/**
 * @file pages/common.js
 * @description Gemeinsame Bausteine der Seiten, vor allem der Rahmen der drei Algorithmus-Seiten.
 *
 * Algorithmus-Seite (createAlgorithmPage):
 *   - Einstellungen: Startknoten; „ganzen Graphen durchlaufen“ oder „bis zu einem Ziel“ mit Zielknoten.
 *   - Abspieler (player.js); der Ablauf wird bei jeder Änderung von Graph oder Einstellungen neu
 *     berechnet und beginnt dann von vorn (mit Hinweis). Verschobene Knoten ändern den Ablauf nicht.
 *   - Zeichnung mit den Zuständen des aktuellen Schritts, Erklärtext, Datenstrukturen (seitenabhängig).
 *   - Optional „Spannbaum anzeigen“ (nach dem letzten Schritt).
 *   Berechnet wird erst, wenn die Seite sichtbar wird (render), nicht bei jeder Änderung im Hintergrund.
 *
 * Abhängigkeiten:
 *   dom-utils.js, format-utils.js, graph.js, graph-view.js, player.js
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  ns.pages = ns.pages || {};

  /**
   * Füllt eine Knotenauswahl und behält die bisherige Wahl, solange der Knoten existiert.
   *
   * @param {HTMLSelectElement} select - Auswahlliste.
   * @param {Array<Object>} nodes - Knoten (alphabetisch).
   * @param {number|null} preferred - Gewünschte Knoten-ID.
   * @returns {number|null} Gewählte Knoten-ID.
   */
  function fillNodeSelect(select, nodes, preferred) {
    dom.clear(select);
    for (const n of nodes) {
      select.appendChild(dom.el('option', { value: String(n.id) }, n.name));
    }
    if (nodes.length === 0) {
      select.appendChild(dom.el('option', { value: '' }, '(kein Knoten)'));
      select.value = '';
      return null;
    }
    const keep = nodes.some((n) => n.id === preferred) ? preferred : nodes[0].id;
    select.value = String(keep);
    return keep;
  }

  /**
   * Liste von Namen als „Kästchen“ (z. B. Warteschlange, Stapel).
   *
   * @param {string[]} names - Namen.
   * @param {{empty:string, highlightFirst?:boolean, highlightLast?:boolean, vertical?:boolean}} options - Darstellung.
   * @returns {HTMLElement} Liste.
   */
  function boxList(names, options) {
    if (names.length === 0) {
      return dom.el('p', { class: 'box-empty' }, options.empty);
    }
    return dom.el('ol', { class: 'box-list' + (options.vertical ? ' box-list-vertical' : '') }, names.map((name, i) => {
      const highlight = (options.highlightFirst && i === 0) || (options.highlightLast && i === names.length - 1);
      return dom.el('li', { class: 'box' + (highlight ? ' box-highlight' : '') }, name);
    }));
  }

  /**
   * Erzeugt eine Algorithmus-Seite.
   *
   * @param {Object} config - Einstellungen:
   *   id: Seiten-ID ("bfs" …), verb: Bezeichnung im Hinweis ("Die Breitensuche"),
   *   run(snapshot, start, target) → {steps, result?},
   *   renderData(step, container, ctx): Datenstrukturen des Schritts anzeigen,
   *   legend: Legenden-Einträge (graph-view.legend), spanningTree: boolean,
   *   clickable: boolean (Klick auf Knoten im letzten Schritt → onNodeClick),
   *   onNodeClick(id, ctx), afterRender(step, ctx): Zusatzanzeigen.
   * @returns {{init:function():void, render:function():void, onGraphChange:function(Object):void, pause:function():void}} Seite.
   */
  function createAlgorithmPage(config) {
    const id = config.id;
    const ctx = {
      steps: [],
      result: null,
      start: null,
      target: null,
      step: null,
      dirty: true,
      note: '',
      selectedPath: null
    };
    let view = null;
    let player = null;
    let ui = null;

    /** Baut die Einstellungen auf. */
    function buildSettings() {
      const box = dom.byId(id + '-settings');
      const start = dom.el('select', { id: id + '-start' });
      const target = dom.el('select', { id: id + '-target', disabled: true });
      const modeAll = dom.el('input', { type: 'radio', name: id + '-mode', id: id + '-mode-all', value: 'all', checked: true });
      const modeTarget = dom.el('input', { type: 'radio', name: id + '-mode', id: id + '-mode-target', value: 'target' });
      const note = dom.el('p', { id: id + '-note', class: 'hint note-change', role: 'status', 'aria-live': 'polite' });
      const children = [
        dom.el('h3', null, 'Einstellungen'),
        dom.el('div', { class: 'field' }, [dom.el('label', { for: id + '-start' }, 'Startknoten'), start]),
        dom.el('fieldset', { class: 'mode-selector' }, [
          dom.el('legend', null, 'Durchlauf'),
          dom.el('label', { class: 'radio' }, [modeAll, ' ganzen Graphen durchlaufen']),
          dom.el('label', { class: 'radio' }, [modeTarget, ' bis zu einem Ziel:']),
          dom.el('div', { class: 'field target-field' }, [dom.el('label', { for: id + '-target', class: 'visually-hidden' }, 'Zielknoten'), target])
        ])
      ];
      let tree = null;
      if (config.spanningTree) {
        tree = dom.el('input', { type: 'checkbox', id: id + '-tree', disabled: true });
        children.push(dom.el('label', { class: 'radio tree-toggle' }, [tree, ' Spannbaum anzeigen']));
        children.push(dom.el('p', { class: 'hint', id: id + '-tree-hint' }, 'Möglich nach dem letzten Schritt.'));
      }
      children.push(note);
      for (const child of children) {
        box.appendChild(child);
      }
      const changed = () => {
        // Die Wahl in den Listen übernehmen (recompute behält sie, solange die Knoten existieren).
        ctx.start = start.value === '' ? null : Number(start.value);
        ctx.target = target.value === '' ? null : Number(target.value);
        ctx.dirty = true;
        ctx.note = 'Einstellungen geändert – der Ablauf beginnt von vorn.';
        render();
      };
      start.addEventListener('change', changed);
      target.addEventListener('change', changed);
      modeAll.addEventListener('change', () => {
        target.disabled = true;
        changed();
      });
      modeTarget.addEventListener('change', () => {
        target.disabled = false;
        changed();
      });
      if (tree) {
        tree.addEventListener('change', () => showStep());
      }
      return { start, target, modeAll, modeTarget, note, tree };
    }

    /** Berechnet den Ablauf neu (wenn nötig). */
    function recompute() {
      const nodes = ns.graph.getNodes();
      ctx.start = fillNodeSelect(ui.start, nodes, ctx.start);
      const targetPref = ctx.target !== null ? ctx.target : (nodes.length > 0 ? nodes[nodes.length - 1].id : null);
      const chosenTarget = fillNodeSelect(ui.target, nodes, targetPref);
      ctx.target = chosenTarget;
      ctx.selectedPath = null;
      if (ctx.start === null) {
        ctx.steps = [];
        ctx.result = null;
      } else {
        const target = ui.modeTarget.checked ? ctx.target : null;
        const out = config.run(ns.graph.snapshot(), ctx.start, target);
        ctx.steps = Array.isArray(out) ? out : out.steps;
        ctx.result = Array.isArray(out) ? null : out.result;
      }
      ctx.dirty = false;
      player.setCount(ctx.steps.length, 0);
    }

    /** Zeigt den aktuellen Schritt an. */
    function showStep() {
      const step = ctx.steps[player.index()] || null;
      ctx.step = step;
      ui.note.textContent = ctx.note;
      const stepBox = dom.byId(id + '-step');
      const dataBox = dom.byId(id + '-data');
      dom.clear(stepBox);
      dom.clear(dataBox);
      if (ui.tree) {
        ui.tree.disabled = !(step && step.final);
        dom.byId(id + '-tree-hint').hidden = Boolean(step && step.final);
      }
      if (!step) {
        stepBox.appendChild(dom.el('p', null, 'Geben Sie zuerst einen Graphen ein (Seite 1).'));
        dataBox.hidden = true;
        view.render();
        if (config.afterRender) {
          config.afterRender(null, ctx);
        }
        return;
      }
      dataBox.hidden = false;
      stepBox.appendChild(dom.el('p', null, [dom.el('strong', null, 'Schritt ' + (player.index() + 1) + ': '), step.text]));
      if (ctx.selectedPath) {
        stepBox.appendChild(dom.el('p', { class: 'path-info' }, ctx.selectedPath.text));
      }
      config.renderData(step, dataBox, ctx);
      const showTree = Boolean(ui.tree && ui.tree.checked && step.final && step.tree);
      let edges = step.edges;
      if (ctx.selectedPath) {
        edges = new Map(step.edges);
        for (const e of ctx.selectedPath.edges) {
          edges.set(e, 'path');
        }
      }
      view.render({
        status: step.status,
        edges,
        activeEdge: step.activeEdge,
        labels: step.labels,
        start: ctx.start,
        target: ui.modeTarget.checked ? ctx.target : null,
        tree: showTree ? new Set(step.tree) : null,
        cycleEdges: step.final && ctx.cycleEdges ? ctx.cycleEdges : null,
        clickable: Boolean(config.clickable && step.final)
      });
      if (config.afterRender) {
        config.afterRender(step, ctx);
      }
    }

    function init() {
      ui = buildSettings();
      view = ns.graphView.create(dom.byId('graph-' + id), {
        label: 'Zeichnung des Graphen mit dem aktuellen Schritt',
        draggable: true,
        onNodeClick: (nodeId) => {
          if (config.onNodeClick && ctx.step && ctx.step.final) {
            config.onNodeClick(nodeId, ctx);
            showStep();
          }
        }
      });
      player = ns.player.create(dom.byId(id + '-player'), {
        id: id + '-player',
        onStep: () => {
          ctx.selectedPath = null;
          showStep();
          // Der Hinweis auf eine Neuberechnung gilt nur bis zum nächsten Schritt.
          ctx.note = '';
        }
      });
      if (config.legend) {
        dom.byId(id + '-legend').appendChild(ns.graphView.legend(config.legend));
      }
      if (config.init) {
        config.init(ctx, { showStep });
      }
    }

    function render() {
      if (ctx.dirty) {
        recompute();
      } else {
        showStep();
      }
    }

    function onGraphChange(event) {
      if (event.type === 'move') {
        // Nur die Zeichnung ändert sich; der Ablauf bleibt gültig.
        return;
      }
      if (event.type === 'load') {
        ctx.start = null;
        ctx.target = null;
        ctx.note = '';
      } else {
        ctx.note = 'Der Graph wurde geändert – der Ablauf wurde neu berechnet und beginnt von vorn.';
      }
      ctx.dirty = true;
      if (player) {
        player.pause();
      }
    }

    function pause() {
      if (player) {
        player.pause();
      }
    }

    return { init, render, onGraphChange, pause, ctx: () => ctx, redraw: () => showStep() };
  }

  /**
   * Tabelle mit Kopfzeile.
   * @param {string[]} heads - Spaltenüberschriften.
   * @param {Array<Array<Node|string>>} rows - Zellen.
   * @param {{caption?:string, rowClass?:function(number):string, numeric?:number[]}} [options] - Darstellung.
   * @returns {HTMLElement} Tabelle in einem scrollbaren Behälter.
   */
  function table(heads, rows, options) {
    const opts = options || {};
    const numeric = new Set(opts.numeric || []);
    const t = dom.el('table', { class: 'data-table' }, [
      opts.caption ? dom.el('caption', null, opts.caption) : null,
      dom.el('thead', null, dom.el('tr', null, heads.map((h, i) => dom.el('th', { scope: 'col', class: numeric.has(i) ? 'num' : null }, h)))),
      dom.el('tbody', null, rows.map((cells, r) => dom.el('tr', { class: opts.rowClass ? opts.rowClass(r) : null },
        cells.map((c, i) => (i === 0 ? dom.el('th', { scope: 'row' }, c) : dom.el('td', { class: numeric.has(i) ? 'num' : null }, c))))))
    ]);
    return dom.el('div', { class: 'table-scroll' }, t);
  }

  ns.pageUtils = { fillNodeSelect, boxList, createAlgorithmPage, table };
})(window.HG = window.HG || {});
