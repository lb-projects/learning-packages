# NEIGHBORS – SCORM-1.2-Lernpaket zum Verfahren k nächste Nachbarn

**NEIGHBORS** steht für **N**ew **E**xamples **I**nherit **G**roup **H**abits **B**y **O**bserving **R**elevant **S**amples.

Interaktiver Simulator zum Klassifikationsverfahren **k nächste Nachbarn (kNN)**.
Das Paket läuft vollständig im Browser, lädt keine externen Ressourcen und verwendet
keine externen Bibliotheken.

## Inhalt für den Unterricht

| Seite | Inhalt |
|---|---|
| 1 Training | Trainingsdaten per Datei (CSV, XLSX, ODS), Beispieldaten oder Eingabemaske erfassen, anzeigen und einzeln entfernen |
| 2 Klassifizierung neuer Datenpunkte | Neuen Punkt eingeben oder ins Diagramm klicken; k und Metrik wählen; Kreis bzw. Raute, Nachbarn und Rechenweg werden angezeigt |
| 3 Auswirkungen des Parameters k | Für einen Trainingspunkt zeigt eine Tabelle über alle k, ob er korrekt (grün) oder falsch (rot) klassifiziert wird; bei Fehlern steht das berechnete Label dabei |
| 4 Auswahl eines passenden Wertes für k | Ein wählbarer Anteil der Daten (1–90 %, Standard 20 %) wird zufällig zu Validierungsdaten; die Schülerinnen und Schüler tragen für k = 1 … 10 ein „x“ ein, die Prozentzeile wird berechnet, „Eintragungen prüfen“ markiert jede Zelle |
| 5 Leave One Out – Verfahren | Wie Seite 4, aber jeder Punkt wird einmal weggelassen |
| 6 Leave One Out – automatisiert | Genauigkeit für alle k = 1 … n−1 als Balkendiagramm und Tabelle, beste k hervorgehoben, Detailmatrix |
| 7 Test und Konfusionsmatrix | Testdaten per Datei oder Eingabemaske erfassen und einzeln entfernen; jeder Testpunkt wird anhand aller Trainingsdaten klassifiziert (k und Metrik wählbar). Die Konfusionsmatrix (Zeilen = tatsächliches, Spalten = vorhergesagtes Label) passt ihre Größe an die Labels der Trainingsdaten an; dazu Genauigkeit und Ergebnis je Testpunkt |
| 8 Normalisierung | Die aktuellen Trainingsdaten links ohne, rechts mit Normalisierung (Min-Max auf 0 bis 1 oder Z-Standardisierung, umschaltbar), jeweils mit einem neuen Punkt und seinen k nächsten Nachbarn. Aufklappbar: allgemeine Erklärung, Rechnung mit den aktuellen Kennwerten, Nachbarn des neuen Punkts im Vergleich, Genauigkeit je k (Leave One Out) ohne und mit Normalisierung, Punkte, deren Ergebnis sich ändert (per Schalter in beiden Diagrammen markierbar) |
| 9 Regression | Für einen neuen x-Wert wird der y-Wert aus den k Trainingspunkten mit dem nächsten x-Wert prognostiziert (Mittelwert oder gewichteter Mittelwert, umschaltbar); Streifen = Abstand zum k-ten Nachbarn, Nachbarn und prognostizierter Punkt hervorgehoben, Rechenweg und Nachbartabelle; Regressionskurve zuschaltbar. Die Punkte erscheinen einheitlich, das Label spielt keine Rolle |

Auf großen Bildschirmen nutzen die Seiten **Training** und **Klassifizierung neuer Datenpunkte** bis 2400 px Breite: Die linke Spalte wächst bis höchstens 720 px, den übrigen Platz erhält das Diagramm (höchstens 75 % der Fensterhöhe). Die übrigen Seiten bleiben bei höchstens 1400 px.

Zwischen den Seiten kann jederzeit gewechselt werden. Änderungen der Trainingsdaten wirken sofort auf alle Seiten:

- Eintragungen bleiben für alle noch vorhandenen Punkte erhalten.
- Prüfmarkierungen werden zurückgesetzt, weil sich die Ergebnisse geändert haben können. Ein Hinweis weist darauf hin.

