/**
 * @file image-kmeans.js
 * @description k-Means auf den Farben eines Bildes und die Rechnung zur Kompression, ohne Zugriff auf die Seite.
 *
 * Ablauf:
 *   1. Stichprobe von höchstens MAX_SAMPLE Pixeln.
 *   2. Startzentren mit k-means++: Weit entfernte Farben werden bevorzugt, damit kleine farbige
 *      Objekte nicht zufällig verloren gehen. Auf den übrigen Seiten ist k-means++ eine
 *      Option; hier gilt es immer.
 *   3. Lloyd-Iterationen auf der Stichprobe.
 *   4. Alle Pixel zuordnen, Farben der Cluster als Mittelwert aller Pixel berechnen.
 *
 * Die Cluster sind nach Flächenanteil absteigend sortiert. Hat das Bild weniger verschiedene
 * Farben als k, gibt es entsprechend weniger Cluster.
 *
 * Kompression:
 *   Ohne Farbtabelle braucht jedes Pixel 24 Bit. Mit k Farben genügt je Pixel die Nummer seiner Farbe mit
 *   ⌈log₂ k⌉ Bit, dazu kommt einmal die Farbtabelle mit k · 24 Bit. Das ist die reine Rechnung, ohne weitere
 *   Kompression wie in einer PNG-Datei.
 *
 * Abhängigkeiten:
 *   Keine.
 */
