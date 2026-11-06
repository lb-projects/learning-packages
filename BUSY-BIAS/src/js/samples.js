/**
 * @file samples.js
 * @description Eingebaute Beispieldatensätze, auch mehrstufige (Form siehe data-panel.js).
 *
 * Erzeugt aus den Dateien in testdata/ (Entwicklungswerkzeug sync-samples.mjs) – nicht von Hand
 * bearbeiten. Der Text jeder Stufe ist zeichengleich mit der Datei gleichen Namens und wird beim
 * Laden genauso eingelesen wie eine hochgeladene CSV-Datei.
 *
 * Abhängigkeiten:
 *   Keine.
 */
(function (ns) {
  'use strict';

  ns.samples = [
    { id: "and", title: "AND", points: 4, stages: [
      {"file":"logik-and.csv","title":"AND","addText":null,"note":"Logisches UND: Nur die Eingabe (1; 1) ergibt 1. Gut von Hand nachzurechnen.","groups":[],"separable":true,"expected":{"restart":20,"continue":20},"points":4,"total":4,"text":"Eingang A;Eingang B;Label\n0;0;0\n0;1;0\n1;0;0\n1;1;1\n"}
    ] },
    { id: "or", title: "OR", points: 4, stages: [
      {"file":"logik-or.csv","title":"OR","addText":null,"note":"Logisches ODER: Die Standardwerte trennen die Punkte schon, das Training endet nach der ersten Iteration.","groups":[],"separable":true,"expected":{"restart":4,"continue":4},"points":4,"total":4,"text":"Eingang A;Eingang B;Label\n0;0;0\n0;1;1\n1;0;1\n1;1;1\n"}
    ] },
    { id: "xor", title: "XOR (nicht trennbar)", points: 4, stages: [
      {"file":"logik-xor.csv","title":"XOR (nicht trennbar)","addText":null,"note":"Exklusives ODER: Keine Gerade trennt die Punkte, das Training endet nicht von selbst.","groups":[],"separable":false,"expected":{"restart":null,"continue":null},"points":4,"total":4,"text":"Eingang A;Eingang B;Label\n0;0;0\n0;1;1\n1;0;1\n1;1;0\n"}
    ] },
    { id: "pruefung", title: "Prüfung bestanden", points: 12, stages: [
      {"file":"pruefung.csv","title":"Prüfung bestanden","addText":null,"note":"Lernstunden und Schlafstunden entscheiden über das Bestehen.","groups":[],"separable":true,"expected":{"restart":180,"continue":180},"points":12,"total":12,"text":"Lernstunden;Schlafstunden;Label\n7,3;6,6;bestanden\n1,5;5,6;durchgefallen\n2,9;5,3;durchgefallen\n2,4;4,9;durchgefallen\n3,4;4,8;durchgefallen\n3,8;3,9;durchgefallen\n2,3;4,7;durchgefallen\n9,1;7,9;bestanden\n7,7;6,8;bestanden\n9,4;6,7;bestanden\n8,1;6,4;bestanden\n7,3;7,6;bestanden\n"}
    ] },
    { id: "obst", title: "Apfel oder Birne", points: 20, stages: [
      {"file":"obst.csv","title":"Apfel oder Birne","addText":null,"note":"Breite und Höhe unterscheiden Äpfel von Birnen.","groups":[],"separable":true,"expected":{"restart":60,"continue":60},"points":20,"total":20,"text":"Breite in cm;Höhe in cm;Label\n7,1;7,6;Apfel\n6,5;9,6;Birne\n7,2;6,4;Apfel\n6,5;9,9;Birne\n6,2;9,7;Birne\n6,6;10,7;Birne\n5,7;9,7;Birne\n7,2;6,8;Apfel\n5,8;10,6;Birne\n7,2;7;Apfel\n7,2;6,6;Apfel\n6,4;10,8;Birne\n6,9;7,4;Apfel\n7,2;7,3;Apfel\n7,9;7,4;Apfel\n6,6;10,2;Birne\n6;9,2;Birne\n7,2;7,2;Apfel\n6,1;10;Birne\n7,7;7;Apfel\n"}
    ] },
    { id: "kredit", title: "Kreditentscheidung", points: 30, stages: [
      {"file":"kredit.csv","title":"Kreditentscheidung","addText":null,"note":"Einkommen und Schulden entscheiden über einen Kredit.","groups":[],"separable":true,"expected":{"restart":60,"continue":60},"points":30,"total":30,"text":"Einkommen in Tsd. €;Schulden in 10 Tsd. €;Label\n6;0,7;genehmigt\n2,9;3;abgelehnt\n1,8;4,4;abgelehnt\n6,3;0,4;genehmigt\n2,6;3,6;abgelehnt\n4,9;0,3;genehmigt\n6,3;2,2;genehmigt\n4,2;1,9;genehmigt\n5,6;1,8;genehmigt\n2,5;4;abgelehnt\n2,4;4;abgelehnt\n4,2;1,9;genehmigt\n7,4;2,3;genehmigt\n7,1;2,2;genehmigt\n2,3;4,5;abgelehnt\n4,6;1,1;genehmigt\n2,5;4,9;abgelehnt\n3,2;2,8;abgelehnt\n1,9;3,1;abgelehnt\n1,7;4,9;abgelehnt\n2,2;3,8;abgelehnt\n2,1;5,4;abgelehnt\n3,2;4,5;abgelehnt\n3;2,9;abgelehnt\n2,1;3,2;abgelehnt\n6;1;genehmigt\n4,3;2,2;genehmigt\n6,5;0,2;genehmigt\n5;0,9;genehmigt\n7,2;1;genehmigt\n"}
    ] },
    { id: "spam", title: "Spam-Filter", points: 50, stages: [
      {"file":"spam.csv","title":"Spam-Filter","addText":null,"note":"Links und Signalwörter kennzeichnen Spam; mit ganzen Zahlen und 50 Punkten der größte Datensatz.","groups":[],"separable":true,"expected":{"restart":150,"continue":150},"points":50,"total":50,"text":"Anzahl Links;Anzahl Signalwörter;Label\n10;10;Spam\n7;10;Spam\n11;13;Spam\n1;3;kein Spam\n2;1;kein Spam\n0;1;kein Spam\n0;3;kein Spam\n2;2;kein Spam\n8;13;Spam\n10;10;Spam\n10;8;Spam\n3;6;Spam\n10;6;Spam\n2;2;kein Spam\n1;1;kein Spam\n2;0;kein Spam\n5;9;Spam\n1;2;kein Spam\n7;5;Spam\n2;1;kein Spam\n0;2;kein Spam\n1;3;kein Spam\n0;1;kein Spam\n0;1;kein Spam\n1;2;kein Spam\n1;1;kein Spam\n1;0;kein Spam\n10;6;Spam\n2;1;kein Spam\n8;8;Spam\n9;7;Spam\n1;1;kein Spam\n1;0;kein Spam\n2;2;kein Spam\n0;1;kein Spam\n1;3;kein Spam\n10;6;Spam\n9;13;Spam\n0;1;kein Spam\n6;13;Spam\n6;12;Spam\n6;10;Spam\n5;14;Spam\n8;4;Spam\n1;1;kein Spam\n6;8;Spam\n0;2;kein Spam\n5;10;Spam\n1;3;kein Spam\n2;2;kein Spam\n"}
    ] },
    { id: "kuendigung", title: "Kundenabwanderung (nicht trennbar)", points: 40, stages: [
      {"file":"kuendigung.csv","title":"Kundenabwanderung (nicht trennbar)","addText":null,"note":"Vertragsjahre und Beschwerden deuten auf eine Kündigung hin, einzelne Ausreißer verhindern aber jede Trenngerade.","groups":[],"separable":false,"expected":{"restart":null,"continue":null},"points":40,"total":40,"text":"Vertragsjahre;Beschwerden;Label\n3;4;kündigt\n0;5;kündigt\n0;4;kündigt\n1;6;kündigt\n9;0;bleibt\n1;4;kündigt\n5;1;bleibt\n5;1;bleibt\n6;0;bleibt\n6;2;bleibt\n3;7;kündigt\n7;1;bleibt\n7;0;bleibt\n1;6;kündigt\n0;3;kündigt\n2;5;kündigt\n5;0;bleibt\n8;0;kündigt\n7;1;kündigt\n2;6;bleibt\n8;1;bleibt\n5;1;bleibt\n10;0;bleibt\n7;1;bleibt\n10;1;kündigt\n8;1;bleibt\n0;6;kündigt\n5;0;bleibt\n1;6;kündigt\n5;1;bleibt\n0;6;kündigt\n9;6;bleibt\n2;5;kündigt\n0;5;kündigt\n2;4;kündigt\n1;5;bleibt\n6;1;bleibt\n0;4;kündigt\n2;7;kündigt\n9;0;bleibt\n"}
    ] },
    { id: "hunde", title: "Hunde: klein oder groß", points: 36, stages: [
      {"file":"hunde-1-grundbestand.csv","title":"Labrador und Chihuahua","addText":null,"note":"Labrador und Chihuahua liegen weit auseinander. Die Trenngerade ist nach wenigen Iterationen gefunden.","groups":[{"name":"Labrador","count":6},{"name":"Chihuahua","count":6}],"separable":true,"expected":{"restart":36,"continue":36},"points":12,"total":12,"text":"Schulterhöhe in dm;Gewicht in 10 kg;Label\n5,5;3,53;Großhund\n5,8;3,54;Großhund\n5,4;3,48;Großhund\n5,6;2,84;Großhund\n5,4;3,59;Großhund\n6;3,23;Großhund\n2;0,26;Kleinhund\n2,1;0,29;Kleinhund\n2,2;0,24;Kleinhund\n2;0,31;Kleinhund\n1,9;0,25;Kleinhund\n1,8;0,29;Kleinhund\n"},
      {"file":"hunde-2-beagle.csv","title":"Beagle","addText":"Beagle hinzufügen","note":"Beagles sind Kleinhunde, liegen aber deutlich näher an den Großhunden. Achten Sie darauf, wie die neuen Punkte die Gerade verschieben.","groups":[{"name":"Beagle","count":6}],"separable":true,"expected":{"restart":144,"continue":126},"points":6,"total":18,"text":"Schulterhöhe in dm;Gewicht in 10 kg;Label\n3,7;1,14;Kleinhund\n3,5;1,39;Kleinhund\n3,5;1,18;Kleinhund\n3,6;1,04;Kleinhund\n3,5;1,25;Kleinhund\n3,7;1,03;Kleinhund\n"},
      {"file":"hunde-3-bulldogge-whippet.csv","title":"Französische Bulldogge und Whippet","addText":"Französische Bulldogge und Whippet hinzufügen","note":"Whippets sind groß und leicht, Bulldoggen klein und vergleichsweise schwer. Das Gewicht allein trennt nicht mehr, die Gerade muss sich drehen, und das Training dauert deutlich länger.","groups":[{"name":"Französische Bulldogge","count":6},{"name":"Whippet","count":6}],"separable":true,"expected":{"restart":690,"continue":1620},"points":12,"total":30,"text":"Schulterhöhe in dm;Gewicht in 10 kg;Label\n3;1,38;Kleinhund\n2,9;1,28;Kleinhund\n2,9;1,19;Kleinhund\n3;1,31;Kleinhund\n2,9;1,15;Kleinhund\n3,2;1,29;Kleinhund\n4,9;1,55;Großhund\n4,9;1,3;Großhund\n4,8;1,53;Großhund\n4,9;1,4;Großhund\n4,8;1,38;Großhund\n4,8;1,25;Großhund\n"},
      {"file":"hunde-4-mischlinge.csv","title":"Mischlinge","addText":"Mischlinge hinzufügen","note":"Mischlinge wurden uneinheitlich eingeschätzt, die Gruppen überschneiden sich. Jetzt gibt es keine Trenngerade mehr: Das Training endet nicht von selbst, hier zeigt sich die Grenze des Perzeptrons.","groups":[{"name":"Mischling","count":6}],"separable":false,"expected":{"restart":null,"continue":null},"points":6,"total":36,"text":"Schulterhöhe in dm;Gewicht in 10 kg;Label\n3,4;1,9;Großhund\n3,9;1,1;Großhund\n3,2;1,6;Großhund\n5;1,8;Kleinhund\n4,6;1,9;Kleinhund\n5,2;2,3;Kleinhund\n"}
    ] },
    { id: "fahrzeuge", title: "Fahrzeuge: Pkw oder Lkw", points: 30, stages: [
      {"file":"fahrzeuge-1-grundbestand.csv","title":"Sattelzug und Kleinwagen","addText":null,"note":"Sattelzug und Kleinwagen liegen weit auseinander. Die Trenngerade ist nach wenigen Iterationen gefunden.","groups":[{"name":"Sattelzug","count":6},{"name":"Kleinwagen","count":6}],"separable":true,"expected":{"restart":36,"continue":36},"points":12,"total":12,"text":"Länge in m;Leermasse in t;Label\n15,7;15,2;Lkw\n16,4;15,8;Lkw\n15,9;16,1;Lkw\n16,1;14,7;Lkw\n15,5;15,8;Lkw\n15,7;15,9;Lkw\n3,7;1,1;Pkw\n3,8;1,1;Pkw\n3,5;1;Pkw\n3,6;0,9;Pkw\n3,8;0,9;Pkw\n3,6;1;Pkw\n"},
      {"file":"fahrzeuge-2-suv-verteiler.csv","title":"SUV und Verteiler-Lkw","addText":"SUV und Verteiler-Lkw hinzufügen","note":"SUV und Verteiler-Lkw liegen dicht beieinander, die Gruppen rücken zusammen. Die bisherige Gerade passt nicht mehr und muss sich verschieben.","groups":[{"name":"SUV","count":6},{"name":"Verteiler-Lkw","count":6}],"separable":true,"expected":{"restart":168,"continue":144},"points":12,"total":24,"text":"Länge in m;Leermasse in t;Label\n4,7;2,2;Pkw\n4,9;2,4;Pkw\n5;2,4;Pkw\n4,6;2,2;Pkw\n4,7;2;Pkw\n4,7;2,1;Pkw\n6,9;3,7;Lkw\n7,3;3,4;Lkw\n7,1;3,7;Lkw\n7;3,6;Lkw\n7,5;3,5;Lkw\n7;3,7;Lkw\n"},
      {"file":"fahrzeuge-3-limousine-kipper.csv","title":"Stretchlimousine und kurzer Kipper","addText":"Stretchlimousine und kurzen Kipper hinzufügen","note":"Lang, aber Pkw; kurz, aber Lkw: Die Länge allein reicht nicht mehr aus. Beim Weitertrainieren passt die Gerade sofort. Vergleichen Sie das mit einem Neubeginn, der viel länger dauert.","groups":[{"name":"Stretchlimousine","count":3},{"name":"Kurzer Kipper","count":3}],"separable":true,"expected":{"restart":2880,"continue":30},"points":6,"total":30,"text":"Länge in m;Leermasse in t;Label\n9;3;Pkw\n9,3;3;Pkw\n8,9;3,1;Pkw\n5,6;3,5;Lkw\n5,5;3,3;Lkw\n5,8;3,4;Lkw\n"}
    ] }
  ];
})(window.BB = window.BB || {});
