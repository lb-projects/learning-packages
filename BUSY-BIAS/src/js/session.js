/**
 * @file session.js
 * @description Gemeinsamer Stand aller Seiten: Datensatz, Einstellungen, Trainer, Protokoll und Stufenvergleich.
 *
 * Wann das Training neu beginnt:
 *   Jede Änderung der Einstellungen oder der Punkte setzt das Training und das Protokoll zurück.
 *   Ausnahme: Beim Wechsel zur nächsten Stufe mit „continue“ übernimmt der neue Trainer die
 *   aktuellen Gewichte und θ, und das Protokoll läuft weiter.
 *
 * Skalierung:
 *   Die Originaldaten bleiben unverändert. modelPoints() liefert die Werte, mit denen gerechnet
 *   wird: bei eingeschalteter Skalierung Min-Max auf 0 bis 1, sonst die Originalwerte.
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
  const config = { w: [1, 1], theta: 1, alphaOn: false, alpha: 0.1, scale: false };
  /** Reihenfolge der Punkte auf Seite 2 je Iteration zufällig mischen. */
  let shuffle = false;
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
  /** Beispiel und Stufe, solange die Daten genau diesem Beispiel entsprechen ({id, stage} oder null). */
  let sampleRef = null;
  /** true, wenn das geladene Beispiel von Hand verändert wurde. */
  let sampleModified = false;
  /** true, wenn eine neue Stufe beim Weitertrainieren die Skalierung der alten Punkte verändert hat. */
  let scaleShift = false;
  /** Bereich der Skalierung beim letzten neuen Trainer. */
  let lastRanges = null;

  /**
   * Meldet eine Änderung an die Seiten.
   * @param {string} kind - 'data' (Punkte oder Labels) oder 'config' (Einstellungen).
   */
  function emit(kind) {
    for (const fn of listeners) {
      fn(kind);
    }
  }

  /**
   * Umrechnung für eine Menge von Punkten; ohne Skalierung bleiben die Werte unverändert.
   * @param {Array<Object>} points - Punkte, aus denen Minimum und Maximum stammen.
   * @returns {{apply:function(number, number):number[], ranges:(Object|null)}} Umrechnung.
   */
  function scalerFor(points) {
    return ns.pointData.minMaxScaler(config.scale ? points : []);
  }

  /**
   * Punkte in der Form, mit der gerechnet wird.
   * @param {Array<Object>} points - Punkte des Datensatzes.
   * @param {Object} scaler - Umrechnung.
   * @returns {Array<Object>} {x:[x₁,x₂], raw:(Originalwerte bei Skalierung, sonst null), t, label, group, stage}.
   */
  function modelPoints(points, scaler) {
    return points.map((p) => ({
      x: scaler.apply(p.x, p.y),
      raw: scaler.ranges ? [p.x, p.y] : null,
      t: data.target(p.label),
      label: p.label,
      group: p.group,
      stage: p.stage
    }));
  }

  /** @returns {number|null} Lernrate für die Rechnung oder null ohne Lernrate. */
  function rate() {
    return config.alphaOn ? config.alpha : null;
  }

  /**
   * Schlüssel für alles, was die Rechnung bestimmt. Die Seiten 5 und 6 erkennen daran echte Änderungen.
   * @returns {string} Schlüssel.
   */
  function dataKey() {
    return JSON.stringify([data.points().map((p) => [p.x, p.y, data.target(p.label), p.label]), config.w, config.theta, rate(), config.scale]);
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
      points: modelPoints(data.points(), scalerFor(data.points())),
      w,
      theta,
      alpha: rate(),
      onRecord: addLog,
      shuffle: shuffle ? ns.pointData.shuffled : undefined
    });
    lastRanges = scalerFor(data.points()).ranges;
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
    scaleShift = false;
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
      sampleModified = event.stage === 1 ? false : sampleModified;
      sampleRef = sampleModified ? null : { id: event.sample, stage: event.stage };
    } else if (event.type !== 'positive') {
      sampleRef = null;
      sampleModified = true;
    }
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
        emit('data');
        return;
      }
      if (currentStage !== null && event.stage > 1) {
        syncRun();
      }
      const before = trainer;
      const beforeRanges = JSON.stringify(lastRanges);
      currentStage = event.stage;
      stageRuns[event.stage - 1] = { stage: event.stage, title: stage.title, total: data.count(), startW: null, startTheta: null, processed: 0, foundAfter: null, w: null, theta: null };
      if (event.mode === 'continue' && before) {
        addStageHeading(event.stage);
        newTrainer(before.weights(), before.theta());
        scaleShift = config.scale && JSON.stringify(lastRanges) !== beforeRanges;
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
    emit('data');
  }

  /**
   * Übernimmt Einstellungen und setzt das Training zurück.
   * @param {Object} changes - Geänderte Felder von config.
   */
  function setConfig(changes) {
    Object.assign(config, changes);
    resetTraining();
    emit('config');
  }

  /**
   * Schaltet das Mischen der Reihenfolge um und setzt das Training von Seite 2 zurück.
   * @param {boolean} value - Neuer Zustand.
   */
  function setShuffle(value) {
    shuffle = Boolean(value);
    resetTraining();
    emit('config');
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
    const model = modelPoints(data.points(), scalerFor(data.points()));
    return data.points().map((p, i) => {
      const fires = data.target(p.label) === 1;
      let ring = null;
      if (i === ringIndex) {
        ring = 'current';
      } else if (currentStage !== null && currentStage > 1 && p.stage === currentStage) {
        ring = 'new';
      }
      return {
        x: model[i].x[0], y: model[i].x[1],
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
    return (name === symbol ? symbol : symbol + ': ' + name) + (config.scale ? ' (skaliert)' : '');
  }

  /**
   * Vollständige Angaben für das Koordinatensystem.
   *
   * @param {{line?:boolean, areas?:boolean, ringIndex?:number, probe?:{x:number, y:number},
   *          values?:{w:number[], theta:number}, marks?:Array<Object>, xLabel?:string, yLabel?:string}} options -
   *   Ebenen; probe in Rechenwerten; values: Werte für Gerade und Flächen (ohne Angabe der aktuelle Stand des
   *   Trainers); marks: eigene Punkte statt der Punkte des Datensatzes (Seiten 5 und 6); xLabel, yLabel: eigene
   *   Achsentitel (Seite 5).
   * @returns {{spec:Object, outside:boolean}} Angaben; outside: Die Gerade verläuft außerhalb des Ausschnitts.
   */
  function plotSpec(options) {
    const opts = options || {};
    const attrs = data.attributes();
    const marks = opts.marks || plotPoints(opts);
    const coords = marks.map((p) => ({ x: p.x, y: p.y }));
    if (opts.probe) {
      coords.push(opts.probe);
    }
    const view = ns.coordPlot.fitView(coords, { includeOrigin: true });
    const w = opts.values ? opts.values.w : trainer.weights();
    const theta = opts.values ? opts.values.theta : trainer.theta();
    const spec = {
      view,
      xLabel: opts.xLabel || axisLabel('x₁', attrs.x),
      yLabel: opts.yLabel || axisLabel('x₂', attrs.y),
      points: [...marks]
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

  /**
   * Kurzer Stand eines Trainings.
   * @param {Object} [source] - Trainer; ohne Angabe der von Seite 2.
   * @returns {string} Text.
   */
  function statusText(source) {
    const t = source || trainer;
    if (t.total() === 0) {
      return 'Keine Trainingspunkte vorhanden.';
    }
    if (t.isFinished()) {
      return 'Trenngerade gefunden nach ' + ns.simFormat.plural(t.foundAfter(), 'verarbeitetem Punkt', 'verarbeiteten Punkten') + '.';
    }
    if (!t.hasStarted()) {
      return 'Training noch nicht begonnen.';
    }
    return 'Iteration ' + t.iteration() + ', ' + ns.simFormat.plural(t.processed(), 'verarbeiteter Punkt', 'verarbeitete Punkte') + '.';
  }

  data.onChange(onDataChange);
  newTrainer(config.w, config.theta);

  ns.session = {
    data, config, runner, setConfig, plotSpec, statusText, axisLabel, MAX_LOG, INSEPARABLE_HINT,
    scalerFor, modelPoints, rate, dataKey, setShuffle,
    shuffle: () => shuffle,
    sampleRef: () => sampleRef,
    scaleShift: () => scaleShift,
    trainer: () => trainer,
    log: () => log.slice(-MAX_LOG),
    droppedEntries: () => dropped + Math.max(0, log.length - MAX_LOG),
    stageRuns: () => stageRuns.filter(Boolean),
    currentStage: () => currentStage,
    showAreas: () => showAreas,
    setShowAreas: (value) => { showAreas = Boolean(value); },
    mightBeInseparable: (source) => {
      const t = source || trainer;
      return !t.isFinished() && t.passes() >= INSEPARABLE_HINT;
    },
    onChange: (fn) => listeners.push(fn)
  };
})(window.BB = window.BB || {});
