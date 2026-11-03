/**
 * @file pages/diagram.js
 * @description Seite 4 „Klassendiagramm“: das Tabellenschema der geladenen Datenbank als
 *              UML-Klassendiagramm (SVG).
 *
 * Das Modell kommt aus uml-model.js, die Anordnung aus uml-layout.js. Alle Linien bestehen
 * nur aus waagerechten und senkrechten Abschnitten. Die Klassenkarten lassen sich mit der
 * Maus (bzw. per Touch) und mit den Pfeiltasten verschieben; die betroffenen Linien werden
 * dabei rechtwinklig neu geführt. „Anordnung zurücksetzen“ stellt das Ebenenlayout wieder her.
 * Beim Laden einer anderen Datenbank wird neu angeordnet.
 *
 * Sicherheit:
 *   Alle Namen werden über dom.svg/dom.el als Textknoten eingefügt (nach cleanCellText).
 *   Es werden keine Stil-Attribute gesetzt; Positionen stehen in SVG-Attributen.
 *
 * Abhängigkeiten:
 *   dom-utils.js, text-utils.js, state.js, uml-model.js, uml-layout.js, pages/common.js
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const ui = {};

  const NAME_H = 28;       // Höhe des Namensfelds
  const ATTR_H = 18;       // Zeilenhöhe der Attribute
  const PAD_X = 12;        // Innenabstand links/rechts
  const MIN_W = 110;       // Mindestbreite einer Karte
  const MAX_CHARS = 40;    // längere Namen werden gekürzt (voller Name als Tooltip)
  const PARALLEL = 18;     // Abstand paralleler Linien nach dem Verschieben
  const MARGIN = 24;

  /** true, wenn sich die Datenbank seit dem letzten Aufbau geändert hat. */
  let stale = true;
  /** true, wenn beim nächsten Aufbau neu angeordnet werden soll (neue Datenbank, Zurücksetzen). */
  let relayout = true;
  /** Kennung des zuletzt dargestellten Modells. */
  let signature = '';
  /** Aktueller Zustand: Modell, Karten, Linien. */
  let view = null;

  /** Kürzt lange Namen für die Anzeige. */
  function shorten(text) {
    const chars = Array.from(text);
    return chars.length > MAX_CHARS ? chars.slice(0, MAX_CHARS - 1).join('') + '…' : text;
  }

  /** @returns {string} Punkte für das points-Attribut. */
  function pointsAttr(points) {
    return points.map((p) => Math.round(p.x * 10) / 10 + ',' + Math.round(p.y * 10) / 10).join(' ');
  }

  /**
   * Misst Textbreiten im sichtbaren Diagrammbereich (mit Schätzung als Rückfall).
   *
   * @returns {{width:function(string, string):number, done:function():void}} Messhilfe.
   */
  function measurer() {
    const svg = dom.svg('svg', { class: 'uml uml-measure', width: '10', height: '10', 'aria-hidden': 'true', focusable: 'false' });
    ui.canvas.appendChild(svg);
    return {
      width(text, cls) {
        const t = dom.svg('text', { class: cls, x: '0', y: '20' }, text);
        svg.appendChild(t);
        let w = 0;
        try {
          w = t.getComputedTextLength();
        } catch (e) {
          w = 0;
        }
        svg.removeChild(t);
        if (!(w > 0)) {
          w = Array.from(text).length * (cls === 'uml-name' ? 8.4 : 7.4);
        }
        return Math.ceil(w);
      },
      done() {
        svg.remove();
      }
    };
  }

  /**
   * Bereitet die Karten vor (Texte, Breite, Höhe).
   *
   * @param {Object} model - Modell aus uml-model.js.
   * @returns {Map<string, Object>} Klassen-ID → Karte.
   */
  function prepareCards(model) {
    const m = measurer();
    const cards = new Map();
    for (const cls of model.classes) {
      const fullName = ns.text.cleanCellText(cls.name);
      const name = shorten(fullName);
      const attrs = cls.attributes.map((a) => {
        const full = ns.text.cleanCellText(a.name);
        const text = shorten(full);
        return { text, full, key: a.key, w: m.width(text, 'uml-attr') };
      });
      const nameW = m.width(name, 'uml-name');
      const w = Math.ceil(Math.max(MIN_W, nameW + 2 * PAD_X, ...attrs.map((a) => a.w + 2 * PAD_X)));
      const h = NAME_H + (attrs.length ? 8 + attrs.length * ATTR_H : 12);
      cards.set(cls.id, { cls, name, fullName, nameW, attrs, w, h, x: 0, y: 0, g: null });
    }
    for (const a of model.associations) {
      a.labelW = a.label ? m.width(shorten(ns.text.cleanCellText(a.label)), 'uml-label') : 0;
    }
    m.done();
    return cards;
  }

  /** @returns {{x:number,y:number,w:number,h:number}} Rechteck einer Karte. */
  function rect(card) {
    return { x: card.x, y: card.y, w: card.w, h: card.h };
  }

  /**
   * Position einer Multiplizität am Anfang bzw. Ende eines Linienzugs.
   *
   * @param {Array<{x:number,y:number}>} points - Eckpunkte.
   * @param {boolean} atStart - true: Anfang, false: Ende.
   * @returns {{x:number, y:number, anchor:string}} Textposition.
   */
  function endLabel(points, atStart) {
    const p = atStart ? points[0] : points[points.length - 1];
    const q = atStart ? points[1] : points[points.length - 2];
    const dy = Math.sign(q.y - p.y);
    const dx = Math.sign(q.x - p.x);
    if (dy !== 0) {
      return { x: p.x + 5, y: p.y + (dy > 0 ? 14 : -6), anchor: 'start' };
    }
    return { x: p.x + (dx > 0 ? 6 : -6), y: p.y - 5, anchor: dx > 0 ? 'start' : 'end' };
  }

  /** Position des Beziehungsbezeichners am längsten Abschnitt. */
  function nameLabel(points) {
    const seg = ns.uml.longestSegment(points);
    if (seg.horizontal) {
      return { x: (seg.a.x + seg.b.x) / 2, y: seg.a.y - 5, anchor: 'middle' };
    }
    return { x: seg.a.x + 6, y: (seg.a.y + seg.b.y) / 2 + 4, anchor: 'start' };
  }

  /** Setzt Position und Ausrichtung eines Textes. */
  function placeText(el, p) {
    el.setAttribute('x', String(Math.round(p.x)));
    el.setAttribute('y', String(Math.round(p.y)));
    el.setAttribute('text-anchor', p.anchor);
  }

  /** Aktualisiert Linie und Beschriftungen einer Beziehung. */
  function updateEdge(a) {
    const els = view.edgeEls.get(a.id);
    const points = view.routes.get(a.id);
    if (!els || !points) {
      return;
    }
    els.line.setAttribute('points', pointsAttr(points));
    placeText(els.multFrom, endLabel(points, true));
    placeText(els.multTo, endLabel(points, false));
    if (els.label) {
      placeText(els.label, nameLabel(points));
    }
    if (els.connector) {
      els.connector.setAttribute('points', pointsAttr(view.connectors.get(a.id)));
    }
  }

  /** Passt die Größe der Zeichenfläche an Karten und Linien an. */
  function resize() {
    let w = 0;
    let h = 0;
    for (const card of view.cards.values()) {
      w = Math.max(w, card.x + card.w + 3 * PARALLEL);
      h = Math.max(h, card.y + card.h);
    }
    for (const list of [view.routes, view.connectors]) {
      for (const points of list.values()) {
        for (const p of points) {
          w = Math.max(w, p.x);
          h = Math.max(h, p.y);
        }
      }
    }
    view.svg.setAttribute('width', String(Math.ceil(w + MARGIN)));
    view.svg.setAttribute('height', String(Math.ceil(h + MARGIN)));
  }

  /**
   * Führt nach dem Verschieben die Linien der betroffenen Karten rechtwinklig neu.
   *
   * @param {string} id - ID der verschobenen Karte.
   */
  function reroute(id) {
    const model = view.model;
    for (const a of model.associations) {
      if (a.from === id || a.to === id) {
        view.free.add(a.id);
      }
    }
    const loops = new Map();
    for (const a of model.associations) {
      if (!view.free.has(a.id) || !view.routes.has(a.id)) {
        continue;
      }
      if (a.from === a.to) {
        const i = loops.get(a.from) || 0;
        loops.set(a.from, i + 1);
        view.routes.set(a.id, ns.uml.loopRoute(rect(view.cards.get(a.from)), i));
      } else {
        const offset = (a.parallelIndex - (a.parallelCount - 1) / 2) * PARALLEL;
        view.routes.set(a.id, ns.uml.orthoRoute(rect(view.cards.get(a.from)), rect(view.cards.get(a.to)), offset));
      }
    }
    for (const a of model.associations) {
      if (a.assocClass && view.routes.has(a.id) && (view.free.has(a.id) || a.assocClass === id)) {
        view.connectors.set(a.id, ns.uml.connectorRoute(view.routes.get(a.id), rect(view.cards.get(a.assocClass))));
      }
    }
    model.associations.forEach(updateEdge);
    resize();
  }

  /** Verschiebt eine Karte an eine neue Position (nicht über den linken/oberen Rand hinaus). */
  function moveCard(card, x, y) {
    card.x = Math.max(4, x);
    card.y = Math.max(4, y);
    card.g.setAttribute('transform', 'translate(' + card.x + ',' + card.y + ')');
    reroute(card.cls.id);
  }

  /** Macht eine Karte per Maus, Touch und Tastatur verschiebbar. */
  function makeMovable(card) {
    const g = card.g;
    let drag = null;
    g.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) {
        return;
      }
      ev.preventDefault();
      g.focus({ preventScroll: true });
      drag = { pointerId: ev.pointerId, px: ev.clientX, py: ev.clientY, x0: card.x, y0: card.y };
      try {
        g.setPointerCapture(ev.pointerId);
      } catch (e) {
        // Synthetische Ereignisse (Tests) haben keinen aktiven Zeiger.
      }
      g.classList.add('dragging');
    });
    g.addEventListener('pointermove', (ev) => {
      if (drag && ev.pointerId === drag.pointerId) {
        moveCard(card, drag.x0 + ev.clientX - drag.px, drag.y0 + ev.clientY - drag.py);
      }
    });
    const end = (ev) => {
      if (drag && ev.pointerId === drag.pointerId) {
        drag = null;
        g.classList.remove('dragging');
      }
    };
    g.addEventListener('pointerup', end);
    g.addEventListener('pointercancel', end);
    g.addEventListener('keydown', (ev) => {
      const step = ev.shiftKey ? 50 : 10;
      const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      const d = moves[ev.key];
      if (d) {
        ev.preventDefault();
        moveCard(card, card.x + d[0], card.y + d[1]);
      }
    });
  }

  /** Erzeugt die SVG-Gruppe einer Klassenkarte. */
  function cardElement(card) {
    const attrList = card.attrs.map((a) => a.full + (a.key ? ' (Schlüssel)' : '')).join(', ');
    const label = (card.cls.associationClass ? 'Assoziationsklasse ' : 'Klasse ') + card.fullName +
      (card.attrs.length ? ', Attribute: ' + attrList : ', ohne Attribute');
    const children = [
      dom.svg('rect', { class: 'uml-box', x: '0', y: '0', width: String(card.w), height: String(card.h) }),
      dom.svg('text', { class: 'uml-name', x: String(card.w / 2), y: '19', 'text-anchor': 'middle' }, card.name),
      dom.svg('line', { class: 'uml-sep', x1: '0', y1: String(NAME_H), x2: String(card.w), y2: String(NAME_H) })
    ];
    card.attrs.forEach((a, i) => {
      const y = NAME_H + 4 + (i + 1) * ATTR_H - 4;
      children.push(dom.svg('text', { class: 'uml-attr', x: String(PAD_X), y: String(y) }, a.text));
      if (a.key) {
        children.push(dom.svg('line', { class: 'uml-key', x1: String(PAD_X), y1: String(y + 3), x2: String(PAD_X + a.w), y2: String(y + 3) }));
      }
    });
    const truncated = card.name !== card.fullName || card.attrs.some((a) => a.text !== a.full);
    if (truncated) {
      children.unshift(dom.svg('title', null, card.fullName + (card.attrs.length ? ': ' + card.attrs.map((a) => a.full).join(', ') : '')));
    }
    const g = dom.svg('g', {
      class: 'uml-class' + (card.cls.associationClass ? ' uml-assoc-class' : ''),
      transform: 'translate(' + card.x + ',' + card.y + ')',
      tabindex: '0', role: 'group', 'aria-label': label, 'data-class': card.cls.id
    }, children);
    card.g = g;
    makeMovable(card);
    return g;
  }

  /** Zeichnet das Diagramm aus dem aktuellen Zustand. */
  function draw() {
    const model = view.model;
    const svg = dom.svg('svg', {
      class: 'uml', role: 'group', focusable: 'false',
      'aria-label': 'Klassendiagramm mit ' + dom.plural(model.classes.length, 'Klasse', 'Klassen') + ' und ' +
        dom.plural(model.associations.length, 'Beziehung', 'Beziehungen')
    });
    const gEdges = dom.svg('g', { class: 'uml-edges', 'aria-hidden': 'true' });
    const gLabels = dom.svg('g', { class: 'uml-labels', 'aria-hidden': 'true' });
    const gCards = dom.svg('g', { class: 'uml-cards' });
    view.edgeEls = new Map();
    for (const a of model.associations) {
      if (!view.routes.has(a.id)) {
        continue;
      }
      const els = {
        line: dom.svg('polyline', { class: 'uml-line', 'data-assoc': a.id }),
        multFrom: dom.svg('text', { class: 'uml-mult' }, a.fromMult),
        multTo: dom.svg('text', { class: 'uml-mult' }, a.toMult),
        label: a.label ? dom.svg('text', { class: 'uml-label' }, shorten(ns.text.cleanCellText(a.label))) : null,
        connector: a.assocClass && view.connectors.has(a.id) ? dom.svg('polyline', { class: 'uml-line uml-connector', 'data-assoc': a.id }) : null
      };
      gEdges.appendChild(els.line);
      if (els.connector) {
        gEdges.appendChild(els.connector);
      }
      gLabels.appendChild(els.multFrom);
      gLabels.appendChild(els.multTo);
      if (els.label) {
        gLabels.appendChild(els.label);
      }
      view.edgeEls.set(a.id, els);
    }
    for (const card of view.cards.values()) {
      gCards.appendChild(cardElement(card));
    }
    svg.appendChild(gEdges);
    svg.appendChild(gLabels);
    svg.appendChild(gCards);
    view.svg = svg;
    dom.clear(ui.canvas);
    ui.canvas.appendChild(svg);
    model.associations.forEach(updateEdge);
    resize();
  }

  /** Berechnet die Standardanordnung. */
  function arrange() {
    const nodes = Array.from(view.cards.values()).map((c) => ({ id: c.cls.id, w: c.w, h: c.h }));
    const edges = view.model.associations.map((a) => ({ id: a.id, from: a.from, to: a.to, kind: a.kind, assocClass: a.assocClass, labelW: a.labelW }));
    const result = ns.uml.layout(nodes, edges);
    for (const card of view.cards.values()) {
      const p = result.positions.get(card.cls.id);
      card.x = p.x;
      card.y = p.y;
    }
    view.routes = result.routes;
    view.connectors = result.connectors;
    view.free = new Set();
  }

  /** Erzeugt die Textfassung des Diagramms (Barrierefreiheit, Unterricht). */
  function textVersion(model) {
    const nameOf = new Map(model.classes.map((c) => [c.id, ns.text.cleanCellText(c.name)]));
    const classItems = model.classes.map((c) => dom.el('li', null, [
      dom.el('strong', null, nameOf.get(c.id)), c.associationClass ? ' (Assoziationsklasse)' : '', ': ',
      c.attributes.length ? c.attributes.map((a) => ns.text.cleanCellText(a.name) + (a.key ? ' (Schlüssel)' : '')).join(', ') : 'keine Attribute'
    ]));
    const assocItems = model.associations.map((a) => {
      let textLine;
      if (a.kind === 'fk') {
        textLine = nameOf.get(a.to) + ' ' + a.toMult + ' – ' + a.fromMult + ' ' + nameOf.get(a.from) + ' (' + ns.text.cleanCellText(a.label) + ')';
      } else {
        textLine = nameOf.get(a.from) + ' * – * ' + nameOf.get(a.to) +
          (a.assocClass ? ' mit der Assoziationsklasse ' + nameOf.get(a.assocClass) : ' (' + ns.text.cleanCellText(a.label) + ')');
      }
      return dom.el('li', null, textLine);
    });
    return [
      dom.el('h4', null, 'Klassen'),
      dom.el('ul', null, classItems),
      dom.el('h4', null, 'Beziehungen'),
      assocItems.length ? dom.el('ul', null, assocItems) : dom.el('p', { class: 'hint' }, 'Keine Beziehungen.')
    ];
  }

  /** Baut die Seite neu auf. */
  function build() {
    const db = ns.state.db();
    dom.clear(ui.warnings);
    if (!db) {
      dom.clear(ui.notice);
      const link = dom.el('button', { type: 'button', class: 'btn btn-link' }, 'Zu Seite 1: Datenbank laden');
      link.addEventListener('click', () => ns.app.showPage('load', { scrollTop: true }));
      ui.notice.appendChild(dom.el('p', null, ['Es ist noch keine Datenbank geladen. Wählen Sie auf Seite 1 eine Beispieldatenbank oder laden Sie eine SQL-Datei hoch. ', link]));
      ui.notice.hidden = false;
      ui.info.textContent = '';
      ui.body.hidden = true;
      dom.clear(ui.canvas);
      dom.clear(ui.text);
      view = null;
      signature = '';
      return;
    }
    ui.notice.hidden = true;
    ui.body.hidden = false;
    const model = ns.uml.buildModel(db);
    const info = ns.state.info();
    ui.info.textContent = 'Datenbank „' + info.name + '“: ' + dom.plural(model.classes.length, 'Klasse', 'Klassen') + ', ' +
      dom.plural(model.associations.length, 'Beziehung', 'Beziehungen') + '.' +
      (db.views.size ? ' Sichten (Views) erscheinen nicht im Klassendiagramm.' : '');
    for (const w of model.warnings) {
      ui.warnings.appendChild(ns.ui.warningBox(w));
    }
    dom.clear(ui.text);
    ui.text.appendChild(dom.el('summary', null, 'Klassendiagramm als Text'));
    ui.text.appendChild(dom.el('div', { class: 'reference-body' }, textVersion(model)));
    if (model.classes.length === 0) {
      dom.clear(ui.canvas);
      ui.canvas.appendChild(dom.el('p', { class: 'hint' }, 'Die Datenbank enthält keine Tabellen.'));
      view = null;
      signature = '';
      return;
    }
    const sig = JSON.stringify([
      model.classes.map((c) => [c.id, c.name, c.attributes]),
      model.associations.map((a) => [a.id, a.from, a.to, a.fromMult, a.toMult, a.label, a.assocClass])
    ]);
    if (view && sig === signature && !relayout) {
      // Schema unverändert (z. B. nach INSERT): Anordnung und verschobene Karten bleiben erhalten.
      draw();
      return;
    }
    view = { model, cards: prepareCards(model) };
    arrange();
    signature = sig;
    relayout = false;
    draw();
  }

  ns.pages.diagram = {
    init() {
      ui.notice = dom.byId('diagram-notice');
      ui.info = dom.byId('diagram-info');
      ui.warnings = dom.byId('diagram-warnings');
      ui.body = dom.byId('diagram-body');
      ui.canvas = dom.byId('diagram-canvas');
      ui.text = dom.byId('diagram-text');
      dom.byId('btn-diagram-reset').addEventListener('click', () => {
        relayout = true;
        stale = false;
        build();
      });
    },
    render() {
      if (stale) {
        stale = false;
        build();
      }
    },
    onDbChange(event) {
      stale = true;
      if (event && event.type === 'load') {
        relayout = true;
      }
    }
  };
})(window.SQLSIM = window.SQLSIM || {});
