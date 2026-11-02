/**
 * @file database.js
 * @description Datenbank im Arbeitsspeicher: Tabellen, Datentypen, Constraints und DDL.
 *
 * Aufbau:
 *   Database  – Tabellen und Sichten (Views) in Maps (Schlüssel: Name in Kleinbuchstaben);
 *               eine Sicht speichert nur ihren Abfragetext (nicht materialisiert).
 *   Table     – Spalten, Datensätze (Arrays von Werten), Primärschlüssel,
 *               UNIQUE-Schlüssel, Fremdschlüssel (nur zur Anzeige), AUTO_INCREMENT.
 *
 * Datensätze sind unveränderlich: Änderungen erzeugen neue Arrays. Dadurch
 * ist clone() billig (Zeilen werden geteilt) und Seite 3 kann Befehle auf
 * einer Kopie ausführen und diese nur bei Erfolg übernehmen (atomar).
 *
 * Fremdschlüssel werden gespeichert und angezeigt, aber nicht erzwungen.
 *
 * Sicherheit:
 *   - Namen aus der Eingabe werden nur als Map-Schlüssel verwendet, nie als
 *     Eigenschaftsnamen von Objekten (kein Prototype Pollution, z. B. bei
 *     einer Tabelle namens "__proto__").
 *   - Grenzwerte (LIMITS) für Tabellen, Spalten, Datensätze und Textlänge.
 *
 * Abhängigkeiten:
 *   sql/errors.js, sql/values.js
 */
