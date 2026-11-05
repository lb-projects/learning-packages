/**
 * @file training.js
 * @description Logik der Seite „Training“ (ohne DOM): richtige Abfolge bei Breiten- und
 *              Tiefensuche, Bewertung eines Klicks, Lesen und Prüfen einer Zeile der
 *              Dijkstra-Tabelle.
 *
 * Breiten- und Tiefensuche (Lehrbuchmodell weiß/grau/schwarz):
 *   - Jeder Knoten wird zuerst „besucht“ (grau) und später „abgeschlossen“ (schwarz).
 *   - Breitensuche: Bearbeitet wird der zuerst besuchte, noch nicht abgeschlossene Knoten u.
 *     Seine unbesuchten Nachbarn werden alphabetisch besucht; danach wird u abgeschlossen.
 *   - Tiefensuche: Bearbeitet wird der zuletzt besuchte, noch nicht abgeschlossene Knoten u
 *     (oberster Eintrag des Aufrufstapels). Hat u einen unbesuchten Nachbarn, wird der
 *     alphabetisch erste besucht; sonst wird u abgeschlossen (Rücksprung).
 *   Damit entspricht die Reihenfolge den Seiten 3 und 4 (Nachbarn alphabetisch,
 *   nur der vom Startknoten aus erreichbare Teil, gerichtet nur in Pfeilrichtung).
 *
 * Dijkstra:
 *   Die Sollzeilen stammen aus algorithms.dijkstra (identisch mit Seite 5). Eine Zeile besteht
 *   aus drei Textfeldern: aktueller Knoten (ein Tripel), Warteschlange (Tripel, mit Komma
 *   getrennt), Rand (Namen oder Tripel). Schreibfehler werden als Syntaxhinweis gemeldet,
 *   Rechenfehler als Hinweis auf Ort und Art des Fehlers – ohne den richtigen Wert zu nennen.
 *
 * Abhängigkeiten:
 *   graph.js (keyOf, compareNames), format-utils.js (formatTriple)
 *
 * Sicherheitsaspekte:
 *   Eingaben werden nur gelesen und verglichen; Teile davon erscheinen in Hinweisen
 *   ausschließlich gekürzt und als Text (die Seite fügt sie über textContent ein).
 */
