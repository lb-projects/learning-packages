/**
 * @file graph-view.js
 * @description Zeichnet den Graphen als SVG – für alle Seiten.
 *
 * Darstellung:
 *   - Knoten als Ellipse mit Namen (Breite passt sich dem Namen an), darunter optional ein
 *     Zusatztext (z. B. Distanz oder Besuchsnummer).
 *   - Kanten als Linie; gerichtet mit Pfeilspitze. Gibt es bei einem gerichteten Graphen
 *     auch die Gegenkante, werden beide leicht gebogen gezeichnet.
 *   - Gewichte in der Kantenmitte (nur, wenn mindestens ein Gewicht von 1 abweicht).
 *   - Zustände aus den Algorithmen als CSS-Klassen (node-frontier, edge-tree, …). Neben der
 *     Farbe unterscheiden Strichart und -stärke bzw. Füllung die Zustände (farbenblindfreundlich).
 *
 * Bedienung:
 *   - Knoten lassen sich mit Maus, Stift oder Finger verschieben (Pointer Events).
 *     Die neue Position wird beim Loslassen im Graphen gespeichert und erscheint in allen Ansichten.
 *   - Ein Klick ohne Verschieben ruft options.onNodeClick auf. Sind die Knoten anklickbar
 *     (view.clickable), lassen sie sich auch mit der Tastatur erreichen (Tabulator) und mit
 *     Eingabe- oder Leertaste auswählen; view.nodeLabel(node) liefert dann den Text für Screenreader.
 *   - Optional melden Kanten, über denen der Zeiger steht (options.onEdgeHover).
 *
 * Abhängigkeiten:
 *   dom-utils.js, format-utils.js, graph.js
 *
 * Sicherheitsaspekte:
 *   Alle Texte (Knotennamen, Gewichte) werden über dom.svg als Textknoten eingefügt.
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;

  /** Halbe Höhe eines Knotens. */
  const NODE_RY = 18;
  /** Abstand der Bögen bei Kante und Gegenkante. */
  const CURVE_OFFSET = 26;
  /** Arten der Pfeilspitzen (je Kantenzustand eine eigene, damit die Farbe passt). */
  const ARROW_KINDS = ['normal', 'tree', 'checked', 'active', 'path', 'faded', 'hover', 'cycle', 'dim'];
  /** Bewegung in Pixeln, ab der aus einem Klick ein Verschieben wird. */
  const DRAG_THRESHOLD = 4;

  let viewCounter = 0;

  /**
   * Halbe Breite eines Knotens (abhängig von der Länge des Namens).
   * @param {string} name - Knotenname.
   * @returns {number} Halbachse in x-Richtung.
   */
  function nodeRx(name) {
    return Math.max(NODE_RY, Math.round(9 + name.length * 4.6));
  }

  /**
   * Schnittpunkt der Geraden vom Mittelpunkt in Richtung (dx, dy) mit dem Ellipsenrand.
   * @returns {{x:number, y:number}} Randpunkt.
   */
  function ellipseBorder(cx, cy, rx, ry, dx, dy) {
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const t = 1 / Math.sqrt((ux * ux) / (rx * rx) + (uy * uy) / (ry * ry));
    return { x: cx + ux * t, y: cy + uy * t };
  }

  /**
   * Erzeugt eine Ansicht.
   *
   * @param {HTMLElement} container - Behälter (wird geleert).
   * @param {{label:string, draggable?:boolean, onNodeClick?:function(number):void,
   *          onEdgeHover?:function(number|null):void}} options - Einstellungen.
   * @returns {{render: function(Object=):void, highlightEdge: function(number|null):void}} Steuerung.
   */
  function create(container, options) {
    const opts = options || {};
    const prefix = 'gv' + (++viewCounter);
    const area = ns.graph.AREA;
    const svgEl = dom.svg('svg', {
      class: 'graph-svg',
      viewBox: '0 0 ' + area.width + ' ' + area.height,
      role: 'img',
      'aria-label': opts.label || 'Zeichnung des Graphen'
    });
    const defs = dom.svg('defs');
    for (const kind of ARROW_KINDS) {
      defs.appendChild(dom.svg('marker', {
        id: prefix + '-arrow-' + kind,
        viewBox: '0 0 10 10',
        refX: '10',
        refY: '5',
        markerWidth: '11',
        markerHeight: '11',
        markerUnits: 'userSpaceOnUse',
        orient: 'auto'
      }, dom.svg('path', { d: 'M0,0 L10,5 L0,10 z', class: 'arrow arrow-' + kind })));
    }
    svgEl.appendChild(defs);
    const edgeLayer = dom.svg('g', { class: 'edge-layer' });
    const nodeLayer = dom.svg('g', { class: 'node-layer' });
    svgEl.appendChild(edgeLayer);
    svgEl.appendChild(nodeLayer);
    const empty = dom.el('p', { class: 'graph-empty' }, 'Noch kein Graph vorhanden.');
    dom.clear(container);
    container.appendChild(svgEl);
    container.appendChild(empty);

    /** Zuletzt gezeichnete Ansicht (für das Neuzeichnen beim Ziehen). */
    let lastView = {};
    /** Position des gerade gezogenen Knotens: {id, x, y} oder null. */
    let dragging = null;
    /** Hervorgehobene Kante (Hover aus einer anderen Ansicht). */
    let highlighted = null;
    /** Kanten-ID → Gruppe. */
    let edgeGroups = new Map();

    /** @returns {{x:number, y:number}} Position eines Knotens (beim Ziehen die vorläufige). */
    function positionOf(node) {
      return dragging && dragging.id === node.id && dragging.moved ? { x: dragging.x, y: dragging.y } : { x: node.x, y: node.y };
    }

    /**
     * Klasse eines Knotens.
     * @param {Object} view - Ansicht.
     * @param {number} id - Knoten-ID.
     * @returns {string} Klassen.
     */
    function nodeClass(view, id) {
      const classes = ['node'];
      classes.push(view.status ? 'node-' + (view.status.get(id) || 'unvisited') : 'node-plain');
      if (opts.draggable) {
        classes.push('node-draggable');
      }
      if (view.clickable) {
        classes.push('node-clickable');
      }
      if (view.marked && view.marked.has(id)) {
        classes.push('node-marked');
      }
      return classes.join(' ');
    }

    /**
     * Zustand einer Kante.
     * @param {Object} view - Ansicht.
     * @param {Object} edge - Kante.
     * @returns {string} Art (für Klasse und Pfeilspitze).
     */
    function edgeKind(view, edge) {
      if (view.cycleEdges && view.cycleEdges.has(edge.id)) {
        return 'cycle';
      }
      if (view.activeEdge === edge.id) {
        return 'active';
      }
      const state = view.edges ? view.edges.get(edge.id) : undefined;
      if (state === 'path') {
        return 'path';
      }
      if (view.tree) {
        return view.tree.has(edge.id) ? 'tree' : 'faded';
      }
      if (view.status && (view.status.get(edge.from) === 'unreachable' || view.status.get(edge.to) === 'unreachable')) {
        return 'dim';
      }
      return state || 'normal';
    }

    /** Zeichnet alle Kanten. */
    function drawEdges(view, nodesById, weighted, directed) {
      dom.clear(edgeLayer);
      edgeGroups = new Map();
      const all = ns.graph.getEdges();
      const pairs = new Set(all.map((e) => e.from + ':' + e.to));
      for (const edge of all) {
        const a = nodesById.get(edge.from);
        const b = nodesById.get(edge.to);
        const pa = positionOf(a);
        const pb = positionOf(b);
        const curved = directed && pairs.has(edge.to + ':' + edge.from);
        let cx = (pa.x + pb.x) / 2;
        let cy = (pa.y + pb.y) / 2;
        if (curved) {
          const len = Math.hypot(pb.x - pa.x, pb.y - pa.y) || 1;
          // Nach rechts (in Laufrichtung) ausbiegen: Hin- und Rückweg liegen dann getrennt.
          cx += (-(pb.y - pa.y) / len) * CURVE_OFFSET * 2;
          cy += ((pb.x - pa.x) / len) * CURVE_OFFSET * 2;
        }
        const s = ellipseBorder(pa.x, pa.y, nodeRx(a.name), NODE_RY, cx - pa.x, cy - pa.y);
        const t = ellipseBorder(pb.x, pb.y, nodeRx(b.name) + (directed ? 2 : 0), NODE_RY + (directed ? 2 : 0), cx - pb.x, cy - pb.y);
        const d = curved
          ? 'M' + s.x.toFixed(1) + ',' + s.y.toFixed(1) + ' Q' + cx.toFixed(1) + ',' + cy.toFixed(1) + ' ' + t.x.toFixed(1) + ',' + t.y.toFixed(1)
          : 'M' + s.x.toFixed(1) + ',' + s.y.toFixed(1) + ' L' + t.x.toFixed(1) + ',' + t.y.toFixed(1);
        const kind = edgeKind(view, edge);
        const group = dom.svg('g', { class: 'edge edge-' + kind + (highlighted === edge.id ? ' edge-hover' : ''), 'data-edge': edge.id });
        const line = dom.svg('path', { d, class: 'edge-line' });
        if (directed) {
          line.setAttribute('marker-end', 'url(#' + prefix + '-arrow-' + (highlighted === edge.id ? 'hover' : kind) + ')');
        }
        group.appendChild(line);
        group.appendChild(dom.svg('path', { d, class: 'edge-hit' }));
        if (weighted) {
          // Beschriftung am Scheitel der Kurve bzw. in der Mitte der Strecke.
          const lx = curved ? 0.25 * s.x + 0.5 * cx + 0.25 * t.x : (s.x + t.x) / 2;
          const ly = curved ? 0.25 * s.y + 0.5 * cy + 0.25 * t.y : (s.y + t.y) / 2;
          group.appendChild(dom.svg('text', { x: lx.toFixed(1), y: (ly + 5).toFixed(1), class: 'edge-weight' + (edge.weight < 0 ? ' edge-weight-negative' : '') },
            dom.formatInt(edge.weight)));
        }
        if (opts.onEdgeHover) {
          group.addEventListener('pointerenter', () => opts.onEdgeHover(edge.id));
          group.addEventListener('pointerleave', () => opts.onEdgeHover(null));
        }
        edgeGroups.set(edge.id, group);
        edgeLayer.appendChild(group);
      }
    }

    /** Zeichnet alle Knoten. */
    function drawNodes(view, list) {
      // Fokus eines anklickbaren Knotens über das Neuzeichnen hinweg erhalten (Tastaturbedienung).
      const active = document.activeElement;
      const focusedId = active && nodeLayer.contains(active) ? active.getAttribute('data-node') : null;
      dom.clear(nodeLayer);
      for (const node of list) {
        const p = positionOf(node);
        const rx = nodeRx(node.name);
        const group = dom.svg('g', {
          class: nodeClass(view, node.id),
          transform: 'translate(' + p.x + ',' + p.y + ')',
          'data-node': node.id,
          tabindex: view.clickable ? '0' : null,
          role: view.clickable ? 'button' : null,
          'aria-label': view.clickable ? (view.nodeLabel ? view.nodeLabel(node) : 'Knoten ' + node.name) : null
        });
        if (view.start === node.id) {
          group.appendChild(dom.svg('ellipse', { rx: rx + 6, ry: NODE_RY + 6, class: 'node-ring node-ring-start' }));
        }
        if (view.target === node.id) {
          group.appendChild(dom.svg('ellipse', { rx: rx + 6, ry: NODE_RY + 6, class: 'node-ring node-ring-target' }));
        }
        group.appendChild(dom.svg('ellipse', { rx, ry: NODE_RY, class: 'node-shape' }));
        group.appendChild(dom.svg('text', { y: '5', class: 'node-name' }, node.name));
        const label = view.labels ? view.labels.get(node.id) : null;
        if (label) {
          group.appendChild(dom.svg('text', { y: String(NODE_RY + 19), class: 'node-label' }, label));
        }
        if (view.start === node.id || view.target === node.id) {
          const tag = view.start === node.id && view.target === node.id ? 'Start = Ziel' : view.start === node.id ? 'Start' : 'Ziel';
          group.appendChild(dom.svg('text', { y: String(-NODE_RY - 10), class: 'node-tag' }, tag));
        }
        group.addEventListener('pointerdown', (event) => startDrag(event, node));
        if (view.clickable && opts.onNodeClick) {
          group.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              opts.onNodeClick(node.id);
            }
          });
        }
        nodeLayer.appendChild(group);
      }
      if (focusedId !== null) {
        const again = nodeLayer.querySelector('[data-node="' + focusedId + '"]');
        if (again && again.hasAttribute('tabindex')) {
          again.focus();
        }
      }
    }

    /**
     * Zeichnet den Graphen.
     * @param {Object} [view] - Zustände: {status, edges, activeEdge, labels, tree:Set, cycleEdges:Set,
     *                          marked:Set, start, target, clickable, nodeLabel}. Ohne Angabe: einfache Zeichnung.
     */
    function render(view) {
      lastView = view || {};
      const list = ns.graph.getNodes();
      const nodesById = new Map(list.map((n) => [n.id, n]));
      svgEl.classList.toggle('graph-directed', ns.graph.isDirected());
      // SVG-Elemente kennen die Eigenschaft hidden nicht; deshalb das Attribut setzen.
      svgEl.toggleAttribute('hidden', list.length === 0);
      empty.hidden = list.length > 0;
      drawEdges(lastView, nodesById, ns.graph.isWeighted(), ns.graph.isDirected());
      drawNodes(lastView, list);
    }

    /**
     * Hebt eine Kante hervor (z. B. beim Zeigen auf eine Zelle der Matrix).
     * @param {number|null} edgeId - Kante oder null.
     */
    function highlightEdge(edgeId) {
      if (highlighted === edgeId) {
        return;
      }
      for (const id of [highlighted, edgeId]) {
        const group = id === null ? null : edgeGroups.get(id);
        if (group) {
          const on = id === edgeId;
          group.classList.toggle('edge-hover', on);
          const line = group.querySelector('.edge-line');
          if (line.hasAttribute('marker-end')) {
            const kind = /edge-([a-z]+)/.exec(group.getAttribute('class'))[1];
            line.setAttribute('marker-end', 'url(#' + prefix + '-arrow-' + (on ? 'hover' : kind) + ')');
          }
        }
      }
      highlighted = edgeId;
    }

    /** Umrechnung Bildschirm → Zeichnung. */
    function toSvgPoint(event) {
      const ctm = svgEl.getScreenCTM();
      if (!ctm) {
        return { x: 0, y: 0 };
      }
      const pt = svgEl.createSVGPoint();
      pt.x = event.clientX;
      pt.y = event.clientY;
      const p = pt.matrixTransform(ctm.inverse());
      return { x: p.x, y: p.y };
    }

    /** Beginnt das Verschieben eines Knotens (oder einen Klick). */
    function startDrag(event, node) {
      if (event.button !== undefined && event.button !== 0) {
        return;
      }
      const p = toSvgPoint(event);
      dragging = { id: node.id, x: node.x, y: node.y, offsetX: p.x - node.x, offsetY: p.y - node.y, startX: event.clientX, startY: event.clientY, moved: false };
      try {
        svgEl.setPointerCapture(event.pointerId);
      } catch (e) {
        // Ohne Zeigererfassung funktioniert das Verschieben nur innerhalb der Zeichnung.
      }
      event.preventDefault();
    }

    svgEl.addEventListener('pointermove', (event) => {
      if (!dragging) {
        return;
      }
      if (!dragging.moved && Math.hypot(event.clientX - dragging.startX, event.clientY - dragging.startY) < DRAG_THRESHOLD) {
        return;
      }
      if (!opts.draggable) {
        return;
      }
      const p = toSvgPoint(event);
      dragging.moved = true;
      dragging.x = Math.min(area.width - area.margin, Math.max(area.margin, p.x - dragging.offsetX));
      dragging.y = Math.min(area.height - area.margin, Math.max(area.margin, p.y - dragging.offsetY));
      render(lastView);
    });

    /** Beendet Verschieben bzw. Klick. */
    function endDrag(cancelled) {
      if (!dragging) {
        return;
      }
      const d = dragging;
      dragging = null;
      if (d.moved) {
        if (cancelled) {
          render(lastView);
        } else {
          ns.graph.moveNode(d.id, d.x, d.y);
          render(lastView);
        }
      } else if (!cancelled && opts.onNodeClick) {
        opts.onNodeClick(d.id);
      }
    }

    svgEl.addEventListener('pointerup', () => endDrag(false));
    svgEl.addEventListener('pointercancel', () => endDrag(true));

    render();
    return { render, highlightEdge };
  }

  /**
   * Erzeugt eine Legende mit kleinen Mustern derselben Klassen wie in der Zeichnung.
   *
   * @param {Array<{node?:string, edge?:string, text:string}>} items - Einträge: node = Knotenzustand
   *   (z. B. "frontier"), edge = Kantenart (z. B. "tree").
   * @returns {HTMLElement} Liste.
   */
  function legend(items) {
    const list = dom.el('ul', { class: 'legend' });
    for (const item of items) {
      const swatch = dom.svg('svg', { class: 'legend-swatch', viewBox: '0 0 40 24', 'aria-hidden': 'true', focusable: 'false' });
      if (item.node) {
        const g = dom.svg('g', { class: 'node node-' + item.node, transform: 'translate(20,12)' });
        if (item.ring) {
          g.appendChild(dom.svg('ellipse', { rx: '17', ry: '11', class: 'node-ring node-ring-' + item.ring }));
        }
        g.appendChild(dom.svg('ellipse', { rx: '12', ry: '8', class: 'node-shape' }));
        swatch.appendChild(g);
      } else {
        const g = dom.svg('g', { class: 'edge edge-' + item.edge });
        g.appendChild(dom.svg('path', { d: 'M2,12 L38,12', class: 'edge-line' }));
        swatch.appendChild(g);
      }
      list.appendChild(dom.el('li', null, [swatch, item.text]));
    }
    return list;
  }

  ns.graphView = { create, legend };
})(window.HG = window.HG || {});
