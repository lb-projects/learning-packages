/**
 * @file kmeans-analysis.js
 * @description Ellbogen-Analyse und Silhouetten-Analyse, ohne Zugriff auf die Seite.
 *
 * Ellbogen:
 *   Für jedes k ein Lauf mit neuen zufälligen Startzentren. Der Knick ist das k mit dem größten
 *   Abstand unterhalb der Verbindungslinie von erstem und letztem Punkt, wenn beide Achsen auf
 *   0 bis 1 normiert sind.
 *
 * Silhouette:
 *   s(i) = (b − a) / max(a, b); a ist der mittlere Abstand zu den Punkten des eigenen Clusters,
 *   b der kleinste mittlere Abstand zu den Punkten eines anderen Clusters. Ein Cluster mit nur
 *   einem Punkt hat s = 0 (Rousseeuw 1987). Bei weniger als zwei belegten Clustern ist die
 *   Silhouette nicht definiert.
 *
 * Abhängigkeiten:
 *   kmeans.js
 */
(function (ns) {
  'use strict';

  /**
   * Wählt Startzentren.
   *
   * @param {number[][]} points - Punkte.
   * @param {number} k - Anzahl der Cluster.
   * @param {{method?:string, shuffle?:function(Array):Array, random?:function():number}} [options] - method:
   *   'random' (Standard) oder 'plusplus'; shuffle und random ersetzen die Zufallsquelle.
   * @returns {number[][]} Startzentren.
   */
  function pickStarts(points, k, options) {
    const o = options || {};
    const indices = o.method === 'plusplus' ? ns.kmeans.plusPlusIndices(points, k, o.random) : ns.kmeans.randomIndices(points, k, o.shuffle);
    return indices.map((i) => points[i]);
  }

  /**
   * Rechnet einen Lauf mit zufällig gewählten Startzentren.
   *
   * @param {number[][]} points - Punkte.
   * @param {number} k - Anzahl der Cluster.
   * @param {Object} [options] - Siehe {@link pickStarts}.
   * @returns {Object} Ergebnis von kmeans.run mit {k, starts}.
   */
  function randomRun(points, k, options) {
    const starts = pickStarts(points, k, options);
    return { k, starts, ...ns.kmeans.run(points, starts) };
  }

  /**
   * Rechnet die Läufe der Ellbogen-Analyse.
   *
   * @param {number[][]} points - Punkte.
   * @param {number} kMax - Größtes k.
   * @param {Object} [options] - Siehe {@link pickStarts}.
   * @returns {Array<Object>} Läufe für k = 1 bis kMax.
   */
  function elbow(points, kMax, options) {
    const runs = [];
    for (let k = 1; k <= kMax; k++) {
      runs.push(randomRun(points, k, options));
    }
    return runs;
  }

  /**
   * Bestimmt den Ellbogen-Knick.
   *
   * @param {number[]} values - WCSS für k = 1, 2, …
   * @returns {number|null} k des Knicks oder null, wenn es keinen gibt (weniger als drei Werte
   *   oder keine Stelle unterhalb der Verbindungslinie).
   */
  function knee(values) {
    if (values.length < 3) {
      return null;
    }
    const first = values[0];
    const last = values[values.length - 1];
    const span = Math.max(...values) - Math.min(...values);
    if (span === 0) {
      return null;
    }
    let bestK = null;
    let best = 1e-9;
    for (let i = 1; i < values.length - 1; i++) {
      const chord = first + ((last - first) * i) / (values.length - 1);
      const distance = (chord - values[i]) / span;
      if (distance > best) {
        best = distance;
        bestK = i + 1;
      }
    }
    return bestK;
  }

  /**
   * Rechnung des Silhouettenwerts eines Punkts.
   *
   * @param {number[][]} points - Punkte.
   * @param {number[]} assignment - Zuordnung.
   * @param {number} k - Anzahl der Cluster.
   * @param {number} index - Punkt.
   * @returns {{own:number, a:(number|null), b:(number|null), nearest:(number|null), s:number, single:boolean}}
   *   own: eigener Cluster; nearest: Cluster, der b liefert; single: Der Cluster hat nur diesen Punkt.
   *   a und b sind null, wenn der Punkt allein ist oder es keinen fremden belegten Cluster gibt.
   */
  function silhouetteOf(points, assignment, k, index) {
    const sizes = ns.kmeans.counts(assignment, k);
    const sums = new Float64Array(k);
    points.forEach((p, j) => {
      if (j !== index) {
        sums[assignment[j]] += Math.sqrt(ns.kmeans.dist2(points[index], p));
      }
    });
    const own = assignment[index];
    let b = Infinity;
    let nearest = null;
    for (let c = 0; c < k; c++) {
      if (c !== own && sizes[c] > 0 && sums[c] / sizes[c] < b) {
        b = sums[c] / sizes[c];
        nearest = c;
      }
    }
    const single = sizes[own] === 1;
    if (single || nearest === null) {
      return { own, a: null, b: null, nearest: null, s: 0, single };
    }
    const a = sums[own] / (sizes[own] - 1);
    const div = Math.max(a, b);
    return { own, a, b, nearest, s: div === 0 ? 0 : (b - a) / div, single };
  }

  /**
   * Berechnet die Silhouettenwerte.
   *
   * @param {number[][]} points - Punkte.
   * @param {number[]} assignment - Zuordnung.
   * @param {number} k - Anzahl der Cluster.
   * @returns {{values:number[], mean:(number|null), perCluster:Array<{cluster:number, count:number, mean:(number|null)}>}} Ergebnis.
   */
  function silhouette(points, assignment, k) {
    const n = points.length;
    const sizes = ns.kmeans.counts(assignment, k);
    const used = sizes.filter((c) => c > 0).length;
    const values = points.map((_, i) => (used >= 2 ? silhouetteOf(points, assignment, k, i).s : 0));
    const perCluster = sizes.map((count, cluster) => {
      if (count === 0 || used < 2) {
        return { cluster, count, mean: null };
      }
      let sum = 0;
      for (let i = 0; i < n; i++) {
        if (assignment[i] === cluster) {
          sum += values[i];
        }
      }
      return { cluster, count, mean: sum / count };
    });
    return { values, mean: used >= 2 && n > 0 ? values.reduce((x, y) => x + y, 0) / n : null, perCluster };
  }

  /**
   * Größtes k, für das die Silhouetten-Analyse sinnvoll ist.
   *
   * @param {number} pointCount - Anzahl der Punkte.
   * @param {number} maxK - Größtes wählbares k.
   * @returns {number} Größtes k; kleiner als 2, wenn die Analyse nicht möglich ist.
   */
  function maxSilhouetteK(pointCount, maxK) {
    return Math.min(maxK, pointCount - 1);
  }

  /**
   * Rechnet die Auswertung: je k ein Lauf und sein mittlerer Silhouettenwert.
   *
   * @param {number[][]} points - Punkte.
   * @param {number[]} kValues - Zu prüfende k.
   * @param {Object<number, {mean:number}>} [known] - Bereits gerechnete Mittelwerte je k.
   * @param {Object} [options] - Siehe {@link pickStarts}.
   * @returns {{rows:Array<{k:number, mean:(number|null)}>, bestK:(number|null)}} Tabelle und bestes k.
   */
  function evaluate(points, kValues, known, options) {
    const rows = kValues.map((k) => {
      if (known && known[k]) {
        return { k, mean: known[k].mean };
      }
      const r = randomRun(points, k, options);
      return { k, mean: silhouette(points, r.assignment, k).mean };
    });
    let bestK = null;
    let best = -Infinity;
    for (const row of rows) {
      if (row.mean !== null && row.mean > best) {
        best = row.mean;
        bestK = row.k;
      }
    }
    return { rows, bestK };
  }

  ns.kmeansAnalysis = { pickStarts, randomRun, elbow, knee, silhouette, silhouetteOf, maxSilhouetteK, evaluate };
})(window.CC = window.CC || {});
