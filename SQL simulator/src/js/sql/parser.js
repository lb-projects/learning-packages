/**
 * @file parser.js
 * @description Wandelt Tokens in einen Syntaxbaum (AST) um – rekursiver Abstieg.
 *
 * Unterstützte Anweisungen:
 *   [WITH …] SELECT [UNION|INTERSECT|EXCEPT …], INSERT (VALUES oder Abfrage), UPDATE, DELETE,
 *   CREATE [OR REPLACE] VIEW, DROP VIEW,
 *   CREATE TABLE, CREATE [UNIQUE] INDEX, DROP TABLE, ALTER TABLE (Teilmenge),
 *   sowie Anweisungen aus Datenbank-Exporten, die übersprungen werden
 *   (SET, START TRANSACTION, BEGIN, COMMIT, LOCK/UNLOCK TABLES, USE, CREATE DATABASE).
 *
 * Ausdrücke (Rangfolge von schwach nach stark):
 *   OR < AND < NOT < Vergleich (=, <>, !=, <, <=, >, >=, [NOT] BETWEEN,
 *   [NOT] LIKE, [NOT] IN, IS [NOT] NULL) < + - < * / % < unäres - < Grundausdruck
 *
 * Sicherheit:
 *   Die Verschachtelungstiefe ist begrenzt (MAX_DEPTH), damit sehr tief
 *   geklammerte Eingaben keinen Stapelüberlauf auslösen. Lange Ketten wie
 *   a + b + c … oder … UNION … UNION … ergeben ebenfalls tiefe Syntaxbäume;
 *   deshalb wird nach dem Parsen die Tiefe des ganzen Baums geprüft
 *   (MAX_TREE_DEPTH). Listen in SELECT, GROUP BY und ORDER BY haben höchstens
 *   MAX_LIST_ITEMS Einträge.
 *
 * Abhängigkeiten:
 *   sql/errors.js, sql/lexer.js
 */
