/**
 * @file app.js
 * @description Einstiegspunkt der Anwendung: Seitennavigation, Verteilung von
 *              Datenbankänderungen an alle Seiten und SCORM-Abschluss.
 *
 * Navigation:
 *   Die sechs Seiten sind als Registerkarten (Tabs) umgesetzt und jederzeit
 *   frei anwählbar. Beim Wechsel bleibt der Zustand jeder Seite erhalten
 *   (Eingaben, Ergebnisse, Scrollpositionen in Tabellen), weil die Seiten nur
 *   aus- und eingeblendet werden. Bedienung per Maus, Tastatur (Pfeiltasten,
 *   Pos1/Ende auf der Tab-Leiste) sowie über "Zurück"/"Weiter" am Seitenende.
 *   Die Navigation selbst steht im gemeinsamen Modul tabs.js (Kopie aus shared/).
 *
 * Datenbankänderungen:
 *   state.js meldet jede Änderung. app.js informiert ALLE Seiten und zeichnet
 *   die gerade sichtbare Seite neu; die anderen zeichnen sich beim nächsten Aufruf neu.
 *
 * SCORM-Abschluss (Datensparsamkeit):
 *   - Das Lernpaket meldet beim Öffnen cmi.core.lesson_status = "incomplete" (nicht
 *     "completed"), damit Moodle beim erneuten Öffnen nicht den Überprüfungsmodus zeigt.
 *     Den Abschluss stellt die Lehrkraft in Moodle als manuellen Abschluss ein. Ein bereits
 *     gemeldeter Abschluss (completed, passed, failed) bleibt unverändert.
 *   - Übertragen werden nur cmi.core.lesson_status und cmi.core.exit. Besuchte
 *     Seiten, Datenbanken und SQL-Eingaben verlassen den Browser nicht.
 *
 * Abhängigkeiten:
 *   alle übrigen Module (werden in index.html vorher geladen).
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const scorm = ns.scorm;

  /** Status, die ein Versuch aus einer früheren Version schon haben kann; sie bleiben unverändert. */
  const FINAL_STATES = new Set(['completed', 'passed', 'failed']);

  /** Reihenfolge und Titel der Seiten. */
  const PAGES = [
    { id: 'load', title: 'Datenbank laden' },
    { id: 'tables', title: 'Tabellen' },
    { id: 'query', title: 'SQL-Befehle' },
    { id: 'steps', title: 'Schritt für Schritt' },
    { id: 'diagram', title: 'Klassendiagramm' },
    { id: 'redundancy', title: 'Redundanzen' }
  ];

  /** Tab-Navigation (gemeinsames Modul tabs.js); wird in start() eingerichtet. */
  let tabs = null;

  /** Zeigt in der Fußzeile, ob eine Verbindung zur Lernplattform besteht. */
  function renderProgress() {
    dom.byId('progress').textContent = scorm.isConnected()
      ? 'Verbunden mit der Lernplattform.'
      : 'Offline-Modus (keine Lernplattform gefunden).';
  }

  /**
   * Zeigt eine Seite an (siehe tabs.js).
   *
   * @param {string} id - Seiten-ID.
   * @param {Object} [options] - {focusTab, scrollTop}.
   */
  function showPage(id, options) {
    tabs.showPage(id, options);
  }

  /** Stellt die SCORM-Verbindung her und meldet den Status „incomplete“ (siehe oben). */
  function initScorm() {
    if (!scorm.init()) {
      return;
    }
    // "incomplete" statt "completed": Ein abgeschlossener Versuch würde Moodle beim erneuten Öffnen
    // in den Überprüfungsmodus schalten. Ohne eigene Meldung setzt Moodle beim Beenden "completed".
    const status = scorm.getValue('cmi.core.lesson_status');
    if (!FINAL_STATES.has(status) && status !== 'incomplete') {
      scorm.setValue('cmi.core.lesson_status', 'incomplete');
    }
    scorm.commit();
  }

  /** Beendet die SCORM-Sitzung (beim Verlassen der Seite). */
  function finishScorm() {
    if (!scorm.isConnected()) {
      return;
    }
    // Reguläres Ende (kein "suspend"): Es gibt keinen Zwischenstand, der fortgesetzt werden müsste.
    scorm.setValue('cmi.core.exit', '');
    scorm.commit();
    scorm.finish();
  }

  /** Startet die Anwendung. */
  function start() {
    try {
      for (const page of PAGES) {
        ns.pages[page.id].init();
      }
      tabs = ns.tabs.create(PAGES, (id) => ns.pages[id].render());
      ns.state.onChange((event) => {
        for (const page of PAGES) {
          ns.pages[page.id].onDbChange(event);
        }
        if (tabs.activeId()) {
          ns.pages[tabs.activeId()].render();
        }
      });
      initScorm();
      window.addEventListener('pagehide', finishScorm);
      window.addEventListener('beforeunload', finishScorm);
      showPage(PAGES[0].id);
      renderProgress();
      dom.byId('app-error').hidden = true;
    } catch (error) {
      const box = dom.byId('app-error');
      box.textContent = 'Die Anwendung konnte nicht gestartet werden: ' + error.message;
      box.hidden = false;
    }
  }

  ns.app = { showPage, PAGES };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})(window.SQLSIM = window.SQLSIM || {});
