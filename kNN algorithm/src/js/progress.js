/**
 * @file progress.js
 * @description Speichert den Bearbeitungsstand der Seiten 4 und 5 in der Lernplattform
 *              (SCORM 1.2, cmi.suspend_data) und stellt ihn beim nächsten Öffnen wieder her.
 *
 * Gespeichert wird nach jeder Eintragung ("x"), nach "zurücksetzen", nach einer neuen
 * Validierungsauswahl und nach Änderungen der Trainingsdaten. So geht nichts verloren,
 * wenn der Browser im Unterricht unerwartet geschlossen wird.
 *
 * Format (JSON, Version 1, höchstens 4096 Zeichen):
 *   {"v":1,"h":"<Prüfwert>","d":{"a":[x-Achse,y-Achse],"l":[Labels],"p":[[x,y,Labelindex],…]},
 *    "s":[Positionen der Validierungspunkte],"f":Anteil in %,"e4":"<Bits>","e5":"<Bits>"}
 *   - h:  Prüfwert der Trainingsdaten (dataset.fingerprint).
 *   - d:  die Trainingsdaten selbst – nur, wenn der Stand damit in 4096 Zeichen passt.
 *         Sonst fehlt d; die Eintragungen werden dann übernommen, sobald dieselben
 *         Daten erneut geladen werden (gleicher Prüfwert).
 *   - e4/e5: Eintragungen der Seiten 4 und 5 als Bitfolge (je Tabellenzeile 10 Bits
 *         für k = 1 … 10) in Base64. Zeilen in der Reihenfolge der Tabelle.
 *   Punkte werden über ihre Position adressiert, weil IDs beim Laden neu vergeben werden.
 *
 * Abhängigkeiten:
 *   dataset.js, scorm-api.js, pages/k-selection.js, pages/loo-manual.js
 *
 * Sicherheitsaspekte / Datenschutz:
 *   - Gespeichert wird nur in der Lernplattform (kein localStorage, keine Cookies)
 *     und nur bei bestehender SCORM-Verbindung.
 *   - Gespeicherte Daten werden vor der Übernahme streng geprüft (Version, Typen,
 *     Wertebereiche, Labels über dataset.validateLabel). Ungültiges wird ignoriert.
 *   - Der Name der Lernenden wird weder gelesen noch gespeichert.
 */
