# Testdaten von CLEVER CLUSTERS

Diese Datei richtet sich an **Lehrkräfte**. Sie nennt, was an den Beispielen besonders ist. Im Paket selbst steht das bewusst nirgends: Titel, Meldungen, Dateinamen und Objektbezeichner sind neutral, und die Zeilen sind gemischt, damit Lernende das Problem erst im Verlauf der Analyse erkennen.

Alle Dateien sind außerdem als Beispiele fest eingebaut; der Build prüft, dass Datei und eingebauter Text übereinstimmen. Sie lassen sich auf **Seite 1** auch von Hand hochladen.

Die Werte sind selbst erzeugt, es sind **keine Messdaten**. Die Lebensmittel sind gerundete Richtwerte ohne Übernahme aus einer Datenbank. Ähnlichkeiten mit realen Personen oder Orten wären zufällig. Lizenz: MIT (siehe `LICENSE` im Stamm des Repositorys).

**Ausnahme:** `schwertlilien.csv` enthält echte Messdaten: 54 von 150 Blüten des Iris-Datensatzes mit Blütenblattlänge und -breite. Messungen von Edgar Anderson (1935), veröffentlicht von R. A. Fisher (1936), bezogen über das UCI Machine Learning Repository (doi:10.24432/C56C76), lizenziert unter **CC BY 4.0**. Die Datei übernimmt beide Teilmengen aus NOSY NEIGHBORS, gemischt und neu nummeriert. Einzelheiten stehen in `THIRD_PARTY_NOTICES.md` im Stamm des Repositorys.

## Format

Die Dateien hier sind UTF-8 ohne BOM mit LF-Zeilenenden; als Trennzeichen dient das Semikolon, als Dezimalzeichen das Komma. Vier Formen kommen vor:

```
x;y                           Lebensmittel;Fett in g je 100 g;Zucker in g je 100 g;Gruppe
1,5;2                         Apfel;0,2;10;Obst, Gemüse und Beilagen

1,5;2                         Adresse 001;5,2;4,8
```

Die dritte Form hat zwei Spalten ohne Kopfzeile, die vierte drei Spalten ohne Kopfzeile. Die Dateien mit vier Spalten nennen in der letzten die bekannte Gruppe. Die Formen `x;y;Gruppe` mit und ohne Kopfzeile versteht das Paket ebenfalls, aber kein Beispiel nutzt sie. Die Erkennung beschreibt `../README.md`, Abschnitt „Dateiformat“.

## Beispiele

Die Spalten „Knick“ und „Silhouette“ zeigen, welches k die Verfahren in 60 Läufen mit k = 1 bis 10 am häufigsten vorschlagen, und wie oft. Ein Prozentwert deutlich unter 100 heißt, dass der Vorschlag von den zufälligen Startzentren abhängt. Die Spalte rechnet `sync-samples.mjs` nach (Entwicklungswerkzeuge).

