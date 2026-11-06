/**
 * @file hand-calc.js
 * @description Logik der Seite „Von Hand rechnen“ (ohne Zugriff auf die Seite): Sollzeilen und
 *              Prüfung einer ausgefüllten Zeile.
 *
 * Sollzeilen:
 *   Je Trainingspunkt eine Zeile, in der Reihenfolge der Tabelle und mit derselben Rechnung wie der
 *   Trainer (perceptron.classify, perceptron.learn). Sie entstehen erst bei Bedarf, weil nicht
 *   trennbare Daten kein Ende haben. Nach einer Iteration ohne Anpassung gibt es keine weitere Zeile.
 *
 * Prüfung:
 *   - Stufenweise, damit Folgefehler nicht verwirren: erst w₁, w₂, θ, dann a, dann f(a), zuletzt die
 *     neuen Werte. Hinweise nennen Ort und Art eines Fehlers, nie den richtigen Wert.
 *   - Neue Werte, je Feld einzeln: frei bedeutet „bleibt gleich“; der alte Wert darf auch eingetragen werden.
 *   - Rundung: Ein Wert ist richtig, wenn er dem genauen Wert gerundet entspricht, auf mindestens zwei
 *     Nachkommastellen. Ein neuer Wert, der dem alten gleicht, obwohl er sich ändern müsste, ist falsch.
 *     So geht eine sehr kleine Lernrate nicht unter.
 *
 * Hilfe:
 *   helpFor() liefert die Texte der drei Hilfestufen zum Fehler der letzten Prüfung: Stufe 1 die Regel,
 *   Stufe 2 den Rechenweg mit eingesetzten Zahlen ohne Ergebnis, Stufe 3 das Ergebnis. Nur die bewusst
 *   angeforderte Stufe 3 nennt den richtigen Wert, die automatischen Hinweise nie.
 *
 * Abhängigkeiten:
 *   sim-format.js, point-data.js, perceptron.js
 *
 * Sicherheitsaspekte:
 *   Eingaben werden nur gelesen und verglichen. Hinweise enthalten keine Eingaben.
 */
