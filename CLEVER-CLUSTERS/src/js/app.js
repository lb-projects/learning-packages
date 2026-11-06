/**
 * @file app.js
 * @description Einstiegspunkt: Seitennavigation, Verteilung von Änderungen und SCORM-Abschluss.
 *
 * Navigation:
 *   Die sechs Seiten sind jederzeit frei anwählbar. Beim Wechsel bleibt jeder Stand erhalten; eine
 *   laufende Automatik hält an.
 *
 * SCORM (Datensparsamkeit):
 *   - Das Paket meldet beim Öffnen cmi.core.lesson_status = "incomplete" (nicht "completed"), damit
 *     Moodle beim erneuten Öffnen nicht den Überprüfungsmodus zeigt. Den Abschluss stellt die
 *     Lehrkraft in Moodle als manuellen Abschluss ein. Ein bereits gemeldeter Abschluss bleibt.
 *   - Es wird nichts gespeichert: Übertragen werden nur cmi.core.lesson_status und cmi.core.exit,
 *     cmi.suspend_data bleibt gesperrt.
 *
 * Abhängigkeiten:
 *   alle übrigen Module (werden in index.html vorher geladen).
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const scorm = ns.scorm;

  /** Status, die ein Versuch schon haben kann; sie bleiben unverändert. */
  const FINAL_STATES = new Set(['completed', 'passed', 'failed']);

  /** Reihenfolge und Titel der Seiten. */
  const PAGES = [
    { id: 'input', title: 'Daten und k' },
    { id: 'training', title: 'Training' },
    { id: 'hand', title: 'Von Hand rechnen' },
    { id: 'elbow', title: 'Ellbogen-Analyse' },
    { id: 'silhouette', title: 'Silhouetten-Analyse' },
    { id: 'images', title: 'Bilder und Objekte' }
  ];

  let tabs = null;

  /** Zeigt in der Fußzeile, ob eine Verbindung zur Lernplattform besteht. */
  function renderProgress() {
    dom.byId('progress').textContent = scorm.isConnected()
      ? 'Verbunden mit der Lernplattform – Daten und Eingaben werden nicht gespeichert.'
      : 'Offline-Modus (keine Lernplattform gefunden) – es wird nichts gespeichert.';
  }

  /** Stellt die SCORM-Verbindung her und meldet den Status „incomplete“ (siehe oben). */
  function initScorm() {
    if (!scorm.init()) {
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
      tabs = ns.tabs.create(PAGES, (id) => {
        if (id !== 'training') {
          ns.pages.training.pause();
        }
        ns.pages[id].render();
      });
      ns.session.onChange(() => {
        ns.pages.training.pause();
        if (tabs.activeId()) {
          ns.pages[tabs.activeId()].render();
        }
      });
      initScorm();
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
})(window.CC = window.CC || {});
