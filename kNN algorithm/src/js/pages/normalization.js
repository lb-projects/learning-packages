/**
 * @file normalization.js
 * @description Seite 8 "Normalisierung".
 *
 * Idee:
 *   Haben die beiden Merkmale sehr unterschiedliche Größenordnungen, bestimmt das
 *   Merkmal mit den größeren Zahlen fast allein den Abstand und damit die Nachbarn.
 *   Die Seite zeigt dieselben Trainingsdaten links ohne und rechts mit
 *   Normalisierung (Min-Max oder Z-Standardisierung), erklärt das Verfahren
 *   allgemein und am konkreten Punkt und vergleicht die Ergebnisse:
 *   neuer Punkt in beiden Darstellungen, Genauigkeit je k (Leave One Out),
 *   Punkte, die je nach Normalisierung anders klassifiziert werden.
 *
 * Die Kennwerte (min/max bzw. Mittelwert/Standardabweichung) stammen aus allen
 * Trainingspunkten und werden bei jeder Datenänderung neu berechnet.
 *
 * Abhängigkeiten:
 *   dom-utils.js, dataset.js, knn.js, chart.js, pages/common.js
 *
 * Sicherheitsaspekte:
 *   - Eingaben werden über dataset.validateCoordinate geprüft.
 *   - Alle Ausgaben erfolgen als Text.
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const ds = ns.dataset;
  const knn = ns.knn;
  const common = ns.common;

  /** Größtes k in der Leave-One-Out-Tabelle. */
  const LOO_K_MAX = 20;

  /** Seitenzustand (bleibt beim Seitenwechsel erhalten). */
  const state = {
    /** @type {{x:number, y:number}|null} Neuer Punkt (Originalwerte). */
    query: null,
    /** @type {number|null} Für das Rechenbeispiel gewählter Trainingspunkt. */
    exampleId: null
  };

  let ui = null;
  let rawChart = null;
  let scaledChart = null;
  let kControl = null;
  let metricSelector = null;
  let methodSelector = null;

  const f = (v) => dom.formatNumber(v);
  const r3 = (v) => Math.round(v * 1000) / 1000;

  /** Liest die Eingabefelder des neuen Punkts. */
  function readInputs() {
    const xText = ui.x.value.trim();
    const yText = ui.y.value.trim();
    if (xText === '' && yText === '') {
      state.query = null;
      ui.error.textContent = '';
      return;
    }
    const vx = ds.validateCoordinate(xText, 'x-Wert');
    const vy = ds.validateCoordinate(yText, 'y-Wert');
    if (!vx.ok || !vy.ok) {
      state.query = null;
      ui.error.textContent = !vx.ok ? vx.error : vy.error;
      return;
    }
    ui.error.textContent = '';
    state.query = { x: vx.value, y: vy.value };
  }

  /**
   * Rundet einen Wert passend zur Spannweite der Achse (für Klicks ins Diagramm).
   * @param {number} v - Wert.
   * @param {number} span - Spannweite der Daten auf dieser Achse.
   * @returns {number} Gerundeter Wert.
   */
  function roundForSpan(v, span) {
    const digits = span >= 100 ? 0 : span >= 10 ? 1 : 2;
    const p = Math.pow(10, digits);
    return Math.round(v * p) / p;
  }

  /** Setzt den neuen Punkt (Originalwerte) und zeichnet neu. */
  function setQuery(x, y) {
    ui.x.value = f(x).replace(/\./g, '');
    ui.y.value = f(y).replace(/\./g, '');
    readInputs();
    render();
  }

  /** @returns {string} Bezeichnung des gewählten Verfahrens. */
  function methodName(method) {
    return method === 'zscore' ? 'Z-Standardisierung' : 'Min-Max';
  }

  /** @returns {string} Zusatz für Achsentitel. */
  function axisSuffix(method) {
    return method === 'zscore' ? ' (standardisiert)' : ' (normalisiert)';
  }

  /**
   * Allgemeine Erklärung des Verfahrens.
   * @param {string} method - Verfahren.
   * @returns {HTMLElement[]} Absätze.
   */
  function explanation(method) {
    const common1 = dom.el('p', null, 'Beim kNN-Verfahren entscheidet der Abstand, welche Punkte Nachbarn sind. ' +
      'Liegen die Werte eines Merkmals z. B. zwischen 30 und 600, die des anderen zwischen 5 und 10, ' +
      'so bestimmt fast nur das erste Merkmal den Abstand – das zweite spielt kaum eine Rolle, auch wenn es für das Label wichtig ist. ' +
      'Bei der Normalisierung werden beide Merkmale getrennt auf einen vergleichbaren Bereich umgerechnet. Danach zählen beide gleich stark.');
    if (method === 'zscore') {
      return [common1,
        dom.el('p', null, ['Z-Standardisierung: Von jedem Wert wird der Mittelwert x̄ des Merkmals abgezogen; ' +
          'das Ergebnis wird durch die Standardabweichung s geteilt: ', dom.el('span', { class: 'formula' }, "x' = (x − x̄) / s"),
          '. Die Standardabweichung gibt an, wie weit die Werte im Mittel vom Mittelwert entfernt sind: ',
          dom.el('span', { class: 'formula' }, 's = √( Σ (x − x̄)² / n )'),
          ' (hier wird durch die Anzahl n der Punkte geteilt).']),
        dom.el('p', null, 'Danach haben beide Merkmale den Mittelwert 0 und die Standardabweichung 1. Werte über dem Mittelwert werden positiv, ' +
          'Werte darunter negativ. Ein einzelner sehr großer oder kleiner Wert (Ausreißer) verschiebt das Ergebnis weniger stark als bei Min-Max.'),
        dom.el('p', null, 'Mittelwert und Standardabweichung werden aus den Trainingsdaten berechnet. Ein neuer Punkt wird mit denselben Werten umgerechnet.')];
    }
    return [common1,
      dom.el('p', null, ['Min-Max-Normalisierung: Von jedem Wert wird das Minimum des Merkmals abgezogen; ' +
        'das Ergebnis wird durch die Spannweite (Maximum − Minimum) geteilt: ', dom.el('span', { class: 'formula' }, "x' = (x − min) / (max − min)"), '.']),
      dom.el('p', null, 'Danach liegen alle Trainingswerte beider Merkmale zwischen 0 (kleinster Wert) und 1 (größter Wert).'),
      dom.el('p', null, 'Minimum und Maximum werden aus den Trainingsdaten berechnet. Ein neuer Punkt wird mit denselben Werten umgerechnet und kann daher auch unter 0 oder über 1 liegen.')];
  }

  /**
   * Rechenweg für einen Wert einer Achse.
   * @param {string} name - "x" oder "y".
   * @param {number} v - Originalwert.
   * @param {Object} axis - Kennwerte der Achse.
   * @param {string} method - Verfahren.
   * @returns {string} Rechenweg.
   */
  function stepText(name, v, axis, method) {
    const result = knn.normalizeValue(v, axis);
    if (axis.constant) {
      return name + "' = 0 (alle Trainingswerte von " + name + ' sind gleich)';
    }
    if (method === 'zscore') {
      return name + "' = (" + name + ' − ' + name + '̄) / s = (' + f(v) + ' − ' + f(r3(axis.mean)) + ') / ' + f(r3(axis.sd)) +
        ' = ' + f(r3(v - axis.mean)) + ' / ' + f(r3(axis.sd)) + ' = ' + f(r3(result));
    }
    return name + "' = (" + name + ' − min) / (max − min) = (' + f(v) + ' − ' + f(axis.min) + ') / (' + f(axis.max) + ' − ' + f(axis.min) +
      ') = ' + f(r3(v - axis.min)) + ' / ' + f(r3(axis.max - axis.min)) + ' = ' + f(r3(result));
  }

  /**
   * Abschnitt "Durchgerechnet": Kennwerte und Rechenweg für einen Punkt.
   * @param {Object} params - Kennwerte.
   * @param {Array} points - Trainingspunkte.
   */
  function renderWorked(params, points) {
    const box = dom.clear(ui.worked);
    const axisNames = ds.getAxisLabels();
    const method = params.method;
    const rows = [['x', axisNames.x, params.x], ['y', axisNames.y, params.y]].map(([n, label, a]) => dom.el('tr', null, method === 'zscore'
      ? [dom.el('th', { scope: 'row' }, n + ': ' + label),
        dom.el('td', { class: 'num' }, f(r3(a.mean))), dom.el('td', { class: 'num' }, f(r3(a.sd)))]
      : [dom.el('th', { scope: 'row' }, n + ': ' + label),
        dom.el('td', { class: 'num' }, f(a.min)), dom.el('td', { class: 'num' }, f(a.max)), dom.el('td', { class: 'num' }, f(r3(a.max - a.min)))]));
    box.appendChild(dom.el('div', { class: 'table-wrap' }, dom.el('table', { class: 'data-table' }, [
      dom.el('caption', null, 'Kennwerte aus den ' + points.length + ' Trainingspunkten'),
      dom.el('thead', null, dom.el('tr', null, method === 'zscore'
        ? [dom.el('th', { scope: 'col' }, 'Merkmal'), dom.el('th', { scope: 'col' }, 'Mittelwert x̄'), dom.el('th', { scope: 'col' }, 'Standardabweichung s')]
        : [dom.el('th', { scope: 'col' }, 'Merkmal'), dom.el('th', { scope: 'col' }, 'Minimum'), dom.el('th', { scope: 'col' }, 'Maximum'), dom.el('th', { scope: 'col' }, 'Spannweite')])),
      dom.el('tbody', null, rows)
    ])));
    if (method === 'zscore') {
      for (const [n, a, key] of [['x', params.x, 'x'], ['y', params.y, 'y']]) {
        const sq = points.reduce((acc, p) => acc + (p[key] - a.mean) * (p[key] - a.mean), 0);
        box.appendChild(dom.el('p', null, n + '̄ = Summe / n = ' + f(r3(a.sum)) + ' / ' + a.n + ' = ' + f(r3(a.mean)) + ';   s = √( Σ (' + n + ' − ' + n +
          '̄)² / n ) = √( ' + f(r3(sq)) + ' / ' + a.n + ' ) = ' + f(r3(a.sd))));
      }
    }
    for (const a of [params.x, params.y]) {
      if (a.constant) {
        box.appendChild(dom.el('p', { class: 'hint-tie' }, 'Hinweis: Auf einer Achse haben alle Trainingspunkte denselben Wert. ' +
          'Dort wird durch 1 statt durch 0 geteilt; alle umgerechneten Werte sind 0.'));
        break;
      }
    }
    let target = null;
    let name = '';
    const chosen = state.exampleId !== null ? ds.getPoint(state.exampleId) : null;
    if (chosen) {
      target = chosen;
      name = 'Trainingspunkt ' + dom.describePoint(chosen);
    } else if (state.query) {
      target = state.query;
      name = 'neuer Punkt (' + f(state.query.x) + ' | ' + f(state.query.y) + ')';
    } else {
      target = points[0];
      name = 'Trainingspunkt ' + dom.describePoint(points[0]);
    }
    box.appendChild(dom.el('p', { class: 'result-main' }, 'Beispiel: ' + name));
    box.appendChild(dom.el('p', null, dom.el('span', { class: 'formula' }, stepText('x', target.x, params.x, method))));
    box.appendChild(dom.el('p', null, dom.el('span', { class: 'formula' }, stepText('y', target.y, params.y, method))));
    box.appendChild(dom.el('p', { class: 'hint' }, 'Anderen Punkt durchrechnen: in einem der beiden Diagramme auf einen Trainingspunkt klicken.'));
  }

  /**
   * Nachbartabelle für einen Klassifizierungsdurchgang.
   * @param {string} caption - Überschrift.
   * @param {Object} result - Ergebnis von knn.classify.
   * @param {Set<number>} otherIds - IDs der Nachbarn im anderen Durchgang (zum Hervorheben).
   * @returns {HTMLElement} Tabelle.
   */
  function neighborTable(caption, result, otherIds) {
    const tbody = dom.el('tbody');
    result.neighbors.forEach((n, i) => {
      const point = ds.getPoint(n.point.id);
      tbody.appendChild(dom.el('tr', otherIds.has(n.point.id) ? null : { class: 'only-here' }, [
        dom.el('td', { class: 'num' }, String(i + 1)),
        dom.el('td', null, dom.describePoint(point)),
        dom.el('td', null, common.labelBadge(point.label)),
        dom.el('td', { class: 'num' }, f(r3(n.distance)))
      ]));
    });
    return dom.el('div', { class: 'table-wrap' }, dom.el('table', { class: 'data-table' }, [
      dom.el('caption', null, caption),
      dom.el('thead', null, dom.el('tr', null, [
        dom.el('th', { scope: 'col' }, 'Rang'), dom.el('th', { scope: 'col' }, 'Datenpunkt'),
        dom.el('th', { scope: 'col' }, 'Label'), dom.el('th', { scope: 'col' }, 'Abstand')])),
      tbody
    ]));
  }

  /**
   * Leave One Out mit festem k für alle Punkte: Ergebnis je Punkt-ID.
   * @param {Array} pts - Punkte.
   * @param {number} k - k.
   * @param {string} metric - Metrik.
   * @returns {Map<number, string|null>} Berechnetes Label je ID.
   */
  function looLabels(pts, k, metric) {
    const out = new Map();
    for (const p of pts) {
      out.set(p.id, knn.classify(pts, p, k, metric, p.id).label);
    }
    return out;
  }

  /** Zeichnet die Seite neu. */
  function render() {
    const points = ds.getPoints();
    const method = methodSelector.get();
    const metric = metricSelector.get();
    ui.rightTitle.textContent = 'Mit Normalisierung (' + methodName(method) + ')';
    dom.clear(ui.explain);
    for (const el of explanation(method)) {
      ui.explain.appendChild(el);
    }
    if (points.length < 2) {
      common.showNotice(ui.notice, 'Für diese Seite werden mindestens 2 Trainingspunkte benötigt.', true);
      kControl.setMax(1);
      rawChart.render(common.baseView());
      scaledChart.render(Object.assign(common.baseView([]), { fitEqual: true }));
      for (const box of [ui.rawResult, ui.scaledResult, ui.worked, ui.neighbors, ui.loo, ui.diff]) {
        dom.clear(box);
      }
      return;
    }
    const reduced = kControl.setMax(points.length);
    common.showNotice(ui.notice, reduced ? 'k wurde auf die Anzahl der Trainingspunkte (' + points.length + ') begrenzt.' : null);
    const k = kControl.get();
    const params = knn.normalizationParams(points, method);
    const scaled = knn.normalizePoints(points, params);
    const axis = ds.getAxisLabels();
    const scaledQuery = state.query ? { x: knn.normalizeValue(state.query.x, params.x), y: knn.normalizeValue(state.query.y, params.y) } : null;

    // Unterschiedlich klassifizierte Punkte (Leave One Out mit dem gewählten k) – nur bei geöffnetem Abschnitt.
    let diffIds = new Set();
    let rawLoo = null;
    let scaledLoo = null;
    const highlight = ui.highlight.checked;
    if (ui.diffSection.open || highlight) {
      rawLoo = looLabels(points, k, metric);
      scaledLoo = looLabels(scaled, k, metric);
      diffIds = new Set(points.filter((p) => rawLoo.get(p.id) !== scaledLoo.get(p.id)).map((p) => p.id));
    }
    // Markiert wird nur, wenn der Schalter "Anders klassifizierte Punkte hervorheben" an ist.
    const marked = { markedIds: highlight ? diffIds : new Set(), markedLegend: 'gestrichelter Ring = Ergebnis (Leave One Out, k = ' + k + ') ändert sich durch die Normalisierung' };
    const selected = state.exampleId !== null && ds.getPoint(state.exampleId) ? state.exampleId : null;

    let rawResult = null;
    let scaledResult = null;
    const rawView = Object.assign(common.baseView(), marked, { selectedId: selected });
    const scaledView = Object.assign(common.baseView(scaled), marked, {
      fitEqual: true, selectedId: selected,
      axisLabels: { x: axis.x + axisSuffix(method), y: axis.y + axisSuffix(method) }
    });
    if (state.query) {
      rawResult = knn.classify(points, state.query, k, metric);
      scaledResult = knn.classify(scaled, scaledQuery, k, metric);
      Object.assign(rawView, { query: { x: state.query.x, y: state.query.y, label: rawResult.label }, neighbors: rawResult.neighbors, metric, radius: rawResult.radius });
      Object.assign(scaledView, { query: { x: scaledQuery.x, y: scaledQuery.y, label: scaledResult.label }, neighbors: scaledResult.neighbors, metric, radius: scaledResult.radius });
    }
    rawChart.render(rawView);
    scaledChart.render(scaledView);

    const resultLine = (box, result) => {
      dom.clear(box);
      if (result) {
        box.appendChild(dom.el('span', null, ['Berechnetes Label: ', common.labelBadge(result.label)]));
      } else {
        box.textContent = 'Geben Sie einen neuen Punkt ein oder klicken Sie in eines der Diagramme.';
      }
    };
    resultLine(ui.rawResult, rawResult);
    resultLine(ui.scaledResult, scaledResult);

    renderWorked(params, points);

    // Neuer Punkt: Nachbarn im Vergleich
    dom.clear(ui.neighbors);
    if (rawResult) {
      const rawIds = new Set(rawResult.neighbors.map((n) => n.point.id));
      const scaledIds = new Set(scaledResult.neighbors.map((n) => n.point.id));
      // Ergebnis jeweils direkt unter der zugehörigen Tabelle
      ui.neighbors.appendChild(dom.el('div', { class: 'side-by-side' }, [
        dom.el('div', null, [
          neighborTable('Ohne Normalisierung (Abstand in Originalwerten)', rawResult, scaledIds),
          dom.el('p', { class: 'result-line', id: 'norm-raw-compare' }, ['Ohne Normalisierung: ', common.labelBadge(rawResult.label)])
        ]),
        dom.el('div', null, [
          neighborTable('Mit Normalisierung (Abstand in umgerechneten Werten)', scaledResult, rawIds),
          dom.el('p', { class: 'result-line', id: 'norm-scaled-compare' }, ['Mit Normalisierung: ', common.labelBadge(scaledResult.label)])
        ])
      ]));
      ui.neighbors.appendChild(dom.el('p', { class: 'hint' }, 'Hervorgehoben: Nachbarn, die nur in einer der beiden Rechnungen vorkommen.'));
    } else {
      ui.neighbors.appendChild(dom.el('p', null, 'Geben Sie oben einen neuen Punkt ein oder klicken Sie in eines der Diagramme.'));
    }

    // Genauigkeit je k (Leave One Out) – nur bei geöffnetem Abschnitt berechnen.
    dom.clear(ui.loo);
    if (ui.looSection.open) {
      const kMax = Math.min(LOO_K_MAX, points.length - 1);
      const accRaw = knn.leaveOneOut(points, kMax, metric).accuracy;
      const accScaled = knn.leaveOneOut(scaled, kMax, metric).accuracy;
      const best = (acc) => Math.max(...acc.map((a) => a.correct));
      const bRaw = best(accRaw);
      const bScaled = best(accScaled);
      const bestKs = (acc, b) => acc.filter((a) => a.correct === b).map((a) => a.k).join(', ');
      ui.loo.appendChild(dom.el('p', { class: 'result-main' }, 'Beste Genauigkeit ohne Normalisierung: ' + dom.formatPercent(bRaw / points.length) +
        ' bei k = ' + bestKs(accRaw, bRaw) + ';  mit Normalisierung: ' + dom.formatPercent(bScaled / points.length) + ' bei k = ' + bestKs(accScaled, bScaled) + '.'));
      const tbody = dom.el('tbody');
      for (let i = 0; i < kMax; i++) {
        const a = accRaw[i];
        const b = accScaled[i];
        tbody.appendChild(dom.el('tr', null, [
          dom.el('td', { class: 'num' }, String(a.k)),
          dom.el('td', { class: 'num' }, a.correct + ' / ' + a.total + ' (' + dom.formatPercent(a.rate) + ')' + (a.correct === bRaw ? ' ★' : '')),
          dom.el('td', { class: 'num' }, b.correct + ' / ' + b.total + ' (' + dom.formatPercent(b.rate) + ')' + (b.correct === bScaled ? ' ★' : ''))
        ]));
      }
      ui.loo.appendChild(dom.el('div', { class: 'table-wrap' }, dom.el('table', { class: 'data-table' }, [
        dom.el('caption', null, 'Leave One Out: korrekt klassifizierte Punkte je k (★ = beste Genauigkeit), Metrik: ' + knn.METRICS[metric].name),
        dom.el('thead', null, dom.el('tr', null, [dom.el('th', { scope: 'col' }, 'k'),
          dom.el('th', { scope: 'col' }, 'ohne Normalisierung'), dom.el('th', { scope: 'col' }, 'mit Normalisierung (' + methodName(method) + ')')])),
        tbody
      ])));
    }

    // Unterschiedlich klassifizierte Punkte
    dom.clear(ui.diff);
    if (ui.diffSection.open) {
      ui.diff.appendChild(dom.el('p', null, 'Jeder Trainingspunkt wird anhand der übrigen Punkte mit k = ' + k +
        ' klassifiziert (Leave One Out) – einmal ohne, einmal mit Normalisierung. Aufgeführt sind die Punkte, bei denen sich das Ergebnis unterscheidet; ' +
        'mit dem Schalter „Anders klassifizierte Punkte hervorheben“ (Einstellungen) werden sie in beiden Diagrammen mit einem gestrichelten Ring markiert.'));
      const list = points.filter((p) => diffIds.has(p.id));
      if (list.length === 0) {
        ui.diff.appendChild(dom.el('p', { class: 'result-main' }, 'Bei diesen Daten ändert die Normalisierung kein Ergebnis.'));
      } else {
        const ok = (label, p) => (label === p.label ? '✓ korrekt' : '✗ falsch');
        const better = list.filter((p) => scaledLoo.get(p.id) === p.label).length;
        const worse = list.filter((p) => rawLoo.get(p.id) === p.label).length;
        ui.diff.appendChild(dom.el('p', { class: 'result-main' }, list.length + ' Punkt(e) werden unterschiedlich klassifiziert: ' +
          better + ' davon erst mit Normalisierung korrekt, ' + worse + ' nur ohne Normalisierung korrekt.'));
        ui.diff.appendChild(dom.el('div', { class: 'table-wrap' }, dom.el('table', { class: 'data-table' }, [
          dom.el('caption', null, 'Unterschiedlich klassifizierte Punkte (k = ' + k + ')'),
          dom.el('thead', null, dom.el('tr', null, [dom.el('th', { scope: 'col' }, 'Datenpunkt'), dom.el('th', { scope: 'col' }, 'tatsächliches Label'),
            dom.el('th', { scope: 'col' }, 'ohne Normalisierung'), dom.el('th', { scope: 'col' }, 'mit Normalisierung')])),
          dom.el('tbody', null, list.map((p) => dom.el('tr', null, [
            dom.el('td', null, dom.describePoint(p)),
            dom.el('td', null, common.labelBadge(p.label)),
            dom.el('td', null, [common.labelBadge(rawLoo.get(p.id)), ' ' + ok(rawLoo.get(p.id), p)]),
            dom.el('td', null, [common.labelBadge(scaledLoo.get(p.id)), ' ' + ok(scaledLoo.get(p.id), p)])
          ])))
        ])));
      }
    }
  }

  /** Initialisiert die Seite. */
  function init() {
    ui = {
      x: dom.byId('n-x'),
      y: dom.byId('n-y'),
      error: dom.byId('n-error'),
      notice: dom.byId('notice-normalization'),
      rightTitle: dom.byId('norm-right-title'),
      rawResult: dom.byId('norm-raw-result'),
      scaledResult: dom.byId('norm-scaled-result'),
      explain: dom.byId('norm-explain-body'),
      worked: dom.byId('norm-worked-body'),
      neighbors: dom.byId('norm-neighbors-body'),
      loo: dom.byId('norm-loo-body'),
      diff: dom.byId('norm-diff-body'),
      looSection: dom.byId('norm-loo'),
      diffSection: dom.byId('norm-diff'),
      highlight: dom.byId('n-highlight')
    };
    ui.highlight.addEventListener('change', render);
    const pickPoint = (point) => {
      state.exampleId = point.id;
      render();
    };
    rawChart = new ns.chart.ScatterChart(dom.byId('chart-norm-raw'), {
      ariaLabel: 'Diagramm: Trainingsdaten ohne Normalisierung',
      onPointClick: pickPoint,
      onPlaneClick: (pos) => {
        state.exampleId = null;
        setQuery(pos.x, pos.y);
      }
    });
    scaledChart = new ns.chart.ScatterChart(dom.byId('chart-norm-scaled'), {
      ariaLabel: 'Diagramm: Trainingsdaten mit Normalisierung',
      onPointClick: pickPoint,
      onPlaneClick: (pos) => {
        const points = ds.getPoints();
        if (points.length < 2) {
          return;
        }
        const params = knn.normalizationParams(points, methodSelector.get());
        state.exampleId = null;
        setQuery(roundForSpan(knn.denormalizeValue(pos.x, params.x), params.x.max - params.x.min),
          roundForSpan(knn.denormalizeValue(pos.y, params.y), params.y.max - params.y.min));
      }
    });
    kControl = new common.KControl(dom.byId('k-normalization'), 'Anzahl der Nachbarn k', render, 3);
    methodSelector = new common.ChoiceSelector(dom.byId('method-normalization'), 'Verfahren', Object.values(knn.NORMALIZATIONS), 'minmax', render);
    metricSelector = new common.MetricSelector(dom.byId('metric-normalization'), render);
    for (const input of [ui.x, ui.y]) {
      input.addEventListener('input', () => {
        state.exampleId = null;
        readInputs();
        render();
      });
    }
    dom.byId('norm-form').addEventListener('submit', (event) => event.preventDefault());
    for (const id of ['norm-loo', 'norm-diff', 'norm-neighbors']) {
      dom.byId(id).addEventListener('toggle', render);
    }
  }

  /**
   * Datenänderungen: Neue Trainingsdaten (Datei, Beispieldaten) setzen die Seite zurück –
   * neuer Punkt und Beispielpunkt entfallen, alle Abschnitte werden zugeklappt.
   * Bei einzelnen Änderungen entfällt nur ein gelöschter Beispielpunkt. render() rechnet neu.
   * @param {{type: string}} event - Änderung.
   */
  function onDataChange(event) {
    if (event && event.type === 'replace') {
      state.query = null;
      state.exampleId = null;
      if (ui) {
        ui.x.value = '';
        ui.y.value = '';
        ui.error.textContent = '';
        for (const id of ['norm-explain', 'norm-worked', 'norm-neighbors', 'norm-loo', 'norm-diff']) {
          dom.byId(id).open = false;
        }
      }
      return;
    }
    if (state.exampleId !== null && !ds.getPoint(state.exampleId)) {
      state.exampleId = null;
    }
  }

  ns.pages = ns.pages || {};
  ns.pages.normalization = { id: 'normalization', init, render, onDataChange };
})(window.KNN = window.KNN || {});
