/**
 * @file session.js
 * @description Gemeinsamer Stand der Seiten außer „Bilder und Objekte“: Datensatz, k, Startzentren, Skalierung, Schalter und der
 *              Trainer von Seite 2.
 *
 * Koordinaten:
 *   Der Datensatz und die Startzentren stehen in Originaleinheiten. coords() liefert die Werte, mit
 *   denen gerechnet und gezeichnet wird: bei eingeschalteter Skalierung Min-Max auf 0 bis 1 (auf
 *   vier Nachkommastellen gerundet), sonst die Originalwerte. So bleiben die Startzentren an
 *   derselben Stelle, wenn die Skalierung umgeschaltet oder ein einzelner Punkt geändert wird.
 *
 * Startzentren:
 *   Neue Daten per „ersetzen“ oder Beispiel löschen sie und setzen k auf den Standardwert zurück.
 *   Sinkt das größte mögliche k, werden überzählige Zentren verworfen.
 *
 * Version:
 *   version() steigt, sobald sich die Koordinaten ändern. Die Ellbogen- und die Silhouetten-Analyse
 *   verwerfen daran ihre Ergebnisse. Änderungen an k und an den Startzentren ändern sie nicht, denn
 *   diese Seiten arbeiten mit eigenem k und eigenen Zentren.
 *
 * Abhängigkeiten:
 *   point-data.js, coord-plot.js, cluster-data.js, kmeans.js
 */
