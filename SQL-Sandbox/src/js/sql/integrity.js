/**
 * @file sql/integrity.js
 * @description Referenzielle Integrität: Prüfung der Fremdschlüssel nach INSERT, UPDATE und
 *              DELETE samt ON DELETE / ON UPDATE sowie die Prüfung einer geladenen Datei.
 *
 * Verhalten (wie MySQL/InnoDB, geprüft wird am Ende jedes Befehls):
 *   - INSERT/UPDATE in der Tabelle mit dem Fremdschlüssel: Jeder neue oder geänderte Datensatz
 *     muss auf einen vorhandenen Datensatz der referenzierten Tabelle verweisen. Enthält eine
 *     Spalte des Fremdschlüssels NULL, wird nicht geprüft (MATCH SIMPLE).
 *   - DELETE/UPDATE in der referenzierten Tabelle: Verschwindet ein Schlüsselwert, auf den noch
 *     verwiesen wird, gilt die Aktion des Fremdschlüssels:
 *       RESTRICT / NO ACTION (Standard): Fehler, der Befehl wird nicht ausgeführt.
 *       CASCADE: abhängige Datensätze werden mitgelöscht bzw. erhalten den neuen Wert
 *                (auch über mehrere Stufen).
 *       SET NULL / SET DEFAULT: Die Spalten des Fremdschlüssels werden NULL bzw. Standardwert.
 *   - Fremdschlüssel auf eine fehlende Tabelle oder Spalte werden nicht geprüft (das
 *     Klassendiagramm weist darauf hin).
 *   - Beim Laden einer Datei wird erst am Dateiende geprüft (firstViolation), damit die
 *     Reihenfolge der Befehle und nachträgliches ALTER TABLE … ADD FOREIGN KEY keine Rolle spielen.
 *
 * Abhängigkeiten:
 *   sql/errors.js (SqlError), sql/values.js (valueKey), sql/database.js (showValue, replaceRows)
 *
 * Sicherheitsaspekte:
 *   Meldungen enthalten Namen und Werte nur als Text; die Seiten fügen sie über textContent ein.
 */
