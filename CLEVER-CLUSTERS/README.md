# CLEVER CLUSTERS – SCORM-1.2-Lernpaket zu k-Means

**CLEVER CLUSTERS** steht für **C**hoose **L**ocations, **E**valuate **V**ectors, **E**dit, **R**epeat: **C**enters **L**earn **U**ntil **S**table, **T**hen **E**verything **R**ests **S**moothly.
Das Paket ist ein k-Means-Demonstrator: Lernende verfolgen das Verfahren Schritt für Schritt, rechnen es selbst von Hand, treten mit eigenen Zentren gegen k-Means an, untersuchen mit Ellbogen- und Silhouetten-Analyse, welches k passt, vergleichen Cluster mit bekannten Gruppen, wenden die Ergebnisse an und sehen an Bildern, was k-Means bei Kompression und Objekterkennung leistet und was nicht.
Es läuft vollständig im Browser, lädt keine externen Ressourcen und verwendet keine externen Bibliotheken.

## Inhalt für den Unterricht

| Seite | Inhalt |
|---|---|
| 1 Daten und k | Links CSV-Datei oder Beispiel laden, einzelne Punkte hinzufügen, Skalierung, k wählen, Startzentren zufällig oder mit k-means++ wählen oder löschen. Rechts die Punkte, die Zentren als nummerierte Sterne, Decision Areas auf Wunsch, darunter Zentren und Punkte als Tabelle |
| 2 Training | Links Steuerung, Erklärung des Schritts, Zähler, WCSS und Tabelle der aktuellen Zentren. Rechts die nach Cluster gefärbten Punkte, Decision Areas und Verlauf der Zentren auf Wunsch. Darunter aufklappbar die WCSS-Kurve und die Objekte je Cluster |
| 3 Von Hand rechnen | Aufgabe von Seite 1 übernehmen oder zufällig erzeugen; Tabelle Zeile für Zeile selbst ausfüllen: Abstände und Cluster, neue Zentren, WCSS. Mit Prüfung, Hinweisen und Hilfestufen. Darunter aufklappbar die Zeichnung |
| 4 Schlage k-Means | Eigene Zentren setzen, die Punkte färben sich sofort, die WCSS ist live. k-Means tritt mit 20 Läufen an: bester, mittlerer und schlechtester Wert, eigener Platz, Urteil, Tabelle der Versuche. k-Means lässt sich auch von den eigenen Zentren aus starten |
| 5 Ellbogen | Kurve der WCSS über k, Knick auf Wunsch, Startzentren zufällig oder mit k-means++. Aufklappbar: Schieberegler für k, Zentren, Abstandslinien, WCSS, Objekte je Cluster |
| 6 Silhouette | Eigenes k, Startzentren zufällig oder mit k-means++, Silhouetten-Diagramm von −1 bis 1; ein Klick auf eine Säule zeigt den Punkt und seine Rechnung. Aufklappbar: Cluster und Zentren dieses Laufs sowie die Auswertung, welches k am besten wäre |
| 7 Bekannte Gruppen | Cluster und bekannte Gruppen nebeneinander, abweichende Punkte mit Ring, Kreuztabelle, Reinheit und Adjusted Rand Index. Die Gruppen erscheinen erst nach „Vergleich durchführen“ |
| 8 Anwenden | Ein Lauf, drei Anwendungen: neue Punkte einordnen, Ausreißer erkennen, Standorte mit Wegen und Kosten planen |
| 9 Bilder | PNG hochladen oder Beispiel wählen. Links das Original, rechts das Ergebnis in k Farben (Regler 1 bis 10). Speicherbedarf und Farbabweichung. Flächen werden automatisch gezählt; Hintergrund und Mindestgröße sind änderbar |

Die Seiten folgen dem Lernweg: **Verstehen** (1 bis 4), **Bewerten** (5 bis 7), **Anwenden** (8 und 9). Die Tabs tragen kurze Titel, die Überschriften auf den Seiten sind ausführlicher.

Zwischen den Seiten kann jederzeit gewechselt werden; eine laufende Automatik hält an.

**Abhängigkeiten:** Das Training und die Seiten 4 bis 8 übernehmen die Daten und die Skalierung von Seite 1. Das Training übernimmt außerdem k und die Startzentren und beginnt bei jeder Änderung neu. Die Seiten 4 bis 8 haben ein eigenes k und arbeiten unabhängig vom Training und voneinander; ändern sich Daten oder Skalierung, verwerfen sie ihr Ergebnis und weisen darauf hin. „Von Hand rechnen“ arbeitet mit einer eigenen Aufgabe und „Bilder und Objekte“ mit eigenen Bildern; beide sind von den übrigen Seiten unabhängig.

### Rechenregel

