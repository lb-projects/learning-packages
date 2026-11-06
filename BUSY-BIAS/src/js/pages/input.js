/**
 * @file pages/input.js
 * @description Seite 1: Trainingspunkte eingeben und das Perzeptron konfigurieren.
 *
 * Aufbau:
 *   Links Daten laden, Stufenkarte, Punktmaske (data-panel.js) und die Konfiguration: feuerndes
 *   Label, Startgewichte, Startschwellenwert, optionale Lernrate, Definition der Heaviside-Funktion.
 *   Rechts die Visualisierung der Punkte mit der Geraden des konfigurierten Perzeptrons und auf
 *   Wunsch den Decision Areas, darunter die Punktetabelle. Gezeichnet werden hier immer die
 *   Startwerte, auch wenn das Training schon läuft; der Schalter gilt auch für Seite 2.
 *
 * Einstellungen:
 *   Gültige Eingaben gelten sofort und setzen das Training zurück. Bei einer ungültigen
 *   Eingabe bleibt der letzte gültige Wert bestehen, und eine Meldung nennt das Feld.
 *   „Zufällig belegen“ setzt w₁, w₂ und θ auf ganze Zahlen von −5 bis 5. Ein Klick ins Feld der
 *   Lernrate oder eine Eingabe dort schaltet die Lernrate ein. Im Feld mit Fokus ändert auch
 *   das Mausrad den Wert (number-wheel.js).
 *
 * Abhängigkeiten:
 *   dom-utils.js, data-panel.js, coord-plot.js, point-data.js, session.js, pages/common.js
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const session = ns.session;
  const RANDOM_MIN = -5;
  const RANDOM_MAX = 5;
  /** Kleinste erlaubte Lernrate. */
  const ALPHA_MIN = 0.0001;

  let plot = null;
  let panel = null;

  /** @returns {Object} Eingabefelder der Konfiguration. */
  function fields() {
    return { w1: dom.byId('cfg-w1'), w2: dom.byId('cfg-w2'), theta: dom.byId('cfg-theta'), alphaOn: dom.byId('cfg-alpha-on'), alpha: dom.byId('cfg-alpha'), scale: dom.byId('cfg-scale') };
  }

  /** Erklärung des Dateiformats. */
  function formatHelp() {
    return [
      dom.el('p', null, ['Erste Zeile: ', dom.el('code', null, 'Attribut x;Attribut y;Label'), '. Sie ist Pflicht; der dritte Eintrag heißt genau „Label“.']),
      dom.el('p', null, ['Danach je Zeile zwei Zahlen und das Label, z. B. ', dom.el('code', null, '1,5;2;bestanden'), '.']),
      dom.el('p', null, 'Trennzeichen: Semikolon, Komma oder Tabulator. Das Dezimalkomma ist beim Semikolon möglich. Höchstens zwei verschiedene Labels und 500 Punkte; Zahlen von −1000 bis 1000.')
    ];
  }

  /** Überträgt die Felder in die Einstellungen, wenn alle gültig sind. */
  function applyConfig() {
    const f = fields();
    const error = dom.byId('cfg-error');
    const checks = [
      ns.pointData.validateNumber(f.w1.value, 'w₁'),
      ns.pointData.validateNumber(f.w2.value, 'w₂'),
      ns.pointData.validateNumber(f.theta.value, 'θ')
    ];
    let alpha = session.config.alpha;
    if (f.alphaOn.checked) {
      const check = ns.pointData.validateNumber(f.alpha.value, 'Die Lernrate');
      if (check.ok && check.value < ALPHA_MIN) {
        checks.push({ ok: false, error: 'Die Lernrate muss mindestens 0,0001 sein.' });
      } else {
        checks.push(check);
        alpha = check.value;
      }
    }
    const bad = checks.find((c) => !c.ok);
    error.textContent = bad ? bad.error : '';
    f.alpha.classList.toggle('is-inactive', !f.alphaOn.checked);
    if (bad) {
      return;
    }
    session.setConfig({ w: [checks[0].value, checks[1].value], theta: checks[2].value, alphaOn: f.alphaOn.checked, alpha, scale: f.scale.checked });
  }

  /** Überträgt die Einstellungen in die Felder (nach dem Wiederherstellen). */
  function syncFields() {
    const f = fields();
    const text = (v) => String(v).replace('.', ',');
    const c = session.config;
    f.w1.value = text(c.w[0]);
    f.w2.value = text(c.w[1]);
    f.theta.value = text(c.theta);
    f.alpha.value = text(c.alpha);
    f.alphaOn.checked = c.alphaOn;
    f.scale.checked = c.scale;
    f.alpha.classList.toggle('is-inactive', !c.alphaOn);
    dom.byId('cfg-error').textContent = '';
  }

  /**
   * Ganze Zufallszahl im vorgesehenen Bereich.
   * @returns {number} Zahl von −5 bis 5.
   */
  function randomInt() {
    return RANDOM_MIN + Math.floor(Math.random() * (RANDOM_MAX - RANDOM_MIN + 1));
  }

  /** Füllt die Auswahl des feuernden Labels. */
  function renderPositive() {
    const data = session.data;
    const labels = data.labels();
    const select = dom.byId('cfg-positive');
    const row = dom.byId('cfg-positive-row');
    row.hidden = labels.length < 2;
    dom.clear(select);
    for (const label of labels) {
      select.appendChild(dom.el('option', { value: label }, label));
    }
    if (labels.length) {
      select.value = data.positive() === null ? labels[0] : data.positive();
    }
  }

  /** Zeichnet die Seite. */
  function render() {
    renderPositive();
    const values = { w: session.config.w, theta: session.config.theta };
    const { spec, outside } = session.plotSpec({ line: true, areas: session.showAreas(), values });
    plot.render(spec);
    dom.byId('input-toggle-areas').checked = session.showAreas();
    ns.pages.common.renderPointLegend(dom.byId('input-legend'));
    ns.pages.common.renderEquation(dom.byId('input-equation'), outside, { ...values, label: 'Gerade der Startwerte' });
    dom.byId('input-empty').hidden = session.data.count() > 0;
  }

  /** Richtet die Seite ein. */
  function init() {
    panel = ns.dataPanel.create(dom.byId('input-data'), { data: session.data, samples: ns.samples, idPrefix: 'data', formatHelp: formatHelp(), formContainer: dom.byId('input-form'), listContainer: dom.byId('input-list') });
    session.panel = panel;
    panel.stageCard(dom.byId('input-stage'), 'input-stage-card');
    plot = ns.coordPlot.create(dom.byId('input-plot'), { ariaLabel: 'Koordinatensystem mit den Trainingspunkten' });
    const f = fields();
    for (const input of [f.w1, f.w2, f.theta]) {
      input.addEventListener('input', applyConfig);
    }
    f.alpha.addEventListener('input', () => {
      f.alphaOn.checked = true;
      applyConfig();
    });
    f.alpha.addEventListener('click', () => {
      if (!f.alphaOn.checked) {
        f.alphaOn.checked = true;
        applyConfig();
      }
    });
    f.alphaOn.addEventListener('change', applyConfig);
    f.scale.addEventListener('change', applyConfig);
    // Beim Tippen speichert progress.js verzögert, beim Verlassen eines Felds sofort.
    dom.byId('cfg-card').addEventListener('change', () => ns.progress.save());
    const limit = ns.pointData.LIMITS.maxAbs;
    const startValue = (read) => ({ min: -limit, max: limit, step: () => 1, fallback: read });
    ns.numberWheel.attach(f.w1, startValue(() => session.config.w[0]));
    ns.numberWheel.attach(f.w2, startValue(() => session.config.w[1]));
    ns.numberWheel.attach(f.theta, startValue(() => session.config.theta));
    ns.numberWheel.attach(f.alpha, {
      min: ALPHA_MIN,
      max: limit,
      step: (value, direction) => ns.numberWheel.decadeStep(value, direction, 0.1),
      fallback: () => session.config.alpha
    });
    dom.byId('cfg-random').addEventListener('click', () => {
      f.w1.value = String(randomInt());
      f.w2.value = String(randomInt());
      f.theta.value = String(randomInt());
      applyConfig();
    });
    ns.pages.common.renderAreaLegend(dom.byId('input-area-legend'));
    dom.byId('input-toggle-areas').addEventListener('change', (event) => {
      session.setShowAreas(event.target.checked);
      render();
      ns.progress.save();
    });
    dom.byId('cfg-positive').addEventListener('change', (event) => session.data.setPositive(event.target.value));
  }

  ns.pages.input = { init, render, syncFields };
})(window.BB = window.BB || {});
