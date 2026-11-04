/**
 * @file sql-import.js
 * @description Liest eine hochgeladene SQL-Datei und baut daraus eine neue Datenbank.
 *
 * Ablauf:
 *   1. Prüfung von Dateiendung (.sql, .txt), Größe (höchstens 1 MB) und Inhalt
 *      (keine Binärdaten, keine Archive).
 *   2. Dekodierung als UTF-8 (BOM wird entfernt); ist die Datei kein gültiges
 *      UTF-8, wird sie als Windows-1252 gelesen (ältere Exporte) und ein
 *      Hinweis ausgegeben.
 *   3. Aufbau einer neuen Datenbank mit ns.sql.buildDatabase. Erst wenn die
 *      ganze Datei fehlerfrei ist, wird sie übernommen (atomar).
 *
 * Sicherheit:
 *   - Die Datei wird nur als Text gelesen, nie geöffnet, ausgeführt oder als
 *     HTML dargestellt.
 *   - Grenzwerte für Größe, Tabellen, Spalten und Datensätze (siehe database.js).
 *
 * Abhängigkeiten:
 *   sql/*.js
 */
(function (ns) {
  'use strict';

  const SqlError = ns.sql.SqlError;

  /** Höchstgröße einer Datei in Byte (1 MB). */
  const MAX_FILE_SIZE = 1024 * 1024;

  /** Erlaubte Dateiendungen. */
  const ALLOWED_EXTENSION = /\.(sql|txt)$/i;

  /**
   * Erkennt bekannte Binärformate an ihren ersten Bytes.
   *
   * @param {Uint8Array} bytes - Dateiinhalt.
   * @returns {string|null} Beschreibung des Formats oder null.
   */
  function detectBinary(bytes) {
    const starts = (sig) => sig.every((b, i) => bytes[i] === b);
    if (starts([0x50, 0x4b, 0x03, 0x04]) || starts([0x50, 0x4b, 0x05, 0x06])) {
      return 'ein ZIP-Archiv (z. B. gepackter Export oder Office-Datei)';
    }
    if (starts([0x1f, 0x8b])) {
      return 'ein gzip-Archiv (.gz) – bitte zuerst entpacken';
    }
    if (starts([0x25, 0x50, 0x44, 0x46])) {
      return 'eine PDF-Datei';
    }
    if (bytes.indexOf(0) >= 0) {
      return 'eine Binärdatei';
    }
    return null;
  }

  /**
   * Liest und dekodiert eine Textdatei.
   *
   * @param {File} file - Gewählte Datei.
   * @returns {Promise<{text:string, encodingNote:string|null}>} Inhalt.
   * @throws {SqlError} Bei unzulässigen Dateien.
   */
  async function readSqlFile(file) {
    if (!ALLOWED_EXTENSION.test(file.name)) {
      throw new SqlError('Nur Dateien mit der Endung .sql oder .txt sind erlaubt.', null);
    }
    if (file.size === 0) {
      throw new SqlError('Die Datei ist leer.', null);
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new SqlError('Die Datei ist zu groß (höchstens 1 MB).', null);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length > MAX_FILE_SIZE) {
      throw new SqlError('Die Datei ist zu groß (höchstens 1 MB).', null);
    }
    const binary = detectBinary(bytes);
    if (binary) {
      throw new SqlError('Die Datei ist keine Textdatei, sondern ' + binary + '.', null);
    }
    try {
      return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encodingNote: null };
    } catch (e) {
      return {
        text: new TextDecoder('windows-1252').decode(bytes),
        encodingNote: 'Die Datei ist nicht im Zeichensatz UTF-8 gespeichert und wurde als Windows-1252 gelesen. Prüfen Sie Umlaute in den Daten.'
      };
    }
  }

  /**
   * Liest eine SQL-Datei und baut daraus eine Datenbank.
   *
   * @param {File} file - Gewählte Datei.
   * @returns {Promise<Object>} Ergebnis von buildDatabase, ergänzt um encodingNote und source (Quelltext für Fehlerausschnitte).
   * @throws {SqlError} Bei Fehlern; error.source enthält dann ggf. den Quelltext.
   */
  async function importFile(file) {
    const { text, encodingNote } = await readSqlFile(file);
    try {
      const result = ns.sql.buildDatabase(text);
      result.encodingNote = encodingNote;
      return result;
    } catch (error) {
      if (error instanceof SqlError) {
        error.source = text;
        error.encodingNote = encodingNote;
      }
      throw error;
    }
  }

  ns.sqlImport = { importFile, readSqlFile, MAX_FILE_SIZE };
})(window.SQLSIM = window.SQLSIM || {});
