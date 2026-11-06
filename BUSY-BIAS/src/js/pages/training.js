/**
 * @file pages/training.js
 * @description Seite 2: Training nachvollziehen.
 *
 * Aufbau:
 *   Links das Perzeptron, darunter Ergebnis des Schritts, Steuerung und Zähler.
 *   Rechts das Koordinatensystem mit aktuellem Punkt und Gerade, darunter Schalter für die
 *   Decision Areas, Legende und Geradengleichung.
 *   Darunter aufklappbar die Punktetabelle; bei mehrstufigen Beispielen zusätzlich Stufenkarte
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

  /** Überschrift je Schritt. */
  const PHASE_TITLES = {
    idle: 'Bereit: „Weiter“ startet das Training.',
    highlight: 'Schritt 1: Trainingspunkt hervorheben',
    inputs: 'Schritt 2: Eingänge vorbelegen',
    sum: 'Schritt 3: Gewichtete Summe berechnen',
    output: 'Schritt 4: Ausgabe berechnen und vergleichen',
    update: 'Schritt 5: Gewichte und Schwellenwert anpassen'
  };

  let plot = null;
  let view = null;
  let controls = null;
  let tableKey = null;

  /** Zeigt das Ergebnis des aktuellen Schritts. */
  function renderResult() {
    const trainer = session.trainer();
    const data = session.data;
    const phase = trainer.phase();
    const r = trainer.record();
    const box = dom.byId('training-result');
    dom.clear(box);
    box.appendChild(dom.el('p', { class: 'result-title', id: 'training-phase' }, trainer.isFinished() ? 'Trenngerade gefunden.' : PHASE_TITLES[phase]));
    if (!r) {
      return;
    }
    const add = (id, text, cls) => box.appendChild(dom.el('p', { id, class: cls || null }, text));
    add('training-point', 'Punkt ' + (r.index + 1) + ' von ' + r.total + ' in Iteration ' + r.iteration + ': x₁ = ' + num(r.x[0]) + ', x₂ = ' + num(r.x[1]) + (r.group ? ' (' + r.group + ')' : ''));
    if (phase === 'sum' || phase === 'output' || phase === 'update') {
      add('training-sum', ns.fmt.sumLine(r.wBefore, r.x, r.sum));
    }
    if (phase === 'output' || phase === 'update') {
      add('training-activation', ns.fmt.activationLine(r.sum, r.thetaBefore, r.y));
      add('training-expected', 'Erwartet: Label ' + r.label + ' (t = ' + r.t + ')');
      add('training-computed', 'Berechnet: Label ' + ns.fmt.labelText(data.labelOf(r.y)) + ' (y = ' + r.y + ')');
      add('training-verdict', r.delta === 0 ? 'Richtig klassifiziert: keine Anpassung nötig.' : 'Falsch klassifiziert: δ = ' + num(r.delta) + (phase === 'output' ? ', Gewichte und Schwellenwert müssen angepasst werden.' : ''), r.delta === 0 ? 'result-ok' : 'result-wrong');
    }
    if (phase === 'update') {
      add('training-update', 'w₁: ' + num(r.wBefore[0]) + ' → ' + num(r.wAfter[0]) + ', w₂: ' + num(r.wBefore[1]) + ' → ' + num(r.wAfter[1]) + ', θ: ' + num(r.thetaBefore) + ' → ' + num(r.thetaAfter));
    }
  }

  /** Zeigt die Zähler. */
  function renderCounters() {
    const trainer = session.trainer();
    const last = trainer.lastPass();
    dom.byId('count-iteration').textContent = String(trainer.iteration());
    dom.byId('count-processed').textContent = String(trainer.processed());
    dom.byId('count-last').textContent = last ? last.correct + ' von ' + last.total : '–';
    const found = dom.byId('training-found');
    found.hidden = !trainer.isFinished();
    found.textContent = trainer.isFinished() ? session.statusText() : '';
    const hint = dom.byId('training-hint');
    hint.hidden = !session.mightBeInseparable();
    dom.byId('training-empty').hidden = trainer.total() > 0;
  }

  /** Füllt die Punktetabelle, wenn sich die Daten geändert haben, und markiert den aktuellen Punkt. */
  function renderTable() {
    const data = session.data;
    const points = data.points();
    const hasGroups = points.some((p) => p.group);
    const key = points.map((p) => p.id).join(',') + '|' + data.positive();
    const tbody = dom.byId('training-tbody');
    if (key !== tableKey) {
      tableKey = key;
      const attrs = data.attributes();
      const head = dom.byId('training-thead');
      dom.clear(head);
      dom.appendChildren(head, [
        dom.el('th', { scope: 'col', class: 'num' }, 'Nr.'),
        dom.el('th', { scope: 'col', class: 'num' }, attrs.x),
        dom.el('th', { scope: 'col', class: 'num' }, attrs.y),
        dom.el('th', { scope: 'col' }, 'Label'),
        dom.el('th', { scope: 'col', class: 'num' }, 't'),
        hasGroups ? dom.el('th', { scope: 'col' }, 'Stufe, Gruppe') : null
      ]);
      dom.clear(tbody);
      points.forEach((p, i) => {
        tbody.appendChild(dom.el('tr', null, [
          dom.el('td', { class: 'num' }, i + 1),
          dom.el('td', { class: 'num' }, num(p.x)),
          dom.el('td', { class: 'num' }, num(p.y)),
          dom.el('td', null, p.label),
          dom.el('td', { class: 'num' }, data.target(p.label)),
          hasGroups ? dom.el('td', null, p.group ? p.stage + ', ' + p.group : '–') : null
        ]));
      });
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
    view.draw(trainer);
    renderResult();
    renderCounters();
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
    controls = ns.trainingControls.create(dom.byId('training-controls'), { id: 'run', runner: session.runner, onChange: render });
    session.panel.stageCard(dom.byId('training-stage'), 'training-stage-card');
    ns.pages.common.renderAreaLegend(dom.byId('training-area-legend'));
    dom.byId('toggle-areas').addEventListener('change', (event) => {
      session.setShowAreas(event.target.checked);
      render();
    });
  }

  ns.pages.training = { init, render, pause: () => controls.pause(), controls: () => controls };
})(window.BB = window.BB || {});
