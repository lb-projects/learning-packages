/**
 * @file pages/steps.js
 * @description Seite 4 „Schritt für Schritt“: zeigt, in welcher Reihenfolge eine
 *              SELECT-Abfrage ausgewertet wird und wie sich die Zwischentabelle verändert.
 *
 * Ablauf:
 *   - Eingabe einer SELECT-Abfrage (eigenes Eingabefeld; „Befehl von Seite 3 übernehmen“).
 *   - sql.traceQuery wertet die Abfrage mit der echten Ausführung aus und liefert die
 *     Zwischenstände (FROM/JOIN → WHERE → GROUP BY → HAVING → SELECT → DISTINCT →
 *     ORDER BY → LIMIT bzw. Mengenoperationen). Der letzte Schritt ist das Ergebnis von Seite 3.
 *   - Abspieler: Liste der Schritte, Anfang/Zurück/Weiter/Ende, Pfeiltasten; die Klausel des
 *     aktuellen Schritts ist im SQL-Text markiert.
 *   - Ansichten: Filter (WHERE, HAVING) mit Wert der Bedingung je Zeile; Verknüpfungen als
 *     farbige Zuordnung oder als Kreuzprodukt-Raster (umschaltbar); Gruppen mit Rechenweg
 *     der Aggregatfunktionen; DISTINCT, ORDER BY und LIMIT mit Kennzeichnung der Zeilen.
 *   - Die Datenbank wird nicht verändert.
 *
 * Abhängigkeiten:
 *   dom-utils.js, text-utils.js, state.js, sql/executor.js, pages/common.js
 *
 * Sicherheit:
 *   Alle Inhalte (Werte, Namen, SQL-Text) werden über dom.el als Text eingefügt und vorher
 *   von unsichtbaren Steuerzeichen bereinigt.
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const text = ns.text;
  const ui = {};

  /** Höchstlänge der Eingabe (wie Seite 3). */
  const MAX_INPUT = 10000;

  /** Anzahl der Farben für Zuordnungen und Gruppen (Klassen c0 … c7). */
  const COLORS = 8;

  /** Ab dieser Länge wird ein Zellinhalt gekürzt angezeigt (voller Text als Tooltip). */
  const LONG_TEXT = 60;

  /** Seitenzustand (bleibt beim Seitenwechsel erhalten). */
  const state = {
    /** Ergebnis von traceQuery (mit zusätzlichem Schritt „Ergebnis“) oder null. */
    trace: null,
    /** Aktueller Schritt (Index). */
    index: 0,
    /** Darstellung von Verknüpfungen: 'colors' oder 'grid'. */
    joinView: 'colors',
    /** Herausgefallene Zeilen ausblenden. */
    hideRemoved: false,
    /** Werte der Teilbedingungen (AND) anzeigen. */
    showParts: true
  };

  // ---------------------------------------------------------------------------
  // Texte
  // ---------------------------------------------------------------------------

  const JOIN_WORDS = { inner: 'JOIN', left: 'LEFT JOIN', right: 'RIGHT JOIN', cross: 'CROSS JOIN' };
  const OP_TITLES = {
    UNION: 'Ergebnisse vereinigen', INTERSECT: 'Schnittmenge bilden', EXCEPT: 'Differenz bilden'
  };

  /** @returns {string} Anzahl mit "Zeile"/"Zeilen". */
  function rowsText(n) {
    return dom.plural(n, 'Zeile', 'Zeilen');
  }

  /** @returns {string} Anzeigetext eines Wahrheitswerts. */
  function truthText(t) {
    if (t === true) {
      return 'wahr';
    }
    if (t === false) {
      return 'falsch';
    }
    return t === null ? 'unbekannt' : '–';
  }

  /** @returns {string} CSS-Klasse eines Wahrheitswerts. */
  function truthClass(t) {
    if (t === true) {
      return 'truth truth-yes';
    }
    if (t === false) {
      return 'truth truth-no';
    }
    return t === null ? 'truth truth-null' : 'truth';
  }

  /** @returns {string} Wert als Anzeigetext (bereinigt). */
  function valueText(value, type) {
    return value === null ? 'NULL' : text.cleanCellText(ns.sql.values.formatValue(value, type || null));
  }

  /** @returns {string} Namen der Quellen einer Tabelle, z. B. "a, k". */
  function sourceNames(table) {
    return table.sources.map((s) => text.cleanCellText(s.label)).join(', ');
  }

  /**
   * Kurzbezeichnung und Zählangabe eines Schritts für die Schrittliste.
   *
   * @param {Object} step - Schritt.
   * @param {Array<Object>} steps - Alle Schritte (für HAVING: Gruppen des vorigen Schritts).
   * @returns {{label:string, count:string, title:string}} Texte.
   */
  function describe(step, steps) {
    switch (step.kind) {
      case 'source': {
        const name = text.cleanCellText(step.name);
        const alias = step.label !== step.name ? ' ' + text.cleanCellText(step.label) : '';
        const what = { cte: 'WITH-Abfrage', view: 'Sicht', subquery: 'Unterabfrage' }[step.derivedKind] || 'Tabelle';
        return {
          label: what + ' ' + name + alias,
          count: rowsText(step.table.total),
          title: 'FROM – ' + what + ' „' + name + '“' + (alias ? ' (Alias' + alias + ')' : '') + ' lesen'
        };
      }
      case 'join': {
        const word = step.implicit ? 'Komma' : JOIN_WORDS[step.joinKind];
        return {
          label: word + ' ' + sourceNames(step.right),
          count: dom.formatCount(step.left.total) + ' × ' + dom.formatCount(step.right.total) + ' → ' + rowsText(step.table.total),
          title: (step.implicit ? 'FROM …, … – Kreuzprodukt' : word + ' – Tabellen verknüpfen')
        };
      }
      case 'where':
        return { label: 'WHERE', count: dom.formatCount(step.table.total) + ' → ' + rowsText(step.kept), title: 'WHERE – Zeilen filtern' };
      case 'group':
        return {
          label: step.implicit ? 'Aggregat (eine Gruppe)' : 'GROUP BY',
          count: rowsText(step.table.total) + ' → ' + dom.plural(step.total, 'Gruppe', 'Gruppen'),
          title: step.implicit ? 'Aggregatfunktionen ohne GROUP BY – alle Zeilen bilden eine Gruppe' : 'GROUP BY – Gruppen bilden'
        };
      case 'having':
        return {
          label: 'HAVING',
          count: dom.formatCount(step.total) + ' → ' + (step.grouped ? dom.plural(step.kept, 'Gruppe', 'Gruppen') : rowsText(step.kept)),
          title: 'HAVING – ' + (step.grouped ? 'Gruppen' : 'Zeilen') + ' filtern'
        };
      case 'select':
        return {
          label: 'SELECT',
          count: rowsText(step.table.total) + ', ' + dom.plural(step.table.columns.length, 'Spalte', 'Spalten'),
          title: 'SELECT – Spalten auswählen und berechnen'
        };
      case 'distinct':
        return { label: 'DISTINCT', count: dom.formatCount(step.table.total) + ' → ' + rowsText(step.kept), title: 'DISTINCT – doppelte Zeilen entfernen' };
      case 'order':
        return { label: 'ORDER BY', count: rowsText(step.table.total), title: 'ORDER BY – sortieren' };
      case 'limit': {
        const kept = Math.max(0, Math.min(step.count, step.table.total - step.offset));
        return { label: 'LIMIT', count: dom.formatCount(step.table.total) + ' → ' + rowsText(kept), title: 'LIMIT – Anzahl der Zeilen begrenzen' };
      }
      case 'part':
        return {
          label: step.which === 'left' ? 'Erste Abfrage' : 'Zweite Abfrage',
          count: rowsText(step.table.total),
          title: (step.which === 'left' ? 'Erste' : 'Zweite') + ' Abfrage für sich auswerten'
        };
      case 'compound': {
        const word = step.op + (step.all ? ' ALL' : '');
        return {
          label: word,
          count: dom.formatCount(step.leftCount) + ' + ' + dom.formatCount(step.rightCount) + ' → ' + rowsText(step.table.total),
          title: word + ' – ' + OP_TITLES[step.op]
        };
      }
      case 'result':
        return { label: 'Ergebnis', count: rowsText(step.table.total), title: 'Ergebnis' };
      default:
        return { label: step.kind, count: '', title: step.kind };
    }
  }

  // ---------------------------------------------------------------------------
  // Tabellen
  // ---------------------------------------------------------------------------

  /** @returns {HTMLElement} Zelle mit einem SQL-Wert (NULL hervorgehoben, Zahlen rechtsbündig). */
  function valueCell(value, type, extraClass) {
    if (value === null) {
      return dom.el('td', { class: 'null' + (extraClass ? ' ' + extraClass : '') }, 'NULL');
    }
    const shown = valueText(value, type);
    const cls = [typeof value === 'number' ? 'num' : null, shown.length > LONG_TEXT ? 'long' : null, extraClass || null].filter(Boolean).join(' ');
    return dom.el('td', { class: cls || null, title: shown.length > LONG_TEXT ? shown : null },
      shown.length > LONG_TEXT ? shown.slice(0, LONG_TEXT - 1) + '…' : shown);
  }

  /** @returns {HTMLElement} Markierung "L3", "R2" oder "G1" (Farbe nur zusätzlich zur Nummer). */
  function badge(prefix, index, colored) {
    return dom.el('span', { class: 'row-badge' + (colored ? ' c' + (index % COLORS) : '') }, prefix + (index + 1));
  }

  /**
   * Erzeugt eine Tabelle für einen Schritt.
   *
   * @param {Object} spec - Beschreibung.
   * @param {Object} spec.table - Tabelle aus dem Mitschreiber ({columns, types, rows, total, sources?}).
   * @param {string} spec.label - Zugängliche Bezeichnung.
   * @param {Array<string>} [spec.pre] - Zusätzliche Spalten vor den Daten (Überschriften).
   * @param {Array<number>} [spec.order] - Reihenfolge der Zeilen (Indizes), Standard: wie gespeichert.
   * @param {function(number): Object} [spec.row] - Je Zeilenindex {pre:[Text, Knoten oder td], cls, nullCls, hidden}.
   * @param {string} [spec.scroll] - Scrollklasse, Standard "scroll-10".
   * @returns {HTMLElement} Tabelle (mit Hinweis bei gekürzter Anzeige).
   */
  function stepTable(spec) {
    const t = spec.table;
    const pre = spec.pre || [];
    const grouped = t.sources && t.sources.length > 0;
    const thead = dom.el('thead');
    if (grouped) {
      const top = dom.el('tr');
      pre.forEach((h) => top.appendChild(dom.el('th', { scope: 'col', rowspan: '2', class: 'extra-col' }, h)));
      t.sources.forEach((s) => top.appendChild(dom.el('th', { scope: 'colgroup', colspan: String(Math.max(1, s.width)), class: 'source-head' }, text.cleanCellText(s.label))));
      thead.appendChild(top);
      thead.appendChild(dom.el('tr', null, t.columns.map((c) => dom.el('th', { scope: 'col' }, text.cleanCellText(c)))));
    } else {
      thead.appendChild(dom.el('tr', null, pre.map((h) => dom.el('th', { scope: 'col', class: 'extra-col' }, h))
        .concat(t.columns.map((c) => dom.el('th', { scope: 'col' }, text.cleanCellText(c))))));
    }
    const tbody = dom.el('tbody');
    const order = spec.order || t.rows.map((r, i) => i);
    let shown = 0;
    for (const i of order) {
      const info = spec.row ? spec.row(i) : {};
      if (info.hidden) {
        continue;
      }
      shown++;
      const tr = dom.el('tr', { class: info.cls || null });
      (info.pre || []).forEach((n) => tr.appendChild(n instanceof Node && n.tagName === 'TD' ? n : dom.el('td', { class: 'extra-col' }, n)));
      t.rows[i].forEach((v, c) => tr.appendChild(valueCell(v, t.types ? t.types[c] : null, info.nullCls && info.nullCls(c) ? 'null-fill' : null)));
      tbody.appendChild(tr);
    }
    const table = dom.el('table', { class: 'data-table step-table' + (grouped ? ' two-head' : '') }, [thead, tbody]);
    const wrap = dom.el('div', { class: 'table-wrap ' + (spec.scroll || 'scroll-10'), tabindex: '0', role: 'region', 'aria-label': spec.label }, table);
    const parts = [wrap];
    if (t.total > t.rows.length) {
      parts.push(dom.el('p', { class: 'hint' }, 'Angezeigt werden die ersten ' + dom.formatCount(t.rows.length) + ' von ' + dom.formatCount(t.total) + ' Zeilen.'));
    } else if (shown === 0) {
      parts.push(dom.el('p', { class: 'hint' }, t.rows.length === 0 ? 'Keine Zeilen.' : 'Alle Zeilen sind ausgeblendet.'));
    }
    return dom.el('div', { class: 'step-table-block' }, parts);
  }

  /** @returns {HTMLElement} Zelle mit einem Wahrheitswert. */
  function truthCell(t, part) {
    return dom.el('td', { class: truthClass(t) + (part ? ' truth-part' : '') }, truthText(t));
  }

  /** @returns {HTMLElement} Schalter (Kontrollkästchen) für die Anzeige. */
  function toggle(id, label, checked, onChange) {
    const input = dom.el('input', { type: 'checkbox', id });
    input.checked = checked;
    input.addEventListener('change', () => onChange(input.checked));
    return dom.el('label', { class: 'inline-label step-toggle', for: id }, [input, ' ', label]);
  }

  /** @returns {HTMLElement} Schalter „Herausgefallene Zeilen ausblenden“. */
  function hideToggle() {
    return toggle('steps-hide-removed', 'Herausgefallene Zeilen ausblenden', state.hideRemoved, (v) => {
      state.hideRemoved = v;
      renderStep();
      focusById('steps-hide-removed');
    });
  }

  /** Setzt nach dem Neuzeichnen den Fokus wieder auf ein Bedienelement. */
  function focusById(id) {
    const el = document.getElementById(id);
    if (el) {
      el.focus();
    }
  }

  // ---------------------------------------------------------------------------
  // Ansichten der Schritte
  // ---------------------------------------------------------------------------

  /** FROM: Tabelle, Sicht, WITH-Abfrage oder Unterabfrage. */
  function viewSource(step) {
    const what = {
      cte: 'Die WITH-Abfrage „' + text.cleanCellText(step.name) + '“ wird ausgewertet; ihr Ergebnis dient als Tabelle.',
      view: 'Die Sicht „' + text.cleanCellText(step.name) + '“ wird ausgewertet; ihr Ergebnis dient als Tabelle.',
      subquery: 'Die Unterabfrage in FROM wird ausgewertet; ihr Ergebnis dient als Tabelle „' + text.cleanCellText(step.name) + '“.'
    }[step.derivedKind] || 'Alle Datensätze der Tabelle „' + text.cleanCellText(step.name) + '“ werden gelesen.';
    return [
      dom.el('p', { class: 'step-explain' }, what + ' Ergebnis: ' + rowsText(step.table.total) + '.'),
      stepTable({ table: step.table, label: 'Tabelle ' + step.label, pre: ['Nr.'], row: (i) => ({ pre: [badge('', i, false)] }) })
    ];
  }

  /** @returns {Set<number>} Indizes, die in den Paaren auf einer Seite vorkommen (mit Partner). */
  function matchedSet(pairs, side) {
    const set = new Set();
    pairs.forEach((p) => {
      if (p[0] !== -1 && p[1] !== -1) {
        set.add(p[side]);
      }
    });
    return set;
  }

  /** Erklärung einer Verknüpfung. */
  function joinExplain(step) {
    const l = step.left.total;
    const r = step.right.total;
    const combos = dom.formatCount(l) + ' × ' + dom.formatCount(r) + ' = ' + dom.plural(l * r, 'Kombination', 'Kombinationen');
    const result = rowsText(step.table.total);
    let main;
    if (step.joinKind === 'cross') {
      main = 'Jede Zeile links wird mit jeder Zeile rechts kombiniert (kartesisches Produkt): ' + combos + '.' +
        (step.implicit ? ' Eine Bedingung (z. B. WHERE a.id = b.a_id) wirkt erst im nächsten Schritt.' : '');
    } else {
      main = 'Jede Zeile links wird mit jeder Zeile rechts kombiniert (' + combos + '). Übrig bleiben die Paare, für die die ON-Bedingung wahr ist.';
      if (step.joinKind === 'left') {
        main += ' Zeilen links ohne passenden Partner bleiben trotzdem erhalten; ihre Spalten rechts werden mit NULL aufgefüllt.';
      } else if (step.joinKind === 'right') {
        main += ' Zeilen rechts ohne passenden Partner bleiben trotzdem erhalten; ihre Spalten links werden mit NULL aufgefüllt.';
      }
    }
    const out = [dom.el('p', { class: 'step-explain' }, main + ' Ergebnis: ' + result + '.')];
    if (step.whereShortcut) {
      out.push(dom.el('p', { class: 'hint' }, 'Das vollständige Kreuzprodukt wäre zu groß. Gezeigt werden nur die Kombinationen, die die Gleichheitsbedingung aus WHERE erfüllen.'));
    }
    return out;
  }

  /** Ausgangstabellen einer Verknüpfung nebeneinander (L1 … farbig bzw. R1 …). */
  function joinSourceTables(step, colorLeft) {
    const complete = step.table.total <= step.table.rows.length && !step.whereShortcut;
    const withL = matchedSet(step.pairs, 0);
    const withR = matchedSet(step.pairs, 1);
    const side = (table, prefix, colored, matched, title) => dom.el('div', { class: 'join-side' }, [
      dom.el('h4', null, title + ' (' + sourceNames(table) + ')'),
      stepTable({
        table, label: title, pre: ['Nr.'].concat(complete && step.joinKind !== 'cross' ? ['Partner'] : []), scroll: 'scroll-10',
        row: (i) => {
          const lonely = complete && !matched.has(i);
          return {
            pre: [badge(prefix, i, colored)].concat(complete && step.joinKind !== 'cross' ? [lonely ? 'keiner' : 'ja'] : []),
            cls: [colored ? 'tint c' + (i % COLORS) : null, lonely ? 'no-partner' : null].filter(Boolean).join(' ') || null
          };
        }
      })
    ]);
    return dom.el('div', { class: 'join-sides' }, [
      side(step.left, 'L', colorLeft, withL, 'Links'),
      side(step.right, 'R', !colorLeft, withR, 'Rechts')
    ]);
  }

  /** Ergebnis der Verknüpfung mit Herkunft je Zeile. */
  function joinResultTable(step, colorLeft) {
    const leftWidth = step.left.columns.length;
    return [
      dom.el('h4', null, 'Ergebnis der Verknüpfung'),
      stepTable({
        table: step.table, label: 'Ergebnis der Verknüpfung', pre: ['aus links', 'aus rechts'],
        row: (i) => {
          const p = step.pairs[i] || [-1, -1];
          const colorIndex = colorLeft ? p[0] : p[1];
          return {
            pre: [p[0] === -1 ? 'NULL' : badge('L', p[0], colorLeft), p[1] === -1 ? 'NULL' : badge('R', p[1], !colorLeft)],
            cls: colorIndex >= 0 ? 'tint c' + (colorIndex % COLORS) : null,
            nullCls: (c) => (p[0] === -1 && c < leftWidth) || (p[1] === -1 && c >= leftWidth)
          };
        }
      })
    ];
  }

  /** Kreuzprodukt-Raster: Zeilen links × Zeilen rechts mit dem Wert der ON-Bedingung. */
  function joinGrid(step) {
    const g = step.grid;
    const preview = (table, i) => {
      const vals = table.rows[i].slice(0, 2).map((v) => valueText(v, null));
      const s = vals.join(', ');
      return s.length > 24 ? s.slice(0, 23) + '…' : s;
    };
    const head = dom.el('tr', null, [dom.el('th', { scope: 'col', class: 'grid-corner' }, 'links \\ rechts')].concat(
      step.right.rows.map((r, j) => dom.el('th', { scope: 'col', title: preview(step.right, j) }, [badge('R', j, false)]))
    ).concat(step.joinKind === 'left' ? [dom.el('th', { scope: 'col' }, 'ohne Partner')] : []));
    const body = dom.el('tbody');
    g.forEach((row, i) => {
      const tr = dom.el('tr', null, [dom.el('th', { scope: 'row', class: 'grid-row-head' }, [badge('L', i, true), ' ', preview(step.left, i)])]);
      row.forEach((t) => {
        tr.appendChild(dom.el('td', { class: 'grid-cell ' + truthClass(t), title: truthText(t) }, t === true ? '✓' : (t === false ? '✗' : '?')));
      });
      if (step.joinKind === 'left') {
        tr.appendChild(dom.el('td', { class: 'grid-cell' }, row.some((t) => t === true) ? '' : '→ NULL'));
      }
      body.appendChild(tr);
    });
    if (step.joinKind === 'right') {
      const tr = dom.el('tr', null, [dom.el('th', { scope: 'row', class: 'grid-row-head' }, 'ohne Partner')]);
      step.right.rows.forEach((r, j) => tr.appendChild(dom.el('td', { class: 'grid-cell' }, g.some((row) => row[j] === true) ? '' : '↓ NULL')));
      body.appendChild(tr);
    }
    return [
      dom.el('div', { class: 'table-wrap grid-wrap', tabindex: '0', role: 'region', 'aria-label': 'Kreuzprodukt-Raster' },
        dom.el('table', { class: 'data-table join-grid' }, [dom.el('thead', null, head), body])),
      dom.el('p', { class: 'hint grid-legend' }, step.joinKind === 'cross'
        ? '✓ Jede Kombination kommt ins Ergebnis (kein ON).'
        : '✓ Bedingung wahr – die Kombination kommt ins Ergebnis. ✗ falsch, ? unbekannt (NULL) – die Kombination fällt weg.' +
          (step.joinKind === 'left' ? ' „→ NULL“: Die Zeile links bleibt mit NULL-Werten rechts erhalten.' : '') +
          (step.joinKind === 'right' ? ' „↓ NULL“: Die Zeile rechts bleibt mit NULL-Werten links erhalten.' : ''))
    ];
  }

  /** Umschalter zwischen farbiger Zuordnung und Raster. */
  function joinViewSwitch(step) {
    const gridPossible = step.grid !== null;
    const option = (value, label, disabled) => {
      const input = dom.el('input', { type: 'radio', name: 'steps-join-view', id: 'steps-join-' + value, value, disabled: disabled || null });
      input.checked = state.joinView === value && !disabled;
      input.addEventListener('change', () => {
        if (input.checked) {
          state.joinView = value;
          renderStep();
          focusById('steps-join-' + value);
        }
      });
      return dom.el('label', { class: 'inline-label', for: 'steps-join-' + value }, [input, ' ', label]);
    };
    return dom.el('fieldset', { class: 'join-switch' }, [
      dom.el('legend', null, 'Darstellung'),
      option('colors', 'Farbige Zuordnung', false),
      option('grid', 'Kreuzprodukt-Raster', !gridPossible),
      gridPossible ? null : dom.el('span', { class: 'hint' }, ' (Raster nur bis ' + ns.sql.TRACE_LIMITS.gridSide + ' × ' + ns.sql.TRACE_LIMITS.gridSide + ' Zeilen)')
    ]);
  }

  /** JOIN, CROSS JOIN, Komma. */
  function viewJoin(step) {
    const colorLeft = step.joinKind !== 'right';
    const useGrid = state.joinView === 'grid' && step.grid !== null;
    const out = joinExplain(step);
    out.push(joinViewSwitch(step));
    if (useGrid) {
      out.push.apply(out, joinGrid(step));
    }
    out.push(joinSourceTables(step, colorLeft));
    out.push.apply(out, joinResultTable(step, colorLeft));
    return out;
  }

  /** WHERE bzw. HAVING ohne Gruppen: Wert der Bedingung je Zeile. */
  function viewWhere(step) {
    const hasParts = step.parts && step.parts.length > 1;
    const out = [dom.el('p', { class: 'step-explain' }, 'Die Bedingung wird für jede Zeile geprüft. Nur Zeilen mit dem Ergebnis „wahr“ bleiben übrig; ' +
      'bei „falsch“ und „unbekannt“ (Vergleich mit NULL) fällt die Zeile heraus. Ergebnis: ' + dom.formatCount(step.table.total) + ' → ' + rowsText(step.kept) + '.')];
    const controls = [hideToggle()];
    if (hasParts) {
      controls.push(toggle('steps-show-parts', 'Teilbedingungen anzeigen', state.showParts, (v) => {
        state.showParts = v;
        renderStep();
        focusById('steps-show-parts');
      }));
    }
    out.push(dom.el('div', { class: 'button-row step-controls-row' }, controls));
    const showParts = hasParts && state.showParts;
    out.push(stepTable({
      table: step.table, label: 'Zeilen mit dem Wert der Bedingung',
      pre: showParts ? step.parts.map((p) => text.cleanCellText(p)).concat(['gesamt']) : ['Bedingung'],
      row: (i) => {
        const t = step.truths[i];
        return {
          hidden: state.hideRemoved && t !== true,
          cls: t === true ? null : 'row-out',
          pre: (showParts ? step.partValues[i].map((v) => truthCell(v, true)) : []).concat([truthCell(t)])
        };
      }
    }));
    if (hasParts) {
      out.push(dom.el('p', { class: 'hint' }, 'Bei AND müssen alle Teilbedingungen wahr sein. Ist eine falsch, ist das Ganze falsch; sonst macht ein „unbekannt“ das Ganze unbekannt.'));
    }
    return out;
  }

  /**
   * Rechenweg einer Aggregatfunktion für eine Gruppe.
   *
   * @param {string} name - Text der Funktion, z. B. "SUM(a.Preis)".
   * @param {Object} d - Ergebnis aus dem Mitschreiber.
   * @returns {string} Text, z. B. "SUM(a.Preis) = 24.9 + 12.5 = 37.4".
   */
  function aggregateFormula(name, d) {
    const fn = name.slice(0, name.indexOf('(')).toUpperCase();
    const result = valueText(d.result, null);
    if (d.star) {
      return name + ' = ' + result + ' (Anzahl der Zeilen)';
    }
    const vals = d.values.map((v) => valueText(v, null));
    const more = d.count > d.values.length ? ', …' : '';
    const notes = [];
    if (d.distinct) {
      notes.push('doppelte Werte nur einmal');
    }
    if (d.nulls > 0) {
      notes.push(dom.plural(d.nulls, 'NULL-Wert', 'NULL-Werte') + ' nicht berücksichtigt');
    }
    const suffix = notes.length ? ' (' + notes.join(', ') + ')' : '';
    if (d.count === 0) {
      return name + ' = ' + result + ' (keine Werte)' + suffix;
    }
    switch (fn) {
      case 'COUNT':
        return name + ' = ' + result + ' (Werte: ' + vals.join(', ') + more + ')' + suffix;
      case 'SUM':
        return name + ' = ' + vals.join(' + ') + (more ? ' + …' : '') + ' = ' + result + suffix;
      case 'AVG':
        return name + ' = (' + vals.join(' + ') + (more ? ' + …' : '') + ') / ' + dom.formatCount(d.count) + ' = ' + result + suffix;
      case 'MIN':
        return name + ' = kleinster Wert von ' + vals.join(', ') + more + ' = ' + result + suffix;
      case 'MAX':
        return name + ' = größter Wert von ' + vals.join(', ') + more + ' = ' + result + suffix;
      default:
        return name + ' = ' + result + suffix;
    }
  }

  /** @returns {Object} Tabelle der Gruppen (Gruppe, Schlüssel, Anzahl, Aggregate). */
  function groupTable(step) {
    return {
      columns: step.keyTexts.concat(['Anzahl Zeilen']).concat(step.aggTexts),
      types: null,
      rows: step.groups.map((g) => g.key.concat([g.size]).concat(g.aggs.map((a) => a.result))),
      total: step.total
    };
  }

  /** @returns {string} Bezeichnung einer Gruppe, z. B. "G1 (Bücher)". */
  function groupName(step, g) {
    const key = step.groups[g].key;
    return 'G' + (g + 1) + (key.length ? ' (' + key.map((v) => valueText(v, null)).join(', ') + ')' : '');
  }

  /** GROUP BY bzw. Aggregatfunktionen ohne GROUP BY. */
  function viewGroup(step) {
    const out = [];
    if (step.implicit) {
      out.push(dom.el('p', { class: 'step-explain' }, 'Die Abfrage enthält Aggregatfunktionen, aber kein GROUP BY. Deshalb bilden alle ' +
        rowsText(step.table.total) + ' zusammen eine einzige Gruppe; das Ergebnis hat genau eine Zeile.'));
    } else {
      out.push(dom.el('p', { class: 'step-explain' }, 'Zeilen mit gleichen Werten in ' + step.keyTexts.map((k) => text.cleanCellText(k)).join(', ') +
        ' kommen in dieselbe Gruppe: ' + rowsText(step.table.total) + ' → ' + dom.plural(step.total, 'Gruppe', 'Gruppen') +
        '. Aus jeder Gruppe wird später genau eine Ergebniszeile.'));
    }
    if (!step.implicit && step.table.rows.length > 0) {
      const order = step.table.rows.map((r, i) => i).sort((a, b) => (step.groupOf[a] - step.groupOf[b]) || (a - b));
      out.push(dom.el('h4', null, 'Zeilen nach Gruppen geordnet'));
      out.push(stepTable({
        table: step.table, label: 'Zeilen nach Gruppen geordnet', pre: ['Gruppe'], order,
        row: (i) => ({ pre: [badge('G', step.groupOf[i], true)], cls: 'tint c' + (step.groupOf[i] % COLORS) })
      }));
    }
    out.push(dom.el('h4', null, step.implicit ? 'Die Gruppe' : 'Die Gruppen'));
    out.push(stepTable({
      table: groupTable(step), label: 'Gruppen', pre: ['Gruppe'],
      row: (g) => ({ pre: [badge('G', g, true)], cls: 'tint c' + (g % COLORS) })
    }));
    if (step.aggTexts.length > 0 && step.groups.length > 0) {
      const list = dom.el('ul', { class: 'agg-list' });
      step.groups.forEach((g, gi) => {
        list.appendChild(dom.el('li', null, [
          badge('G', gi, true), ' ',
          dom.el('span', { class: 'agg-group' }, groupName(step, gi).replace(/^G\d+ ?/, '')),
          dom.el('ul', null, step.aggTexts.map((name, ai) => dom.el('li', { class: 'agg-formula' }, text.cleanCellText(aggregateFormula(name, g.aggs[ai])))))
        ]));
      });
      out.push(dom.el('details', { class: 'card agg-details', open: true }, [
        dom.el('summary', null, 'Rechenweg der Aggregatfunktionen'),
        list,
        step.total > step.groups.length ? dom.el('p', { class: 'hint' }, 'Gezeigt werden die ersten ' + dom.formatCount(step.groups.length) + ' Gruppen.') : null
      ]));
    } else if (step.aggTexts.length === 0) {
      out.push(dom.el('p', { class: 'hint' }, 'Die Abfrage verwendet keine Aggregatfunktion: Jede Gruppe liefert nur ihre Werte aus GROUP BY.'));
    }
    return out;
  }

  /** HAVING: Bedingung je Gruppe. */
  function viewHaving(step, steps, index) {
    if (!step.grouped) {
      return viewWhere(Object.assign({}, step, { parts: null }));
    }
    let groupStep = null;
    for (let k = index - 1; k >= 0; k--) {
      if (steps[k].kind === 'group') {
        groupStep = steps[k];
        break;
      }
    }
    const out = [dom.el('p', { class: 'step-explain' }, 'Die Bedingung wird für jede Gruppe geprüft – sie darf Aggregatfunktionen enthalten. Nur Gruppen mit dem Ergebnis „wahr“ bleiben übrig: ' +
      dom.formatCount(step.total) + ' → ' + dom.plural(step.kept, 'Gruppe', 'Gruppen') + '.'),
    dom.el('div', { class: 'button-row step-controls-row' }, [hideToggle()])];
    if (groupStep) {
      out.push(stepTable({
        table: groupTable(groupStep), label: 'Gruppen mit dem Wert der Bedingung', pre: ['Gruppe', 'Bedingung'],
        row: (g) => {
          const t = step.truths[g];
          return {
            hidden: state.hideRemoved && t !== true,
            pre: [badge('G', g, true), truthCell(t)],
            cls: t === true ? 'tint c' + (g % COLORS) : 'row-out'
          };
        }
      }));
    }
    return out;
  }

  /** SELECT-Liste. */
  function viewSelect(step) {
    const parts = [step.aggregated
      ? 'Für jede Gruppe entsteht eine Ergebniszeile mit den Spalten der SELECT-Liste. Aggregatfunktionen liefern den Wert ihrer Gruppe.'
      : 'Für jede Zeile werden die Spalten der SELECT-Liste berechnet. Alle anderen Spalten fallen weg.'];
    if (step.windows > 0) {
      parts.push('Fensterfunktionen (… OVER (…)) werden dabei über alle verbleibenden Zeilen berechnet.');
    }
    return [
      dom.el('p', { class: 'step-explain' }, parts.join(' ') + ' Ergebnis: ' + rowsText(step.table.total) + ', ' + dom.plural(step.table.columns.length, 'Spalte', 'Spalten') + '.'),
      stepTable({ table: step.table, label: 'Ergebnis der SELECT-Liste' })
    ];
  }

  /** DISTINCT. */
  function viewDistinct(step) {
    return [
      dom.el('p', { class: 'step-explain' }, 'Zeilen, die in allen Spalten mit einer früheren Zeile übereinstimmen, werden entfernt: ' +
        dom.formatCount(step.table.total) + ' → ' + rowsText(step.kept) + '.'),
      dom.el('div', { class: 'button-row step-controls-row' }, [hideToggle()]),
      stepTable({
        table: step.table, label: 'Zeilen mit Kennzeichnung der Duplikate', pre: ['doppelt?'],
        row: (i) => ({
          hidden: state.hideRemoved && step.removed[i],
          cls: step.removed[i] ? 'row-out' : null,
          pre: [step.removed[i] ? 'doppelt – entfällt' : '']
        })
      })
    ];
  }

  /** ORDER BY. */
  function viewOrder(step) {
    return [
      dom.el('p', { class: 'step-explain' }, 'Die Zeilen werden sortiert. Die Spalte „vorher“ zeigt, an welcher Stelle die Zeile vor dem Sortieren stand. ' +
        'Bei gleichen Sortierwerten bleibt die bisherige Reihenfolge erhalten.'),
      stepTable({
        table: step.table, label: 'Sortierte Zeilen', pre: ['Platz', 'vorher'],
        row: (i) => {
          const before = step.before[i];
          return { pre: [String(i + 1), String(before + 1)], cls: before === i ? null : 'moved' };
        }
      })
    ];
  }

  /** LIMIT. */
  function viewLimit(step) {
    const end = step.offset + step.count;
    const kept = Math.max(0, Math.min(step.count, step.table.total - step.offset));
    const skip = step.offset === 1 ? 'Die erste Zeile wird übersprungen' : 'Die ersten ' + rowsText(step.offset) + ' werden übersprungen';
    const keepText = step.count === 1 ? 'höchstens eine Zeile' : 'höchstens ' + rowsText(step.count);
    const what = step.offset > 0
      ? skip + ' (OFFSET ' + step.offset + '), danach werden ' + keepText + ' behalten'
      : 'Von vorne werden ' + keepText + ' behalten';
    return [
      dom.el('p', { class: 'step-explain' }, what + ': ' + dom.formatCount(step.table.total) + ' → ' + rowsText(kept) + '.'),
      dom.el('div', { class: 'button-row step-controls-row' }, [hideToggle()]),
      stepTable({
        table: step.table, label: 'Zeilen mit Kennzeichnung durch LIMIT', pre: ['Platz', 'LIMIT'],
        row: (i) => {
          const keep = i >= step.offset && i < end;
          return {
            hidden: state.hideRemoved && !keep,
            pre: [String(i + 1), keep ? 'behalten' : (i < step.offset ? 'übersprungen' : 'entfällt')],
            cls: keep ? null : 'row-out'
          };
        }
      })
    ];
  }

  /** Teil einer Mengenoperation. */
  function viewPart(step) {
    return [
      dom.el('p', { class: 'step-explain' }, 'Die ' + (step.which === 'left' ? 'erste' : 'zweite') + ' Abfrage wird zuerst für sich ausgewertet: ' + rowsText(step.table.total) + '.'),
      stepTable({ table: step.table, label: (step.which === 'left' ? 'Erste' : 'Zweite') + ' Abfrage' })
    ];
  }

  /** UNION, INTERSECT, EXCEPT. */
  function viewCompound(step) {
    const texts = {
      UNION: step.all ? 'Alle Zeilen beider Abfragen werden untereinander gestellt – auch doppelte.' : 'Die Zeilen beider Abfragen werden zusammengefasst; doppelte Zeilen kommen nur einmal vor.',
      INTERSECT: 'Übrig bleiben die Zeilen, die in beiden Ergebnissen vorkommen.',
      EXCEPT: 'Übrig bleiben die Zeilen der ersten Abfrage, die in der zweiten nicht vorkommen.'
    };
    return [
      dom.el('p', { class: 'step-explain' }, texts[step.op] + ' Die Spaltennamen stammen aus der ersten Abfrage. Ergebnis: ' + rowsText(step.table.total) + '.'),
      stepTable({ table: step.table, label: 'Ergebnis der Mengenoperation' })
    ];
  }

  /** Abschluss: Ergebnis. */
  function viewResult(step) {
    return [
      dom.el('p', { class: 'step-explain' }, 'Das ist das Ergebnis der Abfrage – dasselbe, das Seite 3 „SQL-Befehle“ anzeigt: ' + rowsText(step.table.total) + '.'),
      stepTable({ table: step.table, label: 'Ergebnis der Abfrage' })
    ];
  }

  const VIEWS = {
    source: viewSource, join: viewJoin, where: viewWhere, group: viewGroup, having: viewHaving,
    select: viewSelect, distinct: viewDistinct, order: viewOrder, limit: viewLimit,
    part: viewPart, compound: viewCompound, result: viewResult
  };

  // ---------------------------------------------------------------------------
  // SQL-Text mit Markierung
  // ---------------------------------------------------------------------------

  /** @returns {string} Bereinigter SQL-Text (Zeilenumbrüche bleiben erhalten). */
  function cleanSql(s) {
    return s.replace(/\r/g, '').split('\n').map(text.cleanSourceLine).join('\n');
  }

  /**
   * Zeigt den SQL-Text und markiert den Bereich des aktuellen Schritts.
   *
   * @param {Object} step - Schritt (span bezieht sich auf die ganze Eingabe).
   */
  function renderSql(step) {
    const tr = state.trace;
    const sql = tr.text;
    const span = highlightSpan(step);
    const pre = dom.clear(ui.sql);
    if (!span) {
      pre.appendChild(document.createTextNode(cleanSql(sql)));
      return;
    }
    const a = Math.max(0, span.start - tr.base);
    const b = Math.min(sql.length, span.end - tr.base);
    pre.appendChild(document.createTextNode(cleanSql(sql.slice(0, a))));
    pre.appendChild(dom.el('mark', { class: 'sql-hl' }, cleanSql(sql.slice(a, b))));
    pre.appendChild(document.createTextNode(cleanSql(sql.slice(b))));
  }

  /** @returns {{start:number, end:number}|null} Zu markierender Bereich eines Schritts. */
  function highlightSpan(step) {
    if (step.span) {
      return step.span;
    }
    if (step.kind === 'group') {
      // Aggregatfunktionen ohne GROUP BY: Die SELECT-Liste verursacht die Gruppe.
      const sel = state.trace.steps.find((s) => s.kind === 'select');
      return sel ? sel.span : null;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Abspieler
  // ---------------------------------------------------------------------------

  /** Zeichnet den aktuellen Schritt (Liste, Knöpfe, SQL-Text, Ansicht). */
  function renderStep() {
    const tr = state.trace;
    if (!tr) {
      return;
    }
    const steps = tr.steps;
    const i = state.index;
    const step = steps[i];
    const d = describe(step, steps);
    Array.from(ui.list.querySelectorAll('button')).forEach((btn, k) => {
      if (k === i) {
        btn.setAttribute('aria-current', 'step');
      } else {
        btn.removeAttribute('aria-current');
      }
      btn.tabIndex = k === i ? 0 : -1;
    });
    ui.first.disabled = i === 0;
    ui.prev.disabled = i === 0;
    ui.next.disabled = i === steps.length - 1;
    ui.last.disabled = i === steps.length - 1;
    ui.position.textContent = 'Schritt ' + (i + 1) + ' von ' + steps.length;
    renderSql(step);
    const view = dom.clear(ui.view);
    view.appendChild(dom.el('h3', { class: 'step-title' }, 'Schritt ' + (i + 1) + ': ' + d.title));
    dom.appendChildren(view, VIEWS[step.kind](step, steps, i));
    ui.status.textContent = 'Schritt ' + (i + 1) + ' von ' + steps.length + ': ' + d.title;
  }

  /** Wechselt zu einem Schritt. */
  function go(index, focusList) {
    const n = state.trace ? state.trace.steps.length : 0;
    if (n === 0) {
      return;
    }
    state.index = Math.max(0, Math.min(n - 1, index));
    renderStep();
    if (focusList) {
      ui.list.querySelectorAll('button')[state.index].focus();
    }
  }

  /** Baut den Abspieler für ein neues Ergebnis auf. */
  function buildPlayer() {
    const tr = state.trace;
    ui.list = dom.el('ol', { class: 'steps-list' });
    tr.steps.forEach((step, k) => {
      const d = describe(step, tr.steps);
      const btn = dom.el('button', { type: 'button', class: 'step-btn' }, [
        dom.el('span', { class: 'step-no' }, String(k + 1)),
        dom.el('span', { class: 'step-label' }, d.label),
        dom.el('span', { class: 'step-count' }, d.count)
      ]);
      btn.addEventListener('click', () => go(k, false));
      btn.addEventListener('keydown', (event) => {
        const keys = { ArrowDown: state.index + 1, ArrowRight: state.index + 1, ArrowUp: state.index - 1, ArrowLeft: state.index - 1, Home: 0, End: tr.steps.length - 1 };
        if (Object.prototype.hasOwnProperty.call(keys, event.key)) {
          event.preventDefault();
          go(keys[event.key], true);
        }
      });
      ui.list.appendChild(dom.el('li', null, btn));
    });
    const button = (label, cls, handler) => {
      const b = dom.el('button', { type: 'button', class: 'btn ' + (cls || '') }, label);
      b.addEventListener('click', handler);
      return b;
    };
    ui.first = button('⏮ Anfang', '', () => go(0));
    ui.prev = button('◀ Zurück', '', () => go(state.index - 1));
    ui.next = button('Weiter ▶', 'btn-primary', () => go(state.index + 1));
    ui.last = button('Ende ⏭', '', () => go(tr.steps.length - 1));
    ui.position = dom.el('span', { class: 'step-position' });
    ui.sql = dom.el('pre', { class: 'steps-sql', 'aria-label': 'SQL-Abfrage, der aktuelle Teil ist markiert' });
    ui.view = dom.el('div', { class: 'step-view' });
    const player = dom.el('div', { class: 'steps-player' }, [
      dom.el('nav', { class: 'steps-nav card', 'aria-label': 'Schritte der Auswertung' }, [dom.el('h3', null, 'Schritte'), ui.list]),
      dom.el('div', { class: 'steps-main' }, [
        dom.el('div', { class: 'button-row steps-controls' }, [ui.first, ui.prev, ui.position, ui.next, ui.last]),
        ui.sql,
        ui.view
      ])
    ]);
    ui.output.appendChild(player);
    renderStep();
  }

  // ---------------------------------------------------------------------------
  // Eingabe und Auswertung
  // ---------------------------------------------------------------------------

  /** Zeigt einen Hinweis über dem Ergebnisbereich an. */
  function setNotice(message) {
    ui.notice.textContent = message || '';
    ui.notice.hidden = !message;
  }

  /** Leert den Ergebnisbereich. */
  function clearOutput() {
    dom.clear(ui.output);
    state.trace = null;
    state.index = 0;
  }

  /** Aktualisiert die Angabe zur aktuellen Datenbank. */
  function renderDbInfo() {
    const db = ns.state.db();
    if (!db) {
      ui.dbInfo.textContent = 'Es ist noch keine Datenbank geladen (Seite 1).';
      return;
    }
    const info = ns.state.info();
    ui.dbInfo.textContent = 'Datenbank: „' + text.cleanCellText(info.name) + '“' + (info.dirty ? ' (mit Änderungen)' : '') + '.';
  }

  /** Wertet die Eingabe Schritt für Schritt aus. */
  function execute() {
    setNotice(null);
    clearOutput();
    const db = ns.state.db();
    const source = ui.input.value;
    let error = null;
    if (!db) {
      error = new ns.sql.SqlError('Es ist noch keine Datenbank geladen.', null, 'Wählen Sie auf Seite 1 eine Beispieldatenbank oder laden Sie eine SQL-Datei hoch.');
    } else if (source.trim() === '') {
      error = new ns.sql.SqlError('Bitte geben Sie eine SELECT-Abfrage ein.', null, 'Beispiel: SELECT * FROM ' + (db.tableList()[0] ? db.tableList()[0].name : 'tabelle') + ';');
    } else if (source.length > MAX_INPUT) {
      error = new ns.sql.SqlError('Die Eingabe ist zu lang (höchstens ' + dom.formatCount(MAX_INPUT) + ' Zeichen).', null);
    }
    if (!error) {
      try {
        const res = ns.sql.traceQuery(db, source);
        if (res.keywordCase && res.keywordCase.length) {
          ui.output.appendChild(ns.ui.warningBox('SQL-Schlüsselwörter werden üblicherweise großgeschrieben: ' +
            res.keywordCase.map((k) => k.written + ' → ' + k.upper).join(', ') + '.'));
        }
        for (const w of res.result.warnings || []) {
          ui.output.appendChild(ns.ui.warningBox(w));
        }
        const result = res.result;
        state.trace = {
          text: res.text,
          base: res.base,
          steps: res.steps.concat([{ kind: 'result', span: null, table: { columns: result.columns, types: result.types, rows: result.rows.slice(0, ns.sql.TRACE_LIMITS.rows), total: result.rows.length } }])
        };
        state.index = 0;
        buildPlayer();
        ui.runStatus.textContent = 'Die Abfrage wurde in ' + state.trace.steps.length + ' Schritten ausgewertet.';
        return;
      } catch (e) {
        error = e;
      }
    }
    ui.output.appendChild(ns.ui.errorBox(error, source, {}));
    ui.runStatus.textContent = 'Die Abfrage enthält einen Fehler.';
  }

  ns.pages.steps = {
    init() {
      ui.input = dom.byId('steps-input');
      ui.run = dom.byId('btn-steps-run');
      ui.take = dom.byId('btn-steps-take');
      ui.clearInput = dom.byId('btn-steps-clear');
      ui.output = dom.byId('steps-output');
      ui.runStatus = dom.byId('steps-run-status');
      ui.status = dom.byId('steps-status');
      ui.notice = dom.byId('steps-notice');
      ui.dbInfo = dom.byId('steps-db-info');

      ui.run.addEventListener('click', execute);
      ui.input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          execute();
        }
      });
      ui.take.addEventListener('click', () => {
        const other = dom.byId('sql-input').value;
        if (other.trim() === '') {
          setNotice('Auf Seite 3 „SQL-Befehle“ ist noch kein Befehl eingegeben.');
          return;
        }
        ui.input.value = other.slice(0, MAX_INPUT);
        execute();
      });
      ui.clearInput.addEventListener('click', () => {
        ui.input.value = '';
        ui.input.focus();
      });
    },
    render() {
      renderDbInfo();
    },
    onDbChange(event) {
      renderDbInfo();
      const hadOutput = state.trace !== null || ui.output.childNodes.length > 0;
      clearOutput();
      if (!hadOutput) {
        setNotice(null);
      } else if (event.type === 'reset') {
        setNotice('Die Datenbank wurde auf den Stand nach dem Laden zurückgesetzt. Werten Sie die Abfrage erneut aus.');
      } else if (event.type === 'change') {
        setNotice('Die Datenbank wurde auf Seite 3 geändert. Werten Sie die Abfrage erneut aus.');
      } else {
        setNotice('Es wurde eine andere Datenbank geladen. Die bisherige Auswertung wurde entfernt; Ihre Eingabe bleibt erhalten.');
      }
    }
  };

  /** Für Tests: Zustand der Seite (nur lesend verwenden). */
  ns.pages.steps.state = state;
})(window.SQLSIM = window.SQLSIM || {});
