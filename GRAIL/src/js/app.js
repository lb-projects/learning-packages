/**
 * @file app.js
 * @description Einstiegspunkt der Anwendung: Seitennavigation, Verteilung von
 *              Graphänderungen an alle Seiten, Speicherung und SCORM-Abschluss.
 *
 * Navigation:
 *   Die fünf Seiten sind als Registerkarten (Tabs) umgesetzt und jederzeit frei anwählbar.
 *   Beim Wechsel bleibt der Zustand jeder Seite erhalten; eine laufende Automatik
 *   (Seiten 3 bis 5) wird angehalten. Die Navigation steht im gemeinsamen Modul tabs.js.
 *
 * Graphänderungen:
 *   graph.js meldet jede Änderung. app.js informiert ALLE Seiten und zeichnet die gerade
 *   sichtbare Seite neu; die anderen zeichnen sich beim nächsten Aufruf neu.
 *
 * SCORM (Datensparsamkeit):
 *   - Das Lernpaket gilt mit dem Öffnen als abgeschlossen: Beim Start wird
 *     cmi.core.lesson_status = "completed" gemeldet (ein bereits gemeldeter Abschluss
 *     bzw. "passed" bleibt unverändert).
 *   - Der Graph wird in cmi.suspend_data gespeichert und beim nächsten Öffnen
 *     wiederhergestellt (siehe progress.js). Beim Verlassen: cmi.core.exit = "suspend",
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

  /** Reihenfolge und Titel der Seiten. */
  const PAGES = [
    { id: 'input', title: 'Graph eingeben' },
    { id: 'representation', title: 'Darstellungen' },
    { id: 'bfs', title: 'Breitensuche' },
    { id: 'dfs', title: 'Tiefensuche' },
    { id: 'dijkstra', title: 'Dijkstra' }
  ];

  /** Tab-Navigation (gemeinsames Modul tabs.js); wird in start() eingerichtet. */
  let tabs = null;

  /** Zeigt in der Fußzeile, ob eine Verbindung zur Lernplattform besteht. */
  function renderProgress() {
    dom.byId('progress').textContent = scorm.isConnected()
      ? 'Verbunden mit der Lernplattform – das Lernpaket ist als abgeschlossen gemeldet. Der Graph wird gespeichert.' + ns.progress.statusText()
      : 'Offline-Modus (keine Lernplattform gefunden) – der Graph wird nicht gespeichert.';
  }

  /** Stellt die SCORM-Verbindung her und meldet den Abschluss (bereits beim Öffnen). */
  function initScorm() {
    if (!scorm.init({ suspendData: true })) {
      return;
    }
    const status = scorm.getValue('cmi.core.lesson_status');
    if (status !== 'completed' && status !== 'passed') {
      scorm.setValue('cmi.core.lesson_status', 'completed');
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
