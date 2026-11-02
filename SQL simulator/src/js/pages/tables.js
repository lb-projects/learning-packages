/**
 * @file pages/tables.js
 * @description Seite 2 „Tabellen“: Aufbau und Inhalt aller Tabellen der geladenen Datenbank.
 *
 * Je Tabelle werden die Spalten (Typ, Primär-/Fremdschlüssel, NOT NULL) und die
 * Datensätze angezeigt. Der Tabellenbereich ist so hoch, dass etwa fünf
 * Datensätze sichtbar sind; weitere erreicht man durch Scrollen.
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
      dom.plural(db.rowCount(), 'Datensatz', 'Datensätze') + (info.dirty ? ' (mit Änderungen von Seite 3)' : '') + '.';

    db.tableList().forEach((table, i) => {
      const headingId = 'table-heading-' + i;
      const heading = dom.el('h3', { id: headingId, tabindex: '-1' }, [
        ns.text.cleanCellText(table.name), ' ',
        dom.el('span', { class: 'count' }, '(' + dom.plural(table.rows.length, 'Datensatz', 'Datensätze') + ')')
      ]);
      const jump = dom.el('button', { type: 'button', class: 'btn btn-small' }, ns.text.cleanCellText(table.name));
      jump.addEventListener('click', () => {
        heading.scrollIntoView({ block: 'start' });
        heading.focus({ preventScroll: true });
      });
      ui.toc.appendChild(jump);

      const content = [heading, schemaList(table)];
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
      ui.list.appendChild(dom.el('section', { class: 'card table-card', 'aria-labelledby': headingId }, content));
    });
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
