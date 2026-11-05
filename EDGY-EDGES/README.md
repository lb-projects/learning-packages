# EDGY EDGES – SCORM-1.2-Lernpaket zu Graphalgorithmen

**EDGY EDGES** steht für **E**xplore **D**ynamic **G**raphs **Y**ourself: **E**very **D**istance **G**ets **E**valuated **S**tepwise.
Das Paket veranschaulicht Graphen und die Algorithmen Breitensuche, Tiefensuche und Dijkstra Schritt für Schritt. Auf einer Trainingsseite führen die Lernenden die Algorithmen selbst aus und erhalten nach jedem Schritt eine Rückmeldung.
Es läuft vollständig im Browser, lädt keine externen Ressourcen und verwendet keine externen Bibliotheken.

## Inhalt für den Unterricht

| Seite | Inhalt |
|---|---|
| 1 Graph eingeben | Graph per Datei (CSV, XLSX, ODS; Kantenliste oder Adjazenzmatrix), Beispielgraph oder Eingabemaske erfassen; gerichtet oder ungerichtet; Knoten und Kanten einzeln löschen; die Zeichnung erscheint sofort, Knoten lassen sich verschieben |
| 2 Darstellungen | Links die Zeichnung, rechts die Adjazenzmatrix, darunter aufklappbar die Adjazenzlisten. Zeigen auf eine Kante, eine Zelle oder einen Listeneintrag hebt die zugehörigen Stellen in den anderen Darstellungen hervor |
| 3 Breitensuche | Ablauf Schritt für Schritt: Warteschlange, Besuchsreihenfolge, Abstand (Anzahl der Kanten) und Vorgänger; nach dem letzten Schritt Spannbaum (BFS-Baum) |
| 4 Tiefensuche | Rekursive Tiefensuche Schritt für Schritt: Aufrufstapel, Besuchsreihenfolge, Nummer beim Besuchen und Beenden, Vorgänger; nach dem letzten Schritt Spannbaum (DFS-Baum) |
| 5 Dijkstra | Berechnungstabelle mit den Spalten **Aktueller Knoten**, **Warteschlange** (nach Distanz sortiert) und **Rand** (bisher nicht erreichte Knoten); jeder Knoten als Tripel (Knoten, Vorgänger, Distanz zum Startknoten). Nach dem letzten Schritt Weg zu jedem Knoten und bei negativen Gewichten der Vergleich mit Bellman-Ford |
| 6 Training | Breitensuche oder Tiefensuche selbst ausführen: Knoten in der Zeichnung anklicken (1. Klick besuchen, 2. Klick abschließen). Dijkstra selbst ausführen: Berechnungstabelle Zeile für Zeile ausfüllen und prüfen lassen. Hinweise bei Fehlern, Zähler für richtige Schritte und Fehlentscheidungen, Speicherung in der Lernplattform |

Zwischen den Seiten kann jederzeit gewechselt werden. Änderungen am Graphen wirken sofort auf alle Seiten.

### Anordnung je nach Fensterbreite

Das Paket nutzt bis etwa 2400 px die volle Breite. Auf den Seiten 3 bis 5 richtet sich die Anordnung nach der Fensterbreite:

| Fensterbreite | Breiten- und Tiefensuche | Dijkstra |
|---|---|---|
| unter 900 px | alles untereinander | ebenso, Tabelle zuletzt |
| 900 bis 1399 px | links Einstellungen, Abspieler, Schritt und Datenstrukturen; rechts die Zeichnung | ebenso; Berechnungstabelle darunter über die volle Breite |
| ab 1400 px | drei Spalten: Einstellungen und Abspieler · Schritt, Warteschlange bzw. Aufrufstapel und Tabelle · Zeichnung | drei Spalten wie links; Berechnungstabelle darunter |
| ab 1800 px | wie ab 1400 px | Berechnungstabelle in der mittleren Spalte neben der Zeichnung |

Die Zeichnung ist nie höher als das Fenster, damit sie beim Abspielen ganz sichtbar bleibt.

Seite 6 (Training) ist wie die Breiten- und Tiefensuche angeordnet. Die Berechnungstabelle für Dijkstra steht dort immer unter den drei Spalten über die volle Breite, damit die Eingabefelder genug Platz haben.

