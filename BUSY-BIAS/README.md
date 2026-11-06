# BUSY BIAS – SCORM-1.2-Lernpaket zum Perzeptron

**BUSY BIAS** steht für **B**rain **U**nder **S**imple **Y**ardstick: **B**ias **I**nfluences **A**ctivation **S**tart.
Das Paket ist ein Perzeptron-Simulator: Lernende verfolgen das Training Schritt für Schritt, lesen jede Rechnung im Protokoll nach und klassifizieren eigene Punkte.
Es läuft vollständig im Browser, lädt keine externen Ressourcen und verwendet keine externen Bibliotheken.

## Inhalt für den Unterricht

| Seite | Inhalt |
|---|---|
| 1 Daten und Perzeptron | Links CSV-Datei oder Beispiel laden, einzelne Punkte hinzufügen, Perzeptron konfigurieren (feuerndes Label, Startwerte, Lernrate), darunter die Definition der Heaviside-Funktion. Rechts die Punkte mit der Geraden des konfigurierten Perzeptrons, Decision Areas auf Wunsch, Legende und Geradengleichung, darunter die Liste der Punkte mit Entfernen |
| 2 Training | Links das Perzeptron mit Eingängen, Gewichten, Σ, Heaviside-Symbol, dem von unten zugeführten θ und der Ausgabe, darunter Steuerung, Rechnungen des Schritts und Zähler. Rechts die Punkte mit Gerade, Decision Areas auf Wunsch, Legende und Geradengleichung. Darunter aufklappbar alle Trainingspunkte |
| 3 Protokoll | Scrollbar, älteste Einträge oben: je Trainingspunkt die Werte vor der Rechnung, gewichtete Summe, Aktivierung, Fehler, Anpassung und Geradengleichung |
| 4 Punkt klassifizieren | Links Maske und Rechnung mit dem Urteil korrekt oder falsch. Rechts Punkte, aktuelle Gerade, Decision Areas und der eingegebene Punkt. Ein Hinweis erscheint, solange keine Trenngerade gefunden wurde |

Zwischen den Seiten kann jederzeit gewechselt werden, auch mitten in einem Trainingspunkt. Der Stand bleibt dabei erhalten; eine laufende Automatik hält an.

### Rechenregel

Gerechnet und dargestellt wird mit dem **Schwellenwert θ**, nicht mit einem Bias. Einzige Aktivierungsfunktion ist die **Heaviside-Funktion**.

- Gewichtete Summe: `a = w₁·x₁ + w₂·x₂`
- Ausgabe: `f(a) = 1`, wenn `a ≥ θ`, sonst `f(a) = 0`
- Fehler: `δ = t − f(a)`; dabei ist `t = 1` beim feuernden Label und `t = 0` beim anderen
- Nur bei `δ ≠ 0`: `wᵢ ← wᵢ + α·δ·xᵢ` und `θ ← θ − α·δ`
- Gerade: `w₁·x₁ + w₂·x₂ = θ`, angezeigt als `x₂ = m·x₁ + b`. Bei `w₂ = 0` ist sie senkrecht (`x₁ = θ/w₁`), bei `w₁ = w₂ = 0` gibt es keine Gerade, und die ganze Fläche hat dieselbe Farbe.

Alle Koordinatensysteme schließen den Nullpunkt ein, damit beide Achsen zu sehen sind und sich die Lage der Geraden einordnen lässt.

Eine **Iteration** ist ein Durchlauf durch alle Punkte in der Reihenfolge der Tabelle. Die **Trenngerade gilt als gefunden**, wenn eine ganze Iteration ohne Anpassung durchläuft („n von n“). Der Zähler enthält diesen letzten Prüfdurchlauf.

Gewichte, θ und Summen werden auf zehn Nachkommastellen gerundet, damit Darstellungsfehler von Gleitkommazahlen keine Klassifikation verfälschen. Angezeigt werden höchstens vier Nachkommastellen.

### Konfiguration (Seite 1)

- **Startgewichte** w₁, w₂ und **Startschwellenwert** θ: voreingestellt 1, frei eingebbar. **Zufällig belegen** setzt alle drei auf ganze Zahlen von −5 bis 5.
- **Lernrate α:** optional zuschaltbar, dann frei wählbar (mindestens 0,0001, voreingestellt 0,1). Ein Klick ins Feld oder eine Eingabe dort schaltet sie ein. Ohne Lernrate gilt α = 1, und α erscheint nicht in den Formeln.
- **Mausrad:** Nach einem Klick in eines dieser Felder ändert auch das Mausrad den Wert. w₁, w₂ und θ ändern sich um 1. Bei α richtet sich die Schrittweite nach der Größenordnung, höchstens 0,1 (zum Beispiel 0,2 → 0,1 → 0,09 und 0,01 → 0,009). Über einem Feld ohne Fokus scrollt das Rad nur die Seite.
- **Feuerndes Label:** Bei Zahlen ist das größere Label voreingestellt, sonst das erste der Datei.
- Die Visualisierung zeigt sofort die Gerade dieser **Startwerte**, auch während des Trainings; den aktuellen Stand zeigen die Seiten 2 und 4. Der Schalter für die Decision Areas gilt für die Seiten 1 und 2 gemeinsam.
- Jede Änderung auf Seite 1 setzt Training und Protokoll zurück. Ausnahme ist der Stufenwechsel mit „weitertrainieren“.

