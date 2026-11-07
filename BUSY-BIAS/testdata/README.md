# Testdaten von BUSY BIAS

Dieser Ordner enthält die CSV-Dateien für den Unterricht und für Tests. Alle Dateien sind außerdem als Beispiele fest eingebaut; der Build prüft, dass Datei und eingebauter Text übereinstimmen. Sie lassen sich auf **Seite 1 „Daten und Perzeptron“** auch von Hand hochladen.

Die Werte sind fiktiv und an typische Größenordnungen angelehnt. Es sind **keine Messdaten**. Ähnlichkeiten mit realen Personen, Kundinnen und Kunden oder Fahrzeugen sind nicht beabsichtigt. Die Einteilungen (z. B. Kleinhund/Großhund, Pkw/Lkw) sind für den Unterricht vereinfacht. Lizenz: MIT (siehe `LICENSE` im Stamm des Repositorys).

## Format

```
Attribut x;Attribut y;Label
1,5;2;bestanden
```

- Die erste Zeile ist Pflicht und enthält genau drei Einträge; der dritte heißt `Label`.
- Danach je Zeile zwei Zahlen und das Label. Höchstens zwei verschiedene Labels und 500 Punkte, Zahlen von −1000 bis 1000.
- Die Dateien hier sind UTF-8 ohne BOM mit LF-Zeilenenden; als Trennzeichen dient das Semikolon, als Dezimalzeichen das Komma.

Sind beide Labels Zahlen, feuert das Perzeptron beim größeren, sonst beim ersten Label der Datei. Auf Seite 1 lässt sich das ändern.

## Warum manche Einheiten ungewöhnlich sind

Hunde stehen in Dezimetern und 10 kg, Kreditdaten in Tsd. € und 10 Tsd. €. Das ist Absicht und ergänzt den Schalter „Eingabedaten skalieren“ auf Seite 1. Die Lernregel ändert θ je Anpassung nur um α, die Gewichte aber um α·x. Bei großen Zahlen braucht das Training deshalb sehr viel länger: Dieselben Hunde in Zentimetern und Kilogramm benötigen in Stufe 3 rund 2900 statt 23 Iterationen.

## Einfache Datensätze

„Verarbeitete Punkte“ nennt die Punkte bis zur Trenngeraden mit den Standardwerten (w₁ = w₂ = θ = 1, ohne Lernrate), „Skaliert“ dasselbe mit eingeschalteter Skalierung. Sie ist nicht immer schneller.

<!-- BEGIN:einfach -->
| Datei | Titel | Punkte | Attribute | Labels | Trennbar | Verarbeitete Punkte | Skaliert |
|---|---|---:|---|---|---|---:|---:|
| `logik-and.csv` | AND | 4 | Eingang A; Eingang B | 0 / 1 | ja | 20 | 20 |
| `logik-or.csv` | OR | 4 | Eingang A; Eingang B | 0 / 1 | ja | 4 | 4 |
| `logik-xor.csv` | XOR | 4 | Eingang A; Eingang B | 0 / 1 | nein | keine | keine |
| `pruefung.csv` | Prüfung bestanden | 12 | Lernstunden; Schlafstunden | bestanden / durchgefallen | ja | 180 | 12 |
| `obst.csv` | Apfel oder Birne | 20 | Breite in cm; Höhe in cm | Apfel / Birne | ja | 60 | 80 |
| `kredit.csv` | Kreditentscheidung 1 | 30 | Einkommen in Tsd. €; Schulden in 10 Tsd. € | genehmigt / abgelehnt | ja | 60 | 180 |
| `spam.csv` | Spam-Filter | 50 | Anzahl Links; Anzahl Signalwörter | Spam / kein Spam | ja | 150 | 200 |
| `kuendigung.csv` | Kundenabwanderung | 40 | Vertragsjahre; Beschwerden | kündigt / bleibt | nein | keine | keine |
<!-- END:einfach -->

## Mehrstufige Beispiele

Jede Stufe liegt in einer eigenen Datei und enthält **nur ihre neuen Punkte**. Die Zeilen stehen in der Reihenfolge der Punktgruppen. Beim Hochladen von Hand werden die Dateien nacheinander mit „ergänzen“ geladen; die Gruppennamen gibt es dann allerdings nicht, weil die CSV-Dateien genau drei Spalten haben.

