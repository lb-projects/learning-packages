/**
 * @file algorithms.js
 * @description Breitensuche, Tiefensuche, Dijkstra und Bellman-Ford als reine Funktionen.
 *
 * Zweck:
 *   Jeder Algorithmus läuft einmal vollständig und liefert die Liste seiner Schritte.
 *   Jeder Schritt ist eine vollständige Momentaufnahme (Zustand aller Knoten und Kanten,
 *   Datenstrukturen, Erklärtext). Der Abspieler (player.js) zeigt nur den gewählten
 *   Schritt an; Vor und Zurück sind dadurch bloß ein Wechsel des Index.
 *
 * Gemeinsame Festlegungen:
 *   - Eingabe ist eine Momentaufnahme des Graphen (graph.snapshot()): Nachbarn sind
 *     alphabetisch sortiert und werden in dieser Reihenfolge abgearbeitet.
 *   - Bearbeitet wird nur der Teil des Graphen, der vom Startknoten aus erreichbar ist
 *     (gerichtet: in Pfeilrichtung). Die übrigen Knoten haben den Zustand "unreachable".
 *   - Mit Ziel endet der Algorithmus, sobald das Ziel besucht wird (Breitensuche: aus der
 *     Warteschlange genommen; Tiefensuche: DFS(Ziel) wird aufgerufen; Dijkstra: das Ziel
 *     wird aktueller Knoten). Der letzte Schritt zeigt dann den gefundenen Weg.
 *
 * Aufbau eines Schritts:
 *   { text, status: Map(Knoten-ID → 'unvisited'|'frontier'|'current'|'done'|'unreachable'),
 *     activeEdge: Kanten-ID|null (gerade geprüfte Kante),
 *     edges: Map(Kanten-ID → 'tree'|'checked'|'path'),
 *     labels: Map(Knoten-ID → Text unter dem Knoten, z. B. Distanz),
 *     data: algorithmusabhängige Datenstrukturen, final: boolean,
 *     tree: Kanten-IDs des Spannbaums (nur im letzten Schritt), path: Knoten-IDs|null }
 *
 * Abhängigkeiten:
 *   format-utils.js (Zahlen, Tripel)
 */
