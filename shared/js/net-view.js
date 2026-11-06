/**
 * @file net-view.js
 * @description Zeichnet Neuronen und ihre Verbindungen als SVG.
 *
 * Der Baustein kennt kein bestimmtes Netz: Das Paket übergibt Positionen und Werte. Dadurch
 * lassen sich ein einzelnes Perzeptron ebenso wie Netze mit mehreren Schichten darstellen.
 *
 * Darstellung (draw):
 *   inputs:  [{id, x, y, name, value, active?}]                 Eingang: Name darüber, Wert im Kreis
 *   neurons: [{id, x, y, r, activation, sum, threshold, active?}]
 *            Kreis mit Σ links und dem Symbol von activation rechts (siehe activations.js);
 *            sum und threshold sind fertige Texte neben Σ bzw. neben dem Symbol;
 *            active: 'sum' oder 'output' hebt die jeweilige Hälfte hervor;
 *            thresholdChanged: true hebt den Text des Schwellenwerts hervor.
 *   edges:   [{from, to, label, active?, changed?}]             Kante mit Pfeil und Beschriftung
 *   outputs: [{id, from, x, y, text, active?}]                  Ausgang: Pfeil vom Neuron zum Text;
 *            der Text darf jede Zahl enthalten
 *
 * Gemeinsamer Code der Simulator-Pakete (Quelle: shared/js/net-view.js).
 *
 * Abhängigkeiten:
 *   dom-utils.js
 *
 * Sicherheitsaspekte:
 *   Texte werden nur als Textknoten eingefügt, Farben nur über CSS-Klassen vergeben.
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;

  /** Radius der Eingänge. */
  const INPUT_R = 28;
  /** Länge der Pfeilspitze. */
  const ARROW = 10;

  /**
   * Rundet für kompakte SVG-Attribute.
   * @param {number} v - Zahl.
   * @returns {number} Gerundete Zahl.
   */
  const r2 = (v) => Math.round(v * 100) / 100;

  /**
   * Strecke zwischen zwei Kreisen mit Pfeilspitze.
   * @param {{x:number,y:number,r:number}} a - Start.
   * @param {{x:number,y:number,r:number}} b - Ziel.
   * @param {string} cls - CSS-Klassen.
   * @returns {SVGElement} Gruppe.
   */
  function arrow(a, b, cls) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    const x1 = a.x + ux * a.r;
    const y1 = a.y + uy * a.r;
    const x2 = b.x - ux * b.r;
    const y2 = b.y - uy * b.r;
    const baseX = x2 - ux * ARROW;
    const baseY = y2 - uy * ARROW;
    const tip = 'M' + r2(x2) + ' ' + r2(y2) +
      'L' + r2(baseX - uy * ARROW * 0.5) + ' ' + r2(baseY + ux * ARROW * 0.5) +
      'L' + r2(baseX + uy * ARROW * 0.5) + ' ' + r2(baseY - ux * ARROW * 0.5) + 'Z';
    return dom.svg('g', { class: 'net-edge ' + cls }, [
      dom.svg('line', { x1: r2(x1), y1: r2(y1), x2: r2(baseX), y2: r2(baseY) }),
      dom.svg('path', { d: tip })
    ]);
  }

  /**
   * Erzeugt die Zeichnung.
   *
   * @param {HTMLElement} container - Behälter (wird geleert).
   * @param {{width:number, height:number, ariaLabel?:string}} options - Größe der viewBox und Beschreibung.
   * @returns {{draw:function(Object):void}} Steuerung.
   */
  function create(container, options) {
    const root = dom.svg('svg', {
      class: 'net-view',
      viewBox: '0 0 ' + options.width + ' ' + options.height,
      role: 'img',
      'aria-label': options.ariaLabel || 'Neuronales Netz'
    });
    dom.clear(container);
    container.appendChild(root);

    /**
     * Zeichnet das Modell neu.
     * @param {Object} model - Siehe Dateikopf.
     */
    function draw(model) {
      dom.clear(root);
      const anchors = new Map();
      for (const i of model.inputs || []) {
        anchors.set(i.id, { x: i.x, y: i.y, r: INPUT_R });
      }
      for (const n of model.neurons || []) {
        anchors.set(n.id, { x: n.x, y: n.y, r: n.r });
      }

      for (const e of model.edges || []) {
        const a = anchors.get(e.from);
        const b = anchors.get(e.to);
        const cls = (e.active ? 'is-active' : '') + (e.changed ? ' is-changed' : '');
        root.appendChild(arrow(a, b, cls));
        root.appendChild(dom.svg('text', {
          class: 'net-weight' + (e.changed ? ' is-changed' : ''),
          x: r2(a.x + (b.x - a.x) * 0.42),
          y: r2(a.y + (b.y - a.y) * 0.42 - 12),
          'text-anchor': 'middle'
        }, e.label));
      }

      for (const i of model.inputs || []) {
        root.appendChild(dom.svg('g', { class: 'net-input' + (i.active ? ' is-active' : ''), 'data-id': i.id }, [
          dom.svg('text', { class: 'net-name', x: i.x, y: i.y - INPUT_R - 8, 'text-anchor': 'middle' }, i.name),
          dom.svg('circle', { cx: i.x, cy: i.y, r: INPUT_R }),
          dom.svg('text', { class: 'net-value', x: i.x, y: i.y + 5, 'text-anchor': 'middle' }, i.value)
        ]));
      }

      for (const n of model.neurons || []) {
        const left = 'M' + n.x + ' ' + (n.y - n.r) + 'A' + n.r + ' ' + n.r + ' 0 0 0 ' + n.x + ' ' + (n.y + n.r) + 'Z';
        const right = 'M' + n.x + ' ' + (n.y - n.r) + 'A' + n.r + ' ' + n.r + ' 0 0 1 ' + n.x + ' ' + (n.y + n.r) + 'Z';
        const scale = r2(n.r / 28);
        root.appendChild(dom.svg('g', { class: 'net-neuron', 'data-id': n.id }, [
          dom.svg('path', { d: left, class: 'net-half' + (n.active === 'sum' ? ' is-active' : '') }),
          dom.svg('path', { d: right, class: 'net-half' + (n.active === 'output' ? ' is-active' : '') }),
          dom.svg('line', { class: 'net-divider', x1: n.x, y1: n.y - n.r, x2: n.x, y2: n.y + n.r }),
          dom.svg('text', { class: 'net-sigma', x: r2(n.x - n.r * 0.5), y: r2(n.y + n.r * 0.2), 'text-anchor': 'middle' }, 'Σ'),
          dom.svg('path', {
            class: 'net-symbol',
            d: n.activation.symbol,
            transform: 'translate(' + r2(n.x + n.r * 0.5) + ' ' + n.y + ') scale(' + scale + ')'
          }, dom.svg('title', null, n.activation.name)),
          dom.svg('text', { class: 'net-note' + (n.active === 'sum' ? ' is-active' : ''), x: r2(n.x - n.r * 0.5), y: n.y - n.r - 10, 'text-anchor': 'middle', 'data-part': 'sum' }, n.sum),
          dom.svg('text', { class: 'net-note' + (n.thresholdChanged ? ' is-changed' : ''), x: r2(n.x + n.r * 0.5), y: n.y + n.r + 22, 'text-anchor': 'middle', 'data-part': 'threshold' }, n.threshold)
        ]));
      }

      for (const o of model.outputs || []) {
        const from = anchors.get(o.from);
        root.appendChild(arrow(from, { x: o.x, y: o.y, r: 0 }, o.active ? 'is-active' : ''));
        root.appendChild(dom.svg('text', { class: 'net-output' + (o.active ? ' is-active' : ''), x: o.x + 6, y: o.y + 5, 'data-id': o.id }, o.text));
      }
    }

    return { draw };
  }

  ns.netView = { create };
})(window.LP = window.LP || {});
