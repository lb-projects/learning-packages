# Gemeinsamer Code beider Lernpakete

Dieser Ordner enthält den Quelltext, den **kNN Algorithm** und **SQL Sandbox** gemeinsam nutzen. Er ist die **einzige Stelle**, an der dieser Code bearbeitet wird.

| Datei | Inhalt |
|---|---|
| `js/scorm-api.js` | SCORM-1.2-Wrapper: Suche der LMS-Schnittstelle, Schreib-Whitelist, Offline-Modus, `cmi.suspend_data` nur nach ausdrücklicher Freigabe |
| `js/dom-utils.js` | sichere DOM-Erzeugung (`el`, `svg`, `clear`, `byId`, …): alles, was kein DOM-Knoten ist, wird nur als Text eingefügt; Event-Handler-, `style`- und `srcdoc`-Attribute sowie gefährliche Adressen sind gesperrt |
| `js/text-utils.js` | Entfernen bzw. sichtbares Ersetzen unsichtbarer Steuer- und Richtungszeichen vor der Anzeige |
| `js/tabs.js` | Seitennavigation über Registerkarten (Maus, Tastatur, „Zurück/Weiter“) |
| `css/base.css` | gemeinsame Grundgestaltung: Grundfarben, Kopf und Tabs, Schaltflächen, Meldungen, Seitennavigation, Fußzeile |

## So werden die Dateien verwendet

Jedes SCORM-Paket muss alle Dateien selbst enthalten. Deshalb liegen in `kNN Algorithm/src/` und `SQL Sandbox/src/` **Kopien** dieser Dateien. Jede Kopie trägt in der ersten Zeile den Hinweis „Kopie aus shared/… – nicht hier bearbeiten“. So bleibt `src/` vollständig: `index.html` lässt sich direkt im Browser öffnen, und das ZIP lässt sich weiterhin von Hand erstellen.

Ablauf bei Änderungen:
1. Die Datei **hier** in `shared/` ändern.
2. Mit den Entwicklungswerkzeugen `node sync-shared.mjs` ausführen. Das Skript schreibt die Kopien in beide Pakete und kopiert außerdem `LICENSE` als `src/LICENSE.txt`.
3. Beide Pakete testen und bauen. Der Build bricht ab, wenn eine Kopie von `shared/` abweicht oder fehlt.

## Namensraum

Die JavaScript-Dateien enden mit `})(window.LP = window.LP || {});`. In der Kopie wird diese Zeile durch den Namensraum des Pakets ersetzt (`window.KNN` bzw. `window.SQLSIM`). Sonst sind die Kopien zeichengleich.

`dom-utils.js` stellt nur die gemeinsamen Funktionen bereit. Die paketeigenen Formatierer ergänzt jeweils `src/js/format-utils.js` unter demselben Objekt `dom`:
- kNN: `formatNumber`, `formatPercent`, `describePoint`
- SQL: `formatCount`, `plural`

## Was hier nicht hingehört

Paketspezifisches bleibt im jeweiligen Paket, zum Beispiel:
- die Seiten
- SCORM-Start und -Ende (nur das kNN-Paket speichert einen Bearbeitungsstand)
- Parser, ZIP-Leser und SQL-Engine
- paketeigene Farben und Regeln in `css/style.css`

`index.html` ist ebenfalls je Paket eigen; die strenge Content-Security-Policy prüft der Build.