(function (ns) {
  'use strict';

  const fmt = () => ns.dom;

  /**
   * Hilfsfunktionen für eine Momentaufnahme.
   * @param {Object} snap - graph.snapshot().
   * @returns {Object} name(id), arrow(u, v), order (id → Position in der alphabetischen Reihenfolge).
   */
  function helpers(snap) {
    const names = new Map(snap.nodes.map((n) => [n.id, n.name]));
    const order = new Map(snap.nodes.map((n, i) => [n.id, i]));
    return {
      name: (id) => names.get(id),
      arrow: (u, v) => names.get(u) + (snap.directed ? '→' : '–') + names.get(v),
      order
    };
  }

  /**
   * Knoten, die vom Startknoten aus erreichbar sind.
   * @param {Object} snap - Momentaufnahme.
   * @param {number} start - Startknoten.
   * @returns {Set<number>} Erreichbare Knoten (einschließlich Start).
   */
  function reachable(snap, start) {
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length > 0) {
      const u = queue.shift();
      for (const a of snap.adj.get(u) || []) {
        if (!seen.has(a.to)) {
          seen.add(a.to);
          queue.push(a.to);
        }
      }
    }
    return seen;
  }

  /**
   * Weg vom Start zu einem Knoten über die Vorgänger.
   * @param {Map<number, number|null>} pred - Vorgänger.
   * @param {Map<number, number>} predEdge - Kante zum Vorgänger.
   * @param {number} target - Endknoten.
   * @returns {{nodes:number[], edges:number[]}} Knoten und Kanten in Wegrichtung.
   */
  function pathTo(pred, predEdge, target) {
    const nodes = [target];
    const edges = [];
    let v = target;
    const guard = pred.size + 1;
    for (let i = 0; i < guard && pred.get(v) !== null && pred.get(v) !== undefined; i++) {
      edges.push(predEdge.get(v));
      v = pred.get(v);
      nodes.push(v);
    }
    return { nodes: nodes.reverse(), edges: edges.reverse() };
  }

  /**
   * Gemeinsamer Rahmen: Zustände, Kantenmarkierungen und Aufzeichnung der Schritte.
   * @param {Object} snap - Momentaufnahme.
   * @param {number} start - Startknoten.
   * @returns {Object} Rahmen.
   */
  function recorder(snap, start) {
    const reach = reachable(snap, start);
    const status = new Map(snap.nodes.map((n) => [n.id, reach.has(n.id) ? 'unvisited' : 'unreachable']));
    const edgeState = new Map();
    const labels = new Map();
    const steps = [];
    let activeEdge = null;
    return {
      reach,
      status,
      edgeState,
      labels,
      steps,
      setActive(edgeId) {
        activeEdge = edgeId;
      },
      /**
       * Hält einen Schritt fest.
       * @param {string} text - Erklärtext.
       * @param {Object} data - Datenstrukturen (werden unverändert übernommen; Aufrufer liefert Kopien).
       * @param {Object} [extra] - final, tree, path.
       */
      push(text, data, extra) {
        steps.push(Object.assign({
          text,
          status: new Map(status),
          activeEdge,
          edges: new Map(edgeState),
          labels: new Map(labels),
          data,
          final: false,
          tree: null,
          path: null
        }, extra || {}));
      }
    };
  }

  /**
   * Text für Knoten, die nicht erreichbar sind.
   * @param {Object} snap - Momentaufnahme.
   * @param {Set<number>} reach - Erreichbare Knoten.
   * @returns {string} Satz oder "".
   */
  function unreachableNote(snap, reach) {
    const names = snap.nodes.filter((n) => !reach.has(n.id)).map((n) => n.name);
    if (names.length === 0) {
      return '';
    }
    return ' Vom Startknoten aus nicht erreichbar (wird nicht bearbeitet): ' + fmt().joinNames(names) + '.';
  }

  /**
   * Satz zum Ziel im ersten Schritt.
   */
  function targetNote(h, reach, target) {
    if (target === null) {
      return '';
    }
    return reach.has(target)
      ? ' Gesucht wird ein Weg zum Ziel ' + h.name(target) + '.'
      : ' Das Ziel ' + h.name(target) + ' ist vom Startknoten aus nicht erreichbar.';
  }

  /**
   * Markiert einen Weg im letzten Schritt.
   * @param {Map} edgeState - Kantenmarkierungen.
   * @param {number[]} edges - Kanten des Wegs.
   */
  function markPath(edgeState, edges) {
    for (const e of edges) {
      edgeState.set(e, 'path');
    }
  }

  // ---------------------------------------------------------------------------
  // Breitensuche
  // ---------------------------------------------------------------------------

  /**
   * Breitensuche.
   *
   * @param {Object} snap - Momentaufnahme des Graphen.
   * @param {number} start - Startknoten.
   * @param {number|null} target - Zielknoten oder null (ganzen Teilgraphen durchlaufen).
   * @returns {Array<Object>} Schritte; data = {queue, order, rows:[{id, name, state, dist, pred}]}.
   */
  function bfs(snap, start, target) {
    const h = helpers(snap);
    const r = recorder(snap, start);
    const dist = new Map();
    const pred = new Map();
    const predEdge = new Map();
    const queue = [];
    const order = [];
    const tree = [];

    const data = () => ({
      queue: queue.map(h.name),
      order: order.map(h.name),
      rows: snap.nodes.filter((n) => r.reach.has(n.id)).map((n) => ({
        id: n.id,
        name: n.name,
        state: r.status.get(n.id),
        dist: dist.has(n.id) ? dist.get(n.id) : Infinity,
        pred: pred.has(n.id) && pred.get(n.id) !== null ? h.name(pred.get(n.id)) : null
      }))
    });
    const label = (id) => r.labels.set(id, fmt().formatInt(dist.get(id)));

    dist.set(start, 0);
    pred.set(start, null);
    queue.push(start);
    r.status.set(start, 'frontier');
    label(start);
    r.push('Start: ' + h.name(start) + ' wird als entdeckt markiert (Abstand 0) und in die Warteschlange gelegt.' +
      targetNote(h, r.reach, target) + unreachableNote(snap, r.reach), data());

    let previous = null;
    let found = false;
    while (queue.length > 0) {
      const u = queue.shift();
      if (previous !== null) {
        r.status.set(previous, 'done');
      }
      r.status.set(u, 'current');
      r.setActive(null);
      order.push(u);
      const prefix = previous !== null ? 'Alle Nachbarn von ' + h.name(previous) + ' sind geprüft, ' + h.name(previous) + ' ist fertig. ' : '';
      if (u === target) {
        r.push(prefix + h.name(u) + ' wird vorne aus der Warteschlange genommen und besucht – das ist das Ziel.', data());
        found = true;
        previous = u;
        break;
      }
      r.push(prefix + h.name(u) + ' wird vorne aus der Warteschlange genommen und besucht.', data());
      for (const a of snap.adj.get(u)) {
        r.setActive(a.edgeId);
        const v = a.to;
        if (r.status.get(v) === 'unvisited') {
          dist.set(v, dist.get(u) + 1);
          pred.set(v, u);
          predEdge.set(v, a.edgeId);
          queue.push(v);
          tree.push(a.edgeId);
          r.status.set(v, 'frontier');
          r.edgeState.set(a.edgeId, 'tree');
          label(v);
          r.push('Kante ' + h.arrow(u, v) + ': ' + h.name(v) + ' ist noch nicht entdeckt → Abstand ' + dist.get(v) +
            ', Vorgänger ' + h.name(u) + '; ' + h.name(v) + ' kommt hinten in die Warteschlange.', data());
        } else {
          if (!r.edgeState.has(a.edgeId)) {
            r.edgeState.set(a.edgeId, 'checked');
          }
          r.push('Kante ' + h.arrow(u, v) + ': ' + h.name(v) + ' ist schon entdeckt → nichts zu tun.', data());
        }
      }
      previous = u;
    }
    r.setActive(null);
    if (previous !== null) {
      r.status.set(previous, 'done');
    }
    const orderText = ' Besuchsreihenfolge: ' + order.map(h.name).join(', ') + '.';
    if (found) {
      const p = pathTo(pred, predEdge, target);
      markPath(r.edgeState, p.edges);
      r.push('Ziel erreicht. Kürzester Weg (wenigste Kanten): ' + p.nodes.map(h.name).join(' → ') + ' (' +
        fmt().plural(p.edges.length, 'Kante', 'Kanten') + ').' + orderText, data(), { final: true, tree: tree.slice(), path: p.nodes });
    } else {
      const miss = target !== null ? ' Das Ziel ' + h.name(target) + ' wurde nicht erreicht.' : '';
      r.push('Die Warteschlange ist leer – die Breitensuche ist fertig.' + miss + orderText, data(), { final: true, tree: tree.slice() });
    }
    return r.steps;
  }

  // ---------------------------------------------------------------------------
  // Tiefensuche (rekursiv, Aufrufstapel sichtbar)
  // ---------------------------------------------------------------------------

  /**
   * Tiefensuche in der rekursiven Fassung.
   *
   * @param {Object} snap - Momentaufnahme des Graphen.
   * @param {number} start - Startknoten.
   * @param {number|null} target - Zielknoten oder null.
   * @returns {Array<Object>} Schritte; data = {stack, order, rows:[{id, name, state, number, finished, pred}]}.
   */
  function dfs(snap, start, target) {
    const h = helpers(snap);
    const r = recorder(snap, start);
    const pred = new Map();
    const predEdge = new Map();
    const number = new Map();
    const finished = new Map();
    const stack = [];
    const order = [];
    const tree = [];
    let finishCounter = 0;

    const data = () => ({
      stack: stack.map((f) => h.name(f.u)),
      order: order.map(h.name),
      rows: snap.nodes.filter((n) => r.reach.has(n.id)).map((n) => ({
        id: n.id,
        name: n.name,
        state: r.status.get(n.id),
        number: number.has(n.id) ? number.get(n.id) : null,
        finished: finished.has(n.id) ? finished.get(n.id) : null,
        pred: pred.has(n.id) && pred.get(n.id) !== null ? h.name(pred.get(n.id)) : null
      }))
    });

    /** Besucht einen Knoten (Aufruf DFS(v)). */
    function visit(v) {
      if (stack.length > 0) {
        r.status.set(stack[stack.length - 1].u, 'frontier');
      }
      order.push(v);
      number.set(v, order.length);
      r.labels.set(v, String(order.length));
      r.status.set(v, 'current');
      stack.push({ u: v, i: 0 });
    }

    pred.set(start, null);
    visit(start);
    r.push('DFS(' + h.name(start) + ') wird aufgerufen: ' + h.name(start) + ' ist besucht (Nr. 1).' +
      targetNote(h, r.reach, target) + unreachableNote(snap, r.reach), data());

    let found = start === target;
    while (stack.length > 0 && !found) {
      const frame = stack[stack.length - 1];
      const u = frame.u;
      const list = snap.adj.get(u);
      if (frame.i < list.length) {
        const a = list[frame.i++];
        const v = a.to;
        r.setActive(a.edgeId);
        if (r.status.get(v) === 'unvisited') {
          pred.set(v, u);
          predEdge.set(v, a.edgeId);
          tree.push(a.edgeId);
          r.edgeState.set(a.edgeId, 'tree');
          visit(v);
          const isTarget = v === target;
          r.push('Kante ' + h.arrow(u, v) + ': ' + h.name(v) + ' ist noch nicht besucht → DFS(' + h.name(v) +
            ') wird aufgerufen; ' + h.name(v) + ' ist besucht (Nr. ' + number.get(v) + ')' + (isTarget ? ' – das ist das Ziel.' : '.'), data());
          found = isTarget;
        } else {
          if (!r.edgeState.has(a.edgeId)) {
            r.edgeState.set(a.edgeId, 'checked');
          }
          r.push('Kante ' + h.arrow(u, v) + ': ' + h.name(v) + ' ist schon besucht → überspringen.', data());
        }
      } else {
        stack.pop();
        r.setActive(null);
        r.status.set(u, 'done');
        finished.set(u, ++finishCounter);
        let text = 'Alle Nachbarn von ' + h.name(u) + ' sind geprüft → DFS(' + h.name(u) + ') ist beendet';
        if (stack.length > 0) {
          const back = stack[stack.length - 1].u;
          r.status.set(back, 'current');
          text += ', zurück zu DFS(' + h.name(back) + ').';
        } else {
          text += '.';
        }
        r.push(text, data());
      }
    }
    r.setActive(null);
    const orderText = ' Besuchsreihenfolge: ' + order.map(h.name).join(', ') + '.';
    if (found) {
      const p = pathTo(pred, predEdge, target);
      markPath(r.edgeState, p.edges);
      r.push('Ziel erreicht. Gefundener Weg (entspricht dem Aufrufstapel): ' + p.nodes.map(h.name).join(' → ') + ' (' +
        fmt().plural(p.edges.length, 'Kante', 'Kanten') + '). Die Tiefensuche findet einen Weg, aber nicht unbedingt den kürzesten.' + orderText,
      data(), { final: true, tree: tree.slice(), path: p.nodes });
    } else {
      const miss = target !== null ? ' Das Ziel ' + h.name(target) + ' wurde nicht erreicht.' : '';
      r.push('Der Aufrufstapel ist leer – die Tiefensuche ist fertig.' + miss + orderText, data(), { final: true, tree: tree.slice() });
    }
    return r.steps;
  }

  // ---------------------------------------------------------------------------
  // Dijkstra
  // ---------------------------------------------------------------------------

  /**
   * Summe als Rechenweg, z. B. "3 + (−2) = 1".
   */
  function sumText(a, w) {
    const f = fmt();
    return f.formatInt(a) + ' + ' + (w < 0 ? '(' + f.formatInt(w) + ')' : f.formatInt(w)) + ' = ' + f.formatInt(a + w);
  }

  /**
   * Dijkstra-Algorithmus (Lehrbuchfassung: ein fertiger Knoten wird nie wieder geändert).
   *
   * Berechnungstabelle (data.rows): eine Zeile je aktuellem Knoten mit
   *   current: Tripel des aktuellen Knotens (null in der Startzeile),
   *   queue:   Tripel der Warteschlange, nach Distanz aufsteigend (bei Gleichstand alphabetisch),
   *   rand:    Tripel der bisher nicht erreichten Knoten (Distanz ∞),
   *   changed: Namen, deren Tripel sich in dieser Zeile geändert hat.
   * Tripel: {name, pred (Name|null), dist}.
   *
   * @param {Object} snap - Momentaufnahme des Graphen.
   * @param {number} start - Startknoten.
   * @param {number|null} target - Zielknoten oder null.
   * @returns {{steps:Array<Object>, result:{dist:Map, pred:Map, settled:number[], violations:Array, reach:Set}}}
   *   Schritte und Endergebnis (für den Vergleich mit Bellman-Ford).
   */
  function dijkstra(snap, start, target) {
    const h = helpers(snap);
    const r = recorder(snap, start);
    const dist = new Map();
    const pred = new Map();
    const predEdge = new Map();
    const queue = new Set();
    const settled = [];
    const settledSet = new Set();
    const violations = [];
    let rows = [];

    for (const id of r.reach) {
      dist.set(id, Infinity);
      pred.set(id, null);
    }
    const triple = (id) => Object.freeze({ name: h.name(id), pred: pred.get(id) === null ? null : h.name(pred.get(id)), dist: dist.get(id) });
    const sortedQueue = () => Array.from(queue).sort((a, b) => (dist.get(a) - dist.get(b)) || (h.order.get(a) - h.order.get(b)));
    const rand = () => snap.nodes.filter((n) => r.reach.has(n.id) && dist.get(n.id) === Infinity).map((n) => triple(n.id));
    /** Ersetzt die letzte Tabellenzeile (frühere Zeilen bleiben unverändert und werden geteilt). */
    const updateRow = (current, changed) => {
      const row = Object.freeze({ current, queue: sortedQueue().map(triple), rand: rand(), changed: Object.freeze(changed.slice()) });
      rows = rows.slice(0, -1).concat([row]);
    };
    const data = () => ({
      rows,
      dist: new Map(dist),
      settled: settled.map(h.name)
    });
    const label = (id) => r.labels.set(id, fmt().formatDistance(dist.get(id)));
    /** Kürzeste-Wege-Baum aus den aktuellen Vorgängern. */
    const syncTree = () => {
      for (const [e, s] of Array.from(r.edgeState)) {
        if (s === 'tree') {
          r.edgeState.delete(e);
        }
      }
      for (const e of predEdge.values()) {
        r.edgeState.set(e, 'tree');
      }
    };

    dist.set(start, 0);
    queue.add(start);
    r.status.set(start, 'frontier');
    for (const id of r.reach) {
      label(id);
    }
    rows = [null];
    updateRow(null, [h.name(start)]);
    r.push('Start: ' + h.name(start) + ' erhält die Distanz 0 und kommt in die Warteschlange. Alle anderen erreichbaren Knoten liegen im Rand (Distanz ∞).' +
      targetNote(h, r.reach, target) + unreachableNote(snap, r.reach), data());

    let previous = null;
    let found = false;
    while (queue.size > 0) {
      const u = sortedQueue()[0];
      queue.delete(u);
      settled.push(u);
      settledSet.add(u);
      if (previous !== null) {
        r.status.set(previous, 'done');
      }
      r.status.set(u, 'current');
      r.setActive(null);
      rows = rows.concat([null]);
      const changed = [];
      updateRow(triple(u), changed);
      const isTarget = u === target;
      r.push(h.name(u) + ' hat die kleinste Distanz in der Warteschlange (' + fmt().formatDistance(dist.get(u)) + ') → ' + h.name(u) +
        ' wird aktueller Knoten und ist damit fertig' + (isTarget ? ' – das ist das Ziel.' : '. Jetzt werden seine Kanten geprüft.'), data());
      if (isTarget) {
        found = true;
        previous = u;
        break;
      }
      for (const a of snap.adj.get(u)) {
        const v = a.to;
        r.setActive(a.edgeId);
        const nd = dist.get(u) + a.weight;
        const head = 'Kante ' + h.arrow(u, v) + ' (Gewicht ' + fmt().formatInt(a.weight) + '): ';
        let text;
        if (settledSet.has(v)) {
          text = head + h.name(v) + ' ist schon fertig und wird nicht mehr geändert.';
          if (nd < dist.get(v)) {
            violations.push({ from: u, to: v, weight: a.weight, edgeId: a.edgeId, via: nd, dist: dist.get(v) });
            text += ' Achtung: Über ' + h.name(u) + ' wäre ' + h.name(v) + ' mit ' + sumText(dist.get(u), a.weight) +
              ' kürzer erreichbar als mit ' + fmt().formatInt(dist.get(v)) + '. Wegen des negativen Gewichts ist das Ergebnis von Dijkstra hier falsch.';
          }
        } else if (dist.get(v) === Infinity) {
          dist.set(v, nd);
          pred.set(v, u);
          predEdge.set(v, a.edgeId);
          queue.add(v);
          r.status.set(v, 'frontier');
          changed.push(h.name(v));
          text = head + h.name(v) + ' wird erstmals erreicht: ' + sumText(dist.get(u), a.weight) + ' → ' +
            fmt().formatTriple(h.name(v), h.name(u), nd) + ' kommt aus dem Rand in die Warteschlange.';
        } else if (nd < dist.get(v)) {
          const old = dist.get(v);
          dist.set(v, nd);
          pred.set(v, u);
          predEdge.set(v, a.edgeId);
          if (!changed.includes(h.name(v))) {
            changed.push(h.name(v));
          }
          text = head + sumText(dist.get(u), a.weight) + ' ist kürzer als die bisherige Distanz ' + fmt().formatInt(old) +
            ' → ' + h.name(v) + ' erhält ' + fmt().formatTriple(h.name(v), h.name(u), nd) + '.';
        } else {
          text = head + sumText(dist.get(u), a.weight) + ' ist nicht kürzer als die bisherige Distanz ' + fmt().formatInt(dist.get(v)) + ' → keine Änderung.';
          if (!r.edgeState.has(a.edgeId)) {
            r.edgeState.set(a.edgeId, 'checked');
          }
        }
        label(v);
        syncTree();
        updateRow(triple(u), changed);
        r.push(text, data());
      }
      previous = u;
    }
    r.setActive(null);
    if (previous !== null) {
      r.status.set(previous, 'done');
    }
    syncTree();
    const tree = Array.from(predEdge.values());
    if (found) {
      const p = pathTo(pred, predEdge, target);
      markPath(r.edgeState, p.edges);
      r.push('Ziel erreicht. Kürzester Weg laut Dijkstra: ' + p.nodes.map(h.name).join(' → ') + ' mit der Länge ' +
        fmt().formatInt(dist.get(target)) + '.', data(), { final: true, tree, path: p.nodes });
    } else {
      const miss = target !== null ? ' Das Ziel ' + h.name(target) + ' wurde nicht erreicht.' : '';
      r.push('Die Warteschlange ist leer – Dijkstra ist fertig. Die markierten Kanten bilden den Baum der kürzesten Wege; ein Klick auf einen Knoten zeigt seinen Weg.' + miss,
        data(), { final: true, tree });
    }

    // Kanten, über die sich ein Ergebnis noch verkürzen ließe (nur zwischen fertigen Knoten).
    const finalViolations = [];
    for (const a of snap.arcs) {
      if (settledSet.has(a.from) && settledSet.has(a.to) && dist.get(a.from) + a.weight < dist.get(a.to)) {
        finalViolations.push({ from: a.from, to: a.to, weight: a.weight, edgeId: a.edgeId, via: dist.get(a.from) + a.weight, dist: dist.get(a.to) });
      }
    }
    return {
      steps: r.steps,
      result: { dist, pred, predEdge, settled, violations: finalViolations, reach: r.reach }
    };
  }

  /**
   * Weg zu einem Knoten im Ergebnis von Dijkstra (für den Klick auf einen Knoten).
   * @param {Object} result - dijkstra(...).result.
   * @param {number} id - Knoten.
   * @returns {{nodes:number[], edges:number[]}|null} Weg oder null, wenn der Knoten nicht fertig ist.
   */
  function dijkstraPath(result, id) {
    if (!result.settled.includes(id)) {
      return null;
    }
    return pathTo(result.pred, result.predEdge, id);
  }

  // ---------------------------------------------------------------------------
  // Bellman-Ford (zum Vergleich)
  // ---------------------------------------------------------------------------

  /**
   * Bellman-Ford: richtige kürzeste Distanzen auch bei negativen Gewichten; erkennt negative Zyklen.
   *
   * @param {Object} snap - Momentaufnahme.
   * @param {number} start - Startknoten.
   * @returns {{dist:Map<number, number>, pred:Map<number, number|null>, cycle:number[]|null,
   *            cycleEdges:number[], undefinedNodes:Set<number>, rounds:number}}
   *   Distanzen (−∞ für Knoten, deren Distanz wegen eines negativen Zyklus nicht definiert ist),
   *   Vorgänger, ein negativer Zyklus (Knoten in Laufrichtung) und seine Kanten.
   */
  function bellmanFord(snap, start) {
    const reach = reachable(snap, start);
    const dist = new Map();
    const pred = new Map();
    const predEdge = new Map();
    for (const id of reach) {
      dist.set(id, Infinity);
      pred.set(id, null);
    }
    dist.set(start, 0);
    const arcs = snap.arcs.filter((a) => reach.has(a.from));
    const n = reach.size;
    let rounds = 0;
    for (let i = 1; i < n; i++) {
      let changed = false;
      rounds = i;
      for (const a of arcs) {
        if (dist.get(a.from) !== Infinity && dist.get(a.from) + a.weight < dist.get(a.to)) {
          dist.set(a.to, dist.get(a.from) + a.weight);
          pred.set(a.to, a.from);
          predEdge.set(a.to, a.edgeId);
          changed = true;
        }
      }
      if (!changed) {
        break;
      }
    }
    // n-te Runde: lässt sich noch etwas verkürzen, gibt es einen negativen Zyklus.
    let x = null;
    for (const a of arcs) {
      if (dist.get(a.from) !== Infinity && dist.get(a.from) + a.weight < dist.get(a.to)) {
        pred.set(a.to, a.from);
        predEdge.set(a.to, a.edgeId);
        x = a.to;
        break;
      }
    }
    let cycle = null;
    const cycleEdges = [];
    const undefinedNodes = new Set();
    if (x !== null) {
      for (let i = 0; i < n; i++) {
        x = pred.get(x);
      }
      cycle = [x];
      cycleEdges.push(predEdge.get(x));
      for (let v = pred.get(x); v !== x && cycle.length <= n; v = pred.get(v)) {
        cycle.push(v);
        cycleEdges.push(predEdge.get(v));
      }
      cycle.reverse();
      cycleEdges.reverse();
      // Alles, was vom Zyklus aus erreichbar ist, hat keine definierte kürzeste Distanz.
      const queue = cycle.slice();
      for (const v of cycle) {
        undefinedNodes.add(v);
      }
      while (queue.length > 0) {
        const u = queue.shift();
        for (const a of snap.adj.get(u)) {
          if (!undefinedNodes.has(a.to)) {
            undefinedNodes.add(a.to);
            queue.push(a.to);
          }
        }
      }
      for (const v of undefinedNodes) {
        dist.set(v, -Infinity);
      }
    }
    return { dist, pred, cycle, cycleEdges, undefinedNodes, rounds, reach };
  }

  ns.algorithms = { reachable, bfs, dfs, dijkstra, dijkstraPath, bellmanFord };
})(window.HG = window.HG || {});
