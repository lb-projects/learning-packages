// Kopie aus shared/js/data-panel.js – nicht hier bearbeiten: Änderungen in shared/ vornehmen und sync-shared.mjs ausführen.
/**
 * @file data-panel.js
 * @description Eingabe der Trainingspunkte: Upload, Beispielauswahl mit Stufen, Punktmaske und Punktetabelle.
 *
 * Beispiele (Option samples) haben diese Form:
 *   {id, title, points, stages: [{title, addText, note, points, total, text, groups: [{name, count}]}]}
 *   - points: Punkte des ganzen Beispiels; bei einer Stufe ist es ein einfacher Datensatz.
 *   - title: Bezeichnung der Stufe; addText: Wortlaut der Schaltfläche, z. B. „Beagle hinzufügen“.
 *   - note: Erklärung zur Stufe; points: neue Punkte; total: Punkte einschließlich der früheren Stufen.
 *   - text: CSV-Inhalt nur mit den neuen Punkten.
 *   - groups: Bezeichnungen der Punktgruppen in der Reihenfolge der Zeilen.
 *
 * Mehrstufige Beispiele:
 *   Die Auswahl lädt Stufe 1, nextStage() ergänzt die jeweils nächste. Das Paket erfährt einen
 *   Wechsel über die Änderungsmeldung des Datensatzes: {sample, stage, mode}, mit mode
 *   'continue' (mit den aktuellen Gewichten weiter) oder 'restart' (mit den Startwerten neu).
 *   stageCard() zeigt die Bedienung und lässt sich auf mehreren Seiten verwenden.
 *   Upload und „Alle entfernen“ beenden das Beispiel.
 *
 * Gemeinsamer Code der Simulator-Pakete (Quelle: shared/js/data-panel.js).
 *
 * Abhängigkeiten:
 *   dom-utils.js, sim-format.js, point-data.js, point-import.js
 *
 * Sicherheitsaspekte:
 *   Alle Inhalte aus Dateien werden nur als Text eingefügt. Eine ältere, langsam gelesene
 *   Datei kann das Ergebnis einer neueren nicht überschreiben.
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;

  /**
   * Kleines Eingabefeld mit Beschriftung.
   * @param {string} id - Element-ID.
   * @param {string} text - Beschriftung.
   * @param {Object} [attrs] - Weitere Attribute.
   * @returns {{root:HTMLElement, input:HTMLInputElement, label:HTMLElement}} Teile des Felds.
   */
  function field(id, text, attrs) {
    const label = dom.el('label', { for: id }, text);
    const input = dom.el('input', { type: 'text', id, autocomplete: 'off', ...attrs });
    return { root: dom.el('div', { class: 'field' }, [label, input]), input, label };
  }

  /**
   * Erzeugt die Eingabe der Trainingspunkte.
   *
   * @param {HTMLElement} container - Behälter für „Daten laden“ (wird geleert).
   * @param {{data:Object, samples:Array<Object>, idPrefix?:string, formatHelp?:Node[],
   *          formContainer?:HTMLElement, listContainer?:HTMLElement}} options - Datensatz, Beispiele, Präfix für
   *   Element-IDs, Erklärung des Dateiformats, eigene Behälter für Punktmaske und Punktetabelle
   *   (ohne Angabe landen beide in container).
   * @returns {Object} Steuerung (siehe Rückgabe am Ende der Funktion).
   */
  function create(container, options) {
    const data = options.data;
    const samples = options.samples || [];
    const prefix = options.idPrefix || 'data';
    const format = ns.simFormat;
    let current = null;
    let stageMode = 'continue';
    let importToken = 0;
    const cards = [];

    // ----- Laden -----
    const fileInput = dom.el('input', { type: 'file', id: prefix + '-file', accept: '.csv,text/csv' });
    const radioReplace = dom.el('input', { type: 'radio', name: prefix + '-upload-mode', id: prefix + '-replace', value: 'replace', checked: true });
    const radioAppend = dom.el('input', { type: 'radio', name: prefix + '-upload-mode', id: prefix + '-append', value: 'append' });
    const status = dom.el('div', { class: 'status', id: prefix + '-status', role: 'status', 'aria-live': 'polite', hidden: true });
    const sampleSelect = dom.el('select', { id: prefix + '-sample' }, samples.map((s) => dom.el('option', { value: s.id }, sampleText(s))));
    const sampleButton = dom.el('button', { type: 'button', class: 'btn', id: prefix + '-sample-load' }, 'Beispiel laden');
    const loadCard = dom.el('div', { class: 'card' }, [
      dom.el('h3', null, 'Daten laden'),
      dom.el('label', { class: 'file-label', for: fileInput.id }, 'CSV-Datei auswählen (höchstens 2 MB)'),
      fileInput,
      dom.el('fieldset', { class: 'radio-group' }, [
        dom.el('legend', null, 'Vorhandene Punkte'),
        dom.el('label', { class: 'radio' }, [radioReplace, ' ersetzen']),
        dom.el('label', { class: 'radio' }, [radioAppend, ' ergänzen'])
      ]),
      samples.length ? dom.el('div', { class: 'sample-row' }, [
        dom.el('label', { for: sampleSelect.id }, 'Beispiel'),
        dom.el('div', { class: 'inline-row' }, [sampleSelect, sampleButton])
      ]) : null,
      status,
      options.formatHelp ? dom.el('details', { class: 'format-help' }, [dom.el('summary', null, 'Dateiformat'), ...options.formatHelp]) : null
    ]);

    // ----- Punkt hinzufügen -----
    const fieldX = field(prefix + '-x', 'x₁', { inputmode: 'decimal' });
    const fieldY = field(prefix + '-y', 'x₂', { inputmode: 'decimal' });
    const labelList = dom.el('datalist', { id: prefix + '-labels' });
    const fieldLabel = field(prefix + '-label', 'Label', { list: labelList.id, maxlength: ns.pointData.LIMITS.maxLabelLength });
    const formError = dom.el('p', { class: 'error', id: prefix + '-form-error', role: 'alert' });
    const form = dom.el('form', { class: 'card', id: prefix + '-form', novalidate: true, autocomplete: 'off' }, [
      dom.el('h3', null, 'Punkt hinzufügen'),
      dom.el('div', { class: 'field-row' }, [fieldX.root, fieldY.root, fieldLabel.root]),
      labelList,
      dom.el('button', { type: 'submit', class: 'btn btn-primary' }, 'Hinzufügen'),
      formError
    ]);

    // ----- Punkte -----
    const count = dom.el('span', { class: 'count', id: prefix + '-count' });
    const headRow = dom.el('tr');
    const tbody = dom.el('tbody', { id: prefix + '-tbody' });
    const clearButton = dom.el('button', { type: 'button', class: 'btn btn-danger', id: prefix + '-clear' }, 'Alle entfernen');
    const listCard = dom.el('div', { class: 'card' }, [
      dom.el('h3', null, ['Punkte ', count]),
      dom.el('div', { class: 'table-scroll table-scroll-limited' }, dom.el('table', { class: 'data-table', id: prefix + '-table' }, [dom.el('thead', null, headRow), tbody])),
      dom.el('div', { class: 'button-row' }, clearButton)
    ]);

    const formBox = options.formContainer || container;
    const listBox = options.listContainer || container;
    for (const box of new Set([container, formBox, listBox])) {
      dom.clear(box);
    }
    container.appendChild(loadCard);
    formBox.appendChild(form);
    listBox.appendChild(listCard);

    /**
     * Text einer Zeile der Beispielauswahl.
     * @param {Object} sample - Beispiel.
     * @returns {string} z. B. „AND (4 Punkte)“.
     */
    function sampleText(sample) {
      if (sample.stages.length > 1) {
        return sample.title + ' (' + sample.stages.length + ' Stufen, ' + sample.stages[0].total + ' bis ' + sample.points + ' Punkte)';
      }
      return sample.title + ' (' + format.plural(sample.points, 'Punkt', 'Punkte') + ')';
    }

    /**
     * Zeigt das Ergebnis eines Ladevorgangs.
     * @param {string} kind - '', 'success' oder 'error'.
     * @param {string} text - Haupttext.
     * @param {string[]} [details] - Einzelne Meldungen.
     */
    function showStatus(kind, text, details) {
      dom.clear(status);
      status.className = 'status' + (kind ? ' status-' + kind : '');
      status.appendChild(dom.el('p', null, text));
      if (details && details.length) {
        status.appendChild(dom.el('ul', null, details.map((d) => dom.el('li', null, d))));
      }
      status.hidden = false;
    }

    /**
     * Wandelt eine Stufe in geprüfte Punkte um.
     * @param {Object} stage - Stufe.
     * @param {number} number - Nummer ab 1.
     * @param {string[]} known - Vorhandene Labels.
     * @returns {{points:Array<Object>, attributes:Object}} Punkte mit Gruppe und Stufe.
     */
    function stagePoints(stage, number, known) {
      const parsed = ns.pointImport.parseText(stage.text, { knownLabels: known, maxLabels: data.maxLabels() });
      const groups = [];
      for (const g of stage.groups) {
        for (let i = 0; i < g.count; i++) {
          groups.push(g.name);
        }
      }
      return {
        attributes: parsed.attributes,
        points: parsed.points.map((p, i) => ({ ...p, group: groups[i] || null, stage: number }))
      };
    }

    /**
     * Lädt ein Beispiel ab Stufe 1.
     * @param {string} id - Kennung.
     */
    function loadSample(id) {
      const sample = samples.find((s) => s.id === id);
      if (!sample) {
        return;
      }
      importToken++;
      const first = stagePoints(sample.stages[0], 1, []);
      current = { sample, index: 0 };
      data.replaceAll(first.points, first.attributes, { sample: sample.id, stage: 1, mode: 'restart' });
      sampleSelect.value = id;
      showStatus('success', '„' + sample.title + '“ geladen: ' + format.plural(first.points.length, 'Punkt', 'Punkte') + '.', sample.stages.length === 1 ? [sample.stages[0].note] : []);
    }

    /**
     * Ergänzt die nächste Stufe des geladenen Beispiels.
     * @param {string} [mode] - 'continue' oder 'restart'; ohne Angabe gilt die Auswahl in der Stufenkarte.
     */
    function nextStage(mode) {
      if (!current || current.index + 1 >= current.sample.stages.length) {
        return;
      }
      const number = current.index + 2;
      const stage = current.sample.stages[current.index + 1];
      const next = stagePoints(stage, number, data.labels());
      current.index++;
      data.appendAll(next.points, next.attributes, { sample: current.sample.id, stage: number, mode: mode || stageMode });
      showStatus('success', 'Stufe ' + number + ' geladen: ' + format.plural(next.points.length, 'Punkt', 'Punkte') + ' ergänzt.');
    }

    /**
     * Liest die gewählte Datei ein.
     * @param {File} file - Datei.
     */
    async function upload(file) {
      const token = ++importToken;
      const append = radioAppend.checked;
      try {
        const result = await ns.pointImport.importFile(file, { knownLabels: append ? data.labels() : [], maxLabels: data.maxLabels() });
        if (token !== importToken) {
          return;
        }
        if (result.points.length === 0) {
          throw new Error('Die Datei enthält keine gültigen Punkte.' + (result.errors.length ? ' ' + result.errors[0] : ''));
        }
        const notes = [...result.errors];
        if (result.skipped > result.errors.length) {
          notes.push('… und ' + (result.skipped - result.errors.length) + ' weitere fehlerhafte Zeilen.');
        }
        if (result.limitReached) {
          notes.push('Es wurden nur die ersten ' + ns.pointData.LIMITS.maxPoints + ' Punkte übernommen.');
        }
        current = null;
        const attrs = data.attributes();
        if (append && data.count() > 0 && (attrs.x !== result.attributes.x || attrs.y !== result.attributes.y)) {
          notes.push('Die Namen der Attribute weichen ab; die bisherigen Namen bleiben bestehen.');
        }
        const room = ns.pointData.LIMITS.maxPoints - (append ? data.count() : 0);
        const points = result.points.slice(0, Math.max(0, room));
        if (points.length < result.points.length) {
          notes.push('Es sind höchstens ' + ns.pointData.LIMITS.maxPoints + ' Punkte möglich; ' + (result.points.length - points.length) + ' wurden nicht übernommen.');
        }
        if (append) {
          data.appendAll(points, result.attributes);
        } else {
          data.replaceAll(points, result.attributes);
        }
        showStatus(notes.length ? '' : 'success', format.plural(points.length, 'Punkt', 'Punkte') + (append ? ' ergänzt.' : ' geladen.'), notes);
      } catch (error) {
        if (token === importToken) {
          showStatus('error', error.message);
        }
      } finally {
        fileInput.value = '';
      }
    }

    /** Baut Beschriftungen, Vorschläge und Tabelle aus dem Datensatz neu auf. */
    function refresh() {
      const attrs = data.attributes();
      const points = data.points();
      const hasGroups = points.some((p) => p.group);
      fieldX.label.textContent = attrs.x;
      fieldY.label.textContent = attrs.y;
      count.textContent = '(' + points.length + ')';
      clearButton.disabled = points.length === 0;
      dom.clear(labelList);
      const suggestions = data.labels().length ? data.labels() : ['1', '0'];
      for (const l of suggestions) {
        labelList.appendChild(dom.el('option', { value: l }));
      }
      dom.clear(headRow);
      dom.appendChildren(headRow, [
        dom.el('th', { scope: 'col', class: 'num' }, 'Nr.'),
        dom.el('th', { scope: 'col', class: 'num' }, attrs.x),
        dom.el('th', { scope: 'col', class: 'num' }, attrs.y),
        dom.el('th', { scope: 'col' }, 'Label'),
        hasGroups ? dom.el('th', { scope: 'col' }, 'Stufe, Gruppe') : null,
        dom.el('th', { scope: 'col' }, dom.el('span', { class: 'visually-hidden' }, 'Aktion'))
      ]);
      dom.clear(tbody);
      points.forEach((p, i) => {
        const button = dom.el('button', { type: 'button', class: 'btn btn-small', 'aria-label': 'Punkt ' + (i + 1) + ' entfernen' }, 'Entfernen');
        button.addEventListener('click', () => data.remove(p.id));
        tbody.appendChild(dom.el('tr', null, [
          dom.el('td', { class: 'num' }, i + 1),
          dom.el('td', { class: 'num' }, format.num(p.x)),
          dom.el('td', { class: 'num' }, format.num(p.y)),
          dom.el('td', null, p.label),
          hasGroups ? dom.el('td', null, p.group ? p.stage + ', ' + p.group : '–') : null,
          dom.el('td', null, button)
        ]));
      });
      refreshCards();
    }

    /**
     * Angaben zur Stufe.
     * @returns {{sample:Object, index:number, total:number, stage:Object, next:(Object|null)}|null} Stand oder null.
     */
    function stageInfo() {
      if (!current || current.sample.stages.length < 2) {
        return null;
      }
      const stages = current.sample.stages;
      return { sample: current.sample, index: current.index, total: stages.length, stage: stages[current.index], next: stages[current.index + 1] || null };
    }

    /** Aktualisiert alle Stufenkarten. */
    function refreshCards() {
      for (const fn of cards) {
        fn();
      }
    }

    /**
     * Bedienung der Stufen in einem weiteren Behälter.
     * @param {HTMLElement} box - Behälter (wird geleert).
     * @param {string} id - Präfix für Element-IDs.
     */
    function stageCard(box, id) {
      const title = dom.el('h3', { id: id + '-title' });
      const note = dom.el('p', { id: id + '-note' });
      const radioContinue = dom.el('input', { type: 'radio', name: id + '-mode', id: id + '-continue', value: 'continue', checked: true });
      const radioRestart = dom.el('input', { type: 'radio', name: id + '-mode', id: id + '-restart', value: 'restart' });
      const modes = dom.el('fieldset', { class: 'radio-group' }, [
        dom.el('legend', null, 'Beim Wechsel zur nächsten Stufe'),
        dom.el('label', { class: 'radio' }, [radioContinue, ' mit aktuellen Gewichten weitertrainieren']),
        dom.el('label', { class: 'radio' }, [radioRestart, ' mit den Startwerten neu beginnen'])
      ]);
      const button = dom.el('button', { type: 'button', class: 'btn btn-primary', id: id + '-next' });
      const finished = dom.el('p', { class: 'hint', id: id + '-end' }, 'Das ist die letzte Stufe dieses Beispiels.');
      const card = dom.el('div', { class: 'card stage-card', id: id, hidden: true }, [title, note, modes, button, finished]);
      dom.clear(box);
      box.appendChild(card);
      for (const radio of [radioContinue, radioRestart]) {
        radio.addEventListener('change', () => {
          stageMode = radio.value;
          refreshCards();
        });
      }
      button.addEventListener('click', () => nextStage());
      cards.push(() => {
        const info = stageInfo();
        card.hidden = !info;
        if (!info) {
          return;
        }
        title.textContent = info.sample.title + ': Stufe ' + (info.index + 1) + ' von ' + info.total;
        note.textContent = info.stage.note;
        radioContinue.checked = stageMode === 'continue';
        radioRestart.checked = stageMode === 'restart';
        modes.hidden = !info.next;
        button.hidden = !info.next;
        finished.hidden = Boolean(info.next);
        if (info.next) {
          button.textContent = 'Stufe ' + (info.index + 2) + ': ' + info.next.addText + ' (+' + format.plural(info.next.points, 'Punkt', 'Punkte') + ')';
        }
      });
      refreshCards();
    }

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        upload(fileInput.files[0]);
      }
    });
    sampleButton.addEventListener('click', () => loadSample(sampleSelect.value));
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const result = data.add(fieldX.input.value, fieldY.input.value, fieldLabel.input.value);
      formError.textContent = result.ok ? '' : result.error;
      if (result.ok) {
        fieldX.input.value = '';
        fieldY.input.value = '';
        fieldX.input.focus();
      }
    });
    clearButton.addEventListener('click', () => {
      current = null;
      importToken++;
      data.clear();
      status.hidden = true;
    });
    data.onChange((event) => {
      if (event.type === 'clear') {
        current = null;
      }
      refresh();
    });
    refresh();

    return { refresh, stageInfo, stageCard, loadSample, nextStage, setStageMode: (mode) => { stageMode = mode; refreshCards(); } };
  }

  ns.dataPanel = { create };
})(window.BB = window.BB || {});
