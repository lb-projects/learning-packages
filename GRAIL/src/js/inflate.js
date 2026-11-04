// Kopie aus shared/js/inflate.js – nicht hier bearbeiten: Änderungen in shared/ vornehmen und sync-shared.mjs ausführen.
/**
 * SPDX-License-Identifier: MIT AND Zlib
 *
 * @file inflate.js
 * @description Implementierung des DEFLATE-Dekompressionsverfahrens (RFC 1951)
 *              sowie der Prüfsumme CRC-32 (wie in ZIP verwendet).
 *
 * Herkunft und Lizenz:
 *   Die Huffman-Dekodierung (buildHuffman, decodeSymbol) und der Ablauf der
 *   Blockverarbeitung sind eine VERÄNDERTE JavaScript-Übertragung des
 *   Referenzdekoders "puff" (puff.c, enthalten in der zlib-Distribution unter
 *   contrib/puff) von Mark Adler. Dies ist NICHT die Originalsoftware.
 *   Änderungen gegenüber dem Original: Übertragung nach JavaScript,
 *   Ausgabelimit gegen Zip-Bomben, wachsender Ausgabepuffer, deutsche
 *   Fehlermeldungen und Kommentare, CRC-32-Funktion ergänzt.
 *   Für diese Teile gilt zusätzlich zur MIT-Lizenz des Projekts der
 *   folgende Lizenzhinweis des Originals (zlib-Lizenz):
 *
 *     Copyright (C) 2002-2013 Mark Adler, all rights reserved
 *     version 2.3, 21 Jan 2013
 *
 *     This software is provided 'as-is', without any express or implied
 *     warranty.  In no event will the author be held liable for any damages
 *     arising from the use of this software.
 *
 *     Permission is granted to anyone to use this software for any purpose,
 *     including commercial applications, and to alter it and redistribute it
 *     freely, subject to the following restrictions:
 *
 *     1. The origin of this software must not be misrepresented; you must not
 *        claim that you wrote the original software. If you use this software
 *        in a product, an acknowledgment in the product documentation would be
 *        appreciated but is not required.
 *     2. Altered source versions must be plainly marked as such, and must not be
 *        misrepresented as being the original software.
 *     3. This notice may not be removed or altered from any source distribution.
 *
 *   Die übrigen Teile dieser Datei stehen unter der MIT-Lizenz des Projekts
 *   (siehe LICENSE.txt).
 *
 * Zweck:
 *   XLSX- und ODS-Dateien sind ZIP-Archive, deren Inhalte meist mit DEFLATE
 *   komprimiert sind. Da keine externen Bibliotheken verwendet werden dürfen
 *   und ältere Browser keine eingebaute Dekompression bieten, wird das
 *   Verfahren hier selbst umgesetzt.
 *
 * Aufbau des Verfahrens (vereinfacht):
 *   Ein DEFLATE-Datenstrom besteht aus Blöcken. Jeder Block beginnt mit
 *   3 Bit Kopf: 1 Bit "letzter Block" und 2 Bit Blocktyp:
 *     0 = unkomprimiert ("stored"),
 *     1 = komprimiert mit festen Huffman-Codes,
 *     2 = komprimiert mit im Block mitgelieferten (dynamischen) Huffman-Codes.
 *   Komprimierte Blöcke enthalten Literale (einzelne Bytes) und
 *   Rückverweise (Länge, Abstand), die bereits ausgegebene Bytes kopieren.
 *   Die Huffman-Dekodierung folgt dem kanonischen Verfahren nach dem Vorbild
 *   von "puff" (siehe "Herkunft und Lizenz" oben).
 *
 * Gemeinsamer Code der Lernpakete NEIGHBORS und GRAIL (Quelle: shared/js/inflate.js).
 *
 * Abhängigkeiten:
 *   Keine.
 *
 * Sicherheitsaspekte:
 *   - Jede Leseoperation prüft, ob das Ende der Eingabe erreicht ist.
 *   - Die Ausgabe ist durch `maxOutput` begrenzt. Ein präpariertes Archiv
 *     ("Zip-Bombe"), das sich auf ein Vielfaches entpacken würde, führt
 *     daher zu einem Fehler statt zu Speichererschöpfung.
 *   - Ungültige Codes, zu große Abstände und überbelegte Huffman-Tabellen
 *     führen zu einem Fehler.
 */
