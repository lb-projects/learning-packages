/**
 * @file cluster-import.js
 * @description Liest CSV-Dateien mit Datenpunkten und erkennt ihren Aufbau.
 *
 * Erkennung (die Spaltenzahl der ersten Zeile entscheidet):
 *   2 Spalten: x;y                 Kopfzeile, wenn beide Zellen keine Zahl sind, sonst Daten.
 *   3 Spalten: Objekt;x;y          Kopfzeile, wenn die Zellen 2 und 3 keine Zahl sind, sonst Daten.
 *   Ist in der ersten Zeile nur eine der beiden Zellen eine Zahl, ist die Datei nicht eindeutig
 *   und wird abgelehnt. Andere Spaltenzahlen werden abgelehnt.
 *
 * Fehlerhafte Zeilen werden mit Zeilennummer gemeldet und übersprungen.
 *
 * Abhängigkeiten:
 *   csv-parser.js, point-data.js, point-import.js (Prüfen und Lesen der Datei), cluster-data.js
 *
 * Sicherheitsaspekte:
 *   Die Datei wird nie ausgeführt oder als HTML dargestellt. Meldungen enthalten nur
 *   Zeilennummern und feste Texte, nie den Rohinhalt der Datei.
 */
(function (ns) {
  'use strict';

  /** Höchstzahl einzeln aufgeführter Fehlermeldungen. */
  const MAX_LISTED_ERRORS = 10;

  /**
   * Wandelt CSV-Text in geprüfte Punkte um.
   *
   * @param {string} text - Inhalt der Datei.
   * @returns {{attributes:(Object|null), objectHeader:(string|null), hasHeader:boolean,
   *            points:Array<{x:number,y:number,name:(string|null)}>, errors:string[], skipped:number,
   *            limitReached:boolean}} Ergebnis; attributes ist null, wenn die Datei keine Kopfzeile hat.
   * @throws {Error} Wenn der Aufbau nicht erkennbar ist.
   */
  function parseText(text) {
    const limits = ns.clusterData.LIMITS;
    const parse = ns.pointData.parseNumber;
    const parsed = ns.csv.parseCsv(text, limits.maxPoints * 2 + 1, 4);
    if (parsed.rows.length === 0) {
      throw new Error('Die Datei enthält keine Daten.');
    }
    const first = parsed.rows[0].cells.map((c) => c.value);
    const columns = first.length;
    if (columns !== 2 && columns !== 3) {
      throw new Error('Die Datei muss zwei oder drei Spalten haben: x;y oder Objekt;x;y.');
    }
    const offset = columns - 2;
    const xIsNumber = parse(first[offset]) !== null;
    const yIsNumber = parse(first[offset + 1]) !== null;
    if (xIsNumber !== yIsNumber) {
      throw new Error('Die erste Zeile ist nicht eindeutig: Sie muss entweder zwei Achsennamen oder zwei Zahlen enthalten.');
    }
    const hasHeader = !xIsNumber;
    const result = {
      hasHeader,
      attributes: hasHeader ? {
        x: ns.pointData.sanitizeAttribute(first[offset], ns.pointData.DEFAULT_ATTRIBUTES.x),
        y: ns.pointData.sanitizeAttribute(first[offset + 1], ns.pointData.DEFAULT_ATTRIBUTES.y)
      } : null,
      objectHeader: hasHeader && columns === 3 ? ns.pointData.sanitizeAttribute(first[0], ns.clusterData.DEFAULT_OBJECT_HEADER) : null,
      points: [],
      errors: [],
      skipped: 0,
      limitReached: parsed.truncated
    };
    /**
     * Merkt eine Fehlermeldung.
     * @param {number} row - Zeilennummer.
     * @param {string} message - Meldung.
     */
    const reject = (row, message) => {
      result.skipped++;
      if (result.errors.length < MAX_LISTED_ERRORS) {
        result.errors.push('Zeile ' + row + ': ' + message);
      }
    };
    for (let i = hasHeader ? 1 : 0; i < parsed.rows.length; i++) {
      const { row, cells } = parsed.rows[i];
      if (cells.length !== columns) {
        reject(row, 'Es werden genau ' + (columns === 2 ? 'zwei' : 'drei') + ' Spalten benötigt.');
        continue;
      }
      const vx = ns.clusterData.validateNumber(cells[offset].value, 'Der x-Wert');
      const vy = ns.clusterData.validateNumber(cells[offset + 1].value, 'Der y-Wert');
      const bad = [vx, vy].find((v) => !v.ok);
      if (bad) {
        reject(row, bad.error);
        continue;
      }
      if (result.points.length >= limits.maxPoints) {
        result.limitReached = true;
        break;
      }
      result.points.push({ x: vx.value, y: vy.value, name: columns === 3 ? ns.clusterData.cleanName(cells[0].value) : null });
    }
    return result;
  }

  /**
   * Liest eine hochgeladene Datei ein. Der Datensatz wird hier nicht verändert.
   *
   * @param {File} file - Datei.
   * @returns {Promise<Object>} Ergebnis von {@link parseText}.
   * @throws {Error} Bei unzulässiger, zu großer oder beschädigter Datei.
   */
  async function importFile(file) {
    return parseText(await ns.pointImport.readTextFile(file));
  }

  ns.clusterImport = { parseText, importFile };
})(window.CC = window.CC || {});
