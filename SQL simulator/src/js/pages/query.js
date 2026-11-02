/**
 * @file pages/query.js
 * @description Seite 3 „SQL-Befehle“: Eingabemaske, Ausführung und Ergebnisanzeige.
 *
 * - Fehler erscheinen unterhalb der Eingabemaske mit Position und Ausschnitt.
 * - Ergebnisse von SELECT erscheinen als Tabelle mit Platz für 10 Zeilen;
 *   weitere Zeilen werden durch Scrollen sichtbar.
 * - INSERT, UPDATE und DELETE ändern die Datenbank; mehrere Befehle werden
 *   gemeinsam (atomar) ausgeführt – bei einem Fehler bleibt alles unverändert.
 * - Eingabe und Ergebnis bleiben beim Seitenwechsel erhalten.
 * - Hinweise (kein Fehler) stehen über dem Ergebnis: kleingeschriebene
 *   Schlüsselwörter, fehlende Verknüpfungsbedingung, Text in falscher Schreibung.
 *
 * Abhängigkeiten:
 *   dom-utils.js, state.js, sql/executor.js, pages/common.js
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const ui = {};

  /** Höchstlänge der Eingabe. */
  const MAX_INPUT = 10000;

  /** true, während diese Seite selbst eine Änderung an den Zustand meldet. */
  let ownChange = false;

  /**
   * Zeigt einen Hinweis über dem Ergebnisbereich an.
   *
   * @param {string|null} message - Hinweis oder null zum Ausblenden.
   */
  function setNotice(message) {
    ui.notice.textContent = message || '';
    ui.notice.hidden = !message;
  }

  /** Leert den Ergebnisbereich. */
  function clearOutput() {
    dom.clear(ui.output);
    ui.status.textContent = '';
  }

  /** Aktualisiert die Angabe zur aktuellen Datenbank. */
  function renderDbInfo() {
    const db = ns.state.db();
    if (!db) {
      ui.dbInfo.textContent = 'Es ist noch keine Datenbank geladen (Seite 1).';
      ui.reset.disabled = true;
      return;
    }
    const info = ns.state.info();
    ui.dbInfo.textContent = 'Datenbank: „' + info.name + '“ – Tabellen: ' + db.tableList().map((t) => t.name).join(', ') +
      (info.dirty ? ' (mit Änderungen)' : '') + '.';
    ui.reset.disabled = !info.dirty;
  }

  /**
   * Beschreibt das Ergebnis eines ändernden Befehls.
   *
   * @param {Object} r - Ergebnis {kind, count, table}.
   * @returns {string} Text.
   */
  function changeText(r) {
    const verb = r.kind === 'insert' ? 'eingefügt' : (r.kind === 'update' ? 'geändert' : 'gelöscht');
    return dom.plural(r.count, 'Datensatz', 'Datensätze') + ' in „' + r.table + '“ ' + verb + '.';
  }

  /**
   * Erzeugt einen Hinweis (kein Fehler) zu einem Ergebnis.
   *
   * @param {string} text - Hinweistext.
   * @returns {HTMLElement} Hinweisbox.
   */
  function warningBox(text) {
    return dom.el('p', { class: 'status notice result-warning', role: 'note' }, [
      dom.el('strong', null, 'Hinweis: '), ns.text.cleanCellText(text)
    ]);
  }

  /**
   * Stellt die Ergebnisse dar.
   *
   * @param {Object} res - Ergebnis von runQueries.
   */
  function renderResults(res) {
    const multi = res.statementCount > 1;
    if (res.keywordCase && res.keywordCase.length) {
      ui.output.appendChild(warningBox('SQL-Schlüsselwörter werden üblicherweise großgeschrieben: ' +
        res.keywordCase.map((k) => k.written + ' → ' + k.upper).join(', ') + '.'));
    }
    for (const r of res.results) {
      const block = dom.el('div', { class: 'result-block' });
      if (multi) {
        block.appendChild(dom.el('h3', null, 'Befehl ' + r.statementIndex));
      }
      for (const w of r.warnings || []) {
        block.appendChild(warningBox(w));
      }
      if (r.kind === 'select') {
        block.appendChild(dom.el('p', { class: 'result-count' }, 'Ergebnis: ' + dom.plural(r.rows.length, 'Zeile', 'Zeilen')));
        block.appendChild(ns.ui.dataTable({
          columns: r.columns,
          types: r.types,
          rows: r.rows,
          label: 'Ergebnistabelle' + (multi ? ' von Befehl ' + r.statementIndex : ''),
          scrollClass: 'scroll-10'
        }));
        if (r.rows.length === 0) {
          block.appendChild(dom.el('p', { class: 'hint' }, 'Keine Datensätze gefunden.'));
        }
      } else {
        block.appendChild(dom.el('p', { class: 'status status-success' }, changeText(r)));
      }
      ui.output.appendChild(block);
    }
    if (res.changed) {
      ui.output.appendChild(dom.el('p', { class: 'hint' }, 'Die Änderungen sind auf Seite 2 sichtbar. „Datenbank zurücksetzen“ stellt den geladenen Stand wieder her.'));
    }
    ui.status.textContent = multi ? res.statementCount + ' Befehle erfolgreich ausgeführt.' : 'Befehl erfolgreich ausgeführt.';
  }

  /** Führt die Eingabe aus. */
  function execute() {
    setNotice(null);
    clearOutput();
    const db = ns.state.db();
    const source = ui.input.value;
    let error = null;
    if (!db) {
      error = new ns.sql.SqlError('Es ist noch keine Datenbank geladen.', null, 'Wählen Sie auf Seite 1 eine Beispieldatenbank oder laden Sie eine SQL-Datei hoch.');
    } else if (source.trim() === '') {
      error = new ns.sql.SqlError('Bitte geben Sie einen SQL-Befehl ein.', null, 'Beispiel: SELECT * FROM ' + (db.tableList()[0] ? db.tableList()[0].name : 'tabelle') + ';');
    } else if (source.length > MAX_INPUT) {
      error = new ns.sql.SqlError('Die Eingabe ist zu lang (höchstens ' + dom.formatCount(MAX_INPUT) + ' Zeichen).', null);
    }
    if (!error) {
      try {
        const res = ns.sql.runQueries(db, source);
        if (res.changed) {
          ownChange = true;
          try {
            ns.state.commit(res.db);
          } finally {
            ownChange = false;
          }
        }
        renderResults(res);
        return;
      } catch (e) {
        error = e;
      }
    }
    ui.output.appendChild(ns.ui.errorBox(error, source, { showStatement: true }));
    ui.status.textContent = 'Der Befehl enthält einen Fehler.';
  }

  ns.pages.query = {
    init() {
      ui.input = dom.byId('sql-input');
      ui.run = dom.byId('btn-run');
      ui.clearInput = dom.byId('btn-clear-input');
      ui.reset = dom.byId('btn-reset-db');
      ui.output = dom.byId('query-output');
      ui.status = dom.byId('query-status');
      ui.notice = dom.byId('query-notice');
      ui.dbInfo = dom.byId('query-db-info');

      ui.run.addEventListener('click', execute);
      ui.input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          execute();
        }
      });
      ui.clearInput.addEventListener('click', () => {
        ui.input.value = '';
        ui.input.focus();
      });
      ui.reset.addEventListener('click', () => {
        ns.state.reset();
      });
    },
    render() {
      renderDbInfo();
    },
    onDbChange(event) {
      renderDbInfo();
      if (ownChange) {
        return;
      }
      const hadOutput = ui.output.childNodes.length > 0;
      clearOutput();
      if (event.type === 'reset') {
        setNotice('Die Datenbank wurde auf den Stand nach dem Laden zurückgesetzt.' + (hadOutput ? ' Das bisherige Ergebnis wurde entfernt.' : ''));
      } else if (hadOutput) {
        setNotice('Es wurde eine andere Datenbank geladen. Das bisherige Ergebnis wurde entfernt; Ihre Eingabe bleibt erhalten.');
      } else {
        setNotice(null);
      }
    }
  };
})(window.SQLSIM = window.SQLSIM || {});
