/**
 * @file uml-layout.js
 * @description Ebenenlayout mit rechtwinkliger Linienführung für das Klassendiagramm (ohne DOM).
 *
 * Ablauf (angelehnt an das bekannte Verfahren von Sugiyama, eigene Umsetzung):
 *   1. Zyklen brechen, Ebenen bestimmen: referenzierte Klassen oben, abhängige darunter.
 *      Assoziationsklassen liegen unter beiden Enden ihrer n:m-Beziehung.
 *   2. Linien über mehrere Ebenen erhalten Hilfsknoten (Durchgänge).
 *   3. Reihenfolge je Ebene: Baryzentren und Nachbartausch, um Kreuzungen zu vermeiden
 *      (entfällt bei sehr vielen Linienabschnitten, da die Kreuzungszählung quadratisch wächst).
 *   4. Waagerechte Lage: Ausgleich zur Mitte der Nachbarn bei festen Mindestabständen.
 *   5. Linienführung nur mit waagerechten und senkrechten Abschnitten: Zwischen zwei
 *      Ebenen liegt ein Kanal mit Spuren; jede waagerechte Strecke bekommt eine Spur,
 *      deren Reihenfolge Kreuzungen vermeidet.
 *
 * Das Ergebnis hängt nur von der Eingabe ab (keine Zufallszahlen).
 *
 * Abhängigkeiten:
 *   Keine.
 */
