/**
 * @file perceptron.js
 * @description Rechenregeln des Perzeptrons und Trainer. Reine Logik ohne Zugriff auf die Seite.
 *
 * Rechenregel (Schwellenwert θ, kein Bias):
 *   a = w₁·x₁ + w₂·x₂;  f(a) = 1, wenn a ≥ θ, sonst 0;  δ = t − f(a).
 *   Nur bei δ ≠ 0: wᵢ ← wᵢ + α·δ·xᵢ und θ ← θ − α·δ. Ohne Lernrate gilt α = 1.
 *   Alle Rechenwerte werden gerundet (sim-format.js, clean), damit Darstellungsfehler von
 *   Gleitkommazahlen keine Klassifikation verfälschen.
 *
 * Ablauf des Trainers je Punkt (ein Aufruf von step() = ein Schritt):
 *   highlight → inputs → sum → output → update (nur bei δ ≠ 0).
 *   Iteration = ein Durchlauf durch alle Punkte in der Reihenfolge der Tabelle oder, mit der Option
 *   shuffle, in einer je Iteration neuen Reihenfolge.
 *   Die Trenngerade gilt als gefunden, wenn eine ganze Iteration ohne Anpassung durchläuft.
 *
 * Abhängigkeiten:
 *   sim-format.js, activations.js
 */
