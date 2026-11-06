# SQL Sandbox – SCORM-1.2-Lernpaket zu SQL-Abfragen

**SQL Sandbox** steht für **S**imple **A**nd **N**ice **D**atabase **B**ox for **O**nline e**X**ercises.

Die SQL Sandbox ist eine interaktive Lernumgebung zum Abfragen relationaler Datenbanken mit **SQL**.
Das Paket läuft vollständig im Browser. Die SQL-Engine (Lexer, Parser, Ausführung) ist eigener Code: Es werden keine externen Ressourcen geladen und keine externen Bibliotheken verwendet (auch kein SQLite/sql.js).

## Inhalt für den Unterricht

| Seite | Inhalt |
|---|---|
| 1 Datenbank laden | Eine von fünf Beispieldatenbanken wählen (Schule, Bibliothek, Online-Shop, Sportverein sowie die absichtlich nicht normalisierte Kursbuchung) oder eine eigene SQL-Datei hochladen (`DROP TABLE`, `CREATE TABLE` auch mit `CHECK`, `INSERT INTO` auch mit `SELECT`/`WITH`, `CREATE VIEW`) |
| 2 Tabellen | Aufbau (Spalten, Datentypen, Primär-/Fremdschlüssel, NOT NULL, CHECK-Bedingungen) und Inhalt aller Tabellen; je Tabelle sind etwa fünf Datensätze sichtbar, der Rest durch Scrollen. Unter jeder Tabelle lässt sich der `CREATE TABLE`-Befehl aufklappen (anfangs zugeklappt). Sichten (Views) stehen in einem eigenen Abschnitt mit ihrem aktuellen Ergebnis und dem aufklappbaren `CREATE VIEW`-Befehl |
| 3 SQL-Befehle | Eingabemaske (anfangs leer) mit „Ausführen“ (auch Strg + Enter) für Abfragen, Datenänderungen und `CREATE/DROP VIEW`; Fehlermeldungen erscheinen unter der Eingabe mit Zeile, Spalte, markierter Fehlerstelle und Hinweisen wie „Meinten Sie …?“; Ergebnistabellen haben Platz für zehn Zeilen, weitere durch Scrollen. Hinweise (ohne Abbruch) bei vermutlich vergessener Verknüpfungsbedingung, bei Texten in falscher Groß-/Kleinschreibung und bei kleingeschriebenen Schlüsselwörtern. Kurzreferenz der unterstützten Befehle |
| 4 Schritt für Schritt | Eine `SELECT`-Abfrage wird in der Reihenfolge ihrer Auswertung gezeigt (FROM/JOIN → WHERE → GROUP BY → HAVING → SELECT → DISTINCT → ORDER BY → LIMIT): Abspieler mit Schrittliste, Anfang/Zurück/Weiter/Ende und Pfeiltasten; der zugehörige Teil der Abfrage ist im SQL-Text markiert; zu jedem Schritt die Zwischentabelle. Herausfallende Zeilen bleiben zunächst sichtbar (grau, durchgestrichen). Eigene Eingabe oder „Befehl von Seite 3 übernehmen“; die Datenbank wird nicht verändert |
| 5 Klassendiagramm | Das Tabellenschema als UML-Klassendiagramm, zur Veranschaulichung (ein Hinweis über dem Diagramm stellt klar, dass es nicht den in Unterricht und Leistungsnachweisen geforderten Zeichenkonventionen entspricht): Klassen mit Attributen, Beziehungen als Assoziationen mit Multiplizitäten (`1`, `0..1`, `n`, bei n:m `n` und `m`), Verbindungstabellen als n:m-Beziehung (mit eigenen Spalten als Assoziationsklasse). Übersichtliche Anordnung mit rechtwinkligen Linien, bei genügend Platz in die Breite, sonst in die Tiefe (auch fest wählbar); Klassenkarten lassen sich mit Maus, Touch und Tastatur verschieben. Einzelne Klassen lassen sich samt ihren Beziehungen aus- und einblenden. Hinweise bei Fremdschlüsseln auf nicht vorhandene Tabellen. Textfassung zum Aufklappen |
| 6 Redundanzen | Normalformen je Tabelle (1. bis 3. NF) nach den funktionalen Abhängigkeiten, die die Lernenden selbst eintragen (geprüft gegen die Daten, Widersprüche werden angezeigt); Markierung mehrwertiger Spalten für die 1. NF mit Hinweisen auf Listen und Wiederholungsgruppen; Bewertung mit Begründung (Teilabhängigkeit, transitive Abhängigkeit); zu jedem Verstoß je ein Beispiel für Einfüge-, Änderungs- und Löschanomalie mit SQL-Befehl und Vorher/Nachher, simuliert auf einer Kopie; „Auf Seite 3 übernehmen“ |

Zwischen den Seiten kann jederzeit gewechselt werden. Eingaben, Ergebnisse und die Datenbank bleiben dabei erhalten. Die Registerkarten tragen keine Abschlussmarkierung; die Fußzeile zeigt, ob eine Verbindung zur Lernplattform besteht.
Änderungen durch `INSERT`, `UPDATE` und `DELETE` sind sofort auf Seite 2 sichtbar. „Datenbank zurücksetzen“ stellt den Stand nach dem Laden wieder her. Wird eine andere Datenbank geladen, zeigt Seite 5 sofort deren Klassendiagramm.

### Schritt für Schritt (Seite 4)

Die Zwischenstände stammen aus der echten Ausführung (keine zweite, vereinfachte Auswertung). Der letzte Schritt „Ergebnis“ ist deshalb immer genau das Ergebnis von Seite 3; die Tests prüfen das für über hundert Abfragen.

- **Tabellen in FROM:** je Tabelle, Sicht, WITH-Abfrage oder Unterabfrage ein Schritt mit allen Zeilen.
- **Verknüpfungen** (`JOIN`, `LEFT/RIGHT JOIN`, `CROSS JOIN`, Komma), umschaltbar:
  - *Farbige Zuordnung:* beide Ausgangstabellen nebeneinander, Zeilen nummeriert (L1, L2 … farbig; R1, R2 …), Spalte „Partner“; darunter das Ergebnis mit der Herkunft jeder Zeile. Mit `NULL` aufgefüllte Zellen sind gestrichelt umrandet.
  - *Kreuzprodukt-Raster:* Zeilen links × Zeilen rechts mit dem Wert der ON-Bedingung (✓ wahr, ✗ falsch, ? unbekannt), bei `LEFT/RIGHT JOIN` mit der Angabe, welche Zeilen mit `NULL` erhalten bleiben. Nur bis 20 × 20 Zeilen.
  - Beim Komma (`FROM a, b WHERE …`) entsteht zuerst das vollständige Kreuzprodukt; die Bedingung wirkt erst im WHERE-Schritt. Wäre es zu groß (über 200.000 Zeilen), werden nur die Kombinationen gezeigt, die die Gleichheitsbedingung aus WHERE erfüllen, mit Hinweis.
