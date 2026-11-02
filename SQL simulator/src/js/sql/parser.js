/**
 * @file parser.js
 * @description Wandelt Tokens in einen Syntaxbaum (AST) um – rekursiver Abstieg.
 *
 * Unterstützte Anweisungen:
 *   SELECT, INSERT, UPDATE, DELETE,
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
 *   geklammerte Eingaben keinen Stapelüberlauf auslösen.
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
      if (tok.type === 'word' && (tok.upper === 'UNION' || tok.upper === 'INTERSECT' || tok.upper === 'EXCEPT')) {
        this.fail(tok.upper + ' wird in diesem Simulator nicht unterstützt');
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
        if (this.isSym('(')) {
          this.fail('Ein Befehl muss mit einem SQL-Wort beginnen (z. B. SELECT)');
        }
        this.fail('Erwartet wird ein SQL-Befehl (z. B. SELECT)');
      }
      switch (tok.upper) {
        case 'SELECT': return this.parseSelect();
        case 'INSERT': return this.parseInsert();
        case 'UPDATE': return this.parseUpdate();
        case 'DELETE': return this.parseDelete();
        case 'CREATE': return this.parseCreate();
        case 'DROP': return this.parseDrop();
        case 'ALTER': return this.parseAlter();
        case 'WITH':
          throw new SqlError('WITH (Common Table Expressions) wird in diesem Simulator nicht unterstützt.', tok.pos);
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
          node.groupBy.push(this.parseExpr());
        } while (this.acceptSym(','));
      }
      if (this.acceptKw('HAVING')) {
        node.having = this.parseExpr();
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
      const after = this.peek();
      if (after.type === 'word' && CLAUSE_WORDS.has(after.upper)) {
        this.failStatementEnd();
      }
      if (after.type === 'word' && (after.upper === 'UNION' || after.upper === 'INTERSECT' || after.upper === 'EXCEPT')) {
        throw new SqlError(after.upper + ' wird in diesem Simulator nicht unterstützt.', after.pos);
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
        if (!this.isKw('SELECT', 1)) {
          this.fail('Nach „(“ in FROM wird eine Unterabfrage (SELECT …) erwartet', null);
        }
        this.next();
        const query = this.parseSelect();
        this.expectSym(')', 'Die Unterabfrage wird nicht mit „)“ geschlossen');
        let alias = null;
        if (this.acceptKw('AS') || this.canStartAlias()) {
          alias = this.parseName('ein Alias für die Unterabfrage').name;
        } else {
          throw new SqlError('Eine Unterabfrage in FROM braucht einen Alias, z. B. (SELECT …) AS t.', this.peek().pos);
        }
        return { type: 'subquery', query, alias, pos: tok.pos };
      }
      const name = this.parseName('ein Tabellenname');
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
          if (this.isKw('SELECT')) {
            const query = this.parseSelect();
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
        if (this.isKw('SELECT')) {
          node = { type: 'subquery', query: this.parseSelect(), pos: tok.pos };
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
            const query = this.parseSelect();
            this.expectSym(')', 'Die Unterabfrage wird nicht mit „)“ geschlossen');
            this.leave();
            return { type: 'exists', query, pos: tok.pos };
          }
          case 'CASE':
            throw new SqlError('CASE wird in diesem Simulator nicht unterstützt.', tok.pos);
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
        this.next();
        if (this.isSym('.')) {
          this.next();
          if (this.isSym('*')) {
            throw new SqlError(tok.value + '.* ist nur direkt in der SELECT-Liste erlaubt.', tok.pos);
          }
          const column = this.parseName('ein Spaltenname nach „' + tok.value + '.“', true);
          return { type: 'column', table: tok.value, name: column.name, pos: tok.pos };
        }
        return { type: 'column', table: null, name: tok.value, pos: tok.pos };
      }
      if (this.isSym('*')) {
        this.fail('„*“ ist hier nicht erlaubt', null, '„*“ steht nur direkt nach SELECT oder in COUNT(*).');
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
      this.leave();
      return node;
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
      if (this.isSym('(')) {
        this.next();
        columns = [];
        do {
          columns.push(this.parseName('ein Spaltenname'));
        } while (this.acceptSym(','));
        this.expectSym(')', 'Die Spaltenliste wird nicht mit „)“ geschlossen');
      }
      if (this.isKw('SELECT')) {
        throw new SqlError('INSERT … SELECT wird nicht unterstützt. Verwenden Sie INSERT … VALUES (…).', this.peek().pos);
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
      this.expectKw('TABLE', 'Nach CREATE wird „TABLE“ erwartet');
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
              throw new SqlError('CHECK-Bedingungen werden in diesem Simulator nicht unterstützt.', t.pos);
            case 'FULLTEXT':
            case 'SPATIAL':
              throw new SqlError(t.upper + '-Indizes werden nicht unterstützt.', t.pos);
            default:
              if (name !== null) {
                this.fail('Nach CONSTRAINT Name wird PRIMARY KEY, UNIQUE oder FOREIGN KEY erwartet');
              }
          }
        }
      }
      return { kind: 'column', column: this.parseColumnDef() };
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
        primaryKey: false, autoIncrement: false, unique: false, references: null
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
            throw new SqlError('CHECK-Bedingungen werden in diesem Simulator nicht unterstützt.', tok.pos);
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
      this.expectKw('TABLE', 'Nach DROP wird „TABLE“ erwartet');
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
   * Zerlegt und parst ein SQL-Skript.
   *
   * @param {string} source - Quelltext.
   * @returns {Array<Object>} Liste der Anweisungen (AST).
   * @throws {SqlError} Bei Syntaxfehlern.
   */
  function parse(source) {
    const tokens = ns.sql.tokenize(source);
    return new Parser(String(source), tokens).parseScript();
  }

  ns.sql.parse = parse;
  ns.sql.RESERVED = RESERVED;
})(window.SQLSIM = window.SQLSIM || {});
