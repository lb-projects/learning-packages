/**
 * @file activations.js
 * @description Aktivierungsfunktionen der Simulatoren als einheitliche Einträge.
 *
 * Aufbau eines Eintrags:
 *   id        feste Kennung
 *   name      Bezeichnung für die Anzeige
 *   output(n) Ausgabe für die Netzeingabe n (gewichtete Summe minus Schwellenwert)
 *   fires(y)  true, wenn die Ausgabe y als „feuert“ gilt
 *   symbol    SVG-Pfad des Symbols im Quadrat von −10 bis 10 (y-Achse nach unten, wie in SVG)
 *
 * Weitere Funktionen werden nur hier ergänzt. Die Nutzer der Einträge (net-view.js, die
 * Pakete) kennen keine einzelne Funktion. Bisher verwendet BUSY BIAS nur Heaviside.
 *
 * Gemeinsamer Code der Simulator-Pakete (Quelle: shared/js/activations.js).
 *
 * Abhängigkeiten:
 *   Keine.
 */
(function (ns) {
  'use strict';

  /** Heaviside (Sprungfunktion): 1 ab der Netzeingabe 0, sonst 0. */
  const heaviside = Object.freeze({
    id: 'heaviside',
    name: 'Heaviside',
    output: (net) => (net >= 0 ? 1 : 0),
    fires: (y) => y === 1,
    symbol: 'M-9 7H0V-7H9'
  });

  ns.activations = { heaviside };
})(window.LP = window.LP || {});