### Ablauf des Trainings (Seite 2)

Je Trainingspunkt gibt es diese Schritte; ein Klick auf **Weiter** führt einen aus. Eingänge bleiben leere Kreise, bis sie belegt sind; Summe und Ausgabe stehen erst in der Zeichnung, wenn sie berechnet sind.

1. Der Punkt wird im Koordinatensystem und in der Tabelle hervorgehoben.
2. Die Eingänge im Perzeptron werden vorbelegt.
3. Die gewichtete Summe a erscheint am Summenzeichen.
4. Die Ausgabe f(a) erscheint, dazu erwartetes und berechnetes Label.
5. Nur bei einem Fehler: Gewichte und θ werden angepasst, geänderte Werte sind hervorgehoben, Gerade und Decision Areas werden neu gezeichnet.

| Steuerung | Wirkung |
|---|---|
| **Weiter** | ein Schritt; hält eine laufende Automatik an |
| **[N] Iterationen rechnen** | rechnet 1 bis 1000 Iterationen ohne Zwischenanzeige. Eine angefangene Iteration wird beendet und zählt als erste |
| **Automatisch / Pause** | Einzelschritte im gewählten Tempo (2 s, 1 s, 0,5 s, 0,1 s), bis die Trenngerade gefunden ist oder angehalten wird |
| **Zurücksetzen** | beginnt mit den Startwerten von Seite 1 neu und leert das Protokoll |

Die Zähler nennen die Iteration, die verarbeiteten Punkte und wie viele Punkte in der letzten abgeschlossenen Iteration richtig waren. Bei nicht trennbaren Daten läuft die Automatik bis zum Anhalten; ab 100 Iterationen erscheint ein Hinweis.

### Punkt klassifizieren (Seite 4)

- Die Rechnung verwendet immer die aktuellen Gewichte und θ, also den Stand von Seite 2. Vor dem ersten Training sind das die Startwerte.
- Das Urteil korrekt oder falsch setzt ein erwartetes Label voraus; bei „keine Angabe“ erscheint nur die Klassifikation.
- Der Punkt wird nur geprüft: Er kommt nicht in die Trainingsdaten, ändert keine Gewichte und erscheint nicht im Protokoll.
- Er erscheint als Raute im Diagramm. Liegt er außerhalb der Daten, wird der Ausschnitt erweitert.
- Eingabe und Punkt bleiben beim Seitenwechsel erhalten und werden mit den dann gültigen Werten neu berechnet.
- Solange keine Trenngerade gefunden wurde, steht oben ein Hinweis, das Training zu Ende zu führen. Er sperrt nichts. Er verschwindet mit der Trenngeraden und erscheint nach dem Zurücksetzen oder einem Stufenwechsel wieder.

### Dateiformat für den Upload

```
Lernstunden;Schlafstunden;Label
8,5;7;bestanden
2;5,5;durchgefallen
```

- Nur `.csv`, höchstens 2 MB. Die erste Zeile ist Pflicht: zwei Attributnamen und `Label`. Ohne gültige Kopfzeile wird die Datei abgelehnt.
- Danach je Zeile zwei Zahlen von −1000 bis 1000 und ein Label. Trennzeichen: Semikolon, Komma oder Tabulator. Dezimalkomma ist beim Semikolon möglich.
- Höchstens 500 Punkte und zwei verschiedene Labels mit beliebigen Bezeichnern (Buchstaben, Ziffern, Leerzeichen, `. _ -`; bis 30 Zeichen).
- Fehlerhafte Zeilen werden mit Zeilennummer gemeldet und übersprungen.
- Vor dem Hochladen ist wählbar, ob vorhandene Punkte **ersetzt** oder **ergänzt** werden. Beim Ergänzen bleiben die bisherigen Attributnamen bestehen.

Große Zahlen verlangsamen das Training stark, weil die Lernregel θ je Anpassung nur um α ändert, die Gewichte aber um α·x. Werte um 1 bis 10 eignen sich am besten; Einzelheiten stehen in [testdata/README.md](testdata/README.md).

