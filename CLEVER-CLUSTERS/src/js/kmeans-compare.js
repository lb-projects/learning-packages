/**
 * @file kmeans-compare.js
 * @description Vergleich von Clustern mit bekannten Gruppen, ohne Zugriff auf die Seite.
 *
 * Kreuztabelle:
 *   Zeilen sind die Cluster, Spalten die Gruppen. Punkte ohne Gruppe zählen nicht mit.
 *
 * Reinheit:
 *   Anteil der Punkte, die zur häufigsten Gruppe ihres Clusters gehören. Sie steigt mit k und ist
 *   bei einem Cluster je Punkt immer 1.
 *
 * Adjusted Rand Index (Hubert und Arabie 1985):
 *   Vergleicht Punktpaare: ARI = (Index − Erwartung) / (Maximum − Erwartung) mit
 *     Index     = Σ C(n_ij, 2)
 *     Erwartung = Σ C(a_i, 2) · Σ C(b_j, 2) / C(n, 2)
 *     Maximum   = (Σ C(a_i, 2) + Σ C(b_j, 2)) / 2
 *   Dabei sind n_ij die Zellen der Kreuztabelle, a_i die Zeilen- und b_j die Spaltensummen.
 *   1 bedeutet dieselbe Einteilung, um 0 liegt eine Einteilung, die nur zufällig passt. Der Nenner wird
 *   nur 0, wenn beide Einteilungen alles in eine Gruppe oder alles in Einzelpunkte legen, also gleich sind.
 *
 * Abhängigkeiten:
 *   Keine.
 */
(function (ns) {
  'use strict';

  /**
   * Anzahl der Paare.
   * @param {number} n - Anzahl.
   * @returns {number} n über 2.
   */
  const pairs = (n) => (n * (n - 1)) / 2;

  /**
   * Erstellt die Kreuztabelle.
   *
   * @param {number[]} assignment - Cluster je Punkt.
   * @param {Array<string|null>} groups - Gruppe je Punkt.
   * @param {number} k - Anzahl der Cluster.
   * @returns {{groups:string[], cells:number[][], total:number, ignored:number}} Gruppen alphabetisch,
   *   cells[Cluster][Gruppe], Anzahl der verglichenen Punkte und der Punkte ohne Gruppe.
   */
  function crossTable(assignment, groups, k) {
    const names = [...new Set(groups.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
    const position = new Map(names.map((name, i) => [name, i]));
    const cells = Array.from({ length: k }, () => new Array(names.length).fill(0));
    let total = 0;
    assignment.forEach((c, i) => {
      if (groups[i]) {
        cells[c][position.get(groups[i])]++;
        total++;
      }
    });
    return { groups: names, cells, total, ignored: assignment.length - total };
  }

  /**
   * Häufigste Gruppe je Cluster.
   * @param {{cells:number[][]}} table - Kreuztabelle.
   * @returns {number[]} Gruppe je Cluster; bei Gleichstand die erste, −1 bei einem Cluster ohne Punkte mit Gruppe.
   */
  function majorities(table) {
    return table.cells.map((row) => {
      let best = -1;
      let bestCount = 0;
      row.forEach((count, g) => {
        if (count > bestCount) {
          bestCount = count;
          best = g;
        }
      });
      return best;
    });
  }

  /**
   * Reinheit.
   * @param {{cells:number[][], total:number}} table - Kreuztabelle.
   * @returns {number|null} Wert von 0 bis 1; null ohne Punkte.
   */
  function purity(table) {
    if (table.total === 0) {
      return null;
    }
    return table.cells.reduce((sum, row) => sum + Math.max(0, ...row), 0) / table.total;
  }

  /**
   * Adjusted Rand Index.
   * @param {{cells:number[][], total:number}} table - Kreuztabelle.
   * @returns {number|null} 1 bei gleicher Einteilung; null bei weniger als zwei Punkten.
   */
  function adjustedRand(table) {
    if (table.total < 2) {
      return null;
    }
    const rowSums = table.cells.map((row) => row.reduce((a, b) => a + b, 0));
    const columnSums = table.cells[0].map((_, g) => table.cells.reduce((sum, row) => sum + row[g], 0));
    const index = table.cells.reduce((sum, row) => sum + row.reduce((s, n) => s + pairs(n), 0), 0);
    const a = rowSums.reduce((sum, n) => sum + pairs(n), 0);
    const b = columnSums.reduce((sum, n) => sum + pairs(n), 0);
    const expected = (a * b) / pairs(table.total);
    const maximum = (a + b) / 2;
    return maximum === expected ? 1 : (index - expected) / (maximum - expected);
  }

  /**
   * Findet die Punkte, die nicht zur häufigsten Gruppe ihres Clusters gehören.
   * @param {number[]} assignment - Cluster je Punkt.
   * @param {Array<string|null>} groups - Gruppe je Punkt.
   * @param {{groups:string[], cells:number[][]}} table - Kreuztabelle.
   * @returns {boolean[]} Je Punkt true, wenn er abweicht; Punkte ohne Gruppe weichen nicht ab.
   */
  function deviating(assignment, groups, table) {
    const major = majorities(table);
    return assignment.map((c, i) => Boolean(groups[i]) && table.groups[major[c]] !== groups[i]);
  }

  /**
   * Weist jeder Gruppe eine Farbe zu, sodass eine Gruppe möglichst die Farbe des Clusters trägt, in dem sie
   * am häufigsten vorkommt. Abweichungen fallen beim Vergleich der Zeichnungen dann sofort auf.
   *
   * @param {{groups:string[], cells:number[][]}} table - Kreuztabelle.
   * @returns {number[]} Farbnummer je Gruppe; Gruppen ohne eigenes Cluster erhalten Nummern ab k.
   */
  function groupColors(table) {
    const k = table.cells.length;
    const pairsByCount = [];
    table.cells.forEach((row, c) => row.forEach((count, g) => {
      if (count > 0) {
        pairsByCount.push({ c, g, count });
      }
    }));
    pairsByCount.sort((p, q) => q.count - p.count || p.c - q.c || p.g - q.g);
    const colors = new Array(table.groups.length).fill(-1);
    const used = new Set();
    for (const { c, g } of pairsByCount) {
      if (colors[g] < 0 && !used.has(c)) {
        colors[g] = c;
        used.add(c);
      }
    }
    let next = k;
    return colors.map((color) => (color >= 0 ? color : next++));
  }

  ns.kmeansCompare = { crossTable, majorities, purity, adjustedRand, deviating, groupColors };
})(window.CC = window.CC || {});
