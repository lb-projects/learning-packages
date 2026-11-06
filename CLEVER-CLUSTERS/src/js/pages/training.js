/**
 * @file pages/training.js
 * @description Seite 2: k-Means Schritt für Schritt.
 *
 * Aufbau:
 *   Links Steuerung, Erklärung des Schritts, Zähler, WCSS und Zentrentabelle.
 *   Rechts die Zeichnung mit gefärbten Punkten, Zentren und den Schaltern für Decision Areas
 *   (gemeinsam mit Seite 1) und den Verlauf der Zentren.
 *   Darunter aufklappbar die WCSS-Kurve und die Objekte je Cluster.
 *
 * Abhängigkeiten:
 *   dom-utils.js, sim-format.js, coord-plot.js, training-controls.js, cluster-view.js, session.js
 */
(function (ns) {
  'use strict';

  const dom = ns.dom;
  const session = ns.session;
  const view = ns.clusterView;
  const { num, plural } = ns.simFormat;

  let plot = null;
  let curve = null;
  let controls = null;

  /**
   * Text zum aktuellen Schritt.
   * @param {Object|null} trainer - Trainer.
   * @returns {string[]} Überschrift und Erklärung.
   */
  function stepText(trainer) {
    if (!trainer) {
      return ['Noch nicht bereit', 'Legen Sie auf Seite 1 die Daten und alle Startzentren fest.'];
    }
    if (trainer.isFinished()) {
      return ['Fertig: Die Cluster sind stabil', 'Die letzte Zuordnung hat nichts mehr geändert, also bewegen sich auch die Zentren nicht mehr.'];
    }
    if (trainer.phase() === 'idle') {
      return ['Bereit', '„Weiter“ ordnet jeden Punkt dem nächsten Zentrum zu.'];
    }
    if (trainer.phase() === 'assign') {
      return [
        'Iteration ' + trainer.iteration() + ': Zuordnung',
        'Jeder Punkt gehört jetzt zum nächsten Zentrum. ' + plural(trainer.changes(), 'Punkt hat', 'Punkte haben') + ' den Cluster gewechselt. Als Nächstes rücken die Zentren in die Mitte ihrer Punkte.'
      ];
    }
    return [
      'Iteration ' + trainer.iteration() + ': Aktualisierung',
      'Jedes Zentrum ist in die Mitte seiner Punkte gerückt. Als Nächstes wird neu zugeordnet.'
    ];
  }

  /** Zeichnet die Seite. */
  function render() {
    const trainer = session.trainer();
    const coords = session.coords();
    const centers = trainer ? trainer.centers() : session.modelCenters();
    const assignment = trainer ? trainer.assignment() : null;
    const trails = trainer && session.showTrail() ? trainer.trails() : [];
    const v = session.view();
    const labels = session.axisLabels();
    plot.render({
      view: v,
      xLabel: labels.x,
      yLabel: labels.y,
      regions: session.showAreas() && centers.length > 0 ? view.areaRegions(centers, v) : [],
      lines: view.trailLines(trails),
      points: view.pointMarks(coords, session.names(), assignment).concat(view.trailMarks(trails), view.centerMarks(centers))
    });
    const [title, text] = stepText(trainer);
    dom.byId('training-step-title').textContent = title;
    dom.byId('training-step-text').textContent = text;
    dom.byId('count-iteration').textContent = trainer ? String(trainer.iteration()) : '0';
    dom.byId('count-steps').textContent = trainer ? String(trainer.steps()) : '0';
    dom.byId('count-changes').textContent = trainer && trainer.changes() !== null ? String(trainer.changes()) : '–';
    const wcss = trainer ? trainer.wcss() : null;
    dom.byId('training-wcss').textContent = wcss === null ? '–' : num(wcss);
    const finished = trainer && trainer.isFinished();
    const found = dom.byId('training-found');
    found.hidden = !finished;
    found.textContent = finished ? 'Stabil nach ' + plural(trainer.iteration(), 'Iteration', 'Iterationen') + ' und ' + plural(trainer.steps(), 'Schritt', 'Schritten') + '.' : '';
    const empty = trainer ? trainer.empty() : [];
    const emptyNote = dom.byId('training-empty-cluster');
    emptyNote.hidden = empty.length === 0;
    emptyNote.textContent = empty.length ? 'Leer: Cluster ' + empty.map((c) => c + 1).join(', ') + '. Ein leerer Cluster behält sein Zentrum.' : '';
    dom.byId('training-not-ready').hidden = session.isReady();
    dom.byId('toggle-areas').checked = session.showAreas();
    dom.byId('toggle-trail').checked = session.showTrail();
    view.renderCenterTable(dom.byId('training-centers-head'), dom.byId('training-centers-body'), centers, coords, assignment);
    view.renderObjects(dom.byId('training-objects'), session.names(), assignment, centers.length);
    view.renderCurve(curve, trainer ? trainer.history() : []);
    dom.byId('training-curve-empty').hidden = Boolean(trainer) && trainer.history().length > 0;
    controls.refresh();
  }

  /** Richtet die Seite ein. */
  function init() {
    plot = ns.coordPlot.create(dom.byId('training-plot'), { ariaLabel: 'Koordinatensystem mit den Datenpunkten, gefärbt nach ihrem Cluster, und den Clusterzentren' });
    curve = ns.coordPlot.create(dom.byId('training-curve'), { ariaLabel: 'Verlauf der WCSS je Trainingsschritt' });
    controls = ns.trainingControls.create(dom.byId('training-controls'), { id: 'run', runner: session.runner, onChange: render });
    dom.byId('toggle-areas').addEventListener('change', (event) => {
      session.setShowAreas(event.target.checked);
      render();
    });
    dom.byId('toggle-trail').addEventListener('change', (event) => {
      session.setShowTrail(event.target.checked);
      render();
    });
  }

  ns.pages.training = { init, render, pause: () => controls.pause() };
})(window.CC = window.CC || {});
