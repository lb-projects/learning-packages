# Hinweise zu Drittanteilen, Datenquellen und Marken

Der Quelltext dieses Repositorys steht unter der **MIT-Lizenz** (siehe [LICENSE](LICENSE)).
Davon abweichend oder ergänzend gilt Folgendes.

Das Repository enthält zwei Pakete. Die Hinweise sind danach gegliedert, für wen sie gelten:

- [Allgemein](#allgemein-beide-pakete): gilt für beide Pakete.
- [kNN algorithm](#knn-algorithm): gilt nur für das kNN-Paket (`kNN algorithm/`).
- [SQL Sandbox](#sql-sandbox): gilt nur für das SQL-Paket (`SQL Sandbox/`).

## Allgemein (beide Pakete)

### Code

Das Projekt enthält **keinen Code von Dritten**, keine Bibliotheken, keine Schriftarten und keine Bilder. Einzige Ausnahme ist eine Datei im kNN-Paket (siehe [kNN algorithm](#knn-algorithm)).

### Gestaltung

- **Farbpalette:** Die Klassenfarben basieren auf der farbenblindfreundlichen Palette von Masataka Okabe und Kei Ito, *Color Universal Design* (2008). Das kNN-Paket verwendet sie für die Labels, das SQL-Paket für die Farben der Oberfläche. Die Nennung ist eine Würdigung. Farbwerte als solche sind nicht urheberrechtlich geschützt.

### Standards

Das Projekt implementiert offene Formate und Schnittstellen mit eigenem Code. Weder Spezifikationstexte noch Schemadateien (XSD) sind enthalten.

| Bereich | Standard |
|---|---|
| SCORM-1.2-Laufzeitschnittstelle und IMS Content Packaging | Namensraum-URIs im Manifest sind nur Bezeichner |
| SVG | W3C Scalable Vector Graphics; die Namensraum-URI im Code ist nur ein Bezeichner, es wird nichts geladen |

### Marken

Die folgenden Namen werden nur beschreibend verwendet, um die Kompatibilität zu benennen:

- **Moodle™** ist eine Marke der Moodle Pty Ltd.
- **SCORM®** ist eine eingetragene Marke des U.S. Department of Defense (Advanced Distributed Learning Initiative).
- **Microsoft Windows und Edge** sind Marken der Microsoft Corporation.
- **Chrome** ist eine Marke von Google LLC, **Firefox** von der Mozilla Foundation, **Safari** von Apple Inc.
- **Microsoft Excel** ist eine Marke der Microsoft Corporation (kNN-Paket: Import von `.xlsx`).
- **LibreOffice** ist eine Marke der The Document Foundation (kNN-Paket: Import von `.ods`).
- **MySQL** ist eine eingetragene Marke der Oracle Corporation und/oder ihrer verbundenen Unternehmen (SQL-Paket).
- **MariaDB®** ist eine eingetragene Marke der MariaDB plc (SQL-Paket).
- **PostgreSQL** und **Postgres** sind Marken oder eingetragene Marken der PostgreSQL Community Association of Canada (SQL-Paket).
- **phpMyAdmin** ist ein Projekt der Software Freedom Conservancy (SQL-Paket).
- **SQLite** ist eine Marke von Hipp, Wyrick & Company, Inc. (SQL-Paket).
- **UML®** und **Unified Modeling Language™** sind Marken der Object Management Group, Inc. (SQL-Paket).

Dieses Projekt steht in keiner Verbindung zu den Inhabern der genannten Marken und wird von ihnen weder unterstützt noch empfohlen.

## kNN algorithm

### Code: puff – DEFLATE-Referenzdekoder (zlib-Lizenz)

- **Betrifft:** `kNN algorithm/src/js/inflate.js`
- **Herkunft:** Die Huffman-Dekodierung und der Ablauf der Blockverarbeitung sind eine veränderte JavaScript-Übertragung von `puff.c` von Mark Adler (zlib-Distribution, `contrib/puff`).
- **Lizenz:** zlib-Lizenz, Copyright (C) 2002-2013 Mark Adler. Die zlib-Lizenz ist mit der MIT-Lizenz vereinbar.
- **Kennzeichnung:** Der vollständige Lizenzhinweis und die Kennzeichnung als veränderte Fassung stehen im Kopf der Datei. Sie dürfen nicht entfernt werden.

Darüber hinaus enthält das kNN-Paket keinen Code von Dritten.

### Daten: Iris-Datensatz (Szenario „Schwertlilien“)

- **Betrifft:**
  - `kNN algorithm/testdata/szenario_1_schwertlilien.csv` (Trainingsdaten)
  - `kNN algorithm/testdata/szenario_1_schwertlilien_test.csv` (Testdaten)
- **Inhalt:** zwei getrennte Teilmengen der Merkmale Blütenblattlänge und Blütenblattbreite:
  - Trainingsdaten: 43 von 150 Datensätzen;
  - Testdaten: 11 weitere Datensätze (Nr. 13, 14, 19, 65, 66, 84, 99, 109, 118, 120 und 121 der UCI-Datei `iris.data`).
- **Quelle:**
  - Messungen von Edgar Anderson (1935).
  - Veröffentlicht von R. A. Fisher: *The use of multiple measurements in taxonomic problems*, Annals of Eugenics 7 (1936), S. 179–188.
- **Bezugsquelle:** Fisher, R. A. (1936). *Iris* [Datensatz]. UCI Machine Learning Repository, doi:10.24432/C56C76, lizenziert unter **CC BY 4.0** (creativecommons.org/licenses/by/4.0/).
- **Änderungen:**
  - Nur zwei der vier Merkmale.
  - Teilmengen der Datensätze, aufgeteilt in Trainings- und Testdaten.
  - Deutsche Spaltenbezeichnungen, Dezimalkomma, Semikolon als Trennzeichen.

### Daten: übrige Daten

Alle übrigen Daten des kNN-Pakets wurden für dieses Projekt frei erfunden und stehen unter der MIT-Lizenz:
- die eingebauten Beispieldaten im kNN-Paket (Früchte);
- die Szenarien Wetter, Spam, Lernerfolg und Musik sowie die Szenarien mit Ausreißern und mit unausgewogenen Klassen, jeweils Trainings- und Testdaten (`szenario_2_…` bis `szenario_11_…`, auch `*_test.csv`);
- die Regressionsdateien Eisverkauf, Bremsweg, Lernzeit, Gebrauchtwagen und Stromverbrauch (`regression_1_…` bis `regression_5_…`).

Es handelt sich nicht um Messungen realer Personen.

### Standards

| Bereich | Standard |
|---|---|
| DEFLATE | RFC 1951 |
| ZIP | PKWARE APPNOTE |
| Office Open XML | ECMA-376 |
| OpenDocument | OASIS/ISO/IEC 26300 |

## SQL Sandbox

### Code

Das SQL-Paket enthält keinen Code von Dritten: Lexer, Parser und Ausführung der SQL-Befehle sind eigener Code. Weder SQLite/sql.js noch eine andere Datenbank-Bibliothek ist enthalten. Verwendete Verfahren wie der rekursive Abstieg beim Parsen, der Platzhalter-Abgleich für `LIKE` und der Editierabstand für Vorschläge („Meinten Sie …?“) sind allgemein bekannte Algorithmen in eigener Umsetzung.

### Daten: Beispieldatenbanken

- **Betrifft:**
  - `SQL Sandbox/testdata/*.sql`
  - die inhaltsgleichen eingebauten Beispieldatenbanken `SQL Sandbox/src/js/samples/*.js`
- **Inhalt:** Schule, Bibliothek, Online-Shop, Sportverein, ein Beispiel im Stil eines Datenbank-Exports (Musikschule) und eine absichtlich fehlerhafte Übungsdatei.
- **Herkunft:** frei erfunden für dieses Projekt, MIT-Lizenz:
  - Namen sind frei kombinierte, gängige Vor- und Nachnamen.
  - Orte sind erfunden („Musterstadt“, „Beispielhausen“, „Waldmusterdorf“), ebenso Adressen, Schul-, Vereins- und Mannschaftsnamen.
  - Buchtitel, Autorinnen und Autoren sind frei erfunden und nicht an bestehende Werke angelehnt. Gerade kurze, allgemeine Titel kann es auch als reale Werke geben; solche Übereinstimmungen wären zufällig. Statt ISBN-Nummern gibt es eine erfundene Signatur.
  - Artikelbezeichnungen sind allgemeine Gattungsbezeichnungen. Marken- und Produktnamen kommen nicht vor.
- Es handelt sich nicht um Daten realer Personen, Schulen, Firmen, Werke oder Vereine. Ähnlichkeiten wären zufällig.
- Die Beispieldatei im Export-Stil ist selbst geschrieben:
  - Sie bildet nur den üblichen Aufbau solcher Exporte und deren funktionale SQL-Befehle nach (z. B. `SET SQL_MODE = …`, `START TRANSACTION`, `/*!40101 SET NAMES … */`).
  - Kommentare und Daten sind eigene Formulierungen. Texte oder Übersetzungen aus phpMyAdmin werden nicht übernommen.

### Standards

| Bereich | Standard |
|---|---|
| SQL | ISO/IEC 9075 als Bezug; Verhalten in Teilen an MySQL/MariaDB angelehnt (eigene Umsetzung, keine Spezifikationstexte enthalten) |
| UML-Klassendiagramm | Notation in Anlehnung an OMG UML (Klassen, Assoziationen, Multiplizitäten, Assoziationsklassen); Ebenenlayout nach dem bekannten Verfahren von Sugiyama u. a. (1981); eigene Umsetzung, keine Spezifikationstexte enthalten |
