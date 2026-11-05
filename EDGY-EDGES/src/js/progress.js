/**
 * @file progress.js
 * @description Speichert den Graphen und den Stand des Trainings (Seite 6) in der
 *              Lernplattform (SCORM 1.2, cmi.suspend_data) und stellt beides beim nächsten
 *              Öffnen wieder her.
 *
 * Gespeichert wird sofort nach jeder Änderung des Graphen (Knoten oder Kante eingegeben,
 * geändert oder gelöscht, Datei oder Beispiel geladen, Richtung umgeschaltet, Knoten
 * verschoben). So geht nichts verloren, wenn der Browser im Unterricht unerwartet
 * geschlossen wird. Das Training speichert nach jedem Klick, jeder Prüfung und (verzögert)
 * beim Eintippen in die Dijkstra-Tabelle. Ohne Knoten bleibt cmi.suspend_data leer.
 *
 * Format (JSON, Version 1, höchstens 4096 Zeichen):
 *   {"v":1,"d":0|1,"n":[["A",x,y],…],"e":[[i,j,w],…],"t":{…}}
 *   - d: 1 = gerichtet, 0 = ungerichtet
 *   - n: Knoten (Name, Position) oder nur Namen (["A","B",…]; die Knoten werden dann beim
 *        Laden neu angeordnet).
 *   - e: Kanten als Index in n (von, nach) und Gewicht.
 *   - t: Training (optional; fehlt, solange nichts geübt wurde):
 *        {"a":0|1|2, "b":[s,p,f], "f":[s,p,f], "k":[s,p,f] oder [s,p,f,"…","…","…"]}
 *        a = gewählter Algorithmus (Breitensuche, Tiefensuche, Dijkstra); b/f/k = Stand je
 *        Algorithmus: s = Startknoten als Index in n (−1 = keiner), p = richtige Schritte bzw.
 *        Zeilen, f = Fehlentscheidungen; bei Dijkstra optional der Entwurf der offenen Zeile.
 *        Richtige Schritte und Zeilen werden nur gezählt – sie ergeben sich eindeutig aus dem Graphen.
 *   Passt der Stand nicht in 4096 Zeichen, wird stufenweise weggelassen: erst der Entwurf,
 *   dann die Positionen, zuletzt das Training. Passt auch der Graph allein nicht, wird nicht
 *   gespeichert. Die Statuszeile nennt jeweils, was fehlt.
 *
 * Abhängigkeiten:
 *   graph.js, scorm-api.js
 *
 * Sicherheitsaspekte / Datenschutz:
 *   - Gespeichert wird nur in der Lernplattform (kein localStorage, keine Cookies)
 *     und nur bei bestehender SCORM-Verbindung.
 *   - Gespeicherte Daten werden vor der Übernahme streng geprüft (Version, Typen,
 *     Grenzen, Namen und Gewichte über graph.js). Ungültiges wird verworfen.
 *   - Der Name der Lernenden wird weder gelesen noch gespeichert.
 */
