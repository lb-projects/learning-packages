/**
 * @file tabs.js
 * @description Seitennavigation über Registerkarten (Tabs) und „Zurück/Weiter“-Schaltflächen.
 *
 * Gemeinsamer Code der Lernpakete (Quelle: shared/js/tabs.js).
 *
 * Aufbau im HTML (je Seite):
 *   - Tab-Schaltfläche   <button role="tab" id="tab-<id>" aria-controls="page-<id>">
 *   - Seitenbereich      <section id="page-<id>" role="tabpanel">
 *
 * Verhalten:
 *   - Immer genau eine Seite ist sichtbar; die anderen werden nur ausgeblendet,
 *     ihr Zustand (Eingaben, Ergebnisse, Scrollpositionen) bleibt erhalten.
 *   - Bedienung per Maus, Tastatur (Pfeiltasten, Pos1/Ende auf der Tab-Leiste)
 *     sowie über „Zurück“/„Weiter“ am Ende jeder Seite.
 *
 * Abhängigkeiten:
 *   dom-utils.js
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;

  /**
   * Richtet die Navigation ein.
   *
   * @param {Array<{id:string, title:string}>} pages - Seiten in ihrer Reihenfolge.
   * @param {function(string): void} onShow - Wird nach dem Umschalten mit der Seiten-ID aufgerufen
   *   (z. B. um die Seite neu zu zeichnen).
   * @returns {{showPage: function(string, Object=): void, activeId: function(): (string|null)}} Steuerung.
   */
  function create(pages, onShow) {
    /** ID der sichtbaren Seite. */
    let activeId = null;

    /** @returns {HTMLElement} Tab-Schaltfläche einer Seite. */
    function tabOf(id) {
      return dom.byId('tab-' + id);
    }

    /**
     * Zeigt eine Seite an.
     *
     * @param {string} id - Seiten-ID.
     * @param {Object} [options] - {focusTab: Fokus auf den Tab setzen, scrollTop: an den Seitenanfang scrollen}.
     */
    function showPage(id, options) {
      const opts = options || {};
      const index = pages.findIndex((p) => p.id === id);
      if (index < 0) {
        return;
      }
      activeId = id;
      for (const page of pages) {
        const isActive = page.id === id;
        const tab = tabOf(page.id);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        tab.tabIndex = isActive ? 0 : -1;
        dom.byId('page-' + page.id).hidden = !isActive;
      }
      onShow(id);
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
      const index = pages.findIndex((p) => p.id === activeId);
      let next = null;
      if (event.key === 'ArrowRight') {
        next = (index + 1) % pages.length;
      } else if (event.key === 'ArrowLeft') {
        next = (index - 1 + pages.length) % pages.length;
      } else if (event.key === 'Home') {
        next = 0;
      } else if (event.key === 'End') {
        next = pages.length - 1;
      }
      if (next !== null) {
        event.preventDefault();
        showPage(pages[next].id, { focusTab: true });
      }
    }

    /** Fügt jeder Seite „Zurück“/„Weiter“-Schaltflächen hinzu. */
    function addPageNavigation() {
      pages.forEach((page, i) => {
        const nav = dom.el('nav', { class: 'page-nav', 'aria-label': 'Seitennavigation' });
        if (i > 0) {
          const prev = dom.el('button', { type: 'button', class: 'btn' }, '← ' + pages[i - 1].title);
          prev.addEventListener('click', () => showPage(pages[i - 1].id, { scrollTop: true }));
          nav.appendChild(prev);
        }
        if (i < pages.length - 1) {
          const next = dom.el('button', { type: 'button', class: 'btn btn-primary' }, pages[i + 1].title + ' →');
          next.addEventListener('click', () => showPage(pages[i + 1].id, { scrollTop: true }));
          nav.appendChild(next);
        }
        dom.byId('page-' + page.id).appendChild(nav);
      });
    }

    for (const page of pages) {
      const tab = tabOf(page.id);
      tab.addEventListener('click', () => showPage(page.id));
      tab.addEventListener('keydown', handleTabKey);
    }
    addPageNavigation();

    return { showPage, activeId: () => activeId };
  }

  ns.tabs = { create };
})(window.LP = window.LP || {});
