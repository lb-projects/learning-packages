/**
 * @file graph-import.js
 * @description Prüft hochgeladene Dateien, liest sie mit dem passenden Parser ein
 *              und wandelt die Zeilen in einen geprüften Graphen um.
 *
 * Ablauf:
 *   1. Dateiendung (Whitelist: .csv, .xlsx, .ods) und Dateigröße prüfen.
 *   2. Datei als Bytes lesen (FileReader) – die Datei wird nie ausgeführt,
 *      geöffnet oder als HTML/SVG/Bild dargestellt.
 *   3. "Magic Bytes" prüfen: XLSX/ODS müssen ZIP-Archive sein, CSV darf
 *      weder ZIP noch Binärdaten (Nullbytes) enthalten.
 *   4. Passenden Parser aufrufen (csv-parser.js, xlsx-parser.js, ods-parser.js).
 *   5. Format erkennen und Zeilen umwandeln (rowsToGraph):
 *
 * Formate (automatisch erkannt):
 *   Adjazenzmatrix – erste Zeile: leere Ecke (oder "gerichtet"/"ungerichtet"), dann die
 *     Knotennamen; jede weitere Zeile: Knotenname, dann die Gewichte. Erkannt an der leeren
 *     (bzw. mit der Richtung beschrifteten) Ecke und daran, dass die Namen der ersten Zeile
 *     und der ersten Spalte übereinstimmen.
 *     Keine Kante: leere Zelle, -, –, x oder ∞. Die Zahl 0 ist eine Kante mit Gewicht 0 –
 *     außer in einer reinen 0/1-Matrix (alle nichtleeren Zellen 0 oder 1, ungewichtete
 *     Adjazenzmatrix wie im Schulbuch): Dort bedeutet 0 „keine Kante“. Auf der Hauptdiagonalen
 *     bedeutet 0 immer „keine Kante“ (Abstand zu sich selbst; Schleifen gibt es nicht).
 *     Richtung: Angabe in der Ecke; sonst symmetrisch → ungerichtet, nicht symmetrisch → gerichtet.
 *   Kantenliste – je Zeile: von; nach; Gewicht (Gewicht optional, Standard 1).
 *     Eine Zeile mit nur einem Namen legt einen einzelnen Knoten an (z. B. ohne Kanten).
 *     Optionale Kopfzeile (erkannt an Wörtern wie "von", "nach", "Gewicht").
 *     Eine Zeile, die nur "gerichtet" oder "ungerichtet" enthält, legt die Richtung fest;
 *     sonst gilt die Einstellung auf der Seite.
 *     Ungerichtet: A;B;3 und B;A;3 beschreiben dieselbe Kante (wird zusammengefasst).
 *     Optional folgt nach den Kanten ein Positionsblock: Kopfzeile "knoten;x;y", darunter je
 *     Knoten Name; x; y (z. B. Pixel aus einer Abbildung, y nach unten). Die Positionen werden
 *     auf die Zeichenfläche skaliert (Seitenverhältnis bleibt, mittig). Fehlt für einen Knoten
 *     die Position, werden alle Knoten automatisch angeordnet (mit Hinweis). Unter einer
 *     Adjazenzmatrix ist der Block nicht vorgesehen (Hinweis, automatische Anordnung).
 *   Ungültige Zeilen werden mit Zeilennummer gemeldet und übersprungen.
 *
 * Abhängigkeiten:
 *   graph.js, csv-parser.js, xlsx-parser.js, ods-parser.js, zip-reader.js
 *
 * Sicherheitsaspekte:
 *   Siehe Ablauf. Fehlermeldungen enthalten nur Zeilennummern, feste Texte und
 *   bereits geprüfte Knotennamen, nie ungeprüften Rohinhalt der Datei.
 */
