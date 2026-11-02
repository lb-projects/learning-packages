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

## Marken

Die folgenden Namen werden nur beschreibend verwendet, um die Kompatibilität zu benennen:

- **Moodle™** ist eine Marke der Moodle Pty Ltd.
- **SCORM®** ist eine eingetragene Marke des U.S. Department of Defense (Advanced Distributed Learning Initiative).
- **Microsoft Excel, Windows, Edge und PowerShell** sind Marken der Microsoft Corporation.
- **LibreOffice** ist eine Marke der The Document Foundation.
- **Chrome** ist eine Marke von Google LLC, **Firefox** von der Mozilla Foundation, **Safari** von Apple Inc.

Dieses Projekt steht in keiner Verbindung zu den Markeninhabern und wird von ihnen weder unterstützt noch empfohlen.
