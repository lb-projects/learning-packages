/**
 * @file pages/groups.js
 * @description Seite 7 „Bekannte Gruppen“: Cluster mit den tatsächlichen Gruppen vergleichen.
 *
 * Die Seite macht den Unterschied zu überwachtem Lernen sichtbar: k-Means kennt die Gruppen nicht und muss sie
 * nicht treffen. Sie übernimmt die Daten (mit Skalierung) von Seite 1 und hat ein eigenes k.
 *
 * Geheimnis:
 *   Vor „Vergleich durchführen“ nennt die Seite nur, ob es bekannte Gruppen gibt, nicht wie viele oder welche.
 *   Die Gruppennamen stehen auf keiner anderen Seite und werden bei neuen Daten wieder aus dem Dokument entfernt.
 *
 * Abhängigkeiten:
 *   dom-utils.js, sim-format.js, coord-plot.js, kmeans-analysis.js, kmeans-compare.js, cluster-view.js, session.js
 *
 * Sicherheitsaspekte:
 *   Gruppennamen und Objektbezeichner werden nur als Text eingefügt.
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const session = ns.session;
  const view = ns.clusterView;
  const { num, plural } = ns.simFormat;

  let clusterPlot = null;
  let groupPlot = null;
  let chosen = session.DEFAULT_K;
  /** Ergebnis des letzten Klicks: {version, k, run, table, purity, ari} oder null. */
  let result = null;

  /** @returns {Array<string|null>} Gruppe je Punkt. */
  const groupsOfPoints = () => session.data.points().map((p) => p.group);

  /**
   * Punkte einer Zeichnung, gefärbt nach Cluster oder Gruppe; abweichende Punkte tragen einen Ring.
   * @param {number[]} colors - Farbnummer je Punkt; −1 ohne Farbe.
   * @param {function(number):string} titleOf - Tooltip je Punkt.
   * @param {boolean[]} deviating - Abweichende Punkte.
   * @returns {Array<Object>} Punkte.
   */
  function marksFor(colors, titleOf, deviating) {
    return session.coords().map((c, i) => ({
      x: c[0], y: c[1],
      shape: colors[i] < 0 ? 'circle' : view.shapeOf(colors[i]),
      cls: colors[i] < 0 ? 'pt-neutral' : 'pt-cluster ' + view.clusterClass(colors[i]),
      ring: deviating[i] ? 'wrong' : undefined,
      title: titleOf(i)
    }));
  }

  /** Zeichnet beide Zeichnungen. */
  function renderPlots() {
    if (!result) {
      for (const plot of [clusterPlot, groupPlot]) {
        plot.render({ view: session.view(), xLabel: '', yLabel: '', points: [] });
      }
      return;
    }
    const v = session.view();
    const labels = session.axisLabels();
    const names = session.names();
    const groups = groupsOfPoints();
    const { run, table } = result;
    const off = ns.kmeansCompare.deviating(run.assignment, groups, table);
    const colorOfGroup = new Map(table.groups.map((name, g) => [name, result.colors[g]]));
    const suffix = (i) => (off[i] ? ', weicht von der häufigsten Gruppe ab' : '');
    clusterPlot.render({
      view: v, xLabel: labels.x, yLabel: labels.y,
      points: marksFor(run.assignment, (i) => names[i] + ', Cluster ' + (run.assignment[i] + 1) + suffix(i), off).concat(view.centerMarks(run.centers))
    });
    groupPlot.render({
      view: v, xLabel: labels.x, yLabel: labels.y,
      points: marksFor(groups.map((g) => (g ? colorOfGroup.get(g) : -1)), (i) => names[i] + ', ' + (groups[i] || 'ohne Gruppe') + suffix(i), off)
    });
  }

  /** Zeichnet die Kreuztabelle mit der jeweils häufigsten Gruppe hervorgehoben. */
  function renderTable() {
    const head = dom.clear(dom.byId('grp-head'));
    const body = dom.clear(dom.byId('grp-body'));
    if (!result) {
      return;
    }
    const { table } = result;
    const major = ns.kmeansCompare.majorities(table);
    dom.appendChildren(head, [
      dom.el('th', { scope: 'col' }, 'Cluster'),
      ...table.groups.map((name) => dom.el('th', { scope: 'col', class: 'num' }, name)),
      dom.el('th', { scope: 'col', class: 'num' }, 'Summe')
    ]);
    table.cells.forEach((row, c) => {
      body.appendChild(dom.el('tr', null, [
        dom.el('td', null, [dom.el('span', { class: 'swatch cl-swatch ' + view.clusterClass(c) }), String(c + 1)]),
        ...row.map((count, g) => dom.el('td', { class: 'num' + (g === major[c] ? ' is-majority' : '') }, count)),
        dom.el('td', { class: 'num' }, row.reduce((a, b) => a + b, 0))
      ]));
    });
  }

  /** Zeigt Objekte je Cluster und Gruppe. */
  function renderObjects() {
    const box = dom.clear(dom.byId('grp-objects'));
    if (!result) {
      return;
    }
    const names = session.names();
    const groups = groupsOfPoints();
    const { run, table } = result;
    const items = [];
    for (let c = 0; c < result.k; c++) {
      const members = (name) => names.filter((_, i) => run.assignment[i] === c && groups[i] === name);
      const parts = table.groups.filter((name) => members(name).length > 0).map((name) => dom.el('li', null, [
        dom.el('strong', null, name + ' (' + members(name).length + '): '),
        members(name).join(', ')
      ]));
      items.push(dom.el('li', null, [
        dom.el('span', { class: 'swatch cl-swatch ' + view.clusterClass(c) }),
        dom.el('strong', null, 'Cluster ' + (c + 1)),
        parts.length ? dom.el('ul', { class: 'group-members' }, parts) : ': keine Punkte mit Gruppe'
      ]));
    }
    box.appendChild(dom.el('ul', { class: 'cluster-objects' }, items));
  }

  /** Zeichnet Kennzahlen und Hinweise. */
  function renderResult() {
    dom.byId('grp-result').hidden = !result;
    renderPlots();
    renderTable();
    renderObjects();
    if (!result) {
      dom.byId('grp-purity').textContent = '–';
      dom.byId('grp-ari').textContent = '–';
      dom.byId('grp-k-note').textContent = '';
      dom.byId('grp-ignored').textContent = '';
      return;
    }
    const { table } = result;
    dom.byId('grp-purity').textContent = result.purity === null ? 'nicht definiert' : num(result.purity);
    dom.byId('grp-ari').textContent = result.ari === null ? 'nicht definiert' : num(result.ari);
    const note = dom.byId('grp-k-note');
    const groupCount = table.groups.length;
    note.hidden = result.k === groupCount;
    note.textContent = result.k === groupCount ? '' : 'k = ' + result.k + ', die Daten haben aber ' + plural(groupCount, 'Gruppe', 'Gruppen') + '. Die Einteilungen können deshalb nicht genau übereinstimmen.';
    const ignored = dom.byId('grp-ignored');
    ignored.hidden = table.ignored === 0;
    ignored.textContent = table.ignored === 0 ? '' : plural(table.ignored, 'Punkt ohne Gruppe zählt', 'Punkte ohne Gruppe zählen') + ' beim Vergleich nicht mit.';
  }

  /** Zeichnet die Seite. */
  function render() {
    if (result && result.version !== session.version()) {
      result = null;
      dom.byId('grp-stale').hidden = false;
    }
    view.renderKSelect(dom.byId('grp-k'), session.maxK(), chosen);
    const possible = session.maxK() > 0;
    const has = session.data.hasGroups();
    dom.byId('grp-empty').hidden = possible;
    dom.byId('grp-none').hidden = !possible || has;
    dom.byId('grp-available').hidden = !possible || !has;
    dom.byId('grp-run').disabled = !possible || !has;
    renderResult();
  }

  /** Führt den Vergleich aus. Jeder Klick ist ein neuer Lauf. */
  function run() {
    const k = Number(dom.byId('grp-k').value);
    const main = ns.kmeansAnalysis.randomRun(session.coords(), k, { method: dom.byId('grp-start').value });
    const compare = ns.kmeansCompare;
    const table = compare.crossTable(main.assignment, groupsOfPoints(), k);
    result = { version: session.version(), k, run: main, table, colors: compare.groupColors(table), purity: compare.purity(table), ari: compare.adjustedRand(table) };
    dom.byId('grp-stale').hidden = true;
    render();
  }

  /** Richtet die Seite ein. */
  function init() {
    clusterPlot = ns.coordPlot.create(dom.byId('grp-plot-clusters'), { ariaLabel: 'Koordinatensystem mit den Clustern von k-Means' });
    groupPlot = ns.coordPlot.create(dom.byId('grp-plot-groups'), { ariaLabel: 'Koordinatensystem mit den bekannten Gruppen' });
    dom.byId('grp-run').addEventListener('click', run);
    dom.byId('grp-k').addEventListener('change', (event) => { chosen = Number(event.target.value); });
  }

  ns.pages.groups = { init, render, result: () => result };
})(window.CC = window.CC || {});
