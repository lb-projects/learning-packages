/**
 * @file hand-calc.js
 * @description Logik der Seite „Von Hand rechnen“ (ohne Zugriff auf die Seite): Sollzeilen, Prüfung und Hilfetexte.
 *
 * Sollzeilen, je Iteration in dieser Reihenfolge:
 *   'assign': je Punkt die quadrierten Abstände zu allen Zentren und der Cluster.
 *   'update': je Cluster das neue Zentrum. Ein leerer Cluster behält sein Zentrum; seine Zeile ist
 *             schon ausgefüllt (auto).
 *   'wcss':   die WCSS mit den neuen Zentren.
 *   Ändert eine ganze Zuordnung nichts mehr, endet die Tabelle mit dieser Zuordnung. Gerechnet wird mit
 *   denselben Funktionen wie im Training (kmeans.assign, update, wcss).
 *
 * Prüfung:
 *   - Stufenweise, damit Folgefehler nicht verwirren: erst die Abstände, dann der Cluster.
 *   - Hinweise nennen Ort und Art eines Fehlers, nie den richtigen Wert.
 *   - Rundung: Ein Wert ist richtig, wenn er dem genauen Wert gerundet entspricht, auf mindestens zwei
 *     Nachkommastellen. Weitergerechnet wird mit dem genauen Wert.
 *   - Schreibfehler (leeres Feld, keine Zahl, Cluster außerhalb von 1 bis k) zählen nicht als Fehlversuch.
 *
 * Hilfe:
 *   helpFor() liefert drei Stufen zum Fehler der letzten Prüfung: Stufe 1 die Regel, Stufe 2 den Rechenweg
 *   mit eingesetzten Zahlen ohne Ergebnis, Stufe 3 das Ergebnis. Nur die bewusst angeforderte Stufe 3
 *   nennt den richtigen Wert, die automatischen Hinweise nie.
 *
 * Abhängigkeiten:
 *   sim-format.js, point-data.js, kmeans.js
 *
 * Sicherheitsaspekte:
 *   Eingaben werden nur gelesen und verglichen. Hinweise enthalten keine Eingaben.
 */