- **WHERE und HAVING:** je Zeile bzw. Gruppe der Wert der Bedingung (wahr, falsch, unbekannt bei `NULL`), bei `AND` auch der Wert jeder Teilbedingung. Herausfallende Zeilen lassen sich ausblenden.
- **GROUP BY:** Zeilen nach Gruppen geordnet und eingefärbt (G1, G2 …), eine Tabelle der Gruppen mit den Aggregatwerten und der Rechenweg je Gruppe, z. B. `AVG(Note) = (2 + 3 + 1) / 3 = 2`; `NULL`-Werte und `DISTINCT` werden genannt. Aggregatfunktionen ohne `GROUP BY` bilden eine Gruppe.
- **SELECT, DISTINCT, ORDER BY, LIMIT:** berechnete Spalten; entfernte Duplikate; Platz vor und nach dem Sortieren; übersprungene und entfallende Zeilen.
- **Mengenoperationen:** beide Abfragen als eigene Schritte, dann `UNION`/`INTERSECT`/`EXCEPT`, danach `ORDER BY` und `LIMIT` des Gesamtergebnisses.
- **Grenzen:** Erlaubt ist genau eine Abfrage mit `SELECT` (auch mit `WITH`). Unterabfragen, WITH-Abfragen, Sichten und Fensterfunktionen erscheinen jeweils als ein Schritt mit ihrem Ergebnis, nicht mit eigener Schrittfolge. Je Schritt werden höchstens 200 Zeilen angezeigt (mit Hinweis), im Rechenweg höchstens 30 Werte je Gruppe.
- Nach einer Datenänderung auf Seite 3 oder dem Laden einer anderen Datenbank wird die Auswertung entfernt (mit Hinweis); die Eingabe bleibt erhalten.
- **Breite:** Auf großen Bildschirmen nutzt diese Seite bis 2400 px Breite (Raster und Ausgangstabellen haben dann mehr Platz). Die übrigen Seiten bleiben bei höchstens 1400 px.

### Redundanzen (Seite 6)

Die Seite erkennt **keine** Abhängigkeiten selbst: In den vorhandenen Daten gelten oft zufällige Abhängigkeiten (in der Schule z. B. `Datum → fach_id` bei den Noten), die als Verstoß gemeldet würden. Die Lernenden tragen deshalb die Abhängigkeiten ein, die fachlich gelten.

- **Funktionale Abhängigkeiten** `X → Y` je Tabelle: links 1 bis 3 Spalten, rechts mindestens eine; höchstens 30 je Tabelle. Triviale (eine Spalte links und rechts) und doppelte Abhängigkeiten werden abgelehnt. Jede Abhängigkeit wird an den Daten geprüft (Zeilen mit `NULL` links zählen nicht). Ein Widerspruch wird mit den betroffenen Werten angezeigt – gilt die Abhängigkeit fachlich, ist das eine bereits eingetretene Änderungsanomalie; bewertet wird trotzdem.
- **Schlüsselkandidaten:** Primärschlüssel, `UNIQUE`-Schlüssel aus `NOT NULL`-Spalten und minimale Spaltenmengen (bis 3 Spalten), die nach den Abhängigkeiten alle Spalten bestimmen. Abgeleitete Schlüssel müssen in den Daten eindeutig sein (doppelte Datensätze widerlegen sie) und dürfen nicht einfach alle Spalten umfassen. Ein Hinweis erscheint, wenn der Primärschlüssel danach nicht minimal ist oder es gar keinen Schlüssel gibt.
- **1. NF:** Die Lernenden markieren Spalten, die mehrere Werte enthalten oder zu einer Wiederholungsgruppe gehören. Die Seite weist nur auf Auffälligkeiten hin (Listen mit `,` `;` `/` in mindestens zwei Zeilen, Spalten wie `Telefon1`, `Telefon2`), markiert aber nichts selbst.
- **2. NF:** 1. NF und kein Nichtschlüsselattribut hängt von einem echten Teil eines Schlüsselkandidaten ab – auch über mehrere Abhängigkeiten hinweg (z. B. `schueler_nr → Klasse → Klassenleitung`). Besteht jeder Schlüssel aus einer Spalte, ist sie automatisch erfüllt.
- **3. NF:** 2. NF und keine eingetragene Abhängigkeit `X → A` mit Nichtschlüsselattribut `A`, bei der `X` kein Schlüssel ist (transitive Abhängigkeit).
- Ist eine Normalform ohne Abhängigkeiten nicht entscheidbar (zusammengesetzter Schlüssel bzw. 3. NF), zeigt die Seite „offen“. Die Bewertung berücksichtigt nur die eingetragenen Abhängigkeiten.
- **Anomalien** zu jedem Verstoß (Auswahl, wenn es mehrere gibt), mit Werten aus den Daten:
  - *Änderungsanomalie:* ein Wert der linken Seite, der mehrfach vorkommt; `UPDATE` ändert die abhängige Spalte nur in einer Zeile, danach widersprechen sich die Zeilen (geänderte Zelle hervorgehoben).
  - *Löschanomalie:* möglichst ein Wert, der nur in einem Datensatz steht. Gelöscht werden die betroffenen Datensätze über ihren Schlüssel (`DELETE … WHERE schueler_nr IN (3, 5)`); die Seite zeigt sie vollständig mit allen Angaben und hebt die Information hervor, die mit ihnen verloren geht. Als Nachweis zeigt eine Abfrage, dass zum Wert danach nichts mehr gespeichert ist.
  - *Einfügeanomalie:* `INSERT` nur der neuen Information ohne die übrigen Schlüsselspalten. Gezeigt wird das echte Ergebnis: die Fehlermeldung (Schlüssel fehlt) oder bei `AUTO_INCREMENT` der unvollständige Datensatz mit `NULL`-Werten.
  - Die drei Beispiele stehen untereinander in voller Breite. Die Befehle laufen auf einer Kopie; die Datenbank bleibt unverändert. „Auf Seite 3 übernehmen“ setzt Befehl und Prüfabfrage in die Eingabe von Seite 3, ohne sie auszuführen.
- Abhängigkeiten und Markierungen bleiben beim Seitenwechsel und nach Änderungen auf Seite 3 erhalten. Beim Laden einer anderen Datenbank und beim Zurücksetzen werden sie geleert (mit Hinweis). Gespeichert wird nichts.

### Klassendiagramm (Seite 5)

Das Diagramm wird aus den Tabellendefinitionen abgeleitet:

- **Klassen:** Jede Tabelle wird eine Klasse. Der Klassenname beginnt mit einem Großbuchstaben und ist sonst klein geschrieben, unabhängig von der Schreibung der Tabelle (`schule` → `Schule`, `SCHUL_klasse` → `Schul_klasse`).
- **Attribute:** die Spalten, ganz klein geschrieben (`Adresse` → `adresse`), ohne Datentyp und ohne Methoden.
  - Spalten von Fremdschlüsseln erscheinen nicht; sie werden durch die Beziehung ausgedrückt.
  - Künstliche Primärschlüssel entfallen: Spalten mit `AUTO_INCREMENT` und Spalten, deren Name „id“ als eigenen Namensteil enthält (`id`, `ID`, `kunde_id`, `id_kunde`, `KundenID`, `kundeId`). Wörter wie `Video` zählen nicht.
  - Natürliche Primärschlüssel (z. B. `Kuerzel CHAR(3) PRIMARY KEY`) erscheinen als normale Attribute. Schlüssel werden nicht markiert.
- **Beziehungen:** Jeder Fremdschlüssel von Tabelle A auf Tabelle B wird eine Assoziation.
  - Multiplizität bei B: `1`, wenn alle Spalten des Fremdschlüssels `NOT NULL` sind, sonst `0..1`.
  - Multiplizität bei A: `0..1`, wenn die Spalten eindeutig sind (`UNIQUE` oder Primärschlüssel, also 1:1), sonst `n`.
  - Bezeichner ist der Name aus `CONSTRAINT name FOREIGN KEY …`, sonst die Spalte des Fremdschlüssels (z. B. `schule_id`).
  - Ein Selbstbezug (z. B. `vorgesetzter_id`) erscheint als Schleife. Mehrere Fremdschlüssel zwischen denselben Tabellen (z. B. `heim_id` und `gast_id`) laufen parallel.
- **Verbindungstabellen** werden als n:m-Beziehung (`n` zu `m`) dargestellt. Als Verbindungstabelle gilt eine Tabelle mit genau zwei Fremdschlüsseln auf zwei verschiedene Tabellen, deren Fremdschlüssel-Spalten `NOT NULL` und für sich nicht eindeutig sind, auf die kein anderer Fremdschlüssel verweist und die keinen natürlichen Primärschlüssel hat.
  - Mit eigenen Spalten (z. B. `Menge` in `bestellposition`) wird sie zur **Assoziationsklasse**, gestrichelt an die n:m-Linie angebunden.
  - Ohne eigene Spalten trägt die Linie den Tabellennamen.
