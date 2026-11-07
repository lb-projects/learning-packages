# Hinweise zu Drittanteilen, Datenquellen und Marken

Der Quelltext dieses Repositorys steht unter der **MIT-Lizenz** (siehe [LICENSE](LICENSE)).
Davon abweichend oder ergänzend gilt Folgendes.

Das Repository enthält fünf Pakete. Die Hinweise sind danach gegliedert, für wen sie gelten:

- [Allgemein](#allgemein-alle-pakete): gilt für alle Pakete.
- [NOSY NEIGHBORS](#nosy-neighbors): gilt für NOSY NEIGHBORS (`NOSY-NEIGHBORS/`); der Abschnitt zu `inflate.js` gilt auch für EDGY EDGES.
- [SQL Sandbox](#sql-sandbox): gilt nur für die SQL Sandbox (`SQL-Sandbox/`).
- [EDGY EDGES](#edgy-edges): gilt nur für das Graphen-Paket (`EDGY-EDGES/`).
- [BUSY BIAS](#busy-bias): gilt nur für den Perzeptron-Simulator (`BUSY-BIAS/`).
- [CLEVER CLUSTERS](#clever-clusters): gilt nur für den k-Means-Demonstrator (`CLEVER-CLUSTERS/`).

## Allgemein (alle Pakete)

### Generative KI

Teile dieses Projekts wurden mithilfe generativer KI erstellt, darunter Code, Daten und Bilder. Der Code wurde nach bestem Wissen geprüft, es kann jedoch keine Gewähr dafür übernommen werden, dass der generierte Code frei von Rechten Dritter ist. Das Projekt wird einschließlich der KI-generierten Daten und Bilder unter den Bedingungen der MIT-Lizenz „wie besehen“ bereitgestellt; für die unten genannten Bestandteile unter zlib-Lizenz und CC BY 4.0 gelten zusätzlich diese Lizenzen.

### Code

Das Projekt bindet keine Bibliotheken ein und enthält keine Schriftarten. Eine Datei des gemeinsamen Datei-Imports (`inflate.js`), die in NOSY NEIGHBORS und in EDGY EDGES liegt, enthält Code unter der zlib-Lizenz (siehe [NOSY NEIGHBORS](#nosy-neighbors)).

### Gestaltung

- **Farbpalette:** Die Klassenfarben basieren auf der farbenblindfreundlichen Palette von Masataka Okabe und Kei Ito, *Color Universal Design* (2008). NOSY NEIGHBORS verwendet sie für die Labels, die SQL Sandbox für die Farben der Oberfläche, EDGY EDGES für die Zustände der Knoten und Kanten. Die Nennung ist eine Würdigung. Farbwerte als solche sind nicht urheberrechtlich geschützt.

### Standards

Das Projekt implementiert offene Formate und Schnittstellen. Weder Spezifikationstexte noch Schemadateien (XSD) sind enthalten.

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
- **Microsoft Excel** ist eine Marke der Microsoft Corporation (NOSY NEIGHBORS und EDGY EDGES: Import von `.xlsx`).
- **LibreOffice** ist eine Marke der The Document Foundation (NOSY NEIGHBORS und EDGY EDGES: Import von `.ods`).
- **MySQL** ist eine eingetragene Marke der Oracle Corporation und/oder ihrer verbundenen Unternehmen (SQL Sandbox).
- **MariaDB®** ist eine eingetragene Marke der MariaDB plc (SQL Sandbox).
- **PostgreSQL** und **Postgres** sind Marken oder eingetragene Marken der PostgreSQL Community Association of Canada (SQL Sandbox).
- **phpMyAdmin** ist ein Projekt der Software Freedom Conservancy (SQL Sandbox).
- **SQLite** ist eine Marke von Hipp, Wyrick & Company, Inc. (SQL Sandbox).
- **UML®** und **Unified Modeling Language™** sind Marken der Object Management Group, Inc. (SQL Sandbox).

Dieses Projekt steht in keiner Verbindung zu den Inhabern der genannten Marken und wird von ihnen weder unterstützt noch empfohlen.

## NOSY NEIGHBORS

### Code: puff – DEFLATE-Referenzdekoder (zlib-Lizenz)

- **Betrifft:** `shared/js/inflate.js` (Quelle) und die Kopien `NOSY-NEIGHBORS/src/js/inflate.js` und `EDGY-EDGES/src/js/inflate.js`
- **Herkunft:** Die Huffman-Dekodierung und der Ablauf der Blockverarbeitung sind eine veränderte JavaScript-Übertragung von `puff.c` von Mark Adler (zlib-Distribution, `contrib/puff`).
- **Lizenz:** zlib-Lizenz, Copyright (C) 2002-2013 Mark Adler. Die zlib-Lizenz ist mit der MIT-Lizenz vereinbar.
- **Kennzeichnung:** Der vollständige Lizenzhinweis und die Kennzeichnung als veränderte Fassung stehen im Kopf der Datei. Sie dürfen nicht entfernt werden.

### Daten: Iris-Datensatz (Szenario „Schwertlilien“)

- **Betrifft:**
  - `NOSY-NEIGHBORS/testdata/szenario_1_schwertlilien.csv` (Trainingsdaten)
  - `NOSY-NEIGHBORS/testdata/szenario_1_schwertlilien_test.csv` (Testdaten)
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

Alle übrigen Daten von NOSY NEIGHBORS sind fiktiv und stehen unter der MIT-Lizenz:
- die eingebauten Beispieldaten in NOSY NEIGHBORS (Früchte);
- die Szenarien Wetter, Spam, Lernerfolg und Musik sowie die Szenarien mit Ausreißern und mit unausgewogenen Klassen, jeweils Trainings- und Testdaten (`szenario_2_…` bis `szenario_12_…`, auch `*_test.csv`, darunter das Szenario zur Normalisierung);
- die Regressionsdateien Eisverkauf, Bremsweg, Lernzeit, Gebrauchtwagen, Stromverbrauch und Taxifahrt (`regression_1_…` bis `regression_6_…`).

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

Die SQL Sandbox enthält weder SQLite/sql.js noch eine andere Datenbank-Bibliothek. Verwendete Verfahren wie der rekursive Abstieg beim Parsen, der Platzhalter-Abgleich für `LIKE` und der Editierabstand für Vorschläge („Meinten Sie …?“) sind allgemein bekannte Algorithmen.

### Daten: Beispieldatenbanken

- **Betrifft:**
  - `SQL-Sandbox/testdata/*.sql`
  - die inhaltsgleichen eingebauten Beispieldatenbanken `SQL-Sandbox/src/js/samples/*.js`
- **Inhalt:** Schule, Bibliothek, Online-Shop, Sportverein, die absichtlich nicht normalisierte Kursbuchung, sieben Übungsdateien zu den Normalformen (Kontaktliste, Ausleihe, Vereinsmitglieder, Projektmitarbeit, Arztpraxis, Bestellungen, normalisierte Vereinsverwaltung), ein Beispiel im Stil eines Datenbank-Exports (Musikschule) und eine absichtlich fehlerhafte Übungsdatei.
- **Herkunft:** fiktiv, MIT-Lizenz:
  - Namen sind frei kombinierte, gängige Vor- und Nachnamen.
  - Orte sind fiktiv („Musterstadt“, „Beispielhausen“, „Waldmusterdorf“), ebenso Adressen, Schul-, Vereins- und Mannschaftsnamen.
  - Buchtitel, Autorinnen und Autoren sind fiktiv. Gerade kurze, allgemeine Titel kann es auch als reale Werke geben; solche Übereinstimmungen sind nicht beabsichtigt. Statt ISBN-Nummern gibt es eine fiktive Signatur.
  - Artikelbezeichnungen sind allgemeine Gattungsbezeichnungen. Marken- und Produktnamen kommen nicht vor.
- Es handelt sich nicht um Daten realer Personen, Schulen, Firmen, Werke oder Vereine. Ähnlichkeiten sind nicht beabsichtigt.
- Die Beispieldatei im Export-Stil bildet den üblichen Aufbau solcher Exporte und deren funktionale SQL-Befehle nach (z. B. `SET SQL_MODE = …`, `START TRANSACTION`, `/*!40101 SET NAMES … */`).

### Standards

| Bereich | Standard |
|---|---|
| SQL | ISO/IEC 9075 als Bezug; Verhalten in Teilen an MySQL/MariaDB angelehnt (keine Spezifikationstexte enthalten) |
| UML-Klassendiagramm | Notation in Anlehnung an OMG UML (Klassen, Assoziationen, Multiplizitäten, Assoziationsklassen); Ebenenlayout nach dem bekannten Verfahren von Sugiyama u. a. (1981); keine Spezifikationstexte enthalten |

## EDGY EDGES

### Code

EDGY EDGES verwendet den gemeinsamen Datei-Import (`inflate.js`, siehe [NOSY NEIGHBORS](#nosy-neighbors)). Die Algorithmen sind allgemein bekannte Verfahren:
- Breitensuche und Tiefensuche;
- Dijkstra-Algorithmus (E. W. Dijkstra, 1959);
- Bellman-Ford-Algorithmus (R. Bellman, 1958; L. R. Ford, 1956) mit der üblichen Erkennung negativer Zyklen;
- kräftebasierte Anordnung der Knoten nach Fruchterman und Reingold (1991), vereinfacht und ohne Zufall.

### Daten: Beispielgraphen

- **Betrifft:** `EDGY-EDGES/testdata/beispiel-*.csv` und die inhaltsgleichen eingebauten Beispiele `EDGY-EDGES/src/js/samples.js`.
- **Lizenz:** MIT-Lizenz. Die Graphen mit Buchstaben als Knotennamen sind fiktiv.
- Das Städtenetz verwendet die Namen bayerischer Städte und gerundete Näherungswerte für Straßenentfernungen in km. Es handelt sich um geschätzte, vereinfachte Werte; sie sind nicht für Planungszwecke gedacht.

### Standards

Für den Datei-Import gelten dieselben Standards wie in NOSY NEIGHBORS (DEFLATE, ZIP, Office Open XML, OpenDocument).

## BUSY BIAS

### Code

BUSY BIAS verwendet nur `csv-parser.js` aus dem gemeinsamen Datei-Import, nicht `inflate.js`. Das Perzeptron und seine Lernregel sind allgemein bekannte Verfahren (F. Rosenblatt, 1958).

### Daten: Beispieldatensätze

- **Betrifft:** `BUSY-BIAS/testdata/*.csv` und die inhaltsgleichen eingebauten Beispiele `BUSY-BIAS/src/js/samples.js`.
- **Herkunft:** fiktiv, MIT-Lizenz.
- Die Werte sind an typische Größenordnungen angelehnt. Es sind keine Messdaten. Hunderassen und Fahrzeugarten werden nur als allgemeine Bezeichnungen verwendet; Fahrzeugmarken kommen nicht vor.

### Gestaltung

Grün und Hellrot für die Decision Areas sind eine inhaltliche Vorgabe des Pakets. Damit die Klassen auch ohne Farbwahrnehmung erkennbar sind, unterscheiden sich die Punkte zusätzlich in der Form (Kreis und Quadrat).

## CLEVER CLUSTERS

### Code

CLEVER CLUSTERS verwendet nur `csv-parser.js` aus dem gemeinsamen Datei-Import, nicht `inflate.js`. Die Verfahren sind allgemein bekannt: k-Means nach S. P. Lloyd (1957, veröffentlicht 1982), k-means++ nach D. Arthur und S. Vassilvitskii (2007), Silhouette nach P. J. Rousseeuw (1987), Adjusted Rand Index nach L. Hubert und P. Arabie (1985).

### Daten: Iris-Datensatz (Beispiel „Schwertlilien“)

- **Betrifft:** `CLEVER-CLUSTERS/testdata/schwertlilien.csv` und das inhaltsgleiche eingebaute Beispiel in `CLEVER-CLUSTERS/src/js/samples.js`.
- **Inhalt:** 54 von 150 Datensätzen mit den Merkmalen Blütenblattlänge und Blütenblattbreite; es sind die Trainings- und Testdaten des Szenarios in NOSY NEIGHBORS zusammen.
- **Quelle:**
  - Messungen von Edgar Anderson (1935).
  - Veröffentlicht von R. A. Fisher: *The use of multiple measurements in taxonomic problems*, Annals of Eugenics 7 (1936), S. 179–188.
- **Bezugsquelle:** Fisher, R. A. (1936). *Iris* [Datensatz]. UCI Machine Learning Repository, doi:10.24432/C56C76, lizenziert unter **CC BY 4.0** (creativecommons.org/licenses/by/4.0/).
- **Änderungen:**
  - Nur zwei der vier Merkmale.
  - Teilmenge der Datensätze, gemischt und neu nummeriert.
  - Deutsche Spaltenbezeichnungen, Dezimalkomma, Semikolon als Trennzeichen.
- **Namensnennung im Paket:** Die Meldung nach dem Laden des Beispiels nennt Quelle und Lizenz.

### Daten: übrige Beispieldatensätze und Beispielbilder

- **Betrifft:** die übrigen Dateien `CLEVER-CLUSTERS/testdata/*.csv`, die inhaltsgleichen eingebauten Beispiele in `CLEVER-CLUSTERS/src/js/samples.js` und die Beispielbilder in `CLEVER-CLUSTERS/src/js/sample-scenes.js`.
- **Herkunft:** fiktiv, MIT-Lizenz.
- Es sind keine Messdaten. Die Lebensmittel sind gerundete Richtwerte und nicht für Ernährungsangaben gedacht. Hunderassen, Fahrzeugarten und Sportarten werden nur als allgemeine Bezeichnungen verwendet; Fahrzeugmarken kommen nicht vor.
- Die Beispielbilder sind Zeichnungen, die der Code beim Laden erzeugt. Das Paket enthält keine Bilddateien.

### Gestaltung

Damit die Cluster auch ohne Farbwahrnehmung und bei vielen Clustern erkennbar sind, tragen die Zentren ihre Nummer, und die Punkte unterscheiden sich zusätzlich in der Form (Kreis, Quadrat und Raute).
