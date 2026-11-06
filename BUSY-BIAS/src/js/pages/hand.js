/**
 * @file pages/hand.js
 * @description Seite 5 „Von Hand rechnen“: Tabelle Zeile für Zeile selbst ausfüllen, wie die
 *              Dijkstra-Tabelle in EDGY EDGES.
 *
 * Eigene Aufgabe:
 *   Die Seite ist von den übrigen Seiten entkoppelt. Sie rechnet mit einer eigenen Aufgabe, die
 *   ausdrücklich geladen wird: „Daten von Seite 1 übernehmen“ kopiert Punkte, Startwerte, Lernrate und
 *   Skalierung auf dem aktuellen Stand; „Neue Zufallsaufgabe“ erzeugt eine Aufgabe (task-generator.js).
 *   Ist die Tabelle in Arbeit, fragen beide vorher nach. Änderungen auf anderen Seiten wirken nicht von
 *   selbst; weicht Seite 1 von der übernommenen Aufgabe ab, erscheint nur ein Hinweis.
 *
 * Ablauf:
 *   Nur die offene Zeile hat Eingabefelder. „Prüfen“ oder die Eingabetaste prüft sie (hand-calc.js).
 *   Ist sie richtig, steht sie fest, und die nächste Zeile erscheint. Nach einer Iteration ohne
 *   Anpassung kommt der Erfolgshinweis.
 *
 * Visualisierung:
 *   Aufklappbar unter der Tabelle: die Punkte der Aufgabe, die Gerade nach der letzten richtigen Zeile
 *   und auf Wunsch die Decision Areas. Der Punkt der offenen Zeile ist hervorgehoben.
 *
 * Hilfe:
 *   Nach zwei Fehlversuchen in derselben Zeile erscheint „Hilfe anzeigen“. Sie öffnet Stufe für Stufe
 *   Regel, Rechenweg und Ergebnis zum Fehler der letzten Prüfung und trägt nichts in die Felder ein.
 *   Findet die nächste Prüfung einen Fehler in einer anderen Prüfstufe, beginnt die Hilfe dort neu.
 *
 * Abhängigkeiten:
 *   dom-utils.js, sim-format.js, hand-calc.js, task-generator.js, format-utils.js, session.js,
 *   progress.js, pages/common.js
 *
 * Sicherheitsaspekte:
 *   Eingaben werden gekürzt und nur als Wert von Eingabefeldern gesetzt, nie als HTML.
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const session = ns.session;
  const { num, plural } = ns.simFormat;
  const hand = ns.handCalc;

  /** Höchstlänge einer Eingabe. */
  const INPUT_MAX = 24;
  /** Höchstzahl der gespeicherten richtigen Zeilen, die beim Wiederherstellen akzeptiert wird. */
  const MAX_ROWS = 5000;
  /** Ab so vielen Fehlversuchen in einer Zeile wird Hilfe angeboten. */
  const HELP_AFTER = 2;
  /** Höchste Hilfestufe. */
  const HELP_LEVELS = 3;

  let plot = null;

  const blankDraft = () => Object.fromEntries(hand.FIELDS.map((f) => [f, '']));
  const state = {
    task: null, solver: null, p: 0, errors: 0, helps: 0, rowErrors: 0, helpLevel: 0, helpGroup: null,
    draft: blankDraft(), check: null, feedback: null
  };

  /** Setzt den Stand der Tabelle zurück, die Aufgabe bleibt. */
  function restart() {
    state.p = 0;
    state.errors = 0;
    state.helps = 0;
    state.rowErrors = 0;
    state.helpLevel = 0;
    state.helpGroup = null;
    state.draft = blankDraft();
    state.check = null;
    state.feedback = null;
    state.solver = state.task ? hand.createSolver(state.task.points, state.task.w, state.task.theta, state.task.alpha) : null;
  }

  /**
   * Lädt eine Aufgabe.
   * @param {Object|null} task - Aufgabe oder null.
   */
  function setTask(task) {
    state.task = task;
    restart();
  }

  /** @returns {Object} Aufgabe aus dem aktuellen Stand von Seite 1. */
  function taskFromPageOne() {
    const points = session.data.points();
    const c = session.config;
    return {
      kind: 'page1',
      points: session.modelPoints(points, session.scalerFor(points)),
      w: [...c.w], theta: c.theta, alpha: session.rate(), scale: c.scale,
      attributes: session.data.attributes(),
      key: session.dataKey()
    };
  }

  /**
   * Zufallsaufgabe in der Form einer Aufgabe.
   * @param {Object} generated - Ergebnis von taskGenerator.generate.
   * @returns {Object} Aufgabe.
   */
  function randomTask(generated) {
    return { kind: 'random', level: generated.level, points: generated.points, w: generated.w, theta: generated.theta, alpha: generated.alpha, scale: false, attributes: { ...ns.pointData.DEFAULT_ATTRIBUTES } };
  }

  /** @returns {boolean} true, wenn schon etwas eingetragen oder geprüft wurde. */
  function hasProgress() {
    return state.p > 0 || state.errors > 0 || state.helps > 0 || hand.FIELDS.some((f) => state.draft[f] !== '');
  }

  /** @returns {boolean} true, wenn die Tabelle überschrieben werden darf. */
  function mayReplace() {
    return !hasProgress() || window.confirm('Die Tabelle beginnt dann von vorn. Fortfahren?');
  }

  /** @returns {boolean} true, wenn die Trenngerade gefunden ist. */
  function isDone() {
    const end = state.solver.finishedAt();
    return end !== null && state.p >= end;
  }

  /** Übernimmt die Daten von Seite 1. */
  function adopt() {
    const error = dom.byId('hand-source-error');
    if (session.data.count() === 0) {
      error.textContent = 'Auf Seite 1 gibt es noch keine Trainingspunkte.';
      return;
    }
    error.textContent = '';
    if (mayReplace()) {
      setTask(taskFromPageOne());
      render();
      ns.progress.save();
    }
  }

  /** Erzeugt eine neue Zufallsaufgabe. */
  function newRandom() {
    if (mayReplace()) {
      dom.byId('hand-source-error').textContent = '';
      setTask(randomTask(ns.taskGenerator.generate(dom.byId('hand-level').value)));
      render();
      ns.progress.save();
    }
  }

  /** Prüft die offene Zeile. */
  function check() {
    const row = state.solver.rowAt(state.p);
    if (!row) {
      return;
    }
    const result = hand.checkRow(state.draft, row, state.p === 0);
    if (result.ok) {
      state.p++;
      state.draft = blankDraft();
      state.check = null;
      state.rowErrors = 0;
      state.helpLevel = 0;
      state.helpGroup = null;
      state.feedback = { type: 'success', text: 'Zeile ' + state.p + ' ist richtig.' };
      state.solver.rowAt(state.p);
      if (isDone()) {
        state.feedback = {
          type: 'success',
          text: 'Geschafft! Eine ganze Iteration ohne Anpassung: Die Trenngerade ist gefunden. ' + plural(state.p, 'Zeile', 'Zeilen') + ', Gerade: ' +
            ns.fmt.equation(ns.perceptron.lineOf(row.newW, row.newTheta)) + '.'
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
    ns.progress.save();
    const first = document.getElementById(state.check && state.check.wrong.length ? 'hand-' + state.check.wrong[0] : 'hand-w1');
    if (first) {
      first.focus();
    }
  }

  /** Öffnet die nächste Hilfestufe. */
  function showHelp() {
    state.helpLevel = Math.min(HELP_LEVELS, state.helpLevel + 1);
    state.helps++;
    render();
    ns.progress.save();
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
      lines.push(...hand.helpFor(row, state.check.wrong, level, state.p === 0));
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
   * @returns {HTMLElement} Zelle.
   */
  function inputCell(name) {
    const wrong = state.check && state.check.wrong.includes(name);
    const input = dom.el('input', {
      type: 'text', id: 'hand-' + name, class: 'hand-input' + (wrong ? ' input-wrong' : ''), inputmode: 'decimal', autocomplete: 'off',
      maxlength: INPUT_MAX, 'aria-label': hand.NAMES[name], 'aria-invalid': wrong ? 'true' : null
    });
    input.value = state.draft[name];
    input.addEventListener('input', () => {
      state.draft[name] = input.value.slice(0, INPUT_MAX);
      ns.progress.saveLater();
    });
    input.addEventListener('change', () => ns.progress.save());
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        check();
      }
    });
    return dom.el('td', null, input);
  }

  /**
   * Zelle mit dem Punkt.
   * @param {Object} row - Sollzeile.
   * @returns {HTMLElement} Zelle.
   */
  function pointCell(row) {
    return dom.el('td', { class: 'hand-given' }, [
      '(' + num(row.x[0]) + ' | ' + num(row.x[1]) + ')',
      row.raw ? dom.el('span', { class: 'hand-original' }, 'Original (' + num(row.raw[0]) + ' | ' + num(row.raw[1]) + ')') : null
    ]);
  }

  /**
   * Zelle mit einem neuen Wert einer festen Zeile; frei, wenn er gleich bleibt.
   * @param {number} old - Alter Wert.
   * @param {number} next - Neuer Wert.
   * @returns {HTMLElement} Zelle.
   */
  function newCell(old, next) {
    return dom.el('td', { class: 'num' }, next === old ? '' : num(next));
  }

  /** Baut die Tabelle auf. */
  function renderTable() {
    const body = [];
    let lastIteration = 0;
    const total = state.p + (isDone() ? 0 : 1);
    for (let i = 0; i < total; i++) {
      const row = state.solver.rowAt(i);
      if (!row) {
        break;
      }
      if (row.iteration !== lastIteration) {
        lastIteration = row.iteration;
        body.push(dom.el('tr', { class: 'hand-iteration' }, dom.el('th', { colspan: 11, scope: 'colgroup' }, 'Iteration ' + row.iteration)));
      }
      const label = row.label + ' (t = ' + row.t + ')';
      if (i < state.p) {
        body.push(dom.el('tr', { class: 'row-done' }, [
          pointCell(row),
          dom.el('td', { class: 'hand-given' }, label),
          dom.el('td', { class: 'num' }, num(row.w[0])),
          dom.el('td', { class: 'num' }, num(row.w[1])),
          dom.el('td', { class: 'num' }, num(row.theta)),
          dom.el('td', { class: 'num' }, num(row.sum)),
          dom.el('td', { class: 'num' }, row.y),
          newCell(row.w[0], row.newW[0]),
          newCell(row.w[1], row.newW[1]),
          newCell(row.theta, row.newTheta),
          dom.el('td', { class: 'check-cell' }, dom.el('span', { class: 'check-ok' }, '✓'))
        ]));
      } else {
        const button = dom.el('button', { type: 'button', class: 'btn btn-primary', id: 'hand-check' }, 'Prüfen');
        button.addEventListener('click', check);
        body.push(dom.el('tr', { class: 'row-open' + (state.check && state.check.kind === 'calc' ? ' row-wrong' : '') }, [
          pointCell(row),
          dom.el('td', { class: 'hand-given' }, label),
          ...hand.FIELDS.map(inputCell),
          dom.el('td', { class: 'check-cell' }, button)
        ]));
        if (state.check) {
          body.push(dom.el('tr', { class: 'row-hints' }, dom.el('td', { colspan: 11 }, [
            dom.el('p', { class: 'hints-title' }, state.check.kind === 'syntax' ? 'Schreibweise prüfen:' : 'Hinweise:'),
            dom.el('ul', { id: 'hand-hints', class: 'hint-list ' + (state.check.kind === 'syntax' ? 'hint-syntax' : 'hint-calc') }, state.check.hints.map((h) => dom.el('li', null, h))),
            helpArea(row)
          ])));
        }
      }
    }
    const box = dom.clear(dom.byId('hand-table'));
    box.appendChild(dom.el('table', { class: 'data-table hand-table' }, [
      dom.el('thead', null, dom.el('tr', null, [
        '(x₁ | x₂)', 'Label t', 'Gewicht w₁', 'Gewicht w₂', 'Schwellenwert θ', 'Gew. Summe a', 'f(a)', 'Neues w₁', 'Neues w₂', 'Neues θ'
      ].map((t) => dom.el('th', { scope: 'col' }, t)).concat(dom.el('th', { scope: 'col' }, dom.el('span', { class: 'visually-hidden' }, 'Prüfung'))))),
      dom.el('tbody', null, body)
    ]));
  }

  /** Zeichnet die aufklappbare Visualisierung. */
  function renderPlot() {
    const task = state.task;
    const done = state.p > 0 ? state.solver.rowAt(state.p - 1) : null;
    const values = done ? { w: done.newW, theta: done.newTheta } : { w: task.w, theta: task.theta };
    const open = isDone() ? null : state.solver.rowAt(state.p);
    const marks = task.points.map((p, i) => ({
      x: p.x[0], y: p.x[1],
      shape: p.t === 1 ? 'circle' : 'square',
      cls: p.t === 1 ? 'pt-fire' : 'pt-nofire',
      ring: open && open.index === i ? 'current' : null,
      title: 'Punkt ' + (i + 1) + ': (' + num(p.x[0]) + ' | ' + num(p.x[1]) + '), Label ' + p.label + (p.group ? ', ' + p.group : '')
    }));
    const axis = (symbol, name) => (name === symbol ? symbol : symbol + ': ' + name) + (task.scale ? ' (skaliert)' : '');
    const { spec, outside } = session.plotSpec({
      line: true, areas: dom.byId('hand-areas').checked, values, marks,
      xLabel: axis('x₁', task.attributes.x), yLabel: axis('x₂', task.attributes.y)
    });
    plot.render(spec);
    const labelFor = (t) => {
      const found = task.points.find((p) => p.t === t);
      return found ? found.label : null;
    };
    ns.pages.common.renderPointLegend(dom.byId('hand-point-legend'), { fire: labelFor(1), noFire: labelFor(0) });
    ns.pages.common.renderEquation(dom.byId('hand-equation'), outside, { ...values, label: 'Aktuelle Gerade' });
  }

  /** Zeigt die Erklärung mit den Werten der Aufgabe. */
  function renderHelp() {
    const task = state.task;
    const alpha = task.alpha === null ? '' : 'α · ';
    const box = dom.clear(dom.byId('hand-help'));
    dom.appendChildren(box, [
      dom.el('h3', null, 'So geht es'),
      dom.el('p', null, 'Füllen Sie die Tabelle Zeile für Zeile aus und klicken Sie auf „Prüfen“ (oder drücken Sie die Eingabetaste). Ist die Zeile richtig, erscheint die nächste. Die Spalten „Neu“ dürfen frei bleiben, wenn sich der Wert nicht ändert. Runden Sie krumme Zahlen auf mindestens zwei Nachkommastellen.'),
      dom.el('ul', { class: 'hint' }, [
        dom.el('li', { id: 'hand-start' }, 'Startwerte: w₁ = ' + num(task.w[0]) + ', w₂ = ' + num(task.w[1]) + ', θ = ' + num(task.theta) + (task.alpha === null ? ' (ohne Lernrate, also α = 1)' : ', Lernrate α = ' + num(task.alpha))),
        dom.el('li', null, 'a = w₁ · x₁ + w₂ · x₂; f(a) = 1, falls a ≥ θ, sonst 0'),
        dom.el('li', null, 'δ = t − f(a); nur bei δ ≠ 0: neues wᵢ = wᵢ + ' + alpha + 'δ · xᵢ und neues θ = θ − ' + alpha + 'δ'),
        task.scale ? dom.el('li', null, 'Die Daten sind skaliert: Gerechnet wird mit den Werten von 0 bis 1.') : null
      ])
    ]);
  }

  /** Zeichnet die Seite. */
  function render() {
    const task = state.task;
    dom.byId('hand-empty').hidden = Boolean(task);
    dom.byId('hand-content').hidden = !task;
    dom.byId('hand-differs').hidden = !task || task.kind !== 'page1' || task.key === session.dataKey();
    dom.byId('hand-info').textContent = !task ? '' : task.kind === 'random'
      ? 'Zufallsaufgabe: ' + ns.taskGenerator.LEVELS.find((l) => l.id === task.level).title + '.'
      : 'Übernommen von Seite 1: ' + plural(task.points.length, 'Punkt', 'Punkte') + '.';
    if (!task) {
      return;
    }
    renderHelp();
    dom.byId('hand-correct').textContent = String(state.p);
    dom.byId('hand-errors').textContent = String(state.errors);
    dom.byId('hand-helps').textContent = String(state.helps);
    const feedback = dom.byId('hand-feedback');
    const fb = state.feedback || { type: '', text: 'Tragen Sie Zeile ' + (state.p + 1) + ' ein.' };
    feedback.className = 'status' + (fb.type ? ' status-' + fb.type : '');
    feedback.textContent = fb.text;
    const passes = Math.floor(state.p / task.points.length);
    dom.byId('hand-hint').hidden = isDone() || passes < session.INSEPARABLE_HINT;
    dom.byId('hand-next').hidden = !(isDone() && task.kind === 'random');
    renderTable();
    renderPlot();
    ns.pages.common.renderPointTable(dom.byId('hand-thead'), dom.byId('hand-tbody'), task);
    dom.byId('hand-points-count').textContent = '(' + task.points.length + ')';
  }

  /** Richtet die Seite ein. */
  function init() {
    const level = dom.byId('hand-level');
    for (const l of ns.taskGenerator.LEVELS) {
      level.appendChild(dom.el('option', { value: l.id }, l.title));
    }
    plot = ns.coordPlot.create(dom.byId('hand-plot'), { ariaLabel: 'Koordinatensystem mit den Punkten der Aufgabe und der aktuellen Geraden' });
    ns.pages.common.renderAreaLegend(dom.byId('hand-area-legend'));
    dom.byId('hand-areas').addEventListener('change', render);
    dom.byId('hand-adopt').addEventListener('click', adopt);
    dom.byId('hand-random').addEventListener('click', newRandom);
    dom.byId('hand-next').addEventListener('click', newRandom);
    dom.byId('hand-restart').addEventListener('click', () => {
      if (hasProgress() && !window.confirm('Die Tabelle beginnt von vorn. Fortfahren?')) {
        return;
      }
      restart();
      render();
      ns.progress.save();
    });
  }

  /**
   * Stand für die Speicherung.
   * @returns {Object} task: die Aufgabe; matchesPageOne: Sie stimmt mit Seite 1 überein;
   *   p, e, helps, rowErrors, helpLevel, draft: Stand der Tabelle.
   */
  function exportState() {
    return {
      task: state.task,
      matchesPageOne: Boolean(state.task) && state.task.kind === 'page1' && state.task.key === session.dataKey(),
      p: state.p, e: state.errors, helps: state.helps, rowErrors: state.rowErrors, helpLevel: state.helpLevel,
      draft: hand.FIELDS.map((f) => state.draft[f])
    };
  }

  /**
   * Übernimmt eine gespeicherte Aufgabe mit ihrem Stand.
   * @param {Object|null} saved - {task | samePageOne:true, p, e, helps, rowErrors, helpLevel, draft}.
   * @returns {boolean} true, wenn der Stand übernommen wurde; sonst bleibt die Seite ohne Stand.
   */
  function importState(saved) {
    setTask(null);
    if (!saved) {
      return false;
    }
    if (saved.samePageOne) {
      if (session.data.count() === 0) {
        return false;
      }
      setTask(taskFromPageOne());
    } else if (saved.task) {
      setTask(saved.task);
    } else {
      return false;
    }
    const count = (v, max) => Number.isInteger(v) && v >= 0 && v <= max;
    const valid = count(saved.p, MAX_ROWS) && count(saved.e, 1000000) && count(saved.helps, 1000000) && count(saved.rowErrors, 1000000) &&
      count(saved.helpLevel, HELP_LEVELS) && Array.isArray(saved.draft) && saved.draft.length === hand.FIELDS.length &&
      saved.draft.every((d) => typeof d === 'string' && d.length <= INPUT_MAX) && (saved.p === 0 || Boolean(state.solver.rowAt(saved.p - 1)));
    if (!valid) {
      return false;
    }
    state.p = saved.p;
    state.errors = saved.e;
    state.helps = saved.helps;
    state.rowErrors = saved.rowErrors;
    hand.FIELDS.forEach((f, i) => {
      state.draft[f] = ns.text.cleanCellText(saved.draft[i]);
    });
    // Hinweise und Hilfe der offenen Zeile ergeben sich aus den Eingaben.
    const row = state.solver.rowAt(state.p);
    if (saved.rowErrors > 0 && row) {
      const result = hand.checkRow(state.draft, row, state.p === 0);
      if (result.kind === 'calc') {
        state.check = result;
        state.helpGroup = hand.groupOf(result.wrong[0]);
        state.helpLevel = saved.helpLevel;
      }
    }
    return true;
  }

  /** Entfernt die Aufgabe. */
  function clear() {
    setTask(null);
  }

  ns.pages.hand = { init, render, exportState, importState, hasProgress, clear, INPUT_MAX, HELP_AFTER };
})(window.BB = window.BB || {});