**Testdaten (Seite 7)** werden getrennt von den Trainingsdaten gespeichert:

- Sie fließen nie als Nachbarn in eine Klassifizierung ein.
- Änderungen der Testdaten wirken sich nicht auf die übrigen Seiten aus. Änderungen der Trainingsdaten lassen die Testdaten unverändert; die Matrix wird neu berechnet.
- Testpunkte mit einem Label, das in den Trainingsdaten nicht vorkommt, bleiben erhalten. Sie gelten als „nicht auswertbar“ und werden in der Matrix nicht gezählt.

### Dateiformat für den Upload

- **Spalten:** x-Wert, y-Wert, Label
- **Kopfzeile:** optional. Stehen in der ersten Zeile keine Zahlen, werden Spalte 1 und 2 als Achsenbeschriftung verwendet.
- **CSV:** Trennzeichen Semikolon, Komma oder Tabulator (automatische Erkennung). Dezimalkomma oder Dezimalpunkt, UTF-8 oder Windows-1252.
- **Grenzen:**
  - höchstens 2 MB;
  - höchstens 500 Punkte;
  - höchstens 10 Labels;
  - Werte zwischen −1000 und 1000;
  - Labels mit höchstens 30 Zeichen (Buchstaben, Ziffern, Leerzeichen, `. _ -`).
- Ein Upload **ersetzt** die vorhandenen Daten (nach Rückfrage). Die Eingabemaske **ergänzt** sie.
- Für Testdaten (Seite 7) gelten dasselbe Format und dieselben Grenzen. Die Achsenbeschriftung einer Testdatei wird nicht übernommen.

### Festlegungen des Algorithmus

- **Euklidische Metrik:** √(Δx² + Δy²).
- **Manhattan-Metrik:** |Δx| + |Δy|. Im Diagramm wird sie als Weg entlang der Achsen und als Raute dargestellt.
- **Stimmengleichstand:** Es gewinnt das Label des nächstgelegenen Nachbarn unter den gleichauf liegenden Labels. Die Seite zeigt den Hinweis „Gleichstand“.
- **Gleicher Abstand:** Es zählt die Reihenfolge der Eingabe. Seite 2 weist darauf hin, wenn das an der Grenze des k-ten Nachbarn relevant ist.
- **Seite 2:** Werden neue Trainingsdaten geladen (Datei oder Beispieldaten), wird der neue Punkt zurückgesetzt; k und Metrik bleiben eingestellt. Bei einzelnen Änderungen der Trainingsdaten bleibt er erhalten.
- **Seite 3:** Der betrachtete Punkt wird bei seiner eigenen Klassifizierung ausgeschlossen.
- **Seite 4:** Es bleiben immer mindestens ein Validierungs- und ein Trainingspunkt; die Anzahl ist der gerundete Anteil.
- **Seite 7:** Nachbarn sind alle Trainingspunkte (auch die auf Seite 4 als Validierungsdaten markierten).
- **Seite 8 (Normalisierung):**
  - **Min-Max:** x' = (x − min) / (max − min); die Trainingsdaten liegen danach zwischen 0 und 1.
  - **Z-Standardisierung:** x' = (x − x̄) / s mit s = √(Σ(x − x̄)² / n) (geteilt durch die Anzahl n der Punkte); danach Mittelwert 0 und Standardabweichung 1.
  - Kennwerte (min/max bzw. x̄/s) stammen aus allen Trainingspunkten und werden bei jeder Datenänderung neu berechnet; ein neuer Punkt wird mit denselben Kennwerten umgerechnet (bei Min-Max ggf. außerhalb von 0 bis 1).
  - Haben alle Trainingspunkte auf einer Achse denselben Wert, wird durch 1 geteilt; die umgerechneten Werte sind dann 0 (mit Hinweis).
  - Das linke Diagramm ist wie überall gleich skaliert – bei Merkmalen mit sehr unterschiedlichen Größenordnungen wirken die Daten dort zusammengedrückt; genau das zeigt die Verzerrung der Abstände. Das rechte Diagramm ist ebenfalls gleich skaliert.
  - Leave-One-Out-Vergleich für k = 1 … min(20, n − 1); die Liste der unterschiedlich klassifizierten Punkte verwendet das eingestellte k.
  - Der Schalter „Anders klassifizierte Punkte hervorheben“ (unter k) markiert diese Punkte in beiden Diagrammen, unabhängig davon, ob der Abschnitt aufgeklappt ist. Er ist anfangs aus und bleibt beim Laden neuer Daten eingestellt.
  - Alle Abschnitte sind anfangs zugeklappt. Werden neue Trainingsdaten geladen (Datei oder Beispieldaten), wird die Seite zurückgesetzt: neuer Punkt und gewählter Beispielpunkt entfallen, alle Abschnitte werden zugeklappt. Verfahren, Metrik und k bleiben eingestellt.
