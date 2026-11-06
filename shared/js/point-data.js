/**
 * @file point-data.js
 * @description Datensatz eines Simulators: Punkte, Attributnamen, Labels und ihre Prüfung.
 *
 * Zweck:
 *   Jeder Datensatz entsteht mit create() und meldet Änderungen an seine Beobachter.
 *   Ein Punkt hat die Form {id, x, y, label, group, stage}; group (z. B. „Beagle“) und stage
 *   (Nummer ab 1) sind nur bei mehrstufigen Beispielen gesetzt.
 *
 * Positives Label:
 *   Bei Zahlen ist es das größte Label, sonst das erste im Datensatz. Bei genau einem Label
 *   gilt: eine Zahl ≤ 0 ist nicht positiv, alles andere schon. Eine Wahl über setPositive()
 *   bleibt bestehen, solange das Label vorkommt.
 *
 * Gemeinsamer Code der Simulator-Pakete (Quelle: shared/js/point-data.js).
 *
 * Abhängigkeiten:
 *   text-utils.js
 *
 * Sicherheitsaspekte:
 *   Labels sind auf eine Zeichenliste beschränkt, Attributnamen werden bereinigt und in der
 *   Länge begrenzt. Fehlermeldungen enthalten keinen Rohinhalt.
 */
(function (ns) {
  'use strict';

  /** Grenzwerte. maxLabels lässt sich je Datensatz festlegen. */
  const LIMITS = Object.freeze({ maxPoints: 500, maxLabels: 2, maxAbs: 1000, maxLabelLength: 30, maxAttributeLength: 40 });
  /** Namen der Attribute, solange keine Datei andere festlegt. */
  const DEFAULT_ATTRIBUTES = Object.freeze({ x: 'x₁', y: 'x₂' });
  /** Erlaubte Zeichen in Labels. */
  const LABEL_PATTERN = /^[\p{L}\p{N} ._-]+$/u;
  /** Strenges Zahlenformat: optionales Vorzeichen, Dezimalpunkt oder Dezimalkomma. */
  const NUMBER_PATTERN = /^[+-]?(\d+([.,]\d+)?|[.,]\d+)$/;

  /**
   * Wandelt eine Eingabe in eine Zahl um. Exponenten und Tausendertrennzeichen sind nicht erlaubt.
   *
   * @param {number|string} input - Eingabe.
   * @returns {number|null} Zahl oder null.
   */
  function parseNumber(input) {
    if (typeof input === 'number') {
      return Number.isFinite(input) ? input : null;
    }
    if (typeof input !== 'string') {
      return null;
    }
    const text = input.trim().replace(/^−/, '-');
    if (!NUMBER_PATTERN.test(text)) {
      return null;
    }
    const value = Number(text.replace(',', '.'));
    return Number.isFinite(value) ? value : null;
  }

  /**
   * Prüft eine Zahl mit Betragsgrenze und rundet auf sechs Nachkommastellen.
   *
   * @param {number|string} input - Eingabe.
   * @param {string} name - Bezeichnung für Meldungen.
   * @returns {{ok:boolean, value?:number, error?:string}} Ergebnis.
   */
  function validateNumber(input, name) {
    const value = parseNumber(input);
    if (value === null) {
      return { ok: false, error: name + ' ist keine gültige Zahl.' };
    }
    if (Math.abs(value) > LIMITS.maxAbs) {
      return { ok: false, error: name + ' muss zwischen −' + LIMITS.maxAbs + ' und ' + LIMITS.maxAbs + ' liegen.' };
    }
    const rounded = Math.round(value * 1e6) / 1e6;
    return { ok: true, value: rounded === 0 ? 0 : rounded };
  }

  /**
   * Prüft und vereinheitlicht ein Label.
   *
   * @param {number|string} input - Eingabe.
   * @returns {{ok:boolean, value?:string, error?:string}} Ergebnis.
   */
  function validateLabel(input) {
    if (typeof input !== 'string' && typeof input !== 'number') {
      return { ok: false, error: 'Label fehlt.' };
    }
    const text = String(input).normalize('NFC').trim().replace(/\s+/g, ' ');
    if (text === '') {
      return { ok: false, error: 'Label fehlt.' };
    }
    if (text.length > LIMITS.maxLabelLength) {
      return { ok: false, error: 'Label ist länger als ' + LIMITS.maxLabelLength + ' Zeichen.' };
    }
    if (!LABEL_PATTERN.test(text)) {
      return { ok: false, error: 'Label enthält unzulässige Zeichen (erlaubt: Buchstaben, Ziffern, Leerzeichen, . _ -).' };
    }
    return { ok: true, value: text };
  }

  /**
   * Bereinigt einen Attributnamen aus einer Datei.
   *
   * @param {*} input - Rohtext.
   * @param {string} fallback - Ersatz, wenn nichts übrig bleibt.
   * @returns {string} Name.
   */
  function sanitizeAttribute(input, fallback) {
    return ns.text.sanitizeDisplayText(input, LIMITS.maxAttributeLength, fallback);
  }

  /**
   * Bestimmt das positive Label nach der Regel im Dateikopf.
   *
   * @param {string[]} labels - Labels in der Reihenfolge ihres ersten Auftretens.
   * @returns {string|null} Positives Label oder null.
   */
  function autoPositive(labels) {
    if (labels.length === 0) {
      return null;
    }
    const numbers = labels.map(parseNumber);
    if (numbers.every((n) => n !== null)) {
      const best = Math.max(...numbers);
      return labels.length === 1 && best <= 0 ? null : labels[numbers.indexOf(best)];
    }
    return labels[0];
  }

  /**
   * Erzeugt einen Datensatz.
   *
   * @param {{maxLabels?:number}} [options] - Höchstzahl der Labels (Standard 2).
   * @returns {Object} Datensatz (siehe Rückgabe am Ende der Funktion).
   */
  function create(options) {
    const maxLabels = (options && options.maxLabels) || LIMITS.maxLabels;
    let points = [];
    let nextId = 1;
    let attributes = { ...DEFAULT_ATTRIBUTES };
    let positive = null;
    let positiveChosen = false;
    const listeners = [];

    /** @returns {string[]} Labels in der Reihenfolge ihres ersten Auftretens. */
    function labels() {
      const seen = [];
      for (const p of points) {
        if (!seen.includes(p.label)) {
          seen.push(p.label);
        }
      }
      return seen;
    }

    /** Hält das positive Label passend zu den vorhandenen Labels. */
    function updatePositive() {
      const current = labels();
      if (!positiveChosen || !current.includes(positive)) {
        positiveChosen = false;
        positive = autoPositive(current);
      }
    }

    /**
     * Meldet eine Änderung an alle Beobachter.
     * @param {Object} event - Mindestens {type}.
     */
    function emit(event) {
      updatePositive();
      for (const fn of listeners) {
        fn(event);
      }
    }

    /**
     * Prüft, ob ein Label noch hinzukommen darf.
     * @param {string} label - Label.
     * @param {string[]} known - Bisherige Labels.
     * @returns {boolean} true, wenn zulässig.
     */
    function labelFits(label, known) {
      return known.includes(label) || known.length < maxLabels;
    }

    /**
     * Fügt einen Punkt nach Prüfung hinzu.
     *
     * @param {number|string} x - x-Wert.
     * @param {number|string} y - y-Wert.
     * @param {number|string} label - Label.
     * @returns {{ok:boolean, error?:string, point?:Object}} Ergebnis.
     */
    function add(x, y, label) {
      const vx = validateNumber(x, attributes.x);
      if (!vx.ok) {
        return vx;
      }
      const vy = validateNumber(y, attributes.y);
      if (!vy.ok) {
        return vy;
      }
      const vl = validateLabel(label);
      if (!vl.ok) {
        return vl;
      }
      if (points.length >= LIMITS.maxPoints) {
        return { ok: false, error: 'Es sind höchstens ' + LIMITS.maxPoints + ' Punkte möglich.' };
      }
      if (!labelFits(vl.value, labels())) {
        return { ok: false, error: 'Es sind höchstens ' + maxLabels + ' verschiedene Labels möglich.' };
      }
      const point = Object.freeze({ id: nextId++, x: vx.value, y: vy.value, label: vl.value, group: null, stage: null });
      points.push(point);
      emit({ type: 'add' });
      return { ok: true, point };
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
     * Wandelt geprüfte Rohpunkte in Datensatzpunkte um.
     * @param {Array<Object>} raw - {x, y, label, group?, stage?}.
     * @returns {Array<Object>} Punkte.
     */
    function build(raw) {
      return raw.map((p) => Object.freeze({ id: nextId++, x: p.x, y: p.y, label: p.label, group: p.group || null, stage: p.stage || null }));
    }

    /**
     * Ersetzt alle Punkte.
     *
     * @param {Array<Object>} raw - Geprüfte Punkte.
     * @param {{x:string, y:string}} [names] - Attributnamen (Standardnamen, wenn sie fehlen).
     * @param {Object} [event] - Zusatzangaben für die Änderungsmeldung.
     */
    function replaceAll(raw, names, event) {
      points = build(raw);
      attributes = names ? { x: names.x, y: names.y } : { ...DEFAULT_ATTRIBUTES };
      positiveChosen = false;
      emit({ type: 'replace', ...event });
    }

    /**
     * Ergänzt Punkte. Bei leerem Datensatz gelten die übergebenen Attributnamen, sonst bleiben die vorhandenen.
     *
     * @param {Array<Object>} raw - Geprüfte Punkte.
     * @param {{x:string, y:string}} [names] - Attributnamen.
     * @param {Object} [event] - Zusatzangaben für die Änderungsmeldung.
     */
    function appendAll(raw, names, event) {
      if (points.length === 0 && names) {
        attributes = { x: names.x, y: names.y };
      }
      points = points.concat(build(raw));
      emit({ type: 'append', ...event });
    }

    /** Entfernt alle Punkte und stellt die Standardnamen wieder her. */
    function clear() {
      replaceAll([], null, { type: 'clear' });
    }

    /**
     * Legt das positive Label fest.
     * @param {string} label - Vorhandenes Label.
     */
    function setPositive(label) {
      if (labels().includes(label)) {
        positive = label;
        positiveChosen = true;
        emit({ type: 'positive' });
      }
    }

    /**
     * Sollwert eines Labels.
     * @param {string} label - Label.
     * @returns {number} 1 beim positiven Label, sonst 0.
     */
    function target(label) {
      return label === positive ? 1 : 0;
    }

    /**
     * Label zu einem Sollwert.
     * @param {number} value - 1 oder 0.
     * @returns {string|null} Label oder null, wenn es im Datensatz noch keines dazu gibt.
     */
    function labelOf(value) {
      if (value === 1) {
        return positive;
      }
      const other = labels().find((l) => l !== positive);
      return other === undefined ? null : other;
    }

    return {
      add, remove, replaceAll, appendAll, clear, setPositive, target, labelOf, labels,
      points: () => points,
      count: () => points.length,
      attributes: () => ({ ...attributes }),
      positive: () => positive,
      maxLabels: () => maxLabels,
      onChange: (fn) => listeners.push(fn)
    };
  }

  ns.pointData = { create, parseNumber, validateNumber, validateLabel, sanitizeAttribute, autoPositive, LIMITS, DEFAULT_ATTRIBUTES };
})(window.LP = window.LP || {});