(function (ns) {
  'use strict';

  /** Felder der offenen Zeile in der Reihenfolge der Spalten. */
  const FIELDS = ['w1', 'w2', 'theta', 'sum', 'y', 'nw1', 'nw2', 'ntheta'];
  /** Bezeichnungen der Felder. */
  const NAMES = { w1: 'w₁', w2: 'w₂', theta: 'θ', sum: 'a', y: 'f(a)', nw1: 'Neues w₁', nw2: 'Neues w₂', ntheta: 'Neues θ' };
  /** Kleinster Toleranzbereich: gerundet auf zwei Nachkommastellen. */
  const MIN_DECIMALS = 2;
  const EPSILON = 1e-9;

  /**
   * Erzeugt die Sollzeilen.
   *
   * @param {Array<{x:number[], raw:(number[]|null), t:number, label:string, group:(string|null)}>} points - Punkte.
   * @param {number[]} w - Startgewichte.
   * @param {number} theta - Startschwellenwert.
   * @param {number|null} alpha - Lernrate oder null (dann gilt α = 1).
   * @returns {{rowAt:function(number):(Object|null), finishedAt:function():(number|null)}} rowAt(i): Zeile oder
   *   null; finishedAt(): Anzahl aller Zeilen, sobald die Trenngerade in den erzeugten Zeilen gefunden ist.
   */
  function createSolver(points, w, theta, alpha) {
    const rows = [];
    let currentW = [...w];
    let currentTheta = theta;
    let index = 0;
    let iteration = 1;
    let correct = 0;
    let finished = null;
    const rate = alpha === null ? 1 : alpha;

    /** Erzeugt die nächste Zeile. */
    function grow() {
      const p = points[index];
      const { sum, y } = ns.perceptron.classify(currentW, currentTheta, p.x);
      const delta = p.t - y;
      const next = delta === 0 ? { w: currentW, theta: currentTheta } : ns.perceptron.learn(currentW, currentTheta, p.x, delta, rate);
      rows.push({
        iteration, index, total: points.length, x: p.x, raw: p.raw || null, label: p.label, t: p.t, group: p.group, alpha,
        w: currentW, theta: currentTheta, sum, y, delta, newW: next.w, newTheta: next.theta
      });
      currentW = next.w;
      currentTheta = next.theta;
      correct += delta === 0 ? 1 : 0;
      index++;
      if (index === points.length) {
        if (correct === points.length) {
          finished = rows.length;
        }
        index = 0;
        iteration++;
        correct = 0;
      }
    }

    return {
      rowAt: (i) => {
        while (rows.length <= i && finished === null && points.length > 0) {
          grow();
        }
        return i < rows.length ? rows[i] : null;
      },
      finishedAt: () => finished
    };
  }

  /**
   * Prüft, ob eine Eingabe dem genauen Wert gerundet entspricht.
   * @param {string} text - Eingabe (gültige Zahl).
   * @param {number} exact - Genauer Wert.
   * @returns {boolean} true, wenn sie passt.
   */
  function matches(text, exact) {
    const value = ns.pointData.parseNumber(text);
    const decimals = (String(text).trim().split(/[.,]/)[1] || '').length;
    return Math.abs(value - exact) <= 0.5 * Math.pow(10, -Math.max(MIN_DECIMALS, decimals)) + EPSILON;
  }

  /**
   * Prüft die offene Zeile.
   *
   * @param {Object<string, string>} fields - Eingaben je Feld.
   * @param {Object} row - Sollzeile.
   * @param {boolean} first - true für die allererste Zeile.
   * @returns {{ok:boolean, kind:(string|null), hints:string[], wrong:string[]}} kind: 'syntax' (zählt nicht
   *   als Fehlversuch) oder 'calc'; wrong: falsche Felder.
   */
  function checkRow(fields, row, first) {
    const text = (name) => String(fields[name] === undefined ? '' : fields[name]).trim();
    const isNumber = (name) => ns.pointData.parseNumber(text(name)) !== null;
    const syntaxHints = [];
    const syntaxWrong = [];
    for (const name of FIELDS) {
      const optional = name.startsWith('n');
      if (text(name) === '') {
        if (!optional) {
          syntaxHints.push(NAMES[name] + ' fehlt.');
          syntaxWrong.push(name);
        }
      } else if (!isNumber(name)) {
        syntaxHints.push(NAMES[name] + ' ist keine Zahl. Schreiben Sie zum Beispiel 1,5 oder −2.');
        syntaxWrong.push(name);
      }
    }
    if (isNumber('y') && !['0', '1'].includes(String(ns.pointData.parseNumber(text('y'))))) {
      syntaxHints.push('f(a) kann nur 0 oder 1 sein.');
      syntaxWrong.push('y');
    }
    if (syntaxHints.length > 0) {
      return { ok: false, kind: 'syntax', hints: syntaxHints, wrong: syntaxWrong };
    }

    const failed = (hints, wrong) => ({ ok: false, kind: 'calc', hints, wrong });
    const hints = [];
    const wrong = [];
    const source = first ? 'Übernehmen Sie den Startwert aus „So geht es“.' : 'Übernehmen Sie den aktuellen Wert aus der vorigen Zeile.';
    [['w1', row.w[0]], ['w2', row.w[1]], ['theta', row.theta]].forEach(([name, exact]) => {
      if (!matches(text(name), exact)) {
        hints.push(NAMES[name] + ' stimmt nicht: ' + source);
        wrong.push(name);
      }
    });
    if (wrong.length > 0) {
      return failed(hints, wrong);
    }
    if (!matches(text('sum'), row.sum)) {
      return failed(['a stimmt nicht: a = w₁ · x₁ + w₂ · x₂.'], ['sum']);
    }
    if (ns.pointData.parseNumber(text('y')) !== row.y) {
      return failed(['f(a) stimmt nicht: Vergleichen Sie a mit θ. f(a) = 1, falls a ≥ θ, sonst 0.'], ['y']);
    }
    const rule = row.alpha === null || row.alpha === undefined ? '' : 'α · ';
    [
      ['nw1', row.w[0], row.newW[0], 'w₁ + ' + rule + 'δ · x₁'],
      ['nw2', row.w[1], row.newW[1], 'w₂ + ' + rule + 'δ · x₂'],
      ['ntheta', row.theta, row.newTheta, 'θ − ' + rule + 'δ']
    ].forEach(([name, old, exact, formula]) => {
      const changes = exact !== old;
      if (text(name) === '') {
        if (changes) {
          hints.push(NAMES[name] + ' fehlt: f(a) stimmt nicht mit t überein, also ändert sich dieser Wert.');
          wrong.push(name);
        }
        return;
      }
      const value = ns.pointData.parseNumber(text(name));
      if (changes && Math.abs(value - old) < EPSILON) {
        hints.push(NAMES[name] + ' stimmt nicht: Dieser Wert ändert sich. ' + NAMES[name] + ' = ' + formula + '.');
        wrong.push(name);
      } else if (!matches(text(name), exact)) {
        hints.push(!changes && row.delta === 0
          ? 'Keine Anpassung nötig: f(a) = t. Das Feld ' + NAMES[name] + ' darf frei bleiben.'
          : changes
            ? NAMES[name] + ' stimmt nicht: ' + NAMES[name] + ' = ' + formula + ' mit δ = t − f(a).'
            : NAMES[name] + ' bleibt gleich, weil der zugehörige Eingang 0 ist. Das Feld darf frei bleiben.');
        wrong.push(name);
      }
    });
    return wrong.length > 0 ? failed(hints, wrong) : { ok: true, kind: null, hints: [], wrong: [] };
  }

  /**
   * Prüfstufe eines Felds.
   * @param {string} field - Feld.
   * @returns {string} 'current', 'sum', 'y' oder 'new'.
   */
  function groupOf(field) {
    if (field === 'sum' || field === 'y') {
      return field;
    }
    return field.startsWith('n') ? 'new' : 'current';
  }

  /**
   * Texte der Hilfe zu den falschen Feldern einer Zeile, bis zur gewünschten Stufe.
   *
   * @param {Object} row - Sollzeile.
   * @param {string[]} wrong - Falsche Felder der letzten Prüfung (alle aus derselben Prüfstufe).
   * @param {number} level - Stufe von 1 bis 3.
   * @param {boolean} first - true für die allererste Zeile.
   * @returns {string[]} Zeilen, die der Stufe entsprechen (ohne die der niedrigeren Stufen).
   */
  function helpFor(row, wrong, level, first) {
    const { num, factor } = ns.simFormat;
    const group = groupOf(wrong[0]);
    const alphaText = row.alpha === null || row.alpha === undefined ? '' : 'α · ';
    const alphaValue = row.alpha === null || row.alpha === undefined ? '' : num(row.alpha) + ' · ';
    if (group === 'current') {
      const exact = { w1: row.w[0], w2: row.w[1], theta: row.theta };
      if (level === 1) {
        return [first ? 'In der ersten Zeile stehen die Startwerte. Sie finden sie oben unter „So geht es“.' : 'Die aktuellen Werte ergeben sich aus der vorigen Zeile.'];
      }
      if (level === 2) {
        return [first ? 'Tragen Sie w₁, w₂ und θ genau wie bei den Startwerten ein.' : 'Steht in der vorigen Zeile ein neuer Wert, gilt er. Ist die Spalte „Neu“ dort leer, gilt der Wert aus der Spalte davor.'];
      }
      return wrong.map((f) => NAMES[f] + ' = ' + num(exact[f]));
    }
    if (group === 'sum') {
      if (level === 1) {
        return ['a = w₁ · x₁ + w₂ · x₂. Setzen Sie die Werte aus dieser Zeile ein.'];
      }
      if (level === 2) {
        return ['a = ' + factor(row.w[0]) + ' · ' + factor(row.x[0]) + ' + ' + factor(row.w[1]) + ' · ' + factor(row.x[1]) + ' = ?'];
      }
      return ['a = ' + num(row.sum)];
    }
    if (group === 'y') {
      if (level === 1) {
        return ['f(a) = 1, falls a ≥ θ, sonst 0.'];
      }
      if (level === 2) {
        return ['Vergleichen Sie a = ' + num(row.sum) + ' mit θ = ' + num(row.theta) + ': Ist a ≥ θ?'];
      }
      return ['f(a) = ' + row.y];
    }
    const delta = 'δ = t − f(a) = ' + row.t + ' − ' + row.y + ' = ' + num(row.delta);
    const detail = {
      nw1: ['Neues w₁', row.w[0], row.newW[0], 'w₁ + ' + alphaText + 'δ · x₁', num(row.w[0]) + ' + ' + alphaValue + factor(row.delta) + ' · ' + factor(row.x[0])],
      nw2: ['Neues w₂', row.w[1], row.newW[1], 'w₂ + ' + alphaText + 'δ · x₂', num(row.w[1]) + ' + ' + alphaValue + factor(row.delta) + ' · ' + factor(row.x[1])],
      ntheta: ['Neues θ', row.theta, row.newTheta, 'θ − ' + alphaText + 'δ', num(row.theta) + ' − ' + alphaValue + factor(row.delta)]
    };
    if (level === 1) {
      return row.delta === 0
        ? ['δ = t − f(a) ist 0: Nichts ändert sich, die Spalten „Neu“ dürfen frei bleiben.']
        : ['Rechnen Sie zuerst δ = t − f(a) aus.', ...wrong.map((f) => detail[f][0] + ' = ' + detail[f][3])];
    }
    if (level === 2) {
      return [delta + '.', ...wrong.map((f) => detail[f][0] + ' = ' + detail[f][4] + ' = ?')];
    }
    return wrong.map((f) => (detail[f][1] === detail[f][2] ? detail[f][0] + ' bleibt ' + num(detail[f][1]) + '; das Feld darf frei bleiben.' : detail[f][0] + ' = ' + num(detail[f][2])));
  }

  ns.handCalc = { createSolver, checkRow, helpFor, groupOf, matches, FIELDS, NAMES };
})(window.BB = window.BB || {});
