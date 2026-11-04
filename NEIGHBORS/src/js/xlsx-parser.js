// Kopie aus shared/js/xlsx-parser.js – nicht hier bearbeiten: Änderungen in shared/ vornehmen und sync-shared.mjs ausführen.
/**
 * @file xlsx-parser.js
 * @description Liest die erste Tabelle einer Excel-Datei (Office Open XML, .xlsx).
 *
 * Zweck:
 *   Liefert die Zellinhalte der ersten Spalten (Standard: drei) des ersten Arbeitsblatts.
 *
 * Aufbau einer XLSX-Datei (vereinfacht):
 *   ZIP-Archiv mit u. a.
 *     xl/workbook.xml              Liste der Blätter (<sheet r:id="rId1"/>)
 *     xl/_rels/workbook.xml.rels   Zuordnung rId → Datei (z. B. worksheets/sheet1.xml)
 *     xl/worksheets/sheet1.xml     Zellen: <row r="1"><c r="A1" t="s"><v>0</v></c></row>
 *     xl/sharedStrings.xml         gemeinsam genutzte Texte (<si><t>…</t></si>)
 *   Zelltypen (Attribut t): s = Text aus sharedStrings, inlineStr = Text direkt
 *   in der Zelle, str = Formelergebnis als Text, b = Wahrheitswert,
 *   e = Fehlerwert, fehlt/n = Zahl.
 *
 * Ausgabeformat:
 *   Array von Zeilen { row: Zeilennummer, cells: [{ type: 'number'|'text', value }] }
 *
 * Gemeinsamer Code der Lernpakete NEIGHBORS und GRAIL (Quelle: shared/js/xlsx-parser.js).
 *
 * Abhängigkeiten:
 *   zip-reader.js (ns.zip), xml-utils.js (ns.xml)
 *
 * Sicherheitsaspekte:
 *   - Formeln werden NICHT ausgewertet; es wird nur der gespeicherte Wert gelesen.
 *   - Makros (VBA) werden nicht gelesen; .xlsm wird bereits beim Upload abgelehnt.
 *   - Es werden nur fest benannte Einträge gelesen; Begrenzungen siehe zip-reader.js.
 *   - Anzahl der gelesenen Zeilen und gemeinsamen Texte ist begrenzt.
 */
