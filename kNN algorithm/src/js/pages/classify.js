/**
 * @file classify.js
 * @description Seite 2 "Klassifizierung neuer Datenpunkte".
 *
 * Funktionen der Seite:
 *   - Eingabe eines neuen Punkts (x, y) über Eingabefelder oder Klick ins Diagramm.
 *   - Einstellung von k (Zahlenfeld + Schieberegler, 1 … Anzahl Trainingspunkte).
 *   - Auswahl der Metrik (euklidisch / Manhattan).
 *   - Diagramm: neuer Punkt in Farbe/Form des berechneten Labels, Linien zu den
 *     k nächsten Nachbarn, Kreis bzw. Raute mit Radius = Abstand zum k-ten Nachbarn.
 *   - Ergebnis: berechnetes Label, Stimmenverteilung, Hinweis bei Gleichstand,
 *     Tabelle der Nachbarn mit Rechenweg für den Abstand.
 *
 * Abhängigkeiten:
 *   dom-utils.js, dataset.js, knn.js, chart.js, pages/common.js
 *
 * Sicherheitsaspekte:
 *   - Koordinaten werden über dataset.validateCoordinate geprüft.
 *   - Alle Ausgaben erfolgen als Text.
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const ds = ns.dataset;
  const knn = ns.knn;
  const common = ns.common;

  /** Seitenzustand (bleibt beim Seitenwechsel erhalten). */
  const state = {
    /** @type {{x:number, y:number}|null} Neuer Datenpunkt. */
    query: null
  };

  let ui = null;
  let chart = null;
  let metricSelector = null;
  let kControl = null;

  /**
   * Liest die Eingabefelder und aktualisiert den neuen Punkt.
   * Fehlermeldungen erscheinen unter den Feldern; bei Fehlern wird nicht klassifiziert.
   */
  function readQueryInputs() {
    const xText = ui.qx.value.trim();
    const yText = ui.qy.value.trim();
    if (xText === '' && yText === '') {
      state.query = null;
      ui.queryError.textContent = '';
      return;
    }
    const vx = ds.validateCoordinate(xText, 'x-Wert');
    const vy = ds.validateCoordinate(yText, 'y-Wert');
    if (!vx.ok || !vy.ok) {
      state.query = null;
      ui.queryError.textContent = (!vx.ok ? vx.error : vy.error);
      return;
    }
    ui.queryError.textContent = '';
    state.query = { x: vx.value, y: vy.value };
  }

  /**
   * Erzeugt den Rechenweg für den Abstand, z. B. "√(1² + 2²) = 2,236".
   * @param {{x:number, y:number}} a - Neuer Punkt.
   * @param {{x:number, y:number}} b - Nachbar.
   * @param {string} metric - Metrik.
   * @returns {string} Rechenweg.
   */
  function distanceFormula(a, b, metric) {
    const dx = dom.formatNumber(Math.abs(a.x - b.x));
    const dy = dom.formatNumber(Math.abs(a.y - b.y));
    const d = dom.formatNumber(knn.distance(a, b, metric));
    return metric === 'manhattan'
      ? dx + ' + ' + dy + ' = ' + d
      : '√(' + dx + '² + ' + dy + '²) = ' + d;
  }

  /**
   * Stellt das Ergebnis der Klassifizierung dar.
   * @param {Object} result - Ergebnis von knn.classify.
   * @param {Array} sorted - Alle Punkte nach Abstand sortiert (für den Grenzfall-Hinweis).
   * @param {string} metric - Metrik.
   */
  function renderResult(result, sorted, metric) {
    const box = dom.clear(ui.result);
    box.appendChild(dom.el('p', { class: 'result-main' }, ['Berechnetes Label: ', common.labelBadge(result.label)]));
    box.appendChild(dom.el('p', null, 'Stimmen unter den k = ' + result.k + ' nächsten Nachbarn: ' +
      result.counts.map((c) => c.label + ': ' + c.count).join(', ')));
    if (result.tie) {
      box.appendChild(dom.el('p', { class: 'hint-tie' }, 'Gleichstand zwischen ' + result.tiedLabels.join(', ') +
        '. Entschieden hat das Label des nächstgelegenen Nachbarn unter diesen Labels.'));
    }
    const next = sorted[result.k];
    if (next && result.k > 0 && next.distance === result.radius) {
      box.appendChild(dom.el('p', { class: 'hint-tie' }, 'Hinweis: Der ' + (result.k + 1) +
        '. Punkt hat denselben Abstand wie der ' + result.k + '. Nachbar. Bei gleichem Abstand zählt die Reihenfolge der Eingabe.'));
    }
    const tbody = dom.el('tbody');
    result.neighbors.forEach((n, i) => {
      tbody.appendChild(dom.el('tr', null, [
        dom.el('td', { class: 'num' }, String(i + 1)),
        dom.el('td', null, dom.describePoint(n.point)),
        dom.el('td', null, common.labelBadge(n.point.label)),
        dom.el('td', { class: 'num' }, distanceFormula(state.query, n.point, metric))
      ]));
    });
    box.appendChild(dom.el('div', { class: 'table-wrap' }, dom.el('table', { class: 'data-table' }, [
      dom.el('caption', null, 'Die k nächsten Nachbarn'),
      dom.el('thead', null, dom.el('tr', null, [
        dom.el('th', { scope: 'col' }, 'Rang'),
        dom.el('th', { scope: 'col' }, 'Datenpunkt'),
        dom.el('th', { scope: 'col' }, 'Label'),
        dom.el('th', { scope: 'col' }, 'Abstand (' + (metric === 'manhattan' ? '|Δx| + |Δy|' : '√(Δx² + Δy²)') + ')')
      ])),
      tbody
    ])));
  }

  /** Zeichnet die Seite neu. */
  function render() {
    const points = ds.getPoints();
    const metric = metricSelector.get();
    if (points.length === 0) {
      common.showNotice(ui.notice, 'Es sind noch keine Trainingsdaten vorhanden.', true);
      kControl.setMax(1);
      chart.render(Object.assign(common.baseView(), { query: state.query ? { x: state.query.x, y: state.query.y, label: null } : null }));
      dom.clear(ui.result);
      return;
    }
    const reduced = kControl.setMax(points.length);
    common.showNotice(ui.notice, reduced ? 'k wurde auf die Anzahl der Trainingspunkte (' + points.length + ') begrenzt.' : null);
    if (!state.query) {
      chart.render(common.baseView());
      dom.clear(ui.result).appendChild(dom.el('p', null, 'Geben Sie einen neuen Datenpunkt ein oder klicken Sie in das Diagramm.'));
      return;
    }
    const result = knn.classify(points, state.query, kControl.get(), metric);
    chart.render(Object.assign(common.baseView(), {
      query: { x: state.query.x, y: state.query.y, label: result.label },
      queryLegend: 'neuer Datenpunkt (Farbe/Form = berechnetes Label, gestrichelter Ring)',
      neighbors: result.neighbors,
      metric,
      radius: result.radius
    }));
    renderResult(result, knn.sortByDistance(points, state.query, metric), metric);
  }

  /** Initialisiert die Seite. */
  function init() {
    ui = {
      qx: dom.byId('q-x'),
      qy: dom.byId('q-y'),
      queryError: dom.byId('q-error'),
      result: dom.byId('classify-result'),
      notice: dom.byId('notice-classify')
    };
    chart = new ns.chart.ScatterChart(dom.byId('chart-classify'), {
      ariaLabel: 'Diagramm: Klassifizierung eines neuen Datenpunkts',
      onPlaneClick: (pos) => {
        ui.qx.value = dom.formatNumber(pos.x);
        ui.qy.value = dom.formatNumber(pos.y);
        readQueryInputs();
        render();
      }
    });
    kControl = new common.KControl(dom.byId('k-classify'), 'Anzahl der Nachbarn k', render, 3);
    metricSelector = new common.MetricSelector(dom.byId('metric-classify'), render);
    for (const input of [ui.qx, ui.qy]) {
      input.addEventListener('input', () => {
        readQueryInputs();
        render();
      });
    }
    dom.byId('query-form').addEventListener('submit', (event) => event.preventDefault());
  }

  /**
   * Datenänderungen: Neue Trainingsdaten (Datei, Beispieldaten) setzen den neuen Punkt
   * zurück – er gehört zu den alten Daten. Bei einzelnen Änderungen bleibt er erhalten;
   * render() berechnet neu. k und Metrik bleiben eingestellt.
   * @param {{type: string}} event - Änderung.
   */
  function onDataChange(event) {
    if (event && event.type === 'replace') {
      state.query = null;
      if (ui) {
        ui.qx.value = '';
        ui.qy.value = '';
        ui.queryError.textContent = '';
      }
    }
  }

  ns.pages = ns.pages || {};
  ns.pages.classify = { id: 'classify', init, render, onDataChange };
})(window.KNN = window.KNN || {});