(function (ns) {
  'use strict';

  const VERSION = 1;
  /** Kurzschlüssel der Algorithmen im gespeicherten Training. */
  const TRAINING_KEYS = [['bfs', 'b'], ['dfs', 'f'], ['dijkstra', 'k']];
  const TRAINING_ALGOS = TRAINING_KEYS.map((k) => k[0]);
  /** Grenzen für gespeicherte Trainingswerte. */
  const TRAINING_MAX_STEPS = 1000;
  const TRAINING_MAX_ERRORS = 1000000;
  const TRAINING_MAX_DRAFT = 1000;

  /** Zustand für die Statuszeile: '' | 'saved' | 'draft-dropped' | 'positions-dropped' | 'training-dropped' | 'too-large' | 'error'. */
  let state = '';
  let onStatus = () => {};
  let restoring = false;

  /**
   * Kompakte Form des Trainings (Feld t).
   * @param {Object|null} training - pages.training.exportState() oder null.
   * @param {Map<string, number>} index - Knotenname → Index in n.
   * @param {boolean} withDraft - Entwurf der offenen Dijkstra-Zeile mitspeichern.
   * @returns {Object|null} t oder null, wenn nichts zu speichern ist.
   */
  function encodeTraining(training, index, withDraft) {
    if (!training) {
      return null;
    }
    const t = { a: Math.max(0, TRAINING_ALGOS.indexOf(training.a)) };
    let any = t.a !== 0;
    for (const [algo, key] of TRAINING_KEYS) {
      const s = training[algo];
      if (!s) {
        continue;
      }
      const draft = algo === 'dijkstra' && withDraft && s.draft ? [s.draft.current, s.draft.queue, s.draft.rand] : null;
      const hasDraft = draft !== null && draft.some((x) => x !== '');
      if (s.p === 0 && s.e === 0 && !hasDraft) {
        continue;
      }
      const start = s.start !== null && index.has(s.start) ? index.get(s.start) : -1;
      t[key] = hasDraft ? [start, s.p, s.e].concat(draft) : [start, s.p, s.e];
      any = true;
    }
    return any ? t : null;
  }

  /**
   * Text für den gespeicherten Stand.
   * @param {Object} data - graph.toData().
   * @param {boolean} withPositions - Positionen mitspeichern.
   * @param {Object|null} [t] - Training (encodeTraining) oder null.
   * @returns {string} JSON.
   */
  function encode(data, withPositions, t) {
    const index = new Map(data.nodes.map((n, i) => [n.name, i]));
    const obj = {
      v: VERSION,
      d: data.directed ? 1 : 0,
      n: data.nodes.map((n) => (withPositions ? [n.name, Math.round(n.x), Math.round(n.y)] : n.name)),
      e: data.edges.map((e) => [index.get(e.from), index.get(e.to), e.weight])
    };
    if (t) {
      obj.t = t;
    }
    return JSON.stringify(obj);
  }

  /** Speichert den aktuellen Graphen und den Stand des Trainings. */
  function save() {
    if (restoring || !ns.scorm.isConnected()) {
      return;
    }
    const data = ns.graph.toData();
    let text = '';
    let next = 'saved';
    if (data.nodes.length > 0) {
      const index = new Map(data.nodes.map((n, i) => [n.name, i]));
      const training = ns.pages && ns.pages.training ? ns.pages.training.exportState() : null;
      const full = encodeTraining(training, index, true);
      const noDraft = encodeTraining(training, index, false);
      // Stufen: alles → ohne Entwurf → ohne Positionen → ohne Training.
      const levels = [
        [true, full, 'saved'],
        [true, noDraft, 'draft-dropped'],
        [false, noDraft, 'positions-dropped'],
        [false, null, noDraft ? 'training-dropped' : 'positions-dropped']
      ];
      text = null;
      next = 'too-large';
      for (const [withPositions, t, label] of levels) {
        const candidate = encode(data, withPositions, t);
        if (candidate.length <= ns.scorm.SUSPEND_DATA_MAX) {
          text = candidate;
          // Gleicher Inhalt wie die volle Stufe (kein Entwurf vorhanden) gilt als vollständig gespeichert.
          next = label === 'draft-dropped' && JSON.stringify(full) === JSON.stringify(noDraft) ? 'saved' : label;
          break;
        }
      }
    }
    if (text !== null) {
      if (ns.scorm.setValue('cmi.suspend_data', text)) {
        ns.scorm.commit();
      } else {
        next = 'error';
      }
    }
    if (next !== state) {
      state = next;
      onStatus();
    }
  }

  /**
   * Prüft und liest das gespeicherte Training.
   * @param {*} t - Feld t.
   * @param {Array<{name:string}>} nodes - Gelesene Knoten (Index wie in n).
   * @returns {Object|null} Stand wie pages.training.exportState() oder null (ungültig).
   */
  function decodeTraining(t, nodes) {
    if (!t || typeof t !== 'object' || Array.isArray(t) || !Number.isInteger(t.a) || t.a < 0 || t.a >= TRAINING_ALGOS.length) {
      return null;
    }
    const out = { a: TRAINING_ALGOS[t.a] };
    const count = (x, max) => Number.isInteger(x) && x >= 0 && x <= max;
    for (const [algo, key] of TRAINING_KEYS) {
      const v = t[key];
      if (v === undefined) {
        continue;
      }
      const withDraft = algo === 'dijkstra' && Array.isArray(v) && v.length === 6;
      if (!Array.isArray(v) || (v.length !== 3 && !withDraft) || !Number.isInteger(v[0]) || v[0] < -1 || v[0] >= nodes.length ||
          !count(v[1], TRAINING_MAX_STEPS) || !count(v[2], TRAINING_MAX_ERRORS)) {
        return null;
      }
      out[algo] = { start: v[0] === -1 ? null : nodes[v[0]].name, p: v[1], e: v[2] };
      if (withDraft) {
        if (!v.slice(3).every((x) => typeof x === 'string' && x.length <= TRAINING_MAX_DRAFT)) {
          return null;
        }
        out[algo].draft = { current: v[3], queue: v[4], rand: v[5] };
      }
    }
    return out;
  }

  /**
   * Prüft und liest einen gespeicherten Stand.
   * @param {string} text - Inhalt von cmi.suspend_data.
   * @returns {Object|null} Daten für graph.replaceAll (dazu training, falls gespeichert) oder null.
   */
  function decode(text) {
    if (typeof text !== 'string' || text === '' || text.length > ns.scorm.SUSPEND_DATA_MAX) {
      return null;
    }
    let obj;
    try {
      obj = JSON.parse(text);
    } catch (e) {
      return null;
    }
    if (!obj || typeof obj !== 'object' || obj.v !== VERSION || (obj.d !== 0 && obj.d !== 1) ||
        !Array.isArray(obj.n) || !Array.isArray(obj.e) ||
        obj.n.length > ns.graph.LIMITS.maxNodes || obj.e.length > ns.graph.LIMITS.maxEdges) {
      return null;
    }
    const nodes = [];
    for (const entry of obj.n) {
      if (typeof entry === 'string') {
        nodes.push({ name: entry });
      } else if (Array.isArray(entry) && entry.length === 3 && typeof entry[0] === 'string' &&
                 Number.isFinite(entry[1]) && Number.isFinite(entry[2])) {
        nodes.push({ name: entry[0], x: entry[1], y: entry[2] });
      } else {
        return null;
      }
      if (!ns.graph.validateName(nodes[nodes.length - 1].name).ok) {
        return null;
      }
    }
    const edges = [];
    for (const entry of obj.e) {
      if (!Array.isArray(entry) || entry.length !== 3 || !Number.isInteger(entry[0]) || !Number.isInteger(entry[1]) ||
          entry[0] < 0 || entry[1] < 0 || entry[0] >= nodes.length || entry[1] >= nodes.length || !ns.graph.parseWeight(entry[2]).ok) {
        return null;
      }
      edges.push({ from: nodes[entry[0]].name, to: nodes[entry[1]].name, weight: entry[2] });
    }
    const data = { directed: obj.d === 1, nodes, edges };
    if (obj.t !== undefined) {
      // Ein ungültiges Training verwirft nur das Training, nicht den Graphen.
      const training = decodeTraining(obj.t, nodes);
      if (training) {
        data.training = training;
      }
    }
    return data;
  }

  /**
   * Stellt den gespeicherten Graphen wieder her (beim Start).
   * @returns {boolean} true, wenn ein Graph übernommen wurde.
   */
  function restore() {
    if (!ns.scorm.isConnected()) {
      return false;
    }
    const data = decode(ns.scorm.getValue('cmi.suspend_data'));
    if (!data) {
      return false;
    }
    restoring = true;
    try {
      ns.graph.replaceAll(data);
      if (data.training && ns.pages && ns.pages.training) {
        ns.pages.training.importState(data.training);
      }
      state = 'saved';
      return true;
    } catch (e) {
      return false;
    } finally {
      restoring = false;
    }
  }

  /**
   * Richtet die Speicherung ein: stellt den letzten Stand wieder her und speichert ab dann jede Änderung.
   * @param {{onStatus: function(): void}} options - onStatus: wird bei Änderung des Speicherstatus aufgerufen.
   * @returns {boolean} true, wenn ein gespeicherter Graph übernommen wurde.
   */
  function init(options) {
    onStatus = (options && options.onStatus) || onStatus;
    const restored = restore();
    ns.graph.onChange(save);
    return restored;
  }

  /** @returns {string} Zusatz für die Statuszeile ("" wenn alles gespeichert ist). */
  function statusText() {
    if (state === 'too-large') {
      return ' Achtung: Der Graph ist zu groß zum Speichern; er geht beim Schließen verloren.';
    }
    if (state === 'draft-dropped') {
      return ' Hinweis: Wegen der Größe wird die gerade bearbeitete Zeile der Trainingstabelle nicht gespeichert.';
    }
    if (state === 'positions-dropped') {
      return ' Hinweis: Wegen der Größe werden die Positionen der Knoten nicht gespeichert.';
    }
    if (state === 'training-dropped') {
      return ' Hinweis: Wegen der Größe wird der Stand des Trainings nicht gespeichert.';
    }
    if (state === 'error') {
      return ' Achtung: Der Graph konnte nicht gespeichert werden.';
    }
    return '';
  }

  /** @returns {boolean} true, wenn ein Stand gespeichert ist (für cmi.core.exit = "suspend"). */
  function hasSaved() {
    return ns.graph.nodeCount() > 0 && ['saved', 'draft-dropped', 'positions-dropped', 'training-dropped'].includes(state);
  }

  ns.progress = { init, save, restore, decode, encode, statusText, hasSaved };
})(window.HG = window.HG || {});
