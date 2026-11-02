/**
 * @file values.js
 * @description Vergleich, Wahrheitswerte, Schlüssel und Anzeige von SQL-Werten.
 *
 * Werte in der Engine sind ausschließlich:
 *   null (SQL-NULL), number (Ganz- und Dezimalzahlen) oder string
 *   (Texte sowie Datum/Uhrzeit im festen Format "JJJJ-MM-TT [hh:mm:ss]").
 *   Wahrheitswerte sind wie in MySQL die Zahlen 1 (wahr) und 0 (falsch).
 *
 * Semantik (an MySQL angelehnt, aber mit einer Sortierung, die die
 * Groß-/Kleinschreibung beachtet – wie utf8mb4_bin bzw. *_cs; MySQL selbst
 * verwendet standardmäßig *_ci):
 *   - Texte werden mit Beachtung der Groß-/Kleinschreibung verglichen
 *     ("Berlin" ≠ "berlin"), Akzente/Umlaute werden unterschieden
 *     ("Müller" ≠ "Muller"), Leerzeichen am Ende werden ignoriert.
 *     Sortiert wird nach deutscher Ordnung.
 *   - Zahl gegen Text: Ist der Text eine Zahl ("42"), wird numerisch
 *     verglichen, sonst als Text.
 *   - Vergleiche mit NULL ergeben NULL (dreiwertige Logik).
 *
 * Abhängigkeiten:
 *   Keine.
 */
(function (ns) {
  'use strict';

  /** Text, der vollständig eine Zahl darstellt. */
  const NUMERIC_TEXT = /^\s*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?\s*$/;

  /** Sortierung nach deutscher Ordnung; Groß-/Kleinschreibung und Akzente zählen. */
  const collator = new Intl.Collator('de', { sensitivity: 'variant' });

  /**
   * @param {string} text - Text.
   * @returns {number|null} Die Zahl, wenn der Text eine Zahl ist, sonst null.
   */
  function numericValue(text) {
    if (!NUMERIC_TEXT.test(text)) {
      return null;
    }
    const value = Number(text);
    return Number.isFinite(value) ? value : null;
  }

  /**
   * Vergleichsschlüssel eines Textes (Leerzeichen am Ende egal, Groß-/Kleinschreibung zählt).
   *
   * @param {string} text - Text.
   * @returns {string} Schlüssel.
   */
  function textKey(text) {
    return text.replace(/ +$/, '');
  }

  /**
   * Vergleicht zwei Texte.
   *
   * @param {string} a - Erster Text.
   * @param {string} b - Zweiter Text.
   * @returns {number} -1, 0 oder 1.
   */
  function compareText(a, b) {
    if (textKey(a) === textKey(b)) {
      return 0;
    }
    const c = collator.compare(a, b);
    if (c !== 0) {
      return c < 0 ? -1 : 1;
    }
    return a < b ? -1 : 1;
  }

  /**
   * Vergleicht zwei SQL-Werte.
   *
   * @param {*} a - Erster Wert.
   * @param {*} b - Zweiter Wert.
   * @returns {number|null} -1, 0, 1 oder null, wenn ein Wert NULL ist.
   */
  function compareValues(a, b) {
    if (a === null || b === null) {
      return null;
    }
    const ta = typeof a;
    const tb = typeof b;
    if (ta === 'number' && tb === 'number') {
      return a < b ? -1 : (a > b ? 1 : 0);
    }
    if (ta === 'number' || tb === 'number') {
      const na = ta === 'number' ? a : numericValue(a);
      const nb = tb === 'number' ? b : numericValue(b);
      if (na !== null && nb !== null) {
        return na < nb ? -1 : (na > nb ? 1 : 0);
      }
      return compareText(String(a), String(b));
    }
    return compareText(a, b);
  }

  /**
   * Ordnet zwei Werte für ORDER BY (NULL zuerst, wie MySQL).
   *
   * @param {*} a - Erster Wert.
   * @param {*} b - Zweiter Wert.
   * @returns {number} -1, 0 oder 1.
   */
  function orderValues(a, b) {
    if (a === null || b === null) {
      return a === b ? 0 : (a === null ? -1 : 1);
    }
    return compareValues(a, b);
  }

  /**
   * Schlüssel für Gruppierung, DISTINCT, Eindeutigkeit und Hash-Verknüpfungen.
   * Gleiche Schlüssel ⇔ gleiche Werte im Sinne von compareValues (für Werte gleicher Art).
   *
   * @param {*} value - Wert.
   * @returns {string} Schlüssel.
   */
  function valueKey(value) {
    if (value === null) {
      return 'N';
    }
    if (typeof value === 'number') {
      return 'n' + String(value);
    }
    return 's' + textKey(value);
  }

  /**
   * Wahrheitswert eines SQL-Werts.
   *
   * @param {*} value - Wert.
   * @returns {boolean|null} true, false oder null (unbekannt).
   */
  function truth(value) {
    if (value === null) {
      return null;
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    const n = numericValue(value);
    return n !== null && n !== 0;
  }

  /**
   * Wandelt einen Wahrheitswert in einen SQL-Wert um (1, 0 oder NULL).
   *
   * @param {boolean|null} value - Wahrheitswert.
   * @returns {number|null} SQL-Wert.
   */
  function fromTruth(value) {
    return value === null ? null : (value ? 1 : 0);
  }

  /**
   * Kategorie eines Spaltentyps für Hash-Verknüpfungen.
   *
   * @param {Object|null} type - Normalisierter Typ (siehe database.js) oder null.
   * @returns {string|null} "number", "text" oder null (unbekannt).
   */
  function typeCategory(type) {
    if (!type) {
      return null;
    }
    return (type.base === 'INT' || type.base === 'DECIMAL' || type.base === 'FLOAT' || type.base === 'YEAR') ? 'number' : 'text';
  }

  /**
   * Formatiert einen Wert für die Anzeige.
   * DECIMAL(p,s)-Spalten mit s Nachkommastellen; berechnete Zahlen auf höchstens
   * 10 Nachkommastellen gerundet (verdeckt Gleitkomma-Rauschen wie 0.30000000000000004).
   *
   * @param {*} value - Wert (nicht null).
   * @param {Object|null} type - Spaltentyp oder null.
   * @returns {string} Anzeigetext.
   */
  function formatValue(value, type) {
    if (typeof value === 'number') {
      if (type && type.base === 'DECIMAL') {
        return value.toFixed(type.scale);
      }
      if (Number.isInteger(value)) {
        return String(value);
      }
      return String(parseFloat(value.toFixed(10)));
    }
    return String(value);
  }

  ns.sql.values = {
    numericValue, textKey, compareText, compareValues, orderValues, valueKey,
    truth, fromTruth, typeCategory, formatValue
  };
})(window.SQLSIM = window.SQLSIM || {});
