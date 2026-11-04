# GRAIL – SCORM-1.2-Lernpaket zu Graphalgorithmen

**GRAIL** steht für **GR**aph **A**lgorithm **I**nteractive **L**ab.
Das Paket veranschaulicht Graphen und die Algorithmen Breitensuche, Tiefensuche und Dijkstra Schritt für Schritt.
Es läuft vollständig im Browser, lädt keine externen Ressourcen und verwendet keine externen Bibliotheken.

## Inhalt für den Unterricht

| Seite | Inhalt |
|---|---|
| 1 Graph eingeben | Graph per Datei (CSV, XLSX, ODS; Kantenliste oder Adjazenzmatrix), Beispielgraph oder Eingabemaske erfassen; gerichtet oder ungerichtet; Knoten und Kanten einzeln löschen; die Zeichnung erscheint sofort, Knoten lassen sich verschieben |
| 2 Darstellungen | Links die Zeichnung, rechts die Adjazenzmatrix, darunter aufklappbar die Adjazenzlisten. Zeigen auf eine Kante, eine Zelle oder einen Listeneintrag hebt die zugehörigen Stellen in den anderen Darstellungen hervor |
| 3 Breitensuche | Ablauf Schritt für Schritt: Warteschlange, Besuchsreihenfolge, Abstand (Anzahl der Kanten) und Vorgänger; nach dem letzten Schritt Spannbaum (BFS-Baum) |
| 4 Tiefensuche | Rekursive Tiefensuche Schritt für Schritt: Aufrufstapel, Besuchsreihenfolge, Nummer beim Besuchen und Beenden, Vorgänger; nach dem letzten Schritt Spannbaum (DFS-Baum) |
| 5 Dijkstra | Berechnungstabelle mit den Spalten **Aktueller Knoten**, **Warteschlange** (nach Distanz sortiert) und **Rand** (bisher nicht erreichte Knoten); jeder Knoten als Tripel (Knoten, Vorgänger, Distanz zum Startknoten). Nach dem letzten Schritt Weg zu jedem Knoten und bei negativen Gewichten der Vergleich mit Bellman-Ford |

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

## Aufbau

```
GRAIL/
├─ src/                      NUR die Dateien des SCORM-Pakets (1:1 im ZIP)
│  ├─ imsmanifest.xml        SCORM-1.2-Manifest (ein SCO, alle Dateien gelistet)
│  ├─ index.html             Gerüst der fünf Seiten, Content-Security-Policy
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
│     ├─ graph-view.js       SVG-Zeichnung, Verschieben der Knoten, Legende
│     ├─ player.js           Abspieler (Einzelschritt, Automatik, Pause)
│     ├─ pages/*.js          die fünf Seiten (+ gemeinsamer Rahmen der Algorithmus-Seiten)
│     ├─ progress.js         Speichern/Wiederherstellen des Graphen in der Lernplattform
│     └─ app.js              Navigation, Verteilung der Änderungen, SCORM-Abschluss
├─ testdata/                 Beispielgraphen als CSV (siehe oben)
├─ preview/                  Vorschau
└─ README.md                 diese Datei
```

Der Ordner `src/` enthält ausschließlich Paketdateien – genau die Dateien, die im SCORM-ZIP landen. Das fertige Paket entsteht als `dist/grail.zip` im Stamm des Repositorys; der Ordner `dist/` wird nicht versioniert.

## Paket erstellen und in Moodle einbinden

Das SCORM-Paket ist ein ZIP-Archiv mit dem **Inhalt** des Ordners `src/`. `imsmanifest.xml` muss dabei direkt in der obersten Ebene des ZIP liegen, nicht in einem Unterordner `src/`.

- **Windows:** Ordner `src` öffnen, alle Dateien und Ordner markieren, dann *Senden an → ZIP-komprimierter Ordner*. Die Datei `grail.zip` nennen und in den Ordner `dist/` im Stamm des Repositorys legen.
- **Andere Systeme:** im Ordner `src` z. B. `mkdir -p ../../dist && zip -r ../../dist/grail.zip .` ausführen.

So wird das Paket in Moodle eingebunden:
1. Kurs → *Aktivität oder Material anlegen* → **Lernpaket (SCORM)**.
2. `grail.zip` hochladen.
3. Bewertung: „Abschluss“ bzw. Status „completed“ wird bereits beim Öffnen gemeldet. Ein bereits gemeldeter Abschluss (auch „passed“) bleibt unverändert.
4. Damit der Graph in der nächsten Stunde wieder da ist, muss Moodle denselben Versuch fortsetzen: Einstellung **„Neuen Versuch erzwingen“ = „Nein“** (Standard).

