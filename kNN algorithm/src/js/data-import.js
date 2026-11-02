/**
 * @file data-import.js
 * @description Prüft hochgeladene Dateien, liest sie mit dem passenden Parser ein
 *              und wandelt die Zeilen in geprüfte Datenpunkte um.
 *
 * Ablauf:
 *   1. Dateiendung (Whitelist: .csv, .xlsx, .ods) und Dateigröße prüfen.
 *   2. Datei als Bytes lesen (FileReader) – die Datei wird nie ausgeführt,
 *      geöffnet oder als HTML/SVG/Bild dargestellt.
 *   3. "Magic Bytes" prüfen: XLSX/ODS müssen ZIP-Archive sein, CSV darf
 *      weder ZIP noch Binärdaten (Nullbytes) enthalten.
 *   4. Passenden Parser aufrufen (csv-parser.js, xlsx-parser.js, ods-parser.js).
 *   5. Kopfzeile erkennen: Sind x- und y-Wert der ersten Zeile keine Zahlen,
 *      werden sie als Achsenbeschriftungen verwendet.
 *   6. Jede Datenzeile prüfen (Zahlen, Wertebereich, Label-Whitelist,
 *      Höchstzahl an Labels und Punkten). Ungültige Zeilen werden mit
 *      Zeilennummer gemeldet und übersprungen.
 *
 * Abhängigkeiten:
 *   dataset.js, csv-parser.js, xlsx-parser.js, ods-parser.js, zip-reader.js
 *
 * Sicherheitsaspekte:
 *   Siehe Ablauf. Fehlermeldungen enthalten nur Zeilennummern und feste
 *   Texte, nie den Rohinhalt der Datei.
 */
