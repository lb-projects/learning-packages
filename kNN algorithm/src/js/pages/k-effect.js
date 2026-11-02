/**
 * @file k-effect.js
 * @description Seite 3 "Auswirkungen des Parameters k".
 *
 * Funktionen der Seite:
 *   - Auswahl eines Trainingspunkts (Auswahlliste oder Klick ins Diagramm).
 *   - Der Punkt wird für k = 1 … n−1 anhand der ÜBRIGEN Trainingspunkte
 *     klassifiziert (er selbst wird ausgeschlossen, sonst wäre er bei k = 1
 *     immer sein eigener nächster Nachbar).
 *   - Tabelle: je k das erwartete Label; Zeile grün bei korrekter, rot bei
 *     falscher Klassifizierung; bei falscher Klassifizierung zusätzlich das
 *     berechnete Label. Zusätzlich Symbol ✓/✗, damit die Information nicht
 *     allein über die Farbe vermittelt wird.
 *   - Klick auf eine Tabellenzeile zeigt die Nachbarn für dieses k im Diagramm.
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

  /** Seitenzustand (bleibt beim Seitenwechsel erhalten). */
  const state = {
    /** @type {number|null} Ausgewählter Punkt. */
    selectedId: null,
    /** k, dessen Nachbarn im Diagramm gezeigt werden. */
    shownK: 1,
    /** true, wenn der ausgewählte Punkt zwischenzeitlich entfernt wurde. */
    selectionRemoved: false
  };

  let ui = null;
  let chart = null;
  let metricSelector = null;

  /**
   * Wählt einen Punkt aus.
   * @param {number|null} id - Punkt-ID.
   */
  function select(id) {
    state.selectedId = id;
    state.selectionRemoved = false;
    render();
  }

  /**
   * Füllt die Auswahlliste mit allen Punkten.
   * @param {Array} points - Punkte.
   */
  function renderSelect(points) {
    const select = dom.clear(ui.select);
    select.appendChild(dom.el('option', { value: '' }, '– Punkt auswählen –'));
    for (const p of points) {
      select.appendChild(dom.el('option', { value: p.id, selected: p.id === state.selectedId }, dom.describePoint(p)));
    }
  }

  /**
   * Baut die Ergebnistabelle auf.
   * @param {Object} target - Ausgewählter Punkt.
   * @param {Array<{k:number, label:string, correct:boolean, tie:boolean}>} results - Ergebnis je k.
   */
  function renderTable(target, results) {
    const tbody = dom.el('tbody');
    for (const r of results) {
      const button = dom.el('button', { type: 'button', class: 'btn-row', 'aria-pressed': r.k === state.shownK ? 'true' : 'false', title: 'Nachbarn im Diagramm anzeigen' }, 'k = ' + r.k);
      button.addEventListener('click', () => {
        state.shownK = r.k;
        render();
      });
      tbody.appendChild(dom.el('tr', { class: (r.correct ? 'row-ok' : 'row-wrong') + (r.k === state.shownK ? ' selected' : '') }, [
        dom.el('th', { scope: 'row' }, button),
        dom.el('td', null, common.labelBadge(target.label)),
        dom.el('td', null, r.correct ? '' : [common.labelBadge(r.label), r.tie ? ' (Gleichstand)' : '']),
        dom.el('td', { class: 'result-cell' }, r.correct ? '✓ korrekt' : '✗ falsch')
      ]));
    }
    const correctCount = results.filter((r) => r.correct).length;
    dom.clear(ui.table).appendChild(dom.el('p', null,
      'Punkt ' + dom.describePoint(target) + ' wird für ' + correctCount + ' von ' + results.length +
      ' k-Werten korrekt klassifiziert.'));
    ui.table.appendChild(dom.el('div', { class: 'table-wrap table-scroll' }, dom.el('table', { class: 'data-table' }, [
      dom.el('caption', null, 'Klassifizierung des ausgewählten Punkts für verschiedene k'),
      dom.el('thead', null, dom.el('tr', null, [
        dom.el('th', { scope: 'col' }, 'k'),
        dom.el('th', { scope: 'col' }, 'erwartetes Label'),
        dom.el('th', { scope: 'col' }, 'berechnetes Label (falls falsch)'),
        dom.el('th', { scope: 'col' }, 'Ergebnis')
      ])),
      tbody
    ])));
  }

  /** Zeichnet die Seite neu. */
  function render() {
    const points = ds.getPoints();
    const metric = metricSelector.get();
    renderSelect(points);
    ui.chartInfo.textContent = '';
    if (points.length < 2) {
      common.showNotice(ui.notice, 'Für diese Seite werden mindestens 2 Trainingspunkte benötigt.', true);
      chart.render(common.baseView());
      dom.clear(ui.table);
      return;
    }
    const target = state.selectedId !== null ? ds.getPoint(state.selectedId) : null;
    if (!target) {
      common.showNotice(ui.notice, state.selectionRemoved ? 'Der ausgewählte Punkt wurde auf der Seite „Training“ entfernt. Bitte einen anderen Punkt auswählen.' : null);
      chart.render(common.baseView());
      dom.clear(ui.table).appendChild(dom.el('p', null, 'Wählen Sie einen Trainingspunkt aus der Liste oder klicken Sie im Diagramm auf einen Punkt.'));
      return;
    }
    common.showNotice(ui.notice, null);
    const kMax = points.length - 1;
    state.shownK = Math.min(Math.max(1, state.shownK), kMax);
    const results = knn.evaluateAllK(points, target, kMax, metric);
    const shown = knn.classify(points, target, state.shownK, metric, target.id);
    chart.render(Object.assign(common.baseView(), {
      selectedId: target.id,
      origin: target,
      neighbors: shown.neighbors,
      metric,
      radius: shown.radius
    }));
    ui.chartInfo.textContent = 'Diagramm: k = ' + state.shownK + ' – berechnetes Label: ' + shown.label +
      (shown.label === target.label ? ' (korrekt)' : ' (falsch, erwartet: ' + target.label + ')');
    renderTable(target, results);
  }

  /** Initialisiert die Seite. */
  function init() {
    ui = {
      select: dom.byId('k3-point'),
      table: dom.byId('k3-table'),
      notice: dom.byId('notice-k-effect'),
      chartInfo: dom.byId('k3-chart-info')
    };
    chart = new ns.chart.ScatterChart(dom.byId('chart-k-effect'), {
      ariaLabel: 'Diagramm: ausgewählter Punkt und seine nächsten Nachbarn',
      onPointClick: (p) => select(p.id)
    });
    metricSelector = new common.MetricSelector(dom.byId('metric-k-effect'), render);
    ui.select.addEventListener('change', () => select(ui.select.value === '' ? null : Number(ui.select.value)));
  }

  /**
   * Datenänderungen: Wurde der ausgewählte Punkt entfernt, wird die Auswahl
   * aufgehoben (mit Hinweis; bei komplett neuem Datensatz ohne Hinweis).
   * @param {{type: string}} event - Änderung.
   */
  function onDataChange(event) {
    if (state.selectedId !== null && !ds.getPoint(state.selectedId)) {
      state.selectedId = null;
      state.selectionRemoved = event.type === 'remove';
    }
  }

  ns.pages = ns.pages || {};
  ns.pages['k-effect'] = { id: 'k-effect', init, render, onDataChange };
})(window.KNN = window.KNN || {});