- **Seite 9 (Regression):**
  - Merkmal ist x, vorhergesagt wird y. Der Abstand ist |Δx|; eine Metrik-Auswahl gibt es deshalb nicht. Nachbarn sind alle Trainingspunkte.
  - **Mittelwert:** ŷ = (y₁ + … + yₖ) / k.
  - **Gewichteter Mittelwert:** ŷ = Σ(wᵢ·yᵢ) / Σwᵢ mit wᵢ = 1 / |Δxᵢ|. Haben Nachbarn denselben x-Wert (|Δx| = 0), zählen nur diese, jeweils mit gleichem Gewicht.
  - Bei gleichem Abstand zählt die Reihenfolge der Eingabe (mit Hinweis an der Grenze des k-ten Nachbarn).
  - Die Regressionskurve zeigt die Prognose für jeden x-Wert des Diagramms (beim Mittelwert eine Treppenfunktion).
  - Werden neue Trainingsdaten geladen (Datei oder Beispieldaten), wird der gewählte x-Wert zurückgesetzt; k, Berechnung und Kurve bleiben eingestellt.
  - Im Diagramm sind die Achsen getrennt skaliert, damit Daten mit verschiedenen Größenordnungen (z. B. Uhrzeit und kW) die Fläche füllen. Abstände werden auf dieser Seite nur in x-Richtung gemessen. Auf den Seiten 1 bis 7 bleiben die Achsen gleich skaliert, weil dort Abstände in beiden Richtungen zählen.

## Aufbau

```
NEIGHBORS/
├─ src/                      NUR die Dateien des SCORM-Pakets (1:1 im ZIP)
│  ├─ imsmanifest.xml        SCORM-1.2-Manifest (ein SCO, alle Dateien gelistet)
│  ├─ index.html             Gerüst der neun Seiten, Content-Security-Policy
│  ├─ LICENSE.txt            MIT-Lizenz (wird mit ausgeliefert; Kopie von LICENSE)
│  ├─ css/base.css           gemeinsame Grundgestaltung (Kopie aus shared/)
│  ├─ css/style.css          Gestaltung des Pakets (farbenblindfreundliche Palette, Diagramme)
│  └─ js/
│     ├─ dom-utils.js        sichere DOM-Erzeugung (Kopie aus shared/)
│     ├─ format-utils.js     Zahl- und Punktformate des Pakets (ergänzt dom)
│     ├─ text-utils.js       Entfernen unsichtbarer Steuer- und Richtungszeichen (Kopie aus shared/)
│     ├─ tabs.js             Seitennavigation über Registerkarten (Kopie aus shared/)
│     ├─ scorm-api.js        SCORM-1.2-Wrapper (Schreib-Whitelist, Offline-Modus; Kopie aus shared/)
│     ├─ inflate.js          eigener DEFLATE-Dekoder (RFC 1951) + CRC-32 (Kopie aus shared/)
│     ├─ zip-reader.js       ZIP-Leser mit Grenzwerten gegen Zip-Bomben (Kopie aus shared/)
│     ├─ xml-utils.js        XML-Parsing ohne DOCTYPE/ENTITY (Kopie aus shared/)
│     ├─ csv-parser.js       CSV nach RFC 4180 (Kopie aus shared/)
│     ├─ xlsx-parser.js      Excel (.xlsx), erstes Blatt, keine Formelauswertung (Kopie aus shared/)
│     ├─ ods-parser.js       OpenDocument (.ods), Wiederholungen begrenzt (Kopie aus shared/)
│     ├─ dataset.js          zentraler Datenzustand (Trainings- und Testdaten), Eingabeprüfung, Änderungsereignisse
│     ├─ data-import.js      Upload-Prüfung und Umwandlung in Datenpunkte
│     ├─ knn.js              kNN, Abstimmung, Leave One Out, Regression
│     ├─ chart.js            SVG-Diagramme (gleiche Skalierung, 1er-Gitter)
│     ├─ pages/*.js          die neun Seiten (+ gemeinsame Bausteine)
│     ├─ progress.js         Speichern/Wiederherstellen der Eintragungen (Seiten 4 und 5) in Moodle
│     └─ app.js              Navigation, Verteilung der Änderungen, SCORM-Abschluss
├─ testdata/                 Dateien für den Unterricht (Klassifikation: szenario_*.csv, szenario_*_test.csv; Regression: regression_*.csv)
├─ preview/                  Vorschau
└─ README.md                 diese Datei
```