- **Zuordnung:** Jeder Punkt gehört zum nächsten Zentrum (euklidischer Abstand). Bei gleichem Abstand gewinnt die kleinere Clusternummer.
- **Aktualisierung:** Jedes Zentrum rückt in den Mittelpunkt seiner Punkte. Ein leerer Cluster behält sein Zentrum, und ein Hinweis nennt ihn.
- **WCSS** (Within Cluster Sum of Squares): Summe der quadrierten Abstände aller Punkte zu ihrem Zentrum.
- **Ende:** Eine Zuordnung ändert nichts mehr gegenüber der vorherigen.

### Daten und k (Seite 1)

- **k:** Wählbar sind 1 bis zur Anzahl der verschiedenen Punkte, höchstens 100. Voreingestellt ist 3, auch nach jedem neuen Laden.
- **Startzentren:** „Zufällig wählen“ nimmt k verschiedene Datenpunkte. „Mit k-means++ wählen“ siehe unten. Ein Klick in die Zeichnung setzt ein Zentrum an diese Stelle; liegt dort sehr nahe ein Datenpunkt, rastet es auf ihm ein. Ein Klick auf ein Zentrum entfernt es.
- **Decision Areas:** exakte Flächen in unterschiedlichen Farben. Der Schalter gilt für die Seiten 1 und 2 gemeinsam.
- **Skalierung:** Min-Max je Achse auf 0 bis 1. Die Originaldaten bleiben erhalten, Training und Analysen verwenden die skalierten Werte, „Von Hand rechnen“ bei einer Übernahme von Seite 1 ebenso. Zentren stehen intern in Originaleinheiten und bleiben beim Umschalten an ihrer Stelle.
- **Achsen:** Alle Koordinatensysteme schließen den Nullpunkt ein. Die Achsen sind getrennt skaliert, damit die Daten die Fläche füllen. Deshalb sehen Abstände und Flächengrenzen verzerrt aus, wenn die Achsen sehr verschiedene Größenordnungen haben; auch das lässt sich im Unterricht besprechen.
- **Farben:** Bis 12 Cluster sind die Farben gut zu unterscheiden, darüber nicht mehr sicher. Deshalb tragen Zentren ihre Nummer, die Punkte wechseln die Form, und der Tooltip nennt den Cluster.

### Training (Seite 2)

Ein Klick auf **Weiter** ist ein Trainingsschritt: erst die Zuordnung aller Punkte, dann die Aktualisierung der Zentren, dann wieder die Zuordnung. Eine Iteration besteht aus Zuordnung und Aktualisierung.

| Steuerung | Wirkung |
|---|---|
| **Weiter** | ein Schritt; hält eine laufende Automatik an |
| **[N] Iterationen rechnen** | 1 bis 1000 Iterationen ohne Zwischenanzeige. Eine angefangene Iteration wird beendet und zählt als erste |
| **Automatisch / Pause** | Einzelschritte im gewählten Tempo bis zum Ende |
| **Zurücksetzen** | beginnt wieder mit den Startzentren von Seite 1 |

Die **WCSS-Kurve** erhält nach jedem Trainingsschritt einen neuen Wert, auch im zugeklappten Zustand. **Objekte je Cluster** nennt die Objektbezeichner; Punkte ohne Bezeichner heißen „Punkt n“.

### Von Hand rechnen (Seite 3)

Die Seite ist von den übrigen Seiten **entkoppelt** und rechnet mit einer eigenen Aufgabe:

- **Daten von Seite 1 übernehmen** kopiert Punkte, Startzentren und Skalierung auf dem aktuellen Stand. Das geht bis 12 Punkte und k = 4; sonst nennt eine Meldung den Grund.
- **Neue Zufallsaufgabe** erzeugt eine eigene Aufgabe in der gewählten Schwierigkeit. Jede Person erhält eine andere.

| Schwierigkeit | Punkte | k | Werte | Iterationen höchstens |
|---|---:|---:|---|---:|
| Leicht | 6 | 2 | ganze Zahlen von 0 bis 6 | 3 |
| Mittel | 8 | 2 | ganze Zahlen von 0 bis 8 | 4 |
| Schwer | 10 | 3 | ganze Zahlen von 0 bis 9 | 4 |

Zufallsaufgaben haben keine gleichen Abstände zu zwei Zentren und keinen leeren Cluster, und mindestens ein Punkt wechselt nach der ersten Zuordnung den Cluster.

**Tabelle, je Iteration in dieser Reihenfolge:** Nur die offene Zeile hat Eingabefelder. **Prüfen** oder die Eingabetaste prüft sie.

1. **Zuordnung, je Punkt eine Zeile:** quadrierter Abstand zu jedem Zentrum und der Cluster. Quadrate genügen, weil das kleinste d² auch den kleinsten Abstand bedeutet, und sie passen direkt zur WCSS.
2. **Aktualisierung, je Cluster eine Zeile:** x und y des neuen Zentrums. Die Zeile eines leeren Clusters ist schon ausgefüllt.
3. **WCSS, eine Zeile:** mit den neuen Zentren.

