# learning-packages

SCORM-1.2-Lernpakete für Lernplattformen wie Moodle. Das Repository enthält zwei voneinander unabhängige Pakete. Die Abschnitte unten sind gekennzeichnet:

- **Allgemein:** gilt für beide Pakete.
- **kNN algorithm:** gilt nur für das kNN-Paket.
- **SQL Sandbox:** gilt nur für das SQL-Paket.

Jedes Paket hat eine eigene, ausführliche README.

| Paket | Ordner | Inhalt |
|---|---|---|
| **kNN Algorithmus** | [kNN algorithm](kNN%20algorithm/README.md) | Interaktiver Simulator zum Klassifikationsverfahren k nächste Nachbarn (kNN) |
| **SQL Sandbox** | [SQL Sandbox](SQL%20Sandbox/README.md) | SQL-Abfragen im Browser: Beispieldatenbanken oder eigene SQL-Dateien laden, Tabellen ansehen, SELECT (auch mit WITH, UNION, CASE und Fensterfunktionen), INSERT/UPDATE/DELETE und CREATE VIEW ausführen, Schema als UML-Klassendiagramm ansehen |

## Allgemein (beide Pakete)

**Aufbau und Pakete**
- Jedes Paket liegt in einem eigenen Ordner mit `src/` (genau die Dateien des SCORM-Pakets), `testdata/`, `preview/` und `README.md`.
- Die fertigen SCORM-Pakete entstehen lokal als `dist/knn-algorithmus.zip` und `dist/sql-sandbox.zip` im Stamm des Repositorys. Der Ordner `dist/` wird nicht versioniert.
- Die Entwicklungswerkzeuge (Build, Prüfungen, Tests) liegen außerhalb des Repositorys und sind nicht veröffentlicht.

**Technik und Datenschutz**
- Die Pakete laufen vollständig im Browser, ohne Server, ohne externe Ressourcen und ohne Bibliotheken von Dritten.
- Eingaben und Daten verlassen den Browser nicht. Es werden weder `localStorage` noch Cookies verwendet.
- An die Lernplattform gehen nur `cmi.core.lesson_status` (`completed`) und `cmi.core.exit`. Der Abschluss wird bereits beim Öffnen des Pakets gemeldet. Besuchte Seiten werden nicht erfasst, und der Name der Lernenden wird nicht gelesen.
- Eine strenge Content-Security-Policy (`default-src 'none'`) und Trusted Types verhindern Codeausführung aus Eingaben und Dateien.
- Unterstützt werden aktuelle Versionen von Edge, Chrome, Firefox und Safari.

**Lizenz**
- Der Quelltext steht unter der [MIT-Lizenz](LICENSE). Die Lizenz liegt auch in jedem Paket als `src/LICENSE.txt`.
- Alle Beispieldaten sind frei erfunden und stehen unter der MIT-Lizenz, mit Ausnahme der unten genannten Iris-Daten im kNN-Paket.
- Einzelheiten und Hinweise zu Marken stehen in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## kNN algorithm

Ordner: [kNN algorithm](kNN%20algorithm/README.md), Paket: `dist/knn-algorithmus.zip`.

- **Inhalt:** sieben Seiten von Training und Klassifizierung über die Wahl von k und Leave One Out bis zu Test und Konfusionsmatrix.
- **Daten:** Eingabe von Hand, Upload von `.csv`, `.xlsx` und `.ods`, eingebaute Beispieldaten (Früchte) und fünf Szenarien in `testdata/` (jeweils Trainings- und Testdaten).
- **Lizenz:**
  - Eine Datei (`src/js/inflate.js`) enthält zusätzlich Code unter der zlib-Lizenz.
  - Zwei Datendateien (Szenario Schwertlilien, Training und Test) enthalten Daten unter CC BY 4.0.

## SQL Sandbox

Ordner: [SQL Sandbox](SQL%20Sandbox/README.md), Paket: `dist/sql-sandbox.zip`.

- **Inhalt:** vier Seiten (Datenbank laden, Tabellen, SQL-Befehle, Klassendiagramm).
- **Daten:** vier eingebaute Beispieldatenbanken, dazu Dateien in `testdata/` (auch ein Export im phpMyAdmin-Stil und eine fehlerhafte Übungsdatei).
- **Technik:** Die SQL-Engine (Lexer, Parser, Ausführung) ist eigener Code, ohne SQLite/sql.js oder andere Datenbank-Bibliothek.
- **Lizenz:** enthält keinen Code und keine Daten von Dritten.
