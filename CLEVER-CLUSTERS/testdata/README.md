# Testdaten von CLEVER CLUSTERS

Diese Datei richtet sich an **Lehrkräfte**. Sie nennt, was an den Beispielen besonders ist. Im Paket selbst steht das bewusst nirgends: Titel, Meldungen, Dateinamen und Objektbezeichner sind neutral, und die Zeilen sind gemischt, damit Lernende das Problem erst im Verlauf der Analyse erkennen.

Alle Dateien sind außerdem als Beispiele fest eingebaut; der Build prüft, dass Datei und eingebauter Text übereinstimmen. Sie lassen sich auf **Seite 1** auch von Hand hochladen.

Die Werte sind selbst erzeugt, es sind **keine Messdaten**. Die Lebensmittel sind gerundete Richtwerte ohne Übernahme aus einer Datenbank. Ähnlichkeiten mit realen Personen oder Orten wären zufällig. Lizenz: MIT (siehe `LICENSE` im Stamm des Repositorys).

## Format

Die Dateien hier sind UTF-8 ohne BOM mit LF-Zeilenenden; als Trennzeichen dient das Semikolon, als Dezimalzeichen das Komma. Alle vier möglichen Formen kommen vor:

```
x;y                           Lebensmittel;Fett in g je 100 g;Zucker in g je 100 g
1,5;2                         Apfel;0,2;10

1,5;2                         Adresse 001;5,2;4,8
```

Die dritte Form hat zwei Spalten ohne Kopfzeile, die vierte drei Spalten ohne Kopfzeile. Die Erkennung beschreibt `../README.md`, Abschnitt „Dateiformat“.

## Beispiele

Die Spalten „Knick“ und „Silhouette“ zeigen, welches k die Verfahren in 60 Läufen mit k = 1 bis 10 am häufigsten vorschlagen, und wie oft. Ein Prozentwert deutlich unter 100 heißt, dass der Vorschlag von den zufälligen Startzentren abhängt. Die Spalte rechnet `sync-samples.mjs` nach (Entwicklungswerkzeuge).

<!-- BEGIN:beispiele -->
| Datei | Titel | Punkte | Form | Situation | Knick: häufigstes k | Silhouette: häufigstes bestes k | Silhouette: Mittel des besten Werts |
|---|---|---:|---|---|---:|---:|---:|
| `lebensmittel.csv` | Lebensmittel | 44 | 3 Spalten, Kopfzeile | Natürliche Gruppen, gut greifbar: Obst und Gemüse, Süßes, Fettes, Fettes und Süßes. Reale Daten sind unscharf; Knick und Silhouette sind sich oft nicht einig | 3 (87 %) | 8 (23 %) | 0,58 |
| `onlineshop.csv` | Kundschaft eines Onlineshops | 90 | 3 Spalten, Kopfzeile | Vier getrennte Kundensegmente; schlechte Startzentren verfehlen sie oft, deshalb schwanken die Vorschläge zwischen 3 und 4 | 3 (60 %) | 3 (48 %) | 0,73 |
| `adressen.csv` | Kundenadressen | 150 | 3 Spalten, ohne Kopfzeile | Sechs Stadtteile in zwei Reihen: Bei k = 6 führen zufällige Startzentren oft zu verschiedenen Ergebnissen, und der Knick liegt oft zu früh | 3 (60 %) | 6 (40 %) | 0,73 |
| `haeuser-1.csv` | Häuser in einer Gemeinde | 150 | 3 Spalten, Kopfzeile | Nicht-konvex: Häuser rund um einen See und auf einer Insel. k-Means zerschneidet den Ring | 3 (70 %) | 8 (38 %) | 0,57 |
| `haeuser-2.csv` | Häuser in einem Tal | 120 | 3 Spalten, Kopfzeile | Nicht-konvex: zwei ineinandergreifende Bögen entlang eines Flusses. k = 2 trennt sie nicht | 3 (83 %) | 4 (75 %) | 0,55 |
| `laeden.csv` | Läden in einer Region | 136 | 3 Spalten, Kopfzeile | Unterschiedliche Clustergrößen: eine Großstadt und zwei Dörfer. Bei k = 3 wird die Stadt geteilt, die Dörfer landen im selben Cluster | 4 (60 %) | 2 (82 %) | 0,48 |
| `baeume.csv` | Bäume in einem Gelände | 160 | 3 Spalten, Kopfzeile | Unterschiedliche Dichten: zwei dichte Waldstücke und eine lockere Streuobstwiese. Die Grenze liegt mittig zwischen den Zentren, deshalb fallen Wiesenbäume den Waldstücken zu | 3 (95 %) | 5 (67 %) | 0,67 |
| `messstationen.csv` | Messstationen | 64 | 3 Spalten, Kopfzeile | Ausreißer: Vier defekte Stationen. Bei k = 3 bilden drei von ihnen ein eigenes Cluster, die vierte zieht ein Zentrum zu sich, und zwei echte Gruppen verschmelzen | 4 (45 %) | 4 (57 %) | 0,72 |
| `haushalte.csv` | Haushalte | 120 | 3 Spalten, Kopfzeile | Nicht-sphärisch: zwei parallele Bänder (Haushalte ohne und mit Wärmepumpe). k = 2 schneidet quer zu den Bändern | 2 (72 %) | 7 (35 %) | 0,60 |
| `befragung.csv` | Befragung | 90 | 3 Spalten, Kopfzeile | Skalierung: Ohne sie entscheidet nur das Einkommen. Mit ihr treten die drei Altersgruppen hervor | 3 (100 %) | 3 (22 %) | 0,58 |
| `punkte-a.csv` | Punkte A | 45 | 2 Spalten, Kopfzeile | Einstieg: drei klar getrennte Wolken | 3 (77 %) | 3 (83 %) | 0,83 |
| `punkte-b.csv` | Punkte B | 30 | 2 Spalten, ohne Kopfzeile | Zeigt das Format ohne Kopfzeile: zwei Wolken | 2 (100 %) | 2 (100 %) | 0,82 |
| `punkte-c.csv` | Punkte C | 80 | 2 Spalten, Kopfzeile | Keine Struktur, gleichverteilt: Die Verfahren schlagen trotzdem ein k vor. Der Knick ist schwach, die Silhouettenwerte sind niedrig | 4 (87 %) | 4 (52 %) | 0,42 |
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
<!-- END:startarten -->

## Neue Beispiele ergänzen

1. In `generate-samples.mjs` (Entwicklungswerkzeuge) die Daten mit festem Startwert erzeugen. Zeilen mischen, Bezeichner erst danach nummerieren.
2. In `sync-samples.mjs` Titel, neutrale Meldung, Form und Situation eintragen.
3. `node generate-samples.mjs` und `node sync-samples.mjs` ausführen.

Die Situation jedes Beispiels und die Fragen an die Lernenden stehen auch in `../README.md`. Die Vorschläge in der Tabelle gelten ohne Skalierung.
