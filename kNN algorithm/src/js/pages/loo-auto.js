/**
 * @file loo-auto.js
 * @description Seite 6 "Leave One Out – automatisiert".
 *
 * Funktionen der Seite:
 *   - Führt das Leave-One-Out-Verfahren für alle möglichen k (1 … n−1) und die
 *     gewählte Metrik automatisch durch.
 *   - Zeigt die Genauigkeit je k als Balkendiagramm und als Tabelle; die
 *     besten k-Werte werden hervorgehoben.
 *   - Aufklappbare Detailmatrix (Punkt × k) mit ✓/✗; aus Gründen der
 *     Übersichtlichkeit für höchstens die ersten 20 k-Werte.
 *   Die Berechnung erfolgt bei jedem Aufruf der Seite bzw. bei jeder
 *   Datenänderung neu, sodass sie immer zum aktuellen Datensatz passt.
 *
 * Abhängigkeiten:
 *   dom-utils.js, dataset.js, knn.js, chart.js, pages/common.js
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const ds = ns.dataset;
  const knn = ns.knn;
  const common = ns.common;

  /** Höchstzahl der k-Spalten in der Detailmatrix. */
  const MATRIX_K_MAX = 20;

  let ui = null;
  let metricSelector = null;

  /**
   * Baut die Ergebnistabelle (k, korrekt/gesamt, Genauigkeit).
   * @param {Array<{k:number, correct:number, total:number, rate:number}>} accuracy - Genauigkeit je k.
   * @param {Set<number>} bestKs - Beste k-Werte.
   * @returns {HTMLElement} Tabelle (in Scroll-Container).
   */
  function buildAccuracyTable(accuracy, bestKs) {
    const tbody = dom.el('tbody');
    for (const a of accuracy) {
      tbody.appendChild(dom.el('tr', { class: bestKs.has(a.k) ? 'best' : null }, [
        dom.el('th', { scope: 'row' }, 'k = ' + a.k),
        dom.el('td', { class: 'num' }, a.correct + ' / ' + a.total),
        dom.el('td', { class: 'num' }, dom.formatPercent(a.rate) + (bestKs.has(a.k) ? ' ★' : ''))
      ]));
    }
    return dom.el('div', { class: 'table-wrap table-scroll' }, dom.el('table', { class: 'data-table' }, [
      dom.el('caption', null, 'Genauigkeit je k (★ = beste Genauigkeit)'),
      dom.el('thead', null, dom.el('tr', null, [
        dom.el('th', { scope: 'col' }, 'k'),
        dom.el('th', { scope: 'col' }, 'korrekt / gesamt'),
        dom.el('th', { scope: 'col' }, 'Genauigkeit')
      ])),
      tbody
    ]));
  }

  /**
   * Baut die Detailmatrix (Punkt × k).
   * @param {Array<{point:Object, results:Array}>} perPoint - Ergebnisse je Punkt.
   * @param {number} kCols - Anzahl der k-Spalten.
   * @returns {HTMLElement} Tabelle (in Scroll-Container).
   */
  function buildMatrix(perPoint, kCols) {
    const head = dom.el('tr', null, [dom.el('th', { scope: 'col' }, 'Datenpunkt')]);
    for (let k = 1; k <= kCols; k++) {
      head.appendChild(dom.el('th', { scope: 'col' }, String(k)));
    }
    const tbody = dom.el('tbody');
    for (const entry of perPoint) {
      const tr = dom.el('tr', null, [dom.el('th', { scope: 'row' }, [dom.describePoint(entry.point)])]);
      for (let k = 1; k <= kCols; k++) {
        const r = entry.results[k - 1];
        tr.appendChild(dom.el('td', {
          class: 'matrix-cell ' + (r.correct ? 'cell-ok' : 'cell-wrong'),
          title: r.correct ? 'korrekt' : 'falsch: ' + r.label
        }, r.correct ? '✓' : '✗'));
      }
      tbody.appendChild(tr);
    }
    return dom.el('div', { class: 'table-wrap table-scroll' }, dom.el('table', { class: 'data-table matrix' }, [
      dom.el('caption', null, 'Ergebnis je Punkt und k (✓ korrekt, ✗ falsch; Spalten = k)'),
      dom.el('thead', null, head),
      tbody
    ]));
  }

  /** Berechnet und zeichnet die Seite neu. */
  function render() {
    const points = ds.getPoints();
    dom.clear(ui.summary);
    dom.clear(ui.bars);
    dom.clear(ui.table);
    dom.clear(ui.matrix);
    if (points.length < 2) {
      common.showNotice(ui.notice, 'Für das Leave-One-Out-Verfahren werden mindestens 2 Trainingspunkte benötigt.', true);
      ui.results.hidden = true;
      return;
    }
    common.showNotice(ui.notice, null);
    ui.results.hidden = false;

    const kMax = points.length - 1;
    const result = knn.leaveOneOut(points, kMax, metricSelector.get());
    const bestCorrect = Math.max(...result.accuracy.map((a) => a.correct));
    const bestKs = new Set(result.accuracy.filter((a) => a.correct === bestCorrect).map((a) => a.k));

    ui.summary.appendChild(dom.el('p', null, 'Leave One Out mit ' + points.length + ' Datenpunkten für k = 1 … ' + kMax + '.'));
    ui.summary.appendChild(dom.el('p', { class: 'result-main' }, 'Beste Genauigkeit: ' +
      dom.formatPercent(bestCorrect / points.length) + ' bei k = ' + Array.from(bestKs).join(', ') + '.'));

    ns.chart.renderBarChart(ui.bars, result.accuracy, bestKs);
    ui.table.appendChild(buildAccuracyTable(result.accuracy, bestKs));
    const kCols = Math.min(kMax, MATRIX_K_MAX);
    ui.matrixInfo.textContent = kMax > MATRIX_K_MAX
      ? 'Aus Gründen der Übersichtlichkeit werden nur k = 1 … ' + MATRIX_K_MAX + ' gezeigt.'
      : '';
    ui.matrix.appendChild(buildMatrix(result.perPoint, kCols));
  }

  /** Initialisiert die Seite. */
  function init() {
    ui = {
      notice: dom.byId('notice-loo-auto'),
      results: dom.byId('loo6-results'),
      summary: dom.byId('loo6-summary'),
      bars: dom.byId('loo6-bars'),
      table: dom.byId('loo6-table'),
      matrix: dom.byId('loo6-matrix'),
      matrixInfo: dom.byId('loo6-matrix-info')
    };
    metricSelector = new common.MetricSelector(dom.byId('metric-loo-auto'), render);
  }

  /** Datenänderungen: Es ist kein Zustand anzupassen; render() rechnet neu. */
  function onDataChange() {}

  ns.pages = ns.pages || {};
  ns.pages['loo-auto'] = { id: 'loo-auto', init, render, onDataChange };
})(window.KNN = window.KNN || {});
