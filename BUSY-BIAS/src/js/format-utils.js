/**
 * @file format-utils.js
 * @description Texte des Perzeptrons: Geradengleichung und Rechenzeilen für Protokoll und Klassifikation.
 *
 * Abhängigkeiten:
 *   sim-format.js
 */
(function (ns) {
  'use strict';

  const { num, factor } = ns.simFormat;

  /**
   * Geradengleichung in der Form x₂ = m · x₁ + b.
   *
   * @param {{kind:string, m?:number, b?:number, x?:number}} line - Ergebnis von perceptron.lineOf().
   * @returns {string} Gleichung oder Hinweis.
   */
  function equation(line) {
    if (line.kind === 'none') {
      return 'keine Gerade (w₁ = w₂ = 0)';
    }
    if (line.kind === 'vertical') {
      return 'x₁ = ' + num(line.x);
    }
    const parts = [];
    const m = Math.round(line.m * 1e4) / 1e4;
    if (m === 1) {
      parts.push('x₁');
    } else if (m === -1) {
      parts.push('−x₁');
    } else if (m !== 0) {
      parts.push(num(line.m) + ' · x₁');
    }
    const b = Math.round(line.b * 1e4) / 1e4;
    if (parts.length === 0) {
      parts.push(num(line.b));
    } else if (b !== 0) {
      parts.push((b < 0 ? '− ' : '+ ') + num(Math.abs(line.b)));
    }
    return 'x₂ = ' + parts.join(' ');
  }

  /**
   * Allgemeine Form der Geraden mit den aktuellen Werten.
   *
   * @param {number[]} w - Gewichte.
   * @param {number} theta - Schwellenwert.
   * @returns {string} z. B. "1 · x₁ + (−2) · x₂ = 3".
   */
  function generalForm(w, theta) {
    return factor(w[0]) + ' · x₁ + ' + factor(w[1]) + ' · x₂ = ' + num(theta);
  }

  /**
   * Zeile der gewichteten Summe.
   * @param {number[]} w - Gewichte.
   * @param {number[]} x - Eingänge.
   * @param {number} sum - Ergebnis.
   * @returns {string} Zeile.
   */
  function sumLine(w, x, sum) {
    return 'Gewichtete Summe: a = ' + factor(w[0]) + ' · ' + factor(x[0]) + ' + ' + factor(w[1]) + ' · ' + factor(x[1]) + ' = ' + num(sum);
  }

  /**
   * Zeile der Aktivierung.
   * @param {number} sum - Gewichtete Summe.
   * @param {number} theta - Schwellenwert.
   * @param {number} y - Ausgabe.
   * @returns {string} Zeile.
   */
  function activationLine(sum, theta, y) {
    return 'Aktivierung: a = ' + num(sum) + (y === 1 ? ' ≥ ' : ' < ') + 'θ = ' + num(theta) + ' → f(a) = ' + y;
  }

  /**
   * Zeile der aktuellen Werte.
   * @param {number[]} w - Gewichte.
   * @param {number} theta - Schwellenwert.
   * @returns {string} Zeile.
   */
  function currentLine(w, theta) {
    return 'Aktuell: w₁ = ' + num(w[0]) + ', w₂ = ' + num(w[1]) + ', θ = ' + num(theta);
  }

  /**
   * Zeilen eines Trainingspunkts. Es erscheint nur, was der Ablauf schon erreicht hat.
   *
   * @param {Object} record - Aufzeichnung des Trainers.
   * @param {function(number[], number):Object} lineOf - perceptron.lineOf.
   * @returns {Array<{text:string, cls?:string}>} Zeilen.
   */
  function recordLines(record, lineOf) {
    const r = record;
    const lines = [{
      text: 'Iteration ' + r.iteration + ', Punkt ' + (r.index + 1) + ' von ' + r.total + ': x₁ = ' + num(r.x[0]) + ', x₂ = ' + num(r.x[1]) +
        ', Label ' + r.label + ' (t = ' + r.t + ')' + (r.group ? ', ' + r.group : ''),
      cls: 'protocol-head'
    }, { text: currentLine(r.wBefore, r.thetaBefore) }];
    if (r.phase === 'highlight' || r.phase === 'inputs') {
      return lines;
    }
    lines.push({ text: sumLine(r.wBefore, r.x, r.sum) });
    if (r.phase === 'sum') {
      return lines;
    }
    lines.push({ text: activationLine(r.sum, r.thetaBefore, r.y) });
    lines.push({ text: 'Fehler: δ = t − f(a) = ' + r.t + ' − ' + r.y + ' = ' + num(r.delta) });
    if (r.delta !== 0) {
      if (r.phase !== 'update') {
        return lines;
      }
      const alpha = r.alpha === null ? '' : num(r.alpha) + ' · ';
      lines.push({ text: 'Anpassung:' });
      r.wBefore.forEach((w, i) => {
        lines.push({ text: 'w' + (i === 0 ? '₁' : '₂') + ' = ' + num(w) + ' + ' + alpha + factor(r.delta) + ' · ' + factor(r.x[i]) + ' = ' + num(r.wAfter[i]), cls: 'protocol-sub' });
      });
      lines.push({ text: 'θ = ' + num(r.thetaBefore) + ' − ' + alpha + factor(r.delta) + ' = ' + num(r.thetaAfter), cls: 'protocol-sub' });
      lines.push({ text: 'Neue Gerade: ' + equation(lineOf(r.wAfter, r.thetaAfter)) });
    } else {
      lines.push({ text: 'Gerade (unverändert): ' + equation(lineOf(r.wBefore, r.thetaBefore)) });
    }
    lines.push({ text: '', cls: 'protocol-rule' });
    return lines;
  }

  /**
   * Text eines Labels; fehlt es im Datensatz noch, steht ein Ersatz dort.
   * @param {string|null} label - Label.
   * @returns {string} Text.
   */
  function labelText(label) {
    return label === null ? '(anderes Label)' : label;
  }

  ns.fmt = { equation, generalForm, sumLine, activationLine, currentLine, recordLines, labelText };
})(window.BB = window.BB || {});
