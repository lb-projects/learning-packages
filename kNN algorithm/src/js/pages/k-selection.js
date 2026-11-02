/**
 * @file k-selection.js
 * @description Seite 4 "Auswahl eines passenden Wertes für k" (Validierungsdaten).
 *
 * Idee:
 *   Ein wählbarer Anteil der Daten (Standard 20 %) wird zufällig als
 *   Validierungsdaten zurückgehalten. Diese Punkte werden nur anhand der
 *   übrigen Punkte (Trainingsdaten) klassifiziert. Da ihr tatsächliches Label
 *   bekannt ist, lässt sich je k ablesen, wie viele Validierungspunkte korrekt
 *   erkannt werden – ein Maß für die Eignung des k-Wertes.
 *
 * Seitenspezifisch (alles Weitere siehe evaluation-page.js):
 *   - Eingabefeld für den Anteil der Validierungsdaten in Prozent
 *     (ganze Zahl von 1 bis 90) mit Vorschau der sich ergebenden Punktzahl.
 *   - Schaltfläche "Validierungsdaten auswählen" (zufällige Auswahl mit
 *     kryptographisch sicherer Zufallsquelle, siehe dataset.js).
 *   - Anzeige der Aufteilung und Hinweis, wenn der Anteil durch spätere
 *     Änderungen deutlich vom zuletzt gewählten Anteil abweicht.
 *
 * Abhängigkeiten:
 *   dom-utils.js, dataset.js, pages/common.js, pages/evaluation-page.js
 *
 * Sicherheitsaspekte:
 *   - Der Prozentwert wird streng geprüft (nur ganze Zahlen im erlaubten
 *     Bereich); ungültige Eingaben lösen keine Auswahl aus.
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const ds = ns.dataset;
  const common = ns.common;

  /** Standardanteil der Validierungsdaten in Prozent. */
  const DEFAULT_PERCENT = 20;
  /** Kleinster und größter zulässiger Anteil in Prozent. */
  const MIN_PERCENT = 1;
  const MAX_PERCENT = 90;

  let tableRef = null;
  let ui = null;
  /** Anteil (0 … 1), mit dem die aktuelle Auswahl erzeugt wurde. */
  let appliedFraction = DEFAULT_PERCENT / 100;

  /**
   * Anzahl der Validierungspunkte für einen Anteil (wie in dataset.selectRandomValidation).
   * @param {number} n - Anzahl aller Punkte.
   * @param {number} fraction - Anteil 0 … 1.
   * @returns {number} Anzahl der Validierungspunkte.
   */
  function expectedCount(n, fraction) {
    return Math.min(Math.max(1, Math.round(n * fraction)), n - 1);
  }

  /**
   * Liest und prüft den eingegebenen Prozentwert.
   * @returns {{ok: boolean, value?: number, error?: string}} Ergebnis.
   */
  function readPercent() {
    const text = String(ui.fraction.value).trim();
    if (!/^\d{1,3}$/.test(text)) {
      return { ok: false, error: 'Bitte eine ganze Zahl von ' + MIN_PERCENT + ' bis ' + MAX_PERCENT + ' eingeben.' };
    }
    const value = Number(text);
    if (value < MIN_PERCENT || value > MAX_PERCENT) {
      return { ok: false, error: 'Der Anteil muss zwischen ' + MIN_PERCENT + ' % und ' + MAX_PERCENT + ' % liegen.' };
    }
    return { ok: true, value };
  }

  /** Aktualisiert Fehlermeldung und Vorschau zum eingegebenen Anteil. */
  function renderFractionInfo() {
    const n = ds.size();
    const result = readPercent();
    ui.fractionError.textContent = result.ok ? '' : result.error;
    ui.fractionInfo.textContent = result.ok && n >= 2
      ? 'entspricht ' + expectedCount(n, result.value / 100) + ' von ' + n + ' Punkten'
      : '';
  }

  /** Wählt neue Validierungsdaten aus (nach Rückfrage, wenn Eintragungen verloren gehen). */
  function chooseValidation() {
    if (ds.size() < 2) {
      return;
    }
    const result = readPercent();
    if (!result.ok) {
      ui.fractionError.textContent = result.error;
      ui.fraction.focus();
      return;
    }
    if (tableRef && tableRef.entries.size > 0 &&
        !window.confirm('Neue Validierungsdaten auswählen? Die bisherigen Eintragungen werden gelöscht.')) {
      return;
    }
    appliedFraction = result.value / 100;
    ds.selectRandomValidation(appliedFraction);
  }

  /** Zeigt die aktuelle Aufteilung und ggf. einen Hinweis auf eine Abweichung vom gewählten Anteil. */
  function renderSplitInfo() {
    const n = ds.size();
    const validation = ds.getValidationPoints().length;
    ui.split.textContent = validation > 0
      ? 'Aktuelle Aufteilung: ' + validation + ' Validierungspunkte (' + dom.formatPercent(validation / n) + ') und ' +
        (n - validation) + ' Trainingspunkte.'
      : 'Noch keine Validierungsdaten ausgewählt.';
    common.showNotice(dom.byId('k4-split-notice'), validation > 0 && validation !== expectedCount(n, appliedFraction)
      ? 'Durch Änderungen an den Trainingsdaten beträgt der Anteil der Validierungsdaten jetzt ' +
        dom.formatPercent(validation / n) + '. Bei Bedarf „Validierungsdaten auswählen“ erneut anklicken.'
      : null);
    dom.byId('btn-validation').disabled = n < 2;
    renderFractionInfo();
  }

  /** @returns {string} Eingegebener Prozentwert für Hinweistexte (bei ungültiger Eingabe der Standard). */
  function percentText() {
    const result = ui ? readPercent() : { ok: false };
    return (result.ok ? result.value : DEFAULT_PERCENT) + ' %';
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
        return { text: 'Klicken Sie auf „Validierungsdaten auswählen“, um zufällig ' + percentText() + ' der Daten als Validierungsdaten zu kennzeichnen.', link: false };
      }
      return null;
    },
    extraInit: ({ table }) => {
      tableRef = table;
      ui = {
        fraction: dom.byId('k4-fraction'),
        fractionInfo: dom.byId('k4-fraction-info'),
        fractionError: dom.byId('k4-fraction-error'),
        split: dom.byId('k4-split')
      };
      ui.fraction.min = String(MIN_PERCENT);
      ui.fraction.max = String(MAX_PERCENT);
      ui.fraction.value = String(DEFAULT_PERCENT);
      // Neu zeichnen, damit Vorschau und Hinweistext zum eingegebenen Anteil passen
      // (init() läuft erst nach der Zuweisung von "page").
      ui.fraction.addEventListener('input', () => page.render());
      ui.fraction.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          chooseValidation();
        }
      });
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
