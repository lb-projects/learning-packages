# Testdaten der SQL Sandbox

Dieser Ordner enthält SQL-Dateien für den Unterricht und für Tests. Sie lassen sich auf **Seite 1 „Datenbank laden“** hochladen (Format siehe `../README.md`, Abschnitt „Dateiformat für den Upload“). Die ersten fünf Dateien sind außerdem als Beispieldatenbanken fest eingebaut; der Build prüft, dass Datei und eingebauter Text übereinstimmen.

Alle Namen, Orte, Firmen, Titel und Werte sind **frei erfunden** (Orte wie „Musterstadt“). Ähnlichkeiten mit realen Personen oder Einrichtungen wären zufällig. Lizenz: MIT (siehe `LICENSE` im Stamm des Repositorys).

## Überblick

| Datei | Zweck | Eingebaut |
|---|---|---|
| `schule.sql`, `bibliothek.sql`, `online_shop.sql`, `sportverein.sql` | Normalisierte Beispieldatenbanken zum Abfragen (Seiten 2 bis 5) | ja |
| `redundanz_kursbuchung.sql` | Absichtlich nicht normalisiert, zum Üben auf Seite 6 „Redundanzen“ | ja („Kursbuchung“) |
| `redundanz_1nf_kontaktliste.sql` | Verstoß gegen die 1. Normalform | nein |
| `redundanz_2nf_ausleihe.sql` | Verstoß gegen die 2. Normalform (Schlüssel mit drei Spalten) | nein |
| `redundanz_2nf_projekte.sql` | Verstoß gegen die 2. Normalform (zusammengesetzter Schlüssel) | nein |
| `redundanz_3nf_verein.sql` | Verstoß gegen die 3. Normalform, mit Widerspruch in den Daten | nein |
| `redundanz_3nf_praxis.sql` | Verstoß gegen die 3. Normalform, `AUTO_INCREMENT`-Schlüssel | nein |
| `redundanz_gemischt_bestellung.sql` | Mehrere Verstöße in einer Tabelle, dazu eine Tabelle ohne Schlüssel | nein |
| `redundanz_ok_vereinsverwaltung.sql` | Normalisierte Gegenprobe zu `redundanz_3nf_verein.sql` | nein |
| `beispiel_phpmyadmin_export.sql` | Kursangebot einer Musikschule im Stil eines phpMyAdmin-Exports | nein |
| `beispiel_fehlerhaft.sql` | Übungsdatei mit zwei absichtlichen Fehlern (Fehlermeldungen beim Upload) | nein |

Die Inhalte der Abfrage-Beispiele (Tabellen, Besonderheiten wie `NULL`-Werte und Datensätze ohne Partner) beschreibt `../README.md`, Abschnitt „Beispieldatenbanken und Dateien für den Unterricht“.

## Dateien für die Seite „Redundanzen“

Die Seite erkennt **keine** funktionalen Abhängigkeiten selbst: In den Daten gelten oft zufällige Abhängigkeiten, die als Verstoß gemeldet würden. Die Lernenden tragen die Abhängigkeiten ein, die **fachlich** gelten. Die Dateien sind so gebaut, dass diese Abhängigkeiten eindeutig sind, und sie sind in der Tabelle unten als Lösung angegeben.

**Schreibweise:** `X → Y` bedeutet „zu jedem Wert von X gehört genau ein Wert von Y“. Abhängigkeiten vom Primärschlüssel (`Schlüssel → alle übrigen Spalten`) müssen nicht eingetragen werden; sie gelten immer. „Markieren“ meint das Ankreuzfeld „enthält mehrere Werte“ im Abschnitt zur 1. Normalform.

### Lösung auf einen Blick