<!-- BEGIN:beispiele -->
| Datei | Titel | Punkte | Form | Situation | Knick: häufigstes k | Silhouette: häufigstes bestes k | Silhouette: Mittel des besten Werts |
|---|---|---:|---|---|---:|---:|---:|
| `lebensmittel.csv` | Lebensmittel | 44 | 4 Spalten, Kopfzeile | Natürliche Gruppen, gut greifbar: Obst und Gemüse, Süßes, Fettes, Fettes und Süßes. Reale Daten sind unscharf; Knick und Silhouette sind sich oft nicht einig | 3 (87 %) | 8 (23 %) | 0,58 |
| `onlineshop.csv` | Kundschaft eines Onlineshops | 90 | 4 Spalten, Kopfzeile | Vier getrennte Kundensegmente; schlechte Startzentren verfehlen sie oft, deshalb schwanken die Vorschläge zwischen 3 und 4 | 3 (60 %) | 3 (48 %) | 0,73 |
| `adressen.csv` | Kundenadressen | 150 | 3 Spalten, ohne Kopfzeile | Sechs Stadtteile in zwei Reihen: Bei k = 6 führen zufällige Startzentren oft zu verschiedenen Ergebnissen, und der Knick liegt oft zu früh | 3 (60 %) | 6 (40 %) | 0,73 |
| `haeuser-1.csv` | Häuser in einer Gemeinde | 150 | 4 Spalten, Kopfzeile | Nicht-konvex: Häuser rund um einen See und auf einer Insel. k-Means zerschneidet den Ring | 3 (70 %) | 8 (38 %) | 0,57 |
| `haeuser-2.csv` | Häuser in einem Tal | 120 | 4 Spalten, Kopfzeile | Nicht-konvex: zwei ineinandergreifende Bögen entlang eines Flusses. k = 2 trennt sie nicht | 3 (83 %) | 4 (75 %) | 0,55 |
| `laeden.csv` | Läden in einer Region | 136 | 4 Spalten, Kopfzeile | Unterschiedliche Clustergrößen: eine Großstadt und zwei Dörfer. Bei k = 3 wird die Stadt geteilt, die Dörfer landen im selben Cluster | 4 (60 %) | 2 (82 %) | 0,48 |
| `baeume.csv` | Bäume in einem Gelände | 160 | 4 Spalten, Kopfzeile | Unterschiedliche Dichten: zwei dichte Waldstücke und eine lockere Streuobstwiese. Die Grenze liegt mittig zwischen den Zentren, deshalb fallen Wiesenbäume den Waldstücken zu | 3 (95 %) | 5 (67 %) | 0,67 |
| `messstationen.csv` | Messstationen | 64 | 4 Spalten, Kopfzeile | Ausreißer: Vier defekte Stationen. Bei k = 3 bilden drei von ihnen ein eigenes Cluster, die vierte zieht ein Zentrum zu sich, und zwei echte Gruppen verschmelzen | 4 (45 %) | 4 (57 %) | 0,72 |
| `haushalte.csv` | Haushalte | 120 | 4 Spalten, Kopfzeile | Nicht-sphärisch: zwei parallele Bänder (Haushalte ohne und mit Wärmepumpe). k = 2 schneidet quer zu den Bändern | 2 (72 %) | 7 (35 %) | 0,60 |
| `befragung.csv` | Befragung | 90 | 4 Spalten, Kopfzeile | Skalierung: Ohne sie entscheidet nur das Einkommen. Mit ihr treten die drei Altersgruppen hervor | 3 (100 %) | 3 (22 %) | 0,58 |
| `punkte-a.csv` | Punkte A | 45 | 2 Spalten, Kopfzeile | Einstieg: drei klar getrennte Wolken | 3 (77 %) | 3 (83 %) | 0,83 |
| `punkte-b.csv` | Punkte B | 30 | 2 Spalten, ohne Kopfzeile | Zeigt das Format ohne Kopfzeile: zwei Wolken | 2 (100 %) | 2 (100 %) | 0,82 |
| `punkte-c.csv` | Punkte C | 80 | 2 Spalten, Kopfzeile | Keine Struktur, gleichverteilt: Die Verfahren schlagen trotzdem ein k vor. Der Knick ist schwach, die Silhouettenwerte sind niedrig | 4 (87 %) | 4 (52 %) | 0,42 |
| `hunde.csv` | Hunde | 100 | 4 Spalten, Kopfzeile | Vier Hunderassen in klar getrennten Wolken: k-Means trifft die Gruppen bei k = 4 gut | 3 (72 %) | 4 (33 %) | 0,79 |
| `fahrzeuge.csv` | Fahrzeuge | 120 | 4 Spalten, Kopfzeile | Unterschiedlich große Gruppen: viele Pkw, wenige Transporter, Busse und Lkw. Bei k = 4 werden die Pkw geteilt, Busse und Lkw teilen sich ein Cluster | 2 (100 %) | 2 (100 %) | 0,88 |
| `obst.csv` | Obst | 100 | 4 Spalten, Kopfzeile | Vier Sorten, die sich überlappen: Selbst bei k = 4 trifft k-Means die Sorten nur teilweise | 3 (93 %) | 3 (100 %) | 0,46 |
| `sportarten.csv` | Sportarten | 100 | 4 Spalten, Kopfzeile | Vier Sportarten mit realistischen Überschneidungen: Körpermaße allein bestimmen die Sportart nicht | 2 (50 %) | 2 (100 %) | 0,60 |
| `schwertlilien.csv` | Schwertlilien | 54 | 4 Spalten, Kopfzeile | Echte Messdaten: Eine Art ist klar getrennt, die beiden anderen grenzen aneinander. Bei k = 3 bleiben wenige Blüten im falschen Cluster | 3 (100 %) | 2 (100 %) | 0,72 |
<!-- END:beispiele -->

## Zufällige Startzentren und k-means++

Je 60 Läufe. „Schlecht“ heißt: Die WCSS liegt mehr als 10 % über dem besten gefundenen Wert. k = 3 gilt für alle Beispiele, bei den Kundenadressen zusätzlich k = 6. Die Tabelle zeigt, wo sich k-means++ lohnt und wo nicht: Es senkt meist den Anteil schlechter Läufe, besonders bei getrennten Gruppen (Punkte A, Kundenadressen mit k = 6). Wo die Daten keine klaren Gruppen haben (Punkte C, Häuser in einem Tal), bringt es wenig oder ist in diesen Läufen sogar etwas schlechter.