Der Ordner `src/` enthält ausschließlich Paketdateien – genau die Dateien, die im SCORM-ZIP landen. Das fertige Paket entsteht als `dist/neighbors.zip` im Stamm des Repositorys; der Ordner `dist/` wird nicht versioniert.

## Paket erstellen und in Moodle einbinden

Das SCORM-Paket ist ein ZIP-Archiv mit dem **Inhalt** des Ordners `src/`. `imsmanifest.xml` muss dabei direkt in der obersten Ebene des ZIP liegen, nicht in einem Unterordner `src/`.

- **Windows:** Ordner `src` öffnen, alle Dateien und Ordner markieren, dann *Senden an → ZIP-komprimierter Ordner*. Die Datei `neighbors.zip` nennen und in den Ordner `dist/` im Stamm des Repositorys legen.
- **Andere Systeme:** im Ordner `src` z. B. `mkdir -p ../../dist && zip -r ../../dist/neighbors.zip .` ausführen.

So wird das Paket in Moodle eingebunden:
1. Kurs → *Aktivität oder Material anlegen* → **Lernpaket (SCORM)**.
2. `neighbors.zip` hochladen.
3. Bewertung: „Abschluss“ bzw. Status „completed“ wird bereits beim Öffnen des Lernpakets gemeldet. Ein bereits gemeldeter Abschluss (auch „passed“) bleibt unverändert.
4. Damit die Eintragungen der Seiten 4 und 5 in der nächsten Stunde wieder da sind, muss Moodle denselben Versuch fortsetzen: Einstellung **„Neuen Versuch erzwingen“ = „Nein“** (Standard). Sonst beginnt jeder Aufruf mit leerer Tabelle.

### Speicherung des Bearbeitungsstands

- Nach **jeder** Änderung wird der Bearbeitungsstand sofort in Moodle gespeichert (`cmi.suspend_data`, mit `LMSCommit`): Trainingspunkt eingegeben oder gelöscht, Datei oder Beispieldaten geladen, Achsenbeschriftung geändert, Testdaten auf Seite 7 eingegeben, geladen oder gelöscht, Eintragung auf Seite 4 oder 5 („x“ setzen oder löschen), „zurücksetzen“, neue Validierungsauswahl. Wird der Browser unerwartet geschlossen, geht nichts verloren.
- Gespeichert werden die Trainingsdaten mit Achsenbeschriftung (auch von Hand eingegebene Punkte), die Testdaten, die Validierungsauswahl mit ihrem Anteil und die Kreuze beider Tabellen. SCORM 1.2 erlaubt 4.096 Zeichen; das reicht für die Beispieldaten, alle Szenarien und die Regressionsdateien. Ohne Daten wird nichts gespeichert.
- Beim nächsten Öffnen ist alles wieder da; die Fußzeile meldet „Der gespeicherte Bearbeitungsstand wurde wiederhergestellt“.
- Sind die Trainingsdaten zu groß, wird statt der Daten ein Prüfwert gespeichert. Die Fußzeile weist dann darauf hin, dass dieselbe Datei erneut geladen werden muss; danach werden Validierungsauswahl und Kreuze übernommen. Werden andere Daten geladen, bleibt der gespeicherte Stand erhalten, bis wieder etwas eingetragen wird. Passen auch die Testdaten nicht mehr, werden sie weggelassen; die Fußzeile weist darauf hin.
- Ohne Lernplattform (Offline-Modus) wird nichts gespeichert. Prüfmarkierungen (✓/✗) werden nicht gespeichert; „Eintragungen prüfen“ stellt sie wieder her.

