/**
 * @file scorm-api.js
 * @description Schlanker Wrapper für die SCORM-1.2-Laufzeitschnittstelle (API-Adapter des LMS).
 *
 * Zweck:
 *   Sucht das vom LMS (z. B. Moodle) bereitgestellte Objekt `API` in der
 *   Fensterhierarchie und stellt einfache Funktionen zum Starten, Lesen,
 *   Schreiben, Speichern und Beenden der Sitzung bereit.
 *   Ohne LMS (z. B. lokaler Test im Browser) arbeitet das Paket im
 *   "Offline-Modus": alle Aufrufe sind dann wirkungslos, die Anwendung
 *   funktioniert trotzdem vollständig.
 *
 * Ablauf nach SCORM 1.2:
 *   LMSInitialize("") → LMSGetValue/LMSSetValue … → LMSCommit("") → LMSFinish("")
 *
 * Gemeinsamer Code beider Lernpakete (Quelle: shared/js/scorm-api.js).
 *
 * Abhängigkeiten:
 *   Keine.
 *
 * Datenschutz / Sicherheit:
 *   - Schreibzugriffe sind auf eine feste Liste von Datenelementen beschränkt
 *     (WRITABLE_ELEMENTS). So kann kein Programmteil versehentlich
 *     Daten, Eingaben oder andere Inhalte der Lernenden an das LMS übertragen.
 *   - cmi.suspend_data (gespeicherter Bearbeitungsstand) ist nur schreibbar,
 *     wenn ein Paket es beim Start ausdrücklich freigibt (init({suspendData: true}));
 *     die Länge ist auf SUSPEND_DATA_MAX Zeichen begrenzt (SCORM 1.2).
 *   - Lesend werden nur der bisherige Status (cmi.core.lesson_status) und ggf.
 *     cmi.suspend_data abgefragt; insbesondere wird der Name der Lernenden nicht gelesen.
 *   - Zugriffe auf fremde Fenster (andere Herkunft) werfen Ausnahmen; diese
 *     werden abgefangen, damit die Suche sauber endet.
 */
(function (ns) {
  'use strict';

  /** Maximale Anzahl an Elternfenstern, die bei der Suche durchlaufen werden. */
  const MAX_SEARCH_DEPTH = 10;

  /** Maximale Länge von cmi.suspend_data in SCORM 1.2. */
  const SUSPEND_DATA_MAX = 4096;

  /** Datenelemente, die dieses Paket schreiben darf (Whitelist; cmi.suspend_data nur nach Freigabe in init). */
  const WRITABLE_ELEMENTS = new Set([
    'cmi.core.lesson_status',
    'cmi.core.exit'
  ]);

  /** Gefundenes API-Objekt oder null (Offline-Modus). */
  let api = null;
  /** true, nachdem LMSInitialize erfolgreich war. */
  let initialized = false;
  /** true, nachdem LMSFinish aufgerufen wurde (danach keine Aufrufe mehr erlaubt). */
  let finished = false;

  /**
   * Durchläuft die Elternfenster ausgehend von `start` und sucht `API`.
   *
   * @param {Window} start - Fenster, bei dem die Suche beginnt.
   * @returns {Object|null} Das API-Objekt oder null.
   */
  function searchWindowChain(start) {
    let win = start;
    for (let depth = 0; win && depth <= MAX_SEARCH_DEPTH; depth++) {
      try {
        if (win.API && typeof win.API.LMSInitialize === 'function') {
          return win.API;
        }
        if (win.parent === win) {
          return null;
        }
        win = win.parent;
      } catch (e) {
        // Zugriff auf ein Fenster anderer Herkunft ist nicht erlaubt → Suche beenden.
        return null;
      }
    }
    return null;
  }

  /**
   * Sucht den SCORM-1.2-API-Adapter: zuerst in der eigenen Fensterhierarchie,
   * danach (bei Anzeige im Pop-up) in der Hierarchie des öffnenden Fensters.
   *
   * @returns {Object|null} Das API-Objekt oder null.
   */
  function findApi() {
    let found = searchWindowChain(window);
    if (!found) {
      try {
        if (window.opener) {
          found = searchWindowChain(window.opener);
        }
      } catch (e) {
        found = null;
      }
    }
    return found;
  }

  /**
   * Startet die SCORM-Sitzung.
   *
   * @param {{suspendData?: boolean}} [options] - suspendData: cmi.suspend_data zum Schreiben freigeben.
   * @returns {boolean} true, wenn eine Verbindung zum LMS besteht.
   */
  function init(options) {
    if (options && options.suspendData === true) {
      WRITABLE_ELEMENTS.add('cmi.suspend_data');
    }
    if (initialized) {
      return true;
    }
    api = findApi();
    if (!api) {
      return false;
    }
    try {
      initialized = String(api.LMSInitialize('')) === 'true';
    } catch (e) {
      initialized = false;
    }
    return initialized;
  }

  /**
   * @returns {boolean} true, wenn die Sitzung aktiv ist (verbunden und nicht beendet).
   */
  function isConnected() {
    return initialized && !finished;
  }

  /**
   * Liest ein Datenelement.
   *
   * @param {string} element - Name des Datenelements, z. B. "cmi.core.lesson_status".
   * @returns {string} Der Wert oder "" bei Fehler bzw. im Offline-Modus.
   */
  function getValue(element) {
    if (!isConnected()) {
      return '';
    }
    try {
      const value = api.LMSGetValue(element);
      return value === null || value === undefined ? '' : String(value);
    } catch (e) {
      return '';
    }
  }

  /**
   * Schreibt ein Datenelement (nur Elemente aus WRITABLE_ELEMENTS).
   *
   * @param {string} element - Name des Datenelements.
   * @param {string} value - Zu schreibender Wert.
   * @returns {boolean} true bei Erfolg.
   * @throws {Error} Wenn das Element nicht auf der Whitelist steht (Programmierfehler).
   */
  function setValue(element, value) {
    if (!WRITABLE_ELEMENTS.has(element)) {
      throw new Error('Schreibzugriff auf ' + element + ' ist nicht vorgesehen.');
    }
    const text = String(value);
    if (element === 'cmi.suspend_data' && text.length > SUSPEND_DATA_MAX) {
      return false;
    }
    if (!isConnected()) {
      return false;
    }
    try {
      return String(api.LMSSetValue(element, text)) === 'true';
    } catch (e) {
      return false;
    }
  }

  /**
   * Fordert das LMS auf, die bisher gesetzten Werte dauerhaft zu speichern.
   *
   * @returns {boolean} true bei Erfolg.
   */
  function commit() {
    if (!isConnected()) {
      return false;
    }
    try {
      return String(api.LMSCommit('')) === 'true';
    } catch (e) {
      return false;
    }
  }

  /**
   * Beendet die Sitzung. Mehrfache Aufrufe sind unschädlich.
   *
   * @returns {boolean} true, wenn die Sitzung beendet wurde.
   */
  function finish() {
    if (!isConnected()) {
      return false;
    }
    finished = true;
    try {
      return String(api.LMSFinish('')) === 'true';
    } catch (e) {
      return false;
    }
  }

  ns.scorm = { init, isConnected, getValue, setValue, commit, finish, SUSPEND_DATA_MAX };
})(window.LP = window.LP || {});
