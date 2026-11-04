/**
 * @file csv-parser.js
 * @description Parser für CSV-Dateien (kommagetrennte Werte) nach RFC 4180.
 *
 * Zweck:
 *   Zerlegt den Text einer CSV-Datei in Zeilen und Felder. Unterstützt werden:
 *   - Trennzeichen Semikolon (deutsches Excel), Komma und Tabulator
 *     (automatische Erkennung anhand der ersten Zeile),
 *   - Felder in Anführungszeichen, die Trennzeichen oder Zeilenumbrüche
 *     enthalten dürfen; "" innerhalb solcher Felder steht für ein ".
 *   - Zeilenenden LF, CRLF und CR,
 *   - ein optionales Byte-Order-Mark (BOM) am Dateianfang.
 *
 * Ausgabeformat (gemeinsam mit xlsx-parser.js und ods-parser.js):
 *   Array von Zeilen { row: Zeilennummer (ab 1), cells: [{ type: 'text', value }] }
 *
 * Gemeinsamer Code der Lernpakete NEIGHBORS und GRAIL (Quelle: shared/js/csv-parser.js).
 *
 * Abhängigkeiten:
 *   Keine.
 *
 * Sicherheitsaspekte:
 *   - Der Inhalt wird ausschließlich als Zeichenkette behandelt und nie
 *     ausgewertet oder als HTML eingefügt.
 *   - Anzahl der Zeilen, Felder je Zeile und Länge eines Feldes sind begrenzt,
 *     damit präparierte Dateien den Browser nicht überlasten.
 */
(function (ns) {
  'use strict';

  /** Standard-Höchstzahl an Feldern je Zeile, die gespeichert werden (weitere werden verworfen). */
  const MAX_FIELDS = 20;
  /** Obergrenze für die wählbare Feldzahl. */
  const MAX_FIELDS_LIMIT = 50;
  /** Höchstlänge eines einzelnen Feldes in Zeichen. */
  const MAX_FIELD_LENGTH = 1000;

  /**
   * Ermittelt das Trennzeichen anhand der ersten Zeile, die eines enthält
   * (Zeilen ohne Trennzeichen, z. B. eine einzelne Angabe wie "gerichtet", werden übersprungen).
   * Zeichen innerhalb von Anführungszeichen werden nicht mitgezählt.
   * Vorrang: Semikolon, dann Tabulator, dann Komma. Das Semikolon hat Vorrang,
   * weil bei deutscher Schreibweise das Komma als Dezimaltrennzeichen dient
   * (z. B. "1,5;2,5;A").
   *
   * @param {string} text - Dateiinhalt.
   * @returns {string} Das erkannte Trennzeichen.
   */
  function detectDelimiter(text) {
    const counts = { ';': 0, '\t': 0, ',': 0 };
    let inQuotes = false;
    for (let i = 0; i < text.length && i < 10000; i++) {
      const ch = text[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (!inQuotes && (ch === '\n' || ch === '\r')) {
        if (counts[';'] + counts['\t'] + counts[','] > 0) {
          break;
        }
      } else if (!inQuotes && Object.prototype.hasOwnProperty.call(counts, ch)) {
        counts[ch]++;
      }
    }
    if (counts[';'] > 0) {
      return ';';
    }
    if (counts['\t'] > 0) {
      return '\t';
    }
    return ',';
  }

  /**
   * Zerlegt CSV-Text in Zeilen und Felder.
   *
   * Arbeitsweise: ein einfacher Zustandsautomat, der den Text Zeichen für
   * Zeichen liest und sich merkt, ob er sich innerhalb eines Feldes in
   * Anführungszeichen befindet.
   *
   * @param {string} text - Dateiinhalt.
   * @param {number} maxRows - Höchstzahl nichtleerer Zeilen; danach wird abgebrochen.
   * @param {number} [maxFields=20] - Höchstzahl gespeicherter Felder je Zeile (höchstens 50).
   * @returns {{rows: Array<{row:number, cells:Array<{type:string, value:string}>}>, truncated: boolean, delimiter: string}}
   *          Zeilen, Hinweis auf Abbruch und verwendetes Trennzeichen.
   */
  function parseCsv(text, maxRows, maxFields) {
    const fieldLimit = Math.min(MAX_FIELDS_LIMIT, Math.max(1, Math.floor(maxFields) || MAX_FIELDS));
    let input = text;
    if (input.charCodeAt(0) === 0xfeff) {
      input = input.slice(1); // BOM entfernen
    }
    const delimiter = detectDelimiter(input);
    const rows = [];
    let fields = [];
    let field = '';
    let inQuotes = false;
    let lineNumber = 1;      // aktuelle physische Zeile (für Meldungen)
    let rowStartLine = 1;    // Zeile, in der der aktuelle Datensatz begann
    let truncated = false;

    /** Hängt ein Zeichen an das aktuelle Feld an (mit Längenbegrenzung). */
    function addChar(ch) {
      if (field.length < MAX_FIELD_LENGTH) {
        field += ch;
      }
    }
    /** Schließt das aktuelle Feld ab. */
    function endField() {
      if (fields.length < fieldLimit) {
        fields.push(field);
      }
      field = '';
    }
    /** Schließt den aktuellen Datensatz ab; leere Zeilen werden übersprungen. */
    function endRow() {
      endField();
      const isEmpty = fields.every((f) => f.trim() === '');
      if (!isEmpty) {
        rows.push({
          row: rowStartLine,
          cells: fields.map((value) => ({ type: 'text', value }))
        });
      }
      fields = [];
    }

    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (inQuotes) {
        if (ch === '"') {
          if (input[i + 1] === '"') {
            addChar('"'); // maskiertes Anführungszeichen
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          if (ch === '\n') {
            lineNumber++;
          }
          addChar(ch);
        }
        continue;
      }
      if (ch === '"' && field.trim() === '') {
        field = '';
        inQuotes = true;
      } else if (ch === delimiter) {
        endField();
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && input[i + 1] === '\n') {
          i++; // CRLF als ein Zeilenende behandeln
        }
        endRow();
        lineNumber++;
        rowStartLine = lineNumber;
        if (rows.length >= maxRows) {
          truncated = i + 1 < input.length && input.slice(i + 1).trim() !== '';
          return { rows, truncated, delimiter };
        }
      } else {
        addChar(ch);
      }
    }
    endRow();
    if (rows.length > maxRows) {
      rows.length = maxRows;
      truncated = true;
    }
    return { rows, truncated, delimiter };
  }

  ns.csv = { parseCsv, detectDelimiter };
})(window.LP = window.LP || {});
