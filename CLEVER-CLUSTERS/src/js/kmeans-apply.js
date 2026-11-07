/**
 * @file kmeans-apply.js
 * @description Anwendungen eines fertigen k-Means-Laufs, ohne Zugriff auf die Seite: neue Punkte einordnen,
 *              Ausreißer erkennen, Standorte planen.
 *
 * Einordnen:
 *   Ein neuer Punkt gehört zum nächsten Zentrum, bei gleichem Abstand zur kleineren Nummer. Er ändert weder
 *   Daten noch Zentren.
 *
 * Ausreißer:
 *   Ein Punkt ist auffällig, wenn sein Abstand zum Zentrum größer ist als t mal der mittlere Abstand seines
 *   Clusters. Ein Cluster, das nur aus Ausreißern besteht, fällt nach dieser Regel nicht auf; deshalb nennt
 *   smallClusters() die sehr kleinen Cluster.
 *
 * Standorte:
 *   Gesamtkosten = k · Kosten je Standort + Summe aller Wege · Kosten je Wegeinheit. k-Means minimiert
 *   quadrierte Abstände, nicht die Summe der Wege; das Ergebnis ist also eine gute Näherung, nicht das Optimum.
 *
 * Abhängigkeiten:
 *   kmeans.js, kmeans-analysis.js
 */
