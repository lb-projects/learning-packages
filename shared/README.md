# Gemeinsamer Code der Lernpakete

Dieser Ordner enthält den Quelltext, den die Lernpakete **NEIGHBORS**, **QUEST** und **GRAIL** gemeinsam nutzen. Er ist die **einzige Stelle**, an der dieser Code bearbeitet wird.

| Datei | Inhalt |
|---|---|
| `js/scorm-api.js` | SCORM-1.2-Wrapper: Suche der LMS-Schnittstelle, Schreib-Whitelist, Offline-Modus, `cmi.suspend_data` nur nach ausdrücklicher Freigabe |
| `js/dom-utils.js` | sichere DOM-Erzeugung (`el`, `svg`, `clear`, `byId`, …): alles, was kein DOM-Knoten ist, wird nur als Text eingefügt; Event-Handler-, `style`- und `srcdoc`-Attribute sowie gefährliche Adressen sind gesperrt |
| `js/text-utils.js` | Entfernen bzw. sichtbares Ersetzen unsichtbarer Steuer- und Richtungszeichen vor der Anzeige |
| `js/tabs.js` | Seitennavigation über Registerkarten (Maus, Tastatur, „Zurück/Weiter“) |
| `css/base.css` | gemeinsame Grundgestaltung: Grundfarben, Kopf und Tabs, Schaltflächen, Meldungen, Seitennavigation, Fußzeile; Inhaltsbreite höchstens 1400 px, für Seiten mit `class="page page-wide"` bis 2400 px (solange die Seite sichtbar ist, per `:has()`) |

Datei-Import (nur **NEIGHBORS** und **GRAIL**):

| Datei | Inhalt |
|---|---|
| `js/csv-parser.js` | CSV nach RFC 4180; Trennzeichen aus der ersten Zeile, die eines enthält; Anzahl der Felder je Zeile wählbar (Standard 20) |
| `js/xlsx-parser.js` | Excel (.xlsx), erstes Blatt, keine Formelauswertung; Anzahl der Spalten wählbar (Standard 3) |
| `js/ods-parser.js` | OpenDocument (.ods), Wiederholungen begrenzt; Anzahl der Spalten wählbar (Standard 3) |
| `js/zip-reader.js` | ZIP-Leser mit Grenzwerten gegen Zip-Bomben |
| `js/inflate.js` | DEFLATE-Dekoder (RFC 1951) + CRC-32; enthält Code unter der zlib-Lizenz (siehe THIRD_PARTY_NOTICES.md) |
| `js/xml-utils.js` | XML ohne DOCTYPE/ENTITY, begrenzte Elementzahl; einzige Trusted-Types-Policy `lp-xml` (die CSP der Pakete erlaubt genau diesen Namen) |

## So werden die Dateien verwendet

Jedes SCORM-Paket muss alle Dateien selbst enthalten. Deshalb liegen in `NEIGHBORS/src/`, `QUEST/src/` und `GRAIL/src/` **Kopien** dieser Dateien (welche Dateien ein Paket erhält, legt `sync-shared.mjs` fest). Jede Kopie trägt in der ersten Zeile den Hinweis „Kopie aus shared/… – nicht hier bearbeiten“. So bleibt `src/` vollständig: `index.html` lässt sich direkt im Browser öffnen, und das ZIP lässt sich weiterhin von Hand erstellen.

Ablauf bei Änderungen:
1. Die Datei **hier** in `shared/` ändern.
2. Mit den Entwicklungswerkzeugen `node sync-shared.mjs` ausführen. Das Skript schreibt die Kopien in die Pakete und kopiert außerdem `LICENSE` als `src/LICENSE.txt`.
3. Die betroffenen Pakete testen und bauen. Der Build bricht ab, wenn eine Kopie von `shared/` abweicht oder fehlt.

## Namensraum

Die JavaScript-Dateien enden mit `})(window.LP = window.LP || {});`. In der Kopie wird diese Zeile durch den Namensraum des Pakets ersetzt (`window.KNN`, `window.SQLSIM` bzw. `window.HG`). Sonst sind die Kopien zeichengleich.

`dom-utils.js` stellt nur die gemeinsamen Funktionen bereit. Die paketeigenen Formatierer ergänzt jeweils `src/js/format-utils.js` unter demselben Objekt `dom`:
- kNN: `formatNumber`, `formatPercent`, `describePoint`
- SQL: `formatCount`, `plural`
- GRAIL: `formatInt`, `formatDistance`, `formatTriple`, `plural`, `joinNames`

## Was hier nicht hingehört

Paketspezifisches bleibt im jeweiligen Paket, zum Beispiel:
- die Seiten
- SCORM-Start und -Ende (NEIGHBORS und GRAIL speichern einen Bearbeitungsstand)
- die SQL-Engine und paketeigene Importlogik (`data-import.js`, `graph-import.js`)
- paketeigene Farben und Regeln in `css/style.css`

`index.html` ist ebenfalls je Paket eigen; die strenge Content-Security-Policy prüft der Build.
