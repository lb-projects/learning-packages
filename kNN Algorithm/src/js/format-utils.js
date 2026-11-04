/**
 * @file format-utils.js
 * @description Zahl- und Textformate des kNN-Pakets für die Anzeige.
 *
 * Ergänzt das gemeinsame Modul dom-utils.js (Kopie aus shared/) um die
 * paketeigenen Formatierer; sie stehen wie bisher unter ns.dom zur Verfügung
 * (dom.formatNumber, dom.formatPercent, dom.describePoint).
 *
 * Abhängigkeiten:
 *   dom-utils.js
 */
(function (ns) {
  'use strict';

  /** Zahlformat für die Anzeige (deutsche Schreibweise, höchstens 3 Nachkommastellen). */
  const numberFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 3 });

  /** Prozentformat (deutsche Schreibweise, höchstens 1 Nachkommastelle). */
  const percentFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

  /**
   * Formatiert eine Zahl in deutscher Schreibweise (Dezimalkomma).
   *
   * @param {number} value - Zahl.
   * @returns {string} Formatierte Zahl, z. B. "2,5".
   */
  function formatNumber(value) {
    return numberFormat.format(value);
  }

  /**
   * Formatiert einen Anteil (0 … 1) als Prozentangabe.
   *
   * @param {number} ratio - Anteil zwischen 0 und 1.
   * @returns {string} z. B. "62,5 %".
   */
  function formatPercent(ratio) {
    return percentFormat.format(ratio * 100) + ' %';
  }

  /**
   * Erzeugt die Kurzbeschreibung eines Datenpunkts, z. B. "#3 (2 | 4,5) Apfel".
   *
   * @param {{id:number, x:number, y:number, label:string}} point - Datenpunkt.
   * @returns {string} Beschreibung als reiner Text.
   */
  function describePoint(point) {
    return '#' + point.id + ' (' + formatNumber(point.x) + ' | ' + formatNumber(point.y) + ') ' + point.label;
  }

  Object.assign(ns.dom, { formatNumber, formatPercent, describePoint });
})(window.KNN = window.KNN || {});
