/**
 * @file app.js
 * @description Einstiegspunkt der Anwendung: Seitennavigation, Verteilung von
 *              Datenänderungen an alle Seiten und SCORM-Abschluss.
 *
 * Navigation:
 *   Die neun Seiten sind als Registerkarten (Tabs) umgesetzt und jederzeit
 *   frei anwählbar. Beim Wechsel bleibt der Zustand jeder Seite erhalten.
 *   Bedienung per Maus, Tastatur (Pfeiltasten, Pos1/Ende auf der Tab-Leiste)
 *   sowie über "Zurück"/"Weiter" am Seitenende. ARIA-Rollen (tablist, tab,
 *   tabpanel) unterstützen Screenreader. Die Navigation selbst steht im
 *   gemeinsamen Modul tabs.js (Kopie aus shared/).
 *
 * Datenänderungen:
 *   dataset.js meldet jede Änderung. app.js informiert ALLE Seiten (damit
 *   z. B. Auswahlen und Eintragungen angepasst werden) und zeichnet die
 *   gerade sichtbare Seite neu. Die anderen Seiten zeichnen sich beim
 *   nächsten Aufruf mit den aktuellen Daten neu. Änderungen der Testdaten
 *   (Seite 7) laufen über einen eigenen Kanal und betreffen nur diese Seite.
 *
 * SCORM-Abschluss (Datensparsamkeit):
 *   - Das Lernpaket meldet beim Öffnen cmi.core.lesson_status = "incomplete" (nicht
 *     "completed"), damit Moodle beim erneuten Öffnen nicht den Überprüfungsmodus zeigt.
 *     Den Abschluss stellt die Lehrkraft in Moodle als manuellen Abschluss ein. Ein bereits
 *     gemeldeter Abschluss (completed, passed, failed) bleibt unverändert.
 *   - Übertragen werden cmi.core.lesson_status, cmi.core.exit und in
 *     cmi.suspend_data der Bearbeitungsstand (Trainings- und Testdaten,
 *     Validierungsauswahl, Eintragungen der Seiten 4 und 5; siehe progress.js).
 *     Besuchte Seiten und alle übrigen Eingaben verlassen den Browser nicht.
 *   - Ist ein Stand gespeichert, endet die Sitzung mit cmi.core.exit = "suspend",
 *     damit die Lernplattform den Versuch beim nächsten Öffnen fortsetzt.
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
    { id: 'training', title: 'Training' },
    { id: 'classify', title: 'Klassifizierung neuer Datenpunkte' },
    { id: 'k-effect', title: 'Auswirkungen des Parameters k' },
    { id: 'k-selection', title: 'Auswahl eines passenden Wertes für k' },
    { id: 'loo-manual', title: 'Leave One Out – Verfahren' },
    { id: 'loo-auto', title: 'Leave One Out – automatisiert' },
    { id: 'confusion', title: 'Test und Konfusionsmatrix' },
    { id: 'normalization', title: 'Normalisierung' },
    { id: 'regression', title: 'Regression' }
  ];

  /** Tab-Navigation (gemeinsames Modul tabs.js); wird in start() eingerichtet. */
  let tabs = null;

  /** Zeigt in der Fußzeile, ob eine Verbindung zur Lernplattform besteht. */
  function renderProgress() {
    dom.byId('progress').textContent = scorm.isConnected()
      ? 'Verbunden mit der Lernplattform – Daten und Eintragungen werden gespeichert.' + ns.progress.statusText()
      : 'Offline-Modus (keine Lernplattform gefunden, Daten und Eintragungen werden nicht gespeichert).';
  }

  /**
   * Zeigt eine Seite an (siehe tabs.js).
   * @param {string} id - Seiten-ID.
   * @param {Object} [options] - {focusTab, scrollTop}.
   */
  function showPage(id, options) {
    tabs.showPage(id, options);
  }

  /** Stellt die SCORM-Verbindung her und meldet den Status „incomplete“ (siehe oben). */
  function initScorm() {
    if (!scorm.init({ suspendData: true })) {
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
    // "suspend": Die Lernplattform setzt den Versuch mit dem gespeicherten Stand fort.
    scorm.setValue('cmi.core.exit', ns.progress.hasSaved() ? 'suspend' : '');
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
      ns.dataset.onChange((event) => {
        for (const page of PAGES) {
          ns.pages[page.id].onDataChange(event);
        }
        if (tabs.activeId()) {
          ns.pages[tabs.activeId()].render();
        }
      });
      ns.dataset.onTestChange((event) => {
        ns.pages.confusion.onTestChange(event);
        if (tabs.activeId() === 'confusion') {
          ns.pages.confusion.render();
        }
      });
      initScorm();
      ns.progress.init({ onStatus: renderProgress });
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
})(window.KNN = window.KNN || {});
