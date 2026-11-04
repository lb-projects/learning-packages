/**
 * @file zip-reader.js
 * @description Minimaler, abgesicherter Leser für ZIP-Archive (Grundlage für XLSX und ODS).
 *
 * Zweck:
 *   Liest das Inhaltsverzeichnis ("Central Directory") eines ZIP-Archivs und
 *   entpackt einzelne, namentlich angeforderte Einträge in den Arbeitsspeicher.
 *
 * Aufbau eines ZIP-Archivs (vereinfacht):
 *   [lokaler Kopf + Daten] … [Central Directory] [End of Central Directory]
 *   Das Ende-Verzeichnis (EOCD) steht am Dateiende und verweist auf das
 *   Central Directory, das alle Einträge mit Größen und Positionen auflistet.
 *
 * Abhängigkeiten:
 *   inflate.js (KNN.inflate.inflateRaw, KNN.inflate.crc32)
 *
 * Sicherheitsaspekte:
 *   - Es werden niemals Dateien auf einen Datenträger geschrieben; Eintragsnamen
 *     dienen nur als Schlüssel zum Nachschlagen. Pfadangriffe ("../") sind
 *     daher wirkungslos.
 *   - Begrenzungen gegen "Zip-Bomben": Anzahl Einträge, entpackte Größe je
 *     Eintrag und insgesamt, sowie das Kompressionsverhältnis.
 *   - Verschlüsselte Einträge, ZIP64 und mehrteilige Archive werden abgelehnt.
 *   - Alle Positionsangaben werden gegen die Dateigröße geprüft.
 *   - Die CRC-32-Prüfsumme jedes entpackten Eintrags wird kontrolliert.
 */
