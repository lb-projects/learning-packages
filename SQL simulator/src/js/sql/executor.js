/**
 * @file executor.js
 * @description Führt geparste SQL-Anweisungen auf einer Datenbank aus.
 *
 * Ablauf je Anweisung:
 *   1. Binden: Alle Namen (Tabellen, Aliase, Spalten) werden aufgelöst und
 *      geprüft, bevor eine einzige Zeile gelesen wird. So erscheinen Fehler
 *      wie "unbekannte Spalte" auch bei leeren Tabellen. Dabei werden auch
 *      die Regeln für Aggregatfunktionen und GROUP BY geprüft.
 *   2. Auswerten: FROM (Verknüpfungen) → WHERE → GROUP BY → HAVING →
 *      SELECT-Liste → DISTINCT → ORDER BY → LIMIT.
 *
 * Hinweise (kein Fehler, das Ergebnis wird angezeigt):
 *   - Tabellen in FROM ohne Verknüpfungsbedingung (vermutlich vergessenes JOIN … ON).
 *   - Vergleich mit einem Text, der nur in anderer Groß-/Kleinschreibung vorkommt.
 *
 * Verknüpfungen werden als verschachtelte Schleifen ausgeführt; bei einer
 * Gleichheitsbedingung zwischen zwei Spalten gleicher Art wird eine
 * Hash-Tabelle verwendet (schneller, gleiches Ergebnis).
 *
 * Schutz vor Hängern (die Ausführung läuft im Browser-Tab der Lernenden):
 *   - Zeitbudget je Anweisung (EXEC_LIMITS.timeMs), regelmäßig geprüft.
 *   - Zwischenergebnisse von Verknüpfungen höchstens EXEC_LIMITS.maxJoinRows Zeilen.
 *   - Endergebnis höchstens EXEC_LIMITS.maxResultRows Zeilen.
 *   - Rekursionstiefe ist bereits im Parser begrenzt.
 *   - LIKE wird ohne reguläre Ausdrücke ausgewertet (kein ReDoS).
 *
 * Abhängigkeiten:
 *   sql/errors.js, sql/values.js, sql/parser.js, sql/database.js
 */