(function (ns) {
  'use strict';

  /** Höchstgröße einer hochgeladenen Datei in Bytes (2 MB). */
  const MAX_FILE_BYTES = 2 * 1024 * 1024;
  /** Höchstzahl einzeln aufgeführter Fehlermeldungen. */
  const MAX_LISTED_ERRORS = 10;
  /** Erlaubte Dateiendungen. */
  const ALLOWED_EXTENSIONS = ['csv', 'xlsx', 'ods'];
  /** Gelesene Spalten: Name + höchstens 26 Knoten einer Matrix, mit Reserve. */
  const COLUMNS = 30;
  /** Wörter, an denen eine Kopfzeile der Kantenliste erkannt wird. */
  const HEADER_WORDS = new Set(['von', 'nach', 'gewicht', 'kosten', 'länge', 'distanz', 'from', 'to', 'weight', 'startknoten', 'zielknoten']);
  /** Zellinhalte einer Matrix, die "keine Kante" bedeuten (0 nur in einer reinen 0/1-Matrix, siehe readMatrix). */
  const NO_EDGE = new Set(['', '-', '–', 'x', '∞']);
  /** Angaben zur Richtung. */
  const DIRECTION_WORDS = new Map([['gerichtet', true], ['ungerichtet', false]]);
  /** Erste Zelle der Kopfzeile des Positionsblocks. */
  const POSITION_HEADER = new Set(['knoten', 'node']);
  /** Größter Betrag einer Koordinate im Positionsblock. */
  const MAX_COORDINATE = 100000;
  /** Freiraum am Rand der Zeichenfläche beim Skalieren (Platz für Beschriftungen über und unter den Knoten). */
  const POSITION_PAD = Object.freeze({ x: 60, top: 70, bottom: 70 });

  /**
   * Ermittelt die Dateiendung in Kleinbuchstaben.
   * @param {string} fileName - Dateiname.
   * @returns {string} Endung ohne Punkt oder "".
   */
  function extensionOf(fileName) {
    const dot = fileName.lastIndexOf('.');
    return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : '';
  }

  /**
   * Liest eine Datei als Bytes ein.
   * @param {File} file - Ausgewählte Datei.
   * @returns {Promise<Uint8Array>} Dateiinhalt.
   */
  function readFileBytes(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result));
      reader.onerror = () => reject(new Error('Die Datei konnte nicht gelesen werden.'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Dekodiert CSV-Bytes als Text: zuerst streng als UTF-8, bei Fehlern als Windows-1252.
   * @param {Uint8Array} bytes - Dateiinhalt.
   * @returns {string} Text.
   */
  function decodeText(bytes) {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (e) {
      return new TextDecoder('windows-1252').decode(bytes);
    }
  }

  /**
   * Zellinhalt als bereinigter Text.
   * @param {{type:string, value:(number|string)}|undefined} cell - Zelle.
   * @returns {string} Text ohne Leerraum am Rand.
   */
  function cellText(cell) {
    return cell ? String(cell.value).trim() : '';
  }

  /**
   * Zellen einer Zeile ohne leere Zellen am Ende.
   * @param {Array} cells - Zellen.
   * @returns {Array} Gekürzte Zellen.
   */
  function trimCells(cells) {
    let end = cells.length;
    while (end > 0 && cellText(cells[end - 1]) === '') {
      end--;
    }
    return cells.slice(0, end);
  }

  /**
   * Erkennt eine Zeile, die nur die Richtung angibt.
   * @param {Array} cells - Zellen (gekürzt).
   * @returns {boolean|null} true/false für gerichtet/ungerichtet, sonst null.
   */
  function directionOf(cells) {
    if (cells.length !== 1) {
      return null;
    }
    const word = cellText(cells[0]).toLocaleLowerCase('de');
    return DIRECTION_WORDS.has(word) ? DIRECTION_WORDS.get(word) : null;
  }

  /**
   * Gewicht einer Zelle (Zahlzellen aus XLSX/ODS direkt, sonst als Text).
   * @param {{type:string, value:(number|string)}|undefined} cell - Zelle.
   * @returns {{ok:boolean, value?:number, error?:string}} Ergebnis von graph.parseWeight.
   */
  function weightOf(cell) {
    if (cell && cell.type === 'number') {
      return ns.graph.parseWeight(cell.value);
    }
    return ns.graph.parseWeight(cellText(cell));
  }

  /**
   * Neues, leeres Ergebnis.
   * @returns {Object} Ergebnis.
   */
  function emptyResult() {
    return { format: 'edges', directed: false, directionSource: 'setting', nodes: [], edges: [], errors: [], skipped: 0, merged: 0, truncated: false, positions: 'auto', positionNote: '' };
  }

  /**
   * Merkt eine Fehlermeldung (nur die ersten MAX_LISTED_ERRORS werden aufgeführt).
   * @param {Object} result - Ergebnis.
   * @param {number} rowNumber - Zeilennummer.
   * @param {string} message - Meldung.
   */
  function reject(result, rowNumber, message) {
    result.skipped++;
    if (result.errors.length < MAX_LISTED_ERRORS) {
      result.errors.push('Zeile ' + rowNumber + ': ' + message);
    }
  }

  /**
   * Prüft, ob die Zeilen eine Adjazenzmatrix bilden.
   * @param {Array<{row:number, cells:Array}>} rows - Zeilen ohne Richtungszeilen.
   * @returns {boolean} true bei Matrix.
   */
  function looksLikeMatrix(rows) {
    if (rows.length < 2) {
      return false;
    }
    // Die Ecke ist leer oder enthält die Richtung; eine Kantenliste beginnt nie mit einer leeren Zelle.
    const corner = cellText(rows[0].cells[0]).toLocaleLowerCase('de');
    if (corner !== '' && !DIRECTION_WORDS.has(corner)) {
      return false;
    }
    const head = trimCells(rows[0].cells).slice(1).map(cellText);
    if (head.length !== rows.length - 1 || head.some((t) => t === '')) {
      return false;
    }
    const key = (t) => ns.graph.keyOf(t);
    const headKeys = head.map(key).sort();
    const colKeys = rows.slice(1).map((r) => key(cellText(r.cells[0]))).sort();
    return headKeys.every((k, i) => k === colKeys[i]);
  }

  /**
   * Liest eine Adjazenzmatrix.
   * @param {Array<{row:number, cells:Array}>} rows - Zeilen ohne Richtungszeilen.
   * @param {boolean|null} fileDirection - Richtungsangabe aus einer Richtungszeile.
   * @returns {Object} Ergebnis.
   * @throws {Error} Bei ungültigen oder doppelten Namen, zu vielen Knoten oder Widerspruch zur Richtungsangabe.
   */
  function readMatrix(rows, fileDirection) {
    const g = ns.graph;
    const result = emptyResult();
    result.format = 'matrix';
    const corner = cellText(rows[0].cells[0]).toLocaleLowerCase('de');
    let direction = fileDirection;
    if (DIRECTION_WORDS.has(corner)) {
      direction = DIRECTION_WORDS.get(corner);
    }
    const names = trimCells(rows[0].cells).slice(1).map(cellText);
    if (names.length > g.LIMITS.maxNodes) {
      throw new Error('Die Matrix hat ' + names.length + ' Knoten (höchstens ' + g.LIMITS.maxNodes + ').');
    }
    const seen = new Set();
    for (const name of names) {
      const v = g.validateName(name);
      if (!v.ok) {
        throw new Error('Zeile ' + rows[0].row + ': ' + v.error);
      }
      if (seen.has(g.keyOf(v.value))) {
        throw new Error('Zeile ' + rows[0].row + ': Der Knoten „' + v.value + '“ kommt doppelt vor.');
      }
      seen.add(g.keyOf(v.value));
      result.nodes.push({ name: v.value });
    }
    const index = new Map(result.nodes.map((n, i) => [g.keyOf(n.name), i]));
    const n = names.length;
    /** Gewichte: weights[i][j] = Zahl oder null. */
    const weights = names.map(() => names.map(() => null));
    /** Zahl 0 oder 1 (als Zahlzelle oder Text). */
    const zeroOne = (cell) => (cell && cell.type === 'number' ? cell.value === 0 || cell.value === 1 : ['0', '1', '+0', '+1', '-0'].includes(cellText(cell)));
    const isZero = (cell) => (cell && cell.type === 'number' ? cell.value === 0 : /^[+\-\u2212]?0$/.test(cellText(cell)));
    // Reine 0/1-Matrix (ungewichtete Adjazenzmatrix): Dort steht 0 für „keine Kante“.
    const binary = rows.slice(1).every((r) => r.cells.slice(1, n + 1).every((cell) => cellText(cell) === '' || zeroOne(cell)));
    result.binary = binary;
    for (const r of rows.slice(1)) {
      const i = index.get(g.keyOf(cellText(r.cells[0])));
      for (let col = 0; col < n; col++) {
        const cell = r.cells[col + 1];
        const text = cellText(cell).toLocaleLowerCase('de');
        const j = index.get(g.keyOf(names[col]));
        if (NO_EDGE.has(text) || (isZero(cell) && (binary || i === j))) {
          continue;
        }
        const label = 'Zeile ' + r.row + ', Spalte ' + result.nodes[j].name + ': ';
        if (i === j) {
          result.skipped++;
          if (result.errors.length < MAX_LISTED_ERRORS) {
            result.errors.push(label + 'Schleifen (Kante von einem Knoten zu sich selbst) sind nicht möglich.');
          }
          continue;
        }
        const w = weightOf(cell);
        if (!w.ok) {
          result.skipped++;
          if (result.errors.length < MAX_LISTED_ERRORS) {
            result.errors.push(label + w.error);
          }
          continue;
        }
        weights[i][j] = w.value;
      }
    }
    let symmetric = true;
    for (let i = 0; i < n && symmetric; i++) {
      for (let j = i + 1; j < n; j++) {
        if (weights[i][j] !== weights[j][i]) {
          symmetric = false;
          break;
        }
      }
    }
    if (direction === null) {
      direction = !symmetric;
      result.directionSource = symmetric ? 'symmetric' : 'asymmetric';
    } else {
      result.directionSource = 'file';
      if (direction === false && !symmetric) {
        throw new Error('Die Matrix ist als ungerichtet angegeben, aber nicht symmetrisch (Zeile und Spalte eines Knotens stimmen nicht überein).');
      }
    }
    result.directed = direction;
    for (let i = 0; i < n; i++) {
      for (let j = direction ? 0 : i + 1; j < n; j++) {
        if (weights[i][j] !== null) {
          if (result.edges.length >= g.LIMITS.maxEdges) {
            result.truncated = true;
            return result;
          }
          result.edges.push({ from: result.nodes[i].name, to: result.nodes[j].name, weight: weights[i][j] });
        }
      }
    }
    return result;
  }

  /**
   * Liest eine Kantenliste.
   * @param {Array<{row:number, cells:Array}>} rows - Zeilen ohne Richtungszeilen.
   * @param {boolean} directed - Richtung (aus der Datei oder der Einstellung).
   * @returns {Object} Ergebnis.
   */
  function readEdgeList(rows, directed) {
    const g = ns.graph;
    const result = emptyResult();
    result.directed = directed;
    let start = 0;
    if (rows.length > 0 && rows[0].cells.slice(0, 3).some((c) => HEADER_WORDS.has(cellText(c).toLocaleLowerCase('de')))) {
      start = 1;
    }
    /** Schlüssel → Name in der ersten Schreibweise. */
    const names = new Map();
    /** Kantenschlüssel → Index in result.edges. */
    const pairs = new Map();

    /**
     * Prüft einen Namen und legt den Knoten bei Bedarf an.
     * @returns {{ok:boolean, value?:string, error?:string}} Name oder Fehler.
     */
    function useNode(text, limitCheck) {
      const v = g.validateName(text);
      if (!v.ok) {
        return v;
      }
      const key = g.keyOf(v.value);
      if (names.has(key)) {
        return { ok: true, value: names.get(key) };
      }
      if (limitCheck && names.size >= g.LIMITS.maxNodes) {
        return { ok: false, error: 'Mehr als ' + g.LIMITS.maxNodes + ' Knoten sind nicht möglich.' };
      }
      return { ok: true, value: v.value, isNew: true };
    }

    for (let i = start; i < rows.length; i++) {
      const { row } = rows[i];
      const cells = trimCells(rows[i].cells);
      const fromText = cellText(cells[0]);
      const toText = cellText(cells[1]);
      const weightText = cellText(cells[2]);
      if (fromText === '') {
        reject(result, row, 'Der Startknoten fehlt.');
        continue;
      }
      if (toText === '' && weightText !== '') {
        reject(result, row, 'Der Endknoten fehlt.');
        continue;
      }
      const from = useNode(fromText, true);
      if (!from.ok) {
        reject(result, row, from.error);
        continue;
      }
      if (toText === '') {
        // Einzelner Knoten ohne Kante.
        if (from.isNew) {
          names.set(g.keyOf(from.value), from.value);
          result.nodes.push({ name: from.value });
        }
        continue;
      }
      const to = useNode(toText, true);
      if (!to.ok) {
        reject(result, row, to.error);
        continue;
      }
      if (from.isNew && to.isNew && names.size + 2 > g.LIMITS.maxNodes && g.keyOf(from.value) !== g.keyOf(to.value)) {
        reject(result, row, 'Mehr als ' + g.LIMITS.maxNodes + ' Knoten sind nicht möglich.');
        continue;
      }
      if (g.keyOf(from.value) === g.keyOf(to.value)) {
        reject(result, row, 'Schleifen (Kante von einem Knoten zu sich selbst) sind nicht möglich.');
        continue;
      }
      const w = weightOf(cells[2]);
      if (!w.ok) {
        reject(result, row, w.error);
        continue;
      }
      const a = g.keyOf(from.value);
      const b = g.keyOf(to.value);
      const pair = directed ? a + '\u0000' + b : [a, b].sort().join('\u0000');
      if (pairs.has(pair)) {
        const old = result.edges[pairs.get(pair)];
        const sameDirection = g.keyOf(old.from) === a;
        if (!directed && !sameDirection && old.weight === w.value) {
          result.merged++;
          continue;
        }
        reject(result, row, 'Die Kante ' + (names.get(a) || from.value) + (directed ? '→' : '–') + (names.get(b) || to.value) +
          ' kommt doppelt vor' + (!directed && !sameDirection ? ' (in der Gegenrichtung mit anderem Gewicht)' : '') + '.');
        continue;
      }
      if (result.edges.length >= g.LIMITS.maxEdges) {
        result.truncated = true;
        break;
      }
      for (const v of [from, to]) {
        if (v.isNew && !names.has(g.keyOf(v.value))) {
          names.set(g.keyOf(v.value), v.value);
          result.nodes.push({ name: v.value });
        }
      }
      pairs.set(pair, result.edges.length);
      result.edges.push({ from: names.get(a), to: names.get(b), weight: w.value });
    }
    return result;
  }

  /**
   * Erkennt die Kopfzeile des Positionsblocks ("knoten;x;y").
   * @param {Array} cells - Zellen (gekürzt).
   * @returns {boolean} true bei Kopfzeile.
   */
  function isPositionHeader(cells) {
    const t = cells.map((c) => cellText(c).toLocaleLowerCase('de'));
    return cells.length === 3 && POSITION_HEADER.has(t[0]) && t[1] === 'x' && t[2] === 'y';
  }

  /**
   * Koordinate einer Zelle (Zahlzellen aus XLSX/ODS direkt, sonst Text mit Punkt oder Komma).
   * @param {{type:string, value:(number|string)}|undefined} cell - Zelle.
   * @returns {number|null} Zahl oder null.
   */
  function coordinateOf(cell) {
    let value = null;
    if (cell && cell.type === 'number') {
      value = cell.value;
    } else {
      const text = cellText(cell).replace('−', '-');
      if (/^-?\d{1,6}([.,]\d{1,4})?$/.test(text)) {
        value = Number(text.replace(',', '.'));
      }
    }
    return Number.isFinite(value) && Math.abs(value) <= MAX_COORDINATE ? value : null;
  }

  /**
   * Skaliert Positionen auf die Zeichenfläche (Seitenverhältnis bleibt erhalten, mittig).
   * @param {Array<{x:number, y:number}>} points - Positionen (y nach unten).
   * @returns {Array<{x:number, y:number}>} Positionen auf der Zeichenfläche.
   */
  function fitPositions(points) {
    const area = ns.graph.AREA;
    const minX = Math.min(...points.map((p) => p.x));
    const maxX = Math.max(...points.map((p) => p.x));
    const minY = Math.min(...points.map((p) => p.y));
    const maxY = Math.max(...points.map((p) => p.y));
    const boxW = area.width - 2 * POSITION_PAD.x;
    const boxH = area.height - POSITION_PAD.top - POSITION_PAD.bottom;
    const w = maxX - minX;
    const h = maxY - minY;
    const scale = Math.min(w > 0 ? boxW / w : Infinity, h > 0 ? boxH / h : Infinity);
    const k = Number.isFinite(scale) ? scale : 0;
    const offX = POSITION_PAD.x + (boxW - w * k) / 2;
    const offY = POSITION_PAD.top + (boxH - h * k) / 2;
    return points.map((p) => ({ x: Math.round(offX + (p.x - minX) * k), y: Math.round(offY + (p.y - minY) * k) }));
  }

  /**
   * Übernimmt den Positionsblock in ein Ergebnis der Kantenliste.
   * @param {Object} result - Ergebnis von readEdgeList.
   * @param {Array<{row:number, cells:Array}>} rows - Zeilen des Blocks (ohne Kopfzeile).
   */
  function applyPositions(result, rows) {
    const g = ns.graph;
    const index = new Map(result.nodes.map((n, i) => [g.keyOf(n.name), i]));
    const found = new Map();
    for (const { row, cells: raw } of rows) {
      const cells = trimCells(raw);
      const v = g.validateName(cellText(cells[0]));
      if (!v.ok) {
        reject(result, row, v.error);
        continue;
      }
      const key = g.keyOf(v.value);
      if (!index.has(key)) {
        reject(result, row, 'Der Knoten ' + v.value + ' kommt in der Kantenliste nicht vor.');
        continue;
      }
      if (found.has(key)) {
        reject(result, row, 'Die Position von ' + result.nodes[index.get(key)].name + ' ist doppelt angegeben.');
        continue;
      }
      const x = coordinateOf(cells[1]);
      const y = coordinateOf(cells[2]);
      if (x === null || y === null || cells.length > 3) {
        reject(result, row, 'Eine Position besteht aus Knoten; x; y (zwei Zahlen).');
        continue;
      }
      found.set(key, { x, y });
    }
    const missing = result.nodes.filter((n) => !found.has(g.keyOf(n.name)));
    if (missing.length > 0) {
      result.positionNote = missing.length === result.nodes.length
        ? 'Die Positionsliste enthält keine gültige Position – die Knoten werden automatisch angeordnet.'
        : 'Für ' + ns.dom.joinNames(missing.slice(0, 5).map((n) => n.name)) + (missing.length > 5 ? ' und weitere' : '') +
          ' fehlt die Position – alle Knoten werden automatisch angeordnet.';
      return;
    }
    const fitted = fitPositions(result.nodes.map((n) => found.get(g.keyOf(n.name))));
    result.nodes = result.nodes.map((n, i) => ({ name: n.name, x: fitted[i].x, y: fitted[i].y }));
    result.positions = 'file';
  }

  /**
   * Wandelt geparste Zeilen in einen Graphen um.
   *
   * @param {Array<{row:number, cells:Array<{type:string, value:(number|string)}>}>} rows - Zeilen.
   * @param {boolean} defaultDirected - Richtung, falls die Datei keine angibt (Kantenliste).
   * @returns {{format:string, directed:boolean, directionSource:string, nodes:Array<{name:string, x?:number, y?:number}>,
   *            edges:Array<{from:string, to:string, weight:number}>, errors:string[], skipped:number,
   *            merged:number, truncated:boolean, positions:('auto'|'file'), positionNote:string}} Ergebnis
   *   (positions = 'file': Positionen aus dem Positionsblock; positionNote: Hinweis, warum er nicht gilt).
   * @throws {Error} Bei Fehlern, die die ganze Datei unbrauchbar machen (z. B. Matrix mit doppeltem Namen).
   */
  function rowsToGraph(rows, defaultDirected) {
    let fileDirection = null;
    const data = [];
    let positionRows = null;
    for (const r of rows) {
      const cells = trimCells(r.cells);
      if (cells.length === 0) {
        continue;
      }
      if (positionRows !== null) {
        positionRows.push(r);
        continue;
      }
      if (isPositionHeader(cells)) {
        positionRows = [];
        continue;
      }
      const d = directionOf(cells);
      if (d !== null) {
        if (fileDirection === null) {
          fileDirection = d;
        }
        continue;
      }
      data.push(r);
    }
    if (looksLikeMatrix(data)) {
      const matrix = readMatrix(data, fileDirection);
      if (positionRows !== null) {
        matrix.positionNote = 'Positionen werden nur bei einer Kantenliste übernommen – die Knoten werden automatisch angeordnet.';
      }
      return matrix;
    }
    const result = readEdgeList(data, fileDirection === null ? Boolean(defaultDirected) : fileDirection);
    result.directionSource = fileDirection === null ? 'setting' : 'file';
    if (positionRows !== null) {
      applyPositions(result, positionRows);
    }
    return result;
  }

  /**
   * Liest eine hochgeladene Datei ein und liefert einen geprüften Graphen.
   * Der aktuelle Graph wird hier NICHT verändert; das übernimmt die Seite nach Rückfrage.
   *
   * @param {File} file - Vom Benutzer gewählte Datei.
   * @param {boolean} defaultDirected - Richtung, falls die Datei keine angibt.
   * @returns {Promise<Object>} Ergebnis von rowsToGraph, zusätzlich fileType.
   * @throws {Error} Bei unzulässiger, zu großer oder beschädigter Datei.
   */
  async function importFile(file, defaultDirected) {
    const extension = extensionOf(file.name);
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      throw new Error('Nur Dateien vom Typ .csv, .xlsx oder .ods sind erlaubt.');
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new Error('Die Datei ist zu groß (höchstens 2 MB).');
    }
    if (file.size === 0) {
      throw new Error('Die Datei ist leer.');
    }
    const bytes = await readFileBytes(file);
    // Kanten + Kopf- und Richtungszeile + Positionsblock + Reserve für ungültige Zeilen.
    const maxRows = ns.graph.LIMITS.maxEdges * 2 + ns.graph.LIMITS.maxNodes + 3;

    let parsed;
    if (extension === 'csv') {
      if (ns.zip.looksLikeZip(bytes) || bytes.includes(0)) {
        throw new Error('Die Datei ist keine Textdatei im CSV-Format.');
      }
      parsed = ns.csv.parseCsv(decodeText(bytes), maxRows, COLUMNS);
    } else {
      if (!ns.zip.looksLikeZip(bytes)) {
        throw new Error('Die Datei ist keine gültige ' + (extension === 'xlsx' ? 'Excel-Datei.' : 'OpenDocument-Tabelle.'));
      }
      parsed = extension === 'xlsx' ? ns.xlsx.parseXlsx(bytes, maxRows, COLUMNS) : ns.ods.parseOds(bytes, maxRows, COLUMNS);
    }
    const result = rowsToGraph(parsed.rows, defaultDirected);
    result.truncated = result.truncated || parsed.truncated;
    result.fileType = extension;
    return result;
  }

  /**
   * Liest Text im CSV-Format (für die eingebauten Beispielgraphen).
   * @param {string} text - CSV-Text.
   * @param {boolean} defaultDirected - Richtung, falls der Text keine angibt.
   * @returns {Object} Ergebnis von rowsToGraph.
   */
  function importText(text, defaultDirected) {
    return rowsToGraph(ns.csv.parseCsv(text, ns.graph.LIMITS.maxEdges * 2 + ns.graph.LIMITS.maxNodes + 3, COLUMNS).rows, defaultDirected);
  }

  ns.graphImport = { importFile, importText, rowsToGraph, fitPositions, extensionOf, MAX_FILE_BYTES };
})(window.HG = window.HG || {});
