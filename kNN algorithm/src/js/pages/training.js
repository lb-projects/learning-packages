/**
 * @file training.js
 * @description Seite 1 "Training": Trainingsdaten eingeben, hochladen, anzeigen und entfernen.
 *
 * Funktionen der Seite:
 *   - Datei-Upload (.csv, .xlsx, .ods) mit drei Spalten x-Wert, y-Wert, Label.
 *     Ein Upload ersetzt nach Rückfrage den vorhandenen Datensatz.
 *   - Eingabemaske für einzelne Datenpunkte (ergänzt den Datensatz).
 *   - Achsenbeschriftungen ändern.
 *   - Beispieldaten laden, alle Daten löschen.
 *   - Diagramm aller Punkte; Klick auf einen Punkt wählt ihn aus.
 *   - Tabelle aller Punkte mit Schaltfläche "Entfernen" je Zeile.
 *   Jede Änderung wirkt sich über dataset.js sofort auf alle anderen Seiten aus.
 *
 * Abhängigkeiten:
 *   dom-utils.js, dataset.js, data-import.js, chart.js, pages/common.js
 *
 * Sicherheitsaspekte:
 *   - Eingaben werden über dataset.js geprüft (Zahlen, Bereich, Label-Whitelist).
 *   - Dateiname, Labels und Achsentexte werden nur als Text angezeigt.
 *   - Das Formular wird nie abgeschickt (preventDefault; zusätzlich verbietet
 *     die Content-Security-Policy mit form-action 'none' jede Übertragung).
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const ds = ns.dataset;
  const common = ns.common;

  /**
   * Beispieldaten: Breite und Höhe von Früchten in cm (frei erfunden, zur Übung).
   * Einige Punkte liegen bewusst im Grenzbereich zwischen den Klassen, damit
   * die Wahl von k einen sichtbaren Unterschied macht.
   */
  const SAMPLE = {
    axisLabels: { x: 'Breite (cm)', y: 'Höhe (cm)' },
    points: [
      [7, 7, 'Apfel'], [8, 7, 'Apfel'], [7, 8, 'Apfel'], [8, 8, 'Apfel'],
      [6, 7, 'Apfel'], [7, 6, 'Apfel'], [8, 9, 'Apfel'], [9, 8, 'Apfel'],
      [6, 10, 'Birne'], [7, 11, 'Birne'], [6, 11, 'Birne'], [5, 10, 'Birne'],
      [7, 10, 'Birne'], [6, 12, 'Birne'], [5, 9, 'Birne'], [8, 11, 'Birne'],
      [4, 6, 'Zitrone'], [5, 6, 'Zitrone'], [4, 5, 'Zitrone'], [5, 7, 'Zitrone'],
      [3, 5, 'Zitrone'], [4, 7, 'Zitrone'], [6, 6, 'Zitrone'], [5, 5, 'Zitrone']
    ]
  };

  /** Seitenzustand. */
  const state = {
    /** @type {number|null} ID des ausgewählten Punkts. */
    selectedId: null
  };

  /** Laufende Nummer des letzten gestarteten Datei-Imports. */
  let importCounter = 0;

  /** Referenzen auf Elemente der Seite (werden in init gesetzt). */
  let ui = null;
  /** @type {ns.chart.ScatterChart} */
  let chart = null;

  /**
   * Zeigt Meldungen im Statusbereich des Uploads an.
   *
   * @param {string} type - "info", "success" oder "error".
   * @param {string} message - Hauptmeldung.
   * @param {string[]} [details] - Zusätzliche Zeilen (z. B. übersprungene Zeilen).
   */
  function setImportStatus(type, message, details) {
    const box = dom.clear(ui.importStatus);
    box.className = 'status status-' + type;
    box.appendChild(dom.el('p', null, message));
    if (details && details.length > 0) {
      box.appendChild(dom.el('ul', null, details.map((d) => dom.el('li', null, d))));
    }
    box.hidden = false;
  }

  /**
   * Verarbeitet die ausgewählte Datei.
   * @returns {Promise<void>}
   */
  async function handleFile() {
    const file = ui.fileInput.files && ui.fileInput.files[0];
    if (!file) {
      return;
    }
    // Jeder Import erhält eine Nummer. Wird während des Einlesens eine weitere
    // Datei gewählt, wird das Ergebnis des älteren Imports verworfen – sonst
    // könnte eine langsamere, ältere Datei die neuere überschreiben.
    const importId = ++importCounter;
    // Dateiname nur bereinigt anzeigen (keine unsichtbaren Richtungszeichen zur Täuschung).
    const fileName = ds.sanitizeDisplayText(file.name, 80, 'Datei');
    setImportStatus('info', 'Datei wird gelesen …');
    try {
      const result = await ns.dataImport.importFile(file);
      if (importId !== importCounter) {
        return;
      }
      const details = result.errors.slice();
      if (result.skipped > result.errors.length) {
        details.push('… und ' + (result.skipped - result.errors.length) + ' weitere ungültige Zeilen.');
      }
      if (result.points.length === 0) {
        setImportStatus('error', 'In der Datei wurden keine gültigen Datenpunkte gefunden.', details);
        return;
      }
      if (ds.size() > 0 && !window.confirm('Die vorhandenen ' + ds.size() +
          ' Datenpunkte werden durch die Daten aus der Datei ersetzt. Fortfahren?')) {
        setImportStatus('info', 'Import abgebrochen. Die bisherigen Daten bleiben erhalten.');
        return;
      }
      ds.replaceAll(result.points, result.axisLabels);
      state.selectedId = null;
      let message = result.points.length + ' Datenpunkte aus „' + fileName + '“ übernommen.';
      if (result.hasHeader) {
        message += ' Achsenbeschriftung aus der ersten Zeile: „' + result.axisLabels.x + '“ / „' + result.axisLabels.y + '“.';
      }
      if (result.limitReached) {
        details.unshift('Es wurden nur die ersten ' + ds.LIMITS.maxPoints + ' Datenpunkte übernommen.');
      }
      if (result.skipped > 0) {
        details.unshift(result.skipped + ' Zeile(n) wurden übersprungen:');
      }
      setImportStatus(result.skipped > 0 || result.limitReached ? 'warning' : 'success', message, details);
    } catch (error) {
      if (importId === importCounter) {
        setImportStatus('error', error.message || 'Die Datei konnte nicht verarbeitet werden.');
      }
    } finally {
      // Auswahl zurücksetzen, damit dieselbe Datei erneut gewählt werden kann.
      ui.fileInput.value = '';
    }
  }

  /**
   * Fügt den in der Eingabemaske eingegebenen Punkt hinzu.
   * @param {SubmitEvent} event - Formularereignis.
   */
  function handleAddPoint(event) {
    event.preventDefault();
    const result = ds.addPoint(ui.inX.value, ui.inY.value, ui.inLabel.value);
    if (!result.ok) {
      ui.formError.textContent = result.error;
      return;
    }
    ui.formError.textContent = '';
    ui.formInfo.textContent = 'Punkt ' + dom.describePoint(result.point) + ' hinzugefügt.';
    ui.inX.value = '';
    ui.inY.value = '';
    // Label bleibt stehen: so lassen sich mehrere Punkte einer Klasse schnell eingeben.
    ui.inX.focus();
  }

  /**
   * Übernimmt die Achsenbeschriftungen aus den Eingabefeldern.
   * @param {SubmitEvent} event - Formularereignis.
   */
  function handleAxisLabels(event) {
    event.preventDefault();
    ds.setAxisLabels(ui.axisX.value, ui.axisY.value);
  }

  /** Lädt die Beispieldaten (nach Rückfrage, falls schon Daten vorhanden sind). */
  function loadSample() {
    if (ds.size() > 0 && !window.confirm('Die vorhandenen Datenpunkte werden durch die Beispieldaten ersetzt. Fortfahren?')) {
      return;
    }
    ds.replaceAll(SAMPLE.points.map(([x, y, label]) => ({ x, y, label })), SAMPLE.axisLabels);
    state.selectedId = null;
    setImportStatus('success', 'Beispieldaten geladen (' + SAMPLE.points.length + ' Datenpunkte).');
  }

  /** Löscht alle Punkte (nach Rückfrage). */
  function clearAll() {
    if (ds.size() === 0) {
      return;
    }
    if (window.confirm('Alle ' + ds.size() + ' Datenpunkte löschen? Eintragungen auf den anderen Seiten gehen dabei verloren.')) {
      ds.clearAll();
      state.selectedId = null;
      ui.importStatus.hidden = true;
    }
  }

  /**
   * Wählt einen Punkt aus (Diagramm oder Tabelle) und hebt ihn hervor.
   * @param {number|null} id - Punkt-ID oder null.
   */
  function select(id) {
    state.selectedId = state.selectedId === id ? null : id;
    render();
    if (state.selectedId !== null) {
      const row = ui.tableBody.querySelector('tr.selected');
      if (row) {
        row.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  /**
   * Entfernt einen Punkt.
   * @param {number} id - Punkt-ID.
   */
  function remove(id) {
    const point = ds.getPoint(id);
    if (point && ds.removePoint(id)) {
      ui.formInfo.textContent = 'Punkt ' + dom.describePoint(point) + ' entfernt.';
      ui.tableHeading.focus();
    }
  }

  /**
   * Erzeugt eine Schaltfläche "Entfernen" für einen Punkt.
   * @param {Object} point - Datenpunkt.
   * @returns {HTMLButtonElement} Schaltfläche.
   */
  function removeButton(point) {
    const button = dom.el('button', { type: 'button', class: 'btn btn-small btn-danger', 'aria-label': 'Punkt ' + dom.describePoint(point) + ' entfernen' }, 'Entfernen');
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      remove(point.id);
    });
    return button;
  }

  /** Baut die Punkttabelle neu auf. */
  function renderTable() {
    const tbody = dom.clear(ui.tableBody);
    const points = ds.getPoints();
    for (const p of points) {
      const tr = dom.el('tr', { class: p.id === state.selectedId ? 'selected' : null }, [
        dom.el('td', null, '#' + p.id),
        dom.el('td', { class: 'num' }, dom.formatNumber(p.x)),
        dom.el('td', { class: 'num' }, dom.formatNumber(p.y)),
        dom.el('td', null, common.labelBadge(p.label)),
        dom.el('td', null, ds.isValidation(p.id) ? 'Validierung' : 'Training'),
        dom.el('td', null, removeButton(p))
      ]);
      tr.addEventListener('click', () => select(p.id));
      tbody.appendChild(tr);
    }
    ui.tableEmpty.hidden = points.length > 0;
    ui.count.textContent = points.length + ' Datenpunkte, ' + ds.getLabels().length + ' Labels';
  }

  /** Zeigt den ausgewählten Punkt mit Schaltfläche "Entfernen" unter dem Diagramm. */
  function renderSelection() {
    const box = dom.clear(ui.selection);
    const point = state.selectedId !== null ? ds.getPoint(state.selectedId) : null;
    if (!point) {
      box.hidden = true;
      return;
    }
    box.appendChild(dom.el('span', null, 'Ausgewählt: ' + dom.describePoint(point) + ' '));
    box.appendChild(removeButton(point));
    box.hidden = false;
  }

  /** Zeichnet die gesamte Seite neu. */
  function render() {
    const axis = ds.getAxisLabels();
    ui.axisX.value = axis.x;
    ui.axisY.value = axis.y;
    chart.render(Object.assign(common.baseView(), {
      validationIds: ds.getValidationIds(),
      selectedId: state.selectedId
    }));
    renderSelection();
    renderTable();
  }

  /** Initialisiert die Seite (einmalig beim Start). */
  function init() {
    ui = {
      fileInput: dom.byId('file-input'),
      importStatus: dom.byId('import-status'),
      pointForm: dom.byId('point-form'),
      inX: dom.byId('in-x'),
      inY: dom.byId('in-y'),
      inLabel: dom.byId('in-label'),
      formError: dom.byId('point-form-error'),
      formInfo: dom.byId('point-form-info'),
      axisForm: dom.byId('axis-form'),
      axisX: dom.byId('axis-x'),
      axisY: dom.byId('axis-y'),
      tableBody: dom.byId('training-tbody'),
      tableEmpty: dom.byId('training-empty'),
      tableHeading: dom.byId('training-table-heading'),
      count: dom.byId('training-count'),
      selection: dom.byId('training-selection')
    };
    ui.inLabel.maxLength = ds.LIMITS.maxLabelLength;
    ui.axisX.maxLength = ds.LIMITS.maxAxisLabelLength;
    ui.axisY.maxLength = ds.LIMITS.maxAxisLabelLength;
    chart = new ns.chart.ScatterChart(dom.byId('chart-training'), {
      ariaLabel: 'Diagramm der Trainingsdaten',
      onPointClick: (p) => select(p.id)
    });
    ui.fileInput.addEventListener('change', handleFile);
    ui.pointForm.addEventListener('submit', handleAddPoint);
    ui.axisForm.addEventListener('submit', handleAxisLabels);
    dom.byId('btn-sample').addEventListener('click', loadSample);
    dom.byId('btn-clear').addEventListener('click', clearAll);
  }

  /**
   * Reagiert auf Datenänderungen (auch von anderen Seiten).
   * @param {{type: string, ids?: number[]}} event - Änderung.
   */
  function onDataChange(event) {
    if (state.selectedId !== null && !ds.getPoint(state.selectedId)) {
      state.selectedId = null;
    }
    if (event.type === 'replace') {
      state.selectedId = null;
    }
  }

  ns.pages = ns.pages || {};
  ns.pages.training = { id: 'training', init, render, onDataChange };
})(window.KNN = window.KNN || {});
