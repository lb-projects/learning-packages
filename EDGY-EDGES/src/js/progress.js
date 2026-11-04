/**
 * @file progress.js
 * @description Speichert den Graphen in der Lernplattform (SCORM 1.2, cmi.suspend_data)
 *              und stellt ihn beim nächsten Öffnen wieder her.
 *
 * Gespeichert wird sofort nach jeder Änderung des Graphen (Knoten oder Kante eingegeben,
 * geändert oder gelöscht, Datei oder Beispiel geladen, Richtung umgeschaltet, Knoten
 * verschoben). So geht nichts verloren, wenn der Browser im Unterricht unerwartet
 * geschlossen wird. Ohne Knoten bleibt cmi.suspend_data leer.
 *
 * Format (JSON, Version 1, höchstens 4096 Zeichen):
 *   {"v":1,"d":0|1,"n":[["A",x,y],…],"e":[[i,j,w],…]}
 *   - d: 1 = gerichtet, 0 = ungerichtet
 *   - n: Knoten (Name, Position); passt der Stand nicht in 4096 Zeichen, fehlen die
 *        Positionen (["A","B",…]) und die Knoten werden beim Laden neu angeordnet.
 *   - e: Kanten als Index in n (von, nach) und Gewicht.
 *   Passt auch das nicht, wird nicht gespeichert (Hinweis in der Statuszeile).
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

  /** Zustand für die Statuszeile: '' | 'saved' | 'too-large' | 'positions-dropped' | 'error'. */
  let state = '';
  let onStatus = () => {};
  let restoring = false;

  /**
   * Text für den gespeicherten Stand.
   * @param {Object} data - graph.toData().
   * @param {boolean} withPositions - Positionen mitspeichern.
   * @returns {string} JSON.
   */
  function encode(data, withPositions) {
    const index = new Map(data.nodes.map((n, i) => [n.name, i]));
    return JSON.stringify({
      v: VERSION,
      d: data.directed ? 1 : 0,
      n: data.nodes.map((n) => (withPositions ? [n.name, Math.round(n.x), Math.round(n.y)] : n.name)),
      e: data.edges.map((e) => [index.get(e.from), index.get(e.to), e.weight])
    });
  }

  /** Speichert den aktuellen Graphen. */
  function save() {
    if (restoring || !ns.scorm.isConnected()) {
      return;
    }
    const data = ns.graph.toData();
    let text = '';
    let next = 'saved';
    if (data.nodes.length > 0) {
      text = encode(data, true);
      if (text.length > ns.scorm.SUSPEND_DATA_MAX) {
        text = encode(data, false);
        next = 'positions-dropped';
      }
      if (text.length > ns.scorm.SUSPEND_DATA_MAX) {
        text = null;
        next = 'too-large';
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
   * Prüft und liest einen gespeicherten Stand.
   * @param {string} text - Inhalt von cmi.suspend_data.
   * @returns {Object|null} Daten für graph.replaceAll oder null.
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
    return { directed: obj.d === 1, nodes, edges };
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
    if (state === 'positions-dropped') {
      return ' Hinweis: Wegen der Größe werden die Positionen der Knoten nicht gespeichert.';
    }
    if (state === 'error') {
      return ' Achtung: Der Graph konnte nicht gespeichert werden.';
    }
    return '';
  }

  /** @returns {boolean} true, wenn ein Stand gespeichert ist (für cmi.core.exit = "suspend"). */
  function hasSaved() {
    return ns.graph.nodeCount() > 0 && (state === 'saved' || state === 'positions-dropped');
  }

  ns.progress = { init, save, decode, encode, statusText, hasSaved };
})(window.HG = window.HG || {});