(function (ns) {
  'use strict';

  const DEFAULT_K = 3;
  /** Größtes wählbares k. */
  const MAX_K = 100;
  /** Abstand in Einheiten der Zeichnung, bis zu dem ein Klick ein Zentrum trifft. */
  const CENTER_TOLERANCE = 12;
  /** Abstand in Einheiten der Zeichnung, bis zu dem ein Klick auf einem Datenpunkt einrastet. */
  const SNAP_TOLERANCE = 10;

  const data = ns.clusterData.create();
  const listeners = [];
  let wantedK = DEFAULT_K;
  let scale = false;
  let centers = [];
  let showAreas = false;
  let showTrail = false;
  let trainer = null;
  let version = 0;
  let cache = null;

  /**
   * Meldet eine Änderung an die Seiten.
   * @param {string} kind - 'data', 'config' oder 'centers'.
   */
  function emit(kind) {
    for (const fn of listeners) {
      fn(kind);
    }
  }

  /** @returns {{coords:number[][], scaler:(Object|null), distinct:number}} Abgeleitete Werte der Daten. */
  function model() {
    if (!cache) {
      const points = data.points();
      const scaler = scale ? ns.pointData.minMaxScaler(points) : null;
      const coords = points.map((p) => (scaler ? scaler.apply(p.x, p.y) : [p.x, p.y]));
      cache = { coords, scaler, distinct: new Set(coords.map((c) => c[0] + '|' + c[1])).size };
    }
    return cache;
  }

  /** @returns {number} Größtes wählbares k; 0 ohne Daten. */
  function maxK() {
    return Math.min(MAX_K, model().distinct);
  }

  /** @returns {number} Aktuelles k. */
  function k() {
    const max = maxK();
    return max > 0 ? Math.min(wantedK, max) : wantedK;
  }

  /**
   * Rechnet einen Punkt in die Koordinaten der Zeichnung um.
   * @param {number[]} center - Originaleinheiten.
   * @returns {number[]} Koordinaten.
   */
  function toModel(center) {
    const scaler = model().scaler;
    return scaler ? scaler.apply(center[0], center[1]) : [center[0], center[1]];
  }

  /**
   * Rechnet einen Punkt aus den Koordinaten der Zeichnung in Originaleinheiten um.
   * @param {number[]} coord - Koordinaten.
   * @returns {number[]} Originaleinheiten.
   */
  function toOriginal(coord) {
    const scaler = model().scaler;
    if (!scaler || !scaler.ranges) {
      return [coord[0], coord[1]];
    }
    const back = (v, r) => r.min + v * (r.max - r.min);
    return [back(coord[0], scaler.ranges.x), back(coord[1], scaler.ranges.y)];
  }

  /** @returns {number[][]} Startzentren in den Koordinaten der Zeichnung. */
  function modelCenters() {
    return centers.map(toModel);
  }

  /** @returns {{xmin:number, xmax:number, ymin:number, ymax:number}} Ausschnitt; schließt den Nullpunkt ein und richtet sich nach den Daten. */
  function view() {
    const base = ns.coordPlot.fitView(model().coords.map((c) => ({ x: c[0], y: c[1] })), { includeOrigin: true });
    const list = modelCenters();
    const outside = list.some((c) => c[0] < base.xmin || c[0] > base.xmax || c[1] < base.ymin || c[1] > base.ymax);
    if (!outside) {
      return base;
    }
    return ns.coordPlot.fitView(model().coords.concat(list).map((c) => ({ x: c[0], y: c[1] })), { includeOrigin: true });
  }

  /** Verwirft überzählige Zentren und den Trainer. */
  function settle() {
    if (centers.length > k()) {
      centers = centers.slice(0, k());
    }
    trainer = null;
  }

  /** @returns {boolean} true, wenn Daten und alle Startzentren vorhanden sind. */
  function isReady() {
    return data.count() > 0 && centers.length === k();
  }

  /** @returns {Object|null} Trainer von Seite 2; null, solange die Startzentren unvollständig sind. */
  function getTrainer() {
    if (!trainer && isReady()) {
      trainer = ns.kmeans.createTrainer(model().coords, modelCenters());
    }
    return trainer;
  }

  /**
   * Rundet einen frei gewählten Wert passend zur Spannweite der Achse.
   * @param {number} value - Wert.
   * @param {number} span - Spannweite.
   * @returns {number} Gerundeter Wert.
   */
  function roundFor(value, span) {
    if (!(span > 0)) {
      return value;
    }
    const factor = Math.pow(10, 3 - Math.floor(Math.log10(span)));
    return Math.round(value * factor) / factor;
  }

  /**
   * Verarbeitet einen Klick in die Zeichnung von Seite 1.
   *
   * @param {number} x - x in den Koordinaten der Zeichnung.
   * @param {number} y - y in den Koordinaten der Zeichnung.
   * @param {function(number, number):number[]} screenOf - Umrechnung in Einheiten der Zeichnung.
   * @returns {string} 'removed', 'added', 'snapped', 'full' oder 'empty'.
   */
  function clickCenter(x, y, screenOf) {
    if (data.count() === 0) {
      return 'empty';
    }
    const at = screenOf(x, y);
    const distance = (c) => {
      const s = screenOf(c[0], c[1]);
      return Math.hypot(s[0] - at[0], s[1] - at[1]);
    };
    const list = modelCenters();
    let hit = -1;
    let hitDistance = CENTER_TOLERANCE;
    list.forEach((c, i) => {
      const d = distance(c);
      if (d <= hitDistance) {
        hit = i;
        hitDistance = d;
      }
    });
    if (hit >= 0) {
      centers = centers.filter((_, i) => i !== hit);
      settle();
      emit('centers');
      return 'removed';
    }
    if (centers.length >= k()) {
      return 'full';
    }
    const coords = model().coords;
    let near = -1;
    let nearDistance = SNAP_TOLERANCE;
    coords.forEach((c, i) => {
      const d = distance(c);
      if (d <= nearDistance) {
        near = i;
        nearDistance = d;
      }
    });
    let result = 'snapped';
    if (near >= 0) {
      const p = data.points()[near];
      centers = centers.concat([[p.x, p.y]]);
    } else {
      result = 'added';
      const original = toOriginal([x, y]);
      const v = view();
      const scaler = model().scaler;
      const spanX = scaler && scaler.ranges ? scaler.ranges.x.max - scaler.ranges.x.min : v.xmax - v.xmin;
      const spanY = scaler && scaler.ranges ? scaler.ranges.y.max - scaler.ranges.y.min : v.ymax - v.ymin;
      centers = centers.concat([[roundFor(original[0], spanX), roundFor(original[1], spanY)]]);
    }
    settle();
    emit('centers');
    return result;
  }

  /**
   * Wählt k verschiedene Datenpunkte als Startzentren.
   * @param {string} [method] - 'random' (Standard) oder 'plusplus' (k-means++).
   */
  function randomCenters(method) {
    const points = data.points();
    const coords = model().coords;
    const indices = method === 'plusplus' ? ns.kmeans.plusPlusIndices(coords, k()) : ns.kmeans.randomIndices(coords, k());
    centers = indices.map((i) => [points[i].x, points[i].y]);
    settle();
    emit('centers');
  }

  data.onChange((event) => {
    cache = null;
    version++;
    if (event.type === 'replace') {
      centers = [];
      wantedK = DEFAULT_K;
    }
    settle();
    emit('data');
  });

  /** Schnittstelle für training-controls.js. */
  const runner = {
    step: () => { const t = getTrainer(); if (t) { t.step(); } },
    runIterations: (n) => { const t = getTrainer(); if (t) { t.runIterations(n); } },
    isFinished: () => { const t = getTrainer(); return Boolean(t) && t.isFinished(); },
    reset: () => { trainer = null; },
    isReady,
    hasStarted: () => Boolean(trainer) && trainer.hasStarted()
  };

  ns.session = {
    data, runner, onChange: (fn) => listeners.push(fn),
    coords: () => model().coords,
    distinct: () => model().distinct,
    scaler: () => model().scaler,
    version: () => version,
    k, maxK, view, toOriginal, modelCenters, isReady, clickCenter, randomCenters,
    trainer: getTrainer,
    centers: () => centers,
    scale: () => scale,
    showAreas: () => showAreas,
    showTrail: () => showTrail,
    setK: (value) => {
      wantedK = value;
      settle();
      emit('config');
    },
    setScale: (value) => {
      if (value !== scale) {
        scale = value;
        cache = null;
        version++;
        settle();
        emit('config');
      }
    },
    clearCenters: () => {
      centers = [];
      settle();
      emit('centers');
    },
    setShowAreas: (value) => { showAreas = value; },
    setShowTrail: (value) => { showTrail = value; },
    /** @returns {string[]} Anzeigenamen aller Punkte. */
    names: () => data.points().map((_, i) => data.displayName(i)),
    /** @returns {{x:string, y:string}} Achsenbeschriftungen. */
    axisLabels: () => {
      const a = data.attributes();
      return scale ? { x: a.x + ' (skaliert)', y: a.y + ' (skaliert)' } : a;
    },
    MAX_K, DEFAULT_K
  };
})(window.CC = window.CC || {});
