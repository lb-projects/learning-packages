# Gemeinsamer Code der Lernpakete

Dieser Ordner enthält den Quelltext, den die Lernpakete **NOSY NEIGHBORS**, **SQL Sandbox**, **EDGY EDGES**, **BUSY BIAS** und **CLEVER CLUSTERS** gemeinsam nutzen. Er ist die **einzige Stelle**, an der dieser Code bearbeitet wird.

| Datei | Inhalt |
|---|---|
| `js/scorm-api.js` | SCORM-1.2-Wrapper: Suche der LMS-Schnittstelle, Schreib-Whitelist, Offline-Modus, `cmi.suspend_data` nur nach ausdrücklicher Freigabe |
| `js/dom-utils.js` | sichere DOM-Erzeugung (`el`, `svg`, `clear`, `byId`, …): alles, was kein DOM-Knoten ist, wird nur als Text eingefügt; Event-Handler-, `style`- und `srcdoc`-Attribute sowie gefährliche Adressen sind gesperrt |
| `js/text-utils.js` | Entfernen bzw. sichtbares Ersetzen unsichtbarer Steuer- und Richtungszeichen vor der Anzeige |
| `js/tabs.js` | Seitennavigation über Registerkarten (Maus, Tastatur, „Zurück/Weiter“) |
| `css/base.css` | gemeinsame Grundgestaltung: Grundfarben, Kopf und Tabs, Schaltflächen, Meldungen, Seitennavigation, Fußzeile; Inhaltsbreite höchstens 1400 px, für Seiten mit `class="page page-wide"` bis 2400 px (solange die Seite sichtbar ist, per `:has()`) |

Datei-Import (**NOSY NEIGHBORS** und **EDGY EDGES**; **BUSY BIAS** und **CLEVER CLUSTERS** nutzen nur `csv-parser.js`):

| Datei | Inhalt |
|---|---|
| `js/csv-parser.js` | CSV nach RFC 4180; Trennzeichen aus der ersten Zeile, die eines enthält; Anzahl der Felder je Zeile wählbar (Standard 20) |
| `js/xlsx-parser.js` | Excel (.xlsx), erstes Blatt, keine Formelauswertung; Anzahl der Spalten wählbar (Standard 3) |
| `js/ods-parser.js` | OpenDocument (.ods), Wiederholungen begrenzt; Anzahl der Spalten wählbar (Standard 3) |
| `js/zip-reader.js` | ZIP-Leser mit Grenzwerten gegen Zip-Bomben |
| `js/inflate.js` | DEFLATE-Dekoder (RFC 1951) + CRC-32; enthält Code unter der zlib-Lizenz (siehe THIRD_PARTY_NOTICES.md) |
| `js/xml-utils.js` | XML ohne DOCTYPE/ENTITY, begrenzte Elementzahl; einzige Trusted-Types-Policy `lp-xml` (die CSP der Pakete erlaubt genau diesen Namen) |

Simulator-Bausteine (**BUSY BIAS**; vorgesehen auch für den geplanten Simulator für neuronale Netze; **CLEVER CLUSTERS** nutzt `sim-format`, `point-data`, `point-import`, `coord-plot`, `training-controls` und `sim.css`). Sie kennen kein bestimmtes Modell; die Lernregel und die Texte bleiben im Paket:

| Datei | Inhalt | Schnittstelle |
|---|---|---|
| `js/sim-format.js` | Rundung für die Rechnung, deutsche Zahlenschreibweise | `simFormat.clean`, `num`, `factor`, `plural` |
| `js/activations.js` | Aktivierungsfunktionen als einheitliche Einträge | `{id, name, output(net), fires(y), symbol}`; bisher nur Heaviside |
| `js/point-data.js` | Datensatz: Punkte, Attributnamen, Labels, positives Label, Prüfungen, Änderungsmeldung | `pointData.create({maxLabels})`, `minMaxScaler(points)` (Min-Max auf 0 bis 1), `selectTestIndices(points, fraction)` (zufällig, je Label getrennt), `shuffled(list)`, `randomInt(max)` |
| `js/number-wheel.js` | Wert eines Zahlenfelds mit dem Mausrad ändern, nur im Feld mit Fokus | `numberWheel.attach(input, {min, max, step, fallback})`, `decadeStep` |
| `js/point-import.js` | CSV lesen und prüfen; Kopfzeile `Attribut x;Attribut y;Label` ist Pflicht | `pointImport.importFile`, `parseText`; `readTextFile` und `readBytes` für paketeigene Formate |
| `js/data-panel.js` | Upload, Ersetzen/Ergänzen, Beispielauswahl mit Stufen, Punktmaske und -tabelle, Stufenkarte | `dataPanel.create(container, {data, samples, idPrefix, formatHelp, formContainer, listContainer})`; Punktmaske und Tabelle können in eigenen Behältern stehen; `restoreSample(id, stage)` zum Wiederherstellen; Form der Beispiele im Dateikopf |
| `js/coord-plot.js` | Koordinatensystem mit Flächen, Linien und Punkten | `coordPlot.create(box, {ariaLabel, onClick})`, `render({view, xLabel, yLabel, xTicks, regions, lines, labels, points})`, `screenOf(x, y)`, `fitView(coords, {includeOrigin})`; Achsen mit Pfeilspitzen, sobald 0 im Ausschnitt liegt; Punkte auch als Stern, mit eigener Größe `r` und Text `text` |
| `js/net-view.js` | Zeichnung von Eingängen, Kanten, zweigeteilten Neuronen und Ausgängen | `netView.create`, `draw({inputs, neurons, edges, outputs})`; leere Texte entfallen (leerer Eingang = leerer Kreis), ein Schwellenwert kommt als Pfeil von unten |
| `js/training-controls.js` | Weiter, N Iterationen, Automatik mit Tempo, Zurücksetzen | steuert jedes Objekt mit `step()`, `runIterations(n)`, `isFinished()`, `reset()`, `isReady()`, `hasStarted()` |
| `js/protocol-view.js` | Scrollbares Protokoll, älteste Einträge oben; erzeugt nur neue Einträge | `protocolView.create`, `sync(list, toLines, notice)` |
| `js/classify-panel.js` | Maske für einen Prüfpunkt, Rechnung und Urteil | `classifyPanel.create(container, {id, classify, labels, attributes, onProbe})` |
| `js/confusion-matrix.js` | Konfusionsmatrix für beliebig viele Labels | `confusionMatrix.count(labels, results)`, `table(labels, m)` |
| `css/sim.css` | Gestaltung dieser Bausteine | Farben über CSS-Variablen (`--fire`, `--nofire`, …) |

