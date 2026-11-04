/**
 * @file pages/load.js
 * @description Seite 1 „Datenbank laden“: Beispieldatenbanken und Upload eigener SQL-Dateien.
 *
 * Abhängigkeiten:
 *   dom-utils.js, text-utils.js, state.js, sql-import.js, samples/*.js, pages/common.js
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;

  /** Oberflächenelemente. */
  const ui = {};
  /** Fertig aufgebaute Beispieldatenbanken (id → Datenbank). */
  const sampleCache = new Map();
  /**
   * Laufende Nummer der Ladevorgänge. Wird während des Einlesens einer Datei
   * eine weitere Datei oder Beispieldatenbank gewählt, wird das Ergebnis des
   * älteren Vorgangs verworfen.
   */
  let loadCounter = 0;

  /**
   * Zeigt eine Statusmeldung zum Laden an.
   *
   * @param {string} kind - "info", "success" oder "box" (fertige Fehlerbox ohne eigenen Rahmen).
   * @param {string|HTMLElement} content - Meldung.
   * @param {Array<string>} [details] - Zusätzliche Hinweise als Liste.
   */
  function setStatus(kind, content, details) {
    dom.clear(ui.status);
    ui.status.className = kind === 'box' ? '' : 'status' + (kind === 'success' ? ' status-success' : '');
    ui.status.appendChild(typeof content === 'string' ? dom.el('p', null, content) : content);
    if (details && details.length) {
      // Hinweise können Namen aus der Datei enthalten.
      ui.status.appendChild(dom.el('ul', null, details.map((d) => dom.el('li', null, ns.text.cleanCellText(d)))));
    }
    ui.status.hidden = false;
  }

  /**
   * Beschreibt den Umfang einer Datenbank, z. B. "6 Tabellen, 245 Datensätze".
   *
   * @param {Object} db - Datenbank.
   * @returns {string} Beschreibung.
   */
  function describeDb(db) {
    return dom.plural(db.tables.size, 'Tabelle', 'Tabellen') + (db.views.size ? ', ' + dom.plural(db.views.size, 'Sicht', 'Sichten') : '') +
      ', ' + dom.plural(db.rowCount(), 'Datensatz', 'Datensätze');
  }

  /** Aktualisiert die Anzeige der geladenen Datenbank. */
  function renderCurrent() {
    const db = ns.state.db();
    dom.clear(ui.current);
    if (!db) {
      ui.current.className = 'status';
      ui.current.appendChild(dom.el('p', null, 'Noch keine Datenbank geladen.'));
      return;
    }
    const info = ns.state.info();
    ui.current.className = 'status status-success';
    ui.current.appendChild(dom.el('p', null, [
      dom.el('strong', null, 'Aktuell geladen: '),
      info.name + (info.kind === 'sample' ? ' (Beispieldatenbank)' : ' (eigene Datei)') + ' – ' + describeDb(db) +
      (info.dirty ? ' – mit Änderungen von Seite 3' : '') + '.'
    ]));
  }

  /**
   * Lädt eine Beispieldatenbank.
   *
   * @param {Object} sample - Beispiel {id, title, sql}.
   */
  function loadSample(sample) {
    loadCounter++;
    try {
      let db = sampleCache.get(sample.id);
      if (!db) {
        db = ns.sql.buildDatabase(sample.sql).db;
        sampleCache.set(sample.id, db);
      }
      ns.state.load(db.clone(), sample.title, 'sample');
      setStatus('success', 'Beispieldatenbank „' + sample.title + '“ geladen: ' + describeDb(db) + '.',
        ['Weiter geht es auf Seite 2 (Tabellen ansehen) oder Seite 3 (SQL-Befehle ausführen).']);
    } catch (error) {
      setStatus('box', ns.ui.errorBox(error, sample.sql, { title: 'Die Beispieldatenbank konnte nicht geladen werden.' }));
    }
  }

  /** Erzeugt die Karten der Beispieldatenbanken. */
  function renderSamples() {
    for (const sample of ns.samples || []) {
      let tables = '';
      try {
        const db = ns.sql.buildDatabase(sample.sql).db;
        sampleCache.set(sample.id, db);
        tables = 'Tabellen: ' + db.tableList().map((t) => t.name).join(', ') + ' (' + dom.plural(db.rowCount(), 'Datensatz', 'Datensätze') + ')';
      } catch (error) {
        tables = 'Fehler in der Beispieldatenbank: ' + error.message;
      }
      const button = dom.el('button', { type: 'button', class: 'btn btn-primary' }, '„' + sample.title + '“ laden');
      button.addEventListener('click', () => loadSample(sample));
      ui.samples.appendChild(dom.el('div', { class: 'card sample-card' }, [
        dom.el('h4', null, sample.title),
        dom.el('p', null, sample.description),
        dom.el('p', { class: 'hint' }, tables),
        button
      ]));
    }
  }

  /**
   * Verarbeitet die ausgewählte Datei.
   *
   * @returns {Promise<void>}
   */
  async function handleFile() {
    const file = ui.file.files && ui.file.files[0];
    if (!file) {
      return;
    }
    const id = ++loadCounter;
    // Dateiname nur bereinigt anzeigen (keine unsichtbaren Richtungszeichen zur Täuschung).
    const fileName = ns.text.sanitizeDisplayText(file.name, 80, 'Datei');
    setStatus('info', 'Datei „' + fileName + '“ wird gelesen …');
    try {
      const result = await ns.sqlImport.importFile(file);
      if (id !== loadCounter) {
        return;
      }
      ns.state.load(result.db, fileName, 'file');
      const details = [];
      if (result.encodingNote) {
        details.push(result.encodingNote);
      }
      if (result.skipped.size > 0) {
        details.push('Übersprungen (für QUEST ohne Bedeutung): ' +
          Array.from(result.skipped.entries()).map(([k, n]) => n + '× ' + k).join(', ') + '.');
      }
      for (const notice of result.notices.slice(0, 5)) {
        details.push(notice);
      }
      details.push('Weiter geht es auf Seite 2 (Tabellen ansehen) oder Seite 3 (SQL-Befehle ausführen).');
      setStatus('success', 'Datei „' + fileName + '“ geladen: ' + describeDb(result.db) + '.', details);
    } catch (error) {
      if (id !== loadCounter) {
        return;
      }
      const box = ns.ui.errorBox(error, error && error.source ? error.source : null,
        { title: 'Die Datei „' + fileName + '“ wurde nicht geladen. Die bisherige Datenbank bleibt unverändert.', showStatement: false });
      setStatus('box', box);
    } finally {
      ui.file.value = '';
    }
  }

  ns.pages.load = {
    init() {
      ui.current = dom.byId('current-db');
      ui.samples = dom.byId('sample-list');
      ui.file = dom.byId('file-input');
      ui.status = dom.byId('import-status');
      renderSamples();
      ui.file.addEventListener('change', handleFile);
    },
    render() {
      renderCurrent();
    },
    onDbChange() {
      renderCurrent();
    }
  };
})(window.SQLSIM = window.SQLSIM || {});
