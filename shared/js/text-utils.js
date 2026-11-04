/**
 * @file text-utils.js
 * @description Bereinigung von Texten vor der Anzeige.
 *
 * Zweck:
 *   Werte aus hochgeladenen Dateien (Datenbanken, Tabellen), Namen, Dateinamen
 *   und Quelltext-Ausschnitte werden zwar ausschließlich als Text (textContent)
 *   eingefügt und können daher keinen Code ausführen. Unsichtbare oder
 *   darstellungsverändernde Zeichen könnten die Anzeige aber optisch
 *   verfälschen, z. B. U+202E "Right-to-Left Override" (Trojan-Source-Prinzip).
 *   Diese Zeichen werden hier entfernt bzw. sichtbar ersetzt.
 *
 * Gemeinsamer Code beider Lernpakete (Quelle: shared/js/text-utils.js).
 *
 * Abhängigkeiten:
 *   Keine.
 */
(function (ns) {
  'use strict';

  /**
   * Unsichtbare bzw. darstellungsverändernde Zeichen:
   * Steuerzeichen (C0/C1), weiches Trennzeichen, Nullbreitenzeichen,
   * Richtungssteuerzeichen, Zeilen-/Absatztrenner, Worttrenner und Byte-Order-Mark.
   */
  const INVISIBLE_PATTERN = /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u180e\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff\ufff9-\ufffb]/g;

  /** Sichtbares Ersatzzeichen für entfernte Zeichen in Werten. */
  const REPLACEMENT = '\ufffd';

  /**
   * Bereinigt kurze Anzeigetexte (z. B. Dateinamen): unsichtbare Zeichen
   * entfernen, Leerraum zusammenfassen, Länge begrenzen.
   *
   * @param {*} input - Rohtext.
   * @param {number} maxLength - Höchstlänge in Zeichen.
   * @param {string} fallback - Ersatz, wenn nichts übrig bleibt.
   * @returns {string} Bereinigter Text.
   */
  function sanitizeDisplayText(input, maxLength, fallback) {
    const text = String(input === null || input === undefined ? '' : input)
      .normalize('NFC')
      .replace(INVISIBLE_PATTERN, ' ')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, maxLength);
    return text === '' ? fallback : text;
  }

  /**
   * Bereinigt einen Wert für eine Tabellenzelle: Zeilenumbrüche und
   * Tabulatoren werden zu Leerzeichen, andere unsichtbare Zeichen werden
   * sichtbar als Ersatzzeichen U+FFFD dargestellt (der Inhalt soll nicht verschleiert werden).
   *
   * @param {string} value - Text aus der Datenbank.
   * @returns {string} Anzeigetext.
   */
  function cleanCellText(value) {
    return String(value).replace(/[\t\n\r]/g, ' ').replace(INVISIBLE_PATTERN, REPLACEMENT);
  }

  /**
   * Bereinigt eine Zeile eines SQL-Ausschnitts so, dass jede Zeichenposition
   * erhalten bleibt (für die Markierung "^" unter der Fehlerstelle).
   *
   * @param {string} line - Quelltextzeile.
   * @returns {string} Anzeigetext gleicher Länge.
   */
  function cleanSourceLine(line) {
    return String(line).replace(/\t/g, ' ').replace(INVISIBLE_PATTERN, REPLACEMENT);
  }

  ns.text = { sanitizeDisplayText, cleanCellText, cleanSourceLine };
})(window.LP = window.LP || {});