### Abspielen der Algorithmen (Seiten 3 bis 5)

- **Startknoten** wählen und entweder **den ganzen Graphen durchlaufen** oder **bis zu einem Ziel** laufen lassen.
- Standard ist der Einzelschritt: **Weiter** und **Zurück**, dazu **Anfang** (⏮) und **Ende** (⏭). Mit Fokus im Abspieler gehen auch die Pfeiltasten, Pos1 und Ende.
- **Automatisch** führt in festen Abständen den nächsten Schritt aus (Tempo: 2 s, 1 s oder 0,5 s).
  - Die Schaltfläche wird dabei zu **Pause**. Danach geht es mit **Automatisch fortsetzen** an derselben Stelle weiter.
  - Ein Einzelschritt (auch Zurück) hält die Automatik an. Ein Wechsel der Seite hält sie ebenfalls an.
- Jeder Schritt hat einen Erklärtext. Die Zeichnung zeigt die Zustände farbig und zusätzlich über Strichart und Füllung (farbenblindfreundlich); eine Legende steht darunter.
- Ändert sich der Graph oder eine Einstellung, wird der Ablauf neu berechnet und beginnt von vorn (mit Hinweis). Das Verschieben von Knoten ändert den Ablauf nicht.

### Festlegungen der Algorithmen

- **Reihenfolge:** Nachbarn werden alphabetisch abgearbeitet (Zahlen in Namen natürlich sortiert: A2 vor A10). So lassen sich die Ergebnisse mit Aufgaben aus Schulbüchern vergleichen.
- **Unzusammenhängende Graphen:** Bearbeitet wird nur der Teil, der vom Startknoten aus erreichbar ist (bei gerichteten Graphen in Pfeilrichtung). Die übrigen Knoten sind ausgegraut; der erste Schritt nennt sie.
- **Mit Ziel** endet der Algorithmus, sobald das Ziel besucht wird:
  - Breitensuche: Das Ziel wird aus der Warteschlange genommen. Der Weg hat die wenigsten Kanten.
  - Tiefensuche: DFS(Ziel) wird aufgerufen. Der Weg entspricht dem Aufrufstapel und ist nicht unbedingt der kürzeste.
  - Dijkstra: Das Ziel wird aktueller Knoten. Der Weg ist (bei Gewichten ≥ 0) der kürzeste.
  - Ist das Ziel nicht erreichbar, meldet das der erste und der letzte Schritt.
- **Spannbaum** (Breiten- und Tiefensuche): Der Schalter „Spannbaum anzeigen“ ist nach dem letzten Schritt verfügbar. Er hebt die Baumkanten hervor und blendet die übrigen Kanten ab. Mit Ziel ist es der Baum bis zum Abbruch.
- **Breitensuche:** Gewichte spielen keine Rolle; der Abstand zählt die Kanten. Ein Knoten gilt als „entdeckt“, sobald er in die Warteschlange kommt, und als „besucht“, wenn er herausgenommen wird.
- **Tiefensuche:** rekursive Fassung. Jede geprüfte Kante und jeder Rücksprung ist ein eigener Schritt.
- **Dijkstra:**
  - Lehrbuchfassung: Der Knoten mit der kleinsten Distanz in der Warteschlange wird aktueller Knoten und ist damit fertig; ein fertiger Knoten wird nie mehr geändert. Bei gleicher Distanz entscheidet das Alphabet.
  - Eine Tabellenzeile je aktuellem Knoten; Zeile 0 ist der Start. Die Zeile wächst mit, während die Kanten des aktuellen Knotens geprüft werden. Neu erreichte oder verkürzte Tripel sind hervorgehoben.
  - Fertige Knoten stehen nur noch in ihrer eigenen Zeile als aktueller Knoten.
  - Nach dem letzten Schritt zeigt die Auswahl „Weg anzeigen zu“ (oder ein Klick auf einen Knoten) den Weg zu jedem fertigen Knoten.
