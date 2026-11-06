/**
 * @file number-wheel.js
 * @description Ändert den Wert eines Zahlenfelds mit dem Mausrad.
 *
 * Verhalten:
 *   - Das Rad wirkt nur im Feld mit Fokus, wie bei Zahlenfeldern im Browser üblich. So ändert das
 *     Scrollen der Seite über ein Feld hinweg keinen Wert. Im Feld mit Fokus scrollt die Seite nicht mit.
 *   - Rad nach oben erhöht, nach unten verringert. Bewegungen werden gesammelt: Ein Touchpad springt
 *     so nicht zu schnell, ein Rastschritt am Mausrad bleibt genau ein Schritt.
 *   - Der neue Wert erscheint in deutscher Schreibweise und löst ein input-Ereignis aus, als wäre er
 *     getippt worden. Am Rand des erlaubten Bereichs passiert nichts mehr.
 *
 * Der Baustein kennt kein Modell, nur Feld, Grenzen und Schrittregel.
 *
 * Gemeinsamer Code der Simulator-Pakete (Quelle: shared/js/number-wheel.js).
 *
 * Abhängigkeiten:
 *   sim-format.js, point-data.js
 */
(function (ns) {
  'use strict';

  /** Gesammelte Bewegung in Bildpunkten, die einen Schritt auslöst. */
  const STEP_DISTANCE = 50;
  /** Umrechnung einer Zeile bzw. Seite (WheelEvent.deltaMode) in Bildpunkte. */
  const LINE_PIXELS = 33;
  const PAGE_PIXELS = 400;

  /**
   * Schrittweite nach Größenordnung: 0,09 → 0,08, aber 0,1 → 0,09 und 0,1 → 0,2.
   *
   * @param {number} value - Aktueller Wert (größer als 0).
   * @param {number} direction - 1 für aufwärts, −1 für abwärts.
   * @param {number} maxStep - Größte Schrittweite.
   * @returns {number} Schrittweite.
   */
  function decadeStep(value, direction, maxStep) {
    const power = Math.pow(10, Math.floor(Math.log10(value) + 1e-9));
    const atPower = Math.abs(value / power - 1) < 1e-9;
    return Math.min(direction < 0 && atPower ? power / 10 : power, maxStep);
  }

  /**
   * Verbindet ein Eingabefeld mit dem Mausrad.
   *
   * @param {HTMLInputElement} input - Feld.
   * @param {{min:number, max:number, step:function(number, number):number, fallback:function():number}} options -
   *   Grenzen, Schrittweite für (Wert, Richtung), Ausgangswert bei einer ungültigen Eingabe.
   */
  function attach(input, options) {
    let collected = 0;
    input.addEventListener('wheel', (event) => {
      if (input.ownerDocument.activeElement !== input) {
        return;
      }
      event.preventDefault();
      const factor = event.deltaMode === 1 ? LINE_PIXELS : event.deltaMode === 2 ? PAGE_PIXELS : 1;
      const delta = event.deltaY * factor;
      collected = Math.sign(collected) === -Math.sign(delta) ? delta : collected + delta;
      if (Math.abs(collected) < STEP_DISTANCE) {
        return;
      }
      const direction = collected < 0 ? 1 : -1;
      collected = 0;
      const parsed = ns.pointData.parseNumber(input.value);
      const base = parsed === null ? options.fallback() : parsed;
      const raw = ns.simFormat.clean(base + direction * options.step(base, direction));
      const next = Math.min(options.max, Math.max(options.min, raw));
      if (next === base) {
        return;
      }
      input.value = ns.simFormat.num(next);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, { passive: false });
  }

  ns.numberWheel = { attach, decadeStep };
})(window.LP = window.LP || {});
