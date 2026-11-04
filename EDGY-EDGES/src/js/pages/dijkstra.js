/**
 * @file pages/dijkstra.js
 * @description Seite 5 „Dijkstra“: Ablauf Schritt für Schritt mit Berechnungstabelle
 *              (Aktueller Knoten · Warteschlange nach Distanz · Rand, jeweils als Tripel
 *              (Knoten, Vorgänger, Distanz zum Startknoten)); am Ende Weg zu jedem Knoten
 *              und – bei negativen Gewichten – der Vergleich mit Bellman-Ford.
 *
 * Abhängigkeiten:
 *   dom-utils.js, format-utils.js, graph.js, algorithms.js, pages/common.js
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const u = ns.pageUtils;
  let page = null;
  let showStep = () => {};

  /**
   * Tripel als Element.
   * @param {{name:string, pred:(string|null), dist:number}} t - Tripel.
   * @param {boolean} changed - In dieser Zeile neu oder geändert.
   * @returns {HTMLElement} Element.
   */
  function tripleEl(t, changed) {
    return dom.el('span', { class: 'triple' + (changed ? ' triple-changed' : '') + (t.dist < 0 ? ' negative' : '') }, [
      dom.formatTriple(t.name, t.pred, t.dist),
      changed ? dom.el('span', { class: 'visually-hidden' }, ' (neu oder geändert)') : null
    ]);
  }

  /**
   * Zelle mit mehreren Tripeln.
   */
  function tripleCell(list, changed) {
    if (list.length === 0) {
      return dom.el('span', { class: 'hint' }, '\u2013');
    }
    return dom.el('span', { class: 'triples' }, list.map((t) => tripleEl(t, changed.includes(t.name))));
  }

  /** Zeichnet die Berechnungstabelle. */
  function renderTable(step) {
    const box = dom.clear(dom.byId('dijkstra-table'));
    if (!step) {
      box.appendChild(dom.el('p', { class: 'hint' }, 'Noch kein Graph vorhanden.'));
      return;
    }
    const rows = step.data.rows;
    const t = dom.el('table', { class: 'data-table dijkstra-table' }, [
      dom.el('caption', { class: 'hint' }, 'Tripel: (Knoten, Vorgänger, Distanz zum Startknoten). Hervorgehoben: in dieser Zeile neu erreicht oder verkürzt.'),
      dom.el('thead', null, dom.el('tr', null, [
        dom.el('th', { scope: 'col', class: 'num' }, 'Nr.'),
        dom.el('th', { scope: 'col' }, 'Aktueller Knoten'),
        dom.el('th', { scope: 'col' }, 'Warteschlange (nach Distanz sortiert)'),
        dom.el('th', { scope: 'col' }, 'Rand (bisher nicht erreicht)')
      ])),
      dom.el('tbody', null, rows.map((row, i) => dom.el('tr', { class: i === rows.length - 1 && !step.final ? 'selected' : null }, [
        dom.el('th', { scope: 'row', class: 'num' }, String(i)),
        dom.el('td', null, row.current ? tripleEl(row.current, false) : dom.el('span', { class: 'hint' }, '– (Start)')),
        dom.el('td', null, tripleCell(row.queue, row.changed)),
        dom.el('td', null, tripleCell(row.rand, []))
      ])))
    ]);
    box.appendChild(t);
  }

  /** Datenbereich neben der Zeichnung. */
  function renderData(step, box, ctx) {
    box.appendChild(dom.el('h3', null, 'Fertige Knoten'));
    box.appendChild(dom.el('p', { class: 'hint' }, 'in der Reihenfolge, in der sie aktueller Knoten wurden'));
    box.appendChild(u.boxList(step.data.settled, { empty: 'noch keiner' }));
    if (step.final && ctx.result) {
      const select = dom.el('select', { id: 'dijkstra-path-to' }, [dom.el('option', { value: '' }, '(bitte wählen)')]
        .concat(ns.graph.getNodes().filter((n) => ctx.result.reach.has(n.id)).map((n) => dom.el('option', { value: String(n.id) }, n.name))));
      if (ctx.selectedPath) {
        select.value = String(ctx.selectedPath.id);
      }
      select.addEventListener('change', () => {
        selectPath(select.value === '' ? null : Number(select.value), ctx);
        showStep();
      });
      box.appendChild(dom.el('div', { class: 'field mt' }, [dom.el('label', { for: 'dijkstra-path-to' }, 'Weg anzeigen zu'), select]));
      box.appendChild(dom.el('p', { class: 'hint' }, 'Oder auf einen Knoten in der Zeichnung klicken.'));
    }
  }

  /**
   * Wählt den Weg zu einem Knoten (im letzten Schritt).
   * @param {number|null} id - Knoten oder null.
   * @param {Object} ctx - Seitenzustand.
   */
  function selectPath(id, ctx) {
    if (id === null || !ctx.result) {
      ctx.selectedPath = null;
      return;
    }
    const name = ns.graph.getNode(id).name;
    const startName = ns.graph.getNode(ctx.start).name;
    const p = ns.algorithms.dijkstraPath(ctx.result, id);
    let text;
    if (!ctx.result.reach.has(id)) {
      text = name + ' ist vom Startknoten ' + startName + ' aus nicht erreichbar.';
    } else if (!p) {
      text = 'Für ' + name + ' hat Dijkstra keine endgültige Distanz berechnet (der Ablauf endete vorher am Ziel).';
    } else {
      text = 'Kürzester Weg laut Dijkstra von ' + startName + ' nach ' + name + ': ' +
        p.nodes.map((n) => ns.graph.getNode(n).name).join(' → ') + ', Länge ' + dom.formatInt(ctx.result.dist.get(id)) + '.';
    }
    ctx.selectedPath = { id, text, edges: p ? p.edges : [] };
  }

  /** Hinweis auf negative Gewichte (über dem Ablauf). */
  function renderNegativeNotice() {
    const box = dom.clear(dom.byId('dijkstra-negative'));
    const negative = ns.graph.hasNegativeWeights();
    box.hidden = !negative;
    if (!negative) {
      return;
    }
    box.appendChild(dom.el('p', null, [
      dom.el('strong', null, 'Achtung, negative Kantengewichte: '),
      'Dijkstra setzt voraus, dass kein Gewicht negativ ist – ein fertiger Knoten wird nie mehr geändert. ' +
      'Mit negativen Gewichten kann das Ergebnis deshalb falsch sein. Nach dem letzten Schritt vergleicht diese Seite das Ergebnis mit dem Bellman-Ford-Algorithmus.' +
      (ns.graph.isDirected() ? '' : ' Bei einem ungerichteten Graphen bildet jede negative Kante A–B allein schon einen negativen Zyklus (A → B → A).')
    ]));
  }

  /**
   * Summe der Gewichte eines Zyklus.
   * @param {Object} snap - Momentaufnahme.
   * @param {number[]} cycle - Knoten in Laufrichtung.
   * @returns {number} Summe.
   */
  function cycleWeight(snap, cycle) {
    let sum = 0;
    for (let i = 0; i < cycle.length; i++) {
      const from = cycle[i];
      const to = cycle[(i + 1) % cycle.length];
      const arcs = snap.adj.get(from).filter((a) => a.to === to);
      sum += arcs.length > 0 ? Math.min(...arcs.map((a) => a.weight)) : 0;
    }
    return sum;
  }

  /** Vergleich mit Bellman-Ford (nur im letzten Schritt bei negativen Gewichten). */
  function renderBellmanFord(step, ctx) {
    const details = dom.byId('dijkstra-bf');
    const body = dom.clear(dom.byId('dijkstra-bf-body'));
    const show = Boolean(step && step.final && ctx.result && ns.graph.hasNegativeWeights());
    details.hidden = !show;
    if (!show) {
      return;
    }
    const r = ctx.result;
    if (!ctx.bf || ctx.bf.result !== r) {
      ctx.bf = { result: r, bf: ns.algorithms.bellmanFord(r.snap, ctx.start) };
    }
    const bf = ctx.bf.bf;
    const nameOf = (id) => ns.graph.getNode(id).name;
    body.appendChild(dom.el('p', null, 'Bellman-Ford prüft in bis zu n − 1 Runden immer wieder alle Kanten und verkürzt Distanzen, wo es geht. ' +
      'So findet er auch bei negativen Gewichten die richtigen Distanzen – solange es keinen negativen Zyklus gibt. Eine weitere Runde zeigt, ob sich noch etwas verkürzen lässt: Dann gibt es einen negativen Zyklus.'));
    if (bf.cycle) {
      const names = bf.cycle.map(nameOf);
      body.appendChild(dom.el('p', { class: 'status status-error' }, [
        dom.el('strong', null, 'Negativer Zyklus gefunden: '),
        names.concat([names[0]]).join(' → ') + ' mit der Summe ' + dom.formatInt(cycleWeight(r.snap, bf.cycle)) + '. ' +
        'Jeder weitere Umlauf macht die Wege zu den betroffenen Knoten noch kürzer. Für ' + dom.joinNames(Array.from(bf.undefinedNodes).map(nameOf).sort(ns.graph.compareNames)) +
        ' gibt es deshalb keine kürzeste Distanz (−∞).' +
        (r.snap.directed ? '' : ' Im ungerichteten Graphen ist das die negative Kante selbst, hin und zurück durchlaufen.')
      ]));
      const toggle = dom.el('input', { type: 'checkbox', id: 'dijkstra-show-cycle', checked: Boolean(ctx.cycleEdges) });
      toggle.addEventListener('change', () => {
        ctx.cycleEdges = toggle.checked ? new Set(bf.cycleEdges) : null;
        showStep();
      });
      body.appendChild(dom.el('label', { class: 'radio' }, [toggle, ' Zyklus in der Zeichnung markieren']));
    }
    const settled = new Set(r.settled);
    let wrong = 0;
    const rows = r.snap.nodes.filter((n) => r.reach.has(n.id)).map((n) => {
      const dd = r.dist.get(n.id);
      const bd = bf.dist.get(n.id);
      let verdict;
      if (!settled.has(n.id)) {
        verdict = 'von Dijkstra nicht berechnet';
      } else if (bd === -Infinity) {
        verdict = '✗ nicht definiert (negativer Zyklus)';
        wrong++;
      } else if (dd === bd) {
        verdict = '✓ gleich';
      } else {
        verdict = '✗ Dijkstra falsch';
        wrong++;
      }
      const predName = (map, id) => (map.get(id) === null || map.get(id) === undefined ? '–' : nameOf(map.get(id)));
      return {
        cells: [n.name, settled.has(n.id) ? dom.formatDistance(dd) : '–', settled.has(n.id) ? predName(r.pred, n.id) : '–',
          dom.formatDistance(bd), bd === -Infinity ? '–' : predName(bf.pred, n.id), verdict],
        bad: verdict.startsWith('✗')
      };
    });
    body.appendChild(u.table(['Knoten', 'Dijkstra: Distanz', 'Dijkstra: Vorgänger', 'Bellman-Ford: Distanz', 'Bellman-Ford: Vorgänger', 'Vergleich'],
      rows.map((x) => x.cells), { numeric: [1, 3], rowClass: (i) => (rows[i].bad ? 'row-wrong' : 'row-ok') }));
    if (!bf.cycle) {
      body.appendChild(dom.el('p', null, wrong === 0
        ? 'In diesem Fall liefert Dijkstra trotz negativer Gewichte die richtigen Distanzen – das ist aber Zufall und nicht garantiert.'
        : 'Dijkstra liefert für ' + dom.plural(wrong, 'Knoten', 'Knoten') + ' eine zu große Distanz.'));
    }
    if (r.violations.length > 0) {
      body.appendChild(dom.el('h4', null, 'Kanten, über die sich Dijkstras Ergebnis noch verkürzen ließe'));
      body.appendChild(dom.el('ul', null, r.violations.map((v) => dom.el('li', null,
        'Kante ' + nameOf(v.from) + (r.snap.directed ? '→' : '–') + nameOf(v.to) + ' (' + dom.formatInt(v.weight) + '): ' +
        dom.formatInt(r.dist.get(v.from)) + ' + ' + (v.weight < 0 ? '(' + dom.formatInt(v.weight) + ')' : dom.formatInt(v.weight)) + ' = ' + dom.formatInt(v.via) +
        ' ist kleiner als die Distanz ' + dom.formatInt(v.dist) + ', die Dijkstra für ' + nameOf(v.to) + ' berechnet hat.'))));
    }
  }

  page = u.createAlgorithmPage({
    id: 'dijkstra',
    run: (snap, start, target) => {
      const out = ns.algorithms.dijkstra(snap, start, target);
      out.result.snap = snap;
      return out;
    },
    renderData,
    clickable: true,
    onNodeClick: (id, ctx) => selectPath(id, ctx),
    init: (ctx, api) => {
      showStep = api.showStep;
    },
    afterRender: (step, ctx) => {
      if (!step || !step.final) {
        ctx.cycleEdges = null;
      }
      renderNegativeNotice();
      renderTable(step);
      renderBellmanFord(step, ctx);
    },
    legend: [
      { node: 'unvisited', text: 'Rand (nicht erreicht)' },
      { node: 'frontier', text: 'in der Warteschlange' },
      { node: 'current', text: 'aktueller Knoten' },
      { node: 'done', text: 'fertig' },
      { node: 'unreachable', text: 'nicht erreichbar' },
      { node: 'plain', ring: 'start', text: 'Startknoten' },
      { node: 'plain', ring: 'target', text: 'Ziel' },
      { edge: 'active', text: 'wird gerade geprüft' },
      { edge: 'tree', text: 'zum Vorgänger (Baum der kürzesten Wege)' },
      { edge: 'checked', text: 'geprüft, keine Verbesserung' },
      { edge: 'path', text: 'gewählter Weg' },
      { edge: 'cycle', text: 'negativer Zyklus' }
    ]
  });

  ns.pages = ns.pages || {};
  ns.pages.dijkstra = page;
})(window.HG = window.HG || {});
