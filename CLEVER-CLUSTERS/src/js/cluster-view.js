/**
 * @file cluster-view.js
 * @description Bausteine der Darstellung: Teile der Zeichnungen, Zentrentabelle und „Objekte je Cluster“.
 *
 * Farben:
 *   Jeder Cluster trägt die Klasse cl-N aus css/clusters.css. Farbe allein reicht bei vielen Clustern
 *   nicht; deshalb tragen Zentren ihre Nummer, die Punkte wechseln die Form, und der Tooltip nennt
 *   den Cluster.
 *
 * Abhängigkeiten:
 *   dom-utils.js, sim-format.js, coord-plot.js, voronoi.js, kmeans.js, session.js
 *
 * Sicherheitsaspekte:
 *   Objektbezeichner werden nur als Text eingefügt.
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const { num, plural } = ns.simFormat;
  const SHAPES = ['circle', 'square', 'diamond'];
  /** Größe der Sterne für die Zentren. */
  const CENTER_RADIUS = 15;

  /**
   * Klasse eines Clusters.
   * @param {number} c - Nummer ab 0.
   * @returns {string} Klasse.
   */
  const clusterClass = (c) => 'cl-' + (c % 100);

  /**
   * Form eines Clusters.
   * @param {number} c - Nummer ab 0.
   * @returns {string} Form.
   */
  const shapeOf = (c) => SHAPES[c % SHAPES.length];

  /**
   * Füllt die Auswahl eines eigenen k (Seiten 4, 7 und 8).
   * @param {HTMLSelectElement} select - Auswahl (wird geleert).
   * @param {number} max - Größtes k; 0 ohne Daten.
   * @param {number} chosen - Gewünschtes k.
   */
  function renderKSelect(select, max, chosen) {
    dom.clear(select);
    for (let k = 1; k <= Math.max(max, 1); k++) {
      select.appendChild(dom.el('option', { value: String(k) }, String(k)));
    }
    select.disabled = max === 0;
    select.value = String(Math.min(chosen, Math.max(max, 1)));
  }

  /**
   * Beschreibt einen Punkt für den Tooltip.
   * @param {string} name - Anzeigename.
   * @param {number[]} coord - Koordinaten.
   * @param {number} [cluster] - Cluster ab 0.
   * @returns {string} Text.
   */
  function pointTitle(name, coord, cluster) {
    return name + ' (' + num(coord[0]) + ' | ' + num(coord[1]) + ')' + (cluster === undefined ? '' : ', Cluster ' + (cluster + 1));
  }

  /**
   * Punkte für die Zeichnung.
   * @param {number[][]} coords - Koordinaten.
   * @param {string[]} names - Anzeigenamen.
   * @param {Array<number|null>|null} assignment - Zuordnung; null zeichnet alle neutral, ein einzelner
   *   Eintrag null den betreffenden Punkt.
   * @returns {Array<Object>} Punkte.
   */
  function pointMarks(coords, names, assignment) {
    return coords.map((c, i) => {
      const cluster = assignment && assignment[i] !== null ? assignment[i] : undefined;
      return {
        x: c[0], y: c[1],
        shape: cluster === undefined ? 'circle' : shapeOf(cluster),
        cls: cluster === undefined ? 'pt-neutral' : 'pt-cluster ' + clusterClass(cluster),
        title: pointTitle(names[i], c, cluster)
      };
    });
  }

  /**
   * Zentren für die Zeichnung: große Sterne mit Nummer.
   * @param {number[][]} centers - Zentren.
   * @returns {Array<Object>} Punkte.
   */
  function centerMarks(centers) {
    return centers.map((c, i) => ({
      x: c[0], y: c[1], shape: 'star', r: CENTER_RADIUS, text: String(i + 1),
      cls: 'pt-center ' + clusterClass(i),
      title: 'Zentrum ' + (i + 1) + ' (' + num(c[0]) + ' | ' + num(c[1]) + ')'
    }));
  }

  /**
   * Decision Areas für die Zeichnung.
   * @param {number[][]} centers - Zentren.
   * @param {Object} view - Ausschnitt.
   * @returns {Array<Object>} Flächen.
   */
  function areaRegions(centers, view) {
    const out = [];
    ns.voronoi.cells(centers, view).forEach((polygon, i) => {
      if (polygon.length > 0) {
        out.push({ polygon, cls: 'cl-area ' + clusterClass(i), title: 'Decision Area von Cluster ' + (i + 1) });
      }
    });
    return out;
  }

  /**
   * Verlauf der Zentren: Strecken zwischen den Lagen.
   * @param {number[][][]} trails - Je Cluster die Lagen.
   * @returns {Array<Object>} Linien.
   */
  function trailLines(trails) {
    const out = [];
    trails.forEach((trail, c) => {
      for (let i = 1; i < trail.length; i++) {
        out.push({ x1: trail[i - 1][0], y1: trail[i - 1][1], x2: trail[i][0], y2: trail[i][1], cls: 'cl-trail ' + clusterClass(c) });
      }
    });
    return out;
  }

  /**
   * Frühere Lagen der Zentren als kleine Marken.
   * @param {number[][][]} trails - Je Cluster die Lagen.
   * @returns {Array<Object>} Punkte.
   */
  function trailMarks(trails) {
    const out = [];
    trails.forEach((trail, c) => {
      trail.slice(0, -1).forEach((p, i) => {
        out.push({ x: p[0], y: p[1], shape: 'diamond', r: 3, cls: 'pt-trail ' + clusterClass(c), title: 'Zentrum ' + (c + 1) + ' in Lage ' + (i + 1) });
      });
    });
    return out;
  }

  /**
   * Abstandslinien jedes Punkts zu seinem Zentrum.
   * @param {number[][]} coords - Koordinaten.
   * @param {number[][]} centers - Zentren.
   * @param {number[]} assignment - Zuordnung.
   * @returns {Array<Object>} Linien.
   */
  function distanceLines(coords, centers, assignment) {
    return coords.map((c, i) => {
      const center = centers[assignment[i]];
      return { x1: c[0], y1: c[1], x2: center[0], y2: center[1], cls: 'cl-distance ' + clusterClass(assignment[i]) };
    });
  }

  /**
   * Füllt eine Zentrentabelle.
   *
   * @param {HTMLElement} head - Kopfzeile (wird geleert).
   * @param {HTMLElement} tbody - Tabellenkörper (wird geleert).
   * @param {number[][]} centers - Zentren in den Koordinaten der Zeichnung.
   * @param {number[][]} [coords] - Koordinaten der Punkte; mit assignment für Anzahl und WCSS.
   * @param {number[]|null} [assignment] - Zuordnung.
   */
  function renderCenterTable(head, tbody, centers, coords, assignment) {
    const session = ns.session;
    const attrs = session.axisLabels();
    const scaled = Boolean(session.scaler());
    const raw = session.data.attributes();
    const numCol = (text) => dom.el('th', { scope: 'col', class: 'num' }, text);
    dom.clear(head);
    dom.appendChildren(head, [
      dom.el('th', { scope: 'col' }, 'Cluster'),
      numCol(attrs.x), numCol(attrs.y),
      scaled ? numCol(raw.x) : null,
      scaled ? numCol(raw.y) : null,
      assignment ? numCol('Punkte') : null,
      assignment ? numCol('WCSS') : null
    ]);
    dom.clear(tbody);
    const sizes = assignment ? ns.kmeans.counts(assignment, centers.length) : null;
    const parts = assignment ? ns.kmeans.wcssParts(coords, centers, assignment) : null;
    centers.forEach((c, i) => {
      const original = scaled ? session.toOriginal(c) : null;
      tbody.appendChild(dom.el('tr', null, [
        dom.el('td', null, [dom.el('span', { class: 'swatch cl-swatch ' + clusterClass(i) }), String(i + 1)]),
        dom.el('td', { class: 'num' }, num(c[0])),
        dom.el('td', { class: 'num' }, num(c[1])),
        scaled ? dom.el('td', { class: 'num' }, num(original[0])) : null,
        scaled ? dom.el('td', { class: 'num' }, num(original[1])) : null,
        sizes ? dom.el('td', { class: 'num' }, sizes[i] === 0 ? 'leer' : sizes[i]) : null,
        parts ? dom.el('td', { class: 'num' }, num(parts[i])) : null
      ]));
    });
  }

  /**
   * Zeigt, welche Objekte zu welchem Cluster gehören.
   *
   * @param {HTMLElement} box - Behälter (wird geleert).
   * @param {string[]} names - Anzeigenamen.
   * @param {number[]|null} assignment - Zuordnung.
   * @param {number} k - Anzahl der Cluster.
   */
  function renderObjects(box, names, assignment, k) {
    dom.clear(box);
    if (!assignment) {
      box.appendChild(dom.el('p', { class: 'hint' }, 'Noch keine Zuordnung.'));
      return;
    }
    const groups = Array.from({ length: k }, () => []);
    assignment.forEach((c, i) => groups[c].push(names[i]));
    box.appendChild(dom.el('ul', { class: 'cluster-objects' }, groups.map((list, c) => dom.el('li', null, [
      dom.el('span', { class: 'swatch cl-swatch ' + clusterClass(c) }),
      dom.el('strong', null, 'Cluster ' + (c + 1) + ' (' + plural(list.length, 'Objekt', 'Objekte') + '): '),
      list.length ? list.join(', ') : 'leer'
    ]))));
  }

  /**
   * Ganzzahlige Teilung der x-Achse.
   * @param {number} max - Größter Wert.
   * @returns {Array<{x:number, text:string}>} Teilstriche.
   */
  function integerTicks(max) {
    const step = max <= 15 ? 1 : max <= 30 ? 2 : max <= 75 ? 5 : max <= 150 ? 10 : Math.ceil(max / 100) * 10;
    const out = [];
    for (let v = 0; v <= max; v += step) {
      out.push({ x: v, text: String(v) });
    }
    return out;
  }

  /**
   * Zeichnet die WCSS-Kurve des Trainings.
   * @param {Object} plot - Koordinatensystem.
   * @param {number[]} history - WCSS je Trainingsschritt.
   */
  function renderCurve(plot, history) {
    const xEnd = Math.max(6, history.length);
    const yEnd = history.length ? Math.max(...history) : 1;
    const lines = [];
    for (let i = 1; i < history.length; i++) {
      lines.push({ x1: i, y1: history[i - 1], x2: i + 1, y2: history[i], cls: 'curve-line' });
    }
    plot.render({
      view: ns.coordPlot.fitView([{ x: 0, y: 0 }, { x: xEnd, y: yEnd }]),
      xLabel: 'Trainingsschritt',
      yLabel: 'WCSS',
      xTicks: integerTicks(xEnd),
      lines,
      points: history.map((w, i) => ({ x: i + 1, y: w, shape: 'circle', r: 5, cls: 'pt-curve', title: 'Schritt ' + (i + 1) + ': WCSS = ' + num(w) }))
    });
  }

  ns.clusterView = { clusterClass, shapeOf, renderKSelect, pointMarks, centerMarks, areaRegions, trailLines, trailMarks, distanceLines, renderCenterTable, renderObjects, integerTicks, renderCurve };
})(window.CC = window.CC || {});
