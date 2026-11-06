/**
 * @file app.js
 * @description Einstiegspunkt der Anwendung: Seitennavigation, Verteilung von
 *              Graphänderungen an alle Seiten, Speicherung und SCORM-Abschluss.
 *
 * Navigation:
 *   Die sechs Seiten sind als Registerkarten (Tabs) umgesetzt und jederzeit frei anwählbar.
 *   Beim Wechsel bleibt der Zustand jeder Seite erhalten; eine laufende Automatik
 *   (Seiten 3 bis 5) wird angehalten. Die Navigation steht im gemeinsamen Modul tabs.js.
 *
 * Graphänderungen:
 *   graph.js meldet jede Änderung. app.js informiert ALLE Seiten und zeichnet die gerade
 *   sichtbare Seite neu; die anderen zeichnen sich beim nächsten Aufruf neu.
 *
 * SCORM (Datensparsamkeit):
 *   - Das Lernpaket meldet beim Öffnen cmi.core.lesson_status = "incomplete" (nicht
 *     "completed"), damit Moodle beim erneuten Öffnen nicht den Überprüfungsmodus zeigt.
 *     Den Abschluss stellt die Lehrkraft in Moodle als manuellen Abschluss ein. Ein bereits
 *     gemeldeter Abschluss (completed, passed, failed) bleibt unverändert.
 *   - Der Graph und der Stand des Trainings werden in cmi.suspend_data gespeichert und
 *     beim nächsten Öffnen wiederhergestellt (siehe progress.js). Beim Verlassen: cmi.core.exit = "suspend",
 *     wenn ein Graph gespeichert ist.
 *   - Übertragen werden nur cmi.core.lesson_status, cmi.core.exit und cmi.suspend_data.
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
    { id: 'input', title: 'Graph eingeben' },
    { id: 'representation', title: 'Darstellungen' },
    { id: 'bfs', title: 'Breitensuche' },
    { id: 'dfs', title: 'Tiefensuche' },
    { id: 'dijkstra', title: 'Dijkstra' },
    { id: 'training', title: 'Training' }
  ];

  /** Tab-Navigation (gemeinsames Modul tabs.js); wird in start() eingerichtet. */
  let tabs = null;

  /** Zeigt in der Fußzeile, ob eine Verbindung zur Lernplattform besteht. */
  function renderProgress() {
    dom.byId('progress').textContent = scorm.isConnected()
      ? 'Verbunden mit der Lernplattform – der Graph und der Stand des Trainings werden gespeichert.' + ns.progress.statusText()
      : 'Offline-Modus (keine Lernplattform gefunden) – Graph und Training werden nicht gespeichert.';
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
      tabs = ns.tabs.create(PAGES, (id) => {
        for (const page of PAGES) {
          if (page.id !== id && ns.pages[page.id].pause) {
            ns.pages[page.id].pause();
          }
        }
        ns.pages[id].render();
      });
      ns.graph.onChange((event) => {
        for (const page of PAGES) {
          ns.pages[page.id].onGraphChange(event);
        }
        if (tabs.activeId()) {
          ns.pages[tabs.activeId()].render();
        }
      });
      initScorm();
      ns.progress.init({ onStatus: renderProgress });
      window.addEventListener('pagehide', finishScorm);
      window.addEventListener('beforeunload', finishScorm);
      showFirstPage();
      renderProgress();
      dom.byId('app-error').hidden = true;
    } catch (error) {
      const box = dom.byId('app-error');
      box.textContent = 'Die Anwendung konnte nicht gestartet werden: ' + error.message;
      box.hidden = false;
    }
  }

  /** Zeigt Seite 1. */
  function showFirstPage() {
    tabs.showPage(PAGES[0].id);
  }

  ns.app = { showPage: (id, options) => tabs.showPage(id, options), PAGES };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})(window.HG = window.HG || {});
