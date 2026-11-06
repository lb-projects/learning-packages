/**
 * @file pages/protocol.js
 * @description Seite 3: Protokoll des Trainings, älteste Einträge oben (Anzeige: protocol-view.js).
 *
 * Abhängigkeiten:
 *   dom-utils.js, protocol-view.js, format-utils.js, perceptron.js, session.js
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const session = ns.session;
  let view = null;

  /**
   * Zeilen eines Eintrags.
   * @param {Object} entry - Eintrag.
   * @returns {Array<{text:string, cls?:string}>} Zeilen.
   */
  function toLines(entry) {
    if (entry.kind === 'stage') {
      return [{ text: entry.text, cls: 'protocol-stage' }];
    }
    return ns.fmt.recordLines(entry, ns.perceptron.lineOf);
  }

  /** Zeichnet die Seite. */
  function render() {
    const dropped = session.droppedEntries();
    view.sync(session.log(), toLines, dropped > 0 ? 'Das Protokoll zeigt die letzten ' + session.MAX_LOG + ' Einträge; ' + dropped + ' ältere sind entfallen.' : '');
  }

  /** Richtet die Seite ein. */
  function init() {
    view = ns.protocolView.create(dom.byId('protocol-box'), {
      id: 'protocol-log',
      ariaLabel: 'Protokoll des Trainings',
      emptyText: 'Noch keine Einträge: Starten Sie das Training auf der Seite „Training“.'
    });
  }

  ns.pages.protocol = { init, render };
})(window.BB = window.BB || {});
