// Kopie aus shared/js/training-controls.js – nicht hier bearbeiten: Änderungen in shared/ vornehmen und sync-shared.mjs ausführen.
/**
 * @file training-controls.js
 * @description Steuerung eines Trainings: Einzelschritt, mehrere Iterationen, Automatik, Zurücksetzen.
 *
 * Der Baustein kennt kein Modell. Er steuert jedes Objekt mit dieser Schnittstelle:
 *   step()             führt einen Schritt aus
 *   runIterations(n)   rechnet n Iterationen ohne Zwischenanzeige
 *   isFinished()       true, wenn das Training beendet ist
 *   reset()            setzt das Training zurück
 *   isReady()          true, wenn ein Training möglich ist (z. B. Trainingspunkte vorhanden)
 *   hasStarted()       true, wenn schon gerechnet wurde (beschriftet „Automatisch fortsetzen“)
 *
 * Bedienung:
 *   Einzelschritt und Automatik lassen sich jederzeit abwechseln; „Weiter“ und „Iterationen
 *   rechnen“ halten eine laufende Automatik an. Die Automatik endet, sobald isFinished() gilt.
 *
 * Gemeinsamer Code der Simulator-Pakete (Quelle: shared/js/training-controls.js).
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
    { ms: 500, text: 'schnell (0,5 s)' },
    { ms: 100, text: 'sehr schnell (0,1 s)' }
  ];
  /** Höchstzahl der Iterationen auf einmal. */
  const MAX_ITERATIONS = 1000;

  /**
   * Erzeugt die Steuerung.
   *
   * @param {HTMLElement} container - Behälter (wird geleert).
   * @param {{id:string, runner:Object, onChange:function():void}} options - Präfix für Element-IDs,
   *   gesteuertes Objekt, Rückruf nach jeder Änderung.
   * @returns {{refresh:function():void, pause:function():void, isPlaying:function():boolean}} Steuerung.
   */
  function create(container, options) {
    const id = options.id;
    const runner = options.runner;
    let timer = null;
    let speed = SPEEDS[1].ms;

    const btnStep = dom.el('button', { type: 'button', class: 'btn btn-primary', id: id + '-step' }, 'Weiter ▶');
    const inputCount = dom.el('input', { type: 'text', id: id + '-count', class: 'input-small', inputmode: 'numeric', value: '1', maxlength: 4, autocomplete: 'off' });
    const btnRun = dom.el('button', { type: 'button', class: 'btn', id: id + '-run' }, 'Iterationen rechnen');
    const btnAuto = dom.el('button', { type: 'button', class: 'btn', id: id + '-auto', 'aria-pressed': 'false' }, '▶ Automatisch');
    const selectSpeed = dom.el('select', { id: id + '-speed' }, SPEEDS.map((s) => dom.el('option', { value: String(s.ms), selected: s.ms === speed }, s.text)));
    const btnReset = dom.el('button', { type: 'button', class: 'btn', id: id + '-reset' }, 'Zurücksetzen');
    const error = dom.el('p', { class: 'error', id: id + '-error', role: 'alert' });

    dom.clear(container);
    dom.appendChildren(container, [
      dom.el('div', { class: 'controls-row' }, [btnStep, btnReset]),
      dom.el('div', { class: 'controls-row' }, [
        dom.el('label', { for: inputCount.id, class: 'visually-hidden' }, 'Anzahl der Iterationen'),
        inputCount, btnRun
      ]),
      dom.el('div', { class: 'controls-row' }, [
        btnAuto,
        dom.el('label', { for: selectSpeed.id }, 'Tempo'),
        selectSpeed
      ]),
      error
    ]);

    /** Passt die Schaltflächen an den Stand an. */
    function refresh() {
      const possible = runner.isReady() && !runner.isFinished();
      btnStep.disabled = !possible;
      btnRun.disabled = !possible;
      inputCount.disabled = !possible;
      btnAuto.disabled = !possible;
      btnReset.disabled = !runner.hasStarted();
      btnAuto.textContent = timer !== null ? '⏸ Pause' : (runner.hasStarted() && possible ? '▶ Automatisch fortsetzen' : '▶ Automatisch');
      btnAuto.setAttribute('aria-pressed', timer !== null ? 'true' : 'false');
    }

    /** Hält die Automatik an. */
    function pause() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
      refresh();
    }

    /** Ein Schritt der Automatik. */
    function tick() {
      if (!runner.isReady() || runner.isFinished()) {
        pause();
        return;
      }
      runner.step();
      if (runner.isFinished()) {
        pause();
      }
      options.onChange();
    }

    /** Startet die Automatik ab dem aktuellen Stand. */
    function play() {
      if (timer !== null) {
        clearInterval(timer);
      }
      timer = setInterval(tick, speed);
      refresh();
    }

    btnStep.addEventListener('click', () => {
      pause();
      runner.step();
      refresh();
      options.onChange();
    });
    btnRun.addEventListener('click', () => {
      pause();
      const count = /^\d+$/.test(inputCount.value.trim()) ? Number(inputCount.value.trim()) : 0;
      if (count < 1 || count > MAX_ITERATIONS) {
        error.textContent = 'Bitte eine ganze Zahl von 1 bis ' + MAX_ITERATIONS + ' eingeben.';
        return;
      }
      error.textContent = '';
      runner.runIterations(count);
      refresh();
      options.onChange();
    });
    btnAuto.addEventListener('click', () => {
      if (timer !== null) {
        pause();
      } else {
        play();
      }
    });
    selectSpeed.addEventListener('change', () => {
      speed = Number(selectSpeed.value) || SPEEDS[1].ms;
      if (timer !== null) {
        play();
      }
    });
    btnReset.addEventListener('click', () => {
      pause();
      runner.reset();
      refresh();
      options.onChange();
    });

    refresh();
    return { refresh, pause, isPlaying: () => timer !== null };
  }

  ns.trainingControls = { create, SPEEDS, MAX_ITERATIONS };
})(window.CC = window.CC || {});
