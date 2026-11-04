/**
 * @file pages/bfs.js
 * @description Seite 3 „Breitensuche“: Ablauf Schritt für Schritt mit Warteschlange,
 *              Besuchsreihenfolge, Abstand und Vorgänger; am Ende Spannbaum (BFS-Baum).
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
    ['unvisited', 'nicht entdeckt'],
    ['frontier', 'wartet'],
    ['current', 'wird besucht'],
    ['done', 'fertig']
  ]);

  /**
   * Zeigt die Datenstrukturen eines Schritts.
   * @param {Object} step - Schritt.
   * @param {HTMLElement} box - Behälter.
   */
  function renderData(step, box) {
    const d = step.data;
    box.appendChild(dom.el('h3', null, 'Warteschlange'));
    box.appendChild(dom.el('p', { class: 'hint' }, 'vorne (wird als Nächstes besucht) → hinten (zuletzt entdeckt)'));
    box.appendChild(u.boxList(d.queue, { empty: 'leer', highlightFirst: true }));
    box.appendChild(dom.el('h3', { class: 'mt' }, 'Besuchsreihenfolge'));
    box.appendChild(u.boxList(d.order, { empty: 'noch keiner' }));
    box.appendChild(u.table(['Knoten', 'Zustand', 'Abstand', 'Vorgänger'], d.rows.map((r) => [
      r.name,
      STATE_TEXT.get(r.state) || r.state,
      dom.formatDistance(r.dist),
      r.pred === null ? '–' : r.pred
    ]), { caption: 'Abstand = Anzahl der Kanten vom Startknoten; wartet = in der Warteschlange', numeric: [2], rowClass: (i) => (d.rows[i].state === 'current' ? 'selected' : null) }));
  }

  ns.pages = ns.pages || {};
  ns.pages.bfs = u.createAlgorithmPage({
    id: 'bfs',
    run: (snap, start, target) => ns.algorithms.bfs(snap, start, target),
    renderData,
    spanningTree: true,
    legend: [
      { node: 'unvisited', text: 'nicht entdeckt' },
      { node: 'frontier', text: 'in der Warteschlange' },
      { node: 'current', text: 'wird besucht' },
      { node: 'done', text: 'fertig' },
      { node: 'unreachable', text: 'nicht erreichbar' },
      { node: 'plain', ring: 'start', text: 'Startknoten' },
      { node: 'plain', ring: 'target', text: 'Ziel' },
      { edge: 'active', text: 'wird gerade geprüft' },
      { edge: 'tree', text: 'Baumkante (Knoten darüber entdeckt)' },
      { edge: 'checked', text: 'geprüft, Knoten schon entdeckt' },
      { edge: 'path', text: 'Weg zum Ziel' }
    ]
  });
})(window.HG = window.HG || {});
