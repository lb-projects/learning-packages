# BUSY BIAS – SCORM-1.2-Lernpaket zum Perzeptron

**BUSY BIAS** steht für **B**rain **U**nder **S**imple **Y**ardstick: **B**ias **I**nfluences **A**ctivation **S**tart.
Das Paket ist ein Perzeptron-Simulator: Lernende verfolgen das Training Schritt für Schritt, lesen jede Rechnung im Protokoll nach, klassifizieren eigene Punkte, rechnen das Training selbst von Hand und prüfen das Ergebnis mit Testdaten.
Es läuft vollständig im Browser, lädt keine externen Ressourcen und verwendet keine externen Bibliotheken.

## Inhalt für den Unterricht

| Seite | Inhalt |
|---|---|
| 1 Daten und Perzeptron | Links CSV-Datei oder Beispiel laden, einzelne Punkte hinzufügen, Perzeptron konfigurieren (feuerndes Label, Startwerte, Lernrate), darunter die Definition der Heaviside-Funktion. Rechts die Punkte mit der Geraden des konfigurierten Perzeptrons, Decision Areas auf Wunsch, Legende und Geradengleichung, darunter die Liste der Punkte mit Entfernen |
| 2 Training | Links das Perzeptron mit Eingängen, Gewichten, Σ, Heaviside-Symbol, dem von unten zugeführten θ und der Ausgabe, darunter Steuerung, Rechnungen des Schritts und Zähler. Rechts die Punkte mit Gerade, Decision Areas auf Wunsch, Legende und Geradengleichung. Darunter aufklappbar alle Trainingspunkte |
| 3 Protokoll | Scrollbar, älteste Einträge oben: je Trainingspunkt die Werte vor der Rechnung, gewichtete Summe, Aktivierung, Fehler, Anpassung und Geradengleichung |
| 4 Punkt klassifizieren | Links Maske und Rechnung mit dem Urteil korrekt oder falsch. Rechts Punkte, aktuelle Gerade, Decision Areas und der eingegebene Punkt. Ein Hinweis erscheint, solange keine Trenngerade gefunden wurde |
| 5 Von Hand rechnen | Aufgabe von Seite 1 übernehmen oder zufällig erzeugen; Tabelle Zeile für Zeile selbst ausfüllen, mit Prüfung, Hinweisen, Hilfestufen und Speicherung. Darunter aufklappbar Visualisierung und Trainingspunkte |
| 6 Test und Konfusionsmatrix | Zufällige Testdaten zurückhalten, ohne sie trainieren, im Testmodus klassifizieren und das Ergebnis in einer Konfusionsmatrix ablesen |

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
- Die Seiten 2 bis 4 und 6 übernehmen Änderungen sofort, Seite 5 nur auf ausdrücklichen Wunsch.
- **Eingabedaten skalieren:** rechnet jedes Attribut mit x′ = (x − min) / (max − min) auf den Bereich 0 bis 1 um; voreingestellt aus. Siehe den Abschnitt „Skalierung“.
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

**Reihenfolge mischen:** Der Schalter „Punkte in jeder Iteration zufällig mischen“ unter der Steuerung setzt das Training zurück und verwendet je Iteration eine neue Reihenfolge. Ergebnisfeld und Protokoll nennen dann die Stelle und die Nummer, etwa „Schritt 3 von 8: Punkt Nr. 5“. So lässt sich zeigen, dass dieselben Daten zu einer anderen Geraden führen können; zum Vergleich genügt „Zurücksetzen“. Die Seiten 5 und 6 behalten die feste Reihenfolge, die dokumentierten Zahlen der Beispiele gelten für den Schalter aus.

**Lernkurve:** Aufklappbar unter den Hauptfeldern. Sie zeigt die richtig klassifizierten Punkte je Iteration und wächst mit jeder abgeschlossenen Iteration, bei allen drei Steuerungsarten und auch im zugeklappten Zustand. Eine angefangene Iteration zählt noch nicht. Sehr lange Läufe werden zum Zeichnen ausgedünnt (höchstens 200 Punkte). Zurücksetzen und ein Stufenwechsel beginnen eine neue Kurve.

### Skalierung

Die Originaldaten bleiben unverändert. Ist der Schalter an, rechnen und zeichnen alle Seiten mit den skalierten Werten, auf vier Nachkommastellen gerundet. Was angezeigt wird, ist damit genau das, womit gerechnet wird.

