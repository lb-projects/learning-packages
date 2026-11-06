/**
 * @file progress.js
 * @description Speichert Daten, Einstellungen und die Eingaben der Seiten 5 und 6 in der
 *              Lernplattform (SCORM 1.2, cmi.suspend_data) und stellt sie beim nächsten Öffnen wieder her.
 *
 * Wann gespeichert wird:
 *   Sofort bei jeder Änderung der Daten, nach jedem „Prüfen“, bei einer neuen Auswahl der Testdaten
 *   und beim Verlassen eines Felds. Beim Tippen 800 ms nach dem letzten Tastendruck, weil jede
 *   Speicherung eine Anfrage an die Lernplattform auslöst. Beim Verlassen der Seite wird Offenes
 *   sofort geschrieben.
 *
 * Format (JSON, Version 1, höchstens 4096 Zeichen):
 *   {"v":1, "c":[w₁,w₂,θ,Lernrate an,α,Skalierung an,Flächen an,Mischen an], …}
 *   - s: [Kennung, Stufe] bei einem unveränderten Beispiel; sonst
 *     n: [Attribut x, Attribut y], l: Labels, p: [[x, y, Index des Labels], …]
 *   - f: feuerndes Label, nur wenn es von der Voreinstellung abweicht
 *   - a: Aufgabe von Seite 5: 1, wenn sie mit Seite 1 übereinstimmt, sonst
 *     [Art, Stufe, w₁, w₂, θ, α, Skalierung, [Attribut x, Attribut y], Labels, [[x₁, x₂, t, Index des Labels, Original x, Original y], …]]
 *   - h: [richtige Zeilen, Fehlversuche, Hilfen, Fehlversuche der Zeile, Hilfestufe, …acht Felder der offenen Zeile]
 *   - t: [Anteil, [Indizes der Testpunkte]] (Seite 6)
 *   Nicht gespeichert werden der Trainingsstand der Seiten 2 und 6, Lernkurve, Testergebnis,
 *   Protokoll und der Punkt auf Seite 4.
 *   Passt der Stand nicht in 4096 Zeichen, wird stufenweise weggelassen: erst die offene Zeile,
 *   dann die Auswahl der Testdaten, dann der Stand und die Aufgabe von Seite 5, zuletzt die Punkte. Die
 *   Einstellungen bleiben. Die Fußzeile nennt, was fehlt.
 *
 * Abhängigkeiten:
 *   scorm-api.js, point-data.js, session.js, samples.js, pages/*
 *
 * Sicherheitsaspekte / Datenschutz:
 *   - Gespeichert wird nur in der Lernplattform (kein localStorage, keine Cookies) und nur bei
 *     bestehender SCORM-Verbindung. Der Name der Lernenden wird weder gelesen noch gespeichert.
 *   - Gespeichertes wird vor der Übernahme streng geprüft (Version, Typen, Grenzen, Labels und Zahlen
 *     über point-data.js, Beispiele nur per bekannter Kennung). Ungültiges wird verworfen.
 */
