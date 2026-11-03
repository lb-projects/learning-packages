/**
 * @file uml-model.js
 * @description Leitet aus dem Tabellenschema ein UML-Klassendiagramm ab (ohne Darstellung).
 *
 * Regeln:
 *   - Jede Tabelle wird eine Klasse. Klassenname: erster Buchstabe groß, Rest klein
 *     (schule → Schule), unabhängig von der Schreibung des Tabellennamens.
 *   - Attribute sind die Spalten, ganz klein geschrieben (Adresse → adresse), ohne Datentyp.
 *     Es entfallen alle Spalten von Fremdschlüsseln und künstliche Primärschlüssel
 *     (AUTO_INCREMENT oder „id“ als eigener Namensteil: id, kunde_id, id_kunde, KundenID).
 *     Natürliche Primärschlüssel werden als Schlüssel markiert.
 *   - Jeder Fremdschlüssel (Tabelle A → Tabelle B) wird eine Assoziation:
 *       Seite B: 1 (alle Spalten NOT NULL) bzw. 0..1;
 *       Seite A: 0..1, wenn die Spalten eindeutig sind (1:1), sonst *.
 *     Bezeichner: Name aus CONSTRAINT name, sonst die Spalte(n) des Fremdschlüssels.
 *   - Verbindungstabellen (genau zwei Fremdschlüssel auf zwei verschiedene Tabellen, alle
 *     Spalten NOT NULL, nicht eindeutig, von keiner Tabelle referenziert, kein natürlicher
 *     Schlüssel) werden zur n:m-Assoziation (* zu *). Hat die Tabelle eigene
 *     Attribute, wird sie Assoziationsklasse, sonst trägt die Linie den Tabellennamen.
 *   - Fremdschlüssel auf nicht vorhandene Tabellen oder Spalten ergeben Hinweise.
 *
 * Abhängigkeiten:
 *   Keine (arbeitet nur auf dem Datenbankobjekt aus sql/database.js).
 */
