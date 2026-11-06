/**
 * @file pages/classify.js
 * @description Seite 4: einen Punkt mit dem aktuellen Stand des Perzeptrons klassifizieren.
 *
 * Verhalten:
 *   - Verwendet immer die aktuellen Gewichte und θ, also den Stand von Seite 2.
 *   - Der Punkt wird nur geprüft: Er kommt nicht in die Trainingsdaten, ändert keine Gewichte
 *     und erscheint nicht im Protokoll.
 *   - Solange keine Trenngerade gefunden wurde, weist ein Hinweis darauf hin; die Seite bleibt nutzbar.
 *
 * Abhängigkeiten:
 *   dom-utils.js, coord-plot.js, classify-panel.js, format-utils.js, perceptron.js, session.js, pages/common.js
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const session = ns.session;

  let plot = null;
  let panel = null;
  let probe = null;

  /**
   * Klassifiziert einen Punkt.
   *
   * @param {number} x - x₁.
   * @param {number} y - x₂.
   * @param {string|null} expected - Erwartetes Label oder null.
   * @returns {{lines:string[], verdict:(string|null), verdictText:string}} Ergebnis für classify-panel.js.
   */
  function classify(x, y, expected) {
    const trainer = session.trainer();
    const data = session.data;
    const w = trainer.weights();
    const theta = trainer.theta();
    const result = ns.perceptron.classify(w, theta, [x, y]);
    const computed = data.labelOf(result.y);
    const lines = [
      ns.fmt.currentLine(w, theta),
      ns.fmt.sumLine(w, [x, y], result.sum),
      ns.fmt.activationLine(result.sum, theta, result.y) + (result.y === 1 ? ' (feuert)' : ' (feuert nicht)')
    ];
    if (expected === null) {
      lines.push('Berechnet: Label ' + ns.fmt.labelText(computed));
      return { lines, verdict: null, verdictText: 'Ergebnis: Label ' + ns.fmt.labelText(computed) + '. Ohne erwartetes Label gibt es kein Urteil.' };
    }
    lines.push('Berechnet: Label ' + ns.fmt.labelText(computed) + ', erwartet: Label ' + expected);
    const correct = data.target(expected) === result.y;
    return { lines, verdict: correct ? 'correct' : 'wrong', verdictText: correct ? 'Ergebnis: korrekt klassifiziert' : 'Ergebnis: falsch klassifiziert' };
  }

  /** Zeichnet das Koordinatensystem mit dem Prüfpunkt. */
  function drawPlot() {
    const { spec, outside } = session.plotSpec({ line: true, areas: true, probe });
    plot.render(spec);
    ns.pages.common.renderEquation(dom.byId('classify-equation'), outside);
  }

  /** Zeigt Hinweis und Stand des Trainings. */
  function renderNotice() {
    const trainer = session.trainer();
    const box = dom.byId('classify-notice');
    const empty = session.data.count() === 0;
    box.hidden = !empty && trainer.isFinished();
    dom.byId('classify-status').textContent = 'Stand: ' + session.statusText();
    if (box.hidden) {
      return;
    }
    dom.byId('classify-notice-text').textContent = empty
      ? 'Es liegen noch keine Trainingspunkte vor. Die Klassifikation verwendet die Startwerte.'
      : 'Das Training ist noch nicht abgeschlossen. Die Klassifikation verwendet den aktuellen, vorläufigen Stand; führen Sie das Training zuerst zu Ende.' +
        (session.mightBeInseparable() ? ' Nach so vielen Iterationen sind die Daten möglicherweise nicht linear trennbar.' : '');
    const button = dom.byId('classify-notice-button');
    button.textContent = empty ? 'Zur Dateneingabe' : 'Zum Training';
    button.dataset.target = empty ? 'input' : 'training';
  }

  /** Zeichnet die Seite. */
  function render() {
    renderNotice();
    panel.refresh();
    drawPlot();
    ns.pages.common.renderPointLegend(dom.byId('classify-point-legend'));
  }

  /** Richtet die Seite ein. */
  function init() {
    plot = ns.coordPlot.create(dom.byId('classify-plot'), { ariaLabel: 'Koordinatensystem mit Trainingspunkten, Gerade, Decision Areas und dem eingegebenen Punkt' });
    ns.pages.common.renderAreaLegend(dom.byId('classify-area-legend'));
    panel = ns.classifyPanel.create(dom.byId('classify-panel'), {
      id: 'probe',
      classify,
      labels: () => session.data.labels(),
      attributes: () => session.data.attributes(),
      onProbe: (point) => {
        probe = point;
        if (plot.view()) {
          drawPlot();
        }
      }
    });
    dom.byId('classify-notice-button').addEventListener('click', (event) => ns.app.showPage(event.target.dataset.target, { scrollTop: true }));
  }

  ns.pages.classify = { init, render, probe: () => probe };
})(window.BB = window.BB || {});