## Sicherheits- und Datenschutzkonzept

**Keine Codeausführung über Eingaben oder Uploads**
- Inhalte werden nur als Text eingefügt (`textContent`/Textknoten). `innerHTML`, `eval`, `new Function` und `document.write` kommen nicht vor; das wird beim Bauen geprüft (siehe „Qualitätssicherung“).
- Event-Handler- und `style`-Attribute sowie `javascript:`-/`data:`-Adressen können über die DOM-Hilfsfunktionen gar nicht gesetzt werden.
- Labels werden über eine Zeichen-Whitelist geprüft, Zahlen über ein striktes Format. Alle Daten laufen durch den zentralen Datenzustand (`dataset.js`), der jeden Punkt selbst prüft – auch beim Ersetzen des ganzen Datensatzes.
- Angezeigte Texte aus Dateien (Achsenbeschriftung, Dateiname) werden von unsichtbaren Steuer-, Nullbreiten- und Richtungszeichen befreit (Schutz vor optischer Täuschung, z. B. per U+202E).
- In der x-Tabelle ist nur „x“ als Eingabe zulässig.
- Werden zwei Dateien schnell nacheinander gewählt, wird das Ergebnis des älteren Imports verworfen.

**Uploads**
- Erlaubt sind nur bestimmte Dateiendungen (Whitelist), höchstens 2 MB.
- Die Dateisignatur wird geprüft: XLSX/ODS müssen ZIP-Archive sein, CSV darf keine Binärdaten enthalten.
- Dateien werden nur gelesen, nie geöffnet, ausgeführt oder als HTML/SVG/Bild dargestellt.
- Formeln und Makros werden nicht ausgewertet.

**ZIP und XML**
- Gegen Zip-Bomben gibt es Grenzwerte: höchstens 1000 Einträge, 8 MB je Eintrag, 16 MB insgesamt und Kompressionsverhältnis 200 : 1.
- CRC-Prüfung; verschlüsselte Archive und ZIP64 werden abgelehnt.
- XML mit DOCTYPE/ENTITY wird abgelehnt (Schutz vor „Billion Laughs“).
- Höchstens 200.000 XML-Elemente je Archiveintrag; die Zählung erfolgt vor dem Parsen (Schutz vor Dateien mit Hunderttausenden leerer Zeilen).
- ODS-Wiederholungsangaben sind begrenzt.

**Content-Security-Policy**
- `default-src 'none'`: grundsätzlich ist alles verboten – Bilder, Schriften, Medien, Frames, Worker, Plugins und jede Netzwerkverbindung.
- Erlaubt sind nur Skripte und Stylesheets aus dem Paket selbst (`script-src 'self'`, `style-src 'self'`).
- `form-action 'none'`, `base-uri 'none'`.
- **Trusted Types** (`require-trusted-types-for 'script'`): In Chromium-Browsern (Chrome, Edge) blockiert der Browser zur Laufzeit jede Übergabe von Zeichenketten an HTML-Senken wie `innerHTML` – selbst wenn künftiger Code sie versehentlich verwendet. Einzige erlaubte Policy ist die private `lp-xml` in `xml-utils.js` für das Einlesen von XML; sie ist von außen nicht erreichbar und kann nicht ein zweites Mal angelegt werden.

**Was das Paket nicht beeinflussen kann**
- HTTP-Header (z. B. `X-Frame-Options`, `frame-ancestors`, HSTS) setzt der Moodle-Server. Die Inhalte des Pakets werden von Moodle unter der Moodle-Domain ausgeliefert; die strenge CSP und der Verzicht auf jede Codeausführung aus Daten verhindern, dass das Paket zu einer Lücke in Moodle wird.

**Keine externen Quellen**
- Kein CDN, keine Webfonts (Systemschriften), keine Bibliotheken von Drittanbietern.

