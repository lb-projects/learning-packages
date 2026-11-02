/**
 * @file evaluation-page.js
 * @description Gemeinsame Logik der Seiten 4 ("Auswahl eines passenden Wertes für k")
 *              und 5 ("Leave One Out – Verfahren").
 *
 * Beide Seiten sind gleich aufgebaut:
 *   - Auswahl eines Punkts (Liste, Klick ins Diagramm oder in die Tabelle) und
 *     eines k; das Diagramm zeigt die k nächsten Nachbarn dieses Punkts.
 *   - Eingabetabelle (k = 1 … 10), in die die Schülerinnen und Schüler für
 *     jeden Punkt "x" eintragen, wenn er für dieses k korrekt klassifiziert wird.
 *   - Prozentzeile, Schaltflächen "Eintragungen prüfen" und "zurücksetzen".
 *
 * Unterschiede (werden über die Konfiguration festgelegt):
 *   Seite 4: Zeilen = Validierungspunkte, Nachbarn nur aus den übrigen
 *            Trainingspunkten.
 *   Seite 5: Zeilen = alle Punkte, Nachbarn aus allen Punkten außer dem
 *            jeweils betrachteten (Leave One Out).
 *
 * Verhalten bei Datenänderungen (z. B. Punkte auf Seite 1 hinzugefügt/entfernt):
 *   - Eintragungen bleiben für alle noch vorhandenen Punkte erhalten.
 *   - Prüfmarkierungen werden entfernt, da sich die richtigen Ergebnisse
 *     geändert haben können; ein Hinweis bittet um erneute Prüfung.
 *   - Wird der Datensatz ersetzt (Upload, Beispieldaten), werden alle
 *     Eintragungen gelöscht.
 *
 * Abhängigkeiten:
 *   dom-utils.js, dataset.js, knn.js, chart.js, pages/common.js
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const ds = ns.dataset;
  const knn = ns.knn;
  const common = ns.common;

  /** Anzahl der k-Spalten in der Eingabetabelle. */
  const TABLE_K_MAX = 10;

  /**
   * Erzeugt eine Auswertungsseite.
   *
   * @param {Object} config - Konfiguration.
   * @param {string} config.id - Seiten-ID (z. B. "k-selection").
   * @param {string} config.prefix - Präfix der Element-IDs im HTML (z. B. "k4").
   * @param {string} config.caption - Überschrift der Eingabetabelle.
   * @param {function(): Array} config.getRows - Punkte, die als Tabellenzeilen erscheinen.
   * @param {function(): Array} config.getReference - Punkte, aus denen Nachbarn gewählt werden.
   * @param {function(): ({text: string, link: boolean}|null)} config.getBlocker - Liefert einen
   *        Hinweis, wenn die Seite (noch) nicht nutzbar ist, sonst null.
   * @param {function(Object): void} [config.extraInit] - Zusätzliche Initialisierung.
   * @param {function(): void} [config.extraRender] - Zusätzliche Darstellung.
   * @param {function(Object): void} [config.extraDataChange] - Zusätzliche Reaktion auf Änderungen.
   * @returns {{id: string, init: function, render: function, onDataChange: function}} Seitenobjekt.
   */
  function createEvaluationPage(config) {
    const p = config.prefix;
    const state = {
      /** @type {number|null} Im Diagramm gezeigter Punkt. */
      selectedId: null,
      /** true: Daten wurden nach Eintragungen geändert → Hinweis anzeigen. */
      dataChanged: false
    };
    let ui = null;
    let chart = null;
    let metricSelector = null;
    let kControl = null;
    let table = null;

    /**
     * Größtes sinnvolles k: höchstens 10 und höchstens so viele, wie Nachbarn verfügbar sind.
     * @returns {number} Größtes k.
     */
    function usableK() {
      const rows = config.getRows();
      const reference = config.getReference();
      // Beim Leave One Out ist der betrachtete Punkt Teil der Referenz und wird ausgelassen.
      const overlap = rows.length > 0 && reference.some((r) => r.id === rows[0].id) ? 1 : 0;
      return Math.min(TABLE_K_MAX, reference.length - overlap);
    }

    /**
     * Wählt einen Punkt für das Diagramm aus.
     * @param {number|null} id - Punkt-ID.
     */
    function select(id) {
      const isRow = config.getRows().some((r) => r.id === id);
      state.selectedId = isRow ? id : null;
      table.selectedId = state.selectedId;
      render();
    }

    /** Prüft die Eintragungen gegen die berechneten Ergebnisse. */
    function check() {
      const metric = metricSelector.get();
      const reference = config.getReference();
      const k = usableK();
      const results = new Map();
      for (const point of config.getRows()) {
        results.set(point.id, knn.evaluateAllK(reference, point, k, metric));
      }
      const summary = table.check(results);
      state.dataChanged = false;
      table.render();
      showChangedNotice();
      ui.checkStatus.textContent = summary.right + ' von ' + summary.total +
        ' Zellen sind richtig ausgefüllt (✓ richtig, ✗ falsch).';
    }

    /** Löscht alle Eintragungen nach Rückfrage. */
    function reset() {
      if (!window.confirm('Alle Eintragungen in dieser Tabelle löschen?')) {
        return;
      }
      table.resetEntries();
      state.dataChanged = false;
      ui.checkStatus.textContent = '';
      render();
    }

    /** Zeigt oder verbirgt den Hinweis "Daten wurden geändert". */
    function showChangedNotice() {
      common.showNotice(ui.changed, state.dataChanged
        ? 'Die Trainingsdaten wurden geändert. Die Prozentwerte sind aktualisiert – bitte die Eintragungen erneut prüfen.'
        : null);
    }

    /** Füllt die Punktauswahl. */
    function renderSelect() {
      const select = dom.clear(ui.select);
      select.appendChild(dom.el('option', { value: '' }, '– Punkt auswählen –'));
      for (const point of config.getRows()) {
        select.appendChild(dom.el('option', { value: point.id, selected: point.id === state.selectedId }, dom.describePoint(point)));
      }
    }

    /** Zeichnet die Seite neu. */
    function render() {
      if (config.extraRender) {
        config.extraRender();
      }
      const metric = metricSelector.get();
      const blocker = config.getBlocker();
      renderSelect();
      showChangedNotice();
      if (blocker) {
        common.showNotice(ui.notice, blocker.text, blocker.link);
        chart.render(Object.assign(common.baseView(), { validationIds: ds.getValidationIds() }));
        // Nur die Anzeige leeren – Eintragungen bleiben gespeichert, falls die
        // Seite durch weitere Daten wieder nutzbar wird.
        dom.clear(table.container);
        ui.chartInfo.textContent = '';
        ui.tools.hidden = true;
        return;
      }
      common.showNotice(ui.notice, null);
      ui.tools.hidden = false;
      const maxK = usableK();
      kControl.setMax(maxK);
      table.setRows(config.getRows(), maxK);
      table.selectedId = state.selectedId;
      table.render();

      const view = Object.assign(common.baseView(), { validationIds: ds.getValidationIds() });
      const target = state.selectedId !== null ? ds.getPoint(state.selectedId) : null;
      if (target) {
        const result = knn.classify(config.getReference(), target, kControl.get(), metric, target.id);
        Object.assign(view, { selectedId: target.id, origin: target, neighbors: result.neighbors, metric, radius: result.radius });
        ui.chartInfo.textContent = 'Diagramm: Punkt ' + dom.describePoint(target) + ' mit seinen k = ' +
          result.k + ' nächsten Nachbarn. Zählen Sie die Labels der markierten Nachbarn.';
      } else {
        ui.chartInfo.textContent = 'Wählen Sie einen Punkt aus der Liste, der Tabelle oder im Diagramm, um seine Nachbarn zu sehen.';
      }
      chart.render(view);
    }

    /** Initialisiert die Seite. */
    function init() {
      ui = {
        select: dom.byId(p + '-point'),
        notice: dom.byId('notice-' + config.id),
        changed: dom.byId(p + '-changed'),
        chartInfo: dom.byId(p + '-chart-info'),
        checkStatus: dom.byId(p + '-check-status'),
        tools: dom.byId(p + '-tools')
      };
      chart = new ns.chart.ScatterChart(dom.byId('chart-' + config.id), {
        ariaLabel: 'Diagramm: ausgewählter Punkt und seine nächsten Nachbarn',
        onPointClick: (point) => select(point.id)
      });
      metricSelector = new common.MetricSelector(dom.byId('metric-' + config.id), () => {
        // Neue Metrik → bisherige Prüfung gilt nicht mehr.
        table.clearCheck();
        ui.checkStatus.textContent = '';
        render();
      });
      kControl = new common.KControl(dom.byId(p + '-k'), 'k für das Diagramm', render, 1);
      table = new common.EntryTable(dom.byId(p + '-table'), {
        kMax: TABLE_K_MAX,
        caption: config.caption,
        onSelect: select,
        onEdit: () => {
          ui.checkStatus.textContent = '';
        }
      });
      ui.select.addEventListener('change', () => select(ui.select.value === '' ? null : Number(ui.select.value)));
      dom.byId(p + '-check').addEventListener('click', check);
      dom.byId(p + '-reset').addEventListener('click', reset);
      if (config.extraInit) {
        config.extraInit({ table, state });
      }
    }

    /**
     * Reagiert auf Datenänderungen.
     * @param {{type: string}} event - Änderung.
     */
    function onDataChange(event) {
      if (event.type === 'axis') {
        return;
      }
      if (event.type === 'replace') {
        table.resetEntries();
        state.dataChanged = false;
        state.selectedId = null;
        ui.checkStatus.textContent = '';
      } else {
        const hadWork = table.entries.size > 0 || table.checkResults !== null;
        table.clearCheck();
        ui.checkStatus.textContent = '';
        if (hadWork) {
          state.dataChanged = true;
        }
      }
      if (state.selectedId !== null && !config.getRows().some((r) => r.id === state.selectedId)) {
        state.selectedId = null;
      }
      if (config.extraDataChange) {
        config.extraDataChange(event, { table, state });
      }
    }

    return { id: config.id, init, render, onDataChange };
  }

  ns.createEvaluationPage = createEvaluationPage;
})(window.KNN = window.KNN || {});
