/**
 * @file pages/training.js
 * @description Seite 6 „Training“: Breitensuche, Tiefensuche oder Dijkstra selbst ausführen.
 *
 * Breiten- und Tiefensuche:
 *   Ein Klick auf einen unbesuchten Knoten besucht ihn, ein Klick auf einen besuchten Knoten
 *   schließt ihn ab. Ein falscher Klick ändert nichts, zählt als Fehlentscheidung und zeigt
 *   einen Hinweis (training.judgeClick). Gezählt werden richtige Schritte und Fehlentscheidungen.
 *
 * Dijkstra:
 *   Die Berechnungstabelle beginnt mit Zeile 0. Jede Zeile hat drei Eingabefelder
 *   (aktueller Knoten, Warteschlange, Rand) und „Prüfen“. Eine richtige Zeile wird
 *   schreibgeschützt angezeigt, die nächste erscheint, und die Zeichnung zeigt den Stand am
 *   Ende dieser Zeile (wie Seite 5). Schreibfehler werden gemeldet, aber nicht gezählt.
 *
 * Speicherung:
 *   Der Stand jedes Algorithmus (Startknoten, Schritte, Fehlentscheidungen, Entwurf der
 *   offenen Dijkstra-Zeile) wird über progress.js in der Lernplattform gespeichert
 *   (exportState/importState). Eine Änderung des Graphen setzt das Training zurück.
 *
 * Abhängigkeiten:
 *   dom-utils.js, format-utils.js, graph.js, graph-view.js, training.js, pages/common.js;
 *   progress.js (zur Laufzeit)
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const u = ns.pageUtils;
  const T = ns.training;

  const ALGOS = ['bfs', 'dfs', 'dijkstra'];
  const ALGO_TEXT = { bfs: 'Breitensuche', dfs: 'Tiefensuche', dijkstra: 'Dijkstra' };
  const FIELDS = ['current', 'queue', 'rand'];
  /** Höchstlänge eines Eingabefelds der Tabelle. */
  const INPUT_MAX = 1000;
  /** Verzögerung, bis ein Entwurf gespeichert wird (ms). */
  const DRAFT_DELAY = 800;

  const LEGEND_SEARCH = [
    { node: 'unvisited', text: 'unbesucht' },
    { node: 'frontier', text: 'besucht (noch nicht abgeschlossen)' },
    { node: 'done', text: 'abgeschlossen' },
    { node: 'plain', ring: 'start', text: 'Startknoten' }
  ];
  const LEGEND_DIJKSTRA = [
    { node: 'unvisited', text: 'Rand (nicht erreicht)' },
    { node: 'frontier', text: 'in der Warteschlange' },
    { node: 'current', text: 'aktueller Knoten' },
    { node: 'done', text: 'fertig' },
    { node: 'unreachable', text: 'nicht erreichbar' },
    { node: 'plain', ring: 'start', text: 'Startknoten' },
    { edge: 'tree', text: 'zum Vorgänger (Baum der kürzesten Wege)' },
    { edge: 'checked', text: 'geprüft, keine Verbesserung' }
  ];

  /** @returns {Object} Leerer Stand eines Algorithmus. */
  function fresh(start) {
    return { start: start === undefined ? null : start, p: 0, errors: 0, draft: { current: '', queue: '', rand: '' }, feedback: null, check: null };
  }

  const state = { algo: 'bfs', bfs: fresh(), dfs: fresh(), dijkstra: fresh(), note: '' };
  /** Zwischenspeicher der richtigen Abläufe: Schlüssel "algo:start". */
  let cache = new Map();
  let view = null;
  let ui = null;
  let draftTimer = null;

  // ---------------------------------------------------------------------------
  // Hilfen
  // ---------------------------------------------------------------------------

  const cur = () => state[state.algo];
  const hasProgress = (s) => s.p > 0 || s.errors > 0 || FIELDS.some((f) => s.draft[f] !== '');
  const nameOf = (id) => {
    const n = id === null ? null : ns.graph.getNode(id);
    return n ? n.name : null;
  };

  /** Speichert den Stand in der Lernplattform (sofort). */
  function save() {
    if (draftTimer !== null) {
      clearTimeout(draftTimer);
      draftTimer = null;
    }
    if (ns.progress) {
      ns.progress.save();
    }
  }

  /** Speichert den Entwurf verzögert. */
  function saveLater() {
    if (draftTimer !== null) {
      clearTimeout(draftTimer);
    }
    draftTimer = setTimeout(save, DRAFT_DELAY);
  }

  /** Richtiger Ablauf für den aktuellen Algorithmus (zwischengespeichert). */
  function solution(algo, start) {
    const key = algo + ':' + start;
    if (!cache.has(key)) {
      const snap = ns.graph.snapshot();
      cache.set(key, algo === 'dijkstra'
        ? { snap, plan: T.dijkstraPlan(snap, start) }
        : { snap, seq: T.sequence(snap, start, algo) });
    }
    return cache.get(key);
  }

  /** @returns {number} Anzahl aller Schritte des Algorithmus. */
  function totalSteps(algo, start) {
    const sol = solution(algo, start);
    return algo === 'dijkstra' ? sol.plan.rows.length : sol.seq.length;
  }

  /** Wählt einen gültigen Startknoten (bisherige Wahl oder der alphabetisch erste). */
  function ensureStart(s) {
    const nodes = ns.graph.getNodes();
    if (nodes.length === 0) {
      s.start = null;
    } else if (s.start === null || !ns.graph.getNode(s.start)) {
      s.start = nodes[0].id;
    }
    return s.start;
  }

  // ---------------------------------------------------------------------------
  // Aufbau
  // ---------------------------------------------------------------------------

  function buildSettings() {
    const box = dom.byId('training-settings');
    const radios = ALGOS.map((a) => dom.el('input', { type: 'radio', name: 'training-algo', id: 'training-algo-' + a, value: a, checked: a === state.algo }));
    const start = dom.el('select', { id: 'training-start' });
    const restart = dom.el('button', { type: 'button', class: 'btn', id: 'training-restart' }, 'Neu beginnen');
    const note = dom.el('p', { id: 'training-note', class: 'hint note-change', role: 'status', 'aria-live': 'polite' });
    dom.appendChildren(box, [
      dom.el('h3', null, 'Einstellungen'),
      dom.el('fieldset', { class: 'mode-selector' }, [
        dom.el('legend', null, 'Algorithmus'),
        ...ALGOS.map((a, i) => dom.el('label', { class: 'radio' }, [radios[i], ' ' + ALGO_TEXT[a]]))
      ]),
      dom.el('div', { class: 'field' }, [dom.el('label', { for: 'training-start' }, 'Startknoten'), start]),
      dom.el('div', { class: 'button-row' }, restart),
      note
    ]);
    radios.forEach((r) => r.addEventListener('change', () => {
      if (r.checked) {
        state.algo = r.value;
        state.note = '';
        save();
        render();
      }
    }));
    start.addEventListener('change', () => {
      const s = cur();
      const id = start.value === '' ? null : Number(start.value);
      if (id === s.start) {
        return;
      }
      if (hasProgress(s) && !window.confirm('Das bisherige Training (' + ALGO_TEXT[state.algo] + ' ab ' + nameOf(s.start) + ') wird verworfen. Fortfahren?')) {
        start.value = String(s.start);
        return;
      }
      state[state.algo] = fresh(id);
      state.note = '';
      save();
      render();
    });
    restart.addEventListener('click', () => {
      const s = cur();
      if (hasProgress(s) && !window.confirm('Das Training (' + ALGO_TEXT[state.algo] + ') beginnt von vorn. Fortfahren?')) {
        return;
      }
      state[state.algo] = fresh(s.start);
      state.note = '';
      save();
      render();
    });
    return { radios, start, restart, note };
  }

  function init() {
    ui = buildSettings();
    view = ns.graphView.create(dom.byId('graph-training'), {
      label: 'Zeichnung des Graphen für das Training',
      draggable: true,
      onNodeClick: onNodeClick
    });
    // Ein noch nicht gespeicherter Entwurf wird beim Verlassen gespeichert.
    const flush = () => {
      if (draftTimer !== null) {
        save();
      }
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
  }

  // ---------------------------------------------------------------------------
  // Breiten- und Tiefensuche
  // ---------------------------------------------------------------------------

  /**
   * Klick auf einen Knoten (Maus, Stift, Finger oder Tastatur).
   * @param {number} id - Knoten.
   */
  function onNodeClick(id) {
    if (state.algo === 'dijkstra') {
      return;
    }
    const s = cur();
    if (s.start === null) {
      return;
    }
    const sol = solution(state.algo, s.start);
    const r = T.judgeClick(sol.snap, state.algo, sol.seq, s.p, id);
    const name = nameOf(id);
    if (r.done) {
      s.feedback = { type: 'info', text: 'Der Durchlauf ist schon fertig. „Neu beginnen“ startet ihn noch einmal.' };
    } else if (r.ok) {
      s.p++;
      s.feedback = { type: 'ok', text: 'Richtig: ' + name + (r.action === 'visit' ? ' besucht.' : ' abgeschlossen.') };
      if (s.p === sol.seq.length) {
        s.feedback = { type: 'ok', text: 'Geschafft! Die ' + ALGO_TEXT[state.algo] + ' ist fertig: ' + summary(s) + '.' };
      }
      save();
    } else {
      s.errors++;
      s.feedback = { type: 'wrong', text: 'Die korrekte Abfolge der Abarbeitung wurde nicht beachtet. ' + r.reason };
      save();
    }
    state.note = '';
    render();
  }

  /** @returns {string} z. B. "16 Schritte, 2 Fehlentscheidungen". */
  function summary(s) {
    return dom.plural(s.p, 'Schritt', 'Schritte') + ', ' + dom.plural(s.errors, 'Fehlentscheidung', 'Fehlentscheidungen');
  }

  function renderSearch(s) {
    const sol = solution(state.algo, s.start);
    const st = T.replay(sol.snap, sol.seq, s.p);
    const status = new Map();
    for (const [id, v] of st.status) {
      status.set(id, v === 'visited' ? 'frontier' : v);
    }
    const finished = s.p >= sol.seq.length;
    const STATE_WORD = { unvisited: 'unbesucht', visited: 'besucht', done: 'abgeschlossen' };
    view.render({
      status,
      start: s.start,
      clickable: !finished,
      nodeLabel: (node) => 'Knoten ' + node.name + ', ' + STATE_WORD[st.status.get(node.id)]
    });
    const data = dom.byId('training-data');
    dom.appendChildren(data, [
      dom.el('h3', null, 'So geht es'),
      dom.el('p', null, 'Klicken Sie die Knoten in der Reihenfolge an, in der die ' + ALGO_TEXT[state.algo] +
        ' sie bearbeitet: der erste Klick besucht einen Knoten, der zweite Klick schließt ihn ab. Nachbarn werden alphabetisch bearbeitet.'),
      dom.el('p', { class: 'hint' }, state.algo === 'bfs'
        ? 'Breitensuche: Erst werden alle unbesuchten Nachbarn des zuerst besuchten, noch offenen Knotens besucht, dann wird dieser Knoten abgeschlossen.'
        : 'Tiefensuche: Vom zuletzt besuchten, noch offenen Knoten aus geht es zum ersten unbesuchten Nachbarn. Hat er keinen mehr, wird er abgeschlossen (Rücksprung).'),
      dom.el('p', { class: 'hint' }, 'Mit der Tastatur: Tabulatortaste bis zum Knoten, dann Eingabetaste oder Leertaste.'),
      dom.el('h3', { class: 'mt' }, 'Besucht'),
      u.boxList(st.visited.map(nameOf), { empty: 'noch keiner' }),
      dom.el('h3', { class: 'mt' }, 'Abgeschlossen'),
      u.boxList(st.finished.map(nameOf), { empty: 'noch keiner' })
    ]);
  }

  // ---------------------------------------------------------------------------
  // Dijkstra
  // ---------------------------------------------------------------------------

  /** Tripel als Text. */
  const tripleText = (t) => dom.formatTriple(t.name, t.pred, t.dist);
  const listText = (list) => (list.length === 0 ? '–' : list.map(tripleText).join(', '));

  /** Prüft die offene Zeile. */
  function checkOpenRow() {
    const s = cur();
    const sol = solution('dijkstra', s.start);
    const i = s.p;
    if (i >= sol.plan.rows.length) {
      return;
    }
    const parsed = T.parseRow(s.draft, sol.snap, i === 0);
    if (!parsed.ok) {
      s.check = { type: 'syntax', hints: parsed.errors };
      s.feedback = { type: 'info', text: 'Zeile ' + i + ' enthält Schreibfehler – siehe Hinweise unter der Zeile. Schreibfehler zählen nicht als Fehlentscheidung.' };
    } else {
      const r = T.checkRow(parsed, sol.plan, i, sol.snap);
      if (r.ok) {
        s.p++;
        s.draft = { current: '', queue: '', rand: '' };
        s.check = null;
        s.feedback = s.p === sol.plan.rows.length
          ? { type: 'ok', text: 'Geschafft! Zeile ' + i + ' ist richtig, die Warteschlange ist leer – Dijkstra ist fertig: ' + summary(s) + '. Die markierten Kanten bilden den Baum der kürzesten Wege.' }
          : { type: 'ok', text: 'Zeile ' + i + ' ist richtig. Die Zeichnung zeigt jetzt den Stand nach dieser Zeile.' };
      } else {
        s.errors++;
        s.check = { type: 'calc', hints: r.hints };
        s.feedback = { type: 'wrong', text: (r.kind === 'current' ? 'Falsch ausgewählter nächster Knoten in Zeile ' : 'Zeile ') + i +
          (r.kind === 'current' ? ' – siehe Hinweis unter der Zeile.' : ' enthält Fehler – siehe Hinweise unter der Zeile.') };
      }
    }
    state.note = '';
    save();
    render();
    focusOpenRow();
  }

  /** Setzt den Fokus in das erste Feld der offenen Zeile. */
  function focusOpenRow() {
    // Nach der letzten Zeile gibt es keine Eingabefelder mehr (dom.byId würde dann einen Fehler melden).
    const first = document.getElementById('training-in-current') || document.getElementById('training-in-queue');
    if (first) {
      first.focus();
    }
  }

  function renderTable(s, sol) {
    const box = dom.clear(dom.byId('training-table'));
    const rows = sol.plan.rows;
    const body = [];
    for (let k = 0; k < s.p && k < rows.length; k++) {
      const row = rows[k];
      body.push(dom.el('tr', { class: 'row-done' }, [
        dom.el('th', { scope: 'row', class: 'num' }, String(k)),
        dom.el('td', null, row.current ? tripleText(row.current) : '– (Start)'),
        dom.el('td', null, listText(row.queue)),
        dom.el('td', null, listText(row.rand)),
        dom.el('td', { class: 'check-cell' }, dom.el('span', { class: 'check-ok' }, '✓ richtig'))
      ]));
    }
    if (s.p < rows.length) {
      const i = s.p;
      const input = (field, label, placeholder) => {
        const el = dom.el('input', {
          type: 'text', id: 'training-in-' + field, class: 'triple-input', maxlength: String(INPUT_MAX),
          autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Zeile ' + i + ': ' + label, placeholder
        });
        el.value = s.draft[field];
        el.addEventListener('input', () => {
          s.draft[field] = el.value.slice(0, INPUT_MAX);
          saveLater();
        });
        el.addEventListener('change', save);
        el.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            checkOpenRow();
          }
        });
        return el;
      };
      const button = dom.el('button', { type: 'button', class: 'btn btn-primary', id: 'training-check' }, 'Prüfen');
      button.addEventListener('click', checkOpenRow);
      body.push(dom.el('tr', { class: 'row-open' + (s.check && s.check.type === 'calc' ? ' row-wrong' : '') }, [
        dom.el('th', { scope: 'row', class: 'num' }, String(i)),
        dom.el('td', null, i === 0 ? dom.el('span', { class: 'hint' }, '– (Start)') : input('current', 'Aktueller Knoten', '(Knoten, Vorgänger, Distanz)')),
        dom.el('td', null, input('queue', 'Warteschlange', '(Knoten, Vorgänger, Distanz), …')),
        dom.el('td', null, input('rand', 'Rand', 'Namen oder Tripel, mit Komma getrennt')),
        dom.el('td', { class: 'check-cell' }, button)
      ]));
      if (s.check) {
        body.push(dom.el('tr', { class: 'row-hints' }, dom.el('td', { colspan: '5' }, [
          dom.el('p', { class: 'hints-title' }, s.check.type === 'syntax' ? 'Schreibweise prüfen:' : 'Hinweise:'),
          dom.el('ul', { id: 'training-hints', class: s.check.type === 'syntax' ? 'hint-list hint-syntax' : 'hint-list hint-calc' },
            s.check.hints.map((h) => dom.el('li', null, h)))
        ])));
      }
    }
    box.appendChild(dom.el('table', { class: 'data-table dijkstra-table training-table' }, [
      dom.el('caption', { class: 'hint' }, 'Tripel: (Knoten, Vorgänger, Distanz zum Startknoten). Kein Vorgänger: –, nicht erreicht: ∞ (auch - und inf). Mehrere Tripel mit Komma trennen. Den Rand können Sie auch nur mit Namen angeben.'),
      dom.el('thead', null, dom.el('tr', null, [
        dom.el('th', { scope: 'col', class: 'num' }, 'Nr.'),
        dom.el('th', { scope: 'col' }, 'Aktueller Knoten'),
        dom.el('th', { scope: 'col' }, 'Warteschlange (nach Distanz sortiert)'),
        dom.el('th', { scope: 'col' }, 'Rand (bisher nicht erreicht)'),
        dom.el('th', { scope: 'col' }, dom.el('span', { class: 'visually-hidden' }, 'Prüfung'))
      ])),
      dom.el('tbody', null, body)
    ]));
  }

  function renderDijkstra(s) {
    const sol = solution('dijkstra', s.start);
    if (s.p === 0) {
      view.render({ start: s.start });
    } else {
      const step = sol.plan.steps[sol.plan.stepOfRow[Math.min(s.p, sol.plan.rows.length) - 1]];
      view.render({ status: step.status, edges: step.edges, labels: step.labels, activeEdge: null, start: s.start });
    }
    dom.appendChildren(dom.byId('training-data'), [
      dom.el('h3', null, 'So geht es'),
      dom.el('p', null, 'Füllen Sie die Berechnungstabelle Zeile für Zeile aus und klicken Sie auf „Prüfen“ (oder drücken Sie die Eingabetaste). ' +
        'Ist die Zeile richtig, erscheint die nächste, und die Zeichnung zeigt den Stand nach dieser Zeile.'),
      dom.el('ul', { class: 'hint' }, [
        dom.el('li', null, 'Zeile 0: Startknoten in die Warteschlange, alle anderen Knoten in den Rand.'),
        dom.el('li', null, 'Danach: Der Knoten mit der kleinsten Distanz wird aktueller Knoten (bei Gleichstand alphabetisch) und ist fertig. Seine Kanten werden geprüft (Relaxation).'),
        dom.el('li', null, 'Die Warteschlange ist nach Distanz sortiert, bei gleicher Distanz alphabetisch.'),
        dom.el('li', null, 'Beispiel für die Schreibweise: (B, A, 4), (C, –, ∞)')
      ])
    ]);
    renderTable(s, sol);
  }

  /** Hinweis auf negative Gewichte (wie Seite 5). */
  function renderNegativeNotice() {
    const box = dom.clear(dom.byId('training-negative'));
    const show = state.algo === 'dijkstra' && ns.graph.hasNegativeWeights();
    box.hidden = !show;
    if (show) {
      box.appendChild(dom.el('p', null, [
        dom.el('strong', null, 'Achtung, negative Kantengewichte: '),
        'Dijkstra setzt voraus, dass kein Gewicht negativ ist. Geprüft wird trotzdem nach der Lehrbuchfassung (ein fertiger Knoten wird nie mehr geändert) – das Ergebnis muss dann nicht die kürzesten Wege liefern.'
      ]));
    }
  }

  // ---------------------------------------------------------------------------
  // Anzeige
  // ---------------------------------------------------------------------------

  function render() {
    if (!ui) {
      return;
    }
    const s = cur();
    for (const r of ui.radios) {
      r.checked = r.value === state.algo;
    }
    s.start = u.fillNodeSelect(ui.start, ns.graph.getNodes(), ensureStart(s));
    ui.note.textContent = state.note;
    dom.clear(dom.byId('training-legend')).appendChild(ns.graphView.legend(state.algo === 'dijkstra' ? LEGEND_DIJKSTRA : LEGEND_SEARCH));
    renderNegativeNotice();
    const statusBox = dom.clear(dom.byId('training-status'));
    const data = dom.clear(dom.byId('training-data'));
    const tableCard = dom.byId('training-table-card');
    tableCard.hidden = state.algo !== 'dijkstra' || s.start === null;
    ui.restart.disabled = s.start === null;
    if (s.start === null) {
      view.render();
      data.hidden = true;
      dom.byId('training-feedback').hidden = true;
      statusBox.appendChild(dom.el('p', null, 'Geben Sie zuerst einen Graphen ein (Seite 1).'));
      return;
    }
    data.hidden = false;
    const total = totalSteps(state.algo, s.start);
    statusBox.appendChild(dom.el('h3', null, ALGO_TEXT[state.algo] + ' ab ' + nameOf(s.start)));
    statusBox.appendChild(dom.el('dl', { class: 'counters' }, [
      dom.el('div', null, [dom.el('dt', null, state.algo === 'dijkstra' ? 'Richtige Zeilen' : 'Schritte'), dom.el('dd', { id: 'training-steps' }, String(s.p))]),
      dom.el('div', null, [dom.el('dt', null, 'Fehlentscheidungen'), dom.el('dd', { id: 'training-errors' }, String(s.errors))])
    ]));
    const fb = s.feedback || (s.p >= total
      ? { type: 'ok', text: 'Fertig: ' + summary(s) + '.' }
      : { type: 'info', text: state.algo === 'dijkstra' ? 'Tragen Sie Zeile ' + s.p + ' ein.' : (s.p === 0 ? 'Beginnen Sie beim Startknoten.' : 'Weiter geht es mit dem nächsten Knoten.') });
    // Der Rückmeldungsbereich bleibt bestehen (Live-Region); nur Text und Art wechseln.
    const feedback = dom.byId('training-feedback');
    feedback.className = 'feedback feedback-' + fb.type;
    if (feedback.textContent !== fb.text) {
      feedback.textContent = fb.text;
    }
    feedback.hidden = false;
    if (state.algo === 'dijkstra') {
      renderDijkstra(s);
    } else {
      renderSearch(s);
    }
  }

  function onGraphChange(event) {
    cache = new Map();
    if (event.type === 'move') {
      return;
    }
    const had = ALGOS.some((a) => hasProgress(state[a]));
    for (const a of ALGOS) {
      state[a] = fresh(event.type === 'load' ? null : state[a].start);
    }
    if (draftTimer !== null) {
      clearTimeout(draftTimer);
      draftTimer = null;
    }
    state.note = had ? 'Der Graph wurde geändert – das Training beginnt von vorn.' : '';
  }

  // ---------------------------------------------------------------------------
  // Speicherung (für progress.js)
  // ---------------------------------------------------------------------------

  /**
   * Stand für die Speicherung.
   * @returns {{a:string, bfs:Object, dfs:Object, dijkstra:Object}} Algorithmus und je Algorithmus
   *   {start: Name|null, p, e, draft} (draft nur bei Dijkstra).
   */
  function exportState() {
    const out = { a: state.algo };
    for (const a of ALGOS) {
      const s = state[a];
      out[a] = { start: nameOf(s.start), p: s.p, e: s.errors };
      if (a === 'dijkstra') {
        out[a].draft = { current: s.draft.current, queue: s.draft.queue, rand: s.draft.rand };
      }
    }
    return out;
  }

  /**
   * Übernimmt einen gespeicherten Stand (nach progress.decode). Ungültiges beginnt von vorn.
   * @param {Object} saved - Wie exportState.
   */
  function importState(saved) {
    if (!saved || typeof saved !== 'object') {
      return;
    }
    if (ALGOS.includes(saved.a)) {
      state.algo = saved.a;
    }
    for (const a of ALGOS) {
      const v = saved[a];
      if (!v) {
        continue;
      }
      const node = v.start === null ? null : ns.graph.findNode(v.start);
      const s = fresh(node ? node.id : null);
      if (node && Number.isInteger(v.p) && Number.isInteger(v.e) && v.p >= 0 && v.e >= 0 && v.p <= totalSteps(a, node.id)) {
        s.p = v.p;
        s.errors = v.e;
        if (a === 'dijkstra' && v.draft && v.p < totalSteps(a, node.id)) {
          for (const f of FIELDS) {
            s.draft[f] = typeof v.draft[f] === 'string' ? ns.text.cleanCellText(v.draft[f]).slice(0, INPUT_MAX) : '';
          }
        }
      }
      state[a] = s;
    }
    state.note = '';
  }

  ns.pages = ns.pages || {};
  ns.pages.training = { init, render, onGraphChange, exportState, importState, state: () => state };
})(window.HG = window.HG || {});
