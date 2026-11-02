/**
 * @file confusion.js
 * @description Seite 7 "Test und Konfusionsmatrix".
 *
 * Idee:
 *   Testdaten sind Punkte mit bekanntem Label, die nicht zum Training gehören.
 *   Jeder Testpunkt wird mit kNN anhand ALLER Trainingspunkte klassifiziert.
 *   Die Konfusionsmatrix zählt je Paar (tatsächliches Label, vorhergesagtes
 *   Label), wie viele Testpunkte darauf entfallen. Die Diagonale enthält die
 *   korrekten Klassifizierungen.
 *
 * Funktionen der Seite:
 *   - Datei-Upload der Testdaten (.csv, .xlsx, .ods; gleiche Prüfung wie auf
 *     Seite 1). Ein Upload ersetzt nach Rückfrage die vorhandenen Testdaten;
 *     die Trainingsdaten bleiben unverändert.
 *   - Eingabemaske für einzelne Testpunkte, Entfernen einzelner Testpunkte,
 *     "Alle Testdaten löschen".
 *   - Einstellung von k und Metrik.
 *   - Konfusionsmatrix: Zeilen und Spalten sind die Labels der aktuellen
 *     Trainingsdaten; ihre Größe passt sich bei jeder Änderung der
 *     Trainingsdaten an. Dazu Zeilen-/Spaltensummen und die Trefferquote.
 *   - Testpunkte, deren Label in den Trainingsdaten nicht vorkommt, bleiben
 *     gespeichert, werden aber als "nicht auswertbar" gekennzeichnet und
 *     nicht gezählt.
 *   - Diagramm aller Trainings- und Testpunkte (Testpunkte als Hohlmarker);
 *     ein ausgewählter Testpunkt wird mit seinen k nächsten Nachbarn gezeigt.
 *
 * Abhängigkeiten:
 *   dom-utils.js, dataset.js, data-import.js, knn.js, chart.js, pages/common.js
 *
 * Sicherheitsaspekte:
 *   - Alle Eingaben (Formular und Datei) werden über dataset.js geprüft
 *     (Zahlenformat, Wertebereich, Label-Whitelist, Höchstzahlen).
 *   - Uploads laufen durch dieselbe geprüfte Importfunktion wie auf Seite 1
 *     (Endungs-Whitelist, Größenlimit, Signaturprüfung, Zip-Bomben-Grenzen).
 *   - Ausgaben nur als Text; Einfärbung der Matrix ausschließlich über feste
 *     CSS-Klassen (keine style-Attribute).
 *   - Testdaten verlassen den Browser nicht.
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const ds = ns.dataset;
  const knn = ns.knn;
  const common = ns.common;

  /** Anzahl der Farbstufen in der Matrix (0 = leer, 1 … HEAT_STEPS). */
  const HEAT_STEPS = 5;

  /** Seitenzustand. */
  const state = {
    /** @type {number|null} ID des ausgewählten Testpunkts. */
    selectedId: null
  };

  /** Laufende Nummer des letzten gestarteten Datei-Imports. */
  let importCounter = 0;

  let ui = null;
  let chart = null;
  let metricSelector = null;
  let kControl = null;

  /**
   * Zeigt Meldungen im Statusbereich des Uploads an.
   * @param {string} type - "info", "success", "warning" oder "error".
   * @param {string} message - Hauptmeldung.
   * @param {string[]} [details] - Zusätzliche Zeilen.
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
   * Verarbeitet die ausgewählte Testdatei.
   * @returns {Promise<void>}
   */
  async function handleFile() {
    const file = ui.fileInput.files && ui.fileInput.files[0];
    if (!file) {
      return;
    }
    // Wettlauf verhindern: Nur das Ergebnis des zuletzt gestarteten Imports zählt.
    const importId = ++importCounter;
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
        setImportStatus('error', 'In der Datei wurden keine gültigen Testpunkte gefunden.', details);
        return;
      }
      if (ds.testSize() > 0 && !window.confirm('Die vorhandenen ' + ds.testSize() +
          ' Testpunkte werden durch die Daten aus der Datei ersetzt. Fortfahren?')) {
        setImportStatus('info', 'Import abgebrochen. Die bisherigen Testdaten bleiben erhalten.');
        return;
      }
      // Achsenbeschriftungen der Datei werden bewusst nicht übernommen:
      // Sie gehören zu den Trainingsdaten.
      const count = ds.replaceTestPoints(result.points);
      state.selectedId = null;
      if (result.limitReached) {
        details.unshift('Es wurden nur die ersten ' + ds.LIMITS.maxPoints + ' Testpunkte übernommen.');
      }
      if (result.skipped > 0) {
        details.unshift(result.skipped + ' Zeile(n) wurden übersprungen:');
      }
      const unknown = ds.getTestPoints().filter((p) => ds.labelIndex(p.label) < 0).length;
      if (unknown > 0) {
        details.push(unknown + ' Testpunkt(e) haben ein Label, das in den Trainingsdaten nicht vorkommt, und sind nicht auswertbar.');
      }
      setImportStatus(result.skipped > 0 || result.limitReached || unknown > 0 ? 'warning' : 'success',
        count + ' Testpunkte aus „' + fileName + '“ übernommen.', details);
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
   * Fügt den in der Eingabemaske eingegebenen Testpunkt hinzu.
   * @param {SubmitEvent} event - Formularereignis.
   */
  function handleAddPoint(event) {
    event.preventDefault();
    const result = ds.addTestPoint(ui.inX.value, ui.inY.value, ui.inLabel.value);
    if (!result.ok) {
      ui.formError.textContent = result.error;
      return;
    }
    ui.formError.textContent = '';
    ui.formInfo.textContent = 'Testpunkt ' + dom.describePoint(result.point) + ' hinzugefügt.' +
      (ds.labelIndex(result.point.label) < 0
        ? ' Hinweis: Dieses Label kommt in den Trainingsdaten nicht vor; der Punkt ist nicht auswertbar.'
        : '');
    ui.inX.value = '';
    ui.inY.value = '';
    ui.inX.focus();
  }

  /** Löscht alle Testpunkte (nach Rückfrage). */
  function clearAll() {
    if (ds.testSize() === 0) {
      return;
    }
    if (window.confirm('Alle ' + ds.testSize() + ' Testpunkte löschen? Die Trainingsdaten bleiben erhalten.')) {
      ds.clearTestPoints();
      ui.importStatus.hidden = true;
      ui.formInfo.textContent = '';
    }
  }

  /**
   * Entfernt einen Testpunkt.
   * @param {number} id - ID des Testpunkts.
   */
  function remove(id) {
    const point = ds.getTestPoint(id);
    if (point && ds.removeTestPoint(id)) {
      ui.formInfo.textContent = 'Testpunkt ' + dom.describePoint(point) + ' entfernt.';
      ui.tableHeading.focus();
    }
  }

  /**
   * Wählt einen Testpunkt aus (erneuter Klick hebt die Auswahl auf).
   * Klicks auf Trainingspunkte im Diagramm werden ignoriert.
   * @param {number} id - Punkt-ID.
   */
  function select(id) {
    if (!ds.getTestPoint(id)) {
      return;
    }
    state.selectedId = state.selectedId === id ? null : id;
    render();
  }

  /**
   * Klassifiziert alle Testpunkte.
   * @param {string[]} labels - Labels der Trainingsdaten.
   * @param {number} k - Anzahl der Nachbarn.
   * @param {string} metric - Metrik.
   * @returns {Array<{point: Object, evaluable: boolean, predicted: (string|null), tie: boolean, correct: boolean}>}
   *          Ergebnis je Testpunkt (in Eingabereihenfolge).
   */
  function classifyAll(labels, k, metric) {
    const training = ds.getPoints();
    const known = new Set(labels);
    return ds.getTestPoints().map((point) => {
      if (training.length === 0) {
        return { point, evaluable: false, predicted: null, tie: false, correct: false };
      }
      const r = knn.classify(training, point, k, metric);
      const evaluable = known.has(point.label);
      return { point, evaluable, predicted: r.label, tie: r.tie, correct: evaluable && r.label === point.label };
    });
  }

  /**
   * Zählt die Konfusionsmatrix aus.
   * @param {string[]} labels - Labels (Reihenfolge der Zeilen und Spalten).
   * @param {Array} results - Ergebnisse aus {@link classifyAll}.
   * @returns {{counts: number[][], rowSums: number[], colSums: number[], total: number, correct: number}} Matrix.
   */
  function buildCounts(labels, results) {
    const index = new Map(labels.map((label, i) => [label, i]));
    const counts = labels.map(() => labels.map(() => 0));
    const rowSums = labels.map(() => 0);
    const colSums = labels.map(() => 0);
    let total = 0;
    let correct = 0;
    for (const r of results) {
      if (!r.evaluable || !index.has(r.predicted)) {
        continue;
      }
      const row = index.get(r.point.label);
      const col = index.get(r.predicted);
      counts[row][col]++;
      rowSums[row]++;
      colSums[col]++;
      total++;
      if (row === col) {
        correct++;
      }
    }
    return { counts, rowSums, colSums, total, correct };
  }

  /**
   * Baut die Konfusionsmatrix als Tabelle.
   * @param {string[]} labels - Labels.
   * @param {Object} m - Ergebnis aus {@link buildCounts}.
   * @param {number} k - Verwendetes k.
   * @param {string} metric - Verwendete Metrik.
   * @returns {HTMLElement} Tabelle im Scroll-Container.
   */
  function buildMatrixTable(labels, m, k, metric) {
    const head = dom.el('tr', null, [
      dom.el('th', { scope: 'col', class: 'cm-corner' }, [
        dom.el('span', { class: 'cm-axis' }, 'tatsächlich ↓'),
        dom.el('span', { class: 'cm-axis' }, 'vorhergesagt →')
      ])
    ]);
    for (const label of labels) {
      head.appendChild(dom.el('th', { scope: 'col' }, common.labelBadge(label)));
    }
    head.appendChild(dom.el('th', { scope: 'col', class: 'cm-sum' }, 'Summe'));

    const tbody = dom.el('tbody');
    labels.forEach((actual, row) => {
      const tr = dom.el('tr', null, [dom.el('th', { scope: 'row' }, common.labelBadge(actual))]);
      labels.forEach((predicted, col) => {
        const count = m.counts[row][col];
        const share = m.rowSums[row] > 0 ? count / m.rowSums[row] : 0;
        const step = count === 0 ? 0 : Math.max(1, Math.ceil(share * HEAT_STEPS));
        tr.appendChild(dom.el('td', {
          class: 'cm-cell ' + (row === col ? 'cm-diag' : 'cm-off') + ' cm-h' + step,
          title: 'tatsächlich ' + actual + ', vorhergesagt ' + predicted + ': ' + count +
            (count === 1 ? ' Testpunkt' : ' Testpunkte') + (row === col ? ' (korrekt)' : ' (falsch)')
        }, String(count)));
      });
      tr.appendChild(dom.el('td', { class: 'cm-sum' }, String(m.rowSums[row])));
      tbody.appendChild(tr);
    });

    const foot = dom.el('tr', null, [dom.el('th', { scope: 'row', class: 'cm-sum' }, 'Summe')]);
    for (const sum of m.colSums) {
      foot.appendChild(dom.el('td', { class: 'cm-sum' }, String(sum)));
    }
    foot.appendChild(dom.el('td', { class: 'cm-sum cm-total' }, String(m.total)));

    const metricName = knn.METRICS[metric] ? knn.METRICS[metric].name : metric;
    return dom.el('div', { class: 'table-wrap' }, dom.el('table', { class: 'data-table confusion-matrix' }, [
      dom.el('caption', null, 'Konfusionsmatrix für k = ' + k + ', ' + metricName +
        ' (Zeilen = tatsächliches Label, Spalten = vorhergesagtes Label; Diagonale = korrekt)'),
      dom.el('thead', null, head),
      tbody,
      dom.el('tfoot', null, foot)
    ]));
  }

  /**
   * Zeichnet Zusammenfassung und Matrix.
   * @param {string[]} labels - Labels.
   * @param {Array} results - Ergebnisse je Testpunkt.
   * @param {number} k - Verwendetes k.
   * @param {string} metric - Metrik.
   */
  function renderMatrix(labels, results, k, metric) {
    const summary = dom.clear(ui.summary);
    const container = dom.clear(ui.matrix);
    const m = buildCounts(labels, results);
    const excluded = results.filter((r) => !r.evaluable).length;
    if (results.length === 0) {
      summary.appendChild(dom.el('p', null, 'Noch keine Testdaten vorhanden. Laden Sie eine Datei hoch oder geben Sie einzelne Testpunkte ein.'));
    } else if (m.total === 0) {
      summary.appendChild(dom.el('p', null, 'Keiner der Testpunkte ist auswertbar.'));
    } else {
      summary.appendChild(dom.el('p', { class: 'result-main' }, m.correct + ' von ' + m.total +
        ' auswertbaren Testpunkten korrekt klassifiziert (Trefferquote ' + dom.formatPercent(m.correct / m.total) + ').'));
    }
    if (excluded > 0) {
      summary.appendChild(dom.el('p', { class: 'hint-tie' }, excluded + ' Testpunkt(e) sind nicht auswertbar, weil ihr Label in den ' +
        'Trainingsdaten nicht vorkommt. Sie werden in der Matrix nicht gezählt.'));
    }
    container.appendChild(buildMatrixTable(labels, m, k, metric));
  }

  /**
   * Erzeugt eine Schaltfläche "Entfernen" für einen Testpunkt.
   * @param {Object} point - Testpunkt.
   * @returns {HTMLButtonElement} Schaltfläche.
   */
  function removeButton(point) {
    const button = dom.el('button', { type: 'button', class: 'btn btn-small btn-danger', 'aria-label': 'Testpunkt ' + dom.describePoint(point) + ' entfernen' }, 'Entfernen');
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      remove(point.id);
    });
    return button;
  }

  /**
   * Baut die Tabelle der Testpunkte.
   * @param {Array} results - Ergebnisse je Testpunkt.
   * @param {boolean} hasTraining - true, wenn Trainingsdaten vorhanden sind.
   */
  function renderTable(results, hasTraining) {
    const tbody = dom.clear(ui.tableBody);
    for (const r of results) {
      const p = r.point;
      let resultText = '–';
      let rowClass = null;
      if (hasTraining && !r.evaluable) {
        resultText = 'nicht auswertbar';
      } else if (hasTraining) {
        resultText = r.correct ? '✓ korrekt' : '✗ falsch';
        rowClass = r.correct ? 'row-ok' : 'row-wrong';
      }
      if (p.id === state.selectedId) {
        rowClass = (rowClass ? rowClass + ' ' : '') + 'selected';
      }
      const predicted = [r.predicted !== null ? common.labelBadge(r.predicted) : '–'];
      if (r.tie) {
        predicted.push(' (Gleichstand)');
      }
      const tr = dom.el('tr', { class: rowClass }, [
        dom.el('td', null, '#' + p.id),
        dom.el('td', { class: 'num' }, dom.formatNumber(p.x)),
        dom.el('td', { class: 'num' }, dom.formatNumber(p.y)),
        dom.el('td', null, common.labelBadge(p.label)),
        dom.el('td', null, predicted),
        dom.el('td', { class: 'result-cell' }, resultText),
        dom.el('td', null, removeButton(p))
      ]);
      tr.addEventListener('click', () => select(p.id));
      tbody.appendChild(tr);
    }
    ui.tableEmpty.hidden = results.length > 0;
    ui.count.textContent = results.length + ' Testpunkte';
  }

  /** Zeichnet die Seite neu. */
  function render() {
    const training = ds.getPoints();
    const labels = ds.getLabels();
    const metric = metricSelector.get();
    kControl.setMax(training.length);
    const k = Math.min(kControl.get(), Math.max(training.length, 1));
    const results = classifyAll(labels, k, metric);
    const testIds = new Set(results.map((r) => r.point.id));

    if (training.length === 0) {
      common.showNotice(ui.notice, 'Für die Klassifizierung der Testdaten werden Trainingsdaten benötigt.', true);
      ui.results.hidden = true;
    } else {
      common.showNotice(ui.notice, null);
      ui.results.hidden = false;
      renderMatrix(labels, results, k, metric);
    }
    renderTable(results, training.length > 0);

    const view = Object.assign(common.baseView(training.concat(ds.getTestPoints())), {
      validationIds: testIds,
      hollowName: 'Testpunkt',
      selectedId: state.selectedId
    });
    const target = state.selectedId !== null ? ds.getTestPoint(state.selectedId) : null;
    if (target && training.length > 0) {
      const r = knn.classify(training, target, k, metric);
      Object.assign(view, { origin: target, neighbors: r.neighbors, metric, radius: r.radius });
      ui.chartInfo.textContent = 'Diagramm: Testpunkt ' + dom.describePoint(target) + ' mit seinen k = ' + r.k +
        ' nächsten Nachbarn aus den Trainingsdaten. Vorhergesagt: ' + (r.label === null ? '–' : r.label) + '.';
    } else {
      ui.chartInfo.textContent = testIds.size > 0
        ? 'Klicken Sie auf einen Testpunkt (Hohlmarker) oder eine Tabellenzeile, um seine Nachbarn zu sehen.'
        : '';
    }
    chart.render(view);
  }

  /** Initialisiert die Seite (einmalig beim Start). */
  function init() {
    ui = {
      notice: dom.byId('notice-confusion'),
      fileInput: dom.byId('test-file-input'),
      importStatus: dom.byId('test-import-status'),
      pointForm: dom.byId('test-point-form'),
      inX: dom.byId('test-in-x'),
      inY: dom.byId('test-in-y'),
      inLabel: dom.byId('test-in-label'),
      formError: dom.byId('test-form-error'),
      formInfo: dom.byId('test-form-info'),
      results: dom.byId('cm-results'),
      summary: dom.byId('cm-summary'),
      matrix: dom.byId('cm-matrix'),
      chartInfo: dom.byId('cm-chart-info'),
      tableBody: dom.byId('test-tbody'),
      tableEmpty: dom.byId('test-empty'),
      tableHeading: dom.byId('test-table-heading'),
      count: dom.byId('test-count')
    };
    ui.inLabel.maxLength = ds.LIMITS.maxLabelLength;
    chart = new ns.chart.ScatterChart(dom.byId('chart-confusion'), {
      ariaLabel: 'Diagramm der Trainings- und Testdaten',
      onPointClick: (p) => select(p.id)
    });
    metricSelector = new common.MetricSelector(dom.byId('metric-confusion'), render);
    kControl = new common.KControl(dom.byId('k-confusion'), 'Anzahl der Nachbarn k', render, 3);
    ui.fileInput.addEventListener('change', handleFile);
    ui.pointForm.addEventListener('submit', handleAddPoint);
    dom.byId('btn-test-clear').addEventListener('click', clearAll);
  }

  /** Änderungen der Trainingsdaten: render() rechnet ohnehin alles neu. */
  function onDataChange() {}

  /**
   * Reagiert auf Änderungen der Testdaten.
   * @param {{type: string}} event - Änderung.
   */
  function onTestChange(event) {
    if (event.type === 'replace' || (state.selectedId !== null && !ds.getTestPoint(state.selectedId))) {
      state.selectedId = null;
    }
  }

  ns.pages = ns.pages || {};
  ns.pages.confusion = { id: 'confusion', init, render, onDataChange, onTestChange };
})(window.KNN = window.KNN || {});