(function (ns) {
  'use strict';

  /** Höchstzahl der Hinweise je Prüfung (der Rest wird zusammengefasst). */
  const MAX_HINTS = 6;
  /** Höchstlänge eines Eingabeausschnitts in einem Hinweis. */
  const SNIPPET_MAX = 40;
  /** Betrag, ab dem eine eingegebene Distanz nicht mehr als Zahl gelesen wird. */
  const DIST_LIMIT = 1e9;

  // ---------------------------------------------------------------------------
  // Breiten- und Tiefensuche
  // ---------------------------------------------------------------------------

  /**
   * Zustand nach den ersten p Schritten einer Abfolge.
   *
   * @param {Object} snap - Momentaufnahme des Graphen.
   * @param {Array<{node:number, action:string}>} seq - Abfolge.
   * @param {number} p - Anzahl der ausgeführten Schritte.
   * @returns {{status:Map<number,string>, visited:number[], finished:number[]}}
   *   status: 'unvisited' | 'visited' | 'done'; Reihenfolgen der Besuche und Abschlüsse.
   */
  function replay(snap, seq, p) {
    const status = new Map(snap.nodes.map((n) => [n.id, 'unvisited']));
    const visited = [];
    const finished = [];
    for (let i = 0; i < p && i < seq.length; i++) {
      const s = seq[i];
      if (s.action === 'visit') {
        status.set(s.node, 'visited');
        visited.push(s.node);
      } else {
        status.set(s.node, 'done');
        finished.push(s.node);
      }
    }
    return { status, visited, finished };
  }

  /**
   * Knoten, der gerade bearbeitet wird (besucht, aber nicht abgeschlossen).
   * @param {string} kind - 'bfs' oder 'dfs'.
   * @param {{status:Map, visited:number[]}} state - Zustand.
   * @returns {number|null} Knoten oder null.
   */
  function activeNode(kind, state) {
    const open = state.visited.filter((id) => state.status.get(id) === 'visited');
    if (open.length === 0) {
      return null;
    }
    return kind === 'bfs' ? open[0] : open[open.length - 1];
  }

  /** @returns {number[]} Unbesuchte Nachbarn (alphabetisch). */
  function unvisitedNeighbors(snap, state, id) {
    return (snap.adj.get(id) || []).map((a) => a.to).filter((v) => state.status.get(v) === 'unvisited');
  }

  /**
   * Richtige Abfolge der Klicks.
   *
   * @param {Object} snap - Momentaufnahme des Graphen.
   * @param {number} start - Startknoten.
   * @param {string} kind - 'bfs' oder 'dfs'.
   * @returns {Array<{node:number, action:('visit'|'finish')}>} Abfolge.
   */
  function sequence(snap, start, kind) {
    const seq = [{ node: start, action: 'visit' }];
    const state = { status: new Map(snap.nodes.map((n) => [n.id, 'unvisited'])), visited: [start] };
    state.status.set(start, 'visited');
    const guard = snap.nodes.length * 2 + 1;
    while (seq.length <= guard) {
      const u = activeNode(kind, state);
      if (u === null) {
        break;
      }
      const next = unvisitedNeighbors(snap, state, u);
      if (next.length > 0) {
        seq.push({ node: next[0], action: 'visit' });
        state.status.set(next[0], 'visited');
        state.visited.push(next[0]);
      } else {
        seq.push({ node: u, action: 'finish' });
        state.status.set(u, 'done');
      }
    }
    return seq;
  }

  /**
   * Bewertet einen Klick auf einen Knoten.
   *
   * @param {Object} snap - Momentaufnahme des Graphen.
   * @param {string} kind - 'bfs' oder 'dfs'.
   * @param {Array<Object>} seq - Richtige Abfolge.
   * @param {number} p - Bisher richtig ausgeführte Schritte.
   * @param {number} nodeId - Angeklickter Knoten.
   * @returns {{ok:boolean, action:string, done?:boolean, reason?:string}}
   *   ok: Klick war richtig; action: 'visit' | 'finish' | 'none'; done: Ablauf schon fertig;
   *   reason: Begründung bei einem falschen Klick (ohne die Lösung zu verraten).
   */
  function judgeClick(snap, kind, seq, p, nodeId) {
    const name = (id) => (snap.nodes.find((n) => n.id === id) || { name: '?' }).name;
    const state = replay(snap, seq, p);
    const st = state.status.get(nodeId);
    const action = st === 'unvisited' ? 'visit' : st === 'visited' ? 'finish' : 'none';
    if (p >= seq.length) {
      return { ok: false, action, done: true };
    }
    const expected = seq[p];
    if (expected.node === nodeId && expected.action === action) {
      return { ok: true, action };
    }
    const x = name(nodeId);
    const fail = (reason) => ({ ok: false, action, reason });
    if (p === 0) {
      return fail('Die Suche beginnt beim Startknoten ' + name(seq[0].node) + '.');
    }
    if (st === 'done') {
      return fail(x + ' ist schon abgeschlossen.');
    }
    const reach = new Set(seq.map((s) => s.node));
    if (!reach.has(nodeId)) {
      return fail(x + ' ist vom Startknoten aus nicht erreichbar' + (snap.directed ? ' (gerichteter Graph: nur in Pfeilrichtung).' : '.'));
    }
    const u = activeNode(kind, state);
    const isNeighborOfActive = (snap.adj.get(u) || []).some((a) => a.to === nodeId);
    const activeText = kind === 'bfs'
      ? 'des Knotens, der gerade bearbeitet wird (der zuerst besuchte, noch nicht abgeschlossene Knoten)'
      : 'des Knotens, an dem die Tiefensuche gerade steht (der zuletzt besuchte, noch nicht abgeschlossene Knoten)';
    if (action === 'visit') {
      if (expected.action === 'finish') {
        return fail(kind === 'bfs'
          ? 'Der Knoten, der gerade bearbeitet wird, hat keine unbesuchten Nachbarn mehr – er wird jetzt abgeschlossen.'
          : 'Der Knoten, an dem die Tiefensuche gerade steht, hat keine unbesuchten Nachbarn mehr – er wird jetzt abgeschlossen (Rücksprung).');
      }
      if (isNeighborOfActive) {
        return fail('Die Nachbarn werden alphabetisch besucht.');
      }
      return fail(x + ' ist kein Nachbar ' + activeText + (snap.directed ? ' (gerichteter Graph: nur in Pfeilrichtung).' : '.'));
    }
    // Abschließen eines besuchten Knotens, der nicht an der Reihe ist.
    if (unvisitedNeighbors(snap, state, nodeId).length > 0) {
      return fail(x + ' hat noch unbesuchte Nachbarn.');
    }
    return fail(kind === 'bfs'
      ? 'Abgeschlossen wird in der Reihenfolge, in der die Knoten besucht wurden.'
      : 'Abgeschlossen wird zuerst der zuletzt besuchte, noch nicht abgeschlossene Knoten.');
  }

  // ---------------------------------------------------------------------------
  // Dijkstra: Sollzeilen
  // ---------------------------------------------------------------------------

  /**
   * Sollzeilen der Tabelle und der passende Schritt von Seite 5 je Zeile.
   *
   * @param {Object} snap - Momentaufnahme.
   * @param {number} start - Startknoten.
   * @returns {{rows:Array<Object>, steps:Array<Object>, stepOfRow:number[], reach:Set<number>}}
   *   rows wie algorithms.dijkstra; stepOfRow[i] = letzter Schritt, der Zeile i enthält.
   */
  function dijkstraPlan(snap, start) {
    const out = ns.algorithms.dijkstra(snap, start, null);
    const steps = out.steps;
    const rows = steps[steps.length - 1].data.rows;
    const stepOfRow = rows.map(() => 0);
    steps.forEach((s, j) => {
      stepOfRow[s.data.rows.length - 1] = j;
    });
    return { rows, steps, stepOfRow, reach: out.result.reach };
  }

  // ---------------------------------------------------------------------------
  // Dijkstra: Eingabe lesen
  // ---------------------------------------------------------------------------

  /** Zeichen, die als „kein Vorgänger“ gelten. */
  const DASHES = new Set(['-', '–', '—', '−']);
  /** Schreibweisen für ∞. */
  const INFINITY_WORDS = new Set(['∞', 'inf', 'infinity', 'unendlich', 'oo']);

  /**
   * Zerlegt eine Eingabe in Zeichen ( ) , ; und Wörter.
   * @param {string} text - Eingabe.
   * @returns {Array<{t:string, v:string}>} Teile; t = '(' | ')' | ',' | ';' | 'w'.
   */
  function tokenize(text) {
    const tokens = [];
    const re = /\s*([(),;]|[^\s(),;]+)/gy;
    let m;
    while ((m = re.exec(text)) !== null && m[0] !== '') {
      const v = m[1];
      tokens.push(v === '(' || v === ')' || v === ',' || v === ';' ? { t: v, v } : { t: 'w', v });
    }
    return tokens;
  }

  /** Kürzt einen Ausschnitt für Hinweise. */
  function snippet(text) {
    const s = String(text).replace(/\s+/g, ' ').trim();
    return s.length > SNIPPET_MAX ? s.slice(0, SNIPPET_MAX - 1) + '…' : s;
  }

  /**
   * Liest eine Distanz.
   * @param {string} word - Text.
   * @returns {number|null} Zahl, Infinity oder null (ungültig).
   */
  function parseDistance(word) {
    const w = word.toLocaleLowerCase('de');
    if (INFINITY_WORDS.has(w)) {
      return Infinity;
    }
    const m = /^([-−–]?)(\d{1,9})$/.exec(w);
    if (!m) {
      return null;
    }
    const value = Number(m[2]) * (m[1] ? -1 : 1);
    return Math.abs(value) < DIST_LIMIT ? (value === 0 ? 0 : value) : null;
  }

  /**
   * Liest die Einträge eines Feldes.
   *
   * @param {string} text - Eingabe.
   * @param {function(string): (string|null)} lookup - Name → kanonischer Name oder null.
   * @param {{names:boolean}} options - names: auch bloße Knotennamen erlaubt (Rand).
   * @returns {{items:Array<{name:string, pred:(string|null), dist:number, bare:boolean}>, errors:string[]}}
   */
  function parseList(text, lookup, options) {
    const tokens = tokenize(String(text || ''));
    const items = [];
    const errors = [];
    if (tokens.length === 0 || (tokens.length === 1 && tokens[0].t === 'w' && DASHES.has(tokens[0].v))) {
      return { items, errors };
    }
    if (tokens.some((t) => t.t === ';')) {
      errors.push('Bitte Kommas statt Semikolons verwenden.');
      return { items, errors };
    }
    const unknown = (word) => 'Den Knoten „' + snippet(word) + '“ gibt es im Graphen nicht.';
    let i = 0;
    let last = null;
    while (i < tokens.length) {
      const tok = tokens[i];
      if (tok.t === ',') {
        errors.push(last === null ? 'Am Anfang steht ein Komma zu viel.' : 'Nach „' + snippet(last) + '“ steht ein Komma zu viel.');
        return { items, errors };
      }
      if (tok.t === ')') {
        errors.push('Vor „)“ fehlt die öffnende Klammer „(“.');
        return { items, errors };
      }
      if (tok.t === 'w') {
        if (!options.names) {
          errors.push('„' + snippet(tok.v) + '“ steht nicht in Klammern. Tripel werden als (Knoten, Vorgänger, Distanz) geschrieben.');
          return { items, errors };
        }
        const name = lookup(tok.v);
        if (name === null) {
          errors.push(unknown(tok.v));
          return { items, errors };
        }
        items.push({ name, pred: null, dist: Infinity, bare: true });
        last = tok.v;
        i++;
      } else {
        // Tripel: ( Teil , Teil , Teil )
        const parts = [[]];
        let j = i + 1;
        let closed = false;
        while (j < tokens.length) {
          const t = tokens[j];
          if (t.t === ')') {
            closed = true;
            break;
          }
          if (t.t === '(') {
            break;
          }
          if (t.t === ',') {
            parts.push([]);
          } else {
            parts[parts.length - 1].push(t.v);
          }
          j++;
        }
        const shown = '(' + parts.map((p) => p.join(' ')).join(', ') + (closed ? ')' : '');
        if (!closed) {
          errors.push('Beim Tripel „' + snippet(shown) + '“ fehlt die schließende Klammer „)“.');
          return { items, errors };
        }
        if (parts.some((p) => p.length > 1)) {
          errors.push('Im Tripel „' + snippet(shown) + '“ fehlt ein Komma zwischen den Angaben.');
          return { items, errors };
        }
        if (parts.length !== 3) {
          errors.push('Ein Tripel besteht aus drei Angaben (Knoten, Vorgänger, Distanz); „' + snippet(shown) + '“ hat ' + parts.length + '.');
          return { items, errors };
        }
        const [nameWord, predWord, distWord] = parts.map((p) => (p.length === 0 ? '' : p[0]));
        const name = nameWord === '' ? null : lookup(nameWord);
        if (nameWord === '') {
          errors.push('Im Tripel „' + snippet(shown) + '“ fehlt der Knoten.');
          return { items, errors };
        }
        if (name === null) {
          errors.push(unknown(nameWord));
          return { items, errors };
        }
        let pred = null;
        if (predWord !== '' && !DASHES.has(predWord)) {
          pred = lookup(predWord);
          if (pred === null) {
            errors.push(unknown(predWord));
            return { items, errors };
          }
        }
        const dist = distWord === '' ? null : parseDistance(distWord);
        if (dist === null) {
          errors.push(distWord === ''
            ? 'Im Tripel „' + snippet(shown) + '“ fehlt die Distanz.'
            : '„' + snippet(distWord) + '“ ist keine gültige Distanz (ganze Zahl oder ∞).');
          return { items, errors };
        }
        items.push({ name, pred, dist, bare: false });
        last = shown;
        i = j + 1;
      }
      // Nach einem Eintrag folgt ein Komma oder das Ende.
      if (i < tokens.length) {
        const sep = tokens[i];
        if (sep.t !== ',') {
          errors.push(sep.t === '('
            ? 'Zwischen „' + snippet(last) + '“ und dem nächsten Tripel fehlt ein Komma.'
            : 'Nach „' + snippet(last) + '“ fehlt ein Komma.');
          return { items, errors };
        }
        if (i + 1 >= tokens.length) {
          errors.push('Nach dem letzten Komma fehlt ein Eintrag.');
          return { items, errors };
        }
        i++;
      }
    }
    return { items, errors };
  }

  /**
   * Liest eine Tabellenzeile.
   *
   * @param {{current:string, queue:string, rand:string}} fields - Eingaben.
   * @param {Object} snap - Momentaufnahme.
   * @param {boolean} isStartRow - Zeile 0 (ohne aktuellen Knoten).
   * @returns {{ok:boolean, errors:string[], current:(Object|null), queue:Array, rand:Array}} Ergebnis.
   */
  function parseRow(fields, snap, isStartRow) {
    const byKey = new Map(snap.nodes.map((n) => [ns.graph.keyOf(n.name), n.name]));
    const lookup = (word) => byKey.get(ns.graph.keyOf(word)) || null;
    const errors = [];
    let current = null;
    if (!isStartRow) {
      const c = parseList(fields.current, lookup, { names: true });
      errors.push(...c.errors.map((e) => 'Aktueller Knoten: ' + e));
      if (c.errors.length === 0) {
        if (c.items.length === 0) {
          errors.push('Aktueller Knoten: Tragen Sie den aktuellen Knoten als Tripel (Knoten, Vorgänger, Distanz) ein.');
        } else if (c.items.length > 1) {
          errors.push('Aktueller Knoten: Hier steht genau ein Tripel.');
        } else if (c.items[0].bare) {
          errors.push('Aktueller Knoten: Bitte als Tripel (Knoten, Vorgänger, Distanz) eintragen, nicht nur den Namen.');
        } else {
          current = c.items[0];
        }
      }
    }
    const q = parseList(fields.queue, lookup, { names: false });
    errors.push(...q.errors.map((e) => 'Warteschlange: ' + e));
    const r = parseList(fields.rand, lookup, { names: true });
    errors.push(...r.errors.map((e) => 'Rand: ' + e));
    const dup = (items, label) => {
      const seen = new Set();
      for (const it of items) {
        if (seen.has(it.name)) {
          errors.push(label + it.name + ' steht mehrfach darin.');
          return;
        }
        seen.add(it.name);
      }
    };
    if (q.errors.length === 0) {
      dup(q.items, 'Warteschlange: ');
    }
    if (r.errors.length === 0) {
      dup(r.items, 'Rand: ');
    }
    return { ok: errors.length === 0, errors, current, queue: q.items, rand: r.items };
  }

  // ---------------------------------------------------------------------------
  // Dijkstra: Zeile prüfen
  // ---------------------------------------------------------------------------

  const sameTriple = (a, b) => a.pred === b.pred && a.dist === b.dist;
  const isRandTriple = (t) => t.pred === null && t.dist === Infinity;

  /**
   * Prüft eine gelesene Zeile gegen die Sollzeile.
   *
   * @param {Object} parsed - parseRow(...) mit ok = true.
   * @param {Object} plan - dijkstraPlan(...).
   * @param {number} i - Zeilennummer (0 = Start).
   * @param {Object} snap - Momentaufnahme.
   * @returns {{ok:boolean, hints:string[], kind:(string|null)}} kind: 'current' bei falsch gewähltem Knoten.
   */
  function checkRow(parsed, plan, i, snap) {
    const rows = plan.rows;
    const exp = rows[i];
    const prev = i > 0 ? rows[i - 1] : null;
    const nameOf = new Map(snap.nodes.map((n) => [n.id, n.name]));
    const reachNames = new Set(Array.from(plan.reach).map((id) => nameOf.get(id)));
    const hints = [];
    const finish = (kind) => {
      const list = hints.length > MAX_HINTS
        ? hints.slice(0, MAX_HINTS).concat(['… und ' + (hints.length - MAX_HINTS) + ' weitere Hinweise.'])
        : hints;
      return { ok: hints.length === 0, hints: list, kind: hints.length === 0 ? null : kind };
    };
    const arc = (from, to) => {
      const fromId = snap.nodes.find((n) => n.name === from).id;
      const toId = snap.nodes.find((n) => n.name === to).id;
      return (snap.adj.get(fromId) || []).some((a) => a.to === toId);
    };
    const sep = snap.directed ? '→' : '–';

    // Bereits fertige Knoten (aktuelle Knoten der früheren Zeilen).
    const settled = new Set();
    for (let k = 1; k < i; k++) {
      settled.add(rows[k].current.name);
    }

    // 1. Aktueller Knoten
    let cur = null;
    if (i > 0) {
      const e = exp.current;
      const c = parsed.current;
      if (c.name !== e.name) {
        const prevQueue = new Map(prev.queue.map((t) => [t.name, t]));
        let reason;
        if (settled.has(c.name)) {
          reason = c.name + ' ist schon fertig (war bereits aktueller Knoten).';
        } else if (!prevQueue.has(c.name)) {
          reason = c.name + ' ist noch nicht erreicht (steht im Rand) und kann nicht aktueller Knoten werden.';
        } else if (prevQueue.get(c.name).dist > prevQueue.get(e.name).dist) {
          reason = c.name + ' hat nicht die kleinste Distanz in der Warteschlange.';
        } else {
          reason = 'Bei gleicher Distanz entscheidet das Alphabet.';
        }
        hints.push('Falscher aktueller Knoten: ' + reason);
        return finish('current');
      }
      const fromQueue = prev.queue.find((t) => t.name === e.name);
      if (!sameTriple(c, fromQueue)) {
        hints.push('Das Tripel des aktuellen Knotens ' + e.name + ' wird unverändert aus der Warteschlange übernommen.');
      }
      cur = e.name;
      settled.add(cur);
    }

    // 2. Jeder Knoten: Warteschlange, Rand oder fertig
    const userQueue = new Map(parsed.queue.map((t) => [t.name, t]));
    const userRand = new Map(parsed.rand.map((t) => [t.name, t]));
    const expQueue = new Map(exp.queue.map((t) => [t.name, t]));
    const expRand = new Set(exp.rand.map((t) => t.name));
    const prevQueue = prev ? new Map(prev.queue.map((t) => [t.name, t])) : new Map();
    const changed = new Set(exp.changed || []);
    const start = i === 0 ? exp.queue[0].name : null;

    for (const node of snap.nodes) {
      const x = node.name;
      const inQ = userQueue.get(x);
      const inR = userRand.get(x);
      if (inQ && inR) {
        hints.push(x + ' steht sowohl in der Warteschlange als auch im Rand.');
        continue;
      }
      if (settled.has(x)) {
        if (inQ || inR) {
          hints.push(x === cur
            ? x + ' ist jetzt aktueller Knoten und damit fertig – ' + x + ' steht nicht mehr in ' + (inQ ? 'der Warteschlange.' : 'dem Rand.')
            : x + ' ist schon fertig und steht nicht mehr in ' + (inQ ? 'der Warteschlange.' : 'dem Rand.'));
        }
        continue;
      }
      if (!reachNames.has(x)) {
        if (inQ) {
          hints.push(x + ' ist vom Startknoten aus nicht erreichbar und gehört nicht in die Warteschlange.');
        } else if (inR && !inR.bare && !isRandTriple(inR)) {
          hints.push('Im Rand steht ' + x + ' als Tripel ohne Vorgänger mit der Distanz ∞.');
        }
        continue;
      }
      if (i === 0) {
        if (x === start) {
          if (!inQ) {
            hints.push(inR ? 'Der Startknoten ' + x + ' kommt in die Warteschlange, nicht in den Rand.' : 'Der Startknoten ' + x + ' fehlt in der Warteschlange.');
          } else if (!sameTriple(inQ, expQueue.get(x))) {
            hints.push('Das Tripel des Startknotens ' + x + ' stimmt nicht: Er hat keinen Vorgänger, und seine Distanz zu sich selbst ist bekannt.');
          }
        } else if (inQ) {
          hints.push('Zu Beginn steht nur der Startknoten in der Warteschlange – ' + x + ' ist noch nicht erreicht.');
        } else if (!inR) {
          hints.push(x + ' fehlt im Rand.');
        } else if (!inR.bare && !isRandTriple(inR)) {
          hints.push('Im Rand steht ' + x + ' als Tripel ohne Vorgänger mit der Distanz ∞.');
        }
        continue;
      }
      const edge = cur + sep + x;
      if (expQueue.has(x)) {
        const want = expQueue.get(x);
        const firstReached = !prevQueue.has(x);
        if (!inQ) {
          if (firstReached) {
            hints.push(x + ' wird über die Kante ' + edge + ' erstmals erreicht und gehört in die Warteschlange (Relaxation übersehen).');
          } else {
            hints.push(inR ? x + ' war schon erreicht und steht in der Warteschlange, nicht im Rand.' : x + ' fehlt in der Warteschlange (ein Knoten bleibt dort, bis er aktueller Knoten wird).');
          }
          continue;
        }
        if (sameTriple(inQ, want)) {
          continue;
        }
        if (changed.has(x)) {
          const before = prevQueue.get(x);
          if (before && sameTriple(inQ, before)) {
            hints.push('Für ' + x + ' wurde die Kante ' + edge + ' nicht berücksichtigt (Relaxation übersehen).');
          } else if (inQ.dist !== want.dist) {
            hints.push('Die Distanz von ' + x + ' stimmt nicht.');
          } else {
            hints.push('Der Vorgänger von ' + x + ' stimmt nicht.');
          }
        } else if (!arc(cur, x)) {
          hints.push(x + ' ist kein Nachbar von ' + cur + (snap.directed ? ' (in Pfeilrichtung)' : '') + ' – das Tripel von ' + x + ' bleibt in dieser Zeile unverändert.');
        } else if (inQ.dist === want.dist) {
          hints.push('Bei gleicher Distanz bleibt der bisherige Vorgänger von ' + x + ' erhalten.');
        } else {
          hints.push('Über ' + cur + ' ist ' + x + ' nicht kürzer erreichbar – das Tripel von ' + x + ' bleibt unverändert.');
        }
        continue;
      }
      if (expRand.has(x)) {
        if (inQ) {
          hints.push(x + ' ist noch nicht erreicht und gehört in den Rand.');
        } else if (!inR) {
          hints.push(x + ' fehlt im Rand.');
        } else if (!inR.bare && !isRandTriple(inR)) {
          hints.push('Im Rand steht ' + x + ' als Tripel ohne Vorgänger mit der Distanz ∞.');
        }
      }
    }

    // 3. Reihenfolge der Warteschlange (nur, wenn ihr Inhalt stimmt)
    if (hints.length === 0) {
      const names = parsed.queue.map((t) => t.name);
      const wanted = exp.queue.map((t) => t.name);
      if (names.join('\u0000') !== wanted.join('\u0000')) {
        const sortedByDist = parsed.queue.every((t, k) => k === 0 || parsed.queue[k - 1].dist <= t.dist);
        hints.push(sortedByDist
          ? 'Bei gleicher Distanz werden die Knoten in der Warteschlange alphabetisch sortiert.'
          : 'Die Warteschlange ist nicht nach Distanz sortiert (kleinste Distanz zuerst).');
      }
    }
    return finish('calc');
  }

  ns.training = { sequence, replay, judgeClick, dijkstraPlan, parseList, parseRow, checkRow, parseDistance };
})(window.HG = window.HG || {});
