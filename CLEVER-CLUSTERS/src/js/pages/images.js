/**
 * @file pages/images.js
 * @description Seite 6: k-Means auf den Farben eines Bildes und Zählen zusammenhängender Flächen.
 *
 * Die Seite ist von allen anderen Seiten völlig unabhängig. Links steht das Original, rechts das
 * Ergebnis in den k Clusterfarben, darunter die Farbfelder und das Zählen. Ergebnisse bleiben je
 * Bild und k erhalten, damit das Bild beim Bewegen des Reglers nicht springt.
 *
 * Abhängigkeiten:
 *   dom-utils.js, sim-format.js, image-kmeans.js, object-count.js, sample-scenes.js
 *
 * Sicherheitsaspekte:
 *   Nur PNG: Endung, Größe, Dateikennung und die im Dateikopf genannten Maße werden geprüft, bevor
 *   das Bild dekodiert wird. Dekodiert wird mit createImageBitmap, sodass die Content-Security-Policy
 *   unverändert bleibt. Bilder bleiben im Browser und werden nirgends gespeichert.
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const { plural } = ns.simFormat;
  /** Höchstgröße einer Datei in Bytes (10 MB). */
  const MAX_FILE_BYTES = 10 * 1024 * 1024;
  /** Größte erlaubte Seitenlänge und Pixelzahl des Originals. */
  const MAX_SIDE = 10000;
  const MAX_PIXELS = 40000000;
  /** Gerechnet wird auf einer Fassung mit höchstens dieser langen Seite. */
  const WORK_SIDE = 480;
  const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const DEFAULT_K = 2;

  /** Aktuelles Bild: {title, image} oder null. */
  let current = null;
  /** Ergebnisse je k des aktuellen Bildes. */
  let results = new Map();
  let k = DEFAULT_K;
  let minArea = 100;
  let token = 0;

  /**
   * Prüft Dateikopf und Maße einer PNG-Datei.
   *
   * @param {Uint8Array} bytes - Inhalt.
   * @returns {{width:number, height:number}} Maße.
   * @throws {Error} Wenn die Datei kein gültiges PNG im erlaubten Rahmen ist.
   */
  function checkPng(bytes) {
    if (bytes.length < 24 || PNG_SIGNATURE.some((v, i) => bytes[i] !== v)) {
      throw new Error('Die Datei ist kein PNG-Bild.');
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = view.getUint32(16);
    const height = view.getUint32(20);
    if (width === 0 || height === 0 || width > MAX_SIDE || height > MAX_SIDE || width * height > MAX_PIXELS) {
      throw new Error('Das Bild ist zu groß (höchstens 10000 Pixel je Seite und 40 Megapixel).');
    }
    return { width, height };
  }

  /**
   * Malt ein dekodiertes Bild auf weißem Grund auf die Arbeitsgröße.
   *
   * @param {ImageBitmap} bitmap - Bild in Arbeitsgröße.
   * @returns {ImageData} Pixel.
   */
  function toImageData(bitmap) {
    const canvas = dom.el('canvas', { width: bitmap.width, height: bitmap.height });
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, bitmap.width, bitmap.height);
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  }

  /**
   * Liest eine hochgeladene PNG-Datei.
   *
   * @param {File} file - Datei.
   * @returns {Promise<ImageData>} Pixel in Arbeitsgröße.
   * @throws {Error} Bei unzulässiger Datei.
   */
  async function readPng(file) {
    if (!/\.png$/i.test(file.name)) {
      throw new Error('Nur Dateien vom Typ .png sind erlaubt.');
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new Error('Die Datei ist zu groß (höchstens 10 MB).');
    }
    const bytes = await ns.pointImport.readBytes(file);
    const { width, height } = checkPng(bytes);
    const factor = Math.min(1, WORK_SIDE / Math.max(width, height));
    let bitmap;
    try {
      bitmap = await createImageBitmap(file, {
        resizeWidth: Math.max(1, Math.round(width * factor)),
        resizeHeight: Math.max(1, Math.round(height * factor)),
        resizeQuality: 'high'
      });
    } catch (e) {
      throw new Error('Das Bild konnte nicht gelesen werden. Die Datei ist vermutlich beschädigt.');
    }
    const image = toImageData(bitmap);
    bitmap.close();
    return image;
  }

  /** @returns {Object} Ergebnis für das aktuelle k; wird bei Bedarf berechnet. */
  function resultForK() {
    if (!results.has(k)) {
      const image = current.image;
      const clustered = ns.imageKmeans.cluster(image, k);
      const recolored = new ImageData(image.width, image.height);
      ns.imageKmeans.recolor(clustered.labels, clustered.colors, recolored.data);
      results.set(k, {
        ...clustered,
        recolored,
        background: new Set([ns.objectCount.borderBackground(clustered.labels, image.width, image.height, clustered.colors.length)])
      });
    }
    return results.get(k);
  }

  /**
   * Zeichnet die nummerierten Rahmen ins Ergebnis.
   * @param {CanvasRenderingContext2D} ctx - Zeichenfläche.
   * @param {Array<Object>} boxes - Flächen.
   */
  function drawBoxes(ctx, boxes) {
    ctx.lineJoin = 'round';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    boxes.forEach((b, i) => {
      const w = b.x1 - b.x0 + 1;
      const h = b.y1 - b.y0 + 1;
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.strokeRect(b.x0 - 1, b.y0 - 1, w + 2, h + 2);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#111111';
      ctx.strokeRect(b.x0 - 1, b.y0 - 1, w + 2, h + 2);
      const text = String(i + 1);
      const tw = ctx.measureText(text).width + 6;
      ctx.fillStyle = '#111111';
      ctx.fillRect(b.x0 - 1, b.y0 - 1, tw, 16);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, b.x0 + 2, b.y0);
    });
  }

  /** Zeichnet die Farbfelder. */
  function renderPalette(result) {
    const box = dom.byId('img-palette');
    dom.clear(box);
    result.colors.forEach((color, i) => {
      const isBackground = result.background.has(i);
      const swatch = dom.svg('svg', { class: 'img-swatch', viewBox: '0 0 24 24', width: 24, height: 24, 'aria-hidden': 'true', focusable: 'false' },
        dom.svg('rect', { x: 1, y: 1, width: 22, height: 22, rx: 3, fill: 'rgb(' + color.join(',') + ')', stroke: '#5b6776' }));
      const button = dom.el('button', { type: 'button', class: 'btn img-color' + (isBackground ? ' is-background' : ''), id: 'img-color-' + i, 'aria-pressed': isBackground ? 'true' : 'false' }, [
        swatch,
        dom.el('span', null, Math.round(result.shares[i] * 100) + ' %, ' + (isBackground ? 'Hintergrund' : 'Objekt'))
      ]);
      button.addEventListener('click', () => {
        if (result.background.has(i)) {
          result.background.delete(i);
        } else {
          result.background.add(i);
        }
        render();
      });
      box.appendChild(button);
    });
  }

  /** Zeichnet die Seite. */
  function render() {
    const has = Boolean(current);
    dom.byId('img-empty').hidden = has;
    dom.byId('img-result').hidden = !has;
    dom.byId('img-k').disabled = !has;
    dom.byId('img-recalc').disabled = !has;
    dom.byId('img-k').value = String(k);
    dom.byId('img-k-value').textContent = String(k);
    if (!has) {
      return;
    }
    const image = current.image;
    const original = dom.byId('img-original');
    const output = dom.byId('img-output');
    for (const c of [original, output]) {
      c.width = image.width;
      c.height = image.height;
    }
    original.getContext('2d').putImageData(image, 0, 0);
    const result = resultForK();
    const ctx = output.getContext('2d');
    ctx.putImageData(result.recolored, 0, 0);
    const counted = ns.objectCount.count(result.labels, image.width, image.height, result.background, minArea);
    if (dom.byId('img-boxes').checked) {
      drawBoxes(ctx, counted.boxes);
    }
    renderPalette(result);
    const slider = dom.byId('img-min-area');
    slider.max = String(Math.max(10, Math.round(image.width * image.height * 0.02)));
    slider.value = String(minArea);
    dom.byId('img-min-area-value').textContent = plural(minArea, 'Pixel', 'Pixel');
    dom.byId('img-count').textContent = String(counted.count);
    dom.byId('img-ignored').textContent = counted.ignored > 0 ? plural(counted.ignored, 'kleinere Fläche', 'kleinere Flächen') + ' unter der Mindestgröße nicht mitgezählt.' : '';
    dom.byId('img-few-colors').hidden = result.colors.length === k;
    dom.byId('img-few-colors').textContent = 'Das Bild hat nur ' + plural(result.colors.length, 'Farbe', 'verschiedene Farben') + ', daher gibt es weniger als ' + k + ' Cluster.';
    dom.byId('img-output').setAttribute('aria-label', 'Ergebnisbild mit ' + plural(result.colors.length, 'Farbe', 'Farben') + ', ' + plural(counted.count, 'Fläche', 'Flächen') + ' gezählt');
  }

  /**
   * Übernimmt ein neues Bild.
   * @param {ImageData} image - Pixel.
   * @param {string} title - Bezeichnung.
   */
  function setImage(image, title) {
    current = { image, title };
    results = new Map();
    minArea = Math.max(1, Math.round(image.width * image.height * 0.002));
    dom.byId('img-original').setAttribute('aria-label', 'Original: ' + title);
    render();
  }

  /**
   * Zeigt das Ergebnis eines Ladevorgangs.
   * @param {string} kind - 'success' oder 'error'.
   * @param {string} text - Meldung.
   */
  function showStatus(kind, text) {
    const status = dom.byId('img-status');
    status.className = 'status status-' + kind;
    status.textContent = text;
    status.hidden = false;
  }

  /**
   * Lädt eine Beispielszene.
   * @param {string} id - Kennung.
   */
  function loadScene(id) {
    const scene = ns.sampleScenes.scenes.find((s) => s.id === id);
    if (!scene) {
      return;
    }
    token++;
    setImage(ns.sampleScenes.render(scene), scene.title);
    showStatus('success', '„' + scene.title + '“ geladen.');
  }

  /**
   * Lädt eine hochgeladene Datei.
   * @param {File} file - Datei.
   */
  async function upload(file) {
    const mine = ++token;
    try {
      const image = await readPng(file);
      if (mine === token) {
        setImage(image, 'hochgeladenes Bild');
        showStatus('success', 'Bild geladen (' + image.width + ' × ' + image.height + ' Pixel Arbeitsgröße).');
      }
    } catch (error) {
      if (mine === token) {
        showStatus('error', error.message);
      }
    } finally {
      dom.byId('img-file').value = '';
    }
  }

  /** Richtet die Seite ein. */
  function init() {
    const select = dom.byId('img-sample');
    for (const scene of ns.sampleScenes.scenes) {
      select.appendChild(dom.el('option', { value: scene.id }, scene.title));
    }
    dom.byId('img-sample-load').addEventListener('click', () => loadScene(select.value));
    dom.byId('img-file').addEventListener('change', (event) => {
      if (event.target.files.length > 0) {
        upload(event.target.files[0]);
      }
    });
    dom.byId('img-k').addEventListener('input', (event) => {
      k = Number(event.target.value);
      render();
    });
    dom.byId('img-recalc').addEventListener('click', () => {
      results.delete(k);
      render();
    });
    dom.byId('img-boxes').addEventListener('change', render);
    dom.byId('img-min-area').addEventListener('input', (event) => {
      minArea = Math.max(1, Number(event.target.value));
      render();
    });
  }

  ns.pages.images = { init, render, checkPng, readPng, state: () => ({ k, minArea, current, results }) };
})(window.CC = window.CC || {});