Die Tabelle endet, sobald eine ganze Zuordnung nichts mehr ändert.

- **Abstände vorgeben:** Der Schalter zeigt die Abstände der offenen Zeile an, dann ist nur noch der Cluster einzutragen. Richtige Zeilen und Eingaben bleiben beim Umschalten erhalten. So werden spätere Iterationen nicht zur Fleißarbeit.
- **Hinweise stufenweise:** erst die Abstände, dann der Cluster, damit keine Folgefehler verwirren. Die automatischen Hinweise nennen Ort und Art des Fehlers, nie den richtigen Wert.
- **Fehlversuche:** Rechenfehler zählen, Schreibfehler nicht (leeres Feld, keine Zahl, Cluster außerhalb von 1 bis k).
- **Rundung:** Ein Wert ist richtig, wenn er dem genauen Wert gerundet entspricht, auf mindestens zwei Nachkommastellen. Weitergerechnet wird mit dem genauen Wert.
- **Hilfe:** Nach zwei Fehlversuchen in derselben Zeile erscheint „Hilfe anzeigen“. Sie öffnet schrittweise Regel, Rechenweg ohne Ergebnis und Ergebnis, trägt nichts in die Felder ein, und jede Stufe zählt unter „Genutzte Hilfen“.
- **Zeichnung:** Aufklappbar zeigt sie den Stand nach der letzten richtigen Zeile mit dem hervorgehobenen Punkt der offenen Zeile und auf Wunsch die Decision Areas.

### k-means++

k-means++ wählt das erste Zentrum zufällig und jedes weitere mit einer Wahrscheinlichkeit proportional zum quadrierten Abstand zum nächsten schon gewählten Zentrum. Weit entfernte Punkte werden also bevorzugt.

Es steht auf Seite 1 als eigene Schaltfläche und auf den Seiten 5 bis 8 als Auswahl zur Verfügung; voreingestellt ist dort der rein zufällige Start. Auf Seite 9 gilt es immer. Seite 4 tritt bewusst nur mit zufälligen Starts an. Auch k-means++ ist zufällig und kann schlecht enden. Es senkt meist den Anteil schlechter Läufe, besonders bei getrennten Gruppen, hilft aber wenig bei Daten ohne klare Gruppen. Die Zahlen je Beispiel stehen in [testdata/README.md](testdata/README.md).

### Schlage k-Means (Seite 4)

Lernende suchen selbst die besten Zentren, ohne Verfahren. Die Seite hat ein eigenes k (voreingestellt 3) und eigene Zentren; Seite 1 bleibt unberührt.

- **Setzen:** wie auf Seite 1. Ein Klick setzt ein Zentrum frei oder rastet nahe an einem Datenpunkt ein, ein Klick auf ein Zentrum entfernt es. Die Punkte gehören immer zum nächsten Zentrum, die WCSS ist schon mit wenigen Zentren zu sehen.
- **k-Means antreten lassen:** Mit allen k Zentren rechnet die Seite 20 Läufe aus zufälligen Startzentren. Sie zeigt den besten, mittleren und schlechtesten Wert, den eigenen Platz von 21 und ein Urteil: um wie viel Prozent der eigene Wert über dem besten Lauf liegt, gleichauf oder „alle Läufe geschlagen“.
- **k-Means von meinen Zentren aus starten** zeigt, wie weit das Verfahren das eigene Ergebnis noch verbessert. Die Zeichnung wechselt zwischen eigenen Zentren, bestem Lauf und diesem Ergebnis.
- **Versuche:** Jede neue Zentrenwahl wird eine eigene Zeile, sobald sie antritt oder weitergerechnet wird. Neue Daten löschen die Tabelle.
- Der beste von 20 Läufen ist nicht zwingend das Optimum; das sagt auch der Text auf der Seite. Wer alle Läufe schlägt, hat also nicht unbedingt das Optimum gefunden, sondern womöglich nur k-Means bei ungünstigen Starts.

Fragen an die Lernenden: Wie gehen Sie beim Setzen vor? Warum landen Ihre Zentren oft nahe am Ergebnis von k-Means? Bei welchen Daten schlagen Sie viele Läufe (Kundenadressen mit k = 6)?

### Ellbogen-Analyse (Seite 5)

- Standard ist k = 1 bis 10, bei weniger verschiedenen Punkten entsprechend weniger. Höhere Werte bis 100 lassen sich zuschalten.
- Jeder Klick auf „Ellbogen-Analyse durchführen“ rechnet für jedes k **einen** Lauf mit neuen zufälligen Zentren. Deshalb sieht die Kurve jedes Mal etwas anders aus und kann auch einmal steigen.
- **Knick:** das k mit dem größten Abstand unter der Verbindungslinie vom ersten zum letzten Punkt, mit beiden Achsen auf 0 bis 1 normiert. Er hängt also auch vom größten k ab.
- Der **Schieberegler** rechnet nichts neu, sondern zeigt die Läufe des letzten Klicks mit den Abständen der Punkte zu ihrem Zentrum.