- **Negative Gewichte (Dijkstra):**
  - Über der Seite erscheint ein Hinweis, dass Dijkstra Gewichte ≥ 0 voraussetzt.
  - Prüft Dijkstra eine Kante zu einem schon fertigen Knoten, über die dieser kürzer erreichbar wäre, weist der Schritt darauf hin.
  - Nach dem letzten Schritt erscheint aufklappbar der **Vergleich mit Bellman-Ford**: Distanzen und Vorgänger beider Verfahren, Bewertung je Knoten, Kanten, über die sich Dijkstras Ergebnis noch verkürzen ließe.
  - **Negativer Zyklus:** Bellman-Ford nennt den Zyklus mit seiner Summe; alle davon erreichbaren Knoten haben keine kürzeste Distanz (−∞). Der Zyklus lässt sich in der Zeichnung markieren.
  - In einem ungerichteten Graphen ist jede negative Kante A–B allein schon ein negativer Zyklus (A → B → A); die Seite weist darauf hin.

### Training (Seite 6)

- Oben wählen die Lernenden den **Algorithmus** (Breitensuche, Tiefensuche oder Dijkstra) und den **Startknoten**. Durchlaufen wird immer der ganze vom Startknoten aus erreichbare Teil des Graphen (kein Ziel).
- Jeder Algorithmus hat einen eigenen Stand. Ein Wechsel des Algorithmus behält ihn. Ein Wechsel des Startknotens und **Neu beginnen** verwerfen ihn (mit Rückfrage, wenn schon etwas eingegeben wurde).
- Gezählt werden die **Schritte** (richtige Klicks bzw. richtige Tabellenzeilen) und die **Fehlentscheidungen**. Falsche Versuche zählen nicht als Schritt.
- Die Hinweise nennen Ort und Art eines Fehlers, aber nie den richtigen Wert.

**Breiten- und Tiefensuche (per Klick)**
- Ein Klick auf einen unbesuchten Knoten **besucht** ihn, ein Klick auf einen besuchten Knoten **schließt ihn ab**. Bedienung auch mit der Tastatur: Tabulatortaste bis zum Knoten, dann Eingabe- oder Leertaste.
- Richtige Abfolge (Lehrbuchmodell weiß/grau/schwarz, Nachbarn alphabetisch):
  - Breitensuche: Bearbeitet wird der zuerst besuchte, noch nicht abgeschlossene Knoten. Erst werden alle seine unbesuchten Nachbarn besucht, dann wird er abgeschlossen. Beispiel: A1, B1, C1, A2, D1, B2, …
  - Tiefensuche: Bearbeitet wird der zuletzt besuchte, noch nicht abgeschlossene Knoten. Hat er einen unbesuchten Nachbarn, wird der alphabetisch erste besucht, sonst wird der Knoten abgeschlossen (Rücksprung). Die Reihenfolge entspricht den Nummern auf Seite 4.
- Ein falscher Klick ändert nichts. Er zählt als Fehlentscheidung, und es erscheint der Hinweis „Die korrekte Abfolge der Abarbeitung wurde nicht beachtet“ mit einem Grund, z. B.:
  - Die Suche beginnt beim Startknoten.
  - Die Nachbarn werden alphabetisch besucht.
  - X hat noch unbesuchte Nachbarn.
  - X ist kein Nachbar des Knotens, der gerade bearbeitet wird.
  - Abgeschlossen wird in der Reihenfolge, in der die Knoten besucht wurden (Breitensuche) bzw. zuerst der zuletzt besuchte Knoten (Tiefensuche).
  - X ist schon abgeschlossen bzw. vom Startknoten aus nicht erreichbar.
- Die Zeichnung zeigt unbesuchte, besuchte und abgeschlossene Knoten; daneben stehen die Reihenfolgen „Besucht“ und „Abgeschlossen“. Nicht erreichbare Knoten werden nicht verraten.

