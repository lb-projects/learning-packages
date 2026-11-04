/**
 * @file format-utils.js
 * @description Zahlformate der SQL Sandbox für Fließtexte.
 *
 * Ergänzt das gemeinsame Modul dom-utils.js (Kopie aus shared/) um die
 * paketeigenen Formatierer; sie stehen wie bisher unter ns.dom zur Verfügung
 * (dom.formatCount, dom.plural).
 *
 * Abhängigkeiten:
 *   dom-utils.js
 */
(function (ns) {
  'use strict';

  /** Zahlformat für Mengenangaben in Fließtexten (deutsche Schreibweise, z. B. "1.250"). */
  const countFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

  /**
   * Formatiert eine Anzahl mit Tausenderpunkten.
   *
   * @param {number} value - Anzahl.
   * @returns {string} z. B. "20.000".
   */
  function formatCount(value) {
    return countFormat.format(value);
  }

  /**
   * Gibt "1 Zeile" bzw. "3 Zeilen" zurück.
   *
   * @param {number} count - Anzahl.
   * @param {string} singular - Einzahl, z. B. "Zeile".
   * @param {string} plural - Mehrzahl, z. B. "Zeilen".
   * @returns {string} Text mit Anzahl.
   */
  function plural(count, singular, plural) {
    return formatCount(count) + ' ' + (count === 1 ? singular : plural);
  }

  Object.assign(ns.dom, { formatCount, plural });
})(window.SQLSIM = window.SQLSIM || {});