### Silhouetten-Analyse (Seite 6)

- Für jeden Punkt gilt `s = (b − a) / max(a, b)`: a ist der mittlere Abstand zum eigenen Cluster, b der kleinste mittlere Abstand zu einem fremden Cluster. Ein Cluster mit einem Punkt hat s = 0 (Rousseeuw 1987).
- Das Diagramm zeigt je Punkt einen Balken, nach Cluster gruppiert und absteigend sortiert, auf der y-Achse von −1 bis 1. Die gestrichelte Linie markiert den Mittelwert. Die Säulen tragen einen weißen Rand, solange sie dafür breit genug sind (bis etwa 180 Punkte); bei noch mehr Punkten würde er die Säulen verdecken.
- **Punkt untersuchen:** Ein Klick auf eine Säule oder die Auswahlliste markiert den Punkt im Diagramm und in der Zeichnung und zeigt die Rechnung mit a, b und s, bei negativen Werten mit einer Erklärung. Eine neue Analyse hebt die Auswahl auf.
- Wählbar sind k = 2 bis zur Anzahl der verschiedenen Punkte, höchstens n − 1 und 100.
- Die **Auswertung** rechnet k = 2 bis 10 und das gewählte k mit je einem Lauf. Das gewählte k verwendet den angezeigten Lauf. Das beste k kann von Klick zu Klick schwanken.

### Bekannte Gruppen (Seite 7)

Die Seite macht den Unterschied zu überwachtem Lernen sichtbar: k-Means kennt die Gruppen nicht und muss sie nicht treffen.

- **Vor dem Klick** nennt die Seite nur, ob der Datensatz bekannte Gruppen enthält, nicht wie viele oder welche. k ist voreingestellt 3, also absichtlich nicht die Anzahl der Gruppen. Ohne Gruppen erscheint ein Hinweis.
- **Vergleich durchführen:** Jeder Klick ist ein neuer Lauf. Zwei Zeichnungen stehen nebeneinander, die Gruppen tragen möglichst die Farbe des Clusters, in dem sie am häufigsten vorkommen. Punkte, die nicht zur häufigsten Gruppe ihres Clusters gehören, tragen einen Ring. Darunter stehen die Kreuztabelle und aufklappbar die Objekte je Cluster und Gruppe.
- **Reinheit:** Anteil der Punkte, die zur häufigsten Gruppe ihres Clusters gehören. Sie steigt mit k und ist bei einem Cluster je Punkt immer 1; allein ist sie deshalb wenig wert.
- **Adjusted Rand Index** (Hubert und Arabie 1985): vergleicht Punktpaare. 1 bedeutet dieselbe Einteilung, Werte um 0 eine Übereinstimmung wie durch Zufall. Umbenannte Cluster ändern nichts.
- **Hinweise:** Weicht k von der Anzahl der Gruppen ab, sagt die Seite das. Punkte ohne Gruppe (zum Beispiel von Hand ergänzt) zählen nicht mit, auch das nennt sie.
- **Unsichtbarkeit:** Die Gruppe wird beim Laden gelesen, erscheint aber nirgends sonst: nicht in der Punktetabelle, in Tooltips, Objektlisten, Meldungen oder Auswahllisten. Bei neuen Daten verschwinden die Namen wieder aus dem Dokument. Ein Test prüft das für alle Beispiele auf allen Seiten.

Die Mittelwerte je Beispiel stehen in [testdata/README.md](testdata/README.md).

### Anwenden (Seite 8)

Oben stehen ein eigenes k, die Startart und „Cluster berechnen“. Der Umschalter wählt die Anwendung, alle drei bauen auf demselben Lauf auf.

**Neue Punkte einordnen:** Eingabe per Maske in Originaleinheiten, mit optionalem Bezeichner, oder per Klick in die Zeichnung. Die Seite zeigt die Abstände zu allen Zentren und den Cluster; der Punkt erscheint als Raute mit Linie zu seinem Zentrum. Mehrere Punkte bleiben in einer Liste (höchstens 50). Sie ändern weder Daten noch Zentren. Bei eingeschalteter Skalierung steht die Umrechnung dabei; Punkte außerhalb der Daten liegen außerhalb von 0 bis 1.

**Ausreißer erkennen:** Ein Punkt ist auffällig, wenn sein Abstand zum Zentrum größer ist als t mal der mittlere Abstand seines Clusters (Regler von 1 bis 5, voreingestellt 2,5). Auffällige Punkte tragen einen Ring und stehen sortiert in einer Tabelle. Die Seite nennt zusätzlich sehr kleine Cluster unter 5 % der Punkte: Ausreißer können ein eigenes Cluster bilden und fallen nach der Regel dann gar nicht auf. Bei den Messstationen mit k = 3 lässt sich das oft beobachten.

