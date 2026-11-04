/**
 * @file pages/representation.js
 * @description Seite 2 „Darstellungen“: Zeichnung, Adjazenzmatrix und (aufklappbar) Adjazenzlisten.
 *
 * Festlegungen:
 *   - Zeilen und Spalten der Matrix sind alphabetisch sortiert; Zeile = Startknoten, Spalte = Endknoten.
 *   - Ungewichteter Graph (alle Gewichte 1): Matrix mit 1 (Kante) und 0 (keine Kante).
 *     Gewichteter Graph: Gewicht der Kante (auch 0), „–“ für keine Kante.
 *     So wird die Matrix beim Einlesen wieder genauso verstanden (siehe graph-import.js).
 *   - Ungerichtet: Die Matrix ist symmetrisch; jede Kante steht in den Listen beider Knoten.
 *   - Zeigen auf eine Kante hebt die Zelle(n) hervor und umgekehrt (auch per Tastatur über den Fokus).
 *
 * Abhängigkeiten:
 *   dom-utils.js, format-utils.js, graph.js, graph-view.js
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const g = ns.graph;
  let view = null;
  /** Kanten-ID → Zellen der Matrix. */
  let cellsByEdge = new Map();

  /**
   * Hebt eine Kante in Zeichnung und Matrix hervor.
   * @param {number|null} edgeId - Kante oder null.
   */
  function highlight(edgeId) {
    view.highlightEdge(edgeId);
    for (const cell of document.querySelectorAll('#matrix .matrix-hover')) {
      cell.classList.remove('matrix-hover');
    }
    if (edgeId !== null && cellsByEdge.has(edgeId)) {
      for (const cell of cellsByEdge.get(edgeId)) {
        cell.classList.add('matrix-hover');
      }
    }
  }

  /** Zeichnet die Matrix. */
  function renderMatrix() {
    const box = dom.clear(dom.byId('matrix'));
    cellsByEdge = new Map();
    const m = g.matrix();
    const weighted = g.isWeighted();
    const hint = dom.byId('matrix-hint');
    if (m.nodes.length === 0) {
      hint.textContent = '';
      box.appendChild(dom.el('p', { class: 'hint' }, 'Noch kein Graph vorhanden.'));
      return;
    }
    hint.textContent = 'Zeile = von, Spalte = nach. ' + (weighted
      ? 'Eingetragen ist das Gewicht der Kante (auch 0); „–“ bedeutet: keine Kante.'
      : 'Ungewichteter Graph: 1 = Kante, 0 = keine Kante.') +
      (g.isDirected() ? '' : ' Bei einem ungerichteten Graphen ist die Matrix symmetrisch zur Hauptdiagonalen.');
    const head = dom.el('tr', null, [dom.el('th', { scope: 'col', class: 'matrix-corner' }, dom.el('span', { class: 'visually-hidden' }, 'von \\ nach'))]
      .concat(m.nodes.map((n) => dom.el('th', { scope: 'col' }, n.name))));
    const body = m.nodes.map((rowNode, i) => dom.el('tr', null, [dom.el('th', { scope: 'row' }, rowNode.name)].concat(m.cells[i].map((edge, j) => {
      const text = edge ? (weighted ? dom.formatInt(edge.weight) : '1') : (weighted ? '–' : '0');
      const cell = dom.el('td', {
        class: 'num matrix-cell' + (edge ? ' matrix-edge' : ' matrix-none') + (i === j ? ' matrix-diagonal' : '') + (edge && edge.weight < 0 ? ' negative' : ''),
        tabindex: edge ? '0' : null,
        'aria-label': edge ? rowNode.name + ' nach ' + m.nodes[j].name + ': ' + (weighted ? 'Gewicht ' + dom.formatInt(edge.weight) : 'Kante') : null
      }, text);
      if (edge) {
        if (!cellsByEdge.has(edge.id)) {
          cellsByEdge.set(edge.id, []);
        }
        cellsByEdge.get(edge.id).push(cell);
        cell.addEventListener('pointerenter', () => highlight(edge.id));
        cell.addEventListener('pointerleave', () => highlight(null));
        cell.addEventListener('focus', () => highlight(edge.id));
        cell.addEventListener('blur', () => highlight(null));
      }
      return cell;
    }))));
    box.appendChild(dom.el('table', { class: 'data-table matrix-table' }, [
      dom.el('caption', { class: 'visually-hidden' }, 'Adjazenzmatrix'),
      dom.el('thead', null, head),
      dom.el('tbody', null, body)
    ]));
  }

  /** Zeichnet die Adjazenzlisten. */
  function renderLists() {
    const list = dom.clear(dom.byId('adj-lists'));
    const weighted = g.isWeighted();
    dom.byId('lists-hint').textContent = 'Für jeden Knoten die Liste seiner Nachbarn' +
      (g.isDirected() ? ' (Kanten, die von ihm ausgehen)' : '; bei einem ungerichteten Graphen steht jede Kante in den Listen beider Knoten') +
      (weighted ? ', in Klammern das Gewicht.' : '.');
    const nodes = g.getNodes();
    if (nodes.length === 0) {
      list.appendChild(dom.el('li', { class: 'hint' }, 'Noch kein Graph vorhanden.'));
      return;
    }
    for (const node of nodes) {
      const nbs = g.neighbors(node.id);
      const items = nbs.length === 0
        ? [dom.el('span', { class: 'hint' }, 'keine Nachbarn')]
        : nbs.flatMap((nb, i) => {
          const item = dom.el('span', { class: 'list-item', tabindex: '0' },
            nb.node.name + (weighted ? ' (' + dom.formatInt(nb.weight) + ')' : ''));
          item.addEventListener('pointerenter', () => highlight(nb.edge.id));
          item.addEventListener('pointerleave', () => highlight(null));
          item.addEventListener('focus', () => highlight(nb.edge.id));
          item.addEventListener('blur', () => highlight(null));
          return i === 0 ? [item] : [', ', item];
        });
      list.appendChild(dom.el('li', null, [dom.el('strong', { class: 'list-head' }, node.name), dom.el('span', { class: 'list-arrow', 'aria-hidden': 'true' }, '→'), dom.el('span', { class: 'list-items' }, items)]));
    }
  }

  function init() {
    view = ns.graphView.create(dom.byId('graph-repr'), {
      label: 'Zeichnung des Graphen',
      draggable: true,
      onEdgeHover: (edgeId) => highlight(edgeId)
    });
  }

  function render() {
    view.render();
    renderMatrix();
    renderLists();
  }

  ns.pages = ns.pages || {};
  ns.pages.representation = { init, render, onGraphChange: () => {} };
})(window.HG = window.HG || {});
