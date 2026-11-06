/**
 * @file pages/test.js
 * @description Seite 6 „Test und Konfusionsmatrix“: zufällige Testdaten zurückhalten, ohne sie
 *              trainieren, danach klassifizieren und das Ergebnis in einer Konfusionsmatrix ablesen.
 *
 * Eigener Trainer:
 *   Die Seite ändert nichts an den Seiten 1 bis 5; Seite 2 und das Protokoll trainieren weiter mit
 *   allen Punkten. Die Startwerte kommen von Seite 1. Bei Skalierung stammen Minimum und Maximum nur
 *   aus den Trainingspunkten, damit die Testdaten nicht ins Training einfließen.
 *
 * Ablauf:
 *   1. Testdaten auswählen (je Label getrennt, pointData.selectTestIndices).
 *   2. Modus „Training“ wie auf Seite 2. Testpunkte sind Hohlmarker und werden nicht verwendet.
 *   3. Modus „Test“: Gewichte und θ sind fest. Weitertrainieren verwirft das Testergebnis.
 *   4. Sind alle Testpunkte klassifiziert, erscheint die Konfusionsmatrix.
 *
 * Abhängigkeiten:
 *   dom-utils.js, sim-format.js, point-data.js, coord-plot.js, training-controls.js, confusion-matrix.js,
 *   perceptron.js, perceptron-view.js, format-utils.js, session.js, progress.js, pages/common.js
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const session = ns.session;
  const { num, plural } = ns.simFormat;

  const FRACTION_MIN = 1;
  const FRACTION_MAX = 90;

  const state = {
    fraction: 20,
    /** Indizes der Testpunkte im Datensatz oder null ohne Auswahl. */
    selection: null,
    trainPoints: [],
    testPoints: [],
    trainer: null,
    mode: 'training',
    /** Ergebnisse der klassifizierten Testpunkte. */
    results: [],
    note: '',
    key: null
  };

  let plot = null;
  let view = null;
  let controls = null;

  /** @returns {boolean} true, wenn alle Testpunkte klassifiziert sind. */
  function allClassified() {
    return state.testPoints.length > 0 && state.results.length === state.testPoints.length;
  }

  /** Erzeugt einen neuen Trainer für die Trainingspunkte. */
  function newTrainer() {
    state.trainer = ns.perceptron.createTrainer({
      points: state.trainPoints,
      w: session.config.w,
      theta: session.config.theta,
      alpha: session.rate(),
      onRecord: () => {}
    });
    state.results = [];
    state.mode = 'training';
  }

  /**
   * Teilt die Punkte nach einer Auswahl auf.
   * @param {number[]} selection - Indizes der Testpunkte.
   */
  function applySelection(selection) {
    const points = session.data.points();
    const isTest = new Set(selection);
    const train = points.filter((_, i) => !isTest.has(i));
    const test = points.filter((_, i) => isTest.has(i));
    const scaler = session.scalerFor(train);
    state.selection = selection;
    state.trainPoints = session.modelPoints(train, scaler);
    state.testPoints = session.modelPoints(test, scaler);
    newTrainer();
  }

  /** Verwirft die Auswahl. */
  function clearSelection() {
    state.selection = null;
    state.trainPoints = [];
    state.testPoints = [];
    state.trainer = null;
    state.results = [];
    state.mode = 'training';
    if (controls) {
      controls.pause();
    }
  }

  /** Wählt die Testdaten aus. */
  function select() {
    const input = dom.byId('test-fraction');
    const error = dom.byId('test-select-error');
    const value = ns.pointData.parseNumber(input.value);
    if (value === null || !Number.isInteger(value) || value < FRACTION_MIN || value > FRACTION_MAX) {
      error.textContent = 'Bitte eine ganze Zahl von ' + FRACTION_MIN + ' bis ' + FRACTION_MAX + ' eingeben.';
      return;
    }
    if (state.trainer && state.trainer.hasStarted() && !window.confirm('Die neue Auswahl verwirft das Training und den Test auf dieser Seite. Fortfahren?')) {
      return;
    }
    const chosen = ns.pointData.selectTestIndices(session.data.points(), value / 100);
    if (chosen.length === 0) {
      error.textContent = 'Es lassen sich keine Testdaten auswählen: Jedes Label braucht mindestens einen Trainingspunkt.';
      return;
    }
    error.textContent = '';
    state.fraction = value;
    state.note = '';
    if (controls) {
      controls.pause();
    }
    applySelection(chosen);
    render();
    ns.progress.save();
  }

  /** Steuerbares Objekt für training-controls.js. Weitertrainieren verwirft das Testergebnis. */
  const runner = {
    step() {
      state.results = [];
      state.trainer.step();
    },
    runIterations(count) {
      state.results = [];
      state.trainer.runIterations(count);
    },
    isFinished: () => Boolean(state.trainer) && state.trainer.isFinished(),
    isReady: () => Boolean(state.trainer) && state.trainer.total() > 0,
    hasStarted: () => Boolean(state.trainer) && state.trainer.hasStarted(),
    reset() {
      newTrainer();
    }
  };

  /** Klassifiziert den nächsten Testpunkt. */
  function classifyNext() {
    const i = state.results.length;
    if (i >= state.testPoints.length) {
      return;
    }
    const p = state.testPoints[i];
    const w = state.trainer.weights();
    const theta = state.trainer.theta();
    const { sum, y } = ns.perceptron.classify(w, theta, p.x);
    state.results.push({ point: p, sum, y, correct: y === p.t, predicted: ns.fmt.labelText(session.data.labelOf(y)), w, theta });
  }

  /**
   * Punkte für das Koordinatensystem.
   * @returns {Array<Object>} Punkte für coord-plot.js.
   */
  function marks() {
    const shape = (p) => ({ shape: p.t === 1 ? 'circle' : 'square', fire: p.t === 1 ? 'pt-fire' : 'pt-nofire' });
    const trainerActive = state.mode === 'training' && state.trainer.hasStarted() && !state.trainer.isFinished();
    const train = state.trainPoints.map((p, i) => ({
      x: p.x[0], y: p.x[1], shape: shape(p).shape, cls: shape(p).fire,
      ring: trainerActive && i === state.trainer.index() ? 'current' : null,
      title: 'Trainingspunkt: Label ' + p.label
    }));
    const last = state.results.length - 1;
    const test = state.testPoints.map((p, i) => {
      const result = state.results[i];
      let ring = null;
      if (state.mode === 'test' && i === last && !allClassified()) {
        ring = 'current';
      } else if (result && !result.correct) {
        ring = 'wrong';
      }
      return { x: p.x[0], y: p.x[1], shape: shape(p).shape, cls: shape(p).fire + ' pt-test', ring, title: 'Testpunkt: Label ' + p.label };
    });
    return [...train, ...test];
  }

  /**
   * Stand für die Zeichnung des Perzeptrons im Testmodus: der zuletzt klassifizierte Testpunkt.
   * @returns {Object} Objekt mit den Abfragen, die perceptron-view.js vom Trainer verwendet.
   */
  function testView() {
    const r = state.results[state.results.length - 1];
    return {
      phase: () => (r ? 'output' : 'idle'),
      record: () => (r ? { x: r.point.x, sum: r.sum, y: r.y } : null),
      weights: () => state.trainer.weights(),
      theta: () => state.trainer.theta()
    };
  }

  /** Zeichnet das Koordinatensystem. */
  function drawPlot() {
    const trainer = state.trainer;
    const values = { w: trainer.weights(), theta: trainer.theta() };
    const { spec, outside } = session.plotSpec({ line: true, areas: true, values, marks: marks() });
    plot.render(spec);
    ns.pages.common.renderEquation(dom.byId('test-equation'), outside, { ...values, label: 'Gerade' });
  }

  /** Zeigt die Rechnung zum zuletzt klassifizierten Testpunkt. */
  function renderCalc() {
    const box = dom.clear(dom.byId('test-calc'));
    const r = state.results[state.results.length - 1];
    if (!r) {
      box.appendChild(dom.el('p', { class: 'hint' }, 'Klassifizieren Sie die Testpunkte mit den Werten aus dem Training.'));
      return;
    }
    const lines = [
      'Testpunkt ' + state.results.length + ' von ' + state.testPoints.length + ': ' + ns.fmt.inputsText(r.point.x, r.point.raw) + (r.point.group ? ' (' + r.point.group + ')' : ''),
      ns.fmt.currentLine(r.w, r.theta),
      ns.fmt.sumLine(r.w, r.point.x, r.sum),
      ns.fmt.activationLine(r.sum, r.theta, r.y),
      'Berechnet: Label ' + r.predicted + ', erwartet: Label ' + r.point.label
    ];
    for (const text of lines) {
      box.appendChild(dom.el('p', { class: 'protocol-line' }, text));
    }
    box.appendChild(dom.el('p', { class: r.correct ? 'result-ok' : 'result-wrong', id: 'test-calc-verdict' }, r.correct ? 'Korrekt klassifiziert' : 'Falsch klassifiziert'));
  }

  /** Zeigt die Tabelle der Testpunkte. */
  function renderResults() {
    const attrs = session.data.attributes();
    const scaled = session.config.scale;
    const numCol = (text) => dom.el('th', { scope: 'col', class: 'num' }, text);
    const head = dom.clear(dom.byId('test-results-head'));
    dom.appendChildren(head, [
      numCol('Nr.'), numCol(attrs.x), numCol(attrs.y),
      scaled ? numCol('x₁ skaliert') : null,
      scaled ? numCol('x₂ skaliert') : null,
      dom.el('th', { scope: 'col' }, 'Erwartetes Label'),
      numCol('a'), numCol('f(a)'),
      dom.el('th', { scope: 'col' }, 'Berechnetes Label'),
      dom.el('th', { scope: 'col' }, 'Ergebnis')
    ]);
    const body = dom.clear(dom.byId('test-results-body'));
    state.testPoints.forEach((p, i) => {
      const r = state.results[i];
      const raw = p.raw || p.x;
      body.appendChild(dom.el('tr', { class: i === state.results.length - 1 ? 'is-current' : null }, [
        dom.el('td', { class: 'num' }, i + 1),
        dom.el('td', { class: 'num' }, num(raw[0])),
        dom.el('td', { class: 'num' }, num(raw[1])),
        scaled ? dom.el('td', { class: 'num' }, num(p.x[0])) : null,
        scaled ? dom.el('td', { class: 'num' }, num(p.x[1])) : null,
        dom.el('td', null, p.label),
        dom.el('td', { class: 'num' }, r ? num(r.sum) : ''),
        dom.el('td', { class: 'num' }, r ? r.y : ''),
        dom.el('td', null, r ? r.predicted : ''),
        dom.el('td', null, r ? dom.el('span', { class: r.correct ? 'result-ok' : 'result-wrong' }, r.correct ? '✓ richtig' : '✗ falsch') : '')
      ]));
    });
  }

  /** Zeigt die Konfusionsmatrix, sobald alle Testpunkte klassifiziert sind. */
  function renderMatrix() {
    const card = dom.byId('test-matrix-card');
    card.hidden = !allClassified();
    if (card.hidden) {
      return;
    }
    const data = session.data;
    const labels = [ns.fmt.labelText(data.labelOf(1)), ns.fmt.labelText(data.labelOf(0))];
    const m = ns.confusionMatrix.count(labels, state.results.map((r) => ({ actual: r.point.label, predicted: r.predicted })));
    dom.clear(dom.byId('test-matrix')).appendChild(ns.confusionMatrix.table(labels, m));
    const w = state.trainer.weights();
    const theta = state.trainer.theta();
    const trainCorrect = state.trainPoints.filter((p) => ns.perceptron.classify(w, theta, p.x).y === p.t).length;
    const percent = num(Math.round((m.correct / m.total) * 1000) / 10);
    dom.byId('test-accuracy').textContent = 'Genauigkeit im Test: ' + percent + ' % (' + m.correct + ' von ' + m.total + ').';
    dom.byId('test-compare').textContent = 'Training: ' + trainCorrect + ' von ' + state.trainPoints.length + ', Test: ' + m.correct + ' von ' + m.total + '.';
  }

  /** Zeichnet die Seite. */
  function render() {
    if (state.selection && state.key !== session.dataKey()) {
      clearSelection();
    }
    state.key = session.dataKey();
    const noData = session.data.count() === 0;
    dom.byId('test-empty').hidden = !noData;
    dom.byId('test-select-card').hidden = noData;
    dom.byId('test-note').hidden = !state.note;
    dom.byId('test-note').textContent = state.note;
    dom.byId('test-fraction').value = String(state.fraction);
    const active = Boolean(state.selection);
    dom.byId('test-work').hidden = !active;
    dom.byId('test-split').textContent = active
      ? plural(state.trainPoints.length, 'Trainingspunkt', 'Trainingspunkte') + ', ' + plural(state.testPoints.length, 'Testpunkt', 'Testpunkte') + '.'
      : '';
    dom.byId('test-scale-note').hidden = !(active && session.config.scale);
    if (!active) {
      return;
    }
    const trainer = state.trainer;
    const isTest = state.mode === 'test';
    const radioTest = dom.byId('test-mode-test');
    radioTest.disabled = !trainer.hasStarted();
    radioTest.checked = isTest;
    dom.byId('test-mode-training').checked = !isTest;
    dom.byId('test-mode-hint').hidden = trainer.hasStarted();
    dom.byId('test-preliminary').hidden = !isTest || trainer.isFinished();
    dom.byId('test-training-pane').hidden = isTest;
    dom.byId('test-test-pane').hidden = !isTest;
    view.draw(isTest ? testView() : trainer);
    if (isTest) {
      renderCalc();
      dom.byId('test-next').disabled = allClassified();
      dom.byId('test-all').disabled = allClassified();
      dom.byId('test-again').disabled = state.results.length === 0;
    } else {
      ns.pages.common.renderStepResult(dom.byId('test-result'), trainer, 'test');
      ns.pages.common.renderCounters(trainer, { iteration: 'test-count-iteration', processed: 'test-count-processed', last: 'test-count-last', found: 'test-found', hint: 'test-hint' });
      controls.refresh();
    }
    drawPlot();
    ns.pages.common.renderPointLegend(dom.byId('test-point-legend'));
    renderResults();
    renderMatrix();
  }

  /** Reagiert auf Änderungen von Daten und Einstellungen. */
  function onSessionChange() {
    if (state.key === session.dataKey()) {
      return;
    }
    if (state.selection) {
      state.note = 'Daten oder Einstellungen wurden geändert. Bitte die Testdaten neu auswählen.';
    }
    clearSelection();
    state.key = session.dataKey();
  }

  /** Richtet die Seite ein. */
  function init() {
    state.key = session.dataKey();
    plot = ns.coordPlot.create(dom.byId('test-plot'), { ariaLabel: 'Koordinatensystem mit Trainings- und Testpunkten, Gerade und Decision Areas' });
    view = ns.perceptronView.create(dom.byId('test-perceptron'));
    controls = ns.trainingControls.create(dom.byId('test-controls'), { id: 'test-run', runner, onChange: render });
    ns.pages.common.renderAreaLegend(dom.byId('test-area-legend'));
    dom.byId('test-select').addEventListener('click', select);
    dom.byId('test-to-input').addEventListener('click', () => ns.app.showPage('input', { scrollTop: true }));
    dom.byId('test-mode-training').addEventListener('change', () => {
      state.mode = 'training';
      render();
    });
    dom.byId('test-mode-test').addEventListener('change', () => {
      controls.pause();
      state.mode = 'test';
      render();
    });
    dom.byId('test-next').addEventListener('click', () => {
      classifyNext();
      render();
    });
    dom.byId('test-all').addEventListener('click', () => {
      while (!allClassified()) {
        classifyNext();
      }
      render();
    });
    dom.byId('test-again').addEventListener('click', () => {
      state.results = [];
      render();
    });
    session.onChange(onSessionChange);
  }

  /**
   * Stand für die Speicherung.
   * @returns {{f:number, s:number[]}|null} Anteil und Indizes der Testpunkte oder null.
   */
  function exportState() {
    return state.selection ? { f: state.fraction, s: state.selection } : null;
  }

  /**
   * Übernimmt eine gespeicherte Auswahl. Ungültiges wird verworfen.
   * @param {{f:number, s:number[]}} saved - Stand.
   * @returns {boolean} true, wenn sie übernommen wurde.
   */
  function importState(saved) {
    clearSelection();
    state.key = session.dataKey();
    const n = session.data.count();
    if (!saved || !Number.isInteger(saved.f) || saved.f < FRACTION_MIN || saved.f > FRACTION_MAX || !Array.isArray(saved.s) || saved.s.length === 0 ||
        saved.s.length >= n || new Set(saved.s).size !== saved.s.length || !saved.s.every((i) => Number.isInteger(i) && i >= 0 && i < n)) {
      return false;
    }
    state.fraction = saved.f;
    state.note = '';
    applySelection([...saved.s].sort((a, b) => a - b));
    return true;
  }

  ns.pages.test = { init, render, exportState, importState, pause: () => controls.pause(), controls: () => controls, state: () => state };
})(window.BB = window.BB || {});
