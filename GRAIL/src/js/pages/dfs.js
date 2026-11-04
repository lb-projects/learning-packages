/**
 * @file pages/dfs.js
 * @description Seite 4 „Tiefensuche“: rekursiver Ablauf Schritt für Schritt mit Aufrufstapel,
 *              Besuchsreihenfolge und Vorgänger; am Ende Spannbaum (DFS-Baum).
 *
 * Abhängigkeiten:
 *   dom-utils.js, format-utils.js, algorithms.js, pages/common.js
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const u = ns.pageUtils;

  /** Bezeichnung der Zustände auf dieser Seite. */
  const STATE_TEXT = new Map([
    ['unvisited', 'nicht besucht'],
    ['frontier', 'wartet'],
    ['current', 'aktiv'],
    ['done', 'beendet']
  ]);

  /**
   * Zeigt die Datenstrukturen eines Schritts.
   * @param {Object} step - Schritt.
   * @param {HTMLElement} box - Behälter.
   */
  function renderData(step, box) {
    const d = step.data;
    box.appendChild(dom.el('h3', null, 'Aufrufstapel'));
    box.appendChild(dom.el('p', { class: 'hint' }, 'unten der erste Aufruf, oben der gerade aktive'));
    box.appendChild(u.boxList(d.stack.map((n) => 'DFS(' + n + ')').reverse(), { empty: 'leer', highlightFirst: true, vertical: true }));
    box.appendChild(dom.el('h3', { class: 'mt' }, 'Besuchsreihenfolge'));
    box.appendChild(u.boxList(d.order, { empty: 'noch keiner' }));
    box.appendChild(u.table(['Knoten', 'Zustand', 'besucht', 'beendet', 'Vorgänger'], d.rows.map((r) => [
      r.name,
      STATE_TEXT.get(r.state) || r.state,
      r.number === null ? '–' : String(r.number),
      r.finished === null ? '–' : String(r.finished),
      r.pred === null ? '–' : r.pred
    ]), { caption: 'besucht / beendet: Nummer in der Reihenfolge des Besuchens bzw. Beendens; wartet = auf dem Stapel', numeric: [2, 3], rowClass: (i) => (d.rows[i].state === 'current' ? 'selected' : null) }));
  }

  ns.pages = ns.pages || {};
  ns.pages.dfs = u.createAlgorithmPage({
    id: 'dfs',
    run: (snap, start, target) => ns.algorithms.dfs(snap, start, target),
    renderData,
    spanningTree: true,
    legend: [
      { node: 'unvisited', text: 'nicht besucht' },
      { node: 'frontier', text: 'auf dem Stapel (wartet)' },
      { node: 'current', text: 'aktiv' },
      { node: 'done', text: 'beendet' },
      { node: 'unreachable', text: 'nicht erreichbar' },
      { node: 'plain', ring: 'start', text: 'Startknoten' },
      { node: 'plain', ring: 'target', text: 'Ziel' },
      { edge: 'active', text: 'wird gerade geprüft' },
      { edge: 'tree', text: 'Baumkante (Aufruf)' },
      { edge: 'checked', text: 'geprüft, Knoten schon besucht' },
      { edge: 'path', text: 'Weg zum Ziel' }
    ]
  });
})(window.HG = window.HG || {});
