// Kopie aus shared/js/protocol-view.js – nicht hier bearbeiten: Änderungen in shared/ vornehmen und sync-shared.mjs ausführen.
/**
 * @file protocol-view.js
 * @description Scrollbares Protokoll: älteste Einträge oben, neue werden angehängt.
 *
 * Einträge:
 *   sync(list, toLines, notice) erhält die aktuellen Einträge. Jeder Eintrag hat eine fortlaufende
 *   Nummer seq. toLines(entry) liefert seine Zeilen als [{text, cls?}]; die Inhalte kommen vom Paket.
 *   Damit lange Läufe den Browser nicht bremsen, werden nur neue Einträge und der letzte erzeugt.
 *   Der letzte Eintrag darf sich noch ändern, die älteren nicht. Einträge, die nicht mehr in
 *   der Liste stehen, werden entfernt.
 *
 * Scrollen:
 *   Wer am Ende des Protokolls steht, bleibt dort, wenn neue Einträge dazukommen.
 *   Wer nach oben gescrollt hat, bleibt an seiner Stelle.
 *
 * Gemeinsamer Code der Simulator-Pakete (Quelle: shared/js/protocol-view.js).
 *
 * Abhängigkeiten:
 *   dom-utils.js
 *
 * Sicherheitsaspekte:
 *   Zeilen werden nur als Text eingefügt.
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;

  /** Abstand zum Ende in Bildpunkten, der noch als „am Ende“ gilt. */
  const BOTTOM_TOLERANCE = 24;

  /**
   * Erzeugt ein Protokoll.
   *
   * @param {HTMLElement} container - Behälter (wird geleert).
   * @param {{id:string, ariaLabel?:string, emptyText?:string}} options - Element-ID, Beschreibung, Text ohne Einträge.
   * @returns {{sync:function(Array, function(Object):Array, string=):void, clear:function():void}} Steuerung.
   */
  function create(container, options) {
    const notice = dom.el('p', { class: 'notice', id: options.id + '-notice', hidden: true });
    const empty = dom.el('p', { class: 'hint', id: options.id + '-empty' }, options.emptyText || 'Noch keine Einträge.');
    const log = dom.el('div', { class: 'protocol', id: options.id, tabindex: '0', role: 'log', 'aria-label': options.ariaLabel || 'Protokoll' });
    dom.clear(container);
    dom.appendChildren(container, [notice, empty, log]);
    let stickToEnd = true;

    log.addEventListener('scroll', () => {
      if (log.clientHeight > 0) {
        stickToEnd = log.scrollHeight - log.scrollTop - log.clientHeight <= BOTTOM_TOLERANCE;
      }
    });

    /**
     * Erzeugt das Element eines Eintrags.
     * @param {Object} entry - Eintrag.
     * @param {function(Object):Array} toLines - Liefert die Zeilen.
     * @returns {HTMLElement} Element.
     */
    function build(entry, toLines) {
      return dom.el('div', { class: 'protocol-entry', 'data-seq': entry.seq },
        toLines(entry).map((line) => dom.el('p', { class: 'protocol-line' + (line.cls ? ' ' + line.cls : '') }, line.text)));
    }

    /**
     * Gleicht die Anzeige mit den Einträgen ab.
     *
     * @param {Array<{seq:number}>} list - Einträge, älteste zuerst.
     * @param {function(Object):Array} toLines - Liefert die Zeilen eines Eintrags.
     * @param {string} [noticeText] - Hinweis über dem Protokoll (z. B. entfallene Einträge).
     */
    function sync(list, toLines, noticeText) {
      notice.textContent = noticeText || '';
      notice.hidden = !noticeText;
      empty.hidden = list.length > 0;
      log.hidden = list.length === 0;
      const first = list.length ? list[0].seq : Infinity;
      while (log.firstChild && Number(log.firstChild.dataset.seq) < first) {
        log.removeChild(log.firstChild);
      }
      if (list.length === 0) {
        dom.clear(log);
        stickToEnd = true;
        return;
      }
      // Der zuletzt gezeigte Eintrag kann sich geändert haben; er wird neu erzeugt.
      let lastShown = -1;
      if (log.lastChild) {
        lastShown = Number(log.lastChild.dataset.seq);
        const stale = list.find((e) => e.seq === lastShown);
        if (stale) {
          log.replaceChild(build(stale, toLines), log.lastChild);
        }
      }
      for (const entry of list) {
        if (entry.seq > lastShown) {
          log.appendChild(build(entry, toLines));
        }
      }
      if (stickToEnd) {
        log.scrollTop = log.scrollHeight;
      }
    }

    /** Leert das Protokoll. */
    function clear() {
      sync([], () => []);
    }

    return { sync, clear };
  }

  ns.protocolView = { create };
})(window.BB = window.BB || {});