### Speicherung des Graphen

- Nach **jeder** Änderung des Graphen wird er sofort in Moodle gespeichert (`cmi.suspend_data`, mit `LMSCommit`): Knoten oder Kante eingegeben, geändert oder gelöscht, Datei oder Beispiel geladen, Richtung umgeschaltet, Knoten verschoben oder neu angeordnet.
- Gespeichert werden die Art (gerichtet/ungerichtet), die Knoten mit ihren Positionen und die Kanten mit Gewicht. Der größte zulässige Graph (26 Knoten, 150 Kanten) passt in die 4.096 Zeichen von SCORM 1.2. Sollte es dennoch nicht reichen, werden die Positionen weggelassen (die Knoten werden beim Öffnen neu angeordnet); die Fußzeile weist darauf hin.
- Nicht gespeichert werden die Einstellungen der Seiten 3 bis 5 (Startknoten, Ziel, Schritt) und besuchte Seiten.
- Ohne Lernplattform (Offline-Modus) wird nichts gespeichert. Ohne Knoten bleibt `cmi.suspend_data` leer.

## Sicherheits- und Datenschutzkonzept

Es gilt dasselbe Konzept wie in den anderen Paketen des Repositorys:

- **Keine Codeausführung über Eingaben oder Uploads:** Inhalte werden nur als Text eingefügt (`textContent`/Textknoten). `innerHTML`, `eval`, `new Function` und `document.write` kommen nicht vor; der Build prüft das. Event-Handler- und `style`-Attribute sowie `javascript:`-/`data:`-Adressen lassen sich über die DOM-Hilfen nicht setzen.
- **Eingaben:** Knotennamen werden über eine Zeichen-Whitelist geprüft, Gewichte über ein striktes Zahlformat. Alle Daten laufen durch `graph.js`, das jeden Knoten und jede Kante selbst prüft – auch beim Ersetzen des ganzen Graphen und beim Wiederherstellen aus Moodle. Fehlermeldungen enthalten keinen ungeprüften Dateiinhalt. Dateinamen werden vor der Anzeige von Steuer- und Richtungszeichen befreit. Werden zwei Dateien schnell nacheinander gewählt, gilt nur die zuletzt gewählte.
- **Uploads, ZIP und XML:** Whitelist der Endungen, höchstens 2 MB, Prüfung der Dateisignatur; Grenzwerte gegen Zip-Bomben, CRC-Prüfung, XML ohne DOCTYPE/ENTITY, begrenzte Elementzahl (gemeinsamer Code aus `shared/`, Einzelheiten in der README von NEIGHBORS).
- **Content-Security-Policy:** `default-src 'none'`; nur Skripte und Stylesheets aus dem Paket; `form-action 'none'`, `base-uri 'none'`; Trusted Types mit der einzigen privaten Policy `lp-xml` in `xml-utils.js`.
- **Keine externen Quellen:** kein CDN, keine Webfonts, keine Bibliotheken von Drittanbietern.
- **Datenschutz:** An Moodle gehen nur `cmi.core.lesson_status` (`completed`), `cmi.core.exit` und in `cmi.suspend_data` der Graph. Schreibzugriffe auf andere Datenelemente sind im Code gesperrt. Der Name der Lernenden wird nicht gelesen. Kein `localStorage`, keine Cookies.

## Qualitätssicherung

Build und Tests laufen mit Entwicklungswerkzeugen außerhalb des Repositorys (wie bei den anderen Paketen):
- **Build:** Manifest vollständig, keine externen Adressen, CSP unverändert streng, keine unsichtbaren Zeichen, keine gefährlichen APIs, UTF-8 ohne BOM mit LF, Kopien aus `shared/` unverändert, eingebaute Beispiele zeichengleich mit `testdata/`.
- **Tests** (headless Chromium): Graphmodell, Import (beide Formate, CSV/XLSX/ODS, Fehlerzeilen), Algorithmen (Reihenfolgen, Distanzen, Tabellenzeilen, negative Gewichte und Zyklen), Bedienung aller Seiten einschließlich Abspieler und Automatik, Speicherung in Moodle, Sicherheit.
