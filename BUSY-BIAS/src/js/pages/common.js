/**
 * @file pages/common.js
 * @description Bausteine, die mehrere Seiten teilen: Legenden und Anzeige der Geradengleichung.
 *
 * Abhängigkeiten:
 *   dom-utils.js, coord-plot.js, format-utils.js, perceptron.js, session.js
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  ns.pages = ns.pages || {};

  /**
   * Zeigt die Legende der Punkte.
   * @param {HTMLElement} box - Behälter (wird geleert).
   */
  function renderPointLegend(box) {
    const data = ns.session.data;
    dom.clear(box);
    if (data.labels().length === 0) {
      return;
    }
    const fire = data.labelOf(1);
    const noFire = data.labelOf(0);
    if (fire !== null) {
      box.appendChild(dom.el('li', null, [ns.coordPlot.markerIcon('circle', 'pt-fire'), ' Label ' + fire + ' (t = 1)']));
    }
    if (noFire !== null) {
      box.appendChild(dom.el('li', null, [ns.coordPlot.markerIcon('square', 'pt-nofire'), ' Label ' + noFire + ' (t = 0)']));
    }
  }

  /**
   * Zeigt die Legende der Decision Areas.
   * @param {HTMLElement} box - Behälter (wird geleert).
   */
  function renderAreaLegend(box) {
    dom.clear(box);
    dom.appendChildren(box, [
      dom.el('li', null, [dom.el('span', { class: 'swatch swatch-fire' }), 'Perzeptron feuert (s ≥ θ)']),
      dom.el('li', null, [dom.el('span', { class: 'swatch swatch-nofire' }), 'Perzeptron feuert nicht (s < θ)'])
    ]);
  }

  /**
   * Zeigt die Geradengleichung des aktuellen Stands.
   * @param {HTMLElement} box - Behälter (wird geleert).
   * @param {boolean} outside - Die Gerade verläuft außerhalb des Ausschnitts.
   */
  function renderEquation(box, outside) {
    const trainer = ns.session.trainer();
    const w = trainer.weights();
    const theta = trainer.theta();
    const line = ns.perceptron.lineOf(w, theta);
    dom.clear(box);
    box.appendChild(dom.el('p', { class: 'equation' }, ['Gerade: ', dom.el('strong', null, ns.fmt.equation(line))]));
    box.appendChild(dom.el('p', { class: 'hint' }, 'Allgemeine Form: ' + ns.fmt.generalForm(w, theta)));
    if (line.kind === 'none') {
      box.appendChild(dom.el('p', { class: 'hint' }, line.fires ? 'Die ganze Fläche feuert, weil 0 ≥ θ gilt.' : 'Die ganze Fläche feuert nicht, weil 0 < θ gilt.'));
    }
    if (outside) {
      box.appendChild(dom.el('p', { class: 'hint' }, 'Die Gerade liegt außerhalb des Ausschnitts.'));
    }
  }

  ns.pages.common = { renderPointLegend, renderAreaLegend, renderEquation };
})(window.BB = window.BB || {});