| Datei | Tabelle (Schlüssel) | Einzutragende Abhängigkeiten | Markieren (1. NF) | Höchste erfüllte NF |
|---|---|---|---|---|
| `redundanz_kursbuchung.sql` | `belegung` (`schueler_nr`, `kurs_nr`) | `schueler_nr → Schueler_Name, Klasse`<br>`Klasse → Klassenleitung`<br>`kurs_nr → Kurs_Titel, Lehrkraft`<br>`Lehrkraft → Sprechstunde` | – | 1. NF |
| | `kontakt` (`schueler_nr`) | `PLZ → Ort` | Telefonnummern, Erziehungsberechtigte1, Erziehungsberechtigte2 | keine (ohne Markierung: 2. NF) |
| | `raum` (`Raumnummer`) | – | – | 2. NF; 3. NF offen (normalisiert) |
| `redundanz_1nf_kontaktliste.sql` | `teilnehmer` (`id`) | – | Telefon1, Telefon2, Telefon3, Hobbys, Adresse | keine |
| `redundanz_2nf_ausleihe.sql` | `ausleihe` (`leser_nr`, `buch_nr`, `Ausleihdatum`) | `leser_nr → Leser_Name, Leser_Klasse`<br>`buch_nr → Buch_Titel, Autor` | – | 1. NF |
| `redundanz_2nf_projekte.sql` | `projektmitarbeit` (`mitarbeiter_nr`, `projekt_nr`) | `mitarbeiter_nr → Mitarbeiter_Name, Abteilung`<br>`projekt_nr → Projekt_Titel, Auftraggeber, Budget` | – | 1. NF |
| `redundanz_3nf_verein.sql` | `mitglied` (`id`) | `PLZ → Ort` (widerspricht den Daten, s. u.)<br>`Abteilung → Abteilungsleitung, Beitrag` | – | 2. NF |
| `redundanz_3nf_praxis.sql` | `termin` (`id`) | `Arzt → Fachgebiet, Zimmer`<br>`Versicherung → Versicherung_Telefon` | – | 2. NF |
| `redundanz_gemischt_bestellung.sql` | `bestellung_flach` (`bestell_nr`, `artikel_nr`) | `bestell_nr → Bestelldatum, Kunde_Nr`<br>`Kunde_Nr → Kunde_Name, Kunde_Ort`<br>`artikel_nr → Artikel_Bezeichnung, Einzelpreis` | – | 1. NF |
| | `lieferant` (kein Schlüssel) | – | – | 1. NF; 2. und 3. NF nicht beurteilbar |
| `redundanz_ok_vereinsverwaltung.sql` | `ort` (`PLZ`) | `PLZ → Ort` | – | 3. NF |
| | `abteilung` (`id`) | `id → Bezeichnung, Leitung, Beitrag` | – | 3. NF |
| | `mitglied` (`id`) | `id → Name, PLZ` | – | 3. NF |
| | `mitgliedschaft` (`mitglied_id`, `abteilung_id`) | `(mitglied_id, abteilung_id) → Eintritt` | – | 3. NF |

Die beiden Spalten „Einzutragende Abhängigkeiten“ und „Höchste erfüllte NF“ sind genau die Werte, gegen die der automatische Test (`normalization.test.js`) prüft.

### Die Dateien im Einzelnen

**`redundanz_kursbuchung.sql` – Kursbuchung (eingebaut)**
- `belegung`: Wahlkurse in einer einzigen Tabelle. Schülerdaten (Name, Klasse, Klassenleitung) stehen bei jedem Kurs erneut, Kursdaten (Titel, Lehrkraft, Sprechstunde) bei jedem Schüler.
  - *Teilabhängigkeiten (2. NF):* `schueler_nr → Schueler_Name, Klasse` und `kurs_nr → Kurs_Titel, Lehrkraft` hängen nur von einem Teil des Schlüssels ab. Daraus folgt auch `schueler_nr → Klassenleitung` und `kurs_nr → Sprechstunde` (die Seite kennzeichnet sie als „folgt aus den eingetragenen Abhängigkeiten“).
  - *Transitive Abhängigkeiten (3. NF):* `Klasse → Klassenleitung`, `Lehrkraft → Sprechstunde`.
  - Kurs 105 (Astronomie) kommt nur einmal vor, die Klasse 10a viermal.
- `kontakt`: Telefonnummern als Liste in einer Spalte (zwei Nummern, mit Komma oder Semikolon getrennt), zwei Spalten `Erziehungsberechtigte1/2` als Wiederholungsgruppe (1. NF) und `PLZ → Ort` (3. NF).
- `raum`: normalisiert, zum Vergleich.

**`redundanz_1nf_kontaktliste.sql`**
- `Telefon1`, `Telefon2`, `Telefon3`: Wiederholungsgruppe.
- `Hobbys` („Fußball, Schach“) und `Adresse` („Musterweg 3, 12345 Musterstadt“): mehrere Werte in einem Feld.
- Die Seite weist auf alle drei Auffälligkeiten hin; angekreuzt wird trotzdem von Hand.

**`redundanz_2nf_ausleihe.sql`**
- Schlüssel aus drei Spalten (`leser_nr`, `buch_nr`, `Ausleihdatum`), damit dieselbe Person dasselbe Buch mehrfach ausleihen kann (leser 1 hat Buch 11 zweimal).
- Leser- und Buchdaten hängen nur von einem Teil des Schlüssels ab.

**`redundanz_2nf_projekte.sql`**
- Zusammengesetzter Schlüssel aus zwei Spalten.
- Mitarbeiter 4 und Projekt 12 kommen **nur einmal** vor (Beispiel für die Löschanomalie: Mit dem Datensatz verschwinden die Angaben zu Dieter Pohl bzw. zum Messeauftritt). Alle anderen kommen mehrfach vor (Änderungsanomalie).

