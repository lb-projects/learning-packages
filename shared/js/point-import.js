/**
 * @file point-import.js
 * @description Liest CSV-Dateien mit Trainingspunkten ein und prüft sie.
 *
 * Format:
 *   Erste Zeile: [Attribut x];[Attribut y];Label – diese Kopfzeile ist Pflicht.
 *   Danach je Zeile x-Wert, y-Wert, Label. Trennzeichen Semikolon, Komma oder Tabulator;
 *   Dezimalkomma ist beim Semikolon möglich.
 *
 * Ablauf:
 *   1. Endung und Größe prüfen, Datei als Bytes lesen.
 *   2. ZIP-Archive und Binärdaten ablehnen; Text als UTF-8, sonst als Windows-1252 dekodieren.
 *   3. Kopfzeile prüfen; ohne gültige Kopfzeile wird die Datei abgelehnt.
 *   4. Jede Zeile prüfen. Fehlerhafte Zeilen werden mit Zeilennummer gemeldet und übersprungen.
 *
 * Gemeinsamer Code der Simulator-Pakete (Quelle: shared/js/point-import.js).
 *
 * Abhängigkeiten:
 *   csv-parser.js, point-data.js
 *
 * Sicherheitsaspekte:
 *   Die Datei wird nie ausgeführt oder als HTML dargestellt. Meldungen enthalten nur
 *   Zeilennummern und feste Texte, nie den Rohinhalt der Datei.
 */
(function (ns) {
  'use strict';

  /** Höchstgröße einer Datei in Bytes (2 MB). */
  const MAX_FILE_BYTES = 2 * 1024 * 1024;
  /** Höchstzahl einzeln aufgeführter Fehlermeldungen. */
  const MAX_LISTED_ERRORS = 10;
  /** Anzahl der Spalten. */
  const COLUMNS = 3;

  /**
   * Wandelt CSV-Text in geprüfte Punkte um.
   *
   * @param {string} text - Inhalt der Datei.
   * @param {{knownLabels?:string[], maxLabels?:number}} [options] - Vorhandene Labels und Höchstzahl (Standard 2).
   * @returns {{attributes:{x:string,y:string}, points:Array<{x:number,y:number,label:string}>,
   *            errors:string[], skipped:number, limitReached:boolean}} Ergebnis.
   * @throws {Error} Wenn die Kopfzeile fehlt oder falsch ist.
   */
  function parseText(text, options) {
    const data = ns.pointData;
    const opts = options || {};
    const maxLabels = opts.maxLabels || data.LIMITS.maxLabels;
    const labels = new Set(opts.knownLabels || []);
    const parsed = ns.csv.parseCsv(text, data.LIMITS.maxPoints * 2 + 1, COLUMNS + 1);
    if (parsed.rows.length === 0) {
      throw new Error('Die Datei enthält keine Daten.');
    }
    const header = parsed.rows[0].cells.map((c) => c.value);
    if (header.length !== COLUMNS || String(header[2]).trim().toLowerCase() !== 'label') {
      throw new Error('Die erste Zeile muss genau drei Einträge enthalten: Attribut in x-Richtung, Attribut in y-Richtung, Label.');
    }
    if (data.parseNumber(header[0]) !== null || data.parseNumber(header[1]) !== null) {
      throw new Error('Die erste Zeile muss die Namen der beiden Attribute enthalten, nicht deren Werte.');
    }
    const result = {
      attributes: { x: data.sanitizeAttribute(header[0], 'x₁'), y: data.sanitizeAttribute(header[1], 'x₂') },
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
    for (let i = 1; i < parsed.rows.length; i++) {
      const { row, cells } = parsed.rows[i];
      if (cells.length !== COLUMNS) {
        reject(row, 'Es werden genau drei Spalten benötigt.');
        continue;
      }
      const vx = data.validateNumber(cells[0].value, 'Der x-Wert');
      const vy = data.validateNumber(cells[1].value, 'Der y-Wert');
      const vl = data.validateLabel(cells[2].value);
      const bad = [vx, vy, vl].find((v) => !v.ok);
      if (bad) {
        reject(row, bad.error);
        continue;
      }
      if (!labels.has(vl.value) && labels.size >= maxLabels) {
        reject(row, 'Es sind höchstens ' + maxLabels + ' verschiedene Labels möglich.');
        continue;
      }
      if (result.points.length >= data.LIMITS.maxPoints) {
        result.limitReached = true;
        break;
      }
      labels.add(vl.value);
      result.points.push({ x: vx.value, y: vy.value, label: vl.value });
    }
    return result;
  }

  /**
   * Dekodiert Dateibytes als Text.
   * @param {Uint8Array} bytes - Inhalt.
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
   * Liest eine Datei als Bytes.
   * @param {File} file - Datei.
   * @returns {Promise<Uint8Array>} Inhalt.
   */
  function readBytes(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result));
      reader.onerror = () => reject(new Error('Die Datei konnte nicht gelesen werden.'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Liest eine hochgeladene Datei ein. Der Datensatz wird hier nicht verändert.
   *
   * @param {File} file - Datei.
   * @param {Object} [options] - Siehe {@link parseText}.
   * @returns {Promise<Object>} Ergebnis von {@link parseText}.
   * @throws {Error} Bei unzulässiger, zu großer oder beschädigter Datei.
   */
  async function importFile(file, options) {
    if (!/\.csv$/i.test(file.name)) {
      throw new Error('Nur Dateien vom Typ .csv sind erlaubt.');
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new Error('Die Datei ist zu groß (höchstens 2 MB).');
    }
    if (file.size === 0) {
      throw new Error('Die Datei ist leer.');
    }
    const bytes = await readBytes(file);
    const isZip = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
    if (isZip || bytes.includes(0)) {
      throw new Error('Die Datei ist keine Textdatei im CSV-Format.');
    }
    return parseText(decodeText(bytes), options);
  }

  ns.pointImport = { importFile, parseText, MAX_FILE_BYTES };
})(window.LP = window.LP || {});