**Dijkstra (Berechnungstabelle)**
- Die Tabelle hat dieselben Spalten wie auf Seite 5 und beginnt nur mit Zeile 0. Jede offene Zeile hat drei Eingabefelder und **Prüfen** am Zeilenende (oder Eingabetaste).
- Ist die Zeile richtig, wird sie schreibgeschützt in der Schreibweise von Seite 5 angezeigt, und die nächste Zeile erscheint. Die **Zeichnung** zeigt dann den Stand am Ende dieser Zeile wie Seite 5: aktueller Knoten, Warteschlange, Rand, fertige Knoten, Distanzen an den Knoten und Kanten zum Vorgänger.
- Eine falsche Zeile ändert weder Tabelle noch Zeichnung. Die Hinweise stehen unter der Zeile, die Eingabe bleibt zum Verbessern stehen.
- **Schreibweise:**
  - Tripel `(Knoten, Vorgänger, Distanz)`, mehrere durch Komma getrennt
  - kein Vorgänger: `–` oder `-` (auch leer); nicht erreicht: `∞`, `inf` oder `unendlich`; negative Zahlen mit `-` oder `−`
  - Groß-/Kleinschreibung der Namen egal
  - Zeile 0 hat keinen aktuellen Knoten
  - Den Rand kann man als Namen (`D, E`) oder als Tripel angeben, in beliebiger Reihenfolge. Knoten, die vom Startknoten aus nicht erreichbar sind, dürfen im Rand stehen oder fehlen.
- **Schreibfehler** zählen nicht als Fehlentscheidung, z. B.: fehlendes Komma zwischen zwei Tripeln, fehlende Klammer, Tripel ohne drei Angaben, Semikolon statt Komma, unbekannter Knoten, ungültige Distanz, Knoten doppelt, aktueller Knoten nur als Name.
- **Rechenfehler** zählen als Fehlentscheidung, z. B.:
  - falscher aktueller Knoten (nicht die kleinste Distanz, Gleichstand nicht alphabetisch, noch im Rand, schon fertig)
  - Relaxation übersehen (Knoten nicht erreicht oder nicht verkürzt)
  - Distanz oder Vorgänger falsch, Tripel verändert, obwohl der Knoten nicht kürzer erreichbar ist (auch: bei gleicher Distanz bleibt der bisherige Vorgänger)
  - fertiger Knoten noch in Warteschlange oder Rand, Knoten fehlt
  - Warteschlange nicht nach Distanz bzw. bei Gleichstand nicht alphabetisch sortiert
- Bei negativen Gewichten erscheint derselbe Hinweis wie auf Seite 5; geprüft wird nach der Lehrbuchfassung.

### Dateiformat für den Upload

Die Datei ersetzt den vorhandenen Graphen (nach Rückfrage). Das Format wird automatisch erkannt.

**Kantenliste**
```
ungerichtet
von;nach;gewicht
A;B;4
A;C;-2
B;C
D
```
- Je Zeile: Startknoten; Endknoten; Gewicht. Fehlt das Gewicht, gilt 1.
- Eine Zeile mit nur einem Namen legt einen Knoten ohne Kante an.
- Kopfzeile optional (erkannt an Wörtern wie „von“, „nach“, „Gewicht“).
- Eine Zeile mit nur `gerichtet` oder `ungerichtet` legt die Art des Graphen fest. Fehlt sie, gilt die Einstellung auf Seite 1.
- Ungerichtet: `A;B;3` und `B;A;3` beschreiben dieselbe Kante und werden zusammengefasst; mit verschiedenen Gewichten wird die zweite Zeile gemeldet.

**Positionen der Knoten (optional, nur bei einer Kantenliste)**
```
ungerichtet
von;nach;gewicht
A;B;6
A;C;2
knoten;x;y
A;100;195
B;470;80
C;335;455
```
- Nach den Kanten folgt die Kopfzeile `knoten;x;y`, darunter je Knoten eine Zeile mit Name, x und y.
- Die Koordinaten dürfen einfach die Pixel aus einer Abbildung sein (y nach unten, auch mit Dezimalkomma). Beim Laden wird der Graph auf die Zeichenfläche skaliert, das Seitenverhältnis bleibt erhalten, und er wird mittig gesetzt.
- Fehlt die Position eines Knotens, werden alle Knoten automatisch angeordnet; die Meldung nennt den Knoten. Fehlerhafte Zeilen (unbekannter Knoten, doppelte Angabe, keine Zahl) werden mit Zeilennummer gemeldet.
- Unter einer Adjazenzmatrix wird der Block nicht ausgewertet (Hinweis, automatische Anordnung).

