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
    maxResultRows: 10000,
    timeMs: 3000,
    importTimeMs: 10000
  });

  const AGGREGATES = new Set(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX']);
  const FUNCTION_NAMES = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'ROUND'];
  const COMPARISON_OPS = new Set(['=', '<>', '<', '<=', '>', '>=']);

  /** Anweisungen, die auf Seite 3 erlaubt sind. */
  const QUERY_TYPES = new Set(['select', 'insert', 'update', 'delete']);
  /** Anweisungen, die beim Laden einer SQL-Datei erlaubt sind. */
  const IMPORT_TYPES = new Set(['dropTable', 'createTable', 'createIndex', 'alterTable', 'insert', 'ignored']);

  /** Anzeigenamen der Anweisungsarten. */
  const TYPE_NAMES = new Map([
    ['select', 'SELECT'], ['insert', 'INSERT'], ['update', 'UPDATE'], ['delete', 'DELETE'],
    ['createTable', 'CREATE TABLE'], ['createIndex', 'CREATE INDEX'], ['dropTable', 'DROP TABLE'],
    ['alterTable', 'ALTER TABLE']
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
    return { sources: [], parent, select, hasAgg: false };
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
    if (node.table === null && flags.aliasMap && flags.aliasFirst && flags.aliasMap.has(nameKey)) {
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
          const col = src.colIndex.get(nameKey);
          if (col === undefined) {
            const hint = ns.sql.didYouMean(ns.sql.suggestions(node.name, src.columns.map((c) => c.name)), src.label + '.');
            throw new SqlError('„' + src.label + '“' + (src.aliasGiven && src.tableName ? ' (Tabelle ' + src.tableName + ')' : '') + ' hat keine Spalte „' + node.name + '“.', node.pos,
              hint || 'Vorhandene Spalten: ' + src.columns.map((c) => c.name).join(', ') + '.');
          }
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
          return markBound(node, scope, depth, found.srcIdx, found.col);
        }
      }
      s = s.parent;
      depth++;
    }
    if (node.table === null && flags.aliasMap && flags.aliasFallback && flags.aliasMap.has(nameKey)) {
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
        return node;
      case 'between':
        node.expr = bindExpr(node.expr, scope, flags);
        node.low = bindExpr(node.low, scope, flags);
        node.high = bindExpr(node.high, scope, flags);
        return node;
      case 'like':
        node.expr = bindExpr(node.expr, scope, flags);
        node.pattern = bindExpr(node.pattern, scope, flags);
        return node;
      case 'isnull':
        node.expr = bindExpr(node.expr, scope, flags);
        return node;
      case 'in':
        node.expr = bindExpr(node.expr, scope, flags);
        if (node.list) {
          node.list = node.list.map((e) => bindExpr(e, scope, flags));
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

  /** @returns {boolean} true, wenn der Ausdruck eine Aggregatfunktion dieser Ebene enthält. */
  function containsAggregate(node) {
    if (!node || typeof node !== 'object') {
      return false;
    }
    switch (node.type) {
      case 'func':
        return node.agg === true || node.args.some(containsAggregate);
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
        return 'L' + (n.value === null ? 'N' : typeof n.value + ':' + String(n.value).toLowerCase());
      case 'column':
        return 'C' + n.ref.depth + ':' + n.ref.src + ':' + n.ref.col;
      case 'func':
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
        node.args.forEach((a) => checkGrouped(a, info));
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
      const table = rt.db.requireTable(item.name, item.pos);
      const srcIndex = addSource(scope, tableSource(table, item.alias), item.pos);
      return { type: 'table', table, range: [srcIndex, srcIndex + 1, srcIndex + 1] };
    }
    if (item.type === 'subquery') {
      bindSelect(item.query, null);
      const columns = item.query.outputs.map((o) => ({ name: o.name, type: o.type }));
      const colIndex = new Map();
      columns.forEach((c, i) => {
        const key = c.name.toLowerCase();
        if (colIndex.has(key)) {
          throw new SqlError('In der Unterabfrage „' + item.alias + '“ kommt die Spalte „' + c.name + '“ mehrfach vor.', item.pos,
            'Vergeben Sie in der Unterabfrage eindeutige Namen mit AS.');
        }
        colIndex.set(key, i);
      });
      const source = { key: item.alias.toLowerCase(), label: item.alias, tableKey: null, tableName: null, aliasGiven: false, columns, colIndex, pk: null };
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
   */
  function bindSelect(q, parentScope) {
    const scope = makeScope(parentScope, q);
    q.correlated = false;
    q.scope = scope;
    const aliasNames = new Set(q.columns.filter((c) => c.kind === 'expr' && c.alias).map((c) => c.alias.toLowerCase()));
    const baseFlags = { aliasNames };

    q.fromPlan = q.from ? bindFrom(q.from, scope, baseFlags) : null;
    if (q.where) {
      q.where = bindExpr(q.where, scope, Object.assign({}, baseFlags, { clause: 'WHERE', allowAgg: false }));
      if (q.fromPlan) {
        assignWhereHashes(q.fromPlan, conjuncts(q.where, []), scope);
      }
    }

    // SELECT-Liste (inklusive * und t.*)
    q.outputs = [];
    /** Alias (klein) → Ausdruck bzw. Position in der SELECT-Liste. */
    const aliasMap = new Map();
    const aliasPosition = new Map();
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
        expr = bindExpr(g, scope, Object.assign({}, baseFlags, { clause: 'GROUP BY', allowAgg: false, aliasMap, aliasFallback: true }));
      }
      if (containsAggregate(expr)) {
        throw new SqlError('Nach einer Aggregatfunktion kann nicht gruppiert werden.', g.pos);
      }
      return expr;
    });

    // HAVING
    if (q.having) {
      q.having = bindExpr(q.having, scope, Object.assign({}, baseFlags, { clause: 'HAVING', allowAgg: true, aliasMap, aliasFirst: true }));
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
      if (e.type === 'column' && e.table === null && aliasPosition.has(e.name.toLowerCase())) {
        return { position: aliasPosition.get(e.name.toLowerCase()), desc: o.desc };
      }
      return { expr: bindExpr(e, scope, Object.assign({}, baseFlags, { clause: 'ORDER BY', allowAgg: true, aliasMap, aliasFirst: true })), desc: o.desc };
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
   * _ = genau ein Zeichen, \ maskiert das folgende Zeichen). Groß-/Kleinschreibung egal.
   * Laufzeit höchstens Textlänge × Musterlänge, ohne reguläre Ausdrücke.
   *
   * @param {string} text - Text.
   * @param {string} pattern - Muster.
   * @returns {boolean} true bei Übereinstimmung.
   */
  function likeMatch(text, pattern) {
    const t = Array.from(text.toLowerCase());
    const raw = Array.from(pattern.toLowerCase());
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
      case 'func': {
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
      return runSelect(plan.query, null, false).rows.map((r) => [r]);
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
   * Wertet eine gebundene SELECT-Anweisung aus.
   *
   * @param {Object} q - SELECT-Knoten (gebunden).
   * @param {Object|null} outerCtx - Kontext der umgebenden Abfrage (korrelierte Unterabfragen).
   * @param {boolean} isTop - true für die äußerste Abfrage (Grenze für die Ergebnisgröße).
   * @returns {{columns:Array<string>, types:Array<Object|null>, rows:Array<Array<*>>}} Ergebnis.
   */
  function runSelect(q, outerCtx, isTop) {
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
    const scope = makeScope(null, null);
    const ctx = { frame: [], parent: null, offset: 0 };
    const rows = [];
    const positions = [];
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
      const out = table.columns.map((column, i) => {
        const g = given.get(i);
        let value = g ? g.value : undefined;
        const pos = g ? g.pos : row.pos;
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
      rows.push(out);
      positions.push(row.pos);
    });
    db.insertRows(table, rows, positions);
    return { kind: 'insert', count: rows.length, table: table.name };
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
    rt = { db, deadline: performance.now() + timeMs, timeMs, steps: 0 };
    try {
      switch (stmt.type) {
        case 'select':
          bindSelect(stmt, null);
          return Object.assign({ kind: 'select' }, runSelect(stmt, null, true));
        case 'insert':
          return executeInsert(db, stmt);
        case 'update':
          return executeUpdate(db, stmt);
        case 'delete':
          return executeDelete(db, stmt);
        case 'createTable':
          return { kind: 'ddl', message: ns.sql.ddl.createTable(db, stmt, opts.notices || []) };
        case 'dropTable':
          return { kind: 'ddl', message: ns.sql.ddl.dropTable(db, stmt) };
        case 'createIndex':
          return { kind: 'ddl', message: ns.sql.ddl.createIndex(db, stmt) };
        case 'alterTable':
          return { kind: 'ddl', message: ns.sql.ddl.alterTable(db, stmt) };
        case 'ignored':
          return { kind: 'ignored', keyword: stmt.keyword };
        default:
          throw new Error('Unbekannte Anweisung ' + stmt.type);
      }
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
   * @returns {{db:Object, changed:boolean, results:Array<Object>, statementCount:number}} Ergebnis.
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
          'Hier können Sie Daten abfragen (SELECT) und ändern (INSERT, UPDATE, DELETE). Tabellen legen Sie über eine SQL-Datei auf Seite 1 an.');
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
    return { db: work, changed, results, statementCount: statements.length };
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
        const err = new SqlError('In einer SQL-Datei zum Laden sind nur DROP TABLE, CREATE TABLE und INSERT INTO erlaubt (gefunden: ' + (TYPE_NAMES.get(s.type) || s.type) + ').', s.pos,
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
