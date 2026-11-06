/**
 * @file classify-panel.js
 * @description Maske für einen Prüfpunkt und Anzeige der Rechnung mit Urteil.
 *
 * Der Baustein kennt kein Modell. Das Paket übergibt:
 *   classify(x, y, label) → {lines: [string], verdict: 'correct'|'wrong'|null, verdictText: string}
 *   labels()              → wählbare erwartete Labels
 *   onProbe(point|null)   → wird mit {x, y, verdict} aufgerufen, damit das Paket den Punkt zeichnet
 *
 * Die Eingabe bleibt erhalten. refresh() rechnet mit dem aktuellen Stand des Modells neu.
 *
 * Gemeinsamer Code der Simulator-Pakete (Quelle: shared/js/classify-panel.js).
 *
 * Abhängigkeiten:
 *   dom-utils.js, point-data.js
 *
 * Sicherheitsaspekte:
 *   Eingaben werden geprüft und nur als Text angezeigt.
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  /** Wert der Label-Auswahl ohne erwartetes Label. */
  const NO_LABEL = '';

  /**
   * Erzeugt die Maske.
   *
   * @param {HTMLElement} container - Behälter (wird geleert).
   * @param {{id:string, classify:function, labels:function():string[], attributes:function():Object,
   *          onProbe:function((Object|null)):void}} options - Siehe Dateikopf.
   * @returns {{refresh:function():void, point:function():(Object|null)}} Steuerung.
   */
  function create(container, options) {
    const id = options.id;
    const labelX = dom.el('label', { for: id + '-x' });
    const labelY = dom.el('label', { for: id + '-y' });
    const inputX = dom.el('input', { type: 'text', id: id + '-x', inputmode: 'decimal', autocomplete: 'off' });
    const inputY = dom.el('input', { type: 'text', id: id + '-y', inputmode: 'decimal', autocomplete: 'off' });
    const select = dom.el('select', { id: id + '-label' });
    const error = dom.el('p', { class: 'error', id: id + '-error', role: 'alert' });
    const form = dom.el('form', { class: 'card', id: id + '-form', novalidate: true, autocomplete: 'off' }, [
      dom.el('h3', null, 'Punkt eingeben'),
      dom.el('div', { class: 'field-row' }, [
        dom.el('div', { class: 'field' }, [labelX, inputX]),
        dom.el('div', { class: 'field' }, [labelY, inputY]),
        dom.el('div', { class: 'field' }, [dom.el('label', { for: select.id }, 'Erwartetes Label'), select])
      ]),
      dom.el('button', { type: 'submit', class: 'btn btn-primary', id: id + '-submit' }, 'Klassifizieren'),
      error
    ]);
    const lines = dom.el('div', { class: 'calc-lines', id: id + '-lines' });
    const verdict = dom.el('p', { class: 'status', id: id + '-verdict', role: 'status', 'aria-live': 'polite', hidden: true });
    const result = dom.el('div', { class: 'card', id: id + '-result', hidden: true }, [dom.el('h3', null, 'Berechnung'), lines, verdict]);
    dom.clear(container);
    dom.appendChildren(container, [form, result]);

    /** Gültiger Prüfpunkt oder null. */
    let point = null;

    /** Füllt die Label-Auswahl und behält die Wahl, solange das Label vorkommt. */
    function fillLabels() {
      const keep = select.value;
      dom.clear(select);
      select.appendChild(dom.el('option', { value: NO_LABEL }, 'keine Angabe'));
      for (const label of options.labels()) {
        select.appendChild(dom.el('option', { value: label }, label));
      }
      select.value = options.labels().includes(keep) ? keep : NO_LABEL;
    }

    /** Rechnet den Prüfpunkt und zeigt das Ergebnis. */
    function compute() {
      if (!point) {
        result.hidden = true;
        options.onProbe(null);
        return;
      }
      const outcome = options.classify(point.x, point.y, select.value === NO_LABEL ? null : select.value);
      dom.clear(lines);
      for (const text of outcome.lines) {
        lines.appendChild(dom.el('p', { class: 'protocol-line' }, text));
      }
      verdict.textContent = outcome.verdictText;
      verdict.className = 'status' + (outcome.verdict === 'correct' ? ' status-success' : outcome.verdict === 'wrong' ? ' status-error' : '');
      verdict.hidden = false;
      result.hidden = false;
      options.onProbe({ x: point.x, y: point.y, verdict: outcome.verdict });
    }

    /** Aktualisiert Beschriftungen, Auswahl und Rechnung. */
    function refresh() {
      const attrs = options.attributes();
      labelX.textContent = attrs.x;
      labelY.textContent = attrs.y;
      fillLabels();
      compute();
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const vx = ns.pointData.validateNumber(inputX.value, options.attributes().x);
      const vy = ns.pointData.validateNumber(inputY.value, options.attributes().y);
      const bad = [vx, vy].find((v) => !v.ok);
      error.textContent = bad ? bad.error : '';
      if (bad) {
        return;
      }
      point = { x: vx.value, y: vy.value };
      compute();
    });
    select.addEventListener('change', () => {
      if (point) {
        compute();
      }
    });

    refresh();
    return { refresh, point: () => point };
  }

  ns.classifyPanel = { create };
})(window.LP = window.LP || {});
