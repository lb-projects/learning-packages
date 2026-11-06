/**
 * @file pages/input.js
 * @description Seite 1: Trainingspunkte eingeben und das Perzeptron konfigurieren.
 *
 * Aufbau:
 *   Links die Eingabe der Punkte (data-panel.js), die Wahl des feuernden Labels und die
 *   Konfiguration: Startgewichte, Startschwellenwert, optionale Lernrate.
 *   Rechts die Visualisierung der Punkte.
 *
 * Einstellungen:
 *   Gültige Eingaben gelten sofort und setzen das Training zurück. Bei einer ungültigen
 *   Eingabe bleibt der letzte gültige Wert bestehen, und eine Meldung nennt das Feld.
 *   „Zufällig belegen“ setzt w₁, w₂ und θ auf ganze Zahlen von −5 bis 5.
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

  let plot = null;
  let panel = null;

  /** @returns {Object} Eingabefelder der Konfiguration. */
  function fields() {
    return { w1: dom.byId('cfg-w1'), w2: dom.byId('cfg-w2'), theta: dom.byId('cfg-theta'), etaOn: dom.byId('cfg-eta-on'), eta: dom.byId('cfg-eta') };
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
    let eta = session.config.eta;
    if (f.etaOn.checked) {
      const check = ns.pointData.validateNumber(f.eta.value, 'Die Lernrate');
      if (check.ok && check.value <= 0) {
        checks.push({ ok: false, error: 'Die Lernrate muss größer als 0 sein.' });
      } else {
        checks.push(check);
        eta = check.value;
      }
    }
    const bad = checks.find((c) => !c.ok);
    error.textContent = bad ? bad.error : '';
    f.eta.disabled = !f.etaOn.checked;
    if (bad) {
      return;
    }
    session.setConfig({ w: [checks[0].value, checks[1].value], theta: checks[2].value, etaOn: f.etaOn.checked, eta });
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
    const { spec } = session.plotSpec();
    plot.render(spec);
    ns.pages.common.renderPointLegend(dom.byId('input-legend'));
    dom.byId('input-empty').hidden = session.data.count() > 0;
  }

  /** Richtet die Seite ein. */
  function init() {
    panel = ns.dataPanel.create(dom.byId('input-data'), { data: session.data, samples: ns.samples, idPrefix: 'data', formatHelp: formatHelp() });
    session.panel = panel;
    panel.stageCard(dom.byId('input-stage'), 'input-stage-card');
    plot = ns.coordPlot.create(dom.byId('input-plot'), { ariaLabel: 'Koordinatensystem mit den Trainingspunkten' });
    const f = fields();
    for (const input of [f.w1, f.w2, f.theta, f.eta]) {
      input.addEventListener('input', applyConfig);
    }
    f.etaOn.addEventListener('change', applyConfig);
    dom.byId('cfg-random').addEventListener('click', () => {
      f.w1.value = String(randomInt());
      f.w2.value = String(randomInt());
      f.theta.value = String(randomInt());
      applyConfig();
    });
    dom.byId('cfg-positive').addEventListener('change', (event) => session.data.setPositive(event.target.value));
  }

  ns.pages.input = { init, render };
})(window.BB = window.BB || {});
