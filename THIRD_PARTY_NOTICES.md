# Hinweise zu Drittanteilen, Datenquellen und Marken

Der Quelltext dieses Repositorys steht unter der **MIT-Lizenz** (siehe [LICENSE](LICENSE)).
Davon abweichend oder ergänzend gilt Folgendes.

## Code

### puff – DEFLATE-Referenzdekoder (zlib-Lizenz)

- **Betrifft:** `kNN algorithm/src/js/inflate.js`
- **Herkunft:** Die Huffman-Dekodierung und der Ablauf der Blockverarbeitung sind eine veränderte JavaScript-Übertragung von `puff.c` von Mark Adler (zlib-Distribution, `contrib/puff`).
- **Lizenz:** zlib-Lizenz, Copyright (C) 2002-2013 Mark Adler. Die zlib-Lizenz ist mit der MIT-Lizenz vereinbar.
- **Kennzeichnung:** Der vollständige Lizenzhinweis und die Kennzeichnung als veränderte Fassung stehen im Kopf der Datei. Sie dürfen nicht entfernt werden.

Darüber hinaus enthält das Projekt **keinen Code von Dritten**, keine Bibliotheken, keine Schriftarten und keine Bilder.

Das gilt ausdrücklich auch für den **SQL-Simulator** (`SQL simulator/`): Lexer, Parser und Ausführung der SQL-Befehle sind eigener Code. Weder SQLite/sql.js noch eine andere Datenbank-Bibliothek ist enthalten. Verwendete Verfahren wie der rekursive Abstieg beim Parsen, der Platzhalter-Abgleich für `LIKE` und der Editierabstand für Vorschläge („Meinten Sie …?“) sind allgemein bekannte Algorithmen in eigener Umsetzung.

## Daten

### Iris-Datensatz (Szenario „Schwertlilien“)

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

### Übrige Daten

Alle übrigen Daten wurden für dieses Projekt frei erfunden und stehen unter der MIT-Lizenz:
- die Beispieldaten im Simulator (Früchte);
- die Szenarien Wetter, Spam, Lernerfolg und Musik, jeweils Trainings- und Testdaten (`szenario_2_…` bis `szenario_5_…`, auch `*_test.csv`).

Es handelt sich nicht um Messungen realer Personen.

### SQL-Simulator: Beispieldatenbanken

- **Betrifft:**
  - `SQL simulator/testdata/*.sql`
  - die inhaltsgleichen eingebauten Beispieldatenbanken `SQL simulator/src/js/samples/*.js`
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

## Gestaltung

- **Farbpalette:** Die Klassenfarben basieren auf der farbenblindfreundlichen Palette von Masataka Okabe und Kei Ito, *Color Universal Design* (2008). Die Nennung ist eine Würdigung. Farbwerte als solche sind nicht urheberrechtlich geschützt.

## Standards

Das Projekt implementiert offene Formate und Schnittstellen mit eigenem Code. Weder Spezifikationstexte noch Schemadateien (XSD) sind enthalten.

| Bereich | Standard |
|---|---|
| DEFLATE | RFC 1951 |
| ZIP | PKWARE APPNOTE |
| Office Open XML | ECMA-376 |
| OpenDocument | OASIS/ISO/IEC 26300 |
| SCORM-1.2-Laufzeitschnittstelle und IMS Content Packaging | Namensraum-URIs im Manifest sind nur Bezeichner |
| SQL (SQL-Simulator) | ISO/IEC 9075 als Bezug; Verhalten in Teilen an MySQL/MariaDB angelehnt (eigene Umsetzung, keine Spezifikationstexte enthalten) |

## Marken

Die folgenden Namen werden nur beschreibend verwendet, um die Kompatibilität zu benennen:

- **Moodle™** ist eine Marke der Moodle Pty Ltd.
- **SCORM®** ist eine eingetragene Marke des U.S. Department of Defense (Advanced Distributed Learning Initiative).
- **Microsoft Excel, Windows, Edge, PowerShell und .NET** sind Marken der Microsoft Corporation.
- **LibreOffice** ist eine Marke der The Document Foundation.
- **MySQL** ist eine eingetragene Marke der Oracle Corporation und/oder ihrer verbundenen Unternehmen.
- **MariaDB®** ist eine eingetragene Marke der MariaDB plc.
- **PostgreSQL** und **Postgres** sind Marken oder eingetragene Marken der PostgreSQL Community Association of Canada.
- **phpMyAdmin** ist ein Projekt der Software Freedom Conservancy.
- **SQLite** ist eine Marke von Hipp, Wyrick & Company, Inc.
- **Chrome** ist eine Marke von Google LLC, **Firefox** von der Mozilla Foundation, **Safari** von Apple Inc.

Dieses Projekt steht in keiner Verbindung zu den Markeninhabern und wird von ihnen weder unterstützt noch empfohlen.
