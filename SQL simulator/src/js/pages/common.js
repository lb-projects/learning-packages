/**
 * @file pages/common.js
 * @description Gemeinsame Oberflächenbausteine: Fehlermeldung mit Quelltext-Ausschnitt
 *              und Ergebnistabelle.
 *
 * Sicherheit:
 *   Alle Inhalte (Werte, Spaltennamen, SQL-Ausschnitte) werden über dom.el als
 *   Text eingefügt und vorher von unsichtbaren Steuerzeichen bereinigt.
 *
 * Abhängigkeiten:
 *   dom-utils.js, text-utils.js, sql/values.js
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const text = ns.text;

  /** Höchstzahl der dargestellten Zeilen je Tabelle (alle Daten bleiben per SQL abfragbar). */
  const MAX_RENDERED_ROWS = 1000;

  /** Ab dieser Länge wird ein Zellinhalt gekürzt angezeigt (voller Text als Tooltip). */
  const LONG_TEXT = 60;

  /**
   * Erzeugt einen Quelltext-Ausschnitt mit Markierung "^" unter der Fehlerstelle.
   *
   * @param {string} source - Quelltext.
   * @param {{line:number, col:number}} pos - Position.
   * @returns {HTMLElement} <pre>-Element.
   */
  function excerpt(source, pos) {
    const lines = String(source).split('\n');
    const raw = (lines[pos.line - 1] || '').replace(/\r$/, '');
    const width = 100;
    const start = pos.col > width - 20 ? pos.col - (width - 40) : 0;
    const shown = text.cleanSourceLine(raw.slice(start, start + width));
    const prefix = (start > 0 ? '… ' : '');
    const label = pos.line + ' | ';
    const caretLine = ' '.repeat(label.length + prefix.length + Math.max(0, pos.col - 1 - start)) + '^';
    return dom.el('pre', { class: 'sql-excerpt', 'aria-hidden': 'true' }, label + prefix + shown + (start + width < raw.length ? ' …' : '') + '\n' + caretLine);
  }

  /**
   * Erzeugt die Fehlerbox für einen SQL-Fehler oder einen unerwarteten Programmfehler.
   *
   * @param {Error} error - Fehler.
   * @param {string|null} source - Quelltext für den Ausschnitt.
   * @param {Object} [options] - {title: Überschrift, showStatement: Befehlsnummer anzeigen}.
   * @returns {HTMLElement} Fehlerbox.
   */
  function errorBox(error, source, options) {
    const opts = options || {};
    const box = dom.el('div', { class: 'status status-error error-box', role: 'alert' });
    if (!(error instanceof ns.sql.SqlError)) {
      box.appendChild(dom.el('p', null, [dom.el('strong', null, 'Interner Fehler: '), text.sanitizeDisplayText(error && error.message, 300, 'unbekannt')]));
      box.appendChild(dom.el('p', { class: 'error-hint' }, 'Bitte laden Sie die Seite neu. Wenn der Fehler bleibt, melden Sie ihn bitte mit dem verwendeten SQL-Befehl.'));
      return box;
    }
    if (opts.title) {
      box.appendChild(dom.el('p', null, dom.el('strong', null, opts.title)));
    }
    const where = [];
    if (opts.showStatement && error.statementIndex) {
      where.push('Befehl ' + error.statementIndex);
    }
    if (error.pos) {
      where.push('Zeile ' + error.pos.line + ', Spalte ' + error.pos.col);
    }
    box.appendChild(dom.el('p', null, [
      dom.el('strong', null, 'Fehler' + (where.length ? ' (' + where.join(', ') + ')' : '') + ':'),
      ' ',
      text.cleanCellText(error.message)
    ]));
    if (error.hint) {
      box.appendChild(dom.el('p', { class: 'error-hint' }, text.cleanCellText(error.hint)));
    }
    if (error.pos && source) {
      box.appendChild(excerpt(source, error.pos));
    }
    return box;
  }

  /**
   * Erzeugt eine scrollbare Datentabelle.
   *
   * @param {Object} spec - Beschreibung.
   * @param {Array<string>} spec.columns - Spaltenüberschriften.
   * @param {Array<Object|null>} spec.types - Spaltentypen (für die Zahlformatierung).
   * @param {Array<Array<*>>} spec.rows - Datensätze.
   * @param {string} spec.label - Zugängliche Bezeichnung der Tabelle.
   * @param {string} spec.scrollClass - "scroll-5" oder "scroll-10".
   * @returns {HTMLElement} Container mit Tabelle (und ggf. Hinweis auf gekürzte Anzeige).
   */
  function dataTable(spec) {
    const headRow = dom.el('tr', null, spec.columns.map((name) => dom.el('th', { scope: 'col' }, text.cleanCellText(name))));
    const tbody = dom.el('tbody');
    const count = Math.min(spec.rows.length, MAX_RENDERED_ROWS);
    for (let r = 0; r < count; r++) {
      const row = spec.rows[r];
      const tr = dom.el('tr');
      row.forEach((value, c) => {
        if (value === null) {
          tr.appendChild(dom.el('td', { class: 'null' }, 'NULL'));
          return;
        }
        const shown = text.cleanCellText(ns.sql.values.formatValue(value, spec.types[c] || null));
        const attrs = { class: typeof value === 'number' ? 'num' : null };
        if (shown.length > LONG_TEXT) {
          attrs.title = shown;
          attrs.class = 'long';
        }
        tr.appendChild(dom.el('td', attrs, shown.length > LONG_TEXT ? shown.slice(0, LONG_TEXT - 1) + '…' : shown));
      });
      tbody.appendChild(tr);
    }
    const table = dom.el('table', { class: 'data-table' }, [dom.el('thead', null, headRow), tbody]);
    const wrap = dom.el('div', { class: 'table-wrap ' + spec.scrollClass, tabindex: '0', role: 'region', 'aria-label': spec.label }, table);
    if (spec.rows.length > MAX_RENDERED_ROWS) {
      return dom.el('div', null, [wrap, dom.el('p', { class: 'hint' },
        'Angezeigt werden die ersten ' + dom.formatCount(MAX_RENDERED_ROWS) + ' von ' + dom.formatCount(spec.rows.length) + ' Zeilen.')]);
    }
    return wrap;
  }

  /**
   * Erzeugt einen Hinweis (kein Fehler), z. B. zu einem Ergebnis oder zum Klassendiagramm.
   *
   * @param {string} message - Hinweistext.
   * @returns {HTMLElement} Hinweisbox.
   */
  function warningBox(message) {
    return dom.el('p', { class: 'status notice result-warning', role: 'note' }, [
      dom.el('strong', { class: 'note-title' }, 'Hinweis:'), text.cleanCellText(message)
    ]);
  }

  ns.pages = ns.pages || {};
  ns.ui = { errorBox, dataTable, warningBox, MAX_RENDERED_ROWS };
})(window.SQLSIM = window.SQLSIM || {});