(function (ns) {
  'use strict';

  /** Läufe je k bei der Kostenkurve. */
  const COST_RUNS = 5;
  /** Unter diesem Anteil der Punkte gilt ein Cluster als sehr klein. */
  const SMALL_SHARE = 0.05;

  /**
   * Abstand zum Zentrum des eigenen Clusters.
   * @param {number[][]} points - Punkte.
   * @param {number[][]} centers - Zentren.
   * @param {number[]} assignment - Zuordnung.
   * @returns {number[]} Abstand je Punkt.
   */
  function distances(points, centers, assignment) {
    return points.map((p, i) => Math.sqrt(ns.kmeans.dist2(p, centers[assignment[i]])));
  }

  /**
   * Ordnet einen neuen Punkt ein.
   * @param {number[]} point - Punkt in den Koordinaten der Zentren.
   * @param {number[][]} centers - Zentren.
   * @returns {{distances:number[], cluster:number, distance:number}} Abstände zu allen Zentren, Cluster und sein Abstand.
   */
  function classify(point, centers) {
    const list = centers.map((c) => Math.sqrt(ns.kmeans.dist2(point, c)));
    const cluster = ns.kmeans.assign([point], centers)[0];
    return { distances: list, cluster, distance: list[cluster] };
  }

  /**
   * Bewertet alle Punkte nach der Ausreißer-Regel.
   *
   * @param {number[][]} points - Punkte.
   * @param {number[][]} centers - Zentren.
   * @param {number[]} assignment - Zuordnung.
   * @param {number} t - Schwelle: Vielfaches des mittleren Abstands.
   * @returns {{means:number[], rows:Array<{index:number, cluster:number, distance:number, multiple:number}>}}
   *   Mittlerer Abstand je Cluster und die auffälligen Punkte, das größte Vielfache zuerst.
   */
  function outliers(points, centers, assignment, t) {
    const d = distances(points, centers, assignment);
    const sizes = ns.kmeans.counts(assignment, centers.length);
    const sums = new Array(centers.length).fill(0);
    assignment.forEach((c, i) => { sums[c] += d[i]; });
    const means = sums.map((sum, c) => (sizes[c] > 0 ? sum / sizes[c] : 0));
    const rows = [];
    points.forEach((_, i) => {
      const mean = means[assignment[i]];
      const multiple = mean > 0 ? d[i] / mean : 0;
      if (multiple > t) {
        rows.push({ index: i, cluster: assignment[i], distance: d[i], multiple });
      }
    });
    rows.sort((a, b) => b.multiple - a.multiple || a.index - b.index);
    return { means, rows };
  }

  /**
   * Nennt die sehr kleinen Cluster.
   * @param {number[]} assignment - Zuordnung.
   * @param {number} k - Anzahl der Cluster.
   * @returns {Array<{cluster:number, count:number, share:number}>} Belegte Cluster unter fünf Prozent der Punkte.
   */
  function smallClusters(assignment, k) {
    const total = assignment.length;
    const out = [];
    ns.kmeans.counts(assignment, k).forEach((count, cluster) => {
      if (count > 0 && count / total < SMALL_SHARE) {
        out.push({ cluster, count, share: count / total });
      }
    });
    return out;
  }

  /**
   * Wege von den Punkten zu ihrem Standort.
   *
   * @param {number[][]} points - Punkte.
   * @param {number[][]} centers - Standorte.
   * @param {number[]} assignment - Zuordnung.
   * @returns {{rows:Array<{cluster:number, count:number, sum:number, mean:(number|null), longest:(number|null), longestIndex:(number|null)}>, sum:number}}
   *   Je Standort Anzahl, Summe, mittlerer und längster Weg; dazu die Summe aller Wege.
   */
  function routes(points, centers, assignment) {
    const rows = centers.map((_, cluster) => ({ cluster, count: 0, sum: 0, mean: null, longest: null, longestIndex: null }));
    let sum = 0;
    distances(points, centers, assignment).forEach((d, i) => {
      const row = rows[assignment[i]];
      row.count++;
      row.sum += d;
      sum += d;
      if (row.longest === null || d > row.longest) {
        row.longest = d;
        row.longestIndex = i;
      }
    });
    for (const row of rows) {
      row.mean = row.count > 0 ? row.sum / row.count : null;
    }
    return { rows, sum };
  }

  /**
   * Gesamtkosten.
   * @param {number} k - Anzahl der Standorte.
   * @param {number} routeSum - Summe aller Wege.
   * @param {number} perSite - Kosten je Standort.
   * @param {number} perUnit - Kosten je Wegeinheit.
   * @returns {number} Gesamtkosten.
   */
  function totalCost(k, routeSum, perSite, perUnit) {
    return k * perSite + routeSum * perUnit;
  }

  /**
   * Rechnet je k fünf Läufe und behält den mit der kleinsten Summe der Wege. Die Kosten selbst
   * ändern sich mit den Eingabefeldern und werden erst mit {@link cheapest} bestimmt.
   *
   * @param {number[][]} points - Punkte.
   * @param {number} kMax - Größtes k.
   * @param {Object} [options] - Siehe kmeansAnalysis.pickStarts.
   * @returns {Array<{k:number, sum:number}>} Je k die kleinste Summe der Wege.
   */
  function routeCurve(points, kMax, options) {
    const out = [];
    for (let k = 1; k <= kMax; k++) {
      let best = Infinity;
      for (let i = 0; i < COST_RUNS; i++) {
        const run = ns.kmeansAnalysis.randomRun(points, k, options);
        best = Math.min(best, routes(points, run.centers, run.assignment).sum);
      }
      out.push({ k, sum: best });
    }
    return out;
  }

  /**
   * Bestimmt das günstigste k der Kurve.
   * @param {Array<{k:number, sum:number}>} curve - Ergebnis von {@link routeCurve}.
   * @param {number} perSite - Kosten je Standort.
   * @param {number} perUnit - Kosten je Wegeinheit.
   * @returns {{rows:Array<{k:number, sum:number, cost:number}>, bestK:number}} Kosten je k und das günstigste k;
   *   bei Gleichstand das kleinere.
   */
  function cheapest(curve, perSite, perUnit) {
    const rows = curve.map((row) => ({ ...row, cost: totalCost(row.k, row.sum, perSite, perUnit) }));
    let best = rows[0];
    for (const row of rows) {
      if (row.cost < best.cost) {
        best = row;
      }
    }
    return { rows, bestK: best.k };
  }

  ns.kmeansApply = { classify, outliers, smallClusters, routes, totalCost, routeCurve, cheapest, COST_RUNS };
})(window.CC = window.CC || {});
