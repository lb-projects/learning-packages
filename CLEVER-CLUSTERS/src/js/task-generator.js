/**
 * @file task-generator.js
 * @description Erzeugt Zufallsaufgaben für die Seite „Von Hand rechnen“ (ohne Zugriff auf die Seite).
 *
 * Eine Aufgabe besteht aus verschiedenen Punkten mit ganzzahligen Koordinaten; die Startzentren sind
 * k davon. Eine Ziehung wird verworfen, wenn sie gleiche Abstände zu zwei Zentren oder einen leeren Cluster
 * enthält, die Höchstzahl der Iterationen überschreitet oder keinen Clusterwechsel nach der ersten
 * Zuordnung hat. Der Zufall stammt aus pointData.randomInt, jede Person erhält also eine eigene Aufgabe.
 *
 * Abhängigkeiten:
 *   point-data.js, kmeans.js, hand-calc.js
 */
(function (ns) {
  'use strict';

  /** Schwierigkeitsstufen. */
  const LEVELS = Object.freeze([
    Object.freeze({ id: 'leicht', title: 'Leicht (6 Punkte, k = 2)', points: 6, k: 2, max: 6, maxIterations: 3 }),
    Object.freeze({ id: 'mittel', title: 'Mittel (8 Punkte, k = 2)', points: 8, k: 2, max: 8, maxIterations: 4 }),
    Object.freeze({ id: 'schwer', title: 'Schwer (10 Punkte, k = 3)', points: 10, k: 3, max: 9, maxIterations: 4 })
  ]);
  /** Höchstzahl der Versuche; praktisch wird schon nach wenigen eine Aufgabe gefunden. */
  const MAX_ATTEMPTS = 20000;

  /**
   * Zieht verschiedene Punkte.
   * @param {Object} level - Stufe.
   * @returns {number[][]} Punkte.
   */
  function drawPoints(level) {
    const seen = new Set();
    const out = [];
    while (out.length < level.points) {
      const p = [ns.pointData.randomInt(level.max + 1), ns.pointData.randomInt(level.max + 1)];
      const key = p.join('|');
      if (!seen.has(key)) {
        seen.add(key);
        out.push(p);
      }
    }
    return out;
  }

  /**
   * Erzeugt eine Aufgabe.
   *
   * @param {string} levelId - Kennung der Stufe.
   * @returns {{level:string, points:number[][], centers:number[][]}} Aufgabe.
   * @throws {Error} Wenn die Stufe unbekannt ist oder keine Aufgabe gefunden wurde.
   */
  function generate(levelId) {
    const level = LEVELS.find((l) => l.id === levelId);
    if (!level) {
      throw new Error('Unbekannte Schwierigkeit.');
    }
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const points = drawPoints(level);
      const centers = ns.kmeans.randomIndices(points, level.k).map((i) => points[i]);
      const solved = ns.handCalc.solve(points, centers);
      if (!solved.tie && !solved.empty && solved.changedAfterFirst && solved.iterations <= level.maxIterations) {
        return { level: level.id, points, centers };
      }
    }
    throw new Error('Es konnte keine Aufgabe erzeugt werden.');
  }

  ns.taskGenerator = { LEVELS, generate };
})(window.CC = window.CC || {});
