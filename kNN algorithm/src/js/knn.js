/**
 * @file knn.js
 * @description Der k-nächste-Nachbarn-Algorithmus (kNN) mit allen Auswertungen,
 *              die die sieben Seiten benötigen.
 *
 * Idee des Verfahrens:
 *   Ein Punkt mit unbekanntem Label wird klassifiziert, indem man die k
 *   Trainingspunkte mit dem geringsten Abstand bestimmt ("nächste Nachbarn")
 *   und das Label wählt, das unter ihnen am häufigsten vorkommt
 *   (Mehrheitsentscheidung).
 *
 * Festlegungen (für den Unterricht dokumentiert):
 *   - Metriken:
 *       euklidisch:  d = √((x₁−x₂)² + (y₁−y₂)²)   ("Luftlinie")
 *       Manhattan:   d = |x₁−x₂| + |y₁−y₂|        ("entlang der Gitterlinien")
 *   - Gleiche Abstände: Haben mehrere Punkte denselben Abstand, gilt die
 *     Reihenfolge der Eingabe (stabile Sortierung). Der früher eingegebene
 *     Punkt kommt zuerst.
 *   - Stimmengleichstand: Haben mehrere Labels gleich viele Stimmen, gewinnt
 *     unter diesen das Label des nächstgelegenen Nachbarn. Das Ergebnis wird
 *     als "Gleichstand" gekennzeichnet.
 *   - Ist k größer als die Zahl verfügbarer Punkte, werden alle Punkte verwendet.
 *
 * Abhängigkeiten:
 *   Keine.
 */