„Neubeginn“ und „Weitertrainieren“ nennen die verarbeiteten Punkte bis zur Trenngeraden mit den Standardwerten. Beim Weitertrainieren beginnt jede Stufe mit dem Endstand der vorigen. „Neubeginn skaliert“ gilt mit eingeschalteter Skalierung. „keine“ bedeutet: Es gibt keine Trenngerade, das Training endet nicht von selbst. Der Ablauf im Unterricht steht in `../README.md`, Abschnitt „Mehrstufige Beispiele“.

<!-- BEGIN:stufen -->
### Kreditentscheidung 2

Attribute: Einkommen in Tsd. €; Entfernung zur Innenstadt in 10 km. Labels: genehmigt / abgelehnt. Das Perzeptron feuert bei „genehmigt“ (erstes Label der Datei).

| Stufe | Datei | Neue Punktgruppen (Anzahl) | Neu | Gesamt | Trennbar | Neubeginn | Weitertrainieren | Neubeginn skaliert |
|---:|---|---|---:|---:|---|---:|---:|---:|
| 1 | `kredit-verzerrt-1-innenstadt.csv` | Innenstadt (12) | 12 | 12 | ja | 48 | 48 | 12 |
| 2 | `kredit-verzerrt-2-aussenbezirke.csv` | Außenbezirk, historisch (6) | 6 | 18 | ja | 126 | 162 | 126 |
| 3 | `kredit-verzerrt-3-neue-entscheidungen.csv` | Außenbezirk, neu (6) | 6 | 24 | nein | keine | keine | keine |

### Hunde: klein oder groß

Attribute: Schulterhöhe in dm; Gewicht in 10 kg. Labels: Großhund / Kleinhund. Das Perzeptron feuert bei „Großhund“ (erstes Label der Datei).

| Stufe | Datei | Neue Punktgruppen (Anzahl) | Neu | Gesamt | Trennbar | Neubeginn | Weitertrainieren | Neubeginn skaliert |
|---:|---|---|---:|---:|---|---:|---:|---:|
| 1 | `hunde-1-grundbestand.csv` | Labrador (6), Chihuahua (6) | 12 | 12 | ja | 36 | 36 | 12 |
| 2 | `hunde-2-beagle.csv` | Beagle (6) | 6 | 18 | ja | 144 | 126 | 18 |
| 3 | `hunde-3-bulldogge-whippet.csv` | Französische Bulldogge (6), Whippet (6) | 12 | 30 | ja | 690 | 1620 | 30 |
| 4 | `hunde-4-mischlinge.csv` | Mischling (6) | 6 | 36 | nein | keine | keine | keine |

### Fahrzeuge: Pkw oder Lkw

Attribute: Länge in m; Leermasse in t. Labels: Lkw / Pkw. Das Perzeptron feuert bei „Lkw“ (erstes Label der Datei).

| Stufe | Datei | Neue Punktgruppen (Anzahl) | Neu | Gesamt | Trennbar | Neubeginn | Weitertrainieren | Neubeginn skaliert |
|---:|---|---|---:|---:|---|---:|---:|---:|
| 1 | `fahrzeuge-1-grundbestand.csv` | Sattelzug (6), Kleinwagen (6) | 12 | 12 | ja | 36 | 36 | 12 |
| 2 | `fahrzeuge-2-suv-verteiler.csv` | SUV (6), Verteiler-Lkw (6) | 12 | 24 | ja | 168 | 144 | 192 |
| 3 | `fahrzeuge-3-limousine-kipper.csv` | Stretchlimousine (3), Kurzer Kipper (3) | 6 | 30 | ja | 2880 | 30 | 900 |
<!-- END:stufen -->

## Neue Beispiele und Stufen ergänzen

Die Angaben stehen an einer Stelle, in `sync-samples.mjs` der Entwicklungswerkzeuge (Liste `SAMPLES`).

1. CSV-Datei hier anlegen. Bei einer Stufe enthält sie nur die neuen Punkte, nach Punktgruppen geordnet.
2. In `SAMPLES` die Stufe mit Titel, Wortlaut der Schaltfläche, Erklärung, Punktgruppen und Trennbarkeit eintragen. Die Summe der Gruppen muss zur Zeilenzahl passen.
3. Die erwarteten Zahlen eintragen (`expected`, für die Skalierung `SCALED`). `samples.test.js` rechnet sie nach und nennt bei einer Abweichung den richtigen Wert.
4. `node sync-samples.mjs` ausführen. Das erzeugt `src/js/samples.js` und die beiden Tabellen oben. Die Tabellen nicht von Hand ändern.
