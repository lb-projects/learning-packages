/**
 * @file samples.js
 * @description Eingebaute Beispielgraphen.
 *
 * Erzeugt aus den Dateien in testdata/ (Entwicklungswerkzeug sync-samples.mjs) – nicht von Hand
 * bearbeiten. Der Text jedes Beispiels ist zeichengleich mit der Datei gleichen Namens und
 * wird beim Laden genauso eingelesen wie eine hochgeladene CSV-Datei (graph-import.js).
 *
 * Abhängigkeiten:
 *   Keine.
 */
(function (ns) {
  'use strict';

  ns.samples = Object.freeze([
    { id: "ungewichtet", file: "beispiel-ungewichtet.csv", title: "Ungewichteter Graph",
      text: "ungerichtet\nvon;nach\nA;B\nA;C\nA;D\nB;E\nC;E\nC;F\nD;G\nE;H\nF;H\nG;H\n" },
    { id: "unzusammenhaengend", file: "beispiel-unzusammenhaengend.csv", title: "Unzusammenhängender Graph",
      text: "ungerichtet\nvon;nach\nA;B\nA;C\nB;D\nC;D\nE;F\nG\n" },
    { id: "staedte", file: "beispiel-staedte.csv", title: "Städtenetz mit Entfernungen in km",
      text: "ungerichtet\nvon;nach;gewicht\nAugsburg;München;64\nAugsburg;Ingolstadt;75\nMünchen;Ingolstadt;80\nMünchen;Landshut;72\nMünchen;Rosenheim;65\nIngolstadt;Regensburg;77\nIngolstadt;Nürnberg;95\nRegensburg;Nürnberg;105\nRegensburg;Landshut;63\nLandshut;Rosenheim;95\n" },
    { id: "matrix", file: "beispiel-matrix.csv", title: "Gerichteter Graph als Adjazenzmatrix",
      text: "gerichtet;A;B;C;D;E\nA;;4;2;;\nB;;;;5;\nC;;1;;8;10\nD;;;;;2\nE;;;;;\n" },
    { id: "negatives-gewicht", file: "beispiel-negatives-gewicht.csv", title: "Negatives Gewicht ohne Zyklus",
      text: "gerichtet\nvon;nach;gewicht\nA;B;1\nA;C;3\nB;D;2\nC;B;-3\nC;E;6\nD;E;1\n" },
    { id: "negativer-zyklus", file: "beispiel-negativer-zyklus.csv", title: "Negativer Zyklus",
      text: "gerichtet\nvon;nach;gewicht\nA;B;2\nA;E;8\nB;C;3\nC;D;-6\nD;B;2\nD;E;1\n" }
  ].map((s) => Object.freeze(s)));
})(window.HG = window.HG || {});