**Datenschutz**
- An Moodle gehen nur `cmi.core.lesson_status` (`completed`), `cmi.core.exit` und in `cmi.suspend_data` der Bearbeitungsstand: Trainings- und Testdaten, Validierungsauswahl und Kreuze der Seiten 4 und 5 (siehe „Speicherung des Bearbeitungsstands“). Schreibzugriffe auf andere Datenelemente sind im Code gesperrt.
- Einstellungen der übrigen Seiten (z. B. k, Metrik, gewählter Punkt) und besuchte Seiten verlassen den Browser nicht.
- Der gespeicherte Stand wird beim Öffnen streng geprüft; ungültige Inhalte werden ignoriert.
- Der Name der Lernenden wird nicht gelesen.
- Kein `localStorage`, keine Cookies.
- **Hinweis:** Ohne Lernplattform sind die Daten nach dem Neuladen weg.

## Szenario-Dateien für den Unterricht

In `testdata/` liegen zu jedem Szenario zwei CSV-Dateien (Kopfzeile, Semikolon, Dezimalkomma; bei den Szenarien 1 bis 5 liegen die Werte zwischen 0 und 10):

- `szenario_N_….csv`: Trainingsdaten zum Hochladen auf der Seite „Training“.
- `szenario_N_…_test.csv`: 10 bis 12 Testdaten zum Hochladen auf der Seite „Test und Konfusionsmatrix“. Sie enthalten keine Punkte der Trainingsdatei. Einige liegen bewusst im Grenzbereich zwischen den Klassen, damit die Matrix auch Fehlklassifikationen zeigt; je nach k ändern sich die Ergebnisse.

| Trainingsdatei | Testdatei | Szenario | Labels |
|---|---|---|---|
| `szenario_1_schwertlilien.csv` | `szenario_1_schwertlilien_test.csv` | Iris-Blumen: Blütenblattlänge und -breite | Iris setosa, Iris versicolor, Iris virginica |
| `szenario_2_wetter.csv` | `szenario_2_wetter_test.csv` | Regenvorhersage: Bewölkung und Luftfeuchtigkeit | Regen, kein Regen |
| `szenario_3_spam.csv` | `szenario_3_spam_test.csv` | Spam-Filter: Links und Ausrufezeichen | Spam, kein Spam |
| `szenario_4_lernerfolg.csv` | `szenario_4_lernerfolg_test.csv` | Prüfung: Lernzeit und Schlaf | bestanden, nicht bestanden |
| `szenario_5_musik.csv` | `szenario_5_musik_test.csv` | Musikgenres: Energie und Tanzbarkeit | Klassik, Rock, Hip-Hop, Pop |
| `szenario_6_ausreisser_raumsensoren.csv` | `szenario_6_ausreisser_raumsensoren_test.csv` | Raumsensoren: Temperatur und Luftfeuchtigkeit | Keller, Wohnzimmer, Dachboden |
| `szenario_7_ausreisser_ausdauersport.csv` | `szenario_7_ausreisser_ausdauersport_test.csv` | Ausdauersport: Trainingsumfang und Ruhepuls | Anfaenger, Freizeit, Leistung |
| `szenario_8_ausreisser_haustiere.csv` | `szenario_8_ausreisser_haustiere_test.csv` | Haustiere: Körperlänge und Gewicht | Kaninchen, Katze, Hund |
| `szenario_9_unausgewogen_kartenzahlungen.csv` | `szenario_9_unausgewogen_kartenzahlungen_test.csv` | Kartenzahlungen: Betrag und Uhrzeit | normal (40), Betrug (4) |
| `szenario_10_unausgewogen_atemwegserkrankung.csv` | `szenario_10_unausgewogen_atemwegserkrankung_test.csv` | Atemwegserkrankung: Sauerstoffsättigung und Atemfrequenz | gesund (42), krank (5) |
| `szenario_11_unausgewogen_qualitaetskontrolle.csv` | `szenario_11_unausgewogen_qualitaetskontrolle_test.csv` | Qualitätskontrolle: Durchmesser und Gewicht | in Ordnung (40), zu klein (4), zu gross (3) |
| `szenario_12_normalisierung_bildschirmzeit.csv` | `szenario_12_normalisierung_bildschirmzeit_test.csv` | Befinden: Bildschirmzeit (Minuten, 45 bis 595) und Schlaf (Stunden, 5 bis 10) | ausgeruht, müde |