(function (ns) {
  'use strict';

  /** Kleinster Toleranzbereich: gerundet auf zwei Nachkommastellen. */
  const MIN_DECIMALS = 2;
  const EPSILON = 1e-9;
  /** Schutz gegen Endlosschleifen durch Rundungseffekte bei übernommenen Daten. */
  const MAX_ITERATIONS = 100;

  /**
   * Erzeugt alle Sollzeilen einer Aufgabe.
   *
   * @param {number[][]} points - Punkte.
   * @param {number[][]} startCenters - Startzentren.
   * @returns {{rows:Array<Object>, iterations:number, tie:boolean, empty:boolean, changedAfterFirst:boolean, finalWcss:number}}
   *   Zeilen und Angaben für den Aufgabenerzeuger: tie: zwei Zentren waren gleich nah; empty: Ein Cluster war
   *   leer; changedAfterFirst: Ein Punkt hat nach der ersten Zuordnung den Cluster gewechselt.
   */
  function solve(points, startCenters) {
    const km = ns.kmeans;
    const rows = [];
    let centers = startCenters.map((c) => [c[0], c[1]]);
    let previous = null;
    let iteration = 0;
    let tie = false;
    let empty = false;
    let changedAfterFirst = false;
    let finalWcss = 0;
    while (iteration < MAX_ITERATIONS) {
      iteration++;
      const assignment = km.assign(points, centers);
      points.forEach((p, i) => {
        const d2 = centers.map((c) => km.dist2(p, c));
        const least = Math.min(...d2);
        const atLeast = d2.filter((d) => Math.abs(d - least) < EPSILON).length;
        tie = tie || atLeast > 1;
        rows.push({ kind: 'assign', iteration, point: i, x: p, centers, d2, cluster: assignment[i], tie: atLeast > 1 });
      });
      const changes = previous ? assignment.filter((c, i) => c !== previous[i]).length : assignment.length;
      if (previous && changes > 0) {
        changedAfterFirst = true;
      }
      if (previous && changes === 0) {
        finalWcss = km.wcss(points, centers, assignment);
        break;
      }
      const updated = km.update(points, assignment, centers);
      empty = empty || updated.empty.length > 0;
      updated.centers.forEach((next, c) => {
        const members = [];
        assignment.forEach((a, i) => {
          if (a === c) {
            members.push(i);
          }
        });
        rows.push({ kind: 'update', iteration, cluster: c, members, old: centers[c], next, auto: members.length === 0 });
      });
      const value = km.wcss(points, updated.centers, assignment);
      rows.push({ kind: 'wcss', iteration, value, assignment, centers: updated.centers });
      centers = updated.centers;
      previous = assignment;
      finalWcss = value;
    }
    return { rows, iterations: iteration, tie, empty, changedAfterFirst, finalWcss };
  }

  /**
   * Felder einer Zeile.
   *
   * @param {Object} row - Sollzeile.
   * @param {boolean} [distancesGiven] - Die Abstände sind vorgegeben.
   * @returns {string[]} Namen der Felder.
   */
  function fieldsOf(row, distancesGiven) {
    if (row.kind === 'assign') {
      return (distancesGiven ? [] : row.d2.map((_, c) => 'd' + c)).concat('cluster');
    }
    return row.kind === 'update' ? ['nx', 'ny'] : ['wcss'];
  }

  /**
   * Bezeichnung eines Felds.
   * @param {string} name - Feld.
   * @returns {string} Bezeichnung.
   */
  function fieldName(name) {
    if (name === 'cluster') {
      return 'Cluster';
    }
    if (name === 'nx') {
      return 'x des neuen Zentrums';
    }
    if (name === 'ny') {
      return 'y des neuen Zentrums';
    }
    return name === 'wcss' ? 'WCSS' : 'd² zu Zentrum ' + (Number(name.slice(1)) + 1);
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
   * @param {boolean} [distancesGiven] - Die Abstände sind vorgegeben.
   * @returns {{ok:boolean, kind:(string|null), hints:string[], wrong:string[]}} kind: 'syntax' (zählt nicht
   *   als Fehlversuch) oder 'calc'; wrong: falsche Felder, alle aus derselben Prüfstufe.
   */
  function checkRow(fields, row, distancesGiven) {
    const text = (name) => String(fields[name] === undefined ? '' : fields[name]).trim();
    const syntaxHints = [];
    const syntaxWrong = [];
    for (const name of fieldsOf(row, distancesGiven)) {
      const value = ns.pointData.parseNumber(text(name));
      if (text(name) === '') {
        syntaxHints.push(fieldName(name) + ' fehlt.');
        syntaxWrong.push(name);
      } else if (value === null) {
        syntaxHints.push(fieldName(name) + ' ist keine Zahl. Schreiben Sie zum Beispiel 1,5 oder 2.');
        syntaxWrong.push(name);
      } else if (name === 'cluster' && (!Number.isInteger(value) || value < 1 || value > row.d2.length)) {
        syntaxHints.push('Cluster muss eine ganze Zahl von 1 bis ' + row.d2.length + ' sein.');
        syntaxWrong.push(name);
      }
    }
    if (syntaxHints.length > 0) {
      return { ok: false, kind: 'syntax', hints: syntaxHints, wrong: syntaxWrong };
    }
    const failed = (hints, wrong) => ({ ok: false, kind: 'calc', hints, wrong });
    if (row.kind === 'assign') {
      if (!distancesGiven) {
        const hints = [];
        const wrong = [];
        row.d2.forEach((exact, c) => {
          const name = 'd' + c;
          if (!matches(text(name), exact)) {
            wrong.push(name);
            hints.push(exact > EPSILON && matches(text(name), Math.sqrt(exact))
              ? fieldName(name) + ' stimmt nicht: Das sieht nach dem Abstand ohne Quadrat aus. Gefragt ist d².'
              : fieldName(name) + ' stimmt nicht: d² = (x − Zentrum x)² + (y − Zentrum y)².');
          }
        });
        if (wrong.length > 0) {
          return failed(hints, wrong);
        }
      }
      if (ns.pointData.parseNumber(text('cluster')) !== row.cluster + 1) {
        return failed(['Cluster stimmt nicht: Der Punkt gehört zum Zentrum mit dem kleinsten d². Bei gleichem Abstand gilt die kleinere Nummer.'], ['cluster']);
      }
      return { ok: true, kind: null, hints: [], wrong: [] };
    }
    if (row.kind === 'update') {
      const hints = [];
      const wrong = [];
      [['nx', 0, 'x'], ['ny', 1, 'y']].forEach(([name, axis, letter]) => {
        if (!matches(text(name), row.next[axis])) {
          wrong.push(name);
          hints.push(fieldName(name) + ' stimmt nicht: Das ist der Mittelwert der ' + letter + '-Werte aller Punkte von Cluster ' + (row.cluster + 1) + '.');
        }
      });
      return wrong.length > 0 ? failed(hints, wrong) : { ok: true, kind: null, hints: [], wrong: [] };
    }
    if (!matches(text('wcss'), row.value)) {
      return failed(['WCSS stimmt nicht: Addieren Sie die quadrierten Abstände aller Punkte zu ihren neuen Zentren.'], ['wcss']);
    }
    return { ok: true, kind: null, hints: [], wrong: [] };
  }

  /**
   * Prüfstufe eines Felds.
   * @param {string} field - Feld.
   * @returns {string} 'distance', 'cluster', 'update' oder 'wcss'.
   */
  function groupOf(field) {
    if (field === 'cluster' || field === 'wcss') {
      return field;
    }
    return field === 'nx' || field === 'ny' ? 'update' : 'distance';
  }

  /**
   * Texte der Hilfe zu den falschen Feldern einer Zeile, für eine Stufe.
   *
   * @param {Object} row - Sollzeile.
   * @param {string[]} wrong - Falsche Felder der letzten Prüfung (alle aus derselben Prüfstufe).
   * @param {number} level - Stufe von 1 bis 3.
   * @param {number[][]} points - Punkte der Aufgabe.
   * @returns {string[]} Zeilen dieser Stufe.
   */
  function helpFor(row, wrong, level, points) {
    const { num, factor } = ns.simFormat;
    const group = groupOf(wrong[0]);
    if (group === 'distance') {
      if (level === 1) {
        return ['d² = (x − Zentrum x)² + (y − Zentrum y)². Eine Wurzel ist nicht nötig.'];
      }
      return wrong.map((f) => {
        const c = Number(f.slice(1));
        const center = row.centers[c];
        return level === 2
          ? fieldName(f) + ' = (' + num(row.x[0]) + ' − ' + factor(center[0]) + ')² + (' + num(row.x[1]) + ' − ' + factor(center[1]) + ')² = ?'
          : fieldName(f) + ' = ' + num(row.d2[c]);
      });
    }
    if (group === 'cluster') {
      if (level === 1) {
        return ['Der Punkt gehört zum Zentrum mit dem kleinsten d². Bei gleichem Abstand gilt die kleinere Nummer.'];
      }
      if (level === 2) {
        return ['Vergleichen Sie: ' + row.d2.map((d, c) => 'Zentrum ' + (c + 1) + ': ' + num(d)).join('; ') + '.'];
      }
      return ['Cluster ' + (row.cluster + 1)];
    }
    if (group === 'update') {
      if (level === 1) {
        return ['Das neue Zentrum ist der Mittelpunkt aller Punkte des Clusters: Addieren Sie je Achse die Werte und teilen Sie durch die Anzahl der Punkte.'];
      }
      return wrong.map((f) => {
        const axis = f === 'nx' ? 0 : 1;
        return level === 2
          ? fieldName(f) + ' = (' + row.members.map((i) => factor(points[i][axis])).join(' + ') + ') / ' + row.members.length + ' = ?'
          : fieldName(f) + ' = ' + num(row.next[axis]);
      });
    }
    if (level === 1) {
      return ['WCSS ist die Summe der quadrierten Abstände aller Punkte zu ihren neuen Zentren. Die Zuordnung bleibt die aus dieser Iteration.'];
    }
    if (level === 2) {
      const parts = points.map((p, i) => num(ns.kmeans.dist2(p, row.centers[row.assignment[i]])));
      return ['WCSS = ' + parts.join(' + ') + ' = ?'];
    }
    return ['WCSS = ' + num(row.value)];
  }

  ns.handCalc = { solve, fieldsOf, fieldName, matches, checkRow, groupOf, helpFor };
})(window.CC = window.CC || {});
