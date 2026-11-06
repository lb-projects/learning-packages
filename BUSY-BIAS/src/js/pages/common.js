/**
 * @file pages/common.js
 * @description Bausteine, die mehrere Seiten teilen: Legenden, Geradengleichung, Ergebnis eines
 *              Trainingsschritts, Zähler, Punktetabelle und Lernkurve.
 *
 * Abhängigkeiten:
 *   dom-utils.js, coord-plot.js, format-utils.js, perceptron.js, session.js
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  ns.pages = ns.pages || {};
  const { num, plural } = ns.simFormat;

  /** Überschrift je Schritt. */
  const PHASE_TITLES = {
    idle: 'Bereit: „Weiter“ startet das Training.',
    highlight: 'Schritt 1: Trainingspunkt hervorheben',
    inputs: 'Schritt 2: Eingänge vorbelegen',
    sum: 'Schritt 3: Gewichtete Summe berechnen',
    output: 'Schritt 4: Ausgabe berechnen und vergleichen',
    update: 'Schritt 5: Gewichte und Schwellenwert anpassen'
  };
  /** Höchstzahl der Punkte, die die Lernkurve zeichnet. */
  const CURVE_MAX_POINTS = 200;
  /** Bis zu dieser Zahl von Iterationen trägt die Lernkurve Punkte. */
  const CURVE_MARKERS_UP_TO = 60;

  /**
   * Zeigt die Legende der Punkte.
   * @param {HTMLElement} box - Behälter (wird geleert).
   * @param {{fire:(string|null), noFire:(string|null)}} [labels] - Eigene Labels; ohne Angabe die von Seite 1.
   */
  function renderPointLegend(box, labels) {
    const data = ns.session.data;
    dom.clear(box);
    if (!labels && data.labels().length === 0) {
      return;
    }
    const fire = labels ? labels.fire : data.labelOf(1);
    const noFire = labels ? labels.noFire : data.labelOf(0);
    if (fire !== null) {
      box.appendChild(dom.el('li', null, [ns.coordPlot.markerIcon('circle', 'pt-fire'), ' Label ' + fire + ' (t = 1)']));
    }
    if (noFire !== null) {
      box.appendChild(dom.el('li', null, [ns.coordPlot.markerIcon('square', 'pt-nofire'), ' Label ' + noFire + ' (t = 0)']));
    }
  }

  /**
   * Zeigt die Legende der Decision Areas.
   * @param {HTMLElement} box - Behälter (wird geleert).
   */
  function renderAreaLegend(box) {
    dom.clear(box);
    dom.appendChildren(box, [
      dom.el('li', null, [dom.el('span', { class: 'swatch swatch-fire' }), 'Perzeptron feuert (a ≥ θ)']),
      dom.el('li', null, [dom.el('span', { class: 'swatch swatch-nofire' }), 'Perzeptron feuert nicht (a < θ)'])
    ]);
  }

  /**
   * Zeigt eine Geradengleichung.
   * @param {HTMLElement} box - Behälter (wird geleert).
   * @param {boolean} outside - Die Gerade verläuft außerhalb des Ausschnitts.
   * @param {{w:number[], theta:number, label:string}} [source] - Werte und Bezeichnung; ohne Angabe der aktuelle Stand.
   */
  function renderEquation(box, outside, source) {
    const trainer = ns.session.trainer();
    const w = source ? source.w : trainer.weights();
    const theta = source ? source.theta : trainer.theta();
    const line = ns.perceptron.lineOf(w, theta);
    dom.clear(box);
    box.appendChild(dom.el('p', { class: 'equation' }, [(source ? source.label : 'Gerade') + ': ', dom.el('strong', null, ns.fmt.equation(line))]));
    box.appendChild(dom.el('p', { class: 'hint' }, 'Allgemeine Form: ' + ns.fmt.generalForm(w, theta)));
    if (line.kind === 'none') {
      box.appendChild(dom.el('p', { class: 'hint' }, line.fires ? 'Die ganze Fläche feuert, weil 0 ≥ θ gilt.' : 'Die ganze Fläche feuert nicht, weil 0 < θ gilt.'));
    }
    if (outside) {
      box.appendChild(dom.el('p', { class: 'hint' }, 'Die Gerade liegt außerhalb des Ausschnitts.'));
    }
  }

  /**
   * Zeigt das Ergebnis des aktuellen Trainingsschritts.
   * @param {HTMLElement} box - Behälter (wird geleert).
   * @param {Object} trainer - Trainer.
   * @param {string} prefix - Präfix für Element-IDs.
   */
  function renderStepResult(box, trainer, prefix) {
    const data = ns.session.data;
    const phase = trainer.phase();
    const r = trainer.record();
    dom.clear(box);
    box.appendChild(dom.el('p', { class: 'result-title', id: prefix + '-phase' }, trainer.isFinished() ? 'Trenngerade gefunden.' : PHASE_TITLES[phase]));
    if (!r) {
      return;
    }
    const add = (id, text, cls) => box.appendChild(dom.el('p', { id: prefix + '-' + id, class: cls || null }, text));
    add('point', ns.fmt.pointTitle(r) + ' in Iteration ' + r.iteration + ': ' + ns.fmt.inputsText(r.x, r.raw) + (r.group ? ' (' + r.group + ')' : ''));
    if (phase === 'sum' || phase === 'output' || phase === 'update') {
      add('sum', ns.fmt.sumLine(r.wBefore, r.x, r.sum));
    }
    if (phase === 'output' || phase === 'update') {
      add('activation', ns.fmt.activationLine(r.sum, r.thetaBefore, r.y));
      add('expected', 'Erwartet: Label ' + r.label + ' (t = ' + r.t + ')');
      add('computed', 'Berechnet: Label ' + ns.fmt.labelText(data.labelOf(r.y)) + ' (f(a) = ' + r.y + ')');
      add('verdict', r.delta === 0 ? 'Richtig klassifiziert: keine Anpassung nötig.' : 'Falsch klassifiziert: δ = ' + num(r.delta) + (phase === 'output' ? ', Gewichte und Schwellenwert müssen angepasst werden.' : ''), r.delta === 0 ? 'result-ok' : 'result-wrong');
    }
    if (phase === 'update') {
      add('update', 'w₁: ' + num(r.wBefore[0]) + ' → ' + num(r.wAfter[0]) + ', w₂: ' + num(r.wBefore[1]) + ' → ' + num(r.wAfter[1]) + ', θ: ' + num(r.thetaBefore) + ' → ' + num(r.thetaAfter));
    }
  }

  /**
   * Zeigt die Zähler eines Trainings.
   * @param {Object} trainer - Trainer.
   * @param {{iteration:string, processed:string, last:string, found:string, hint:string}} ids - Element-IDs.
   */
  function renderCounters(trainer, ids) {
    const last = trainer.lastPass();
    dom.byId(ids.iteration).textContent = String(trainer.iteration());
    dom.byId(ids.processed).textContent = String(trainer.processed());
    dom.byId(ids.last).textContent = last ? last.correct + ' von ' + last.total : '–';
    const found = dom.byId(ids.found);
    found.hidden = !trainer.isFinished();
    found.textContent = trainer.isFinished() ? ns.session.statusText(trainer) : '';
    dom.byId(ids.hint).hidden = !ns.session.mightBeInseparable(trainer);
  }

  /**
   * Füllt eine Punktetabelle; bei Skalierung mit Original- und skalierten Werten.
   * @param {HTMLElement} head - Kopfzeile (wird geleert).
   * @param {HTMLElement} tbody - Tabellenkörper (wird geleert).
   * @param {{points:Array<Object>, attributes:Object}} [task] - Eigene Aufgabe (Seite 5); ohne Angabe die Daten von Seite 1.
   */
  function renderPointTable(head, tbody, task) {
    const data = ns.session.data;
    const scaler = ns.session.scalerFor(data.points());
    const points = task ? task.points : ns.session.modelPoints(data.points(), scaler);
    const hasGroups = points.some((p) => p.group);
    const attrs = task ? task.attributes : data.attributes();
    const scaled = points.some((p) => p.raw);
    const numCol = (text) => dom.el('th', { scope: 'col', class: 'num' }, text);
    dom.clear(head);
    dom.appendChildren(head, [
      numCol('Nr.'), numCol(attrs.x), numCol(attrs.y),
      scaled ? numCol('x₁ skaliert') : null,
      scaled ? numCol('x₂ skaliert') : null,
      dom.el('th', { scope: 'col' }, 'Label'),
      numCol('t'),
      hasGroups ? dom.el('th', { scope: 'col' }, 'Stufe, Gruppe') : null
    ]);
    dom.clear(tbody);
    points.forEach((p, i) => {
      const original = p.raw || p.x;
      tbody.appendChild(dom.el('tr', null, [
        dom.el('td', { class: 'num' }, i + 1),
        dom.el('td', { class: 'num' }, num(original[0])),
        dom.el('td', { class: 'num' }, num(original[1])),
        scaled ? dom.el('td', { class: 'num' }, num(p.x[0])) : null,
        scaled ? dom.el('td', { class: 'num' }, num(p.x[1])) : null,
        dom.el('td', null, p.label),
        dom.el('td', { class: 'num' }, p.t),
        hasGroups ? dom.el('td', null, p.group ? p.stage + ', ' + p.group : '–') : null
      ]));
    });
  }

  /**
   * Dünnt den Verlauf fürs Zeichnen aus; der letzte Wert bleibt immer erhalten.
   * @param {number[]} history - Richtige Punkte je Iteration.
   * @param {number} [max] - Höchstzahl der Punkte.
   * @returns {Array<{x:number, y:number}>} Punkte, x = Nummer der Iteration ab 1.
   */
  function thinHistory(history, max) {
    const limit = max || CURVE_MAX_POINTS;
    const stride = Math.max(1, Math.ceil(history.length / limit));
    const out = [];
    for (let i = 0; i < history.length; i += stride) {
      out.push({ x: i + 1, y: history[i] });
    }
    if (history.length > 0 && out[out.length - 1].x !== history.length) {
      if (out.length >= limit) {
        out.pop();
      }
      out.push({ x: history.length, y: history[history.length - 1] });
    }
    return out;
  }

  /**
   * Zeichnet die Lernkurve.
   * @param {Object} plot - Koordinatensystem.
   * @param {number[]} history - Richtige Punkte je Iteration.
   * @param {number} total - Punkte je Iteration.
   */
  function renderLearningCurve(plot, history, total) {
    const points = thinHistory(history);
    const xEnd = Math.max(10, history.length);
    const yEnd = Math.max(1, total);
    const lines = [{ x1: 0, y1: yEnd, x2: xEnd, y2: yEnd, cls: 'curve-goal' }];
    for (let i = 1; i < points.length; i++) {
      lines.push({ x1: points[i - 1].x, y1: points[i - 1].y, x2: points[i].x, y2: points[i].y, cls: 'curve-line' });
    }
    plot.render({
      view: ns.coordPlot.fitView([{ x: 0, y: 0 }, { x: xEnd, y: yEnd }]),
      xLabel: 'Iteration',
      yLabel: 'Richtig klassifizierte Punkte',
      lines,
      points: history.length <= CURVE_MARKERS_UP_TO
        ? points.map((p) => ({ x: p.x, y: p.y, shape: 'circle', cls: 'pt-curve', title: 'Iteration ' + p.x + ': ' + plural(p.y, 'Punkt', 'Punkte') + ' richtig' }))
        : []
    });
  }

  ns.pages.common = { renderPointLegend, renderAreaLegend, renderEquation, renderStepResult, renderCounters, renderPointTable, renderLearningCurve, thinHistory };
})(window.BB = window.BB || {});