- **Seite 1:** Das Koordinatensystem zeigt die skalierten Werte, die Punkteliste weiter die Originalwerte.
- **Seiten 2, 5 und 6:** Die Tabellen zeigen beide Werte. Das Protokoll nennt das Original in Klammern.
- **Seite 4:** Eingegeben wird in Originaleinheiten, die Rechnung zeigt die Umrechnung. Ein Punkt außerhalb der Daten liegt außerhalb von 0 bis 1.
- **Seite 6:** Minimum und Maximum stammen nur aus den Trainingspunkten, damit die Testdaten nicht ins Training einfließen. Testpunkte können deshalb außerhalb von 0 bis 1 liegen.
- **Mehrstufige Beispiele:** Neue Punkte können Minimum und Maximum ändern, dann verschieben sich auch die alten Punkte. Beim Weitertrainieren weist Seite 2 darauf hin.

**Skalierung ist kein Allheilmittel.** Mit den Standardwerten sinkt der Aufwand bei den Hunden in Stufe 3 von 690 auf 30 verarbeitete Punkte und bei „Prüfung bestanden“ von 180 auf 12. Bei den Fahrzeugen in Stufe 3 sind es 900 statt 2880. Bei „Kreditentscheidung 1“ steigt er dagegen von 60 auf 180, bei den Fahrzeugen in Stufe 2 von 168 auf 192. Das eignet sich als Frage an die Lernenden: Wann lohnt sich das Skalieren? Alle Zahlen stehen in [testdata/README.md](testdata/README.md).

### Punkt klassifizieren (Seite 4)

- Die Rechnung verwendet immer die aktuellen Gewichte und θ, also den Stand von Seite 2. Vor dem ersten Training sind das die Startwerte.
- Das Urteil korrekt oder falsch setzt ein erwartetes Label voraus; bei „keine Angabe“ erscheint nur die Klassifikation.
- Der Punkt wird nur geprüft: Er kommt nicht in die Trainingsdaten, ändert keine Gewichte und erscheint nicht im Protokoll.
- Er erscheint als Raute im Diagramm. Liegt er außerhalb der Daten, wird der Ausschnitt erweitert.
- Eingabe und Punkt bleiben beim Seitenwechsel erhalten und werden mit den dann gültigen Werten neu berechnet.
- Solange keine Trenngerade gefunden wurde, steht oben ein Hinweis, das Training zu Ende zu führen. Er sperrt nichts. Er verschwindet mit der Trenngeraden und erscheint nach dem Zurücksetzen oder einem Stufenwechsel wieder.

### Von Hand rechnen (Seite 5)

Die Seite ist von den übrigen Seiten **entkoppelt** und rechnet mit einer eigenen Aufgabe. Oben stehen zwei Schaltflächen:

- **Daten von Seite 1 übernehmen** kopiert Punkte, Startwerte, Lernrate und Skalierung auf dem aktuellen Stand.
- **Neue Zufallsaufgabe** erzeugt eine eigene Aufgabe in der gewählten Schwierigkeit.

Ist die Tabelle in Arbeit, fragen beide vorher nach. Änderungen auf anderen Seiten lassen die Tabelle unberührt und lösen keine Abfrage aus. Weicht Seite 1 von der übernommenen Aufgabe ab, erscheint nur ein Hinweis.

**Tabelle:** Die Spalten sind (x₁ | x₂), Label t, Gewicht w₁, Gewicht w₂, Schwellenwert θ, Gew. Summe a, f(a), Neues w₁, Neues w₂ und Neues θ. Punkt und Label gibt das System vor, alles andere tragen die Lernenden ein.

