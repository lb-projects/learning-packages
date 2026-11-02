/**
 * @file errors.js
 * @description Fehlerklasse der SQL-Engine und Vorschläge bei Tippfehlern.
 *
 * Zweck:
 *   Alle Fehler, die durch Eingaben entstehen (Syntaxfehler, unbekannte
 *   Spalten, Typfehler, Grenzwerte …), werden als SqlError mit einer
 *   verständlichen deutschen Meldung und – wenn bekannt – der Position im
 *   Quelltext gemeldet. Programmfehler bleiben gewöhnliche Errors und werden
 *   von der Oberfläche getrennt behandelt.
 *
 * Abhängigkeiten:
 *   Keine.
 */
(function (ns) {
  'use strict';

  /**
   * Fehler in einer SQL-Eingabe.
   */
  class SqlError extends Error {
    /**
     * @param {string} message - Meldung für die Lernenden.
     * @param {{offset:number, line:number, col:number}|null} [pos] - Position im Quelltext.
     * @param {string|null} [hint] - Zusätzlicher Hinweis, z. B. "Meinten Sie „FROM“?".
     */
    constructor(message, pos, hint) {
      super(message);
      this.name = 'SqlError';
      this.pos = pos || null;
      this.hint = hint || null;
      /** Nummer des Befehls (1-basiert) bei mehreren Befehlen; wird von außen gesetzt. */
      this.statementIndex = null;
    }
  }

  /**
   * Editierabstand (Einfügen, Löschen, Ersetzen, Vertauschen benachbarter
   * Zeichen – z. B. "FORM" → "FROM" = 1). Wörter sind höchstens 64 Zeichen lang.
   *
   * @param {string} a - Erstes Wort.
   * @param {string} b - Zweites Wort.
   * @param {number} max - Größter interessanter Abstand.
   * @returns {number} Abstand oder max + 1.
   */
  function distance(a, b, max) {
    if (Math.abs(a.length - b.length) > max) {
      return max + 1;
    }
    const d = [];
    for (let i = 0; i <= a.length; i++) {
      d.push(new Array(b.length + 1).fill(0));
      d[i][0] = i;
    }
    for (let j = 0; j <= b.length; j++) {
      d[0][j] = j;
    }
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
      }
    }
    return Math.min(d[a.length][b.length], max + 1);
  }

  /**
   * Sucht unter `candidates` das Wort, das `word` am ähnlichsten ist
   * (Groß-/Kleinschreibung egal). Kurze Wörter dürfen um 1 Zeichen, längere
   * um 2 Zeichen abweichen.
   *
   * @param {string} word - Eingegebenes Wort.
   * @param {Iterable<string>} candidates - Mögliche Wörter.
   * @returns {string|null} Bester Vorschlag oder null.
   */
  function suggest(word, candidates) {
    const list = suggestions(word, candidates);
    return list.length ? list[0] : null;
  }

  /**
   * Liefert alle gleich guten Vorschläge (höchstens drei, ohne Doppelungen).
   *
   * @param {string} word - Eingegebenes Wort.
   * @param {Iterable<string>} candidates - Mögliche Wörter.
   * @returns {Array<string>} Vorschläge (leer, wenn keiner nahe genug ist).
   */
  function suggestions(word, candidates) {
    const w = String(word).toLowerCase();
    const max = w.length <= 4 ? 1 : 2;
    let best = [];
    let bestDistance = max + 1;
    for (const candidate of candidates) {
      const d = distance(w, String(candidate).toLowerCase(), max);
      if (d < bestDistance) {
        best = [candidate];
        bestDistance = d;
      } else if (d === bestDistance && d <= max && !best.some((b) => b.toLowerCase() === String(candidate).toLowerCase())) {
        best.push(candidate);
      }
    }
    return best.slice(0, 3);
  }

  /**
   * Formuliert einen Hinweis aus Vorschlägen.
   *
   * @param {Array<string>} list - Vorschläge.
   * @param {string} [prefix=''] - Vorangestellter Text, z. B. "s." für Spalten mit Alias.
   * @returns {string|null} z. B. "Meinten Sie „schule“ oder „schueler“?" oder null.
   */
  function didYouMean(list, prefix) {
    if (!list.length) {
      return null;
    }
    const p = prefix || '';
    const quoted = list.map((s) => '„' + p + s + '“');
    return 'Meinten Sie ' + (quoted.length === 1 ? quoted[0] : quoted.slice(0, -1).join(', ') + ' oder ' + quoted[quoted.length - 1]) + '?';
  }

  ns.sql = ns.sql || {};
  ns.sql.SqlError = SqlError;
  ns.sql.suggest = suggest;
  ns.sql.suggestions = suggestions;
  ns.sql.didYouMean = didYouMean;
})(window.SQLSIM = window.SQLSIM || {});