(function (ns) {
  'use strict';

  const SqlError = ns.sql.SqlError;
  const suggest = ns.sql.suggest;
  const V = ns.sql.values;

  /** Grenzwerte der Datenbank. */
  const LIMITS = Object.freeze({
    maxTables: 50,
    maxColumns: 50,
    maxRows: 20000,
    maxString: 1000,
    maxChecks: 50
  });

  /** Ganzzahltypen mit Wertebereich (vorzeichenbehaftet). */
  const INT_RANGES = new Map([
    ['TINYINT', 128], ['BOOL', 128], ['BOOLEAN', 128], ['SMALLINT', 32768],
    ['MEDIUMINT', 8388608], ['INT', 2147483648], ['INTEGER', 2147483648]
  ]);

  /** Bekannte Typnamen (für Vorschläge). */
  const KNOWN_TYPES = ['INT', 'INTEGER', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT', 'BOOLEAN', 'BOOL',
    'DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE', 'REAL', 'CHAR', 'VARCHAR', 'TEXT', 'TINYTEXT', 'MEDIUMTEXT',
    'LONGTEXT', 'ENUM', 'DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'YEAR'];

  /**
   * Wandelt einen geparsten Typ in einen normalisierten Typ um.
   *
   * @param {Object} t - Typ aus dem Parser ({name, args, values, unsigned, pos}).
   * @returns {Object} Normalisierter Typ: {base, display, length?, precision?, scale?, values?, min?, max?}.
   * @throws {SqlError} Bei unbekannten oder ungültigen Typen.
   */
  function normalizeType(t) {
    const name = t.name;
    const args = t.args;
    const argText = args.length ? '(' + args.join(',') + ')' : '';
    const display = name + (t.values ? '(' + t.values.map((v) => '\'' + v + '\'').join(',') + ')' : argText) + (t.unsigned ? ' UNSIGNED' : '');
    if (INT_RANGES.has(name) || name === 'BIGINT') {
      let min;
      let max;
      if (name === 'BIGINT') {
        min = t.unsigned ? 0 : Number.MIN_SAFE_INTEGER;
        max = Number.MAX_SAFE_INTEGER;
      } else {
        const r = INT_RANGES.get(name);
        min = t.unsigned ? 0 : -r;
        max = t.unsigned ? 2 * r - 1 : r - 1;
      }
      return { base: 'INT', display, min, max };
    }
    switch (name) {
      case 'DECIMAL':
      case 'NUMERIC':
      case 'DEC':
      case 'FIXED': {
        const precision = args.length > 0 ? args[0] : 10;
        const scale = args.length > 1 ? args[1] : 0;
        if (precision < 1 || precision > 65 || scale > 30 || scale > precision) {
          throw new SqlError('Ungültige Angabe ' + display + ': erlaubt sind DECIMAL(Stellen, Nachkommastellen) mit 1 ≤ Stellen ≤ 65 und Nachkommastellen ≤ Stellen.', t.pos);
        }
        return { base: 'DECIMAL', display, precision, scale, min: t.unsigned ? 0 : null };
      }
      case 'FLOAT':
      case 'DOUBLE':
      case 'REAL':
        return { base: 'FLOAT', display, min: t.unsigned ? 0 : null };
      case 'CHAR':
      case 'VARCHAR': {
        const length = args.length > 0 ? args[0] : (name === 'CHAR' ? 1 : 255);
        if (length < 0 || length > 65535) {
          throw new SqlError('Ungültige Länge in ' + display + '.', t.pos);
        }
        return { base: name, display, length };
      }
      case 'TINYTEXT':
      case 'TEXT':
      case 'MEDIUMTEXT':
      case 'LONGTEXT':
        return { base: 'TEXT', display };
      case 'ENUM': {
        if (!t.values || t.values.length === 0) {
          throw new SqlError('ENUM braucht eine Liste erlaubter Werte, z. B. ENUM(\'ja\',\'nein\').', t.pos);
        }
        const keys = new Set();
        for (const v of t.values) {
          const k = V.textKey(v);
          if (keys.has(k)) {
            throw new SqlError('Der Wert \'' + v + '\' steht mehrfach in ENUM.', t.pos);
          }
          keys.add(k);
        }
        return { base: 'ENUM', display, values: t.values.slice() };
      }
      case 'DATE':
        return { base: 'DATE', display };
      case 'DATETIME':
      case 'TIMESTAMP':
        return { base: 'DATETIME', display };
      case 'TIME':
        return { base: 'TIME', display };
      case 'YEAR':
        return { base: 'YEAR', display, min: 1901, max: 2155 };
      case 'SET':
        throw new SqlError('Der Datentyp SET wird nicht unterstützt.', t.pos);
      default: {
        const s = suggest(name, KNOWN_TYPES);
        throw new SqlError('Unbekannter Datentyp „' + name + '“.', t.pos, s ? 'Meinten Sie „' + s + '“?' : 'Mögliche Typen sind z. B. INT, DECIMAL(8,2), VARCHAR(50), TEXT, DATE.');
      }
    }
  }

  /**
   * Prüft ein Datum und bringt es in die Form JJJJ-MM-TT.
   *
   * @param {string} y - Jahr.
   * @param {string} m - Monat.
   * @param {string} d - Tag.
   * @returns {string|null} Datum oder null, wenn ungültig.
   */
  function normalizeDate(y, m, d) {
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    if (year < 1000 || month < 1 || month > 12 || day < 1) {
      return null;
    }
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (day > daysInMonth) {
      return null;
    }
    return String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  }

  /** @returns {string} Aktuelles Datum mit Uhrzeit (Ortszeit) im Format JJJJ-MM-TT hh:mm:ss. */
  function nowText() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  /**
   * Rundet kaufmännisch (halbe Werte vom Nullpunkt weg) auf `digits` Nachkommastellen.
   *
   * @param {number} x - Zahl.
   * @param {number} digits - Nachkommastellen (darf negativ sein).
   * @returns {number} Gerundete Zahl.
   */
  function roundHalfAway(x, digits) {
    const factor = Math.pow(10, Math.abs(digits));
    const y = digits >= 0 ? Math.abs(x) * factor : Math.abs(x) / factor;
    const r = Math.floor(y + 0.5 + 1e-9 * Math.max(1, y));
    const result = Math.sign(x) * (digits >= 0 ? r / factor : r * factor);
    return result === 0 ? 0 : result;
  }

  /**
   * Beschreibt einen Wert kurz für Fehlermeldungen.
   *
   * @param {*} value - Wert.
   * @returns {string} Beschreibung.
   */
  function show(value) {
    if (value === null) {
      return 'NULL';
    }
    if (typeof value === 'number') {
      return V.formatValue(value, null);
    }
    return '\'' + (value.length > 30 ? value.slice(0, 30) + '…' : value) + '\'';
  }

  /**
   * Wandelt einen Wert in den Typ einer Spalte um und prüft ihn.
   *
   * @param {*} value - Wert (null, number oder string).
   * @param {Object} column - Spalte.
   * @param {Object|null} pos - Position für Fehlermeldungen.
   * @returns {*} Umgewandelter Wert.
   * @throws {SqlError} Wenn der Wert nicht passt.
   */
  function coerceValue(value, column, pos) {
    if (value === null) {
      return null;
    }
    const type = column.type;
    const where = 'Spalte „' + column.name + '“ (' + type.display + ')';
    switch (type.base) {
      case 'INT':
      case 'YEAR': {
        let n = value;
        if (typeof n === 'string') {
          n = V.numericValue(n);
          if (n === null) {
            throw new SqlError(where + ': ' + show(value) + ' ist keine ganze Zahl.', pos);
          }
        }
        n = roundHalfAway(n, 0);
        if (n < type.min || n > type.max || !Number.isSafeInteger(n)) {
          throw new SqlError(where + ': Der Wert ' + show(value) + ' liegt außerhalb des erlaubten Bereichs (' + type.min + ' bis ' + type.max + ').', pos);
        }
        return n;
      }
      case 'DECIMAL':
      case 'FLOAT': {
        let n = value;
        if (typeof n === 'string') {
          n = V.numericValue(n);
          if (n === null) {
            throw new SqlError(where + ': ' + show(value) + ' ist keine Zahl. Dezimalzahlen werden mit Punkt geschrieben, z. B. 3.50.', pos);
          }
        }
        if (type.min === 0 && n < 0) {
          throw new SqlError(where + ': Negative Werte sind bei UNSIGNED nicht erlaubt.', pos);
        }
        if (type.base === 'DECIMAL') {
          n = roundHalfAway(n, type.scale);
          if (Math.abs(n) >= Math.pow(10, type.precision - type.scale)) {
            throw new SqlError(where + ': Der Wert ' + show(value) + ' hat zu viele Stellen vor dem Komma.', pos);
          }
        }
        return n;
      }
      case 'CHAR':
      case 'VARCHAR':
      case 'TEXT': {
        const text = typeof value === 'number' ? V.formatValue(value, null) : value;
        const length = Array.from(text).length;
        if (type.length !== undefined && length > type.length) {
          throw new SqlError(where + ': Der Text ist zu lang (' + length + ' Zeichen, erlaubt sind ' + type.length + ').', pos);
        }
        if (length > LIMITS.maxString) {
          throw new SqlError(where + ': Texte dürfen in diesem Simulator höchstens ' + LIMITS.maxString + ' Zeichen lang sein.', pos);
        }
        return text;
      }
      case 'ENUM': {
        const text = typeof value === 'number' ? V.formatValue(value, null) : value;
        const key = V.textKey(text);
        const match = type.values.find((v) => V.textKey(v) === key);
        if (match === undefined) {
          const lower = key.toLowerCase();
          const similar = type.values.find((v) => V.textKey(v).toLowerCase() === lower);
          throw new SqlError(where + ': ' + show(value) + ' ist nicht erlaubt. Erlaubt: ' + type.values.map((v) => '\'' + v + '\'').join(', ') + '.', pos,
            similar !== undefined ? 'Meinten Sie \'' + similar + '\'? Bei Texten kommt es auf die Groß-/Kleinschreibung an.' : null);
        }
        return match;
      }
      case 'DATE':
      case 'DATETIME': {
        if (typeof value !== 'string') {
          throw new SqlError(where + ': ' + show(value) + ' ist kein Datum. Schreiben Sie z. B. \'2024-03-15\'.', pos);
        }
        const m = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?\s*$/.exec(value);
        const date = m ? normalizeDate(m[1], m[2], m[3]) : null;
        if (!date) {
          throw new SqlError(where + ': ' + show(value) + ' ist kein gültiges Datum. Schreiben Sie z. B. \'2024-03-15\'.', pos);
        }
        if (type.base === 'DATE') {
          return date;
        }
        const h = m[4] !== undefined ? Number(m[4]) : 0;
        const min = m[5] !== undefined ? Number(m[5]) : 0;
        const s = m[6] !== undefined ? Number(m[6]) : 0;
        if (h > 23 || min > 59 || s > 59) {
          throw new SqlError(where + ': ' + show(value) + ' enthält eine ungültige Uhrzeit.', pos);
        }
        const p = (x) => String(x).padStart(2, '0');
        return date + ' ' + p(h) + ':' + p(min) + ':' + p(s);
      }
      case 'TIME': {
        const m = typeof value === 'string' ? /^\s*(\d{1,3}):(\d{2})(?::(\d{2}))?\s*$/.exec(value) : null;
        if (!m || Number(m[1]) > 838 || Number(m[2]) > 59 || (m[3] !== undefined && Number(m[3]) > 59)) {
          throw new SqlError(where + ': ' + show(value) + ' ist keine gültige Uhrzeit. Schreiben Sie z. B. \'14:30:00\'.', pos);
        }
        const p = (x) => String(x).padStart(2, '0');
        return p(Number(m[1])) + ':' + m[2] + ':' + (m[3] !== undefined ? m[3] : '00');
      }
      default:
        throw new Error('Unbekannter Basistyp ' + type.base);
    }
  }

  /**
   * Tabelle mit Spalten und Datensätzen.
   */
  class Table {
    /**
     * @param {string} name - Tabellenname (wie angelegt).
     */
    constructor(name) {
      this.name = name;
      this.key = name.toLowerCase();
      /** @type {Array<Object>} Spalten {name, key, type, notNull, defaultValue, defaultNow, autoIncrement}. */
      this.columns = [];
      /** @type {Map<string, number>} Spaltenname (klein) → Index. */
      this.colIndex = new Map();
      /** @type {Array<Array<*>>} Datensätze. */
      this.rows = [];
      /** @type {Array<number>|null} Spaltenindizes des Primärschlüssels. */
      this.primaryKey = null;
      /** @type {Array<Array<number>>} UNIQUE-Schlüssel (Spaltenindizes). */
      this.uniques = [];
      /** @type {Array<{columns:Array<number>, refTable:string, refColumns:Array<string>}>} Fremdschlüssel. */
      this.foreignKeys = [];
      /** @type {Array<Object>} CHECK-Bedingungen {name, text, expr, column, enforced, pos, bound}. */
      this.checks = [];
      /** Nächster AUTO_INCREMENT-Wert. */
      this.autoIncrementNext = 1;
      /** Zwischenspeicher der Schlüsselmengen für die Eindeutigkeitsprüfung (wird bei Änderungen verworfen). */
      this.keySets = null;
    }

    /** @returns {Table} Kopie (Datensätze werden geteilt, da unveränderlich). */
    clone() {
      const t = new Table(this.name);
      t.columns = this.columns.slice();
      t.colIndex = new Map(this.colIndex);
      t.rows = this.rows.slice();
      t.primaryKey = this.primaryKey ? this.primaryKey.slice() : null;
      t.uniques = this.uniques.map((u) => u.slice());
      t.foreignKeys = this.foreignKeys.map((f) => Object.assign({}, f));
      t.checks = this.checks.slice();
      t.autoIncrementNext = this.autoIncrementNext;
      return t;
    }

    /**
     * Liefert den Index einer Spalte oder wirft einen Fehler mit Vorschlag.
     *
     * @param {string} name - Spaltenname.
     * @param {Object|null} pos - Position.
     * @returns {number} Spaltenindex.
     */
    requireColumn(name, pos) {
      const idx = this.colIndex.get(name.toLowerCase());
      if (idx === undefined) {
        const hint = ns.sql.didYouMean(ns.sql.suggestions(name, this.columns.map((c) => c.name)));
        throw new SqlError('Die Tabelle „' + this.name + '“ hat keine Spalte „' + name + '“.', pos,
          hint || 'Vorhandene Spalten: ' + this.columns.map((c) => c.name).join(', ') + '.');
      }
      ns.sql.requireExactName(name, this.columns[idx].name, 'Die Tabelle „' + this.name + '“ hat keine Spalte „' + name + '“.', pos);
      return idx;
    }

    /** @returns {Object|null} Die AUTO_INCREMENT-Spalte mit Index oder null. */
    autoIncrementColumn() {
      const idx = this.columns.findIndex((c) => c.autoIncrement);
      return idx < 0 ? null : { idx, column: this.columns[idx] };
    }

    /** @returns {Array<{kind:string, columns:Array<number>}>} Alle Eindeutigkeitsschlüssel. */
    keys() {
      const list = [];
      if (this.primaryKey) {
        list.push({ kind: 'pk', columns: this.primaryKey });
      }
      for (const u of this.uniques) {
        list.push({ kind: 'unique', columns: u });
      }
      return list;
    }

    /** Verwirft zwischengespeicherte Schlüsselmengen (nach Änderungen). */
    invalidate() {
      this.keySets = null;
    }
  }

  /**
   * Bildet den Schlüssel eines Datensatzes für einen Eindeutigkeitsschlüssel.
   *
   * @param {Array<*>} row - Datensatz.
   * @param {Array<number>} columns - Spaltenindizes.
   * @returns {string|null} Schlüssel oder null, wenn ein Wert NULL ist (NULL ist nie doppelt).
   */
  function rowKey(row, columns) {
    let key = '';
    for (const idx of columns) {
      const v = row[idx];
      if (v === null) {
        return null;
      }
      key += V.valueKey(v) + '\u0001';
    }
    return key;
  }

  /**
   * Meldet einen doppelten Schlüssel.
   *
   * @param {Table} table - Tabelle.
   * @param {Object} key - Schlüssel {kind, columns}.
   * @param {Array<*>} row - Datensatz.
   * @param {Object|null} pos - Position.
   * @throws {SqlError} Immer.
   */
  function duplicateError(table, key, row, pos) {
    const names = key.columns.map((i) => table.columns[i].name).join(', ');
    const values = key.columns.map((i) => show(row[i])).join(', ');
    const what = key.kind === 'pk' ? 'Primärschlüssel (' + names + ')' : 'UNIQUE-Schlüssel (' + names + ')';
    throw new SqlError('Doppelter Wert ' + values + ' für den ' + what + ' der Tabelle „' + table.name + '“.', pos,
      key.kind === 'pk' ? 'Jeder Datensatz braucht einen eigenen Primärschlüssel-Wert.' : null);
  }

  /**
   * Prüft alle Eindeutigkeitsschlüssel über eine vollständige Liste von Datensätzen.
   *
   * @param {Table} table - Tabelle (für Schlüssel und Namen).
   * @param {Array<Array<*>>} rows - Zu prüfende Datensätze.
   * @param {Object|null} pos - Position.
   * @returns {Array<Set<string>>} Schlüsselmengen (zur Wiederverwendung).
   */
  function checkAllKeys(table, rows, pos) {
    const keys = table.keys();
    const sets = keys.map(() => new Set());
    for (const row of rows) {
      keys.forEach((key, k) => {
        const rk = rowKey(row, key.columns);
        if (rk === null) {
          return;
        }
        if (sets[k].has(rk)) {
          duplicateError(table, key, row, pos);
        }
        sets[k].add(rk);
      });
    }
    return sets;
  }

  /**
   * Datenbank mit mehreren Tabellen.
   */
  class Database {
    constructor() {
      /** @type {Map<string, Table>} Tabellen in Reihenfolge des Anlegens. */
      this.tables = new Map();
      /** @type {Map<string, {name:string, columns:Array<string>|null, text:string}>} Sichten (nur der Abfragetext, nicht materialisiert). */
      this.views = new Map();
    }

    /** @returns {Database} Kopie für atomare Änderungen. */
    clone() {
      const db = new Database();
      for (const [key, table] of this.tables) {
        db.tables.set(key, table.clone());
      }
      db.views = new Map(this.views);
      return db;
    }

    /** @returns {number} Anzahl aller Datensätze. */
    rowCount() {
      let n = 0;
      for (const t of this.tables.values()) {
        n += t.rows.length;
      }
      return n;
    }

    /** @returns {Array<Table>} Tabellen in Reihenfolge des Anlegens. */
    tableList() {
      return Array.from(this.tables.values());
    }

    /**
     * Liefert eine Tabelle oder wirft einen Fehler mit Vorschlag.
     *
     * @param {string} name - Tabellenname.
     * @param {Object|null} pos - Position.
     * @returns {Table} Tabelle.
     */
    requireTable(name, pos) {
      const table = this.tables.get(name.toLowerCase());
      if (!table) {
        const view = this.views.get(name.toLowerCase());
        if (view) {
          ns.sql.requireExactName(name, view.name, 'Die Tabelle „' + name + '“ gibt es nicht.', pos);
          throw new SqlError('„' + view.name + '“ ist eine Sicht, keine Tabelle.', pos,
            'Sichten lassen sich nur abfragen (SELECT …). Daten ändern Sie in der zugrunde liegenden Tabelle.');
        }
        const names = this.tableList().map((t) => t.name).concat(Array.from(this.views.values()).map((v) => v.name));
        const hint = ns.sql.didYouMean(ns.sql.suggestions(name, names));
        throw new SqlError('Die Tabelle „' + name + '“ gibt es nicht.', pos,
          hint || (names.length ? 'Vorhandene Tabellen: ' + names.join(', ') + '.' : 'Die Datenbank enthält noch keine Tabellen.'));
      }
      ns.sql.requireExactName(name, table.name, 'Die Tabelle „' + name + '“ gibt es nicht.', pos);
      return table;
    }

    /**
     * Fügt fertig umgewandelte Datensätze ein (prüft Grenzen und Eindeutigkeit).
     *
     * @param {Table} table - Zieltabelle.
     * @param {Array<Array<*>>} rows - Datensätze.
     * @param {Array<Object|null>} positions - Position je Datensatz.
     */
    insertRows(table, rows, positions) {
      if (this.rowCount() + rows.length > LIMITS.maxRows) {
        throw new SqlError('Die Datenbank darf in diesem Simulator höchstens ' + LIMITS.maxRows + ' Datensätze enthalten.', positions[0] || null);
      }
      const keys = table.keys();
      if (!table.keySets) {
        table.keySets = checkAllKeys(table, table.rows, null);
      }
      rows.forEach((row, r) => {
        keys.forEach((key, k) => {
          const rk = rowKey(row, key.columns);
          if (rk !== null && table.keySets[k].has(rk)) {
            duplicateError(table, key, row, positions[r]);
          }
        });
        keys.forEach((key, k) => {
          const rk = rowKey(row, key.columns);
          if (rk !== null) {
            table.keySets[k].add(rk);
          }
        });
        table.rows.push(row);
      });
    }

    /**
     * Ersetzt alle Datensätze einer Tabelle (nach UPDATE/DELETE) und prüft die Eindeutigkeit.
     *
     * @param {Table} table - Tabelle.
     * @param {Array<Array<*>>} rows - Neue Datensätze.
     * @param {Object|null} pos - Position.
     */
    replaceRows(table, rows, pos) {
      const sets = checkAllKeys(table, rows, pos);
      table.rows = rows;
      table.keySets = sets;
    }
  }

  // ---------------------------------------------------------------------------
  // DDL: CREATE TABLE, DROP TABLE, CREATE INDEX, ALTER TABLE
  // ---------------------------------------------------------------------------

  /**
   * Baut eine Spalte aus einer geparsten Spaltendefinition.
   *
   * @param {Object} def - Spaltendefinition aus dem Parser.
   * @returns {Object} Spalte.
   */
  function buildColumn(def) {
    const type = normalizeType(def.type);
    const column = {
      name: def.name,
      key: def.name.toLowerCase(),
      type,
      notNull: def.notNull || def.primaryKey,
      defaultValue: undefined,
      defaultNow: null,
      autoIncrement: def.autoIncrement
    };
    if (def.autoIncrement && type.base !== 'INT') {
      throw new SqlError('AUTO_INCREMENT ist nur bei Ganzzahl-Spalten (z. B. INT) möglich (Spalte „' + def.name + '“).', def.pos);
    }
    if (def.defaultValue !== undefined) {
      if (def.defaultValue.now) {
        if (type.base !== 'DATETIME' && type.base !== 'DATE') {
          throw new SqlError('CURRENT_TIMESTAMP als Standardwert ist nur bei DATE/DATETIME möglich (Spalte „' + def.name + '“).', def.pos);
        }
        column.defaultNow = type.base === 'DATE' ? 'date' : 'datetime';
      } else if (def.defaultValue.value === null) {
        if (column.notNull) {
          throw new SqlError('Die Spalte „' + def.name + '“ ist NOT NULL und kann daher nicht den Standardwert NULL haben.', def.pos);
        }
        column.defaultValue = null;
      } else {
        column.defaultValue = coerceValue(def.defaultValue.value, column, def.pos);
      }
    }
    return column;
  }

  /**
   * Wandelt Spaltennamen in Indizes um und prüft auf doppelte Angaben.
   *
   * @param {Table} table - Tabelle.
   * @param {Array<{name:string, pos:Object}>} names - Spaltennamen.
   * @returns {Array<number>} Indizes.
   */
  function columnIndices(table, names) {
    const result = [];
    for (const n of names) {
      const idx = table.requireColumn(n.name, n.pos);
      if (result.includes(idx)) {
        throw new SqlError('Die Spalte „' + n.name + '“ steht doppelt im Schlüssel.', n.pos);
      }
      result.push(idx);
    }
    return result;
  }

  /**
   * Setzt den Primärschlüssel einer Tabelle (Spalten werden NOT NULL).
   *
   * @param {Table} table - Tabelle.
   * @param {Array<number>} columns - Spaltenindizes.
   * @param {Object|null} pos - Position.
   */
  function setPrimaryKey(table, columns, pos) {
    if (table.primaryKey) {
      throw new SqlError('Die Tabelle „' + table.name + '“ hat bereits einen Primärschlüssel.', pos);
    }
    for (const idx of columns) {
      if (table.rows.some((r) => r[idx] === null)) {
        throw new SqlError('Die Spalte „' + table.columns[idx].name + '“ enthält NULL-Werte und kann daher nicht Teil des Primärschlüssels sein.', pos);
      }
      table.columns[idx] = Object.assign({}, table.columns[idx], { notNull: true });
    }
    table.primaryKey = columns;
    table.invalidate();
    checkAllKeys(table, table.rows, pos);
  }

  /**
   * Fügt einen UNIQUE-Schlüssel hinzu und prüft die vorhandenen Daten.
   *
   * @param {Table} table - Tabelle.
   * @param {Array<number>} columns - Spaltenindizes.
   * @param {Object|null} pos - Position.
   */
  function addUnique(table, columns, pos) {
    const sig = columns.join(',');
    if ((table.primaryKey && table.primaryKey.join(',') === sig) || table.uniques.some((u) => u.join(',') === sig)) {
      return;
    }
    table.uniques.push(columns);
    table.invalidate();
    checkAllKeys(table, table.rows, pos);
  }

  /**
   * Fügt eine CHECK-Bedingung hinzu. Gebunden und an den vorhandenen
   * Datensätzen geprüft wird sie in executor.js (prepareChecks).
   *
   * @param {Table} table - Tabelle.
   * @param {Object} c - CHECK aus dem Parser {name, expr, text, enforced, pos}.
   * @param {number|null} column - Spaltenindex bei einer Spaltenbedingung, sonst null.
   */
  function addCheck(table, c, column) {
    if (c.name !== null) {
      const key = c.name.toLowerCase();
      if (table.checks.some((k) => k.name !== null && k.name.toLowerCase() === key)) {
        throw new SqlError('Die Tabelle „' + table.name + '“ hat bereits eine Bedingung namens „' + c.name + '“.', c.pos);
      }
    }
    if (table.checks.length >= LIMITS.maxChecks) {
      throw new SqlError('Eine Tabelle darf höchstens ' + LIMITS.maxChecks + ' CHECK-Bedingungen haben.', c.pos);
    }
    table.checks.push({ name: c.name, text: c.text, expr: c.expr, column, enforced: c.enforced, pos: c.pos, bound: false });
  }

  /**
   * Wendet ein Tabellen-Constraint (aus CREATE TABLE oder ALTER TABLE ADD) an.
   *
   * @param {Table} table - Tabelle.
   * @param {Object} c - Constraint aus dem Parser.
   */
  function applyConstraint(table, c) {
    switch (c.kind) {
      case 'pk':
        setPrimaryKey(table, columnIndices(table, c.columns), c.pos);
        break;
      case 'unique':
        addUnique(table, columnIndices(table, c.columns), c.pos);
        break;
      case 'fk': {
        const cols = columnIndices(table, c.columns);
        if (c.refColumns.length && c.refColumns.length !== cols.length) {
          throw new SqlError('Der Fremdschlüssel hat ' + cols.length + ' Spalte(n), verweist aber auf ' + c.refColumns.length + '.', c.pos);
        }
        table.foreignKeys.push({ columns: cols, refTable: c.refTable, refColumns: c.refColumns.slice() });
        break;
      }
      case 'index':
        columnIndices(table, c.columns);
        break;
      case 'check':
        addCheck(table, c, null);
        break;
      default:
        throw new Error('Unbekanntes Constraint ' + c.kind);
    }
  }

  /**
   * Führt CREATE TABLE aus.
   *
   * @param {Database} db - Datenbank.
   * @param {Object} stmt - Anweisung.
   * @param {Array<string>} notices - Hinweise (werden ergänzt).
   * @returns {string} Ergebnismeldung.
   */
  function createTable(db, stmt, notices) {
    const key = stmt.name.toLowerCase();
    if (db.tables.has(key)) {
      if (stmt.ifNotExists) {
        notices.push('Die Tabelle „' + stmt.name + '“ existiert bereits und wurde nicht neu angelegt.');
        return 'Tabelle existiert bereits.';
      }
      throw new SqlError('Die Tabelle „' + stmt.name + '“ existiert bereits.', stmt.namePos,
        'Tipp: vorher „DROP TABLE IF EXISTS ' + stmt.name + ';“ ausführen.');
    }
    if (db.views.has(key)) {
      throw new SqlError('Es gibt bereits eine Sicht namens „' + db.views.get(key).name + '“.', stmt.namePos);
    }
    if (db.tables.size + db.views.size >= LIMITS.maxTables) {
      throw new SqlError('Es sind höchstens ' + LIMITS.maxTables + ' Tabellen und Sichten erlaubt.', stmt.namePos);
    }
    if (stmt.columns.length === 0) {
      throw new SqlError('Die Tabelle „' + stmt.name + '“ braucht mindestens eine Spalte.', stmt.namePos);
    }
    if (stmt.columns.length > LIMITS.maxColumns) {
      throw new SqlError('Eine Tabelle darf höchstens ' + LIMITS.maxColumns + ' Spalten haben.', stmt.namePos);
    }
    const table = new Table(stmt.name);
    for (const def of stmt.columns) {
      if (table.colIndex.has(def.name.toLowerCase())) {
        throw new SqlError('Die Spalte „' + def.name + '“ ist doppelt angegeben.', def.pos);
      }
      table.colIndex.set(def.name.toLowerCase(), table.columns.length);
      table.columns.push(buildColumn(def));
    }
    if (table.columns.filter((c) => c.autoIncrement).length > 1) {
      throw new SqlError('Eine Tabelle darf nur eine AUTO_INCREMENT-Spalte haben.', stmt.namePos);
    }
    const pkColumns = stmt.columns.filter((c) => c.primaryKey);
    if (pkColumns.length > 1) {
      throw new SqlError('Mehrere Spalten sind als PRIMARY KEY markiert. Für einen zusammengesetzten Schlüssel schreiben Sie PRIMARY KEY (a, b).', pkColumns[1].pos);
    }
    if (pkColumns.length === 1) {
      setPrimaryKey(table, [table.colIndex.get(pkColumns[0].name.toLowerCase())], pkColumns[0].pos);
    }
    stmt.columns.forEach((def, idx) => {
      if (def.unique) {
        addUnique(table, [idx], def.pos);
      }
      if (def.references) {
        table.foreignKeys.push({ columns: [idx], refTable: def.references.refTable, refColumns: def.references.refColumns.slice() });
      }
      for (const c of def.checks) {
        addCheck(table, c, idx);
      }
    });
    for (const c of stmt.constraints) {
      applyConstraint(table, c);
    }
    db.tables.set(key, table);
    return 'Tabelle „' + table.name + '“ angelegt.';
  }

  /**
   * Führt DROP TABLE aus.
   *
   * @param {Database} db - Datenbank.
   * @param {Object} stmt - Anweisung.
   * @returns {string} Ergebnismeldung.
   */
  function dropTable(db, stmt) {
    for (const n of stmt.names) {
      if (db.views.has(n.name.toLowerCase())) {
        throw new SqlError('„' + db.views.get(n.name.toLowerCase()).name + '“ ist eine Sicht.', n.pos, 'Sichten löschen Sie mit DROP VIEW ' + db.views.get(n.name.toLowerCase()).name + '.');
      }
      if (db.tables.has(n.name.toLowerCase()) || !stmt.ifExists) {
        db.requireTable(n.name, n.pos);
      }
    }
    for (const n of stmt.names) {
      db.tables.delete(n.name.toLowerCase());
    }
    return 'Tabelle(n) gelöscht.';
  }

  /**
   * Führt CREATE [UNIQUE] INDEX aus (normale Indizes haben keine Wirkung).
   *
   * @param {Database} db - Datenbank.
   * @param {Object} stmt - Anweisung.
   * @returns {string} Ergebnismeldung.
   */
  function createIndex(db, stmt) {
    const table = db.requireTable(stmt.table, stmt.tablePos);
    const cols = columnIndices(table, stmt.columns);
    if (stmt.unique) {
      addUnique(table, cols, stmt.pos);
    }
    return 'Index angelegt.';
  }

  /**
   * Ermittelt den nächsten AUTO_INCREMENT-Wert aus den vorhandenen Daten.
   *
   * @param {Table} table - Tabelle.
   */
  function refreshAutoIncrement(table) {
    const ai = table.autoIncrementColumn();
    if (!ai) {
      return;
    }
    let max = 0;
    for (const row of table.rows) {
      if (typeof row[ai.idx] === 'number' && row[ai.idx] > max) {
        max = row[ai.idx];
      }
    }
    table.autoIncrementNext = Math.max(table.autoIncrementNext, max + 1);
  }

  /**
   * Führt ALTER TABLE aus (Teilmenge, wie sie in phpMyAdmin-Exporten vorkommt).
   *
   * @param {Database} db - Datenbank.
   * @param {Object} stmt - Anweisung.
   * @returns {string} Ergebnismeldung.
   */
  function alterTable(db, stmt) {
    const table = db.requireTable(stmt.table, stmt.tablePos);
    for (const action of stmt.actions) {
      switch (action.kind) {
        case 'addConstraint':
          if (action.constraint.kind === 'column') {
            throw new Error('Unerwartete Spalte in ADD-Constraint');
          }
          applyConstraint(table, action.constraint);
          break;
        case 'addColumn': {
          const def = action.column;
          if (table.colIndex.has(def.name.toLowerCase())) {
            throw new SqlError('Die Spalte „' + def.name + '“ gibt es bereits.', def.pos);
          }
          if (table.columns.length >= LIMITS.maxColumns) {
            throw new SqlError('Eine Tabelle darf höchstens ' + LIMITS.maxColumns + ' Spalten haben.', def.pos);
          }
          if (def.autoIncrement) {
            throw new SqlError('ADD COLUMN mit AUTO_INCREMENT wird nicht unterstützt.', def.pos);
          }
          const column = buildColumn(def);
          const fill = column.defaultValue !== undefined ? column.defaultValue : null;
          if (fill === null && column.notNull && table.rows.length > 0) {
            throw new SqlError('Die neue Spalte „' + def.name + '“ ist NOT NULL, hat aber keinen Standardwert für die vorhandenen Datensätze.', def.pos);
          }
          table.colIndex.set(column.key, table.columns.length);
          table.columns.push(column);
          table.rows = table.rows.map((r) => r.concat([fill]));
          table.invalidate();
          if (def.primaryKey) {
            setPrimaryKey(table, [table.columns.length - 1], def.pos);
          }
          if (def.unique) {
            addUnique(table, [table.columns.length - 1], def.pos);
          }
          for (const c of def.checks) {
            addCheck(table, c, table.columns.length - 1);
          }
          break;
        }
        case 'modify': {
          const def = action.column;
          const idx = table.requireColumn(def.name, def.pos);
          const column = buildColumn(def);
          column.name = table.columns[idx].name;
          column.key = table.columns[idx].key;
          if (table.primaryKey && table.primaryKey.includes(idx)) {
            column.notNull = true;
          }
          if (column.autoIncrement && table.columns.some((c, i) => c.autoIncrement && i !== idx)) {
            throw new SqlError('Eine Tabelle darf nur eine AUTO_INCREMENT-Spalte haben.', def.pos);
          }
          table.rows = table.rows.map((r) => {
            const value = coerceValue(r[idx], column, def.pos);
            if (value === null && column.notNull) {
              throw new SqlError('Die Spalte „' + column.name + '“ enthält NULL-Werte und kann nicht NOT NULL werden.', def.pos);
            }
            const copy = r.slice();
            copy[idx] = value;
            return copy;
          });
          table.columns[idx] = column;
          table.invalidate();
          if (def.primaryKey && !(table.primaryKey && table.primaryKey.length === 1 && table.primaryKey[0] === idx)) {
            setPrimaryKey(table, [idx], def.pos);
          }
          if (def.unique) {
            addUnique(table, [idx], def.pos);
          }
          for (const c of def.checks) {
            addCheck(table, c, idx);
          }
          checkAllKeys(table, table.rows, def.pos);
          refreshAutoIncrement(table);
          break;
        }
        case 'autoIncrement':
          table.autoIncrementNext = Math.max(1, action.value);
          refreshAutoIncrement(table);
          break;
        default:
          throw new Error('Unbekannte ALTER-Aktion ' + action.kind);
      }
    }
    return 'Tabelle „' + table.name + '“ geändert.';
  }

  // ---------------------------------------------------------------------------
  // CREATE TABLE aus dem aktuellen Tabellenaufbau (Anzeige auf Seite 2)
  // ---------------------------------------------------------------------------

  /** Einfacher Name, der ohne Backticks geschrieben werden kann (wie im Lexer). */
  const PLAIN_NAME = /^[\p{L}_][\p{L}\p{N}_$]*$/u;

  /** Nicht reservierte Wörter, die am Anfang einer Spaltendefinition trotzdem anders gelesen würden. */
  const QUOTE_ALWAYS = new Set(['FULLTEXT', 'SPATIAL']);

  /**
   * Schreibt einen Namen, bei Bedarf in Backticks.
   *
   * @param {string} name - Name.
   * @returns {string} Name für SQL.
   */
  function quoteName(name) {
    if (PLAIN_NAME.test(name) && !ns.sql.isReserved(name) && !QUOTE_ALWAYS.has(name.toUpperCase())) {
      return name;
    }
    return '`' + name.replace(/`/g, '``') + '`';
  }

  /**
   * Schreibt einen Wert als SQL-Literal.
   *
   * @param {*} value - Wert.
   * @param {Object|null} type - Spaltentyp (für die Zahlformatierung).
   * @returns {string} Literal.
   */
  function sqlLiteral(value, type) {
    if (value === null) {
      return 'NULL';
    }
    if (typeof value === 'number') {
      return V.formatValue(value, type);
    }
    return '\'' + value.replace(/\\/g, '\\\\').replace(/'/g, '\'\'').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t') + '\'';
  }

  /** @returns {string} Datentyp einer Spalte als SQL. */
  function typeSql(type) {
    if (type.base === 'ENUM') {
      return 'ENUM(' + type.values.map((v) => sqlLiteral(v, null)).join(', ') + ')';
    }
    return type.display;
  }

  /** @returns {string} CHECK-Bedingung als SQL. */
  function checkSql(check) {
    return (check.name !== null ? 'CONSTRAINT ' + quoteName(check.name) + ' ' : '') +
      'CHECK (' + check.text + ')' + (check.enforced ? '' : ' NOT ENFORCED');
  }

  /**
   * Erzeugt den CREATE-TABLE-Befehl, der den aktuellen Aufbau einer Tabelle
   * ergibt (ähnlich SHOW CREATE TABLE). Normale Indizes und Tabellenoptionen
   * haben im Simulator keine Wirkung und erscheinen daher nicht.
   *
   * @param {Table} table - Tabelle.
   * @returns {string} SQL-Befehl (mehrzeilig).
   */
  function createTableSql(table) {
    const pk = table.primaryKey;
    const inlinePk = pk && pk.length === 1 ? pk[0] : -1;
    const inlineUnique = new Set(table.uniques.filter((u) => u.length === 1).map((u) => u[0]));
    const lines = table.columns.map((c, idx) => {
      const parts = [quoteName(c.name), typeSql(c.type)];
      if (c.notNull && idx !== inlinePk) {
        parts.push('NOT NULL');
      }
      if (c.defaultNow) {
        parts.push('DEFAULT ' + (c.defaultNow === 'date' ? 'CURRENT_DATE' : 'CURRENT_TIMESTAMP'));
      } else if (c.defaultValue !== undefined) {
        parts.push('DEFAULT ' + sqlLiteral(c.defaultValue, c.type));
      }
      if (c.autoIncrement) {
        parts.push('AUTO_INCREMENT');
      }
      if (idx === inlinePk) {
        parts.push('PRIMARY KEY');
      }
      if (inlineUnique.has(idx)) {
        parts.push('UNIQUE');
      }
      for (const check of table.checks) {
        if (check.column === idx) {
          parts.push(checkSql(check));
        }
      }
      return parts.join(' ');
    });
    const names = (cols) => cols.map((i) => quoteName(table.columns[i].name)).join(', ');
    if (pk && pk.length > 1) {
      lines.push('PRIMARY KEY (' + names(pk) + ')');
    }
    for (const u of table.uniques) {
      if (u.length > 1) {
        lines.push('UNIQUE (' + names(u) + ')');
      }
    }
    for (const fk of table.foreignKeys) {
      lines.push('FOREIGN KEY (' + names(fk.columns) + ') REFERENCES ' + quoteName(fk.refTable) +
        (fk.refColumns.length ? ' (' + fk.refColumns.map(quoteName).join(', ') + ')' : ''));
    }
    for (const check of table.checks) {
      if (check.column === null) {
        lines.push(checkSql(check));
      }
    }
    return 'CREATE TABLE ' + quoteName(table.name) + ' (\n  ' + lines.join(',\n  ') + '\n);';
  }

  ns.sql.LIMITS = LIMITS;
  /**
   * Erzeugt den CREATE-VIEW-Befehl einer Sicht.
   *
   * @param {{name:string, columns:Array<string>|null, text:string}} view - Sicht.
   * @returns {string} SQL-Befehl.
   */
  function createViewSql(view) {
    return 'CREATE VIEW ' + quoteName(view.name) + (view.columns ? ' (' + view.columns.map(quoteName).join(', ') + ')' : '') + ' AS\n' + view.text + ';';
  }

  ns.sql.createTableSql = createTableSql;
  ns.sql.createViewSql = createViewSql;
  ns.sql.quoteName = quoteName;
  ns.sql.Database = Database;
  ns.sql.Table = Table;
  ns.sql.coerceValue = coerceValue;
  ns.sql.roundHalfAway = roundHalfAway;
  ns.sql.nowText = nowText;
  ns.sql.showValue = show;
  ns.sql.ddl = { createTable, dropTable, createIndex, alterTable };
})(window.SQLSIM = window.SQLSIM || {});
