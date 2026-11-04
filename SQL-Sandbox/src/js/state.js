/**
 * @file state.js
 * @description Zentraler Zustand: die aktuell geladene Datenbank.
 *
 * Zweck:
 *   Alle Seiten lesen die Datenbank von hier. Änderungen werden über
 *   Ereignisse gemeldet:
 *     "load"   – eine Datenbank wurde geladen (Seite 1),
 *     "change" – Seite 3 hat Daten geändert (INSERT/UPDATE/DELETE),
 *     "reset"  – die Datenbank wurde auf den geladenen Stand zurückgesetzt.
 *
 * Datenschutz:
 *   Die Datenbank liegt nur im Arbeitsspeicher des Browsers. Es gibt keine
 *   Speicherung im Browser (Web Storage, Cookies) und keine Übertragung an
 *   die Lernplattform.
 *
 * Abhängigkeiten:
 *   Keine.
 */
(function (ns) {
  'use strict';

  /** Aktuelle Datenbank oder null. */
  let current = null;
  /** Stand direkt nach dem Laden (für "Zurücksetzen"). */
  let original = null;
  /** Anzeigename und Herkunft der geladenen Datenbank. */
  let info = { name: '', kind: '' };
  /** true, wenn Seite 3 Daten geändert hat. */
  let dirty = false;
  /** Registrierte Beobachter. */
  const listeners = [];

  /**
   * Benachrichtigt alle Beobachter.
   *
   * @param {string} type - "load", "change" oder "reset".
   */
  function emit(type) {
    for (const listener of listeners) {
      listener({ type });
    }
  }

  ns.state = {
    /** @returns {Object|null} Aktuelle Datenbank. */
    db() {
      return current;
    },

    /** @returns {{name:string, kind:string, dirty:boolean}} Angaben zur geladenen Datenbank. */
    info() {
      return { name: info.name, kind: info.kind, dirty };
    },

    /**
     * Übernimmt eine neu geladene Datenbank.
     *
     * @param {Object} db - Datenbank.
     * @param {string} name - Anzeigename (z. B. "Schule" oder Dateiname).
     * @param {string} kind - "sample" oder "file".
     */
    load(db, name, kind) {
      current = db;
      original = db.clone();
      info = { name, kind };
      dirty = false;
      emit('load');
    },

    /**
     * Übernimmt die durch Seite 3 geänderte Datenbank.
     *
     * @param {Object} db - Geänderte Datenbank.
     */
    commit(db) {
      current = db;
      dirty = true;
      emit('change');
    },

    /**
     * Stellt den Stand nach dem letzten Laden wieder her.
     *
     * @returns {boolean} false, wenn noch keine Datenbank geladen ist.
     */
    reset() {
      if (!original) {
        return false;
      }
      current = original.clone();
      dirty = false;
      emit('reset');
      return true;
    },

    /**
     * Registriert einen Beobachter.
     *
     * @param {function({type:string}):void} listener - Wird bei jeder Änderung aufgerufen.
     */
    onChange(listener) {
      listeners.push(listener);
    }
  };
})(window.SQLSIM = window.SQLSIM || {});
