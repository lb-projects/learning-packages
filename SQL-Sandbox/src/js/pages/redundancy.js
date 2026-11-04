/**
 * @file pages/redundancy.js
 * @description Seite 6 „Redundanzen“: Normalformen (1. bis 3. NF) je Tabelle nach den
 *              funktionalen Abhängigkeiten, die die Lernenden eintragen, und Beispiele für
 *              Einfüge-, Änderungs- und Löschanomalien.
 *
 * Ablauf:
 *   - Übersicht aller Tabellen mit 1./2./3. NF und „Anomalien möglich?“.
 *   - Ausgewählte Tabelle: Schlüsselkandidaten, Markierung mehrwertiger Spalten (1. NF, mit
 *     Hinweisen auf Auffälligkeiten), Eingabe der funktionalen Abhängigkeiten (geprüft gegen
 *     die Daten), Bewertung mit Begründung, Anomalien mit SQL-Befehl und Vorher/Nachher.
 *   - Die Beispiele laufen auf einer Kopie der Datenbank (normalization.anomalies); „Auf Seite 3
 *     übernehmen“ setzt nur die Eingabe auf Seite 3.
 *   - Abhängigkeiten und Markierungen bleiben beim Seitenwechsel und nach Änderungen auf Seite 3
 *     erhalten; beim Laden einer anderen Datenbank und beim Zurücksetzen werden sie geleert.
 *
 * Abhängigkeiten:
 *   dom-utils.js, text-utils.js, state.js, normalization.js, sql/*, pages/common.js, app.js (zur Laufzeit)
 *
 * Sicherheit:
 *   Namen und Werte stammen ggf. aus hochgeladenen Dateien und werden nur als Text eingefügt.
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const text = ns.text;
  const N = ns.normalization;
  const ui = {};

  /** Seitenzustand (bleibt beim Seitenwechsel erhalten). */
  const state = {
    /** Schlüssel (klein) der ausgewählten Tabelle. */
    table: null,
    /** Tabelle (klein) → [{left:[Namen klein], right:[Namen klein]}]. */
    fds: new Map(),
    /** Tabelle (klein) → Set der als mehrwertig markierten Spalten (klein). */
    nonAtomic: new Map(),
    /** Tabelle (klein) → gewählter Verstoß (Index). */
    violation: new Map(),
    /** Entwurf der neuen Abhängigkeit (Namen klein). */
    draft: { left: new Set(), right: new Set() },
    /** Letzte Meldung des Editors. */
    fdError: ''
  };

  const KIND_TEXT = { partial: 'Teilabhängigkeit, verletzt die 2. NF', transitive: 'transitive Abhängigkeit, verletzt die 3. NF' };

  // ---------------------------------------------------------------------------
  // Hilfsfunktionen
  // ---------------------------------------------------------------------------

  /** @returns {string} Bereinigter Name. */
  const clean = (s) => text.cleanCellText(s);

  /** @returns {string} Spaltennamen, z. B. "schueler_nr, kurs_nr". */
  function colNames(table, cols) {
    return cols.map((c) => clean(table.columns[c].name)).join(', ');
  }

  /** @returns {string} FA als Text, z. B. "kurs_nr → Kurs_Titel, Lehrkraft". */
  function fdText(table, fd) {
    return colNames(table, fd.left) + ' → ' + colNames(table, fd.right);
  }

  /** @returns {Array<Object>} Eingetragene FA einer Tabelle als Indizes (unbekannte Spalten fallen weg). */
  function fdsOf(table) {
    const list = state.fds.get(table.key) || [];
    const idx = (n) => table.colIndex.get(n);
    return list.map((fd) => ({ left: N.sortedSet(fd.left.map(idx).filter((i) => i !== undefined)), right: N.sortedSet(fd.right.map(idx).filter((i) => i !== undefined)) }))
      .filter((fd) => fd.left.length && fd.right.length);
  }

  /** @returns {Array<number>} Als mehrwertig markierte Spalten (Indizes). */
  function nonAtomicOf(table) {
    const set = state.nonAtomic.get(table.key) || new Set();
    return Array.from(set).map((n) => table.colIndex.get(n)).filter((i) => i !== undefined).sort((a, b) => a - b);
  }

  /** @returns {Object} Bewertung einer Tabelle. */
  function evaluate(table) {
    return N.evaluate(table, fdsOf(table), nonAtomicOf(table));
  }

  /** Statusanzeige einer Normalform. */
  function statusBadge(ok) {
    if (ok === true) {
      return dom.el('span', { class: 'nf-status nf-ok' }, '✓ erfüllt');
    }
    if (ok === false) {
      return dom.el('span', { class: 'nf-status nf-bad' }, '✗ verletzt');
    }
    return dom.el('span', { class: 'nf-status nf-open' }, '– offen');
  }

  /** Setzt nach dem Neuzeichnen den Fokus wieder auf ein Bedienelement. */
  function focusById(id) {
    const el = document.getElementById(id);
    if (el) {
      el.focus();
    }
  }

  // ---------------------------------------------------------------------------
  // Übersicht
  // ---------------------------------------------------------------------------

  /** Tabelle aller Tabellen mit ihren Normalformen. */
  function renderOverview(db) {
    const body = dom.el('tbody');
    for (const table of db.tableList()) {
      const ev = evaluate(table);
      const name = dom.el('button', { type: 'button', class: 'link-btn', id: 'red-pick-' + table.key }, clean(table.name));
      name.addEventListener('click', () => {
        selectTable(table.key);
        focusById('red-table');
      });
      const count = fdsOf(table).length;
      let anomaly = '–';
      if (ev.groups.length > 0) {
        anomaly = 'ja';
      } else if (ev.nf3.ok === true) {
        anomaly = 'nein';
      }
      body.appendChild(dom.el('tr', { class: table.key === state.table ? 'selected' : null }, [
        dom.el('td', null, name),
        dom.el('td', null, ev.keys.length ? ev.keys.map((k) => '(' + colNames(table, k.columns) + ')').join(' ') : 'keiner'),
        dom.el('td', null, statusBadge(ev.nf1.ok)),
        dom.el('td', null, statusBadge(ev.nf2.ok)),
        dom.el('td', null, statusBadge(ev.nf3.ok)),
        dom.el('td', { class: 'num' }, String(count)),
        dom.el('td', null, anomaly)
      ]));
    }
    const head = dom.el('tr', null, ['Tabelle', 'Schlüsselkandidaten', '1. NF', '2. NF', '3. NF', 'Abhängigkeiten', 'Anomalien möglich?']
      .map((h) => dom.el('th', { scope: 'col' }, h)));
    return dom.el('div', { class: 'table-wrap', tabindex: '0', role: 'region', 'aria-label': 'Übersicht der Tabellen' },
      dom.el('table', { class: 'data-table red-overview' }, [dom.el('thead', null, head), body]));
  }

  // ---------------------------------------------------------------------------
  // Abschnitte der ausgewählten Tabelle
  // ---------------------------------------------------------------------------

  /** Spalten und Schlüssel. */
  function renderSchema(table, ev) {
    const pk = new Set(table.primaryKey || []);
    const unique = new Set(table.uniques.filter((u) => u.length === 1).map((u) => u[0]));
    const fk = new Set(table.foreignKeys.flatMap((f) => f.columns));
    const items = table.columns.map((c, i) => dom.el('li', null, [
      dom.el('span', { class: 'col-name' }, clean(c.name)), ' ',
      dom.el('span', { class: 'col-type' }, clean(c.type ? c.type.display : '')),
      pk.has(i) ? dom.el('span', { class: 'badge badge-pk' }, 'PK') : null,
      unique.has(i) ? dom.el('span', { class: 'badge' }, 'UNIQUE') : null,
      fk.has(i) ? dom.el('span', { class: 'badge badge-fk' }, 'FK') : null
    ]));
    const kindText = { pk: 'Primärschlüssel', unique: 'UNIQUE', derived: 'aus den Abhängigkeiten' };
    const out = [dom.el('ul', { class: 'schema-list' }, items)];
    if (ev.keys.length) {
      out.push(dom.el('p', null, [dom.el('strong', null, 'Schlüsselkandidaten: '),
        ev.keys.map((k) => '(' + colNames(table, k.columns) + ') – ' + kindText[k.kind]).join('; ') + '.']));
      out.push(dom.el('p', null, [dom.el('strong', null, 'Schlüsselattribute: '), colNames(table, ev.prime) + '.']));
    } else {
      out.push(ns.ui.warningBox('Die Tabelle hat keinen Primärschlüssel, und die eingetragenen Abhängigkeiten ergeben keinen Schlüssel. ' +
        'Die Datensätze sind damit nicht eindeutig; 2. und 3. NF lassen sich nicht beurteilen.'));
    }
    for (const k of ev.nonMinimal) {
      out.push(ns.ui.warningBox('Der ' + (k.kind === 'pk' ? 'Primärschlüssel' : 'UNIQUE-Schlüssel') + ' (' + colNames(table, k.columns) +
        ') ist nach den eingetragenen Abhängigkeiten nicht minimal: Ein Teil davon bestimmt bereits alle Spalten.'));
    }
    return out;
  }

  /** 1. NF: Markierung mehrwertiger Spalten und Hinweise. */
  function renderFirstNf(table) {
    const marked = state.nonAtomic.get(table.key) || new Set();
    const boxes = table.columns.map((c, i) => {
      const id = 'red-atomic-' + i;
      const input = dom.el('input', { type: 'checkbox', id });
      input.checked = marked.has(c.key);
      input.addEventListener('change', () => {
        const set = state.nonAtomic.get(table.key) || new Set();
        if (input.checked) {
          set.add(c.key);
        } else {
          set.delete(c.key);
        }
        state.nonAtomic.set(table.key, set);
        render();
        focusById(id);
      });
      return dom.el('label', { class: 'check-item', for: id }, [input, ' ', clean(c.name)]);
    });
    const out = [
      dom.el('h4', null, '1. Normalform – atomare Werte'),
      dom.el('p', null, 'In der 1. NF enthält jedes Feld genau einen Wert: keine Listen wie „Fußball, Schach“ in einer Spalte und keine Wiederholungsgruppen ' +
        'wie Telefon1, Telefon2, Telefon3. Markieren Sie die Spalten, auf die das zutrifft:'),
      dom.el('fieldset', { class: 'check-grid' }, [dom.el('legend', null, 'Spalte enthält mehrere Werte bzw. gehört zu einer Wiederholungsgruppe')].concat(boxes))
    ];
    for (const h of N.firstNfHints(table)) {
      if (h.kind === 'list') {
        out.push(dom.el('p', { class: 'hint red-hint' }, 'Auffällig: In „' + colNames(table, h.columns) + '“ stehen in mehreren Zeilen Listen, z. B. ' +
          h.examples.map((e) => '„' + clean(e) + '“').join(', ') + '.'));
      } else {
        out.push(dom.el('p', { class: 'hint red-hint' }, 'Auffällig: ' + h.columns.map((c) => '„' + clean(table.columns[c].name) + '“').join(', ') +
          ' unterscheiden sich nur durch eine Nummer – das sieht nach einer Wiederholungsgruppe aus.'));
      }
    }
    return out;
  }

  /** Neue Abhängigkeit prüfen und hinzufügen. */
  function addFd(table) {
    const left = Array.from(state.draft.left).filter((n) => table.colIndex.has(n));
    const right = Array.from(state.draft.right).filter((n) => table.colIndex.has(n));
    const list = state.fds.get(table.key) || [];
    let error = '';
    if (left.length === 0) {
      error = 'Wählen Sie links mindestens eine Spalte, die bestimmt.';
    } else if (left.length > N.LIMITS.maxLeft) {
      error = 'Links sind höchstens ' + N.LIMITS.maxLeft + ' Spalten möglich.';
    } else if (right.length === 0) {
      error = 'Wählen Sie rechts mindestens eine abhängige Spalte.';
    } else if (right.some((n) => left.includes(n))) {
      error = 'Eine Spalte kann nicht zugleich links und rechts stehen (das wäre trivial: Jede Spalte bestimmt sich selbst).';
    } else if (list.length >= N.LIMITS.maxFds) {
      error = 'Je Tabelle sind höchstens ' + N.LIMITS.maxFds + ' Abhängigkeiten möglich.';
    } else {
      const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
      if (list.some((fd) => same(fd.left, left) && same(fd.right, right))) {
        error = 'Diese Abhängigkeit ist schon eingetragen.';
      }
    }
    state.fdError = error;
    if (!error) {
      list.push({ left, right });
      state.fds.set(table.key, list);
      state.draft = { left: new Set(), right: new Set() };
    }
    render();
    focusById('red-add');
  }

  /** Abhängigkeiten: Editor und Liste. */
  function renderFds(table) {
    const side = (which, legend) => {
      const boxes = table.columns.map((c, i) => {
        const id = 'red-' + which + '-' + i;
        const input = dom.el('input', { type: 'checkbox', id });
        input.checked = state.draft[which].has(c.key);
        input.addEventListener('change', () => {
          if (input.checked) {
            state.draft[which].add(c.key);
          } else {
            state.draft[which].delete(c.key);
          }
        });
        return dom.el('label', { class: 'check-item', for: id }, [input, ' ', clean(c.name)]);
      });
      return dom.el('fieldset', { class: 'check-grid fd-side' }, [dom.el('legend', null, legend)].concat(boxes));
    };
    const add = dom.el('button', { type: 'button', class: 'btn btn-primary', id: 'red-add' }, 'Abhängigkeit hinzufügen');
    add.addEventListener('click', () => addFd(table));
    const out = [
      dom.el('h4', null, 'Funktionale Abhängigkeiten'),
      dom.el('p', null, 'X → Y bedeutet: Zu jedem Wert von X gehört genau ein Wert von Y, z. B. PLZ → Ort. Tragen Sie die Abhängigkeiten ein, die fachlich gelten – ' +
        'nicht nur zufällig in den vorhandenen Daten. Abhängigkeiten vom Primärschlüssel müssen Sie nicht eintragen.'),
      dom.el('div', { class: 'fd-editor' }, [side('left', 'bestimmt (links, höchstens 3)'), dom.el('span', { class: 'fd-arrow', 'aria-hidden': 'true' }, '→'), side('right', 'hängt ab (rechts)')]),
      dom.el('div', { class: 'button-row' }, [add]),
      dom.el('p', { class: 'status status-error fd-error', id: 'red-fd-error', role: 'alert', hidden: !state.fdError }, state.fdError)
    ];
    const fds = fdsOf(table);
    if (fds.length === 0) {
      out.push(dom.el('p', { class: 'hint' }, 'Noch keine Abhängigkeiten eingetragen.'));
      return out;
    }
    const list = dom.el('ul', { class: 'fd-list' });
    fds.forEach((fd, k) => {
      const check = N.checkFd(table, fd);
      const del = dom.el('button', { type: 'button', class: 'btn btn-small', id: 'red-del-' + k, 'aria-label': 'Abhängigkeit ' + fdText(table, fd) + ' entfernen' }, 'Entfernen');
      del.addEventListener('click', () => {
        const stored = state.fds.get(table.key) || [];
        stored.splice(k, 1);
        state.fds.set(table.key, stored);
        state.fdError = '';
        render();
        focusById(stored.length ? 'red-del-' + Math.min(k, stored.length - 1) : 'red-add');
      });
      const parts = [dom.el('code', { class: 'fd-text' }, fdText(table, fd)), ' '];
      if (check.holds) {
        parts.push(dom.el('span', { class: 'fd-ok' }, 'gilt in den Daten' + (check.repeated ? ' (' + dom.plural(check.repeated, 'Wert kommt', 'Werte kommen') + ' mehrfach vor)' : ' (jeder Wert kommt nur einmal vor)')));
      } else {
        parts.push(dom.el('span', { class: 'fd-bad' }, 'widerspricht den Daten (' + dom.plural(check.conflictCount, 'Wert', 'Werte') + ')'));
      }
      parts.push(' ', del);
      const li = dom.el('li', null, parts);
      if (!check.holds) {
        const rows = check.conflicts.map((cf) => dom.el('li', null, colNames(table, fd.left) + ' = ' + cf.left.map((v) => '„' + clean(ns.sql.values.formatValue(v, null)) + '“').join(', ') + ' kommt vor mit ' +
          cf.variants.map((v) => v.right.map((x) => (x === null ? 'NULL' : '„' + clean(ns.sql.values.formatValue(x, null)) + '“')).join(', ') + ' (' + dom.plural(v.rows.length, 'Zeile', 'Zeilen') + ')').join(' und ') + '.'));
        li.appendChild(dom.el('details', { class: 'fd-conflicts' }, [
          dom.el('summary', null, 'Widersprüche anzeigen'),
          dom.el('ul', null, rows),
          dom.el('p', { class: 'hint' }, 'Gilt die Abhängigkeit fachlich, sind die Daten bereits inkonsistent – so sieht eine eingetretene Änderungsanomalie aus. ' +
            'Die Abhängigkeit wird trotzdem bewertet.')
        ]));
      }
      list.appendChild(li);
    });
    out.push(list);
    return out;
  }

  /** Bewertung der Normalformen mit Begründung. */
  function renderEvaluation(table, ev) {
    const key = (v) => '(' + colNames(table, v.key) + ')';
    const reasons = {
      nf1: {
        atomic: 'Keine Spalte ist als mehrwertig markiert.',
        nonAtomic: 'Mehrere Werte bzw. Wiederholungsgruppe: ' + colNames(table, nonAtomicOf(table)) + '.'
      },
      nf2: {
        simpleKey: 'Jeder Schlüsselkandidat besteht aus einer einzigen Spalte – eine Teilabhängigkeit ist nicht möglich.',
        allPrime: 'Alle Spalten gehören zu einem Schlüsselkandidaten.',
        fds: 'Kein Nichtschlüsselattribut hängt nur von einem Teil eines Schlüssels ab.',
        noFds: 'Noch offen: Der Schlüssel ist zusammengesetzt, es sind aber keine Abhängigkeiten eingetragen.',
        noKey: 'Nicht beurteilbar: Die Tabelle hat keinen Schlüssel.',
        nf1: 'Nicht erfüllt, weil schon die 1. NF verletzt ist.',
        partial: 'Teilabhängigkeiten – ein Nichtschlüsselattribut hängt nur von einem Teil des Schlüssels ab:'
      },
      nf3: {
        allPrime: 'Alle Spalten gehören zu einem Schlüsselkandidaten.',
        fds: 'Kein Nichtschlüsselattribut hängt von Spalten ab, die keinen Schlüssel bilden.',
        noFds: 'Noch offen: Es sind keine Abhängigkeiten eingetragen.',
        noKey: 'Nicht beurteilbar: Die Tabelle hat keinen Schlüssel.',
        nf2: 'Nicht erfüllt, weil die 2. NF nicht erfüllt ist.',
        transitive: 'Transitive Abhängigkeiten – ein Nichtschlüsselattribut hängt über eine andere Spalte vom Schlüssel ab:'
      }
    };
    const partial = ev.violations.filter((v) => v.kind === 'partial').map((v) => dom.el('li', null,
      colNames(table, v.left) + ' → ' + clean(table.columns[v.column].name) + ': ' + colNames(table, v.left) + ' ist nur ein Teil des Schlüssels ' + key(v) +
      (v.derived ? ' (folgt aus den eingetragenen Abhängigkeiten)' : '') + '.'));
    const transitive = ev.violations.filter((v) => v.kind === 'transitive').map((v) => dom.el('li', null,
      colNames(table, v.left) + ' → ' + clean(table.columns[v.column].name) + ': ' + colNames(table, v.left) + ' ist kein Schlüssel; also ' + key(v) + ' → ' +
      colNames(table, v.left) + ' → ' + clean(table.columns[v.column].name) + '.'));
    const row = (title, nf, extra) => dom.el('div', { class: 'nf-row' }, [
      dom.el('div', { class: 'nf-head' }, [dom.el('strong', null, title), ' ', statusBadge(nf.ok)]),
      dom.el('p', null, reasons[extra.key][nf.reason] || ''),
      extra.list && extra.list.length ? dom.el('ul', null, extra.list) : null
    ]);
    const levelText = ev.level === 0 ? 'keine (schon die 1. NF ist verletzt)' : ev.level + '. NF' +
      ((ev.level === 1 && ev.nf2.ok === null) || (ev.level === 2 && ev.nf3.ok === null) ? ' (weitere noch offen)' : '');
    return [
      dom.el('h4', null, 'Bewertung'),
      row('1. Normalform', ev.nf1, { key: 'nf1' }),
      row('2. Normalform', ev.nf2, { key: 'nf2', list: partial }),
      row('3. Normalform', ev.nf3, { key: 'nf3', list: transitive }),
      dom.el('p', { class: 'nf-level' }, [dom.el('strong', null, 'Höchste erfüllte Normalform: '), levelText]),
      dom.el('p', { class: 'hint' }, 'Die Bewertung berücksichtigt nur die eingetragenen Abhängigkeiten und Markierungen. Fehlt eine Abhängigkeit, kann ein Verstoß unentdeckt bleiben.')
    ];
  }

  /**
   * Kleine Ergebnistabelle für Vorher/Nachher.
   *
   * @param {Object} result - {columns, types, rows, total}.
   * @param {Object|null} compare - Vergleichstabelle (geänderte Zellen werden hervorgehoben).
   * @param {string} label - Zugängliche Bezeichnung.
   * @param {Array<number>} [highlight] - Spalten, deren Zellen als verlorene Information hervorgehoben werden.
   * @returns {HTMLElement} Tabelle.
   */
  function exampleTable(result, compare, label, highlight) {
    const head = dom.el('tr', null, result.columns.map((c) => dom.el('th', { scope: 'col' }, clean(c))));
    const body = dom.el('tbody');
    result.rows.forEach((row, r) => {
      body.appendChild(dom.el('tr', null, row.map((v, c) => {
        const changed = compare && compare.rows[r] && ns.sql.values.valueKey(compare.rows[r][c]) !== ns.sql.values.valueKey(v);
        const lost = highlight && highlight.includes(c);
        const cls = [v === null ? 'null' : null, typeof v === 'number' ? 'num' : null, changed ? 'cell-changed' : null, lost ? 'cell-lost' : null].filter(Boolean).join(' ');
        return dom.el('td', { class: cls || null }, v === null ? 'NULL' : clean(ns.sql.values.formatValue(v, result.types[c] || null)));
      })));
    });
    const parts = [dom.el('div', { class: 'table-wrap', tabindex: '0', role: 'region', 'aria-label': label },
      dom.el('table', { class: 'data-table' }, [dom.el('thead', null, head), body]))];
    if (result.rows.length === 0) {
      parts.push(dom.el('p', { class: 'hint' }, 'Keine Zeilen.'));
    } else if (result.total > result.rows.length) {
      parts.push(dom.el('p', { class: 'hint' }, 'Angezeigt werden die ersten ' + result.rows.length + ' von ' + result.total + ' Zeilen.'));
    }
    return dom.el('div', null, parts);
  }

  /** Übernimmt einen Befehl auf Seite 3 (ohne ihn auszuführen). */
  function takeToQuery(sql) {
    dom.byId('sql-input').value = sql;
    ns.app.showPage('query', { scrollTop: true });
    dom.byId('sql-input').focus();
  }

  /** Karte einer Anomalie. */
  function anomalyCard(id, title, general, example, showBefore) {
    const card = dom.el('section', { class: 'card anomaly-card', 'aria-labelledby': id + '-title' }, [
      dom.el('h5', { id: id + '-title' }, title),
      dom.el('p', { class: 'anomaly-general' }, general),
      dom.el('p', null, clean(example.text))
    ]);
    if (example.sql && example.deleted) {
      // Löschanomalie: gelöschte Datensätze vollständig, dann der Nachweis, dass die Information fehlt.
      card.appendChild(dom.el('pre', { class: 'sql-example' }, clean(example.sql)));
      card.appendChild(dom.el('p', { class: 'anomaly-label' }, 'Diese Datensätze werden gelöscht:'));
      card.appendChild(exampleTable(example.deleted, null, title + ': gelöschte Datensätze', example.lostColumns));
      card.appendChild(dom.el('p', { class: 'hint' }, 'Hervorgehoben: die Information, die mit den Datensätzen verloren geht.'));
      card.appendChild(dom.el('p', { class: 'anomaly-label' }, clean(example.checkLabel) + ' – vorher:'));
      card.appendChild(exampleTable(example.before, null, title + ': vorher'));
      card.appendChild(dom.el('p', { class: 'anomaly-label' }, 'nachher:'));
      if (example.error) {
        card.appendChild(ns.ui.errorBox(example.error, example.sql, { title: 'Der Befehl wird abgelehnt:' }));
      } else if (example.after && example.after.rows.length === 0) {
        card.appendChild(dom.el('p', { class: 'hint anomaly-lost' }, 'Keine Zeilen – die Information ist verloren.'));
      } else if (example.after) {
        card.appendChild(exampleTable(example.after, null, title + ': nachher'));
      }
      const take = dom.el('button', { type: 'button', class: 'btn btn-small', id: id + '-take' }, 'Auf Seite 3 übernehmen');
      take.addEventListener('click', () => takeToQuery(example.sql + '\n' + (example.check || '')));
      card.appendChild(dom.el('div', { class: 'button-row' }, [take]));
    } else if (example.sql) {
      card.appendChild(dom.el('pre', { class: 'sql-example' }, clean(example.sql)));
      if (example.before && showBefore) {
        card.appendChild(dom.el('p', { class: 'anomaly-label' }, 'Vorher:'));
        card.appendChild(exampleTable(example.before, null, title + ': vorher'));
      }
      card.appendChild(dom.el('p', { class: 'anomaly-label' }, 'Nachher:'));
      if (example.error) {
        card.appendChild(ns.ui.errorBox(example.error, example.sql, { title: 'Der Befehl wird abgelehnt:' }));
      } else if (example.after) {
        card.appendChild(exampleTable(example.after, example.before && example.before.rows.length === example.after.rows.length ? example.before : null, title + ': nachher'));
      }
      const take = dom.el('button', { type: 'button', class: 'btn btn-small', id: id + '-take' }, 'Auf Seite 3 übernehmen');
      take.addEventListener('click', () => takeToQuery(example.sql + '\n' + (example.check || '')));
      card.appendChild(dom.el('div', { class: 'button-row' }, [take]));
    }
    return card;
  }

  /** Anomalien zum gewählten Verstoß. */
  function renderAnomalies(db, table, ev) {
    const out = [dom.el('h4', null, 'Anomalien')];
    if (ev.groups.length === 0) {
      if (ev.nf3.ok === true) {
        out.push(dom.el('p', null, 'Keine Anomalien durch die eingetragenen Abhängigkeiten: Die Tabelle ist in der 3. Normalform.'));
      } else {
        out.push(dom.el('p', null, 'Tragen Sie funktionale Abhängigkeiten ein. Verstößt eine davon gegen die 2. oder 3. NF, erscheinen hier Beispiele für ' +
          'Einfüge-, Änderungs- und Löschanomalie.'));
      }
      if (ev.nf1.ok === false) {
        out.push(dom.el('p', { class: 'hint' }, 'Mehrwertige Spalten erschweren außerdem Abfragen und Änderungen: Einzelne Werte einer Liste lassen sich nicht gezielt suchen, ändern oder löschen.'));
      }
      return out;
    }
    let selected = state.violation.get(table.key) || 0;
    if (selected >= ev.groups.length) {
      selected = 0;
    }
    const select = dom.el('select', { id: 'red-violation', class: 'select' }, ev.groups.map((g, i) => {
      const o = dom.el('option', { value: String(i) }, colNames(table, g.left) + ' → ' + colNames(table, g.columns) + ' (' + KIND_TEXT[g.kind] + ')');
      o.selected = i === selected;
      return o;
    }));
    select.addEventListener('change', () => {
      state.violation.set(table.key, Number(select.value));
      render();
      focusById('red-violation');
    });
    out.push(dom.el('p', null, [dom.el('label', { for: 'red-violation' }, 'Verstoß: '), select]));
    const group = ev.groups[selected];
    let examples;
    try {
      examples = N.anomalies(db, table, group);
    } catch (error) {
      out.push(ns.ui.errorBox(error, null, { title: 'Die Beispiele konnten nicht erzeugt werden.' }));
      return out;
    }
    out.push(dom.el('p', { class: 'hint' }, 'Die Beispiele laufen auf einer Kopie der Datenbank – die Daten bleiben unverändert. Auf Seite 3 ändert der übernommene Befehl die Datenbank; ' +
      '„Datenbank zurücksetzen“ stellt sie wieder her.'));
    out.push(dom.el('div', { class: 'anomaly-cards' }, [
      anomalyCard('red-insert', 'Einfügeanomalie', 'Eine Information lässt sich nicht speichern, ohne gleichzeitig andere, noch nicht vorhandene Angaben zu machen.', examples.insert, false),
      anomalyCard('red-update', 'Änderungsanomalie', 'Dieselbe Information steht mehrfach in der Tabelle. Wird sie nicht überall geändert, widersprechen sich die Daten.', examples.update, true),
      anomalyCard('red-delete', 'Löschanomalie', 'Beim Löschen eines Datensatzes geht ungewollt eine andere Information verloren.', examples.delete, true)
    ]));
    return out;
  }

  // ---------------------------------------------------------------------------
  // Seite
  // ---------------------------------------------------------------------------

  /** Wählt eine Tabelle aus. */
  function selectTable(key) {
    if (state.table !== key) {
      state.table = key;
      state.draft = { left: new Set(), right: new Set() };
      state.fdError = '';
    }
    render();
  }

  /** Zeichnet die Seite neu. */
  function render() {
    const db = ns.state.db();
    if (!db) {
      ui.notice.textContent = 'Es ist noch keine Datenbank geladen. Wählen Sie auf Seite 1 eine Beispieldatenbank – zum Üben eignet sich „Kursbuchung (nicht normalisiert)“.';
      ui.notice.hidden = false;
      ui.body.hidden = true;
      return;
    }
    ui.body.hidden = false;
    if (!ui.keepNotice) {
      ui.notice.hidden = true;
    }
    const tables = db.tableList();
    if (!tables.some((t) => t.key === state.table)) {
      state.table = tables.length ? tables[0].key : null;
    }
    ui.dbInfo.textContent = 'Datenbank: „' + clean(ns.state.info().name) + '“ – ' + dom.plural(tables.length, 'Tabelle', 'Tabellen') + '.';
    dom.clear(ui.overview).appendChild(renderOverview(db));
    dom.clear(ui.select);
    for (const t of tables) {
      const o = dom.el('option', { value: t.key }, clean(t.name));
      o.selected = t.key === state.table;
      ui.select.appendChild(o);
    }
    const detail = dom.clear(ui.detail);
    const table = tables.find((t) => t.key === state.table);
    if (!table) {
      return;
    }
    const ev = evaluate(table);
    const section = (cls, children) => dom.el('section', { class: 'card red-section ' + cls }, children);
    detail.appendChild(section('red-schema', [dom.el('h3', null, 'Tabelle „' + clean(table.name) + '“')].concat(renderSchema(table, ev))));
    detail.appendChild(section('red-nf1', renderFirstNf(table)));
    detail.appendChild(section('red-fds', renderFds(table)));
    detail.appendChild(section('red-eval', renderEvaluation(table, ev)));
    detail.appendChild(section('red-anomalies', renderAnomalies(db, table, ev)));
  }

  ns.pages.redundancy = {
    init() {
      ui.notice = dom.byId('red-notice');
      ui.body = dom.byId('red-body');
      ui.dbInfo = dom.byId('red-db-info');
      ui.overview = dom.byId('red-overview');
      ui.select = dom.byId('red-table');
      ui.detail = dom.byId('red-detail');
      ui.select.addEventListener('change', () => selectTable(ui.select.value));
    },
    render() {
      render();
      ui.keepNotice = false;
    },
    onDbChange(event) {
      if (event.type === 'load' || event.type === 'reset') {
        const had = state.fds.size > 0 || state.nonAtomic.size > 0;
        state.fds = new Map();
        state.nonAtomic = new Map();
        state.violation = new Map();
        state.table = null;
        state.draft = { left: new Set(), right: new Set() };
        state.fdError = '';
        if (had) {
          ui.notice.textContent = event.type === 'reset'
            ? 'Die Datenbank wurde zurückgesetzt. Die eingetragenen Abhängigkeiten und Markierungen wurden entfernt.'
            : 'Es wurde eine andere Datenbank geladen. Die eingetragenen Abhängigkeiten und Markierungen wurden entfernt.';
          ui.notice.hidden = false;
          ui.keepNotice = true;
        }
      }
    }
  };

  /** Für Tests: Zustand der Seite (nur lesend verwenden). */
  ns.pages.redundancy.state = state;
})(window.SQLSIM = window.SQLSIM || {});