(function (ns) {
  'use strict';

  const SqlError = ns.sql.SqlError;
  const suggest = ns.sql.suggest;

  /** Größte erlaubte Verschachtelungstiefe (Klammern, Unterabfragen, NOT, Vorzeichen). */
  const MAX_DEPTH = 32;

  /**
   * Größte erlaubte Tiefe des Syntaxbaums (Knoten mit "type"). Begrenzt die
   * Rekursion aller späteren Durchläufe (Binden, Auswerten).
   */
  const MAX_TREE_DEPTH = 300;

  /** Höchstzahl der Einträge in SELECT-, GROUP-BY- und ORDER-BY-Listen. */
  const MAX_LIST_ITEMS = 250;

  /**
   * Reservierte Wörter: dürfen ohne Backticks nicht als Name oder Alias
   * verwendet werden, weil der Befehl sonst mehrdeutig wäre.
   */
  const RESERVED = new Set([
    'SELECT', 'FROM', 'WHERE', 'GROUP', 'BY', 'HAVING', 'ORDER', 'LIMIT', 'OFFSET',
    'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'CROSS', 'NATURAL', 'ON', 'USING',
    'AS', 'AND', 'OR', 'NOT', 'BETWEEN', 'IN', 'IS', 'NULL', 'LIKE', 'EXISTS', 'DISTINCT', 'ALL',
    'UNION', 'INTERSECT', 'EXCEPT', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
    'CREATE', 'DROP', 'ALTER', 'TABLE', 'ASC', 'DESC', 'TRUE', 'FALSE',
    'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'PRIMARY', 'FOREIGN', 'REFERENCES', 'KEY',
    'DEFAULT', 'UNIQUE', 'CONSTRAINT', 'CHECK', 'INDEX', 'WITH'
  ]);

  /** Schlüsselwörter, mit denen eine Anweisung beginnen kann (für Vorschläge). */
  const STATEMENT_WORDS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER'];

  /** Schlüsselwörter der SELECT-Klauseln in der vorgeschriebenen Reihenfolge. */
  const CLAUSE_WORDS = new Set(['FROM', 'WHERE', 'GROUP', 'HAVING', 'ORDER', 'LIMIT']);

  /** Schlüsselwörter, die in Ausdrücken häufig falsch geschrieben werden. */
  const EXPRESSION_WORDS = ['AND', 'OR', 'NOT', 'BETWEEN', 'LIKE', 'IN', 'IS', 'NULL', 'FROM', 'WHERE',
    'GROUP', 'HAVING', 'ORDER', 'LIMIT', 'JOIN', 'ON', 'AS', 'DISTINCT', 'EXISTS', 'SELECT'];

  /** Anweisungen aus Exporten, die ohne Wirkung übersprungen werden. */
  const IGNORED_START = new Set(['SET', 'START', 'BEGIN', 'COMMIT', 'LOCK', 'UNLOCK', 'USE']);

  /**
   * Beschreibt ein Token für Fehlermeldungen.
   *
   * @param {Object} tok - Token.
   * @returns {string} Beschreibung.
   */
  function describe(tok) {
    switch (tok.type) {
      case 'eof': return 'Ende des Befehls';
      case 'string': return 'Text \'' + (tok.value.length > 20 ? tok.value.slice(0, 20) + '…' : tok.value) + '\'';
      case 'number': return 'Zahl ' + tok.text;
      case 'ident': return '„' + tok.value + '“';
      default: return '„' + tok.value + '“';
    }
  }

  /**
   * Parser für einen Quelltext.
   */
  class Parser {
    /**
     * @param {string} source - Quelltext (für Spaltenüberschriften aus Ausdrücken).
     * @param {Array<Object>} tokens - Tokens aus dem Lexer.
     */
    constructor(source, tokens) {
      this.src = source;
      this.tokens = tokens;
      this.i = 0;
      this.depth = 0;
      this.lastEnd = 0;
      /** Zuletzt ohne AS gelesener Alias (für Hinweise auf Tippfehler in Schlüsselwörtern). */
      this.lastImplicitAlias = null;
    }

    // ----- Hilfsfunktionen für Tokens -----

    peek(k) {
      const idx = Math.min(this.i + (k || 0), this.tokens.length - 1);
      return this.tokens[idx];
    }

    next() {
      const tok = this.tokens[this.i];
      if (tok.type !== 'eof') {
        this.i++;
        this.lastEnd = tok.end;
      }
      return tok;
    }

    isKw(word, k) {
      const tok = this.peek(k);
      return tok.type === 'word' && tok.upper === word;
    }

    acceptKw(word) {
      return this.isKw(word) ? this.next() : null;
    }

    expectKw(word, message) {
      if (this.isKw(word)) {
        return this.next();
      }
      return this.fail(message || ('Erwartet wird „' + word + '“'), [word]);
    }

    isSym(value, k) {
      const tok = this.peek(k);
      return (tok.type === 'punct' || tok.type === 'op') && tok.value === value;
    }

    acceptSym(value) {
      return this.isSym(value) ? this.next() : null;
    }

    expectSym(value, message) {
      if (this.isSym(value)) {
        return this.next();
      }
      return this.fail(message || ('Erwartet wird „' + value + '“'));
    }

    /**
     * Meldet einen Syntaxfehler am aktuellen Token.
     *
     * @param {string} message - Was erwartet wurde.
     * @param {Array<string>} [expectedWords] - Wörter für einen Tippfehler-Vorschlag.
     * @param {string} [hint] - Fester Hinweis.
     * @throws {SqlError} Immer.
     */
    fail(message, expectedWords, hint) {
      const tok = this.peek();
      let finalHint = hint || null;
      if (expectedWords && tok.type === 'word') {
        const s = suggest(tok.value, expectedWords);
        if (s && s.toUpperCase() !== tok.upper) {
          finalHint = 'Meinten Sie „' + s + '“?';
        }
      }
      throw new SqlError(message + ' – gefunden: ' + describe(tok) + '.', tok.pos, finalHint);
    }

    enter() {
      this.depth++;
      if (this.depth > MAX_DEPTH) {
        throw new SqlError('Der Befehl ist zu tief verschachtelt (höchstens ' + MAX_DEPTH + ' Ebenen).', this.peek().pos);
      }
    }

    leave() {
      this.depth--;
    }

    /**
     * Bricht ab, wenn eine Liste bereits MAX_LIST_ITEMS Einträge hat.
     *
     * @param {Array} list - Bisherige Einträge.
     * @param {string} what - Bezeichnung der Liste, z. B. "SELECT-Liste".
     */
    checkListLength(list, what) {
      if (list.length >= MAX_LIST_ITEMS) {
        throw new SqlError('Die ' + what + ' hat zu viele Einträge (höchstens ' + MAX_LIST_ITEMS + ').', this.peek().pos);
      }
    }

    /**
     * Setzt den Quelltext der Tokens [from, to) wieder zusammen: Tokens wie
     * geschrieben, Leerraum und Kommentare dazwischen als ein Leerzeichen.
     * Texte in Anführungszeichen bleiben dadurch unverändert.
     *
     * @param {number} from - Index des ersten Tokens.
     * @param {number} to - Index nach dem letzten Token.
     * @returns {string} Quelltext.
     */
    sourceText(from, to) {
      let out = '';
      for (let k = from; k < to; k++) {
        const tok = this.tokens[k];
        if (k > from && tok.pos.offset > this.tokens[k - 1].end) {
          out += ' ';
        }
        out += this.src.slice(tok.pos.offset, tok.end);
      }
      return out;
    }

    /** Überspringt alle Tokens bis zum Ende der Anweisung. */
    skipStatement() {
      while (!this.isSym(';') && this.peek().type !== 'eof') {
        this.next();
      }
    }

    /**
     * Liest einen Namen (Tabelle, Spalte, Alias).
     *
     * @param {string} what - Bezeichnung für Fehlermeldungen, z. B. "ein Tabellenname".
     * @param {boolean} [allowReserved=false] - Reservierte Wörter zulassen (z. B. nach "t.").
     * @returns {{name:string, pos:Object}} Name und Position.
     */
    parseName(what, allowReserved) {
      const tok = this.peek();
      if (tok.type === 'ident') {
        this.next();
        return { name: tok.value, pos: tok.pos };
      }
      if (tok.type === 'word') {
        if (RESERVED.has(tok.upper) && !allowReserved) {
          this.fail('Erwartet wird ' + what, null,
            '„' + tok.value + '“ ist ein reserviertes SQL-Wort. Als Name muss es in `Backticks` stehen.');
        }
        tok.isName = true;
        this.next();
        return { name: tok.value, pos: tok.pos };
      }
      return this.fail('Erwartet wird ' + what);
    }

    /** @returns {boolean} true, wenn das aktuelle Token als Alias ohne AS gelesen werden kann. */
    canStartAlias() {
      const tok = this.peek();
      return tok.type === 'ident' || (tok.type === 'word' && !RESERVED.has(tok.upper));
    }

    // ----- Skript und Anweisungen -----

    /**
     * Liest alle Anweisungen eines Skripts (getrennt durch ";").
     *
     * @returns {Array<Object>} Anweisungen; jede mit pos und statementIndex.
     */
    parseScript() {
      const statements = [];
      for (;;) {
        while (this.acceptSym(';')) {
          // leere Anweisungen überspringen
        }
        if (this.peek().type === 'eof') {
          break;
        }
        const startTok = this.peek();
        const index = statements.length + 1;
        this.lastImplicitAlias = null;
        let stmt;
        try {
          stmt = this.parseStatement();
          if (!this.isSym(';') && this.peek().type !== 'eof') {
            this.failStatementEnd();
          }
        } catch (error) {
          if (error instanceof SqlError) {
            error.statementIndex = index;
          }
          throw error;
        }
        stmt.pos = startTok.pos;
        stmt.statementIndex = index;
        stmt.text = this.src.slice(startTok.pos.offset, this.lastEnd);
        statements.push(stmt);
      }
      return statements;
    }

    /** Meldet ein unerwartetes Token nach einer vollständigen Anweisung mit passendem Hinweis. */
    failStatementEnd() {
      const tok = this.peek();
      if (tok.type === 'word' && CLAUSE_WORDS.has(tok.upper)) {
        this.fail('„' + tok.value + '“ steht an der falschen Stelle', null,
          'Reihenfolge: SELECT … FROM … WHERE … GROUP BY … HAVING … ORDER BY … LIMIT …');
      }
      // Ein Tippfehler in einem Schlüsselwort wird oft als Alias gelesen: "SELECT name FORM schule".
      const alias = this.lastImplicitAlias;
      if (alias && alias.name.length >= 3) {
        const s = suggest(alias.name, EXPRESSION_WORDS);
        if (s && s.toUpperCase() !== alias.name.toUpperCase()) {
          throw new SqlError('Erwartet wird „;“ oder das Ende des Befehls – gefunden: ' + describe(tok) + '.', alias.pos,
            '„' + alias.name + '“ wurde als Alias (Ersatzname) gelesen. Meinten Sie „' + s + '“?');
        }
      }
      if (tok.type === 'word' || tok.type === 'ident') {
        this.fail('Erwartet wird „;“ oder das Ende des Befehls', EXPRESSION_WORDS,
          'Fehlt ein Komma, ein Operator oder ein Schlüsselwort?');
      }
      this.fail('Erwartet wird „;“ oder das Ende des Befehls');
    }

    parseStatement() {
      const tok = this.peek();
      if (tok.type !== 'word') {
        if (this.startsQuery()) {
          return this.parseQuery();
        }
        if (this.isSym('(')) {
          this.fail('Ein Befehl muss mit einem SQL-Wort beginnen (z. B. SELECT)');
        }
        this.fail('Erwartet wird ein SQL-Befehl (z. B. SELECT)');
      }
      switch (tok.upper) {
        case 'SELECT':
          return this.parseQuery();
        case 'WITH':
          return this.parseQuery({ allowInsert: true });
        case 'INSERT': return this.parseInsert();
        case 'UPDATE': return this.parseUpdate();
        case 'DELETE': return this.parseDelete();
        case 'CREATE': return this.parseCreate();
        case 'DROP': return this.parseDrop();
        case 'ALTER': return this.parseAlter();
        default:
          if (IGNORED_START.has(tok.upper)) {
            this.next();
            this.skipStatement();
            return { type: 'ignored', keyword: tok.upper };
          }
          return this.fail('Erwartet wird ein SQL-Befehl (z. B. SELECT)', STATEMENT_WORDS);
      }
    }

    // ----- SELECT -----

    /** @returns {boolean} true, wenn an Position k eine Abfrage beginnt (SELECT oder WITH). */
    isQueryStart(k) {
      return this.isKw('SELECT', k) || this.isKw('WITH', k);
    }

    /**
     * Liest eine Abfrage: optional "WITH name [(spalten)] AS (abfrage), …", dann SELECT.
     * Rekursive WITH-Abfragen werden nicht unterstützt.
     *
     * @returns {Object} SELECT-Knoten (mit Eigenschaft "with", falls vorhanden).
     */
    parseQuery(options) {
      if (!this.isKw('WITH')) {
        return this.parseSetExpr();
      }
      this.next();
      this.enter();
      if (this.isKw('RECURSIVE')) {
        throw new SqlError('WITH RECURSIVE (rekursive Abfragen) wird in diesem Simulator nicht unterstützt.', this.peek().pos);
      }
      const ctes = [];
      do {
        const name = this.parseName('ein Name für die WITH-Abfrage');
        if (ctes.some((c) => c.name.toLowerCase() === name.name.toLowerCase())) {
          throw new SqlError('Der Name „' + name.name + '“ wird in WITH mehrfach vergeben.', name.pos);
        }
        let columns = null;
        if (this.isSym('(')) {
          this.next();
          columns = [];
          do {
            columns.push(this.parseName('ein Spaltenname'));
          } while (this.acceptSym(','));
          this.expectSym(')', 'Die Spaltenliste wird nicht mit „)“ geschlossen');
        }
        this.expectKw('AS', 'Nach dem Namen der WITH-Abfrage wird „AS (SELECT …)“ erwartet');
        this.expectSym('(', 'Nach AS wird „(“ mit einer Abfrage erwartet');
        if (!this.startsQuery()) {
          this.fail('Erwartet wird eine Abfrage (SELECT …)', ['SELECT']);
        }
        const query = this.parseQuery();
        this.expectSym(')', 'Die WITH-Abfrage wird nicht mit „)“ geschlossen');
        ctes.push({ name: name.name, pos: name.pos, columns, query });
      } while (this.acceptSym(','));
      if (this.isKw('INSERT') && options && options.allowInsert) {
        // WITH … INSERT INTO t (…) SELECT … (wie in PostgreSQL; in MySQL: INSERT … WITH … SELECT)
        const insertTok = this.peek();
        const ins = this.parseInsert();
        if (!ins.query) {
          throw new SqlError('WITH vor INSERT ist nur mit INSERT … SELECT möglich, nicht mit VALUES.', insertTok.pos);
        }
        ins.query.with = ctes.concat(ins.query.with || []);
        this.leave();
        return ins;
      }
      if (!this.isKw('SELECT') && !this.startsQuery()) {
        if (this.isKw('UPDATE') || this.isKw('DELETE') || this.isKw('INSERT')) {
          throw new SqlError('WITH ist hier nur vor SELECT bzw. als WITH … INSERT INTO … SELECT … erlaubt.', this.peek().pos,
            'Zum Einfügen schreiben Sie: WITH … INSERT INTO tabelle (Spalten) SELECT … oder INSERT INTO tabelle (Spalten) WITH … SELECT …');
        }
        this.fail('Nach den WITH-Abfragen wird „SELECT …“ erwartet', ['SELECT']);
      }
      const node = this.parseSetExpr();
      node.with = ctes;
      this.leave();
      return node;
    }

    /**
     * @param {number} [k=0] - Abstand zum aktuellen Token.
     * @returns {boolean} true, wenn dort (nach beliebig vielen "(") eine Abfrage beginnt.
     */
    startsQuery(k) {
      let j = k || 0;
      while (this.isSym('(', j)) {
        j++;
      }
      return this.isQueryStart(j);
    }

    /**
     * Liest Abfragen mit Mengenoperationen: … UNION|EXCEPT [ALL|DISTINCT] …
     * (INTERSECT bindet stärker, wie im SQL-Standard). ORDER BY und LIMIT am
     * Ende gelten für das Gesamtergebnis.
     *
     * @returns {Object} SELECT-Knoten; bei Mengenoperationen mit Eigenschaft "compound".
     */
    parseSetExpr() {
      // Lange UNION-Ketten begrenzt checkTreeDepth nach dem Parsen (MAX_TREE_DEPTH).
      let left = this.parseIntersectExpr();
      while (this.isKw('UNION') || this.isKw('EXCEPT')) {
        left = this.parseSetOp(left, () => this.parseIntersectExpr());
      }
      return this.finishCompound(left);
    }

    /** Liest … INTERSECT [ALL|DISTINCT] … */
    parseIntersectExpr() {
      let left = this.parseQueryTerm();
      while (this.isKw('INTERSECT')) {
        left = this.parseSetOp(left, () => this.parseQueryTerm());
      }
      return left;
    }

    /**
     * Liest einen Mengenoperator und die rechte Seite.
     *
     * @param {Object} left - Linke Seite.
     * @param {function(): Object} parseRight - Liest die rechte Seite.
     * @returns {Object} Verbund-Knoten.
     */
    parseSetOp(left, parseRight) {
      const tok = this.next();
      let all = false;
      if (this.acceptKw('ALL')) {
        all = true;
      } else {
        this.acceptKw('DISTINCT');
      }
      if (!left.compound && !left.parenthesized && (left.orderBy.length > 0 || left.limit)) {
        throw new SqlError('ORDER BY bzw. LIMIT vor ' + tok.upper + ' ist nur in Klammern möglich.', tok.pos,
          'Setzen Sie die Abfrage in Klammern, wenn sie ein eigenes ORDER BY oder LIMIT haben soll: (SELECT … ORDER BY … LIMIT …) ' + tok.upper + ' SELECT …');
      }
      if (!this.startsQuery()) {
        this.fail('Nach ' + tok.upper + ' wird eine Abfrage (SELECT …) erwartet', ['SELECT']);
      }
      this.enter();
      const right = parseRight();
      this.leave();
      return { type: 'select', compound: { op: tok.upper, all, left, right }, orderBy: [], limit: null, with: null, pos: left.pos, opPos: tok.pos };
    }

    /**
     * Ordnet ORDER BY/LIMIT am Ende einem Verbund zu: Stehen sie direkt am
     * letzten Glied ohne Klammern, gelten sie für das Gesamtergebnis (wie MySQL).
     *
     * @param {Object} node - Ergebnis von parseSetExpr.
     * @returns {Object} node.
     */
    finishCompound(node) {
      if (!node.compound) {
        return node;
      }
      let last = node;
      while (last.compound) {
        last = last.compound.right;
      }
      if (!last.parenthesized && (last.orderBy.length > 0 || last.limit)) {
        node.orderBy = last.orderBy;
        node.limit = last.limit;
        last.orderBy = [];
        last.limit = null;
      } else {
        this.parseOrderLimit(node);
      }
      return node;
    }

    /** Liest ein Glied einer Mengenoperation: (Abfrage) oder SELECT …. */
    parseQueryTerm() {
      if (this.isSym('(')) {
        this.next();
        this.enter();
        if (!this.startsQuery()) {
          this.fail('Nach „(“ wird eine Abfrage (SELECT …) erwartet', ['SELECT']);
        }
        const q = this.parseQuery();
        this.expectSym(')', 'Die Klammer um die Abfrage wird nicht mit „)“ geschlossen');
        this.leave();
        q.parenthesized = true;
        return q;
      }
      if (!this.isKw('SELECT')) {
        this.fail('Erwartet wird eine Abfrage (SELECT …)', ['SELECT']);
      }
      return this.parseSelect();
    }

    /** Liest [ORDER BY …] [LIMIT …] in einen Abfrageknoten. */
    parseOrderLimit(node) {
      if (this.isKw('ORDER')) {
        this.next();
        this.expectKw('BY', 'Nach ORDER wird „BY“ erwartet');
        do {
          const expr = this.parseExpr();
          let desc = false;
          if (this.acceptKw('DESC')) {
            desc = true;
          } else {
            this.acceptKw('ASC');
          }
          this.checkListLength(node.orderBy, 'ORDER-BY-Liste');
          node.orderBy.push({ expr, desc });
        } while (this.acceptSym(','));
      }
      if (this.acceptKw('LIMIT')) {
        const a = this.parseLimitNumber();
        if (this.acceptSym(',')) {
          node.limit = { offset: a, count: this.parseLimitNumber() };
        } else {
          let offset = 0;
          if (this.acceptKw('OFFSET')) {
            offset = this.parseLimitNumber();
          }
          node.limit = { offset, count: a };
        }
      }
    }

    parseSelect() {
      this.enter();
      const start = this.expectKw('SELECT');
      const node = {
        type: 'select', pos: start.pos, distinct: false, columns: [], from: null, where: null,
        groupBy: [], having: null, orderBy: [], limit: null
      };
      if (this.acceptKw('DISTINCT')) {
        node.distinct = true;
      } else {
        this.acceptKw('ALL');
      }
      const first = this.peek();
      if (first.type === 'eof' || this.isSym(';') || this.isSym(')') ||
          (first.type === 'word' && CLAUSE_WORDS.has(first.upper))) {
        this.fail('Nach SELECT fehlt die Liste der Spalten (z. B. SELECT * oder SELECT Name, Ort)');
      }
      do {
        this.checkListLength(node.columns, 'SELECT-Liste');
        node.columns.push(this.parseSelectItem());
      } while (this.acceptSym(','));

      if (this.acceptKw('FROM')) {
        node.from = this.parseFromList();
      }
      if (this.acceptKw('WHERE')) {
        node.where = this.parseExpr();
      }
      if (this.isKw('GROUP')) {
        this.next();
        this.expectKw('BY', 'Nach GROUP wird „BY“ erwartet');
        do {
          this.checkListLength(node.groupBy, 'GROUP-BY-Liste');
          node.groupBy.push(this.parseExpr());
        } while (this.acceptSym(','));
      }
      if (this.acceptKw('HAVING')) {
        node.having = this.parseExpr();
      }
      this.parseOrderLimit(node);
      const after = this.peek();
      if (after.type === 'word' && CLAUSE_WORDS.has(after.upper)) {
        this.failStatementEnd();
      }
      this.leave();
      return node;
    }

    parseLimitNumber() {
      const tok = this.peek();
      if (tok.type === 'number' && tok.isInteger && tok.value >= 0) {
        this.next();
        return tok.value;
      }
      return this.fail('Nach LIMIT bzw. OFFSET wird eine ganze Zahl ≥ 0 erwartet');
    }

    parseSelectItem() {
      const start = this.peek();
      if (this.isSym('*')) {
        this.next();
        return { kind: 'star', table: null, pos: start.pos };
      }
      if ((start.type === 'word' || start.type === 'ident') && this.isSym('.', 1) && this.isSym('*', 2)) {
        start.isName = true;
        this.next();
        this.next();
        this.next();
        return { kind: 'star', table: start.value, pos: start.pos };
      }
      const expr = this.parseExpr();
      const text = this.src.slice(start.pos.offset, this.lastEnd).replace(/\s+/g, ' ').trim();
      let alias = null;
      if (this.acceptKw('AS')) {
        alias = this.parseAlias();
      } else if (this.canStartAlias() || this.peek().type === 'string') {
        const aliasTok = this.peek();
        alias = this.parseAlias();
        this.lastImplicitAlias = { name: alias, pos: aliasTok.pos };
      }
      return { kind: 'expr', expr, alias, text, pos: start.pos };
    }

    parseAlias() {
      const tok = this.peek();
      if (tok.type === 'string') {
        this.next();
        if (tok.value.trim() === '') {
          throw new SqlError('Ein Alias darf nicht leer sein.', tok.pos);
        }
        return tok.value.slice(0, ns.sql.MAX_IDENTIFIER_LENGTH);
      }
      return this.parseName('ein Alias (Name)').name;
    }

    // ----- FROM -----

    /** Komma-Liste (impliziter Join); Komma bindet schwächer als JOIN. */
    parseFromList() {
      let left = this.parseJoinChain();
      while (this.isSym(',')) {
        const comma = this.next();
        const right = this.parseJoinChain();
        left = { type: 'join', kind: 'cross', implicit: true, left, right, on: null, pos: comma.pos };
      }
      return left;
    }

    parseJoinChain() {
      let left = this.parseTableRef();
      for (;;) {
        const tok = this.peek();
        let kind = null;
        if (this.isKw('JOIN')) {
          kind = 'inner';
          this.next();
        } else if (this.isKw('INNER')) {
          this.next();
          this.expectKw('JOIN', 'Nach INNER wird „JOIN“ erwartet');
          kind = 'inner';
        } else if (this.isKw('CROSS')) {
          this.next();
          this.expectKw('JOIN', 'Nach CROSS wird „JOIN“ erwartet');
          kind = 'cross';
        } else if (this.isKw('LEFT') || this.isKw('RIGHT')) {
          kind = this.next().upper === 'LEFT' ? 'left' : 'right';
          this.acceptKw('OUTER');
          this.expectKw('JOIN', 'Nach ' + kind.toUpperCase() + ' [OUTER] wird „JOIN“ erwartet');
        } else if (this.isKw('FULL')) {
          throw new SqlError('FULL OUTER JOIN wird nicht unterstützt (auch MySQL kennt ihn nicht). Kombinieren Sie LEFT JOIN und RIGHT JOIN.', tok.pos);
        } else if (this.isKw('NATURAL')) {
          throw new SqlError('NATURAL JOIN wird nicht unterstützt. Verwenden Sie JOIN … ON … mit einer ausdrücklichen Bedingung.', tok.pos);
        } else {
          break;
        }
        const right = this.parseTableRef();
        let on = null;
        if (this.acceptKw('ON')) {
          on = this.parseExpr();
        } else if (this.isKw('USING')) {
          throw new SqlError('USING wird nicht unterstützt. Schreiben Sie die Bedingung mit ON, z. B. ON a.id = b.a_id.', this.peek().pos);
        } else if (kind === 'left' || kind === 'right') {
          this.fail('Nach ' + kind.toUpperCase() + ' JOIN fehlt die Verknüpfungsbedingung „ON …“', ['ON']);
        }
        if (kind === 'cross' && on) {
          kind = 'inner';
        }
        left = { type: 'join', kind, implicit: false, left, right, on, pos: tok.pos };
      }
      return left;
    }

    parseTableRef() {
      const tok = this.peek();
      if (this.isSym('(')) {
        if (!this.startsQuery(1)) {
          this.fail('Nach „(“ in FROM wird eine Unterabfrage (SELECT …) erwartet', null);
        }
        this.next();
        const query = this.parseQuery();
        this.expectSym(')', 'Die Unterabfrage wird nicht mit „)“ geschlossen');
        let alias = null;
        if (this.acceptKw('AS') || this.canStartAlias()) {
          alias = this.parseName('ein Alias für die Unterabfrage').name;
        } else {
          throw new SqlError('Eine Unterabfrage in FROM braucht einen Alias, z. B. (SELECT …) AS t.', this.peek().pos);
        }
        return { type: 'subquery', query, alias, pos: tok.pos };
      }
      let name = this.parseName('ein Tabellenname');
      if (this.isSym('.')) {
        // Datenbankpräfix wie in Exporten (`db`.`tabelle`) – es gibt nur eine Datenbank.
        this.next();
        name = this.parseName('ein Tabellenname nach dem Datenbanknamen', true);
      }
      let alias = null;
      if (this.acceptKw('AS')) {
        alias = this.parseName('ein Alias (Name)').name;
      } else if (this.canStartAlias()) {
        const aliasTok = this.peek();
        alias = this.parseName('ein Alias (Name)').name;
        this.lastImplicitAlias = { name: alias, pos: aliasTok.pos };
      }
      return { type: 'table', name: name.name, alias, pos: name.pos };
    }

    // ----- Ausdrücke -----

    parseExpr() {
      return this.parseOr();
    }

    parseOr() {
      let left = this.parseAnd();
      while (this.isKw('OR')) {
        const op = this.next();
        left = { type: 'binary', op: 'OR', left, right: this.parseAnd(), pos: op.pos };
      }
      return left;
    }

    parseAnd() {
      let left = this.parseNot();
      while (this.isKw('AND')) {
        const op = this.next();
        left = { type: 'binary', op: 'AND', left, right: this.parseNot(), pos: op.pos };
      }
      return left;
    }

    parseNot() {
      if (this.isKw('NOT')) {
        const op = this.next();
        this.enter();
        const operand = this.parseNot();
        this.leave();
        return { type: 'not', operand, pos: op.pos };
      }
      return this.parseComparison();
    }

    parseComparison() {
      let left = this.parseAdditive();
      for (;;) {
        const tok = this.peek();
        if (tok.type === 'op' && ['=', '<>', '!=', '<', '<=', '>', '>='].includes(tok.value)) {
          this.next();
          if (this.isKw('ANY') || this.isKw('ALL') || this.isKw('SOME')) {
            throw new SqlError('ANY/ALL/SOME wird nicht unterstützt. Verwenden Sie IN oder eine Unterabfrage mit MIN/MAX.', this.peek().pos);
          }
          const op = tok.value === '!=' ? '<>' : tok.value;
          left = { type: 'binary', op, left, right: this.parseAdditive(), pos: tok.pos };
          continue;
        }
        if (this.isKw('IS')) {
          this.next();
          const not = !!this.acceptKw('NOT');
          this.expectKw('NULL', 'Nach IS bzw. IS NOT wird „NULL“ erwartet');
          left = { type: 'isnull', expr: left, not, pos: tok.pos };
          continue;
        }
        let not = false;
        if (this.isKw('NOT') && (this.isKw('BETWEEN', 1) || this.isKw('LIKE', 1) || this.isKw('IN', 1))) {
          this.next();
          not = true;
        }
        if (this.isKw('BETWEEN')) {
          this.next();
          const low = this.parseAdditive();
          this.expectKw('AND', 'BETWEEN braucht die Form „BETWEEN untere_Grenze AND obere_Grenze“');
          const high = this.parseAdditive();
          left = { type: 'between', expr: left, low, high, not, pos: tok.pos };
          continue;
        }
        if (this.isKw('LIKE')) {
          this.next();
          left = { type: 'like', expr: left, pattern: this.parseAdditive(), not, pos: tok.pos };
          continue;
        }
        if (this.isKw('IN')) {
          this.next();
          this.expectSym('(', 'Nach IN wird „(“ mit einer Werteliste oder Unterabfrage erwartet');
          this.enter();
          if (this.isQueryStart()) {
            const query = this.parseQuery();
            this.expectSym(')', 'Die Unterabfrage wird nicht mit „)“ geschlossen');
            left = { type: 'in', expr: left, list: null, query, not, pos: tok.pos };
          } else {
            const list = [];
            if (this.isSym(')')) {
              this.fail('Die Werteliste nach IN darf nicht leer sein');
            }
            do {
              list.push(this.parseExpr());
            } while (this.acceptSym(','));
            this.expectSym(')', 'Die Werteliste nach IN wird nicht mit „)“ geschlossen');
            left = { type: 'in', expr: left, list, query: null, not, pos: tok.pos };
          }
          this.leave();
          continue;
        }
        if (not) {
          this.fail('Erwartet wird BETWEEN, LIKE oder IN');
        }
        break;
      }
      return left;
    }

    parseAdditive() {
      // Ketten wie a + b + c werden links-tief aufgebaut; ihre Tiefe begrenzt checkTreeDepth nach dem Parsen.
      let left = this.parseMultiplicative();
      while (this.isSym('+') || this.isSym('-')) {
        const op = this.next();
        left = { type: 'binary', op: op.value, left, right: this.parseMultiplicative(), pos: op.pos };
      }
      return left;
    }

    parseMultiplicative() {
      let left = this.parseUnary();
      while (this.isSym('*') || this.isSym('/') || this.isSym('%')) {
        const op = this.next();
        left = { type: 'binary', op: op.value, left, right: this.parseUnary(), pos: op.pos };
      }
      return left;
    }

    parseUnary() {
      if (this.isSym('-') || this.isSym('+')) {
        const op = this.next();
        this.enter();
        const operand = this.parseUnary();
        this.leave();
        if (op.value === '+') {
          return operand;
        }
        if (operand.type === 'literal' && typeof operand.value === 'number') {
          return { type: 'literal', value: -operand.value, isInteger: operand.isInteger, pos: op.pos };
        }
        return { type: 'neg', operand, pos: op.pos };
      }
      return this.parsePrimary();
    }

    parsePrimary() {
      const tok = this.peek();
      if (tok.type === 'number') {
        this.next();
        return { type: 'literal', value: tok.value, isInteger: tok.isInteger, pos: tok.pos };
      }
      if (tok.type === 'string') {
        this.next();
        return { type: 'literal', value: tok.value, pos: tok.pos };
      }
      if (this.isSym('(')) {
        this.next();
        this.enter();
        let node;
        if (this.isQueryStart()) {
          node = { type: 'subquery', query: this.parseQuery(), pos: tok.pos };
          this.expectSym(')', 'Die Unterabfrage wird nicht mit „)“ geschlossen');
        } else {
          node = this.parseExpr();
          this.expectSym(')', 'Die Klammer wird nicht mit „)“ geschlossen');
        }
        this.leave();
        return node;
      }
      if (tok.type === 'word') {
        switch (tok.upper) {
          case 'NULL':
            this.next();
            return { type: 'literal', value: null, pos: tok.pos };
          case 'TRUE':
          case 'FALSE':
            this.next();
            return { type: 'literal', value: tok.upper === 'TRUE' ? 1 : 0, isInteger: true, pos: tok.pos };
          case 'EXISTS': {
            this.next();
            this.expectSym('(', 'Nach EXISTS wird „(SELECT …)“ erwartet');
            this.enter();
            if (!this.isQueryStart()) {
              this.fail('Nach EXISTS ( wird eine Abfrage (SELECT …) erwartet', ['SELECT']);
            }
            const query = this.parseQuery();
            this.expectSym(')', 'Die Unterabfrage wird nicht mit „)“ geschlossen');
            this.leave();
            return { type: 'exists', query, pos: tok.pos };
          }
          case 'CASE':
            return this.parseCase();
          default:
            break;
        }
        if (this.isSym('(', 1)) {
          return this.parseFunction();
        }
      }
      if (tok.type === 'word' || tok.type === 'ident') {
        if (tok.type === 'word' && RESERVED.has(tok.upper)) {
          this.fail('Erwartet wird ein Ausdruck (z. B. ein Spaltenname, eine Zahl oder ein Text)', null,
            '„' + tok.value + '“ ist ein SQL-Schlüsselwort. Fehlt davor eine Spalte oder ein Wert?');
        }
        tok.isName = true;
        this.next();
        if (this.isSym('.')) {
          this.next();
          if (this.isSym('*')) {
            throw new SqlError(tok.value + '.* ist nur direkt in der SELECT-Liste erlaubt.', tok.pos);
          }
          const column = this.parseName('ein Spaltenname nach „' + tok.value + '.“', true);
          if (this.isSym('.')) {
            // Datenbankpräfix wie in Exporten (`db`.`tabelle`.`spalte`) – wird ignoriert.
            this.next();
            const inner = this.parseName('ein Spaltenname nach „' + tok.value + '.' + column.name + '.“', true);
            return { type: 'column', table: column.name, name: inner.name, pos: tok.pos };
          }
          return { type: 'column', table: tok.value, name: column.name, pos: tok.pos };
        }
        return { type: 'column', table: null, name: tok.value, pos: tok.pos };
      }
      if (this.isSym('*')) {
        this.fail('„*“ ist hier nicht erlaubt', null, '„*“ steht nur direkt nach SELECT oder in COUNT(*).');
      }
      if (this.isSym('@')) {
        this.fail('Erwartet wird ein Ausdruck (z. B. ein Spaltenname, eine Zahl oder ein Text)', null, 'Variablen wie @name werden in diesem Simulator nicht unterstützt.');
      }
      return this.fail('Erwartet wird ein Ausdruck (z. B. ein Spaltenname, eine Zahl oder ein Text)', EXPRESSION_WORDS);
    }

    parseFunction() {
      const nameTok = this.next();
      this.next(); // "("
      this.enter();
      const node = { type: 'func', name: nameTok.upper, args: [], distinct: false, star: false, pos: nameTok.pos };
      if (this.isSym('*')) {
        this.next();
        node.star = true;
      } else if (!this.isSym(')')) {
        if (this.acceptKw('DISTINCT')) {
          node.distinct = true;
        }
        do {
          node.args.push(this.parseExpr());
        } while (this.acceptSym(','));
      }
      this.expectSym(')', 'Die Klammer der Funktion ' + nameTok.upper + ' wird nicht mit „)“ geschlossen');
      if (this.isKw('OVER')) {
        node.over = this.parseOver(nameTok.upper);
      }
      this.leave();
      return node;
    }

    /**
     * Liest "OVER ( [PARTITION BY …] [ORDER BY …] )" einer Fensterfunktion.
     *
     * @param {string} fn - Name der Funktion (für Meldungen).
     * @returns {{partition:Array<Object>, order:Array<{expr:Object, desc:boolean}>, pos:Object}} Fenster.
     */
    parseOver(fn) {
      const over = this.next();
      if (!this.isSym('(')) {
        if (this.peek().type === 'word' || this.peek().type === 'ident') {
          throw new SqlError('Benannte Fenster (OVER name / WINDOW …) werden nicht unterstützt.', this.peek().pos,
            'Schreiben Sie das Fenster direkt: ' + fn + '(…) OVER (PARTITION BY … ORDER BY …).');
        }
        this.fail('Nach OVER wird „(“ erwartet');
      }
      this.next();
      const win = { partition: [], order: [], pos: over.pos };
      if (this.isKw('PARTITION')) {
        this.next();
        this.expectKw('BY', 'Nach PARTITION wird „BY“ erwartet');
        do {
          win.partition.push(this.parseExpr());
        } while (this.acceptSym(','));
      }
      if (this.isKw('ORDER')) {
        this.next();
        this.expectKw('BY', 'Nach ORDER wird „BY“ erwartet');
        do {
          const expr = this.parseExpr();
          let desc = false;
          if (this.acceptKw('DESC')) {
            desc = true;
          } else {
            this.acceptKw('ASC');
          }
          win.order.push({ expr, desc });
        } while (this.acceptSym(','));
      }
      if (this.isKw('ROWS') || this.isKw('RANGE') || this.isKw('GROUPS')) {
        throw new SqlError('Rahmenangaben (ROWS/RANGE …) in Fensterfunktionen werden nicht unterstützt.', this.peek().pos,
          'Ohne Rahmenangabe gilt: ohne ORDER BY die ganze Partition, mit ORDER BY alle Zeilen bis einschließlich der aktuellen.');
      }
      this.expectSym(')', 'Das Fenster nach OVER wird nicht mit „)“ geschlossen');
      return win;
    }

    /**
     * Liest CASE [ausdruck] WHEN … THEN … [WHEN … THEN …] [ELSE …] END.
     *
     * @returns {Object} Knoten {type:'case', operand, whens, otherwise, pos}.
     */
    parseCase() {
      const start = this.next();
      this.enter();
      const operand = this.isKw('WHEN') ? null : this.parseExpr();
      const whens = [];
      while (this.acceptKw('WHEN')) {
        const when = this.parseExpr();
        this.expectKw('THEN', 'Nach WHEN … wird „THEN“ erwartet');
        whens.push({ when, then: this.parseExpr() });
      }
      if (whens.length === 0) {
        this.fail('Nach CASE wird „WHEN“ erwartet', ['WHEN'], 'Form: CASE WHEN Bedingung THEN Wert … ELSE Wert END');
      }
      const otherwise = this.acceptKw('ELSE') ? this.parseExpr() : null;
      this.expectKw('END', 'CASE wird mit „END“ abgeschlossen');
      this.leave();
      return { type: 'case', operand, whens, otherwise, pos: start.pos };
    }

    // ----- INSERT / UPDATE / DELETE -----

    parseInsert() {
      const start = this.next();
      if (this.isKw('IGNORE')) {
        throw new SqlError('INSERT IGNORE wird nicht unterstützt.', this.peek().pos);
      }
      this.expectKw('INTO', 'Nach INSERT wird „INTO“ erwartet');
      const table = this.parseName('ein Tabellenname');
      let columns = null;
      if (this.isSym('(') && !this.startsQuery(1)) {
        this.next();
        columns = [];
        do {
          columns.push(this.parseName('ein Spaltenname'));
        } while (this.acceptSym(','));
        this.expectSym(')', 'Die Spaltenliste wird nicht mit „)“ geschlossen');
      }
      // INSERT … SELECT (auch geklammert, mit WITH oder Mengenoperationen)
      const query = this.startsQuery() ? this.parseQuery() : null;
      if (query) {
        if (this.isKw('ON')) {
          throw new SqlError('ON DUPLICATE KEY UPDATE wird nicht unterstützt.', this.peek().pos);
        }
        return { type: 'insert', table: table.name, tablePos: table.pos, columns, rows: null, query, pos: start.pos };
      }
      if (this.isKw('SET')) {
        throw new SqlError('INSERT … SET wird nicht unterstützt. Verwenden Sie INSERT INTO t (Spalten) VALUES (…).', this.peek().pos);
      }
      if (!this.acceptKw('VALUES') && !this.acceptKw('VALUE')) {
        this.fail('Erwartet wird „VALUES“', ['VALUES']);
      }
      const rows = [];
      do {
        const rowStart = this.expectSym('(', 'Erwartet wird „(“ vor den Werten');
        const values = [];
        if (this.isSym(')')) {
          this.fail('Die Werteliste darf nicht leer sein');
        }
        do {
          values.push(this.parseExpr());
        } while (this.acceptSym(','));
        this.expectSym(')', 'Die Werteliste wird nicht mit „)“ geschlossen – fehlt ein Komma zwischen den Werten?');
        rows.push({ values, pos: rowStart.pos });
      } while (this.acceptSym(','));
      if (this.isKw('ON')) {
        throw new SqlError('ON DUPLICATE KEY UPDATE wird nicht unterstützt.', this.peek().pos);
      }
      return { type: 'insert', table: table.name, tablePos: table.pos, columns, rows, pos: start.pos };
    }

    parseUpdate() {
      const start = this.next();
      const table = this.parseName('ein Tabellenname');
      let alias = null;
      if (this.acceptKw('AS') || this.canStartAlias()) {
        alias = this.parseName('ein Alias (Name)').name;
      }
      this.expectKw('SET', 'Nach UPDATE Tabelle wird „SET“ erwartet');
      const sets = [];
      do {
        const first = this.parseName('ein Spaltenname');
        let qualifier = null;
        let column = first;
        if (this.acceptSym('.')) {
          qualifier = first.name;
          column = this.parseName('ein Spaltenname', true);
        }
        this.expectSym('=', 'Nach dem Spaltennamen wird „=“ erwartet');
        sets.push({ table: qualifier, column: column.name, pos: column.pos, expr: this.parseExpr() });
      } while (this.acceptSym(','));
      let where = null;
      if (this.acceptKw('WHERE')) {
        where = this.parseExpr();
      }
      if (this.isKw('ORDER') || this.isKw('LIMIT')) {
        throw new SqlError('ORDER BY und LIMIT werden bei UPDATE nicht unterstützt.', this.peek().pos);
      }
      return { type: 'update', table: table.name, tablePos: table.pos, alias, sets, where, pos: start.pos };
    }

    parseDelete() {
      const start = this.next();
      this.expectKw('FROM', 'Nach DELETE wird „FROM“ erwartet');
      const table = this.parseName('ein Tabellenname');
      let alias = null;
      if (this.acceptKw('AS') || this.canStartAlias()) {
        alias = this.parseName('ein Alias (Name)').name;
      }
      let where = null;
      if (this.acceptKw('WHERE')) {
        where = this.parseExpr();
      }
      if (this.isKw('ORDER') || this.isKw('LIMIT')) {
        throw new SqlError('ORDER BY und LIMIT werden bei DELETE nicht unterstützt.', this.peek().pos);
      }
      return { type: 'delete', table: table.name, tablePos: table.pos, alias, where, pos: start.pos };
    }

    // ----- CREATE / DROP / ALTER -----

    parseCreate() {
      const start = this.next();
      let orReplace = false;
      if (this.isKw('OR')) {
        this.next();
        this.expectKw('REPLACE', 'Erwartet wird „OR REPLACE“');
        orReplace = true;
      }
      const viewOptions = this.skipViewOptions();
      if (this.isKw('VIEW')) {
        return this.parseCreateView(start, orReplace);
      }
      if (orReplace || viewOptions) {
        this.fail('Erwartet wird „VIEW“', ['VIEW']);
      }
      if (this.isKw('DATABASE') || this.isKw('SCHEMA')) {
        this.next();
        this.skipStatement();
        return { type: 'ignored', keyword: 'CREATE DATABASE' };
      }
      if (this.isKw('TEMPORARY')) {
        throw new SqlError('CREATE TEMPORARY TABLE wird nicht unterstützt.', this.peek().pos);
      }
      if (this.isKw('UNIQUE') || this.isKw('INDEX')) {
        const unique = !!this.acceptKw('UNIQUE');
        this.expectKw('INDEX', 'Erwartet wird „INDEX“');
        this.parseName('ein Indexname');
        this.expectKw('ON', 'Erwartet wird „ON Tabelle (Spalten)“');
        const table = this.parseName('ein Tabellenname');
        const columns = this.parseKeyColumns();
        return { type: 'createIndex', unique, table: table.name, tablePos: table.pos, columns, pos: start.pos };
      }
      this.expectKw('TABLE', 'Nach CREATE wird „TABLE“ oder „VIEW“ erwartet');
      let ifNotExists = false;
      if (this.isKw('IF')) {
        this.next();
        this.expectKw('NOT', 'Erwartet wird „IF NOT EXISTS“');
        this.expectKw('EXISTS', 'Erwartet wird „IF NOT EXISTS“');
        ifNotExists = true;
      }
      const name = this.parseName('ein Tabellenname');
      if (this.isKw('LIKE') || this.isKw('AS') || this.isKw('SELECT')) {
        throw new SqlError('CREATE TABLE … LIKE/AS/SELECT wird nicht unterstützt.', this.peek().pos);
      }
      this.expectSym('(', 'Nach dem Tabellennamen wird „(“ mit der Spaltenliste erwartet');
      const columns = [];
      const constraints = [];
      do {
        const element = this.parseTableElement();
        if (element.kind === 'column') {
          columns.push(element.column);
        } else if (element.kind !== 'ignore') {
          constraints.push(element);
        }
      } while (this.acceptSym(','));
      this.expectSym(')', 'Die Spaltenliste wird nicht mit „)“ geschlossen – fehlt ein Komma?');
      this.skipTableOptions();
      return { type: 'createTable', name: name.name, namePos: name.pos, ifNotExists, columns, constraints, pos: start.pos };
    }

    /**
     * Überspringt View-Optionen aus Exporten:
     * ALGORITHM=…, DEFINER=`user`@`host` bzw. CURRENT_USER, SQL SECURITY DEFINER|INVOKER.
     *
     * @returns {boolean} true, wenn mindestens eine Option gelesen wurde.
     */
    skipViewOptions() {
      let found = false;
      const value = (what) => {
        const t = this.peek();
        if (t.type !== 'word' && t.type !== 'ident' && t.type !== 'string') {
          this.fail('Erwartet wird ' + what);
        }
        this.next();
      };
      for (;;) {
        if (this.isKw('ALGORITHM')) {
          this.next();
          this.expectSym('=', 'Nach ALGORITHM wird „=“ erwartet');
          value('ein Algorithmus (z. B. UNDEFINED)');
        } else if (this.isKw('DEFINER')) {
          this.next();
          this.expectSym('=', 'Nach DEFINER wird „=“ erwartet');
          value('ein Benutzername');
          if (this.acceptSym('@')) {
            value('ein Rechnername');
          } else if (this.acceptSym('(')) {
            this.expectSym(')', 'Erwartet wird „)“');
          }
        } else if (this.isKw('SQL') && this.isKw('SECURITY', 1)) {
          this.next();
          this.next();
          if (!this.acceptKw('DEFINER') && !this.acceptKw('INVOKER')) {
            this.fail('Nach SQL SECURITY wird DEFINER oder INVOKER erwartet');
          }
        } else {
          return found;
        }
        found = true;
      }
    }

    /**
     * Liest CREATE [OR REPLACE] VIEW name [(spalten)] AS abfrage [WITH [CASCADED|LOCAL] CHECK OPTION].
     *
     * @param {Object} start - Token "CREATE".
     * @param {boolean} orReplace - OR REPLACE angegeben.
     * @returns {Object} Anweisung {type:'createView', …}.
     */
    parseCreateView(start, orReplace) {
      this.next(); // VIEW
      let ifNotExists = false;
      if (this.isKw('IF')) {
        this.next();
        this.expectKw('NOT', 'Erwartet wird „IF NOT EXISTS“');
        this.expectKw('EXISTS', 'Erwartet wird „IF NOT EXISTS“');
        ifNotExists = true;
      }
      const name = this.parseName('ein Name für die Sicht');
      let columns = null;
      if (this.isSym('(')) {
        this.next();
        columns = [];
        do {
          columns.push(this.parseName('ein Spaltenname'));
        } while (this.acceptSym(','));
        this.expectSym(')', 'Die Spaltenliste wird nicht mit „)“ geschlossen');
      }
      this.expectKw('AS', 'Nach dem Namen der Sicht wird „AS SELECT …“ erwartet');
      if (!this.startsQuery()) {
        this.fail('Nach AS wird eine Abfrage (SELECT …) erwartet', ['SELECT']);
      }
      const first = this.i;
      const query = this.parseQuery();
      const text = this.sourceText(first, this.i);
      if (this.isKw('WITH')) {
        this.next();
        if (!this.acceptKw('CASCADED')) {
          this.acceptKw('LOCAL');
        }
        this.expectKw('CHECK', 'Erwartet wird „WITH CHECK OPTION“');
        this.expectKw('OPTION', 'Erwartet wird „WITH CHECK OPTION“');
      }
      return { type: 'createView', name: name.name, namePos: name.pos, columns, orReplace, ifNotExists, query, queryText: text, pos: start.pos };
    }

    /** Überspringt Tabellenoptionen wie ENGINE=InnoDB DEFAULT CHARSET=utf8mb4. */
    skipTableOptions() {
      while (!this.isSym(';') && this.peek().type !== 'eof') {
        const tok = this.peek();
        if (tok.type === 'word' || tok.type === 'ident' || tok.type === 'number' || tok.type === 'string' ||
            this.isSym('=') || this.isSym(',')) {
          this.next();
        } else {
          this.fail('Unerwartete Angabe nach der Tabellendefinition');
        }
      }
    }

    /** Liest eine Spaltendefinition oder ein Tabellen-Constraint. */
    parseTableElement() {
      const tok = this.peek();
      if (tok.type === 'word') {
        let name = null;
        if (tok.upper === 'CONSTRAINT') {
          this.next();
          if (!this.isKw('PRIMARY') && !this.isKw('UNIQUE') && !this.isKw('FOREIGN') && !this.isKw('CHECK')) {
            name = this.parseName('ein Name für das Constraint').name;
          }
        }
        const t = this.peek();
        if (t.type === 'word') {
          switch (t.upper) {
            case 'PRIMARY':
              this.next();
              this.expectKw('KEY', 'Nach PRIMARY wird „KEY“ erwartet');
              return { kind: 'pk', columns: this.parseKeyColumns(), pos: t.pos, name };
            case 'UNIQUE':
              this.next();
              if (!this.acceptKw('KEY')) {
                this.acceptKw('INDEX');
              }
              if (!this.isSym('(')) {
                this.parseName('ein Indexname');
              }
              return { kind: 'unique', columns: this.parseKeyColumns(), pos: t.pos, name };
            case 'FOREIGN':
              this.next();
              this.expectKw('KEY', 'Nach FOREIGN wird „KEY“ erwartet');
              if (!this.isSym('(')) {
                this.parseName('ein Name');
              }
              return Object.assign({ kind: 'fk', columns: this.parseKeyColumns(), pos: t.pos, name }, this.parseReferences());
            case 'KEY':
            case 'INDEX':
              this.next();
              if (!this.isSym('(')) {
                this.parseName('ein Indexname');
              }
              return { kind: 'index', columns: this.parseKeyColumns(), pos: t.pos };
            case 'CHECK':
              return this.parseCheck(name);
            case 'FULLTEXT':
            case 'SPATIAL':
              throw new SqlError(t.upper + '-Indizes werden nicht unterstützt.', t.pos);
            default:
              if (name !== null) {
                this.fail('Nach CONSTRAINT Name wird PRIMARY KEY, UNIQUE, FOREIGN KEY oder CHECK erwartet');
              }
          }
        }
      }
      return { kind: 'column', column: this.parseColumnDef() };
    }

    /**
     * Liest "CHECK (Bedingung) [[NOT] ENFORCED]".
     *
     * @param {string|null} name - Name aus "CONSTRAINT name" oder null.
     * @returns {Object} Constraint {kind:'check', name, expr, text, enforced, pos}.
     */
    parseCheck(name) {
      const start = this.expectKw('CHECK', 'Erwartet wird „CHECK (Bedingung)“');
      const open = this.expectSym('(', 'Nach CHECK wird „(“ mit einer Bedingung erwartet');
      this.enter();
      if (this.isSym(')')) {
        this.fail('Die Bedingung nach CHECK darf nicht leer sein');
      }
      const firstIndex = this.i;
      const expr = this.parseExpr();
      const text = this.sourceText(firstIndex, this.i);
      this.expectSym(')', 'Die Bedingung nach CHECK wird nicht mit „)“ geschlossen');
      this.leave();
      let enforced = true;
      if (this.isKw('NOT') && this.isKw('ENFORCED', 1)) {
        this.next();
        this.next();
        enforced = false;
      } else {
        this.acceptKw('ENFORCED');
      }
      return { kind: 'check', name, expr, text, enforced, pos: start.pos, openPos: open.pos };
    }

    /** Liest "(a, b)" in Schlüsseldefinitionen; Präfixlängen wie name(10) und ASC/DESC sind erlaubt. */
    parseKeyColumns() {
      this.expectSym('(', 'Erwartet wird „(“ mit Spaltennamen');
      const columns = [];
      do {
        columns.push(this.parseName('ein Spaltenname'));
        if (this.isSym('(')) {
          this.next();
          const tok = this.peek();
          if (tok.type !== 'number') {
            this.fail('Erwartet wird eine Länge');
          }
          this.next();
          this.expectSym(')', 'Erwartet wird „)“');
        }
        if (!this.acceptKw('ASC')) {
          this.acceptKw('DESC');
        }
      } while (this.acceptSym(','));
      this.expectSym(')', 'Die Spaltenliste wird nicht mit „)“ geschlossen');
      return columns;
    }

    /** Liest "REFERENCES t (spalten) [ON DELETE …] [ON UPDATE …]". */
    parseReferences() {
      this.expectKw('REFERENCES', 'Erwartet wird „REFERENCES Tabelle (Spalte)“');
      const refTable = this.parseName('ein Tabellenname');
      let refColumns = [];
      if (this.isSym('(')) {
        refColumns = this.parseKeyColumns();
      }
      while (this.isKw('ON')) {
        this.next();
        if (!this.acceptKw('DELETE') && !this.acceptKw('UPDATE')) {
          this.fail('Nach ON wird DELETE oder UPDATE erwartet');
        }
        if (this.acceptKw('CASCADE') || this.acceptKw('RESTRICT')) {
          continue;
        }
        if (this.acceptKw('SET')) {
          if (!this.acceptKw('NULL') && !this.acceptKw('DEFAULT')) {
            this.fail('Nach SET wird NULL oder DEFAULT erwartet');
          }
          continue;
        }
        if (this.acceptKw('NO')) {
          this.expectKw('ACTION', 'Erwartet wird „NO ACTION“');
          continue;
        }
        this.fail('Erwartet wird CASCADE, RESTRICT, SET NULL oder NO ACTION');
      }
      return { refTable: refTable.name, refColumns: refColumns.map((c) => c.name) };
    }

    /** Liest eine Spaltendefinition: Name Typ [Optionen]. */
    parseColumnDef() {
      const name = this.parseName('ein Spaltenname');
      const type = this.parseType();
      const col = {
        name: name.name, pos: name.pos, type, notNull: false, defaultValue: undefined,
        primaryKey: false, autoIncrement: false, unique: false, references: null, checks: []
      };
      for (;;) {
        const tok = this.peek();
        if (tok.type !== 'word') {
          break;
        }
        switch (tok.upper) {
          case 'NOT':
            this.next();
            this.expectKw('NULL', 'Nach NOT wird „NULL“ erwartet');
            col.notNull = true;
            break;
          case 'NULL':
            this.next();
            break;
          case 'DEFAULT':
            this.next();
            col.defaultValue = this.parseDefaultValue();
            break;
          case 'AUTO_INCREMENT':
            this.next();
            col.autoIncrement = true;
            break;
          case 'PRIMARY':
            this.next();
            this.expectKw('KEY', 'Nach PRIMARY wird „KEY“ erwartet');
            col.primaryKey = true;
            break;
          case 'KEY':
            this.next();
            col.primaryKey = true;
            break;
          case 'UNIQUE':
            this.next();
            this.acceptKw('KEY');
            col.unique = true;
            break;
          case 'COMMENT':
            this.next();
            if (this.peek().type !== 'string') {
              this.fail('Nach COMMENT wird ein Text erwartet');
            }
            this.next();
            break;
          case 'COLLATE':
            this.next();
            this.parseName('eine Sortierung');
            break;
          case 'CHARACTER':
            this.next();
            this.expectKw('SET', 'Erwartet wird „CHARACTER SET“');
            this.parseName('ein Zeichensatz');
            break;
          case 'CHARSET':
            this.next();
            this.parseName('ein Zeichensatz');
            break;
          case 'ON':
            this.next();
            this.expectKw('UPDATE', 'Erwartet wird „ON UPDATE“');
            this.parseDefaultValue();
            break;
          case 'REFERENCES':
            col.references = this.parseReferences();
            break;
          case 'CHECK':
            col.checks.push(this.parseCheck(null));
            break;
          case 'CONSTRAINT': {
            this.next();
            const cname = this.isKw('CHECK') ? null : this.parseName('ein Name für das Constraint').name;
            if (!this.isKw('CHECK')) {
              this.fail('In einer Spaltendefinition wird nach CONSTRAINT Name „CHECK (Bedingung)“ erwartet', ['CHECK']);
            }
            col.checks.push(this.parseCheck(cname));
            break;
          }
          default:
            return col;
        }
      }
      return col;
    }

    /** Liest einen Standardwert (Literal, NULL, TRUE/FALSE oder CURRENT_TIMESTAMP). */
    parseDefaultValue() {
      let sign = 1;
      if (this.isSym('-')) {
        this.next();
        sign = -1;
      }
      const t = this.peek();
      if (t.type === 'number') {
        this.next();
        return { value: sign * t.value };
      }
      if (sign === -1) {
        this.fail('Nach „-“ wird eine Zahl erwartet');
      }
      if (t.type === 'string') {
        this.next();
        return { value: t.value };
      }
      if (t.type === 'word') {
        if (t.upper === 'NULL') {
          this.next();
          return { value: null };
        }
        if (t.upper === 'TRUE' || t.upper === 'FALSE') {
          this.next();
          return { value: t.upper === 'TRUE' ? 1 : 0 };
        }
        if (t.upper === 'CURRENT_TIMESTAMP' || t.upper === 'NOW' || t.upper === 'CURRENT_DATE') {
          this.next();
          if (this.acceptSym('(')) {
            this.expectSym(')', 'Erwartet wird „)“');
          }
          return { value: null, now: t.upper === 'CURRENT_DATE' ? 'date' : 'datetime' };
        }
      }
      return this.fail('Erwartet wird ein Standardwert (Zahl, Text oder NULL)');
    }

    /** Liest einen Datentyp, z. B. VARCHAR(50), DECIMAL(8,2), INT(11) UNSIGNED, ENUM('a','b'). */
    parseType() {
      const tok = this.peek();
      if (tok.type !== 'word') {
        this.fail('Erwartet wird ein Datentyp (z. B. INT, VARCHAR(50), DATE)');
      }
      this.next();
      let name = tok.upper;
      if (name === 'DOUBLE' && this.isKw('PRECISION')) {
        this.next();
      }
      if (name === 'CHARACTER' && this.isKw('VARYING')) {
        this.next();
        name = 'VARCHAR';
      }
      const type = { name, args: [], values: null, unsigned: false, pos: tok.pos };
      if (this.isSym('(')) {
        this.next();
        if (name === 'ENUM' || name === 'SET') {
          type.values = [];
          do {
            const v = this.peek();
            if (v.type !== 'string') {
              this.fail('Erwartet wird ein Text in Anführungszeichen');
            }
            this.next();
            type.values.push(v.value);
          } while (this.acceptSym(','));
        } else {
          do {
            const v = this.peek();
            if (v.type !== 'number' || !v.isInteger) {
              this.fail('Erwartet wird eine ganze Zahl als Typangabe');
            }
            this.next();
            type.args.push(v.value);
          } while (this.acceptSym(','));
        }
        this.expectSym(')', 'Die Typangabe wird nicht mit „)“ geschlossen');
      }
      for (;;) {
        if (this.acceptKw('UNSIGNED')) {
          type.unsigned = true;
        } else if (!this.acceptKw('SIGNED') && !this.acceptKw('ZEROFILL') && !this.acceptKw('BINARY')) {
          break;
        }
      }
      return type;
    }

    parseDrop() {
      const start = this.next();
      if (this.isKw('DATABASE') || this.isKw('SCHEMA')) {
        throw new SqlError('DROP DATABASE wird nicht unterstützt. Löschen Sie einzelne Tabellen mit DROP TABLE.', this.peek().pos);
      }
      if (this.isKw('INDEX')) {
        throw new SqlError('DROP INDEX wird nicht unterstützt.', this.peek().pos);
      }
      if (this.acceptKw('VIEW')) {
        let ifExists = false;
        if (this.isKw('IF')) {
          this.next();
          this.expectKw('EXISTS', 'Erwartet wird „IF EXISTS“');
          ifExists = true;
        }
        const names = [];
        do {
          names.push(this.parseName('ein Name einer Sicht'));
        } while (this.acceptSym(','));
        if (!this.acceptKw('CASCADE')) {
          this.acceptKw('RESTRICT');
        }
        return { type: 'dropView', names, ifExists, pos: start.pos };
      }
      this.expectKw('TABLE', 'Nach DROP wird „TABLE“ oder „VIEW“ erwartet');
      let ifExists = false;
      if (this.isKw('IF')) {
        this.next();
        this.expectKw('EXISTS', 'Erwartet wird „IF EXISTS“');
        ifExists = true;
      }
      const names = [];
      do {
        names.push(this.parseName('ein Tabellenname'));
      } while (this.acceptSym(','));
      if (!this.acceptKw('CASCADE')) {
        this.acceptKw('RESTRICT');
      }
      return { type: 'dropTable', names, ifExists, pos: start.pos };
    }

    parseAlter() {
      const start = this.next();
      this.expectKw('TABLE', 'Nach ALTER wird „TABLE“ erwartet');
      const table = this.parseName('ein Tabellenname');
      const actions = [];
      do {
        actions.push(this.parseAlterAction());
      } while (this.acceptSym(','));
      return { type: 'alterTable', table: table.name, tablePos: table.pos, actions, pos: start.pos };
    }

    parseAlterAction() {
      const tok = this.peek();
      const unsupported = 'ALTER TABLE unterstützt hier nur ADD PRIMARY KEY, ADD [UNIQUE] KEY/INDEX, ADD FOREIGN KEY, ADD COLUMN und MODIFY';
      if (this.acceptKw('ADD')) {
        const t = this.peek();
        if (t.type === 'word' && ['PRIMARY', 'UNIQUE', 'FOREIGN', 'KEY', 'INDEX', 'CONSTRAINT', 'CHECK', 'FULLTEXT', 'SPATIAL'].includes(t.upper)) {
          return { kind: 'addConstraint', constraint: this.parseTableElement(), pos: t.pos };
        }
        this.acceptKw('COLUMN');
        const column = this.parseColumnDef();
        if (this.isKw('FIRST') || this.isKw('AFTER')) {
          throw new SqlError('FIRST/AFTER wird nicht unterstützt; neue Spalten werden immer hinten angefügt.', this.peek().pos);
        }
        return { kind: 'addColumn', column, pos: t.pos };
      }
      if (this.acceptKw('MODIFY')) {
        this.acceptKw('COLUMN');
        return { kind: 'modify', column: this.parseColumnDef(), pos: tok.pos };
      }
      if (this.isKw('AUTO_INCREMENT')) {
        this.next();
        this.acceptSym('=');
        const n = this.peek();
        if (n.type !== 'number' || !n.isInteger) {
          this.fail('Nach AUTO_INCREMENT wird eine ganze Zahl erwartet');
        }
        this.next();
        return { kind: 'autoIncrement', value: n.value, pos: tok.pos };
      }
      return this.fail(unsupported, ['ADD', 'MODIFY']);
    }
  }

  /**
   * Prüft die Tiefe eines Syntaxbaums ohne Rekursion (eigener Stapel).
   * Als Ebene zählen nur Knoten mit "type"; Listen und Hilfsobjekte werden durchlaufen.
   *
   * @param {Object} root - Anweisung (AST).
   * @throws {SqlError} Wenn der Baum tiefer als MAX_TREE_DEPTH ist.
   */
  function checkTreeDepth(root) {
    const seen = new Set();
    const stack = [[root, 0]];
    while (stack.length > 0) {
      const [value, parentDepth] = stack.pop();
      if (value === null || typeof value !== 'object' || seen.has(value)) {
        continue;
      }
      seen.add(value);
      const depth = typeof value.type === 'string' ? parentDepth + 1 : parentDepth;
      if (depth > MAX_TREE_DEPTH) {
        throw new SqlError('Der Befehl ist zu umfangreich: zu viele aufeinanderfolgende Operatoren, Bedingungen oder Mengenoperationen.',
          value.pos || null, 'Teilen Sie den Befehl auf oder verwenden Sie z. B. IN (…) statt vieler OR-Bedingungen.');
      }
      for (const child of Array.isArray(value) ? value : Object.values(value)) {
        if (child !== null && typeof child === 'object') {
          stack.push([child, depth]);
        }
      }
    }
  }

  /**
   * Zerlegt und parst ein SQL-Skript.
   *
   * @param {string} source - Quelltext.
   * @returns {Array<Object>} Liste der Anweisungen (AST).
   * @throws {SqlError} Bei Syntaxfehlern.
   */
  function parse(source) {
    const tokens = ns.sql.tokenize(source);
    const statements = new Parser(String(source), tokens).parseScript();
    statements.forEach(checkTreeDepth);
    statements.keywordCase = keywordCase(tokens);
    return statements;
  }

  /** Höchstzahl der gemeldeten Schlüsselwörter in falscher Schreibung. */
  const MAX_KEYWORD_NOTES = 8;

  /**
   * Sucht Schlüsselwörter, die nicht großgeschrieben sind (z. B. "select").
   * Wörter, die der Parser als Namen (Tabelle, Spalte, Alias) gelesen hat, zählen nicht.
   *
   * @param {Array<Object>} tokens - Tokens nach dem Parsen.
   * @returns {Array<{written:string, upper:string}>} Eindeutige Fundstellen (höchstens MAX_KEYWORD_NOTES).
   */
  function keywordCase(tokens) {
    const seen = new Set();
    const list = [];
    for (const tok of tokens) {
      if (tok.type === 'word' && !tok.isName && tok.value !== tok.upper && !seen.has(tok.value)) {
        seen.add(tok.value);
        list.push({ written: tok.value, upper: tok.upper });
        if (list.length >= MAX_KEYWORD_NOTES) {
          break;
        }
      }
    }
    return list;
  }

  /**
   * @param {string} word - Wort.
   * @returns {boolean} true, wenn das Wort reserviert ist und als Name in Backticks stehen muss.
   */
  function isReserved(word) {
    return RESERVED.has(String(word).toUpperCase());
  }

  ns.sql.parse = parse;
  ns.sql.RESERVED = RESERVED;
  ns.sql.isReserved = isReserved;
})(window.SQLSIM = window.SQLSIM || {});