**Standorte planen:** Die Zentren sind Standorte. Die Tabelle nennt je Standort Anzahl, mittleren und längsten Weg; die längsten Wege sind in der Zeichnung hervorgehoben. Gesamtkosten = k · Kosten je Standort + Summe der Wege · Kosten je Wegeinheit. „Für k = 1 bis 10 rechnen“ zeichnet sie über k und markiert das günstigste k. Je k gilt der beste von fünf Läufen; geänderte Kosten rechnen die Kurve ohne neue Läufe um.

- Abstände sind nur bei gleicher Einheit auf beiden Achsen sinnvoll; bei eingeschalteter Skalierung erscheint eine Warnung.
- k-Means minimiert quadrierte Abstände, nicht den mittleren Weg. Das Ergebnis ist also eine gute Näherung, nicht das Optimum.

### Bilder und Objekte (Seite 9)

Jedes Pixel ist ein Punkt im Farbraum aus Rot, Grün und Blau. k-Means gruppiert diese Punkte, und das Ergebnisbild zeigt jedes Pixel in der mittleren Farbe seines Clusters.

- **Eingabe:** nur PNG, höchstens 10 MB, 10000 Pixel je Seite und 40 Megapixel. Gerechnet wird auf einer Fassung mit höchstens 480 Pixeln an der langen Seite.
- **Start:** immer k-means++, damit kleine farbige Objekte nicht zufällig verloren gehen. Die Zentren werden auf einer Stichprobe von höchstens 20000 Pixeln angelernt.
- **Regler k:** 1 bis 10. Ergebnisse bleiben je Bild und k erhalten; „Neu berechnen“ startet das aktuelle k neu.
- **Zählen:** Das Cluster, das am Bildrand am häufigsten vorkommt, gilt als Hintergrund. Ein Klick auf ein Farbfeld wechselt zwischen Hintergrund und Objekt. Danach wird die Maske bereinigt: kleine Lücken schließen, Löcher füllen, dünne Linien und Rauschen entfernen. Gezählt werden zusammenhängende Flächen ab der einstellbaren Mindestgröße (voreingestellt 0,2 % des Bildes).

**Speicherbedarf:** Das Original braucht Breite × Höhe × 24 Bit. Mit k Farben genügen Breite × Höhe × ⌈log₂ k⌉ Bit für die Nummern der Farben, dazu die Farbtabelle mit k × 24 Bit. Die mittlere Farbabweichung je Pixel (Abstand im Farbraum zwischen Original und Ergebnis) zeigt den Preis dafür. Das ist die Rechnung für die verkleinerte Arbeitsgröße, ohne weitere Kompression wie bei PNG; tatsächliche Dateien fallen anders aus. Frage an die Lernenden: Ab welchem k lohnt sich eine weitere Farbe kaum noch?

**k-Means zählt nicht selbst und kennt keine Objekte.** Es gruppiert Farben, das Zählen ist ein zweiter Schritt, und auch der kennt nur Flächen:

| Beobachtung | Ursache |
|---|---|
| Zu wenig Objekte | Berührende oder überlappende Objekte werden zu einer Fläche; Objekte in Hintergrundfarbe gehen unter |
| Zu viele Objekte | Schatten, Pflanzen und Blasen zählen mit; mehrfarbige Objekte zerfallen |
| Eine riesige Fläche | Der Hintergrund besteht aus mehreren Clustern: Lernende müssen weitere Farbfelder als Hintergrund markieren |
| Die Zahl stimmt | Das kann auch Zufall sein. Die Rahmen zeigen, ob wirklich die Objekte gezählt wurden |

Die Beispielbilder sind Zeichnungen, die das Paket beim Laden erzeugt. Ihre Titel verraten weder Schwierigkeit noch Anzahl. Die Tabelle nennt den Median der gezählten Flächen über fünf Läufe mit den Voreinstellungen, ohne Korrektur durch Lernende; einzelne Läufe weichen ab.

