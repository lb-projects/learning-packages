/**
 * @file normalization.js
 * @description Normalformen und Anomalien für Seite 6 „Redundanzen“ (reine Logik, kein DOM).
 *
 * Grundlage sind die funktionalen Abhängigkeiten (FA), die die Lernenden selbst
 * eintragen; das Paket erkennt keine Abhängigkeiten aus den Daten (zufällige
 * Übereinstimmungen würden sonst als Verstoß gemeldet). Eine FA hat die Form
 * {left: [Spaltenindizes], right: [Spaltenindizes]}.
 *
 * Festlegungen:
 *   - Schlüsselkandidaten: Primärschlüssel, UNIQUE-Schlüssel aus NOT-NULL-Spalten sowie
 *     minimale Spaltenmengen (bis 3 Spalten), deren Hülle unter den FA alle Spalten enthält.
 *   - 1. NF: keine als „enthält mehrere Werte“ markierte Spalte (Einschätzung der Lernenden;
 *     firstNfHints liefert nur Auffälligkeiten als Hinweis).
 *   - 2. NF: 1. NF und keine Teilabhängigkeit eines Nichtschlüsselattributs von einem echten
 *     Teil eines Schlüsselkandidaten (auch abgeleitet über die Hülle).
 *   - 3. NF: 2. NF und keine eingetragene FA X → A mit Nichtschlüsselattribut A, bei der X
 *     kein Superschlüssel ist (transitive Abhängigkeit).
 *   - Anomalien: Beispiele werden mit der echten Ausführung (runQueries) auf einer Kopie
 *     der Datenbank vorgeführt; die übergebene Datenbank bleibt unverändert.
 *
 * Abhängigkeiten:
 *   sql/values.js, sql/database.js (quoteName, sqlLiteral), sql/executor.js (runQueries)
 */
