/**
 * @file dataset.js
 * @description Zentraler, seitenübergreifender Zustand der Trainingsdaten.
 *
 * Zweck:
 *   Alle sechs Seiten arbeiten auf demselben Datensatz. Dieses Modul
 *   - speichert die Datenpunkte (jeder Punkt erhält eine stabile, fortlaufende ID),
 *   - verwaltet die Achsenbeschriftungen,
 *   - merkt sich, welche Punkte als Validierungsdaten markiert sind,
 *   - ordnet jedem Label eine feste Farbe/Markerform zu,
 *   - prüft alle Eingaben (Koordinaten, Labels, Grenzwerte) und
 *   - benachrichtigt die Seiten bei jeder Änderung (Beobachter-Muster).
 *
 * Warum stabile IDs?
 *   Eintragungen der Schülerinnen und Schüler (Seiten 4 und 5) und die Auswahl
 *   eines Punkts (Seiten 3–5) beziehen sich auf die ID. Wird ein anderer Punkt
 *   gelöscht, verschieben sich die IDs nicht – Eintragungen bleiben korrekt
 *   zugeordnet.
 *
 * Abhängigkeiten:
 *   Keine (Browser-API crypto.getRandomValues für die Zufallsauswahl).
 *
 * Sicherheitsaspekte:
 *   - Labels werden gegen eine Zeichen-Whitelist geprüft und in der Länge
 *     begrenzt; Koordinaten müssen endliche Zahlen in einem festen Bereich sein.
 *   - Achsenbeschriftungen werden von Steuerzeichen befreit und gekürzt.
 *   - Punkte werden eingefroren (Object.freeze), damit kein Modul sie
 *     versehentlich verändert.
 */
