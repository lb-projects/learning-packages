/**
 * @file chart.js
 * @description Selbst implementierte SVG-Diagramme: Streudiagramm der Datenpunkte
 *              (mit Metrik-Visualisierung) und Balkendiagramm der Trefferquoten.
 *
 * Streudiagramm – Eigenschaften:
 *   - x- und y-Achse sind gleich skaliert (eine Einheit ist in beiden Richtungen
 *     gleich lang), Gitterlinien in Einer-Schritten.
 *   - Bei großen Wertebereichen wird nur die Beschriftung ausgedünnt
 *     (z. B. jede 5. oder 10. Zahl); sind Einer-Schritte zu eng für eine
 *     sinnvolle Darstellung (< 3 Bildpunkte), werden nur die beschrifteten
 *     Gitterlinien gezeichnet.
 *   - Jedes Label erhält eine eigene Farbe UND eine eigene Markerform, damit
 *     die Klassen auch bei Farbsehschwäche unterscheidbar sind.
 *   - Optionale Ebenen: Metrik-Form (Kreis bei euklidischer, Raute bei
 *     Manhattan-Metrik; Radius = Abstand zum k-ten Nachbarn), Linien zu den
 *     Nachbarn (bei Manhattan als Weg entlang der Achsen), Rangnummern,
 *     Validierungspunkte als Hohlmarker, Auswahlring.
 *
 * Abhängigkeiten:
 *   dom-utils.js (KNN.dom)
 *
 * Sicherheitsaspekte:
 *   - Alle Elemente werden mit createElementNS erzeugt; Texte (Achsen,
 *     Tooltips mit Labels) ausschließlich als Textknoten.
 *   - Farben werden nur über CSS-Klassen (label-0 … label-9) vergeben,
 *     nie über Stil-Attribute aus Daten.
 *   - Attributwerte bestehen nur aus selbst berechneten Zahlen.
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;

  /** Ränder um die Zeichenfläche (in viewBox-Einheiten). */
  const MARGIN = { left: 58, right: 16, top: 16, bottom: 50 };
  /** Länge der längeren Seite der Zeichenfläche (viewBox-Einheiten). */
  const PLOT_SIZE = 560;
  /** Radius der Punktmarker. */
  const MARKER_R = 6;
  /** Mögliche Abstände der Achsenbeschriftung. */
  const LABEL_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
  /** Maximale Anzahl Nachbarn, die eine Rangnummer erhalten. */
  const MAX_RANK_LABELS = 20;

  /** Zähler für eindeutige IDs (clipPath) je Diagramm. */
  let chartCounter = 0;

  /**
   * Rundet auf 2 Nachkommastellen für kompakte SVG-Attribute.
   * @param {number} v - Zahl.
   * @returns {string} Gerundete Zahl als Text.
   */
  function fmt(v) {
    return String(Math.round(v * 100) / 100);
  }

  /**
   * Erzeugt die Eckpunkte eines regelmäßigen Polygons bzw. Sterns als SVG-Pfad.
   *
   * @param {number} cx - Mittelpunkt x.
   * @param {number} cy - Mittelpunkt y.
   * @param {number[]} radii - Radien, die reihum verwendet werden (2 Werte = Stern).
   * @param {number} corners - Anzahl der Ecken.
   * @param {number} rotation - Drehung in Grad (0 = erste Ecke oben).
   * @returns {string} SVG-Pfaddaten.
   */
  function polygonPath(cx, cy, radii, corners, rotation) {
    let d = '';
    for (let i = 0; i < corners; i++) {
      const angle = ((rotation + (360 * i) / corners) * Math.PI) / 180;
      const r = radii[i % radii.length];
      d += (i === 0 ? 'M' : 'L') + fmt(cx + r * Math.sin(angle)) + ' ' + fmt(cy - r * Math.cos(angle));
    }
    return d + 'Z';
  }

  /**
   * Liefert den SVG-Pfad der Markerform für einen Farbindex.
   * Formen: 0 Kreis, 1 Quadrat, 2 Dreieck, 3 Raute, 4 Dreieck (Spitze unten),
   * 5 Plus, 6 Stern, 7 Sechseck, 8 Kreuz, 9 Fünfeck.
   *
   * @param {number} shape - Formindex (0 … 9).
   * @param {number} cx - Mittelpunkt x.
   * @param {number} cy - Mittelpunkt y.
   * @param {number} r - Radius.
   * @returns {string} SVG-Pfaddaten.
   */
  function markerPath(shape, cx, cy, r) {
    const w = r * 0.42;
    switch (shape) {
      case 1: return polygonPath(cx, cy, [r * 1.15], 4, 45);
      case 2: return polygonPath(cx, cy, [r * 1.25], 3, 0);
      case 3: return polygonPath(cx, cy, [r * 1.3], 4, 0);
      case 4: return polygonPath(cx, cy, [r * 1.25], 3, 180);
      case 5: return 'M' + fmt(cx - w) + ' ' + fmt(cy - r) + 'H' + fmt(cx + w) + 'V' + fmt(cy - w) +
        'H' + fmt(cx + r) + 'V' + fmt(cy + w) + 'H' + fmt(cx + w) + 'V' + fmt(cy + r) +
        'H' + fmt(cx - w) + 'V' + fmt(cy + w) + 'H' + fmt(cx - r) + 'V' + fmt(cy - w) + 'H' + fmt(cx - w) + 'Z';
      case 6: return polygonPath(cx, cy, [r * 1.35, r * 0.6], 10, 0);
      case 7: return polygonPath(cx, cy, [r * 1.1], 6, 30);
      case 8: return polygonPath(cx, cy, [r * 1.25, w], 8, 45);
      case 9: return polygonPath(cx, cy, [r * 1.15], 5, 0);
      default:
        return 'M' + fmt(cx - r) + ' ' + fmt(cy) + 'a' + fmt(r) + ' ' + fmt(r) + ' 0 1 0 ' + fmt(2 * r) +
          ' 0a' + fmt(r) + ' ' + fmt(r) + ' 0 1 0 ' + fmt(-2 * r) + ' 0Z';
    }
  }

  /**
   * Erzeugt ein kleines eigenständiges SVG mit einem Marker (für Legenden und Tabellen).
   *
   * @param {number} labelIndex - Farb-/Formindex (−1 = unbekannt).
   * @param {boolean} [hollow=false] - Als Hohlmarker (Validierungspunkt) zeichnen.
   * @returns {SVGElement} Mini-SVG.
   */
  function markerIcon(labelIndex, hollow) {
    const index = labelIndex >= 0 ? labelIndex : 0;
    return dom.svgEl('svg', { class: 'marker-icon', viewBox: '0 0 20 20', width: 16, height: 16, 'aria-hidden': 'true', focusable: 'false' }, [
      dom.svgEl('path', {
        d: markerPath(index, 10, 10, 6),
        class: 'pt label-' + index + (hollow ? ' is-validation' : '') + (labelIndex < 0 ? ' unknown' : '')
      })
    ]);
  }

  /**
   * Ermittelt den darzustellenden Wertebereich (ganzzahlig, mit Rand von 1).
   *
   * @param {Array<{x:number, y:number}>} coords - Alle zu zeigenden Koordinaten.
   * @returns {{xMin:number, xMax:number, yMin:number, yMax:number}} Wertebereich.
   */
  function computeBounds(coords) {
    if (coords.length === 0) {
      return { xMin: 0, xMax: 10, yMin: 0, yMax: 10 };
    }
    let xMin = Infinity;
    let xMax = -Infinity;
    let yMin = Infinity;
    let yMax = -Infinity;
    for (const c of coords) {
      xMin = Math.min(xMin, c.x);
      xMax = Math.max(xMax, c.x);
      yMin = Math.min(yMin, c.y);
      yMax = Math.max(yMax, c.y);
    }
    const bounds = {
      xMin: Math.floor(xMin) - 1,
      xMax: Math.ceil(xMax) + 1,
      yMin: Math.floor(yMin) - 1,
      yMax: Math.ceil(yMax) + 1
    };
    /**
     * Vergrößert einen Bereich symmetrisch (ganzzahlig) auf mindestens `span`.
     * @param {string} minKey - Schlüssel des Minimums.
     * @param {string} maxKey - Schlüssel des Maximums.
     * @param {number} span - Mindestbreite.
     */
    function widen(minKey, maxKey, span) {
      const missing = Math.ceil(span) - (bounds[maxKey] - bounds[minKey]);
      if (missing > 0) {
        bounds[minKey] -= Math.floor(missing / 2);
        bounds[maxKey] += Math.ceil(missing / 2);
      }
    }
    // Mindestgröße und kein zu extremes Seitenverhältnis (lesbarer Ausschnitt).
    widen('xMin', 'xMax', 6);
    widen('yMin', 'yMax', 6);
    widen('xMin', 'xMax', (bounds.yMax - bounds.yMin) * 0.75);
    widen('yMin', 'yMax', (bounds.xMax - bounds.xMin) * 0.5);
    return bounds;
  }

  /**
   * Wählt den Abstand der Achsenbeschriftung, sodass Beschriftungen mindestens
   * `minPixels` auseinanderliegen.
   *
   * @param {number} unit - Länge einer Einheit in viewBox-Einheiten.
   * @param {number} minPixels - Mindestabstand.
   * @returns {number} Beschriftungsabstand.
   */
  function chooseLabelStep(unit, minPixels) {
    for (const step of LABEL_STEPS) {
      if (step * unit >= minPixels) {
        return step;
      }
    }
    return LABEL_STEPS[LABEL_STEPS.length - 1];
  }

  /**
   * Streudiagramm für Datenpunkte.
   */
  class ScatterChart {
    /**
     * @param {HTMLElement} container - Element, in das das Diagramm gezeichnet wird.
     * @param {Object} [options] - Optionen.
     * @param {string} [options.ariaLabel] - Beschreibung für Screenreader.
     * @param {function(Object): void} [options.onPointClick] - Wird beim Klick auf einen Punkt aufgerufen.
     * @param {function({x:number, y:number}): void} [options.onPlaneClick] - Wird beim Klick
     *        auf eine freie Stelle mit den (auf 0,1 gerundeten) Koordinaten aufgerufen.
     */
    constructor(container, options) {
      this.container = container;
      this.options = options || {};
      this.clipId = 'knn-clip-' + (++chartCounter);
      this.layout = null;
      this.drawnPoints = [];
      container.classList.add('chart');
      this.svg = dom.svgEl('svg', {
        class: 'scatter',
        role: 'img',
        'aria-label': this.options.ariaLabel || 'Diagramm der Datenpunkte'
      });
      this.legend = dom.el('ul', { class: 'legend', 'aria-label': 'Legende' });
      container.appendChild(this.svg);
      container.appendChild(this.legend);
      if (this.options.onPointClick || this.options.onPlaneClick) {
        this.svg.classList.add('clickable');
        this.svg.addEventListener('click', (event) => this.handleClick(event));
      }
    }

    /**
     * Rechnet Datenkoordinaten in viewBox-Koordinaten um.
     * @param {number} x - Datenwert x.
     * @param {number} y - Datenwert y.
     * @returns {{sx:number, sy:number}} Bildschirmkoordinaten im SVG.
     */
    toSvg(x, y) {
      const l = this.layout;
      return {
        sx: MARGIN.left + (x - l.xMin) * l.unit,
        sy: MARGIN.top + (l.yMax - y) * l.unit
      };
    }

    /**
     * Wertet einen Mausklick aus: nächstgelegener Punkt oder freie Stelle.
     * @param {MouseEvent} event - Klickereignis.
     */
    handleClick(event) {
      if (!this.layout) {
        return;
      }
      const ctm = this.svg.getScreenCTM();
      if (!ctm) {
        return;
      }
      const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
      // Nächsten gezeichneten Punkt innerhalb von 14 Einheiten suchen.
      let best = null;
      let bestDist = 14;
      for (const point of this.drawnPoints) {
        const s = this.toSvg(point.x, point.y);
        const d = Math.hypot(s.sx - p.x, s.sy - p.y);
        if (d <= bestDist) {
          best = point;
          bestDist = d;
        }
      }
      if (best && this.options.onPointClick) {
        this.options.onPointClick(best);
        return;
      }
      const l = this.layout;
      const inside = p.x >= MARGIN.left && p.x <= MARGIN.left + l.width &&
        p.y >= MARGIN.top && p.y <= MARGIN.top + l.height;
      if (inside && this.options.onPlaneClick) {
        const x = Math.round((l.xMin + (p.x - MARGIN.left) / l.unit) * 10) / 10;
        const y = Math.round((l.yMax - (p.y - MARGIN.top) / l.unit) * 10) / 10;
        this.options.onPlaneClick({ x, y });
      }
    }

    /**
     * Zeichnet das Diagramm vollständig neu.
     *
     * @param {Object} view - Darzustellender Zustand.
     * @param {Array<{id:number, x:number, y:number, label:string}>} view.points - Datenpunkte.
     * @param {{x:string, y:string}} view.axisLabels - Achsenbeschriftungen.
     * @param {function(string): number} view.labelIndex - Liefert den Farbindex eines Labels.
     * @param {string[]} [view.labels] - Labels für die Legende (in Farbreihenfolge).
     * @param {string} [view.queryLegend] - Legendentext für den hervorgehobenen Abfragepunkt.
     * @param {Set<number>} [view.validationIds] - IDs der Validierungspunkte (Hohlmarker).
     * @param {string} [view.hollowName] - Bezeichnung der Hohlmarker in Legende und Tooltip
     *        (Standard "Validierungspunkt", auf Seite 7 "Testpunkt").
     * @param {number|null} [view.selectedId] - ID des hervorgehobenen Punkts.
     * @param {{x:number, y:number, label:(string|null)}|null} [view.query] - Neuer Punkt
     *        (wird zusätzlich als großer Marker gezeichnet).
     * @param {{x:number, y:number}|null} [view.origin] - Ausgangspunkt für Nachbarlinien
     *        und Metrik-Form (Standard: query).
     * @param {Array<{point:Object, distance:number}>} [view.neighbors] - Nächste Nachbarn.
     * @param {string} [view.metric] - "euclidean" oder "manhattan".
     * @param {number} [view.radius] - Radius der Metrik-Form (Abstand zum k-ten Nachbarn).
     */
    render(view) {
      const svg = dom.clear(this.svg);
      const points = view.points || [];
      const validationIds = view.validationIds || new Set();
      const neighbors = view.neighbors || [];
      const origin = view.origin || view.query || null;
      const hollowName = view.hollowName || 'Validierungspunkt';

      // --- Layout: gleiche Skalierung in x und y -----------------------------
      const coords = points.slice();
      if (view.query) {
        coords.push(view.query);
      }
      const b = computeBounds(coords);
      const xSpan = b.xMax - b.xMin;
      const ySpan = b.yMax - b.yMin;
      const unit = PLOT_SIZE / Math.max(xSpan, ySpan);
      const width = xSpan * unit;
      const height = ySpan * unit;
      this.layout = { xMin: b.xMin, xMax: b.xMax, yMin: b.yMin, yMax: b.yMax, unit, width, height };
      const totalW = MARGIN.left + width + MARGIN.right;
      const totalH = MARGIN.top + height + MARGIN.bottom;
      svg.setAttribute('viewBox', '0 0 ' + fmt(totalW) + ' ' + fmt(totalH));

      const left = MARGIN.left;
      const top = MARGIN.top;
      const right = left + width;
      const bottom = top + height;

      // Zuschneidebereich: Metrik-Form und Linien bleiben in der Zeichenfläche.
      svg.appendChild(dom.svgEl('defs', null, [
        dom.svgEl('clipPath', { id: this.clipId }, [
          dom.svgEl('rect', { x: fmt(left), y: fmt(top), width: fmt(width), height: fmt(height) })
        ])
      ]));
      svg.appendChild(dom.svgEl('rect', { class: 'plot-bg', x: fmt(left), y: fmt(top), width: fmt(width), height: fmt(height) }));

      // --- Gitter und Achsenbeschriftung ----------------------------------------
      const labelStep = chooseLabelStep(unit, 28);
      const drawMinor = unit >= 3;
      const grid = dom.svgEl('g', { class: 'grid', 'aria-hidden': 'true' });
      for (let x = b.xMin; x <= b.xMax; x++) {
        const isMajor = x % labelStep === 0;
        if (!drawMinor && !isMajor) {
          continue;
        }
        const sx = this.toSvg(x, 0).sx;
        grid.appendChild(dom.svgEl('line', {
          class: x === 0 ? 'axis-zero' : (isMajor ? 'grid-major' : 'grid-minor'),
          x1: fmt(sx), y1: fmt(top), x2: fmt(sx), y2: fmt(bottom)
        }));
        if (isMajor) {
          grid.appendChild(dom.svgEl('text', { class: 'tick', x: fmt(sx), y: fmt(bottom + 16), 'text-anchor': 'middle' }, dom.formatNumber(x)));
        }
      }
      for (let y = b.yMin; y <= b.yMax; y++) {
        const isMajor = y % labelStep === 0;
        if (!drawMinor && !isMajor) {
          continue;
        }
        const sy = this.toSvg(0, y).sy;
        grid.appendChild(dom.svgEl('line', {
          class: y === 0 ? 'axis-zero' : (isMajor ? 'grid-major' : 'grid-minor'),
          x1: fmt(left), y1: fmt(sy), x2: fmt(right), y2: fmt(sy)
        }));
        if (isMajor) {
          grid.appendChild(dom.svgEl('text', { class: 'tick', x: fmt(left - 6), y: fmt(sy + 4), 'text-anchor': 'end' }, dom.formatNumber(y)));
        }
      }
      grid.appendChild(dom.svgEl('rect', { class: 'plot-frame', x: fmt(left), y: fmt(top), width: fmt(width), height: fmt(height) }));
      svg.appendChild(grid);

      // Achsentitel (Text aus Datei/Eingabe → nur als Textknoten).
      const axis = view.axisLabels || { x: 'x', y: 'y' };
      svg.appendChild(dom.svgEl('text', { class: 'axis-title', x: fmt(left + width / 2), y: fmt(bottom + 40), 'text-anchor': 'middle' }, axis.x));
      const yTitleX = 16;
      const yTitleY = top + height / 2;
      svg.appendChild(dom.svgEl('text', {
        class: 'axis-title', x: fmt(yTitleX), y: fmt(yTitleY), 'text-anchor': 'middle',
        transform: 'rotate(-90 ' + fmt(yTitleX) + ' ' + fmt(yTitleY) + ')'
      }, axis.y));

      // --- Metrik-Form und Nachbarlinien --------------------------------------
      const overlay = dom.svgEl('g', { 'clip-path': 'url(#' + this.clipId + ')' });
      if (origin && neighbors.length > 0 && view.radius > 0) {
        const o = this.toSvg(origin.x, origin.y);
        const r = view.radius * unit;
        if (view.metric === 'manhattan') {
          overlay.appendChild(dom.svgEl('path', {
            class: 'metric-shape',
            d: 'M' + fmt(o.sx) + ' ' + fmt(o.sy - r) + 'L' + fmt(o.sx + r) + ' ' + fmt(o.sy) +
              'L' + fmt(o.sx) + ' ' + fmt(o.sy + r) + 'L' + fmt(o.sx - r) + ' ' + fmt(o.sy) + 'Z'
          }));
        } else {
          overlay.appendChild(dom.svgEl('circle', { class: 'metric-shape', cx: fmt(o.sx), cy: fmt(o.sy), r: fmt(r) }));
        }
      }
      if (origin) {
        const o = this.toSvg(origin.x, origin.y);
        for (const n of neighbors) {
          const s = this.toSvg(n.point.x, n.point.y);
          // Manhattan: Weg erst waagerecht, dann senkrecht – zeigt die Summe |Δx| + |Δy|.
          const d = view.metric === 'manhattan'
            ? 'M' + fmt(o.sx) + ' ' + fmt(o.sy) + 'H' + fmt(s.sx) + 'V' + fmt(s.sy)
            : 'M' + fmt(o.sx) + ' ' + fmt(o.sy) + 'L' + fmt(s.sx) + ' ' + fmt(s.sy);
          overlay.appendChild(dom.svgEl('path', { class: 'nb-line', d }));
        }
      }
      svg.appendChild(overlay);

      // --- Datenpunkte -----------------------------------------------------------
      const pointLayer = dom.svgEl('g', { class: 'points' });
      for (const p of points) {
        const s = this.toSvg(p.x, p.y);
        const index = view.labelIndex(p.label);
        const isVal = validationIds.has(p.id);
        pointLayer.appendChild(dom.svgEl('path', {
          class: 'pt label-' + Math.max(0, index) + (isVal ? ' is-validation' : '') + (index < 0 ? ' unknown' : ''),
          d: markerPath(Math.max(0, index), s.sx, s.sy, MARKER_R)
        }, [dom.svgEl('title', null, dom.describePoint(p) + (isVal ? ' (' + hollowName + ')' : ''))]));
      }
      svg.appendChild(pointLayer);
      this.drawnPoints = points;

      // --- Hervorhebungen: Nachbarn, Auswahl, neuer Punkt -----------------------
      const marks = dom.svgEl('g', { class: 'marks', 'aria-hidden': 'true' });
      neighbors.forEach((n, i) => {
        const s = this.toSvg(n.point.x, n.point.y);
        marks.appendChild(dom.svgEl('circle', { class: 'nb-ring', cx: fmt(s.sx), cy: fmt(s.sy), r: MARKER_R + 4 }));
        if (neighbors.length <= MAX_RANK_LABELS) {
          marks.appendChild(dom.svgEl('text', { class: 'nb-rank', x: fmt(s.sx + 9), y: fmt(s.sy - 9) }, String(i + 1)));
        }
      });
      if (view.selectedId !== null && view.selectedId !== undefined) {
        const sel = points.find((p) => p.id === view.selectedId);
        if (sel) {
          const s = this.toSvg(sel.x, sel.y);
          marks.appendChild(dom.svgEl('circle', { class: 'sel-ring', cx: fmt(s.sx), cy: fmt(s.sy), r: MARKER_R + 7 }));
        }
      }
      if (view.query) {
        const s = this.toSvg(view.query.x, view.query.y);
        const qIndex = view.query.label !== null && view.query.label !== undefined ? view.labelIndex(view.query.label) : -1;
        marks.appendChild(dom.svgEl('circle', { class: 'query-ring', cx: fmt(s.sx), cy: fmt(s.sy), r: MARKER_R + 9 }));
        marks.appendChild(dom.svgEl('path', {
          class: 'pt query ' + (qIndex >= 0 ? 'label-' + qIndex : 'unknown'),
          d: markerPath(qIndex >= 0 ? qIndex : 0, s.sx, s.sy, MARKER_R + 2)
        }));
        if (qIndex < 0) {
          marks.appendChild(dom.svgEl('text', { class: 'query-unknown', x: fmt(s.sx), y: fmt(s.sy + 4), 'text-anchor': 'middle' }, '?'));
        }
      }
      svg.appendChild(marks);

      this.renderLegend(view, points, validationIds, neighbors);
    }

    /**
     * Baut die Legende unterhalb des Diagramms auf.
     * @param {Object} view - Darzustellender Zustand (siehe render).
     * @param {Array} points - Datenpunkte.
     * @param {Set<number>} validationIds - Validierungs-IDs.
     * @param {Array} neighbors - Nachbarn.
     */
    renderLegend(view, points, validationIds, neighbors) {
      const legend = dom.clear(this.legend);
      const labels = (view.labels || []).filter((label) => view.labelIndex(label) >= 0);
      for (const label of labels) {
        legend.appendChild(dom.el('li', null, [markerIcon(view.labelIndex(label)), label]));
      }
      if (points.some((p) => validationIds.has(p.id))) {
        legend.appendChild(dom.el('li', null, [markerIcon(0, true), (view.hollowName || 'Validierungspunkt') + ' (Hohlmarker)']));
      }
      if (view.query) {
        legend.appendChild(dom.el('li', { class: 'legend-query' }, [view.queryLegend || 'neuer Datenpunkt (gestrichelter Ring)']));
      }
      if (neighbors.length > 0) {
        legend.appendChild(dom.el('li', { class: 'legend-neighbor' }, [
          'k = ' + neighbors.length + ' nächste Nachbarn (Ring, Nummer = Rang); ' +
          (view.metric === 'manhattan' ? 'Raute' : 'Kreis') + ' = Abstand zum k-ten Nachbarn'
        ]));
      }
      legend.hidden = legend.childNodes.length === 0;
    }
  }

  /**
   * Zeichnet ein Balkendiagramm der Trefferquote je k (Seite 6).
   *
   * @param {HTMLElement} container - Zielelement (wird geleert).
   * @param {Array<{k:number, rate:number}>} data - Trefferquote je k (0 … 1).
   * @param {Set<number>} bestKs - k-Werte mit der höchsten Trefferquote (hervorgehoben).
   */
  function renderBarChart(container, data, bestKs) {
    dom.clear(container);
    if (data.length === 0) {
      return;
    }
    const m = { left: 50, right: 12, top: 14, bottom: 46 };
    // Feste Zeichenbreite: Schrift und Balken wirken unabhängig von der Anzahl der k gleich groß.
    const plotW = 900;
    const plotH = 260;
    const barW = plotW / data.length;
    const svg = dom.svgEl('svg', {
      class: 'bars', role: 'img',
      viewBox: '0 0 ' + (m.left + plotW + m.right) + ' ' + (m.top + plotH + m.bottom),
      'aria-label': 'Balkendiagramm der Trefferquote je k'
    });
    // Waagerechte Hilfslinien bei 0, 25, 50, 75, 100 %.
    for (let pct = 0; pct <= 100; pct += 25) {
      const y = m.top + plotH * (1 - pct / 100);
      svg.appendChild(dom.svgEl('line', { class: pct === 0 ? 'axis-zero' : 'grid-major', x1: m.left, y1: fmt(y), x2: m.left + plotW, y2: fmt(y) }));
      svg.appendChild(dom.svgEl('text', { class: 'tick', x: m.left - 6, y: fmt(y + 4), 'text-anchor': 'end' }, pct + ' %'));
    }
    const labelEvery = Math.ceil(data.length / 40);
    data.forEach((d, i) => {
      const h = plotH * d.rate;
      const x = m.left + i * barW;
      const bar = dom.svgEl('rect', {
        class: 'bar' + (bestKs.has(d.k) ? ' best' : ''),
        x: fmt(x + barW * 0.15), y: fmt(m.top + plotH - h), width: fmt(barW * 0.7), height: fmt(Math.max(h, 0.5))
      }, [dom.svgEl('title', null, 'k = ' + d.k + ': ' + dom.formatPercent(d.rate))]);
      svg.appendChild(bar);
      if (d.k === 1 || d.k % labelEvery === 0 || bestKs.has(d.k)) {
        svg.appendChild(dom.svgEl('text', { class: 'tick' + (bestKs.has(d.k) ? ' best' : ''), x: fmt(x + barW / 2), y: m.top + plotH + 16, 'text-anchor': 'middle' }, String(d.k)));
      }
    });
    svg.appendChild(dom.svgEl('text', { class: 'axis-title', x: fmt(m.left + plotW / 2), y: m.top + plotH + 40, 'text-anchor': 'middle' }, 'k'));
    container.appendChild(svg);
  }

  ns.chart = { ScatterChart, renderBarChart, markerIcon, markerPath, computeBounds };
})(window.KNN = window.KNN || {});
