/**
 * @file cluster-import.js
 * @description Liest CSV-Dateien mit Datenpunkten und erkennt ihren Aufbau.
 *
 * Erkennung (die erste Zeile entscheidet):
 *   2 Spalten: x;y                 Kopfzeile, wenn beide Zellen keine Zahl sind, sonst Daten.
 *   3 Spalten: x;y;Gruppe          Kopfzeile, wenn der letzte Eintrag „Gruppe“ heißt und die Zellen 1 und 2
 *                                  keine Zahl sind; Daten, wenn die Zellen 1 und 2 Zahlen sind und Zelle 3 keine ist.
 *   3 Spalten: Objekt;x;y          sonst: Kopfzeile, wenn die Zellen 2 und 3 keine Zahl sind, sonst Daten.
 *   4 Spalten: Objekt;x;y;Gruppe   Kopfzeile, wenn die Zellen 2 und 3 keine Zahl sind, sonst Daten.
 *   Ist nur eine der beiden Zellen für x und y eine Zahl, ist die Datei nicht eindeutig und wird
 *   abgelehnt. Andere Spaltenzahlen werden abgelehnt.
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
  /** Gespeicherte Felder je Zeile: eines mehr als erlaubt, damit zu viele Spalten auffallen. */
  const MAX_FIELDS = 5;
  const COLUMN_WORDS = { 2: 'zwei', 3: 'drei', 4: 'vier' };

  /**
   * Bestimmt aus der ersten Zeile, welche Spalte was enthält.
   *
   * @param {string[]} first - Zellen der ersten Zeile.
   * @returns {{name:number, x:number, y:number, group:number}} Spalten ab 0; −1, wenn es sie nicht gibt.
   * @throws {Error} Bei einer anderen Spaltenzahl.
   */
  function layoutOf(first) {
    const isNumber = (value) => ns.pointData.parseNumber(value) !== null;
    if (first.length === 2) {
      return { name: -1, x: 0, y: 1, group: -1 };
    }
    if (first.length === 4) {
      return { name: 0, x: 1, y: 2, group: 3 };
    }
    if (first.length !== 3) {
      throw new Error('Die Datei muss zwei bis vier Spalten haben: x;y, Objekt;x;y, x;y;Gruppe oder Objekt;x;y;Gruppe.');
    }
    const twoNumbers = isNumber(first[0]) && isNumber(first[1]);
    const noNumbers = !isNumber(first[0]) && !isNumber(first[1]);
    const groupHeader = noNumbers && first[2].trim().toLowerCase() === 'gruppe';
    const groupData = twoNumbers && !isNumber(first[2]);
    return groupHeader || groupData ? { name: -1, x: 0, y: 1, group: 2 } : { name: 0, x: 1, y: 2, group: -1 };
  }

  /**
   * Wandelt CSV-Text in geprüfte Punkte um.
   *
   * @param {string} text - Inhalt der Datei.
   * @returns {{attributes:(Object|null), objectHeader:(string|null), hasHeader:boolean,
   *            points:Array<{x:number,y:number,name:(string|null),group?:(string|null)}>, errors:string[],
   *            skipped:number, limitReached:boolean}} Ergebnis; attributes ist null, wenn die Datei keine
   *   Kopfzeile hat. group gibt es nur bei Dateien mit Gruppenspalte.
   * @throws {Error} Wenn der Aufbau nicht erkennbar ist.
   */
  function parseText(text) {
    const limits = ns.clusterData.LIMITS;
    const parse = ns.pointData.parseNumber;
    const parsed = ns.csv.parseCsv(text, limits.maxPoints * 2 + 1, MAX_FIELDS);
    if (parsed.rows.length === 0) {
      throw new Error('Die Datei enthält keine Daten.');
    }
    const first = parsed.rows[0].cells.map((c) => c.value);
    const columns = first.length;
    const layout = layoutOf(first);
    const xIsNumber = parse(first[layout.x]) !== null;
    const yIsNumber = parse(first[layout.y]) !== null;
    if (xIsNumber !== yIsNumber) {
      throw new Error('Die erste Zeile ist nicht eindeutig: Sie muss entweder zwei Achsennamen oder zwei Zahlen enthalten.');
    }
    const hasHeader = !xIsNumber;
    const result = {
      hasHeader,
      attributes: hasHeader ? {
        x: ns.pointData.sanitizeAttribute(first[layout.x], ns.pointData.DEFAULT_ATTRIBUTES.x),
        y: ns.pointData.sanitizeAttribute(first[layout.y], ns.pointData.DEFAULT_ATTRIBUTES.y)
      } : null,
      objectHeader: hasHeader && layout.name >= 0 ? ns.pointData.sanitizeAttribute(first[layout.name], ns.clusterData.DEFAULT_OBJECT_HEADER) : null,
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
        reject(row, 'Es werden genau ' + COLUMN_WORDS[columns] + ' Spalten benötigt.');
        continue;
      }
      const vx = ns.clusterData.validateNumber(cells[layout.x].value, 'Der x-Wert');
      const vy = ns.clusterData.validateNumber(cells[layout.y].value, 'Der y-Wert');
      const bad = [vx, vy].find((v) => !v.ok);
      if (bad) {
        reject(row, bad.error);
        continue;
      }
      if (result.points.length >= limits.maxPoints) {
        result.limitReached = true;
        break;
      }
      const point = { x: vx.value, y: vy.value, name: layout.name >= 0 ? ns.clusterData.cleanName(cells[layout.name].value) : null };
      if (layout.group >= 0) {
        point.group = ns.clusterData.cleanName(cells[layout.group].value);
      }
      result.points.push(point);
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