| Titel | Tiere | Gezählte Flächen | Situation (nur für Lehrkräfte) |
|---|---:|---|---|
| Weide 1 | 8 | k = 2 und 3: 8; ab k = 4: 1 | Leicht. Ab k = 4 zerfällt die Wiese in mehrere Grüntöne und wird zur riesigen Fläche, bis weitere Farbfelder als Hintergrund markiert sind |
| Weide 2 | 9 | k = 2 und 3: 12; ab k = 4: meist 10 | Hintergrund aus Himmel und Wiese, gefleckte Kühe: Flächen zerfallen, und der Himmel zählt mit |
| Weide 3 | 10 | k = 2: 4; ab k = 3: 10 | Die Zahl stimmt ab k = 3, aber oft aus falschen Gründen: Himmel und Bäume zählen als Fläche, dafür fehlt eine helle Kuh vor dem Himmel. Die Rahmen zeigen es |
| Weide 4 | 16 | meist 8 bis 10 | Dichte Herde: Berührungen und Überlappungen ergeben zu wenige Flächen |
| Weide 5 | 8 | 1 | Geringer Kontrast: Die Kühe unterscheiden sich kaum vom fleckigen Boden |
| Aquarium 1 | 7 | meist 7, bei hohem k auch 1 | Mehrfarbige Fische, ruhiges Wasser: Löcher füllen macht aus ihnen ganze Flächen |
| Aquarium 2 | 12 | meist 4 bis 11 | Farbverlauf, Pflanzen, Blasen, blaue Fische nahe der Wasserfarbe: schwer |

Fragen an die Lernenden: Wie muss k gewählt werden, damit die Tiere vom Hintergrund getrennt sind? Warum hilft ein größeres k hier nicht immer? Was bräuchte ein Verfahren, das berührende Kühe trennt?

### Dateiformat

Trennzeichen sind Semikolon, Komma oder Tabulator; das Dezimalkomma ist beim Semikolon möglich. Nur `.csv`, höchstens 2 MB, höchstens 500 Punkte, Zahlen von −1000000 bis 1000000. Die erste Zeile entscheidet:

| Spalten | Erste Zeile | Bedeutung |
|---:|---|---|
| 2 | keine Zahlen | Kopfzeile mit den Achsennamen |
| 2 | Zahlen | keine Kopfzeile; Achsen heißen x₁ und x₂ |
| 3 | letzter Eintrag heißt `Gruppe`, die ersten beiden sind keine Zahlen | Kopfzeile: Achsennamen, dann die Gruppe |
| 3 | Zahl;Zahl;keine Zahl | `x;y;Gruppe` ohne Kopfzeile |
| 3 | letzte zwei Zellen keine Zahlen | Kopfzeile: Überschrift der Objekte, dann die Achsennamen |
| 3 | letzte zwei Zellen Zahlen | keine Kopfzeile; Spalte 1 enthält die Objektbezeichner, auch wenn es Zahlen sind |
| 4 | Zellen 2 und 3 keine Zahlen | Kopfzeile: Objekte, Achsennamen, Gruppe |
| 4 | Zellen 2 und 3 Zahlen | `Objekt;x;y;Gruppe` ohne Kopfzeile |

Ist nur eine der beiden Zellen für x und y eine Zahl, ist die Datei nicht eindeutig und wird abgelehnt. Fehlerhafte Zeilen werden mit Zeilennummer gemeldet und übersprungen. Fehlt ein Bezeichner, heißt das Objekt „Punkt n“. Bezeichner und Gruppen werden bereinigt und auf 40 Zeichen begrenzt. „Punkt hinzufügen“ hat kein Feld für die Gruppe.

```
Lebensmittel;Fett in g je 100 g;Zucker in g je 100 g;Gruppe
Apfel;0,2;10;Obst, Gemüse und Beilagen
Butter;83;0,6;Fettes
```

## Beispiele

**Das Besondere der Daten bleibt verborgen.** Lernende sollen das Problem erst im Verlauf der Analyse erkennen. Titel, Meldungen, Dateinamen und Objektbezeichner sind deshalb neutral, die Zeilen sind gemischt, und die Auswahl nennt kein passendes k. Die Auflösung steht nur hier und in [testdata/README.md](testdata/README.md), also außerhalb des SCORM-Pakets.