- Nur die offene Zeile hat Eingabefelder. **Prüfen** oder die Eingabetaste prüft sie. Ist sie richtig, steht sie fest, und die nächste Zeile erscheint. Ist sie falsch, bleibt sie offen; falsche Felder sind markiert, und unter der Zeile stehen Hinweise.
- Nach einer ganzen Iteration ohne Anpassung endet die Tabelle mit einem Erfolgshinweis. Nicht trennbare Daten haben kein Ende; ab 100 Iterationen erscheint ein Hinweis.
- **Spalten „Neu“, je Feld einzeln:** Frei bedeutet „bleibt gleich“. Das gilt auch bei einer Anpassung für ein Gewicht, das sich nicht ändert (xᵢ = 0). Der alte Wert darf auch eingetragen werden.
- **Hinweise stufenweise:** erst w₁, w₂, θ, dann a, dann f(a), zuletzt die neuen Werte. So verwirren keine Folgefehler. Die automatischen Hinweise nennen Ort und Art des Fehlers, nie den richtigen Wert.
- **Fehlversuche:** Rechenfehler zählen, Schreibfehler nicht (leeres Pflichtfeld, keine Zahl, f(a) außer 0 und 1).
- **Rundung:** Ein Wert ist richtig, wenn er dem genauen Wert gerundet entspricht, auf mindestens zwei Nachkommastellen: 5,77 ist richtig bei 5,7712, 5,8 ist falsch. Ein neuer Wert, der dem alten gleicht, obwohl er sich ändern müsste, ist falsch. So geht eine sehr kleine Lernrate nicht unter. Weitergerechnet wird immer mit dem genauen Wert.

**Hilfe:** Nach zwei Fehlversuchen in derselben Zeile erscheint „Hilfe anzeigen“. Sie bezieht sich auf den Fehler der letzten Prüfung und öffnet sich schrittweise. Am Beispiel „neues w₂“:

| Stufe | Inhalt | Beispiel |
|---:|---|---|
| 1 | Regel | Neues w₂ = w₂ + δ · x₂ |
| 2 | Rechenweg ohne Ergebnis | Neues w₂ = 1 + (−1) · 1 = ? |
| 3 | Ergebnis | Neues w₂ = 0 |

Die Hilfe trägt nichts in die Felder ein. Jede geöffnete Stufe zählt unter „Genutzte Hilfen“. Findet die nächste Prüfung einen Fehler in einer anderen Prüfstufe, beginnt die Hilfe dort neu. Sie lässt sich nicht abschalten.

**Zufallsaufgaben:** Jede Person erhält eine eigene Aufgabe mit einfachen Zahlen. Jede Aufgabe ist trennbar, enthält mindestens eine Anpassung und ändert nichts an den anderen Seiten. Die Skalierung gilt hier nicht.

| Schwierigkeit | Punkte | Werte | Lernrate | Zeilen höchstens |
|---|---:|---|---|---:|
| Leicht | 4 | ganze Zahlen von 0 bis 3 | ohne | 12 |
| Mittel | 6 | ganze Zahlen von −3 bis 3 | ohne | 24 |
| Schwer | 8 | ganze Zahlen von −5 bis 5 | α = 0,5 | 40 |

**Visualisierung:** Aufklappbar unter der Tabelle zeigt ein Koordinatensystem die Punkte der Aufgabe, die Gerade nach der letzten richtigen Zeile und auf Wunsch die Decision Areas. Der Punkt der offenen Zeile ist hervorgehoben. Darunter ist die Punkteliste aufklappbar.

### Test und Konfusionsmatrix (Seite 6)

Die Seite arbeitet mit einem eigenen Trainer und ändert nichts an den Seiten 1 bis 5. Seite 2 und das Protokoll trainieren weiter mit allen Punkten.

1. **Testdaten auswählen:** Anteil von 1 bis 90 % (Standard 20 %). Die Auswahl ist zufällig, aber je Label getrennt, und jedes Label behält mindestens einen Trainingspunkt.
2. **Modus „Training“:** Bedienung wie auf Seite 2, nur mit den Trainingspunkten. Testpunkte erscheinen als Hohlmarker.
3. **Modus „Test“:** verfügbar, sobald das Training begonnen hat; ohne Trenngerade nennt ein Hinweis den vorläufigen Stand. Gewichte und θ sind fest. **Nächster Testpunkt** zeigt die Rechnung, **Alle klassifizieren** erledigt den Rest. Falsch klassifizierte Punkte sind rot umrandet. Wird danach weitertrainiert, verfällt das Testergebnis.
4. **Konfusionsmatrix:** erscheint, sobald alle Testpunkte klassifiziert sind. Zeilen sind das tatsächliche, Spalten das berechnete Label. Darunter stehen die Genauigkeit und der Vergleich „Training: x von n, Test: y von m“.

Eine Änderung auf Seite 1, die die Rechnung betrifft, führt zurück zur Auswahl.

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

