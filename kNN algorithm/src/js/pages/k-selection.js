/**
 * @file k-selection.js
 * @description Seite 4 "Auswahl eines passenden Wertes für k" (Validierungsdaten).
 *
 * Idee:
 *   Ein Teil der Daten (zufällig 20 %) wird als Validierungsdaten zurückgehalten.
 *   Diese Punkte werden nur anhand der übrigen 80 % (Trainingsdaten)
 *   klassifiziert. Da ihr tatsächliches Label bekannt ist, lässt sich je k
 *   ablesen, wie viele Validierungspunkte korrekt erkannt werden – ein
 *   Maß für die Eignung des k-Wertes.
 *
 * Seitenspezifisch (alles Weitere siehe evaluation-page.js):
 *   - Schaltfläche "Validierungsdaten auswählen" (zufällige Auswahl mit
 *     kryptographisch sicherer Zufallsquelle, siehe dataset.js).
 *   - Anzeige der Aufteilung und Hinweis, wenn der Anteil durch spätere
 *     Änderungen deutlich von 20 % abweicht.
 *
 * Abhängigkeiten:
 *   dom-utils.js, dataset.js, pages/common.js, pages/evaluation-page.js
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const ds = ns.dataset;
  const common = ns.common;

  /** Anteil der Validierungsdaten. */
  const VALIDATION_FRACTION = 0.2;

  let tableRef = null;

  /** Wählt neue Validierungsdaten aus (nach Rückfrage, wenn Eintragungen verloren gehen). */
  function chooseValidation() {
    if (ds.size() < 2) {
      return;
    }
    if (tableRef && tableRef.entries.size > 0 &&
        !window.confirm('Neue Validierungsdaten auswählen? Die bisherigen Eintragungen werden gelöscht.')) {
      return;
    }
    ds.selectRandomValidation(VALIDATION_FRACTION);
  }

  /** Zeigt die aktuelle Aufteilung und ggf. einen Hinweis auf eine Abweichung von 20 %. */
  function renderSplitInfo() {
    const n = ds.size();
    const validation = ds.getValidationPoints().length;
    const info = dom.byId('k4-split');
    info.textContent = validation > 0
      ? validation + ' Validierungspunkte (' + dom.formatPercent(validation / n) + ') und ' +
        (n - validation) + ' Trainingspunkte.'
      : 'Noch keine Validierungsdaten ausgewählt.';
    const expected = Math.min(Math.max(1, Math.round(n * VALIDATION_FRACTION)), n - 1);
    common.showNotice(dom.byId('k4-split-notice'), validation > 0 && validation !== expected
      ? 'Durch Änderungen an den Trainingsdaten beträgt der Anteil der Validierungsdaten jetzt ' +
        dom.formatPercent(validation / n) + '. Bei Bedarf „Validierungsdaten auswählen“ erneut anklicken.'
      : null);
    dom.byId('btn-validation').disabled = n < 2;
  }

  const page = ns.createEvaluationPage({
    id: 'k-selection',
    prefix: 'k4',
    caption: 'Validierungsdaten: Für welche k wird der Punkt korrekt klassifiziert? (x eintragen)',
    getRows: () => ds.getValidationPoints(),
    getReference: () => ds.getTrainingPoints(),
    getBlocker: () => {
      if (ds.size() < 2) {
        return { text: 'Für diese Seite werden mindestens 2 Trainingspunkte benötigt.', link: true };
      }
      if (ds.getValidationPoints().length === 0) {
        return { text: 'Klicken Sie auf „Validierungsdaten auswählen“, um zufällig 20 % der Daten als Validierungsdaten zu kennzeichnen.', link: false };
      }
      return null;
    },
    extraInit: ({ table }) => {
      tableRef = table;
      dom.byId('btn-validation').addEventListener('click', chooseValidation);
    },
    extraRender: renderSplitInfo,
    extraDataChange: (event, { table, state }) => {
      if (event.type === 'validation') {
        // Neue Auswahl → bisherige Eintragungen passen nicht mehr.
        table.resetEntries();
        state.dataChanged = false;
        state.selectedId = null;
      }
    }
  });

  ns.pages = ns.pages || {};
  ns.pages['k-selection'] = page;
})(window.KNN = window.KNN || {});
