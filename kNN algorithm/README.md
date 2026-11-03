# kNN-Simulator – SCORM-1.2-Lernpaket

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

Zwischen den Seiten kann jederzeit gewechselt werden. Änderungen der Trainingsdaten wirken sofort auf alle Seiten:

- Eintragungen bleiben für alle noch vorhandenen Punkte erhalten.
- Prüfmarkierungen werden zurückgesetzt, weil sich die Ergebnisse geändert haben können. Ein Hinweis weist darauf hin.

**Testdaten (Seite 7)** werden getrennt von den Trainingsdaten gespeichert:

- Sie fließen nie als Nachbarn in eine Klassifizierung ein.
- Änderungen der Testdaten wirken sich nicht auf die Seiten 1–6 aus. Änderungen der Trainingsdaten lassen die Testdaten unverändert; die Matrix wird neu berechnet.
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
- **Seite 3:** Der betrachtete Punkt wird bei seiner eigenen Klassifizierung ausgeschlossen.
- **Seite 4:** Es bleiben immer mindestens ein Validierungs- und ein Trainingspunkt; die Anzahl ist der gerundete Anteil.
- **Seite 7:** Nachbarn sind alle Trainingspunkte (auch die auf Seite 4 als Validierungsdaten markierten).

## Aufbau

```
kNN algorithm/
├─ src/                      NUR die Dateien des SCORM-Pakets (1:1 im ZIP)
│  ├─ imsmanifest.xml        SCORM-1.2-Manifest (ein SCO, alle Dateien gelistet)
│  ├─ index.html             Gerüst der sieben Seiten, Content-Security-Policy
│  ├─ LICENSE.txt            MIT-Lizenz (wird mit ausgeliefert)
│  ├─ css/style.css          Gestaltung (Systemschriften, farbenblindfreundliche Palette)
│  └─ js/
│     ├─ dom-utils.js        sichere DOM-Erzeugung (nur Textknoten, keine Event-/style-Attribute)
│     ├─ scorm-api.js        SCORM-1.2-Wrapper (Schreib-Whitelist, Offline-Modus)
│     ├─ inflate.js          eigener DEFLATE-Dekoder (RFC 1951) + CRC-32
│     ├─ zip-reader.js       ZIP-Leser mit Grenzwerten gegen Zip-Bomben
│     ├─ xml-utils.js        XML-Parsing ohne DOCTYPE/ENTITY
│     ├─ csv-parser.js       CSV nach RFC 4180
│     ├─ xlsx-parser.js      Excel (.xlsx), erstes Blatt, keine Formelauswertung
│     ├─ ods-parser.js       OpenDocument (.ods), Wiederholungen begrenzt
│     ├─ dataset.js          zentraler Datenzustand (Trainings- und Testdaten), Eingabeprüfung, Änderungsereignisse
│     ├─ data-import.js      Upload-Prüfung und Umwandlung in Datenpunkte
│     ├─ knn.js              kNN, Abstimmung, Leave One Out
│     ├─ chart.js            SVG-Diagramme (gleiche Skalierung, 1er-Gitter)
│     ├─ pages/*.js          die sieben Seiten (+ gemeinsame Bausteine)
│     └─ app.js              Navigation, Verteilung der Änderungen, SCORM-Abschluss
├─ testdata/                 Szenario-Dateien für den Unterricht (Training: szenario_*.csv, Test: szenario_*_test.csv)
├─ preview/                  Vorschau
└─ README.md                 diese Datei
```

Der Ordner `src/` enthält ausschließlich Paketdateien – genau die Dateien, die im SCORM-ZIP landen. Das fertige Paket entsteht als `dist/knn-algorithmus.zip` im Stamm des Repositorys; der Ordner `dist/` wird nicht versioniert.

## Paket erstellen und in Moodle einbinden

Das SCORM-Paket ist ein ZIP-Archiv mit dem **Inhalt** des Ordners `src/`. `imsmanifest.xml` muss dabei direkt in der obersten Ebene des ZIP liegen, nicht in einem Unterordner `src/`.

- **Windows:** Ordner `src` öffnen, alle Dateien und Ordner markieren, dann *Senden an → ZIP-komprimierter Ordner*. Die Datei `knn-algorithmus.zip` nennen und in den Ordner `dist/` im Stamm des Repositorys legen.
- **Andere Systeme:** im Ordner `src` z. B. `mkdir -p ../../dist && zip -r ../../dist/knn-algorithmus.zip .` ausführen.

So wird das Paket in Moodle eingebunden:
1. Kurs → *Aktivität oder Material anlegen* → **Lernpaket (SCORM)**.
2. `knn-algorithmus.zip` hochladen.
3. Bewertung: „Abschluss“ bzw. Status „completed“ wird bereits beim Öffnen des Lernpakets gemeldet. Ein bereits gemeldeter Abschluss (auch „passed“) bleibt unverändert.

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
- **Trusted Types** (`require-trusted-types-for 'script'`): In Chromium-Browsern (Chrome, Edge) blockiert der Browser zur Laufzeit jede Übergabe von Zeichenketten an HTML-Senken wie `innerHTML` – selbst wenn künftiger Code sie versehentlich verwendet. Einzige erlaubte Policy ist die private `knn-xml` in `xml-utils.js` für das Einlesen von XML; sie ist von außen nicht erreichbar und kann nicht ein zweites Mal angelegt werden.

