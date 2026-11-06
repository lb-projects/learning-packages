/**
 * @file coord-plot.js
 * @description Koordinatensystem als SVG: Flächen, Linien und Punkte in Datenkoordinaten.
 *
 * Eigenschaften:
 *   - Die Achsen sind getrennt skaliert, damit Merkmale verschiedener Größenordnung die Fläche füllen.
 *   - Der Baustein kennt kein Modell: Flächen sind beliebige Polygone, Linien beliebige Strecken.
 *     Nichtlineare Entscheidungsgrenzen lassen sich als Raster aus Polygonen übergeben.
 *   - Punkte sind Kreis, Quadrat oder Raute, damit Klassen auch ohne Farbe unterscheidbar bleiben.
 *   - Liegt 0 im Ausschnitt, sind die Achsen kräftig und mit Pfeilspitzen gezeichnet. Mit
 *     fitView(…, {includeOrigin: true}) ist das immer der Fall.
 *
 * Darstellung (render):
 *   {view, xLabel, yLabel, regions: [{polygon: [[x, y], …], cls, title?}],
 *    lines: [{x1, y1, x2, y2, cls}], points: [{x, y, shape, cls, title?, ring?}]}
 *   ring zeichnet einen Ring um den Punkt ('current' oder 'new').
 *
 * Gemeinsamer Code der Simulator-Pakete (Quelle: shared/js/coord-plot.js).
 *
 * Abhängigkeiten:
 *   dom-utils.js, sim-format.js
 *
 * Sicherheitsaspekte:
 *   Texte werden nur als Textknoten eingefügt, Farben nur über CSS-Klassen vergeben.
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;

  const WIDTH = 640;
  const HEIGHT = 480;
  const MARGIN = { left: 66, right: 16, top: 14, bottom: 54 };
  const MARKER_R = 6;
  const TICKS = 6;
  /** Größe der Pfeilspitzen der Achsen. */
  const AXIS_TIP = 10;

  /** Zähler für eindeutige clipPath-IDs. */
  let counter = 0;

  /**
   * Rundet für kompakte SVG-Attribute.
   * @param {number} v - Zahl.
   * @returns {number} Gerundete Zahl.
   */
  const r2 = (v) => Math.round(v * 100) / 100;

  /**
   * Bestimmt den Ausschnitt für eine Menge von Koordinaten.
   *
   * @param {Array<{x:number, y:number}>} list - Koordinaten.
   * @param {{includeOrigin?:boolean}} [options] - includeOrigin: Der Nullpunkt liegt immer im Ausschnitt,
   *   sodass beide Achsen zu sehen sind.
   * @returns {{xmin:number, xmax:number, ymin:number, ymax:number}} Ausschnitt.
   */
  function fitView(list, options) {
    if (list.length === 0) {
      return { xmin: -5, xmax: 5, ymin: -5, ymax: 5 };
    }
    const coords = options && options.includeOrigin ? [...list, { x: 0, y: 0 }] : list;
    const range = (values) => {
      let min = Math.min(...values);
      let max = Math.max(...values);
      if (min === max) {
        min -= 1;
        max += 1;
      }
      const pad = (max - min) * 0.1;
      return [min - pad, max + pad];
    };
    const [xmin, xmax] = range(coords.map((c) => c.x));
    const [ymin, ymax] = range(coords.map((c) => c.y));
    return { xmin, xmax, ymin, ymax };
  }

  /**
   * Schrittweite der Achsenteilung (1, 2 oder 5 mal einer Zehnerpotenz).
   * @param {number} span - Spannweite.
   * @returns {number} Schrittweite.
   */
  function niceStep(span) {
    const raw = span / TICKS;
    const power = Math.pow(10, Math.floor(Math.log10(raw)));
    const scaled = raw / power;
    return (scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10) * power;
  }

  /**
   * Teilstriche einer Achse.
   * @param {number} min - Untergrenze.
   * @param {number} max - Obergrenze.
   * @returns {number[]} Werte.
   */
  function ticksOf(min, max) {
    const step = niceStep(max - min);
    const out = [];
    for (let i = Math.ceil(min / step); i * step <= max + step * 1e-9; i++) {
      out.push(ns.simFormat.clean(i * step));
    }
    return out;
  }

  /**
   * Pfad einer Markerform.
   * @param {string} shape - 'circle', 'square' oder 'diamond'.
   * @param {number} cx - Mittelpunkt x.
   * @param {number} cy - Mittelpunkt y.
   * @param {number} r - Radius.
   * @returns {SVGElement} Element.
   */
  function marker(shape, cx, cy, r) {
    if (shape === 'square') {
      const s = r * 0.9;
      return dom.svg('rect', { x: r2(cx - s), y: r2(cy - s), width: r2(2 * s), height: r2(2 * s) });
    }
    if (shape === 'diamond') {
      const s = r * 1.5;
      return dom.svg('path', { d: 'M' + r2(cx) + ' ' + r2(cy - s) + 'L' + r2(cx + s) + ' ' + r2(cy) + 'L' + r2(cx) + ' ' + r2(cy + s) + 'L' + r2(cx - s) + ' ' + r2(cy) + 'Z' });
    }
    return dom.svg('circle', { cx: r2(cx), cy: r2(cy), r });
  }

  /**
   * Kleines Symbol eines Markers für Legenden.
   * @param {string} shape - Form.
   * @param {string} cls - CSS-Klassen.
   * @returns {SVGElement} SVG.
   */
  function markerIcon(shape, cls) {
    const m = marker(shape, 10, 10, MARKER_R);
    m.setAttribute('class', cls);
    return dom.svg('svg', { class: 'marker-icon', viewBox: '0 0 20 20', width: 16, height: 16, 'aria-hidden': 'true', focusable: 'false' }, m);
  }

  /**
   * Erzeugt ein Koordinatensystem.
   *
   * @param {HTMLElement} container - Behälter (wird geleert).
   * @param {{ariaLabel?:string}} [options] - Beschreibung für Hilfsmittel.
   * @returns {{render:function(Object):void, view:function():(Object|null)}} Steuerung.
   */
  function create(container, options) {
    const clipId = 'coord-plot-clip-' + (++counter);
    const root = dom.svg('svg', {
      class: 'coord-plot',
      viewBox: '0 0 ' + WIDTH + ' ' + HEIGHT,
      role: 'img',
      'aria-label': (options && options.ariaLabel) || 'Koordinatensystem'
    });
    dom.clear(container);
    container.appendChild(root);
    let currentView = null;

    /**
     * Zeichnet alles neu.
     * @param {Object} spec - Siehe Dateikopf.
     */
    function render(spec) {
      const view = spec.view;
      currentView = view;
      const plotW = WIDTH - MARGIN.left - MARGIN.right;
      const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
      const sx = (x) => MARGIN.left + ((x - view.xmin) / (view.xmax - view.xmin)) * plotW;
      const sy = (y) => MARGIN.top + plotH - ((y - view.ymin) / (view.ymax - view.ymin)) * plotH;
      dom.clear(root);

      root.appendChild(dom.svg('defs', null, dom.svg('clipPath', { id: clipId }, dom.svg('rect', { x: MARGIN.left, y: MARGIN.top, width: plotW, height: plotH }))));
      const clipped = dom.svg('g', { 'clip-path': 'url(#' + clipId + ')' });
      for (const region of spec.regions || []) {
        const d = region.polygon.map((p, i) => (i === 0 ? 'M' : 'L') + r2(sx(p[0])) + ' ' + r2(sy(p[1]))).join('') + 'Z';
        clipped.appendChild(dom.svg('path', { d, class: 'plot-region ' + (region.cls || '') }, region.title ? dom.svg('title', null, region.title) : null));
      }
      root.appendChild(clipped);

      const grid = dom.svg('g', { class: 'plot-grid' });
      const labels = dom.svg('g', { class: 'plot-tick-labels' });
      for (const t of ticksOf(view.xmin, view.xmax)) {
        grid.appendChild(dom.svg('line', { x1: r2(sx(t)), x2: r2(sx(t)), y1: MARGIN.top, y2: MARGIN.top + plotH}));
        labels.appendChild(dom.svg('text', { x: r2(sx(t)), y: MARGIN.top + plotH + 18, 'text-anchor': 'middle' }, ns.simFormat.num(t)));
      }
      for (const t of ticksOf(view.ymin, view.ymax)) {
        grid.appendChild(dom.svg('line', { x1: MARGIN.left, x2: MARGIN.left + plotW, y1: r2(sy(t)), y2: r2(sy(t))}));
        labels.appendChild(dom.svg('text', { x: MARGIN.left - 8, y: r2(sy(t)) + 4, 'text-anchor': 'end' }, ns.simFormat.num(t)));
      }
      root.appendChild(grid);
      const axes = dom.svg('g', { class: 'plot-axes' });
      if (view.ymin <= 0 && view.ymax >= 0) {
        const y = r2(sy(0));
        const end = MARGIN.left + plotW;
        axes.appendChild(dom.svg('g', { class: 'plot-axis', 'data-axis': 'x' }, [
          dom.svg('line', { x1: MARGIN.left, y1: y, x2: end, y2: y }),
          dom.svg('path', { d: 'M' + end + ' ' + y + 'l' + -AXIS_TIP + ' ' + (-AXIS_TIP / 2) + 'v' + AXIS_TIP + 'Z' })
        ]));
      }
      if (view.xmin <= 0 && view.xmax >= 0) {
        const x = r2(sx(0));
        axes.appendChild(dom.svg('g', { class: 'plot-axis', 'data-axis': 'y' }, [
          dom.svg('line', { x1: x, y1: MARGIN.top + plotH, x2: x, y2: MARGIN.top }),
          dom.svg('path', { d: 'M' + x + ' ' + MARGIN.top + 'l' + (-AXIS_TIP / 2) + ' ' + AXIS_TIP + 'h' + AXIS_TIP + 'Z' })
        ]));
      }
      root.appendChild(axes);
      root.appendChild(dom.svg('rect', { class: 'plot-frame', x: MARGIN.left, y: MARGIN.top, width: plotW, height: plotH }));
      root.appendChild(labels);
      root.appendChild(dom.svg('text', { class: 'plot-axis-label', x: MARGIN.left + plotW / 2, y: HEIGHT - 10, 'text-anchor': 'middle' }, spec.xLabel));
      root.appendChild(dom.svg('text', {
        class: 'plot-axis-label', x: 0, y: 0, 'text-anchor': 'middle',
        transform: 'translate(16 ' + (MARGIN.top + plotH / 2) + ') rotate(-90)'
      }, spec.yLabel));

      const lines = dom.svg('g', { 'clip-path': 'url(#' + clipId + ')' });
      for (const line of spec.lines || []) {
        lines.appendChild(dom.svg('line', { x1: r2(sx(line.x1)), y1: r2(sy(line.y1)), x2: r2(sx(line.x2)), y2: r2(sy(line.y2)), class: 'plot-line ' + (line.cls || '') }));
      }
      root.appendChild(lines);

      const marks = dom.svg('g', { class: 'plot-points' });
      const ordered = [...(spec.points || [])].sort((a, b) => (a.ring ? 1 : 0) - (b.ring ? 1 : 0));
      for (const p of ordered) {
        const group = dom.svg('g', { class: 'plot-point' + (p.ring ? ' ring-' + p.ring : ''), 'data-x': p.x, 'data-y': p.y });
        if (p.ring) {
          group.appendChild(dom.svg('circle', { class: 'plot-ring', cx: r2(sx(p.x)), cy: r2(sy(p.y)), r: MARKER_R + (p.ring === 'current' ? 7 : 4) }));
        }
        const m = marker(p.shape || 'circle', sx(p.x), sy(p.y), p.ring === 'current' ? MARKER_R + 1 : MARKER_R);
        m.setAttribute('class', 'plot-marker ' + (p.cls || ''));
        group.appendChild(m);
        if (p.title) {
          group.appendChild(dom.svg('title', null, p.title));
        }
        marks.appendChild(group);
      }
      root.appendChild(marks);
    }

    return { render, view: () => currentView };
  }

  ns.coordPlot = { create, fitView, markerIcon };
})(window.LP = window.LP || {});