(function (ns) {
  'use strict';

  /** Grenzwerte für den Datensatz. */
  const LIMITS = Object.freeze({
    maxPoints: 500,
    maxLabels: 10,
    maxAbs: 1000,
    maxLabelLength: 30,
    maxAxisLabelLength: 40
  });

  /** Erlaubte Zeichen in Labels: Buchstaben (inkl. Umlaute), Ziffern, Leerzeichen, Punkt, Unterstrich, Bindestrich. */
  const LABEL_PATTERN = /^[\p{L}\p{N} ._-]+$/u;

  /** Strenges Zahlenformat: optionales Vorzeichen, Dezimalpunkt ODER Dezimalkomma. */
  const NUMBER_PATTERN = /^[+-]?(\d+([.,]\d+)?|[.,]\d+)$/;

  // ---------------------------------------------------------------------------
  // Eingabeprüfung
  // ---------------------------------------------------------------------------

  /**
   * Wandelt eine Eingabe in eine Zahl um (Zahl oder Text wie "2,5" bzw. "-3.75").
   * Exponentenschreibweise, Tausendertrennzeichen u. Ä. werden bewusst nicht akzeptiert.
   *
   * @param {number|string} input - Eingabe.
   * @returns {number|null} Die Zahl oder null, wenn die Eingabe keine gültige Zahl ist.
   */
  function parseNumber(input) {
    if (typeof input === 'number') {
      return Number.isFinite(input) ? input : null;
    }
    if (typeof input !== 'string') {
      return null;
    }
    const text = String(input).trim();
    if (!NUMBER_PATTERN.test(text)) {
      return null;
    }
    const value = Number(text.replace(',', '.'));
    return Number.isFinite(value) ? value : null;
  }

  /**
   * Prüft eine Koordinate.
   *
   * @param {number|string} input - Eingabe.
   * @param {string} name - Bezeichnung für Fehlermeldungen (z. B. "x-Wert").
   * @returns {{ok: boolean, value?: number, error?: string}} Ergebnis der Prüfung.
   */
  function validateCoordinate(input, name) {
    const value = parseNumber(input);
    if (value === null) {
      return { ok: false, error: name + ' ist keine gültige Zahl.' };
    }
    if (Math.abs(value) > LIMITS.maxAbs) {
      return { ok: false, error: name + ' muss zwischen -' + LIMITS.maxAbs + ' und ' + LIMITS.maxAbs + ' liegen.' };
    }
    // Auf 6 Nachkommastellen runden, um Darstellungsartefakte zu vermeiden.
    return { ok: true, value: Math.round(value * 1e6) / 1e6 };
  }

  /**
   * Prüft und normalisiert ein Label (Klassenbezeichnung).
   * Normalisierung: Leerzeichen am Rand entfernen, Mehrfachleerzeichen zusammenfassen.
   * Groß-/Kleinschreibung bleibt erhalten ("Apfel" und "apfel" sind verschiedene Labels).
   *
   * @param {number|string} input - Eingabe.
   * @returns {{ok: boolean, value?: string, error?: string}} Ergebnis der Prüfung.
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
   * Unsichtbare bzw. darstellungsverändernde Zeichen:
   * Steuerzeichen (C0/C1), Nullbreitenzeichen, Richtungssteuerzeichen
   * (z. B. U+202E "Right-to-Left Override", mit dem sich "rechnung\u202Efdp.csv"
   * als "rechnungvsc.pdf" tarnen ließe), Worttrenner und Byte-Order-Mark.
   */
  const INVISIBLE_PATTERN = /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u180e\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff\ufff9-\ufffb]/g;

  /**
   * Bereinigt Text, der aus Dateien stammt und angezeigt wird (z. B. Dateiname):
   * unsichtbare Zeichen entfernen, Leerraum zusammenfassen, Länge begrenzen.
   * Angezeigt wird ohnehin nur per textContent; die Bereinigung verhindert
   * zusätzlich optische Täuschung.
   *
   * @param {*} input - Rohtext.
   * @param {number} maxLength - Höchstlänge in Zeichen.
   * @param {string} fallback - Ersatz, wenn nichts übrig bleibt.
   * @returns {string} Bereinigter Text.
   */
  function sanitizeDisplayText(input, maxLength, fallback) {
    const text = String(input === null || input === undefined ? '' : input)
      .normalize('NFC')
      .replace(INVISIBLE_PATTERN, ' ')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, maxLength);
    return text === '' ? fallback : text;
  }

  /**
   * Bereinigt eine Achsenbeschriftung (siehe {@link sanitizeDisplayText}).
   *
   * @param {string} input - Rohtext.
   * @param {string} fallback - Ersatz, wenn nichts übrig bleibt.
   * @returns {string} Bereinigte Beschriftung.
   */
  function sanitizeAxisLabel(input, fallback) {
    return sanitizeDisplayText(input, LIMITS.maxAxisLabelLength, fallback);
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------

  /** @type {Array<Readonly<{id:number, x:number, y:number, label:string}>>} */
  let points = [];
  let nextId = 1;
  let axisLabels = { x: 'x', y: 'y' };
  /** IDs der Validierungspunkte (Seite 4). */
  let validationIds = new Set();
  /** Zuordnung Label → Farbindex 0 … 9. */
  let colorMap = new Map();
  /** Änderungszähler; Seiten erkennen daran, ob sie neu rechnen müssen. */
  let revision = 0;
  /** Registrierte Beobachter. */
  const listeners = [];

  /**
   * Benachrichtigt alle Beobachter über eine Änderung.
   * @param {{type: string, ids?: number[]}} event - Art der Änderung.
   */
  function emit(event) {
    revision++;
    for (const listener of listeners) {
      listener(event);
    }
  }

  /**
   * Entfernt Farbzuordnungen von Labels, die nicht mehr vorkommen, und vergibt
   * neuen Labels den kleinsten freien Farbindex.
   */
  function updateColors() {
    const used = new Set(points.map((p) => p.label));
    for (const label of Array.from(colorMap.keys())) {
      if (!used.has(label)) {
        colorMap.delete(label);
      }
    }
    for (const p of points) {
      if (!colorMap.has(p.label)) {
        const taken = new Set(colorMap.values());
        let index = 0;
        while (taken.has(index)) {
          index++;
        }
        colorMap.set(p.label, index);
      }
    }
  }

  /**
   * Erstellt einen eingefrorenen Punkt mit neuer ID.
   * @param {number} x - x-Koordinate.
   * @param {number} y - y-Koordinate.
   * @param {string} label - Geprüftes Label.
   * @returns {Readonly<{id:number, x:number, y:number, label:string}>} Neuer Punkt.
   */
  function makePoint(x, y, label) {
    return Object.freeze({ id: nextId++, x, y, label });
  }

  /**
   * Fügt einen einzelnen Punkt hinzu (manuelle Eingabe).
   *
   * @param {number|string} x - x-Wert.
   * @param {number|string} y - y-Wert.
   * @param {string} label - Label.
   * @returns {{ok: boolean, point?: Object, error?: string}} Ergebnis.
   */
  function addPoint(x, y, label) {
    const vx = validateCoordinate(x, 'x-Wert');
    if (!vx.ok) {
      return vx;
    }
    const vy = validateCoordinate(y, 'y-Wert');
    if (!vy.ok) {
      return vy;
    }
    const vl = validateLabel(label);
    if (!vl.ok) {
      return vl;
    }
    if (points.length >= LIMITS.maxPoints) {
      return { ok: false, error: 'Es sind höchstens ' + LIMITS.maxPoints + ' Datenpunkte möglich.' };
    }
    if (!colorMap.has(vl.value) && colorMap.size >= LIMITS.maxLabels) {
      return { ok: false, error: 'Es sind höchstens ' + LIMITS.maxLabels + ' verschiedene Labels möglich.' };
    }
    const point = makePoint(vx.value, vy.value, vl.value);
    points.push(point);
    updateColors();
    emit({ type: 'add', ids: [point.id] });
    return { ok: true, point };
  }

  /**
   * Entfernt einen Punkt anhand seiner ID (auch aus den Validierungsdaten).
   *
   * @param {number} id - ID des Punkts.
   * @returns {boolean} true, wenn ein Punkt entfernt wurde.
   */
  function removePoint(id) {
    const index = points.findIndex((p) => p.id === id);
    if (index < 0) {
      return false;
    }
    points.splice(index, 1);
    validationIds.delete(id);
    updateColors();
    emit({ type: 'remove', ids: [id] });
    return true;
  }

  /**
   * Ersetzt den gesamten Datensatz (Datei-Upload, Beispieldaten).
   * Jeder Punkt wird hier erneut geprüft – der Datenzustand ist die einzige
   * Stelle, über die Daten in die Anwendung gelangen, und verlässt sich nicht
   * auf Prüfungen der Aufrufer. Ungültige Punkte, Punkte mit einem elften
   * Label und Punkte über der Höchstzahl werden verworfen.
   * Validierungsauswahl und Farbzuordnung werden zurückgesetzt.
   *
   * @param {Array<{x:(number|string), y:(number|string), label:string}>} newPoints - Punkte.
   * @param {{x: string, y: string}} [newAxisLabels] - Achsenbeschriftungen.
   * @returns {number} Anzahl der übernommenen Punkte.
   */
  function replaceAll(newPoints, newAxisLabels) {
    const accepted = [];
    const labels = new Set();
    for (const p of Array.isArray(newPoints) ? newPoints : []) {
      if (accepted.length >= LIMITS.maxPoints) {
        break;
      }
      const vx = validateCoordinate(p && p.x, 'x-Wert');
      const vy = validateCoordinate(p && p.y, 'y-Wert');
      const vl = validateLabel(p && p.label);
      if (!vx.ok || !vy.ok || !vl.ok || (!labels.has(vl.value) && labels.size >= LIMITS.maxLabels)) {
        continue;
      }
      labels.add(vl.value);
      accepted.push({ x: vx.value, y: vy.value, label: vl.value });
    }
    points = accepted.map((p) => makePoint(p.x, p.y, p.label));
    axisLabels = {
      x: sanitizeAxisLabel(newAxisLabels && newAxisLabels.x, 'x'),
      y: sanitizeAxisLabel(newAxisLabels && newAxisLabels.y, 'y')
    };
    validationIds = new Set();
    colorMap = new Map();
    updateColors();
    emit({ type: 'replace' });
    return points.length;
  }

  /** Löscht alle Punkte und setzt die Achsenbeschriftungen zurück. */
  function clearAll() {
    replaceAll([], { x: 'x', y: 'y' });
  }

  /**
   * Ändert die Achsenbeschriftungen.
   * @param {string} x - Beschriftung der x-Achse.
   * @param {string} y - Beschriftung der y-Achse.
   */
  function setAxisLabels(x, y) {
    axisLabels = { x: sanitizeAxisLabel(x, 'x'), y: sanitizeAxisLabel(y, 'y') };
    emit({ type: 'axis' });
  }

  /**
   * Liefert eine ganzzahlige Zufallszahl 0 ≤ r < max aus einer
   * kryptographisch sicheren Quelle (ohne Verzerrung durch Modulo).
   *
   * @param {number} max - Obergrenze (exklusiv), 1 … 2^32.
   * @returns {number} Zufallszahl.
   */
  function randomInt(max) {
    const buffer = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / max) * max;
    let value;
    do {
      crypto.getRandomValues(buffer);
      value = buffer[0];
    } while (value >= limit);
    return value % max;
  }

  /**
   * Markiert zufällig einen Anteil der Punkte als Validierungsdaten
   * (Fisher-Yates-Mischverfahren, dann die ersten n Punkte nehmen).
   * Es bleibt immer mindestens ein Trainingspunkt übrig.
   *
   * @param {number} fraction - Anteil, z. B. 0.2 für 20 %.
   * @returns {number} Anzahl der Validierungspunkte.
   */
  function selectRandomValidation(fraction) {
    const ids = points.map((p) => p.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      const tmp = ids[i];
      ids[i] = ids[j];
      ids[j] = tmp;
    }
    let count = Math.max(1, Math.round(ids.length * fraction));
    count = Math.min(count, ids.length - 1);
    validationIds = new Set(count > 0 ? ids.slice(0, count) : []);
    emit({ type: 'validation' });
    return validationIds.size;
  }

  /**
   * Registriert einen Beobachter für Datenänderungen.
   * @param {function({type: string, ids?: number[]}): void} listener - Rückruffunktion.
   */
  function onChange(listener) {
    listeners.push(listener);
  }

  /**
   * Liefert die Labels in der Reihenfolge ihrer Farbindizes.
   * @returns {string[]} Labels.
   */
  function getLabels() {
    return Array.from(colorMap.entries()).sort((a, b) => a[1] - b[1]).map((e) => e[0]);
  }

  ns.dataset = {
    LIMITS,
    parseNumber,
    validateCoordinate,
    validateLabel,
    sanitizeDisplayText,
    sanitizeAxisLabel,
    addPoint,
    removePoint,
    replaceAll,
    clearAll,
    setAxisLabels,
    selectRandomValidation,
    onChange,
    getLabels,
    /** @returns {Array} Kopie der Punktliste (Punkte selbst sind eingefroren). */
    getPoints: () => points.slice(),
    /** @param {number} id @returns {Object|undefined} Punkt mit dieser ID. */
    getPoint: (id) => points.find((p) => p.id === id),
    /** @returns {number} Anzahl der Punkte. */
    size: () => points.length,
    /** @returns {{x: string, y: string}} Kopie der Achsenbeschriftungen. */
    getAxisLabels: () => ({ x: axisLabels.x, y: axisLabels.y }),
    /** @param {string} label @returns {number} Farbindex 0 … 9 (oder -1, falls unbekannt). */
    labelIndex: (label) => (colorMap.has(label) ? colorMap.get(label) : -1),
    /** @param {number} id @returns {boolean} true, wenn der Punkt ein Validierungspunkt ist. */
    isValidation: (id) => validationIds.has(id),
    /** @returns {Set<number>} Kopie der Validierungs-IDs. */
    getValidationIds: () => new Set(validationIds),
    /** @returns {Array} Punkte, die keine Validierungspunkte sind. */
    getTrainingPoints: () => points.filter((p) => !validationIds.has(p.id)),
    /** @returns {Array} Validierungspunkte. */
    getValidationPoints: () => points.filter((p) => validationIds.has(p.id)),
    /** @returns {number} Änderungszähler. */
    revision: () => revision
  };
})(window.KNN = window.KNN || {});