(function (ns) {
  'use strict';

  /** Verfügbare Metriken. */
  const METRICS = Object.freeze({
    euclidean: { id: 'euclidean', name: 'Euklidische Metrik' },
    manhattan: { id: 'manhattan', name: 'Manhattan-Metrik' }
  });

  /**
   * Berechnet den Abstand zweier Punkte.
   *
   * @param {{x:number, y:number}} a - Erster Punkt.
   * @param {{x:number, y:number}} b - Zweiter Punkt.
   * @param {string} metric - "euclidean" oder "manhattan".
   * @returns {number} Abstand.
   */
  function distance(a, b, metric) {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    return metric === 'manhattan' ? dx + dy : Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Sortiert alle Punkte nach ihrem Abstand zum Abfragepunkt.
   *
   * @param {Array<{id:number, x:number, y:number, label:string}>} points - Trainingspunkte.
   * @param {{x:number, y:number}} query - Abfragepunkt.
   * @param {string} metric - Metrik.
   * @param {number} [excludeId] - ID eines Punkts, der ausgelassen wird (Leave One Out).
   * @returns {Array<{point: Object, distance: number}>} Nach Abstand sortierte Liste.
   */
  function sortByDistance(points, query, metric, excludeId) {
    const list = [];
    points.forEach((point, order) => {
      if (point.id !== excludeId) {
        list.push({ point, distance: distance(point, query, metric), order });
      }
    });
    // Bei gleichem Abstand entscheidet die Eingabereihenfolge (stabil).
    list.sort((a, b) => a.distance - b.distance || a.order - b.order);
    return list.map((entry) => ({ point: entry.point, distance: entry.distance }));
  }

  /**
   * Führt die Mehrheitsentscheidung unter den gegebenen Nachbarn durch.
   *
   * @param {Array<{point: {label:string}, distance:number}>} neighbors - Nachbarn, nach Abstand sortiert.
   * @returns {{label: (string|null), counts: Array<{label:string, count:number}>,
   *            tie: boolean, tiedLabels: string[]}} Ergebnis der Abstimmung.
   */
  function vote(neighbors) {
    const counts = new Map();
    for (const n of neighbors) {
      counts.set(n.point.label, (counts.get(n.point.label) || 0) + 1);
    }
    let max = 0;
    for (const c of counts.values()) {
      max = Math.max(max, c);
    }
    const tiedLabels = Array.from(counts.keys()).filter((label) => counts.get(label) === max);
    let label = null;
    // Gleichstand auflösen: das Label des nächstgelegenen Nachbarn unter den Kandidaten.
    for (const n of neighbors) {
      if (tiedLabels.includes(n.point.label)) {
        label = n.point.label;
        break;
      }
    }
    return {
      label,
      counts: Array.from(counts.entries())
        .map(([l, count]) => ({ label: l, count }))
        .sort((a, b) => b.count - a.count),
      tie: tiedLabels.length > 1,
      tiedLabels
    };
  }

  /**
   * Klassifiziert einen Punkt.
   *
   * @param {Array} points - Trainingspunkte.
   * @param {{x:number, y:number}} query - Abfragepunkt.
   * @param {number} k - Anzahl der Nachbarn.
   * @param {string} metric - Metrik.
   * @param {number} [excludeId] - Auszulassender Punkt (Leave One Out).
   * @returns {{label: (string|null), counts: Array, tie: boolean, tiedLabels: string[],
   *            neighbors: Array<{point:Object, distance:number}>, radius: number, k: number}}
   *          Ergebnis inkl. Nachbarn und Radius (= Abstand zum k-ten Nachbarn).
   */
  function classify(points, query, k, metric, excludeId) {
    const sorted = sortByDistance(points, query, metric, excludeId);
    const effectiveK = Math.max(0, Math.min(k, sorted.length));
    const neighbors = sorted.slice(0, effectiveK);
    const result = vote(neighbors);
    result.neighbors = neighbors;
    result.radius = effectiveK > 0 ? neighbors[effectiveK - 1].distance : 0;
    result.k = effectiveK;
    return result;
  }

  /**
   * Klassifiziert einen bekannten Punkt für alle k von 1 bis kMax und vergleicht
   * mit seinem tatsächlichen Label. Die Nachbarn werden nur einmal sortiert;
   * die Stimmen werden für wachsendes k schrittweise fortgeschrieben.
   *
   * @param {Array} points - Punkte, aus denen Nachbarn gewählt werden.
   * @param {{id:number, x:number, y:number, label:string}} target - Zu prüfender Punkt.
   * @param {number} kMax - Größtes k.
   * @param {string} metric - Metrik.
   * @returns {Array<{k:number, label:string, correct:boolean, tie:boolean}>}
   *          Ergebnis je k (Index 0 entspricht k = 1).
   */
  function evaluateAllK(points, target, kMax, metric) {
    const sorted = sortByDistance(points, target, metric, target.id);
    const limit = Math.min(kMax, sorted.length);
    const counts = new Map();
    const firstRank = new Map(); // Rang des nächsten Nachbarn je Label (für Gleichstand)
    const results = [];
    for (let k = 1; k <= limit; k++) {
      const label = sorted[k - 1].point.label;
      counts.set(label, (counts.get(label) || 0) + 1);
      if (!firstRank.has(label)) {
        firstRank.set(label, k);
      }
      let max = 0;
      for (const c of counts.values()) {
        max = Math.max(max, c);
      }
      let winner = null;
      let tieCount = 0;
      for (const [l, c] of counts) {
        if (c === max) {
          tieCount++;
          if (winner === null || firstRank.get(l) < firstRank.get(winner)) {
            winner = l;
          }
        }
      }
      results.push({ k, label: winner, correct: winner === target.label, tie: tieCount > 1 });
    }
    return results;
  }

  /**
   * Bewertet eine Menge von Testpunkten für k = 1 … kMax.
   * Wird für Validierungsdaten (Seite 4) und Leave One Out (Seiten 5, 6) genutzt.
   *
   * @param {Array} referencePoints - Punkte, aus denen Nachbarn gewählt werden.
   * @param {Array} testPoints - Zu klassifizierende Punkte (mit bekanntem Label).
   * @param {number} kMax - Größtes k.
   * @param {string} metric - Metrik.
   * @returns {{perPoint: Array<{point:Object, results:Array}>,
   *            accuracy: Array<{k:number, correct:number, total:number, rate:number}>}}
   *          Ergebnisse je Punkt und Trefferquote je k.
   */
  function evaluate(referencePoints, testPoints, kMax, metric) {
    const perPoint = testPoints.map((point) => ({
      point,
      results: evaluateAllK(referencePoints, point, kMax, metric)
    }));
    const accuracy = [];
    for (let k = 1; k <= kMax; k++) {
      let correct = 0;
      let total = 0;
      for (const entry of perPoint) {
        const r = entry.results[k - 1];
        if (r) {
          total++;
          if (r.correct) {
            correct++;
          }
        }
      }
      accuracy.push({ k, correct, total, rate: total > 0 ? correct / total : 0 });
    }
    return { perPoint, accuracy };
  }

  /**
   * Leave-One-Out-Verfahren: Jeder Punkt wird einmal weggelassen und anhand
   * aller übrigen Punkte klassifiziert.
   *
   * @param {Array} points - Alle Trainingspunkte.
   * @param {number} kMax - Größtes k (sinnvoll: Anzahl Punkte − 1).
   * @param {string} metric - Metrik.
   * @returns {{perPoint: Array, accuracy: Array}} Siehe {@link evaluate}.
   */
  function leaveOneOut(points, kMax, metric) {
    // evaluateAllK lässt den jeweiligen Punkt über seine ID selbst aus.
    return evaluate(points, points, kMax, metric);
  }

  ns.knn = { METRICS, distance, sortByDistance, vote, classify, evaluateAllK, evaluate, leaveOneOut };
})(window.KNN = window.KNN || {});