(function (ns) {
  'use strict';

  /** Höchstzahl der Pixel, auf denen die Zentren angelernt werden. */
  const MAX_SAMPLE = 20000;
  /** Höchstzahl der Lloyd-Iterationen. */
  const MAX_ITERATIONS = 30;

  /**
   * Nimmt eine Stichprobe der Farben.
   *
   * @param {Uint8ClampedArray} rgba - Pixel.
   * @param {function():number} random - Zufallsquelle.
   * @returns {Float32Array} r, g, b je Pixel der Stichprobe.
   */
  function samplePixels(rgba, random) {
    const total = rgba.length / 4;
    const count = Math.min(total, MAX_SAMPLE);
    const out = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const p = count === total ? i : Math.floor(random() * total);
      out[i * 3] = rgba[p * 4];
      out[i * 3 + 1] = rgba[p * 4 + 1];
      out[i * 3 + 2] = rgba[p * 4 + 2];
    }
    return out;
  }

  /**
   * Wählt die Startzentren mit k-means++.
   *
   * @param {Float32Array} sample - Stichprobe.
   * @param {number} k - Anzahl.
   * @param {function():number} random - Zufallsquelle.
   * @returns {number[][]} Höchstens k verschiedene Farben.
   */
  function seed(sample, k, random) {
    const n = sample.length / 3;
    const first = Math.floor(random() * n);
    const centers = [[sample[first * 3], sample[first * 3 + 1], sample[first * 3 + 2]]];
    const distances = new Float64Array(n).fill(Infinity);
    while (centers.length < k) {
      const c = centers[centers.length - 1];
      let total = 0;
      for (let i = 0; i < n; i++) {
        const dr = sample[i * 3] - c[0];
        const dg = sample[i * 3 + 1] - c[1];
        const db = sample[i * 3 + 2] - c[2];
        const d = dr * dr + dg * dg + db * db;
        if (d < distances[i]) {
          distances[i] = d;
        }
        total += distances[i];
      }
      if (total === 0) {
        break;
      }
      let target = random() * total;
      let chosen = n - 1;
      for (let i = 0; i < n; i++) {
        target -= distances[i];
        if (target <= 0 && distances[i] > 0) {
          chosen = i;
          break;
        }
      }
      centers.push([sample[chosen * 3], sample[chosen * 3 + 1], sample[chosen * 3 + 2]]);
    }
    return centers;
  }

  /**
   * Nummer der nächsten Farbe.
   *
   * @param {number} r - Rot.
   * @param {number} g - Grün.
   * @param {number} b - Blau.
   * @param {number[][]} centers - Farben.
   * @returns {number} Nummer.
   */
  function nearest(r, g, b, centers) {
    let best = 0;
    let bestD = Infinity;
    for (let c = 0; c < centers.length; c++) {
      const dr = r - centers[c][0];
      const dg = g - centers[c][1];
      const db = b - centers[c][2];
      const d = dr * dr + dg * dg + db * db;
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  /**
   * Fasst die Farben eines Bildes zu k Clustern zusammen.
   *
   * @param {{data:Uint8ClampedArray, width:number, height:number}} image - Bilddaten.
   * @param {number} k - Anzahl der Cluster.
   * @param {function():number} [random] - Zufallsquelle (Standard Math.random).
   * @returns {{colors:number[][], labels:Uint8Array, shares:number[]}} Farben (gerundet), Cluster je Pixel, Flächenanteile.
   */
  function cluster(image, k, random) {
    const rnd = random || Math.random;
    const rgba = image.data;
    const total = image.width * image.height;
    const sample = samplePixels(rgba, rnd);
    const n = sample.length / 3;
    let centers = seed(sample, k, rnd);
    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      const sums = centers.map(() => [0, 0, 0, 0]);
      for (let i = 0; i < n; i++) {
        const s = sums[nearest(sample[i * 3], sample[i * 3 + 1], sample[i * 3 + 2], centers)];
        s[0] += sample[i * 3];
        s[1] += sample[i * 3 + 1];
        s[2] += sample[i * 3 + 2];
        s[3]++;
      }
      let moved = 0;
      centers = centers.map((c, i) => {
        if (sums[i][3] === 0) {
          return c;
        }
        const next = [sums[i][0] / sums[i][3], sums[i][1] / sums[i][3], sums[i][2] / sums[i][3]];
        moved = Math.max(moved, Math.abs(next[0] - c[0]), Math.abs(next[1] - c[1]), Math.abs(next[2] - c[2]));
        return next;
      });
      if (moved < 0.5) {
        break;
      }
    }
    const raw = new Uint8Array(total);
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (let p = 0; p < total; p++) {
      const c = nearest(rgba[p * 4], rgba[p * 4 + 1], rgba[p * 4 + 2], centers);
      raw[p] = c;
      sums[c][0] += rgba[p * 4];
      sums[c][1] += rgba[p * 4 + 1];
      sums[c][2] += rgba[p * 4 + 2];
      sums[c][3]++;
    }
    const order = sums.map((s, i) => i).filter((i) => sums[i][3] > 0).sort((a, b) => sums[b][3] - sums[a][3]);
    const position = new Uint8Array(centers.length);
    order.forEach((old, i) => { position[old] = i; });
    const labels = new Uint8Array(total);
    for (let p = 0; p < total; p++) {
      labels[p] = position[raw[p]];
    }
    return {
      labels,
      colors: order.map((i) => [Math.round(sums[i][0] / sums[i][3]), Math.round(sums[i][1] / sums[i][3]), Math.round(sums[i][2] / sums[i][3])]),
      shares: order.map((i) => sums[i][3] / total)
    };
  }

  /**
   * Färbt das Bild mit den Farben der Cluster.
   *
   * @param {Uint8Array} labels - Cluster je Pixel.
   * @param {number[][]} colors - Farben.
   * @param {Uint8ClampedArray} target - Zielpixel (RGBA).
   */
  function recolor(labels, colors, target) {
    for (let p = 0; p < labels.length; p++) {
      const c = colors[labels[p]];
      target[p * 4] = c[0];
      target[p * 4 + 1] = c[1];
      target[p * 4 + 2] = c[2];
      target[p * 4 + 3] = 255;
    }
  }

  /**
   * Rechnet den Speicherbedarf aus.
   *
   * @param {number} width - Breite in Pixeln.
   * @param {number} height - Höhe in Pixeln.
   * @param {number} k - Anzahl der Farben.
   * @returns {{originalBits:number, bitsPerPixel:number, tableBits:number, compressedBits:number, saved:number}}
   *   Bits des Originals, Bits je Pixel, Bits der Farbtabelle, Bits insgesamt und der gesparte Anteil (negativ, wenn
   *   die Fassung mit Farbtabelle größer ist).
   */
  function storage(width, height, k) {
    const pixels = width * height;
    const bitsPerPixel = Math.ceil(Math.log2(k));
    const originalBits = pixels * 24;
    const tableBits = k * 24;
    const compressedBits = pixels * bitsPerPixel + tableBits;
    return { originalBits, bitsPerPixel, tableBits, compressedBits, saved: 1 - compressedBits / originalBits };
  }

  /**
   * Mittlere Farbabweichung je Pixel zwischen Original und Ergebnis.
   *
   * @param {Uint8ClampedArray} rgba - Pixel des Originals.
   * @param {Uint8Array} labels - Cluster je Pixel.
   * @param {number[][]} colors - Farben der Cluster.
   * @returns {number} Mittlerer euklidischer Abstand im Farbraum aus Rot, Grün und Blau, von 0 bis etwa 441.
   */
  function colorError(rgba, labels, colors) {
    let sum = 0;
    for (let p = 0; p < labels.length; p++) {
      const c = colors[labels[p]];
      const dr = rgba[p * 4] - c[0];
      const dg = rgba[p * 4 + 1] - c[1];
      const db = rgba[p * 4 + 2] - c[2];
      sum += Math.sqrt(dr * dr + dg * dg + db * db);
    }
    return labels.length > 0 ? sum / labels.length : 0;
  }

  ns.imageKmeans = { cluster, recolor, storage, colorError };
})(window.CC = window.CC || {});
