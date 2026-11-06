/**
 * @file task-generator.js
 * @description Erzeugt Zufallsaufgaben für die Seite „Von Hand rechnen“ (ohne Zugriff auf die Seite).
 *
 * Eine Aufgabe besteht aus Punkten mit ganzzahligen Koordinaten und ganzzahligen Startwerten:
 *   - Eine verdeckte Gerade mit ganzzahligen Werten legt die Labels fest. Kein Punkt liegt auf ihr, und
 *     beide Labels kommen vor. Jede Aufgabe ist deshalb trennbar.
 *   - Die Rechnung muss die Zeilengrenze der Stufe einhalten und mindestens eine Anpassung enthalten.
 *     Sonst wird neu gezogen.
 *   - Der Zufall stammt aus pointData.randomInt, jede Person erhält also eine eigene Aufgabe.
 *
 * Abhängigkeiten:
 *   point-data.js, hand-calc.js
 */
(function (ns) {
  'use strict';

  /** Schwierigkeitsstufen. */
  const LEVELS = Object.freeze([
    Object.freeze({ id: 'leicht', title: 'Leicht (4 Punkte)', points: 4, min: 0, max: 3, alpha: null, maxRows: 12 }),
    Object.freeze({ id: 'mittel', title: 'Mittel (6 Punkte)', points: 6, min: -3, max: 3, alpha: null, maxRows: 24 }),
    Object.freeze({ id: 'schwer', title: 'Schwer (8 Punkte, α = 0,5)', points: 8, min: -5, max: 5, alpha: 0.5, maxRows: 40 })
  ]);
  /** Bereich der Startwerte und der verdeckten Geraden. */
  const VALUE_MIN = -3;
  const VALUE_MAX = 3;
  /** Höchstzahl der Versuche; praktisch wird schon nach wenigen eine Aufgabe gefunden. */
  const MAX_ATTEMPTS = 20000;

  /**
   * Ganze Zufallszahl.
   * @param {number} min - Untergrenze.
   * @param {number} max - Obergrenze (eingeschlossen).
   * @returns {number} Zahl.
   */
  const between = (min, max) => min + ns.pointData.randomInt(max - min + 1);

  /**
   * Zieht verschiedene Punkte und vergibt die Labels.
   * @param {Object} level - Stufe.
   * @returns {Array<Object>|null} Punkte oder null, wenn der Versuch nicht passt.
   */
  function drawPoints(level) {
    const a = between(VALUE_MIN, VALUE_MAX);
    const b = between(VALUE_MIN, VALUE_MAX);
    const c = between(VALUE_MIN, VALUE_MAX);
    if (a === 0 && b === 0) {
      return null;
    }
    const seen = new Set();
    const points = [];
    while (points.length < level.points) {
      const x = [between(level.min, level.max), between(level.min, level.max)];
      const key = x.join();
      const value = a * x[0] + b * x[1];
      if (seen.has(key) || value === c) {
        // Kein Punkt doppelt und keiner auf der verdeckten Geraden; bei kleinen Bereichen begrenzt.
        seen.add(key);
        if (seen.size >= (level.max - level.min + 1) * (level.max - level.min + 1)) {
          return null;
        }
        continue;
      }
      seen.add(key);
      const t = value > c ? 1 : 0;
      points.push({ x, raw: null, t, label: String(t), group: null, stage: null });
    }
    return points.some((p) => p.t === 1) && points.some((p) => p.t === 0) ? points : null;
  }

  /**
   * Erzeugt eine Aufgabe.
   * @param {string} levelId - Kennung der Stufe.
   * @returns {{level:string, points:Array<Object>, w:number[], theta:number, alpha:(number|null)}} Aufgabe.
   * @throws {Error} Wenn keine Aufgabe gefunden wird (praktisch ausgeschlossen).
   */
  function generate(levelId) {
    const level = LEVELS.find((l) => l.id === levelId) || LEVELS[0];
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const points = drawPoints(level);
      if (!points) {
        continue;
      }
      const w = [between(VALUE_MIN, VALUE_MAX), between(VALUE_MIN, VALUE_MAX)];
      const theta = between(VALUE_MIN, VALUE_MAX);
      const solver = ns.handCalc.createSolver(points, w, theta, level.alpha);
      let adjusted = false;
      for (let i = 0; i < level.maxRows; i++) {
        // Zuerst die Zeile abrufen: Erst dadurch rechnet der Solver weiter.
        const row = solver.rowAt(i);
        adjusted = adjusted || row.delta !== 0;
        if (solver.finishedAt() !== null) {
          break;
        }
      }
      if (adjusted && solver.finishedAt() !== null && solver.finishedAt() <= level.maxRows) {
        return { level: level.id, points, w, theta, alpha: level.alpha };
      }
    }
    throw new Error('Es konnte keine Zufallsaufgabe erzeugt werden.');
  }

  ns.taskGenerator = { generate, LEVELS };
})(window.BB = window.BB || {});