(function (ns) {
  'use strict';

  /** Höchstgröße einer hochgeladenen Datei in Bytes (2 MB). */
  const MAX_FILE_BYTES = 2 * 1024 * 1024;
  /** Höchstzahl einzeln aufgeführter Fehlermeldungen. */
  const MAX_LISTED_ERRORS = 10;
  /** Erlaubte Dateiendungen. */
  const ALLOWED_EXTENSIONS = ['csv', 'xlsx', 'ods'];

  /**
   * Ermittelt die Dateiendung in Kleinbuchstaben.
   * @param {string} fileName - Dateiname.
   * @returns {string} Endung ohne Punkt oder "".
   */
  function extensionOf(fileName) {
    const dot = fileName.lastIndexOf('.');
    return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : '';
  }

  /**
   * Liest eine Datei als Bytes ein.
   * @param {File} file - Ausgewählte Datei.
   * @returns {Promise<Uint8Array>} Dateiinhalt.
   */
  function readFileBytes(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result));
      reader.onerror = () => reject(new Error('Die Datei konnte nicht gelesen werden.'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Dekodiert CSV-Bytes als Text: zuerst streng als UTF-8, bei Fehlern als
   * Windows-1252 (typisch für ältere Excel-Exporte mit Umlauten).
   *
   * @param {Uint8Array} bytes - Dateiinhalt.
   * @returns {string} Text.
   */
  function decodeText(bytes) {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (e) {
      return new TextDecoder('windows-1252').decode(bytes);
    }
  }

  /**
   * Prüft, ob eine Zelle eine gültige Zahl enthält.
   * @param {{type: string, value: (number|string)}} cell - Zelle.
   * @returns {boolean} true bei Zahl.
   */
  function isNumericCell(cell) {
    return ns.dataset.parseNumber(cell.value) !== null;
  }

  /**
   * Wandelt geparste Zeilen in geprüfte Datenpunkte um.
   *
   * @param {Array<{row:number, cells:Array<{type:string, value:(number|string)}>}>} rows - Zeilen.
   * @returns {{points: Array<{x:number, y:number, label:string}>, axisLabels: {x:string, y:string},
   *            hasHeader: boolean, errors: string[], skipped: number, limitReached: boolean}} Ergebnis.
   */
  function rowsToPoints(rows) {
    const ds = ns.dataset;
    const result = {
      points: [],
      axisLabels: { x: 'x', y: 'y' },
      hasHeader: false,
      errors: [],
      skipped: 0,
      limitReached: false
    };
    if (rows.length === 0) {
      return result;
    }
    let start = 0;
    const first = rows[0].cells;
    if (!(isNumericCell(first[0] || { value: '' }) && isNumericCell(first[1] || { value: '' }))) {
      // Kopfzeile: Spalten 1 und 2 beschriften die Achsen.
      result.hasHeader = true;
      result.axisLabels = {
        x: ds.sanitizeAxisLabel(first[0] ? first[0].value : '', 'x'),
        y: ds.sanitizeAxisLabel(first[1] ? first[1].value : '', 'y')
      };
      start = 1;
    }

    const labels = new Set();
    /**
     * Merkt eine Fehlermeldung (nur die ersten MAX_LISTED_ERRORS werden aufgeführt).
     * @param {number} rowNumber - Zeilennummer.
     * @param {string} message - Meldung.
     */
    function reject(rowNumber, message) {
      result.skipped++;
      if (result.errors.length < MAX_LISTED_ERRORS) {
        result.errors.push('Zeile ' + rowNumber + ': ' + message);
      }
    }

    for (let i = start; i < rows.length; i++) {
      const { row, cells } = rows[i];
      if (cells.length < 3) {
        reject(row, 'Es werden drei Spalten benötigt (x-Wert, y-Wert, Label).');
        continue;
      }
      const vx = ds.validateCoordinate(cells[0].value, 'x-Wert');
      if (!vx.ok) {
        reject(row, vx.error);
        continue;
      }
      const vy = ds.validateCoordinate(cells[1].value, 'y-Wert');
      if (!vy.ok) {
        reject(row, vy.error);
        continue;
      }
      const vl = ds.validateLabel(cells[2].value);
      if (!vl.ok) {
        reject(row, vl.error);
        continue;
      }
      if (!labels.has(vl.value) && labels.size >= ds.LIMITS.maxLabels) {
        reject(row, 'Mehr als ' + ds.LIMITS.maxLabels + ' verschiedene Labels sind nicht möglich.');
        continue;
      }
      if (result.points.length >= ds.LIMITS.maxPoints) {
        result.limitReached = true;
        break;
      }
      labels.add(vl.value);
      result.points.push({ x: vx.value, y: vy.value, label: vl.value });
    }
    return result;
  }

  /**
   * Liest eine hochgeladene Datei ein und liefert geprüfte Datenpunkte.
   * Der Datensatz selbst wird hier NICHT verändert; das übernimmt die
   * aufrufende Seite nach Rückfrage.
   *
   * @param {File} file - Vom Benutzer gewählte Datei.
   * @returns {Promise<{points: Array, axisLabels: Object, hasHeader: boolean, errors: string[],
   *                    skipped: number, limitReached: boolean, format: string}>} Ergebnis.
   * @throws {Error} Bei unzulässiger, zu großer oder beschädigter Datei.
   */
  async function importFile(file) {
    const extension = extensionOf(file.name);
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      throw new Error('Nur Dateien vom Typ .csv, .xlsx oder .ods sind erlaubt.');
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new Error('Die Datei ist zu groß (höchstens 2 MB).');
    }
    if (file.size === 0) {
      throw new Error('Die Datei ist leer.');
    }
    const bytes = await readFileBytes(file);
    // Kopfzeile + maximale Punktzahl + Reserve für ungültige Zeilen.
    const maxRows = ns.dataset.LIMITS.maxPoints * 2 + 1;

    let parsed;
    if (extension === 'csv') {
      if (ns.zip.looksLikeZip(bytes) || bytes.includes(0)) {
        throw new Error('Die Datei ist keine Textdatei im CSV-Format.');
      }
      parsed = ns.csv.parseCsv(decodeText(bytes), maxRows);
    } else {
      if (!ns.zip.looksLikeZip(bytes)) {
        throw new Error('Die Datei ist keine gültige ' + (extension === 'xlsx' ? 'Excel-Datei.' : 'OpenDocument-Tabelle.'));
      }
      parsed = extension === 'xlsx' ? ns.xlsx.parseXlsx(bytes, maxRows) : ns.ods.parseOds(bytes, maxRows);
    }
    const result = rowsToPoints(parsed.rows);
    result.limitReached = result.limitReached || parsed.truncated;
    result.format = extension;
    return result;
  }

  ns.dataImport = { importFile, rowsToPoints, extensionOf, MAX_FILE_BYTES };
})(window.KNN = window.KNN || {});