**`redundanz_3nf_verein.sql`**
- Schlüssel `id` (`AUTO_INCREMENT`). `Ort` hängt von `PLZ` ab, `Abteilungsleitung` und `Beitrag` hängen von `Abteilung` ab: transitive Abhängigkeiten.
- **Absichtlicher Widerspruch:** Zur PLZ 12347 sind „Beispielhausen“ und „Beispielhsn.“ gespeichert. So sieht eine bereits eingetretene Änderungsanomalie aus. Die Seite zeigt bei `PLZ → Ort` „widerspricht den Daten (1 Wert)“ mit den betroffenen Zeilen und bewertet die Abhängigkeit trotzdem.

**`redundanz_3nf_praxis.sql`**
- Schlüssel `id` (`AUTO_INCREMENT`), alle übrigen Spalten dürfen leer sein. Deshalb ergibt die **Einfügeanomalie** hier keine Fehlermeldung, sondern einen unvollständigen Datensatz mit `NULL`-Werten.
- `Arzt → Fachgebiet, Zimmer` und `Versicherung → Versicherung_Telefon`.
- Dr. Lorenz kommt nur einmal vor, die Kasse „Bergland“ zweimal.

**`redundanz_gemischt_bestellung.sql`**
- `bestellung_flach`: Teilabhängigkeiten *und* eine transitive Abhängigkeit gleichzeitig. Die Seite bietet die Verstöße nacheinander zur Auswahl an:
  1. `bestell_nr → Bestelldatum, Kunde_Nr, Kunde_Name, Kunde_Ort` (Teilabhängigkeit; `Kunde_Name` und `Kunde_Ort` folgen über `Kunde_Nr`)
  2. `artikel_nr → Artikel_Bezeichnung, Einzelpreis` (Teilabhängigkeit)
  3. `Kunde_Nr → Kunde_Name, Kunde_Ort` (transitiv)
- `lieferant`: **keine** Primärschlüssel-Angabe und ein doppelter Datensatz („Papierhof GmbH“). Die Seite meldet, dass es keinen Schlüssel gibt, und beurteilt die 2. und 3. NF als „offen“. Auch aus Abhängigkeiten lässt sich hier kein Schlüssel ableiten, weil die Datensätze nicht eindeutig sind.

**`redundanz_ok_vereinsverwaltung.sql` – Gegenprobe**
- Dieselben Informationen wie in `redundanz_3nf_verein.sql`, aufgeteilt auf `ort`, `abteilung`, `mitglied` und `mitgliedschaft` (Verbindungstabelle mit zusammengesetztem Schlüssel).
- Mit den Abhängigkeiten aus der Tabelle oben ergibt sich überall die 3. NF, und es erscheinen keine Anomalien („Keine Anomalien durch die eingetragenen Abhängigkeiten“).
- Gut für die Frage: „Was hat sich gegenüber der Vereinsliste geändert, und warum verschwinden die Anomalien?“

### Was die Anomalie-Beispiele zeigen

Zu jedem Verstoß gegen die 2. oder 3. NF zeigt die Seite je ein Beispiel mit echten Werten aus den Daten, ausgeführt auf einer Kopie:

| Anomalie | Beispiel | Erwartung |
|---|---|---|
| Änderungsanomalie | `UPDATE` ändert die abhängige Spalte nur in einer Zeile | danach gibt es zu demselben Wert zwei verschiedene Werte (nur möglich, wenn der Wert mehrfach vorkommt) |
| Löschanomalie | `DELETE` über den Schlüssel der Datensätze, in denen ein Wert am seltensten vorkommt | die Datensätze werden vollständig gezeigt, die mit ihnen verlorene Information ist hervorgehoben; die Prüfabfrage liefert danach keine Zeile mehr |
| Einfügeanomalie | `INSERT` nur der neuen Information (ohne die übrigen Schlüsselspalten) | Fehlermeldung (Schlüsselspalte fehlt) – oder bei `AUTO_INCREMENT` und nullbaren Spalten ein unvollständiger Datensatz |

Wo die Daten zu einem Beispiel nicht reichen (etwa wenn kein Wert mehrfach vorkommt), steht an dieser Stelle ein erklärender Text statt eines Befehls.

## Hinweise zur Verwendung

- Beim Hochladen ersetzt eine Datei die aktuelle Datenbank. Eingetragene Abhängigkeiten und Markierungen auf Seite 6 werden dabei geleert.
- Die Dateien sind UTF-8 mit LF-Zeilenenden (ohne BOM). Der Build prüft das.
- Eigene Übungsdateien lassen sich nach demselben Muster erstellen: einen Verstoß bewusst einbauen, einzelne Werte nur einmal vorkommen lassen (für die Löschanomalie), andere mehrfach (für die Änderungsanomalie), und die beabsichtigten Abhängigkeiten im Dateikopf festhalten.