(function (ns) {
  'use strict';

  const ds = ns.dataset;
  const scorm = ns.scorm;

  const VERSION = 1;
  /** Spalten der Eingabetabellen (k = 1 … 10). */
  const K_MAX = 10;
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  /** true, wenn eine SCORM-Verbindung besteht und gespeichert wird. */
  let active = false;
  /** true, wenn in der Lernplattform ein Stand gespeichert ist. */
  let saved = false;
  /** true während der Wiederherstellung (Ereignisse lösen dann kein Speichern aus). */
  let restoring = false;
  /** Vorgemerkter Stand ohne Daten (wartet auf dieselben Trainingsdaten). */
  let pending = null;
  /** Zustand für die Statuszeile: '', 'restored', 'pending', 'too-large'. */
  let status = '';
  /** Rückruf bei geändertem Status. */
  let onStatus = null;

  function setStatus(value) {
    status = value;
    if (onStatus) {
      onStatus();
    }
  }

  /** @returns {{k4: Object, k5: Object}} Die beiden Auswertungsseiten. */
  function evalPages() {
    return { k4: ns.pages['k-selection'], k5: ns.pages['loo-manual'] };
  }

  /**
   * Kodiert Eintragungen als Bitfolge in Base64.
   * @param {Array<number[]>} rows - Je Zeile die k-Werte mit "x".
   * @returns {string} Base64-Text.
   */
  function encodeRows(rows) {
    const bits = new Array(rows.length * K_MAX).fill(0);
    rows.forEach((ks, r) => {
      for (const k of ks) {
        if (k >= 1 && k <= K_MAX) {
          bits[r * K_MAX + k - 1] = 1;
        }
      }
    });
    let out = '';
    for (let i = 0; i < bits.length; i += 6) {
      let v = 0;
      for (let j = 0; j < 6; j++) {
        v = (v << 1) | (bits[i + j] || 0);
      }
      out += B64[v];
    }
    return out;
  }

  /**
   * Dekodiert eine Bitfolge (Gegenstück zu encodeRows).
   * @param {string} text - Base64-Text.
   * @param {number} rowCount - Anzahl der Tabellenzeilen.
   * @returns {Array<number[]>|null} Je Zeile die k-Werte oder null, wenn die Länge nicht passt.
   */
  function decodeRows(text, rowCount) {
    if (text.length !== Math.ceil(rowCount * K_MAX / 6)) {
      return null;
    }
    const bits = [];
    for (const ch of text) {
      const v = B64.indexOf(ch);
      for (let j = 5; j >= 0; j--) {
        bits.push((v >> j) & 1);
      }
    }
    const rows = [];
    for (let r = 0; r < rowCount; r++) {
      const ks = [];
      for (let k = 1; k <= K_MAX; k++) {
        if (bits[r * K_MAX + k - 1]) {
          ks.push(k);
        }
      }
      rows.push(ks);
    }
    return rows;
  }

  /** @returns {boolean} true, wenn es etwas zu speichern gibt (Validierungsauswahl oder Eintragungen). */
  function hasWork() {
    const { k4, k5 } = evalPages();
    return ds.getValidationPoints().length > 0 ||
      k4.getEntryRows().some((r) => r.length > 0) || k5.getEntryRows().some((r) => r.length > 0);
  }

  /**
   * Stellt den zu speichernden Text zusammen.
   * @param {boolean} withData - Trainingsdaten mitspeichern.
   * @returns {string} JSON-Text.
   */
  function serialize(withData) {
    const { k4, k5 } = evalPages();
    const points = ds.getPoints();
    const position = new Map(points.map((p, i) => [p.id, i]));
    const state = { v: VERSION, h: ds.fingerprint() };
    if (withData) {
      const labels = [];
      for (const p of points) {
        if (!labels.includes(p.label)) {
          labels.push(p.label);
        }
      }
      const axis = ds.getAxisLabels();
      state.d = { a: [axis.x, axis.y], l: labels, p: points.map((p) => [p.x, p.y, labels.indexOf(p.label)]) };
    }
    state.s = ds.getValidationPoints().map((p) => position.get(p.id));
    state.f = k4.getPercent();
    state.e4 = encodeRows(k4.getEntryRows());
    state.e5 = encodeRows(k5.getEntryRows());
    return JSON.stringify(state);
  }

  /**
   * Speichert den aktuellen Stand in der Lernplattform.
   * @param {boolean} userAction - true bei einer Bearbeitung (Eintragung, Zurücksetzen, Validierungsauswahl).
   */
  function save(userAction) {
    if (!active || restoring) {
      return;
    }
    if (pending) {
      // Ein vorgemerkter Stand wird nur durch echte Bearbeitungen ersetzt,
      // nicht schon durch das Laden anderer Daten.
      if (!userAction) {
        return;
      }
      pending = null;
      setStatus('');
    }
    if (!hasWork() && !saved) {
      return; // Nichts bearbeitet und nichts gespeichert: cmi.suspend_data bleibt leer.
    }
    let text = serialize(true);
    if (text.length > scorm.SUSPEND_DATA_MAX) {
      text = serialize(false);
    }
    if (text.length > scorm.SUSPEND_DATA_MAX) {
      setStatus('too-large');
      return;
    }
    if (scorm.setValue('cmi.suspend_data', text)) {
      scorm.commit();
      saved = true;
      if (status === 'too-large') {
        setStatus('');
      }
    }
  }

  /**
   * Prüft einen gespeicherten Text streng.
   * @param {string} text - Inhalt von cmi.suspend_data.
   * @returns {Object|null} Geprüfter Stand oder null.
   */
  function parse(text) {
    if (typeof text !== 'string' || text === '' || text.length > scorm.SUSPEND_DATA_MAX) {
      return null;
    }
    let obj;
    try {
      obj = JSON.parse(text);
    } catch (e) {
      return null;
    }
    const isIntArray = (a, max) => Array.isArray(a) && a.length <= max && a.every((n) => Number.isInteger(n) && n >= 0);
    const isBits = (t) => typeof t === 'string' && t.length <= 1000 && /^[A-Za-z0-9+/]*$/.test(t);
    if (!obj || typeof obj !== 'object' || obj.v !== VERSION || typeof obj.h !== 'string' || !/^[0-9a-f]{8}$/.test(obj.h) ||
        !isIntArray(obj.s, ds.LIMITS.maxPoints) || new Set(obj.s).size !== obj.s.length ||
        !isBits(obj.e4) || !isBits(obj.e5) ||
        (obj.f !== undefined && !(Number.isInteger(obj.f) && obj.f >= 1 && obj.f <= 90))) {
      return null;
    }
    if (obj.d !== undefined) {
      const d = obj.d;
      if (!d || typeof d !== 'object' || !Array.isArray(d.a) || d.a.length !== 2 || !d.a.every((t) => typeof t === 'string') ||
          !Array.isArray(d.l) || d.l.length > ds.LIMITS.maxLabels || !d.l.every((l) => ds.validateLabel(l).ok) ||
          !Array.isArray(d.p) || d.p.length > ds.LIMITS.maxPoints ||
          !d.p.every((p) => Array.isArray(p) && p.length === 3 &&
            ds.validateCoordinate(p[0], 'x').ok && ds.validateCoordinate(p[1], 'y').ok &&
            typeof p[0] === 'number' && typeof p[1] === 'number' &&
            Number.isInteger(p[2]) && p[2] >= 0 && p[2] < d.l.length)) {
        return null;
      }
    }
    return obj;
  }

  /**
   * Übernimmt Validierungsauswahl, Anteil und Eintragungen (die Daten passen bereits).
   * @param {Object} obj - Geprüfter Stand.
   * @returns {boolean} true bei Erfolg.
   */
  function apply(obj) {
    const { k4, k5 } = evalPages();
    const points = ds.getPoints();
    if (obj.s.some((i) => i >= points.length)) {
      return false;
    }
    restoring = true;
    try {
      ds.setValidationIds(obj.s.map((i) => points[i].id));
      if (obj.f !== undefined) {
        k4.setPercent(obj.f);
      }
      const rows4 = decodeRows(obj.e4, ds.getValidationPoints().length);
      const rows5 = decodeRows(obj.e5, points.length);
      if (rows4) {
        k4.setEntryRows(rows4);
      }
      if (rows5) {
        k5.setEntryRows(rows5);
      }
    } finally {
      restoring = false;
    }
    saved = true;
    return true;
  }

  /**
   * Reagiert auf Datenänderungen: vorgemerkten Stand übernehmen oder speichern.
   * @param {{type: string}} event - Änderung.
   */
  function onDataChange(event) {
    if (restoring || !active) {
      return;
    }
    if (pending && event.type === 'replace' && ds.fingerprint() === pending.h) {
      const obj = pending;
      pending = null;
      if (apply(obj)) {
        setStatus('restored');
      }
      return;
    }
    save(event.type === 'validation');
  }

  /**
   * Startet die Speicherung: liest einen gespeicherten Stand und registriert die Beobachter.
   * Wird von app.js nach der SCORM-Initialisierung und vor der ersten Anzeige aufgerufen.
   * @param {{onStatus?: function(): void}} [options] - onStatus: Rückruf bei geändertem Status.
   */
  function init(options) {
    onStatus = options && options.onStatus ? options.onStatus : null;
    active = scorm.isConnected();
    if (!active) {
      return;
    }
    const obj = parse(scorm.getValue('cmi.suspend_data'));
    if (obj) {
      saved = true;
      if (obj.d) {
        restoring = true;
        try {
          ds.replaceAll(obj.d.p.map(([x, y, l]) => ({ x, y, label: obj.d.l[l] })), { x: obj.d.a[0], y: obj.d.a[1] });
        } finally {
          restoring = false;
        }
        if (ds.fingerprint() === obj.h && apply(obj)) {
          status = 'restored';
        }
      } else {
        pending = obj;
        status = 'pending';
      }
    }
    ds.onChange(onDataChange);
    const { k4, k5 } = evalPages();
    k4.onUserChange(() => save(true));
    k5.onUserChange(() => save(true));
  }

  /** @returns {string} Ergänzung für die Statuszeile. */
  function statusText() {
    if (!active) {
      return '';
    }
    if (status === 'restored') {
      return ' Gespeicherte Eintragungen wurden wiederhergestellt.';
    }
    if (status === 'pending') {
      return ' Gespeicherte Eintragungen liegen vor; sie werden übernommen, sobald dieselben Trainingsdaten erneut geladen werden.';
    }
    if (status === 'too-large') {
      return ' Achtung: Der Bearbeitungsstand ist zu groß und konnte nicht gespeichert werden.';
    }
    return '';
  }

  ns.progress = {
    init,
    save,
    statusText,
    /** @returns {boolean} true, wenn in der Lernplattform ein Stand gespeichert ist. */
    hasSaved: () => saved,
    // für Tests
    encodeRows,
    decodeRows,
    parse
  };
})(window.KNN = window.KNN || {});