(function (ns) {
  'use strict';

  const { clean } = ns.simFormat;
  const activation = ns.activations.heaviside;

  /**
   * Berechnet Summe und Ausgabe.
   *
   * @param {number[]} w - Gewichte.
   * @param {number} theta - Schwellenwert.
   * @param {number[]} x - Eingänge.
   * @returns {{sum:number, y:number}} Gewichtete Summe und Ausgabe.
   */
  function classify(w, theta, x) {
    const sum = clean(w.reduce((total, wi, i) => total + wi * x[i], 0));
    return { sum, y: activation.output(clean(sum - theta)) };
  }

  /**
   * Wendet die Lernregel an.
   *
   * @param {number[]} w - Gewichte.
   * @param {number} theta - Schwellenwert.
   * @param {number[]} x - Eingänge.
   * @param {number} delta - Fehler.
   * @param {number} alpha - Lernrate.
   * @returns {{w:number[], theta:number}} Neue Werte.
   */
  function learn(w, theta, x, delta, alpha) {
    return {
      w: w.map((wi, i) => clean(wi + alpha * delta * x[i])),
      theta: clean(theta - alpha * delta)
    };
  }

  /**
   * Beschreibt die Gerade w₁x₁ + w₂x₂ = θ.
   *
   * @param {number[]} w - Gewichte.
   * @param {number} theta - Schwellenwert.
   * @returns {{kind:string, m?:number, b?:number, x?:number, fires?:boolean}} 'normal' (x₂ = m·x₁ + b),
   *   'vertical' (x₁ = x) oder 'none' (keine Gerade; fires: die ganze Fläche feuert).
   */
  function lineOf(w, theta) {
    if (w[0] === 0 && w[1] === 0) {
      return { kind: 'none', fires: theta <= 0 };
    }
    if (w[1] === 0) {
      return { kind: 'vertical', x: clean(theta / w[0]) };
    }
    return { kind: 'normal', m: clean(-w[0] / w[1]), b: clean(theta / w[1]) };
  }

  /**
   * Ecken eines Ausschnitts als Polygon.
   * @param {{xmin:number,xmax:number,ymin:number,ymax:number}} view - Ausschnitt.
   * @returns {number[][]} Ecken.
   */
  function viewPolygon(view) {
    return [[view.xmin, view.ymin], [view.xmax, view.ymin], [view.xmax, view.ymax], [view.xmin, view.ymax]];
  }

  /**
   * Schneidet ein Polygon mit einer Halbebene (Sutherland-Hodgman).
   *
   * @param {number[][]} polygon - Ecken.
   * @param {function(number[]):number} side - Wert ≥ 0 bedeutet „innerhalb“.
   * @returns {number[][]} Ecken des Schnitts.
   */
  function clipPolygon(polygon, side) {
    const out = [];
    polygon.forEach((p, i) => {
      const q = polygon[(i + 1) % polygon.length];
      const sp = side(p);
      const sq = side(q);
      if (sp >= 0) {
        out.push(p);
      }
      if ((sp >= 0) !== (sq >= 0)) {
        const f = sp / (sp - sq);
        out.push([p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]);
      }
    });
    return out;
  }

  /**
   * Teil der Geraden innerhalb des Ausschnitts.
   *
   * @param {number[]} w - Gewichte.
   * @param {number} theta - Schwellenwert.
   * @param {Object} view - Ausschnitt.
   * @returns {{x1:number,y1:number,x2:number,y2:number}|null} Strecke oder null, wenn die Gerade nicht hindurchgeht.
   */
  function segment(w, theta, view) {
    if (w[0] === 0 && w[1] === 0) {
      return null;
    }
    const side = (p) => w[0] * p[0] + w[1] * p[1] - theta;
    const corners = viewPolygon(view);
    const hits = [];
    corners.forEach((p, i) => {
      const q = corners[(i + 1) % corners.length];
      const sp = side(p);
      const sq = side(q);
      if (sp === 0) {
        hits.push(p);
      } else if (sp * sq < 0) {
        const f = sp / (sp - sq);
        hits.push([p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]);
      }
    });
    if (hits.length < 2) {
      return null;
    }
    return { x1: hits[0][0], y1: hits[0][1], x2: hits[1][0], y2: hits[1][1] };
  }

  /**
   * Decision Areas innerhalb des Ausschnitts.
   *
   * @param {number[]} w - Gewichte.
   * @param {number} theta - Schwellenwert.
   * @param {Object} view - Ausschnitt.
   * @returns {Array<{polygon:number[][], fires:boolean}>} Flächen.
   */
  function regions(w, theta, view) {
    const corners = viewPolygon(view);
    const line = lineOf(w, theta);
    if (line.kind === 'none') {
      return [{ polygon: corners, fires: line.fires }];
    }
    const side = (p) => w[0] * p[0] + w[1] * p[1] - theta;
    return [
      { polygon: clipPolygon(corners, side), fires: true },
      { polygon: clipPolygon(corners, (p) => -side(p)), fires: false }
    ].filter((r) => r.polygon.length >= 3);
  }

  /**
   * Erzeugt einen Trainer.
   *
   * @param {{points:Array<{x:number[], t:number, label:string, group:(string|null)}>, w:number[], theta:number,
   *          alpha:(number|null), onRecord:function(Object):void, shuffle?:function(number[]):number[]}} options -
   *   Punkte, Startwerte, Lernrate (null: ohne Lernrate, also α = 1), Rückruf für jede neue Aufzeichnung,
   *   Mischfunktion für die Reihenfolge je Iteration (ohne Angabe die Reihenfolge der Punkte).
   * @returns {Object} Trainer (siehe Rückgabe).
   */
  function createTrainer(options) {
    const points = options.points;
    const total = points.length;
    const alpha = options.alpha;
    const rate = alpha === null ? 1 : alpha;
    let w = [...options.w];
    let theta = options.theta;
    let phase = 'idle';
    /** Reihenfolge der aktuellen Iteration (Indizes der Punkte). */
    const fixedOrder = points.map((_, i) => i);
    let order = fixedOrder;
    /** Stelle in der aktuellen Iteration. */
    let position = -1;
    /** Index des aktuellen Punkts. */
    let index = -1;
    let iteration = 0;
    let processed = 0;
    let correctInPass = 0;
    let passes = 0;
    let lastPass = null;
    /** Richtig klassifizierte Punkte je abgeschlossener Iteration (für die Lernkurve). */
    const history = [];
    let foundAfter = null;
    let record = null;

    /** Beginnt den nächsten Punkt, nach dem letzten die nächste Iteration. */
    function begin() {
      if (position === -1 || position === total - 1) {
        position = 0;
        order = options.shuffle ? options.shuffle(fixedOrder) : fixedOrder;
        iteration++;
        correctInPass = 0;
      } else {
        position++;
      }
      index = order[position];
      const p = points[index];
      phase = 'highlight';
      record = {
        kind: 'point', iteration, index, position, shuffled: Boolean(options.shuffle), total, x: p.x, raw: p.raw || null, label: p.label, t: p.t, group: p.group, alpha,
        wBefore: [...w], thetaBefore: theta, sum: null, y: null, delta: null, wAfter: null, thetaAfter: null, phase
      };
      options.onRecord(record);
    }

    /** Schließt die Iteration ab, wenn der aktuelle Punkt der letzte war. */
    function endPassIfLast() {
      if (position === total - 1) {
        passes++;
        lastPass = { correct: correctInPass, total };
        history.push(correctInPass);
        if (correctInPass === total) {
          foundAfter = processed;
        }
      }
    }

    /**
     * Führt einen Schritt aus.
     * @returns {boolean} false, wenn nichts mehr zu tun ist.
     */
    function step() {
      if (total === 0 || foundAfter !== null) {
        return false;
      }
      if (phase === 'highlight') {
        phase = 'inputs';
      } else if (phase === 'inputs') {
        phase = 'sum';
        record.sum = classify(w, theta, record.x).sum;
      } else if (phase === 'sum') {
        phase = 'output';
        record.y = classify(w, theta, record.x).y;
        record.delta = record.t - record.y;
        processed++;
        if (record.delta === 0) {
          correctInPass++;
          endPassIfLast();
        }
      } else if (phase === 'output' && record.delta !== 0) {
        phase = 'update';
        const next = learn(w, theta, record.x, record.delta, rate);
        w = next.w;
        theta = next.theta;
        record.wAfter = [...w];
        record.thetaAfter = theta;
        endPassIfLast();
      } else {
        begin();
        return true;
      }
      record.phase = phase;
      return true;
    }

    /**
     * Rechnet Iterationen ohne Zwischenanzeige. Eine angefangene Iteration wird beendet und zählt als erste.
     * @param {number} count - Anzahl.
     */
    function runIterations(count) {
      const target = passes + count;
      while (foundAfter === null && total > 0 && passes < target) {
        step();
      }
    }

    return {
      step, runIterations,
      weights: () => [...w],
      theta: () => theta,
      phase: () => phase,
      index: () => index,
      position: () => position,
      iteration: () => iteration,
      processed: () => processed,
      passes: () => passes,
      lastPass: () => lastPass,
      history: () => history,
      foundAfter: () => foundAfter,
      isFinished: () => foundAfter !== null,
      hasStarted: () => phase !== 'idle',
      record: () => record,
      total: () => total
    };
  }

  ns.perceptron = { activation, classify, learn, lineOf, segment, regions, createTrainer };
})(window.BB = window.BB || {});