**Szenarien mit Ausreißern (6 bis 8):** Je Klasse liegt mindestens ein Punkt weit außerhalb seiner Gruppe (z. B. eine sehr schwere Katze, ein Zwerghund, ein Sensor im Heizungsraum). Die Testdaten enthalten ebenfalls einen solchen Punkt. Damit lässt sich zeigen, wie Ausreißer die Nachbarn und die Wahl von k beeinflussen: Bei kleinem k stört ein Ausreißer das Ergebnis, bei größerem k wird er überstimmt.

**Szenarien mit unausgewogenen Klassen (9 bis 11):** Eine Klasse stellt über 90 % der Trainingsdaten, die seltenen Klassen haben nur 3 bis 5 Punkte. Die Testdaten enthalten bewusst mehr seltene Fälle. Damit lässt sich zeigen, dass eine hohe Genauigkeit täuschen kann: Wer immer die häufige Klasse vorhersagt, hat fast immer recht, erkennt aber den seltenen Fall nicht. Die Konfusionsmatrix macht das sichtbar.

**Szenario zur Normalisierung (12):** Die Bildschirmzeit liegt zwischen 45 und 595 Minuten, der Schlaf zwischen 5 und 10 Stunden. Das Befinden hängt vor allem vom Schlaf ab. Ohne Normalisierung bestimmt fast nur die Bildschirmzeit den Abstand: Leave One Out erreicht höchstens etwa 68 %. Mit Normalisierung (Seite 8) sind es etwa 98 %.

Die Daten sind frei erfunden, mit einer Ausnahme: `szenario_1_schwertlilien.csv` und `szenario_1_schwertlilien_test.csv` enthalten zwei getrennte Teilmengen des Iris-Datensatzes (Anderson 1935, Fisher 1936; UCI Machine Learning Repository, CC BY 4.0). Bei der Weitergabe dieser Dateien bitte die Quelle nennen und auf die Lizenz verweisen (Einzelheiten in `THIRD_PARTY_NOTICES.md`).

### Regressionsdateien (Seite 9)

Zu jedem Thema liegt in `testdata/` eine CSV-Datei (Kopfzeile, Semikolon, Dezimalkomma) zum Hochladen auf der Seite „Training“. Danach zeigt Seite 9 die Daten. x ist das Merkmal, y der Zielwert. Die dritte Spalte (Gruppe) wird vom Paket verlangt, spielt aber für die Regression keine Rolle; sie lässt sich auf den anderen Seiten nutzen.

| Datei | Thema | x | y | Verlauf |
|---|---|---|---|---|
| `regression_1_eisverkauf.csv` | Eisverkauf | Temperatur (°C) | verkaufte Eiskugeln pro Tag | ungefähr linear ab etwa 9 °C, am Wochenende höher |
| `regression_2_bremsweg.csv` | Bremsweg | Geschwindigkeit (km/h) | Anhalteweg (m) | quadratisch, bei Nässe länger |
| `regression_3_lernzeit.csv` | Lernzeit | Lernzeit pro Woche (h) | Punkte in der Klassenarbeit | steigt und sättigt sich |
| `regression_4_gebrauchtwagen.csv` | Gebrauchtwagen | Alter (Jahre) | Preis (1000 Euro) | fällt exponentiell, je nach Fahrzeugklasse verschieden hoch |
| `regression_5_stromverbrauch.csv` | Stromverbrauch | Uhrzeit (h) | Verbrauch eines Haushalts (kW) | zwei Spitzen (morgens, abends); eignet sich gut, um den Einfluss von k zu zeigen |
| `regression_6_taxifahrt.csv` | Taxifahrt | Fahrstrecke (km) | Fahrpreis (Euro) | nur 12 Punkte mit deutlichem Abstand: Nachbarn, Streifen und Rechenweg lassen sich gut nachvollziehen; zum Einstieg geeignet |

Die Daten sind frei erfunden (zufällig um einen vorgegebenen Verlauf gestreut bzw. bei der Taxifahrt von Hand gewählt) und stehen unter der MIT-Lizenz.

