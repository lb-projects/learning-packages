/**
 * @file regression.js
 * @description Seite 9 "Regression".
 *
 * Funktionen der Seite:
 *   - Eingabe eines x-Werts über das Eingabefeld oder Klick ins Diagramm.
 *   - Einstellung von k (Zahlenfeld + Schieberegler, 1 … Anzahl Trainingspunkte).
 *   - Berechnung: Mittelwert oder gewichteter Mittelwert (Gewicht 1/|Δx|).
 *   - Diagramm mit getrennt skalierten Achsen (füllt die Fläche auch bei verschiedenen
 *     Größenordnungen von x und y); alle Trainingspunkte einheitlich (das Label spielt keine Rolle),
 *     Streifen x ± |Δx| des k-ten Nachbarn, Nachbarn mit Rangnummer,
 *     prognostizierter Punkt; optional die Regressionskurve.
 *   - Ergebnis: prognostizierter y-Wert, Rechenweg, Tabelle der Nachbarn.
 *
 * Abhängigkeiten:
 *   dom-utils.js, dataset.js, knn.js, chart.js, pages/common.js
 *
 * Sicherheitsaspekte:
 *   - Der x-Wert wird über dataset.validateCoordinate geprüft.
 *   - Alle Ausgaben erfolgen als Text.
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const ds = ns.dataset;
  const knn = ns.knn;
  const common = ns.common;

  /** Anzahl der Abschnitte, aus denen die Regressionskurve gezeichnet wird. */
  const CURVE_STEPS = 400;

  /** Seitenzustand (bleibt beim Seitenwechsel erhalten). */
  const state = {
    /** @type {number|null} x-Wert des neuen Datenpunkts. */
    x: null,
    /** Regressionskurve anzeigen. */
    showCurve: false
  };

  let ui = null;
  let chart = null;
  let kControl = null;
  let weightingSelector = null;

  /** Liest das Eingabefeld; Fehlermeldungen erscheinen darunter. */
  function readInput() {
    const text = ui.x.value.trim();
    if (text === '') {
      state.x = null;
      ui.error.textContent = '';
      return;
    }
    const v = ds.validateCoordinate(text, 'x-Wert');
    if (!v.ok) {
      state.x = null;
      ui.error.textContent = v.error;
      return;
    }
    ui.error.textContent = '';
    state.x = v.value;
  }

  /**
   * Erzeugt den Rechenweg für die Prognose.
   * @param {Object} result - Ergebnis von knn.regress.
   * @returns {string} Rechenweg, z. B. "(7 + 8 + 7) / 3 = 22 / 3 = 7,333".
   */
  function formula(result) {
    const f = dom.formatNumber;
    const ys = result.neighbors.map((n) => n.point.y);
    if (result.weighting === 'mean') {
      const sum = Math.round(ys.reduce((a, b) => a + b, 0) * 1e6) / 1e6;
      return '(' + ys.map(f).join(' + ') + ') / ' + result.k + ' = ' + f(sum) + ' / ' + result.k + ' = ' + f(result.y);
    }
    const used = result.neighbors.filter((n) => n.weight > 0);
    const sumW = used.reduce((a, n) => a + n.weight, 0);
    const sumWY = used.reduce((a, n) => a + n.weight * n.point.y, 0);
    return 'Σ(w · y) / Σw = ' + f(Math.round(sumWY * 1e6) / 1e6) + ' / ' + f(Math.round(sumW * 1e6) / 1e6) + ' = ' + f(result.y);
  }

  /**
   * Stellt das Ergebnis dar.
   * @param {Object} result - Ergebnis von knn.regress.
   * @param {Array} sorted - Alle Punkte nach |Δx| sortiert (für den Grenzfall-Hinweis).
   */
  function renderResult(result, sorted) {
    const box = dom.clear(ui.result);
    const weighted = result.weighting === 'weighted';
    box.appendChild(dom.el('p', { class: 'result-main' }, 'Prognostizierter y-Wert: ŷ = ' + dom.formatNumber(result.y)));
    box.appendChild(dom.el('p', null, (weighted ? 'Gewichteter Mittelwert der y-Werte der k = ' : 'Mittelwert der y-Werte der k = ') +
      result.k + ' nächsten Nachbarn: ' + formula(result)));
    if (weighted && result.neighbors.some((n) => n.distance === 0)) {
      box.appendChild(dom.el('p', { class: 'hint-tie' }, 'Hinweis: Mindestens ein Nachbar hat denselben x-Wert (|Δx| = 0). ' +
        'Dann zählen nur diese Nachbarn, jeweils mit gleichem Gewicht.'));
    }
    const next = sorted[result.k];
    if (next && result.k > 0 && next.distance === result.radius) {
      box.appendChild(dom.el('p', { class: 'hint-tie' }, 'Hinweis: Der ' + (result.k + 1) +
        '. Punkt hat denselben Abstand wie der ' + result.k + '. Nachbar. Bei gleichem Abstand zählt die Reihenfolge der Eingabe.'));
    }
    const tbody = dom.el('tbody');
    result.neighbors.forEach((n, i) => {
      const cells = [
        dom.el('td', { class: 'num' }, String(i + 1)),
        dom.el('td', null, '#' + n.point.id + ' (' + dom.formatNumber(n.point.x) + ' | ' + dom.formatNumber(n.point.y) + ')'),
        dom.el('td', { class: 'num' }, dom.formatNumber(n.distance)),
        dom.el('td', { class: 'num' }, dom.formatNumber(n.point.y))
      ];
      if (weighted) {
        cells.push(dom.el('td', { class: 'num' }, n.distance === 0 || n.weight === 0
          ? dom.formatNumber(n.weight)
          : '1 / ' + dom.formatNumber(n.distance) + ' = ' + dom.formatNumber(Math.round(n.weight * 1000) / 1000)));
      }
      tbody.appendChild(dom.el('tr', null, cells));
    });
    const head = [
      dom.el('th', { scope: 'col' }, 'Rang'),
      dom.el('th', { scope: 'col' }, 'Datenpunkt'),
      dom.el('th', { scope: 'col' }, 'Abstand |Δx|'),
      dom.el('th', { scope: 'col' }, 'y-Wert')
    ];
    if (weighted) {
      head.push(dom.el('th', { scope: 'col' }, 'Gewicht w'));
    }
    box.appendChild(dom.el('div', { class: 'table-wrap' }, dom.el('table', { class: 'data-table' }, [
      dom.el('caption', null, 'Die k nächsten Nachbarn (nach Abstand in x-Richtung)'),
      dom.el('thead', null, dom.el('tr', null, head)),
      tbody
    ])));
  }

  /** Zeichnet die Seite neu. */
  function render() {
    const points = ds.getPoints();
    const base = Object.assign(common.baseView(), { uniform: true, fit: true });
    if (points.length === 0) {
      common.showNotice(ui.notice, 'Es sind noch keine Trainingsdaten vorhanden.', true);
      kControl.setMax(1);
      chart.render(Object.assign(base, { band: state.x !== null ? { x: state.x, radius: 0 } : null }));
      dom.clear(ui.result);
      return;
    }
    const reduced = kControl.setMax(points.length);
    common.showNotice(ui.notice, reduced ? 'k wurde auf die Anzahl der Trainingspunkte (' + points.length + ') begrenzt.' : null);
    const k = kControl.get();
    const weighting = weightingSelector.get();
    const result = state.x !== null ? knn.regress(points, state.x, k, weighting) : null;
    const prediction = result ? { x: state.x, y: result.y } : null;
    let curve = null;
    if (state.showCurve) {
      const b = ns.chart.computeFitBounds(prediction ? points.concat([prediction]) : points);
      curve = knn.regressionCurve(points, k, weighting, b.xMin, b.xMax, CURVE_STEPS);
    }
    if (!result) {
      chart.render(Object.assign(base, { curve }));
      dom.clear(ui.result).appendChild(dom.el('p', null, 'Geben Sie einen x-Wert ein oder klicken Sie in das Diagramm.'));
      return;
    }
    chart.render(Object.assign(base, {
      prediction,
      neighbors: result.neighbors,
      band: { x: state.x, radius: result.radius },
      curve
    }));
    renderResult(result, knn.sortByX(points, state.x));
  }

  /** Initialisiert die Seite. */
  function init() {
    ui = {
      x: dom.byId('r-x'),
      error: dom.byId('r-error'),
      result: dom.byId('regression-result'),
      notice: dom.byId('notice-regression'),
      curve: dom.byId('r-curve')
    };
    chart = new ns.chart.ScatterChart(dom.byId('chart-regression'), {
      ariaLabel: 'Diagramm: Regression – Prognose des y-Werts aus den k nächsten Nachbarn',
      onPlaneClick: (pos) => {
        ui.x.value = dom.formatNumber(pos.x);
        readInput();
        render();
      }
    });
    kControl = new common.KControl(dom.byId('k-regression'), 'Anzahl der Nachbarn k', render, 3);
    weightingSelector = new common.ChoiceSelector(dom.byId('weighting-regression'), 'Berechnung',
      Object.values(knn.WEIGHTINGS), 'mean', render);
    ui.x.addEventListener('input', () => {
      readInput();
      render();
    });
    ui.curve.checked = state.showCurve;
    ui.curve.addEventListener('change', () => {
      state.showCurve = ui.curve.checked;
      render();
    });
    dom.byId('regression-form').addEventListener('submit', (event) => event.preventDefault());
  }

  /**
   * Datenänderungen: Neue Trainingsdaten (Datei, Beispieldaten) setzen den neuen Punkt
   * zurück – er gehört zu den alten Daten. Bei einzelnen Änderungen bleibt er erhalten;
   * render() berechnet neu. k, Berechnung und Kurve bleiben eingestellt.
   * @param {{type: string}} event - Änderung.
   */
  function onDataChange(event) {
    if (event && event.type === 'replace') {
      state.x = null;
      if (ui) {
        ui.x.value = '';
        ui.error.textContent = '';
      }
    }
  }

  ns.pages = ns.pages || {};
  ns.pages.regression = { id: 'regression', init, render, onDataChange };
})(window.KNN = window.KNN || {});