(function (ns) {
  'use strict';

  /** Höchste Codelänge in DEFLATE (Bit). */
  const MAX_BITS = 15;

  /** Basislängen für Längencodes 257 … 285. */
  const LENGTH_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31,
    35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  /** Anzahl Zusatzbits für Längencodes 257 … 285. */
  const LENGTH_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2,
    3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  /** Basisabstände für Abstandscodes 0 … 29. */
  const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193,
    257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  /** Anzahl Zusatzbits für Abstandscodes 0 … 29. */
  const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
    7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  /** Reihenfolge, in der die Codelängen des Codelängen-Alphabets übertragen werden. */
  const CODE_LENGTH_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

  /**
   * Fehler, der bei beschädigten oder unzulässigen Daten geworfen wird.
   * @param {string} message - Beschreibung.
   * @returns {Error} Fehlerobjekt.
   */
  function inflateError(message) {
    return new Error('Dekompression fehlgeschlagen: ' + message);
  }

  /**
   * Baut eine kanonische Huffman-Dekodiertabelle aus Codelängen.
   *
   * Ergebnis:
   *   count[len]  = Anzahl der Symbole mit Codelänge len,
   *   symbol[]    = Symbole, sortiert nach (Codelänge, Symbolwert).
   *
   * @param {Uint8Array|number[]} lengths - Codelänge je Symbol (0 = Symbol unbenutzt).
   * @returns {{count: Uint16Array, symbol: Uint16Array}} Dekodiertabelle.
   * @throws {Error} Wenn die Codelängen eine überbelegte (ungültige) Tabelle ergeben.
   */
  function buildHuffman(lengths) {
    const count = new Uint16Array(MAX_BITS + 1);
    const symbol = new Uint16Array(lengths.length);
    for (let s = 0; s < lengths.length; s++) {
      count[lengths[s]]++;
    }
    // Prüfen, ob die Längen einen gültigen Präfixcode ergeben:
    // "left" zählt die noch freien Codes jeder Länge; negativ = überbelegt.
    let left = 1;
    for (let len = 1; len <= MAX_BITS; len++) {
      left <<= 1;
      left -= count[len];
      if (left < 0) {
        throw inflateError('ungültige Huffman-Tabelle');
      }
    }
    // Startposition jeder Codelänge in der Symbolliste berechnen.
    const offsets = new Uint16Array(MAX_BITS + 1);
    for (let len = 1; len < MAX_BITS; len++) {
      offsets[len + 1] = offsets[len] + count[len];
    }
    for (let s = 0; s < lengths.length; s++) {
      if (lengths[s] !== 0) {
        symbol[offsets[lengths[s]]++] = s;
      }
    }
    count[0] = 0;
    return { count, symbol };
  }

  /** Feste Huffman-Tabellen für Blocktyp 1 (werden beim ersten Bedarf erzeugt). */
  let fixedTables = null;

  /**
   * Liefert die festen Huffman-Tabellen nach RFC 1951, Abschnitt 3.2.6.
   * @returns {{lit: Object, dist: Object}} Literal-/Längen- und Abstandstabelle.
   */
  function getFixedTables() {
    if (!fixedTables) {
      const lit = new Uint8Array(288);
      lit.fill(8, 0, 144);
      lit.fill(9, 144, 256);
      lit.fill(7, 256, 280);
      lit.fill(8, 280, 288);
      const dist = new Uint8Array(30);
      dist.fill(5);
      fixedTables = { lit: buildHuffman(lit), dist: buildHuffman(dist) };
    }
    return fixedTables;
  }

  /**
   * Entpackt einen rohen DEFLATE-Datenstrom (ohne zlib- oder gzip-Kopf).
   *
   * @param {Uint8Array} input - Komprimierte Daten.
   * @param {number} maxOutput - Höchstzahl an Bytes, die erzeugt werden dürfen.
   * @param {number} [expectedSize] - Erwartete Größe (zur Vorbelegung des Puffers).
   * @returns {Uint8Array} Die entpackten Daten.
   * @throws {Error} Bei beschädigten Daten oder Überschreitung von maxOutput.
   */
  function inflateRaw(input, maxOutput, expectedSize) {
    let inPos = 0;     // nächstes zu lesendes Eingabebyte
    let bitBuf = 0;    // noch nicht verbrauchte Bits (niederwertigste zuerst)
    let bitCnt = 0;    // Anzahl gültiger Bits in bitBuf

    let out = new Uint8Array(Math.max(1024, Math.min(expectedSize || 0, maxOutput)));
    let outLen = 0;

    /**
     * Liest `n` Bits (0 ≤ n ≤ 16) aus der Eingabe, niederwertigstes Bit zuerst.
     * @param {number} n - Anzahl Bits.
     * @returns {number} Gelesener Wert.
     */
    function bits(n) {
      while (bitCnt < n) {
        if (inPos >= input.length) {
          throw inflateError('unerwartetes Ende der Daten');
        }
        bitBuf |= input[inPos++] << bitCnt;
        bitCnt += 8;
      }
      const value = bitBuf & ((1 << n) - 1);
      bitBuf >>>= n;
      bitCnt -= n;
      return value;
    }

    /**
     * Stellt sicher, dass im Ausgabepuffer Platz für `extra` weitere Bytes ist.
     * Vergrößert den Puffer bei Bedarf (Verdopplung), höchstens bis maxOutput.
     * @param {number} extra - Benötigte zusätzliche Bytes.
     */
    function ensureCapacity(extra) {
      const needed = outLen + extra;
      if (needed > maxOutput) {
        throw inflateError('entpackte Daten überschreiten die zulässige Größe');
      }
      if (needed > out.length) {
        let size = out.length * 2;
        while (size < needed) {
          size *= 2;
        }
        const bigger = new Uint8Array(Math.min(size, maxOutput));
        bigger.set(out.subarray(0, outLen));
        out = bigger;
      }
    }

    /**
     * Dekodiert ein Symbol mit Hilfe einer kanonischen Huffman-Tabelle.
     * Die Codebits werden einzeln gelesen; für jede Länge wird geprüft, ob
     * der bisher gelesene Code in den Bereich dieser Länge fällt.
     * @param {{count: Uint16Array, symbol: Uint16Array}} table - Dekodiertabelle.
     * @returns {number} Dekodiertes Symbol.
     */
    function decodeSymbol(table) {
      let code = 0;   // bisher gelesene Codebits
      let first = 0;  // erster Code der aktuellen Länge
      let index = 0;  // Index des ersten Symbols der aktuellen Länge
      for (let len = 1; len <= MAX_BITS; len++) {
        code |= bits(1);
        const count = table.count[len];
        if (code - first < count) {
          return table.symbol[index + (code - first)];
        }
        index += count;
        first += count;
        first <<= 1;
        code <<= 1;
      }
      throw inflateError('ungültiger Huffman-Code');
    }

    /** Verarbeitet einen unkomprimierten Block (Typ 0). */
    function storedBlock() {
      // Restbits bis zur Bytegrenze verwerfen.
      bitBuf = 0;
      bitCnt = 0;
      if (inPos + 4 > input.length) {
        throw inflateError('unerwartetes Ende der Daten');
      }
      const len = input[inPos] | (input[inPos + 1] << 8);
      const nlen = input[inPos + 2] | (input[inPos + 3] << 8);
      inPos += 4;
      if (len !== (~nlen & 0xffff)) {
        throw inflateError('beschädigter unkomprimierter Block');
      }
      if (inPos + len > input.length) {
        throw inflateError('unerwartetes Ende der Daten');
      }
      ensureCapacity(len);
      out.set(input.subarray(inPos, inPos + len), outLen);
      outLen += len;
      inPos += len;
    }

    /**
     * Verarbeitet einen komprimierten Block mit den angegebenen Tabellen.
     * @param {Object} litTable - Tabelle für Literale/Längen (Symbole 0 … 285).
     * @param {Object} distTable - Tabelle für Abstände (Symbole 0 … 29).
     */
    function codesBlock(litTable, distTable) {
      for (;;) {
        let sym = decodeSymbol(litTable);
        if (sym < 256) {
          // Literal: ein einzelnes Byte ausgeben.
          ensureCapacity(1);
          out[outLen++] = sym;
        } else if (sym === 256) {
          // Blockende.
          return;
        } else {
          // Rückverweis: Länge und Abstand bestimmen, dann kopieren.
          sym -= 257;
          if (sym >= 29) {
            throw inflateError('ungültiger Längencode');
          }
          const length = LENGTH_BASE[sym] + bits(LENGTH_EXTRA[sym]);
          const dsym = decodeSymbol(distTable);
          if (dsym >= 30) {
            throw inflateError('ungültiger Abstandscode');
          }
          const dist = DIST_BASE[dsym] + bits(DIST_EXTRA[dsym]);
          if (dist > outLen) {
            throw inflateError('Abstand zeigt vor den Anfang der Daten');
          }
          ensureCapacity(length);
          // Byteweise kopieren: Quelle und Ziel dürfen sich überlappen
          // (z. B. Abstand 1, Länge 10 = ein Byte zehnmal wiederholen).
          for (let i = 0; i < length; i++) {
            out[outLen] = out[outLen - dist];
            outLen++;
          }
        }
      }
    }

    /** Liest die mitgelieferten Huffman-Tabellen (Typ 2) und dekodiert den Block. */
    function dynamicBlock() {
      const nlen = bits(5) + 257;
      const ndist = bits(5) + 1;
      const ncode = bits(4) + 4;
      if (nlen > 286 || ndist > 30) {
        throw inflateError('ungültige Tabellengrößen');
      }
      // 1. Codelängen für das Codelängen-Alphabet lesen.
      const clLengths = new Uint8Array(19);
      for (let i = 0; i < ncode; i++) {
        clLengths[CODE_LENGTH_ORDER[i]] = bits(3);
      }
      const clTable = buildHuffman(clLengths);

      // 2. Codelängen für Literal-/Längen- und Abstandsalphabet lesen.
      const lengths = new Uint8Array(nlen + ndist);
      let index = 0;
      while (index < nlen + ndist) {
        const sym = decodeSymbol(clTable);
        if (sym < 16) {
          lengths[index++] = sym;
        } else {
          let repeatValue = 0;
          let repeat;
          if (sym === 16) {
            if (index === 0) {
              throw inflateError('Wiederholung ohne Vorgänger');
            }
            repeatValue = lengths[index - 1];
            repeat = 3 + bits(2);
          } else if (sym === 17) {
            repeat = 3 + bits(3);
          } else {
            repeat = 11 + bits(7);
          }
          if (index + repeat > nlen + ndist) {
            throw inflateError('zu viele Codelängen');
          }
          while (repeat--) {
            lengths[index++] = repeatValue;
          }
        }
      }
      if (lengths[256] === 0) {
        throw inflateError('Blockende-Code fehlt');
      }
      const litTable = buildHuffman(lengths.subarray(0, nlen));
      const distTable = buildHuffman(lengths.subarray(nlen));
      codesBlock(litTable, distTable);
    }

    // Hauptschleife: Blöcke verarbeiten, bis der letzte Block erreicht ist.
    let last;
    do {
      last = bits(1);
      const type = bits(2);
      if (type === 0) {
        storedBlock();
      } else if (type === 1) {
        const fixed = getFixedTables();
        codesBlock(fixed.lit, fixed.dist);
      } else if (type === 2) {
        dynamicBlock();
      } else {
        throw inflateError('ungültiger Blocktyp');
      }
    } while (!last);

    return out.slice(0, outLen);
  }

  /** Vorberechnete CRC-32-Tabelle (Polynom 0xEDB88320, wie bei ZIP). */
  let crcTable = null;

  /**
   * Berechnet die CRC-32-Prüfsumme.
   *
   * @param {Uint8Array} data - Daten.
   * @returns {number} Prüfsumme als vorzeichenlose 32-Bit-Zahl.
   */
  function crc32(data) {
    if (!crcTable) {
      crcTable = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
          c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        }
        crcTable[n] = c >>> 0;
      }
    }
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
      crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  ns.inflate = { inflateRaw, crc32 };
})(window.HG = window.HG || {});
