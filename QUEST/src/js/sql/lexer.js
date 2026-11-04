/**
 * @file lexer.js
 * @description Zerlegt SQL-Quelltext in Tokens (Wörter, Bezeichner, Zahlen, Texte, Operatoren).
 *
 * Dialekt (an MySQL/MariaDB angelehnt):
 *   - Wörter (Schlüsselwörter und Namen) ohne Anführungszeichen; Buchstaben
 *     einschließlich Umlauten, Ziffern, "_" und "$".
 *   - Bezeichner in `Backticks` (z. B. `Schüler Nr`); `` steht für ein Backtick.
 *   - Texte in 'einfachen' oder "doppelten" Anführungszeichen; '' bzw. ""
 *     und Backslash-Escapes (\' \" \\ \n \t \r) sind möglich.
 *   - Zahlen: 12, 3.5, .5, 1e3.
 *   - Kommentare: "-- " bis Zeilenende (nach "--" muss ein Leerzeichen
 *     oder das Zeilenende folgen), "#" bis Zeilenende und /* … *\/.
 *     MySQL-Sonderkommentare /*! … *\/ werden ebenfalls übersprungen.
 *
 * Jedes Token enthält seine Position (offset, line, col) für Fehlermeldungen.
 *
 * Sicherheit:
 *   Keine regulären Ausdrücke, die aus der Eingabe gebildet werden; die
 *   Laufzeit ist linear zur Länge des Quelltextes.
 *
 * Abhängigkeiten:
 *   sql/errors.js
 */