| Titel in der Auswahl | Situation | Was zu beobachten ist | Frage an die Lernenden |
|---|---|---|---|
| Lebensmittel | Natürliche Gruppen, unscharf | Obst und Gemüse, Süßes, Fettes, Fettes und Süßes. Knick und Silhouette sind sich oft nicht einig | Welche Gruppen ergeben inhaltlich Sinn? Wo liegt Schokolade, und warum? |
| Kundschaft eines Onlineshops | Vier Segmente | Schlechte Startzentren verfehlen sie oft | Wie lässt sich erkennen, dass ein Lauf schlecht war? |
| Kundenadressen | Sechs Stadtteile, keine Kopfzeile | Bei k = 6 enden die Läufe nicht immer gleich, der Knick liegt oft zu früh | Warum führen dieselben Daten zu verschiedenen Clustern? Wo würden Sie Depots bauen? |
| Häuser in einer Gemeinde | Nicht-konvex: Ring um einen See mit Insel | Der Ring wird zerschnitten, die Insel teilt sich ein Cluster mit Teilen des Rings | Wie viele Siedlungen sehen Sie? Warum findet k-Means sie nicht? |
| Häuser in einem Tal | Nicht-konvex: zwei Bögen an einem Fluss | k = 2 schneidet beide Bögen | Welche Form haben die Flächen, die k-Means bilden kann? |
| Läden in einer Region | Unterschiedliche Clustergrößen: Großstadt und zwei Dörfer | Bei k = 3 wird die Stadt geteilt, und die Dörfer landen im selben Cluster | Warum senkt das die WCSS, obwohl es falsch aussieht? |
| Bäume in einem Gelände | Unterschiedliche Dichten: zwei Waldstücke und eine Streuobstwiese | Die Grenze liegt mittig zwischen den Zentren, deshalb fallen Wiesenbäume den Waldstücken zu | Wo müsste die Grenze eigentlich liegen? |
| Messstationen | Ausreißer: vier defekte Stationen | Bei k = 3 bilden drei von ihnen ein eigenes Cluster, die vierte zieht ein Zentrum zu sich, zwei echte Gruppen verschmelzen | Was ändert sich, wenn die defekten Stationen entfernt werden (Punktetabelle)? |
| Haushalte | Nicht-sphärisch: zwei parallele Bänder (ohne und mit Wärmepumpe) | k = 2 schneidet quer zu den Bändern | Welches Merkmal unterscheidet die Haushalte wirklich? |
| Befragung | Skalierung entscheidet | Ohne Skalierung bestimmt nur das Einkommen die Cluster, mit Skalierung treten drei Altersgruppen hervor | Welche Einheit hat ein Abstand? Wann ist Skalieren falsch? |
| Punkte A | Einstieg: drei getrennte Wolken | Alle Verfahren sind sich meist einig | Warum ist das so einfach? |
| Punkte B | Zwei Wolken, ohne Kopfzeile | Achsen heißen x₁ und x₂, Objekte „Punkt n“ | – |
| Punkte C | Keine Struktur | Trotzdem schlagen die Verfahren ein k vor; die Silhouettenwerte sind niedrig | Bedeutet ein vorgeschlagenes k, dass es Gruppen gibt? |
| Hunde | Vier Rassen, klar getrennt | k-Means trifft die Gruppen bei k = 4 fast genau (Seite 7) | Warum klappt es hier so gut? Was ändert sich mit k = 3 oder k = 8? |
| Fahrzeuge | Unterschiedlich große Gruppen: viele Pkw, wenige Transporter, Busse und Lkw | Bei k = 4 werden die Pkw geteilt, Busse und Lkw teilen sich ein Cluster. Die Reinheit bleibt hoch, der Adjusted Rand Index nicht | Warum sagt die Reinheit hier wenig? |
| Obst | Vier Sorten, die sich überlappen | k-Means trifft die Sorten nur teilweise, und Knick und Silhouette schlagen 3 vor | Würde ein weiteres Merkmal helfen? |
| Sportarten | Vier Sportarten mit realistischen Überschneidungen | Die Verfahren schlagen meist 2 vor, viele Punkte tragen auf Seite 7 einen Ring | Welche Sportarten lassen sich an den Körpermaßen erkennen, welche nicht? |
| Schwertlilien | Echte Messdaten, drei Arten | Eine Art ist klar getrennt, die beiden anderen grenzen aneinander. Der Knick schlägt 3 vor, die Silhouette 2 | Sieht man an den Daten allein, dass es drei Arten sind? |

**Bekannte Gruppen** haben alle Beispiele außer Kundenadressen und Punkte A, B und C. Sie heißen sprechend, zum Beispiel „Insel“ oder „mit Wärmepumpe“, und erscheinen erst auf Seite 7 nach dem Klick. Besonders aufschlussreich sind die Beispiele, bei denen k-Means die Gruppen verfehlt: Häuser in einem Tal, Haushalte und Befragung ohne Skalierung.

Die Werte sind fiktiv, die Lebensmittel sind gerundete Richtwerte. Eine Ausnahme sind die Schwertlilien: 54 Blüten aus dem Iris-Datensatz (Messungen von Edgar Anderson 1935, veröffentlicht von R. A. Fisher 1936, CC BY 4.0, siehe [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)). Die Meldung nach dem Laden nennt Quelle und Lizenz. Die Effekte prüft ein automatischer Test; die Vorschläge von Knick und Silhouette stehen in [testdata/README.md](testdata/README.md).

## Aufbau

