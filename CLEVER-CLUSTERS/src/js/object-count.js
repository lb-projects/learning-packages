/**
 * @file object-count.js
 * @description Zählt zusammenhängende Flächen in einem nach Farben eingeteilten Bild, ohne Zugriff auf die Seite.
 *
 * Ablauf:
 *   1. Hintergrund: Das Cluster, das am Bildrand am häufigsten vorkommt (Vorschlag; änderbar).
 *   2. Maske: alle Pixel, deren Cluster nicht zum Hintergrund gehört.
 *   3. Bereinigen: Schließen (kleine Lücken), Löcher füllen (auch helle Körper mit dunklem Umriss
 *      werden zu einer Fläche), Öffnen (dünne Linien und Rauschen). In dieser Reihenfolge,
 *      damit dünne Umrisse noch die Löcher einschließen können.
 *   4. Zählen: zusammenhängende Flächen (Nachbarschaft über Kanten) ab einer Mindestgröße.
 *
 * Das Verfahren kennt keine Objekte: Es zählt Flächen. Berührende Objekte werden zu einer Fläche,
 * mehrfarbige können zerfallen. Genau das sollen Lernende untersuchen können.
 *
 * Abhängigkeiten:
 *   Keine.
 */
(function (ns) {
  'use strict';

  /**
   * Schlägt den Hintergrund vor.
   *
   * @param {Uint8Array} labels - Cluster je Pixel.
   * @param {number} width - Breite.
   * @param {number} height - Höhe.
   * @param {number} k - Anzahl der Cluster.
   * @returns {number} Nummer des Clusters, das am Rand am häufigsten vorkommt.
   */
  function borderBackground(labels, width, height, k) {
    const counts = new Array(k).fill(0);
    for (let x = 0; x < width; x++) {
      counts[labels[x]]++;
      counts[labels[(height - 1) * width + x]]++;
    }
    for (let y = 1; y < height - 1; y++) {
      counts[labels[y * width]]++;
      counts[labels[y * width + width - 1]]++;
    }
    return counts.indexOf(Math.max(...counts));
  }

  /**
   * Erweitert eine Maske um einen Pixel in alle Richtungen (Quadrat 3 × 3).
   *
   * @param {Uint8Array} mask - Maske.
   * @param {number} w - Breite.
   * @param {number} h - Höhe.
   * @param {number} outside - Wert außerhalb des Bildes.
   * @param {number} value - Der Wert, der sich ausbreitet (1 = Erweitern, 0 = Abtragen).
   * @returns {Uint8Array} Neue Maske.
   */
  function spread(mask, w, h, outside, value) {
    const out = new Uint8Array(mask.length).fill(1 - value);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let hit = false;
        for (let dy = -1; dy <= 1 && !hit; dy++) {
          for (let dx = -1; dx <= 1 && !hit; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            const v = nx < 0 || ny < 0 || nx >= w || ny >= h ? outside : mask[ny * w + nx];
            hit = v === value;
          }
        }
        if (hit) {
          out[y * w + x] = value;
        }
      }
    }
    return out;
  }

  /**
   * Füllt Löcher: Hintergrundpixel, die keine Verbindung zum Rand haben, werden zur Fläche.
   *
   * @param {Uint8Array} mask - Maske.
   * @param {number} w - Breite.
   * @param {number} h - Höhe.
   * @returns {Uint8Array} Neue Maske.
   */
  function fillHoles(mask, w, h) {
    const reached = new Uint8Array(mask.length);
    const stack = [];
    const visit = (i) => {
      if (mask[i] === 0 && reached[i] === 0) {
        reached[i] = 1;
        stack.push(i);
      }
    };
    for (let x = 0; x < w; x++) {
      visit(x);
      visit((h - 1) * w + x);
    }
    for (let y = 0; y < h; y++) {
      visit(y * w);
      visit(y * w + w - 1);
    }
    while (stack.length > 0) {
      const i = stack.pop();
      const x = i % w;
      if (x > 0) { visit(i - 1); }
      if (x < w - 1) { visit(i + 1); }
      if (i >= w) { visit(i - w); }
      if (i < mask.length - w) { visit(i + w); }
    }
    const out = new Uint8Array(mask.length);
    for (let i = 0; i < mask.length; i++) {
      out[i] = reached[i] ? 0 : 1;
    }
    return out;
  }

  /**
   * Findet zusammenhängende Flächen.
   *
   * @param {Uint8Array} mask - Maske.
   * @param {number} w - Breite.
   * @param {number} h - Höhe.
   * @returns {Array<{area:number, x0:number, y0:number, x1:number, y1:number}>} Flächen in Leserichtung ihres ersten Pixels.
   */
  function components(mask, w, h) {
    const seen = new Uint8Array(mask.length);
    const out = [];
    const stack = [];
    for (let start = 0; start < mask.length; start++) {
      if (mask[start] === 0 || seen[start]) {
        continue;
      }
      const box = { area: 0, x0: w, y0: h, x1: 0, y1: 0 };
      seen[start] = 1;
      stack.push(start);
      while (stack.length > 0) {
        const i = stack.pop();
        const x = i % w;
        const y = (i - x) / w;
        box.area++;
        box.x0 = Math.min(box.x0, x);
        box.x1 = Math.max(box.x1, x);
        box.y0 = Math.min(box.y0, y);
        box.y1 = Math.max(box.y1, y);
        const near = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
        for (const j of near) {
          if (j >= 0 && mask[j] === 1 && !seen[j]) {
            seen[j] = 1;
            stack.push(j);
          }
        }
      }
      out.push(box);
    }
    return out;
  }

  /**
   * Erstellt die bereinigte Maske.
   *
   * @param {Uint8Array} labels - Cluster je Pixel.
   * @param {number} w - Breite.
   * @param {number} h - Höhe.
   * @param {Set<number>} background - Cluster, die als Hintergrund gelten.
   * @returns {Uint8Array} Maske (1 = Objekt).
   */
  function cleanMask(labels, w, h, background) {
    const mask = new Uint8Array(labels.length);
    for (let i = 0; i < labels.length; i++) {
      mask[i] = background.has(labels[i]) ? 0 : 1;
    }
    const closed = spread(spread(mask, w, h, 0, 1), w, h, 1, 0);
    const filled = fillHoles(closed, w, h);
    return spread(spread(filled, w, h, 1, 0), w, h, 0, 1);
  }

  /**
   * Zählt die Flächen.
   *
   * @param {Uint8Array} labels - Cluster je Pixel.
   * @param {number} w - Breite.
   * @param {number} h - Höhe.
   * @param {Set<number>} background - Cluster, die als Hintergrund gelten.
   * @param {number} minArea - Mindestgröße in Pixeln.
   * @returns {{boxes:Array<Object>, count:number, ignored:number}} Flächen ab der Mindestgröße,
   *   ihre Anzahl und die Anzahl der kleineren Flächen.
   */
  function count(labels, w, h, background, minArea) {
    const all = components(cleanMask(labels, w, h, background), w, h);
    const boxes = all.filter((b) => b.area >= minArea);
    return { boxes, count: boxes.length, ignored: all.length - boxes.length };
  }

  ns.objectCount = { borderBackground, cleanMask, fillHoles, components, count };
})(window.CC = window.CC || {});
