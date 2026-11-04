/**
 * @file graph.js
 * @description Zentraler, seitenübergreifender Zustand des Graphen.
 *
 * Zweck:
 *   Alle Seiten arbeiten auf demselben Graphen. Dieses Modul
 *   - speichert Knoten (Name, Position in der Zeichnung) und Kanten (von, nach, Gewicht),
 *   - legt fest, ob der Graph gerichtet oder ungerichtet ist,
 *   - prüft alle Eingaben (Namen, Gewichte, Grenzwerte, doppelte Kanten, Schleifen),
 *   - liefert abgeleitete Darstellungen (sortierte Knoten, Nachbarn, Adjazenzmatrix) und
 *   - benachrichtigt die Seiten bei jeder Änderung (Beobachter-Muster).
 *
 * Festlegungen:
 *   - Knoten erhalten eine stabile, fortlaufende ID; Kanten ebenso.
 *   - Namen sind eindeutig; beim Vergleich zählt Groß-/Kleinschreibung nicht.
 *   - Alle Listen (Matrix, Adjazenzlisten, Nachbarn in den Algorithmen) sind
 *     alphabetisch nach Namen sortiert (Zahlen in Namen natürlich: A2 vor A10).
 *   - Ungerichtet: eine Kante A–B gilt in beide Richtungen; es gibt keine zweite Kante B–A.
 *   - Gerichtet: A→B und B→A sind zwei verschiedene Kanten.
 *   - Gewichte sind ganze Zahlen von −999 bis 999 (auch 0 und negative Werte).
 *
 * Ereignisse (onChange): { type: 'load' | 'edit' | 'move' | 'direction' }
 *   - load:      Graph vollständig ersetzt (Datei, Beispiel, gespeicherter Stand, Löschen)
 *   - edit:      Knoten oder Kante hinzugefügt, geändert oder entfernt
 *   - direction: gerichtet/ungerichtet umgeschaltet
 *   - move:      nur Positionen geändert (Ziehen, neu anordnen)
 *
 * Abhängigkeiten:
 *   layout.js (Positionen neuer Knoten)
 *
 * Sicherheitsaspekte:
 *   - Namen werden gegen eine Zeichen-Whitelist geprüft und in der Länge begrenzt.
 *   - Namen werden nur als Map-Schlüssel verwendet, nie als Eigenschaftsnamen
 *     (kein Prototype Pollution, z. B. bei einem Knoten namens "__proto__").
 *   - Knoten und Kanten, die nach außen gegeben werden, sind eingefroren.
 */
