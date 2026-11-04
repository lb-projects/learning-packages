/**
 * @file player.js
 * @description Abspieler für die Schritte eines Algorithmus (Seiten 3 bis 5).
 *
 * Bedienung:
 *   - Anfang · Zurück · Weiter · Ende: springt zum ersten, vorigen, nächsten bzw. letzten Schritt.
 *   - Automatisch: führt in festen Zeitabständen den nächsten Schritt aus; die Schaltfläche
 *     wird dabei zu „Pause“. Die Automatik beginnt beim aktuellen Schritt und hält am letzten an.
 *     Anfang/Zurück/Weiter/Ende während der Automatik halten sie an (danach Einzelschritte).
 *   - Geschwindigkeit: Abstand zwischen zwei Schritten.
 *   - Tastatur (Fokus im Abspieler): Pfeil links/rechts = Zurück/Weiter, Pos1/Ende, Leertaste = Automatik/Pause.
 *
 * Die Schritte werden vorher vollständig berechnet (algorithms.js). Der Abspieler kennt nur
 * ihre Anzahl und meldet den gewählten Index an die Seite (onStep).
 *
 * Abhängigkeiten:
 *   dom-utils.js
 *
 * Sicherheitsaspekte:
 *   Zeitgeber werden nur mit Funktionen (nie mit Text) gestartet.
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;

  /** Wählbare Abstände in Millisekunden. */
  const SPEEDS = [
    { ms: 2000, text: 'langsam (2 s)' },
    { ms: 1000, text: 'mittel (1 s)' },
    { ms: 500, text: 'schnell (0,5 s)' }
  ];

  /**
   * Erzeugt einen Abspieler.
   *
   * @param {HTMLElement} container - Behälter (wird geleert).
   * @param {{id:string, onStep:function(number):void}} options - id: Präfix für Element-IDs;
   *   onStep: wird nach jedem Wechsel des Schritts aufgerufen.
   * @returns {{setCount:function(number, number=):void, index:function():number, count:function():number,
   *            pause:function():void, isPlaying:function():boolean, go:function(number):void}} Steuerung.
   */
  function create(container, options) {
    const id = options.id;
    let count = 0;
    let index = 0;
    let timer = null;
    let speed = SPEEDS[1].ms;

    const button = (suffix, text, title) => dom.el('button', { type: 'button', class: 'btn player-btn', id: id + '-' + suffix, title, 'aria-label': title }, text);
    const btnFirst = button('first', '⏮', 'Zum Anfang');
    const btnPrev = button('prev', '◀ Zurück', 'Einen Schritt zurück');
    const btnNext = button('next', 'Weiter ▶', 'Nächster Schritt');
    const btnLast = button('last', '⏭', 'Zum Ende');
    const btnAuto = dom.el('button', { type: 'button', class: 'btn btn-primary player-auto', id: id + '-auto', 'aria-pressed': 'false' }, '▶ Automatisch');
    const speedSelect = dom.el('select', { id: id + '-speed' }, SPEEDS.map((s) =>
      dom.el('option', { value: String(s.ms), selected: s.ms === speed }, s.text)));
    const position = dom.el('p', { class: 'player-position', id: id + '-position', 'aria-live': 'polite' });

    const root = dom.el('div', { class: 'player', role: 'group', 'aria-label': 'Abspieler' }, [
      dom.el('div', { class: 'player-buttons' }, [btnFirst, btnPrev, btnNext, btnLast]),
      dom.el('div', { class: 'player-auto-row' }, [
        btnAuto,
        dom.el('label', { for: id + '-speed', class: 'player-speed-label' }, 'Tempo'),
        speedSelect
      ]),
      position
    ]);
    dom.clear(container);
    container.appendChild(root);

    /** Aktualisiert Schaltflächen und Positionsanzeige. */
    function update() {
      const atStart = index <= 0;
      const atEnd = index >= count - 1;
      btnFirst.disabled = count === 0 || atStart;
      btnPrev.disabled = count === 0 || atStart;
      btnNext.disabled = count === 0 || atEnd;
      btnLast.disabled = count === 0 || atEnd;
      btnAuto.disabled = count === 0 || (atEnd && timer === null);
      btnAuto.textContent = timer !== null ? '⏸ Pause' : (index > 0 && !atEnd ? '▶ Automatisch fortsetzen' : '▶ Automatisch');
      btnAuto.setAttribute('aria-pressed', timer !== null ? 'true' : 'false');
      position.textContent = count === 0 ? 'Keine Schritte.' : 'Schritt ' + (index + 1) + ' von ' + count + (atEnd ? ' (Ende)' : '');
    }

    /** Hält die Automatik an. */
    function pause() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
      update();
    }

    /**
     * Wechselt zu einem Schritt.
     * @param {number} target - Index.
     */
    function go(target) {
      const next = Math.max(0, Math.min(count - 1, target));
      if (count === 0) {
        update();
        return;
      }
      index = next;
      update();
      options.onStep(index);
    }

    /** Ein Schritt der Automatik. */
    function tick() {
      if (index >= count - 1) {
        pause();
        return;
      }
      go(index + 1);
      if (index >= count - 1) {
        pause();
      }
    }

    /** Startet die Automatik ab dem aktuellen Schritt. */
    function play() {
      if (count === 0 || index >= count - 1) {
        return;
      }
      pause();
      timer = setInterval(tick, speed);
      update();
    }

    btnFirst.addEventListener('click', () => { pause(); go(0); });
    btnPrev.addEventListener('click', () => { pause(); go(index - 1); });
    btnNext.addEventListener('click', () => { pause(); go(index + 1); });
    btnLast.addEventListener('click', () => { pause(); go(count - 1); });
    btnAuto.addEventListener('click', () => {
      if (timer !== null) {
        pause();
      } else {
        play();
      }
    });
    speedSelect.addEventListener('change', () => {
      speed = Number(speedSelect.value) || SPEEDS[1].ms;
      if (timer !== null) {
        play();
      }
    });
    root.addEventListener('keydown', (event) => {
      if (event.target === speedSelect) {
        return;
      }
      const keys = new Map([['ArrowLeft', () => go(index - 1)], ['ArrowRight', () => go(index + 1)], ['Home', () => go(0)], ['End', () => go(count - 1)]]);
      if (keys.has(event.key)) {
        event.preventDefault();
        pause();
        keys.get(event.key)();
      } else if (event.key === ' ' && event.target.tagName !== 'BUTTON') {
        event.preventDefault();
        btnAuto.click();
      }
    });

    /**
     * Setzt eine neue Schrittliste (hält die Automatik an).
     * @param {number} newCount - Anzahl der Schritte.
     * @param {number} [startIndex=0] - Erster angezeigter Schritt.
     */
    function setCount(newCount, startIndex) {
      pause();
      count = newCount;
      index = 0;
      go(startIndex || 0);
    }

    update();
    return { setCount, index: () => index, count: () => count, pause, isPlaying: () => timer !== null, go };
  }

  ns.player = { create, SPEEDS };
})(window.HG = window.HG || {});