## Beispiele

Die Beispielauswahl auf Seite 1 enthält acht einfache Datensätze mit 4 bis 50 Punkten, darunter zwei ohne Trenngerade (XOR, Kundenabwanderung), und zwei mehrstufige Beispiele. Alle Dateien, Attribute, Labels und die zu erwartenden Zahlen stehen in [testdata/README.md](testdata/README.md). Die Werte sind selbst erzeugt und an typische Größenordnungen angelehnt; es sind keine Messdaten.

## Mehrstufige Beispiele

Die mehrstufigen Beispiele zeigen, **wie zusätzliche Trainingspunkte das Training beeinflussen**. Jede Stufe ergänzt die vorherigen um neue Punktgruppen.

### Bedienung

1. Auf Seite 1 das Beispiel laden. Es beginnt mit Stufe 1; auf den Seiten 1 und 2 erscheint eine Karte mit einer kurzen Erklärung zur Stufe.
2. Auf Seite 2 trainieren, bis die Trenngerade gefunden ist.
3. Vor dem Wechsel wählen, wie es weitergeht, und in der Karte die nächste Stufe laden:
   - **Mit aktuellen Gewichten weitertrainieren** (voreingestellt): Die vorhandene Gerade bleibt zunächst stehen, das Protokoll läuft mit einer Zwischenüberschrift weiter. Das zeigt, wie die neuen Punkte die Gerade verändern.
   - **Mit den Startwerten neu beginnen:** Das Training beginnt von vorn, das Protokoll wird geleert. Das zeigt den Aufwand für die größere Punktmenge.
4. Die neuen Punkte sind im Koordinatensystem gestrichelt umrandet, bis die nächste Stufe geladen wird. In der Tabelle stehen Stufe und Gruppe.
5. Der **Vergleich der Stufen** auf Seite 2 hält je Stufe fest: Anzahl der Punkte, Startwerte, verarbeitete Punkte bis zur Trenngeraden und die Werte am Ende. Wurde eine Stufe angehalten oder übersprungen, steht dort „keine Trenngerade nach N Punkten“ bzw. „–“.

Das Beispiel neu zu laden beginnt wieder bei Stufe 1. Änderungen an Punkten oder Einstellungen setzen das Training der aktuellen Stufe zurück; die Stufe bleibt, frühere Zeilen im Vergleich auch. Ein Upload und „Alle entfernen“ beenden das Beispiel.

Die Zahlen unten beziehen sich auf die Standardwerte (w₁ = w₂ = θ = 1, ohne Lernrate). Die genauen Werte je Stufe stehen in [testdata/README.md](testdata/README.md); ein Test rechnet sie nach. Andere Startwerte ergeben andere Zahlen, oft auch eine andere Rangfolge.

### Hunde: klein oder groß

Attribute: Schulterhöhe in dm, Gewicht in 10 kg. Das Perzeptron feuert bei „Großhund“.

| Stufe | Neue Punkte | Was zu beobachten ist | Frage an die Lernenden |
|---:|---|---|---|
| 1 | Labrador, Chihuahua | Die Gruppen liegen weit auseinander, nach wenigen Iterationen ist die Trenngerade gefunden. Sie verläuft fast waagerecht: Das Gewicht genügt | Warum gibt es viele mögliche Trenngeraden? Welche findet das Training, und wovon hängt das ab? |
| 2 | Beagle (Kleinhund) | Die neuen Punkte liegen auf der falschen Seite, die Gerade muss sich verschieben. Der Aufwand steigt deutlich | Welche Punkte lösen Anpassungen aus? Liegt die neue Gerade näher an den Großhunden? |
| 3 | Französische Bulldogge (Kleinhund), Whippet (Großhund) | Klein und schwer gegen groß und leicht: Das Gewicht allein trennt nicht mehr, die Gerade muss sich drehen. Das Training dauert ein Vielfaches. Hier ist der Neubeginn sogar schneller als das Weitertrainieren | Warum hilft eine schon gefundene Gerade hier nicht? Welches Attribut wird wichtiger? |
| 4 | Mischlinge (uneinheitlich eingeschätzt) | Die Gruppen überschneiden sich. Es gibt keine Trenngerade mehr: Die Automatik läuft bis zum Anhalten, nach 100 Iterationen erscheint ein Hinweis | Woran erkennt man, dass das Training nicht mehr endet? Was müsste ein Modell können, das diese Punkte trennt? |

### Fahrzeuge: Pkw oder Lkw

Attribute: Länge in m, Leermasse in t. Das Perzeptron feuert bei „Lkw“.

