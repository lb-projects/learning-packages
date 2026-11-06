/**
 * @file pages/training.js
 * @description Seite 2: Training nachvollziehen.
 *
 * Aufbau:
 *   Links das Perzeptron, darunter Steuerung, Rechnungen des Schritts und Zähler.
 *   Rechts das Koordinatensystem mit aktuellem Punkt und Gerade, darunter Schalter für die
 *   Decision Areas, Legende und Geradengleichung.
 *   Darunter aufklappbar die Lernkurve und die Punktetabelle; bei mehrstufigen Beispielen zusätzlich Stufenkarte
 *   und Stufenvergleich.
 *
 * Abhängigkeiten:
 *   dom-utils.js, sim-format.js, coord-plot.js, training-controls.js, perceptron-view.js,
 *   format-utils.js, session.js, pages/common.js
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const session = ns.session;
  const { num, plural } = ns.simFormat;

  let plot = null;
  let view = null;
  let controls = null;
  let tableKey = null;
  let curve = null;
  let curveTrainer = null;
  let curvePasses = -1;

  /** Zeigt die Lernkurve, wenn sich der Verlauf geändert hat. */
  function renderCurve() {
    const trainer = session.trainer();
    if (curveTrainer === trainer && curvePasses === trainer.passes()) {
      return;
    }
    curveTrainer = trainer;
    curvePasses = trainer.passes();
    ns.pages.common.renderLearningCurve(curve, trainer.history(), trainer.total());
    dom.byId('training-curve-empty').hidden = trainer.passes() > 0;
  }

  /** Füllt die Punktetabelle, wenn sich die Daten geändert haben, und markiert den aktuellen Punkt. */
  function renderTable() {
    const data = session.data;
    const points = data.points();
    const key = points.map((p) => p.id).join(',') + '|' + data.positive() + '|' + session.config.scale;
    const tbody = dom.byId('training-tbody');
    if (key !== tableKey) {
      tableKey = key;
      ns.pages.common.renderPointTable(dom.byId('training-thead'), tbody);
    }
    dom.byId('training-table-count').textContent = '(' + points.length + ')';
    const trainer = session.trainer();
    const old = tbody.querySelector('.is-current');
    if (old) {
      old.classList.remove('is-current');
    }
    if (trainer.hasStarted() && tbody.rows[trainer.index()]) {
      tbody.rows[trainer.index()].classList.add('is-current');
    }
  }

  /** Zeigt den Stufenvergleich. */
  function renderStages() {
    const runs = session.stageRuns();
    const card = dom.byId('training-stages');
    card.hidden = runs.length === 0;
    const tbody = dom.byId('stages-tbody');
    dom.clear(tbody);
    for (const run of runs) {
      let outcome = '–';
      if (run.foundAfter !== null) {
        outcome = plural(run.foundAfter, 'Punkt', 'Punkte');
      } else if (run.processed > 0) {
        outcome = 'keine Trenngerade nach ' + plural(run.processed, 'Punkt', 'Punkten');
      }
      const values = (w, theta) => (w ? 'w₁ = ' + num(w[0]) + ', w₂ = ' + num(w[1]) + ', θ = ' + num(theta) : '–');
      tbody.appendChild(dom.el('tr', { class: run.stage === session.currentStage() ? 'is-current' : null }, [
        dom.el('td', null, run.stage + ': ' + run.title),
        dom.el('td', { class: 'num' }, run.total),
        dom.el('td', null, values(run.startW, run.startTheta)),
        dom.el('td', null, outcome),
        dom.el('td', null, run.processed > 0 ? values(run.w, run.theta) : '–')
      ]));
    }
  }

  /** Zeichnet die Seite. */
  function render() {
    const trainer = session.trainer();
    const ringIndex = trainer.hasStarted() && !trainer.isFinished() ? trainer.index() : -1;
    const { spec, outside } = session.plotSpec({ line: true, areas: session.showAreas(), ringIndex });
    plot.render(spec);
    dom.byId('toggle-areas').checked = session.showAreas();
    dom.byId('toggle-shuffle').checked = session.shuffle();
    dom.byId('training-shuffle-hint').hidden = !session.shuffle();
    view.draw(trainer);
    ns.pages.common.renderStepResult(dom.byId('training-result'), trainer, 'training');
    ns.pages.common.renderCounters(trainer, { iteration: 'count-iteration', processed: 'count-processed', last: 'count-last', found: 'training-found', hint: 'training-hint' });
    dom.byId('training-empty').hidden = trainer.total() > 0;
    dom.byId('training-scale-shift').hidden = !session.scaleShift();
    renderCurve();
    ns.pages.common.renderPointLegend(dom.byId('training-point-legend'));
    ns.pages.common.renderEquation(dom.byId('training-equation'), outside);
    renderTable();
    renderStages();
    controls.refresh();
  }

  /** Richtet die Seite ein. */
  function init() {
    plot = ns.coordPlot.create(dom.byId('training-plot'), { ariaLabel: 'Koordinatensystem mit Trainingspunkten und der Geraden des Perzeptrons' });
    view = ns.perceptronView.create(dom.byId('training-perceptron'));
    curve = ns.coordPlot.create(dom.byId('training-curve'), { ariaLabel: 'Lernkurve: richtig klassifizierte Punkte je Iteration' });
    controls = ns.trainingControls.create(dom.byId('training-controls'), { id: 'run', runner: session.runner, onChange: render });
    session.panel.stageCard(dom.byId('training-stage'), 'training-stage-card');
    ns.pages.common.renderAreaLegend(dom.byId('training-area-legend'));
    dom.byId('toggle-shuffle').addEventListener('change', (event) => {
      session.setShuffle(event.target.checked);
    });
    dom.byId('toggle-areas').addEventListener('change', (event) => {
      session.setShowAreas(event.target.checked);
      render();
      ns.progress.save();
    });
  }

  ns.pages.training = { init, render, pause: () => controls.pause(), controls: () => controls };
})(window.BB = window.BB || {});
