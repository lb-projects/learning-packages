/**
 * @file loo-manual.js
 * @description Seite 5 "Leave One Out – Verfahren" (manuelle Durchführung).
 *
 * Idee:
 *   Beim Leave-One-Out-Verfahren wird nacheinander JEDER Punkt des gesamten
 *   Trainingsdatensatzes einmal weggelassen und anhand aller übrigen Punkte
 *   klassifiziert. So dient jeder Punkt einmal als "Validierungspunkt", und
 *   es wird kein Teil der Daten dauerhaft zurückgehalten.
 *
 * Seitenspezifisch:
 *   Zeilen = alle Punkte, Nachbarn = alle übrigen Punkte. Alles Weitere
 *   (Diagramm, Eingabetabelle, Prüfen) siehe evaluation-page.js.
 *
 * Abhängigkeiten:
 *   dataset.js, pages/evaluation-page.js
 */
(function (ns) {
  'use strict';

  const ds = ns.dataset;

  const page = ns.createEvaluationPage({
    id: 'loo-manual',
    prefix: 'loo5',
    caption: 'Leave One Out: Für welche k wird der weggelassene Punkt korrekt klassifiziert? (x eintragen)',
    getRows: () => ds.getPoints(),
    // Der jeweils betrachtete Punkt wird bei der Klassifizierung über seine ID ausgelassen.
    getReference: () => ds.getPoints(),
    getBlocker: () => (ds.size() < 2
      ? { text: 'Für diese Seite werden mindestens 2 Trainingspunkte benötigt.', link: true }
      : null)
  });

  ns.pages = ns.pages || {};
  ns.pages['loo-manual'] = page;
})(window.KNN = window.KNN || {});