(function (ns) {
  'use strict';

  /** Grenzwerte des Graphen. */
  const LIMITS = Object.freeze({
    maxNodes: 26,
    maxEdges: 150,
    maxWeight: 999,
    maxNameLength: 12
  });

  /** Erlaubte Zeichen in Knotennamen: Buchstaben (inkl. Umlaute), Ziffern, Unterstrich, Bindestrich. */
  const NAME_PATTERN = /^[\p{L}\p{N}_-]+$/u;

  /** Strenges Format ganzer Zahlen: optionales Vorzeichen (auch U+2212), nur Ziffern. */
  const INT_PATTERN = /^[+\-−]?\d+$/;

  /** Zeichenfläche der Zeichnung (Koordinaten der Knoten). */
  const AREA = Object.freeze({ width: 800, height: 520, margin: 40 });

  let directed = false;
  /** @type {Map<number, {id:number, name:string, x:number, y:number}>} */
  const nodes = new Map();
  /** @type {Map<number, {id:number, from:number, to:number, weight:number}>} */
  const edges = new Map();
  let nextNodeId = 1;
  let nextEdgeId = 1;
  const listeners = [];

  // ---------------------------------------------------------------------------
  // Eingabeprüfung
  // ---------------------------------------------------------------------------

  /**
   * Schlüssel eines Namens für Vergleiche (ohne Groß-/Kleinschreibung).
   * @param {string} name - Name.
   * @returns {string} Schlüssel.
   */
  function keyOf(name) {
    return String(name).toLocaleLowerCase('de');
  }

  /** Natürliche, alphabetische Sortierung von Namen. */
  const collator = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });

  /**
   * Vergleicht zwei Namen alphabetisch (bei gleicher Basis entscheidet die Schreibweise).
   * @param {string} a - Name.
   * @param {string} b - Name.
   * @returns {number} Vergleichswert.
   */
  function compareNames(a, b) {
    return collator.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0);
  }

  /**
   * Prüft einen Knotennamen.
   *
   * @param {*} input - Eingabe.
   * @returns {{ok: true, value: string}|{ok: false, error: string}} Ergebnis.
   */
  function validateName(input) {
    const value = String(input === null || input === undefined ? '' : input).normalize('NFC').trim();
    if (value === '') {
      return { ok: false, error: 'Der Knotenname fehlt.' };
    }
    if (value.length > LIMITS.maxNameLength) {
      return { ok: false, error: 'Der Knotenname ist zu lang (höchstens ' + LIMITS.maxNameLength + ' Zeichen).' };
    }
    if (!NAME_PATTERN.test(value)) {
      return { ok: false, error: 'Der Knotenname darf nur Buchstaben, Ziffern, _ und - enthalten (keine Leerzeichen).' };
    }
    return { ok: true, value };
  }

  /**
   * Prüft ein Kantengewicht. Leere Eingabe ergibt das Gewicht 1 (ungewichtete Kante).
   *
   * @param {*} input - Eingabe (Zahl oder Text).
   * @returns {{ok: true, value: number}|{ok: false, error: string}} Ergebnis.
   */
  function parseWeight(input) {
    let value;
    if (typeof input === 'number') {
      value = input;
    } else {
      const text = String(input === null || input === undefined ? '' : input).trim();
      if (text === '') {
        return { ok: true, value: 1 };
      }
      if (!INT_PATTERN.test(text)) {
        return { ok: false, error: 'Das Gewicht muss eine ganze Zahl sein (z. B. 4 oder −2).' };
      }
      value = Number(text.replace('−', '-'));
    }
    if (!Number.isInteger(value)) {
      return { ok: false, error: 'Das Gewicht muss eine ganze Zahl sein (z. B. 4 oder −2).' };
    }
    if (Math.abs(value) > LIMITS.maxWeight) {
      return { ok: false, error: 'Das Gewicht muss zwischen −' + LIMITS.maxWeight + ' und ' + LIMITS.maxWeight + ' liegen.' };
    }
    return { ok: true, value: value === 0 ? 0 : value };
  }

  /**
   * Begrenzt eine Koordinate auf die Zeichenfläche.
   * @param {number} value - Wert.
   * @param {number} max - Breite bzw. Höhe.
   * @returns {number} Gerundeter Wert innerhalb der Ränder.
   */
  function clampCoordinate(value, max) {
    const v = Number.isFinite(value) ? value : max / 2;
    return Math.round(Math.min(max - AREA.margin, Math.max(AREA.margin, v)));
  }

  // ---------------------------------------------------------------------------
  // Beobachter
  // ---------------------------------------------------------------------------

  /**
   * Meldet eine Änderung an alle Beobachter.
   * @param {string} type - Art der Änderung.
   */
  function emit(type) {
    for (const listener of listeners.slice()) {
      listener({ type });
    }
  }

  /**
   * Registriert einen Beobachter.
   * @param {function({type:string}): void} listener - Wird nach jeder Änderung aufgerufen.
   */
  function onChange(listener) {
    listeners.push(listener);
  }

  // ---------------------------------------------------------------------------
  // Lesen
  // ---------------------------------------------------------------------------

  /** @returns {boolean} true bei einem gerichteten Graphen. */
  function isDirected() {
    return directed;
  }

  /** @returns {Array<Object>} Knoten in alphabetischer Reihenfolge. */
  function getNodes() {
    return Array.from(nodes.values()).sort((a, b) => compareNames(a.name, b.name));
  }

  /** @returns {Array<Object>} Kanten, sortiert nach Name von Start- und Endknoten. */
  function getEdges() {
    return Array.from(edges.values()).sort((a, b) =>
      compareNames(nodes.get(a.from).name, nodes.get(b.from).name) ||
      compareNames(nodes.get(a.to).name, nodes.get(b.to).name));
  }

  /** @returns {number} Anzahl der Knoten. */
  function nodeCount() {
    return nodes.size;
  }

  /** @returns {number} Anzahl der Kanten. */
  function edgeCount() {
    return edges.size;
  }

  /**
   * @param {number} id - Knoten-ID.
   * @returns {Object|null} Knoten oder null.
   */
  function getNode(id) {
    return nodes.get(id) || null;
  }

  /**
   * @param {number} id - Kanten-ID.
   * @returns {Object|null} Kante oder null.
   */
  function getEdge(id) {
    return edges.get(id) || null;
  }

  /**
   * Sucht einen Knoten über seinen Namen (ohne Groß-/Kleinschreibung).
   * @param {string} name - Name.
   * @returns {Object|null} Knoten oder null.
   */
  function findNode(name) {
    const key = keyOf(name);
    for (const node of nodes.values()) {
      if (keyOf(node.name) === key) {
        return node;
      }
    }
    return null;
  }

  /**
   * Sucht die Kante zwischen zwei Knoten (ungerichtet: in beiden Richtungen).
   * @param {number} from - Startknoten.
   * @param {number} to - Endknoten.
   * @returns {Object|null} Kante oder null.
   */
  function findEdge(from, to) {
    for (const edge of edges.values()) {
      if ((edge.from === from && edge.to === to) || (!directed && edge.from === to && edge.to === from)) {
        return edge;
      }
    }
    return null;
  }

  /** @returns {boolean} true, wenn mindestens ein Gewicht von 1 abweicht. */
  function isWeighted() {
    for (const edge of edges.values()) {
      if (edge.weight !== 1) {
        return true;
      }
    }
    return false;
  }

  /** @returns {boolean} true, wenn es eine Kante mit negativem Gewicht gibt. */
  function hasNegativeWeights() {
    for (const edge of edges.values()) {
      if (edge.weight < 0) {
        return true;
      }
    }
    return false;
  }

  /**
   * Nachbarn eines Knotens in alphabetischer Reihenfolge.
   * Gerichtet: nur Kanten, die vom Knoten ausgehen.
   *
   * @param {number} id - Knoten-ID.
   * @returns {Array<{node:Object, edge:Object, weight:number}>} Nachbarn.
   */
  function neighbors(id) {
    const out = [];
    for (const edge of edges.values()) {
      if (edge.from === id) {
        out.push({ node: nodes.get(edge.to), edge, weight: edge.weight });
      } else if (!directed && edge.to === id) {
        out.push({ node: nodes.get(edge.from), edge, weight: edge.weight });
      }
    }
    return out.sort((a, b) => compareNames(a.node.name, b.node.name));
  }

  /**
   * Unveränderliche Momentaufnahme für die Algorithmen.
   *
   * @returns {{directed:boolean, nodes:Array<{id:number, name:string}>,
   *            adj:Map<number, Array<{to:number, weight:number, edgeId:number}>>,
   *            arcs:Array<{from:number, to:number, weight:number, edgeId:number}>}}
   *   Knoten (alphabetisch), Nachbarlisten (alphabetisch) und alle Bögen
   *   (ungerichtete Kanten in beiden Richtungen).
   */
  function snapshot() {
    const list = getNodes().map((n) => ({ id: n.id, name: n.name }));
    const adj = new Map();
    for (const n of list) {
      adj.set(n.id, neighbors(n.id).map((nb) => ({ to: nb.node.id, weight: nb.weight, edgeId: nb.edge.id })));
    }
    const arcs = [];
    for (const n of list) {
      for (const a of adj.get(n.id)) {
        arcs.push({ from: n.id, to: a.to, weight: a.weight, edgeId: a.edgeId });
      }
    }
    return { directed, nodes: list, adj, arcs };
  }

  /**
   * Adjazenzmatrix: Zeile = Startknoten, Spalte = Endknoten (beide alphabetisch).
   *
   * @returns {{nodes:Array<Object>, cells:Array<Array<Object|null>>}} Knoten und Kanten je Zelle (null = keine Kante).
   */
  function matrix() {
    const list = getNodes();
    const index = new Map(list.map((n, i) => [n.id, i]));
    const cells = list.map(() => list.map(() => null));
    for (const edge of edges.values()) {
      const i = index.get(edge.from);
      const j = index.get(edge.to);
      cells[i][j] = edge;
      if (!directed) {
        cells[j][i] = edge;
      }
    }
    return { nodes: list, cells };
  }

  // ---------------------------------------------------------------------------
  // Ändern
  // ---------------------------------------------------------------------------

  /**
   * Fügt einen Knoten hinzu (ohne Benachrichtigung).
   * @returns {Object} Der neue Knoten.
   */
  function insertNode(name, x, y) {
    const node = Object.freeze({ id: nextNodeId++, name, x: clampCoordinate(x, AREA.width), y: clampCoordinate(y, AREA.height) });
    nodes.set(node.id, node);
    return node;
  }

  /**
   * Fügt einen Knoten hinzu.
   *
   * @param {string} name - Name.
   * @param {{x:number, y:number}} [position] - Position; fehlt sie, wird ein freier Platz gesucht.
   * @returns {Object} Der neue Knoten.
   * @throws {Error} Bei ungültigem oder doppeltem Namen bzw. erreichter Höchstzahl.
   */
  function addNode(name, position) {
    const v = validateName(name);
    if (!v.ok) {
      throw new Error(v.error);
    }
    if (findNode(v.value)) {
      throw new Error('Einen Knoten „' + v.value + '“ gibt es bereits.');
    }
    if (nodes.size >= LIMITS.maxNodes) {
      throw new Error('Höchstens ' + LIMITS.maxNodes + ' Knoten sind möglich.');
    }
    const pos = position || ns.layout.freeSpot(Array.from(nodes.values()), AREA);
    const node = insertNode(v.value, pos.x, pos.y);
    emit('edit');
    return node;
  }

  /**
   * Entfernt einen Knoten und alle Kanten, die ihn berühren.
   * @param {number} id - Knoten-ID.
   * @returns {number} Anzahl der mit entfernten Kanten.
   */
  function removeNode(id) {
    if (!nodes.has(id)) {
      return 0;
    }
    let removed = 0;
    for (const edge of Array.from(edges.values())) {
      if (edge.from === id || edge.to === id) {
        edges.delete(edge.id);
        removed++;
      }
    }
    nodes.delete(id);
    emit('edit');
    return removed;
  }

  /**
   * Fügt eine Kante hinzu oder ändert das Gewicht einer vorhandenen Kante.
   *
   * @param {number} from - Startknoten-ID.
   * @param {number} to - Endknoten-ID.
   * @param {number} weight - Gewicht (bereits über parseWeight geprüft).
   * @returns {{edge:Object, created:boolean, previous:(number|null)}} Kante; created = neu angelegt,
   *          previous = bisheriges Gewicht bei einer Änderung.
   * @throws {Error} Bei Schleife, unbekannten Knoten, ungültigem Gewicht oder erreichter Höchstzahl.
   */
  function setEdge(from, to, weight) {
    if (!nodes.has(from) || !nodes.has(to)) {
      throw new Error('Start- und Endknoten müssen vorhanden sein.');
    }
    if (from === to) {
      throw new Error('Eine Kante von einem Knoten zu sich selbst (Schleife) ist nicht möglich.');
    }
    const w = parseWeight(weight);
    if (!w.ok) {
      throw new Error(w.error);
    }
    const existing = findEdge(from, to);
    if (existing) {
      const updated = Object.freeze(Object.assign({}, existing, { weight: w.value }));
      edges.set(existing.id, updated);
      emit('edit');
      return { edge: updated, created: false, previous: existing.weight };
    }
    if (edges.size >= LIMITS.maxEdges) {
      throw new Error('Höchstens ' + LIMITS.maxEdges + ' Kanten sind möglich.');
    }
    const edge = Object.freeze({ id: nextEdgeId++, from, to, weight: w.value });
    edges.set(edge.id, edge);
    emit('edit');
    return { edge, created: true, previous: null };
  }

  /**
   * Entfernt eine Kante.
   * @param {number} id - Kanten-ID.
   */
  function removeEdge(id) {
    if (edges.delete(id)) {
      emit('edit');
    }
  }

  /**
   * Verschiebt einen Knoten.
   * @param {number} id - Knoten-ID.
   * @param {number} x - neue x-Koordinate.
   * @param {number} y - neue y-Koordinate.
   */
  function moveNode(id, x, y) {
    const node = nodes.get(id);
    if (!node) {
      return;
    }
    const nx = clampCoordinate(x, AREA.width);
    const ny = clampCoordinate(y, AREA.height);
    if (nx === node.x && ny === node.y) {
      return;
    }
    nodes.set(id, Object.freeze(Object.assign({}, node, { x: nx, y: ny })));
    emit('move');
  }

  /**
   * Startpositionen für Knoten (alphabetisch) und Kanten (Indexpaare): kräftebasierte Anordnung.
   * @param {number} count - Anzahl der Knoten.
   * @param {Array<[number, number]>} links - Kanten.
   * @returns {Array<{x:number, y:number}>} Positionen.
   */
  function autoLayout(count, links) {
    return ns.layout.force(count, links, AREA);
  }

  /** Ordnet alle Knoten neu an (kräftebasiert, bei gleichem Graphen immer gleich). */
  function relayout() {
    const list = getNodes();
    const index = new Map(list.map((n, i) => [n.id, i]));
    const positions = autoLayout(list.length, Array.from(edges.values()).map((e) => [index.get(e.from), index.get(e.to)]));
    list.forEach((node, i) => {
      nodes.set(node.id, Object.freeze(Object.assign({}, node, positions[i])));
    });
    emit('move');
  }

  /**
   * Prüft, ob der Graph in die andere Richtungsart umgewandelt werden kann.
   *
   * @param {boolean} toDirected - Zielart.
   * @returns {{ok: true, info: string}|{ok: false, error: string}} Ergebnis mit Erklärung.
   */
  function checkDirection(toDirected) {
    if (toDirected === directed) {
      return { ok: true, info: '' };
    }
    if (toDirected) {
      if (edges.size * 2 > LIMITS.maxEdges) {
        return { ok: false, error: 'Jede ungerichtete Kante wird zu zwei gerichteten Kanten. Das wären ' + (edges.size * 2) + ' Kanten (höchstens ' + LIMITS.maxEdges + ').' };
      }
      return { ok: true, info: 'Jede Kante A–B wird zu den zwei Kanten A→B und B→A mit demselben Gewicht.' };
    }
    const conflicts = [];
    for (const edge of edges.values()) {
      for (const other of edges.values()) {
        if (edge.id < other.id && edge.from === other.to && edge.to === other.from && edge.weight !== other.weight) {
          conflicts.push(nodes.get(edge.from).name + '→' + nodes.get(edge.to).name + ' (' + ns.dom.formatInt(edge.weight) + ') und ' +
            nodes.get(other.from).name + '→' + nodes.get(other.to).name + ' (' + ns.dom.formatInt(other.weight) + ')');
        }
      }
    }
    if (conflicts.length > 0) {
      return { ok: false, error: 'Umwandlung nicht möglich: ' + conflicts.slice(0, 3).join('; ') + (conflicts.length > 3 ? ' …' : '') +
        ' haben verschiedene Gewichte. Gleichen Sie die Gewichte an oder löschen Sie eine der beiden Kanten.' };
    }
    return { ok: true, info: 'Jede Kante A→B wird zur ungerichteten Kante A–B; Gegenkanten B→A mit gleichem Gewicht werden zusammengefasst.' };
  }

  /**
   * Schaltet zwischen gerichtet und ungerichtet um (vorher checkDirection aufrufen).
   *
   * @param {boolean} toDirected - Zielart.
   * @throws {Error} Wenn die Umwandlung nicht möglich ist.
   */
  function setDirected(toDirected) {
    const flag = Boolean(toDirected);
    if (flag === directed) {
      return;
    }
    const check = checkDirection(flag);
    if (!check.ok) {
      throw new Error(check.error);
    }
    const old = Array.from(edges.values()).sort((a, b) => a.id - b.id);
    edges.clear();
    directed = flag;
    for (const edge of old) {
      if (flag) {
        edges.set(edge.id, edge);
        const back = Object.freeze({ id: nextEdgeId++, from: edge.to, to: edge.from, weight: edge.weight });
        edges.set(back.id, back);
      } else if (!findEdge(edge.from, edge.to)) {
        edges.set(edge.id, edge);
      }
    }
    emit('direction');
  }

  /**
   * Ersetzt den gesamten Graphen (Datei, Beispiel, gespeicherter Stand).
   * Die Eingaben müssen bereits geprüft sein; fehlerhafte Einträge führen zu einer Ausnahme,
   * der bisherige Graph bleibt dann unverändert.
   *
   * @param {{directed:boolean, nodes:Array<{name:string, x?:number, y?:number}>,
   *          edges:Array<{from:string, to:string, weight:number}>}} data - Neuer Graph.
   * @throws {Error} Bei ungültigen Daten.
   */
  function replaceAll(data) {
    const list = data.nodes || [];
    const links = data.edges || [];
    if (list.length > LIMITS.maxNodes) {
      throw new Error('Höchstens ' + LIMITS.maxNodes + ' Knoten sind möglich.');
    }
    if (links.length > LIMITS.maxEdges) {
      throw new Error('Höchstens ' + LIMITS.maxEdges + ' Kanten sind möglich.');
    }
    const keys = new Map();
    for (const n of list) {
      const v = validateName(n.name);
      if (!v.ok) {
        throw new Error(v.error);
      }
      if (keys.has(keyOf(v.value))) {
        throw new Error('Der Knoten „' + v.value + '“ kommt doppelt vor.');
      }
      keys.set(keyOf(v.value), v.value);
    }
    const pairs = new Set();
    const checked = [];
    for (const e of links) {
      const from = keys.get(keyOf(e.from));
      const to = keys.get(keyOf(e.to));
      if (from === undefined || to === undefined) {
        throw new Error('Eine Kante verweist auf einen unbekannten Knoten.');
      }
      if (keyOf(from) === keyOf(to)) {
        throw new Error('Schleifen (Kante von einem Knoten zu sich selbst) sind nicht möglich.');
      }
      const w = parseWeight(e.weight);
      if (!w.ok) {
        throw new Error(w.error);
      }
      const pair = data.directed ? keyOf(from) + '\u0000' + keyOf(to) : [keyOf(from), keyOf(to)].sort().join('\u0000');
      if (pairs.has(pair)) {
        throw new Error('Die Kante ' + from + (data.directed ? '→' : '–') + to + ' kommt doppelt vor.');
      }
      pairs.add(pair);
      checked.push({ from, to, weight: w.value });
    }

    // Alles geprüft: jetzt ersetzen.
    nodes.clear();
    edges.clear();
    directed = Boolean(data.directed);
    const needLayout = list.some((n) => !Number.isFinite(n.x) || !Number.isFinite(n.y));
    const sortedNames = list.map((n) => validateName(n.name).value).sort(compareNames);
    const sortedIndex = new Map(sortedNames.map((name, i) => [keyOf(name), i]));
    const circle = needLayout
      ? autoLayout(list.length, checked.map((e) => [sortedIndex.get(keyOf(e.from)), sortedIndex.get(keyOf(e.to))]))
      : [];
    const ids = new Map();
    for (const n of list) {
      const name = validateName(n.name).value;
      const pos = needLayout ? circle[sortedIndex.get(keyOf(name))] : { x: n.x, y: n.y };
      ids.set(keyOf(name), insertNode(name, pos.x, pos.y).id);
    }
    for (const e of checked) {
      const edge = Object.freeze({ id: nextEdgeId++, from: ids.get(keyOf(e.from)), to: ids.get(keyOf(e.to)), weight: e.weight });
      edges.set(edge.id, edge);
    }
    emit('load');
  }

  /** Löscht den gesamten Graphen (die Richtungsart bleibt eingestellt). */
  function clear() {
    nodes.clear();
    edges.clear();
    emit('load');
  }

  /**
   * Exportiert den Graphen als einfache Daten (für die Speicherung).
   * @returns {{directed:boolean, nodes:Array<{name:string, x:number, y:number}>,
   *            edges:Array<{from:string, to:string, weight:number}>}} Daten.
   */
  function toData() {
    return {
      directed,
      nodes: getNodes().map((n) => ({ name: n.name, x: n.x, y: n.y })),
      edges: getEdges().map((e) => ({ from: nodes.get(e.from).name, to: nodes.get(e.to).name, weight: e.weight }))
    };
  }

  ns.graph = {
    LIMITS, AREA,
    validateName, parseWeight, compareNames, keyOf,
    onChange,
    isDirected, getNodes, getEdges, nodeCount, edgeCount, getNode, getEdge, findNode, findEdge,
    isWeighted, hasNegativeWeights, neighbors, snapshot, matrix,
    addNode, removeNode, setEdge, removeEdge, moveNode, relayout,
    checkDirection, setDirected, replaceAll, clear, toData
  };
})(window.HG = window.HG || {});
