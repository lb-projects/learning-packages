/**
 * @file session.js
 * @description Gemeinsamer Stand aller Seiten: Datensatz, Einstellungen, Trainer, Protokoll und Stufenvergleich.
 *
 * Wann das Training neu beginnt:
 *   Jede Änderung der Einstellungen oder der Punkte setzt das Training und das Protokoll zurück.
 *   Ausnahme: Beim Wechsel zur nächsten Stufe mit „continue“ übernimmt der neue Trainer die
 *   aktuellen Gewichte und θ, und das Protokoll läuft weiter.
 *
 * Protokoll:
 *   Einträge tragen eine fortlaufende Nummer seq, die nie zurückgesetzt wird. Es bleiben die
 *   letzten MAX_LOG Einträge, damit lange Läufe den Browser nicht überlasten.
 *
 * Abhängigkeiten:
 *   point-data.js, perceptron.js, coord-plot.js, samples.js
 */
(function (ns) {
  'use strict';

  /** Höchstzahl der Einträge im Protokoll. */
  const MAX_LOG = 2000;
  /** Ab so vielen Iterationen erscheint der Hinweis auf fehlende lineare Trennbarkeit. */
  const INSEPARABLE_HINT = 100;

  const data = ns.pointData.create({ maxLabels: 2 });
  const config = { w: [1, 1], theta: 1, etaOn: false, eta: 0.1 };
  const listeners = [];
  let trainer = null;
  let log = [];
  let seq = 0;
  let dropped = 0;
  let showAreas = false;
  /** Stufenvergleich: je Stufe {stage, title, total, startW, startTheta, processed, foundAfter, w, theta}. */
  let stageRuns = [];
  /** Nummer der aktuellen Stufe oder null. */
  let currentStage = null;

  /** Meldet eine Änderung an die Seiten. */
  function emit() {
    for (const fn of listeners) {
      fn();
    }
  }

  /**
   * Hängt einen Eintrag an das Protokoll an.
   * @param {Object} entry - Eintrag.
   */
  function addLog(entry) {
    entry.seq = ++seq;
    log.push(entry);
    // Blockweise kürzen, weil lange Läufe sehr viele Einträge erzeugen.
    if (log.length > MAX_LOG * 2) {
      const extra = log.length - MAX_LOG;
      log.splice(0, extra);
      dropped += extra;
    }
  }

  /** Leert das Protokoll. */
  function clearLog() {
    log = [];
    dropped = 0;
  }

  /**
   * Erzeugt einen neuen Trainer.
   * @param {number[]} w - Startgewichte.
   * @param {number} theta - Startschwellenwert.
   */
  function newTrainer(w, theta) {
    trainer = ns.perceptron.createTrainer({
      points: data.points().map((p) => ({ x: [p.x, p.y], t: data.target(p.label), label: p.label, group: p.group })),
      w,
      theta,
      eta: config.etaOn ? config.eta : null,
      onRecord: addLog
    });
    if (currentStage !== null) {
      const run = stageRuns[currentStage - 1];
      run.total = data.count();
      run.startW = [...w];
      run.startTheta = theta;
    }
    syncRun();
  }

  /** Überträgt den Stand des Trainers in die aktuelle Zeile des Stufenvergleichs. */
  function syncRun() {
    if (currentStage === null) {
      return;
    }
    const run = stageRuns[currentStage - 1];
    run.processed = trainer.processed();
    run.foundAfter = trainer.foundAfter();
    run.w = trainer.weights();
    run.theta = trainer.theta();
  }

  /** Setzt das Training auf die Startwerte der Einstellungen zurück. */
  function resetTraining() {
    clearLog();
    if (currentStage !== null) {
      addStageHeading(currentStage);
    }
    newTrainer(config.w, config.theta);
  }

  /**
   * Zwischenüberschrift im Protokoll.
   * @param {number} number - Nummer der Stufe.
   */
  function addStageHeading(number) {
    addLog({ kind: 'stage', text: 'Stufe ' + number + ': ' + stageRuns[number - 1].title + ' (' + ns.simFormat.plural(data.count(), 'Punkt', 'Punkte') + ')' });
  }

  /**
   * Reagiert auf Änderungen des Datensatzes.
   * @param {Object} event - Meldung des Datensatzes.
   */
  function onDataChange(event) {
    if (event.stage) {
      const sample = ns.samples.find((s) => s.id === event.sample);
      if (event.stage === 1) {
        stageRuns = [];
      }
      const stage = sample.stages[event.stage - 1];
      const isMulti = sample.stages.length > 1;
      if (!isMulti) {
        currentStage = null;
        stageRuns = [];
        resetTraining();
        emit();
        return;
      }
      if (currentStage !== null && event.stage > 1) {
        syncRun();
      }
      const before = trainer;
      currentStage = event.stage;
      stageRuns[event.stage - 1] = { stage: event.stage, title: stage.title, total: data.count(), startW: null, startTheta: null, processed: 0, foundAfter: null, w: null, theta: null };
      if (event.mode === 'continue' && before) {
        addStageHeading(event.stage);
        newTrainer(before.weights(), before.theta());
      } else {
        resetTraining();
      }
    } else {
      if (event.type === 'clear' || event.type === 'replace' || (event.type === 'append' && !event.stage)) {
        currentStage = null;
        stageRuns = [];
      }
      resetTraining();
    }
    emit();
  }

  /**
   * Übernimmt Einstellungen und setzt das Training zurück.
   * @param {Object} changes - Geänderte Felder von config.
   */
  function setConfig(changes) {
    Object.assign(config, changes);
    resetTraining();
    emit();
  }

  /** Steuerbares Objekt für training-controls.js. */
  const runner = {
    step() {
      trainer.step();
      syncRun();
    },
    runIterations(count) {
      trainer.runIterations(count);
      syncRun();
    },
    isFinished: () => trainer.isFinished(),
    isReady: () => trainer.total() > 0,
    hasStarted: () => trainer.hasStarted(),
    reset: resetTraining
  };

  /**
   * Punkte für das Koordinatensystem.
   * @param {Object} [options] - {ringIndex: Index des aktuellen Punkts}.
   * @returns {Array<Object>} Punkte für coord-plot.js.
   */
  function plotPoints(options) {
    const ringIndex = options && options.ringIndex !== undefined ? options.ringIndex : -1;
    return data.points().map((p, i) => {
      const fires = data.target(p.label) === 1;
      let ring = null;
      if (i === ringIndex) {
        ring = 'current';
      } else if (currentStage !== null && currentStage > 1 && p.stage === currentStage) {
        ring = 'new';
      }
      return {
        x: p.x, y: p.y,
        shape: fires ? 'circle' : 'square',
        cls: fires ? 'pt-fire' : 'pt-nofire',
        ring,
        title: 'Punkt ' + (i + 1) + ': (' + ns.simFormat.num(p.x) + '; ' + ns.simFormat.num(p.y) + '), Label ' + p.label + (p.group ? ', ' + p.group : '')
      };
    });
  }

  /**
   * Beschriftung einer Achse.
   * @param {string} symbol - x₁ oder x₂.
   * @param {string} name - Name des Attributs.
   * @returns {string} Beschriftung.
   */
  function axisLabel(symbol, name) {
    return name === symbol ? symbol : symbol + ': ' + name;
  }

  /**
   * Vollständige Angaben für das Koordinatensystem.
   *
   * @param {{line?:boolean, areas?:boolean, ringIndex?:number, probe?:{x:number, y:number}}} options - Ebenen.
   * @returns {{spec:Object, outside:boolean}} Angaben; outside: Die Gerade verläuft außerhalb des Ausschnitts.
   */
  function plotSpec(options) {
    const opts = options || {};
    const attrs = data.attributes();
    const coords = data.points().map((p) => ({ x: p.x, y: p.y }));
    if (opts.probe) {
      coords.push(opts.probe);
    }
    const view = ns.coordPlot.fitView(coords);
    const w = trainer.weights();
    const theta = trainer.theta();
    const spec = {
      view,
      xLabel: axisLabel('x₁', attrs.x),
      yLabel: axisLabel('x₂', attrs.y),
      points: plotPoints(opts)
    };
    let outside = false;
    if (opts.areas) {
      spec.regions = ns.perceptron.regions(w, theta, view).map((r) => ({ polygon: r.polygon, cls: r.fires ? 'plot-region-fire' : 'plot-region-nofire' }));
    }
    if (opts.line) {
      const seg = ns.perceptron.segment(w, theta, view);
      spec.lines = seg ? [seg] : [];
      outside = !seg && ns.perceptron.lineOf(w, theta).kind !== 'none';
    }
    if (opts.probe) {
      spec.points.push({ x: opts.probe.x, y: opts.probe.y, shape: 'diamond', cls: 'pt-probe', title: 'Eingegebener Punkt' });
    }
    return { spec, outside };
  }

  /** @returns {string} Kurzer Stand des Trainings. */
  function statusText() {
    if (trainer.total() === 0) {
      return 'Keine Trainingspunkte vorhanden.';
    }
    if (trainer.isFinished()) {
      return 'Trenngerade gefunden nach ' + ns.simFormat.plural(trainer.foundAfter(), 'verarbeitetem Punkt', 'verarbeiteten Punkten') + '.';
    }
    if (!trainer.hasStarted()) {
      return 'Training noch nicht begonnen.';
    }
    return 'Iteration ' + trainer.iteration() + ', ' + ns.simFormat.plural(trainer.processed(), 'verarbeiteter Punkt', 'verarbeitete Punkte') + '.';
  }

  data.onChange(onDataChange);
  newTrainer(config.w, config.theta);

  ns.session = {
    data, config, runner, setConfig, plotSpec, statusText, axisLabel, MAX_LOG, INSEPARABLE_HINT,
    trainer: () => trainer,
    log: () => log.slice(-MAX_LOG),
    droppedEntries: () => dropped + Math.max(0, log.length - MAX_LOG),
    stageRuns: () => stageRuns.filter(Boolean),
    currentStage: () => currentStage,
    showAreas: () => showAreas,
    setShowAreas: (value) => { showAreas = Boolean(value); },
    mightBeInseparable: () => !trainer.isFinished() && trainer.passes() >= INSEPARABLE_HINT,
    onChange: (fn) => listeners.push(fn)
  };
})(window.BB = window.BB || {});
