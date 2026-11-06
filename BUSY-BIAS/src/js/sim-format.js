// Kopie aus shared/js/sim-format.js – nicht hier bearbeiten: Änderungen in shared/ vornehmen und sync-shared.mjs ausführen.
/**
 * @file sim-format.js
 * @description Zahlen in den Simulatoren: Rundung für die Rechnung und deutsche Schreibweise für die Anzeige.
 *
 * Zweck:
 *   - clean(): beseitigt Darstellungsfehler von Gleitkommazahlen (0,30000000000000004 → 0,3),
 *     damit sie weder Vergleiche noch Anzeigen verfälschen.
 *   - num(): höchstens vier Nachkommastellen, Dezimalkomma, echtes Minuszeichen (U+2212).
 *   - factor(): wie num(), negative Zahlen aber in Klammern, für Rechenausdrücke wie „(−1) · 2“.
 *
 * Gemeinsamer Code der Simulator-Pakete (Quelle: shared/js/sim-format.js).
 *
 * Abhängigkeiten:
 *   Keine.
 */
(function (ns) {
  'use strict';

  /** Stellen, auf die in der Rechnung gerundet wird. */
  const CLEAN_FACTOR = 1e10;
  /** Stellen, auf die in der Anzeige gerundet wird. */
  const DISPLAY_FACTOR = 1e4;

  /**
   * Rundet einen Rechenwert auf zehn Nachkommastellen. −0 wird zu 0.
   *
   * @param {number} value - Zahl.
   * @returns {number} Gerundete Zahl.
   */
  function clean(value) {
    const rounded = Math.round(value * CLEAN_FACTOR) / CLEAN_FACTOR;
    return rounded === 0 ? 0 : rounded;
  }

  /**
   * Formatiert eine Zahl für die Anzeige.
   *
   * @param {number} value - Zahl.
   * @returns {string} z. B. "−0,5".
   */
  function num(value) {
    const rounded = Math.round(value * DISPLAY_FACTOR) / DISPLAY_FACTOR;
    if (rounded === 0) {
      return '0';
    }
    return (rounded < 0 ? '−' : '') + String(Math.abs(rounded)).replace('.', ',');
  }

  /**
   * Formatiert eine Zahl als Faktor in einem Rechenausdruck.
   *
   * @param {number} value - Zahl.
   * @returns {string} z. B. "(−1)" oder "2".
   */
  function factor(value) {
    const text = num(value);
    return text.startsWith('−') ? '(' + text + ')' : text;
  }

  /**
   * Zählwort mit Einzahl/Mehrzahl.
   *
   * @param {number} count - Anzahl.
   * @param {string} one - Einzahl.
   * @param {string} many - Mehrzahl.
   * @returns {string} z. B. "1 Punkt", "3 Punkte".
   */
  function plural(count, one, many) {
    return count + ' ' + (count === 1 ? one : many);
  }

  ns.simFormat = { clean, num, factor, plural };
})(window.BB = window.BB || {});
