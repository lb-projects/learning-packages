/**
 * @file pages/hand.js
 * @description Seite 3 „Von Hand rechnen“: k-Means Zeile für Zeile selbst rechnen.
 *
 * Eigene Aufgabe:
 *   Die Seite ist von den übrigen Seiten entkoppelt und rechnet mit einer eigenen Aufgabe, die
 *   ausdrücklich geladen wird: „Daten von Seite 1 übernehmen“ kopiert Punkte, Startzentren und Skalierung
 *   auf dem aktuellen Stand (bis 12 Punkte und k = 4); „Neue Zufallsaufgabe“ erzeugt eine Aufgabe
 *   (task-generator.js). Ist die Tabelle in Arbeit, fragen beide vorher nach. Weicht Seite 1 von der
 *   übernommenen Aufgabe ab, erscheint nur ein Hinweis.
 *
 * Ablauf:
 *   Nur die offene Zeile hat Eingabefelder. „Prüfen“ oder die Eingabetaste prüft sie (hand-calc.js). Ist sie
 *   richtig, steht sie fest, und die nächste Zeile erscheint. Der Schalter „Abstände vorgeben“ zeigt die
 *   Abstände der offenen Zeile an, dann ist nur noch der Cluster einzutragen.
 *
 * Hilfe:
 *   Nach zwei Fehlversuchen in derselben Zeile erscheint „Hilfe anzeigen“. Sie öffnet Stufe für Stufe Regel,
 *   Rechenweg und Ergebnis zum Fehler der letzten Prüfung und trägt nichts in die Felder ein.
 *
 * Es wird nichts gespeichert.
 *
 * Abhängigkeiten:
 *   dom-utils.js, sim-format.js, coord-plot.js, hand-calc.js, task-generator.js, cluster-view.js, session.js
 *
 * Sicherheitsaspekte:
 *   Eingaben werden gekürzt und nur als Wert von Eingabefeldern gesetzt, nie als HTML.
 *   Objektbezeichner werden nur als Text eingefügt.
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const session = ns.session;
  const view = ns.clusterView;
  const hand = ns.handCalc;
  const { num, plural } = ns.simFormat;

  /** Höchstlänge einer Eingabe. */
  const INPUT_MAX = 24;
  /** Ab so vielen Fehlversuchen in einer Zeile wird Hilfe angeboten. */
  const HELP_AFTER = 2;
  /** Höchste Hilfestufe. */
  const HELP_LEVELS = 3;
  /** Grenzen für die Übernahme von Seite 1; größere Aufgaben sind von Hand nicht sinnvoll. */
  const MAX_ADOPT_POINTS = 12;
  const MAX_ADOPT_K = 4;

  let plot = null;

  const state = {
    task: null, solved: null, p: 0, errors: 0, helps: 0, rowErrors: 0, helpLevel: 0, helpGroup: null,
    draft: {}, check: null, feedback: null, given: false
  };

  /** Überspringt schon ausgefüllte Zeilen leerer Cluster. */
  function skipAuto() {
    while (state.solved && state.solved.rows[state.p] && state.solved.rows[state.p].auto) {
      state.p++;
    }
  }

  /** Setzt den Stand der Tabelle zurück, die Aufgabe bleibt. */
  function restart() {
    state.p = 0;
    state.errors = 0;
    state.helps = 0;
    state.rowErrors = 0;
    state.helpLevel = 0;
    state.helpGroup = null;
    state.draft = {};
    state.check = null;
    state.feedback = null;
    state.solved = state.task ? hand.solve(state.task.points, state.task.centers) : null;
    skipAuto();
  }

  /**
   * Lädt eine Aufgabe.
   * @param {Object|null} task - Aufgabe oder null.
   */
  function setTask(task) {
    state.task = task;
    restart();
  }

  /** @returns {string} Merkmal des Stands von Seite 1, um Abweichungen zu erkennen. */
  function pageOneKey() {
    return session.version() + '|' + JSON.stringify(session.centers());
  }

  /** @returns {boolean} true, wenn schon gerechnet oder etwas eingetragen wurde. */
  function hasProgress() {
    return state.p > 0 || state.errors > 0 || state.helps > 0 || Object.values(state.draft).some((v) => v !== '');
  }

  /** @returns {boolean} true, wenn die Tabelle überschrieben werden darf. */
  function mayReplace() {
    return !hasProgress() || window.confirm('Die Tabelle beginnt dann von vorn. Fortfahren?');
  }

  /** @returns {boolean} true, wenn die Tabelle vollständig ist. */
  function isDone() {
    return state.p >= state.solved.rows.length;
  }

  /**
   * Prüft, ob Seite 1 übernommen werden kann.
   * @returns {string} Meldung oder ''.
   */
  function adoptProblem() {
    if (session.data.count() === 0) {
      return 'Auf Seite 1 gibt es noch keine Daten.';
    }
    if (session.data.count() > MAX_ADOPT_POINTS) {
      return 'Von Hand lassen sich höchstens ' + MAX_ADOPT_POINTS + ' Punkte sinnvoll rechnen; auf Seite 1 sind es ' + session.data.count() + '.';
    }
    if (session.k() > MAX_ADOPT_K) {
      return 'Von Hand lassen sich höchstens k = ' + MAX_ADOPT_K + ' sinnvoll rechnen; auf Seite 1 ist k = ' + session.k() + '.';
    }
    if (!session.isReady()) {
      return 'Legen Sie zuerst auf Seite 1 alle ' + session.k() + ' Startzentren fest.';
    }
    return '';
  }

  /** Übernimmt die Daten von Seite 1. */
  function adopt() {
    const problem = adoptProblem();
    dom.byId('hand-source-error').textContent = problem;
    if (problem || !mayReplace()) {
      return;
    }
    setTask({
      kind: 'page1',
      points: session.coords().map((c) => [c[0], c[1]]),
      centers: session.modelCenters(),
      names: session.names(),
      attributes: session.axisLabels(),
      scale: session.scale(),
      key: pageOneKey()
    });
    render();
  }

  /** Erzeugt eine neue Zufallsaufgabe. */
  function newRandom() {
    if (!mayReplace()) {
      return;
    }
    dom.byId('hand-source-error').textContent = '';
    const generated = ns.taskGenerator.generate(dom.byId('hand-level').value);
    setTask({
      kind: 'random',
      level: generated.level,
      points: generated.points,
      centers: generated.centers,
      names: generated.points.map((_, i) => 'Punkt ' + (i + 1)),
      attributes: { x: 'x', y: 'y' },
      scale: false,
      key: null
    });
    render();
  }

  /** Prüft die offene Zeile. */
  function check() {
    const row = state.solved.rows[state.p];
    if (!row) {
      return;
    }
    const result = hand.checkRow(state.draft, row, state.given);
    if (result.ok) {
      state.p++;
      skipAuto();
      state.draft = {};
      state.check = null;
      state.rowErrors = 0;
      state.helpLevel = 0;
      state.helpGroup = null;
      state.feedback = { type: 'success', text: 'Zeile ' + state.p + ' ist richtig.' };
      if (isDone()) {
        state.feedback = {
          type: 'success',
          text: 'Geschafft! Die letzte Zuordnung hat nichts mehr geändert: Die Cluster sind stabil. ' + plural(state.solved.iterations, 'Iteration', 'Iterationen') + ', WCSS = ' + num(state.solved.finalWcss) + '.'
        };
      }
    } else {
      if (result.kind === 'calc') {
        state.errors++;
        state.rowErrors++;
        const group = hand.groupOf(result.wrong[0]);
        if (group !== state.helpGroup) {
          state.helpGroup = group;
          state.helpLevel = 0;
        }
      }
      state.check = result;
      state.feedback = result.kind === 'calc'
        ? { type: 'error', text: 'Die Zeile enthält Fehler. Siehe die Hinweise unter der Zeile.' }
        : { type: '', text: 'Bitte die Schreibweise prüfen. Das zählt nicht als Fehlversuch.' };
    }
    render();
    focusOpenRow();
  }

  /** Setzt den Fokus in die offene Zeile, auf das erste falsche oder sonst das erste Feld. */
  function focusOpenRow() {
    const row = state.solved.rows[state.p];
    if (!row) {
      return;
    }
    const wrong = state.check && state.check.wrong.length ? state.check.wrong[0] : hand.fieldsOf(row, state.given)[0];
    const input = document.getElementById('hand-' + wrong);
    if (input) {
      input.focus();
    }
  }

  /** Öffnet die nächste Hilfestufe. */
  function showHelp() {
    state.helpLevel = Math.min(HELP_LEVELS, state.helpLevel + 1);
    state.helps++;
    render();
  }

  /**
   * Hilfe zur offenen Zeile.
   * @param {Object} row - Sollzeile.
   * @returns {HTMLElement|null} Bereich oder null.
   */
  function helpArea(row) {
    if (!state.check || state.check.kind !== 'calc' || state.rowErrors < HELP_AFTER) {
      return null;
    }
    const lines = [];
    for (let level = 1; level <= state.helpLevel; level++) {
      lines.push(...hand.helpFor(row, state.check.wrong, level, state.task.points));
    }
    const button = state.helpLevel < HELP_LEVELS
      ? dom.el('button', { type: 'button', class: 'btn', id: 'hand-help-button' }, state.helpLevel === 0 ? 'Hilfe anzeigen' : 'Mehr Hilfe')
      : null;
    if (button) {
      button.addEventListener('click', showHelp);
    }
    return dom.el('div', { id: 'hand-help-area' }, [
      lines.length ? dom.el('div', { class: 'help-box', id: 'hand-help-text' }, lines.map((l) => dom.el('p', null, l))) : null,
      button
    ]);
  }

  /**
   * Erzeugt ein Eingabefeld der offenen Zeile.
   * @param {string} name - Feld.
   * @returns {HTMLInputElement} Feld.
   */
  function inputOf(name) {
    const wrong = state.check && state.check.wrong.includes(name);
    const input = dom.el('input', {
      type: 'text', id: 'hand-' + name, class: 'hand-input' + (wrong ? ' input-wrong' : ''), inputmode: 'decimal', autocomplete: 'off',
      maxlength: INPUT_MAX, 'aria-label': hand.fieldName(name), 'aria-invalid': wrong ? 'true' : null
    });
    input.value = state.draft[name] || '';
    input.addEventListener('input', () => {
      state.draft[name] = input.value.slice(0, INPUT_MAX);
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        check();
      }
    });
    return input;
  }

  /**
   * Zelle mit dem Punkt einer Zuordnungszeile.
   * @param {Object} row - Sollzeile.
   * @returns {HTMLElement} Zelle.
   */
  function pointCell(row) {
    return dom.el('td', { class: 'hand-given' }, [
      state.task.names[row.point],
      dom.el('span', { class: 'hand-original' }, '(' + num(row.x[0]) + ' | ' + num(row.x[1]) + ')')
    ]);
  }

  /**
   * Markierung eines Clusters.
   * @param {number} c - Cluster ab 0.
   * @returns {HTMLElement} Farbfeld.
   */
  const swatch = (c) => dom.el('span', { class: 'swatch cl-swatch ' + view.clusterClass(c) });

  /**
   * Prüfzelle der offenen Zeile.
   * @returns {HTMLElement} Zelle.
   */
  function checkCell() {
    const button = dom.el('button', { type: 'button', class: 'btn btn-primary', id: 'hand-check' }, 'Prüfen');
    button.addEventListener('click', check);
    return dom.el('td', { class: 'check-cell' }, button);
  }

  /** @returns {HTMLElement} Zelle mit dem Häkchen einer richtigen Zeile. */
  const doneCell = () => dom.el('td', { class: 'check-cell' }, dom.el('span', { class: 'check-ok' }, '✓'));

  /**
   * Zeile der Tabelle.
   * @param {Object} row - Sollzeile.
   * @param {boolean} done - Die Zeile ist fertig.
   * @param {number} k - Anzahl der Cluster.
   * @returns {HTMLElement} Tabellenzeile.
   */
  function rowElement(row, done, k) {
    const open = done ? 'row-done' : 'row-open' + (state.check && state.check.kind === 'calc' ? ' row-wrong' : '');
    if (row.kind === 'assign') {
      const distances = row.d2.map((d, c) => (done || state.given
        ? dom.el('td', { class: 'num' }, num(d))
        : dom.el('td', null, inputOf('d' + c))));
      return dom.el('tr', { class: open }, [
        pointCell(row),
        ...distances,
        done ? dom.el('td', null, [swatch(row.cluster), String(row.cluster + 1)]) : dom.el('td', null, inputOf('cluster')),
        done ? doneCell() : checkCell()
      ]);
    }
    if (row.kind === 'update') {
      const label = [swatch(row.cluster), 'Neues Zentrum ' + (row.cluster + 1)];
      const members = row.auto ? 'kein Punkt, das Zentrum bleibt' : row.members.map((i) => state.task.names[i]).join(', ');
      return dom.el('tr', { class: open }, [
        dom.el('td', { class: 'hand-given' }, [...label, dom.el('span', { class: 'hand-original' }, members)]),
        done
          ? dom.el('td', { colspan: k + 1, class: 'num' }, '(' + num(row.next[0]) + ' | ' + num(row.next[1]) + ')')
          : dom.el('td', { colspan: k + 1, class: 'hand-pair' }, [
            dom.el('label', { for: 'hand-nx' }, 'x = '), inputOf('nx'),
            dom.el('label', { for: 'hand-ny' }, ' y = '), inputOf('ny')
          ]),
        done ? doneCell() : checkCell()
      ]);
    }
    return dom.el('tr', { class: open }, [
      dom.el('td', { class: 'hand-given' }, 'WCSS mit den neuen Zentren'),
      done
        ? dom.el('td', { colspan: k + 1, class: 'num' }, num(row.value))
        : dom.el('td', { colspan: k + 1, class: 'hand-pair' }, [dom.el('label', { for: 'hand-wcss' }, 'WCSS = '), inputOf('wcss')]),
      done ? doneCell() : checkCell()
    ]);
  }

  /** Baut die Tabelle auf. */
  function renderTable() {
    const k = state.task.centers.length;
    const rows = state.solved.rows;
    const body = [];
    let lastHeading = '';
    const total = isDone() ? rows.length : state.p + 1;
    for (let i = 0; i < total; i++) {
      const row = rows[i];
      const heading = 'Iteration ' + row.iteration + (row.kind === 'assign' ? ': Zuordnung' : ': Aktualisierung');
      if (heading !== lastHeading) {
        lastHeading = heading;
        body.push(dom.el('tr', { class: 'hand-iteration' }, dom.el('th', { colspan: k + 3, scope: 'colgroup' }, heading)));
      }
      body.push(rowElement(row, i < state.p, k));
      if (i === state.p && state.check) {
        body.push(dom.el('tr', { class: 'row-hints' }, dom.el('td', { colspan: k + 3 }, [
          dom.el('p', { class: 'hints-title' }, state.check.kind === 'syntax' ? 'Schreibweise prüfen:' : 'Hinweise:'),
          dom.el('ul', { id: 'hand-hints', class: 'hint-list ' + (state.check.kind === 'syntax' ? 'hint-syntax' : 'hint-calc') }, state.check.hints.map((h) => dom.el('li', null, h))),
          helpArea(row)
        ])));
      }
    }
    const head = ['Punkt'];
    for (let c = 0; c < k; c++) {
      head.push('d² zu Zentrum ' + (c + 1));
    }
    head.push('Cluster');
    const box = dom.clear(dom.byId('hand-table'));
    box.appendChild(dom.el('table', { class: 'data-table hand-table' }, [
      dom.el('thead', null, dom.el('tr', null, head.map((t) => dom.el('th', { scope: 'col' }, t)).concat(dom.el('th', { scope: 'col' }, dom.el('span', { class: 'visually-hidden' }, 'Prüfung'))))),
      dom.el('tbody', null, body)
    ]));
  }

  /**
   * Stand nach den richtigen Zeilen.
   * @returns {{centers:number[][], assignment:Array<number|null>}} Aktuelle Zentren und Zuordnung (null = noch offen).
   */
  function currentStand() {
    const rows = state.solved.rows;
    let centers = state.task.centers;
    const assignment = state.task.points.map(() => null);
    for (let i = 0; i < state.p; i++) {
      const row = rows[i];
      if (row.kind === 'assign') {
        assignment[row.point] = row.cluster;
      } else if (row.kind === 'update') {
        centers = centers.map((c, j) => (j === row.cluster ? row.next : c));
      }
    }
    return { centers, assignment };
  }

  /**
   * Zeigt die aktuellen Zentren.
   * @param {number[][]} centers - Zentren.
   */
  function renderCenters(centers) {
    const box = dom.clear(dom.byId('hand-centers'));
    box.appendChild(dom.el('ul', { class: 'hand-center-list' }, centers.map((c, i) => dom.el('li', null, [
      swatch(i), 'Zentrum ' + (i + 1) + ': (' + num(c[0]) + ' | ' + num(c[1]) + ')'
    ]))));
  }

  /**
   * Zeichnet die aufklappbare Visualisierung.
   * @param {number[][]} centers - Zentren.
   * @param {Array<number|null>} assignment - Zuordnung.
   */
  function renderPlot(centers, assignment) {
    const task = state.task;
    const open = state.solved.rows[state.p];
    const v = ns.coordPlot.fitView(task.points.concat(task.centers).map((c) => ({ x: c[0], y: c[1] })), { includeOrigin: true });
    const marks = view.pointMarks(task.points, task.names, assignment);
    if (open && open.kind === 'assign') {
      marks[open.point].ring = 'current';
    }
    plot.render({
      view: v,
      xLabel: task.attributes.x,
      yLabel: task.attributes.y,
      regions: dom.byId('hand-areas').checked ? view.areaRegions(centers, v) : [],
      points: marks.concat(view.centerMarks(centers))
    });
  }

  /** Zeichnet die Seite. */
  function render() {
    const task = state.task;
    dom.byId('hand-empty').hidden = Boolean(task);
    dom.byId('hand-content').hidden = !task;
    dom.byId('hand-differs').hidden = !task || task.kind !== 'page1' || task.key === pageOneKey();
    dom.byId('hand-info').textContent = !task ? '' : task.kind === 'random'
      ? 'Zufallsaufgabe: ' + ns.taskGenerator.LEVELS.find((l) => l.id === task.level).title + '.'
      : 'Übernommen von Seite 1: ' + plural(task.points.length, 'Punkt', 'Punkte') + ', k = ' + task.centers.length + (task.scale ? ', skaliert' : '') + '.';
    dom.byId('hand-given').checked = state.given;
    if (!task) {
      return;
    }
    dom.byId('hand-correct').textContent = String(state.p);
    dom.byId('hand-errors').textContent = String(state.errors);
    dom.byId('hand-helps').textContent = String(state.helps);
    const feedback = dom.byId('hand-feedback');
    const fb = state.feedback || { type: '', text: 'Tragen Sie Zeile ' + (state.p + 1) + ' ein.' };
    feedback.className = 'status' + (fb.type ? ' status-' + fb.type : '');
    feedback.textContent = fb.text;
    dom.byId('hand-next').hidden = !(isDone() && task.kind === 'random');
    const stand = currentStand();
    renderCenters(stand.centers);
    renderTable();
    renderPlot(stand.centers, stand.assignment);
  }

  /** Richtet die Seite ein. */
  function init() {
    const level = dom.byId('hand-level');
    for (const l of ns.taskGenerator.LEVELS) {
      level.appendChild(dom.el('option', { value: l.id }, l.title));
    }
    plot = ns.coordPlot.create(dom.byId('hand-plot'), { ariaLabel: 'Koordinatensystem mit den Punkten der Aufgabe und den aktuellen Zentren' });
    dom.byId('hand-areas').addEventListener('change', render);
    dom.byId('hand-adopt').addEventListener('click', adopt);
    dom.byId('hand-random').addEventListener('click', newRandom);
    dom.byId('hand-next').addEventListener('click', newRandom);
    dom.byId('hand-given').addEventListener('change', (event) => {
      state.given = event.target.checked;
      state.check = null;
      render();
    });
    dom.byId('hand-restart').addEventListener('click', () => {
      if (hasProgress() && !window.confirm('Die Tabelle beginnt von vorn. Fortfahren?')) {
        return;
      }
      restart();
      render();
    });
  }

  ns.pages.hand = {
    init, render,
    state: () => state,
    /** Setzt die Seite zurück (für Tests). */
    clear: () => { state.given = false; setTask(null); render(); }
  };
})(window.CC = window.CC || {});
