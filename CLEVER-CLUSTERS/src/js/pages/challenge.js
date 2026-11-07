/**
 * @file pages/challenge.js
 * @description Seite 4 „Schlage k-Means“: Zentren selbst setzen und gegen k-Means antreten.
 *
 * Die Seite übernimmt wie die Analysen nur die Daten (mit Skalierung) von Seite 1 und hat ein eigenes k und
 * eigene Zentren. Ein Klick setzt und entfernt Zentren wie auf Seite 1. Die Punkte färben sich sofort nach dem
 * nächsten Zentrum, die WCSS ist live.
 *
 * Abhängigkeiten:
 *   dom-utils.js, sim-format.js, coord-plot.js, kmeans.js, kmeans-analysis.js, cluster-view.js, session.js
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const session = ns.session;
  const view = ns.clusterView;
  const { num, plural } = ns.simFormat;
  /** Läufe von k-Means beim Antreten. */
  const CONTEST_RUNS = 20;

  let plot = null;
  let version = session.version();
  let chosen = session.DEFAULT_K;
  /** Eigene Zentren in Originaleinheiten. */
  let centers = [];
  /** Letzter Wettkampf zu den aktuellen Zentren oder null. */
  let contest = null;
  /** k-Means von den eigenen Zentren aus oder null. */
  let continued = null;
  /** Was die Zeichnung zeigt: 'own', 'best' oder 'continued'. */
  let shown = 'own';
  /** Alle Versuche seit dem letzten Datenwechsel. */
  let attempts = [];
  /** Versuch zu den aktuellen Zentren oder null. */
  let attempt = null;

  /** Verwirft alles, was zu den aktuellen Zentren gehört. */
  function dropResults() {
    contest = null;
    continued = null;
    attempt = null;
    shown = 'own';
  }

  /** @returns {number} k dieser Seite. */
  function currentK() {
    return Math.min(chosen, Math.max(session.maxK(), 1));
  }

  /** @returns {number[][]} Eigene Zentren in den Koordinaten der Zeichnung. */
  const modelCenters = () => centers.map(session.toModel);

  /** @returns {{centers:number[][], assignment:(number[]|null), wcss:(number|null)}} Stand der eigenen Zentren. */
  function ownState() {
    const list = modelCenters();
    if (list.length === 0 || session.data.count() === 0) {
      return { centers: list, assignment: null, wcss: null };
    }
    const coords = session.coords();
    const assignment = ns.kmeans.assign(coords, list);
    return { centers: list, assignment, wcss: ns.kmeans.wcss(coords, list, assignment) };
  }

  /**
   * Text zum Vergleich mit dem besten Lauf.
   * @param {{own:number, best:number, beatsAll:boolean, tied:boolean, runs:number[]}} result - Wettkampf.
   * @returns {string} Urteil.
   */
  function verdict(result) {
    if (result.beatsAll) {
      return 'Sie haben alle ' + result.runs.length + ' Läufe geschlagen.';
    }
    if (result.tied) {
      return 'Sie liegen gleichauf mit dem besten Lauf.';
    }
    if (result.best === 0) {
      return 'Der beste Lauf erreicht eine WCSS von 0, Ihre liegt darüber.';
    }
    return 'Sie liegen ' + num(Math.round(((result.own - result.best) / result.best) * 1000) / 10) + ' % über dem besten Lauf.';
  }

  /** Zeichnet die Zeichnung für die gewählte Ansicht. */
  function renderPlot(own) {
    const list = shown === 'best' && contest ? contest.bestRun : shown === 'continued' && continued ? continued : own;
    const v = session.view(own.centers);
    const labels = session.axisLabels();
    plot.render({
      view: v,
      xLabel: labels.x,
      yLabel: labels.y,
      regions: dom.byId('duel-areas').checked && list.centers.length > 0 ? view.areaRegions(list.centers, v) : [],
      points: view.pointMarks(session.coords(), session.names(), list.assignment).concat(view.centerMarks(list.centers))
    });
  }

  /** Zeichnet die Tabelle der Versuche. */
  function renderAttempts() {
    dom.byId('duel-attempts-card').hidden = attempts.length === 0;
    const tbody = dom.clear(dom.byId('duel-attempts'));
    attempts.forEach((row, i) => {
      tbody.appendChild(dom.el('tr', { class: row === attempt ? 'is-current' : null }, [
        dom.el('td', { class: 'num' }, i + 1),
        dom.el('td', { class: 'num' }, row.k),
        dom.el('td', { class: 'num' }, num(row.own)),
        dom.el('td', { class: 'num' }, row.rank === null ? '–' : row.rank + ' von ' + (CONTEST_RUNS + 1)),
        dom.el('td', { class: 'num' }, row.best === null ? '–' : num(row.best)),
        dom.el('td', { class: 'num' }, row.continued === null ? '–' : num(row.continued))
      ]));
    });
  }

  /** Zeichnet das Ergebnis. */
  function renderResult(own) {
    dom.byId('duel-result').hidden = !contest;
    if (contest) {
      dom.byId('duel-verdict').textContent = verdict(contest);
      dom.byId('duel-rank').textContent = contest.rank + ' von ' + (CONTEST_RUNS + 1);
      dom.byId('duel-best').textContent = num(contest.best);
      dom.byId('duel-mean').textContent = num(contest.mean);
      dom.byId('duel-worst').textContent = num(contest.worst);
    }
    const further = dom.byId('duel-continued');
    further.hidden = !continued;
    if (continued) {
      const gain = own.wcss - continued.wcss;
      further.textContent = 'Von Ihren Zentren aus sinkt die WCSS in ' + plural(continued.iterations, 'Iteration', 'Iterationen') + ' von ' + num(own.wcss) + ' auf ' + num(continued.wcss) + (gain <= 1e-9 ? ': Ihre Zentren waren schon stabil.' : '.');
    }
    dom.byId('duel-view').hidden = !contest && !continued;
    dom.byId('duel-view-best').disabled = !contest;
    dom.byId('duel-view-continued').disabled = !continued;
    dom.byId('duel-view-own').checked = shown === 'own';
    dom.byId('duel-view-best').checked = shown === 'best';
    dom.byId('duel-view-continued').checked = shown === 'continued';
  }

  /** Zeichnet die Seite. */
  function render() {
    if (version !== session.version()) {
      const hadWork = centers.length > 0 || attempts.length > 0;
      version = session.version();
      centers = [];
      attempts = [];
      dropResults();
      dom.byId('duel-stale').hidden = !hadWork;
    }
    const possible = session.maxK() > 0;
    dom.byId('duel-empty').hidden = possible;
    view.renderKSelect(dom.byId('duel-k'), session.maxK(), chosen);
    const k = currentK();
    if (centers.length > k) {
      centers = centers.slice(0, k);
      dropResults();
    }
    const own = ownState();
    const full = possible && centers.length === k;
    dom.byId('duel-status').textContent = possible ? centers.length + ' von ' + k + ' Zentren gesetzt.' : 'Noch keine Daten.';
    dom.byId('duel-wcss').textContent = own.wcss === null ? '–' : num(own.wcss);
    dom.byId('duel-run').disabled = !full;
    dom.byId('duel-continue').disabled = !full;
    dom.byId('duel-clear').disabled = centers.length === 0;
    renderPlot(own);
    renderResult(own);
    renderAttempts();
  }

  /** @returns {Object} Versuch zu den aktuellen Zentren; wird bei Bedarf angelegt. */
  function currentAttempt() {
    if (!attempt) {
      attempt = { k: centers.length, own: ownState().wcss, rank: null, best: null, continued: null };
      attempts.push(attempt);
    }
    return attempt;
  }

  /** Lässt k-Means antreten. */
  function runContest() {
    const coords = session.coords();
    contest = ns.kmeansAnalysis.contest(coords, modelCenters(), CONTEST_RUNS);
    const row = currentAttempt();
    row.rank = contest.rank;
    row.best = contest.best;
    dom.byId('duel-stale').hidden = true;
    render();
  }

  /** Startet k-Means von den eigenen Zentren aus. */
  function runContinued() {
    continued = ns.kmeans.run(session.coords(), modelCenters());
    currentAttempt().continued = continued.wcss;
    shown = 'continued';
    dom.byId('duel-stale').hidden = true;
    render();
  }

  /**
   * Verarbeitet einen Klick in die Zeichnung.
   * @param {number} x - x-Wert.
   * @param {number} y - y-Wert.
   */
  function handleClick(x, y) {
    const k = currentK();
    const result = session.placeCenter(centers, x, y, plot.screenOf, k);
    const message = dom.byId('duel-message');
    message.textContent = result.outcome === 'full'
      ? 'Alle ' + k + ' Zentren sind gesetzt. Entfernen Sie erst ein Zentrum per Klick, oder erhöhen Sie k.'
      : result.outcome === 'empty' ? 'Laden Sie zuerst auf Seite 1 Daten.' : '';
    if (result.centers !== centers) {
      centers = result.centers;
      dropResults();
      dom.byId('duel-stale').hidden = true;
      render();
    }
  }

  /** Richtet die Seite ein. */
  function init() {
    plot = ns.coordPlot.create(dom.byId('duel-plot'), { ariaLabel: 'Koordinatensystem mit den Datenpunkten und Ihren Zentren. Ein Klick setzt oder entfernt ein Zentrum.', onClick: handleClick });
    dom.byId('duel-k').addEventListener('change', (event) => {
      chosen = Number(event.target.value);
      dom.byId('duel-message').textContent = '';
      dropResults();
      render();
    });
    dom.byId('duel-run').addEventListener('click', runContest);
    dom.byId('duel-continue').addEventListener('click', runContinued);
    dom.byId('duel-clear').addEventListener('click', () => {
      centers = [];
      dom.byId('duel-message').textContent = '';
      dropResults();
      render();
    });
    dom.byId('duel-areas').addEventListener('change', render);
    for (const [id, value] of [['duel-view-own', 'own'], ['duel-view-best', 'best'], ['duel-view-continued', 'continued']]) {
      dom.byId(id).addEventListener('change', () => {
        shown = value;
        render();
      });
    }
  }

  ns.pages.challenge = { init, render, centers: () => centers, contest: () => contest, continued: () => continued, attempts: () => attempts, CONTEST_RUNS };
})(window.CC = window.CC || {});
