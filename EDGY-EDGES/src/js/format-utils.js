/**
 * @file format-utils.js
 * @description Paketeigene Formatierer (ergänzen das gemeinsame Objekt dom aus dom-utils.js).
 *
 * Zweck:
 *   Einheitliche Schreibweise von Zahlen, Distanzen und Tripeln in allen Ansichten:
 *   - negative Zahlen mit echtem Minuszeichen (−3 statt -3),
 *   - unendliche Distanz als ∞,
 *   - Tripel (Knoten, Vorgänger, Distanz) wie in der Dijkstra-Tabelle.
 *
 * Abhängigkeiten:
 *   dom-utils.js
 */
(function (ns) {
  'use strict';

  /**
   * Formatiert eine ganze Zahl (negative Zahlen mit Minuszeichen U+2212).
   *
   * @param {number} value - Zahl.
   * @returns {string} Text.
   */
  function formatInt(value) {
    if (value < 0) {
      return '−' + String(Math.abs(value));
    }
    return String(value);
  }

  /**
   * Formatiert eine Distanz (∞ für nicht erreicht, −∞ für „nicht definiert“ bei negativem Zyklus).
   *
   * @param {number} value - Distanz.
   * @returns {string} Text.
   */
  function formatDistance(value) {
    if (value === Infinity) {
      return '∞';
    }
    if (value === -Infinity) {
      return '−∞';
    }
    return formatInt(value);
  }

  /**
   * Formatiert ein Tripel (Knoten, Vorgänger, Distanz zum Startknoten).
   *
   * @param {string} name - Knotenname.
   * @param {string|null} pred - Name des Vorgängers oder null.
   * @param {number} dist - Distanz.
   * @returns {string} z. B. "(C, A, 4)".
   */
  function formatTriple(name, pred, dist) {
    return '(' + name + ', ' + (pred === null ? '–' : pred) + ', ' + formatDistance(dist) + ')';
  }

  /**
   * Zählwort mit Einzahl/Mehrzahl.
   *
   * @param {number} count - Anzahl.
   * @param {string} one - Einzahl.
   * @param {string} many - Mehrzahl.
   * @returns {string} z. B. "1 Knoten", "3 Kanten".
   */
  function plural(count, one, many) {
    return count + ' ' + (count === 1 ? one : many);
  }

  /**
   * Verbindet Namen zu einer Aufzählung ("A, B und C").
   *
   * @param {string[]} names - Namen.
   * @returns {string} Aufzählung.
   */
  function joinNames(names) {
    if (names.length <= 1) {
      return names.join('');
    }
    return names.slice(0, -1).join(', ') + ' und ' + names[names.length - 1];
  }

  ns.dom = Object.assign(ns.dom || {}, { formatInt, formatDistance, formatTriple, plural, joinNames });
})(window.HG = window.HG || {});
