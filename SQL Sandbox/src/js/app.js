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
 *
 * Datenbankänderungen:
 *   state.js meldet jede Änderung. app.js informiert ALLE Seiten und zeichnet
 *   die gerade sichtbare Seite neu; die anderen zeichnen sich beim nächsten Aufruf neu.
 *
 * SCORM-Abschluss (Datensparsamkeit):
 *   - Das Lernpaket gilt mit dem Öffnen als abgeschlossen: Beim Start wird
 *     cmi.core.lesson_status = "completed" gemeldet (ein bereits gemeldeter
 *     Abschluss bzw. "passed" bleibt unverändert).
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

  /** Reihenfolge und Titel der Seiten. */
  const PAGES = [
    { id: 'load', title: 'Datenbank laden' },
    { id: 'tables', title: 'Tabellen' },
    { id: 'query', title: 'SQL-Befehle' },
    { id: 'steps', title: 'Schritt für Schritt' },
    { id: 'diagram', title: 'Klassendiagramm' },
    { id: 'redundancy', title: 'Redundanzen' }
  ];

  /** ID der sichtbaren Seite. */
  let activeId = null;

  /**
   * @param {string} id - Seiten-ID.
   * @returns {HTMLElement} Tab-Schaltfläche.
   */
  function tabOf(id) {
    return dom.byId('tab-' + id);
  }

  /** Zeigt in der Fußzeile, ob eine Verbindung zur Lernplattform besteht. */
  function renderProgress() {
    dom.byId('progress').textContent = scorm.isConnected()
      ? 'Verbunden mit der Lernplattform – das Lernpaket ist als abgeschlossen gemeldet.'
      : 'Offline-Modus (keine Lernplattform gefunden).';
  }

  /**
   * Zeigt eine Seite an.
   *
   * @param {string} id - Seiten-ID.
   * @param {Object} [options] - {focusTab: Fokus auf den Tab setzen, scrollTop: an den Seitenanfang scrollen}.
   */
  function showPage(id, options) {
    const opts = options || {};
    const index = PAGES.findIndex((p) => p.id === id);
    if (index < 0) {
      return;
    }
    activeId = id;
    for (const page of PAGES) {
      const isActive = page.id === id;
      const tab = tabOf(page.id);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      tab.tabIndex = isActive ? 0 : -1;
      dom.byId('page-' + page.id).hidden = !isActive;
    }
    ns.pages[id].render();
    if (opts.focusTab) {
      tabOf(id).focus();
    }
    if (opts.scrollTop) {
      window.scrollTo(0, 0);
    }
  }

  /**
   * Tastaturbedienung der Tab-Leiste (Pfeiltasten, Pos1, Ende).
   *
   * @param {KeyboardEvent} event - Tastaturereignis.
   */
  function handleTabKey(event) {
    const index = PAGES.findIndex((p) => p.id === activeId);
    let next = null;
    if (event.key === 'ArrowRight') {
      next = (index + 1) % PAGES.length;
    } else if (event.key === 'ArrowLeft') {
      next = (index - 1 + PAGES.length) % PAGES.length;
    } else if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = PAGES.length - 1;
    }
    if (next !== null) {
      event.preventDefault();
      showPage(PAGES[next].id, { focusTab: true });
    }
  }

  /** Fügt jeder Seite "Zurück"/"Weiter"-Schaltflächen hinzu. */
  function addPageNavigation() {
    PAGES.forEach((page, i) => {
      const nav = dom.el('nav', { class: 'page-nav', 'aria-label': 'Seitennavigation' });
      if (i > 0) {
        const prev = dom.el('button', { type: 'button', class: 'btn' }, '← ' + PAGES[i - 1].title);
        prev.addEventListener('click', () => showPage(PAGES[i - 1].id, { scrollTop: true }));
        nav.appendChild(prev);
      }
      if (i < PAGES.length - 1) {
        const next = dom.el('button', { type: 'button', class: 'btn btn-primary' }, PAGES[i + 1].title + ' →');
        next.addEventListener('click', () => showPage(PAGES[i + 1].id, { scrollTop: true }));
        nav.appendChild(next);
      }
      dom.byId('page-' + page.id).appendChild(nav);
    });
  }

  /** Stellt die SCORM-Verbindung her und meldet den Abschluss (bereits beim Öffnen). */
  function initScorm() {
    if (!scorm.init()) {
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
      for (const page of PAGES) {
        const tab = tabOf(page.id);
        tab.addEventListener('click', () => showPage(page.id));
        tab.addEventListener('keydown', handleTabKey);
      }
      addPageNavigation();
      ns.state.onChange((event) => {
        for (const page of PAGES) {
          ns.pages[page.id].onDbChange(event);
        }
        if (activeId) {
          ns.pages[activeId].render();
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