| Stufe | Neue Punkte | Was zu beobachten ist | Frage an die Lernenden |
|---:|---|---|---|
| 1 | Sattelzug, Kleinwagen | Die Gruppen liegen weit auseinander, die Trenngerade ist schnell gefunden | Warum genügen hier wenige Iterationen? |
| 2 | SUV (Pkw), Verteiler-Lkw (Lkw) | Die Gruppen rücken zusammen, die bisherige Gerade passt nicht mehr und verschiebt sich | Welche der neuen Punkte liegen zunächst falsch? |
| 3 | Stretchlimousine (Pkw), kurzer Kipper (Lkw) | Lang, aber Pkw; kurz, aber Lkw: Die Länge allein reicht nicht mehr. Beim Weitertrainieren liegen alle neuen Punkte schon richtig, die erste Iteration ist fehlerfrei. Ein Neubeginn dauert dagegen sehr viel länger | Warum lohnt es sich hier, weiterzutrainieren, bei den Hunden in Stufe 3 aber nicht? |

Die Einteilungen sind für den Unterricht vereinfacht. Gewicht und Länge streuen in der Wirklichkeit stärker, und „klein“ oder „groß“ ist keine feste Rasseneinteilung.

## Aufbau

```
BUSY-BIAS/
├── README.md
├── preview/                 Vorschaubilder
├── testdata/                CSV-Dateien aller Beispiele, README.md mit allen Angaben
└── src/                     Inhalt des SCORM-Pakets
    ├── index.html           Einstiegsseite mit den vier Seiten
    ├── imsmanifest.xml      SCORM-Manifest
    ├── LICENSE.txt
    ├── css/                 base.css und sim.css (aus shared/), style.css
    └── js/
        ├── format-utils.js      Geradengleichung und Rechenzeilen
        ├── perceptron.js        Rechenregel, Geometrie, Trainer (ohne Zugriff auf die Seite)
        ├── perceptron-view.js   Zeichnung des Perzeptrons
        ├── session.js           Datensatz, Einstellungen, Trainer, Protokoll, Stufenvergleich
        ├── samples.js           Beispiele (erzeugt aus testdata/)
        ├── app.js               Start, Navigation, SCORM
        ├── pages/               je Seite ein Modul, dazu common.js
        └── …                    Kopien aus shared/ (siehe unten)
```

Die Bausteine des Simulators (Datensatz, Import, Eingabe, Koordinatensystem, Neuronenzeichnung, Steuerung, Protokoll, Klassifikation, Aktivierungsfunktionen) stehen in [`shared/`](../shared/README.md), weil sie auch der geplante Simulator für neuronale Netze nutzen soll. Paketspezifisch sind nur die Lernregel, die Texte und die Seiten.

## Paket erstellen und in Moodle einbinden

Das SCORM-Paket ist ein ZIP-Archiv mit dem **Inhalt** des Ordners `src/`. `imsmanifest.xml` muss dabei direkt in der obersten Ebene des ZIP liegen, nicht in einem Unterordner `src/`. Das fertige Paket entsteht als `dist/busy-bias.zip` im Stamm des Repositorys.

So wird das Paket in Moodle eingebunden:
1. Kurs → *Aktivität oder Material anlegen* → **Lernpaket (SCORM)**.
2. `busy-bias.zip` hochladen.
3. **Abschluss:** In den Einstellungen der Aktivität unter *Aktivitätsabschluss* „Teilnehmer/innen können die Aktivität manuell als abgeschlossen markieren“ einstellen. Das Paket meldet `incomplete`, damit Moodle beim erneuten Öffnen nicht den Überprüfungsmodus zeigt.

Trainingspunkte, Einstellungen und Training werden **nicht gespeichert**: Nach dem Schließen beginnt das Paket wieder leer.

## Sicherheits- und Datenschutzkonzept

- Strenge Content-Security-Policy mit Trusted Types: Es laufen nur Skripte aus dem Paket, es gibt keine Netzwerkzugriffe und keine externen Ressourcen.
- Hochgeladene Dateien werden nur gelesen: Endung, Größe und Binärinhalt werden geprüft, alle Inhalte erscheinen ausschließlich als Text. Meldungen nennen Zeilennummern, nie den Rohinhalt.
- An die Lernplattform gehen nur `cmi.core.lesson_status` und `cmi.core.exit`. Der Name der Lernenden wird nicht gelesen; hochgeladene Daten verlassen den Browser nicht.

## Qualitätssicherung

Vor jeder Veröffentlichung wird das Paket mit nicht veröffentlichten Entwicklungswerkzeugen gebaut und getestet. Die automatischen Tests laufen in Chromium und prüfen unter anderem einen von Hand gerechneten AND-Lauf, jede Stufe gegen die dokumentierten Zahlen, jeden Baustein ohne Perzeptron und die Bedienung aller Seiten.
