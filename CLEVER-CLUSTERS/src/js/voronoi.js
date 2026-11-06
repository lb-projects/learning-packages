/**
 * @file voronoi.js
 * @description Decision Areas als exakte Polygone: Jede Fläche ist der Ausschnitt, beschnitten an den
 *              Mittelsenkrechten zu allen anderen Zentren.
 *
 * Die Polygone liegen in Datenkoordinaten. Weil coord-plot.js die Achsen linear abbildet, bleiben
 * sie auch bei getrennt skalierten Achsen genau.
 *
 * Abhängigkeiten:
 *   Keine.
 */
(function (ns) {
  'use strict';

  /**
   * Beschneidet ein Polygon an der Halbebene a·x + b·y ≤ c (Sutherland-Hodgman).
   *
   * @param {number[][]} polygon - Ecken.
   * @param {number} a - Koeffizient.
   * @param {number} b - Koeffizient.
   * @param {number} c - Grenze.
   * @returns {number[][]} Beschnittenes Polygon.
   */
  function clip(polygon, a, b, c) {
    const out = [];
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i];
      const q = polygon[(i + 1) % polygon.length];
      const dp = a * p[0] + b * p[1] - c;
      const dq = a * q[0] + b * q[1] - c;
      if (dp <= 0) {
        out.push(p);
      }
      if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) {
        const t = dp / (dp - dq);
        out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
      }
    }
    return out;
  }

  /**
   * Berechnet die Decision Areas.
   *
   * @param {number[][]} centers - Zentren.
   * @param {{xmin:number, xmax:number, ymin:number, ymax:number}} view - Ausschnitt.
   * @returns {number[][][]} Je Zentrum ein Polygon; leer, wenn das Zentrum keine Fläche im Ausschnitt
   *   hat. Bei zwei gleichen Zentren erhält das mit der kleineren Nummer die Fläche.
   */
  function cells(centers, view) {
    const box = [[view.xmin, view.ymin], [view.xmax, view.ymin], [view.xmax, view.ymax], [view.xmin, view.ymax]];
    return centers.map((center, i) => {
      let polygon = box;
      for (let j = 0; j < centers.length && polygon.length > 0; j++) {
        if (j === i) {
          continue;
        }
        const other = centers[j];
        const a = other[0] - center[0];
        const b = other[1] - center[1];
        if (a === 0 && b === 0) {
          if (j < i) {
            polygon = [];
          }
          continue;
        }
        const c = (other[0] * other[0] + other[1] * other[1] - center[0] * center[0] - center[1] * center[1]) / 2;
        polygon = clip(polygon, a, b, c);
      }
      return polygon;
    });
  }

  ns.voronoi = { cells };
})(window.CC = window.CC || {});