**Adjazenzmatrix**
```
gerichtet;A;B;C
A;;4;2
B;;;-1
C;1;;
```
- Erste Zeile: Ecke, dann die Knotennamen. Die Ecke ist leer oder enthält `gerichtet` bzw. `ungerichtet`.
- Darunter je Knoten eine Zeile: Name, dann die Gewichte (Zeile = von, Spalte = nach). Die Zeilen dürfen anders sortiert sein als die Spalten.
- Keine Kante: leere Zelle, `-`, `–`, `x` oder `∞`.
- `0` ist eine Kante mit Gewicht 0. Ausnahmen:
  - Besteht die Matrix nur aus 0 und 1 (leere Zellen zählen nicht mit), gilt sie als ungewichtete Adjazenzmatrix wie im Schulbuch: 1 = Kante, 0 = keine Kante. Wer in einer solchen Matrix Kanten mit Gewicht 0 meint, kennzeichnet fehlende Kanten mit `-` oder `x`.
  - Auf der Hauptdiagonalen bedeutet 0 immer „keine Kante“ (Abstand eines Knotens zu sich selbst).
- Ohne Angabe in der Ecke gilt eine symmetrische Matrix als ungerichtet, sonst als gerichtet. Ist `ungerichtet` angegeben, muss die Matrix symmetrisch sein.
- Einträge auf der Hauptdiagonalen (Schleifen) werden gemeldet.

**Für beide Formate**
- CSV: Trennzeichen Semikolon, Komma oder Tabulator (automatische Erkennung), UTF-8 oder Windows-1252. XLSX/ODS: erstes Tabellenblatt.
- **Knotennamen:** 1 bis 12 Zeichen aus Buchstaben (auch Umlaute), Ziffern, `_` und `-`; keine Leerzeichen. Groß-/Kleinschreibung zählt beim Vergleich nicht (`a` und `A` sind derselbe Knoten).
- **Gewichte:** ganze Zahlen von −999 bis 999 (auch 0 und negative Werte), in allen Eingabewegen.
- **Grenzen:** höchstens 2 MB, 26 Knoten, 150 Kanten; keine Schleifen und keine Mehrfachkanten.
- Ungültige Zeilen werden mit Zeilennummer gemeldet und übersprungen.

### Eingabemaske und Zeichnung

- **Knoten hinzufügen:** Der neue Knoten erscheint an einer freien Stelle.
- **Kante hinzufügen oder ändern:** von, nach, Gewicht (leer = 1). Gibt es die Kante schon, wird ihr Gewicht geändert. Im ungerichteten Graphen ist B–A dieselbe Kante wie A–B.
- **Gerichtet/ungerichtet umschalten** (nach Rückfrage):
  - ungerichtet → gerichtet: aus A–B werden A→B und B→A mit demselben Gewicht;
  - gerichtet → ungerichtet: A→B und B→A werden zusammengefasst. Haben sie verschiedene Gewichte, ist die Umwandlung nicht möglich (Meldung).
- **Knoten löschen** entfernt auch seine Kanten (Rückfrage, wenn Kanten betroffen sind).
- **Knoten neu anordnen:** kräftebasierte Anordnung (bei gleichem Graphen immer dieselbe). Dieselbe Anordnung erhält ein Graph beim Laden aus einer Datei oder einem Beispiel.
- **Zeichnung:** Knoten lassen sich mit Maus, Stift oder Finger auf allen Seiten verschieben; die Position gilt dann überall. Gerichtete Kanten haben Pfeilspitzen; gibt es auch die Gegenkante, sind beide gebogen. Gewichte erscheinen, sobald eines von 1 abweicht; negative Gewichte sind rot.
- **Matrix (Seite 2):** Bei einem ungewichteten Graphen (alle Gewichte 1) zeigt sie 1 und 0, sonst das Gewicht (auch 0) und „–“ für „keine Kante“. Übernimmt man diese Matrix in eine Datei, wird sie wieder genauso eingelesen.

## Beispielgraphen (`testdata/`)

Alle Beispiele sind im Paket eingebaut (Auswahl auf Seite 1) und liegen zeichengleich als CSV-Datei in `testdata/` (UTF-8, Semikolon).