- **Hinweise** erscheinen, wenn ein Fremdschlüssel auf eine Tabelle verweist, die es nicht gibt (die Beziehung fehlt dann), auf eine Sicht oder auf eine nicht vorhandene Spalte, oder wenn sich die Schreibung unterscheidet.
- **Anordnung:**
  - Ebenenlayout: In die Breite stehen referenzierte Klassen links und abhängige rechts davon, in die Tiefe stehen referenzierte Klassen oben und abhängige darunter. Die Reihenfolge wird so gewählt, dass sich möglichst wenige Linien kreuzen.
  - **Ausrichtung:** „Automatisch“ (Standard) ordnet in die Breite an, wenn das Diagramm so in den verfügbaren Bereich passt, sonst in die Tiefe. „In die Breite“ und „In die Tiefe“ legen die Ausrichtung fest. Gewählt wird beim Laden, beim Zurücksetzen und beim Ändern der Auswahl, nicht bei jeder Änderung der Fenstergröße; verschobene Karten bleiben so erhalten.
  - Alle Linien bestehen nur aus waagerechten und senkrechten Abschnitten.
  - Die Karten lassen sich mit Maus oder Touch verschieben, oder nach Auswahl mit der Tabulatortaste mit den Pfeiltasten (mit Umschalt in größeren Schritten). Die Linien werden dabei rechtwinklig neu geführt.
  - „Anordnung zurücksetzen“ stellt die Standardanordnung wieder her. Datenänderungen auf Seite 3 lassen die Anordnung unverändert.
- **Auswahl der Klassen** („Angezeigte Klassen“ über dem Diagramm):
  - Standardmäßig werden alle Klassen gezeigt. Jede Klasse lässt sich per Kontrollkästchen aus- und wieder einblenden; „Alle anzeigen“ und „Alle ausblenden“ schalten alle auf einmal.
  - Mit einer Klasse verschwinden ihre Beziehungen und erscheinen mit ihr wieder. Die sichtbaren Klassen werden nach jeder Änderung neu angeordnet.
  - Assoziationsklassen sind eigenständig wählbar. Ist nur die Assoziationsklasse ausgeblendet, bleibt die n:m-Linie und trägt den Namen der Verbindungstabelle. Ist ein Ende der n:m-Beziehung ausgeblendet, verschwinden Linie und Assoziationsklasse; ihr Kontrollkästchen ist dann gesperrt, mit Hinweis auf das fehlende Ende.
  - Die Auswahl bleibt bei Datenänderungen auf Seite 3 erhalten. Beim Laden einer Datenbank werden wieder alle Klassen gezeigt.
  - Hinweise zu Fremdschlüsseln gelten immer für das ganze Schema. Infozeile und Textfassung nennen, wie viele Klassen und Beziehungen angezeigt sind und welche Klassen ausgeblendet sind.
- **Sichten** erscheinen nicht im Klassendiagramm.
- **Aufbau der Seite:** Unter der Überschrift steht ein kurzer Hinweis, dass das Diagramm nur der Veranschaulichung dient und nicht den im Unterricht und in Leistungsnachweisen geforderten Zeichenkonventionen entspricht. Darunter stehen die Bedienelemente (Anordnung, Ausrichtung, Auswahl der Klassen), danach das Diagramm mit Infozeile und Textfassung, die Erläuterung am Ende.

### Unterstützter SQL-Umfang