(function (ns) {
  'use strict';

  const SqlError = ns.sql.SqlError;

  /** Höchstlänge von Bezeichnern (wie MySQL). */
  const MAX_IDENTIFIER_LENGTH = 64;

  const IDENT_START = /[\p{L}_]/u;
  const IDENT_PART = /[\p{L}\p{N}_$]/u;
  const DIGIT = /[0-9]/;
  const WHITESPACE = /[ \t\r\n\f\v\u00a0\ufeff]/;

  /** Zwei-Zeichen-Operatoren. */
  const OPERATORS_2 = new Set(['<=', '>=', '<>', '!=']);
  /** Ein-Zeichen-Operatoren. */
  const OPERATORS_1 = new Set(['=', '<', '>', '+', '-', '*', '/', '%']);
  /** Satzzeichen. */
  /** Satzzeichen; "@" nur für DEFINER=`user`@`host` in Exporten. */
  const PUNCTUATION = new Set(['(', ')', ',', '.', ';', '@']);

  /**
   * Beschreibt ein einzelnes Zeichen für Fehlermeldungen (unsichtbare
   * Zeichen als Codepunkt).
   *
   * @param {string} ch - Zeichen.
   * @returns {string} Beschreibung.
   */
  function describeChar(ch) {
    const code = ch.codePointAt(0);
    if (code < 0x21 || (code >= 0x7f && code <= 0xa0) || (code >= 0x2000 && code <= 0x206f) || code === 0xfeff) {
      return 'U+' + code.toString(16).toUpperCase().padStart(4, '0');
    }
    return '„' + ch + '“';
  }

  /**
   * Zerlegt einen Quelltext in Tokens.
   *
   * @param {string} source - SQL-Quelltext.
   * @returns {Array<Object>} Tokens; das letzte hat den Typ "eof".
   * @throws {SqlError} Bei ungültigen Zeichen, offenen Texten/Kommentaren oder ungültigen Zahlen.
   */
  function tokenize(source) {
    const src = String(source);
    const n = src.length;
    const tokens = [];
    let i = 0;
    let line = 1;
    let col = 1;

    function pos() {
      return { offset: i, line, col };
    }

    function advance(count) {
      for (let k = 0; k < count && i < n; k++) {
        if (src.charCodeAt(i) === 10) {
          line++;
          col = 1;
        } else {
          col++;
        }
        i++;
      }
    }

    function push(type, value, start, extra) {
      const token = { type, value, pos: start, end: i };
      if (extra) {
        Object.assign(token, extra);
      }
      tokens.push(token);
    }

    while (i < n) {
      const ch = src[i];
      const next = i + 1 < n ? src[i + 1] : '';

      // Leerraum
      if (WHITESPACE.test(ch)) {
        advance(1);
        continue;
      }

      // Kommentare
      if (ch === '#' || (ch === '-' && next === '-' && (i + 2 >= n || WHITESPACE.test(src[i + 2])))) {
        while (i < n && src[i] !== '\n') {
          advance(1);
        }
        continue;
      }
      if (ch === '/' && next === '*') {
        const start = pos();
        const close = src.indexOf('*/', i + 2);
        if (close < 0) {
          throw new SqlError('Der Kommentar /* … wird nicht mit */ geschlossen.', start);
        }
        advance(close + 2 - i);
        continue;
      }

      const start = pos();

      // Texte
      if (ch === '\'' || ch === '"') {
        const quote = ch;
        advance(1);
        let value = '';
        let closed = false;
        while (i < n) {
          const c = src[i];
          if (c === quote) {
            if (src[i + 1] === quote) {
              value += quote;
              advance(2);
              continue;
            }
            advance(1);
            closed = true;
            break;
          }
          if (c === '\\' && i + 1 < n) {
            const e = src[i + 1];
            if (e === '0') {
              throw new SqlError('Nullzeichen (\\0) sind in Texten nicht erlaubt.', pos());
            }
            const map = { n: '\n', t: '\t', r: '\r' };
            // \% und \_ bleiben erhalten, damit sie in LIKE-Mustern wirken.
            value += (e === '%' || e === '_') ? '\\' + e : (Object.prototype.hasOwnProperty.call(map, e) ? map[e] : e);
            advance(2);
            continue;
          }
          if (c === '\u0000') {
            throw new SqlError('Nullzeichen sind in Texten nicht erlaubt.', pos());
          }
          value += c;
          advance(1);
        }
        if (!closed) {
          throw new SqlError('Der Text wird nicht geschlossen – es fehlt das abschließende ' + quote + '.', start);
        }
        push('string', value, start);
        continue;
      }

      // Bezeichner in Backticks
      if (ch === '`') {
        advance(1);
        let value = '';
        let closed = false;
        while (i < n) {
          const c = src[i];
          if (c === '`') {
            if (src[i + 1] === '`') {
              value += '`';
              advance(2);
              continue;
            }
            advance(1);
            closed = true;
            break;
          }
          if (/[\u0000-\u001f\u007f]/.test(c)) {
            throw new SqlError('Steuerzeichen sind in Namen nicht erlaubt.', pos());
          }
          value += c;
          advance(1);
        }
        if (!closed) {
          throw new SqlError('Der Name in Backticks wird nicht geschlossen – es fehlt das abschließende `.', start);
        }
        if (value.trim() === '') {
          throw new SqlError('Ein Name darf nicht leer sein.', start);
        }
        if (value.length > MAX_IDENTIFIER_LENGTH) {
          throw new SqlError('Der Name ist zu lang (höchstens ' + MAX_IDENTIFIER_LENGTH + ' Zeichen).', start);
        }
        push('ident', value, start);
        continue;
      }

      // Zahlen ("." nur dann als Zahlbeginn, wenn kein Name davor steht, z. B. s.id)
      const prev = tokens.length > 0 ? tokens[tokens.length - 1] : null;
      const dotStartsNumber = ch === '.' && DIGIT.test(next) &&
        !(prev && (prev.type === 'word' || prev.type === 'ident') && prev.end === i);
      if (DIGIT.test(ch) || dotStartsNumber) {
        let j = i;
        while (j < n && DIGIT.test(src[j])) {
          j++;
        }
        let isInteger = true;
        if (src[j] === '.') {
          isInteger = false;
          j++;
          while (j < n && DIGIT.test(src[j])) {
            j++;
          }
        }
        if ((src[j] === 'e' || src[j] === 'E') && (DIGIT.test(src[j + 1] || '') || ((src[j + 1] === '+' || src[j + 1] === '-') && DIGIT.test(src[j + 2] || '')))) {
          isInteger = false;
          j += 2;
          while (j < n && DIGIT.test(src[j])) {
            j++;
          }
        }
        if (j < n && IDENT_PART.test(src[j])) {
          throw new SqlError('Ungültige Zahl „' + src.slice(i, Math.min(j + 1, i + 30)) + '“. Namen dürfen nicht mit einer Ziffer beginnen.', start);
        }
        const text = src.slice(i, j);
        const value = Number(text);
        if (!Number.isFinite(value) || (isInteger && !Number.isSafeInteger(value))) {
          throw new SqlError('Die Zahl ' + text.slice(0, 30) + ' ist zu groß.', start);
        }
        advance(j - i);
        push('number', value, start, { isInteger, text });
        continue;
      }

      // Wörter (Schlüsselwörter und Namen)
      if (IDENT_START.test(ch)) {
        let j = i + 1;
        while (j < n && IDENT_PART.test(src[j])) {
          j++;
        }
        const text = src.slice(i, j);
        if (text.length > MAX_IDENTIFIER_LENGTH) {
          throw new SqlError('Der Name „' + text.slice(0, 20) + '…“ ist zu lang (höchstens ' + MAX_IDENTIFIER_LENGTH + ' Zeichen).', start);
        }
        advance(j - i);
        push('word', text, start, { upper: text.toUpperCase() });
        continue;
      }

      // Operatoren und Satzzeichen
      const two = ch + next;
      if (OPERATORS_2.has(two)) {
        advance(2);
        push('op', two, start);
        continue;
      }
      if (OPERATORS_1.has(ch)) {
        advance(1);
        push('op', ch, start);
        continue;
      }
      if (PUNCTUATION.has(ch)) {
        advance(1);
        push('punct', ch, start);
        continue;
      }

      let hint = null;
      if (ch === '‘' || ch === '’' || ch === '‚' || ch === '“' || ch === '”' || ch === '„' || ch === '´') {
        hint = 'Typografische Anführungszeichen sind in SQL nicht erlaubt. Verwenden Sie gerade Anführungszeichen: \'Text\'.';
      } else if (ch === '[' || ch === ']') {
        hint = 'Eckige Klammern für Namen gibt es in MySQL nicht. Verwenden Sie `Backticks`.';
      }
      throw new SqlError('Unerwartetes Zeichen ' + describeChar(String.fromCodePoint(src.codePointAt(i))) + '.', start, hint);
    }

    tokens.push({ type: 'eof', value: null, pos: pos(), end: i });
    return tokens;
  }

  ns.sql.tokenize = tokenize;
  ns.sql.MAX_IDENTIFIER_LENGTH = MAX_IDENTIFIER_LENGTH;
})(window.SQLSIM = window.SQLSIM || {});