| Datei | Inhalt | gedacht für |
|---|---|---|
| `beispiel-ungewichtet.csv` | ungerichtet, ungewichtet, 8 Knoten (A bis H), 10 Kanten | Breiten- und Tiefensuche, Matrix 0/1 |
| `beispiel-unzusammenhaengend.csv` | ungerichtet, zwei Teile und ein einzelner Knoten | Bearbeitung nur des Teils mit dem Startknoten |
| `beispiel-staedte.csv` | ungerichtet, 7 bayerische Städte, Straßenentfernungen in km (gerundete Näherungswerte) | Dijkstra |
| `beispiel-matrix.csv` | gerichtet, als Adjazenzmatrix; mehrere Verkürzungen während des Ablaufs | Matrixformat, Dijkstra-Tabelle |
| `beispiel-negatives-gewicht.csv` | gerichtet, eine negative Kante C→B (−3), kein negativer Zyklus | Dijkstra liefert falsche Distanzen für B, D und E; Bellman-Ford die richtigen |
| `beispiel-negativer-zyklus.csv` | gerichtet, Zyklus B → C → D → B mit Summe −1 | negativer Zyklus, keine kürzesten Wege |

Weitere Übungsgraphen nur zum Hochladen (nicht in der Auswahlliste). Sie enthalten einen Positionsblock, damit die Knoten nach dem Hochladen so stehen wie in den Abbildungen der Aufgaben:

| Datei | Inhalt |
|---|---|
| `beispiel-graph-01.csv` | ungerichtet, 6 Knoten (A bis F), 11 Kanten |
| `beispiel-graph-02.csv` | ungerichtet, 11 Knoten (A bis K), 15 Kanten |
| `beispiel-graph-03.csv` | gerichtet, 8 Knoten (A bis H), 13 Kanten, mehrere Kantenpaare in beiden Richtungen mit verschiedenen Gewichten |
| `beispiel-graph-04.csv` | ungerichtet, 16 Knoten (A bis P), 31 Kanten |
| `beispiel-graph-sigismund.csv` | ungerichtet, Wegeplan mit 17 Knoten (A bis Q) und 3 Hilfsknoten (X1 bis X3), 25 Kanten. Wo zwei Wege dieselben Knoten verbinden, liegt auf dem längeren ein Hilfsknoten, weil EDGY EDGES keine Mehrfachkanten kennt: B–X1–F (4 + 4 = 8), J–X2–M (3 + 3 = 6), L–X3–Q (2 + 3 = 5). Weil EDGY EDGES gerade Kanten zeichnet (die Wege im Plan verlaufen rechtwinklig), sind C und I gegenüber der Abbildung etwas verschoben, damit keine Kante durch einen Knoten läuft; die Hilfsknoten liegen an Ecken der Wege |

## Aufbau

```
EDGY-EDGES/
├─ src/                      NUR die Dateien des SCORM-Pakets (1:1 im ZIP)
│  ├─ imsmanifest.xml        SCORM-1.2-Manifest (ein SCO, alle Dateien gelistet)
│  ├─ index.html             Gerüst der sechs Seiten, Content-Security-Policy
│  ├─ LICENSE.txt            MIT-Lizenz (wird mit ausgeliefert; Kopie von LICENSE)
│  ├─ css/base.css           gemeinsame Grundgestaltung (Kopie aus shared/)
│  ├─ css/style.css          Gestaltung des Pakets (Zustandsfarben, Zeichnung, Tabellen)
│  └─ js/
│     ├─ dom-utils.js        sichere DOM-Erzeugung (Kopie aus shared/)
│     ├─ format-utils.js     Zahlen, Distanzen (∞), Tripel (ergänzt dom)
│     ├─ text-utils.js       Entfernen unsichtbarer Steuer- und Richtungszeichen (Kopie aus shared/)
│     ├─ tabs.js             Seitennavigation über Registerkarten (Kopie aus shared/)
│     ├─ scorm-api.js        SCORM-1.2-Wrapper (Kopie aus shared/)
│     ├─ inflate.js, zip-reader.js, xml-utils.js,
│     │  csv-parser.js, xlsx-parser.js, ods-parser.js   Datei-Import (Kopien aus shared/)
│     ├─ layout.js           Anordnung der Knoten (Kreis, kräftebasiert, freier Platz)
│     ├─ graph.js            zentraler Zustand des Graphen, Eingabeprüfung, Änderungsereignisse
│     ├─ graph-import.js     Upload-Prüfung, Erkennung Kantenliste/Matrix
│     ├─ samples.js          eingebaute Beispielgraphen (aus testdata/ erzeugt)
│     ├─ algorithms.js       Breitensuche, Tiefensuche, Dijkstra, Bellman-Ford (Schrittlisten)
│     ├─ training.js         Training: richtige Abfolge, Klickbewertung, Tabelleneingabe lesen und prüfen
│     ├─ graph-view.js       SVG-Zeichnung, Verschieben der Knoten, Legende
│     ├─ player.js           Abspieler (Einzelschritt, Automatik, Pause)
│     ├─ pages/*.js          die sechs Seiten (+ gemeinsamer Rahmen der Algorithmus-Seiten)
│     ├─ progress.js         Speichern/Wiederherstellen von Graph und Training in der Lernplattform
│     └─ app.js              Navigation, Verteilung der Änderungen, SCORM-Status
├─ testdata/                 Beispielgraphen als CSV (siehe oben)
├─ preview/                  Vorschau
└─ README.md                 diese Datei
```