Die Beispielauswahl auf Seite 1 enthält acht einfache Datensätze mit 4 bis 50 Punkten, darunter zwei ohne Trenngerade (XOR, Kundenabwanderung), und drei mehrstufige Beispiele. Alle Dateien, Attribute, Labels und die zu erwartenden Zahlen stehen in [testdata/README.md](testdata/README.md). Die Werte sind fiktiv und an typische Größenordnungen angelehnt; es sind keine Messdaten.

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

### Kreditentscheidung 2

Attribute: Einkommen in Tsd. €, Entfernung zur Innenstadt in 10 km. Das Perzeptron feuert bei „genehmigt“. Das Beispiel zeigt, wie ein Modell eine Verzerrung aus seinen Trainingsdaten übernimmt. In der Auswahl trägt es bewusst keinen Hinweis darauf, damit die Lernenden es selbst entdecken können. Es ist **fiktiv und vereinfacht** und bildet keine reale Kreditvergabe ab. Die Entfernung steht stellvertretend für den Wohnort; es kommen keine geschützten Merkmale, keine realen Orte und keine realen Gruppen vor.

| Stufe | Neue Punkte | Was zu beobachten ist | Frage an die Lernenden |
|---:|---|---|---|
| 1 | Anträge aus der Innenstadt, nach dem Einkommen entschieden | Die Gerade trennt vernünftig. Die Prüfpunkte (6 \| 0,3) und (6 \| 2,8) sind beide genehmigt | Woran erkennt man, dass das Modell gut arbeitet? |
| 2 | Historische Anträge aus den Außenbezirken: gutes Einkommen, trotzdem abgelehnt | Die Gerade kippt, das Gewicht der Entfernung wird negativ. Bei gleichem Einkommen wird der entfernte Prüfpunkt jetzt abgelehnt | Woher kommt diese Regel? Wer hat sie dem Modell beigebracht? |
| 3 | Neue Anträge aus den Außenbezirken, nach dem Einkommen entschieden | Sie widersprechen den alten Entscheidungen, es gibt keine Trenngerade mehr | Warum helfen mehr Daten hier nicht? Was müsste man an den alten Daten ändern? |

So lässt es sich im Unterricht einsetzen:
- **Seite 4, Prüfpaar:** Die Punkte (6 | 0,3) und (6 | 2,8) nach jeder Stufe klassifizieren. Beide haben dasselbe Einkommen.
- **Seite 6:** In Stufe 2 Testdaten auswählen und testen. Die Genauigkeit kann hoch sein, weil auch die Testdaten aus den verzerrten Entscheidungen stammen. Merksatz: Hohe Genauigkeit heißt nicht fair.
- **Diskussion:** Woher kommen Labels? Reicht es, ein Merkmal wegzulassen, wenn ein anderes dafür einspringt? Wer sollte über solche Entscheidungen bestimmen?

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
        ├── session.js           Datensatz, Einstellungen, Skalierung, Trainer, Protokoll, Stufenvergleich
        ├── hand-calc.js         Sollzeilen, Prüfung und Hilfetexte für Seite 5 (ohne Zugriff auf die Seite)
        ├── task-generator.js    Zufallsaufgaben für Seite 5
        ├── progress.js          Speichern und Wiederherstellen in der Lernplattform
        ├── samples.js           Beispiele (erzeugt aus testdata/)
        ├── app.js               Start, Navigation, SCORM
        ├── pages/               je Seite ein Modul, dazu common.js
        └── …                    Kopien aus shared/ (siehe unten)
