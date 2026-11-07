/**
 * @file cluster-data.js
 * @description Datensatz von CLEVER CLUSTERS: Punkte mit optionalem Objektbezeichner, optionaler Gruppe und Achsennamen.
 *
 * Zweck:
 *   Ein Punkt hat die Form {id, x, y, name, group}; name und group sind null, wenn die Daten sie nicht nennen.
 *   k-Means arbeitet ohne die Gruppe. Sie bleibt unsichtbar, bis Seite 7 sie nach „Vergleich durchführen“ zeigt:
 *   Keine andere Seite darf sie anzeigen, damit die Daten ihr Geheimnis nicht verraten.
 *
 * Abhängigkeiten:
 *   text-utils.js, point-data.js (parseNumber, sanitizeAttribute)
 *
 * Sicherheitsaspekte:
 *   Bezeichner werden bereinigt, in der Länge begrenzt und später nur als Text eingefügt.
 *   Fehlermeldungen enthalten keinen Rohinhalt.
 */
(function (ns) {
  'use strict';

  /** Grenzwerte. Beträge bis 1 000 000, damit auch Größen wie Einkommen in Euro passen. */
  const LIMITS = Object.freeze({ maxPoints: 500, maxAbs: 1000000, maxNameLength: 40 });
  /** Überschrift der Objektbezeichner, solange die Datei keine nennt. */
  const DEFAULT_OBJECT_HEADER = 'Objekt';

  /**
   * Prüft eine Zahl mit Betragsgrenze und rundet auf sechs Nachkommastellen.
   *
   * @param {number|string} input - Eingabe.
   * @param {string} name - Bezeichnung für Meldungen.
   * @returns {{ok:boolean, value?:number, error?:string}} Ergebnis.
   */
  function validateNumber(input, name) {
    const value = ns.pointData.parseNumber(input);
    if (value === null) {
      return { ok: false, error: name + ' ist keine gültige Zahl.' };
    }
    if (Math.abs(value) > LIMITS.maxAbs) {
      return { ok: false, error: name + ' muss zwischen −1000000 und 1000000 liegen.' };
    }
    const rounded = Math.round(value * 1e6) / 1e6;
    return { ok: true, value: rounded === 0 ? 0 : rounded };
  }

  /**
   * Bereinigt einen Objektbezeichner.
   *
   * @param {*} input - Rohtext.
   * @returns {string|null} Bezeichner oder null, wenn nichts übrig bleibt.
   */
  function cleanName(input) {
    return ns.text.sanitizeDisplayText(input, LIMITS.maxNameLength, null);
  }

  /**
   * Erzeugt einen Datensatz.
   *
   * @returns {Object} Datensatz (siehe Rückgabe am Ende der Funktion).
   */
  function create() {
    let points = [];
    let nextId = 1;
    let attributes = { ...ns.pointData.DEFAULT_ATTRIBUTES };
    let objectHeader = DEFAULT_OBJECT_HEADER;
    const listeners = [];

    /**
     * Meldet eine Änderung an alle Beobachter.
     * @param {Object} event - Mindestens {type}.
     */
    function emit(event) {
      for (const fn of listeners) {
        fn(event);
      }
    }

    /**
     * Wandelt geprüfte Rohpunkte in Datensatzpunkte um.
     * @param {Array<{x:number, y:number, name:(string|null), group:(string|null|undefined)}>} raw - Punkte.
     * @returns {Array<Object>} Punkte.
     */
    function build(raw) {
      return raw.map((p) => Object.freeze({ id: nextId++, x: p.x, y: p.y, name: p.name || null, group: p.group || null }));
    }

    /**
     * Fügt einen Punkt nach Prüfung hinzu.
     *
     * @param {number|string} x - x-Wert.
     * @param {number|string} y - y-Wert.
     * @param {string} [name] - Objektbezeichner.
     * @returns {{ok:boolean, error?:string}} Ergebnis.
     */
    function add(x, y, name) {
      const vx = validateNumber(x, attributes.x);
      if (!vx.ok) {
        return vx;
      }
      const vy = validateNumber(y, attributes.y);
      if (!vy.ok) {
        return vy;
      }
      if (points.length >= LIMITS.maxPoints) {
        return { ok: false, error: 'Es sind höchstens ' + LIMITS.maxPoints + ' Punkte möglich.' };
      }
      points = points.concat(build([{ x: vx.value, y: vy.value, name: cleanName(name) }]));
      emit({ type: 'add' });
      return { ok: true };
    }

    /**
     * Entfernt einen Punkt.
     * @param {number} id - ID.
     */
    function remove(id) {
      points = points.filter((p) => p.id !== id);
      emit({ type: 'remove' });
    }

    /**
     * Ersetzt alle Punkte.
     *
     * @param {Array<Object>} raw - Geprüfte Punkte.
     * @param {{x:string, y:string}} [names] - Achsennamen (Standardnamen, wenn sie fehlen).
     * @param {string} [header] - Überschrift der Objektbezeichner.
     */
    function replaceAll(raw, names, header) {
      points = build(raw);
      attributes = names ? { x: names.x, y: names.y } : { ...ns.pointData.DEFAULT_ATTRIBUTES };
      objectHeader = header || DEFAULT_OBJECT_HEADER;
      emit({ type: 'replace' });
    }

    /**
     * Ergänzt Punkte. Bei leerem Datensatz gelten die übergebenen Namen, sonst bleiben die vorhandenen.
     *
     * @param {Array<Object>} raw - Geprüfte Punkte.
     * @param {{x:string, y:string}} [names] - Achsennamen.
     * @param {string} [header] - Überschrift der Objektbezeichner.
     */
    function appendAll(raw, names, header) {
      if (points.length === 0) {
        attributes = names ? { x: names.x, y: names.y } : attributes;
        objectHeader = header || objectHeader;
      }
      points = points.concat(build(raw));
      emit({ type: 'append' });
    }

    /** Entfernt alle Punkte und stellt die Standardnamen wieder her. */
    function clear() {
      replaceAll([], null, null);
    }

    return {
      add, remove, replaceAll, appendAll, clear,
      points: () => points,
      count: () => points.length,
      attributes: () => ({ ...attributes }),
      objectHeader: () => objectHeader,
      /**
       * Anzeigename eines Punkts.
       * @param {number} index - Position ab 0.
       * @returns {string} Bezeichner oder „Punkt n“.
       */
      displayName: (index) => points[index].name || 'Punkt ' + (index + 1),
      hasNames: () => points.some((p) => p.name),
      /** @returns {boolean} true, wenn mindestens ein Punkt eine bekannte Gruppe hat. */
      hasGroups: () => points.some((p) => p.group),
      onChange: (fn) => listeners.push(fn)
    };
  }

  ns.clusterData = { create, validateNumber, cleanName, LIMITS, DEFAULT_OBJECT_HEADER };
})(window.CC = window.CC || {});