Der Ordner `src/` enthält ausschließlich Paketdateien – genau die Dateien, die im SCORM-ZIP landen. Das fertige Paket entsteht als `dist/edgy-edges.zip` im Stamm des Repositorys; der Ordner `dist/` wird nicht versioniert.

## Paket erstellen und in Moodle einbinden

Das SCORM-Paket ist ein ZIP-Archiv mit dem **Inhalt** des Ordners `src/`. `imsmanifest.xml` muss dabei direkt in der obersten Ebene des ZIP liegen, nicht in einem Unterordner `src/`.

- **Windows:** Ordner `src` öffnen, alle Dateien und Ordner markieren, dann *Senden an → ZIP-komprimierter Ordner*. Die Datei `edgy-edges.zip` nennen und in den Ordner `dist/` im Stamm des Repositorys legen.
- **Andere Systeme:** im Ordner `src` z. B. `mkdir -p ../../dist && zip -r ../../dist/edgy-edges.zip .` ausführen.

So wird das Paket in Moodle eingebunden:
1. Kurs → *Aktivität oder Material anlegen* → **Lernpaket (SCORM)**.
2. `edgy-edges.zip` hochladen.
3. **Abschluss: In den Einstellungen der Aktivität unter *Aktivitätsabschluss* „Teilnehmer/innen können die Aktivität manuell als abgeschlossen markieren“ einstellen.** Nur so lässt sich die Aktivität als abgeschlossen erkennen. Das Lernpaket meldet beim Öffnen nämlich den Status „incomplete“ und nie „completed“: Ein abgeschlossener Versuch würde Moodle beim erneuten Öffnen in den *Überprüfungsmodus* schalten. Abschlussbedingungen, die den SCORM-Status auswerten („Status erforderlich“, „Alle Lernobjekte abgeschlossen“), werden deshalb nie erfüllt.
   - Ein Status „completed“ bzw. „passed“ aus einer früheren Version des Pakets bleibt unverändert; für diese Lernenden erscheint der Überprüfungsmodus weiterhin. Abhilfe: das Paket in einer neuen Aktivität einbinden.
4. Damit der Graph in der nächsten Stunde wieder da ist, muss Moodle denselben Versuch fortsetzen: Einstellung **„Neuen Versuch erzwingen“ = „Nein“** (Standard).

### Speicherung des Graphen und des Trainings

- Nach **jeder** Änderung des Graphen wird er sofort in Moodle gespeichert (`cmi.suspend_data`, mit `LMSCommit`): Knoten oder Kante eingegeben, geändert oder gelöscht, Datei oder Beispiel geladen, Richtung umgeschaltet, Knoten verschoben oder neu angeordnet.
- Gespeichert werden die Art (gerichtet/ungerichtet), die Knoten mit ihren Positionen und die Kanten mit Gewicht. Der größte zulässige Graph (26 Knoten, 150 Kanten) passt in die 4.096 Zeichen von SCORM 1.2.
- **Training (Seite 6):** Gespeichert wird nach jedem Klick, nach jedem „Prüfen“ und beim Eintippen in die Tabelle (kurz verzögert, spätestens beim Verlassen des Feldes oder der Seite). Je Algorithmus: Startknoten, Zahl der richtigen Schritte bzw. Zeilen, Fehlentscheidungen, bei Dijkstra der Inhalt der offenen Zeile; dazu der zuletzt gewählte Algorithmus. Richtige Schritte und Zeilen werden nur gezählt, weil sie sich aus dem Graphen eindeutig ergeben. Beim nächsten Öffnen geht es an derselben Stelle weiter.
- Ändert sich der Graph (außer beim Verschieben von Knoten), beginnt das Training von vorn; die Seite weist darauf hin.
- Reichen die 4.096 Zeichen nicht, wird stufenweise weggelassen: zuerst der Inhalt der offenen Tabellenzeile, dann die Positionen der Knoten (sie werden beim Öffnen neu angeordnet), zuletzt der Stand des Trainings. Die Fußzeile nennt jeweils, was nicht gespeichert wird.
- Nicht gespeichert werden die Einstellungen der Seiten 3 bis 5 (Startknoten, Ziel, Schritt) und besuchte Seiten.
- Ohne Lernplattform (Offline-Modus) wird nichts gespeichert. Ohne Knoten bleibt `cmi.suspend_data` leer.

