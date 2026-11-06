/**
 * @file confusion-matrix.js
 * @description Konfusionsmatrix als Tabelle: Zeilen = tatsächliches Label, Spalten = berechnetes Label.
 *
 * Der Baustein kennt kein Modell und keine feste Zahl von Labels. Die Diagonale enthält die
 * korrekten Klassifikationen. Die Farbstufe richtet sich nach dem Anteil an der Zeilensumme;
 * die Zahl steht immer zusätzlich in der Zelle, die Farbe ist nie die einzige Information.
 *
 * Gemeinsamer Code der Simulator-Pakete (Quelle: shared/js/confusion-matrix.js).
 *
 * Abhängigkeiten:
 *   dom-utils.js
 *
 * Sicherheitsaspekte:
 *   Labels werden nur als Text eingefügt, Farben nur über feste CSS-Klassen vergeben.
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;

  /** Anzahl der Farbstufen (0 = leer, 1 … HEAT_STEPS). */
  const HEAT_STEPS = 5;

  /**
   * Zählt die Paare aus tatsächlichem und berechnetem Label.
   *
   * @param {string[]} labels - Labels in der Reihenfolge der Matrix.
   * @param {Array<{actual:string, predicted:string}>} results - Ergebnisse.
   * @returns {{counts:number[][], rowSums:number[], colSums:number[], total:number, correct:number}} Zählwerte.
   */
  function count(labels, results) {
    const counts = labels.map(() => labels.map(() => 0));
    for (const r of results) {
      const row = labels.indexOf(r.actual);
      const col = labels.indexOf(r.predicted);
      if (row >= 0 && col >= 0) {
        counts[row][col]++;
      }
    }
    const rowSums = counts.map((row) => row.reduce((a, b) => a + b, 0));
    const colSums = labels.map((_, col) => counts.reduce((sum, row) => sum + row[col], 0));
    return {
      counts, rowSums, colSums,
      total: rowSums.reduce((a, b) => a + b, 0),
      correct: labels.reduce((sum, _, i) => sum + counts[i][i], 0)
    };
  }

  /**
   * Erzeugt die Tabelle.
   *
   * @param {string[]} labels - Labels.
   * @param {Object} m - Ergebnis von {@link count}.
   * @returns {HTMLElement} Tabelle.
   */
  function table(labels, m) {
    const head = dom.el('tr', null, [
      dom.el('th', { scope: 'col', class: 'cm-corner' }, [
        dom.el('span', { class: 'cm-axis' }, 'tatsächlich ↓'),
        dom.el('span', { class: 'cm-axis' }, 'berechnet →')
      ]),
      ...labels.map((l) => dom.el('th', { scope: 'col' }, l)),
      dom.el('th', { scope: 'col', class: 'cm-sum' }, 'Summe')
    ]);
    const rows = labels.map((actual, row) => dom.el('tr', null, [
      dom.el('th', { scope: 'row' }, actual),
      ...labels.map((predicted, col) => {
        const value = m.counts[row][col];
        const share = m.rowSums[row] > 0 ? value / m.rowSums[row] : 0;
        const step = value === 0 ? 0 : Math.max(1, Math.ceil(share * HEAT_STEPS));
        return dom.el('td', {
          class: 'cm-cell ' + (row === col ? 'cm-diag' : 'cm-off') + ' cm-h' + step,
          title: 'tatsächlich ' + actual + ', berechnet ' + predicted + ': ' + value + (row === col ? ' (korrekt)' : ' (falsch)')
        }, value);
      }),
      dom.el('td', { class: 'cm-sum' }, m.rowSums[row])
    ]));
    const foot = dom.el('tr', null, [
      dom.el('th', { scope: 'row', class: 'cm-sum' }, 'Summe'),
      ...m.colSums.map((sum) => dom.el('td', { class: 'cm-sum' }, sum)),
      dom.el('td', { class: 'cm-sum cm-total' }, m.total)
    ]);
    return dom.el('table', { class: 'data-table confusion-matrix' }, [
      dom.el('caption', { class: 'hint' }, 'Zeilen = tatsächliches Label, Spalten = berechnetes Label; Diagonale = korrekt'),
      dom.el('thead', null, head),
      dom.el('tbody', null, rows),
      dom.el('tfoot', null, foot)
    ]);
  }

  ns.confusionMatrix = { count, table };
})(window.LP = window.LP || {});