```
CLEVER-CLUSTERS/
├── README.md
├── preview/                 Vorschaubilder
├── testdata/                CSV-Dateien aller Beispiele, README.md für Lehrkräfte
└── src/                     Inhalt des SCORM-Pakets
    ├── index.html           Einstiegsseite mit den neun Seiten
    ├── imsmanifest.xml      SCORM-Manifest
    ├── LICENSE.txt
    ├── css/                 base.css und sim.css (aus shared/), clusters.css (Farben, erzeugt), style.css
    └── js/
        ├── cluster-data.js      Datensatz mit Objektbezeichnern und Gruppen
        ├── cluster-import.js    CSV-Erkennung
        ├── cluster-panel.js     Upload, Beispiele, Punktmaske, Punktetabelle
        ├── cluster-view.js      Teile der Zeichnungen, Zentrentabelle, Objekte je Cluster
        ├── kmeans.js            Rechenregel und Trainer (ohne Zugriff auf die Seite)
        ├── kmeans-analysis.js   Ellbogen, Silhouette und Wettkampf von Seite 4 (ohne Zugriff auf die Seite)
        ├── kmeans-compare.js    Kreuztabelle, Reinheit, Adjusted Rand Index (ohne Zugriff auf die Seite)
        ├── kmeans-apply.js      Einordnen, Ausreißer, Wege und Kosten (ohne Zugriff auf die Seite)
        ├── voronoi.js           Decision Areas als Polygone
        ├── image-kmeans.js      k-Means auf Farben, Speicherbedarf (ohne Zugriff auf die Seite)
        ├── object-count.js      Hintergrund, Maske, Zählen (ohne Zugriff auf die Seite)
        ├── sample-scenes.js     Beispielbilder als Zeichnungen
        ├── hand-calc.js         Sollzeilen, Prüfung und Hilfetexte für Seite 3 (ohne Zugriff auf die Seite)
        ├── task-generator.js    Zufallsaufgaben für Seite 3
        ├── session.js           Gemeinsamer Stand aller Seiten außer 3 und 9
        ├── samples.js           Beispiele (erzeugt aus testdata/)
        ├── app.js               Start, Navigation, SCORM
        ├── pages/               je Seite ein Modul
        └── …                    Kopien aus shared/
```

## Paket erstellen und in Moodle einbinden

Das SCORM-Paket ist ein ZIP-Archiv mit dem **Inhalt** des Ordners `src/`. `imsmanifest.xml` muss dabei direkt in der obersten Ebene des ZIP liegen, nicht in einem Unterordner `src/`. Das fertige Paket entsteht als `dist/clever-clusters-<Version>.zip` im Stamm des Repositorys. `<Version>` steht für die Version des aktuellen Release, zum Beispiel `v0.5.0`.

So wird das Paket in Moodle eingebunden:
1. Kurs → *Aktivität oder Material anlegen* → **Lernpaket (SCORM)**.
2. `clever-clusters-<Version>.zip` hochladen.
3. **Abschluss:** In den Einstellungen der Aktivität unter *Aktivitätsabschluss* „Teilnehmer/innen können die Aktivität manuell als abgeschlossen markieren“ einstellen. Das Paket meldet `incomplete`, damit Moodle beim erneuten Öffnen nicht den Überprüfungsmodus zeigt.

### Speicherung

Es wird **nichts gespeichert**, auch nicht der Stand der Tabelle auf Seite 3. Nach dem erneuten Öffnen beginnt das Paket leer. An die Lernplattform gehen nur `cmi.core.lesson_status` und `cmi.core.exit`.

## Sicherheits- und Datenschutzkonzept

- Strenge Content-Security-Policy mit Trusted Types: Es laufen nur Skripte aus dem Paket, es gibt keine Netzwerkzugriffe und keine externen Ressourcen. Bilder werden mit `createImageBitmap` dekodiert und auf Canvas gezeichnet; dafür ist keine Ausnahme in der Richtlinie nötig.
- Hochgeladene Dateien werden nur gelesen und bleiben im Browser. Bei CSV-Dateien werden Endung, Größe und Binärinhalt geprüft, bei PNG-Dateien Endung, Größe, Dateikennung und die im Dateikopf genannten Maße, bevor das Bild dekodiert wird.
- Alle Inhalte aus Dateien erscheinen ausschließlich als Text. Meldungen nennen Zeilennummern, nie den Rohinhalt.
- Der Name der Lernenden wird nicht gelesen.

## Qualitätssicherung

Vor jeder Veröffentlichung wird das Paket mit nicht veröffentlichten Entwicklungswerkzeugen gebaut und getestet. Die automatischen Tests laufen in Chromium und prüfen unter anderem von Hand gerechnete Beispiele für WCSS und Silhouette, die Decision Areas gegen die Zuordnung, alle CSV-Formen, den in dieser Datei beschriebenen Effekt der Beispiele, die von Hand gerechneten Tabellen und Zufallsaufgaben, das Zählen auf kleinen Masken, den PNG-Upload und die Bedienung aller Seiten. Von Hand nachgerechnet sind auch Reinheit und Adjusted Rand Index, die Ausreißer-Regel, Wege und Kosten sowie der Speicherbedarf. Ein eigener Test prüft für alle Beispiele auf allen Seiten, dass die Gruppennamen vor dem Vergleich auf Seite 7 nirgends im Dokument stehen.
