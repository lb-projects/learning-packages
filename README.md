# learning-packages

SCORM-1.2-Lernpakete für Lernplattformen.

| Paket | Inhalt |
|---|---|
| [NEIGHBORS](NEIGHBORS/README.md) | **NEIGHBORS** (New Examples Inherit Group Habits By Observing Relevant Samples): Interaktiver Simulator zum Verfahren k nächste Nachbarn (kNN): Klassifikation, Normalisierung und Regression |
| [GRAIL](GRAIL/README.md) | **GRAIL** (GRaph Algorithm Interactive Lab): Graphen per Datei (Kantenliste oder Adjazenzmatrix) oder Eingabemaske erfassen und zeichnen, als Adjazenzmatrix und Adjazenzlisten darstellen; Breitensuche, Tiefensuche und Dijkstra Schritt für Schritt oder automatisch abspielen, mit Spannbaum, Ziel und Vergleich mit Bellman-Ford bei negativen Gewichten |
| [QUEST](QUEST/README.md) | **QUEST** (Querying Understood Easily, Step Through): SQL-Abfragen im Browser: Beispieldatenbanken oder eigene SQL-Dateien laden, Tabellen ansehen, SELECT (auch mit WITH, UNION, CASE und Fensterfunktionen), INSERT/UPDATE/DELETE und CREATE VIEW ausführen, Abfragen Schritt für Schritt nachvollziehen, Schema als UML-Klassendiagramm ansehen, Normalformen und Anomalien prüfen |

## Gemeinsamer Code (`shared/`)

Quelltext, den mehrere Pakete nutzen, steht nur einmal in [`shared/`](shared/README.md): SCORM-Wrapper, sichere DOM-Erzeugung, Textbereinigung, Tab-Navigation und die Grundgestaltung (`base.css`) für alle Pakete, dazu der Datei-Import (CSV, XLSX, ODS) für NEIGHBORS und GRAIL. In den Paketen liegen geprüfte Kopien, damit jedes SCORM-Paket vollständig bleibt.
- Änderungen werden nur in `shared/` gemacht und dann mit `sync-shared.mjs` (Entwicklungswerkzeuge) in die Pakete übernommen.
- Der Build bricht ab, wenn eine Kopie abweicht.

## Pakete erstellen

Die fertigen SCORM-Pakete entstehen lokal als `dist/quest.zip`, `dist/neighbors.zip` und `dist/grail.zip` im Stamm des Repositorys. Der Ordner `dist/` wird nicht versioniert.

## Lizenz

- Der Quelltext steht unter der [MIT-Lizenz](LICENSE).
- Eine Datei des gemeinsamen Datei-Imports (`inflate.js`, in NEIGHBORS und GRAIL) enthält zusätzlich Code unter der zlib-Lizenz.
- Zwei Datendateien von NEIGHBORS (Szenario Schwertlilien, Training und Test) enthalten Daten unter CC BY 4.0.
- QUEST enthält keinen Code und keine Daten von Dritten.
- GRAIL enthält außer dem gemeinsamen Datei-Import keinen Code und keine Daten von Dritten.

Die Einzelheiten sowie Hinweise zu Marken stehen in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
