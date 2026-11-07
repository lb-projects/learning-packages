/**
 * @file pages/apply.js
 * @description Seite 8 „Anwenden“: neue Punkte einordnen, Ausreißer erkennen, Standorte planen.
 *
 * Die Seite übernimmt die Daten (mit Skalierung) von Seite 1 und hat ein eigenes k. Oben entsteht ein Lauf,
 * alle drei Anwendungen bauen auf ihm auf. Der Umschalter wählt die Anwendung; die Zeichnung bleibt dieselbe und
 * zeigt nur, was zur Anwendung gehört. Ändern sich die Daten, verfallen Lauf, neue Punkte und Kostenkurve.
 *
 * Abhängigkeiten:
 *   dom-utils.js, sim-format.js, coord-plot.js, cluster-data.js, kmeans-analysis.js, kmeans-apply.js,
 *   cluster-view.js, session.js
 *
 * Sicherheitsaspekte:
 *   Bezeichner werden bereinigt und nur als Text eingefügt.
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const session = ns.session;
  const view = ns.clusterView;
  const apply = ns.kmeansApply;
  const { num, plural } = ns.simFormat;
  /** Größtes k der Kostenkurve. */
  const COST_MAX_K = 10;
  /** Höchstzahl der neuen Punkte in der Liste. */
  const MAX_NEW_POINTS = 50;
  const MODES = ['classify', 'outliers', 'sites'];
  /** Größe der Rauten für neue Punkte. */
  const NEW_POINT_RADIUS = 7;

  let plot = null;
  let chart = null;
  let version = session.version();
  let chosen = session.DEFAULT_K;
  let mode = 'classify';
  /** Aktueller Lauf: {k, run} oder null. */
  let current = null;
  /** Neue Punkte in Originaleinheiten: {name, x, y}. */
  let newPoints = [];
  /** Nummer des neuen Punkts, dessen Rechnung zu sehen ist, oder null. */
  let selectedNew = null;
  /** Kostenkurve: Summe der Wege je k, oder null. */
  let curve = null;

  /** @returns {number[]} Koordinaten eines neuen Punkts für die Zeichnung. */
  const modelOf = (p) => session.toModel([p.x, p.y]);

  /** @returns {{site:number, unit:number}|null} Kosten aus den Eingabefeldern; null, wenn sie ungültig sind. */
  function costs() {
    const read = (id) => {
      const value = ns.pointData.parseNumber(dom.byId(id).value);
      return value !== null && value >= 0 && value <= 1000000 ? value : null;
    };
    const site = read('app-cost-site');
    const unit = read('app-cost-unit');
    return site === null || unit === null ? null : { site, unit };
  }

  /** @returns {Array<Object>} Marken der neuen Punkte. */
  function newMarks() {
    return newPoints.map((p, i) => {
      const at = modelOf(p);
      const r = apply.classify(at, current.run.centers);
      return {
        x: at[0], y: at[1], shape: 'diamond', r: NEW_POINT_RADIUS,
        cls: 'pt-new ' + view.clusterClass(r.cluster),
        ring: i === selectedNew ? 'current' : undefined,
        title: p.name + ': Cluster ' + (r.cluster + 1) + ', Abstand ' + num(r.distance)
      };
    });
  }

  /** @returns {Array<Object>} Linien der neuen Punkte zu ihrem Zentrum. */
  function newLines() {
    return newPoints.map((p) => {
      const at = modelOf(p);
      const center = current.run.centers[apply.classify(at, current.run.centers).cluster];
      return { x1: at[0], y1: at[1], x2: center[0], y2: center[1], cls: 'new-line' };
    });
  }

  /** Zeichnet die Zeichnung passend zur Anwendung. */
  function renderPlot() {
    const coords = session.coords();
    const labels = session.axisLabels();
    const names = session.names();
    const extra = mode === 'classify' ? newPoints.map(modelOf) : [];
    const v = session.view(extra);
    const spec = { view: v, xLabel: labels.x, yLabel: labels.y, regions: [], lines: [] };
    dom.byId('app-plot').classList.toggle('is-passive', mode !== 'classify');
    if (!current) {
      plot.render({ ...spec, points: view.pointMarks(coords, names, null) });
      return;
    }
    const { run } = current;
    const marks = view.pointMarks(coords, names, run.assignment);
    let added = [];
    if (dom.byId('app-areas').checked) {
      spec.regions = view.areaRegions(run.centers, v);
    }
    if (mode === 'classify') {
      spec.lines = newLines();
      added = newMarks();
    } else if (mode === 'outliers') {
      for (const row of apply.outliers(coords, run.centers, run.assignment, threshold()).rows) {
        marks[row.index].ring = 'wrong';
        marks[row.index].title += ', auffällig: ' + num(row.multiple) + '-facher mittlerer Abstand';
      }
    } else {
      const routes = apply.routes(coords, run.centers, run.assignment);
      spec.lines = view.distanceLines(coords, run.centers, run.assignment);
      for (const row of routes.rows) {
        if (row.longestIndex !== null) {
          const from = coords[row.longestIndex];
          const to = run.centers[row.cluster];
          spec.lines.push({ x1: from[0], y1: from[1], x2: to[0], y2: to[1], cls: 'route-longest ' + view.clusterClass(row.cluster) });
        }
      }
    }
    plot.render({ ...spec, points: marks.concat(view.centerMarks(run.centers), added) });
  }

  /** Zeigt die Rechnung zum gewählten neuen Punkt. */
  function renderNewCalc() {
    const box = dom.clear(dom.byId('app-new-calc'));
    if (!current || selectedNew === null) {
      return;
    }
    const p = newPoints[selectedNew];
    const at = modelOf(p);
    const r = apply.classify(at, current.run.centers);
    box.appendChild(dom.el('p', { class: 'result-title', id: 'app-new-title' }, p.name + ' gehört zu Cluster ' + (r.cluster + 1) + '.'));
    const scaler = session.scaler();
    if (scaler && scaler.ranges) {
      const step = (value, range, scaled, name) => name + ' = (' + num(value) + ' − ' + num(range.min) + ') / (' + num(range.max) + ' − ' + num(range.min) + ') = ' + num(scaled);
      const span = (range) => range.max > range.min;
      box.appendChild(dom.el('p', { id: 'app-new-scaled' }, 'Skaliert: '
        + (span(scaler.ranges.x) ? step(p.x, scaler.ranges.x, at[0], 'x₁') : 'x₁ = 0')
        + '; ' + (span(scaler.ranges.y) ? step(p.y, scaler.ranges.y, at[1], 'x₂') : 'x₂ = 0')));
      if (at.some((v) => v < 0 || v > 1)) {
        box.appendChild(dom.el('p', { class: 'hint', id: 'app-new-outside' }, 'Der Punkt liegt außerhalb der Daten, deshalb liegt ein Wert außerhalb von 0 bis 1.'));
      }
    }
    box.appendChild(dom.el('div', { class: 'table-scroll table-scroll-limited' }, dom.el('table', { class: 'data-table', id: 'app-new-distances' }, [
      dom.el('thead', null, dom.el('tr', null, [dom.el('th', { scope: 'col' }, 'Zentrum'), dom.el('th', { scope: 'col', class: 'num' }, 'Abstand')])),
      dom.el('tbody', null, r.distances.map((d, c) => dom.el('tr', { class: c === r.cluster ? 'is-current' : null }, [
        dom.el('td', null, [dom.el('span', { class: 'swatch cl-swatch ' + view.clusterClass(c) }), String(c + 1)]),
        dom.el('td', { class: 'num' }, num(d))
      ])))
    ])));
  }

  /** Zeichnet die Liste der neuen Punkte. */
  function renderNewList() {
    dom.byId('app-new-card').hidden = newPoints.length === 0;
    const attrs = session.data.attributes();
    const head = dom.clear(dom.byId('app-new-head'));
    dom.appendChildren(head, ['Bezeichner', attrs.x, attrs.y, 'Cluster', 'Abstand'].map((text, i) => dom.el('th', { scope: 'col', class: i >= 1 ? 'num' : null }, text)));
    const body = dom.clear(dom.byId('app-new-body'));
    newPoints.forEach((p, i) => {
      const r = current ? apply.classify(modelOf(p), current.run.centers) : null;
      const button = dom.el('button', { type: 'button', class: 'btn btn-small', title: 'Rechnung zeigen', 'aria-pressed': i === selectedNew ? 'true' : 'false' }, p.name);
      button.addEventListener('click', () => {
        selectedNew = i;
        render();
      });
      body.appendChild(dom.el('tr', { class: i === selectedNew ? 'is-current' : null }, [
        dom.el('td', null, button),
        dom.el('td', { class: 'num' }, num(p.x)),
        dom.el('td', { class: 'num' }, num(p.y)),
        dom.el('td', { class: 'num' }, r ? r.cluster + 1 : '–'),
        dom.el('td', { class: 'num' }, r ? num(r.distance) : '–')
      ]));
    });
  }

  /** Füllt die Beschriftungen der Maske. */
  function renderForm() {
    const attrs = session.data.attributes();
    dom.byId('app-new-x-label').textContent = attrs.x;
    dom.byId('app-new-y-label').textContent = attrs.y;
  }

  /** @returns {number} Schwelle t. */
  const threshold = () => Number(dom.byId('app-t').value);

  /** Zeichnet die Anwendung „Ausreißer erkennen“. */
  function renderOutliers() {
    dom.byId('app-t-value').textContent = num(threshold());
    const body = dom.clear(dom.byId('app-out-body'));
    const small = dom.clear(dom.byId('app-out-small'));
    const count = dom.byId('app-out-count');
    if (!current) {
      count.textContent = '–';
      return;
    }
    const coords = session.coords();
    const { run } = current;
    const found = apply.outliers(coords, run.centers, run.assignment, threshold());
    const names = session.names();
    count.textContent = String(found.rows.length);
    for (const row of found.rows) {
      body.appendChild(dom.el('tr', null, [
        dom.el('td', null, names[row.index]),
        dom.el('td', { class: 'num' }, row.cluster + 1),
        dom.el('td', { class: 'num' }, num(row.distance)),
        dom.el('td', { class: 'num' }, num(found.means[row.cluster])),
        dom.el('td', { class: 'num' }, num(row.multiple))
      ]));
    }
    dom.byId('app-out-none').hidden = found.rows.length > 0;
    for (const c of apply.smallClusters(run.assignment, current.k)) {
      small.appendChild(dom.el('p', { class: 'notice' }, 'Cluster ' + (c.cluster + 1) + ' enthält nur ' + plural(c.count, 'Punkt', 'Punkte') + ' (' + num(Math.round(c.share * 1000) / 10) + ' %). Ausreißer können ein eigenes Cluster bilden: Dann ist ihr Abstand zum eigenen Zentrum klein, und die Regel erkennt sie nicht.'));
    }
  }

  /** Zeichnet die Anwendung „Standorte planen“. */
  function renderSites() {
    dom.byId('app-site-scaled').hidden = !session.scaler();
    const body = dom.clear(dom.byId('app-site-body'));
    const total = dom.byId('app-site-total');
    const price = costs();
    dom.byId('app-cost-error').textContent = price ? '' : 'Die Kosten müssen Zahlen von 0 bis 1000000 sein.';
    if (!current) {
      total.textContent = '';
    } else {
      const names = session.names();
      const routes = apply.routes(session.coords(), current.run.centers, current.run.assignment);
      for (const row of routes.rows) {
        body.appendChild(dom.el('tr', null, [
          dom.el('td', null, [dom.el('span', { class: 'swatch cl-swatch ' + view.clusterClass(row.cluster) }), String(row.cluster + 1)]),
          dom.el('td', { class: 'num' }, row.count === 0 ? 'leer' : row.count),
          dom.el('td', { class: 'num' }, row.mean === null ? '–' : num(row.mean)),
          dom.el('td', { class: 'num' }, row.longest === null ? '–' : num(row.longest)),
          dom.el('td', null, row.longestIndex === null ? '–' : names[row.longestIndex])
        ]));
      }
      total.textContent = price
        ? 'Gesamtkosten: ' + current.k + ' × ' + num(price.site) + ' + ' + num(routes.sum) + ' × ' + num(price.unit) + ' = ' + num(apply.totalCost(current.k, routes.sum, price.site, price.unit))
        : '';
    }
    const possible = session.maxK() > 0;
    const kMax = Math.min(COST_MAX_K, session.maxK());
    const button = dom.byId('app-curve-run');
    button.disabled = !possible;
    button.textContent = possible ? 'Für k = 1 bis ' + kMax + ' rechnen' : 'Kosten für mehrere k rechnen';
    renderCurve(price);
  }

  /**
   * Zeichnet die Kosten über k.
   * @param {{site:number, unit:number}|null} price - Kosten.
   */
  function renderCurve(price) {
    const box = dom.byId('app-curve-box');
    box.hidden = !curve || !price;
    if (!curve || !price) {
      return;
    }
    const { rows, bestK } = apply.cheapest(curve, price.site, price.unit);
    const kMax = rows.length;
    const lines = [];
    for (let i = 1; i < kMax; i++) {
      lines.push({ x1: i, y1: rows[i - 1].cost, x2: i + 1, y2: rows[i].cost, cls: 'curve-line' });
    }
    const best = rows[bestK - 1];
    const v = ns.coordPlot.fitView([{ x: 0, y: 0 }, { x: kMax, y: Math.max(...rows.map((r) => r.cost), 1) }]);
    chart.render({
      view: v,
      xLabel: 'Anzahl der Standorte k',
      yLabel: 'Gesamtkosten',
      xTicks: view.integerTicks(kMax),
      lines,
      points: rows.map((r) => ({
        x: r.k, y: r.cost, shape: 'circle', r: 5, cls: 'pt-curve',
        ring: r.k === bestK ? 'current' : undefined,
        title: 'k = ' + r.k + ': Gesamtkosten ' + num(r.cost) + ', Wege ' + num(r.sum)
      })),
      labels: [{ x: best.k + (v.xmax - v.xmin) * 0.03, y: best.cost + (v.ymax - v.ymin) * 0.05, text: 'günstigstes k = ' + best.k, cls: 'label-strong' }]
    });
    dom.byId('app-curve-best').textContent = 'Am günstigsten ist k = ' + best.k + ' mit Gesamtkosten von ' + num(best.cost) + '.';
  }

  /** Zeichnet die Seite. */
  function render() {
    if (version !== session.version()) {
      const hadWork = Boolean(current) || newPoints.length > 0 || Boolean(curve);
      version = session.version();
      current = null;
      newPoints = [];
      selectedNew = null;
      curve = null;
      dom.byId('app-stale').hidden = !hadWork;
    }
    const possible = session.maxK() > 0;
    dom.byId('app-empty').hidden = possible;
    dom.byId('app-run').disabled = !possible;
    view.renderKSelect(dom.byId('app-k'), session.maxK(), chosen);
    dom.byId('app-info').textContent = current ? 'Lauf mit k = ' + current.k + ': WCSS ' + num(current.run.wcss) + ', ' + plural(current.run.iterations, 'Iteration', 'Iterationen') + '.' : 'Noch kein Lauf.';
    for (const m of MODES) {
      dom.byId('app-mode-' + m).checked = m === mode;
      dom.byId('app-panel-' + m).hidden = m !== mode;
    }
    renderForm();
    renderNewCalc();
    renderNewList();
    renderOutliers();
    renderSites();
    renderPlot();
  }

  /** Rechnet den Lauf, auf dem die Anwendungen aufbauen. */
  function run() {
    const k = Number(dom.byId('app-k').value);
    current = { k, run: ns.kmeansAnalysis.randomRun(session.coords(), k, { method: dom.byId('app-start').value }) };
    dom.byId('app-stale').hidden = true;
    render();
  }

  /**
   * Ordnet einen neuen Punkt ein.
   * @param {number} x - x in Originaleinheiten.
   * @param {number} y - y in Originaleinheiten.
   * @param {string} [name] - Bezeichner.
   * @returns {string} Fehlermeldung oder ''.
   */
  function addPoint(x, y, name) {
    if (!current) {
      return 'Berechnen Sie zuerst die Cluster.';
    }
    if (newPoints.length >= MAX_NEW_POINTS) {
      return 'Es sind höchstens ' + MAX_NEW_POINTS + ' neue Punkte möglich.';
    }
    newPoints = newPoints.concat([{ name: ns.clusterData.cleanName(name) || 'Neu ' + (newPoints.length + 1), x, y }]);
    selectedNew = newPoints.length - 1;
    render();
    return '';
  }

  /** Liest die Maske aus. */
  function submitForm() {
    const attrs = session.data.attributes();
    const vx = ns.clusterData.validateNumber(dom.byId('app-new-x').value, attrs.x);
    const vy = ns.clusterData.validateNumber(dom.byId('app-new-y').value, attrs.y);
    const bad = [vx, vy].find((v) => !v.ok);
    const error = bad ? bad.error : addPoint(vx.value, vy.value, dom.byId('app-new-name').value);
    dom.byId('app-new-error').textContent = error;
    if (!error) {
      for (const id of ['app-new-name', 'app-new-x', 'app-new-y']) {
        dom.byId(id).value = '';
      }
      dom.byId('app-new-x').focus();
    }
  }

  /**
   * Klick in die Zeichnung: nur beim Einordnen.
   * @param {number} x - x-Wert.
   * @param {number} y - y-Wert.
   */
  function handleClick(x, y) {
    if (mode !== 'classify') {
      return;
    }
    const [ox, oy] = session.freePoint(x, y);
    dom.byId('app-new-error').textContent = addPoint(ox, oy);
  }

  /** Richtet die Seite ein. */
  function init() {
    plot = ns.coordPlot.create(dom.byId('app-plot'), { ariaLabel: 'Koordinatensystem mit den Clustern des Laufs. Beim Einordnen setzt ein Klick einen neuen Punkt.', onClick: handleClick });
    chart = ns.coordPlot.create(dom.byId('app-curve'), { ariaLabel: 'Gesamtkosten je Anzahl der Standorte k' });
    dom.byId('app-run').addEventListener('click', run);
    dom.byId('app-k').addEventListener('change', (event) => { chosen = Number(event.target.value); });
    for (const m of MODES) {
      dom.byId('app-mode-' + m).addEventListener('change', () => {
        mode = m;
        render();
      });
    }
    dom.byId('app-areas').addEventListener('change', renderPlot);
    dom.byId('app-new-form').addEventListener('submit', (event) => {
      event.preventDefault();
      submitForm();
    });
    dom.byId('app-new-clear').addEventListener('click', () => {
      newPoints = [];
      selectedNew = null;
      render();
    });
    dom.byId('app-t').addEventListener('input', () => {
      renderOutliers();
      renderPlot();
    });
    for (const id of ['app-cost-site', 'app-cost-unit']) {
      dom.byId(id).addEventListener('input', renderSites);
    }
    dom.byId('app-curve-run').addEventListener('click', () => {
      curve = apply.routeCurve(session.coords(), Math.min(COST_MAX_K, session.maxK()), { method: dom.byId('app-start').value });
      dom.byId('app-stale').hidden = true;
      render();
    });
  }

  ns.pages.apply = { init, render, current: () => current, newPoints: () => newPoints, curve: () => curve };
})(window.CC = window.CC || {});