```

Die Bausteine des Simulators (Datensatz, Import, Eingabe, Koordinatensystem, Neuronenzeichnung, Steuerung, Protokoll, Klassifikation, Aktivierungsfunktionen) stehen in [`shared/`](../shared/README.md), weil sie auch der geplante Simulator für neuronale Netze nutzen soll. Paketspezifisch sind nur die Lernregel, die Texte und die Seiten.

## Paket erstellen und in Moodle einbinden

Das SCORM-Paket ist ein ZIP-Archiv mit dem **Inhalt** des Ordners `src/`. `imsmanifest.xml` muss dabei direkt in der obersten Ebene des ZIP liegen, nicht in einem Unterordner `src/`. Das fertige Paket entsteht als `dist/busy-bias-<Version>.zip` im Stamm des Repositorys. `<Version>` steht für die Version des aktuellen Release, zum Beispiel `v0.5.0`.

So wird das Paket in Moodle eingebunden:
1. Kurs → *Aktivität oder Material anlegen* → **Lernpaket (SCORM)**.
2. `busy-bias-<Version>.zip` hochladen.
3. **Abschluss:** In den Einstellungen der Aktivität unter *Aktivitätsabschluss* „Teilnehmer/innen können die Aktivität manuell als abgeschlossen markieren“ einstellen. Das Paket meldet `incomplete`, damit Moodle beim erneuten Öffnen nicht den Überprüfungsmodus zeigt.

4. Damit Lernende weiterarbeiten können, muss Moodle denselben Versuch fortsetzen: Einstellung **„Neuen Versuch erzwingen“ = „Nein“** (Standard).

### Speicherung

- **Gespeichert** wird in Moodle (`cmi.suspend_data`, mit `LMSCommit`):
  - die Daten: bei einem unveränderten Beispiel nur Kennung und Stufe, sonst Attributnamen, Labels und Punkte;
  - die Einstellungen: feuerndes Label, Startwerte, Lernrate, Schalter für Skalierung, Decision Areas und Mischen;
  - Seite 5: die Aufgabe (bei Übereinstimmung mit Seite 1 nur ein Vermerk), richtige Zeilen, Fehlversuche, genutzte Hilfen, Hilfestufe und der Inhalt der offenen Zeile;
  - Seite 6: Anteil und Auswahl der Testdaten.
- **Nicht gespeichert** werden der Trainingsstand der Seiten 2 und 6, Lernkurve, Testergebnis, Protokoll und der Punkt auf Seite 4, außerdem der Schalter für die Decision Areas auf Seite 5. Nach dem Öffnen beginnt das Training also neu, auch bei einem Beispiel in einer späteren Stufe; Seite 1 erscheint zuerst.
- **Zeitpunkt:** sofort bei jeder Änderung der Daten, nach jedem „Prüfen“, bei einer neuen Auswahl der Testdaten und beim Verlassen eines Felds. Beim Tippen 800 ms nach dem letzten Tastendruck, weil jede Speicherung eine Anfrage an Moodle auslöst. Beim Verlassen der Seite wird Offenes sofort geschrieben. Bei einem plötzlichen Absturz können also höchstens die letzten Tastendrücke fehlen.
- **Platz:** SCORM 1.2 erlaubt 4096 Zeichen. Alle eingebauten Beispiele passen. Knapp wird es bei hochgeladenen Dateien, je nach Länge der Zahlen ab etwa 200 Punkten; früher, wenn Seite 5 eine abweichende Aufgabe mit vielen Punkten enthält. Dann wird stufenweise weggelassen: erst die offene Zeile, dann die Auswahl der Testdaten, dann Aufgabe und Stand von Seite 5, zuletzt die Punkte. Die Einstellungen bleiben. Die Fußzeile nennt, was fehlt.
- Ohne Lernplattform (Offline-Modus) wird nichts gespeichert.

## Sicherheits- und Datenschutzkonzept

- Strenge Content-Security-Policy mit Trusted Types: Es laufen nur Skripte aus dem Paket, es gibt keine Netzwerkzugriffe und keine externen Ressourcen.
- Hochgeladene Dateien werden nur gelesen: Endung, Größe und Binärinhalt werden geprüft, alle Inhalte erscheinen ausschließlich als Text. Meldungen nennen Zeilennummern, nie den Rohinhalt.
- An die Lernplattform gehen nur `cmi.core.lesson_status`, `cmi.core.exit` und `cmi.suspend_data` (siehe „Speicherung“). Hochgeladene Punkte werden dort also mitgespeichert, an andere Stellen gehen sie nicht. Der Name der Lernenden wird nicht gelesen.
- Gespeichertes wird vor der Übernahme streng geprüft (Version, Typen, Grenzen, Labels und Zahlen, Beispiele nur per bekannter Kennung). Ungültiges wird verworfen.

## Qualitätssicherung

Vor jeder Veröffentlichung wird das Paket mit nicht veröffentlichten Entwicklungswerkzeugen gebaut und getestet. Die automatischen Tests laufen in Chromium und prüfen unter anderem einen von Hand gerechneten AND-Lauf, jede Stufe gegen die dokumentierten Zahlen, jeden Baustein ohne Perzeptron, die von Hand gerechnete Tabelle und Konfusionsmatrix, das Wiederherstellen des Stands und die Bedienung aller Seiten.
