/**
 * @file app.js
 * @description Einstiegspunkt der Anwendung: Seitennavigation, Verteilung von
 *              Datenänderungen an alle Seiten und SCORM-Fortschritt.
 *
 * Navigation:
 *   Die sieben Seiten sind als Registerkarten (Tabs) umgesetzt und jederzeit
 *   frei anwählbar. Beim Wechsel bleibt der Zustand jeder Seite erhalten.
 *   Bedienung per Maus, Tastatur (Pfeiltasten, Pos1/Ende auf der Tab-Leiste)
 *   sowie über "Zurück"/"Weiter" am Seitenende. ARIA-Rollen (tablist, tab,
 *   tabpanel) unterstützen Screenreader.
 *
 * Datenänderungen:
 *   dataset.js meldet jede Änderung. app.js informiert ALLE Seiten (damit
 *   z. B. Auswahlen und Eintragungen angepasst werden) und zeichnet die
 *   gerade sichtbare Seite neu. Die anderen Seiten zeichnen sich beim
 *   nächsten Aufruf mit den aktuellen Daten neu. Änderungen der Testdaten
 *   (Seite 7) laufen über einen eigenen Kanal und betreffen nur diese Seite.
 *
 * SCORM-Fortschritt (Datensparsamkeit):
 *   - Übertragen werden nur cmi.core.lesson_status ("incomplete"/"completed"),
 *     cmi.core.exit und in cmi.suspend_data die besuchten Seiten als
 *     Bitmaske (z. B. "v=1101001"). Trainings-, Testdaten und Eintragungen
 *     verlassen den Browser nicht.
 *   - "completed", sobald alle sieben Seiten besucht wurden.
 *   - Gespeicherte Masken der früheren Fassung mit sechs Seiten werden
 *     weiterhin gelesen (die siebte Seite gilt dann als nicht besucht).
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
    { id: 'training', title: 'Training' },
    { id: 'classify', title: 'Klassifizierung neuer Datenpunkte' },
    { id: 'k-effect', title: 'Auswirkungen des Parameters k' },
    { id: 'k-selection', title: 'Auswahl eines passenden Wertes für k' },
    { id: 'loo-manual', title: 'Leave One Out – Verfahren' },
    { id: 'loo-auto', title: 'Leave One Out – automatisiert' },
    { id: 'confusion', title: 'Test und Konfusionsmatrix' }
  ];

  /** ID der sichtbaren Seite. */
  let activeId = null;
  /** Bereits besuchte Seiten (Indizes). */
  const visited = new Set();
  /** true, wenn der Status "completed" bereits gemeldet wurde. */
  let completed = false;

  /**
   * Liefert das Tab-Element einer Seite.
   * @param {string} id - Seiten-ID.
   * @returns {HTMLElement} Tab-Schaltfläche.
   */
  function tabOf(id) {
    return dom.byId('tab-' + id);
  }

  /** Aktualisiert die Fortschrittsanzeige in der Fußzeile. */
  function renderProgress() {
    const text = 'Besuchte Seiten: ' + visited.size + ' von ' + PAGES.length +
      (scorm.isConnected() ? ' – Fortschritt wird an die Lernplattform gemeldet.' : ' – Offline-Modus (keine Lernplattform gefunden, Fortschritt wird nicht gespeichert).');
    dom.byId('progress').textContent = text;
  }

  /**
   * Merkt eine Seite als besucht und meldet den Fortschritt an das LMS.
   * @param {number} index - Index der Seite.
   */
  function markVisited(index) {
    if (visited.has(index)) {
      return;
    }
    visited.add(index);
    tabOf(PAGES[index].id).classList.add('visited');
    if (scorm.isConnected()) {
      const mask = PAGES.map((page, i) => (visited.has(i) ? '1' : '0')).join('');
      scorm.setValue('cmi.suspend_data', 'v=' + mask);
      if (visited.size === PAGES.length && !completed) {
        scorm.setValue('cmi.core.lesson_status', 'completed');
        completed = true;
      }
      scorm.commit();
    }
    renderProgress();
  }

  /**
   * Zeigt eine Seite an.
   * @param {string} id - Seiten-ID.
   * @param {Object} [options] - Optionen.
   * @param {boolean} [options.focusTab=false] - Fokus auf den Tab setzen (Tastaturbedienung).
   * @param {boolean} [options.scrollTop=false] - An den Seitenanfang scrollen.
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
    markVisited(index);
    if (opts.focusTab) {
      tabOf(id).focus();
    }
    if (opts.scrollTop) {
      window.scrollTo(0, 0);
    }
  }

  /**
   * Tastaturbedienung der Tab-Leiste (Pfeiltasten, Pos1, Ende).
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

  /** Stellt die SCORM-Verbindung her und liest den bisherigen Fortschritt. */
  function initScorm() {
    if (!scorm.init()) {
      return;
    }
    const status = scorm.getValue('cmi.core.lesson_status');
    completed = status === 'completed' || status === 'passed';
    if (status === '' || status === 'not attempted') {
      scorm.setValue('cmi.core.lesson_status', 'incomplete');
    }
    // Besuchte Seiten aus dem letzten Versuch wiederherstellen (striktes Format).
    // Erlaubt sind genau so viele Stellen wie Seiten oder 6 (frühere Fassung ohne Seite 7).
    const match = /^v=([01]{6,7})$/.exec(scorm.getValue('cmi.suspend_data'));
    if (match) {
      match[1].split('').forEach((bit, i) => {
        if (bit === '1' && i < PAGES.length) {
          visited.add(i);
          tabOf(PAGES[i].id).classList.add('visited');
        }
      });
    }
    scorm.commit();
  }

  /** Beendet die SCORM-Sitzung (beim Verlassen der Seite). */
  function finishScorm() {
    if (!scorm.isConnected()) {
      return;
    }
    // "suspend": Wiedereinstieg mit gespeichertem Fortschritt; nach Abschluss regulär beenden.
    scorm.setValue('cmi.core.exit', completed ? '' : 'suspend');
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
      ns.dataset.onChange((event) => {
        for (const page of PAGES) {
          ns.pages[page.id].onDataChange(event);
        }
        if (activeId) {
          ns.pages[activeId].render();
        }
      });
      ns.dataset.onTestChange((event) => {
        ns.pages.confusion.onTestChange(event);
        if (activeId === 'confusion') {
          ns.pages.confusion.render();
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
})(window.KNN = window.KNN || {});
