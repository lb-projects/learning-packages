/**
 * @file cluster-panel.js
 * @description Eingabe der Daten: Upload, Beispielauswahl, Punktmaske und Punktetabelle.
 *
 * Beispiele haben die Form {id, title, note, points, text}. Der Titel und die Meldung nach dem Laden
 * sind neutral: Sie nennen nur, was die Daten sind, nie das Besondere an ihnen.
 *
 * Abhängigkeiten:
 *   dom-utils.js, sim-format.js, cluster-data.js, cluster-import.js
 *
 * Sicherheitsaspekte:
 *   Alle Inhalte aus Dateien werden nur als Text eingefügt. Eine ältere, langsam gelesene
 *   Datei kann das Ergebnis einer neueren nicht überschreiben.
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;

  /**
   * Eingabefeld mit Beschriftung.
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
   * Erzeugt die Eingabe der Daten.
   *
   * @param {HTMLElement} container - Behälter für „Daten laden“ (wird geleert).
   * @param {{data:Object, samples:Array<Object>, formatHelp?:Node[], formContainer:HTMLElement,
   *          listContainer:HTMLElement, scaled?:function(number):(number[]|null)}} options - Datensatz,
   *   Beispiele, Erklärung des Dateiformats, Behälter für Maske und Tabelle, skalierte Werte je Punkt.
   * @returns {{refresh:function():void, loadSample:function(string):void}} Steuerung.
   */
  function create(container, options) {
    const data = options.data;
    const samples = options.samples || [];
    const format = ns.simFormat;
    let importToken = 0;

    const fileInput = dom.el('input', { type: 'file', id: 'data-file', accept: '.csv,text/csv' });
    const radioReplace = dom.el('input', { type: 'radio', name: 'data-upload-mode', id: 'data-replace', value: 'replace', checked: true });
    const radioAppend = dom.el('input', { type: 'radio', name: 'data-upload-mode', id: 'data-append', value: 'append' });
    const status = dom.el('div', { class: 'status', id: 'data-status', role: 'status', 'aria-live': 'polite', hidden: true });
    const sampleSelect = dom.el('select', { id: 'data-sample' }, samples.map((s) => dom.el('option', { value: s.id }, s.title + ' (' + format.plural(s.points, 'Punkt', 'Punkte') + ')')));
    const sampleButton = dom.el('button', { type: 'button', class: 'btn', id: 'data-sample-load' }, 'Beispiel laden');

    dom.clear(container);
    container.appendChild(dom.el('div', { class: 'card' }, [
      dom.el('h3', null, 'Daten laden'),
      dom.el('label', { class: 'file-label', for: fileInput.id }, 'CSV-Datei auswählen (höchstens 2 MB)'),
      fileInput,
      dom.el('fieldset', { class: 'radio-group' }, [
        dom.el('legend', null, 'Vorhandene Punkte'),
        dom.el('label', { class: 'radio' }, [radioReplace, ' ersetzen']),
        dom.el('label', { class: 'radio' }, [radioAppend, ' ergänzen'])
      ]),
      dom.el('div', { class: 'sample-row' }, [
        dom.el('label', { for: sampleSelect.id }, 'Beispiel'),
        dom.el('div', { class: 'inline-row' }, [sampleSelect, sampleButton])
      ]),
      status,
      options.formatHelp ? dom.el('details', { class: 'format-help' }, [dom.el('summary', null, 'Dateiformat'), ...options.formatHelp]) : null
    ]));

    const fieldName = field('data-name', 'Objektbezeichner (optional)', { maxlength: ns.clusterData.LIMITS.maxNameLength });
    const fieldX = field('data-x', 'x₁', { inputmode: 'decimal' });
    const fieldY = field('data-y', 'x₂', { inputmode: 'decimal' });
    const formError = dom.el('p', { class: 'error', id: 'data-form-error', role: 'alert' });
    const form = dom.el('form', { class: 'card', id: 'data-form', novalidate: true, autocomplete: 'off' }, [
      dom.el('h3', null, 'Punkt hinzufügen'),
      dom.el('div', { class: 'field-row' }, [fieldName.root, fieldX.root, fieldY.root]),
      dom.el('button', { type: 'submit', class: 'btn btn-primary' }, 'Hinzufügen'),
      formError
    ]);
    dom.clear(options.formContainer);
    options.formContainer.appendChild(form);

    const count = dom.el('span', { class: 'count', id: 'data-count' });
    const headRow = dom.el('tr');
    const tbody = dom.el('tbody', { id: 'data-tbody' });
    const clearButton = dom.el('button', { type: 'button', class: 'btn btn-danger', id: 'data-clear' }, 'Alle entfernen');
    dom.clear(options.listContainer);
    options.listContainer.appendChild(dom.el('div', { class: 'card' }, [
      dom.el('h3', null, ['Punkte ', count]),
      dom.el('div', { class: 'table-scroll table-scroll-limited' }, dom.el('table', { class: 'data-table', id: 'data-table' }, [dom.el('thead', null, headRow), tbody])),
      dom.el('div', { class: 'button-row' }, clearButton)
    ]));

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
     * Lädt ein Beispiel.
     * @param {string} id - Kennung.
     */
    function loadSample(id) {
      const sample = samples.find((s) => s.id === id);
      if (!sample) {
        return;
      }
      importToken++;
      const parsed = ns.clusterImport.parseText(sample.text);
      data.replaceAll(parsed.points, parsed.attributes, parsed.objectHeader);
      sampleSelect.value = id;
      showStatus('success', '„' + sample.title + '“ geladen: ' + format.plural(parsed.points.length, 'Punkt', 'Punkte') + '.', [sample.note]);
    }

    /**
     * Liest die gewählte Datei ein.
     * @param {File} file - Datei.
     */
    async function upload(file) {
      const token = ++importToken;
      const append = radioAppend.checked;
      try {
        const result = await ns.clusterImport.importFile(file);
        if (token !== importToken) {
          return;
        }
        if (result.points.length === 0) {
          throw new Error('Die Datei enthält keine gültigen Punkte.' + (result.errors.length ? ' ' + result.errors[0] : ''));
        }
        const limit = ns.clusterData.LIMITS.maxPoints;
        const notes = [...result.errors];
        if (result.skipped > result.errors.length) {
          notes.push('… und ' + (result.skipped - result.errors.length) + ' weitere fehlerhafte Zeilen.');
        }
        if (result.limitReached) {
          notes.push('Es wurden nur die ersten ' + limit + ' Punkte übernommen.');
        }
        const room = limit - (append ? data.count() : 0);
        const points = result.points.slice(0, Math.max(0, room));
        if (points.length < result.points.length) {
          notes.push('Es sind höchstens ' + limit + ' Punkte möglich; ' + (result.points.length - points.length) + ' wurden nicht übernommen.');
        }
        if (append) {
          const attrs = data.attributes();
          if (data.count() > 0 && result.attributes && (attrs.x !== result.attributes.x || attrs.y !== result.attributes.y)) {
            notes.push('Die Namen der Achsen weichen ab; die bisherigen Namen bleiben bestehen.');
          }
          data.appendAll(points, result.attributes, result.objectHeader);
        } else {
          data.replaceAll(points, result.attributes, result.objectHeader);
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

    /** Baut Beschriftungen und Tabelle aus dem Datensatz neu auf. */
    function refresh() {
      const attrs = data.attributes();
      const points = data.points();
      const hasNames = data.hasNames();
      const numCol = (text) => dom.el('th', { scope: 'col', class: 'num' }, text);
      const scaledFirst = options.scaled && points.length ? options.scaled(0) : null;
      fieldX.label.textContent = attrs.x;
      fieldY.label.textContent = attrs.y;
      count.textContent = '(' + points.length + ')';
      clearButton.disabled = points.length === 0;
      dom.clear(headRow);
      dom.appendChildren(headRow, [
        numCol('Nr.'),
        hasNames ? dom.el('th', { scope: 'col' }, data.objectHeader()) : null,
        numCol(attrs.x), numCol(attrs.y),
        scaledFirst ? numCol('x₁ skaliert') : null,
        scaledFirst ? numCol('x₂ skaliert') : null,
        dom.el('th', { scope: 'col' }, dom.el('span', { class: 'visually-hidden' }, 'Aktion'))
      ]);
      dom.clear(tbody);
      points.forEach((p, i) => {
        const button = dom.el('button', { type: 'button', class: 'btn btn-small', 'aria-label': 'Punkt ' + (i + 1) + ' entfernen' }, 'Entfernen');
        button.addEventListener('click', () => data.remove(p.id));
        const s = scaledFirst ? options.scaled(i) : null;
        tbody.appendChild(dom.el('tr', null, [
          dom.el('td', { class: 'num' }, i + 1),
          hasNames ? dom.el('td', null, data.displayName(i)) : null,
          dom.el('td', { class: 'num' }, format.num(p.x)),
          dom.el('td', { class: 'num' }, format.num(p.y)),
          s ? dom.el('td', { class: 'num' }, format.num(s[0])) : null,
          s ? dom.el('td', { class: 'num' }, format.num(s[1])) : null,
          dom.el('td', null, button)
        ]));
      });
    }

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        upload(fileInput.files[0]);
      }
    });
    sampleButton.addEventListener('click', () => loadSample(sampleSelect.value));
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const result = data.add(fieldX.input.value, fieldY.input.value, fieldName.input.value);
      formError.textContent = result.ok ? '' : result.error;
      if (result.ok) {
        fieldName.input.value = '';
        fieldX.input.value = '';
        fieldY.input.value = '';
        fieldX.input.focus();
      }
    });
    clearButton.addEventListener('click', () => {
      importToken++;
      data.clear();
      status.hidden = true;
    });
    refresh();

    return { refresh, loadSample };
  }

  ns.clusterPanel = { create };
})(window.CC = window.CC || {});
