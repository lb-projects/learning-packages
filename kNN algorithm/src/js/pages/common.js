/**
 * @file common.js
 * @description Gemeinsam genutzte Bedienelemente der Seiten.
 *
 * Inhalt:
 *   - baseView():          Grunddaten für ein Streudiagramm (Punkte, Achsen, Farben).
 *   - ChoiceSelector:      allgemeine Optionsfeld-Gruppe (z. B. Berechnung der Regression).
 *   - MetricSelector:      Auswahl euklidische / Manhattan-Metrik (Optionsfelder).
 *   - KControl:            Eingabe von k als Zahlenfeld mit gekoppeltem Schieberegler.
 *   - showNotice():        Hinweisfeld, optional mit Schaltfläche "Zur Seite Training".
 *   - labelBadge():        Label mit passendem Marker (für Tabellen).
 *   - EntryTable:          Eingabetabelle für Schülereintragungen ("x") mit
 *                          Prozentzeile und Prüffunktion (Seiten 4 und 5).
 *
 * Abhängigkeiten:
 *   dom-utils.js, dataset.js, chart.js; app.js (KNN.app.showPage, zur Laufzeit).
 *
 * Sicherheitsaspekte:
 *   - Alle Texte (insbesondere Labels aus Dateien) werden als Textknoten eingefügt.
 *   - Eingaben in der x-Tabelle werden sofort normalisiert: Erlaubt ist nur
 *     "x" (bzw. "X"); jede andere Eingabe wird verworfen.
 *   - k-Eingaben werden auf ganze Zahlen im gültigen Bereich begrenzt.
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const ds = ns.dataset;

  /** Zähler für eindeutige Namen von Optionsfeld-Gruppen. */
  let groupCounter = 0;

  /**
   * Liefert die Grunddaten für ein Streudiagramm.
   *
   * @param {Array} [points] - Zu zeichnende Punkte (Standard: alle Punkte).
   * @returns {{points: Array, axisLabels: Object, labelIndex: function, labels: string[]}} Grunddaten.
   */
  function baseView(points) {
    return {
      points: points || ds.getPoints(),
      axisLabels: ds.getAxisLabels(),
      labelIndex: ds.labelIndex,
      labels: ds.getLabels()
    };
  }

  /**
   * Erzeugt ein Label mit Marker (Farbe + Form), z. B. für Tabellenzellen.
   *
   * @param {string|null} label - Label oder null (unbekannt).
   * @returns {HTMLElement} span-Element.
   */
  function labelBadge(label) {
    if (label === null || label === undefined) {
      return dom.el('span', { class: 'label-badge' }, '–');
    }
    return dom.el('span', { class: 'label-badge' }, [ns.chart.markerIcon(ds.labelIndex(label)), label]);
  }

  /**
   * Zeigt oder versteckt ein Hinweisfeld.
   *
   * @param {HTMLElement} box - Hinweiselement.
   * @param {string|null} text - Hinweistext; null versteckt das Feld.
   * @param {boolean} [linkToTraining=false] - Schaltfläche zur Seite "Training" anzeigen.
   */
  function showNotice(box, text, linkToTraining) {
    dom.clear(box);
    if (!text) {
      box.hidden = true;
      return;
    }
    box.appendChild(dom.el('span', null, text));
    if (linkToTraining) {
      const button = dom.el('button', { type: 'button', class: 'btn btn-link' }, 'Zur Seite „Training“');
      button.addEventListener('click', () => ns.app.showPage('training'));
      box.appendChild(button);
    }
    box.hidden = false;
  }

  /**
   * Allgemeine Optionsfeld-Gruppe (z. B. Berechnungsart der Regression).
   */
  class ChoiceSelector {
    /**
     * @param {HTMLElement} container - Zielelement.
     * @param {string} legend - Überschrift der Gruppe.
     * @param {Array<{id:string, name:string}>} options - Auswahlmöglichkeiten.
     * @param {string} initial - ID der anfangs gewählten Möglichkeit.
     * @param {function(string): void} onChange - Wird bei Änderung mit der gewählten ID aufgerufen.
     */
    constructor(container, legend, options, initial, onChange) {
      this.value = initial;
      const name = 'choice-' + (++groupCounter);
      const fieldset = dom.el('fieldset', { class: 'metric-selector' }, [dom.el('legend', null, legend)]);
      for (const option of options) {
        const input = dom.el('input', { type: 'radio', name, value: option.id, checked: option.id === initial });
        input.addEventListener('change', () => {
          if (input.checked) {
            this.value = option.id;
            onChange(option.id);
          }
        });
        fieldset.appendChild(dom.el('label', { class: 'radio' }, [input, ' ' + option.name]));
      }
      container.appendChild(fieldset);
    }

    /** @returns {string} Gewählte ID. */
    get() {
      return this.value;
    }
  }

  /**
   * Auswahl der Metrik (euklidisch / Manhattan) als Optionsfeld-Gruppe.
   */
  class MetricSelector {
    /**
     * @param {HTMLElement} container - Zielelement.
     * @param {function(string): void} onChange - Wird bei Änderung mit der Metrik-ID aufgerufen.
     */
    constructor(container, onChange) {
      this.value = 'euclidean';
      const name = 'metric-' + (++groupCounter);
      const fieldset = dom.el('fieldset', { class: 'metric-selector' }, [dom.el('legend', null, 'Metrik')]);
      for (const metric of Object.values(ns.knn.METRICS)) {
        const input = dom.el('input', { type: 'radio', name, value: metric.id, checked: metric.id === this.value });
        input.addEventListener('change', () => {
          if (input.checked) {
            this.value = metric.id;
            onChange(metric.id);
          }
        });
        fieldset.appendChild(dom.el('label', { class: 'radio' }, [input, ' ' + metric.name]));
      }
      container.appendChild(fieldset);
    }

    /** @returns {string} Gewählte Metrik ("euclidean" oder "manhattan"). */
    get() {
      return this.value;
    }
  }

  /**
   * Eingabe von k: Zahlenfeld und Schieberegler, die sich gegenseitig aktualisieren.
   *
   * Es wird zwischen dem gewünschten k (zuletzt vom Benutzer gewählt) und dem
   * wirksamen k unterschieden: Gibt es (z. B. nach dem Entfernen von Punkten)
   * weniger Punkte als gewünscht, wird k vorübergehend begrenzt. Kommen wieder
   * Punkte hinzu, gilt erneut das gewünschte k.
   */
  class KControl {
    /**
     * @param {HTMLElement} container - Zielelement.
     * @param {string} labelText - Beschriftung, z. B. "Anzahl der Nachbarn k".
     * @param {function(number): void} onChange - Wird mit dem neuen k aufgerufen.
     * @param {number} [initial=1] - Anfangswert für k.
     */
    constructor(container, labelText, onChange, initial) {
      this.desired = initial || 1;
      this.value = 1;
      this.max = 1;
      this.onChange = onChange;
      const id = 'k-input-' + (++groupCounter);
      this.number = dom.el('input', { type: 'number', id, min: 1, max: 1, step: 1, value: 1, class: 'k-number' });
      this.range = dom.el('input', { type: 'range', min: 1, max: 1, step: 1, value: 1, class: 'k-range', 'aria-label': labelText + ' (Schieberegler)' });
      this.number.addEventListener('change', () => this.set(this.number.value, true));
      this.number.addEventListener('input', () => {
        // Während der Eingabe nur gültige Werte übernehmen, sonst bis "change" warten.
        const v = Number(this.number.value);
        if (Number.isInteger(v) && v >= 1 && v <= this.max) {
          this.set(v, true);
        }
      });
      this.range.addEventListener('input', () => this.set(this.range.value, true));
      container.appendChild(dom.el('div', { class: 'k-control' }, [
        dom.el('label', { for: id }, labelText),
        dom.el('div', { class: 'k-inputs' }, [this.number, this.range])
      ]));
    }

    /**
     * Setzt das größte zulässige k. Das wirksame k wird auf
     * min(gewünschtes k, max) gesetzt.
     * @param {number} max - Größtes k (Werte < 1 deaktivieren die Eingabe).
     * @returns {boolean} true, wenn das gewünschte k dadurch begrenzt wird.
     */
    setMax(max) {
      this.max = Math.max(1, max);
      this.number.max = String(this.max);
      this.range.max = String(this.max);
      const disabled = max < 1;
      this.number.disabled = disabled;
      this.range.disabled = disabled;
      this.show(Math.min(this.desired, this.max));
      return this.desired > this.max;
    }

    /**
     * Übernimmt einen Wert in Zustand und Eingabefelder.
     * @param {number} v - Gültiger Wert.
     */
    show(v) {
      this.value = v;
      this.number.value = String(v);
      this.range.value = String(v);
    }

    /**
     * Setzt k (wird auf eine ganze Zahl zwischen 1 und max begrenzt).
     * @param {number|string} value - Neuer Wert.
     * @param {boolean} notify - onChange aufrufen.
     */
    set(value, notify) {
      let v = Math.round(Number(value));
      if (!Number.isFinite(v)) {
        v = this.value;
      }
      v = Math.min(this.max, Math.max(1, v));
      this.desired = v;
      this.show(v);
      if (notify) {
        this.onChange(v);
      }
    }

    /** @returns {number} Aktuelles k. */
    get() {
      return this.value;
    }
  }

  /**
   * Eingabetabelle für Schülereintragungen: Zeilen = Datenpunkte, Spalten = k.
   * In jede Zelle kann "x" eingetragen werden ("für dieses k korrekt klassifiziert").
   * Die Eintragungen sind über die Punkt-ID gespeichert und bleiben beim
   * Seitenwechsel und beim Hinzufügen/Entfernen anderer Punkte erhalten.
   */
  class EntryTable {
    /**
     * @param {HTMLElement} container - Zielelement.
     * @param {Object} options - Optionen.
     * @param {number} [options.kMax=10] - Anzahl der k-Spalten.
     * @param {string} options.caption - Tabellenüberschrift (für Screenreader).
     * @param {function(number): void} [options.onSelect] - Klick auf den Punkt einer Zeile.
     * @param {function(): void} [options.onEdit] - Nach jeder Änderung einer Eintragung.
     */
    constructor(container, options) {
      this.container = container;
      this.kMax = options.kMax || 10;
      this.caption = options.caption;
      this.onSelect = options.onSelect || null;
      this.onEdit = options.onEdit || null;
      /** @type {Map<number, Set<number>>} Eintragungen: Punkt-ID → Menge der k mit "x". */
      this.entries = new Map();
      /** @type {Map<number, Array>|null} Prüfergebnisse je Punkt-ID (null = nicht geprüft). */
      this.checkResults = null;
      this.rows = [];
      this.usableK = this.kMax;
      this.selectedId = null;
    }

    /**
     * Gleicht die Zeilen mit einer neuen Punktliste ab: Eintragungen bestehender
     * Punkte bleiben erhalten, Eintragungen entfernter Punkte werden gelöscht.
     *
     * @param {Array} points - Punkte, die als Zeilen erscheinen.
     * @param {number} usableK - Größtes sinnvolles k (größere Spalten werden deaktiviert).
     */
    setRows(points, usableK) {
      this.rows = points;
      this.usableK = Math.min(this.kMax, usableK);
      const ids = new Set(points.map((p) => p.id));
      for (const id of Array.from(this.entries.keys())) {
        if (!ids.has(id)) {
          this.entries.delete(id);
        }
      }
    }

    /** Löscht alle Eintragungen und Prüfmarkierungen. */
    resetEntries() {
      this.entries.clear();
      this.checkResults = null;
    }

    /** Entfernt die Prüfmarkierungen (Eintragungen bleiben). */
    clearCheck() {
      this.checkResults = null;
    }

    /**
     * Speichert Prüfergebnisse; sie werden beim nächsten render() angezeigt.
     *
     * @param {Map<number, Array<{k:number, correct:boolean}>>} resultsById - Berechnete Ergebnisse je Punkt.
     * @returns {{right: number, total: number}} Anzahl richtig ausgefüllter Zellen / aller Zellen.
     */
    check(resultsById) {
      this.checkResults = resultsById;
      let right = 0;
      let total = 0;
      for (const p of this.rows) {
        const results = resultsById.get(p.id) || [];
        const marked = this.entries.get(p.id) || new Set();
        for (let k = 1; k <= this.usableK; k++) {
          const r = results[k - 1];
          if (!r) {
            continue;
          }
          total++;
          if (marked.has(k) === r.correct) {
            right++;
          }
        }
      }
      return { right, total };
    }

    /**
     * Liefert den Anteil der Zeilen, in denen für k ein "x" eingetragen ist.
     * @param {number} k - Spalte.
     * @returns {number} Anteil 0 … 1.
     */
    columnRate(k) {
      if (this.rows.length === 0) {
        return 0;
      }
      let count = 0;
      for (const p of this.rows) {
        const marked = this.entries.get(p.id);
        if (marked && marked.has(k)) {
          count++;
        }
      }
      return count / this.rows.length;
    }

    /** Aktualisiert nur die Prozentzeile (ohne die Tabelle neu aufzubauen). */
    updateFooter() {
      for (let k = 1; k <= this.kMax; k++) {
        const cell = this.footerCells[k - 1];
        if (cell) {
          cell.textContent = k <= this.usableK ? dom.formatPercent(this.columnRate(k)) : '–';
        }
      }
    }

    /**
     * Verarbeitet eine Eingabe in einer Zelle: nur "x" ist erlaubt.
     * @param {HTMLInputElement} input - Eingabefeld.
     * @param {number} id - Punkt-ID.
     * @param {number} k - Spalte.
     */
    handleInput(input, id, k) {
      const value = input.value.trim().toLowerCase() === 'x' ? 'x' : '';
      input.value = value;
      if (!this.entries.has(id)) {
        this.entries.set(id, new Set());
      }
      const marked = this.entries.get(id);
      if (value === 'x') {
        marked.add(k);
      } else {
        marked.delete(k);
      }
      // Eine geänderte Zelle ist nicht mehr geprüft.
      const td = input.parentElement;
      td.classList.remove('cell-ok', 'cell-wrong');
      const mark = td.querySelector('.check-mark');
      if (mark) {
        mark.remove();
      }
      this.updateFooter();
      if (this.onEdit) {
        this.onEdit();
      }
    }

    /**
     * Pfeiltasten-Navigation zwischen den Eingabefeldern.
     * @param {KeyboardEvent} event - Tastaturereignis.
     * @param {number} row - Zeilenindex.
     * @param {number} k - Spalte.
     */
    handleKey(event, row, k) {
      const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      const move = moves[event.key];
      if (!move) {
        return;
      }
      const target = this.inputs[row + move[0]] && this.inputs[row + move[0]][k - 1 + move[1]];
      if (target && !target.disabled) {
        event.preventDefault();
        target.focus();
        target.select();
      }
    }

    /** Baut die Tabelle aus dem aktuellen Zustand neu auf. */
    render() {
      const container = dom.clear(this.container);
      if (this.rows.length === 0) {
        return;
      }
      const headRow = dom.el('tr', null, [
        dom.el('th', { scope: 'col' }, 'Datenpunkt'),
        dom.el('th', { scope: 'col' }, 'Label')
      ]);
      for (let k = 1; k <= this.kMax; k++) {
        headRow.appendChild(dom.el('th', { scope: 'col', class: 'k-col' + (k > this.usableK ? ' disabled' : '') }, 'k = ' + k));
      }
      const tbody = dom.el('tbody');
      this.inputs = [];
      this.rows.forEach((p, rowIndex) => {
        const marked = this.entries.get(p.id) || new Set();
        const results = this.checkResults ? this.checkResults.get(p.id) : null;
        const pointCell = this.onSelect
          ? dom.el('button', { type: 'button', class: 'btn-row', 'aria-pressed': p.id === this.selectedId ? 'true' : 'false', title: 'Im Diagramm anzeigen' }, dom.describePoint(p))
          : dom.describePoint(p);
        if (this.onSelect) {
          pointCell.addEventListener('click', () => this.onSelect(p.id));
        }
        const tr = dom.el('tr', { class: p.id === this.selectedId ? 'selected' : null }, [
          dom.el('th', { scope: 'row' }, pointCell),
          dom.el('td', null, labelBadge(p.label))
        ]);
        const rowInputs = [];
        for (let k = 1; k <= this.kMax; k++) {
          const disabled = k > this.usableK;
          const input = dom.el('input', {
            type: 'text', maxlength: 1, size: 1, class: 'x-input', autocomplete: 'off', spellcheck: 'false',
            value: marked.has(k) ? 'x' : '', disabled,
            'aria-label': 'Punkt #' + p.id + ', k = ' + k + ': x eintragen, wenn korrekt klassifiziert'
          });
          input.addEventListener('input', () => this.handleInput(input, p.id, k));
          input.addEventListener('keydown', (event) => this.handleKey(event, rowIndex, k));
          const td = dom.el('td', { class: 'x-cell' + (disabled ? ' disabled' : '') }, input);
          const r = results && results[k - 1];
          if (r && !disabled) {
            const ok = marked.has(k) === r.correct;
            td.classList.add(ok ? 'cell-ok' : 'cell-wrong');
            td.appendChild(dom.el('span', { class: 'check-mark', 'aria-label': ok ? 'richtig' : 'falsch', title: ok ? 'richtig' : 'falsch' }, ok ? '✓' : '✗'));
          }
          rowInputs.push(input);
          tr.appendChild(td);
        }
        this.inputs.push(rowInputs);
        tbody.appendChild(tr);
      });
      this.footerCells = [];
      const footRow = dom.el('tr', null, [dom.el('th', { scope: 'row', colspan: 2 }, 'korrekt erkannt')]);
      for (let k = 1; k <= this.kMax; k++) {
        const cell = dom.el('td', { class: 'percent' }, '');
        this.footerCells.push(cell);
        footRow.appendChild(cell);
      }
      const table = dom.el('table', { class: 'data-table entry-table' }, [
        dom.el('caption', null, this.caption),
        dom.el('thead', null, headRow),
        tbody,
        dom.el('tfoot', null, footRow)
      ]);
      container.appendChild(dom.el('div', { class: 'table-wrap' }, table));
      this.updateFooter();
    }
  }

  ns.common = { baseView, labelBadge, showNotice, ChoiceSelector, MetricSelector, KControl, EntryTable };
})(window.KNN = window.KNN || {});