(function (ns) {
  'use strict';

  const V = ns.sql.values;

  /** Grenzen. */
  const LIMITS = Object.freeze({
    /** Spalten auf der linken Seite einer FA. */
    maxLeft: 3,
    /** FA je Tabelle. */
    maxFds: 30,
    /** Größe der gesuchten Schlüsselkandidaten (größere nur, wenn deklariert). */
    keySearch: 3,
    /** Gezeigte Widersprüche je FA. */
    conflicts: 5,
    /** Beispielwerte je Hinweis. */
    hintValues: 3,
    /** Zeilen in Vorher-/Nachher-Tabellen. */
    exampleRows: 20
  });

  /** @returns {Array<number>} Sortierte Indizes ohne Doppelungen. */
  function sortedSet(list) {
    return Array.from(new Set(list)).sort((a, b) => a - b);
  }

  /** @returns {boolean} true, wenn beide Mengen gleich sind (sortiert). */
  function sameSet(a, b) {
    return a.length === b.length && a.every((x, i) => x === b[i]);
  }

  /** @returns {boolean} true, wenn a ⊆ b. */
  function subset(a, b) {
    return a.every((x) => b.includes(x));
  }

  /**
   * Hülle einer Spaltenmenge unter FA.
   *
   * @param {Array<number>} attrs - Spalten.
   * @param {Array<Object>} fds - FA {left, right}.
   * @returns {Set<number>} Alle bestimmten Spalten.
   */
  function closure(attrs, fds) {
    const set = new Set(attrs);
    let changed = true;
    while (changed) {
      changed = false;
      for (const fd of fds) {
        if (fd.left.every((i) => set.has(i))) {
          for (const r of fd.right) {
            if (!set.has(r)) {
              set.add(r);
              changed = true;
            }
          }
        }
      }
    }
    return set;
  }

  /** @returns {Array<{columns:Array<number>, kind:string}>} Deklarierte Schlüssel (PK, UNIQUE aus NOT-NULL-Spalten). */
  function declaredKeys(table) {
    const list = [];
    if (table.primaryKey && table.primaryKey.length) {
      list.push({ columns: sortedSet(table.primaryKey), kind: 'pk' });
    }
    for (const u of table.uniques) {
      if (u.every((i) => table.columns[i].notNull) && !list.some((k) => sameSet(k.columns, sortedSet(u)))) {
        list.push({ columns: sortedSet(u), kind: 'unique' });
      }
    }
    return list;
  }

  /** @returns {Array<Object>} Eingetragene FA plus „Schlüssel → alle Spalten“ für die deklarierten Schlüssel. */
  function withKeyFds(table, fds) {
    const all = table.columns.map((c, i) => i);
    return fds.concat(declaredKeys(table).map((k) => ({ left: k.columns, right: all })));
  }

  /** @returns {boolean} true, wenn die Spalten alle Spalten bestimmen. */
  function isSuperkey(table, fds, attrs) {
    return closure(attrs, withKeyFds(table, fds)).size === table.columns.length;
  }

  /** Alle Teilmengen einer Liste mit genau size Elementen. */
  function combinations(list, size) {
    const out = [];
    const rec = (start, acc) => {
      if (acc.length === size) {
        out.push(acc.slice());
        return;
      }
      for (let i = start; i < list.length; i++) {
        acc.push(list[i]);
        rec(i + 1, acc);
        acc.pop();
      }
    };
    rec(0, []);
    return out;
  }

  /** @returns {boolean} true, wenn kein Wertetupel der Spalten in zwei Zeilen vorkommt. */
  function uniqueInData(table, cols) {
    const seen = new Set();
    for (const row of table.rows) {
      const k = cols.map((i) => V.valueKey(row[i])).join('\u0001');
      if (seen.has(k)) {
        return false;
      }
      seen.add(k);
    }
    return true;
  }

  /**
   * Schlüsselkandidaten einer Tabelle.
   *
   * @param {Object} table - Tabelle.
   * @param {Array<Object>} fds - Eingetragene FA.
   * @returns {{keys:Array<{columns:Array<number>, kind:string}>, nonMinimal:Array<{columns:Array<number>, kind:string}>}}
   *   Schlüsselkandidaten (kind: 'pk', 'unique' oder 'derived') und deklarierte, aber nicht minimale Schlüssel.
   *   Abgeleitete Schlüssel (aus den Abhängigkeiten) müssen in den Daten eindeutig sein.
   */
  function candidateKeys(table, fds) {
    const n = table.columns.length;
    const declared = declaredKeys(table);
    const full = withKeyFds(table, fds);
    // Teil eines Schlüssels können nur Spalten sein, die links in einer FA bzw. in einem deklarierten
    // Schlüssel stehen oder nie bestimmt werden (diese gehören zu jedem Schlüssel).
    const right = new Set(full.flatMap((fd) => fd.right));
    const universe = sortedSet(full.flatMap((fd) => fd.left).concat(table.columns.map((c, i) => i).filter((i) => !right.has(i))));
    const found = [];
    for (let size = 1; size <= Math.min(LIMITS.keySearch, universe.length); size++) {
      for (const c of combinations(universe, size)) {
        if (found.some((k) => subset(k.columns, c))) {
          continue;
        }
        if (closure(c, full).size === n) {
          const decl = declared.find((k) => sameSet(k.columns, c));
          // Ein abgeleiteter Schlüssel muss sich aus Abhängigkeiten ergeben (nicht einfach alle Spalten
          // umfassen) und in den Daten eindeutig sein; Dopplungen widerlegen ihn.
          if (!decl && (c.length === n || !uniqueInData(table, c))) {
            continue;
          }
          found.push({ columns: c, kind: decl ? decl.kind : 'derived' });
        }
      }
    }
    const nonMinimal = [];
    for (const k of declared) {
      if (found.some((f) => sameSet(f.columns, k.columns))) {
        continue;
      }
      if (found.some((f) => subset(f.columns, k.columns))) {
        nonMinimal.push(k);
      } else {
        found.push(k);
      }
    }
    const order = { pk: 0, unique: 1, derived: 2 };
    found.sort((a, b) => (order[a.kind] - order[b.kind]) || (a.columns.length - b.columns.length) || (a.columns[0] - b.columns[0]));
    return { keys: found, nonMinimal };
  }

  /**
   * Prüft eine FA an den vorhandenen Datensätzen.
   *
   * @param {Object} table - Tabelle.
   * @param {Object} fd - FA.
   * @returns {{holds:boolean, groups:number, repeated:number, conflicts:Array<Object>, conflictCount:number}}
   *   groups: verschiedene Werte links (ohne NULL); repeated: davon mehrfach vorkommende;
   *   conflicts: höchstens LIMITS.conflicts Werte links mit verschiedenen Werten rechts
   *   ({left: Werte, variants: [{right: Werte, rows: Zeilennummern ab 0}]}).
   */
  function checkFd(table, fd) {
    const groups = new Map();
    table.rows.forEach((row, r) => {
      if (fd.left.some((i) => row[i] === null)) {
        return;
      }
      const key = fd.left.map((i) => V.valueKey(row[i])).join('\u0001');
      let g = groups.get(key);
      if (!g) {
        g = { left: fd.left.map((i) => row[i]), variants: new Map(), size: 0 };
        groups.set(key, g);
      }
      g.size++;
      const rk = fd.right.map((i) => V.valueKey(row[i])).join('\u0001');
      let v = g.variants.get(rk);
      if (!v) {
        v = { right: fd.right.map((i) => row[i]), rows: [] };
        g.variants.set(rk, v);
      }
      v.rows.push(r);
    });
    const conflicts = [];
    let conflictCount = 0;
    let repeated = 0;
    for (const g of groups.values()) {
      if (g.size > 1) {
        repeated++;
      }
      if (g.variants.size > 1) {
        conflictCount++;
        if (conflicts.length < LIMITS.conflicts) {
          conflicts.push({ left: g.left, variants: Array.from(g.variants.values()) });
        }
      }
    }
    return { holds: conflictCount === 0, groups: groups.size, repeated, conflicts, conflictCount };
  }

  /** Listen-Trennzeichen zwischen zwei Einträgen (keine Dezimalzahlen wie „3,5“). */
  const LIST_PATTERN = /[^\s,;/]\s*[,;/]\s*[^\s,;/]/;
  const DECIMAL_COMMA = /^\s*-?\d+,\d+\s*$/;

  /**
   * Auffälligkeiten zur 1. NF (nur Hinweise, keine Bewertung).
   *
   * @param {Object} table - Tabelle.
   * @returns {Array<{kind:string, columns:Array<number>, examples:Array<string>}>}
   *   kind 'list': Texte mit Listen-Trennzeichen in mindestens zwei Zeilen;
   *   kind 'group': Spalten, die sich nur durch eine Endziffer unterscheiden (Wiederholungsgruppe).
   */
  function firstNfHints(table) {
    const hints = [];
    table.columns.forEach((c, i) => {
      const examples = [];
      let count = 0;
      for (const row of table.rows) {
        const v = row[i];
        if (typeof v === 'string' && LIST_PATTERN.test(v) && !DECIMAL_COMMA.test(v)) {
          count++;
          if (examples.length < LIMITS.hintValues) {
            examples.push(v);
          }
        }
      }
      if (count >= 2) {
        hints.push({ kind: 'list', columns: [i], examples });
      }
    });
    const groups = new Map();
    table.columns.forEach((c, i) => {
      const m = /^(.*?[^\d_ ])[_ ]?\d+$/.exec(c.name);
      if (m) {
        const base = m[1].toLowerCase();
        if (!groups.has(base)) {
          groups.set(base, []);
        }
        groups.get(base).push(i);
      }
    });
    for (const cols of groups.values()) {
      if (cols.length >= 2) {
        hints.push({ kind: 'group', columns: cols, examples: [] });
      }
    }
    return hints;
  }

  /**
   * Bewertet eine Tabelle.
   *
   * @param {Object} table - Tabelle.
   * @param {Array<Object>} fds - Eingetragene FA.
   * @param {Array<number>} nonAtomic - Als „enthält mehrere Werte“ markierte Spalten.
   * @returns {Object} {keys, nonMinimal, prime, nf1, nf2, nf3, level, violations, groups}:
   *   nf1/nf2/nf3 je {ok: true|false|null (nicht beurteilbar), reason};
   *   violations: [{kind:'partial'|'transitive', left, column, key, derived}];
   *   groups: Verstöße nach (Art, linker Seite) zusammengefasst [{kind, left, columns, key}].
   */
  function evaluate(table, fds, nonAtomic) {
    const { keys, nonMinimal } = candidateKeys(table, fds);
    const prime = new Set(keys.flatMap((k) => k.columns));
    const nonPrime = table.columns.map((c, i) => i).filter((i) => !prime.has(i));
    const full = withKeyFds(table, fds);
    const violations = [];
    const nf1 = { ok: nonAtomic.length === 0, reason: nonAtomic.length === 0 ? 'atomic' : 'nonAtomic' };

    // Teilabhängigkeiten (2. NF): echte Teilmengen der Schlüsselkandidaten, kleinste zuerst.
    for (const key of keys) {
      if (key.columns.length < 2 || key.columns.length > 6) {
        continue;
      }
      const reported = new Set();
      for (let size = 1; size < key.columns.length; size++) {
        for (const part of combinations(key.columns, size)) {
          const cl = closure(part, full);
          for (const a of nonPrime) {
            if (cl.has(a) && !reported.has(a)) {
              reported.add(a);
              const derived = !fds.some((fd) => sameSet(sortedSet(fd.left), part) && fd.right.includes(a));
              violations.push({ kind: 'partial', left: part, column: a, key: key.columns, derived });
            }
          }
        }
      }
    }
    // Transitive Abhängigkeiten (3. NF): eingetragene FA mit Nichtschlüsselattribut rechts.
    for (const fd of fds) {
      const left = sortedSet(fd.left);
      if (isSuperkey(table, fds, left) || keys.some((k) => left.length < k.columns.length && subset(left, k.columns))) {
        continue;
      }
      for (const a of fd.right) {
        if (prime.has(a) || left.includes(a)) {
          continue;
        }
        if (violations.some((v) => v.kind === 'transitive' && sameSet(v.left, left) && v.column === a)) {
          continue;
        }
        violations.push({ kind: 'transitive', left, column: a, key: keys.length ? keys[0].columns : [], derived: false });
      }
    }

    const partial = violations.filter((v) => v.kind === 'partial');
    const transitive = violations.filter((v) => v.kind === 'transitive');
    const onlySimpleKeys = keys.every((k) => k.columns.length === 1);
    let nf2;
    let nf3;
    if (keys.length === 0) {
      nf2 = { ok: null, reason: 'noKey' };
      nf3 = { ok: null, reason: 'noKey' };
    } else {
      if (!nf1.ok) {
        nf2 = { ok: false, reason: 'nf1' };
      } else if (partial.length > 0) {
        nf2 = { ok: false, reason: 'partial' };
      } else if (onlySimpleKeys) {
        nf2 = { ok: true, reason: 'simpleKey' };
      } else if (nonPrime.length === 0) {
        nf2 = { ok: true, reason: 'allPrime' };
      } else if (fds.length === 0) {
        nf2 = { ok: null, reason: 'noFds' };
      } else {
        nf2 = { ok: true, reason: 'fds' };
      }
      if (nf2.ok === false) {
        nf3 = { ok: false, reason: 'nf2' };
      } else if (transitive.length > 0) {
        nf3 = { ok: false, reason: 'transitive' };
      } else if (nf2.ok === null) {
        nf3 = { ok: null, reason: nf2.reason };
      } else if (nonPrime.length === 0) {
        nf3 = { ok: true, reason: 'allPrime' };
      } else if (fds.length === 0) {
        nf3 = { ok: null, reason: 'noFds' };
      } else {
        nf3 = { ok: true, reason: 'fds' };
      }
    }
    let level = 0;
    if (nf1.ok) {
      level = 1;
      if (nf2.ok === true) {
        level = 2;
        if (nf3.ok === true) {
          level = 3;
        }
      }
    }
    const groups = [];
    for (const v of violations) {
      let g = groups.find((x) => x.kind === v.kind && sameSet(x.left, v.left));
      if (!g) {
        g = { kind: v.kind, left: v.left, columns: [], key: v.key };
        groups.push(g);
      }
      g.columns.push(v.column);
    }
    return { keys, nonMinimal, prime: Array.from(prime).sort((a, b) => a - b), nf1, nf2, nf3, level, violations, groups };
  }

  // ---------------------------------------------------------------------------
  // Anomalien
  // ---------------------------------------------------------------------------

  const q = (name) => ns.sql.quoteName(name);

  /** @returns {string} SQL-Literal für einen Wert der Spalte. */
  function lit(table, col, value) {
    return ns.sql.sqlLiteral(value, table.columns[col].type);
  }

  /** @returns {string} Bedingung "a = 1 AND b = 'x'". */
  function cond(table, cols, values) {
    return cols.map((c, k) => q(table.columns[c].name) + (values[k] === null ? ' IS NULL' : ' = ' + lit(table, c, values[k]))).join(' AND ');
  }

  /** @returns {string} Anzeige eines Werts (für Erklärungen). */
  function show(value) {
    return value === null ? 'NULL' : V.formatValue(value, null);
  }

  /** @returns {number|null} Höchstlänge eines Textyps oder null. */
  function maxLength(type) {
    return type && typeof type.length === 'number' ? type.length : null;
  }

  /**
   * Ein geänderter Wert für die Änderungsanomalie (anderer Wert desselben Typs).
   *
   * @param {Object} column - Spalte.
   * @param {*} value - Bisheriger Wert.
   * @returns {*} Neuer Wert.
   */
  function changedValue(column, value) {
    const t = column.type || {};
    switch (t.base) {
      case 'INT':
      case 'YEAR':
      case 'DECIMAL':
      case 'FLOAT': {
        const v = typeof value === 'number' ? value : 0;
        return (t.max !== undefined && t.max !== null && v + 1 > t.max) ? v - 1 : v + 1;
      }
      case 'ENUM':
        return t.values.find((x) => x !== value) || value;
      case 'DATE':
        return value === '2000-01-01' ? '2000-01-02' : '2000-01-01';
      case 'DATETIME':
        return value === '2000-01-01 00:00:00' ? '2000-01-02 00:00:00' : '2000-01-01 00:00:00';
      case 'TIME':
        return value === '00:00:00' ? '00:00:01' : '00:00:00';
      default: {
        const max = maxLength(t);
        const base = value === null ? 'neu' : String(value) + ' (neu)';
        if (max === null || base.length <= max) {
          return base;
        }
        for (const c of ['neu', 'Neu', 'X', 'Y']) {
          if (c.length <= max && c !== value) {
            return c;
          }
        }
        return 'X';
      }
    }
  }

  /**
   * Ein neuer, noch nicht vorhandener Wert für die Einfügeanomalie.
   *
   * @param {Object} table - Tabelle.
   * @param {number} col - Spalte.
   * @returns {*} Wert.
   */
  function newValue(table, col) {
    const column = table.columns[col];
    const t = column.type || {};
    const existing = new Set(table.rows.map((r) => V.valueKey(r[col])));
    switch (t.base) {
      case 'INT':
      case 'YEAR':
      case 'DECIMAL':
      case 'FLOAT': {
        const nums = table.rows.map((r) => r[col]).filter((v) => typeof v === 'number');
        let v = nums.length ? Math.floor(Math.max.apply(null, nums)) + 1 : 1;
        if (t.base === 'YEAR' && (v < 1901 || v > 2155)) {
          v = 2000;
        }
        return v;
      }
      case 'ENUM':
        return t.values.find((x) => !existing.has(V.valueKey(x))) || t.values[0];
      case 'DATE':
        return '2000-01-01';
      case 'DATETIME':
        return '2000-01-01 00:00:00';
      case 'TIME':
        return '00:00:00';
      default: {
        const max = maxLength(t);
        const candidates = ['Neu', 'Neu 2', 'Neu 3', 'N', 'Z', 'Q'];
        for (let n = 4; n < 50; n++) {
          candidates.push('Neu ' + n);
        }
        const ok = candidates.find((c) => (max === null || c.length <= max) && !existing.has(V.valueKey(c)));
        return ok || 'Neu';
      }
    }
  }

  /** @returns {Object|null} Ergebnistabelle einer Abfrage (oder null bei Fehler). */
  function select(db, sql) {
    const r = ns.sql.runQueries(db, sql).results[0];
    return { columns: r.columns, types: r.types, rows: r.rows.slice(0, LIMITS.exampleRows), total: r.rows.length };
  }

  /**
   * Führt einen ändernden Befehl auf einer Kopie aus.
   *
   * @returns {{db:Object|null, error:Error|null}} Ergebnis-Datenbank (Kopie) oder Fehler.
   */
  function simulate(db, sql) {
    try {
      return { db: ns.sql.runQueries(db, sql).db, error: null };
    } catch (error) {
      if (error instanceof ns.sql.SqlError) {
        return { db: null, error };
      }
      throw error;
    }
  }

  /** @returns {string} Spaltennamen, z. B. "kurs_nr, Lehrkraft". */
  function names(table, cols) {
    return cols.map((c) => table.columns[c].name).join(', ');
  }

  /** @returns {string} Werte, z. B. "„101“" bzw. "„101“, „Theater“". */
  function quoted(values) {
    return values.map((v) => '„' + show(v) + '“').join(', ');
  }

  /**
   * Beispiele für die drei Anomalien zu einem Verstoß (Gruppe aus evaluate().groups).
   *
   * @param {Object} db - Datenbank (wird nicht verändert).
   * @param {Object} table - Tabelle.
   * @param {{kind:string, left:Array<number>, columns:Array<number>, key:Array<number>}} group - Verstoß.
   * @returns {{insert:Object, update:Object, delete:Object}} je {sql, text, before, after, error, available};
   *   available = false, wenn die Daten derzeit kein Beispiel hergeben (text erklärt dann den Grund).
   */
  function anomalies(db, table, group) {
    const T = q(table.name);
    const X = group.left;
    const A = group.columns;
    const key = group.key.length ? group.key : X;
    // Spalten der Beispiele: Schlüssel, linke Seite, abhängige Spalten.
    const colOrder = key.filter((c) => !A.includes(c)).concat(X.filter((c) => !key.includes(c))).concat(A);
    const colList = colOrder.map((c) => q(table.columns[c].name)).join(', ');
    const orderBy = key.map((c) => q(table.columns[c].name)).join(', ');
    const xName = names(table, X);
    const aName = names(table, A);

    // Gruppen der linken Seite (ohne NULL)
    const groups = new Map();
    table.rows.forEach((row, r) => {
      if (X.some((i) => row[i] === null)) {
        return;
      }
      const k = X.map((i) => V.valueKey(row[i])).join('\u0001');
      if (!groups.has(k)) {
        groups.set(k, { values: X.map((i) => row[i]), rows: [] });
      }
      groups.get(k).rows.push(r);
    });
    const list = Array.from(groups.values());
    const selectFor = (values) => 'SELECT ' + colList + ' FROM ' + T + ' WHERE ' + cond(table, X, values) + (orderBy ? ' ORDER BY ' + orderBy : '') + ';';

    // Änderungsanomalie
    const update = { available: false, sql: null, text: '', before: null, after: null, error: null };
    const multi = list.filter((g) => g.rows.length >= 2).sort((a, b) => b.rows.length - a.rows.length)[0];
    if (!multi) {
      update.text = 'Zurzeit kommt jeder Wert von ' + xName + ' nur einmal vor; nichts ist doppelt gespeichert. Sobald ein Wert mehrfach vorkommt, steht ' +
        aName + ' mehrfach in der Tabelle – wird es dann nur an einer Stelle geändert, widersprechen sich die Zeilen.';
    } else {
      const row = table.rows[multi.rows[0]];
      const target = A[0];
      const value = changedValue(table.columns[target], row[target]);
      update.available = true;
      update.sql = 'UPDATE ' + T + ' SET ' + q(table.columns[target].name) + ' = ' + lit(table, target, value) + ' WHERE ' + cond(table, key, key.map((c) => row[c])) + ';';
      update.check = selectFor(multi.values);
      update.text = xName + ' = ' + quoted(multi.values) + ' steht in ' + multi.rows.length + ' Zeilen, jedes Mal mit ' + table.columns[target].name + ' = „' + show(row[target]) +
        '“. Wird der Wert nur in einer Zeile geändert, widersprechen sich danach die Zeilen: Zu ' + quoted(multi.values) + ' gehören zwei verschiedene Werte für ' +
        table.columns[target].name + '. Um das zu vermeiden, müssten immer alle ' + multi.rows.length + ' Zeilen gleichzeitig geändert werden.';
      update.before = select(db, update.check);
      const sim = simulate(db, update.sql);
      update.error = sim.error;
      update.after = sim.db ? select(sim.db, update.check) : null;
    }

    // Löschanomalie: Gelöscht werden Datensätze über ihren Schlüssel (das ist der eigentliche Anlass);
    // die Information X → A verschwindet dabei ungewollt mit.
    const del = { available: false, sql: null, text: '', before: null, after: null, error: null, deleted: null, lostColumns: sortedSet(X.concat(A)) };
    const few = list.slice().sort((a, b) => a.rows.length - b.rows.length)[0];
    if (!few) {
      del.text = 'In der Tabelle gibt es keine Zeile mit einem Wert für ' + xName + '.';
    } else {
      const row = table.rows[few.rows[0]];
      const keyRows = few.rows.map((r) => key.map((c) => table.rows[r][c]));
      let where;
      if (keyRows.length === 1) {
        where = cond(table, key, keyRows[0]);
      } else if (key.length === 1) {
        where = q(table.columns[key[0]].name) + ' IN (' + keyRows.map((v) => lit(table, key[0], v[0])).join(', ') + ')';
      } else {
        where = keyRows.map((v) => '(' + cond(table, key, v) + ')').join(' OR ');
      }
      const orderKey = key.map((c) => q(table.columns[c].name)).join(', ');
      del.available = true;
      del.sql = 'DELETE FROM ' + T + ' WHERE ' + where + ';';
      del.check = 'SELECT ' + X.concat(A).map((c) => q(table.columns[c].name)).join(', ') + ' FROM ' + T + ' WHERE ' + cond(table, X, few.values) + ';';
      del.deleted = select(db, 'SELECT * FROM ' + T + ' WHERE ' + where + ' ORDER BY ' + orderKey + ';');
      del.checkLabel = 'Gespeichert zu ' + xName + ' = ' + quoted(few.values);
      const fact = quoted(few.values) + ' → ' + quoted(A.map((c) => row[c]));
      const keyText = key.length === 1
        ? names(table, key) + ' = ' + keyRows.map((v) => show(v[0])).join(keyRows.length === 2 ? ' und ' : ', ')
        : '(' + names(table, key) + ') = ' + keyRows.map((v) => '(' + v.map(show).join(', ') + ')').join(', ');
      const others = table.columns.map((c, i) => i).filter((i) => !key.includes(i));
      const all = others.length ? ' – vollständig, mit allen Angaben (' + names(table, others) + ')' : '';
      if (keyRows.length === 1) {
        del.text = 'Gelöscht wird der Datensatz mit ' + keyText + all + ', etwa weil er nicht mehr gebraucht wird. Mit ihm verschwindet auch die Information ' +
          xName + ' → ' + aName + ' (' + fact + '), denn sie steht nur in diesem Datensatz. Sie gilt aber weiterhin.';
      } else {
        del.text = 'Gelöscht werden die ' + keyRows.length + ' Datensätze mit ' + keyText + all + ', etwa weil sie nicht mehr gebraucht werden. Mit ihnen verschwindet auch die Information ' +
          xName + ' → ' + aName + ' (' + fact + '), denn sie steht nur in diesen Datensätzen. Sie gilt aber weiterhin.';
      }
      del.before = select(db, del.check);
      const sim = simulate(db, del.sql);
      del.error = sim.error;
      del.after = sim.db ? select(sim.db, del.check) : null;
    }

    // Einfügeanomalie
    const ins = { available: true, sql: null, text: '', before: null, after: null, error: null };
    const xValues = X.map((c, k) => (k === 0 ? newValue(table, c) : (table.rows.length ? table.rows[0][c] : newValue(table, c))));
    const aValues = A.map((c) => newValue(table, c));
    const insCols = X.concat(A);
    ins.sql = 'INSERT INTO ' + T + ' (' + insCols.map((c) => q(table.columns[c].name)).join(', ') + ') VALUES (' +
      insCols.map((c, k) => lit(table, c, (k < X.length ? xValues : aValues)[k < X.length ? k : k - X.length])).join(', ') + ');';
    ins.check = 'SELECT * FROM ' + T + ' WHERE ' + cond(table, X, xValues) + ';';
    const missing = key.filter((c) => !insCols.includes(c));
    const missingNames = names(table, missing);
    ins.before = select(db, ins.check);
    const sim = simulate(db, ins.sql);
    ins.error = sim.error;
    ins.after = sim.db ? select(sim.db, ins.check) : null;
    const fact = quoted(xValues) + ' → ' + quoted(aValues);
    if (ins.error) {
      ins.text = 'Es soll nur die neue Information ' + xName + ' → ' + aName + ' (' + fact + ') gespeichert werden. Das geht nicht: Jeder Datensatz braucht einen ' +
        'vollständigen Schlüssel (' + names(table, key) + ')' + (missingNames ? ', für ' + missingNames + ' gibt es aber noch keinen Wert' : '') +
        '. Erst wenn ein passender Datensatz entsteht, lässt sich die Information speichern.';
    } else {
      const row = ins.after && ins.after.rows.length ? ins.after.rows[0] : null;
      const others = table.columns.map((c, i) => i).filter((i) => !insCols.includes(i));
      const empty = row ? others.filter((i) => row[i] === null) : others;
      const filled = row ? others.filter((i) => row[i] !== null) : [];
      const parts = [];
      if (empty.length) {
        parts.push(names(table, empty) + (empty.length === 1 ? ' bleibt' : ' bleiben') + ' leer (NULL)');
      }
      if (filled.length) {
        parts.push(names(table, filled) + (filled.length === 1 ? ' erhält' : ' erhalten') + ' einen automatischen bzw. Standardwert');
      }
      ins.text = 'Es soll nur die neue Information ' + xName + ' → ' + aName + ' (' + fact + ') gespeichert werden. Das gelingt nur mit einem unvollständigen Datensatz' +
        (parts.length ? ': ' + parts.join('; ') : '') + '. Der Datensatz steht für nichts Wirkliches – er existiert nur, um die Information unterzubringen.';
    }
    return { insert: ins, update, delete: del };
  }

  ns.normalization = {
    LIMITS, closure, declaredKeys, candidateKeys, isSuperkey, checkFd, firstNfHints, evaluate, anomalies, sortedSet
  };
})(window.SQLSIM = window.SQLSIM || {});
