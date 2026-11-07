/**
 * @file pages/silhouette.js
 * @description Seite 6: Silhouetten-Analyse.
 *
 * Die Seite übernimmt nur die Daten (mit Skalierung) von Seite 1, hat ein eigenes k und ist vom
 * Training und von der Ellbogen-Analyse unabhängig. Jeder Klick auf „Silhouetten-Analyse durchführen“
 * startet mit neuen zufälligen Zentren, rein zufällig oder mit k-means++. Die Auswertung rechnet je k
 * einen Lauf; das gewählte k nutzt den angezeigten.
 *
 * Punkt auswählen:
 *   Ein Klick auf eine Säule oder die Auswahlliste markiert den Punkt im Diagramm und in der Zeichnung
 *   und zeigt die Rechnung mit a, b und s. Die Auswahlliste macht das auch ohne Maus möglich.
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
  /** Die Auswertung prüft k = 2 bis zu diesem Wert und zusätzlich das gewählte k. */
  const EVALUATION_MAX = 10;
  /** Mehr Beschriftungen passen nicht unter die Achse. */
  const MAX_AXIS_LABELS = 20;
  /** Breite der Zeichenfläche in Einheiten der Zeichnung, ungefähr. */
  const CHART_WIDTH = 558;
  /** Ab dieser Säulenbreite trägt jede Säule einen weißen Rand; schmalere würde er verdecken. */
  const MIN_EDGED_WIDTH = 3;

  let chart = null;
  let plot = null;
  /** Ergebnis des letzten Klicks: {version, k, run, sil, table} oder null. */
  let result = null;
  let chosen = null;
  /** Gewählter Punkt oder null. */
  let selected = null;
  /** Säulen der aktuellen Zeichnung: {x, point}. */
  let bars = [];

  /** @returns {number} Größtes k der Analyse. */
  function maxK() {
    return ns.kmeansAnalysis.maxSilhouetteK(session.data.count(), session.maxK());
  }

  /** Füllt die Auswahl von k. */
  function renderSelect() {
    const select = dom.byId('sil-k');
    const max = maxK();
    dom.clear(select);
    for (let k = 2; k <= max; k++) {
      select.appendChild(dom.el('option', { value: String(k) }, String(k)));
    }
    select.disabled = max < 2;
    if (max >= 2) {
      chosen = Math.min(chosen === null ? 3 : chosen, max);
      select.value = String(chosen);
    }
  }

  /** Zeichnet das Silhouetten-Diagramm: je Punkt ein Balken, nach Cluster gruppiert und absteigend sortiert. */
  function renderChart() {
    const box = dom.byId('sil-chart-box');
    box.hidden = !result;
    if (!result) {
      dom.byId('sil-mean').textContent = '–';
      dom.clear(dom.byId('sil-clusters'));
      return;
    }
    const names = session.names();
    const n = names.length;
    const gap = Math.max(2, n * 0.02);
    const regions = [];
    const ticks = [];
    let x = 0;
    let selectedRegion = null;
    bars = [];
    const used = result.sil.perCluster.filter((c) => c.count > 0);
    const labelEvery = Math.ceil(used.length / MAX_AXIS_LABELS);
    used.forEach((c, position) => {
      const members = [];
      result.run.assignment.forEach((a, i) => {
        if (a === c.cluster) {
          members.push(i);
        }
      });
      members.sort((p, q) => result.sil.values[q] - result.sil.values[p]);
      const start = x;
      for (const i of members) {
        const s = result.sil.values[i];
        const region = {
          polygon: [[x, 0], [x + 1, 0], [x + 1, s], [x, s]],
          cls: 'sil-bar ' + view.clusterClass(c.cluster),
          title: names[i] + ', Cluster ' + (c.cluster + 1) + ': s = ' + num(s)
        };
        if (i === selected) {
          selectedRegion = region;
        } else {
          regions.push(region);
        }
        bars.push({ x, point: i });
        x++;
      }
      if (position % labelEvery === 0) {
        ticks.push({ x: (start + x) / 2, text: 'C' + (c.cluster + 1) });
      }
      x += gap;
    });
    const end = x - gap;
    if (CHART_WIDTH / Math.max(end, 1) >= MIN_EDGED_WIDTH) {
      regions.forEach((region) => { region.cls += ' sil-edged'; });
    }
    if (selectedRegion) {
      selectedRegion.cls += ' sil-selected';
      regions.push(selectedRegion);
    }
    const mean = result.sil.mean;
    chart.render({
      view: { xmin: 0, xmax: Math.max(end, 1), ymin: -1, ymax: 1 },
      xLabel: 'Punkte, nach Cluster gruppiert',
      yLabel: 'Silhouettenwert',
      xTicks: ticks,
      regions,
      lines: mean === null ? [] : [{ x1: 0, y1: mean, x2: Math.max(end, 1), y2: mean, cls: 'curve-goal' }],
      labels: (mean === null ? [] : [{ x: Math.max(end, 1) * 0.99, y: mean + 0.03, text: 'Mittelwert ' + num(mean), anchor: 'end', cls: 'label-strong' }]).concat(selectedLabel(end))
    });
    dom.byId('sil-mean').textContent = mean === null ? 'nicht definiert' : num(mean);
    const tbody = dom.byId('sil-clusters');
    dom.clear(tbody);
    for (const c of result.sil.perCluster) {
      tbody.appendChild(dom.el('tr', null, [
        dom.el('td', null, [dom.el('span', { class: 'swatch cl-swatch ' + view.clusterClass(c.cluster) }), String(c.cluster + 1)]),
        dom.el('td', { class: 'num' }, c.count === 0 ? 'leer' : c.count),
        dom.el('td', { class: 'num' }, c.mean === null ? '–' : num(c.mean))
      ]));
    }
  }

  /**
   * Beschriftet die gewählte Säule, weil Säulen mit Werten nahe 0 kaum zu sehen sind.
   * @param {number} end - Rechtes Ende der Säulen.
   * @returns {Array<Object>} Beschriftung oder nichts.
   */
  function selectedLabel(end) {
    const bar = bars.find((b) => b.point === selected);
    if (!bar) {
      return [];
    }
    const s = result.sil.values[selected];
    const name = session.names()[selected];
    const onRight = bar.x > end / 2;
    return [{
      x: bar.x + 0.5,
      y: s >= 0 ? -0.1 : 0.05,
      text: onRight ? name + ' ▲' : '▲ ' + name,
      anchor: onRight ? 'end' : 'start',
      cls: 'label-strong sil-point-label'
    }];
  }

  /** Füllt die Auswahlliste der Punkte. */
  function renderPointSelect() {
    const select = dom.byId('sil-point');
    dom.clear(select);
    select.appendChild(dom.el('option', { value: '' }, '– Punkt wählen –'));
    if (!result) {
      return;
    }
    session.names().forEach((name, i) => {
      select.appendChild(dom.el('option', { value: String(i) }, name + ' (Cluster ' + (result.run.assignment[i] + 1) + ')'));
    });
    select.value = selected === null ? '' : String(selected);
  }

  /** Zeigt die Rechnung zum gewählten Punkt. */
  function renderPointCard() {
    dom.byId('sil-point-card').hidden = !result;
    const box = dom.clear(dom.byId('sil-point-calc'));
    if (!result || selected === null) {
      return;
    }
    const r = ns.kmeansAnalysis.silhouetteOf(session.coords(), result.run.assignment, result.k, selected);
    const own = 'Cluster ' + (r.own + 1);
    box.appendChild(dom.el('p', { class: 'result-title', id: 'sil-point-name' }, session.names()[selected] + ', ' + own));
    if (r.single) {
      box.appendChild(dom.el('p', { id: 'sil-point-text' }, 's = 0: ' + own + ' enthält nur diesen Punkt, dafür ist der Wert festgelegt.'));
      return;
    }
    if (r.a === null) {
      box.appendChild(dom.el('p', { id: 'sil-point-text' }, 'Es gibt keinen anderen belegten Cluster, deshalb ist der Wert nicht definiert.'));
      return;
    }
    const others = result.run.assignment.filter((c) => c === r.own).length - 1;
    dom.appendChildren(box, [
      dom.el('p', { id: 'sil-point-a' }, 'a = ' + num(r.a) + ' (mittlerer Abstand zu ' + (others === 1 ? 'dem anderen Punkt' : 'den ' + others + ' anderen Punkten') + ' von ' + own + ')'),
      dom.el('p', { id: 'sil-point-b' }, 'b = ' + num(r.b) + ' (mittlerer Abstand zu den Punkten von Cluster ' + (r.nearest + 1) + ', dem nächsten fremden Cluster)'),
      dom.el('p', { id: 'sil-point-s' }, 's = (b − a) / max(a; b) = (' + num(r.b) + ' − ' + num(r.a) + ') / ' + num(Math.max(r.a, r.b)) + ' = ' + num(r.s)),
      r.s < 0 ? dom.el('p', { class: 'hint', id: 'sil-point-note' }, 'Der Wert ist negativ: Im Mittel liegt der Punkt näher an Cluster ' + (r.nearest + 1) + ' als an seinem eigenen.') : null
    ]);
  }

  /**
   * Wählt einen Punkt aus.
   * @param {number|null} point - Punkt oder null.
   */
  function selectPoint(point) {
    selected = point;
    if (point !== null) {
      dom.byId('sil-details').open = true;
    }
    dom.byId('sil-point').value = point === null ? '' : String(point);
    renderChart();
    renderClusters();
    renderPointCard();
  }

  /**
   * Verarbeitet einen Klick ins Diagramm: Lücken zwischen den Clustern bewirken nichts.
   * @param {number} x - x-Wert.
   */
  function handleChartClick(x) {
    const bar = bars.find((b) => x >= b.x && x < b.x + 1);
    if (bar) {
      selectPoint(bar.point);
    }
  }

  /** Zeichnet den aufklappbaren Teil mit den Clustern. */
  function renderClusters() {
    dom.byId('sil-detail-empty').hidden = Boolean(result);
    dom.byId('sil-detail').hidden = !result;
    if (!result) {
      return;
    }
    const coords = session.coords();
    const v = session.view();
    const labels = session.axisLabels();
    const marks = view.pointMarks(coords, session.names(), result.run.assignment);
    if (selected !== null) {
      marks[selected].ring = 'current';
    }
    plot.render({
      view: v,
      xLabel: labels.x,
      yLabel: labels.y,
      points: marks.concat(view.centerMarks(result.run.centers))
    });
    view.renderCenterTable(dom.byId('sil-centers-head'), dom.byId('sil-centers-body'), result.run.centers, coords, result.run.assignment);
    view.renderObjects(dom.byId('sil-objects'), session.names(), result.run.assignment, result.k);
  }

  /** Zeichnet die rechnerische Auswertung. */
  function renderEvaluation() {
    dom.byId('sil-eval-empty').hidden = Boolean(result);
    dom.byId('sil-eval').hidden = !result;
    if (!result) {
      return;
    }
    const { rows, bestK } = result.table;
    const tbody = dom.byId('sil-eval-body');
    dom.clear(tbody);
    for (const row of rows) {
      tbody.appendChild(dom.el('tr', { class: row.k === bestK ? 'is-current' : null }, [
        dom.el('td', { class: 'num' }, row.k),
        dom.el('td', { class: 'num' }, row.mean === null ? 'nicht definiert' : num(row.mean)),
        dom.el('td', null, (row.k === bestK ? 'höchster Wert' : '') + (row.k === bestK && row.k === result.k ? ', ' : '') + (row.k === result.k ? 'oben gezeigt' : ''))
      ]));
    }
    const best = rows.find((r) => r.k === bestK);
    dom.byId('sil-best').textContent = best ? 'Nach dieser Rechnung wäre k = ' + bestK + ' am besten (mittlerer Silhouettenwert ' + num(best.mean) + ').' : 'Für diese Daten lässt sich kein bestes k bestimmen.';
  }

  /** Zeichnet die Seite. */
  function render() {
    if (result && result.version !== session.version()) {
      result = null;
      selected = null;
      dom.byId('sil-stale').hidden = false;
    }
    renderSelect();
    const possible = maxK() >= 2;
    dom.byId('sil-empty').hidden = possible;
    dom.byId('sil-run').disabled = !possible;
    renderChart();
    renderClusters();
    renderEvaluation();
    renderPointSelect();
    renderPointCard();
  }

  /** Führt die Analyse aus. */
  function run() {
    const k = Number(dom.byId('sil-k').value);
    const coords = session.coords();
    const analysis = ns.kmeansAnalysis;
    const options = { method: dom.byId('sil-start').value };
    const main = analysis.randomRun(coords, k, options);
    const sil = analysis.silhouette(coords, main.assignment, k);
    const kValues = [];
    for (let v = 2; v <= Math.min(EVALUATION_MAX, maxK()); v++) {
      kValues.push(v);
    }
    if (!kValues.includes(k)) {
      kValues.push(k);
    }
    result = { version: session.version(), k, run: main, sil, table: analysis.evaluate(coords, kValues, { [k]: { mean: sil.mean } }, options) };
    selected = null;
    dom.byId('sil-stale').hidden = true;
    render();
  }

  /** Richtet die Seite ein. */
  function init() {
    chart = ns.coordPlot.create(dom.byId('sil-chart'), { ariaLabel: 'Silhouetten-Diagramm: je Punkt eine Säule mit seinem Silhouettenwert von −1 bis 1. Ein Klick wählt den Punkt aus.', onClick: handleChartClick });
    plot = ns.coordPlot.create(dom.byId('sil-plot'), { ariaLabel: 'Koordinatensystem mit den Clustern und Zentren der Silhouetten-Analyse' });
    dom.byId('sil-run').addEventListener('click', run);
    dom.byId('sil-k').addEventListener('change', (event) => { chosen = Number(event.target.value); });
    dom.byId('sil-point').addEventListener('change', (event) => {
      selectPoint(event.target.value === '' ? null : Number(event.target.value));
    });
  }

  ns.pages.silhouette = { init, render, result: () => result, selected: () => selected };
})(window.CC = window.CC || {});