## Sicherheits- und Datenschutzkonzept

Es gilt dasselbe Konzept wie in den anderen Paketen des Repositorys:

- **Keine Codeausführung über Eingaben oder Uploads:** Inhalte werden nur als Text eingefügt (`textContent`/Textknoten). `innerHTML`, `eval`, `new Function` und `document.write` kommen nicht vor; der Build prüft das. Event-Handler- und `style`-Attribute sowie `javascript:`-/`data:`-Adressen lassen sich über die DOM-Hilfen nicht setzen.
- **Eingaben:** Knotennamen werden über eine Zeichen-Whitelist geprüft, Gewichte über ein striktes Zahlformat. Alle Daten laufen durch `graph.js`, das jeden Knoten und jede Kante selbst prüft – auch beim Ersetzen des ganzen Graphen und beim Wiederherstellen aus Moodle. Fehlermeldungen enthalten keinen ungeprüften Dateiinhalt. Dateinamen werden vor der Anzeige von Steuer- und Richtungszeichen befreit. Werden zwei Dateien schnell nacheinander gewählt, gilt nur die zuletzt gewählte.
- **Uploads, ZIP und XML:** Whitelist der Endungen, höchstens 2 MB, Prüfung der Dateisignatur; Grenzwerte gegen Zip-Bomben, CRC-Prüfung, XML ohne DOCTYPE/ENTITY, begrenzte Elementzahl (gemeinsamer Code aus `shared/`, Einzelheiten in der README von NOSY NEIGHBORS).
- **Content-Security-Policy:** `default-src 'none'`; nur Skripte und Stylesheets aus dem Paket; `form-action 'none'`, `base-uri 'none'`; Trusted Types mit der einzigen privaten Policy `lp-xml` in `xml-utils.js`.
- **Keine externen Quellen:** kein CDN, keine Webfonts, keine Bibliotheken von Drittanbietern.
- **Datenschutz:** An Moodle gehen nur `cmi.core.lesson_status` (`incomplete`), `cmi.core.exit` und in `cmi.suspend_data` der Graph und der Stand des Trainings (Zähler und Eingaben der offenen Tabellenzeile). Schreibzugriffe auf andere Datenelemente sind im Code gesperrt. Der Name der Lernenden wird nicht gelesen. Kein `localStorage`, keine Cookies.

## Qualitätssicherung

Build und Tests laufen mit Entwicklungswerkzeugen außerhalb des Repositorys (wie bei den anderen Paketen):
- **Build:** Manifest vollständig, keine externen Adressen, CSP unverändert streng, keine unsichtbaren Zeichen, keine gefährlichen APIs, UTF-8 ohne BOM mit LF, Kopien aus `shared/` unverändert, eingebaute Beispiele zeichengleich mit `testdata/`.
- **Tests** (headless Chromium): Graphmodell, Import (beide Formate, CSV/XLSX/ODS, Fehlerzeilen), Algorithmen (Reihenfolgen, Distanzen, Tabellenzeilen, negative Gewichte und Zyklen), Training (Abfolgen, Klickbewertung, Schreibweise und Rechenprüfung der Tabelle, Zeichnung nach jeder Zeile, Tastaturbedienung), Bedienung aller Seiten einschließlich Abspieler und Automatik, Speicherung in Moodle (auch Weiterarbeit und Größengrenzen), Sicherheit.