(function (ns) {
  'use strict';

  const V = ns.sql.values;
  const SqlError = ns.sql.SqlError;

  /** Höchstzahl aufgeführter vorhandener Werte in einem Hinweis. */
  const MAX_LISTED_VALUES = 10;
  /** Höchstzahl verketteter Folgeänderungen eines Befehls (Schutz vor Endlosschleifen). */
  const MAX_EVENTS = 2000;

  const show = (v) => ns.sql.showValue(v);
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

  /**
   * Ermittelt die referenzierte Tabelle und ihre Spalten.
   * @param {Object} db - Datenbank.
   * @param {Object} fk - Fremdschlüssel.
   * @returns {{parent:Object, cols:Array<number>}|null} null, wenn Tabelle oder Spalte fehlt (dann keine Prüfung).
   */
  function resolve(db, fk) {
    const parent = db.tables.get(fk.refTable.toLowerCase());
    if (!parent) {
      return null;
    }
    let cols;
    if (fk.refColumns.length === 0) {
      // REFERENCES t ohne Spalten: der Primärschlüssel von t.
      if (!parent.primaryKey || parent.primaryKey.length !== fk.columns.length) {
        return null;
      }
      cols = parent.primaryKey.slice();
    } else {
      cols = fk.refColumns.map((c) => parent.colIndex.get(c.toLowerCase()));
      if (cols.some((i) => i === undefined) || cols.length !== fk.columns.length) {
        return null;
      }
    }
    return { parent, cols };
  }

  /** Schlüssel eines Datensatzes über Spalten (null, wenn ein Wert NULL ist). */
  function keyOf(row, cols) {
    let key = '';
    for (const i of cols) {
      const v = row[i];
      if (v === null) {
        return null;
      }
      key += V.valueKey(v) + '\u0001';
    }
    return key;
  }

  /** Menge der Schlüssel aller Datensätze. */
  function keySet(rows, cols) {
    const set = new Set();
    for (const row of rows) {
      const k = keyOf(row, cols);
      if (k !== null) {
        set.add(k);
      }
    }
    return set;
  }

  /** Alle Fremdschlüssel (auch Selbstbezüge), die auf eine Tabelle verweisen. */
  function referencing(db, parent) {
    const out = [];
    for (const child of db.tables.values()) {
      for (const fk of child.foreignKeys) {
        const r = resolve(db, fk);
        if (r && r.parent === parent) {
          out.push({ child, fk, cols: r.cols });
        }
      }
    }
    return out;
  }

  const colNames = (table, cols) => cols.map((i) => table.columns[i].name).join(', ');
  const valuesText = (row, cols) => (cols.length === 1 ? show(row[cols[0]]) : '(' + cols.map((i) => show(row[i])).join(', ') + ')');
  const fkLabel = (fk) => (fk.name ? 'Der Fremdschlüssel „' + fk.name + '“' : 'Der Fremdschlüssel');

  /**
   * Fehler: Ein Datensatz verweist auf einen nicht vorhandenen Datensatz.
   * @returns {SqlError} Fehler.
   */
  function missingParentError(table, fk, r, row, pos) {
    const values = [];
    const seen = new Set();
    for (const p of r.parent.rows) {
      const k = keyOf(p, r.cols);
      if (k !== null && !seen.has(k)) {
        seen.add(k);
        if (values.length < MAX_LISTED_VALUES) {
          values.push(valuesText(p, r.cols));
        }
      }
    }
    const many = fk.columns.length > 1;
    const message = 'Fremdschlüssel verletzt: ' + (many ? 'Die Werte ' : 'Der Wert ') + valuesText(row, fk.columns) +
      ' in „' + table.name + '“ (' + colNames(table, fk.columns) + ') verweis' + (many ? 'en' : 't') + ' auf keinen Datensatz in „' +
      r.parent.name + '“ (' + colNames(r.parent, r.cols) + ').';
    const hint = (seen.size === 0
      ? 'Die Tabelle „' + r.parent.name + '“ enthält noch keinen Datensatz.'
      : 'Vorhandene Werte in „' + r.parent.name + '“ (' + colNames(r.parent, r.cols) + '): ' + values.join(', ') +
        (seen.size > values.length ? ', … (insgesamt ' + seen.size + ')' : '') + '.') +
      ' Legen Sie zuerst den Datensatz in „' + r.parent.name + '“ an oder verwenden Sie einen vorhandenen Wert.';
    return new SqlError(message, pos, hint);
  }

  /**
   * Fehler: Löschen bzw. Ändern wird durch RESTRICT/NO ACTION verhindert.
   * @returns {SqlError} Fehler.
   */
  function restrictError(kind, ref, affected, pos) {
    const { child, fk, cols } = ref;
    const parent = ref.parent;
    const first = affected[0];
    const key = keyOf(first, fk.columns);
    const count = affected.filter((row) => keyOf(row, fk.columns) === key).length;
    const where = colNames(parent, cols) + ' = ' + valuesText(first, fk.columns);
    const message = (kind === 'delete'
      ? 'Der Datensatz mit ' + where + ' in „' + parent.name + '“ kann nicht gelöscht werden: '
      : 'In „' + parent.name + '“ kann ' + where + ' nicht geändert werden: ') +
      plural(count, 'Datensatz', 'Datensätze') + ' in „' + child.name + '“ verweis' + (count === 1 ? 't' : 'en') + ' noch darauf (' +
      colNames(child, fk.columns) + ').';
    const hint = fkLabel(fk) + ' hat ' + (kind === 'delete' ? 'ON DELETE ' + fk.onDelete : 'ON UPDATE ' + fk.onUpdate) +
      ' (ohne Angabe gilt RESTRICT). ' + (kind === 'delete'
      ? 'Löschen oder ändern Sie zuerst die Datensätze in „' + child.name + '“, die darauf verweisen.'
      : 'Ändern Sie zuerst die Datensätze in „' + child.name + '“, die darauf verweisen.');
    return new SqlError(message, pos, hint);
  }

  /**
   * Arbeitet die Folgen eines Befehls ab und prüft am Ende alle neuen bzw. geänderten Datensätze.
   *
   * @param {Object} db - Datenbank (wird bei CASCADE/SET NULL verändert).
   * @param {Array<Object>} events - {kind:'delete', table, rows} | {kind:'update', table, pairs:[[alt, neu]]}.
   * @param {Map<Object, Map<Array, Object>>} touched - Tabelle → (Datensatz → Position): zu prüfende Datensätze.
   * @param {Object} pos - Position des Befehls.
   * @param {{checkRow:function(Object, Array, Object):void, tick:function():void}} hooks - CHECK-Prüfung, Zeitbudget.
   * @returns {Array<{table:string, kind:string, rule:string, count:number}>} Folgeänderungen.
   */
  function settle(db, events, touched, pos, hooks) {
    const summary = new Map();
    const note = (table, kind, rule, count) => {
      const key = table.name + '\u0000' + kind + '\u0000' + rule;
      const old = summary.get(key) || { table: table.name, kind, rule, count: 0 };
      old.count += count;
      summary.set(key, old);
    };
    const touch = (table, row) => {
      if (!touched.has(table)) {
        touched.set(table, new Map());
      }
      touched.get(table).set(row, pos);
    };
    let handled = 0;
    while (events.length > 0) {
      if (++handled > MAX_EVENTS) {
        throw new SqlError('Der Befehl löst zu viele verkettete Änderungen über Fremdschlüssel aus (mehr als ' + MAX_EVENTS + ').', pos);
      }
      const ev = events.shift();
      const parent = ev.table;
      for (const ref of referencing(db, parent)) {
        hooks.tick();
        const { child, fk, cols } = ref;
        // Schlüsselwerte, die verschwinden (und wofür sie bei UPDATE … CASCADE ersetzt werden).
        const gone = new Map();
        if (ev.kind === 'delete') {
          for (const row of ev.rows) {
            const k = keyOf(row, cols);
            if (k !== null) {
              gone.set(k, null);
            }
          }
        } else {
          for (const [before, after] of ev.pairs) {
            const k = keyOf(before, cols);
            if (k !== null && k !== keyOf(after, cols)) {
              gone.set(k, after);
            }
          }
        }
        if (gone.size === 0) {
          continue;
        }
        for (const k of keySet(parent.rows, cols)) {
          gone.delete(k);
        }
        if (gone.size === 0) {
          continue;
        }
        const affected = child.rows.filter((row) => gone.has(keyOf(row, fk.columns)));
        if (affected.length === 0) {
          continue;
        }
        const rule = ev.kind === 'delete' ? fk.onDelete : fk.onUpdate;
        const ruleText = (ev.kind === 'delete' ? 'ON DELETE ' : 'ON UPDATE ') + rule;
        if (rule === 'RESTRICT' || rule === 'NO ACTION') {
          throw restrictError(ev.kind, Object.assign({ parent }, ref), affected, pos);
        }
        if (rule === 'CASCADE' && ev.kind === 'delete') {
          const drop = new Set(affected);
          db.replaceRows(child, child.rows.filter((row) => !drop.has(row)), pos);
          note(child, 'delete', ruleText, affected.length);
          events.push({ kind: 'delete', table: child, rows: affected });
          continue;
        }
        // Ändern der Fremdschlüssel-Spalten: CASCADE (bei UPDATE), SET NULL oder SET DEFAULT.
        const replace = new Map();
        for (const row of affected) {
          const copy = row.slice();
          fk.columns.forEach((c, n) => {
            const column = child.columns[c];
            let value;
            if (rule === 'CASCADE') {
              value = gone.get(keyOf(row, fk.columns))[cols[n]];
            } else if (rule === 'SET NULL') {
              value = null;
            } else {
              value = column.defaultValue !== undefined ? column.defaultValue : null;
            }
            if (value === null && column.notNull) {
              throw new SqlError(ruleText + ' ist nicht möglich: Die Spalte „' + column.name + '“ in „' + child.name + '“ darf nicht NULL sein.', pos,
                fkLabel(fk) + ' setzt den Wert beim ' + (ev.kind === 'delete' ? 'Löschen' : 'Ändern') + ' in „' + parent.name + '“ auf ' +
                (rule === 'SET DEFAULT' ? 'den Standardwert (hier keiner, also NULL).' : 'NULL.'));
            }
            copy[c] = value;
          });
          hooks.checkRow(child, copy, pos);
          replace.set(row, copy);
        }
        db.replaceRows(child, child.rows.map((row) => replace.get(row) || row), pos);
        const pairs = Array.from(replace.entries());
        for (const [, after] of pairs) {
          touch(child, after);
        }
        note(child, 'update', ruleText, pairs.length);
        events.push({ kind: 'update', table: child, pairs });
      }
    }
    // Neue und geänderte Datensätze, die noch vorhanden sind, müssen auf Vorhandenes verweisen.
    for (const [table, rows] of touched) {
      const present = new Set(table.rows);
      for (const fk of table.foreignKeys) {
        const r = resolve(db, fk);
        if (!r) {
          continue;
        }
        const keys = keySet(r.parent.rows, r.cols);
        for (const [row, rowPos] of rows) {
          hooks.tick();
          if (!present.has(row)) {
            continue;
          }
          const k = keyOf(row, fk.columns);
          if (k !== null && !keys.has(k)) {
            throw missingParentError(table, fk, r, row, rowPos);
          }
        }
      }
    }
    return Array.from(summary.values());
  }

  /** Nach INSERT: neue Datensätze prüfen. */
  function afterInsert(db, table, rows, positions, pos, hooks) {
    const map = new Map(rows.map((row, i) => [row, positions[i] || pos]));
    return settle(db, [], new Map([[table, map]]), pos, hooks);
  }

  /** Nach UPDATE: Folgen in abhängigen Tabellen und geänderte Datensätze prüfen. */
  function afterUpdate(db, table, pairs, pos, hooks) {
    if (pairs.length === 0) {
      return [];
    }
    const map = new Map(pairs.map((p) => [p[1], pos]));
    return settle(db, [{ kind: 'update', table, pairs }], new Map([[table, map]]), pos, hooks);
  }

  /** Nach DELETE: Folgen in abhängigen Tabellen. */
  function afterDelete(db, table, rows, pos, hooks) {
    if (rows.length === 0) {
      return [];
    }
    return settle(db, [{ kind: 'delete', table, rows }], new Map(), pos, hooks);
  }

  /**
   * Erster Verstoß in der ganzen Datenbank (Tabellen in Reihenfolge des Anlegens).
   *
   * @param {Object} db - Datenbank.
   * @returns {{table:Object, rowIndex:number, error:SqlError}|null} Verstoß oder null.
   */
  function firstViolation(db) {
    for (const table of db.tableList()) {
      for (const fk of table.foreignKeys) {
        const r = resolve(db, fk);
        if (!r) {
          continue;
        }
        const keys = keySet(r.parent.rows, r.cols);
        for (let i = 0; i < table.rows.length; i++) {
          const k = keyOf(table.rows[i], fk.columns);
          if (k !== null && !keys.has(k)) {
            return { table, rowIndex: i, error: missingParentError(table, fk, r, table.rows[i], null) };
          }
        }
      }
    }
    return null;
  }

  ns.sql.integrity = { resolve, afterInsert, afterUpdate, afterDelete, firstViolation };
})(window.SQLSIM = window.SQLSIM || {});
