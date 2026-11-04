/**
 * @file layout.js
 * @description Anordnung der Knoten in der Zeichnung.
 *
 * Zweck:
 *   - circle:   Startlayout: Knoten gleichmäßig auf einem Kreis (im Uhrzeigersinn, oben beginnend).
 *   - freeSpot: Platz für einen neu eingegebenen Knoten, möglichst weit weg von den vorhandenen.
 *   Verschoben werden Knoten danach von Hand (Ziehen mit Maus, Stift oder Finger, siehe graph-view.js).
 *
 * Abhängigkeiten:
 *   Keine.
 */
(function (ns) {
  'use strict';

  /**
   * Positionen auf einem Kreis.
   *
   * @param {number} count - Anzahl der Knoten.
   * @param {{width:number, height:number, margin:number}} area - Zeichenfläche.
   * @returns {Array<{x:number, y:number}>} Positionen.
   */
  function circle(count, area) {
    const cx = area.width / 2;
    const cy = area.height / 2;
    if (count === 1) {
      return [{ x: Math.round(cx), y: Math.round(cy) }];
    }
    const rx = area.width / 2 - area.margin * 2;
    const ry = area.height / 2 - area.margin * 1.5;
    const out = [];
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / count;
      out.push({ x: Math.round(cx + rx * Math.cos(angle)), y: Math.round(cy + ry * Math.sin(angle)) });
    }
    return out;
  }

  /**
   * Freier Platz für einen neuen Knoten: der Rasterpunkt mit dem größten Abstand
   * zum nächsten vorhandenen Knoten (bei Gleichstand der erste von links oben).
   *
   * @param {Array<{x:number, y:number}>} existing - Vorhandene Knoten.
   * @param {{width:number, height:number, margin:number}} area - Zeichenfläche.
   * @returns {{x:number, y:number}} Position.
   */
  function freeSpot(existing, area) {
    if (existing.length === 0) {
      return { x: Math.round(area.width / 2), y: Math.round(area.height / 2) };
    }
    const cols = 9;
    const rows = 6;
    let best = null;
    let bestDistance = -1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = area.margin * 1.5 + ((area.width - area.margin * 3) * c) / (cols - 1);
        const y = area.margin * 1.5 + ((area.height - area.margin * 3) * r) / (rows - 1);
        let nearest = Infinity;
        for (const p of existing) {
          nearest = Math.min(nearest, Math.hypot(p.x - x, p.y - y));
        }
        if (nearest > bestDistance + 0.5) {
          bestDistance = nearest;
          best = { x: Math.round(x), y: Math.round(y) };
        }
      }
    }
    return best;
  }

  /**
   * Kräftebasierte Anordnung (Fruchterman-Reingold): Knoten stoßen sich ab, Kanten ziehen
   * ihre Endknoten zusammen. Start ist die Kreisanordnung; ohne Zufall, daher bei gleichem
   * Graphen immer dasselbe Ergebnis. Danach wird das Bild auf die Zeichenfläche gestreckt.
   *
   * @param {number} count - Anzahl der Knoten (Index 0 … count−1, alphabetisch).
   * @param {Array<[number, number]>} links - Kanten als Indexpaare.
   * @param {{width:number, height:number, margin:number}} area - Zeichenfläche.
   * @returns {Array<{x:number, y:number}>} Positionen.
   */
  function force(count, links, area) {
    const start = circle(count, area);
    if (count < 3) {
      return start;
    }
    const pos = start.map((p) => ({ x: p.x, y: p.y }));
    const w = area.width - area.margin * 3;
    const h = area.height - area.margin * 3;
    const k = 0.9 * Math.sqrt((w * h) / count);
    let temperature = w / 8;
    const cx = area.width / 2;
    const cy = area.height / 2;
    const gravity = (4 * k) / Math.min(w, h);
    const iterations = 300;
    for (let it = 0; it < iterations; it++) {
      const disp = pos.map(() => ({ x: 0, y: 0 }));
      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          let dx = pos[i].x - pos[j].x;
          let dy = pos[i].y - pos[j].y;
          let d = Math.hypot(dx, dy);
          if (d < 0.01) {
            dx = 0.01 * (i - j);
            dy = 0.01;
            d = Math.hypot(dx, dy);
          }
          const f = (k * k) / d;
          disp[i].x += (dx / d) * f;
          disp[i].y += (dy / d) * f;
          disp[j].x -= (dx / d) * f;
          disp[j].y -= (dy / d) * f;
        }
      }
      for (const [a, b] of links) {
        const dx = pos[a].x - pos[b].x;
        const dy = pos[a].y - pos[b].y;
        const d = Math.max(0.01, Math.hypot(dx, dy));
        const f = (d * d) / k;
        disp[a].x -= (dx / d) * f;
        disp[a].y -= (dy / d) * f;
        disp[b].x += (dx / d) * f;
        disp[b].y += (dy / d) * f;
      }
      // Schwerkraft zur Mitte: hält auch unzusammenhängende Teile und einzelne Knoten beisammen.
      for (let i = 0; i < count; i++) {
        disp[i].x -= (pos[i].x - cx) * gravity;
        disp[i].y -= (pos[i].y - cy) * gravity;
      }
      for (let i = 0; i < count; i++) {
        const d = Math.max(0.01, Math.hypot(disp[i].x, disp[i].y));
        const step = Math.min(d, temperature);
        pos[i].x += (disp[i].x / d) * step;
        pos[i].y += (disp[i].y / d) * step;
      }
      temperature *= 0.985;
    }
    // Auf die Zeichenfläche strecken (Ränder frei für Beschriftungen).
    const xs = pos.map((p) => p.x);
    const ys = pos.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const left = area.margin * 2.2;
    const top = area.margin * 1.5;
    const spanX = area.width - left * 2;
    const spanY = area.height - top * 2;
    return pos.map((p) => ({
      x: Math.round(maxX > minX ? left + ((p.x - minX) / (maxX - minX)) * spanX : area.width / 2),
      y: Math.round(maxY > minY ? top + ((p.y - minY) / (maxY - minY)) * spanY : area.height / 2)
    }));
  }

  ns.layout = { circle, freeSpot, force };
})(window.HG = window.HG || {});