(function (ns) {
  'use strict';

  /** Höchstzahl gemeinsam genutzter Texte, die gelesen werden. */
  const MAX_SHARED_STRINGS = 100000;
  /** Standard: nur die ersten drei Spalten (A, B, C) sind relevant. */
  const DEFAULT_COLUMNS = 3;
  /** Höchstzahl lesbarer Spalten. */
  const MAX_COLUMNS = 50;

  /**
   * Wandelt einen Zellbezug wie "B12" in einen Spaltenindex (0-basiert) um.
   *
   * @param {string|null} ref - Zellbezug.
   * @returns {number} Spaltenindex oder -1, wenn kein Bezug angegeben ist.
   */
  function columnIndex(ref) {
    if (!ref) {
      return -1;
    }
    const match = /^([A-Z]{1,3})\d*$/.exec(ref.toUpperCase());
    if (!match) {
      return -1;
    }
    let index = 0;
    for (const ch of match[1]) {
      index = index * 26 + (ch.charCodeAt(0) - 64);
    }
    return index - 1;
  }

  /**
   * Fügt den Text aller <t>-Elemente eines Textcontainers zusammen.
   * Phonetische Hilfstexte (<rPh>, z. B. für Japanisch) werden ausgelassen.
   *
   * @param {Element} container - <si>- oder <is>-Element.
   * @returns {string} Zusammengesetzter Text.
   */
  function richText(container) {
    let text = '';
    for (const t of ns.xml.descendants(container, 't')) {
      if (t.parentElement && t.parentElement.localName === 'rPh') {
        continue;
      }
      text += t.textContent;
    }
    return text;
  }

  /**
   * Ermittelt den Pfad des ersten Arbeitsblatts über workbook.xml und die Beziehungsdatei.
   *
   * @param {Object} archive - Geöffnetes ZIP-Archiv (ns.zip.open).
   * @returns {string} Archivpfad des ersten Blatts.
   */
  function firstSheetPath(archive) {
    const fallback = 'xl/worksheets/sheet1.xml';
    const workbook = ns.xml.parseXml(archive.readText('xl/workbook.xml'), 'workbook.xml');
    const sheet = ns.xml.descendants(workbook, 'sheet')[0];
    if (!sheet || !archive.has('xl/_rels/workbook.xml.rels')) {
      return fallback;
    }
    const relId = ns.xml.attr(sheet, 'id', true);
    const rels = ns.xml.parseXml(archive.readText('xl/_rels/workbook.xml.rels'), 'workbook.xml.rels');
    for (const rel of ns.xml.descendants(rels, 'Relationship')) {
      if (rel.getAttribute('Id') === relId) {
        const target = rel.getAttribute('Target') || '';
        // Pfade sind relativ zu "xl/" oder absolut ab Archivwurzel ("/xl/…").
        // Der Pfad dient nur als Schlüssel im Archiv, nicht als Dateisystempfad.
        const path = target.startsWith('/') ? target.slice(1) : 'xl/' + target;
        return archive.has(path) ? path : fallback;
      }
    }
    return fallback;
  }

  /**
   * Liest die gemeinsam genutzten Texte (falls vorhanden).
   *
   * @param {Object} archive - Geöffnetes ZIP-Archiv.
   * @returns {string[]} Liste der Texte (Index = Verweis in Zellen mit t="s").
   */
  function readSharedStrings(archive) {
    if (!archive.has('xl/sharedStrings.xml')) {
      return [];
    }
    const doc = ns.xml.parseXml(archive.readText('xl/sharedStrings.xml'), 'sharedStrings.xml');
    const items = ns.xml.descendants(doc, 'si');
    if (items.length > MAX_SHARED_STRINGS) {
      throw new Error('Die Datei enthält zu viele Texteinträge.');
    }
    return items.map(richText);
  }

  /**
   * Liest den Wert einer Zelle.
   *
   * @param {Element} c - <c>-Element.
   * @param {string[]} shared - Gemeinsame Texte.
   * @returns {{type: string, value: (number|string)}|null} Zellwert oder null bei leerer Zelle.
   */
  function cellValue(c, shared) {
    const type = c.getAttribute('t') || 'n';
    if (type === 'inlineStr') {
      const is = ns.xml.children(c, 'is')[0];
      return is ? { type: 'text', value: richText(is) } : null;
    }
    const v = ns.xml.children(c, 'v')[0];
    if (!v) {
      return null;
    }
    const raw = v.textContent;
    if (type === 's') {
      const index = Number(raw);
      const text = Number.isInteger(index) && index >= 0 && index < shared.length ? shared[index] : '';
      return { type: 'text', value: text };
    }
    if (type === 'n') {
      const number = Number(raw);
      return Number.isFinite(number) && raw.trim() !== '' ? { type: 'number', value: number } : { type: 'text', value: raw };
    }
    // str, b, e und unbekannte Typen werden als Text weitergegeben.
    return { type: 'text', value: raw };
  }

  /**
   * Liest die ersten Spalten des ersten Arbeitsblatts.
   *
   * @param {Uint8Array} bytes - Dateiinhalt.
   * @param {number} maxRows - Höchstzahl nichtleerer Zeilen.
   * @param {number} [columns=3] - Anzahl der gelesenen Spalten (höchstens 50).
   * @returns {{rows: Array<{row:number, cells:Array}>, truncated: boolean}} Zeilen und Abbruchhinweis.
   * @throws {Error} Wenn die Datei keine gültige XLSX-Datei ist.
   */
  function parseXlsx(bytes, maxRows, columns) {
    const columnCount = Math.min(MAX_COLUMNS, Math.max(1, Math.floor(columns) || DEFAULT_COLUMNS));
    const archive = ns.zip.open(bytes);
    if (!archive.has('[Content_Types].xml') || !archive.has('xl/workbook.xml')) {
      throw new Error('Die Datei ist keine gültige Excel-Datei (.xlsx).');
    }
    const shared = readSharedStrings(archive);
    const sheetPath = firstSheetPath(archive);
    const sheet = ns.xml.parseXml(archive.readText(sheetPath), 'Arbeitsblatt');

    const rows = [];
    let truncated = false;
    let rowCounter = 0;
    for (const rowEl of ns.xml.descendants(sheet, 'row')) {
      rowCounter++;
      const rowNumber = Number(rowEl.getAttribute('r')) || rowCounter;
      rowCounter = rowNumber;
      const cells = new Array(columnCount).fill(null);
      let position = 0;
      for (const c of ns.xml.children(rowEl, 'c')) {
        const col = columnIndex(c.getAttribute('r'));
        const index = col >= 0 ? col : position;
        position = index + 1;
        if (index < columnCount) {
          cells[index] = cellValue(c, shared);
        }
      }
      const filled = cells.map((cell) => cell || { type: 'text', value: '' });
      if (filled.every((cell) => String(cell.value).trim() === '')) {
        continue;
      }
      if (rows.length >= maxRows) {
        truncated = true;
        break;
      }
      rows.push({ row: rowNumber, cells: filled });
    }
    return { rows, truncated };
  }

  ns.xlsx = { parseXlsx, columnIndex };
})(window.KNN = window.KNN || {});