- **Abfragen:** `SELECT [DISTINCT] … FROM … WHERE … GROUP BY … HAVING … ORDER BY … [ASC|DESC] LIMIT n [OFFSET m]` (auch `LIMIT m, n`); `SELECT` ohne `FROM` (z. B. `SELECT 2 * 21`).
- **Spalten und Aliase:** `*`, `t.*`, Ausdrücke, `AS` (auch ohne `AS`); Tabellenaliase wie `FROM schule s` mit Punktnotation `s.Adresse`.
- **Verknüpfungen:** `[INNER] JOIN … ON`, `LEFT [OUTER] JOIN`, `RIGHT [OUTER] JOIN`, `CROSS JOIN`, impliziter Join `FROM a, b WHERE a.id = b.a_id`, Self-Join mit Aliasen.
- **Bedingungen:** `= <> != < <= > >=`, `AND`, `OR`, `NOT`, `BETWEEN … AND …`, `LIKE` mit `%` und `_` (Maskierung mit `\`), `IN (Liste)`, `IS [NOT] NULL`, `[NOT] EXISTS`.
- **Aggregatfunktionen:** `COUNT(*)`, `COUNT(Spalte)`, `COUNT(DISTINCT …)`, `SUM`, `AVG`, `MIN`, `MAX`; dazu `ROUND(Zahl [, Stellen])`.
- **Unterabfragen:** als Wert (`WHERE Preis > (SELECT AVG(Preis) …)`), mit `IN`/`EXISTS`, korreliert und als Tabelle in `FROM (SELECT …) AS t`.
- **WITH (Common Table Expressions):** `WITH teuer AS (SELECT …), billig (name, preis) AS (SELECT …) SELECT … FROM teuer …`. Mehrere WITH-Abfragen sind möglich, jede kann die vorher definierten verwenden; optional mit Spaltenliste. WITH funktioniert auch in Unterabfragen, in `FROM (…)`, in Sichten und in `INSERT … SELECT`. Zusätzlich ist `WITH … INSERT INTO t (…) SELECT …` möglich (wie in PostgreSQL; MySQL verlangt dafür `INSERT INTO t (…) WITH … SELECT …`, was ebenfalls funktioniert). Eine WITH-Abfrage verdeckt eine gleichnamige Tabelle. Nicht rekursiv.
- **Rechnen:** `+ - * / %`, Klammern, Vorzeichen.
- **Fallunterscheidung:** `CASE WHEN Bedingung THEN Wert … [ELSE Wert] END` und `CASE Ausdruck WHEN Wert THEN … END`; ohne passenden Zweig und ohne `ELSE` ergibt sich `NULL`. CASE ist überall erlaubt, wo ein Ausdruck stehen kann (auch in `WHERE`, `GROUP BY`, `ORDER BY` und `CHECK`).
- **Fensterfunktionen:** `ROW_NUMBER()`, `RANK()`, `DENSE_RANK()`, `LAG(x [, n [, Standard]])`, `LEAD(…)` sowie `COUNT(*|x)`, `SUM`, `AVG`, `MIN`, `MAX` mit `OVER ([PARTITION BY …] [ORDER BY … [ASC|DESC]])`. Sie werden nach `WHERE`, `GROUP BY` und `HAVING` berechnet und stehen deshalb nur in der SELECT-Liste und in `ORDER BY`. Rahmen wie im SQL-Standard und in MySQL: ohne `ORDER BY` die ganze Partition, mit `ORDER BY` alle Zeilen bis einschließlich der gleichrangigen (laufende Summe). Bei `GROUP BY` sind Aggregate im Fenster möglich, z. B. `SUM(COUNT(*)) OVER ()`.
- **Mengenoperationen:** `SELECT … UNION [ALL|DISTINCT] SELECT …`, `INTERSECT [ALL]` und `EXCEPT [ALL]` (INTERSECT bindet stärker; Klammern sind möglich). Beide Abfragen müssen gleich viele Spalten liefern; die Spaltennamen kommen aus der ersten. `ORDER BY`/`LIMIT` am Ende gelten für das Gesamtergebnis und verwenden Ergebnisspalten (Name oder Nummer); eine einzelne Abfrage mit eigenem `ORDER BY`/`LIMIT` steht in Klammern. Zeilen gelten als gleich wie bei `DISTINCT` (`NULL` = `NULL`, Groß-/Kleinschreibung zählt). Mengenoperationen funktionieren überall, wo eine Abfrage stehen kann – auch in Unterabfragen, WITH, Sichten und `INSERT … SELECT`.
- **Daten ändern (Seite 3):** `INSERT INTO … [(Spalten)] VALUES (…), (…)` oder `INSERT INTO … [(Spalten)] [WITH …] SELECT …` (das Abfrageergebnis wird vollständig berechnet, bevor eingefügt wird), `UPDATE … SET … [WHERE …]`, `DELETE FROM … [WHERE …]`. Mehrere Befehle (getrennt durch `;`) werden **gemeinsam** ausgeführt: Enthält einer einen Fehler, bleibt die Datenbank unverändert.
- **Sichten (Views, Seite 3 und Dateien):** `CREATE [OR REPLACE] VIEW name [(Spalten)] AS SELECT …` (auch mit `WITH`), `DROP VIEW [IF EXISTS] name`. Eine Sicht speichert nur ihre Abfrage; bei jeder Verwendung wird sie neu ausgewertet und zeigt so immer den aktuellen Stand der Tabellen. In Sichten kann nicht geschrieben werden (`INSERT`/`UPDATE`/`DELETE` ergeben eine Meldung). Wird eine benötigte Tabelle gelöscht, meldet die Sicht beim Abfragen „ungültig“. Sichten, die über andere Sichten auf sich selbst verweisen, werden abgelehnt.
- **Hinweise zum Ergebnis** (die Abfrage wird trotzdem ausgeführt):
  - Stehen mehrere Tabellen in `FROM`, ohne dass alle über eine Bedingung (in `ON` oder `WHERE`) verbunden sind, entsteht ein kartesisches Produkt. Der Hinweis nennt die nicht verknüpften Tabellen und schlägt, wenn möglich, eine Bedingung aus den Fremdschlüsseln vor, z. B. `bp.bestellung_id = b.id`. Ein ausdrückliches `CROSS JOIN` gilt als beabsichtigt und ergibt keinen Hinweis.
  - Vergleicht `=`, `IN` oder `LIKE` eine Spalte mit einem Text, der nur in anderer Groß-/Kleinschreibung vorkommt (`'berlin'` statt `'Berlin'`), kommt der Vorschlag „Meinten Sie 'Berlin'?“.
  - Nicht großgeschriebene Schlüsselwörter werden mit der üblichen Schreibweise genannt (`select → SELECT`).
- **Nicht unterstützt** (mit eigener, verständlicher Meldung): `WITH RECURSIVE`, Rahmenangaben (`ROWS/RANGE BETWEEN …`) und benannte Fenster (`WINDOW w AS …`), `FULL OUTER JOIN`, `NATURAL JOIN`, `USING`, `ANY/ALL`, weitere Funktionen (z. B. `UPPER`, `CONCAT`, Datumsfunktionen).

### Festlegungen (an MySQL/MariaDB angelehnt)

Viele Schulen arbeiten mit MySQL/MariaDB und phpMyAdmin. Die SQL Sandbox verhält sich deshalb in den meisten Punkten wie MySQL. Bei der Groß-/Kleinschreibung ist sie bewusst strenger, damit sich Lernende eine saubere Schreibweise angewöhnen.

- **Schlüsselwörter** werden in jeder Schreibweise erkannt. Nicht großgeschriebene Schlüsselwörter ergeben aber einen kurzen Hinweis.
- **Tabellen-, Spalten- und Aliasnamen** müssen genau so geschrieben werden wie definiert. `preis` statt `Preis` ergibt einen Fehler mit dem Vorschlag „Meinten Sie „Preis“?“. Namen, die sich nur in der Schreibung unterscheiden (`Preis` und `preis` in derselben Tabelle), sind nicht erlaubt.
- **Texte** stehen in einfachen oder doppelten Anführungszeichen (`'Müller'`, `"Müller"`). **Namen** mit Sonderzeichen oder reservierten Wörtern stehen in `` `Backticks` ``.
- **Textvergleich** und `LIKE` beachten die Groß-/Kleinschreibung (`'Berlin' <> 'berlin'`), ebenso `GROUP BY`, `DISTINCT`, `UNIQUE` und `ENUM`-Werte. Umlaute werden unterschieden (`'Müller' <> 'Muller'`), Leerzeichen am Ende zählen nicht. Sortiert wird nach deutscher Ordnung.
- `NULL` folgt der dreiwertigen Logik (`NULL = NULL` ergibt `NULL`; `NOT IN` mit `NULL` in der Liste liefert keine Zeilen). Bei `ORDER BY` steht `NULL` zuerst.
- `/` liefert eine Dezimalzahl, Division durch 0 ergibt `NULL`. Ein Text, der eine Zahl ist (`'42'`), wird beim Vergleich mit einer Zahl als Zahl gelesen.
- **Datumswerte** sind Texte im Format `'JJJJ-MM-TT'` (bzw. `'JJJJ-MM-TT hh:mm:ss'`); sie lassen sich vergleichen und sortieren, aber nicht berechnen.
- **GROUP BY streng** (wie `ONLY_FULL_GROUP_BY`): Jede ausgegebene Spalte muss gruppiert oder aggregiert sein. Ist der Primärschlüssel einer Tabelle gruppiert, sind deren übrige Spalten erlaubt.
- Aliase aus der SELECT-Liste sind in `GROUP BY`, `HAVING` und `ORDER BY` erlaubt, in `WHERE` nicht (mit Hinweis).
- `UPDATE`: Alle Ausdrücke in `SET` verwenden die Werte **vor** der Änderung (wie im SQL-Standard).
- **Datentypen** werden geprüft: `INT` (mit Wertebereich je Typ, auch `UNSIGNED`), `DECIMAL(p,s)`, `FLOAT/DOUBLE`, `CHAR/VARCHAR(n)` (Länge), `TEXT`, `ENUM(…)`, `DATE`, `DATETIME/TIMESTAMP`, `TIME`, `YEAR`, `BOOLEAN` (als 0/1).
- `PRIMARY KEY` (auch zusammengesetzt), `UNIQUE`, `NOT NULL`, `DEFAULT`, `AUTO_INCREMENT`, `CHECK` und **Fremdschlüssel** werden durchgesetzt. Der Name eines Fremdschlüssels aus `CONSTRAINT name FOREIGN KEY …` bleibt erhalten; doppelte Namen in einer Tabelle sind nicht erlaubt.
- **Fremdschlüssel** (referenzielle Integrität, wie MySQL/InnoDB; geprüft wird am Ende jedes Befehls):
  - `INSERT` und `UPDATE`: Ein neuer oder geänderter Wert muss in der referenzierten Tabelle vorkommen. Enthält eine Spalte des Fremdschlüssels `NULL`, wird nicht geprüft. Weil erst am Befehlsende geprüft wird, darf ein `INSERT` mit mehreren Zeilen auch auf eine Zeile verweisen, die im selben Befehl eingefügt wird (z. B. bei einem Selbstbezug).
  - `DELETE` und `UPDATE` des Schlüssels in der referenzierten Tabelle: Es gilt die Angabe `ON DELETE` bzw. `ON UPDATE`. Ohne Angabe sowie bei `RESTRICT` und `NO ACTION` wird der Befehl mit einer Fehlermeldung verhindert (sie nennt Tabelle, Wert und die Anzahl der verweisenden Datensätze). `CASCADE` löscht bzw. ändert die abhängigen Datensätze mit, auch über mehrere Stufen; `SET NULL` und `SET DEFAULT` setzen die Spalten des Fremdschlüssels auf `NULL` bzw. ihren Standardwert. Die Erfolgsmeldung auf Seite 3 nennt, was so mitgelöscht oder mitgeändert wurde.
  - Wie immer auf Seite 3 gilt: Scheitert ein Befehl, bleibt die Datenbank unverändert, auch wenn mehrere Befehle auf einmal ausgeführt werden.
  - `REFERENCES tabelle` ohne Spaltenliste verweist auf den Primärschlüssel. Ein Fremdschlüssel auf eine Tabelle oder Spalte, die es nicht gibt, wird nicht geprüft; das Klassendiagramm weist darauf hin.
  - Beim **Laden einer Datei** wird erst am Dateiende geprüft. Die Reihenfolge der Befehle spielt also keine Rolle, und Fremdschlüssel dürfen wie in phpMyAdmin-Exporten erst nach den Daten per `ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY` folgen. Verweist ein Datensatz ins Leere, wird die Datei nicht geladen; die Meldung nennt den Wert und den Befehl, aus dem der Datensatz stammt.
  - Seite 6 simuliert ihre Anomalie-Beispiele mit derselben Prüfung. Bei einer Tabelle, auf die andere verweisen, zeigt das Löschbeispiel deshalb gegebenenfalls die Fehlermeldung bzw. die Mitlöschung.
- **CHECK-Bedingungen**:
  - Sie stehen an einer Spalte (`Preis DECIMAL(8,2) CHECK (Preis >= 0)`) oder als Tabellenbedingung, auch mit Namen (`CONSTRAINT chk_rueckgabe CHECK (Rueckgabedatum IS NULL OR Rueckgabedatum >= Ausleihdatum)`). `ALTER TABLE … ADD [CONSTRAINT name] CHECK (…)` ist ebenfalls möglich.
  - Geprüft wird bei `INSERT` und `UPDATE`; beim Anlegen mit `ALTER TABLE` auch an den vorhandenen Datensätzen.
  - Wie im SQL-Standard und in MySQL ist ein Datensatz nur unzulässig, wenn die Bedingung **falsch** ist. Ergibt sie `NULL`, etwa weil ein Wert fehlt, wird er gespeichert.
  - Unterabfragen und Aggregatfunktionen sind in CHECK nicht erlaubt.
  - `NOT ENFORCED` (MySQL 8) speichert die Bedingung, ohne sie zu prüfen.
- **CREATE TABLE auf Seite 2** wird aus dem aktuellen Tabellenaufbau erzeugt (ähnlich `SHOW CREATE TABLE`). Er enthält daher auch Schlüssel, die erst per `ALTER TABLE` hinzukamen. Einfache Indizes (`KEY`, `INDEX`) und Tabellenoptionen (`ENGINE=…`) haben in der SQL Sandbox keine Wirkung und erscheinen dort nicht.

### Dateiformat für den Upload (Seite 1)

- **Dateien:** `.sql` oder `.txt`, höchstens 1 MB, Zeichensatz UTF-8 (sonst wird Windows-1252 angenommen, mit Hinweis).
- **Erlaubte Anweisungen:** `DROP TABLE [IF EXISTS]`, `CREATE TABLE [IF NOT EXISTS]` (auch mit `CHECK`), `INSERT INTO` (auch `INSERT INTO … [WITH …] SELECT …`, auch mit `UNION`), `CREATE [OR REPLACE] VIEW` und `DROP VIEW`; aus Exporten zusätzlich `ALTER TABLE … ADD PRIMARY KEY / ADD [UNIQUE] KEY / ADD CONSTRAINT … FOREIGN KEY / ADD [CONSTRAINT …] CHECK / ADD COLUMN / MODIFY` und `CREATE [UNIQUE] INDEX`.
- **Namen** müssen auch in der Datei überall gleich geschrieben sein (z. B. in `PRIMARY KEY (id)` und `INSERT INTO kurs (…)`).
- **Übersprungen** (ohne Wirkung, mit Hinweis): `SET`, `START TRANSACTION`, `BEGIN`, `COMMIT`, `LOCK/UNLOCK TABLES`, `USE`, `CREATE DATABASE` sowie Sonderkommentare `/*! … */`. Tabellenoptionen wie `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4` werden ignoriert.
- **Sichten aus Exporten:** Zusätze wie ``ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER`` und `WITH CASCADED CHECK OPTION` werden überlesen. Ein Datenbankpräfix wie in `` `schule`.`t`.`a` `` wird ignoriert (es gibt nur eine Datenbank). Die in Exporten übliche Ersatztabelle mit dem Namen der Sicht, die anschließend per `DROP TABLE` entfernt wird, funktioniert ebenfalls.
- **Grenzen:** 50 Tabellen, 50 Spalten je Tabelle, je Tabelle höchstens 50 CHECK-Bedingungen, 50 UNIQUE-Schlüssel und 50 Fremdschlüssel, 20.000 Datensätze insgesamt, Texte bis 1.000 Zeichen, Namen bis 64 Zeichen.
- Eine Datei wird **ganz oder gar nicht** übernommen. Bei einem Fehler erscheint die Meldung mit Zeile, Spalte und Ausschnitt; die bisherige Datenbank bleibt unverändert.

## Beispieldatenbanken und Dateien für den Unterricht

Alle Daten sind **frei erfunden** (Namen, Orte wie „Musterstadt“, Buchtitel, Artikel, Vereine). Ähnlichkeiten mit realen Personen, Schulen, Firmen, Werken oder Vereinen wären zufällig. Die Daten stehen unter der MIT-Lizenz.

Eine ausführliche Beschreibung aller Dateien – bei den Übungsdateien für die Seite „Redundanzen“ mit den beabsichtigten funktionalen Abhängigkeiten, den Absichten hinter den Daten und den erwarteten Ergebnissen – steht in [`testdata/README.md`](testdata/README.md).

| Datei in `testdata/` | Inhalt | Tabellen |
|---|---|---|
| `schule.sql` | Schulen, Lehrkräfte, Klassen, Schülerinnen und Schüler, Fächer, Noten | schule, lehrkraft, klasse, schueler, fach, note |
| `bibliothek.sql` | Autorinnen und Autoren, Bücher, Leserinnen und Leser, Ausleihen (auch offene) | autor, buch, leser, ausleihe |
| `online_shop.sql` | Kategorien, Artikel mit Preisen, Kundinnen und Kunden, Bestellungen, Bestellpositionen (zusammengesetzter Primärschlüssel) | kategorie, artikel, kunde, bestellung, bestellposition |
| `sportverein.sql` | Abteilungen, Trainerinnen und Trainer, Mannschaften, Mitglieder mit Beiträgen, Spiele (auch ohne Ergebnis) | abteilung, trainer, mannschaft, mitglied, spiel |
| `redundanz_kursbuchung.sql` | **Absichtlich nicht normalisiert:** Wahlkurse mit Schülerinnen, Schülern, Klassenleitung, Lehrkraft und Sprechstunde in einer Tabelle; Kontaktdaten mit Telefonliste und Wiederholungsgruppe; Räume (normalisiert, zum Vergleich) | belegung, kontakt, raum |
| `redundanz_1nf_kontaktliste.sql` | Teilnehmerliste mit Listen in einer Spalte (Hobbys, Adresse) und Wiederholungsgruppe (Telefon1 bis Telefon3) | teilnehmer |
| `redundanz_2nf_ausleihe.sql` | Ausleihen einer Schulbibliothek in einer Tabelle mit zusammengesetztem Schlüssel (leser_nr, buch_nr, Ausleihdatum) | ausleihe |
| `redundanz_3nf_verein.sql` | Vereinsmitglieder mit Wohnort und Abteilung; enthält absichtlich einen Widerspruch (PLZ 12347 mit zwei Schreibweisen des Orts); `AUTO_INCREMENT`-Schlüssel | mitglied |
| `redundanz_2nf_projekte.sql` | Mitarbeit an Projekten mit zusammengesetztem Schlüssel (mitarbeiter_nr, projekt_nr); Mitarbeiter 4 und Projekt 12 kommen nur einmal vor (Löschanomalie), die übrigen mehrfach (Änderungsanomalie) | projektmitarbeit |
| `redundanz_3nf_praxis.sql` | Terminliste einer Arztpraxis mit Arzt (Fachgebiet, Zimmer) und Krankenkasse (Telefon) in jeder Zeile; `AUTO_INCREMENT`-Schlüssel, alle übrigen Spalten dürfen leer sein (Einfügeanomalie ergibt einen unvollständigen Datensatz); Dr. Lorenz kommt nur einmal vor | termin |
| `redundanz_gemischt_bestellung.sql` | Bestellungen mit Kunden- und Artikeldaten in einer Tabelle (Teilabhängigkeiten und transitive Abhängigkeit, mehrere Verstöße zur Auswahl); dazu eine Tabelle **ohne Schlüssel** mit einem doppelten Datensatz | bestellung_flach, lieferant |
| `redundanz_ok_vereinsverwaltung.sql` | **Gegenprobe:** dieselben Vereinsdaten wie in `redundanz_3nf_verein.sql`, aber auf vier Tabellen verteilt – mit den passenden Abhängigkeiten keine Verstöße und keine Anomalien | ort, abteilung, mitglied, mitgliedschaft |
| `beispiel_phpmyadmin_export.sql` | Kursangebot einer Musikschule im Stil eines Datenbank-Exports (Backticks, `ENGINE=…`, `SET`, `CONSTRAINT … CHECK`, Schlüssel per `ALTER TABLE`). Der Fremdschlüssel von `anmeldung` auf `kurs` hat `ON DELETE CASCADE` (Löschen eines Kurses löscht seine Anmeldungen mit), der auf `teilnehmer` nicht (Löschen eines angemeldeten Teilnehmers wird verhindert) | kurs, teilnehmer, anmeldung |
| `beispiel_fehlerhaft.sql` | Übungsdatei mit zwei absichtlichen Fehlern (fehlendes Komma, doppelter Primärschlüssel) | – |

Die ersten fünf Dateien sind identisch mit den eingebauten Beispieldatenbanken auf Seite 1 (der Build prüft das). Sie eignen sich als Vorlage für eigene Datenbanken. Jede enthält einige `CHECK`-Bedingungen, z. B. `Note BETWEEN 1 AND 6`, `Preis >= 0` oder `Menge > 0`; ein `INSERT` mit unzulässigem Wert zeigt die entsprechende Meldung. Die Daten enthalten bewusst `NULL`-Werte und Datensätze ohne Partner, z. B. Lehrkräfte ohne Klasse, Fächer ohne Noten, Kundinnen und Kunden ohne Bestellung. So lassen sich `LEFT JOIN` und `IS NULL` sinnvoll üben.

**Lösungshinweise für Lehrkräfte (Seite 6):** Mit diesen Abhängigkeiten und Markierungen ergibt sich die angegebene höchste Normalform.

| Datei | Tabelle | Abhängigkeiten | mehrwertig markieren | Ergebnis |
|---|---|---|---|---|
| `redundanz_kursbuchung.sql` | belegung | `schueler_nr → Schueler_Name, Klasse`; `Klasse → Klassenleitung`; `kurs_nr → Kurs_Titel, Lehrkraft`; `Lehrkraft → Sprechstunde` | – | 1. NF (Teilabhängigkeiten, transitive Abhängigkeiten) |
| | kontakt | `PLZ → Ort` | Telefonnummern, Erziehungsberechtigte1, Erziehungsberechtigte2 | keine (1. NF verletzt; ohne Markierung: 2. NF) |
| | raum | – | – | 2. NF, 3. NF offen (normalisiert) |
| `redundanz_1nf_kontaktliste.sql` | teilnehmer | – | Telefon1, Telefon2, Telefon3, Hobbys, Adresse | keine (1. NF verletzt) |
| `redundanz_2nf_ausleihe.sql` | ausleihe | `leser_nr → Leser_Name, Leser_Klasse`; `buch_nr → Buch_Titel, Autor` | – | 1. NF (Teilabhängigkeiten) |
| `redundanz_3nf_verein.sql` | mitglied | `PLZ → Ort` (widerspricht den Daten); `Abteilung → Abteilungsleitung, Beitrag` | – | 2. NF (transitive Abhängigkeiten) |
| `redundanz_2nf_projekte.sql` | projektmitarbeit | `mitarbeiter_nr → Mitarbeiter_Name, Abteilung`; `projekt_nr → Projekt_Titel, Auftraggeber, Budget` | – | 1. NF (Teilabhängigkeiten) |
| `redundanz_3nf_praxis.sql` | termin | `Arzt → Fachgebiet, Zimmer`; `Versicherung → Versicherung_Telefon` | – | 2. NF (transitive Abhängigkeiten) |
| `redundanz_gemischt_bestellung.sql` | bestellung_flach | `bestell_nr → Bestelldatum, Kunde_Nr`; `Kunde_Nr → Kunde_Name, Kunde_Ort`; `artikel_nr → Artikel_Bezeichnung, Einzelpreis` | – | 1. NF (Teilabhängigkeiten und transitive Abhängigkeit) |
| | lieferant | – | – | 1. NF; 2. und 3. NF nicht beurteilbar (kein Schlüssel) |
| `redundanz_ok_vereinsverwaltung.sql` | ort, abteilung, mitglied, mitgliedschaft | je „Schlüssel → übrige Spalten“, z. B. `PLZ → Ort`, `id → Name, PLZ`, `(mitglied_id, abteilung_id) → Eintritt` | – | 3. NF, keine Anomalien |

## Aufbau

```
SQL-Sandbox/
├─ src/                      NUR die Dateien des SCORM-Pakets (1:1 im ZIP)
│  ├─ imsmanifest.xml        SCORM-1.2-Manifest (ein SCO, alle Dateien gelistet)
│  ├─ index.html             Gerüst der sechs Seiten, Content-Security-Policy
│  ├─ LICENSE.txt            MIT-Lizenz (wird mit ausgeliefert; Kopie von LICENSE)
│  ├─ css/base.css           gemeinsame Grundgestaltung (Kopie aus shared/)
│  ├─ css/style.css          Gestaltung des Pakets (feste Zeilenhöhen für die Scrollbereiche)
│  └─ js/
│     ├─ dom-utils.js        sichere DOM-Erzeugung (Kopie aus shared/)
│     ├─ format-utils.js     Mengenangaben des Pakets (ergänzt dom)
│     ├─ text-utils.js       Entfernen unsichtbarer Steuer- und Richtungszeichen vor der Anzeige (Kopie aus shared/)
│     ├─ tabs.js             Seitennavigation über Registerkarten (Kopie aus shared/)
│     ├─ scorm-api.js        SCORM-1.2-Wrapper (Schreib-Whitelist, Offline-Modus; Kopie aus shared/)
│     ├─ sql/errors.js       Fehlerklasse, Vorschläge bei Tippfehlern
│     ├─ sql/lexer.js        Zerlegung in Tokens mit Zeile/Spalte
│     ├─ sql/parser.js       Syntaxbaum (rekursiver Abstieg, Tiefe begrenzt)
│     ├─ sql/values.js       Vergleich, NULL-Logik, Sortierung, Anzeige von Werten
│     ├─ sql/database.js     Tabellen, Datentypen, Schlüssel, CREATE/DROP/ALTER
│     ├─ sql/integrity.js    Fremdschlüssel: Prüfung bei INSERT/UPDATE/DELETE, ON DELETE/ON UPDATE, Prüfung beim Laden
│     ├─ sql/executor.js     Namensauflösung, SELECT/INSERT/UPDATE/DELETE, Grenzwerte, Mitschreiben der Schritte (Seite 4)
│     ├─ sql-import.js       Upload-Prüfung und Aufbau einer neuen Datenbank
│     ├─ state.js            aktuelle Datenbank, Zurücksetzen, Änderungsereignisse
│     ├─ normalization.js    Seite 6: Schlüssel, Normalformen, Prüfung der Abhängigkeiten, Anomalie-Beispiele
│     ├─ samples/*.js        die fünf Beispieldatenbanken (Inhalt = testdata/*.sql)
│     ├─ uml-model.js        Klassendiagramm: Ableitung aus dem Tabellenschema
│     ├─ uml-layout.js       Klassendiagramm: Ebenenlayout mit rechtwinkligen Linien
│     ├─ pages/*.js          die sechs Seiten (+ gemeinsame Bausteine)
│     └─ app.js              Navigation, Verteilung der Änderungen, SCORM-Status
├─ testdata/                 SQL-Dateien für den Unterricht (siehe oben)
├─ preview/                  Vorschau
└─ README.md                 diese Datei
```

Der Ordner `src/` enthält ausschließlich Paketdateien – genau die Dateien, die im SCORM-ZIP landen. Das fertige Paket entsteht als `dist/sql-sandbox.zip` im Stamm des Repositorys; der Ordner `dist/` wird nicht versioniert.

## Paket erstellen und in Moodle einbinden

Das SCORM-Paket ist ein ZIP-Archiv mit dem **Inhalt** des Ordners `src/`. `imsmanifest.xml` muss dabei direkt in der obersten Ebene des ZIP liegen, nicht in einem Unterordner `src/`.

- **Windows:** Ordner `src` öffnen, alle Dateien und Ordner markieren, dann *Senden an → ZIP-komprimierter Ordner*. Die Datei `sql-sandbox.zip` nennen und in den Ordner `dist/` im Stamm des Repositorys legen.
- **Andere Systeme:** im Ordner `src` z. B. `mkdir -p ../../dist && zip -r ../../dist/sql-sandbox.zip .` ausführen.

So wird das Paket in Moodle eingebunden:
1. Kurs → *Aktivität oder Material anlegen* → **Lernpaket (SCORM)**.
2. `sql-sandbox.zip` hochladen.
3. **Abschluss: In den Einstellungen der Aktivität unter *Aktivitätsabschluss* „Teilnehmer/innen können die Aktivität manuell als abgeschlossen markieren“ einstellen.** Nur so lässt sich die Aktivität als abgeschlossen erkennen. Das Lernpaket meldet beim Öffnen nämlich den Status „incomplete“ und nie „completed“: Ein abgeschlossener Versuch würde Moodle beim erneuten Öffnen in den *Überprüfungsmodus* schalten. Abschlussbedingungen, die den SCORM-Status auswerten („Status erforderlich“, „Alle Lernobjekte abgeschlossen“), werden deshalb nie erfüllt.
   - Ein Status „completed“ bzw. „passed“ aus einer früheren Version des Pakets bleibt unverändert; für diese Lernenden erscheint der Überprüfungsmodus weiterhin. Abhilfe: das Paket in einer neuen Aktivität einbinden.

## Sicherheits- und Datenschutzkonzept

**Keine Codeausführung über Eingaben oder Uploads**
- SQL wird von einem eigenen Interpreter ausgewertet, nie als JavaScript. `innerHTML`, `eval`, `new Function` und `document.write` kommen nicht vor; das wird beim Bauen geprüft (siehe „Qualitätssicherung“).
- Alle Inhalte (Werte, Tabellen- und Spaltennamen, Dateinamen, SQL-Ausschnitte) werden nur als Text eingefügt. Eingeschleuster HTML-Code wie `<img onerror=…>` erscheint als Text.
- Unsichtbare Steuer-, Nullbreiten- und Richtungszeichen (z. B. U+202E) werden vor der Anzeige entfernt bzw. sichtbar ersetzt (Schutz vor optischer Täuschung) – auch in Tabellen- und Sichtnamen in Hinweisen und Statuszeilen.
- Event-Handler- und `style`-Attribute sowie `javascript:`-/`data:`-Adressen können über die DOM-Hilfsfunktionen gar nicht gesetzt werden.
- Tabellen, Spalten, Aliase und Gruppen liegen nur in `Map`/`Set`. Namen wie `__proto__` oder `constructor` sind daher harmlos (kein Prototype Pollution).

**Schutz vor Hängern und Speicherüberlauf im Browser**
- Verschachtelungstiefe höchstens 32 (Klammern, Unterabfragen, `NOT`); lange Ketten wie `a + b + …`, `… OR …` oder `… UNION …` ergeben höchstens 300 Ebenen im Syntaxbaum.
- SELECT-, GROUP-BY- und ORDER-BY-Listen höchstens 250 Einträge; Ergebnisse höchstens 250 Spalten (auch bei `*`).
- Zwischenergebnisse von Verknüpfungen und Mengenoperationen (`UNION ALL` usw., auch über verschachtelte `WITH`-Abfragen) höchstens 200.000 Zeilen. Ein vergessenes `ON` führt zu einer erklärenden Meldung zum kartesischen Produkt statt zum Absturz.
- Ergebnisse höchstens 25.000 Zeilen; angezeigt werden höchstens 1.000 Zeilen je Tabelle (mit Hinweis).
- Zeitbudget 3 Sekunden je Befehl (Upload: 10 Sekunden), danach Abbruch mit Meldung. Zusätzlich gilt ein Gesamtbudget: 10 Sekunden für alle Befehle einer Eingabe auf Seite 3 bzw. für alle Sichten auf Seite 2, 30 Sekunden für einen ganzen Upload.
- `LIKE` wird ohne reguläre Ausdrücke ausgewertet (kein ReDoS) und hält das Zeitbudget auch innerhalb eines einzelnen Vergleichs ein.
- Bei sehr vielen Beziehungen (über 300 Linienabschnitte) verzichtet das Klassendiagramm auf die Kreuzungsoptimierung, damit die Seite nicht hängt.

**Uploads**
- Erlaubt sind nur die Endungen `.sql` und `.txt`, höchstens 1 MB.
- Binärdateien, ZIP-/gzip-Archive und PDF werden am Inhalt erkannt und abgelehnt.
- Dateien werden nur als Text gelesen, nie geöffnet, ausgeführt oder als HTML dargestellt.
- Grenzwerte für Tabellen, Spalten, Datensätze und Textlänge (siehe oben).
- Werden zwei Dateien schnell nacheinander gewählt, wird das Ergebnis des älteren Imports verworfen.

**Content-Security-Policy**
- `default-src 'none'`: grundsätzlich ist alles verboten – Bilder, Schriften, Medien, Frames, Worker, Plugins und jede Netzwerkverbindung.
- Erlaubt sind nur Skripte und Stylesheets aus dem Paket selbst (`script-src 'self'`, `style-src 'self'`).
- `form-action 'none'`, `base-uri 'none'`, `<meta name="referrer" content="no-referrer">`.
- **Trusted Types** (`require-trusted-types-for 'script'; trusted-types 'none'`): In Chromium-Browsern (Chrome, Edge) blockiert der Browser zur Laufzeit jede Übergabe von Zeichenketten an HTML-Senken – auch wenn künftiger Code sie versehentlich verwendet. Es gibt keine einzige Ausnahme-Policy.

**Was das Paket nicht beeinflussen kann**
- HTTP-Header (z. B. `X-Frame-Options`, `frame-ancestors`, HSTS) setzt der Moodle-Server. Die strenge CSP und der Verzicht auf jede Codeausführung aus Daten verhindern, dass das Paket zu einer Lücke in Moodle wird.

**Keine externen Quellen**
- Kein CDN, keine Webfonts (Systemschriften), keine Bibliotheken von Drittanbietern.

**Datenschutz**
- Datenbanken, SQL-Eingaben und Ergebnisse verlassen den Browser nicht.
- An Moodle gehen nur `cmi.core.lesson_status` (`incomplete`) und `cmi.core.exit`. Besuchte Seiten werden nicht erfasst; `cmi.suspend_data` wird nicht verwendet; Schreibzugriffe auf andere Datenelemente sind im Code gesperrt.
- Der Name der Lernenden wird nicht gelesen.
- Kein `localStorage`, keine Cookies.
- **Hinweis:** Nach dem Neuladen sind Datenbank, Eingaben und Änderungen weg – das ist bewusst so (Datensparsamkeit).

## Ausprobieren und Browser

`src/index.html` lässt sich auch ohne Lernplattform direkt im Browser öffnen. Die Anwendung läuft dann im Offline-Modus; die Fußzeile weist darauf hin.

**Unterstützte Browser:** aktuelle Versionen von Edge, Chrome, Firefox und Safari (ab ca. 2021).

## Qualitätssicherung

Vor jeder Veröffentlichung wird das Paket mit nicht veröffentlichten Entwicklungswerkzeugen gebaut und getestet. Sie verwenden Node.js sowie Playwright mit Chromium im Headless-Modus.

**Beim Bauen wird geprüft**, und das Paket wird nicht erstellt, wenn
- eine Datei in `src/` nicht im Manifest steht oder umgekehrt;
- `LICENSE.txt` von der `LICENSE` des Repositorys abweicht;
- die CSP fehlt oder verändert wurde, Inline-Skripte, Inline-Stile oder Event-Handler vorkommen;
- gefährliche APIs (HTML-Senken, `eval`, Netzwerk-, Speicher- und Cookie-Zugriffe) oder externe Adressen vorkommen;
- unsichtbare Richtungs- oder Nullbreitenzeichen im Quelltext stehen (Schutz vor „Trojan Source“);
- eine Textdatei kein UTF-8 ohne BOM mit LF-Zeilenenden ist;
- die eingebauten Beispieldatenbanken von `testdata/*.sql` abweichen;
- eine Kopie des gemeinsamen Codes (`base.css`, `dom-utils.js`, `text-utils.js`, `tabs.js`, `scorm-api.js`) von ihrer Quelle in `shared/` abweicht oder fehlt;
- im Ordner des Teilprojekts etwas anderes als `src/`, `preview/`, `testdata/` und `README.md` liegt.

**Automatisierte Tests** (267) im Browser, mit simulierter SCORM-Schnittstelle:
- Lexer und Parser einschließlich Positionsangaben;
- Abfragen mit Handrechnungen: alle Join-Arten, Gruppierung, `HAVING`, `NULL`-Logik, korrelierte Unterabfragen, Sortierung, `LIMIT`, `LIKE`;
- jede Fehlerklasse mit ihrer Meldung und ihrem Hinweis, darunter falsch geschriebene Namen und die Hinweise zu fehlender Verknüpfung, Text-Schreibung und Schlüsselwörtern;
- `INSERT`/`UPDATE`/`DELETE` mit Typ-, Schlüssel- und `CHECK`-Prüfungen sowie Atomarität;
- Fremdschlüssel: `INSERT`/`UPDATE` ins Leere, `NULL`, Selbstbezug im selben Befehl, zusammengesetzte Schlüssel, `REFERENCES` ohne Spalten, `RESTRICT`/`NO ACTION`, `CASCADE` über mehrere Stufen, `SET NULL` (auch bei `NOT NULL`), `SET DEFAULT`, `ON UPDATE CASCADE`, Tausch von Schlüsselwerten, Atomarität, Prüfung beim Laden am Dateiende mit Befehlsangabe, Export mit `ON DELETE CASCADE`, Meldungen auf Seite 1 und 3;
- `CASE` und Fensterfunktionen (Gleichstände, Partitionen, laufende Summen, `LAG`/`LEAD`, Fehlerfälle) sowie `WITH … INSERT`, darunter ein vollständiges Stundenplan-Beispiel als Datei-Import;
- `UNION`, `INTERSECT` und `EXCEPT` (auch `ALL`, Rangfolge, `ORDER BY`/`LIMIT`, Klammern, in Unterabfragen, Sichten und Dateien);
- `WITH`-Abfragen, `INSERT … SELECT` und Sichten (Anlegen, Ersetzen, Löschen, ungültige und zirkuläre Sichten, Import im Export-Stil);
- erzeugter `CREATE TABLE`-Befehl: Er lässt sich für alle Beispieltabellen wieder einlesen und ergibt denselben Aufbau;
- Schritt für Schritt: letzter Schritt gleich dem Ergebnis von Seite 3 (über hundert Abfragen über alle Beispieldatenbanken), Reihenfolge und markierte Klauseln, Wahrheitswerte je Zeile (auch `NULL`), Paare und Raster der Verknüpfungen, NULL-Auffüllung, vollständiges Kreuzprodukt beim Komma, Gruppen und Rechenweg, `DISTINCT`/`ORDER BY`/`LIMIT`, Mengenoperationen, Abspieler und Tastatur, Umschalter, Übernahme von Seite 3, Fehlerfälle, Datenbank unverändert;
- Redundanzen: Hülle und Schlüsselkandidaten (deklariert, abgeleitet, nicht minimal), 2. NF bei einspaltigem Schlüssel, Teilabhängigkeiten (auch abgeleitet), transitive Abhängigkeiten, Schlüsselattribut rechts, „offen“ ohne Abhängigkeiten, Prüfung an den Daten mit Widersprüchen und `NULL`, 1NF-Hinweise ohne Fehlalarme in den normalisierten Beispielen, die Lösungshinweise aller Übungsdateien (für jeden der 16 Verstöße sind Einfüge-, Änderungs- und Löschbeispiel ausführbar, die Datenbank bleibt unverändert; die normalisierte Gegenprobe ergibt keine Verstöße; Tabelle ohne Schlüssel), abgeleitete Schlüssel nur bei Eindeutigkeit in den Daten, alle drei Anomalien mit ausführbarem SQL und Vorher/Nachher (auch `AUTO_INCREMENT`, Zahlen, Datumswerte, Sonderzeichen in Namen), Datenbank unverändert;
- Import der Beispieldateien, eines Exports im phpMyAdmin-Stil und fehlerhafter Dateien; Grenzwerte;
- Klassendiagramm: Ableitungsregeln (Namen, ausgeblendete und künstliche Schlüssel, Multiplizitäten, 1:1, Selbstbezug, parallele Beziehungen, Verbindungstabellen, Constraint-Namen, Hinweise) sowie das Layout aller Beispiele in beiden Ausrichtungen: keine überlappenden Karten, nur waagerechte und senkrechte Linien, keine Kreuzungen, keine Linie durch fremde Karten; 50 Tabellen; Verschieben mit Maus und Tastatur; Aus- und Einblenden von Klassen samt Beziehungen und Assoziationsklassen;
- präparierte Angriffe: HTML-/Skript-Einschleusung in Werten und Namen, `__proto__` als Name, Richtungszeichen, kartesisches Produkt, tiefe Verschachtelung, langsame `LIKE`-Muster, getarnte Binärdateien, übergroße Dateien, schneller Doppel-Upload;
- Klickpfade aller Seiten (Seite 4 und 6 auch mit eingeschleustem HTML-Code): Erhalt der Eingaben beim Seitenwechsel, Höhe der Scrollbereiche (5 bzw. 10 Zeilen), Strg + Enter, Zurücksetzen, Tastaturbedienung;
- SCORM-Meldungen;
- Härtung: keine externen Anfragen, keine CSP-Verstöße, Sperre durch Trusted Types, `eval` und Netzwerkzugriffe blockiert.

## Lizenz

- **Projekt:** MIT-Lizenz. Der Lizenztext liegt als `src/LICENSE.txt` im Paket und ist identisch mit der `LICENSE` im Stamm des Repositorys.
- **Code von Dritten:** keiner. Lexer, Parser, `LIKE`-Abgleich, Editierabstand und das Ebenenlayout des Klassendiagramms (angelehnt an das Verfahren von Sugiyama) sind Standardverfahren in eigener Umsetzung.
- **Daten:** alle Beispieldaten sind frei erfunden (MIT-Lizenz).
- **Weitere Hinweise:** Marken (Moodle™, SCORM®, MySQL®, UML® u. a.) stehen in `THIRD_PARTY_NOTICES.md` im Stamm des Repositorys.
