# learning-packages

SCORM-1.2-Lernpakete für Lernplattformen.

| Paket | Inhalt |
|---|---|
| [EDGY EDGES](EDGY-EDGES/README.md) | **EDGY EDGES** (Explore Dynamic Graphs Yourself: Every Distance Gets Evaluated Stepwise): Graphen per Datei (Kantenliste oder Adjazenzmatrix) oder Eingabemaske erfassen und zeichnen, als Adjazenzmatrix und Adjazenzlisten darstellen; Breitensuche, Tiefensuche und Dijkstra Schritt für Schritt oder automatisch abspielen, mit Spannbaum, Ziel und Vergleich mit Bellman-Ford bei negativen Gewichten; Trainingsseite: Breiten- und Tiefensuche per Klick und die Dijkstra-Tabelle selbst ausführen, mit Prüfung, Hinweisen und Speicherung |
| [BUSY BIAS](BUSY-BIAS/README.md) | **BUSY BIAS** (Brain Under Simple Yardstick: Bias Influences Activation Start): Perzeptron-Simulator mit Schwellenwert und Heaviside-Funktion: Punkte aus CSV-Datei, Beispiel oder Eingabemaske; Training Schritt für Schritt, in Iterationen oder automatisch mit Gerade und Decision Areas; Protokoll jeder Rechnung; Lernkurve; eigene Punkte klassifizieren; Training von Hand rechnen mit Prüfung, Hinweisen, Hilfestufen und Zufallsaufgaben; Testdaten mit Konfusionsmatrix; Eingabedaten skalieren; mehrstufige Beispiele zeigen, wie neue Punkte das Training beeinflussen, auch bei verzerrten Trainingsdaten; Speicherung in der Lernplattform |
| [NOSY NEIGHBORS](NOSY-NEIGHBORS/README.md) | **NOSY NEIGHBORS** (Nearest Objects Sort You: New Examples Inherit Group Habits By Observing Relevant Samples): Interaktiver Simulator zum Verfahren k nächste Nachbarn (kNN): Klassifikation, Normalisierung und Regression |
| [SQL Sandbox](SQL-Sandbox/README.md) | **SQL Sandbox** (Simple And Nice Database Box for Online eXercises): SQL-Abfragen im Browser: Beispieldatenbanken oder eigene SQL-Dateien laden, Tabellen ansehen, SELECT (auch mit WITH, UNION, CASE und Fensterfunktionen), INSERT/UPDATE/DELETE und CREATE VIEW ausführen, Abfragen Schritt für Schritt nachvollziehen, Schema als UML-Klassendiagramm ansehen, Normalformen und Anomalien prüfen |

## Gemeinsamer Code (`shared/`)

Quelltext, den mehrere Pakete nutzen, steht nur einmal in [`shared/`](shared/README.md): SCORM-Wrapper, sichere DOM-Erzeugung, Textbereinigung, Tab-Navigation und die Grundgestaltung (`base.css`) für alle Pakete, dazu der Datei-Import (CSV, XLSX, ODS) für EDGY EDGES und NOSY NEIGHBORS und die Simulator-Bausteine für BUSY BIAS. In den Paketen liegen geprüfte Kopien, damit jedes SCORM-Paket vollständig bleibt.
- Änderungen werden nur in `shared/` gemacht und dann mit `sync-shared.mjs` (Entwicklungswerkzeuge) in die Pakete übernommen.
- Der Build bricht ab, wenn eine Kopie abweicht.

## Pakete erstellen

Die fertigen SCORM-Pakete entstehen lokal als `dist/busy-bias-<Version>.zip`, `dist/edgy-edges-<Version>.zip`, `dist/nosy-neighbors-<Version>.zip` und `dist/sql-sandbox-<Version>.zip` im Stamm des Repositorys. `<Version>` steht für die Version des aktuellen Release, zum Beispiel `v0.5.0`. Der Ordner `dist/` wird nicht versioniert.

## Lizenz

- Der Quelltext steht unter der [MIT-Lizenz](LICENSE).
- Eine Datei des gemeinsamen Datei-Imports (`inflate.js`, in EDGY EDGES und NOSY NEIGHBORS) enthält zusätzlich Code unter der zlib-Lizenz.
- EDGY EDGES enthält außer dem gemeinsamen Datei-Import keinen Code und keine Daten von Dritten.
- BUSY BIAS enthält keinen Code und keine Daten von Dritten.
- Zwei Datendateien von NOSY NEIGHBORS (Szenario Schwertlilien, Training und Test) enthalten Daten unter CC BY 4.0.
- Die SQL Sandbox enthält keinen Code und keine Daten von Dritten.

Die Einzelheiten sowie Hinweise zu Marken stehen in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