(function (ns) {
  'use strict';

  const VERSION = 1;
  /** Verzögerung beim Tippen in Millisekunden. */
  const TYPING_DELAY = 800;
  const ALPHA_MIN = 0.0001;

  /** Zustand: '' | 'saved' | 'draft-dropped' | 'test-dropped' | 'hand-dropped' | 'points-dropped' | 'error'. */
  let state = '';
  let hasText = false;
  let onStatus = () => {};
  let restoring = false;
  let timer = null;

  /**
   * Kompakte Einstellungen.
   * @returns {Array} Feld c.
   */
  function encodeConfig() {
    const c = ns.session.config;
    return [c.w[0], c.w[1], c.theta, c.alphaOn ? 1 : 0, c.alpha, c.scale ? 1 : 0, ns.session.showAreas() ? 1 : 0, ns.session.shuffle() ? 1 : 0];
  }

  /** @returns {boolean} true, wenn die Einstellungen den Voreinstellungen entsprechen. */
  function isDefaultConfig() {
    return JSON.stringify(encodeConfig()) === JSON.stringify([1, 1, 1, 0, 0.1, 0, 0, 0]);
  }

  /**
   * Kompakte Aufgabe von Seite 5.
   * @param {Object} task - Aufgabe.
   * @returns {Array} Feld a.
   */
  function encodeTask(task) {
    const labels = [...new Set(task.points.map((p) => p.label))];
    return [
      task.kind === 'random' ? 1 : 0, task.level || '', task.w[0], task.w[1], task.theta, task.alpha, task.scale ? 1 : 0,
      [task.attributes.x, task.attributes.y], labels,
      task.points.map((p) => [p.x[0], p.x[1], p.t, labels.indexOf(p.label), ...(p.raw || [])])
    ];
  }

  /**
   * Erzeugt den Text einer Speicherstufe.
   * @param {{points:boolean, hand:boolean, draft:boolean, test:boolean}} parts - Was enthalten ist.
   * @returns {string} JSON.
   */
  function encode(parts) {
    const data = ns.session.data;
    const obj = { v: VERSION, c: encodeConfig() };
    const ref = ns.session.sampleRef();
    const labels = data.labels();
    if (parts.points && ref) {
      obj.s = [ref.id, ref.stage];
    } else if (parts.points && data.count() > 0) {
      const attrs = data.attributes();
      obj.n = [attrs.x, attrs.y];
      obj.l = labels;
      obj.p = data.points().map((p) => [p.x, p.y, labels.indexOf(p.label)]);
    }
    if (parts.points && data.positive() !== null && data.positive() !== ns.pointData.autoPositive(labels)) {
      obj.f = data.positive();
    }
    const h = ns.pages.hand.exportState();
    if (parts.hand && h.task) {
      obj.a = h.matchesPageOne && parts.points ? 1 : encodeTask(h.task);
      if (ns.pages.hand.hasProgress()) {
        obj.h = [h.p, h.e, h.helps, h.rowErrors, h.helpLevel, ...(parts.draft ? h.draft : [])];
      }
    }
    const test = ns.pages.test.exportState();
    if (parts.points && parts.test && test) {
      obj.t = [test.f, test.s];
    }
    return JSON.stringify(obj);
  }

  /** Speichert sofort. */
  function save() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (restoring || !ns.scorm.isConnected()) {
      return;
    }
    let text = '';
    let next = 'saved';
    if (ns.session.data.count() > 0 || !isDefaultConfig() || ns.pages.hand.exportState().task) {
      const levels = [
        [{ points: true, hand: true, draft: true, test: true }, 'saved'],
        [{ points: true, hand: true, draft: false, test: true }, 'draft-dropped'],
        [{ points: true, hand: true, draft: false, test: false }, 'test-dropped'],
        [{ points: true, hand: false, draft: false, test: false }, 'hand-dropped'],
        [{ points: false, hand: false, draft: false, test: false }, 'points-dropped']
      ];
      const full = encode(levels[0][0]);
      for (const [parts, label] of levels) {
        const candidate = encode(parts);
        if (candidate.length <= ns.scorm.SUSPEND_DATA_MAX) {
          text = candidate;
          next = candidate === full ? 'saved' : label;
          break;
        }
      }
    }
    if (ns.scorm.setValue('cmi.suspend_data', text)) {
      ns.scorm.commit();
      hasText = text !== '';
    } else {
      next = 'error';
    }
    if (next !== state) {
      state = next;
      onStatus();
    }
  }

  /** Speichert kurz nach dem letzten Tastendruck. */
  function saveLater() {
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(save, TYPING_DELAY);
  }

  /** Schreibt Offenes sofort (beim Verlassen der Seite). */
  function flush() {
    if (timer !== null) {
      save();
    }
  }

  /**
   * Prüft und liest die Einstellungen.
   * @param {*} c - Feld c.
   * @returns {Object|null} Einstellungen oder null.
   */
  function decodeConfig(c) {
    if (!Array.isArray(c) || c.length !== 8) {
      return null;
    }
    const numbers = [c[0], c[1], c[2], c[4]].map((v) => (typeof v === 'number' ? ns.pointData.validateNumber(v, 'Wert') : { ok: false }));
    const flag = (v) => v === 0 || v === 1;
    if (!numbers.every((n) => n.ok) || !flag(c[3]) || !flag(c[5]) || !flag(c[6]) || !flag(c[7]) || numbers[3].value < ALPHA_MIN) {
      return null;
    }
    return { w: [numbers[0].value, numbers[1].value], theta: numbers[2].value, alphaOn: c[3] === 1, alpha: numbers[3].value, scale: c[5] === 1, areas: c[6] === 1, shuffle: c[7] === 1 };
  }

  /**
   * Prüft und liest eigene Punkte.
   * @param {Object} obj - Gespeicherter Stand.
   * @returns {{points:Array<Object>, names:Object}|null} Punkte oder null, wenn etwas ungültig ist.
   */
  function decodePoints(obj) {
    const limits = ns.pointData.LIMITS;
    if (!Array.isArray(obj.n) || obj.n.length !== 2 || !Array.isArray(obj.l) || obj.l.length > limits.maxLabels || !Array.isArray(obj.p) || obj.p.length > limits.maxPoints ||
        !obj.n.every((v) => typeof v === 'string')) {
      return null;
    }
    const labels = [];
    for (const l of obj.l) {
      const check = ns.pointData.validateLabel(l);
      if (!check.ok || typeof l !== 'string') {
        return null;
      }
      labels.push(check.value);
    }
    const points = [];
    for (const p of obj.p) {
      if (!Array.isArray(p) || p.length !== 3 || typeof p[0] !== 'number' || typeof p[1] !== 'number' || !Number.isInteger(p[2]) || p[2] < 0 || p[2] >= labels.length) {
        return null;
      }
      const x = ns.pointData.validateNumber(p[0], 'x');
      const y = ns.pointData.validateNumber(p[1], 'y');
      if (!x.ok || !y.ok) {
        return null;
      }
      points.push({ x: x.value, y: y.value, label: labels[p[2]] });
    }
    const fallback = ns.pointData.DEFAULT_ATTRIBUTES;
    return { points, names: { x: ns.pointData.sanitizeAttribute(obj.n[0], fallback.x), y: ns.pointData.sanitizeAttribute(obj.n[1], fallback.y) } };
  }

  /**
   * Prüft und liest die gespeicherte Aufgabe von Seite 5.
   * @param {*} a - Feld a.
   * @returns {Object|null} Aufgabe oder null.
   */
  function decodeTask(a) {
    const limits = ns.pointData.LIMITS;
    if (!Array.isArray(a) || a.length !== 10 || (a[0] !== 0 && a[0] !== 1) || (a[6] !== 0 && a[6] !== 1) || !Array.isArray(a[7]) || a[7].length !== 2 ||
        !a[7].every((v) => typeof v === 'string') || !Array.isArray(a[8]) || a[8].length > limits.maxLabels || !Array.isArray(a[9]) || a[9].length === 0 || a[9].length > limits.maxPoints) {
      return null;
    }
    const number = (v) => (typeof v === 'number' ? ns.pointData.validateNumber(v, 'Wert') : { ok: false });
    const values = [a[2], a[3], a[4]].map(number);
    if (!values.every((v) => v.ok) || (a[5] !== null && (!number(a[5]).ok || number(a[5]).value < ALPHA_MIN))) {
      return null;
    }
    const labels = a[8].map((l) => (typeof l === 'string' ? ns.pointData.validateLabel(l) : { ok: false }));
    if (!labels.every((l) => l.ok)) {
      return null;
    }
    const level = a[0] === 1 ? ns.taskGenerator.LEVELS.find((l) => l.id === a[1]) : null;
    if (a[0] === 1 && !level) {
      return null;
    }
    const points = [];
    for (const p of a[9]) {
      if (!Array.isArray(p) || (p.length !== 4 && p.length !== 6) || (p[2] !== 0 && p[2] !== 1) || !Number.isInteger(p[3]) || p[3] < 0 || p[3] >= labels.length) {
        return null;
      }
      const coords = [p[0], p[1], ...p.slice(4)].map(number);
      if (!coords.every((v) => v.ok)) {
        return null;
      }
      points.push({ x: [coords[0].value, coords[1].value], raw: coords.length === 4 ? [coords[2].value, coords[3].value] : null, t: p[2], label: labels[p[3]].value, group: null, stage: null });
    }
    const fallback = ns.pointData.DEFAULT_ATTRIBUTES;
    const task = {
      kind: a[0] === 1 ? 'random' : 'page1',
      points, w: [values[0].value, values[1].value], theta: values[2].value, alpha: a[5], scale: a[6] === 1,
      attributes: { x: ns.pointData.sanitizeAttribute(a[7][0], fallback.x), y: ns.pointData.sanitizeAttribute(a[7][1], fallback.y) }
    };
    if (level) {
      task.level = level.id;
    } else {
      task.key = '';
    }
    return task;
  }

  /**
   * Prüft einen gespeicherten Stand, ohne etwas zu verändern.
   * @param {string} text - Inhalt von cmi.suspend_data.
   * @returns {Object|null} Gelesener Stand oder null.
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
    if (!obj || typeof obj !== 'object' || Array.isArray(obj) || obj.v !== VERSION) {
      return null;
    }
    const config = decodeConfig(obj.c);
    if (!config) {
      return null;
    }
    const out = { config };
    if (obj.s !== undefined) {
      const sample = Array.isArray(obj.s) && obj.s.length === 2 ? ns.samples.find((s) => s.id === obj.s[0]) : null;
      if (!sample || !Number.isInteger(obj.s[1]) || obj.s[1] < 1 || obj.s[1] > sample.stages.length) {
        return null;
      }
      out.sample = { id: sample.id, stage: obj.s[1] };
    } else if (obj.p !== undefined) {
      out.own = decodePoints(obj);
      if (!out.own) {
        return null;
      }
    }
    if (typeof obj.f === 'string') {
      out.positive = obj.f;
    }
    if (obj.a === 1) {
      out.hand = { samePageOne: true };
    } else if (obj.a !== undefined) {
      const task = decodeTask(obj.a);
      out.hand = task ? { task } : null;
    }
    if (out.hand) {
      const h = Array.isArray(obj.h) && (obj.h.length === 5 || obj.h.length === 13) ? obj.h : [0, 0, 0, 0, 0];
      Object.assign(out.hand, { p: h[0], e: h[1], helps: h[2], rowErrors: h[3], helpLevel: h[4], draft: h.length === 13 ? h.slice(5) : Array(8).fill('') });
    }
    if (Array.isArray(obj.t) && obj.t.length === 2) {
      out.test = { f: obj.t[0], s: obj.t[1] };
    }
    return out;
  }

  /**
   * Stellt den gespeicherten Stand wieder her.
   * @returns {boolean} true, wenn ein Stand übernommen wurde.
   */
  function restore() {
    if (!ns.scorm.isConnected()) {
      return false;
    }
    const saved = decode(ns.scorm.getValue('cmi.suspend_data'));
    if (!saved) {
      return false;
    }
    restoring = true;
    try {
      ns.session.setShowAreas(saved.config.areas);
      const { areas, shuffle, ...config } = saved.config;
      ns.session.setShuffle(shuffle);
      ns.session.setConfig(config);
      ns.pages.input.syncFields();
      if (saved.sample) {
        ns.session.panel.restoreSample(saved.sample.id, saved.sample.stage);
      } else if (saved.own) {
        ns.session.data.replaceAll(saved.own.points, saved.own.names);
      }
      if (saved.positive) {
        ns.session.data.setPositive(saved.positive);
      }
      ns.pages.hand.importState(saved.hand || null);
      ns.pages.test.importState(saved.test || null);
      state = 'saved';
      hasText = true;
      return true;
    } catch (e) {
      return false;
    } finally {
      restoring = false;
    }
  }

  /**
   * Richtet die Speicherung ein: stellt den letzten Stand wieder her und speichert ab dann jede Änderung.
   * @param {{onStatus:function():void}} options - onStatus: bei Änderung des Speicherstatus.
   * @returns {boolean} true, wenn ein Stand übernommen wurde.
   */
  function init(options) {
    onStatus = (options && options.onStatus) || onStatus;
    const restored = restore();
    ns.session.onChange((kind) => {
      if (kind === 'config') {
        saveLater();
      } else {
        save();
      }
    });
    return restored;
  }

  /** @returns {string} Zusatz für die Fußzeile ("" wenn alles gespeichert ist). */
  function statusText() {
    const texts = {
      'draft-dropped': ' Hinweis: Wegen der Größe wird die offene Zeile auf Seite 5 nicht gespeichert.',
      'test-dropped': ' Hinweis: Wegen der Größe werden die offene Zeile auf Seite 5 und die Auswahl der Testdaten nicht gespeichert.',
      'hand-dropped': ' Hinweis: Wegen der Größe werden der Stand von Seite 5 und die Auswahl der Testdaten nicht gespeichert.',
      'points-dropped': ' Achtung: Es sind zu viele Punkte zum Speichern; gespeichert werden nur die Einstellungen.',
      error: ' Achtung: Der Stand konnte nicht gespeichert werden.'
    };
    return texts[state] || '';
  }

  /** @returns {boolean} true, wenn ein Stand gespeichert ist (für cmi.core.exit = "suspend"). */
  function hasSaved() {
    return hasText && state !== 'error';
  }

  ns.progress = { init, save, saveLater, flush, restore, decode, statusText, hasSaved, state: () => state };
})(window.BB = window.BB || {});