## Ausprobieren und Browser

`src/index.html` lässt sich auch ohne Lernplattform direkt im Browser öffnen. Die Anwendung läuft dann im Offline-Modus; die Fußzeile weist darauf hin.

**Unterstützte Browser:** aktuelle Versionen von Edge, Chrome, Firefox und Safari (ab ca. 2021).

## Qualitätssicherung

Vor jeder Veröffentlichung wird das Paket mit nicht veröffentlichten Entwicklungswerkzeugen gebaut und getestet. Sie verwenden Node.js sowie Playwright mit Chromium im Headless-Modus.

**Beim Bauen wird geprüft**, und das Paket wird nicht erstellt, wenn
- eine Datei in `src/` nicht im Manifest steht oder umgekehrt;
- `LICENSE.txt` von der `LICENSE` des Repositorys abweicht;
- die CSP fehlt oder gelockert ist (`unsafe-*`, Platzhalter, fremde Quellen, weitere Trusted-Types-Policies), Inline-Skripte, Inline-Stile oder Event-Handler vorkommen;
- gefährliche APIs (HTML-Senken, `eval`, Netzwerk-, Speicher- und Cookie-Zugriffe) oder externe Adressen vorkommen;
- unsichtbare Richtungs- oder Nullbreitenzeichen im Quelltext stehen (Schutz vor „Trojan Source“);
- eine Paketdatei kein UTF-8 ohne BOM mit LF-Zeilenenden ist (die Szenario-Dateien sind für Excel bewusst mit BOM gespeichert);
- eine Kopie des gemeinsamen Codes (`base.css`, `dom-utils.js`, `text-utils.js`, `tabs.js`, `scorm-api.js` sowie der Datei-Import `inflate.js`, `zip-reader.js`, `xml-utils.js`, `csv-parser.js`, `xlsx-parser.js`, `ods-parser.js`) von ihrer Quelle in `shared/` abweicht oder fehlt;
- im Ordner des Teilprojekts etwas anderes als `src/`, `preview/`, `testdata/` und `README.md` liegt.

**Automatisierte Tests** (84) im Browser, mit simulierter SCORM-Schnittstelle:
- Algorithmus mit Handrechnungen: Metriken, Gleichstände, gleiche Abstände, Leave One Out; schrittweise Auswertung für alle k im Abgleich mit der Einzelklassifizierung; Normalisierung (Min-Max, Z-Standardisierung mit Division durch n, konstante Achse); Regression (Mittelwert, gewichtet, |Δx| = 0, Kurve);
- Datenzustand: Zahlen- und Labelprüfung, stabile IDs, Grenzen, Validierungsauswahl, getrennte Testdaten;
- Parser, DEFLATE und ZIP-Grenzen; Import aller Szenario- und Regressionsdateien sowie von XLSX- und ODS-Dateien;
- präparierte Angriffsdateien (Skript-Einschleusung, Zip-Bombe, „Billion Laughs“, getarnte Dateitypen, übergroße Dateien);
- Klickpfade aller Seiten und seitenübergreifende Änderungen;
- SCORM-Meldungen; Speichern nach jeder Änderung (Eintragungen, von Hand eingegebene Trainings- und Testpunkte, geladene Dateien), Wiederherstellen (mit und ohne gespeicherte Daten), ungültige gespeicherte Stände, Größengrenze, Offline-Modus;
- Härtung: keine externen Anfragen, keine CSP-Verstöße, Trusted-Types-Sperre, URL-Attribute, unsichtbare Zeichen, Wettlauf beim Import.

## Lizenz

- **Projekt:** MIT-Lizenz. Der Lizenztext liegt als `src/LICENSE.txt` im Paket und ist identisch mit der `LICENSE` im Stamm des Repositorys.
- **`src/js/inflate.js`:** enthält zusätzlich eine veränderte Übertragung von `puff.c` (Mark Adler) unter der zlib-Lizenz. Der Lizenzhinweis steht im Dateikopf.
- **Weitere Hinweise:** Datenquellen und Marken (Moodle™, SCORM® u. a.) stehen in `THIRD_PARTY_NOTICES.md` im Stamm des Repositorys.
