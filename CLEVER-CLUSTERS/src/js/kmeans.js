/**
 * @file kmeans.js
 * @description k-Means nach Lloyd: Zuordnung, Aktualisierung, WCSS, kompletter Lauf und Trainer.
 *
 * Rechenregel:
 *   Zuordnung:     Jeder Punkt gehört zum nächsten Zentrum; bei gleichem Abstand zum mit der
 *                  kleineren Nummer.
 *   Aktualisierung: Jedes Zentrum wird zum Mittelpunkt seiner Punkte. Ein leerer Cluster behält
 *                  sein Zentrum.
 *   WCSS:          Summe der quadrierten Abstände aller Punkte zu ihrem Zentrum.
 *   Ende:          Eine Zuordnung ändert nichts mehr gegenüber der vorherigen.
 *
 * Das Modul greift nicht auf die Seite zu. Punkte und Zentren sind Felder [x, y].
 *
 * Abhängigkeiten:
 *   point-data.js (nur shuffled für die Standard-Zufallsquelle)
 */
(function (ns) {
  'use strict';

  /** Obergrenze der Iterationen eines kompletten Laufs, nur als Schutz gegen Rundungseffekte. */
  const MAX_RUN_ITERATIONS = 500;

  /**
   * Quadrierter Abstand.
   * @param {number[]} a - Punkt.
   * @param {number[]} b - Punkt.
   * @returns {number} Quadrierter Abstand.
   */
  function dist2(a, b) {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    return dx * dx + dy * dy;
  }

  /**
   * Ordnet jeden Punkt dem nächsten Zentrum zu.
   * @param {number[][]} points - Punkte.
   * @param {number[][]} centers - Zentren.
   * @returns {number[]} Clusternummer ab 0 je Punkt.
   */
  function assign(points, centers) {
    return points.map((p) => {
      let best = 0;
      let bestDistance = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const d = dist2(p, centers[c]);
        if (d < bestDistance) {
          bestDistance = d;
          best = c;
        }
      }
      return best;
    });
  }

  /**
   * Berechnet die neuen Zentren.
   * @param {number[][]} points - Punkte.
   * @param {number[]} assignment - Zuordnung.
   * @param {number[][]} centers - Bisherige Zentren.
   * @returns {{centers:number[][], empty:number[]}} Neue Zentren und die Nummern leerer Cluster.
   */
  function update(points, assignment, centers) {
    const sums = centers.map(() => [0, 0, 0]);
    points.forEach((p, i) => {
      const s = sums[assignment[i]];
      s[0] += p[0];
      s[1] += p[1];
      s[2]++;
    });
    const empty = [];
    const next = centers.map((c, i) => {
      if (sums[i][2] === 0) {
        empty.push(i);
        return [c[0], c[1]];
      }
      return [sums[i][0] / sums[i][2], sums[i][1] / sums[i][2]];
    });
    return { centers: next, empty };
  }

  /**
   * WCSS je Cluster.
   * @param {number[][]} points - Punkte.
   * @param {number[][]} centers - Zentren.
   * @param {number[]} assignment - Zuordnung.
   * @returns {number[]} Summe der quadrierten Abstände je Cluster.
   */
  function wcssParts(points, centers, assignment) {
    const parts = centers.map(() => 0);
    points.forEach((p, i) => {
      parts[assignment[i]] += dist2(p, centers[assignment[i]]);
    });
    return parts;
  }

  /**
   * WCSS.
   * @param {number[][]} points - Punkte.
   * @param {number[][]} centers - Zentren.
   * @param {number[]} assignment - Zuordnung.
   * @returns {number} Summe der quadrierten Abstände.
   */
  function wcss(points, centers, assignment) {
    return wcssParts(points, centers, assignment).reduce((a, b) => a + b, 0);
  }

  /**
   * Zählt die Punkte je Cluster.
   * @param {number[]} assignment - Zuordnung.
   * @param {number} k - Anzahl der Cluster.
   * @returns {number[]} Anzahl je Cluster.
   */
  function counts(assignment, k) {
    const out = new Array(k).fill(0);
    for (const c of assignment) {
      out[c]++;
    }
    return out;
  }

  /**
   * Wählt k verschiedene Datenpunkte als Startzentren.
   *
   * @param {number[][]} points - Punkte.
   * @param {number} k - Anzahl.
   * @param {function(Array):Array} [shuffle] - Mischfunktion, Standard ist pointData.shuffled.
   * @returns {number[]} Indizes der gewählten Punkte; weniger als k, wenn es nicht genug verschiedene Punkte gibt.
   */
  function randomIndices(points, k, shuffle) {
    const mix = shuffle || ns.pointData.shuffled;
    const seen = new Set();
    const out = [];
    for (const i of mix(points.map((_, index) => index))) {
      const key = points[i][0] + '|' + points[i][1];
      if (!seen.has(key)) {
        seen.add(key);
        out.push(i);
        if (out.length === k) {
          break;
        }
      }
    }
    return out;
  }

  /**
   * Wählt k verschiedene Datenpunkte mit k-means++: Der erste ist zufällig, jeder weitere mit einer
   * Wahrscheinlichkeit proportional zum quadrierten Abstand zum nächsten bereits gewählten Zentrum.
   * Punkte mit Abstand 0 kommen nicht in Frage.
   *
   * @param {number[][]} points - Punkte.
   * @param {number} k - Anzahl.
   * @param {function():number} [random] - Zufallsquelle (Standard Math.random).
   * @returns {number[]} Indizes der gewählten Punkte; weniger als k, wenn es nicht genug verschiedene Punkte gibt.
   */
  function plusPlusIndices(points, k, random) {
    const rnd = random || Math.random;
    if (points.length === 0 || k < 1) {
      return [];
    }
    const out = [Math.floor(rnd() * points.length)];
    const nearest = points.map(() => Infinity);
    while (out.length < k) {
      const last = points[out[out.length - 1]];
      let total = 0;
      points.forEach((p, i) => {
        nearest[i] = Math.min(nearest[i], dist2(p, last));
        total += nearest[i];
      });
      if (total === 0) {
        break;
      }
      let target = rnd() * total;
      let chosen = -1;
      for (let i = 0; i < points.length; i++) {
        if (nearest[i] > 0) {
          chosen = i;
          target -= nearest[i];
          if (target <= 0) {
            break;
          }
        }
      }
      out.push(chosen);
    }
    return out;
  }

  /**
   * Rechnet k-Means von gegebenen Zentren bis zum Ende.
   *
   * @param {number[][]} points - Punkte.
   * @param {number[][]} initial - Startzentren.
   * @returns {{centers:number[][], assignment:number[], wcss:number, iterations:number, empty:number[]}} Ergebnis.
   */
  function run(points, initial) {
    let centers = initial.map((c) => [c[0], c[1]]);
    let assignment = assign(points, centers);
    let iterations = 1;
    let empty = [];
    while (iterations < MAX_RUN_ITERATIONS) {
      const updated = update(points, assignment, centers);
      centers = updated.centers;
      empty = updated.empty;
      const next = assign(points, centers);
      const changed = next.some((c, i) => c !== assignment[i]);
      assignment = next;
      iterations++;
      if (!changed) {
        break;
      }
    }
    return { centers, assignment, wcss: wcss(points, centers, assignment), iterations, empty };
  }

  /**
   * Erzeugt einen Trainer, der k-Means in sichtbaren Schritten rechnet.
   *
   * Phasen: 'idle' → 'assign' → 'update' → 'assign' → …; ein Schritt ist genau ein Phasenwechsel.
   * Eine Iteration besteht aus Zuordnung und Aktualisierung; das Training endet in einer Zuordnung,
   * die nichts mehr ändert.
   *
   * @param {number[][]} points - Punkte.
   * @param {number[][]} initial - Startzentren.
   * @returns {Object} Trainer (siehe Rückgabe am Ende der Funktion).
   */
  function createTrainer(points, initial) {
    let centers = initial.map((c) => [c[0], c[1]]);
    let assignment = null;
    let phase = 'idle';
    let iteration = 0;
    let steps = 0;
    let changes = null;
    let finished = false;
    let empty = [];
    const history = [];
    /** Verlauf: je Cluster alle Lagen des Zentrums. */
    const trails = centers.map((c) => [[c[0], c[1]]]);

    /** Führt den nächsten Schritt aus. */
    function step() {
      if (finished) {
        return;
      }
      steps++;
      if (phase === 'assign') {
        const updated = update(points, assignment, centers);
        centers = updated.centers;
        empty = updated.empty;
        centers.forEach((c, i) => {
          const last = trails[i][trails[i].length - 1];
          if (last[0] !== c[0] || last[1] !== c[1]) {
            trails[i].push([c[0], c[1]]);
          }
        });
        phase = 'update';
      } else {
        const next = assign(points, centers);
        changes = assignment ? next.filter((c, i) => c !== assignment[i]).length : next.length;
        finished = Boolean(assignment) && changes === 0;
        assignment = next;
        iteration++;
        phase = 'assign';
      }
      history.push(wcss(points, centers, assignment));
    }

    /**
     * Rechnet Iterationen ohne Zwischenanzeige. Eine angefangene Iteration wird beendet und zählt als erste.
     * @param {number} count - Anzahl der Iterationen.
     */
    function runIterations(count) {
      let done = 0;
      while (done < count && !finished) {
        if (phase === 'assign') {
          step();
          done++;
        } else {
          step();
          if (!finished) {
            step();
            done++;
          }
        }
      }
    }

    return {
      step, runIterations,
      isFinished: () => finished,
      hasStarted: () => steps > 0,
      phase: () => phase,
      iteration: () => iteration,
      steps: () => steps,
      changes: () => changes,
      centers: () => centers,
      assignment: () => assignment,
      empty: () => empty,
      history: () => history,
      trails: () => trails,
      wcss: () => (assignment ? wcss(points, centers, assignment) : null)
    };
  }

  ns.kmeans = { dist2, assign, update, wcss, wcssParts, counts, randomIndices, plusPlusIndices, run, createTrainer };
})(window.CC = window.CC || {});