(function (ns) {
  'use strict';

  /**
   * Grenzwerte gegen präparierte Archive.
   * Eine Tabelle mit 500 Punkten ergibt entpackt nur wenige hundert KB XML;
   * die Grenzen lassen reichlich Spielraum (z. B. für Formatierungen), halten
   * aber den Speicherbedarf des XML-Parsers in einem unkritischen Bereich.
   */
  const LIMITS = Object.freeze({
    maxEntries: 1000,
    maxEntryBytes: 8 * 1024 * 1024,
    maxTotalBytes: 16 * 1024 * 1024,
    maxRatio: 200,
    /** Unterhalb dieser Größe wird das Kompressionsverhältnis nicht geprüft. */
    ratioCheckMinBytes: 1024 * 1024
  });

  const SIG_EOCD = 0x06054b50;
  const SIG_CENTRAL = 0x02014b50;
  const SIG_LOCAL = 0x04034b50;

  /**
   * Erzeugt einen Fehler mit einheitlicher Meldung.
   * @param {string} message - Beschreibung.
   * @returns {Error} Fehlerobjekt.
   */
  function zipError(message) {
    return new Error('Ungültige oder nicht unterstützte Datei: ' + message);
  }

  /**
   * Öffnet ein ZIP-Archiv und liest das Inhaltsverzeichnis.
   *
   * @param {Uint8Array} bytes - Vollständiger Dateiinhalt.
   * @returns {{names: function(): string[], has: function(string): boolean,
   *            read: function(string): Uint8Array, readText: function(string): string}}
   *          Zugriffsobjekt auf die Einträge.
   * @throws {Error} Bei beschädigten, verschlüsselten oder zu großen Archiven.
   */
  function open(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const size = bytes.length;

    /** Liest eine 16-Bit-Zahl (little endian) mit Bereichsprüfung. */
    function u16(pos) {
      if (pos < 0 || pos + 2 > size) {
        throw zipError('Position außerhalb der Datei');
      }
      return view.getUint16(pos, true);
    }
    /** Liest eine 32-Bit-Zahl (little endian) mit Bereichsprüfung. */
    function u32(pos) {
      if (pos < 0 || pos + 4 > size) {
        throw zipError('Position außerhalb der Datei');
      }
      return view.getUint32(pos, true);
    }

    // 1. Ende-Verzeichnis suchen (rückwärts; danach darf höchstens ein
    //    Kommentar von max. 65535 Bytes folgen).
    let eocd = -1;
    const searchStart = Math.max(0, size - 22 - 65535);
    for (let pos = size - 22; pos >= searchStart; pos--) {
      if (view.getUint32(pos, true) === SIG_EOCD) {
        eocd = pos;
        break;
      }
    }
    if (eocd < 0) {
      throw zipError('Archivende nicht gefunden');
    }
    const diskNumber = u16(eocd + 4);
    const cdDisk = u16(eocd + 6);
    const entriesOnDisk = u16(eocd + 8);
    const totalEntries = u16(eocd + 10);
    const cdSize = u32(eocd + 12);
    const cdOffset = u32(eocd + 16);
    if (diskNumber !== 0 || cdDisk !== 0 || entriesOnDisk !== totalEntries) {
      throw zipError('mehrteilige Archive werden nicht unterstützt');
    }
    if (totalEntries === 0xffff || cdOffset === 0xffffffff || cdSize === 0xffffffff) {
      throw zipError('ZIP64 wird nicht unterstützt');
    }
    if (totalEntries > LIMITS.maxEntries) {
      throw zipError('zu viele Einträge im Archiv');
    }
    if (cdOffset + cdSize > eocd) {
      throw zipError('Inhaltsverzeichnis beschädigt');
    }

    // 2. Central Directory lesen.
    const decoder = new TextDecoder('utf-8');
    /** @type {Map<string, {flags:number, method:number, crc:number, compSize:number, uncompSize:number, localOffset:number}>} */
    const entries = new Map();
    let pos = cdOffset;
    for (let i = 0; i < totalEntries; i++) {
      if (u32(pos) !== SIG_CENTRAL) {
        throw zipError('Inhaltsverzeichnis beschädigt');
      }
      const flags = u16(pos + 8);
      const method = u16(pos + 10);
      const crc = u32(pos + 16);
      const compSize = u32(pos + 20);
      const uncompSize = u32(pos + 24);
      const nameLen = u16(pos + 28);
      const extraLen = u16(pos + 30);
      const commentLen = u16(pos + 32);
      const localOffset = u32(pos + 42);
      const nameStart = pos + 46;
      if (nameStart + nameLen > size) {
        throw zipError('Eintragsname beschädigt');
      }
      const name = decoder.decode(bytes.subarray(nameStart, nameStart + nameLen));
      // Bei doppelten Namen gilt der erste Eintrag; weitere werden ignoriert.
      if (!entries.has(name)) {
        entries.set(name, { flags, method, crc, compSize, uncompSize, localOffset });
      }
      pos = nameStart + nameLen + extraLen + commentLen;
    }

    let totalExtracted = 0;

    /**
     * Entpackt einen Eintrag.
     * @param {string} name - Exakter Eintragsname, z. B. "xl/workbook.xml".
     * @returns {Uint8Array} Inhalt des Eintrags.
     * @throws {Error} Wenn der Eintrag fehlt, verschlüsselt, zu groß oder beschädigt ist.
     */
    function read(name) {
      const entry = entries.get(name);
      if (!entry) {
        throw zipError('Eintrag "' + name + '" fehlt');
      }
      if (entry.flags & 0x0001) {
        throw zipError('verschlüsselte Dateien werden nicht unterstützt');
      }
      if (entry.uncompSize > LIMITS.maxEntryBytes) {
        throw zipError('Eintrag ist zu groß');
      }
      if (totalExtracted + entry.uncompSize > LIMITS.maxTotalBytes) {
        throw zipError('Archiv ist entpackt zu groß');
      }
      if (entry.uncompSize >= LIMITS.ratioCheckMinBytes &&
          entry.uncompSize > entry.compSize * LIMITS.maxRatio) {
        throw zipError('verdächtig hohes Kompressionsverhältnis');
      }
      // Lokalen Kopf überspringen: Namens- und Zusatzfeldlänge stehen dort erneut.
      const local = entry.localOffset;
      if (u32(local) !== SIG_LOCAL) {
        throw zipError('lokaler Kopf beschädigt');
      }
      const dataStart = local + 30 + u16(local + 26) + u16(local + 28);
      const dataEnd = dataStart + entry.compSize;
      if (dataEnd > size) {
        throw zipError('Eintrag reicht über das Dateiende hinaus');
      }
      const raw = bytes.subarray(dataStart, dataEnd);

      let data;
      if (entry.method === 0) {
        if (entry.compSize !== entry.uncompSize) {
          throw zipError('Größenangaben widersprüchlich');
        }
        data = raw.slice();
      } else if (entry.method === 8) {
        // Die tatsächliche Ausgabe wird auf die angegebene Größe begrenzt.
        data = ns.inflate.inflateRaw(raw, entry.uncompSize, entry.uncompSize);
        if (data.length !== entry.uncompSize) {
          throw zipError('Größenangaben widersprüchlich');
        }
      } else {
        throw zipError('Kompressionsverfahren ' + entry.method + ' wird nicht unterstützt');
      }
      if (ns.inflate.crc32(data) !== entry.crc) {
        throw zipError('Prüfsumme stimmt nicht');
      }
      totalExtracted += data.length;
      return data;
    }

    /**
     * Entpackt einen Eintrag und dekodiert ihn als UTF-8-Text.
     * @param {string} name - Eintragsname.
     * @returns {string} Textinhalt.
     */
    function readText(name) {
      return new TextDecoder('utf-8').decode(read(name));
    }

    return {
      names: () => Array.from(entries.keys()),
      has: (name) => entries.has(name),
      read,
      readText
    };
  }

  /**
   * Prüft, ob Daten mit der Signatur eines lokalen ZIP-Kopfs beginnen ("PK\x03\x04").
   * @param {Uint8Array} bytes - Dateiinhalt.
   * @returns {boolean} true bei ZIP-Signatur.
   */
  function looksLikeZip(bytes) {
    return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b &&
      bytes[2] === 0x03 && bytes[3] === 0x04;
  }

  ns.zip = { open, looksLikeZip, LIMITS };
})(window.KNN = window.KNN || {});