(function (ns) {
  'use strict';

  const SqlError = ns.sql.SqlError;
  const suggest = ns.sql.suggest;
  const V = ns.sql.values;
  const show = ns.sql.showValue;

  /** Grenzwerte der Ausführung. */
  const EXEC_LIMITS = Object.freeze({
    maxJoinRows: 200000,
    maxResultRows: 25000,
    timeMs: 3000,
    importTimeMs: 10000
  });

  const AGGREGATES = new Set(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX']);
  const FUNCTION_NAMES = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'ROUND', 'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'LAG', 'LEAD'];
  /** Reine Fensterfunktionen (nur mit OVER). */
  const WINDOW_ONLY = new Set(['ROW_NUMBER', 'RANK', 'DENSE_RANK', 'LAG', 'LEAD']);
  const COMPARISON_OPS = new Set(['=', '<>', '<', '<=', '>', '>=']);

  /** Anweisungen, die auf Seite 3 erlaubt sind. */
  const QUERY_TYPES = new Set(['select', 'insert', 'update', 'delete', 'createView', 'dropView']);
  /** Anweisungen, die beim Laden einer SQL-Datei erlaubt sind. */
  const IMPORT_TYPES = new Set(['dropTable', 'createTable', 'createIndex', 'alterTable', 'insert', 'createView', 'dropView', 'ignored']);

  /** Anzeigenamen der Anweisungsarten. */
  const TYPE_NAMES = new Map([
    ['select', 'SELECT'], ['insert', 'INSERT'], ['update', 'UPDATE'], ['delete', 'DELETE'],
    ['createTable', 'CREATE TABLE'], ['createIndex', 'CREATE INDEX'], ['dropTable', 'DROP TABLE'],
    ['alterTable', 'ALTER TABLE'], ['createView', 'CREATE VIEW'], ['dropView', 'DROP VIEW']
  ]);

  /** Laufzeitzustand der aktuellen Anweisung (die Ausführung ist synchron). */
  let rt = null;

  /** Prüft regelmäßig das Zeitbudget. */
  function tick() {
    rt.steps++;
    if ((rt.steps & 1023) === 0 && performance.now() > rt.deadline) {
      throw new SqlError('Abbruch: Die Ausführung hat länger als ' + Math.round(rt.timeMs / 1000) + ' Sekunden gedauert.', null,
        'Prüfen Sie die Verknüpfungsbedingungen (ON …) oder grenzen Sie die Abfrage mit WHERE ein.');
    }
  }

  // ---------------------------------------------------------------------------
  // Binden (Namensauflösung und Prüfungen)
  // ---------------------------------------------------------------------------

  /**
   * Erzeugt eine Quelle (Tabelle oder Unterabfrage in FROM) für die Namensauflösung.
   *
   * @param {Object} table - Tabelle (database.js).
   * @param {string|null} alias - Alias oder null.
   * @returns {Object} Quelle.
   */
  function tableSource(table, alias) {
    return {
      key: (alias || table.name).toLowerCase(),
      label: alias || table.name,
      tableKey: table.key,
      tableName: table.name,
      aliasGiven: !!alias,
      columns: table.columns.map((c) => ({ name: c.name, type: c.type })),
      colIndex: table.colIndex,
      pk: table.primaryKey
    };
  }

  /**
   * Erzeugt einen Gültigkeitsbereich (Scope) für eine Abfrageebene.
   *
   * @param {Object|null} parent - Übergeordneter Scope (bei Unterabfragen).
   * @param {Object|null} select - Zugehörige SELECT-Anweisung.
   * @returns {Object} Scope.
   */
  function makeScope(parent, select) {
    return { sources: [], parent, select, hasAgg: false, windows: [] };
  }

  /**
   * Fügt eine Quelle hinzu und prüft auf doppelte Namen.
   *
   * @param {Object} scope - Scope.
   * @param {Object} source - Quelle.
   * @param {Object} pos - Position.
   * @returns {number} Index der Quelle.
   */
  function addSource(scope, source, pos) {
    if (scope.sources.some((s) => s.key === source.key)) {
      throw new SqlError('Der Name „' + source.label + '“ wird in FROM mehrfach verwendet.', pos,
        'Vergeben Sie unterschiedliche Aliase, z. B. FROM person p1 JOIN person p2 ON …');
    }
    scope.sources.push(source);
    return scope.sources.length - 1;
  }

  /** @returns {string} Spaltenbezeichnung wie geschrieben, z. B. "s.Adresse". */
  function columnText(node) {
    return (node.table !== null ? node.table + '.' : '') + node.name;
  }

  /**
   * Löst eine Spaltenreferenz auf.
   *
   * @param {Object} node - Knoten {type:'column', table, name, pos}.
   * @param {Object} scope - Scope.
   * @param {Object} flags - Kontext (clause, aliasMap, aliasFirst, aliasFallback, aliasNames).
   * @returns {Object} Gebundener Knoten (ggf. der Ausdruck eines SELECT-Alias).
   */
  function bindColumn(node, scope, flags) {
    const nameKey = node.name.toLowerCase();
    if (node.table === null && flags.aliasMap && flags.aliasFirst && flags.aliasMap.has(nameKey) &&
        flags.aliasSpelling.get(nameKey) === node.name) {
      return flags.aliasMap.get(nameKey);
    }
    let hiddenTable = null;
    let s = scope;
    let depth = 0;
    while (s) {
      if (node.table !== null) {
        const tKey = node.table.toLowerCase();
        const srcIdx = s.sources.findIndex((x) => x.key === tKey);
        if (srcIdx >= 0) {
          const src = s.sources[srcIdx];
          ns.sql.requireExactName(node.table, src.label, 'Unbekannte Tabelle bzw. unbekannter Alias „' + node.table + '“ in „' + columnText(node) + '“.', node.pos);
          const col = src.colIndex.get(nameKey);
          if (col === undefined) {
            const hint = ns.sql.didYouMean(ns.sql.suggestions(node.name, src.columns.map((c) => c.name)), src.label + '.');
            throw new SqlError('„' + src.label + '“' + (src.aliasGiven && src.tableName ? ' (Tabelle ' + src.tableName + ')' : '') + ' hat keine Spalte „' + node.name + '“.', node.pos,
              hint || 'Vorhandene Spalten: ' + src.columns.map((c) => c.name).join(', ') + '.');
          }
          ns.sql.requireExactName(node.name, src.columns[col].name, '„' + src.label + '“ hat keine Spalte „' + node.name + '“.', node.pos);
          return markBound(node, scope, depth, srcIdx, col);
        }
        if (!hiddenTable) {
          hiddenTable = s.sources.find((x) => x.aliasGiven && x.tableKey === tKey) || null;
        }
      } else {
        let found = null;
        const matches = [];
        s.sources.forEach((src, srcIdx) => {
          const col = src.colIndex.get(nameKey);
          if (col !== undefined) {
            matches.push(src.label);
            found = { srcIdx, col };
          }
        });
        if (matches.length > 1) {
          throw new SqlError('Der Spaltenname „' + node.name + '“ ist mehrdeutig – er kommt in ' + matches.join(' und ') + ' vor.', node.pos,
            'Geben Sie die Tabelle oder den Alias mit an, z. B. ' + matches[0] + '.' + node.name + '.');
        }
        if (found) {
          ns.sql.requireExactName(node.name, s.sources[found.srcIdx].columns[found.col].name, 'Unbekannte Spalte „' + node.name + '“.', node.pos);
          return markBound(node, scope, depth, found.srcIdx, found.col);
        }
      }
      s = s.parent;
      depth++;
    }
    if (node.table === null && flags.aliasMap && (flags.aliasFallback || flags.aliasFirst) && flags.aliasMap.has(nameKey)) {
      ns.sql.requireExactName(node.name, flags.aliasSpelling.get(nameKey), 'Unbekannter Alias bzw. unbekannte Spalte „' + node.name + '“.', node.pos);
      return flags.aliasMap.get(nameKey);
    }
    // Fehlermeldungen
    if (node.table !== null) {
      if (hiddenTable) {
        throw new SqlError('Die Tabelle „' + hiddenTable.tableName + '“ hat in dieser Abfrage den Alias „' + hiddenTable.label + '“.', node.pos,
          'Verwenden Sie ' + hiddenTable.label + '.' + node.name + ' statt ' + columnText(node) + '.');
      }
      const names = allSourceLabels(scope);
      const cand = suggest(node.table, names);
      throw new SqlError('Unbekannte Tabelle bzw. unbekannter Alias „' + node.table + '“ in „' + columnText(node) + '“.', node.pos,
        cand ? 'Meinten Sie „' + cand + '“?' : (names.length ? 'In FROM stehen: ' + names.join(', ') + '.' : 'Die Tabelle muss in FROM stehen.'));
    }
    if (flags.clause === 'VALUES') {
      throw new SqlError('In VALUES sind keine Spaltennamen erlaubt (gefunden: „' + node.name + '“).', node.pos,
        'Texte müssen in einfachen Anführungszeichen stehen, z. B. \'' + node.name + '\'.');
    }
    if (flags.aliasNames && flags.aliasNames.has(nameKey) && (flags.clause === 'WHERE' || flags.clause === 'ON')) {
      throw new SqlError('„' + node.name + '“ ist ein Alias aus der SELECT-Liste. Aliase können in ' + flags.clause + ' nicht verwendet werden.', node.pos,
        'Wiederholen Sie dort den Ausdruck – oder verwenden Sie HAVING bzw. ORDER BY.');
    }
    const columns = allColumnNames(scope);
    const hint = ns.sql.didYouMean(ns.sql.suggestions(node.name, columns)) ||
      (allSourceLabels(scope).length === 0
        ? 'Fehlt FROM mit einer Tabelle?'
        : 'Soll „' + node.name + '“ ein Text sein? Dann in einfache Anführungszeichen setzen: \'' + node.name + '\'.');
    throw new SqlError('Unbekannte Spalte „' + node.name + '“.', node.pos, hint);
  }

  /** Vermerkt die Bindung und markiert korrelierte Unterabfragen. */
  function markBound(node, scope, depth, src, col) {
    let s = scope;
    for (let d = 0; d < depth; d++) {
      if (s.select) {
        s.select.correlated = true;
      }
      s = s.parent;
    }
    node.ref = { depth, src, col };
    return node;
  }

  /** @returns {Array<string>} Namen aller Quellen im Scope und darüber. */
  function allSourceLabels(scope) {
    const names = [];
    for (let s = scope; s; s = s.parent) {
      for (const src of s.sources) {
        names.push(src.label);
      }
    }
    return names;
  }

  /** @returns {Array<string>} Alle Spaltennamen im Scope und darüber. */
  function allColumnNames(scope) {
    const names = [];
    for (let s = scope; s; s = s.parent) {
      for (const src of s.sources) {
        for (const c of src.columns) {
          names.push(c.name);
        }
      }
    }
    return names;
  }

  /**
   * Bindet einen Ausdruck.
   *
   * @param {Object} node - Ausdruck.
   * @param {Object} scope - Scope.
   * @param {Object} flags - Kontext: clause, allowAgg, inAgg, aliasMap, aliasFirst, aliasFallback, aliasNames.
   * @returns {Object} Gebundener Ausdruck.
   */
  function bindExpr(node, scope, flags) {
    switch (node.type) {
      case 'literal':
        return node;
      case 'column':
        return bindColumn(node, scope, flags);
      case 'neg':
      case 'not':
        node.operand = bindExpr(node.operand, scope, flags);
        return node;
      case 'binary':
        node.left = bindExpr(node.left, scope, flags);
        node.right = bindExpr(node.right, scope, flags);
        noteLiteralComparison(node, scope, flags);
        return node;
      case 'between':
        node.expr = bindExpr(node.expr, scope, flags);
        node.low = bindExpr(node.low, scope, flags);
        node.high = bindExpr(node.high, scope, flags);
        return node;
      case 'like':
        node.expr = bindExpr(node.expr, scope, flags);
        node.pattern = bindExpr(node.pattern, scope, flags);
        noteLiteralComparison(node, scope, flags);
        return node;
      case 'isnull':
        node.expr = bindExpr(node.expr, scope, flags);
        return node;
      case 'in':
        node.expr = bindExpr(node.expr, scope, flags);
        if (node.list) {
          node.list = node.list.map((e) => bindExpr(e, scope, flags));
          noteLiteralComparison(node, scope, flags);
        } else {
          bindSelect(node.query, scope);
          if (node.query.outputs.length !== 1) {
            throw new SqlError('Die Unterabfrage nach IN muss genau eine Spalte liefern (sie liefert ' + node.query.outputs.length + ').', node.query.pos);
          }
        }
        return node;
      case 'exists':
        bindSelect(node.query, scope);
        return node;
      case 'subquery':
        bindSelect(node.query, scope);
        if (node.query.outputs.length !== 1) {
          throw new SqlError('Eine Unterabfrage als Wert muss genau eine Spalte liefern (sie liefert ' + node.query.outputs.length + ').', node.query.pos);
        }
        return node;
      case 'case':
        if (node.operand) {
          node.operand = bindExpr(node.operand, scope, flags);
        }
        node.whens.forEach((w) => {
          w.when = bindExpr(w.when, scope, flags);
          w.then = bindExpr(w.then, scope, flags);
        });
        if (node.otherwise) {
          node.otherwise = bindExpr(node.otherwise, scope, flags);
        }
        return node;
      case 'func':
        return bindFunction(node, scope, flags);
      default:
        throw new Error('Unbekannter Ausdruck ' + node.type);
    }
  }

  /**
   * Bindet einen Funktionsaufruf (Aggregatfunktionen und ROUND).
   */
  function bindFunction(node, scope, flags) {
    if (node.over) {
      return bindWindow(node, scope, flags);
    }
    if (WINDOW_ONLY.has(node.name)) {
      throw new SqlError(node.name + ' ist eine Fensterfunktion und braucht OVER (…).', node.pos,
        'Beispiel: ' + node.name + '() OVER (ORDER BY Spalte) bzw. mit PARTITION BY für Gruppen.');
    }
    if (AGGREGATES.has(node.name)) {
      if (flags.inAgg) {
        throw new SqlError('Aggregatfunktionen können nicht verschachtelt werden (' + node.name + ' innerhalb einer anderen Aggregatfunktion).', node.pos);
      }
      if (!flags.allowAgg) {
        throw new SqlError('Die Aggregatfunktion ' + node.name + ' ist in ' + flags.clause + ' nicht erlaubt.', node.pos,
          flags.clause === 'WHERE' ? 'Bedingungen mit Aggregatfunktionen gehören in HAVING (nach GROUP BY).' : null);
      }
      if (node.star) {
        if (node.name !== 'COUNT') {
          throw new SqlError(node.name + '(*) ist nicht möglich – nur COUNT(*).', node.pos, 'Geben Sie eine Spalte an, z. B. ' + node.name + '(Preis).');
        }
      } else if (node.args.length !== 1) {
        throw new SqlError(node.name + ' erwartet genau ein Argument, z. B. ' + node.name + '(Spalte).', node.pos);
      }
      const inner = Object.assign({}, flags, { inAgg: true, allowAgg: true });
      node.args = node.args.map((a) => bindExpr(a, scope, inner));
      node.agg = true;
      scope.hasAgg = true;
      return node;
    }
    if (node.name === 'ROUND') {
      if (node.star || node.distinct || node.args.length < 1 || node.args.length > 2) {
        throw new SqlError('ROUND erwartet ein oder zwei Argumente: ROUND(Zahl) oder ROUND(Zahl, Nachkommastellen).', node.pos);
      }
      node.args = node.args.map((a) => bindExpr(a, scope, flags));
      return node;
    }
    const cand = suggest(node.name, FUNCTION_NAMES);
    throw new SqlError('Unbekannte Funktion „' + node.name + '“.', node.pos,
      (cand ? 'Meinten Sie „' + cand + '“? ' : '') + 'Unterstützt werden COUNT, SUM, AVG, MIN, MAX und ROUND.');
  }

  /**
   * Bindet eine Fensterfunktion (… OVER (PARTITION BY … ORDER BY …)).
   * Sie wird nach WHERE, GROUP BY und HAVING berechnet und ist deshalb nur in
   * der SELECT-Liste und in ORDER BY erlaubt.
   */
  function bindWindow(node, scope, flags) {
    if (flags.clause !== 'SELECT' && flags.clause !== 'ORDER BY') {
      throw new SqlError('Fensterfunktionen (' + node.name + ' … OVER …) sind nur in der SELECT-Liste und in ORDER BY erlaubt, nicht in ' + flags.clause + '.', node.pos,
        flags.clause === 'WHERE' ? 'Berechnen Sie den Wert in einer Unterabfrage oder WITH-Abfrage und filtern Sie danach.' : null);
    }
    if (flags.inWindow) {
      throw new SqlError('Fensterfunktionen können nicht verschachtelt werden.', node.pos);
    }
    if (flags.inAgg) {
      throw new SqlError('Eine Fensterfunktion kann nicht innerhalb einer Aggregatfunktion stehen.', node.pos);
    }
    if (node.distinct) {
      throw new SqlError('DISTINCT wird in Fensterfunktionen nicht unterstützt.', node.pos);
    }
    if (node.name === 'ROW_NUMBER' || node.name === 'RANK' || node.name === 'DENSE_RANK') {
      if (node.args.length > 0 || node.star) {
        throw new SqlError(node.name + '() hat keine Argumente.', node.pos);
      }
    } else if (node.name === 'LAG' || node.name === 'LEAD') {
      if (node.star || node.args.length < 1 || node.args.length > 3) {
        throw new SqlError(node.name + ' erwartet ein bis drei Argumente: ' + node.name + '(Spalte [, Abstand [, Standardwert]]).', node.pos);
      }
    } else if (AGGREGATES.has(node.name)) {
      if (node.star ? node.name !== 'COUNT' : node.args.length !== 1) {
        throw new SqlError(node.name + ' erwartet als Fensterfunktion genau ein Argument' + (node.name === 'COUNT' ? ' oder *' : '') + '.', node.pos);
      }
    } else {
      const cand = suggest(node.name, FUNCTION_NAMES);
      throw new SqlError('„' + node.name + '“ ist keine Fensterfunktion.', node.pos,
        (cand ? 'Meinten Sie „' + cand + '“? ' : '') + 'Möglich sind ROW_NUMBER, RANK, DENSE_RANK, LAG, LEAD, COUNT, SUM, AVG, MIN und MAX.');
    }
    const inner = Object.assign({}, flags, { inWindow: true });
    node.args = node.args.map((a) => bindExpr(a, scope, inner));
    node.over.partition = node.over.partition.map((e) => bindExpr(e, scope, inner));
    node.over.order.forEach((o) => {
      o.expr = bindExpr(o.expr, scope, inner);
    });
    node.window = true;
    scope.windows.push(node);
    return node;
  }

  /** @returns {Array<Object>} Alle Ausdrücke einer Fensterfunktion (Argumente, PARTITION, ORDER). */
  function windowParts(node) {
    return node.args.concat(node.over.partition, node.over.order.map((o) => o.expr));
  }

  /** @returns {Array<Object>} Alle Teilausdrücke eines CASE-Ausdrucks. */
  function caseParts(node) {
    const parts = node.operand ? [node.operand] : [];
    for (const w of node.whens) {
      parts.push(w.when, w.then);
    }
    if (node.otherwise) {
      parts.push(node.otherwise);
    }
    return parts;
  }

  /** @returns {boolean} true, wenn der Ausdruck eine Aggregatfunktion dieser Ebene enthält. */
  function containsAggregate(node) {
    if (!node || typeof node !== 'object') {
      return false;
    }
    switch (node.type) {
      case 'func':
        return node.agg === true || (node.window ? windowParts(node) : node.args).some(containsAggregate);
      case 'case':
        return caseParts(node).some(containsAggregate);
      case 'neg':
      case 'not':
        return containsAggregate(node.operand);
      case 'binary':
        return containsAggregate(node.left) || containsAggregate(node.right);
      case 'between':
        return containsAggregate(node.expr) || containsAggregate(node.low) || containsAggregate(node.high);
      case 'like':
        return containsAggregate(node.expr) || containsAggregate(node.pattern);
      case 'isnull':
        return containsAggregate(node.expr);
      case 'in':
        return containsAggregate(node.expr) || (node.list ? node.list.some(containsAggregate) : false);
      default:
        return false;
    }
  }

  let keyCounter = 0;

  /**
   * Struktureller Schlüssel eines gebundenen Ausdrucks (für den Abgleich mit GROUP BY).
   *
   * @param {Object} n - Ausdruck.
   * @returns {string} Schlüssel.
   */
  function exprKey(n) {
    switch (n.type) {
      case 'literal':
        return 'L' + (n.value === null ? 'N' : typeof n.value + ':' + String(n.value));
      case 'column':
        return 'C' + n.ref.depth + ':' + n.ref.src + ':' + n.ref.col;
      case 'func':
        if (n.window) {
          keyCounter++;
          return 'X' + keyCounter;
        }
        return 'F' + n.name + (n.distinct ? 'D' : '') + (n.star ? '*' : '') + '(' + n.args.map(exprKey).join(',') + ')';
      case 'binary':
        return '(' + exprKey(n.left) + n.op + exprKey(n.right) + ')';
      case 'neg':
        return '-(' + exprKey(n.operand) + ')';
      case 'not':
        return '!(' + exprKey(n.operand) + ')';
      case 'between':
        return 'B' + (n.not ? '!' : '') + '(' + exprKey(n.expr) + ',' + exprKey(n.low) + ',' + exprKey(n.high) + ')';
      case 'like':
        return 'K' + (n.not ? '!' : '') + '(' + exprKey(n.expr) + ',' + exprKey(n.pattern) + ')';
      case 'isnull':
        return 'I' + (n.not ? '!' : '') + '(' + exprKey(n.expr) + ')';
      case 'case':
        return 'S(' + (n.operand ? exprKey(n.operand) : '') + ';' + n.whens.map((w) => exprKey(w.when) + '>' + exprKey(w.then)).join(';') + ';' + (n.otherwise ? exprKey(n.otherwise) : '') + ')';
      default:
        keyCounter++;
        return 'X' + keyCounter;
    }
  }

  /**
   * Prüft, dass in einer gruppierten Abfrage nur gruppierte Spalten oder
   * Aggregatfunktionen vorkommen (wie MySQL mit ONLY_FULL_GROUP_BY;
   * Spalten einer Tabelle, deren Primärschlüssel gruppiert ist, sind erlaubt).
   */
  function checkGrouped(node, info) {
    if (info.groupKeys.has(exprKey(node))) {
      return;
    }
    switch (node.type) {
      case 'literal':
      case 'subquery':
      case 'exists':
        return;
      case 'func':
        if (node.agg) {
          return;
        }
        (node.window ? windowParts(node) : node.args).forEach((a) => checkGrouped(a, info));
        return;
      case 'case':
        caseParts(node).forEach((a) => checkGrouped(a, info));
        return;
      case 'column': {
        if (node.ref.depth > 0 || info.groupedCols.has(node.ref.src + ':' + node.ref.col) || info.determined.has(node.ref.src)) {
          return;
        }
        const text = columnText(node);
        if (info.hasGroupBy) {
          throw new SqlError('Die Spalte „' + text + '“ steht weder in GROUP BY noch in einer Aggregatfunktion.', node.pos,
            'Nehmen Sie ' + text + ' in GROUP BY auf oder verwenden Sie eine Aggregatfunktion wie COUNT, MIN oder MAX.');
        }
        throw new SqlError('Die Spalte „' + text + '“ kann nicht zusammen mit einer Aggregatfunktion ausgegeben werden.', node.pos,
          'Ohne GROUP BY fasst eine Aggregatfunktion alle Zeilen zu einer zusammen. Ergänzen Sie GROUP BY ' + text + '.');
      }
      case 'neg':
      case 'not':
        checkGrouped(node.operand, info);
        return;
      case 'binary':
        checkGrouped(node.left, info);
        checkGrouped(node.right, info);
        return;
      case 'between':
        checkGrouped(node.expr, info);
        checkGrouped(node.low, info);
        checkGrouped(node.high, info);
        return;
      case 'like':
        checkGrouped(node.expr, info);
        checkGrouped(node.pattern, info);
        return;
      case 'isnull':
        checkGrouped(node.expr, info);
        return;
      case 'in':
        checkGrouped(node.expr, info);
        if (node.list) {
          node.list.forEach((e) => checkGrouped(e, info));
        }
        return;
      default:
        return;
    }
  }

  /** Zerlegt einen Ausdruck an den obersten AND-Verknüpfungen. */
  function conjuncts(node, out) {
    if (node && node.type === 'binary' && node.op === 'AND') {
      conjuncts(node.left, out);
      conjuncts(node.right, out);
    } else if (node) {
      out.push(node);
    }
    return out;
  }

  /**
   * Sucht eine Gleichheitsbedingung a.x = b.y zwischen den beiden Seiten einer
   * Verknüpfung, die sich für eine Hash-Verknüpfung eignet.
   *
   * @param {Array<Object>} conds - Teilbedingungen.
   * @param {Array<number>} range - [Beginn links, Beginn rechts, Ende].
   * @param {Object} scope - Scope (für Spaltentypen).
   * @returns {Object|null} Hash-Plan oder null.
   */
  function findHashCondition(conds, range, scope) {
    const side = (ref) => {
      if (!ref || ref.depth !== 0) {
        return null;
      }
      if (ref.src >= range[0] && ref.src < range[1]) {
        return 'L';
      }
      if (ref.src >= range[1] && ref.src < range[2]) {
        return 'R';
      }
      return null;
    };
    for (const c of conds) {
      if (c.type !== 'binary' || c.op !== '=' || c.left.type !== 'column' || c.right.type !== 'column') {
        continue;
      }
      const a = c.left.ref;
      const b = c.right.ref;
      const sa = side(a);
      const sb = side(b);
      if (!sa || !sb || sa === sb) {
        continue;
      }
      const left = sa === 'L' ? a : b;
      const right = sa === 'L' ? b : a;
      const catL = V.typeCategory(scope.sources[left.src].columns[left.col].type);
      const catR = V.typeCategory(scope.sources[right.src].columns[right.col].type);
      if (catL && catL === catR) {
        return { left, right, category: catL };
      }
    }
    return null;
  }

  /**
   * Bindet einen FROM-Eintrag.
   *
   * @param {Object} item - FROM-Knoten.
   * @param {Object} scope - Scope der Abfrage.
   * @param {Object} flags - Kontext für ON.
   * @returns {Object} Ausführungsplan.
   */
  function bindFrom(item, scope, flags) {
    if (item.type === 'table') {
      const cte = findCte(scope.cteEnv, item.name, item.pos);
      if (cte) {
        const srcIndex = addSource(scope, derivedSource(cte.name, item.alias, cte.out), item.pos);
        return { type: 'derived', query: cte.query, cte, range: [srcIndex, srcIndex + 1, srcIndex + 1] };
      }
      const view = rt.db.views.get(item.name.toLowerCase());
      if (view) {
        ns.sql.requireExactName(item.name, view.name, 'Die Tabelle bzw. Sicht „' + item.name + '“ gibt es nicht.', item.pos);
        const bound = bindView(view, item.pos);
        const srcIndex = addSource(scope, derivedSource(view.name, item.alias, bound.out), item.pos);
        return { type: 'derived', query: bound.query, range: [srcIndex, srcIndex + 1, srcIndex + 1] };
      }
      const table = rt.db.requireTable(item.name, item.pos);
      const srcIndex = addSource(scope, tableSource(table, item.alias), item.pos);
      return { type: 'table', table, range: [srcIndex, srcIndex + 1, srcIndex + 1] };
    }
    if (item.type === 'subquery') {
      bindSelect(item.query, null, scope.cteEnv);
      const out = derivedColumns(item.alias, null, item.query, item.pos, { dat: 'der Unterabfrage', acc: 'die Unterabfrage' });
      const source = { key: item.alias.toLowerCase(), label: item.alias, tableKey: null, tableName: null, aliasGiven: false, columns: out.columns, colIndex: out.colIndex, pk: null };
      const srcIndex = addSource(scope, source, item.pos);
      return { type: 'derived', query: item.query, range: [srcIndex, srcIndex + 1, srcIndex + 1] };
    }
    // Verknüpfung
    const start = scope.sources.length;
    const left = bindFrom(item.left, scope, flags);
    const mid = scope.sources.length;
    const right = bindFrom(item.right, scope, flags);
    const end = scope.sources.length;
    const range = [start, mid, end];
    let on = null;
    if (item.on) {
      on = bindExpr(item.on, scope, Object.assign({}, flags, { clause: 'ON', allowAgg: false }));
    }
    const plan = { type: 'join', kind: item.kind, left, right, on, range, hash: null, implicit: item.implicit };
    if (on) {
      plan.hash = findHashCondition(conjuncts(on, []), range, scope);
    }
    return plan;
  }

  /** @returns {boolean} true, wenn zwei Spaltentypen für die Anzeige gleich sind. */
  function sameType(a, b) {
    return !!a && !!b && a.base === b.base && a.display === b.display;
  }

  /**
   * Bindet eine Mengenoperation (UNION, INTERSECT, EXCEPT). Spaltennamen
   * stammen aus der ersten Abfrage; ORDER BY darf nur Spalten des Ergebnisses
   * verwenden (Name oder Nummer).
   *
   * @param {Object} q - Verbund-Knoten mit q.compound.
   * @param {Object|null} parentScope - Scope der umgebenden Abfrage.
   * @param {Object|null} env - Sichtbare WITH-Abfragen.
   */
  function bindCompound(q, parentScope, env) {
    const c = q.compound;
    if (q.topLevel || q === rt.topQuery) {
      c.left.topLevel = true;
      c.right.topLevel = true;
    }
    bindSelect(c.left, parentScope, env);
    bindSelect(c.right, parentScope, env);
    const lo = c.left.outputs;
    const ro = c.right.outputs;
    if (lo.length !== ro.length) {
      throw new SqlError('Die Abfragen vor und nach ' + c.op + ' liefern unterschiedlich viele Spalten (' + lo.length + ' und ' + ro.length + ').', q.opPos,
        'Bei ' + c.op + ' müssen beide Abfragen gleich viele Spalten liefern.');
    }
    q.outputs = lo.map((o, i) => ({ name: o.name, type: sameType(o.type, ro[i].type) ? o.type : null }));
    q.correlated = c.left.correlated || c.right.correlated;
    const names = q.outputs.map((o) => o.name);
    q.orderPlan = q.orderBy.map((o) => {
      const e = o.expr;
      if (e.type === 'literal' && typeof e.value === 'number' && e.isInteger) {
        if (e.value < 1 || e.value > names.length) {
          throw new SqlError('ORDER BY ' + e.value + ': Das Ergebnis hat nur ' + names.length + ' Spalte(n).', e.pos);
        }
        return { position: e.value - 1, desc: o.desc };
      }
      if (e.type === 'column' && e.table === null) {
        const idx = names.findIndex((n) => n.toLowerCase() === e.name.toLowerCase());
        if (idx >= 0) {
          ns.sql.requireExactName(e.name, names[idx], 'Das Ergebnis hat keine Spalte „' + e.name + '“.', e.pos);
          return { position: idx, desc: o.desc };
        }
        throw new SqlError('Das Ergebnis von ' + c.op + ' hat keine Spalte „' + e.name + '“.', e.pos,
          ns.sql.didYouMean(ns.sql.suggestions(e.name, names)) || 'Spalten des Ergebnisses: ' + names.join(', ') + '.');
      }
      throw new SqlError('Nach ' + c.op + ' kann ORDER BY nur Spalten des Ergebnisses verwenden (Name oder Nummer, z. B. ORDER BY 1).', e.pos,
        'Vergeben Sie in der ersten Abfrage einen Namen mit AS und sortieren Sie danach.');
    });
  }

  /** Größte Verschachtelung von Sichten (Schutz vor Sichten, die auf sich selbst verweisen). */
  const MAX_VIEW_DEPTH = 16;

  /**
   * Spalten einer abgeleiteten Quelle (Unterabfrage in FROM, WITH-Abfrage, Sicht).
   *
   * @param {string} label - Name für Meldungen.
   * @param {Array<{name:string}>|null} names - Ausdrückliche Spaltennamen oder null.
   * @param {Object} query - Gebundene Abfrage.
   * @param {Object|null} pos - Position.
   * @param {{dat:string, acc:string}} what - Bezeichnung, z. B. {dat:'der Sicht', acc:'die Sicht'}.
   * @returns {{columns:Array<{name:string, type:Object|null}>, colIndex:Map<string, number>}} Spalten.
   */
  function derivedColumns(label, names, query, pos, what) {
    let columns = query.outputs.map((o) => ({ name: o.name, type: o.type }));
    if (names) {
      if (names.length !== columns.length) {
        throw new SqlError('Für ' + what.acc + ' „' + label + '“ sind ' + names.length + ' Spaltennamen angegeben, die Abfrage liefert aber ' + columns.length + ' Spalte(n).', pos);
      }
      columns = columns.map((c, i) => ({ name: names[i].name, type: c.type }));
    }
    const colIndex = new Map();
    columns.forEach((c, i) => {
      const key = c.name.toLowerCase();
      if (colIndex.has(key)) {
        throw new SqlError('In ' + what.dat + ' „' + label + '“ kommt die Spalte „' + c.name + '“ mehrfach vor.', pos,
          'Vergeben Sie eindeutige Namen mit AS.');
      }
      colIndex.set(key, i);
    });
    return { columns, colIndex };
  }

  /** @returns {Object} Quelle für eine WITH-Abfrage oder Sicht (mit optionalem Alias). */
  function derivedSource(name, alias, out) {
    return {
      key: (alias || name).toLowerCase(), label: alias || name, tableKey: null, tableName: alias ? name : null,
      aliasGiven: !!alias, columns: out.columns, colIndex: out.colIndex, pk: null
    };
  }

  /**
   * Sucht eine WITH-Abfrage in der Umgebung (innere zuerst).
   *
   * @param {Object|null} env - Umgebung {map, parent}.
   * @param {string} name - Name aus FROM.
   * @param {Object} pos - Position.
   * @returns {Object|null} WITH-Abfrage oder null.
   */
  function findCte(env, name, pos) {
    const key = name.toLowerCase();
    for (let e = env; e; e = e.parent) {
      const cte = e.map.get(key);
      if (cte) {
        ns.sql.requireExactName(name, cte.name, 'Die Tabelle bzw. WITH-Abfrage „' + name + '“ gibt es nicht.', pos);
        return cte;
      }
    }
    return null;
  }

  /**
   * Bindet die Abfrage einer Sicht (frisch aus dem gespeicherten Text, damit sie
   * immer den aktuellen Stand der Tabellen zeigt). Hinweise aus der Definition
   * der Sicht werden nicht gemeldet.
   *
   * @param {Object} view - Sicht {name, columns, text}.
   * @param {Object} pos - Position des Verweises.
   * @returns {{query:Object, out:Object}} Gebundene Abfrage und Spalten.
   */
  function bindView(view, pos) {
    if (rt.viewDepth >= MAX_VIEW_DEPTH) {
      const err = new SqlError('Die Sicht „' + view.name + '“ verweist (über andere Sichten) auf sich selbst.', pos);
      err.fromView = true;
      throw err;
    }
    const saved = { warnings: rt.warnings, literalChecks: rt.literalChecks };
    rt.viewDepth++;
    rt.warnings = [];
    rt.literalChecks = null;
    try {
      const query = ns.sql.parse(view.text)[0];
      bindSelect(query, null, null);
      const out = derivedColumns(view.name, view.columns ? view.columns.map((n) => ({ name: n })) : null, query, pos, { dat: 'der Sicht', acc: 'die Sicht' });
      return { query, out };
    } catch (error) {
      if (error instanceof SqlError && !error.fromView) {
        const err = new SqlError('Die Sicht „' + view.name + '“ ist ungültig: ' + error.message, pos, error.hint);
        err.fromView = true;
        throw err;
      }
      throw error;
    } finally {
      rt.viewDepth--;
      rt.warnings = saved.warnings;
      rt.literalChecks = saved.literalChecks;
    }
  }

  /** Ergänzt Hash-Bedingungen aus WHERE für innere Verknüpfungen ohne eigene. */
  function assignWhereHashes(plan, conds, scope) {
    if (!plan || plan.type !== 'join') {
      return;
    }
    assignWhereHashes(plan.left, conds, scope);
    assignWhereHashes(plan.right, conds, scope);
    if (!plan.hash && (plan.kind === 'cross' || plan.kind === 'inner')) {
      plan.hash = findHashCondition(conds, plan.range, scope);
    }
  }

  /** Spaltentyp eines Ausgabeausdrucks (für die Anzeige von DECIMAL). */
  function outputType(expr, scope) {
    if (expr.type === 'column' && expr.ref && expr.ref.depth === 0) {
      return scope.sources[expr.ref.src].columns[expr.ref.col].type;
    }
    if (expr.type === 'func' && expr.agg && (expr.name === 'SUM' || expr.name === 'MIN' || expr.name === 'MAX') && expr.args.length === 1) {
      return outputType(expr.args[0], scope);
    }
    return null;
  }

  /**
   * Bindet eine SELECT-Anweisung (auch Unterabfragen).
   *
   * @param {Object} q - SELECT-Knoten.
   * @param {Object|null} parentScope - Scope der umgebenden Abfrage.
   * @param {Object|null} [cteEnv] - Sichtbare WITH-Abfragen (ohne Angabe: die des umgebenden Scopes).
   */
  function bindSelect(q, parentScope, cteEnv) {
    let env = cteEnv !== undefined ? cteEnv : (parentScope ? parentScope.cteEnv : null);
    if (q.with) {
      // WITH-Abfragen der Reihe nach: jede sieht nur die vorher definierten.
      for (const cte of q.with) {
        bindSelect(cte.query, null, env);
        cte.out = derivedColumns(cte.name, cte.columns, cte.query, cte.pos, { dat: 'der WITH-Abfrage', acc: 'die WITH-Abfrage' });
        env = { map: new Map([[cte.name.toLowerCase(), cte]]), parent: env };
      }
    }
    if (q.compound) {
      bindCompound(q, parentScope, env);
      return;
    }
    const scope = makeScope(parentScope, q);
    q.correlated = false;
    q.scope = scope;
    scope.cteEnv = env;
    const aliasNames = new Set(q.columns.filter((c) => c.kind === 'expr' && c.alias).map((c) => c.alias.toLowerCase()));
    const baseFlags = { aliasNames };

    q.fromPlan = q.from ? bindFrom(q.from, scope, baseFlags) : null;
    if (q.where) {
      q.where = bindExpr(q.where, scope, Object.assign({}, baseFlags, { clause: 'WHERE', allowAgg: false }));
      if (q.fromPlan) {
        assignWhereHashes(q.fromPlan, conjuncts(q.where, []), scope);
      }
    }
    checkConnectivity(q, scope);

    // SELECT-Liste (inklusive * und t.*)
    q.outputs = [];
    /** Alias (klein) → Ausdruck bzw. Position in der SELECT-Liste. */
    const aliasMap = new Map();
    const aliasPosition = new Map();
    /** Alias (klein) → Schreibweise wie in der SELECT-Liste (Verweise müssen exakt passen). */
    const aliasSpelling = new Map();
    for (const item of q.columns) {
      if (item.kind === 'star') {
        if (scope.sources.length === 0) {
          throw new SqlError('SELECT * braucht eine Tabelle in FROM.', item.pos);
        }
        let indices = scope.sources.map((s, i) => i);
        if (item.table !== null) {
          const idx = scope.sources.findIndex((s) => s.key === item.table.toLowerCase());
          if (idx < 0) {
            const labels = scope.sources.map((s) => s.label);
            const cand = suggest(item.table, labels);
            throw new SqlError('Unbekannte Tabelle bzw. unbekannter Alias „' + item.table + '“ in „' + item.table + '.*“.', item.pos,
              cand ? 'Meinten Sie „' + cand + '.*“?' : 'In FROM stehen: ' + labels.join(', ') + '.');
          }
          ns.sql.requireExactName(item.table, scope.sources[idx].label, 'Unbekannte Tabelle bzw. unbekannter Alias „' + item.table + '“ in „' + item.table + '.*“.', item.pos);
          indices = [idx];
        }
        for (const srcIdx of indices) {
          scope.sources[srcIdx].columns.forEach((c, col) => {
            q.outputs.push({ expr: { type: 'column', table: null, name: c.name, ref: { depth: 0, src: srcIdx, col }, pos: item.pos }, name: c.name, type: c.type });
          });
        }
      } else {
        const expr = bindExpr(item.expr, scope, Object.assign({}, baseFlags, { clause: 'SELECT', allowAgg: true }));
        const name = item.alias || (item.expr.type === 'column' ? item.expr.name : item.text);
        if (item.alias && !aliasMap.has(item.alias.toLowerCase())) {
          aliasMap.set(item.alias.toLowerCase(), expr);
          aliasSpelling.set(item.alias.toLowerCase(), item.alias);
          aliasPosition.set(item.alias.toLowerCase(), q.outputs.length);
        }
        q.outputs.push({ expr, name, type: outputType(expr, scope) });
      }
    }

    // GROUP BY
    q.groupExprs = q.groupBy.map((g) => {
      let expr;
      if (g.type === 'literal' && typeof g.value === 'number' && g.isInteger) {
        if (g.value < 1 || g.value > q.outputs.length) {
          throw new SqlError('GROUP BY ' + g.value + ': Die SELECT-Liste hat nur ' + q.outputs.length + ' Spalte(n).', g.pos);
        }
        expr = q.outputs[g.value - 1].expr;
      } else {
        expr = bindExpr(g, scope, Object.assign({}, baseFlags, { clause: 'GROUP BY', allowAgg: false, aliasMap, aliasSpelling, aliasFallback: true }));
      }
      if (containsAggregate(expr)) {
        throw new SqlError('Nach einer Aggregatfunktion kann nicht gruppiert werden.', g.pos);
      }
      return expr;
    });

    // HAVING
    if (q.having) {
      q.having = bindExpr(q.having, scope, Object.assign({}, baseFlags, { clause: 'HAVING', allowAgg: true, aliasMap, aliasSpelling, aliasFirst: true }));
    }

    // ORDER BY
    q.orderPlan = q.orderBy.map((o) => {
      const e = o.expr;
      if (e.type === 'literal' && typeof e.value === 'number' && e.isInteger) {
        if (e.value < 1 || e.value > q.outputs.length) {
          throw new SqlError('ORDER BY ' + e.value + ': Die SELECT-Liste hat nur ' + q.outputs.length + ' Spalte(n).', e.pos);
        }
        return { position: e.value - 1, desc: o.desc };
      }
      if (e.type === 'column' && e.table === null && aliasPosition.has(e.name.toLowerCase()) && aliasSpelling.get(e.name.toLowerCase()) === e.name) {
        return { position: aliasPosition.get(e.name.toLowerCase()), desc: o.desc };
      }
      return { expr: bindExpr(e, scope, Object.assign({}, baseFlags, { clause: 'ORDER BY', allowAgg: true, aliasMap, aliasSpelling, aliasFirst: true })), desc: o.desc };
    });

    q.aggregated = q.groupExprs.length > 0 || scope.hasAgg;
    q.width = scope.sources.length;
    if (q.aggregated) {
      const info = { groupKeys: new Set(), groupedCols: new Set(), determined: new Set(), hasGroupBy: q.groupExprs.length > 0 };
      for (const g of q.groupExprs) {
        info.groupKeys.add(exprKey(g));
        if (g.type === 'column' && g.ref.depth === 0) {
          info.groupedCols.add(g.ref.src + ':' + g.ref.col);
        }
      }
      scope.sources.forEach((src, i) => {
        if (src.pk && src.pk.every((col) => info.groupedCols.has(i + ':' + col))) {
          info.determined.add(i);
        }
      });
      q.outputs.forEach((o) => checkGrouped(o.expr, info));
      if (q.having) {
        checkGrouped(q.having, info);
      }
      q.orderPlan.forEach((p) => {
        if (p.expr) {
          checkGrouped(p.expr, info);
        }
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Hinweise (kein Fehler, das Ergebnis wird trotzdem angezeigt)
  // ---------------------------------------------------------------------------

  /** Höchstzahl der Hinweise je Anweisung. */
  const MAX_WARNINGS = 6;

  /** Klauseln, in denen Vergleiche mit Texten auf falsche Schreibung geprüft werden. */
  const LITERAL_CLAUSES = new Set(['WHERE', 'ON', 'HAVING']);

  /** Fügt einen Hinweis hinzu (ohne Doppelungen, höchstens MAX_WARNINGS). */
  function addWarning(text) {
    if (rt.warnings.length < MAX_WARNINGS && !rt.warnings.includes(text)) {
      rt.warnings.push(text);
    }
  }

  /**
   * Direkte Teilausdrücke eines Ausdrucks (ohne Unterabfragen).
   *
   * @param {Object} node - Ausdruck.
   * @returns {Array<Object>} Teilausdrücke.
   */
  function exprChildren(node) {
    switch (node.type) {
      case 'neg':
      case 'not':
        return [node.operand];
      case 'binary':
        return [node.left, node.right];
      case 'between':
        return [node.expr, node.low, node.high];
      case 'like':
        return [node.expr, node.pattern];
      case 'isnull':
        return [node.expr];
      case 'in':
        return node.list ? [node.expr].concat(node.list) : [node.expr];
      case 'func':
        return node.window ? windowParts(node) : node.args;
      case 'case':
        return caseParts(node);
      default:
        return [];
    }
  }

  /** @returns {Array<Object>} Alle ON-Bedingungen eines FROM-Plans. */
  function planConditions(plan, out) {
    if (plan && plan.type === 'join') {
      planConditions(plan.left, out);
      planConditions(plan.right, out);
      if (plan.on) {
        out.push(plan.on);
      }
    }
    return out;
  }

  /**
   * Sammelt die Quellen einer Abfrageebene, auf die ein Ausdruck verweist –
   * auch aus Unterabfragen heraus (dort mit entsprechend größerer Tiefe).
   *
   * @param {Object} node - Gebundener Ausdruck.
   * @param {number} depth - Abstand zur betrachteten Ebene.
   * @param {Set<number>} set - Gefundene Quellen (Index in scope.sources).
   */
  function collectSourceRefs(node, depth, set) {
    if (!node || typeof node !== 'object') {
      return;
    }
    if (node.type === 'column') {
      if (node.ref && node.ref.depth === depth) {
        set.add(node.ref.src);
      }
      return;
    }
    if (node.type === 'subquery' || node.type === 'exists' || (node.type === 'in' && node.query)) {
      if (node.type === 'in') {
        collectSourceRefs(node.expr, depth, set);
      }
      for (const p of queryParts(node.query)) {
        collectSourceRefs(p, depth + 1, set);
      }
      return;
    }
    for (const child of exprChildren(node)) {
      collectSourceRefs(child, depth, set);
    }
  }

  /** @returns {Array<Object>} Ausdrücke einer Abfrage (bei Mengenoperationen aller Glieder). */
  function queryParts(q) {
    if (q.compound) {
      return queryParts(q.compound.left).concat(queryParts(q.compound.right));
    }
    return planConditions(q.fromPlan, []).concat(q.where ? [q.where] : [], q.having ? [q.having] : [], (q.outputs || []).map((o) => o.expr));
  }

  /** @returns {string} Eine Quelle wie in FROM geschrieben, z. B. „bestellung b“. */
  function sourceLabel(src) {
    return '„' + (src.aliasGiven && src.tableName ? src.tableName + ' ' + src.label : src.label) + '“';
  }

  /** @returns {string} Aufzählung "a, b und c". */
  function joinList(items) {
    return items.length <= 1 ? items.join('') : items.slice(0, -1).join(', ') + ' und ' + items[items.length - 1];
  }

  /**
   * Sucht eine Verknüpfungsbedingung zwischen zwei Quellen aus einem Fremdschlüssel.
   *
   * @param {Object} from - Quelle mit dem Fremdschlüssel.
   * @param {Object} to - Quelle, auf die verwiesen wird.
   * @returns {string|null} Bedingung, z. B. "bp.bestellung_id = b.id".
   */
  function fkCondition(from, to) {
    if (!from.tableKey || !to.tableKey) {
      return null;
    }
    const fromTable = rt.db.tables.get(from.tableKey);
    const toTable = rt.db.tables.get(to.tableKey);
    if (!fromTable || !toTable) {
      return null;
    }
    for (const fk of fromTable.foreignKeys) {
      if (fk.refTable.toLowerCase() !== to.tableKey) {
        continue;
      }
      let refCols = fk.refColumns.slice();
      if (refCols.length === 0 && toTable.primaryKey) {
        refCols = toTable.primaryKey.map((i) => toTable.columns[i].name);
      }
      if (refCols.length !== fk.columns.length) {
        continue;
      }
      return fk.columns.map((c, k) => {
        const refIdx = toTable.colIndex.get(refCols[k].toLowerCase());
        const refName = refIdx === undefined ? refCols[k] : toTable.columns[refIdx].name;
        return from.label + '.' + fromTable.columns[c].name + ' = ' + to.label + '.' + refName;
      }).join(' AND ');
    }
    return null;
  }

  /**
   * Prüft, ob alle Tabellen einer Abfrageebene über Bedingungen verknüpft sind.
   * Fehlt eine Verknüpfung, wird jede Zeile mit jeder kombiniert (kartesisches
   * Produkt) – meist eine vergessene JOIN-Bedingung. Ein ausdrückliches
   * CROSS JOIN gilt als beabsichtigt.
   *
   * @param {Object} q - Gebundene SELECT-Anweisung (FROM und WHERE gebunden).
   * @param {Object} scope - Scope der Abfrage.
   */
  function checkConnectivity(q, scope) {
    const n = scope.sources.length;
    if (n < 2) {
      return;
    }
    const parent = scope.sources.map((s, i) => i);
    const find = (x) => {
      while (parent[x] !== x) {
        parent[x] = parent[parent[x]];
        x = parent[x];
      }
      return x;
    };
    const connect = (list) => {
      for (let k = 1; k < list.length; k++) {
        parent[find(list[k])] = find(list[0]);
      }
    };
    const markCross = (plan) => {
      if (plan && plan.type === 'join') {
        markCross(plan.left);
        markCross(plan.right);
        if (plan.kind === 'cross' && !plan.implicit) {
          const all = [];
          for (let i = plan.range[0]; i < plan.range[2]; i++) {
            all.push(i);
          }
          connect(all);
        }
      }
    };
    markCross(q.fromPlan);
    const conds = [];
    for (const on of planConditions(q.fromPlan, [])) {
      conjuncts(on, conds);
    }
    if (q.where) {
      conjuncts(q.where, conds);
    }
    for (const c of conds) {
      const set = new Set();
      collectSourceRefs(c, 0, set);
      connect(Array.from(set));
    }
    const groupMap = new Map();
    for (let i = 0; i < n; i++) {
      const root = find(i);
      if (!groupMap.has(root)) {
        groupMap.set(root, []);
      }
      groupMap.get(root).push(i);
    }
    if (groupMap.size < 2) {
      return;
    }
    const groups = Array.from(groupMap.values());
    const src = scope.sources;
    const parts = groups.map((g) => (g.length === 1 ? sourceLabel(src[g[0]]) : '(' + g.map((i) => sourceLabel(src[i])).join(', ') + ')'));
    let text;
    if (groups.length === 2 && groups[1].length === 1) {
      text = 'Die Tabelle ' + sourceLabel(src[groups[1][0]]) + ' ist mit ' +
        (groups[0].length === 1 ? sourceLabel(src[groups[0][0]]) : 'den übrigen Tabellen ' + parts[0]) + ' über keine Bedingung verknüpft.';
    } else {
      text = 'Die Tabellen in FROM sind nicht alle über Bedingungen verknüpft. Getrennte Gruppen: ' + joinList(parts) + '.';
    }
    text += ' Dadurch wird jede Zeile mit jeder kombiniert (kartesisches Produkt) – das Ergebnis enthält vermutlich zu viele Zeilen.';
    // Vorschläge aus Fremdschlüsseln: je getrennter Gruppe eine Bedingung zu einer anderen Gruppe.
    const proposals = [];
    for (let g = 1; g < groups.length && proposals.length < 3; g++) {
      let found = null;
      for (let h = 0; h < groups.length && !found; h++) {
        if (h === g) {
          continue;
        }
        for (const i of groups[g]) {
          for (const j of groups[h]) {
            found = found || fkCondition(src[i], src[j]) || fkCondition(src[j], src[i]);
          }
        }
      }
      if (found && !proposals.includes('„' + found + '“')) {
        proposals.push('„' + found + '“');
      }
    }
    if (proposals.length === 1) {
      text += ' Fehlt eine Bedingung wie ' + proposals[0] + ' (mit JOIN … ON … oder in WHERE)?';
    } else if (proposals.length > 1) {
      text += ' Fehlen Bedingungen wie ' + joinList(proposals) + ' (mit JOIN … ON … oder in WHERE)?';
    } else {
      text += ' Fehlt eine Verknüpfungsbedingung (JOIN … ON … oder in WHERE)?';
    }
    text += ' Ist das kartesische Produkt beabsichtigt, schreiben Sie CROSS JOIN.';
    addWarning((q === rt.topQuery || q.topLevel ? '' : 'In einer Unterabfrage: ') + text);
  }

  /**
   * Merkt Vergleiche einer Spalte mit einem Text vor (=, IN, LIKE), um nach der
   * Ausführung auf Werte hinzuweisen, die sich nur in der Schreibung unterscheiden.
   *
   * @param {Object} node - Gebundener Vergleich.
   * @param {Object} scope - Scope.
   * @param {Object} flags - Kontext (clause).
   */
  function noteLiteralComparison(node, scope, flags) {
    if (!rt || !rt.literalChecks || !LITERAL_CLAUSES.has(flags.clause) || rt.literalChecks.length >= 20) {
      return;
    }
    let column = null;
    let values = [];
    let kind = 'eq';
    const isText = (e) => e.type === 'literal' && typeof e.value === 'string' && e.value.toLowerCase() !== e.value.toUpperCase();
    if (node.type === 'binary' && node.op === '=') {
      if (node.left.type === 'column' && isText(node.right)) {
        column = node.left;
        values = [node.right.value];
      } else if (node.right.type === 'column' && isText(node.left)) {
        column = node.right;
        values = [node.left.value];
      }
    } else if (node.type === 'in' && node.list && !node.not && node.expr.type === 'column') {
      column = node.expr;
      values = node.list.filter(isText).map((e) => e.value);
    } else if (node.type === 'like' && !node.not && node.expr.type === 'column' && isText(node.pattern)) {
      column = node.expr;
      values = [node.pattern.value];
      kind = 'like';
    }
    if (!column || !column.ref || values.length === 0) {
      return;
    }
    let s = scope;
    for (let d = column.ref.depth; d > 0 && s; d--) {
      s = s.parent;
    }
    const source = s ? s.sources[column.ref.src] : null;
    const table = source && source.tableKey ? rt.db.tables.get(source.tableKey) : null;
    if (!table) {
      return;
    }
    rt.literalChecks.push({ table, rows: table.rows.slice(), col: column.ref.col, values, kind });
  }

  /**
   * Weist auf Texte hin, die so in der Spalte nicht vorkommen, wohl aber in
   * anderer Groß-/Kleinschreibung. Geprüft wird der Tabelleninhalt vor der Anweisung.
   */
  function literalCaseHints() {
    for (const lc of rt.literalChecks) {
      for (const text of lc.values) {
        if (rt.warnings.length >= MAX_WARNINGS) {
          return;
        }
        let exact = false;
        let similar = null;
        const folded = V.textKey(text).toLowerCase();
        for (const row of lc.rows) {
          tick();
          const v = row[lc.col];
          if (typeof v !== 'string') {
            continue;
          }
          if (lc.kind === 'like') {
            if (likeMatch(v, text)) {
              exact = true;
              break;
            }
            if (similar === null && likeMatch(v, text, true)) {
              similar = v;
            }
          } else {
            if (V.compareValues(v, text) === 0) {
              exact = true;
              break;
            }
            if (similar === null && V.textKey(v).toLowerCase() === folded) {
              similar = v;
            }
          }
        }
        if (exact || similar === null) {
          continue;
        }
        const where = '„' + lc.table.name + '.' + lc.table.columns[lc.col].name + '“';
        if (lc.kind === 'like') {
          addWarning('Das Muster ' + show(text) + ' passt auf keinen Wert in ' + where + ', ohne Beachtung der Groß-/Kleinschreibung aber z. B. auf ' +
            show(similar) + '. Bei LIKE kommt es auf die Groß-/Kleinschreibung an.');
        } else {
          addWarning('In ' + where + ' gibt es den Wert ' + show(text) + ' nicht, wohl aber ' + show(similar) + '. Meinten Sie ' + show(similar) +
            '? Texte werden mit Beachtung der Groß-/Kleinschreibung verglichen.');
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Auswerten
  // ---------------------------------------------------------------------------

  /**
   * Wandelt einen Wert für Rechenoperationen in eine Zahl um.
   *
   * @param {*} v - Wert (nicht null).
   * @param {Object} node - Ausdruck (für die Position).
   * @returns {number} Zahl.
   */
  function toNumber(v, node) {
    if (typeof v === 'number') {
      return v;
    }
    const n = V.numericValue(v);
    if (n === null) {
      throw new SqlError('Mit dem Text ' + show(v) + ' kann nicht gerechnet werden.', node.pos,
        'Rechnen ist nur mit Zahlen möglich. Datumswerte sind in diesem Simulator Texte (JJJJ-MM-TT).');
    }
    return n;
  }

  /**
   * Prüft das Ergebnis einer Rechnung.
   *
   * @param {number} n - Ergebnis.
   * @param {Object} node - Ausdruck.
   * @returns {number} Ergebnis.
   */
  function checkFinite(n, node) {
    if (!Number.isFinite(n)) {
      throw new SqlError('Das Ergebnis der Rechnung ist zu groß.', node.pos);
    }
    return n;
  }

  /**
   * Vergleicht einen Text mit einem LIKE-Muster (% = beliebig viele Zeichen,
   * _ = genau ein Zeichen, \ maskiert das folgende Zeichen). Groß-/Kleinschreibung zählt
   * (außer mit ignoreCase – das dient nur dem Hinweis auf eine falsche Schreibung).
   * Laufzeit höchstens Textlänge × Musterlänge, ohne reguläre Ausdrücke.
   *
   * @param {string} text - Text.
   * @param {string} pattern - Muster.
   * @param {boolean} [ignoreCase=false] - Groß-/Kleinschreibung nicht beachten.
   * @returns {boolean} true bei Übereinstimmung.
   */
  function likeMatch(text, pattern, ignoreCase) {
    const t = Array.from(ignoreCase ? text.toLowerCase() : text);
    const raw = Array.from(ignoreCase ? pattern.toLowerCase() : pattern);
    const p = [];
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] === '\\' && i + 1 < raw.length) {
        p.push({ ch: raw[++i] });
      } else if (raw[i] === '%') {
        if (p.length === 0 || !p[p.length - 1].any) {
          p.push({ any: true });
        }
      } else if (raw[i] === '_') {
        p.push({ one: true });
      } else {
        p.push({ ch: raw[i] });
      }
    }
    let ti = 0;
    let pi = 0;
    let starP = -1;
    let starT = 0;
    while (ti < t.length) {
      if (pi < p.length && (p[pi].one || (p[pi].ch !== undefined && p[pi].ch === t[ti]))) {
        ti++;
        pi++;
      } else if (pi < p.length && p[pi].any) {
        starP = pi++;
        starT = ti;
      } else if (starP >= 0) {
        pi = starP + 1;
        ti = ++starT;
      } else {
        return false;
      }
    }
    while (pi < p.length && p[pi].any) {
      pi++;
    }
    return pi === p.length;
  }

  /**
   * Erstellt eine schnelle Prüfung "Wert ist in Liste" (für IN mit Unterabfrage),
   * die dieselbe Gleichheit wie compareValues verwendet.
   *
   * @param {Array<*>} values - Werte.
   * @returns {{has: function(*): boolean, hasNull: boolean}} Prüfer.
   */
  function makeMatcher(values) {
    const numbers = new Set();
    const numericTexts = new Set();
    const texts = new Set();
    let hasNull = false;
    for (const v of values) {
      if (v === null) {
        hasNull = true;
      } else if (typeof v === 'number') {
        numbers.add(v);
      } else {
        texts.add(V.textKey(v));
        const n = V.numericValue(v);
        if (n !== null) {
          numericTexts.add(n);
        }
      }
    }
    return {
      hasNull,
      has(v) {
        if (typeof v === 'number') {
          return numbers.has(v) || numericTexts.has(v);
        }
        if (texts.has(V.textKey(v))) {
          return true;
        }
        const n = V.numericValue(v);
        return n !== null && numbers.has(n);
      }
    };
  }

  /**
   * Führt eine Unterabfrage aus (unkorrelierte Ergebnisse werden zwischengespeichert).
   *
   * @param {Object} query - Gebundene SELECT-Anweisung.
   * @param {Object} ctx - Aktueller Kontext.
   * @returns {Object} Ergebnis {columns, types, rows}.
   */
  function runSubquery(query, ctx) {
    if (!query.correlated) {
      if (!query.cachedResult) {
        query.cachedResult = runSelect(query, null, false);
      }
      return query.cachedResult;
    }
    return runSelect(query, ctx, false);
  }

  /** Wertet eine Aggregatfunktion über die Gruppe des Kontexts aus. */
  function evalAggregate(node, ctx) {
    if (!ctx.group) {
      throw new Error('Aggregatfunktion ohne Gruppe');
    }
    if (ctx.aggCache.has(node)) {
      return ctx.aggCache.get(node);
    }
    const group = ctx.group;
    let result;
    if (node.star) {
      result = group.length;
    } else {
      const rowCtx = { frame: null, parent: ctx.parent, offset: 0 };
      const seen = node.distinct ? new Set() : null;
      let count = 0;
      let sum = 0;
      let best = null;
      for (const frame of group) {
        tick();
        rowCtx.frame = frame;
        const v = evalExpr(node.args[0], rowCtx);
        if (v === null) {
          continue;
        }
        if (seen) {
          const k = V.valueKey(v);
          if (seen.has(k)) {
            continue;
          }
          seen.add(k);
        }
        switch (node.name) {
          case 'COUNT':
            count++;
            break;
          case 'SUM':
          case 'AVG':
            sum += toNumber(v, node.args[0]);
            count++;
            break;
          case 'MIN':
            if (best === null || V.compareValues(v, best) < 0) {
              best = v;
            }
            break;
          case 'MAX':
            if (best === null || V.compareValues(v, best) > 0) {
              best = v;
            }
            break;
          default:
            throw new Error('Unbekannte Aggregatfunktion');
        }
      }
      if (node.name === 'COUNT') {
        result = count;
      } else if (node.name === 'SUM') {
        result = count ? checkFinite(sum, node) : null;
      } else if (node.name === 'AVG') {
        result = count ? checkFinite(sum / count, node) : null;
      } else {
        result = best;
      }
    }
    ctx.aggCache.set(node, result);
    return result;
  }

  /** Dreiwertiges UND bzw. ODER mit Kurzschluss. */
  function evalLogic(node, ctx) {
    const l = V.truth(evalExpr(node.left, ctx));
    if (node.op === 'AND') {
      if (l === false) {
        return 0;
      }
      const r = V.truth(evalExpr(node.right, ctx));
      if (r === false) {
        return 0;
      }
      return (l === null || r === null) ? null : 1;
    }
    if (l === true) {
      return 1;
    }
    const r = V.truth(evalExpr(node.right, ctx));
    if (r === true) {
      return 1;
    }
    return (l === null || r === null) ? null : 0;
  }

  /** Negiert einen SQL-Wahrheitswert (NULL bleibt NULL). */
  function negate(value, not) {
    if (!not || value === null) {
      return value;
    }
    return value ? 0 : 1;
  }

  /**
   * Wertet einen gebundenen Ausdruck aus.
   *
   * @param {Object} node - Ausdruck.
   * @param {Object} ctx - Kontext {frame, parent, offset, group?, aggCache?}.
   * @returns {*} SQL-Wert.
   */
  function evalExpr(node, ctx) {
    switch (node.type) {
      case 'literal':
        return node.value;
      case 'column': {
        let c = ctx;
        for (let d = node.ref.depth; d > 0; d--) {
          c = c.parent;
        }
        const row = c.frame[node.ref.src - c.offset];
        return row ? row[node.ref.col] : null;
      }
      case 'neg': {
        const v = evalExpr(node.operand, ctx);
        return v === null ? null : -toNumber(v, node.operand);
      }
      case 'not': {
        const t = V.truth(evalExpr(node.operand, ctx));
        return t === null ? null : (t ? 0 : 1);
      }
      case 'binary': {
        if (node.op === 'AND' || node.op === 'OR') {
          return evalLogic(node, ctx);
        }
        const l = evalExpr(node.left, ctx);
        const r = evalExpr(node.right, ctx);
        if (COMPARISON_OPS.has(node.op)) {
          const c = V.compareValues(l, r);
          if (c === null) {
            return null;
          }
          switch (node.op) {
            case '=': return c === 0 ? 1 : 0;
            case '<>': return c !== 0 ? 1 : 0;
            case '<': return c < 0 ? 1 : 0;
            case '<=': return c <= 0 ? 1 : 0;
            case '>': return c > 0 ? 1 : 0;
            default: return c >= 0 ? 1 : 0;
          }
        }
        if (l === null || r === null) {
          return null;
        }
        const a = toNumber(l, node.left);
        const b = toNumber(r, node.right);
        switch (node.op) {
          case '+': return checkFinite(a + b, node);
          case '-': return checkFinite(a - b, node);
          case '*': return checkFinite(a * b, node);
          case '/': return b === 0 ? null : checkFinite(a / b, node);
          case '%': return b === 0 ? null : a % b;
          default: throw new Error('Unbekannter Operator ' + node.op);
        }
      }
      case 'between': {
        const v = evalExpr(node.expr, ctx);
        const c1 = V.compareValues(v, evalExpr(node.low, ctx));
        const c2 = V.compareValues(v, evalExpr(node.high, ctx));
        const t1 = c1 === null ? null : c1 >= 0;
        const t2 = c2 === null ? null : c2 <= 0;
        let res;
        if (t1 === false || t2 === false) {
          res = 0;
        } else if (t1 === null || t2 === null) {
          res = null;
        } else {
          res = 1;
        }
        return negate(res, node.not);
      }
      case 'like': {
        const v = evalExpr(node.expr, ctx);
        const p = evalExpr(node.pattern, ctx);
        if (v === null || p === null) {
          return null;
        }
        const text = typeof v === 'number' ? V.formatValue(v, null) : v;
        const pattern = typeof p === 'number' ? V.formatValue(p, null) : p;
        return negate(likeMatch(text, pattern) ? 1 : 0, node.not);
      }
      case 'isnull': {
        const isNull = evalExpr(node.expr, ctx) === null;
        return (isNull !== node.not) ? 1 : 0;
      }
      case 'in': {
        const v = evalExpr(node.expr, ctx);
        if (v === null) {
          return null;
        }
        let found = false;
        let hasNull = false;
        if (node.list) {
          for (const e of node.list) {
            const c = V.compareValues(v, evalExpr(e, ctx));
            if (c === null) {
              hasNull = true;
            } else if (c === 0) {
              found = true;
              break;
            }
          }
        } else {
          let matcher;
          if (!node.query.correlated && node.matcher) {
            matcher = node.matcher;
          } else {
            const res = runSubquery(node.query, ctx);
            matcher = makeMatcher(res.rows.map((row) => row[0]));
            if (!node.query.correlated) {
              node.matcher = matcher;
            }
          }
          found = matcher.has(v);
          hasNull = matcher.hasNull;
        }
        return negate(found ? 1 : (hasNull ? null : 0), node.not);
      }
      case 'exists':
        return runSubquery(node.query, ctx).rows.length > 0 ? 1 : 0;
      case 'subquery': {
        const res = runSubquery(node.query, ctx);
        if (res.rows.length > 1) {
          throw new SqlError('Die Unterabfrage liefert mehr als eine Zeile (' + res.rows.length + '), hier wird aber genau ein Wert erwartet.', node.pos,
            'Verwenden Sie IN statt = oder grenzen Sie die Unterabfrage ein (z. B. mit MAX(…) oder LIMIT 1).');
        }
        return res.rows.length === 0 ? null : res.rows[0][0];
      }
      case 'case': {
        if (node.operand) {
          const v = evalExpr(node.operand, ctx);
          for (const w of node.whens) {
            if (V.compareValues(v, evalExpr(w.when, ctx)) === 0) {
              return evalExpr(w.then, ctx);
            }
          }
        } else {
          for (const w of node.whens) {
            if (V.truth(evalExpr(w.when, ctx)) === true) {
              return evalExpr(w.then, ctx);
            }
          }
        }
        return node.otherwise ? evalExpr(node.otherwise, ctx) : null;
      }
      case 'func': {
        if (node.window) {
          return ctx.winValues ? ctx.winValues.get(node) : null;
        }
        if (node.agg) {
          return evalAggregate(node, ctx);
        }
        // ROUND
        const x = evalExpr(node.args[0], ctx);
        const d = node.args.length > 1 ? evalExpr(node.args[1], ctx) : 0;
        if (x === null || d === null) {
          return null;
        }
        const digits = toNumber(d, node.args[1] || node);
        if (!Number.isInteger(digits) || digits < -30 || digits > 30) {
          throw new SqlError('ROUND: Die Anzahl der Nachkommastellen muss eine ganze Zahl zwischen -30 und 30 sein.', node.pos);
        }
        return ns.sql.roundHalfAway(toNumber(x, node.args[0]), digits);
      }
      default:
        throw new Error('Unbekannter Ausdruck ' + node.type);
    }
  }

  /** Fehler bei zu großem Zwischenergebnis. */
  function tooLarge(plan) {
    return new SqlError('Das Zwischenergebnis der Verknüpfung hat mehr als ' + EXEC_LIMITS.maxJoinRows.toLocaleString('de-DE') + ' Zeilen.', null,
      plan.kind === 'cross'
        ? 'Ohne Bedingung wird jede Zeile mit jeder kombiniert (kartesisches Produkt). Fehlt eine Bedingung wie WHERE a.id = b.a_id oder JOIN … ON …?'
        : 'Prüfen Sie die Verknüpfungsbedingung nach ON.');
  }

  /**
   * Erzeugt die Zeilen-Kombinationen (Frames) eines FROM-Plans.
   * Ein Frame enthält je Quelle des Teilbaums einen Datensatz (oder null bei OUTER JOIN).
   *
   * @param {Object} plan - Plan aus bindFrom.
   * @param {Object|null} outerCtx - Kontext der umgebenden Abfrage.
   * @returns {Array<Array<Array<*>|null>>} Frames.
   */
  function runFrom(plan, outerCtx) {
    if (plan.type === 'table') {
      return plan.table.rows.map((r) => [r]);
    }
    if (plan.type === 'derived') {
      // Abgeleitete Quellen sind nie korreliert: einmal je Anweisung berechnen (WITH-Abfragen
      // werden so auch bei mehrfacher Verwendung und in korrelierten Unterabfragen nur einmal ausgewertet).
      const holder = plan.cte || plan;
      if (!holder.cachedFrames) {
        holder.cachedFrames = runSelect(plan.query, null, false).rows.map((r) => [r]);
      }
      return holder.cachedFrames;
    }
    const L = runFrom(plan.left, outerCtx);
    const R = runFrom(plan.right, outerCtx);
    const [r0, r1, r2] = plan.range;
    const nullsL = new Array(r1 - r0).fill(null);
    const nullsR = new Array(r2 - r1).fill(null);
    const onCtx = { frame: null, parent: outerCtx, offset: r0 };
    const test = (frame) => {
      if (!plan.on) {
        return true;
      }
      onCtx.frame = frame;
      return V.truth(evalExpr(plan.on, onCtx)) === true;
    };
    const out = [];
    const push = (frame) => {
      out.push(frame);
      if (out.length > EXEC_LIMITS.maxJoinRows) {
        throw tooLarge(plan);
      }
    };
    const hash = plan.hash;
    const hashKey = (v) => (hash.category === 'number' ? (typeof v === 'number' ? v : V.numericValue(String(v))) : V.textKey(String(v)));
    const buildIndex = (frames, ref, base) => {
      const map = new Map();
      frames.forEach((f, idx) => {
        const row = f[ref.src - base];
        const v = row ? row[ref.col] : null;
        if (v === null) {
          return;
        }
        const k = hashKey(v);
        let list = map.get(k);
        if (!list) {
          list = [];
          map.set(k, list);
        }
        list.push(idx);
      });
      return map;
    };
    const keyOf = (frame, ref, base) => {
      const row = frame[ref.src - base];
      const v = row ? row[ref.col] : null;
      return v === null ? null : hashKey(v);
    };
    const EMPTY = [];

    if (plan.kind === 'right') {
      // Äußere Schleife über die rechte Seite, damit die Reihenfolge der rechten Tabelle folgt.
      const index = hash ? buildIndex(L, hash.left, r0) : null;
      for (const rf of R) {
        let matched = false;
        const k = hash ? keyOf(rf, hash.right, r1) : null;
        const list = hash ? (k === null ? EMPTY : (index.get(k) || EMPTY)) : null;
        const count = hash ? list.length : L.length;
        for (let x = 0; x < count; x++) {
          tick();
          const frame = L[hash ? list[x] : x].concat(rf);
          if (test(frame)) {
            matched = true;
            push(frame);
          }
        }
        if (!matched) {
          push(nullsL.concat(rf));
        }
      }
      return out;
    }

    const index = hash ? buildIndex(R, hash.right, r1) : null;
    for (const lf of L) {
      let matched = false;
      const k = hash ? keyOf(lf, hash.left, r0) : null;
      const list = hash ? (k === null ? EMPTY : (index.get(k) || EMPTY)) : null;
      const count = hash ? list.length : R.length;
      for (let x = 0; x < count; x++) {
        tick();
        const frame = lf.concat(R[hash ? list[x] : x]);
        if (test(frame)) {
          matched = true;
          push(frame);
        }
      }
      if (!matched && plan.kind === 'left') {
        push(lf.concat(nullsR));
      }
    }
    return out;
  }

  /**
   * Berechnet die Fensterfunktionen einer Abfrageebene für alle Ergebniszeilen
   * (Kontexte nach WHERE, GROUP BY und HAVING). Ergebnis je Kontext in ctx.winValues.
   * Rahmen wie im SQL-Standard: ohne ORDER BY die ganze Partition, mit ORDER BY
   * alle Zeilen bis einschließlich der gleichrangigen (Peers) der aktuellen Zeile.
   *
   * @param {Array<Object>} windows - Gebundene Fensterfunktionen.
   * @param {Array<Object>} ctxs - Kontexte der Ergebniszeilen.
   */
  function computeWindows(windows, ctxs) {
    for (const c of ctxs) {
      if (!c.winValues) {
        c.winValues = new Map();
      }
    }
    for (const w of windows) {
      const partitions = new Map();
      for (const c of ctxs) {
        tick();
        let key = '';
        for (const p of w.over.partition) {
          key += V.valueKey(evalExpr(p, c)) + '\u0001';
        }
        let list = partitions.get(key);
        if (!list) {
          list = [];
          partitions.set(key, list);
        }
        list.push(c);
      }
      for (const list of partitions.values()) {
        const keys = list.map((c) => w.over.order.map((o) => evalExpr(o.expr, c)));
        const idx = list.map((c, i) => i);
        if (w.over.order.length > 0) {
          idx.sort((a, b) => {
            for (let k = 0; k < w.over.order.length; k++) {
              const cmp = V.orderValues(keys[a][k], keys[b][k]);
              if (cmp !== 0) {
                return w.over.order[k].desc ? -cmp : cmp;
              }
            }
            return a - b;
          });
        }
        const rows = idx.map((i) => list[i]);
        const rowKeys = idx.map((i) => keys[i]);
        const peers = (i, j) => w.over.order.every((o, k) => V.orderValues(rowKeys[i][k], rowKeys[j][k]) === 0);
        windowValues(w, rows, peers);
      }
    }
  }

  /**
   * Berechnet eine Fensterfunktion für die sortierten Zeilen einer Partition.
   *
   * @param {Object} w - Fensterfunktion.
   * @param {Array<Object>} rows - Kontexte in Fensterreihenfolge.
   * @param {function(number, number): boolean} peers - true, wenn zwei Zeilen gleichrangig sind.
   */
  function windowValues(w, rows, peers) {
    const n = rows.length;
    const set = (i, v) => rows[i].winValues.set(w, v);
    switch (w.name) {
      case 'ROW_NUMBER':
        rows.forEach((c, i) => set(i, i + 1));
        return;
      case 'RANK':
      case 'DENSE_RANK': {
        let rank = 0;
        let dense = 0;
        for (let i = 0; i < n; i++) {
          if (i === 0 || !peers(i, i - 1)) {
            rank = i + 1;
            dense++;
          }
          set(i, w.name === 'RANK' ? rank : dense);
        }
        return;
      }
      case 'LAG':
      case 'LEAD': {
        const values = rows.map((c) => evalExpr(w.args[0], c));
        for (let i = 0; i < n; i++) {
          tick();
          let offset = 1;
          if (w.args[1]) {
            const o = evalExpr(w.args[1], rows[i]);
            offset = o === null ? null : toNumber(o, w.args[1]);
            if (offset === null || !Number.isInteger(offset) || offset < 0) {
              throw new SqlError(w.name + ': Der Abstand muss eine ganze Zahl ≥ 0 sein.', w.args[1].pos);
            }
          }
          const j = w.name === 'LAG' ? i - offset : i + offset;
          set(i, j >= 0 && j < n ? values[j] : (w.args[2] ? evalExpr(w.args[2], rows[i]) : null));
        }
        return;
      }
      default: {
        // Aggregat als Fensterfunktion
        const values = rows.map((c) => (w.star ? 1 : evalExpr(w.args[0], c)));
        const acc = { count: 0, sum: 0, best: null };
        const add = (v) => {
          if (v === null) {
            return;
          }
          acc.count++;
          if (w.name === 'SUM' || w.name === 'AVG') {
            acc.sum += toNumber(v, w.args[0]);
          } else if (w.name === 'MIN' || w.name === 'MAX') {
            const cmp = acc.best === null ? null : V.compareValues(v, acc.best);
            if (acc.best === null || (w.name === 'MIN' ? cmp < 0 : cmp > 0)) {
              acc.best = v;
            }
          }
        };
        const result = () => {
          switch (w.name) {
            case 'COUNT': return acc.count;
            case 'SUM': return acc.count ? checkFinite(acc.sum, w) : null;
            case 'AVG': return acc.count ? checkFinite(acc.sum / acc.count, w) : null;
            default: return acc.best;
          }
        };
        if (w.over.order.length === 0) {
          values.forEach((v) => {
            tick();
            add(v);
          });
          const r = result();
          rows.forEach((c, i) => set(i, r));
          return;
        }
        let i = 0;
        while (i < n) {
          let j = i;
          while (j + 1 < n && peers(j + 1, i)) {
            j++;
          }
          for (let k = i; k <= j; k++) {
            tick();
            add(values[k]);
          }
          const r = result();
          for (let k = i; k <= j; k++) {
            set(k, r);
          }
          i = j + 1;
        }
      }
    }
  }

  /**
   * Wertet eine Mengenoperation aus. Zeilen gelten als gleich, wenn alle Werte
   * im Sinne von DISTINCT gleich sind (NULL = NULL, Groß-/Kleinschreibung zählt).
   *
   * @param {Object} q - Gebundener Verbund-Knoten.
   * @param {Object|null} outerCtx - Kontext der umgebenden Abfrage.
   * @param {boolean} isTop - true für die äußerste Abfrage (Grenze für die Ergebnisgröße).
   * @returns {{columns:Array<string>, types:Array<Object|null>, rows:Array<Array<*>>}} Ergebnis.
   */
  function runCompound(q, outerCtx, isTop) {
    const c = q.compound;
    const L = runSelect(c.left, outerCtx, false).rows;
    const R = runSelect(c.right, outerCtx, false).rows;
    const key = (row) => row.map(V.valueKey).join('\u0001');
    let rows = [];
    if (c.op === 'UNION') {
      if (c.all) {
        rows = L.concat(R);
      } else {
        const seen = new Set();
        for (const row of L.concat(R)) {
          tick();
          const k = key(row);
          if (!seen.has(k)) {
            seen.add(k);
            rows.push(row);
          }
        }
      }
    } else {
      // INTERSECT bzw. EXCEPT: Häufigkeiten der rechten Seite zählen.
      const counts = new Map();
      for (const row of R) {
        tick();
        const k = key(row);
        counts.set(k, (counts.get(k) || 0) + 1);
      }
      const seen = new Set();
      for (const row of L) {
        tick();
        const k = key(row);
        const n = counts.get(k) || 0;
        if (c.all) {
          if (n > 0) {
            counts.set(k, n - 1);
          }
          if ((c.op === 'INTERSECT') === (n > 0)) {
            rows.push(row);
          }
        } else if ((c.op === 'INTERSECT') === (n > 0) && !seen.has(k)) {
          seen.add(k);
          rows.push(row);
        }
      }
    }
    if (q.orderPlan.length > 0) {
      const indexed = rows.map((row, i) => ({ row, i }));
      indexed.sort((a, b) => {
        for (const p of q.orderPlan) {
          const cmp = V.orderValues(a.row[p.position], b.row[p.position]);
          if (cmp !== 0) {
            return p.desc ? -cmp : cmp;
          }
        }
        return a.i - b.i;
      });
      rows = indexed.map((x) => x.row);
    }
    if (q.limit) {
      rows = rows.slice(q.limit.offset, q.limit.offset + q.limit.count);
    }
    if (isTop && rows.length > EXEC_LIMITS.maxResultRows) {
      throw new SqlError('Das Ergebnis hätte ' + rows.length.toLocaleString('de-DE') + ' Zeilen – erlaubt sind höchstens ' +
        EXEC_LIMITS.maxResultRows.toLocaleString('de-DE') + '.', null, 'Grenzen Sie das Ergebnis mit WHERE oder LIMIT ein.');
    }
    return { columns: q.outputs.map((o) => o.name), types: q.outputs.map((o) => o.type), rows };
  }

  /**
   * Wertet eine gebundene SELECT-Anweisung aus.
   *
   * @param {Object} q - SELECT-Knoten (gebunden).
   * @param {Object|null} outerCtx - Kontext der umgebenden Abfrage (korrelierte Unterabfragen).
   * @param {boolean} isTop - true für die äußerste Abfrage (Grenze für die Ergebnisgröße).
   * @returns {{columns:Array<string>, types:Array<Object|null>, rows:Array<Array<*>>}} Ergebnis.
   */
  function runSelect(q, outerCtx, isTop) {
    if (q.compound) {
      return runCompound(q, outerCtx, isTop);
    }
    let frames = q.fromPlan ? runFrom(q.fromPlan, outerCtx) : [[]];
    if (q.where) {
      const kept = [];
      const ctx = { frame: null, parent: outerCtx, offset: 0 };
      for (const f of frames) {
        tick();
        ctx.frame = f;
        if (V.truth(evalExpr(q.where, ctx)) === true) {
          kept.push(f);
        }
      }
      frames = kept;
    }

    let ctxs;
    if (q.aggregated) {
      let groups;
      if (q.groupExprs.length === 0) {
        groups = [frames];
      } else {
        const map = new Map();
        const ctx = { frame: null, parent: outerCtx, offset: 0 };
        for (const f of frames) {
          tick();
          ctx.frame = f;
          let key = '';
          for (const g of q.groupExprs) {
            key += V.valueKey(evalExpr(g, ctx)) + '\u0001';
          }
          let list = map.get(key);
          if (!list) {
            list = [];
            map.set(key, list);
          }
          list.push(f);
        }
        groups = Array.from(map.values());
      }
      ctxs = groups.map((g) => ({
        frame: g.length ? g[0] : new Array(q.width).fill(null),
        parent: outerCtx, offset: 0, group: g, aggCache: new Map()
      }));
    } else {
      ctxs = frames.map((f) => ({ frame: f, parent: outerCtx, offset: 0 }));
    }

    if (q.having) {
      ctxs = ctxs.filter((c) => {
        tick();
        return V.truth(evalExpr(q.having, c)) === true;
      });
    }

    if (q.scope.windows.length > 0) {
      computeWindows(q.scope.windows, ctxs);
    }

    const rows = ctxs.map((c) => {
      tick();
      return q.outputs.map((o) => evalExpr(o.expr, c));
    });

    let order = rows.map((r, i) => i);
    if (q.distinct) {
      const seen = new Set();
      order = order.filter((i) => {
        const key = rows[i].map(V.valueKey).join('\u0001');
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
    }
    if (q.orderPlan.length > 0) {
      const keys = new Map();
      for (const i of order) {
        tick();
        keys.set(i, q.orderPlan.map((p) => (p.position !== undefined ? rows[i][p.position] : evalExpr(p.expr, ctxs[i]))));
      }
      order.sort((a, b) => {
        const ka = keys.get(a);
        const kb = keys.get(b);
        for (let k = 0; k < ka.length; k++) {
          const c = V.orderValues(ka[k], kb[k]);
          if (c !== 0) {
            return q.orderPlan[k].desc ? -c : c;
          }
        }
        return a - b;
      });
    }
    if (q.limit) {
      order = order.slice(q.limit.offset, q.limit.offset + q.limit.count);
    }
    if (isTop && order.length > EXEC_LIMITS.maxResultRows) {
      throw new SqlError('Das Ergebnis hätte ' + order.length.toLocaleString('de-DE') + ' Zeilen – erlaubt sind höchstens ' +
        EXEC_LIMITS.maxResultRows.toLocaleString('de-DE') + '.', null, 'Grenzen Sie das Ergebnis mit WHERE oder LIMIT ein.');
    }
    return {
      columns: q.outputs.map((o) => o.name),
      types: q.outputs.map((o) => o.type),
      rows: order.map((i) => rows[i])
    };
  }

  // ---------------------------------------------------------------------------
  // CHECK-Bedingungen
  // ---------------------------------------------------------------------------

  /** Lehnt Unterabfragen in einer CHECK-Bedingung ab (wie MySQL). */
  function rejectSubqueries(node) {
    if (node.type === 'subquery' || node.type === 'exists' || (node.type === 'in' && node.query)) {
      throw new SqlError('In einer CHECK-Bedingung sind keine Unterabfragen erlaubt.', node.pos,
        'Eine CHECK-Bedingung darf sich nur auf die Werte des eigenen Datensatzes beziehen.');
    }
    for (const child of exprChildren(node)) {
      rejectSubqueries(child);
    }
  }

  /** @returns {Array<number>} Spaltenindizes, die in einer gebundenen Bedingung vorkommen. */
  function checkColumns(node, out) {
    if (node.type === 'column') {
      if (!out.includes(node.ref.col)) {
        out.push(node.ref.col);
      }
    } else {
      for (const child of exprChildren(node)) {
        checkColumns(child, out);
      }
    }
    return out;
  }

  /**
   * Erzeugt die Fehlermeldung für einen Datensatz, der eine CHECK-Bedingung verletzt.
   *
   * @param {Object} table - Tabelle.
   * @param {Object} check - CHECK-Bedingung (gebunden).
   * @param {Array<*>} row - Datensatz.
   * @param {Object|null} pos - Position.
   * @param {boolean} existing - true für vorhandene Datensätze (beim Anlegen der Bedingung).
   * @returns {SqlError} Fehler.
   */
  function checkViolation(table, check, row, pos, existing) {
    const values = checkColumns(check.expr, []).map((i) => {
      const v = row[i];
      return table.columns[i].name + ' = ' + (typeof v === 'number' ? V.formatValue(v, table.columns[i].type) : show(v));
    });
    const condition = check.text.length > 120 ? check.text.slice(0, 120) + '…' : check.text;
    return new SqlError((existing ? 'Ein vorhandener Datensatz' : 'Der Datensatz') + ' verstößt gegen die CHECK-Bedingung ' +
      (check.name !== null ? '„' + check.name + '“ ' : '') + '(' + condition + ') der Tabelle „' + table.name + '“' +
      (values.length ? ': ' + values.join(', ') : '') + '.', pos,
      existing ? 'Ändern oder löschen Sie zuerst die betroffenen Datensätze.' : 'Gespeichert werden nur Datensätze, die die Bedingung erfüllen.');
  }

  /**
   * Prüft einen Datensatz gegen alle (erzwungenen) CHECK-Bedingungen.
   * Wie in SQL üblich gilt nur FALSCH als Verstoß; ergibt die Bedingung NULL
   * (z. B. weil ein Wert fehlt), ist der Datensatz zulässig.
   *
   * @param {Object} table - Tabelle.
   * @param {Array<*>} row - Datensatz.
   * @param {Object|null} pos - Position für die Fehlermeldung.
   * @param {boolean} [existing=false] - Prüfung vorhandener Datensätze.
   */
  function checkRow(table, row, pos, existing) {
    for (const check of table.checks) {
      if (!check.enforced || !check.bound) {
        continue;
      }
      const ctx = { frame: [row], parent: null, offset: 0 };
      if (V.truth(evalExpr(check.expr, ctx)) === false) {
        throw checkViolation(table, check, row, existing ? check.pos : pos, !!existing);
      }
    }
  }

  /**
   * Bindet neu angelegte CHECK-Bedingungen einer Tabelle und prüft alle
   * vorhandenen Datensätze (nach CREATE TABLE und ALTER TABLE).
   *
   * @param {Object|undefined} table - Tabelle.
   */
  function prepareChecks(table) {
    if (!table || table.checks.length === 0) {
      return;
    }
    table.checks.forEach((check, i) => {
      if (check.bound) {
        return;
      }
      rejectSubqueries(check.expr);
      const scope = makeScope(null, null);
      addSource(scope, tableSource(table, null), check.pos);
      const expr = bindExpr(check.expr, scope, { clause: 'CHECK', allowAgg: false });
      table.checks[i] = Object.assign({}, check, { expr, bound: true });
    });
    for (const row of table.rows) {
      tick();
      checkRow(table, row, null, true);
    }
  }

  // ---------------------------------------------------------------------------
  // INSERT, UPDATE, DELETE
  // ---------------------------------------------------------------------------

  /** Wert einer Spalte, die beim INSERT nicht angegeben wurde. */
  function missingValue(column, pos) {
    if (column.defaultNow) {
      const now = ns.sql.nowText();
      return column.defaultNow === 'date' ? now.slice(0, 10) : now;
    }
    if (column.defaultValue !== undefined) {
      return column.defaultValue;
    }
    if (column.notNull) {
      throw new SqlError('Für die Spalte „' + column.name + '“ fehlt ein Wert (NOT NULL, kein Standardwert).', pos,
        'Geben Sie die Spalte in der Spaltenliste mit einem Wert an.');
    }
    return null;
  }

  function executeInsert(db, stmt) {
    const table = db.requireTable(stmt.table, stmt.tablePos);
    let targets;
    if (stmt.columns) {
      targets = [];
      for (const c of stmt.columns) {
        const idx = table.requireColumn(c.name, c.pos);
        if (targets.includes(idx)) {
          throw new SqlError('Die Spalte „' + c.name + '“ ist doppelt angegeben.', c.pos);
        }
        targets.push(idx);
      }
    } else {
      targets = table.columns.map((c, i) => i);
    }
    const names = targets.map((i) => table.columns[i].name).join(', ');
    // Quellzeilen: Werte je Zielspalte (Map Spaltenindex → {value, pos}).
    const sources = [];
    if (stmt.query) {
      // INSERT … SELECT: erst vollständig auswerten, dann einfügen (Schnappschuss).
      rt.topQuery = stmt.query;
      bindSelect(stmt.query, null);
      if (stmt.query.outputs.length !== targets.length) {
        throw new SqlError('Die Abfrage liefert ' + stmt.query.outputs.length + ' Spalte(n), erwartet werden ' + targets.length + ' (' + names + ').', stmt.query.pos,
          stmt.columns ? null : 'Geben Sie die Zielspalten an: INSERT INTO ' + table.name + ' (Spalte1, Spalte2) SELECT …');
      }
      runSelect(stmt.query, null, true).rows.forEach((values, r) => {
        const given = new Map();
        values.forEach((v, k) => given.set(targets[k], { value: v, pos: stmt.query.pos }));
        sources.push({ given, pos: stmt.query.pos, rowNo: r + 1 });
      });
    } else {
      const scope = makeScope(null, null);
      const ctx = { frame: [], parent: null, offset: 0 };
      stmt.rows.forEach((row, r) => {
        tick();
        if (row.values.length !== targets.length) {
          throw new SqlError('Die ' + (r + 1) + '. Werteliste enthält ' + row.values.length + ' Wert(e), erwartet werden ' + targets.length + ' (' + names + ').', row.pos,
            stmt.columns ? null : 'Ohne Spaltenliste braucht jede Zeile Werte für alle Spalten. Tipp: INSERT INTO ' + table.name + ' (Spalte1, Spalte2) VALUES (…).');
        }
        const given = new Map();
        row.values.forEach((e, k) => {
          const bound = bindExpr(e, scope, { clause: 'VALUES', allowAgg: false });
          given.set(targets[k], { value: evalExpr(bound, ctx), pos: e.pos });
        });
        sources.push({ given, pos: row.pos, rowNo: null });
      });
    }
    const rows = [];
    const positions = [];
    for (const src of sources) {
      tick();
      try {
        const out = buildInsertRow(table, src.given, src.pos);
        checkRow(table, out, src.pos);
        rows.push(out);
        positions.push(src.pos);
      } catch (error) {
        if (error instanceof SqlError && src.rowNo !== null) {
          error.message = error.message.replace(/\.$/, '') + ' (Zeile ' + src.rowNo + ' des Abfrageergebnisses).';
        }
        throw error;
      }
    }
    db.insertRows(table, rows, positions);
    return { kind: 'insert', count: rows.length, table: table.name };
  }

  /**
   * Baut einen einzufügenden Datensatz (Standardwerte, AUTO_INCREMENT, Typprüfung, NOT NULL).
   *
   * @param {Object} table - Zieltabelle.
   * @param {Map<number, {value:*, pos:Object}>} given - Angegebene Werte je Spaltenindex.
   * @param {Object} rowPos - Position der Zeile.
   * @returns {Array<*>} Datensatz.
   */
  function buildInsertRow(table, given, rowPos) {
    const out = table.columns.map((column, i) => {
      const g = given.get(i);
      let value = g ? g.value : undefined;
      const pos = g ? g.pos : rowPos;
      if (column.autoIncrement && (value === undefined || value === null || value === 0)) {
        value = table.autoIncrementNext;
        table.autoIncrementNext++;
      } else if (value === undefined) {
        value = missingValue(column, pos);
      }
      value = ns.sql.coerceValue(value, column, pos);
      if (value === null && column.notNull) {
        throw new SqlError('Die Spalte „' + column.name + '“ darf nicht NULL sein.', pos);
      }
      if (column.autoIncrement && typeof value === 'number' && value >= table.autoIncrementNext) {
        table.autoIncrementNext = value + 1;
      }
      return value;
    });
    return out;
  }

  // ---------------------------------------------------------------------------
  // CREATE VIEW, DROP VIEW
  // ---------------------------------------------------------------------------

  /**
   * Legt eine Sicht an (bzw. ersetzt sie bei OR REPLACE). Die Abfrage wird zur
   * Probe gebunden, damit Fehler sofort mit der richtigen Position erscheinen;
   * gespeichert wird nur ihr Text.
   */
  function executeCreateView(db, stmt) {
    const key = stmt.name.toLowerCase();
    if (db.tables.has(key)) {
      throw new SqlError('Es gibt bereits eine Tabelle namens „' + db.tables.get(key).name + '“.', stmt.namePos,
        'Sichten und Tabellen brauchen unterschiedliche Namen.');
    }
    const previous = db.views.get(key);
    if (previous && !stmt.orReplace) {
      if (stmt.ifNotExists) {
        return { kind: 'ddl', message: 'Die Sicht „' + previous.name + '“ existiert bereits und wurde nicht verändert.' };
      }
      throw new SqlError('Die Sicht „' + previous.name + '“ existiert bereits.', stmt.namePos,
        'Mit CREATE OR REPLACE VIEW ' + previous.name + ' AS … wird sie ersetzt.');
    }
    if (!previous && db.tables.size + db.views.size >= ns.sql.LIMITS.maxTables) {
      throw new SqlError('Es sind höchstens ' + ns.sql.LIMITS.maxTables + ' Tabellen und Sichten erlaubt.', stmt.namePos);
    }
    const view = { name: stmt.name, columns: stmt.columns ? stmt.columns.map((c) => c.name) : null, text: stmt.queryText };
    // Die neue Sicht ist während der Probe schon eingetragen: So fallen Kreise über OR REPLACE auf.
    db.views.set(key, view);
    const saved = { warnings: rt.warnings, literalChecks: rt.literalChecks };
    rt.warnings = [];
    rt.literalChecks = null;
    try {
      bindSelect(stmt.query, null, null);
      derivedColumns(stmt.name, stmt.columns, stmt.query, stmt.namePos, { dat: 'der Sicht', acc: 'die Sicht' });
    } catch (error) {
      if (previous) {
        db.views.set(key, previous);
      } else {
        db.views.delete(key);
      }
      throw error;
    } finally {
      rt.warnings = saved.warnings;
      rt.literalChecks = saved.literalChecks;
    }
    return { kind: 'ddl', message: 'Sicht „' + view.name + '“ ' + (previous ? 'ersetzt' : 'angelegt') + '.' };
  }

  /** Löscht Sichten (DROP VIEW [IF EXISTS] a, b). */
  function executeDropView(db, stmt) {
    const keys = [];
    for (const n of stmt.names) {
      const key = n.name.toLowerCase();
      const view = db.views.get(key);
      if (view) {
        ns.sql.requireExactName(n.name, view.name, 'Die Sicht „' + n.name + '“ gibt es nicht.', n.pos);
        keys.push(key);
        continue;
      }
      if (db.tables.has(key)) {
        throw new SqlError('„' + db.tables.get(key).name + '“ ist eine Tabelle, keine Sicht.', n.pos, 'Tabellen löschen Sie mit DROP TABLE.');
      }
      if (!stmt.ifExists) {
        const names = Array.from(db.views.values()).map((v) => v.name);
        throw new SqlError('Die Sicht „' + n.name + '“ gibt es nicht.', n.pos,
          ns.sql.didYouMean(ns.sql.suggestions(n.name, names)) || (names.length ? 'Vorhandene Sichten: ' + names.join(', ') + '.' : 'Es gibt noch keine Sichten.'));
      }
    }
    const removed = keys.map((k) => db.views.get(k).name);
    keys.forEach((k) => db.views.delete(k));
    return { kind: 'ddl', message: removed.length ? (removed.length === 1 ? 'Sicht „' + removed[0] + '“ gelöscht.' : 'Sichten ' + removed.map((r) => '„' + r + '“').join(', ') + ' gelöscht.') : 'Keine Sicht gelöscht.' };
  }

  /** Bindet WHERE für UPDATE/DELETE (eine Tabelle). */
  function singleTableScope(db, stmt) {
    const table = db.requireTable(stmt.table, stmt.tablePos);
    const scope = makeScope(null, null);
    addSource(scope, tableSource(table, stmt.alias), stmt.tablePos);
    const where = stmt.where ? bindExpr(stmt.where, scope, { clause: 'WHERE', allowAgg: false }) : null;
    return { table, scope, where };
  }

  function executeUpdate(db, stmt) {
    const { table, scope, where } = singleTableScope(db, stmt);
    const source = scope.sources[0];
    const sets = stmt.sets.map((s) => {
      if (s.table !== null && s.table.toLowerCase() !== source.key) {
        if (source.aliasGiven && s.table.toLowerCase() === source.tableKey) {
          throw new SqlError('Die Tabelle „' + table.name + '“ hat den Alias „' + source.label + '“.', s.pos, 'Schreiben Sie ' + source.label + '.' + s.column + '.');
        }
        throw new SqlError('„' + s.table + '“ ist hier nicht die geänderte Tabelle.', s.pos);
      }
      if (s.table !== null) {
        ns.sql.requireExactName(s.table, source.label, 'Unbekannte Tabelle bzw. unbekannter Alias „' + s.table + '“.', s.pos);
      }
      const idx = table.requireColumn(s.column, s.pos);
      return { idx, column: table.columns[idx], expr: bindExpr(s.expr, scope, { clause: 'SET', allowAgg: false }), pos: s.pos };
    });
    const seen = new Set();
    for (const s of sets) {
      if (seen.has(s.idx)) {
        throw new SqlError('Die Spalte „' + s.column.name + '“ wird in SET doppelt gesetzt.', s.pos);
      }
      seen.add(s.idx);
    }
    let count = 0;
    const ctx = { frame: null, parent: null, offset: 0 };
    const newRows = table.rows.map((row) => {
      tick();
      ctx.frame = [row];
      if (where && V.truth(evalExpr(where, ctx)) !== true) {
        return row;
      }
      count++;
      const copy = row.slice();
      for (const s of sets) {
        const value = ns.sql.coerceValue(evalExpr(s.expr, ctx), s.column, s.pos);
        if (value === null && s.column.notNull) {
          throw new SqlError('Die Spalte „' + s.column.name + '“ darf nicht NULL sein.', s.pos);
        }
        copy[s.idx] = value;
      }
      checkRow(table, copy, stmt.pos);
      return copy;
    });
    db.replaceRows(table, newRows, stmt.pos);
    const ai = table.autoIncrementColumn();
    if (ai) {
      for (const row of newRows) {
        if (typeof row[ai.idx] === 'number' && row[ai.idx] >= table.autoIncrementNext) {
          table.autoIncrementNext = row[ai.idx] + 1;
        }
      }
    }
    return { kind: 'update', count, table: table.name };
  }

  function executeDelete(db, stmt) {
    const { table, where } = singleTableScope(db, stmt);
    const ctx = { frame: null, parent: null, offset: 0 };
    const kept = table.rows.filter((row) => {
      tick();
      ctx.frame = [row];
      return where ? V.truth(evalExpr(where, ctx)) !== true : false;
    });
    const count = table.rows.length - kept.length;
    db.replaceRows(table, kept, stmt.pos);
    return { kind: 'delete', count, table: table.name };
  }

  // ---------------------------------------------------------------------------
  // Öffentliche Schnittstelle
  // ---------------------------------------------------------------------------

  /**
   * Führt eine einzelne geparste Anweisung aus.
   *
   * @param {Object} db - Datenbank (wird verändert).
   * @param {Object} stmt - Anweisung.
   * @param {Object} [options] - {timeMs, notices}.
   * @returns {Object} Ergebnis, z. B. {kind:'select', columns, types, rows} oder {kind:'insert', count}.
   */
  function executeStatement(db, stmt, options) {
    const opts = options || {};
    const timeMs = opts.timeMs || EXEC_LIMITS.timeMs;
    rt = { db, deadline: performance.now() + timeMs, timeMs, steps: 0, warnings: [], literalChecks: [], topQuery: null, viewDepth: 0 };
    try {
      let result;
      switch (stmt.type) {
        case 'select':
          rt.topQuery = stmt;
          bindSelect(stmt, null);
          result = Object.assign({ kind: 'select' }, runSelect(stmt, null, true));
          break;
        case 'insert':
          result = executeInsert(db, stmt);
          break;
        case 'update':
          result = executeUpdate(db, stmt);
          break;
        case 'delete':
          result = executeDelete(db, stmt);
          break;
        case 'createTable':
          result = { kind: 'ddl', message: ns.sql.ddl.createTable(db, stmt, opts.notices || []) };
          prepareChecks(db.tables.get(stmt.name.toLowerCase()));
          break;
        case 'dropTable':
          result = { kind: 'ddl', message: ns.sql.ddl.dropTable(db, stmt) };
          break;
        case 'createIndex':
          result = { kind: 'ddl', message: ns.sql.ddl.createIndex(db, stmt) };
          break;
        case 'alterTable':
          result = { kind: 'ddl', message: ns.sql.ddl.alterTable(db, stmt) };
          prepareChecks(db.tables.get(stmt.table.toLowerCase()));
          break;
        case 'createView':
          result = executeCreateView(db, stmt);
          break;
        case 'dropView':
          result = executeDropView(db, stmt);
          break;
        case 'ignored':
          result = { kind: 'ignored', keyword: stmt.keyword };
          break;
        default:
          throw new Error('Unbekannte Anweisung ' + stmt.type);
      }
      literalCaseHints();
      result.warnings = rt.warnings;
      return result;
    } finally {
      rt = null;
    }
  }

  /** Ergänzt die Befehlsnummer an einem Fehler. */
  function withIndex(error, index) {
    if (error instanceof SqlError && error.statementIndex === null) {
      error.statementIndex = index;
    }
    return error;
  }

  /**
   * Führt die Eingabe von Seite 3 aus: SELECT, INSERT, UPDATE, DELETE.
   * Mehrere Befehle werden atomar ausgeführt: auf einer Kopie der Datenbank,
   * die nur zurückgegeben wird, wenn alle Befehle fehlerfrei waren.
   *
   * @param {Object} db - Aktuelle Datenbank (wird nicht verändert).
   * @param {string} source - Eingabe.
   * @returns {{db:Object, changed:boolean, results:Array<Object>, statementCount:number, keywordCase:Array<Object>}} Ergebnis
   *   (jedes Ergebnis mit warnings: Hinweise wie fehlende Verknüpfung oder falsche Schreibung).
   * @throws {SqlError} Bei Fehlern (mit statementIndex).
   */
  function runQueries(db, source) {
    const statements = ns.sql.parse(source);
    if (statements.length === 0) {
      throw new SqlError('Bitte geben Sie einen SQL-Befehl ein.', null);
    }
    for (const s of statements) {
      if (!QUERY_TYPES.has(s.type)) {
        const name = s.type === 'ignored' ? s.keyword : (TYPE_NAMES.get(s.type) || s.type);
        const err = new SqlError('„' + name + '“ ist auf dieser Seite nicht erlaubt.', s.pos,
          'Hier können Sie Daten abfragen (SELECT, auch mit WITH), ändern (INSERT, UPDATE, DELETE) und Sichten anlegen (CREATE VIEW, DROP VIEW). Tabellen legen Sie über eine SQL-Datei auf Seite 1 an.');
        throw withIndex(err, s.statementIndex);
      }
    }
    const changed = statements.some((s) => s.type !== 'select');
    const work = changed ? db.clone() : db;
    const results = [];
    for (const s of statements) {
      try {
        const result = executeStatement(work, s);
        result.statementIndex = s.statementIndex;
        result.text = s.text;
        results.push(result);
      } catch (error) {
        throw withIndex(error, s.statementIndex);
      }
    }
    return { db: work, changed, results, statementCount: statements.length, keywordCase: statements.keywordCase || [] };
  }

  /**
   * Baut eine neue Datenbank aus einem SQL-Skript (Beispieldatenbank oder hochgeladene Datei).
   * Erlaubt sind DROP TABLE, CREATE TABLE, INSERT INTO sowie ALTER TABLE und
   * CREATE INDEX aus Exporten; typische Export-Anweisungen (SET, LOCK …) werden übersprungen.
   *
   * @param {string} source - SQL-Skript.
   * @returns {{db:Object, notices:Array<string>, skipped:Map<string, number>, statements:number}} Ergebnis.
   * @throws {SqlError} Beim ersten Fehler (die Datenbank wird dann nicht verwendet).
   */
  function buildDatabase(source) {
    const statements = ns.sql.parse(source);
    const db = new ns.sql.Database();
    const notices = [];
    const skipped = new Map();
    for (const s of statements) {
      if (!IMPORT_TYPES.has(s.type)) {
        const err = new SqlError('In einer SQL-Datei zum Laden sind nur DROP TABLE, CREATE TABLE, INSERT INTO (auch INSERT INTO … SELECT bzw. WITH …) sowie CREATE VIEW und DROP VIEW erlaubt (gefunden: ' + (TYPE_NAMES.get(s.type) || s.type) + ').', s.pos,
          'Abfragen und Änderungen führen Sie auf Seite 3 aus.');
        throw withIndex(err, s.statementIndex);
      }
      if (s.type === 'ignored') {
        skipped.set(s.keyword, (skipped.get(s.keyword) || 0) + 1);
        continue;
      }
      try {
        executeStatement(db, s, { timeMs: EXEC_LIMITS.importTimeMs, notices });
      } catch (error) {
        throw withIndex(error, s.statementIndex);
      }
    }
    if (db.tables.size === 0) {
      throw new SqlError('Die Datei enthält keine Tabelle (es fehlt CREATE TABLE).', null);
    }
    return { db, notices, skipped, statements: statements.length };
  }

  ns.sql.EXEC_LIMITS = EXEC_LIMITS;
  ns.sql.executeStatement = executeStatement;
  ns.sql.runQueries = runQueries;
  ns.sql.buildDatabase = buildDatabase;
  ns.sql.likeMatch = likeMatch;
})(window.SQLSIM = window.SQLSIM || {});
