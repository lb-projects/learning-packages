/**
 * @file perceptron-view.js
 * @description Zeichnet das Perzeptron mit dem Stand des Trainers (Bausteine aus net-view.js).
 *
 * Es erscheinen nur die Werte, die der aktuelle Schritt schon erreicht hat:
 *   Eingänge ab „inputs“, Summe ab „sum“, Ausgabe ab „output“, geänderte Werte bei „update“.
 *   Noch nicht belegte Eingänge bleiben leere Kreise; noch nicht berechnete Summen und Ausgaben
 *   stehen gar nicht in der Zeichnung.
 *
 * Abhängigkeiten:
 *   net-view.js, sim-format.js, perceptron.js
 */
(function (ns) {
  'use strict';

  const { num } = ns.simFormat;

  /** Größe der Zeichnung. */
  const WIDTH = 640;
  const HEIGHT = 296;
  /** Reihenfolge der Schritte je Punkt. */
  const PHASES = ['idle', 'highlight', 'inputs', 'sum', 'output', 'update'];

  /**
   * Erzeugt die Zeichnung.
   * @param {HTMLElement} container - Behälter.
   * @returns {{draw:function(Object):void}} Steuerung.
   */
  function create(container) {
    const view = ns.netView.create(container, { width: WIDTH, height: HEIGHT, ariaLabel: 'Perzeptron mit zwei Eingängen, Summe, Heaviside-Aktivierung und Schwellenwert' });

    /**
     * Zeichnet den Stand des Trainers.
     * @param {Object} trainer - Trainer.
     */
    function draw(trainer) {
      const phase = trainer.phase();
      const rank = PHASES.indexOf(phase);
      const r = trainer.record();
      const w = trainer.weights();
      const theta = trainer.theta();
      const update = phase === 'update';
      const inputsShown = rank >= PHASES.indexOf('inputs');
      const sumShown = rank >= PHASES.indexOf('sum');
      const outputShown = rank >= PHASES.indexOf('output');
      const inputActive = phase === 'inputs';
      const changed = (i) => update && r.wBefore[i] !== r.wAfter[i];
      view.draw({
        inputs: [
          { id: 'x1', x: 70, y: 80, name: 'x₁', value: inputsShown ? num(r.x[0]) : '', active: inputActive },
          { id: 'x2', x: 70, y: 240, name: 'x₂', value: inputsShown ? num(r.x[1]) : '', active: inputActive }
        ],
        neurons: [{
          id: 'n', x: 340, y: 160, r: 78,
          activation: ns.perceptron.activation,
          sum: sumShown ? 'a = ' + num(r.sum) : '',
          threshold: 'θ = ' + num(theta),
          thresholdChanged: update,
          active: phase === 'sum' ? 'sum' : phase === 'output' ? 'output' : null
        }],
        edges: [
          { from: 'x1', to: 'n', label: 'w₁ = ' + num(w[0]), active: inputActive || phase === 'sum', changed: changed(0) },
          { from: 'x2', to: 'n', label: 'w₂ = ' + num(w[1]), active: inputActive || phase === 'sum', changed: changed(1) }
        ],
        outputs: [{ id: 'y', from: 'n', x: 540, y: 160, text: outputShown ? 'f(a) = ' + r.y : '', active: phase === 'output' }]
      });
    }

    return { draw };
  }

  ns.perceptronView = { create };
})(window.BB = window.BB || {});
