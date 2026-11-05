/**
 * @file pages/input.js
 * @description Seite 1 „Graph eingeben“: Datei, Beispielgraph, Eingabemaske, Richtung, Zeichnung, Listen.
 *
 * Verhalten:
 *   - Datei hochladen oder Beispiel laden ersetzt den Graphen (bei vorhandenem Graphen nach Rückfrage).
 *   - Knoten und Kanten werden einzeln ergänzt; eine vorhandene Kante erhält das neue Gewicht.
 *   - Umschalten gerichtet/ungerichtet wandelt die Kanten um (nach Rückfrage, siehe graph.checkDirection).
 *   - Löschen einzelner Knoten (mit ihren Kanten) und Kanten; ganzer Graph nach Rückfrage.
 *
 * Abhängigkeiten:
 *   dom-utils.js, format-utils.js, text-utils.js, graph.js, graph-import.js, samples.js,
 *   graph-view.js, pages/common.js
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const g = ns.graph;
  let view = null;

  /**
   * Zeigt eine Meldung im Importbereich.
   * @param {string} kind - 'success' | 'error' | 'info'.
   * @param {string} text - Haupttext.
   * @param {string[]} [details] - Einzelmeldungen.
   */
  function showImportStatus(kind, text, details) {
    const box = dom.byId('import-status');
    dom.clear(box);
    box.className = 'status' + (kind === 'success' ? ' status-success' : kind === 'error' ? ' status-error' : '');
    box.appendChild(dom.el('p', null, text));
    if (details && details.length > 0) {
      box.appendChild(dom.el('ul', null, details.map((d) => dom.el('li', null, d))));
    }
    box.hidden = false;
  }

  /** Beschreibung, woher die Richtung stammt. */
  function directionText(result) {
    const kind = result.directed ? 'gerichtet' : 'ungerichtet';
    switch (result.directionSource) {
      case 'file':
        return kind + ' (Angabe in der Datei)';
      case 'symmetric':
        return kind + ' (Matrix ist symmetrisch)';
      case 'asymmetric':
        return kind + ' (Matrix ist nicht symmetrisch)';
      default:
        return kind + ' (Einstellung auf dieser Seite)';
    }
  }

  /**
   * Übernimmt ein Importergebnis nach Rückfrage.
   * @param {Object} result - Ergebnis von graphImport.
   * @param {string} source - Bezeichnung für die Meldung (z. B. Dateiname).
   */
  function applyImport(result, source) {
    if (result.nodes.length === 0) {
      showImportStatus('error', source + ': Es wurden keine gültigen Knoten gefunden.', result.errors);
      return;
    }
    if (g.nodeCount() > 0 && !window.confirm('Der vorhandene Graph wird ersetzt. Fortfahren?')) {
      showImportStatus('info', 'Laden abgebrochen – der bisherige Graph bleibt erhalten.');
      return;
    }
    try {
      g.replaceAll({ directed: result.directed, nodes: result.nodes, edges: result.edges });
    } catch (e) {
      showImportStatus('error', source + ': ' + e.message);
      return;
    }
    const details = result.errors.slice();
    if (result.skipped > details.length) {
      details.push('… insgesamt ' + dom.plural(result.skipped, 'Eintrag', 'Einträge') + ' übersprungen.');
    }
    if (result.merged > 0) {
      details.push(dom.plural(result.merged, 'Kante war', 'Kanten waren') + ' in beiden Richtungen angegeben und wurde' + (result.merged === 1 ? '' : 'n') + ' zusammengefasst.');
    }
    if (result.truncated) {
      details.push('Die Höchstzahl von ' + g.LIMITS.maxEdges + ' Kanten wurde erreicht; weitere Zeilen wurden nicht gelesen.');
    }
    if (result.positionNote) {
      details.push(result.positionNote);
    }
    const text = source + ' geladen: ' + (result.format === 'matrix' ? 'Adjazenzmatrix' : 'Kantenliste') + ', ' + directionText(result) + ', ' +
      dom.plural(g.nodeCount(), 'Knoten', 'Knoten') + ', ' + dom.plural(g.edgeCount(), 'Kante', 'Kanten') + '.' +
      (result.positions === 'file' ? ' Die Knoten stehen an den Positionen aus der Datei.' : '') +
      (result.skipped > 0 ? ' ' + dom.plural(result.skipped, 'Eintrag wurde', 'Einträge wurden') + ' übersprungen:' : '');
    showImportStatus(result.skipped > 0 || result.positionNote ? 'info' : 'success', text, details);
  }

  /** Zähler der Importe: Nur das Ergebnis des zuletzt gestarteten Imports wird übernommen. */
  let importCounter = 0;

  /** Datei wurde gewählt. */
  async function handleFile(event) {
    const input = event.target;
    const file = input.files && input.files[0];
    if (!file) {
      return;
    }
    const ticket = ++importCounter;
    const name = '„' + ns.text.sanitizeDisplayText(file.name, 80, 'Datei') + '“';
    try {
      const result = await ns.graphImport.importFile(file, g.isDirected());
      if (ticket === importCounter) {
        applyImport(result, 'Datei ' + name);
      }
    } catch (e) {
      if (ticket === importCounter) {
        showImportStatus('error', 'Datei ' + name + ': ' + e.message);
      }
    } finally {
      input.value = '';
    }
  }

  /** Beispiel laden. */
  function handleSample() {
    const sample = ns.samples.find((s) => s.id === dom.byId('sample-select').value);
    if (!sample) {
      return;
    }
    importCounter++; // ein noch laufender Datei-Import wird damit verworfen
    try {
      applyImport(ns.graphImport.importText(sample.text, g.isDirected()), 'Beispiel „' + sample.title + '“');
    } catch (e) {
      showImportStatus('error', e.message);
    }
  }

  /** Meldung in einem Formular. */
  function formMessage(prefix, error, info) {
    dom.byId(prefix + '-error').textContent = error || '';
    dom.byId(prefix + '-info').textContent = info || '';
  }

  /** Knoten hinzufügen. */
  function handleNodeSubmit(event) {
    event.preventDefault();
    const input = dom.byId('node-name');
    try {
      const node = g.addNode(input.value);
      formMessage('node-form', '', 'Knoten ' + node.name + ' hinzugefügt.');
      input.value = '';
      input.focus();
    } catch (e) {
      formMessage('node-form', e.message, '');
    }
  }

  /** Kante hinzufügen oder ändern. */
  function handleEdgeSubmit(event) {
    event.preventDefault();
    const from = Number(dom.byId('edge-from').value);
    const to = Number(dom.byId('edge-to').value);
    if (!g.getNode(from) || !g.getNode(to)) {
      formMessage('edge-form', 'Legen Sie zuerst mindestens zwei Knoten an.', '');
      return;
    }
    const weightInput = dom.byId('edge-weight');
    const w = g.parseWeight(weightInput.value);
    if (!w.ok) {
      formMessage('edge-form', w.error, '');
      return;
    }
    try {
      const out = g.setEdge(from, to, w.value);
      const a = g.getNode(out.edge.from).name;
      const b = g.getNode(out.edge.to).name;
      const label = 'Kante ' + a + (g.isDirected() ? '→' : '–') + b;
      formMessage('edge-form', '', out.created
        ? label + ' mit Gewicht ' + dom.formatInt(w.value) + ' hinzugefügt.'
        : label + ': Gewicht von ' + dom.formatInt(out.previous) + ' auf ' + dom.formatInt(w.value) + ' geändert.');
    } catch (e) {
      formMessage('edge-form', e.message, '');
    }
  }

  /** Richtung umschalten. */
  function handleDirection(event) {
    const toDirected = event.target.value === '1';
    dom.byId('direction-error').textContent = '';
    dom.byId('direction-info').textContent = '';
    const check = g.checkDirection(toDirected);
    if (!check.ok) {
      dom.byId('direction-error').textContent = check.error;
      syncDirection();
      return;
    }
    if (g.edgeCount() > 0 && !window.confirm(check.info + ' Fortfahren?')) {
      syncDirection();
      return;
    }
    g.setDirected(toDirected);
    dom.byId('direction-info').textContent = 'Der Graph ist jetzt ' + (toDirected ? 'gerichtet.' : 'ungerichtet.');
  }

  /** Setzt die Auswahl der Richtung auf den Zustand des Graphen. */
  function syncDirection() {
    dom.byId('dir-directed').checked = g.isDirected();
    dom.byId('dir-undirected').checked = !g.isDirected();
  }

  /** Knoten löschen (mit Rückfrage, wenn Kanten betroffen sind). */
  function deleteNode(node) {
    const touching = g.getEdges().filter((e) => e.from === node.id || e.to === node.id).length;
    if (touching > 0 && !window.confirm('Knoten ' + node.name + ' und ' + dom.plural(touching, 'Kante', 'Kanten') + ' löschen?')) {
      return;
    }
    g.removeNode(node.id);
  }

  /** Füllt die Auswahllisten der Kantenmaske. */
  function fillEdgeSelects() {
    const nodes = g.getNodes();
    const from = dom.byId('edge-from');
    const to = dom.byId('edge-to');
    const keepFrom = Number(from.value) || null;
    const keepTo = Number(to.value) || null;
    ns.pageUtils.fillNodeSelect(from, nodes, keepFrom);
    const chosenTo = ns.pageUtils.fillNodeSelect(to, nodes, keepTo !== null ? keepTo : (nodes[1] ? nodes[1].id : null));
    if (keepTo === null && nodes.length > 1 && chosenTo === Number(from.value)) {
      to.value = String(nodes[1].id);
    }
  }

  /** Zeichnet Knotenliste und Kantentabelle. */
  function renderLists() {
    const nodes = g.getNodes();
    const edges = g.getEdges();
    dom.byId('node-count').textContent = '(' + nodes.length + ' von höchstens ' + g.LIMITS.maxNodes + ')';
    dom.byId('edge-count').textContent = '(' + edges.length + ' von höchstens ' + g.LIMITS.maxEdges + ')';
    const list = dom.clear(dom.byId('node-list'));
    if (nodes.length === 0) {
      list.appendChild(dom.el('li', { class: 'hint' }, 'Noch keine Knoten.'));
    }
    for (const node of nodes) {
      const del = dom.el('button', { type: 'button', class: 'chip-delete', 'aria-label': 'Knoten ' + node.name + ' löschen', title: 'Knoten löschen' }, '×');
      del.addEventListener('click', () => deleteNode(node));
      list.appendChild(dom.el('li', { class: 'chip' }, [node.name, del]));
    }
    const tbody = dom.clear(dom.byId('edge-tbody'));
    if (edges.length === 0) {
      tbody.appendChild(dom.el('tr', null, dom.el('td', { colspan: '4', class: 'hint' }, 'Noch keine Kanten.')));
    }
    for (const edge of edges) {
      const a = g.getNode(edge.from).name;
      const b = g.getNode(edge.to).name;
      const del = dom.el('button', { type: 'button', class: 'btn btn-small btn-danger', 'aria-label': 'Kante ' + a + '–' + b + ' löschen' }, 'Löschen');
      del.addEventListener('click', () => g.removeEdge(edge.id));
      tbody.appendChild(dom.el('tr', null, [
        dom.el('td', null, a), dom.el('td', null, b),
        dom.el('td', { class: 'num' + (edge.weight < 0 ? ' negative' : '') }, dom.formatInt(edge.weight)),
        dom.el('td', null, del)
      ]));
    }
  }

  function init() {
    view = ns.graphView.create(dom.byId('graph-input'), { label: 'Zeichnung des eingegebenen Graphen', draggable: true });
    const select = dom.byId('sample-select');
    for (const s of ns.samples) {
      select.appendChild(dom.el('option', { value: s.id }, s.title));
    }
    dom.byId('file-input').addEventListener('change', handleFile);
    dom.byId('btn-sample').addEventListener('click', handleSample);
    dom.byId('node-form').addEventListener('submit', handleNodeSubmit);
    dom.byId('edge-form').addEventListener('submit', handleEdgeSubmit);
    dom.byId('dir-directed').addEventListener('change', handleDirection);
    dom.byId('dir-undirected').addEventListener('change', handleDirection);
    dom.byId('btn-relayout').addEventListener('click', () => g.relayout());
    dom.byId('btn-clear').addEventListener('click', () => {
      if (g.nodeCount() === 0 || window.confirm('Den ganzen Graphen löschen?')) {
        g.clear();
        dom.byId('import-status').hidden = true;
      }
    });
  }

  function render() {
    syncDirection();
    fillEdgeSelects();
    renderLists();
    dom.byId('btn-relayout').disabled = g.nodeCount() < 2;
    dom.byId('btn-clear').disabled = g.nodeCount() === 0;
    view.render();
  }

  function onGraphChange(event) {
    if (event.type === 'load' || event.type === 'direction') {
      formMessage('node-form', '', '');
      formMessage('edge-form', '', '');
    }
  }

  ns.pages = ns.pages || {};
  ns.pages.input = { init, render, onGraphChange };
})(window.HG = window.HG || {});