<!-- BEGIN:startarten -->
| Titel | k | Mittlere WCSS, zufällig | Mittlere WCSS, k-means++ | Schlechte Läufe, zufällig | Schlechte Läufe, k-means++ |
|---|---:|---:|---:|---:|---:|
| Lebensmittel | 3 | 16012,8 | 15622,3 | 15 % | 13 % |
| Kundschaft eines Onlineshops | 3 | 10729,7 | 10338,0 | 40 % | 28 % |
| Kundenadressen | 3 | 5742,1 | 5663,3 | 20 % | 10 % |
| Kundenadressen | 6 | 1267,4 | 785,2 | 45 % | 18 % |
| Häuser in einer Gemeinde | 3 | 4608,0 | 4574,0 | 3 % | 0 % |
| Häuser in einem Tal | 3 | 1895,9 | 1905,6 | 7 % | 8 % |
| Läden in einer Region | 3 | 2908,4 | 2901,8 | 0 % | 0 % |
| Bäume in einem Gelände | 3 | 35181,8 | 31039,0 | 12 % | 3 % |
| Messstationen | 3 | 9247,1 | 9341,5 | 78 % | 43 % |
| Haushalte | 3 | 63009,7 | 61950,8 | 22 % | 12 % |
| Befragung | 3 | 1189688724,6 | 1185803060,2 | 0 % | 0 % |
| Punkte A | 3 | 86,7 | 22,9 | 27 % | 2 % |
| Punkte B | 3 | 24,4 | 23,8 | 60 % | 48 % |
| Punkte C | 3 | 494,6 | 499,8 | 5 % | 13 % |
| Hunde | 3 | 14506,2 | 8738,2 | 45 % | 17 % |
| Fahrzeuge | 3 | 115,4 | 125,2 | 2 % | 15 % |
| Obst | 3 | 59,3 | 58,9 | 2 % | 0 % |
| Sportarten | 3 | 15154,2 | 14336,0 | 40 % | 23 % |
| Schwertlilien | 3 | 14,5 | 14,5 | 0 % | 0 % |
<!-- END:startarten -->

## Vergleich mit den bekannten Gruppen

Je 60 Läufe mit zufälligen Startzentren, jeweils mit k = Anzahl der Gruppen und ohne Skalierung. Die Tabelle zeigt die Mittelwerte. Hohe Werte heißen, dass k-Means die Gruppen trifft. Niedrige Werte sind kein Fehler des Verfahrens: Die Gruppen sind dann nicht das, was nahe beieinanderliegt. Kundenadressen und die Punkte A, B und C haben keine Gruppen.

<!-- BEGIN:gruppen -->
| Titel | Anzahl der Gruppen | Reinheit | Adjusted Rand Index |
|---|---:|---:|---:|
| Lebensmittel | 4 | 0,82 | 0,66 |
| Kundschaft eines Onlineshops | 4 | 0,88 | 0,80 |
| Häuser in einer Gemeinde | 2 | 0,80 | −0,01 |
| Häuser in einem Tal | 2 | 0,74 | 0,23 |
| Läden in einer Region | 3 | 0,89 | 0,28 |
| Bäume in einem Gelände | 3 | 0,91 | 0,76 |
| Messstationen | 4 | 0,93 | 0,87 |
| Haushalte | 2 | 0,61 | 0,04 |
| Befragung | 3 | 0,37 | −0,02 |
| Hunde | 4 | 0,84 | 0,76 |
| Fahrzeuge | 4 | 0,94 | 0,52 |
| Obst | 4 | 0,72 | 0,45 |
| Sportarten | 4 | 0,75 | 0,56 |
| Schwertlilien | 3 | 0,93 | 0,78 |
<!-- END:gruppen -->

| Datei | Gruppen | Frage an die Lernenden |
|---|---|---|
| `hunde.csv` | Chihuahua, Beagle, Schäferhund, Bernhardiner | Warum klappt es hier so gut? Was ändert sich mit k = 3 oder k = 8? |
| `fahrzeuge.csv` | Pkw (90), Transporter (14), Bus (8), Lkw (8) | Warum teilt k-Means die große Gruppe, obwohl vier Gruppen und vier Cluster vorliegen? |
| `obst.csv` | Apfel, Birne, Orange, Zitrone | Woran liegt es, dass die Sorten nicht getrennt werden? Würde ein weiteres Merkmal helfen? |
| `sportarten.csv` | Basketball, Turnen, Langstreckenlauf, Gewichtheben | Welche Sportarten lassen sich an den Körpermaßen erkennen, welche nicht? |
| `schwertlilien.csv` | Iris setosa, Iris versicolor, Iris virginica | Welche Art ist klar getrennt? Sieht man an den Daten allein, dass es drei Arten sind? |

## Neue Beispiele ergänzen

1. In `generate-samples.mjs` (Entwicklungswerkzeuge) die Daten mit festem Startwert erzeugen. Zeilen mischen, Bezeichner erst danach nummerieren.
2. In `sync-samples.mjs` Titel, neutrale Meldung, Form und Situation eintragen.
3. `node generate-samples.mjs` und `node sync-samples.mjs` ausführen.

Die Situation jedes Beispiels und die Fragen an die Lernenden stehen auch in `../README.md`. Die Vorschläge in der Tabelle gelten ohne Skalierung.