(function (ns) {
  'use strict';

  const GAP_X = 60;        // Abstand zwischen zwei Karten einer Ebene
  const GAP_NM = 90;       // Mindestabstand zwischen n:m-verbundenen Nachbarn
  const GAP_DUMMY = 30;    // Abstand einer durchlaufenden Linie zu ihren Nachbarn
  const MARGIN = 24;       // Rand um das Diagramm
  const PAD = 32;          // freier Bereich oben und unten in einem Kanal (Multiplizitäten)
  const TRACK = 16;        // Abstand der Spuren
  const MIN_CHANNEL = 96;  // Mindesthöhe eines Kanals zwischen zwei Ebenen
  const ISOLATED_PER_ROW = 5;
  const LOOP = 16;         // Größe einer Schleife (Selbstbezug)
  const PORT_MARGIN = 14;  // Abstand der Anschlüsse von den Kartenecken
  const PORT_GAP = 18;     // Mindestabstand zweier Anschlüsse auf einer Seite
  const SWEEPS = 12;
  /** Oberhalb dieser Zahl von Linienabschnitten wird die Reihenfolge nicht optimiert (Laufzeit). */
  const MAX_OPTIMIZED_SEGMENTS = 300;

  /** @returns {{x:number, y:number}} Punkt. */
  const pt = (x, y) => ({ x, y });

  /**
   * Entfernt doppelte Punkte und Punkte mitten auf einer Geraden.
   *
   * @param {Array<{x:number,y:number}>} points - Eckpunkte.
   * @returns {Array<{x:number,y:number}>} Bereinigte Eckpunkte.
   */
  function simplify(points) {
    const out = [];
    for (const p of points) {
      const last = out[out.length - 1];
      if (last && Math.abs(last.x - p.x) < 0.01 && Math.abs(last.y - p.y) < 0.01) {
        continue;
      }
      out.push(p);
      while (out.length >= 3) {
        const a = out[out.length - 3];
        const b = out[out.length - 2];
        const c = out[out.length - 1];
        const vertical = Math.abs(a.x - b.x) < 0.01 && Math.abs(b.x - c.x) < 0.01;
        const horizontal = Math.abs(a.y - b.y) < 0.01 && Math.abs(b.y - c.y) < 0.01;
        if (vertical || horizontal) {
          out.splice(out.length - 2, 1);
        } else {
          break;
        }
      }
    }
    return out;
  }

  /**
   * Platziert Elemente einer Ebene in fester Reihenfolge möglichst nahe an ihren
   * Wunschpositionen (kleinste Quadrate) unter Einhaltung der Mindestabstände.
   *
   * @param {Array<number>} desired - Wunschmitten.
   * @param {Array<number>} sep - sep[i] = Mindestabstand der Mitten von Element i und i+1.
   * @returns {Array<number>} Mitten.
   */
  function place1D(desired, sep) {
    const blocks = [];
    for (let i = 0; i < desired.length; i++) {
      let block = { first: i, last: i, sum: desired[i], count: 1, offLast: 0 };
      block.p = block.sum;
      while (blocks.length) {
        const prev = blocks[blocks.length - 1];
        const shift = prev.offLast + sep[prev.last];
        if (prev.p + shift <= block.p) {
          break;
        }
        prev.sum += block.sum - block.count * shift;
        prev.count += block.count;
        prev.last = block.last;
        prev.offLast = shift + block.offLast;
        prev.p = prev.sum / prev.count;
        blocks.pop();
        block = prev;
      }
      blocks.push(block);
    }
    const out = new Array(desired.length);
    for (const b of blocks) {
      let x = b.p;
      for (let i = b.first; i <= b.last; i++) {
        out[i] = x;
        x += sep[i];
      }
    }
    return out;
  }

  /**
   * Berechnet das Layout.
   *
   * „In die Tiefe“ (vertical): referenzierte Klassen oben, abhängige darunter.
   * „In die Breite“ (horizontal): referenzierte Klassen links, abhängige rechts. Dafür wird
   * das Layout mit vertauschten Kartenmaßen berechnet und anschließend gespiegelt (x ↔ y);
   * rechtwinklige Linien bleiben dabei rechtwinklig.
   *
   * @param {Array<{id:string, w:number, h:number}>} nodes - Karten (Klassen und Assoziationsklassen).
   * @param {Array<{id:string, from:string, to:string, kind:string, assocClass:string|null, labelW:number}>} edges - Beziehungen.
   * @param {{direction:string}} [options] - direction: 'vertical' (Standard) oder 'horizontal'.
   * @returns {{positions:Map<string,{x:number,y:number}>, routes:Map<string,Array>, connectors:Map<string,Array>, width:number, height:number, direction:string}}
   *   Linke obere Ecke je Karte, Eckpunkte je Beziehung (vom from- zum to-Ende) und je Anbindung einer Assoziationsklasse.
   */
  function layout(nodes, edges, options) {
    if (!(options && options.direction === 'horizontal')) {
      return Object.assign(layoutCore(nodes, edges, { minChannel: MIN_CHANNEL, labelGap: true }), { direction: 'vertical' });
    }
    // Bezeichner stehen auf den waagerechten Abschnitten zwischen den Spalten: Kanäle so breit
    // wie nötig, Knicke nahe der linken Spalte (das lange Stück trägt den Bezeichner).
    const t = layoutCore(nodes.map((n) => ({ id: n.id, w: n.h, h: n.w })), edges,
      { minChannel: MIN_CHANNEL, labelGap: false, channelLabels: true });
    const swap = (p) => pt(p.y, p.x);
    const mapAll = (m) => new Map(Array.from(m, ([k, pts]) => [k, pts.map(swap)]));
    return {
      positions: new Map(Array.from(t.positions, ([k, p]) => [k, swap(p)])),
      routes: mapAll(t.routes),
      connectors: mapAll(t.connectors),
      width: t.height,
      height: t.width,
      direction: 'horizontal'
    };
  }

  /**
   * Kern des Layouts (immer „in die Tiefe“ gerechnet).
   *
   * @param {Array} nodes - Karten.
   * @param {Array} edges - Beziehungen.
   * @param {{minChannel:number, labelGap:boolean, channelLabels:boolean}} opts - Mindesthöhe der
   *   Kanäle; Platz für Bezeichner zwischen n:m-Nachbarn derselben Ebene; Bezeichner laufen
   *   entlang der Kanäle (nach dem Spiegeln waagerecht), Spuren dann am Kanalanfang.
   * @returns {Object} Ergebnis wie {@link layout} (ohne direction).
   */
  function layoutCore(nodes, edges, opts) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const order = new Map(nodes.map((n, i) => [n.id, i]));

    // ---- 1) Ebenen ------------------------------------------------------
    const arcs = [];
    for (const e of edges) {
      if (e.kind === 'fk' && e.from !== e.to) {
        arcs.push([e.from, e.to]);
      }
      if (e.kind === 'nm' && e.assocClass) {
        arcs.push([e.assocClass, e.from]);
        if (e.to !== e.from) {
          arcs.push([e.assocClass, e.to]);
        }
      }
    }
    const out = new Map(nodes.map((n) => [n.id, []]));
    for (const a of arcs) {
      out.get(a[0]).push(a);
    }
    const dag = [];
    const state = new Map();
    const visit = (v) => {
      state.set(v, 1);
      for (const [c, p] of out.get(v)) {
        if (state.get(p) === 1) {
          dag.push([p, c]);
        } else {
          dag.push([c, p]);
          if (!state.has(p)) {
            visit(p);
          }
        }
      }
      state.set(v, 2);
    };
    nodes.forEach((n) => {
      if (!state.has(n.id)) {
        visit(n.id);
      }
    });
    const parents = new Map(nodes.map((n) => [n.id, []]));
    const children = new Map(nodes.map((n) => [n.id, []]));
    for (const [c, p] of dag) {
      parents.get(c).push(p);
      children.get(p).push(c);
    }
    const layer = new Map();
    const lay = (v) => {
      if (layer.has(v)) {
        return layer.get(v);
      }
      layer.set(v, 0);
      let l = 0;
      for (const p of parents.get(v)) {
        l = Math.max(l, lay(p) + 1);
      }
      layer.set(v, l);
      return l;
    };
    nodes.forEach((n) => lay(n.id));
    // Klassen ohne Eltern rücken direkt über ihr höchstes Kind.
    for (const n of nodes) {
      const kids = children.get(n.id);
      if (parents.get(n.id).length === 0 && kids.length) {
        layer.set(n.id, Math.min(...kids.map((k) => layer.get(k))) - 1);
      }
    }
    // Isolierte Klassen kommen in eigene Reihen unten.
    const connected = new Set();
    for (const [c, p] of dag) {
      connected.add(c);
      connected.add(p);
    }
    for (const e of edges) {
      if (e.from !== e.to) {
        connected.add(e.from);
        connected.add(e.to);
      }
    }
    let maxLayer = -1;
    for (const n of nodes) {
      if (connected.has(n.id)) {
        maxLayer = Math.max(maxLayer, layer.get(n.id));
      }
    }
    let isolatedCount = 0;
    for (const n of nodes) {
      if (!connected.has(n.id)) {
        layer.set(n.id, maxLayer + 1 + Math.floor(isolatedCount / ISOLATED_PER_ROW));
        isolatedCount++;
      }
    }
    const layerCount = Math.max(0, ...nodes.map((n) => layer.get(n.id) + 1));

    // ---- 2) Elemente je Ebene, Hilfsknoten ------------------------------
    const layers = Array.from({ length: layerCount }, () => []);
    const items = new Map();
    for (const n of nodes) {
      const item = { id: n.id, node: n, w: n.w, layer: layer.get(n.id) };
      items.set(n.id, item);
      layers[item.layer].push(item);
    }
    const segs = Array.from({ length: layerCount }, () => []); // segs[l]: Verbindungen zwischen Ebene l und l+1
    const routeInfo = new Map();
    for (const e of edges) {
      if (e.from === e.to) {
        routeInfo.set(e.id, { type: 'loop', edge: e });
        continue;
      }
      const la = layer.get(e.from);
      const lb = layer.get(e.to);
      if (la === lb) {
        routeInfo.set(e.id, { type: 'same', edge: e, layer: la });
        continue;
      }
      const upper = la < lb ? e.from : e.to;
      const lower = la < lb ? e.to : e.from;
      const chain = [items.get(upper)];
      for (let l = Math.min(la, lb) + 1; l < Math.max(la, lb); l++) {
        const d = { id: e.id + '#' + l, dummy: true, w: 0, layer: l };
        items.set(d.id, d);
        layers[l].push(d);
        chain.push(d);
      }
      chain.push(items.get(lower));
      for (let i = 0; i + 1 < chain.length; i++) {
        segs[chain[i].layer].push([chain[i], chain[i + 1]]);
      }
      routeInfo.set(e.id, { type: 'inter', edge: e, chain, reversed: upper !== e.from });
    }
    // Assoziationsklassen ziehen zu ihren Enden (nur für Reihenfolge und Lage).
    for (const e of edges) {
      if (e.kind === 'nm' && e.assocClass) {
        const c = items.get(e.assocClass);
        for (const end of [e.from, e.to]) {
          const it = items.get(end);
          if (c.layer === it.layer + 1) {
            segs[it.layer].push([it, c]);
          }
        }
      }
    }
    const sameLayer = edges.filter((e) => routeInfo.get(e.id).type === 'same');

    // ---- 3) Reihenfolge -------------------------------------------------
    const pos = new Map();
    const index = () => layers.forEach((row) => row.forEach((it, i) => pos.set(it, i)));
    index();
    const crossings = (l) => {
      const s = segs[l] || [];
      let count = 0;
      for (let i = 0; i < s.length; i++) {
        for (let j = i + 1; j < s.length; j++) {
          const a = (pos.get(s[i][0]) - pos.get(s[j][0])) * (pos.get(s[i][1]) - pos.get(s[j][1]));
          if (a < 0) {
            count++;
          }
        }
      }
      return count;
    };
    const penalty = (l) => {
      let p = 0;
      for (const e of sameLayer) {
        if (layer.get(e.from) === l) {
          p += 4 * Math.max(0, Math.abs(pos.get(items.get(e.from)) - pos.get(items.get(e.to))) - 1);
        }
      }
      return p;
    };
    const total = () => {
      let t = 0;
      for (let l = 0; l < layerCount; l++) {
        t += crossings(l) + penalty(l);
      }
      return t;
    };
    const up = new Map();
    const down = new Map();
    for (const it of items.values()) {
      up.set(it, []);
      down.set(it, []);
    }
    segs.forEach((s) => s.forEach(([a, b]) => {
      down.get(a).push(b);
      up.get(b).push(a);
    }));
    const sortByBary = (row, neighbors) => {
      const bary = new Map(row.map((it, i) => {
        const nb = neighbors.get(it);
        return [it, nb.length ? nb.reduce((s, x) => s + pos.get(x), 0) / nb.length : i];
      }));
      row.sort((a, b) => (bary.get(a) - bary.get(b)) || (pos.get(a) - pos.get(b)));
      row.forEach((it, i) => pos.set(it, i));
    };
    const optimize = segs.reduce((n, s) => n + (s ? s.length : 0), 0) <= MAX_OPTIMIZED_SEGMENTS;
    let best = layers.map((row) => row.slice());
    let bestScore = optimize ? total() : 0;
    for (let s = 0; s < SWEEPS && bestScore > 0; s++) {
      if (s % 2 === 0) {
        for (let l = 1; l < layerCount; l++) {
          sortByBary(layers[l], up);
        }
      } else {
        for (let l = layerCount - 2; l >= 0; l--) {
          sortByBary(layers[l], down);
        }
      }
      const score = total();
      if (score < bestScore) {
        bestScore = score;
        best = layers.map((row) => row.slice());
      }
    }
    best.forEach((row, l) => {
      layers[l] = row;
    });
    index();
    const local = (l) => (l > 0 ? crossings(l - 1) : 0) + crossings(l) + penalty(l);
    for (let guard = 0, improved = optimize; improved && guard < 30; guard++) {
      improved = false;
      for (let l = 0; l < layerCount; l++) {
        const row = layers[l];
        for (let j = 0; j + 1 < row.length; j++) {
          const before = local(l);
          [row[j], row[j + 1]] = [row[j + 1], row[j]];
          pos.set(row[j], j);
          pos.set(row[j + 1], j + 1);
          if (local(l) < before) {
            improved = true;
          } else {
            [row[j], row[j + 1]] = [row[j + 1], row[j]];
            pos.set(row[j], j);
            pos.set(row[j + 1], j + 1);
          }
        }
      }
    }

    // Beziehungen innerhalb einer Ebene: direkte Nachbarn oder Umweg über den Kanal darüber.
    const adjacentGap = new Map();
    for (const e of sameLayer) {
      const a = items.get(e.from);
      const b = items.get(e.to);
      const info = routeInfo.get(e.id);
      if (Math.abs(pos.get(a) - pos.get(b)) === 1) {
        info.type = 'adjacent';
        const left = pos.get(a) < pos.get(b) ? a : b;
        adjacentGap.set(left, Math.max(adjacentGap.get(left) || GAP_NM, opts.labelGap ? (e.labelW || 0) + 40 : 0));
      } else {
        info.type = 'over';
      }
    }

    // ---- 4) Waagerechte Lage --------------------------------------------
    const cx = new Map();
    const sepOf = (row) => row.slice(0, -1).map((a, i) => {
      const b = row[i + 1];
      const gap = a.dummy || b.dummy ? GAP_DUMMY : (adjacentGap.get(a) || GAP_X);
      return a.w / 2 + b.w / 2 + gap;
    });
    const seps = layers.map(sepOf);
    layers.forEach((row, l) => {
      let x = 0;
      row.forEach((it, i) => {
        cx.set(it, x);
        x += seps[l][i] || 0;
      });
    });
    const relax = (l, neighborSets) => {
      const row = layers[l];
      if (!row.length) {
        return;
      }
      const desired = row.map((it) => {
        const nb = [];
        neighborSets.forEach((m) => nb.push(...m.get(it)));
        return nb.length ? nb.reduce((s, x) => s + cx.get(x), 0) / nb.length : cx.get(it);
      });
      place1D(desired, seps[l]).forEach((x, i) => cx.set(row[i], x));
    };
    for (let round = 0; round < 10; round++) {
      for (let l = 1; l < layerCount; l++) {
        relax(l, [up]);
      }
      for (let l = layerCount - 2; l >= 0; l--) {
        relax(l, [down]);
      }
    }
    for (let l = 0; l < layerCount; l++) {
      relax(l, [up, down]);
    }
    let minLeft = Infinity;
    for (const it of items.values()) {
      minLeft = Math.min(minLeft, cx.get(it) - it.w / 2);
    }
    for (const it of items.values()) {
      cx.set(it, cx.get(it) - minLeft + MARGIN);
    }
    const left = (it) => cx.get(it) - it.w / 2;
    const right = (it) => cx.get(it) + it.w / 2;

    // ---- 5) Anschlusspunkte ---------------------------------------------
    const bottomPorts = new Map();
    const topPorts = new Map();
    const addPort = (map, it, key, ref, idx) => {
      if (!map.has(it)) {
        map.set(it, []);
      }
      map.get(it).push({ key, ref, idx });
    };
    const loopsOf = new Map();
    const connectorInfo = new Map();
    // Wunschlage eines Anschlusses: genau über/unter dem Gegenüber, damit die Linie
    // möglichst ohne Versatz senkrecht verläuft.
    const toward = (it, other) => {
      if (other.dummy) {
        return cx.get(other);
      }
      const lo = Math.max(left(it), left(other)) + PORT_MARGIN;
      const hi = Math.min(right(it), right(other)) - PORT_MARGIN;
      return lo <= hi ? (lo + hi) / 2 : cx.get(other);
    };
    edges.forEach((e, idx) => {
      const info = routeInfo.get(e.id);
      if (info.type === 'inter') {
        const c = info.chain;
        addPort(bottomPorts, c[0], toward(c[0], c[1]), e.id, idx);
        addPort(topPorts, c[c.length - 1], toward(c[c.length - 1], c[c.length - 2]), e.id, idx);
      } else if (info.type === 'over') {
        addPort(topPorts, items.get(e.from), cx.get(items.get(e.to)), e.id + ':from', idx);
        addPort(topPorts, items.get(e.to), cx.get(items.get(e.from)), e.id + ':to', idx);
      } else if (info.type === 'loop') {
        const it = items.get(e.from);
        if (!loopsOf.has(it)) {
          loopsOf.set(it, []);
        }
        loopsOf.get(it).push(e.id);
        addPort(topPorts, it, Infinity, e.id, idx);
      }
      if (e.kind === 'nm' && e.assocClass && info.type === 'adjacent') {
        const a = items.get(e.from);
        const b = items.get(e.to);
        const l = pos.get(a) < pos.get(b) ? a : b;
        const r = l === a ? b : a;
        const c = items.get(e.assocClass);
        if (c.layer === l.layer + 1) {
          const xm = (right(l) + left(r)) / 2;
          connectorInfo.set(e.id, { xm, c });
          addPort(topPorts, c, xm, e.id + ':assoc', idx);
        }
      }
    });
    const portX = new Map();
    // Anschlüsse einer Seite: sortiert nach Wunschlage (vermeidet Kreuzungen), möglichst an der
    // Wunschlage, mit Mindestabstand, innerhalb der Kartenseite.
    const distribute = (map) => {
      for (const [it, list] of map) {
        list.sort((a, b) => (a.key - b.key) || (a.idx - b.idx) || (a.ref < b.ref ? -1 : 1));
        const lo = left(it) + PORT_MARGIN;
        const hi = right(it) - PORT_MARGIN;
        const gap = list.length > 1 ? Math.min(PORT_GAP, (hi - lo) / (list.length - 1)) : 0;
        const desired = list.map((p) => Math.min(Math.max(p.key, lo), hi));
        let xs = place1D(desired, desired.map(() => gap));
        const shift = Math.max(0, lo - xs[0]) - Math.max(0, xs[xs.length - 1] - hi);
        xs = xs.map((x) => x + shift);
        list.forEach((p, k) => portX.set(p.ref + (map === topPorts ? '@top' : '@bottom'), xs[k]));
      }
    };
    distribute(bottomPorts);
    distribute(topPorts);
    const exitX = (it, ref) => (it.dummy ? cx.get(it) : portX.get(ref + '@bottom'));
    const entryX = (it, ref) => (it.dummy ? cx.get(it) : portX.get(ref + '@top'));

    // ---- 6) Kanäle und Spuren -------------------------------------------
    const channels = Array.from({ length: layerCount + 1 }, () => []); // channels[l] liegt über Ebene l
    // Kleine Versätze zwischen Anschluss und Durchgang vermeiden: Durchgang auf den Anschluss rücken.
    for (const e of edges) {
      const info = routeInfo.get(e.id);
      if (info.type === 'inter' && info.chain.length > 2) {
        const c = info.chain;
        const first = exitX(c[0], e.id);
        const last = entryX(c[c.length - 1], e.id);
        if (Math.abs(cx.get(c[1]) - first) < 8) {
          cx.set(c[1], first);
        }
        if (Math.abs(cx.get(c[c.length - 2]) - last) < 8) {
          cx.set(c[c.length - 2], last);
        }
      }
    }
    for (const e of edges) {
      const info = routeInfo.get(e.id);
      if (info.type === 'inter') {
        info.steps = [];
        const c = info.chain;
        for (let i = 0; i + 1 < c.length; i++) {
          const x1 = i === 0 ? exitX(c[0], e.id) : cx.get(c[i]);
          const x2 = i + 1 === c.length - 1 ? entryX(c[i + 1], e.id) : cx.get(c[i + 1]);
          const step = { x1, x2, channel: c[i].layer + 1, piece: null };
          if (Math.abs(x1 - x2) > 0.5) {
            step.piece = { lo: Math.min(x1, x2), hi: Math.max(x1, x2), verts: [{ x: x1, dir: 'up' }, { x: x2, dir: 'down' }] };
            channels[step.channel].push(step.piece);
          }
          info.steps.push(step);
        }
      } else if (info.type === 'over') {
        const xa = portX.get(e.id + ':from@top');
        const xb = portX.get(e.id + ':to@top');
        info.piece = { lo: Math.min(xa, xb), hi: Math.max(xa, xb), verts: [{ x: xa, dir: 'down' }, { x: xb, dir: 'down' }] };
        info.xa = xa;
        info.xb = xb;
        channels[info.layer].push(info.piece);
      }
      const conn = connectorInfo.get(e.id);
      if (conn) {
        conn.xc = portX.get(e.id + ':assoc@top');
        if (Math.abs(conn.xm - conn.xc) > 0.5) {
          conn.piece = { lo: Math.min(conn.xm, conn.xc), hi: Math.max(conn.xm, conn.xc), verts: [{ x: conn.xm, dir: 'up' }, { x: conn.xc, dir: 'down' }] };
          channels[conn.c.layer].push(conn.piece);
        }
      }
    }
    const trackCount = channels.map((pieces) => assignTracks(pieces));
    // Platzbedarf der Bezeichner je Kanal (nur wenn sie entlang des Kanals stehen).
    const labelNeed = new Array(layerCount + 1).fill(0);
    if (opts.channelLabels) {
      for (const e of edges) {
        const info = routeInfo.get(e.id);
        if (info.type === 'inter' && info.chain.length === 2 && e.labelW) {
          const step = info.steps[0];
          const t = trackCount[step.channel];
          const need = e.labelW + 30 + (step.piece ? PAD + Math.max(0, t - 1) * TRACK + 10 : 0);
          labelNeed[step.channel] = Math.max(labelNeed[step.channel], need);
        }
      }
    }

    // ---- 7) Senkrechte Lage ---------------------------------------------
    const rowTop = [];
    const rowH = layers.map((row) => Math.max(0, ...row.filter((it) => it.node).map((it) => it.node.h)));
    const chTop = [];
    const chH = [];
    let y = MARGIN;
    for (let l = 0; l <= layerCount; l++) {
      const t = trackCount[l];
      let h;
      if (l === 0) {
        const loops = layers[0] && layers[0].some((it) => loopsOf.has(it));
        h = t > 0 ? 2 * PAD + (t - 1) * TRACK : (loops ? PAD : 0);
      } else if (l === layerCount) {
        h = 0;
      } else {
        h = Math.max(opts.minChannel, labelNeed[l], 2 * PAD + Math.max(0, t - 1) * TRACK);
      }
      chTop[l] = y;
      chH[l] = h;
      y += h;
      if (l < layerCount) {
        rowTop[l] = y;
        y += rowH[l];
      }
    }
    const height = y + MARGIN;
    const trackY = (l, piece) => {
      const t = trackCount[l];
      if (opts.channelLabels && l > 0) {
        return chTop[l] + PAD + piece.track * TRACK;
      }
      return chTop[l] + (chH[l] - (t - 1) * TRACK) / 2 + piece.track * TRACK;
    };
    const top = (it) => rowTop[it.layer];
    const bottom = (it) => rowTop[it.layer] + it.node.h;

    // ---- 8) Eckpunkte ---------------------------------------------------
    const routes = new Map();
    const connectors = new Map();
    // Seitliche Anschlüsse für direkte Nachbarn (gleiche Höhe auf beiden Seiten).
    const adjacentGroups = new Map();
    for (const e of edges) {
      if (routeInfo.get(e.id).type === 'adjacent') {
        const a = items.get(e.from);
        const b = items.get(e.to);
        const key = [a.id, b.id].sort().join('|');
        if (!adjacentGroups.has(key)) {
          adjacentGroups.set(key, []);
        }
        adjacentGroups.get(key).push(e);
      }
    }
    for (const group of adjacentGroups.values()) {
      const a = items.get(group[0].from);
      const b = items.get(group[0].to);
      const l = pos.get(a) < pos.get(b) ? a : b;
      const r = l === a ? b : a;
      const loopsL = (loopsOf.get(l) || []).length;
      const minH = Math.min(l.node.h, r.node.h);
      const lo = Math.max(20, loopsL ? 14 + loopsL * 8 : 0);
      const hi = minH - 8;
      group.forEach((e, k) => {
        const yy = top(l) + (hi > lo ? lo + (hi - lo) * (k + 1) / (group.length + 1) : minH / 2);
        let points = [pt(right(l), yy), pt(left(r), yy)];
        if (items.get(e.from) !== l) {
          points = points.reverse();
        }
        routes.set(e.id, points);
        const conn = connectorInfo.get(e.id);
        if (conn) {
          const c = conn.c;
          const pts = [pt(conn.xm, yy)];
          if (conn.piece) {
            const ty = trackY(c.layer, conn.piece);
            pts.push(pt(conn.xm, ty), pt(conn.xc, ty));
          }
          pts.push(pt(conn.xc, top(c)));
          connectors.set(e.id, simplify(pts));
        }
      });
    }
    for (const e of edges) {
      const info = routeInfo.get(e.id);
      if (info.type === 'inter') {
        const c = info.chain;
        const pts = [pt(info.steps[0].x1, bottom(c[0]))];
        for (const step of info.steps) {
          if (step.piece) {
            const ty = trackY(step.channel, step.piece);
            pts.push(pt(step.x1, ty), pt(step.x2, ty));
          }
        }
        pts.push(pt(info.steps[info.steps.length - 1].x2, top(c[c.length - 1])));
        const simple = simplify(pts);
        routes.set(e.id, info.reversed ? simple.reverse() : simple);
      } else if (info.type === 'over') {
        const a = items.get(e.from);
        const b = items.get(e.to);
        const ty = trackY(info.layer, info.piece);
        routes.set(e.id, simplify([pt(info.xa, top(a)), pt(info.xa, ty), pt(info.xb, ty), pt(info.xb, top(b))]));
      } else if (info.type === 'loop') {
        const it = items.get(e.from);
        const i = loopsOf.get(it).indexOf(e.id);
        routes.set(e.id, loopRoute({ x: left(it), y: top(it), w: it.w, h: it.node.h }, i, portX.get(e.id + '@top')));
      }
    }
    // Übrige Anbindungen von Assoziationsklassen (seltene Fälle): einfache rechtwinklige Führung.
    for (const e of edges) {
      if (e.kind === 'nm' && e.assocClass && !connectors.has(e.id) && routes.has(e.id)) {
        const c = items.get(e.assocClass);
        connectors.set(e.id, connectorRoute(routes.get(e.id), { x: left(c), y: top(c), w: c.w, h: c.node.h }));
      }
    }

    const positions = new Map();
    let width = 0;
    for (const n of nodes) {
      const it = items.get(n.id);
      positions.set(n.id, { x: left(it), y: top(it) });
      width = Math.max(width, right(it) + LOOP * 3);
    }
    for (const list of [routes, connectors]) {
      for (const points of list.values()) {
        for (const p of points) {
          width = Math.max(width, p.x + MARGIN);
        }
      }
    }
    return { positions, routes, connectors, width: Math.ceil(width + MARGIN), height: Math.ceil(height) };
  }

  /**
   * Verteilt die waagerechten Strecken eines Kanals auf Spuren: Strecken, die sich
   * überdecken, erhalten verschiedene Spuren; die Reihenfolge vermeidet Kreuzungen
   * mit den senkrechten Abschnitten.
   *
   * @param {Array<{lo:number, hi:number, verts:Array<{x:number, dir:string}>}>} pieces - Strecken (bekommen .track).
   * @returns {number} Anzahl der Spuren.
   */
  function assignTracks(pieces) {
    const n = pieces.length;
    if (n === 0) {
      return 0;
    }
    const inside = (x, p) => x > p.lo - 0.5 && x < p.hi + 0.5;
    const above = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = pieces[i];
        const b = pieces[j];
        if (!(a.lo <= b.hi + 6 && b.lo <= a.hi + 6)) {
          continue;
        }
        let score = 0; // < 0: a über b
        for (const v of a.verts) {
          if (inside(v.x, b)) {
            score += v.dir === 'up' ? -1 : 1;
          }
        }
        for (const v of b.verts) {
          if (inside(v.x, a)) {
            score += v.dir === 'up' ? 1 : -1;
          }
        }
        if (score === 0) {
          score = (a.lo - b.lo) || (a.hi - b.hi) || -1;
        }
        if (score < 0) {
          above[i].push(j);
        } else {
          above[j].push(i);
        }
      }
    }
    // Zyklen brechen (Kanten zu Knoten in Bearbeitung ignorieren), dann längster Pfad.
    const state = new Array(n).fill(0);
    const kept = Array.from({ length: n }, () => []);
    const visit = (v) => {
      state[v] = 1;
      for (const w of above[v]) {
        if (state[w] === 1) {
          continue;
        }
        kept[v].push(w);
        if (state[w] === 0) {
          visit(w);
        }
      }
      state[v] = 2;
    };
    for (let i = 0; i < n; i++) {
      if (state[i] === 0) {
        visit(i);
      }
    }
    const depth = new Array(n).fill(0);
    const indeg = new Array(n).fill(0);
    kept.forEach((list) => list.forEach((w) => indeg[w]++));
    const queue = [];
    indeg.forEach((d, i) => {
      if (d === 0) {
        queue.push(i);
      }
    });
    while (queue.length) {
      const v = queue.shift();
      for (const w of kept[v]) {
        depth[w] = Math.max(depth[w], depth[v] + 1);
        if (--indeg[w] === 0) {
          queue.push(w);
        }
      }
    }
    pieces.forEach((p, i) => {
      p.track = depth[i];
    });
    return Math.max(...depth) + 1;
  }

  /**
   * Rechteckige Schleife für einen Selbstbezug (rechts heraus, oben hinein).
   *
   * @param {{x:number, y:number, w:number, h:number}} r - Karte.
   * @param {number} i - Nummer der Schleife an dieser Karte.
   * @param {number} [topX] - x des Anschlusses oben (sonst nahe der rechten Ecke).
   * @returns {Array<{x:number,y:number}>} Eckpunkte.
   */
  function loopRoute(r, i, topX) {
    const d = LOOP + i * 8;
    const x = topX === undefined ? r.x + r.w - 24 - i * 8 : topX;
    const right = r.x + r.w;
    return [pt(right, r.y + 8 + i * 8), pt(right + d, r.y + 8 + i * 8), pt(right + d, r.y - d), pt(x, r.y - d), pt(x, r.y)];
  }

  /**
   * Rechtwinklige Verbindung zweier Karten (nach dem Verschieben).
   *
   * @param {{x:number,y:number,w:number,h:number}} a - Karte am Anfang.
   * @param {{x:number,y:number,w:number,h:number}} b - Karte am Ende.
   * @param {number} offset - Versatz für parallele Linien (px).
   * @returns {Array<{x:number,y:number}>} Eckpunkte von a nach b.
   */
  function orthoRoute(a, b, offset) {
    const clampTo = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
    const vGap = (u, l) => l.y - (u.y + u.h);
    const hGap = (l, r) => r.x - (l.x + l.w);
    if (vGap(a, b) >= 24 || vGap(b, a) >= 24) {
      const upper = vGap(a, b) >= 24 ? a : b;
      const lower = upper === a ? b : a;
      const lo = Math.max(upper.x, lower.x) + 10;
      const hi = Math.min(upper.x + upper.w, lower.x + lower.w) - 10;
      let points;
      if (lo <= hi) {
        const x = clampTo((lo + hi) / 2 + offset, lo, hi);
        points = [pt(x, upper.y + upper.h), pt(x, lower.y)];
      } else {
        const xu = clampTo(upper.x + upper.w / 2 + offset, upper.x + 8, upper.x + upper.w - 8);
        const xl = clampTo(lower.x + lower.w / 2 + offset, lower.x + 8, lower.x + lower.w - 8);
        const ym = (upper.y + upper.h + lower.y) / 2 + offset / 2;
        points = [pt(xu, upper.y + upper.h), pt(xu, ym), pt(xl, ym), pt(xl, lower.y)];
      }
      return simplify(upper === a ? points : points.reverse());
    }
    if (hGap(a, b) >= 24 || hGap(b, a) >= 24) {
      const l = hGap(a, b) >= 24 ? a : b;
      const r = l === a ? b : a;
      const lo = Math.max(l.y, r.y) + 10;
      const hi = Math.min(l.y + l.h, r.y + r.h) - 10;
      let points;
      if (lo <= hi) {
        const y = clampTo((lo + hi) / 2 + offset, lo, hi);
        points = [pt(l.x + l.w, y), pt(r.x, y)];
      } else {
        const yl = clampTo(l.y + l.h / 2 + offset, l.y + 8, l.y + l.h - 8);
        const yr = clampTo(r.y + r.h / 2 + offset, r.y + 8, r.y + r.h - 8);
        const xm = (l.x + l.w + r.x) / 2 + offset / 2;
        points = [pt(l.x + l.w, yl), pt(xm, yl), pt(xm, yr), pt(r.x, yr)];
      }
      return simplify(l === a ? points : points.reverse());
    }
    // Karten liegen zu dicht oder übereinander: Bogen über beide Karten (rechtwinklig).
    const yTop = Math.min(a.y, b.y) - 24 - Math.abs(offset);
    const xa = clampTo(a.x + a.w / 2 + offset, a.x + 8, a.x + a.w - 8);
    const xb = clampTo(b.x + b.w / 2 + offset, b.x + 8, b.x + b.w - 8);
    return simplify([pt(xa, a.y), pt(xa, yTop), pt(xb, yTop), pt(xb, b.y)]);
  }

  /**
   * Längster Abschnitt eines Linienzugs.
   *
   * @param {Array<{x:number,y:number}>} points - Eckpunkte.
   * @returns {{a:Object, b:Object, length:number, horizontal:boolean}} Abschnitt.
   */
  function longestSegment(points) {
    let best = null;
    for (let i = 0; i + 1 < points.length; i++) {
      const a = points[i];
      const b = points[i + 1];
      const length = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      if (!best || length > best.length) {
        best = { a, b, length, horizontal: Math.abs(a.y - b.y) < 0.01 };
      }
    }
    return best;
  }

  /**
   * Rechtwinklige Anbindung einer Assoziationsklasse an die Mitte ihrer n:m-Linie.
   *
   * @param {Array<{x:number,y:number}>} points - Eckpunkte der n:m-Linie.
   * @param {{x:number,y:number,w:number,h:number}} c - Karte der Assoziationsklasse.
   * @returns {Array<{x:number,y:number}>} Eckpunkte von der Linie zur Karte.
   */
  function connectorRoute(points, c) {
    const seg = longestSegment(points);
    const m = pt((seg.a.x + seg.b.x) / 2, (seg.a.y + seg.b.y) / 2);
    const cxm = c.x + c.w / 2;
    const cym = c.y + c.h / 2;
    if (c.y >= m.y + 20) {
      const ym = (m.y + c.y) / 2;
      return simplify([m, pt(m.x, ym), pt(cxm, ym), pt(cxm, c.y)]);
    }
    if (c.y + c.h <= m.y - 20) {
      const ym = (m.y + c.y + c.h) / 2;
      return simplify([m, pt(m.x, ym), pt(cxm, ym), pt(cxm, c.y + c.h)]);
    }
    const sideX = m.x < c.x ? c.x : c.x + c.w;
    const xm = (m.x + sideX) / 2;
    return simplify([m, pt(xm, m.y), pt(xm, cym), pt(sideX, cym)]);
  }

  ns.uml = ns.uml || {};
  Object.assign(ns.uml, { layout, orthoRoute, loopRoute, connectorRoute, longestSegment, simplify, place1D });
})(window.SQLSIM = window.SQLSIM || {});
