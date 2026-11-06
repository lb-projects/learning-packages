/**
 * @file app.js
 * @description Einstiegspunkt: Seitennavigation, Verteilung von Änderungen und SCORM-Abschluss.
 *
 * Navigation:
 *   Die sechs Seiten sind jederzeit frei anwählbar. Beim Wechsel bleibt das Training
 *   unverändert, auch mitten in einem Trainingspunkt; eine laufende Automatik hält an.
 *
 * SCORM (Datensparsamkeit):
 *   - Das Paket meldet beim Öffnen cmi.core.lesson_status = "incomplete" (nicht "completed"), damit
 *     Moodle beim erneuten Öffnen nicht den Überprüfungsmodus zeigt. Den Abschluss stellt die
 *     Lehrkraft in Moodle als manuellen Abschluss ein. Ein bereits gemeldeter Abschluss bleibt.
 *   - Daten, Einstellungen und die Eingaben der Seiten 5 und 6 werden in cmi.suspend_data gespeichert
 *     und beim nächsten Öffnen wiederhergestellt (siehe progress.js). Beim Verlassen: cmi.core.exit =
 *     "suspend", wenn ein Stand gespeichert ist.
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
    { id: 'input', title: 'Daten und Perzeptron' },
    { id: 'training', title: 'Training' },
    { id: 'protocol', title: 'Protokoll' },
    { id: 'classify', title: 'Punkt klassifizieren' },
    { id: 'hand', title: 'Von Hand rechnen' },
    { id: 'test', title: 'Test und Konfusionsmatrix' }
  ];

  let tabs = null;

  /** Zeigt in der Fußzeile, ob eine Verbindung zur Lernplattform besteht. */
  function renderProgress() {
    dom.byId('progress').textContent = scorm.isConnected()
      ? 'Verbunden mit der Lernplattform – Daten, Einstellungen und Eingaben werden gespeichert.' + ns.progress.statusText()
      : 'Offline-Modus (keine Lernplattform gefunden) – es wird nichts gespeichert.';
  }

  /** Stellt die SCORM-Verbindung her und meldet den Status „incomplete“ (siehe oben). */
  function initScorm() {
    if (!scorm.init({ suspendData: true })) {
      return;
    }
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
    ns.progress.flush();
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
        if (id !== 'training') {
          ns.pages.training.pause();
        }
        if (id !== 'test') {
          ns.pages.test.pause();
        }
        ns.pages[id].render();
      });
      ns.session.onChange(() => {
        ns.pages.training.pause();
        ns.pages.test.pause();
        if (tabs.activeId()) {
          ns.pages[tabs.activeId()].render();
        }
      });
      initScorm();
      ns.progress.init({ onStatus: renderProgress });
      window.addEventListener('pagehide', finishScorm);
      window.addEventListener('beforeunload', finishScorm);
      tabs.showPage(PAGES[0].id);
      renderProgress();
      dom.byId('app-error').hidden = true;
    } catch (error) {
      const box = dom.byId('app-error');
      box.textContent = 'Die Anwendung konnte nicht gestartet werden: ' + error.message;
      box.hidden = false;
    }
  }

  ns.app = { showPage: (id, options) => tabs.showPage(id, options), PAGES };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})(window.BB = window.BB || {});