### Simulator-Bausteine in einem neuen Paket verwenden

1. In `sync-shared.mjs` beim Paket `files: [...SHARED_FILES, 'js/csv-parser.js', ...SIM_FILES]` eintragen und das Skript ausführen.
2. In `index.html` und `imsmanifest.xml` die Dateien in dieser Reihenfolge einbinden: `dom-utils`, `sim-format`, `text-utils`, `tabs`, `scorm-api`, `csv-parser`, `activations`, `point-data`, `number-wheel`, `point-import`, `data-panel`, `coord-plot`, `net-view`, `training-controls`, `protocol-view`, `classify-panel`, `confusion-matrix`, danach die eigenen Module; `css/base.css`, `css/sim.css`, `css/style.css`.
3. Das Modell und die Texte im Paket umsetzen und `training-controls` ein passendes Objekt übergeben (Vorlage: `BUSY-BIAS/src/js/session.js`).

### Eine Aktivierungsfunktion ergänzen

In `js/activations.js` einen Eintrag nach dem Muster im Dateikopf ergänzen. `symbol` ist ein SVG-Pfad im Quadrat von −10 bis 10. `net-view.js` übernimmt Symbol und Namen aus dem Eintrag und zeigt Ausgaben als übergebenen Text, also auch nicht binäre Werte. Der Test „activations“ in BUSY BIAS, der nur Heaviside erwartet, ist dann anzupassen. BUSY BIAS selbst greift fest auf `activations.heaviside` zu und bietet keine Auswahl an.

## So werden die Dateien verwendet

Jedes SCORM-Paket muss alle Dateien selbst enthalten. Deshalb liegen in `NOSY-NEIGHBORS/src/`, `SQL-Sandbox/src/`, `EDGY-EDGES/src/`, `BUSY-BIAS/src/` und `CLEVER-CLUSTERS/src/` **Kopien** dieser Dateien (welche Dateien ein Paket erhält, legt `sync-shared.mjs` fest). Jede Kopie trägt in der ersten Zeile den Hinweis „Kopie aus shared/… – nicht hier bearbeiten“. So bleibt `src/` vollständig: `index.html` lässt sich direkt im Browser öffnen, und das ZIP lässt sich weiterhin von Hand erstellen.

Ablauf bei Änderungen:
1. Die Datei **hier** in `shared/` ändern.
2. Mit den Entwicklungswerkzeugen `node sync-shared.mjs` ausführen. Das Skript schreibt die Kopien in die Pakete und kopiert außerdem `LICENSE` als `src/LICENSE.txt`.
3. Die betroffenen Pakete testen und bauen. Der Build bricht ab, wenn eine Kopie von `shared/` abweicht oder fehlt.

## Namensraum

Die JavaScript-Dateien enden mit `})(window.LP = window.LP || {});`. In der Kopie wird diese Zeile durch den Namensraum des Pakets ersetzt (`window.KNN`, `window.SQLSIM`, `window.HG`, `window.BB` bzw. `window.CC`). Sonst sind die Kopien zeichengleich.

`dom-utils.js` stellt nur die gemeinsamen Funktionen bereit. Die paketeigenen Formatierer ergänzt jeweils `src/js/format-utils.js` unter demselben Objekt `dom`:
- kNN: `formatNumber`, `formatPercent`, `describePoint`
- SQL: `formatCount`, `plural`
- EDGY EDGES: `formatInt`, `formatDistance`, `formatTriple`, `plural`, `joinNames`

BUSY BIAS ergänzt `dom` nicht: Zahlen kommen aus `sim-format.js`, die Texte des Perzeptrons aus dem eigenen Objekt `fmt` in `src/js/format-utils.js`. CLEVER CLUSTERS ergänzt `dom` ebenfalls nicht.

## Was hier nicht hingehört

Paketspezifisches bleibt im jeweiligen Paket, zum Beispiel:
- die Seiten
- SCORM-Start und -Ende (NOSY NEIGHBORS und EDGY EDGES speichern einen Bearbeitungsstand)
- die SQL-Engine und paketeigene Importlogik (`data-import.js`, `graph-import.js`)
- paketeigene Farben und Regeln in `css/style.css`

`index.html` ist ebenfalls je Paket eigen; die strenge Content-Security-Policy prüft der Build.
