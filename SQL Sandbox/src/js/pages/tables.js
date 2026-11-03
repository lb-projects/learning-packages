/**
 * @file pages/tables.js
 * @description Seite 2 „Tabellen“: Aufbau und Inhalt aller Tabellen der geladenen Datenbank.
 *
 * Je Tabelle werden die Spalten (Typ, Primär-/Fremdschlüssel, NOT NULL) und die
 * Datensätze angezeigt. Der Tabellenbereich ist so hoch, dass etwa fünf
 * Datensätze sichtbar sind; weitere erreicht man durch Scrollen.
 * Unter jeder Tabelle lässt sich der CREATE-TABLE-Befehl aufklappen, der aus
 * dem aktuellen Aufbau erzeugt wird (standardmäßig zugeklappt).
 * Sichten (Views) folgen in einem eigenen Abschnitt mit ihrem aktuellen Ergebnis
 * und dem aufklappbaren CREATE-VIEW-Befehl.
 *
 * Abhängigkeiten:
 *   dom-utils.js, state.js, pages/common.js
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const ui = {};
  /** true, wenn sich die Datenbank seit dem letzten Aufbau geändert hat. */
  let stale = true;
  /** Tabellen (Schlüssel in Kleinbuchstaben), deren CREATE-TABLE-Befehl aufgeklappt ist – bleibt beim Neuaufbau erhalten. */
  const openCreate = new Set();

  /**
   * Erzeugt die Spaltenbeschreibung einer Tabelle.
   *
   * @param {Object} table - Tabelle.
   * @returns {HTMLElement} Liste der Spalten.
   */
  function schemaList(table) {
    const fkByColumn = new Map();
    for (const fk of table.foreignKeys) {
      fk.columns.forEach((col, i) => {
        fkByColumn.set(col, fk.refTable + (fk.refColumns[i] ? '.' + fk.refColumns[i] : ''));
      });
    }
    const uniqueCols = new Set(table.uniques.filter((u) => u.length === 1).map((u) => u[0]));
    const items = table.columns.map((column, idx) => {
      const badges = [];
      if (table.primaryKey && table.primaryKey.includes(idx)) {
        badges.push(dom.el('abbr', { class: 'badge badge-pk', title: 'Primärschlüssel' }, 'PK'));
      }
      if (fkByColumn.has(idx)) {
        badges.push(dom.el('span', { class: 'badge badge-fk', title: 'Fremdschlüssel' }, 'FK → ' + ns.text.cleanCellText(fkByColumn.get(idx))));
      }
      if (uniqueCols.has(idx)) {
        badges.push(dom.el('span', { class: 'badge' }, 'UNIQUE'));
      }
      if (column.notNull && !(table.primaryKey && table.primaryKey.includes(idx))) {
        badges.push(dom.el('span', { class: 'badge' }, 'NOT NULL'));
      }
      if (column.autoIncrement) {
        badges.push(dom.el('span', { class: 'badge' }, 'AUTO_INCREMENT'));
      }
      return dom.el('li', null, [
        dom.el('code', { class: 'col-name' }, ns.text.cleanCellText(column.name)), ' ',
        dom.el('span', { class: 'col-type' }, ns.text.cleanCellText(column.type.display))
      ].concat(badges.length ? [' '].concat(badges) : []));
    });
    const list = dom.el('ul', { class: 'schema-list', 'aria-label': 'Spalten der Tabelle ' + table.name }, items);
    if (table.primaryKey && table.primaryKey.length > 1) {
      return dom.el('div', null, [list, dom.el('p', { class: 'hint' },
        'Zusammengesetzter Primärschlüssel: (' + table.primaryKey.map((i) => table.columns[i].name).join(', ') + ')')]);
    }
    return list;
  }

  /**
   * Erzeugt die Zeile mit den CHECK-Bedingungen einer Tabelle.
   *
   * @param {Object} table - Tabelle.
   * @returns {HTMLElement|null} Absatz oder null, wenn es keine gibt.
   */
  function checkList(table) {
    if (table.checks.length === 0) {
      return null;
    }
    const items = table.checks.map((c) => (c.name !== null ? c.name + ': ' : '') + c.text + (c.enforced ? '' : ' (NOT ENFORCED)'));
    return dom.el('p', { class: 'hint check-list' }, ['Bedingungen (CHECK): ', dom.el('code', null, ns.text.cleanCellText(items.join('; ')))]);
  }

  /**
   * Erzeugt einen aufklappbaren SQL-Befehl (CREATE TABLE bzw. CREATE VIEW).
   *
   * @param {string} key - Schlüssel für den gemerkten Auf-/Zuklapp-Zustand.
   * @param {string} summary - Beschriftung.
   * @param {string} label - Zugängliche Bezeichnung des Befehls.
   * @param {string} sql - Befehl (mehrzeilig).
   * @returns {HTMLElement} <details>-Element (zugeklappt, außer es war zuvor offen).
   */
  function sqlBlock(key, summary, label, sql) {
    const text = sql.split('\n').map((line) => ns.text.cleanSourceLine(line)).join('\n');
    const details = dom.el('details', { class: 'create-sql' }, [
      dom.el('summary', null, summary),
      dom.el('pre', { class: 'sql-example', 'aria-label': label }, text)
    ]);
    details.open = openCreate.has(key);
    details.addEventListener('toggle', () => {
      if (details.open) {
        openCreate.add(key);
      } else {
        openCreate.delete(key);
      }
    });
    return details;
  }

  /**
   * Erzeugt die Karte einer Sicht: Spalten, aktuelles Ergebnis und CREATE VIEW.
   *
   * @param {Object} db - Datenbank.
   * @param {Object} view - Sicht {name, columns, text}.
   * @param {number} i - Laufende Nummer (für die Überschrift-ID).
   * @param {Object} budget - Gemeinsames Zeitbudget aller Sichten (ns.sql.timeBudget).
   * @returns {{card:HTMLElement, heading:HTMLElement}} Karte und Überschrift.
   */
  function viewCard(db, view, i, budget) {
    let result = null;
    let error = null;
    try {
      result = ns.sql.runQueries(db, 'SELECT * FROM ' + ns.sql.quoteName(view.name), { total: budget }).results[0];
    } catch (e) {
      error = e;
    }
    const headingId = 'view-heading-' + i;
    const heading = dom.el('h3', { id: headingId, tabindex: '-1' }, [
      ns.text.cleanCellText(view.name), ' ',
      dom.el('span', { class: 'count' }, '(Sicht' + (result ? ', ' + dom.plural(result.rows.length, 'Zeile', 'Zeilen') : '') + ')')
    ]);
    const content = [heading];
    if (result) {
      content.push(dom.el('ul', { class: 'schema-list', 'aria-label': 'Spalten der Sicht ' + view.name },
        result.columns.map((c) => dom.el('li', null, dom.el('code', { class: 'col-name' }, ns.text.cleanCellText(c))))));
      if (result.rows.length === 0) {
        content.push(dom.el('p', { class: 'hint' }, 'Die Sicht liefert derzeit keine Zeilen.'));
      } else {
        content.push(ns.ui.dataTable({
          columns: result.columns, types: result.types, rows: result.rows,
          label: 'Ergebnis der Sicht ' + view.name, scrollClass: 'scroll-5'
        }));
      }
    } else {
      content.push(ns.ui.errorBox(error, null));
    }
    content.push(sqlBlock('view:' + view.name.toLowerCase(), 'CREATE-VIEW-Befehl anzeigen', 'CREATE-VIEW-Befehl der Sicht ' + view.name, ns.sql.createViewSql(view)));
    return { card: dom.el('section', { class: 'card view-card', 'aria-labelledby': headingId }, content), heading };
  }

  /** Fügt oben einen Sprungknopf zu einer Überschrift hinzu. */
  function addJump(text, heading) {
    const jump = dom.el('button', { type: 'button', class: 'btn btn-small' }, text);
    jump.addEventListener('click', () => {
      heading.scrollIntoView({ block: 'start' });
      heading.focus({ preventScroll: true });
    });
    ui.toc.appendChild(jump);
  }

  /** Baut die Seite neu auf. */
  function build() {
    const db = ns.state.db();
    dom.clear(ui.toc);
    dom.clear(ui.list);
    if (!db) {
      dom.clear(ui.notice);
      const link = dom.el('button', { type: 'button', class: 'btn btn-link' }, 'Zu Seite 1: Datenbank laden');
      link.addEventListener('click', () => ns.app.showPage('load', { scrollTop: true }));
      ui.notice.appendChild(dom.el('p', null, ['Es ist noch keine Datenbank geladen. Wählen Sie auf Seite 1 eine Beispieldatenbank oder laden Sie eine SQL-Datei hoch. ', link]));
      ui.notice.hidden = false;
      ui.info.textContent = '';
      return;
    }
    ui.notice.hidden = true;
    const info = ns.state.info();
    ui.info.textContent = 'Datenbank „' + info.name + '“: ' + dom.plural(db.tables.size, 'Tabelle', 'Tabellen') + ', ' +
      (db.views.size ? dom.plural(db.views.size, 'Sicht', 'Sichten') + ', ' : '') +
      dom.plural(db.rowCount(), 'Datensatz', 'Datensätze') + (info.dirty ? ' (mit Änderungen von Seite 3)' : '') + '.';

    db.tableList().forEach((table, i) => {
      const headingId = 'table-heading-' + i;
      const heading = dom.el('h3', { id: headingId, tabindex: '-1' }, [
        ns.text.cleanCellText(table.name), ' ',
        dom.el('span', { class: 'count' }, '(' + dom.plural(table.rows.length, 'Datensatz', 'Datensätze') + ')')
      ]);
      addJump(ns.text.cleanCellText(table.name), heading);

      const content = [heading, schemaList(table)];
      const checks = checkList(table);
      if (checks) {
        content.push(checks);
      }
      if (table.rows.length === 0) {
        content.push(dom.el('p', { class: 'hint' }, 'Die Tabelle enthält keine Datensätze.'));
      } else {
        content.push(ns.ui.dataTable({
          columns: table.columns.map((c) => c.name),
          types: table.columns.map((c) => c.type),
          rows: table.rows,
          label: 'Datensätze der Tabelle ' + table.name,
          scrollClass: 'scroll-5'
        }));
      }
      content.push(sqlBlock('table:' + table.key, 'CREATE-TABLE-Befehl anzeigen', 'CREATE-TABLE-Befehl der Tabelle ' + table.name, ns.sql.createTableSql(table)));
      ui.list.appendChild(dom.el('section', { class: 'card table-card', 'aria-labelledby': headingId }, content));
    });

    const views = Array.from(db.views.values());
    if (views.length) {
      ui.list.appendChild(dom.el('h3', { class: 'section-heading' }, 'Sichten (Views)'));
      ui.list.appendChild(dom.el('p', { class: 'hint' }, 'Eine Sicht ist eine gespeicherte Abfrage. Ihr Inhalt wird bei jedem Aufruf aus den aktuellen Tabellen berechnet.'));
      // Alle Sichten zusammen haben ein gemeinsames Zeitbudget; danach erscheint bei den übrigen eine Meldung.
      const budget = ns.sql.timeBudget(ns.sql.EXEC_LIMITS.totalTimeMs);
      views.forEach((view, i) => {
        const v = viewCard(db, view, i, budget);
        addJump(ns.text.cleanCellText(view.name) + ' (Sicht)', v.heading);
        ui.list.appendChild(v.card);
      });
    }
  }

  ns.pages.tables = {
    init() {
      ui.notice = dom.byId('tables-notice');
      ui.info = dom.byId('tables-info');
      ui.toc = dom.byId('tables-toc');
      ui.list = dom.byId('tables-list');
    },
    render() {
      if (stale) {
        stale = false;
        build();
      }
    },
    onDbChange() {
      stale = true;
    }
  };
})(window.SQLSIM = window.SQLSIM || {});
