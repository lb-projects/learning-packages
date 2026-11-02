/**
 * @file ods-parser.js
 * @description Liest die erste Tabelle einer OpenDocument-Tabellendatei (.ods,
 *              z. B. aus LibreOffice Calc).
 *
 * Zweck:
 *   Liefert die Zellinhalte der ersten drei Spalten des ersten Tabellenblatts.
 *
 * Aufbau einer ODS-Datei (vereinfacht):
 *   ZIP-Archiv mit u. a.
 *     mimetype     Text "application/vnd.oasis.opendocument.spreadsheet"
 *     content.xml  <table:table> → <table:table-row> → <table:table-cell>
 *   Zellen tragen den Typ in office:value-type ("float", "string", …) und bei
 *   Zahlen den Wert in office:value; der angezeigte Text steht in <text:p>.
 *   Wiederholungen werden komprimiert gespeichert:
 *     table:number-columns-repeated = "diese Zelle n-mal",
 *     table:number-rows-repeated    = "diese Zeile n-mal".
 *
 * Ausgabeformat:
 *   Array von Zeilen { row: Zeilennummer, cells: [{ type: 'number'|'text', value }] }
 *
 * Abhängigkeiten:
 *   zip-reader.js (KNN.zip), xml-utils.js (KNN.xml)
 *
 * Sicherheitsaspekte:
 *   - Formeln werden nicht ausgewertet, Makros nicht gelesen.
 *   - Wiederholungsangaben werden begrenzt: Spalten auf die drei benötigten,
 *     Zeilen auf die verbleibende zulässige Punktzahl. Ein Wert wie
 *     number-rows-repeated="1048576" erzeugt daher keine Million Zeilen.
 */
(function (ns) {
  'use strict';

  const TABLE_NS = 'urn:oasis:names:tc:opendocument:xmlns:table:1.0';
  const OFFICE_NS = 'urn:oasis:names:tc:opendocument:xmlns:office:1.0';
  const ODS_MIMETYPE = 'application/vnd.oasis.opendocument.spreadsheet';
  /** Nur die ersten drei Spalten sind relevant. */
  const COLUMN_COUNT = 3;
  /** Zahlartige Werttypen, deren Wert in office:value steht. */
  const NUMERIC_TYPES = new Set(['float', 'percentage', 'currency']);

  /**
   * Liest eine positive ganze Wiederholungsangabe.
   *
   * @param {Element} element - Zeile oder Zelle.
   * @param {string} name - Attributname ohne Präfix.
   * @returns {number} Wiederholungsanzahl (mindestens 1).
   */
  function repeatCount(element, name) {
    const value = Number(element.getAttributeNS(TABLE_NS, name));
    return Number.isInteger(value) && value > 1 ? value : 1;
  }

  /**
   * Liest den Wert einer Zelle.
   *
   * @param {Element} cell - <table:table-cell>-Element.
   * @returns {{type: string, value: (number|string)}} Zellwert (leere Zelle → leerer Text).
   */
  function cellValue(cell) {
    const valueType = cell.getAttributeNS(OFFICE_NS, 'value-type');
    if (NUMERIC_TYPES.has(valueType)) {
      const number = Number(cell.getAttributeNS(OFFICE_NS, 'value'));
      if (Number.isFinite(number)) {
        return { type: 'number', value: number };
      }
    }
    // Text: Absätze (<text:p>) mit Leerzeichen verbinden.
    const paragraphs = ns.xml.children(cell, 'p').map((p) => p.textContent);
    return { type: 'text', value: paragraphs.join(' ') };
  }

  /**
   * Liest die ersten drei Spalten des ersten Tabellenblatts.
   *
   * @param {Uint8Array} bytes - Dateiinhalt.
   * @param {number} maxRows - Höchstzahl nichtleerer Zeilen.
   * @returns {{rows: Array<{row:number, cells:Array}>, truncated: boolean}} Zeilen und Abbruchhinweis.
   * @throws {Error} Wenn die Datei keine gültige ODS-Datei ist.
   */
  function parseOds(bytes, maxRows) {
    const archive = ns.zip.open(bytes);
    if (!archive.has('mimetype') || archive.readText('mimetype').trim() !== ODS_MIMETYPE ||
        !archive.has('content.xml')) {
      throw new Error('Die Datei ist keine gültige OpenDocument-Tabelle (.ods).');
    }
    const content = ns.xml.parseXml(archive.readText('content.xml'), 'content.xml');
    const table = content.getElementsByTagNameNS(TABLE_NS, 'table')[0];
    if (!table) {
      return { rows: [], truncated: false };
    }

    const rows = [];
    let truncated = false;
    let rowNumber = 0;
    for (const rowEl of Array.from(table.getElementsByTagNameNS(TABLE_NS, 'table-row'))) {
      const rowRepeat = repeatCount(rowEl, 'number-rows-repeated');
      // Zellen der Zeile lesen; überdeckte Zellen (verbundene Bereiche) zählen als Spalten.
      const cells = [];
      for (const cell of Array.from(rowEl.children)) {
        if (cells.length >= COLUMN_COUNT) {
          break;
        }
        if (cell.localName !== 'table-cell' && cell.localName !== 'covered-table-cell') {
          continue;
        }
        const value = cellValue(cell);
        const colRepeat = Math.min(repeatCount(cell, 'number-columns-repeated'), COLUMN_COUNT - cells.length);
        for (let i = 0; i < colRepeat; i++) {
          cells.push(value);
        }
      }
      while (cells.length < COLUMN_COUNT) {
        cells.push({ type: 'text', value: '' });
      }
      const firstRow = rowNumber + 1;
      rowNumber += rowRepeat;
      if (cells.every((cell) => String(cell.value).trim() === '')) {
        continue; // leere (auch vielfach wiederholte) Zeilen überspringen
      }
      for (let r = 0; r < rowRepeat; r++) {
        if (rows.length >= maxRows) {
          truncated = true;
          break;
        }
        rows.push({ row: firstRow + r, cells: cells.slice() });
      }
      if (truncated) {
        break;
      }
    }
    return { rows, truncated };
  }

  ns.ods = { parseOds };
})(window.KNN = window.KNN || {});