(function (ns) {
  'use strict';

  /**
   * Klassenname: erster Buchstabe groß, Rest klein.
   *
   * @param {string} name - Tabellenname.
   * @returns {string} z. B. "Schule".
   */
  function className(name) {
    const chars = Array.from(String(name));
    if (chars.length === 0) {
      return '';
    }
    return chars[0].toLocaleUpperCase('de-DE') + chars.slice(1).join('').toLocaleLowerCase('de-DE');
  }

  /**
   * Attributname: komplett klein.
   *
   * @param {string} name - Spaltenname.
   * @returns {string} z. B. "adresse".
   */
  function attributeName(name) {
    return String(name).toLocaleLowerCase('de-DE');
  }

  /**
   * Prüft, ob ein Spaltenname „id“ als eigenen Namensteil enthält:
   * id, ID, kunde_id, id_kunde, KundenID, kundeId, IdKunde.
   * Wörter wie „Video“ oder „Seide“ zählen nicht.
   *
   * @param {string} name - Spaltenname.
   * @returns {boolean} true bei einem künstlichen Schlüsselnamen.
   */
  function isIdName(name) {
    const n = String(name);
    return /(^|_)id(_|$)/i.test(n) || /[a-zäöüß0-9]I[dD]([A-ZÄÖÜ_0-9]|$)/.test(n) || /^I[dD][A-ZÄÖÜ0-9]/.test(n);
  }

  /**
   * @param {Object} table - Tabelle.
   * @param {number} idx - Spaltenindex.
   * @returns {boolean} true, wenn die Spalte ein künstlicher Primärschlüssel ist.
   */
  function isArtificialKey(table, idx) {
    if (!table.primaryKey || !table.primaryKey.includes(idx)) {
      return false;
    }
    const column = table.columns[idx];
    return Boolean(column.autoIncrement) || isIdName(column.name);
  }

  /** @returns {boolean} true, wenn beide Spaltenmengen gleich sind. */
  function sameSet(a, b) {
    return a.length === b.length && a.every((x) => b.includes(x));
  }

  /**
   * @param {Object} table - Tabelle.
   * @param {Array<number>} cols - Spalten.
   * @returns {boolean} true, wenn die Spalten Primärschlüssel oder UNIQUE sind.
   */
  function isUniqueSet(table, cols) {
    return (table.primaryKey && sameSet(table.primaryKey, cols)) || table.uniques.some((u) => sameSet(u, cols));
  }

  /**
   * Bezeichner eines Fremdschlüssels: Constraint-Name oder Spaltennamen.
   *
   * @param {Object} table - Tabelle.
   * @param {Object} fk - Fremdschlüssel.
   * @returns {string} Bezeichner.
   */
  function fkLabel(table, fk) {
    return fk.name || fk.columns.map((i) => table.columns[i].name).join(', ');
  }

  /**
   * Erzeugt das Modell des Klassendiagramms.
   *
   * @param {Object} db - Datenbank.
   * @returns {{classes:Array<Object>, associations:Array<Object>, warnings:Array<string>}} Modell.
   *   Klasse: {id, table, name, attributes:[{name, key}], associationClass}.
   *   Assoziation: {id, kind:'fk'|'nm', from, to, fromMult, toMult, label, assocClass, parallelIndex, parallelCount}
   *   (bei 'fk' ist from die Tabelle mit dem Fremdschlüssel, to die referenzierte Tabelle).
   */
  function buildModel(db) {
    const tables = db.tableList();
    const warnings = [];

    // 1) Fremdschlüssel auflösen und prüfen.
    const resolved = new Map(); // Tabellenschlüssel → [{fk, target}]
    for (const table of tables) {
      const list = [];
      for (const fk of table.foreignKeys) {
        const label = fkLabel(table, fk);
        const target = db.tables.get(fk.refTable.toLowerCase()) || null;
        if (!target) {
          if (db.views.has(fk.refTable.toLowerCase())) {
            warnings.push('Der Fremdschlüssel „' + label + '“ der Tabelle „' + table.name + '“ verweist auf „' + fk.refTable +
              '“. Das ist eine Sicht; ein Fremdschlüssel kann nur auf eine Tabelle verweisen. Die Beziehung fehlt deshalb im Diagramm.');
          } else {
            warnings.push('Der Fremdschlüssel „' + label + '“ der Tabelle „' + table.name + '“ verweist auf die Tabelle „' + fk.refTable +
              '“, die es nicht gibt. Die Beziehung fehlt deshalb im Diagramm.');
          }
          continue;
        }
        if (target.name !== fk.refTable) {
          warnings.push('Der Fremdschlüssel „' + label + '“ der Tabelle „' + table.name + '“ verweist auf „' + fk.refTable +
            '“; die Tabelle heißt aber „' + target.name + '“. Achten Sie auf die Groß- und Kleinschreibung.');
        }
        for (const col of fk.refColumns) {
          const idx = target.colIndex.get(col.toLowerCase());
          if (idx === undefined) {
            warnings.push('Der Fremdschlüssel „' + label + '“ der Tabelle „' + table.name + '“ verweist auf die Spalte „' + target.name + '.' + col +
              '“, die es nicht gibt.');
          } else if (target.columns[idx].name !== col) {
            warnings.push('Der Fremdschlüssel „' + label + '“ der Tabelle „' + table.name + '“ verweist auf „' + target.name + '.' + col +
              '“; die Spalte heißt aber „' + target.columns[idx].name + '“. Achten Sie auf die Groß- und Kleinschreibung.');
          }
        }
        list.push({ fk, target, label });
      }
      resolved.set(table.key, list);
    }

    // Wie oft wird jede Tabelle von anderen Fremdschlüsseln referenziert?
    const referenced = new Map();
    for (const table of tables) {
      for (const r of resolved.get(table.key)) {
        referenced.set(r.target.key, (referenced.get(r.target.key) || 0) + 1);
      }
    }

    /** Spalten, die in der Klassenkarte erscheinen. */
    function attributesOf(table) {
      const fkCols = new Set();
      for (const fk of table.foreignKeys) {
        fk.columns.forEach((c) => fkCols.add(c));
      }
      const attrs = [];
      table.columns.forEach((column, idx) => {
        if (fkCols.has(idx) || isArtificialKey(table, idx)) {
          return;
        }
        attrs.push({ name: attributeName(column.name), key: Boolean(table.primaryKey && table.primaryKey.includes(idx)) });
      });
      return attrs;
    }

    /** Prüft, ob eine Tabelle als Verbindungstabelle (n:m) dargestellt wird. */
    function isJunction(table) {
      const list = resolved.get(table.key);
      if (table.foreignKeys.length !== 2 || list.length !== 2 || referenced.has(table.key)) {
        return false;
      }
      // Selbstbezug oder zwei Verweise auf dieselbe Tabelle (z. B. heim_id/gast_id): keine
      // Verbindungstabelle, sondern eigene Klasse mit parallelen Beziehungen.
      if (list.some((r) => r.target === table) || list[0].target === list[1].target) {
        return false;
      }
      const [a, b] = list.map((r) => r.fk);
      if (a.columns.some((c) => b.columns.includes(c))) {
        return false;
      }
      const fkCols = a.columns.concat(b.columns);
      if (fkCols.some((c) => !table.columns[c].notNull)) {
        return false;
      }
      if (isUniqueSet(table, a.columns) || isUniqueSet(table, b.columns)) {
        return false;
      }
      if (table.primaryKey && table.primaryKey.some((c) => !fkCols.includes(c) && !isArtificialKey(table, c))) {
        return false;
      }
      return true;
    }

    // 2) Klassen und Assoziationen.
    const classes = [];
    const classOf = new Map();
    const associations = [];
    const junctions = tables.filter(isJunction);
    const junctionKeys = new Set(junctions.map((t) => t.key));

    for (const table of tables) {
      if (junctionKeys.has(table.key)) {
        continue;
      }
      const cls = { id: 'c' + classes.length, table: table.name, name: className(table.name), attributes: attributesOf(table), associationClass: false };
      classes.push(cls);
      classOf.set(table.key, cls);
    }
    for (const table of tables) {
      if (junctionKeys.has(table.key)) {
        continue;
      }
      for (const r of resolved.get(table.key)) {
        const allNotNull = r.fk.columns.every((c) => table.columns[c].notNull);
        associations.push({
          id: 'a' + associations.length, kind: 'fk',
          from: classOf.get(table.key).id, to: classOf.get(r.target.key).id,
          fromMult: isUniqueSet(table, r.fk.columns) ? '0..1' : '*',
          toMult: allNotNull ? '1' : '0..1',
          label: r.label, assocClass: null
        });
      }
    }
    for (const table of junctions) {
      const [ra, rb] = resolved.get(table.key);
      const attrs = attributesOf(table);
      let assocClass = null;
      if (attrs.length > 0) {
        const cls = { id: 'c' + classes.length, table: table.name, name: className(table.name), attributes: attrs, associationClass: true };
        classes.push(cls);
        classOf.set(table.key, cls);
        assocClass = cls.id;
      }
      associations.push({
        id: 'a' + associations.length, kind: 'nm',
        from: classOf.get(ra.target.key).id, to: classOf.get(rb.target.key).id,
        fromMult: '*', toMult: '*',
        label: assocClass ? '' : table.name, assocClass, junction: table.name
      });
    }

    // 3) Parallele Beziehungen zwischen demselben Klassenpaar durchnummerieren.
    const groups = new Map();
    for (const a of associations) {
      const key = [a.from, a.to].sort().join('|');
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(a);
    }
    for (const group of groups.values()) {
      group.forEach((a, i) => {
        a.parallelIndex = i;
        a.parallelCount = group.length;
      });
    }

    return { classes, associations, warnings };
  }

  ns.uml = ns.uml || {};
  Object.assign(ns.uml, { buildModel, className, attributeName, isIdName });
})(window.SQLSIM = window.SQLSIM || {});
