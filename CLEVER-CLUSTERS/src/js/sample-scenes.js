/**
 * @file sample-scenes.js
 * @description Zeichnet die Beispielbilder von Seite 9 auf eine Canvas, mit festem Startwert.
 *
 * Die Bilder sind Zeichnungen und kommen ohne Bilddateien aus. Titel und Meldungen sind
 * neutral und verraten weder Schwierigkeit noch Anzahl; die Auflösung steht nur in der README.
 *
 * Abhängigkeiten:
 *   dom-utils.js
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const WIDTH = 480;
  const HEIGHT = 300;

  /**
   * Zufallsquelle mit festem Startwert (mulberry32), damit jede Szene immer gleich aussieht.
   * @param {number} seed - Startwert.
   * @returns {function():number} Zahlen von 0 bis unter 1.
   */
  function seeded(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Füllt eine Ellipse.
   * @param {CanvasRenderingContext2D} c - Zeichenfläche.
   * @param {number} x - Mitte x.
   * @param {number} y - Mitte y.
   * @param {number} rx - Radius x.
   * @param {number} ry - Radius y.
   * @param {string} color - Farbe.
   * @param {number} [rotation] - Drehung.
   */
  function ellipse(c, x, y, rx, ry, color, rotation) {
    c.fillStyle = color;
    c.beginPath();
    c.ellipse(x, y, rx, ry, rotation || 0, 0, Math.PI * 2);
    c.fill();
  }

  /**
   * Zeichnet eine Kuh von der Seite.
   *
   * @param {CanvasRenderingContext2D} c - Zeichenfläche.
   * @param {number} x - Mitte x.
   * @param {number} y - Mitte y.
   * @param {number} s - Größe.
   * @param {{body:string, patch?:string, flip?:boolean, seed?:number}} o - Farben und Blickrichtung.
   */
  function cow(c, x, y, s, o) {
    c.save();
    c.translate(x, y);
    c.scale(o.flip ? -s : s, s);
    const body = o.body;
    c.fillStyle = body;
    for (const lx of [-20, -12, 12, 20]) {
      c.fillRect(lx - 2.5, 6, 5, 20);
    }
    c.fillStyle = '#2b2118';
    for (const lx of [-20, -12, 12, 20]) {
      c.fillRect(lx - 2.5, 23, 5, 3);
    }
    ellipse(c, 0, 0, 29, 15, body);
    c.fillRect(-27, -5, 54, 14);
    c.strokeStyle = body;
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(-28, -5);
    c.quadraticCurveTo(-35, 2, -33, 15);
    c.stroke();
    ellipse(c, 6, 11, 5, 4, '#d9a0a0');
    c.fillStyle = body;
    c.beginPath();
    c.moveTo(22, -12);
    c.lineTo(34, -17);
    c.lineTo(34, 2);
    c.lineTo(22, 6);
    c.fill();
    ellipse(c, 38, -13, 10, 9, body);
    ellipse(c, 45, -9, 6, 5, '#d9b3a0');
    ellipse(c, 33, -22, 5, 2.5, body, -0.5);
    c.fillStyle = '#e8e0c8';
    c.fillRect(38, -25, 2, 5);
    ellipse(c, 40, -15, 1.6, 1.6, '#0a0a0a');
    if (o.patch) {
      c.save();
      c.beginPath();
      c.rect(-28, -15, 56, 26);
      c.clip();
      const rnd = seeded(o.seed || 1);
      for (let i = 0; i < 5; i++) {
        ellipse(c, -24 + rnd() * 48, -11 + rnd() * 20, 5 + rnd() * 6, 4 + rnd() * 5, o.patch, rnd() * 3);
      }
      c.restore();
    }
    c.restore();
  }

  /**
   * Zeichnet einen Fisch.
   *
   * @param {CanvasRenderingContext2D} c - Zeichenfläche.
   * @param {number} x - Mitte x.
   * @param {number} y - Mitte y.
   * @param {number} s - Größe.
   * @param {{body:string, belly:string, fin:string, flip?:boolean}} o - Farben und Blickrichtung.
   */
  function fish(c, x, y, s, o) {
    c.save();
    c.translate(x, y);
    c.scale(o.flip ? -s : s, s);
    c.lineWidth = 1.8;
    c.strokeStyle = '#141a22';
    c.fillStyle = o.fin;
    c.beginPath();
    c.moveTo(-22, 0);
    c.lineTo(-38, -13);
    c.lineTo(-33, 0);
    c.lineTo(-38, 13);
    c.closePath();
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(-10, -14);
    c.quadraticCurveTo(0, -27, 12, -14);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = o.body;
    c.beginPath();
    c.ellipse(0, 0, 26, 16, 0, 0, Math.PI * 2);
    c.fill();
    c.save();
    c.clip();
    ellipse(c, 2, 12, 26, 9, o.belly);
    c.fillStyle = o.fin;
    c.fillRect(-12, -18, 5, 36);
    c.fillRect(-1, -18, 5, 36);
    c.restore();
    c.beginPath();
    c.ellipse(0, 0, 26, 16, 0, 0, Math.PI * 2);
    c.stroke();
    ellipse(c, 15, -5, 4.2, 4.2, '#ffffff');
    ellipse(c, 16, -5, 2, 2, '#0a0a0a');
    c.strokeStyle = '#141a22';
    c.beginPath();
    c.moveTo(25, 4);
    c.lineTo(14, 7);
    c.stroke();
    c.restore();
  }

  /**
   * Zeichnet einen Baum.
   * @param {CanvasRenderingContext2D} c - Zeichenfläche.
   * @param {number} x - Stamm x.
   * @param {number} y - Fußpunkt y.
   * @param {number} s - Größe.
   */
  function tree(c, x, y, s) {
    c.fillStyle = '#4a3320';
    c.fillRect(x - 5 * s, y - 40 * s, 10 * s, 40 * s);
    ellipse(c, x, y - 58 * s, 28 * s, 30 * s, '#1f5a24');
    ellipse(c, x - 16 * s, y - 45 * s, 18 * s, 16 * s, '#236528');
    ellipse(c, x + 16 * s, y - 45 * s, 18 * s, 16 * s, '#1b5220');
  }

  /**
   * Zeichnet Grasbüschel oder andere kurze Striche.
   *
   * @param {CanvasRenderingContext2D} c - Zeichenfläche.
   * @param {function():number} rnd - Zufallsquelle.
   * @param {number} count - Anzahl.
   * @param {number} y0 - Oberer Rand.
   * @param {string[]} colors - Farben.
   */
  function strokes(c, rnd, count, y0, colors) {
    c.lineWidth = 1;
    for (let i = 0; i < count; i++) {
      const x = rnd() * WIDTH;
      const y = y0 + rnd() * (HEIGHT - y0);
      c.strokeStyle = colors[Math.floor(rnd() * colors.length)];
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + (rnd() - 0.5) * 3, y - 2 - rnd() * 4);
      c.stroke();
    }
  }

  /**
   * Fügt jedem Pixel etwas Rauschen hinzu.
   * @param {ImageData} image - Pixel.
   * @param {function():number} rnd - Zufallsquelle.
   * @param {number} amount - Größte Abweichung.
   */
  function addNoise(image, rnd, amount) {
    const d = image.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (rnd() - 0.5) * 2 * amount;
      d[i] += n;
      d[i + 1] += n;
      d[i + 2] += n;
    }
  }

  /** Zeichnet Himmel und Wiese. */
  function skyAndMeadow(c, horizon) {
    const sky = c.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#7fbce6');
    sky.addColorStop(1, '#c4e2f4');
    c.fillStyle = sky;
    c.fillRect(0, 0, WIDTH, horizon);
    c.fillStyle = '#5da043';
    c.fillRect(0, horizon, WIDTH, HEIGHT - horizon);
  }

  /** Die Szenen. Jede kennt ihre tatsächliche Anzahl an Tieren (count), nur für Tests und die README. */
  const scenes = [
    {
      id: 'weide-1', title: 'Weide 1', count: 8, seed: 11, noise: 6,
      draw(c) {
        c.fillStyle = '#5da043';
        c.fillRect(0, 0, WIDTH, HEIGHT);
        const places = [[70, 60], [195, 50], [330, 65], [425, 120], [95, 160], [240, 150], [90, 255], [320, 240]];
        places.forEach(([x, y], i) => cow(c, x, y, 0.95, { body: '#3a2a1c', flip: i % 2 === 1 }));
      }
    },
    {
      id: 'weide-2', title: 'Weide 2', count: 9, seed: 22, noise: 6,
      draw(c) {
        skyAndMeadow(c, 90);
        const places = [[70, 130], [190, 125], [310, 135], [425, 130], [100, 195], [235, 200], [370, 200], [150, 265], [320, 268]];
        places.forEach(([x, y], i) => cow(c, x, y, 0.9, { body: '#f2efe6', patch: '#16130f', flip: i % 2 === 0, seed: 100 + i }));
      }
    },
    {
      id: 'weide-3', title: 'Weide 3', count: 10, seed: 33, noise: 8,
      draw(c, rnd) {
        skyAndMeadow(c, 80);
        strokes(c, rnd, 1400, 82, ['#4b8a35', '#74b355', '#548f3c']);
        tree(c, 50, 120, 1.05);
        tree(c, 420, 110, 0.9);
        const colors = ['#6b3f1d', '#f0e9d8', '#1c1712', '#a06a33', '#e6d4aa'];
        const places = [[155, 105], [285, 100], [90, 165], [225, 160], [360, 165], [445, 195], [60, 235], [190, 240], [320, 235], [420, 265]];
        places.forEach(([x, y], i) => {
          ellipse(c, x, y + 25, 34, 6, '#3c6e2c');
          cow(c, x, y, 0.85, { body: colors[i % colors.length], flip: i % 3 === 0 });
        });
      }
    },
    {
      id: 'weide-4', title: 'Weide 4', count: 16, seed: 44, noise: 6,
      draw(c) {
        c.fillStyle = '#5da043';
        c.fillRect(0, 0, WIDTH, HEIGHT);
        const places = [[70, 55], [130, 75], [195, 50], [255, 80], [325, 55], [390, 85], [95, 125], [165, 135], [235, 130], [310, 125], [385, 145], [70, 195], [145, 205], [225, 200], [295, 195], [370, 225]];
        places.forEach(([x, y], i) => cow(c, x, y, 1, { body: i % 2 ? '#3a2a1c' : '#4a3524', flip: i % 3 === 1 }));
      }
    },
    {
      id: 'weide-5', title: 'Weide 5', count: 8, seed: 55, noise: 12,
      draw(c, rnd) {
        c.fillStyle = '#8f6c45';
        c.fillRect(0, 0, WIDTH, HEIGHT);
        for (let i = 0; i < 70; i++) {
          ellipse(c, rnd() * WIDTH, rnd() * HEIGHT, 8 + rnd() * 26, 4 + rnd() * 12, rnd() < 0.5 ? '#7d5c39' : '#a07c52', rnd() * 3);
        }
        const places = [[75, 70], [205, 60], [350, 80], [425, 165], [100, 170], [250, 165], [130, 260], [320, 255]];
        places.forEach(([x, y], i) => cow(c, x, y, 0.95, { body: '#6f4e2c', flip: i % 2 === 0 }));
      }
    },
    {
      id: 'aquarium-1', title: 'Aquarium 1', count: 7, seed: 66, noise: 4,
      draw(c) {
        c.fillStyle = '#a8cfdc';
        c.fillRect(0, 0, WIDTH, HEIGHT);
        const places = [[75, 60], [215, 55], [370, 70], [125, 155], [290, 150], [420, 185], [190, 245]];
        places.forEach(([x, y], i) => fish(c, x, y, 1.05, { body: '#ec8a2a', belly: '#f6efdc', fin: '#7a3d0c', flip: i % 2 === 1 }));
      }
    },
    {
      id: 'aquarium-2', title: 'Aquarium 2', count: 12, seed: 77, noise: 6,
      draw(c, rnd) {
        const water = c.createLinearGradient(0, 0, 0, HEIGHT);
        water.addColorStop(0, '#5ea6c6');
        water.addColorStop(0.75, '#a9cfd8');
        water.addColorStop(1, '#d8e4dc');
        c.fillStyle = water;
        c.fillRect(0, 0, WIDTH, HEIGHT);
        c.fillStyle = '#e9dcc5';
        c.beginPath();
        c.moveTo(0, HEIGHT);
        c.lineTo(0, 275);
        c.quadraticCurveTo(240, 250, WIDTH, 280);
        c.lineTo(WIDTH, HEIGHT);
        c.fill();
        c.lineWidth = 9;
        c.lineCap = 'round';
        for (const [x, h, bend] of [[345, 240, 40], [395, 200, -30], [120, 150, 25], [20, 180, 18], [465, 170, -14]]) {
          c.strokeStyle = '#5c9b58';
          c.beginPath();
          c.moveTo(x, HEIGHT);
          c.quadraticCurveTo(x + bend, HEIGHT - h / 2, x - bend / 2, HEIGHT - h);
          c.stroke();
        }
        c.lineCap = 'butt';
        c.lineWidth = 1.5;
        c.strokeStyle = '#d8eef6';
        for (let i = 0; i < 26; i++) {
          c.beginPath();
          c.arc(rnd() * WIDTH, rnd() * 220, 2 + rnd() * 6, 0, Math.PI * 2);
          c.stroke();
        }
        const blue = { body: '#1f6fa6', belly: '#cfe3ea', fin: '#c23a1e' };
        const blueDark = { body: '#2b7fb4', belly: '#2b7fb4', fin: '#e0a020' };
        const orange = { body: '#f09a2a', belly: '#f6efdc', fin: '#c23a1e' };
        const places = [[60, 55, blue], [175, 50, blue], [290, 45, blueDark], [410, 55, orange], [105, 125, orange], [225, 120, orange], [345, 130, blue], [440, 145, blueDark], [60, 200, orange], [175, 195, blue], [295, 210, orange], [415, 235, blueDark]];
        places.forEach(([x, y, o], i) => fish(c, x, y, 1, { ...o, flip: i % 3 === 2 }));
      }
    }
  ];

  /**
   * Zeichnet eine Szene.
   * @param {Object} scene - Eintrag aus scenes.
   * @returns {ImageData} Pixel.
   */
  function render(scene) {
    const canvas = dom.el('canvas', { width: WIDTH, height: HEIGHT });
    const c = canvas.getContext('2d', { willReadFrequently: true });
    const rnd = seeded(scene.seed);
    scene.draw(c, rnd);
    const image = c.getImageData(0, 0, WIDTH, HEIGHT);
    addNoise(image, rnd, scene.noise);
    return image;
  }

  ns.sampleScenes = { scenes, render };
})(window.CC = window.CC || {});
