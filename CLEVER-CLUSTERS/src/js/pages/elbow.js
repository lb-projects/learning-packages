/**
 * @file pages/elbow.js
 * @description Seite 5: Ellbogen-Analyse.
 *
 * Die Seite übernimmt nur die Daten (mit Skalierung) von Seite 1 und ist vom Training und von der
 * Silhouetten-Analyse unabhängig. Jeder Klick auf „Ellbogen-Analyse durchführen“ rechnet für jedes k einen Lauf mit neuen
 * zufälligen Zentren, rein zufällig oder mit k-means++; der Schieberegler zeigt nur die Läufe dieses Klicks.
 *
 * Abhängigkeiten:
 *   dom-utils.js, sim-format.js, coord-plot.js, kmeans-analysis.js, cluster-view.js, session.js
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const session = ns.session;
  const view = ns.clusterView;
  const { num } = ns.simFormat;
  /** Standard für das größte k. */
  const STANDARD_MAX = 10;

  let chart = null;
  let plot = null;
  /** Ergebnis des letzten Klicks: {version, runs, knee} oder null. */
  let result = null;
  let sliderK = 1;

  /** @returns {number} Das größte k der nächsten Analyse. */
  function plannedMax() {
    const standard = Math.min(STANDARD_MAX, session.maxK());
    if (dom.byId('elbow-higher').checked && session.maxK() > STANDARD_MAX) {
      return Number(dom.byId('elbow-max').value) || standard;
    }
    return standard;
  }

  /** Füllt die Auswahl des höheren k. */
  function renderMaxSelect() {
    const max = session.maxK();
    const row = dom.byId('elbow-higher-row');
    row.hidden = max <= STANDARD_MAX;
    const select = dom.byId('elbow-max');
    const old = Number(select.value) || Math.min(20, max);
    dom.clear(select);
    for (let k = STANDARD_MAX + 1; k <= max; k++) {
      select.appendChild(dom.el('option', { value: String(k) }, String(k)));
    }
    select.value = String(Math.min(old, Math.max(max, STANDARD_MAX + 1)));
    select.disabled = !dom.byId('elbow-higher').checked;
  }

  /** Zeichnet die Kurve. */
  function renderChart() {
    const box = dom.byId('elbow-chart-box');
    box.hidden = !result;
    if (!result) {
      return;
    }
    const runs = result.runs;
    const kMax = runs.length;
    const lines = [];
    for (let i = 1; i < kMax; i++) {
      lines.push({ x1: i, y1: runs[i - 1].wcss, x2: i + 1, y2: runs[i].wcss, cls: 'curve-line' });
    }
    const showKnee = dom.byId('elbow-knee').checked && result.knee !== null;
    const yEnd = Math.max(...runs.map((r) => r.wcss));
    const v = ns.coordPlot.fitView([{ x: 0, y: 0 }, { x: kMax, y: yEnd }]);
    const kneeRun = showKnee ? runs[result.knee - 1] : null;
    chart.render({
      view: v,
      xLabel: 'Anzahl der Cluster k',
      yLabel: 'WCSS',
      xTicks: view.integerTicks(kMax),
      lines,
      points: runs.map((r) => ({
        x: r.k, y: r.wcss, shape: 'circle', r: 5, cls: 'pt-curve',
        ring: showKnee && r.k === result.knee ? 'current' : dom.byId('elbow-details').open && r.k === sliderK ? 'new' : undefined,
        title: 'k = ' + r.k + ': WCSS = ' + num(r.wcss)
      })),
      labels: kneeRun ? [{ x: kneeRun.k + (v.xmax - v.xmin) * 0.03, y: kneeRun.wcss + (v.ymax - v.ymin) * 0.05, text: 'Knick bei k = ' + kneeRun.k, cls: 'label-strong' }] : []
    });
    const kneeNote = dom.byId('elbow-knee-text');
    kneeNote.hidden = !dom.byId('elbow-knee').checked;
    kneeNote.textContent = result.knee === null
      ? 'Bei diesen Werten lässt sich kein Knick bestimmen.'
      : 'Der Knick liegt bei k = ' + result.knee + '. Berechnet als größter Abstand unter der Verbindungslinie vom ersten zum letzten Punkt, mit beiden Achsen auf 0 bis 1 normiert.';
    const rising = runs.some((r, i) => i > 0 && r.wcss > runs[i - 1].wcss + 1e-9);
    dom.byId('elbow-rising').hidden = !rising;
  }

  /** Zeichnet den Lauf zum Schieberegler. */
  function renderDetail() {
    const slider = dom.byId('elbow-slider');
    slider.disabled = !result;
    dom.byId('elbow-detail-empty').hidden = Boolean(result);
    dom.byId('elbow-detail').hidden = !result;
    if (!result) {
      return;
    }
    slider.max = String(result.runs.length);
    slider.value = String(sliderK);
    dom.byId('elbow-slider-value').textContent = String(sliderK);
    const run = result.runs[sliderK - 1];
    const coords = session.coords();
    const v = session.view();
    const labels = session.axisLabels();
    plot.render({
      view: v,
      xLabel: labels.x,
      yLabel: labels.y,
      lines: view.distanceLines(coords, run.centers, run.assignment),
      points: view.pointMarks(coords, session.names(), run.assignment).concat(view.centerMarks(run.centers))
    });
    dom.byId('elbow-wcss').textContent = num(run.wcss);
    dom.byId('elbow-iterations').textContent = String(run.iterations);
    view.renderCenterTable(dom.byId('elbow-centers-head'), dom.byId('elbow-centers-body'), run.centers, coords, run.assignment);
    view.renderObjects(dom.byId('elbow-objects'), session.names(), run.assignment, run.k);
  }

  /** Zeichnet die Seite. */
  function render() {
    if (result && result.version !== session.version()) {
      result = null;
      dom.byId('elbow-stale').hidden = false;
    }
    const possible = session.maxK() > 0;
    dom.byId('elbow-empty').hidden = possible;
    dom.byId('elbow-run').disabled = !possible;
    renderMaxSelect();
    dom.byId('elbow-plan').textContent = possible ? 'Die Analyse rechnet k = 1 bis ' + plannedMax() + ' mit ' + (dom.byId('elbow-start').value === 'plusplus' ? 'k-means++' : 'zufälligen Startzentren') + '.' : '';
    renderChart();
    renderDetail();
  }

  /** Führt die Analyse aus. */
  function run() {
    const kMax = plannedMax();
    const runs = ns.kmeansAnalysis.elbow(session.coords(), kMax, { method: dom.byId('elbow-start').value });
    result = { version: session.version(), runs, knee: ns.kmeansAnalysis.knee(runs.map((r) => r.wcss)) };
    sliderK = Math.min(sliderK, kMax);
    dom.byId('elbow-stale').hidden = true;
    render();
  }

  /** Richtet die Seite ein. */
  function init() {
    chart = ns.coordPlot.create(dom.byId('elbow-chart'), { ariaLabel: 'Ellbogen-Kurve: WCSS je Anzahl der Cluster k' });
    plot = ns.coordPlot.create(dom.byId('elbow-plot'), { ariaLabel: 'Koordinatensystem mit den Clustern des gewählten k und den Abständen der Punkte zu ihrem Zentrum' });
    dom.byId('elbow-run').addEventListener('click', run);
    dom.byId('elbow-higher').addEventListener('change', render);
    dom.byId('elbow-max').addEventListener('change', render);
    dom.byId('elbow-start').addEventListener('change', render);
    dom.byId('elbow-knee').addEventListener('change', renderChart);
    dom.byId('elbow-details').addEventListener('toggle', renderChart);
    dom.byId('elbow-slider').addEventListener('input', (event) => {
      sliderK = Number(event.target.value);
      renderDetail();
      renderChart();
    });
  }

  ns.pages.elbow = { init, render, result: () => result };
})(window.CC = window.CC || {});
