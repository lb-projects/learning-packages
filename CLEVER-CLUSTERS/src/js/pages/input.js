/**
 * @file pages/input.js
 * @description Seite 1: Daten laden, k wählen, Startzentren festlegen.
 *
 * Aufbau:
 *   Links Daten laden, Punktmaske, Einstellungen mit k und den Schaltflächen für die Startzentren.
 *   Rechts die Punkte mit den Zentren und auf Wunsch den Decision Areas, darunter die Punktetabelle.
 *
 * Startzentren:
 *   Ein Klick in die Zeichnung setzt ein Zentrum; nahe an einem Datenpunkt rastet es auf ihm ein.
 *   Ein Klick auf ein Zentrum entfernt es. „Zufällig wählen“ nimmt k verschiedene Datenpunkte,
 *   „Mit k-means++ wählen“ bevorzugt dabei Punkte, die weit von den schon gewählten entfernt sind.
 *
 * Abhängigkeiten:
 *   dom-utils.js, coord-plot.js, cluster-panel.js, cluster-view.js, session.js, samples.js
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const session = ns.session;
  const view = ns.clusterView;

  let plot = null;
  let panel = null;

  /** Erklärung des Dateiformats. */
  function formatHelp() {
    return [
      dom.el('p', null, ['Zwei Spalten: ', dom.el('code', null, 'Achse x;Achse y'), ' als Kopfzeile, danach je Zeile zwei Zahlen. Die Kopfzeile kann entfallen.']),
      dom.el('p', null, ['Drei Spalten: ', dom.el('code', null, 'Objekt;Achse x;Achse y'), ' als Kopfzeile, danach je Zeile ein Bezeichner und zwei Zahlen. Auch hier kann die Kopfzeile entfallen.']),
      dom.el('p', null, ['Mit bekannten Gruppen: ', dom.el('code', null, 'Objekt;Achse x;Achse y;Gruppe'), ' oder ', dom.el('code', null, 'Achse x;Achse y;Gruppe'), '. Die Gruppe bleibt unsichtbar, bis Sie sie auf Seite 7 mit den Clustern vergleichen.']),
      dom.el('p', null, 'Trennzeichen: Semikolon, Komma oder Tabulator. Das Dezimalkomma ist beim Semikolon möglich. Höchstens 500 Punkte; Zahlen von −1000000 bis 1000000.')
    ];
  }

  /** Füllt die Auswahl von k. */
  function renderK() {
    const select = dom.byId('cfg-k');
    const max = session.maxK();
    dom.clear(select);
    for (let k = 1; k <= Math.max(max, 1); k++) {
      select.appendChild(dom.el('option', { value: String(k) }, String(k)));
    }
    select.disabled = max === 0;
    select.value = String(max === 0 ? 1 : session.k());
  }

  /** Zeigt, wie viele Zentren gesetzt sind. */
  function renderCenterStatus() {
    const set = session.centers().length;
    const k = session.k();
    const status = dom.byId('cfg-center-status');
    if (session.data.count() === 0) {
      status.textContent = 'Noch keine Daten.';
    } else if (set === k) {
      status.textContent = 'Alle ' + k + ' Startzentren sind gesetzt. Ein Klick auf ein Zentrum entfernt es.';
    } else {
      status.textContent = set + ' von ' + k + ' Startzentren gesetzt. Klicken Sie in die Zeichnung oder wählen Sie zufällig.';
    }
    dom.byId('cfg-random').disabled = session.data.count() === 0;
    dom.byId('cfg-plusplus').disabled = session.data.count() === 0;
    dom.byId('cfg-clear-centers').disabled = set === 0;
  }

  /** Zeichnet die Seite. */
  function render() {
    renderK();
    renderCenterStatus();
    const centers = session.modelCenters();
    const v = session.view();
    const labels = session.axisLabels();
    plot.render({
      view: v,
      xLabel: labels.x,
      yLabel: labels.y,
      regions: session.showAreas() && centers.length > 0 ? view.areaRegions(centers, v) : [],
      points: view.pointMarks(session.coords(), session.names(), null).concat(view.centerMarks(centers))
    });
    dom.byId('input-toggle-areas').checked = session.showAreas();
    dom.byId('cfg-scale').checked = session.scale();
    dom.byId('input-empty').hidden = session.data.count() > 0;
    dom.byId('input-centers-card').hidden = centers.length === 0;
    view.renderCenterTable(dom.byId('input-centers-head'), dom.byId('input-centers-body'), centers);
    panel.refresh();
  }

  /**
   * Verarbeitet einen Klick in die Zeichnung.
   * @param {number} x - x-Wert.
   * @param {number} y - y-Wert.
   */
  function handleClick(x, y) {
    const outcome = session.clickCenter(x, y, plot.screenOf);
    const message = dom.byId('input-click-message');
    message.textContent = outcome === 'full'
      ? 'Alle ' + session.k() + ' Zentren sind gesetzt. Entfernen Sie erst ein Zentrum per Klick, oder erhöhen Sie k.'
      : outcome === 'empty' ? 'Laden Sie zuerst Daten.' : '';
  }

  /** Richtet die Seite ein. */
  function init() {
    panel = ns.clusterPanel.create(dom.byId('input-data'), {
      data: session.data,
      samples: ns.samples,
      formatHelp: formatHelp(),
      formContainer: dom.byId('input-form'),
      listContainer: dom.byId('input-list'),
      scaled: (i) => (session.scaler() ? session.coords()[i] : null)
    });
    plot = ns.coordPlot.create(dom.byId('input-plot'), { ariaLabel: 'Koordinatensystem mit den Datenpunkten und den Startzentren. Ein Klick setzt oder entfernt ein Zentrum.', onClick: handleClick });
    dom.byId('cfg-k').addEventListener('change', (event) => session.setK(Number(event.target.value)));
    dom.byId('cfg-scale').addEventListener('change', (event) => session.setScale(event.target.checked));
    dom.byId('cfg-random').addEventListener('click', () => {
      dom.byId('input-click-message').textContent = '';
      session.randomCenters();
    });
    dom.byId('cfg-plusplus').addEventListener('click', () => {
      dom.byId('input-click-message').textContent = '';
      session.randomCenters('plusplus');
    });
    dom.byId('cfg-clear-centers').addEventListener('click', () => {
      dom.byId('input-click-message').textContent = '';
      session.clearCenters();
    });
    dom.byId('input-toggle-areas').addEventListener('change', (event) => {
      session.setShowAreas(event.target.checked);
      render();
    });
  }

  ns.pages = ns.pages || {};
  ns.pages.input = { init, render, panel: () => panel };
})(window.CC = window.CC || {});