**Was das Paket nicht beeinflussen kann**
- HTTP-Header (z. B. `X-Frame-Options`, `frame-ancestors`, HSTS) setzt der Moodle-Server. Die Inhalte des Pakets werden von Moodle unter der Moodle-Domain ausgeliefert; die strenge CSP und der Verzicht auf jede Codeausführung aus Daten verhindern, dass das Paket zu einer Lücke in Moodle wird.

**Keine externen Quellen**
- Kein CDN, keine Webfonts (Systemschriften), keine Bibliotheken von Drittanbietern.

**Datenschutz**
- Trainings-, Testdaten und Eintragungen verlassen den Browser nicht.
- An Moodle gehen nur `cmi.core.lesson_status` (`completed`) und `cmi.core.exit`. Besuchte Seiten werden nicht erfasst; Schreibzugriffe auf andere Datenelemente (auch `cmi.suspend_data`) sind im Code gesperrt.
- Der Name der Lernenden wird nicht gelesen.
- Kein `localStorage`, keine Cookies.
- **Hinweis:** Nach dem Neuladen sind die Daten weg – das ist bewusst so (Datensparsamkeit).

## Szenario-Dateien für den Unterricht

In `testdata/` liegen zu jedem Szenario zwei CSV-Dateien (Werte zwischen 0 und 10, Kopfzeile, Semikolon, Dezimalkomma):

- `szenario_N_….csv`: Trainingsdaten zum Hochladen auf der Seite „Training“.
- `szenario_N_…_test.csv`: 10 bis 12 Testdaten zum Hochladen auf der Seite „Test und Konfusionsmatrix“. Sie enthalten keine Punkte der Trainingsdatei. Einige liegen bewusst im Grenzbereich zwischen den Klassen, damit die Matrix auch Fehlklassifikationen zeigt; je nach k ändern sich die Ergebnisse.

| Trainingsdatei | Testdatei | Szenario | Labels |
|---|---|---|---|
| `szenario_1_schwertlilien.csv` | `szenario_1_schwertlilien_test.csv` | Iris-Blumen: Blütenblattlänge und -breite | Iris setosa, Iris versicolor, Iris virginica |
| `szenario_2_wetter.csv` | `szenario_2_wetter_test.csv` | Regenvorhersage: Bewölkung und Luftfeuchtigkeit | Regen, kein Regen |
| `szenario_3_spam.csv` | `szenario_3_spam_test.csv` | Spam-Filter: Links und Ausrufezeichen | Spam, kein Spam |
| `szenario_4_lernerfolg.csv` | `szenario_4_lernerfolg_test.csv` | Prüfung: Lernzeit und Schlaf | bestanden, nicht bestanden |
| `szenario_5_musik.csv` | `szenario_5_musik_test.csv` | Musikgenres: Energie und Tanzbarkeit | Klassik, Rock, Hip-Hop, Pop |

Die Daten sind frei erfunden, mit einer Ausnahme: `szenario_1_schwertlilien.csv` und `szenario_1_schwertlilien_test.csv` enthalten zwei getrennte Teilmengen des Iris-Datensatzes (Anderson 1935, Fisher 1936; UCI Machine Learning Repository, CC BY 4.0). Bei der Weitergabe dieser Dateien bitte die Quelle nennen und auf die Lizenz verweisen (Einzelheiten in `THIRD_PARTY_NOTICES.md`).

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
- der SCORM-Wrapper von der Fassung des SQL-Pakets abweicht (abgesehen von Namensraum und Kommentaren);
- im Ordner des Teilprojekts etwas anderes als `src/`, `preview/`, `testdata/` und `README.md` liegt.

**Automatisierte Tests** (60) im Browser, mit simulierter SCORM-Schnittstelle:
- Algorithmus mit Handrechnungen: Metriken, Gleichstände, gleiche Abstände, Leave One Out; schrittweise Auswertung für alle k im Abgleich mit der Einzelklassifizierung;
- Datenzustand: Zahlen- und Labelprüfung, stabile IDs, Grenzen, Validierungsauswahl, getrennte Testdaten;
- Parser, DEFLATE und ZIP-Grenzen; Import aller Szenario-Dateien sowie von XLSX- und ODS-Dateien;
- präparierte Angriffsdateien (Skript-Einschleusung, Zip-Bombe, „Billion Laughs“, getarnte Dateitypen, übergroße Dateien);
- Klickpfade aller Seiten und seitenübergreifende Änderungen;
- SCORM-Meldungen;
- Härtung: keine externen Anfragen, keine CSP-Verstöße, Trusted-Types-Sperre, URL-Attribute, unsichtbare Zeichen, Wettlauf beim Import.

## Lizenz

- **Projekt:** MIT-Lizenz. Der Lizenztext liegt als `src/LICENSE.txt` im Paket und ist identisch mit der `LICENSE` im Stamm des Repositorys.
- **`src/js/inflate.js`:** enthält zusätzlich eine veränderte Übertragung von `puff.c` (Mark Adler) unter der zlib-Lizenz. Der Lizenzhinweis steht im Dateikopf.
- **Weitere Hinweise:** Datenquellen und Marken (Moodle™, SCORM® u. a.) stehen in `THIRD_PARTY_NOTICES.md` im Stamm des Repositorys.
