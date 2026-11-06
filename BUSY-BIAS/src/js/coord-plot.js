// Kopie aus shared/js/coord-plot.js – nicht hier bearbeiten: Änderungen in shared/ vornehmen und sync-shared.mjs ausführen.
/**
 * @file coord-plot.js
 * @description Koordinatensystem als SVG: Flächen, Linien und Punkte in Datenkoordinaten.
 *
 * Eigenschaften:
 *   - Die Achsen sind getrennt skaliert, damit Merkmale verschiedener Größenordnung die Fläche füllen.
 *   - Der Baustein kennt kein Modell: Flächen sind beliebige Polygone, Linien beliebige Strecken.
 *     Nichtlineare Entscheidungsgrenzen lassen sich als Raster aus Polygonen übergeben.
 *   - Punkte sind Kreis, Quadrat oder Raute, damit Klassen auch ohne Farbe unterscheidbar bleiben.
 *     Ein Stern hebt besondere Punkte hervor, zum Beispiel Clusterzentren.
 *   - Der linke Rand wächst mit der Länge der Zahlen an der y-Achse, damit sie die Achsenbeschriftung nicht überdecken.
 *   - Liegt 0 im Ausschnitt, sind die Achsen kräftig und mit Pfeilspitzen gezeichnet. Mit
 *     fitView(…, {includeOrigin: true}) ist das immer der Fall.
 *
 * Darstellung (render):
 *   {view, xLabel, yLabel, xTicks?: [{x, text}], regions: [{polygon: [[x, y], …], cls, title?}],
 *    lines: [{x1, y1, x2, y2, cls}], labels?: [{x, y, text, cls?, anchor?}],
 *    points: [{x, y, shape, cls, title?, ring?, r?, text?}]}
 *   ring zeichnet einen Ring um den Punkt ('current' oder 'new'); r ändert die Größe des Markers,
 *   text steht mittig im Marker. xTicks ersetzt die automatische Teilung der x-Achse, labels sind
 *   freie Beschriftungen in Datenkoordinaten.
 *
 * Bedienung:
 *   create(…, {onClick(x, y)}) meldet Klicks in die Zeichenfläche in Datenkoordinaten; screenOf()
 *   rechnet Datenkoordinaten in Einheiten der Zeichnung um, damit sich Abstände wie auf dem
 *   Bildschirm vergleichen lassen.
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
  /** So viele Zeichen passen an der y-Achse in den normalen linken Rand. */
  const TICK_CHARS = 4;
  /** Zusätzlicher Rand je weiteres Zeichen. */
  const CHAR_WIDTH = 8;

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
   * @param {string} shape - 'circle', 'square', 'diamond' oder 'star'.
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
    if (shape === 'star') {
      let d = '';
      for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? r : r * 0.5;
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        d += (i === 0 ? 'M' : 'L') + r2(cx + radius * Math.cos(angle)) + ' ' + r2(cy + radius * Math.sin(angle));
      }
      return dom.svg('path', { d: d + 'Z' });
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
   * @param {{ariaLabel?:string, onClick?:function(number, number):void}} [options] - Beschreibung für
   *   Hilfsmittel und Rückruf für Klicks in die Zeichenfläche (Datenkoordinaten).
   * @returns {{render:function(Object):void, view:function():(Object|null), screenOf:function(number, number):number[]}} Steuerung.
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
    let left = MARGIN.left;

    /**
     * Rechnet Datenkoordinaten in Einheiten der Zeichnung um.
     * @param {number} x - x-Wert.
     * @param {number} y - y-Wert.
     * @returns {number[]} Position in der Zeichnung.
     */
    function screenOf(x, y) {
      const plotW = WIDTH - left - MARGIN.right;
      const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
      const v = currentView;
      return [left + ((x - v.xmin) / (v.xmax - v.xmin)) * plotW, MARGIN.top + plotH - ((y - v.ymin) / (v.ymax - v.ymin)) * plotH];
    }

    if (options && options.onClick) {
      root.classList.add('is-clickable');
      root.addEventListener('click', (event) => {
        const matrix = root.getScreenCTM();
        if (!currentView || !matrix) {
          return;
        }
        const inverse = matrix.inverse();
        const px = inverse.a * event.clientX + inverse.c * event.clientY + inverse.e;
        const py = inverse.b * event.clientX + inverse.d * event.clientY + inverse.f;
        const plotW = WIDTH - left - MARGIN.right;
        const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
        if (px < left || px > left + plotW || py < MARGIN.top || py > MARGIN.top + plotH) {
          return;
        }
        const v = currentView;
        options.onClick(v.xmin + ((px - left) / plotW) * (v.xmax - v.xmin), v.ymin + ((MARGIN.top + plotH - py) / plotH) * (v.ymax - v.ymin));
      });
    }

    /**
     * Zeichnet alles neu.
     * @param {Object} spec - Siehe Dateikopf.
     */
    function render(spec) {
      const view = spec.view;
      currentView = view;
      const yTicks = ticksOf(view.ymin, view.ymax);
      const longest = Math.max(0, ...yTicks.map((t) => ns.simFormat.num(t).length));
      left = MARGIN.left + Math.max(0, longest - TICK_CHARS) * CHAR_WIDTH;
      const plotW = WIDTH - left - MARGIN.right;
      const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
      const sx = (x) => left + ((x - view.xmin) / (view.xmax - view.xmin)) * plotW;
      const sy = (y) => MARGIN.top + plotH - ((y - view.ymin) / (view.ymax - view.ymin)) * plotH;
      dom.clear(root);

      root.appendChild(dom.svg('defs', null, dom.svg('clipPath', { id: clipId }, dom.svg('rect', { x: left, y: MARGIN.top, width: plotW, height: plotH }))));
      const clipped = dom.svg('g', { 'clip-path': 'url(#' + clipId + ')' });
      for (const region of spec.regions || []) {
        const d = region.polygon.map((p, i) => (i === 0 ? 'M' : 'L') + r2(sx(p[0])) + ' ' + r2(sy(p[1]))).join('') + 'Z';
        clipped.appendChild(dom.svg('path', { d, class: 'plot-region ' + (region.cls || '') }, region.title ? dom.svg('title', null, region.title) : null));
      }
      root.appendChild(clipped);

      const grid = dom.svg('g', { class: 'plot-grid' });
      const labels = dom.svg('g', { class: 'plot-tick-labels' });
      const xTicks = spec.xTicks || ticksOf(view.xmin, view.xmax).map((t) => ({ x: t, text: ns.simFormat.num(t) }));
      for (const t of xTicks) {
        grid.appendChild(dom.svg('line', { x1: r2(sx(t.x)), x2: r2(sx(t.x)), y1: MARGIN.top, y2: MARGIN.top + plotH}));
        labels.appendChild(dom.svg('text', { x: r2(sx(t.x)), y: MARGIN.top + plotH + 18, 'text-anchor': 'middle' }, t.text));
      }
      for (const t of yTicks) {
        grid.appendChild(dom.svg('line', { x1: left, x2: left + plotW, y1: r2(sy(t)), y2: r2(sy(t))}));
        labels.appendChild(dom.svg('text', { x: left - 8, y: r2(sy(t)) + 4, 'text-anchor': 'end' }, ns.simFormat.num(t)));
      }
      root.appendChild(grid);
      const axes = dom.svg('g', { class: 'plot-axes' });
      if (view.ymin <= 0 && view.ymax >= 0) {
        const y = r2(sy(0));
        const end = left + plotW;
        axes.appendChild(dom.svg('g', { class: 'plot-axis', 'data-axis': 'x' }, [
          dom.svg('line', { x1: left, y1: y, x2: end, y2: y }),
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
      root.appendChild(dom.svg('rect', { class: 'plot-frame', x: left, y: MARGIN.top, width: plotW, height: plotH }));
      root.appendChild(labels);
      root.appendChild(dom.svg('text', { class: 'plot-axis-label', x: left + plotW / 2, y: HEIGHT - 10, 'text-anchor': 'middle' }, spec.xLabel));
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
        const m = marker(p.shape || 'circle', sx(p.x), sy(p.y), p.r || (p.ring === 'current' ? MARKER_R + 1 : MARKER_R));
        m.setAttribute('class', 'plot-marker ' + (p.cls || ''));
        group.appendChild(m);
        if (p.text) {
          group.appendChild(dom.svg('text', { class: 'plot-point-text', x: r2(sx(p.x)), y: r2(sy(p.y)) + 4, 'text-anchor': 'middle' }, p.text));
        }
        if (p.title) {
          group.appendChild(dom.svg('title', null, p.title));
        }
        marks.appendChild(group);
      }
      root.appendChild(marks);

      for (const label of spec.labels || []) {
        root.appendChild(dom.svg('text', { class: 'plot-label ' + (label.cls || ''), x: r2(sx(label.x)), y: r2(sy(label.y)), 'text-anchor': label.anchor || 'start' }, label.text));
      }
    }

    return { render, screenOf, view: () => currentView };
  }

  ns.coordPlot = { create, fitView, markerIcon };
})(window.BB = window.BB || {});
