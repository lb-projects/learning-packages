# learning-packages

SCORM-1.2-Lernpakete für Lernplattformen.

| Paket | Inhalt |
|---|---|
| [kNN Algorithm](kNN%20Algorithm/README.md) | **kNN Algorithmus:** Interaktiver Simulator zum Verfahren k nächste Nachbarn (kNN): Klassifikation, Normalisierung und Regression |
| [SQL Sandbox](SQL%20Sandbox/README.md) | **SQL Sandbox:** SQL-Abfragen im Browser: Beispieldatenbanken oder eigene SQL-Dateien laden, Tabellen ansehen, SELECT (auch mit WITH, UNION, CASE und Fensterfunktionen), INSERT/UPDATE/DELETE und CREATE VIEW ausführen, Abfragen Schritt für Schritt nachvollziehen, Schema als UML-Klassendiagramm ansehen, Normalformen und Anomalien prüfen |

## Gemeinsamer Code (`shared/`)

Quelltext, den beide Pakete nutzen, steht nur einmal in [`shared/`](shared/README.md): SCORM-Wrapper, sichere DOM-Erzeugung, Textbereinigung, Tab-Navigation und die Grundgestaltung (`base.css`). In den Paketen liegen geprüfte Kopien, damit jedes SCORM-Paket vollständig bleibt.
- Änderungen werden nur in `shared/` gemacht und dann mit `sync-shared.mjs` (Entwicklungswerkzeuge) in beide Pakete übernommen.
- Der Build bricht ab, wenn eine Kopie abweicht.

## Pakete erstellen

Die fertigen SCORM-Pakete entstehen lokal als `dist/sql-sandbox.zip` und `dist/knn-algorithmus.zip` im Stamm des Repositorys. Der Ordner `dist/` wird nicht versioniert.

## Lizenz

- Der Quelltext steht unter der [MIT-Lizenz](LICENSE).
- Eine Datei des kNN-Pakets enthält zusätzlich Code unter der zlib-Lizenz.
- Zwei Datendateien des kNN-Pakets (Szenario Schwertlilien, Training und Test) enthalten Daten unter CC BY 4.0.
- Die SQL Sandbox enthält keinen Code und keine Daten von Dritten.

Die Einzelheiten sowie Hinweise zu Marken stehen in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
