# SQL Sandbox – SCORM-1.2-Lernpaket

Interaktiver Simulator zum Abfragen relationaler Datenbanken mit **SQL**. In Moodle und im Browser erscheint das Lernpaket unter dem Namen **„SQL Sandbox“** (Ordner im Repository: `SQL simulator/`).
Das Paket läuft vollständig im Browser. Die SQL-Engine (Lexer, Parser, Ausführung) ist eigener Code: Es werden keine externen Ressourcen geladen und keine externen Bibliotheken verwendet (auch kein SQLite/sql.js).

## Inhalt für den Unterricht

| Seite | Inhalt |
|---|---|
| 1 Datenbank laden | Eine von vier Beispieldatenbanken wählen (Schule, Bibliothek, Online-Shop, Sportverein) oder eine eigene SQL-Datei hochladen (`DROP TABLE`, `CREATE TABLE` auch mit `CHECK`, `INSERT INTO` auch mit `SELECT`/`WITH`, `CREATE VIEW`) |
| 2 Tabellen | Aufbau (Spalten, Datentypen, Primär-/Fremdschlüssel, NOT NULL, CHECK-Bedingungen) und Inhalt aller Tabellen; je Tabelle sind etwa fünf Datensätze sichtbar, der Rest durch Scrollen. Unter jeder Tabelle lässt sich der `CREATE TABLE`-Befehl aufklappen (anfangs zugeklappt). Sichten (Views) stehen in einem eigenen Abschnitt mit ihrem aktuellen Ergebnis und dem aufklappbaren `CREATE VIEW`-Befehl |
| 3 SQL-Befehle | Eingabemaske (anfangs leer) mit „Ausführen“ (auch Strg + Enter) für Abfragen, Datenänderungen und `CREATE/DROP VIEW`; Fehlermeldungen erscheinen unter der Eingabe mit Zeile, Spalte, markierter Fehlerstelle und Hinweisen wie „Meinten Sie …?“; Ergebnistabellen haben Platz für zehn Zeilen, weitere durch Scrollen. Hinweise (ohne Abbruch) bei vermutlich vergessener Verknüpfungsbedingung, bei Texten in falscher Groß-/Kleinschreibung und bei kleingeschriebenen Schlüsselwörtern. Kurzreferenz der unterstützten Befehle |

Zwischen den Seiten kann jederzeit gewechselt werden. Eingaben, Ergebnisse und die Datenbank bleiben dabei erhalten.
Änderungen durch `INSERT`, `UPDATE` und `DELETE` sind sofort auf Seite 2 sichtbar. „Datenbank zurücksetzen“ stellt den Stand nach dem Laden wieder her.

### Unterstützter SQL-Umfang

- **Abfragen:** `SELECT [DISTINCT] … FROM … WHERE … GROUP BY … HAVING … ORDER BY … [ASC|DESC] LIMIT n [OFFSET m]` (auch `LIMIT m, n`); `SELECT` ohne `FROM` (z. B. `SELECT 2 * 21`).
- **Spalten und Aliase:** `*`, `t.*`, Ausdrücke, `AS` (auch ohne `AS`); Tabellenaliase wie `FROM schule s` mit Punktnotation `s.Adresse`.
- **Verknüpfungen:** `[INNER] JOIN … ON`, `LEFT [OUTER] JOIN`, `RIGHT [OUTER] JOIN`, `CROSS JOIN`, impliziter Join `FROM a, b WHERE a.id = b.a_id`, Self-Join mit Aliasen.
- **Bedingungen:** `= <> != < <= > >=`, `AND`, `OR`, `NOT`, `BETWEEN … AND …`, `LIKE` mit `%` und `_` (Maskierung mit `\`), `IN (Liste)`, `IS [NOT] NULL`, `[NOT] EXISTS`.
- **Aggregatfunktionen:** `COUNT(*)`, `COUNT(Spalte)`, `COUNT(DISTINCT …)`, `SUM`, `AVG`, `MIN`, `MAX`; dazu `ROUND(Zahl [, Stellen])`.
- **Unterabfragen:** als Wert (`WHERE Preis > (SELECT AVG(Preis) …)`), mit `IN`/`EXISTS`, korreliert und als Tabelle in `FROM (SELECT …) AS t`.
- **WITH (Common Table Expressions):** `WITH teuer AS (SELECT …), billig (name, preis) AS (SELECT …) SELECT … FROM teuer …`. Mehrere WITH-Abfragen sind möglich, jede kann die vorher definierten verwenden; optional mit Spaltenliste. WITH funktioniert auch in Unterabfragen, in `FROM (…)`, in Sichten und in `INSERT … SELECT`. Eine WITH-Abfrage verdeckt eine gleichnamige Tabelle. Nicht rekursiv.
- **Rechnen:** `+ - * / %`, Klammern, Vorzeichen.
- **Daten ändern (Seite 3):** `INSERT INTO … [(Spalten)] VALUES (…), (…)` oder `INSERT INTO … [(Spalten)] [WITH …] SELECT …` (das Abfrageergebnis wird vollständig berechnet, bevor eingefügt wird), `UPDATE … SET … [WHERE …]`, `DELETE FROM … [WHERE …]`. Mehrere Befehle (getrennt durch `;`) werden **gemeinsam** ausgeführt: Enthält einer einen Fehler, bleibt die Datenbank unverändert.
- **Sichten (Views, Seite 3 und Dateien):** `CREATE [OR REPLACE] VIEW name [(Spalten)] AS SELECT …` (auch mit `WITH`), `DROP VIEW [IF EXISTS] name`. Eine Sicht speichert nur ihre Abfrage; bei jeder Verwendung wird sie neu ausgewertet und zeigt so immer den aktuellen Stand der Tabellen. In Sichten kann nicht geschrieben werden (`INSERT`/`UPDATE`/`DELETE` ergeben eine Meldung). Wird eine benötigte Tabelle gelöscht, meldet die Sicht beim Abfragen „ungültig“. Sichten, die über andere Sichten auf sich selbst verweisen, werden abgelehnt.
- **Hinweise zum Ergebnis** (die Abfrage wird trotzdem ausgeführt):
  - Stehen mehrere Tabellen in `FROM`, ohne dass alle über eine Bedingung (in `ON` oder `WHERE`) verbunden sind, entsteht ein kartesisches Produkt. Der Hinweis nennt die nicht verknüpften Tabellen und schlägt, wenn möglich, eine Bedingung aus den Fremdschlüsseln vor, z. B. `bp.bestellung_id = b.id`. Ein ausdrückliches `CROSS JOIN` gilt als beabsichtigt und ergibt keinen Hinweis.
  - Vergleicht `=`, `IN` oder `LIKE` eine Spalte mit einem Text, der nur in anderer Groß-/Kleinschreibung vorkommt (`'berlin'` statt `'Berlin'`), kommt der Vorschlag „Meinten Sie 'Berlin'?“.
  - Nicht großgeschriebene Schlüsselwörter werden mit der üblichen Schreibweise genannt (`select → SELECT`).
- **Nicht unterstützt** (mit eigener, verständlicher Meldung): `UNION`, `CASE`, `WITH RECURSIVE`, `FULL OUTER JOIN`, `NATURAL JOIN`, `USING`, `ANY/ALL`, weitere Funktionen (z. B. `UPPER`, `CONCAT`, Datumsfunktionen).

### Festlegungen (an MySQL/MariaDB angelehnt)

Viele Schulen arbeiten mit MySQL/MariaDB und phpMyAdmin. Der Simulator verhält sich deshalb in den meisten Punkten wie MySQL. Bei der Groß-/Kleinschreibung ist er bewusst strenger, damit sich Lernende eine saubere Schreibweise angewöhnen.

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
- `PRIMARY KEY` (auch zusammengesetzt), `UNIQUE`, `NOT NULL`, `DEFAULT`, `AUTO_INCREMENT` und `CHECK` werden durchgesetzt. **Fremdschlüssel** werden gespeichert und auf Seite 2 angezeigt, aber **nicht erzwungen**.
- **CHECK-Bedingungen**:
  - Sie stehen an einer Spalte (`Preis DECIMAL(8,2) CHECK (Preis >= 0)`) oder als Tabellenbedingung, auch mit Namen (`CONSTRAINT chk_rueckgabe CHECK (Rueckgabedatum IS NULL OR Rueckgabedatum >= Ausleihdatum)`). `ALTER TABLE … ADD [CONSTRAINT name] CHECK (…)` ist ebenfalls möglich.
  - Geprüft wird bei `INSERT` und `UPDATE`; beim Anlegen mit `ALTER TABLE` auch an den vorhandenen Datensätzen.
  - Wie im SQL-Standard und in MySQL ist ein Datensatz nur unzulässig, wenn die Bedingung **falsch** ist. Ergibt sie `NULL`, etwa weil ein Wert fehlt, wird er gespeichert.
  - Unterabfragen und Aggregatfunktionen sind in CHECK nicht erlaubt.
  - `NOT ENFORCED` (MySQL 8) speichert die Bedingung, ohne sie zu prüfen.
- **CREATE TABLE auf Seite 2** wird aus dem aktuellen Tabellenaufbau erzeugt (ähnlich `SHOW CREATE TABLE`). Er enthält daher auch Schlüssel, die erst per `ALTER TABLE` hinzukamen. Einfache Indizes (`KEY`, `INDEX`) und Tabellenoptionen (`ENGINE=…`) haben im Simulator keine Wirkung und erscheinen dort nicht.

### Dateiformat für den Upload (Seite 1)

- **Dateien:** `.sql` oder `.txt`, höchstens 1 MB, Zeichensatz UTF-8 (sonst wird Windows-1252 angenommen, mit Hinweis).
- **Erlaubte Anweisungen:** `DROP TABLE [IF EXISTS]`, `CREATE TABLE [IF NOT EXISTS]` (auch mit `CHECK`), `INSERT INTO` (auch `INSERT INTO … [WITH …] SELECT …`), `CREATE [OR REPLACE] VIEW` und `DROP VIEW`; aus Exporten zusätzlich `ALTER TABLE … ADD PRIMARY KEY / ADD [UNIQUE] KEY / ADD CONSTRAINT … FOREIGN KEY / ADD [CONSTRAINT …] CHECK / ADD COLUMN / MODIFY` und `CREATE [UNIQUE] INDEX`.
- **Namen** müssen auch in der Datei überall gleich geschrieben sein (z. B. in `PRIMARY KEY (id)` und `INSERT INTO kurs (…)`).
- **Übersprungen** (ohne Wirkung, mit Hinweis): `SET`, `START TRANSACTION`, `BEGIN`, `COMMIT`, `LOCK/UNLOCK TABLES`, `USE`, `CREATE DATABASE` sowie Sonderkommentare `/*! … */`. Tabellenoptionen wie `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4` werden ignoriert.
- **Sichten aus Exporten:** Zusätze wie ``ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER`` und `WITH CASCADED CHECK OPTION` werden überlesen. Ein Datenbankpräfix wie in `` `schule`.`t`.`a` `` wird ignoriert (es gibt nur eine Datenbank). Die in Exporten übliche Ersatztabelle mit dem Namen der Sicht, die anschließend per `DROP TABLE` entfernt wird, funktioniert ebenfalls.
- **Grenzen:** 50 Tabellen, 50 Spalten je Tabelle, 20.000 Datensätze insgesamt, Texte bis 1.000 Zeichen, Namen bis 64 Zeichen.
- Eine Datei wird **ganz oder gar nicht** übernommen. Bei einem Fehler erscheint die Meldung mit Zeile, Spalte und Ausschnitt; die bisherige Datenbank bleibt unverändert.

## Beispieldatenbanken und Dateien für den Unterricht

Alle Daten sind **frei erfunden** (Namen, Orte wie „Musterstadt“, Buchtitel, Artikel, Vereine). Ähnlichkeiten mit realen Personen, Schulen, Firmen, Werken oder Vereinen wären zufällig. Die Daten stehen unter der MIT-Lizenz.

| Datei in `testdata/` | Inhalt | Tabellen |
|---|---|---|
| `schule.sql` | Schulen, Lehrkräfte, Klassen, Schülerinnen und Schüler, Fächer, Noten | schule, lehrkraft, klasse, schueler, fach, note |
| `bibliothek.sql` | Autorinnen und Autoren, Bücher, Leserinnen und Leser, Ausleihen (auch offene) | autor, buch, leser, ausleihe |
| `online_shop.sql` | Kategorien, Artikel mit Preisen, Kundinnen und Kunden, Bestellungen, Bestellpositionen (zusammengesetzter Primärschlüssel) | kategorie, artikel, kunde, bestellung, bestellposition |
| `sportverein.sql` | Abteilungen, Trainerinnen und Trainer, Mannschaften, Mitglieder mit Beiträgen, Spiele (auch ohne Ergebnis) | abteilung, trainer, mannschaft, mitglied, spiel |
| `beispiel_phpmyadmin_export.sql` | Kursangebot einer Musikschule im Stil eines Datenbank-Exports (Backticks, `ENGINE=…`, `SET`, `CONSTRAINT … CHECK`, Schlüssel per `ALTER TABLE`) | kurs, teilnehmer, anmeldung |
| `beispiel_fehlerhaft.sql` | Übungsdatei mit zwei absichtlichen Fehlern (fehlendes Komma, doppelter Primärschlüssel) | – |

Die ersten vier Dateien sind identisch mit den eingebauten Beispieldatenbanken auf Seite 1 (der Build prüft das). Sie eignen sich als Vorlage für eigene Datenbanken. Jede enthält einige `CHECK`-Bedingungen, z. B. `Note BETWEEN 1 AND 6`, `Preis >= 0` oder `Menge > 0`; ein `INSERT` mit unzulässigem Wert zeigt die entsprechende Meldung. Die Daten enthalten bewusst `NULL`-Werte und Datensätze ohne Partner, z. B. Lehrkräfte ohne Klasse, Fächer ohne Noten, Kundinnen und Kunden ohne Bestellung. So lassen sich `LEFT JOIN` und `IS NULL` sinnvoll üben.

## Aufbau

```
SQL simulator/
├─ src/                      NUR die Dateien des SCORM-Pakets (1:1 im ZIP)
│  ├─ imsmanifest.xml        SCORM-1.2-Manifest (ein SCO, alle Dateien gelistet)
│  ├─ index.html             Gerüst der drei Seiten, Content-Security-Policy
│  ├─ LICENSE.txt            MIT-Lizenz (wird mit ausgeliefert)
│  ├─ css/style.css          Gestaltung (Systemschriften, feste Zeilenhöhen für die Scrollbereiche)
│  └─ js/
│     ├─ dom-utils.js        sichere DOM-Erzeugung (nur Textknoten, keine Event-/style-Attribute)
│     ├─ text-utils.js       Entfernen unsichtbarer Steuer- und Richtungszeichen vor der Anzeige
│     ├─ scorm-api.js        SCORM-1.2-Wrapper (Schreib-Whitelist, Offline-Modus; wie im kNN-Paket)
│     ├─ sql/errors.js       Fehlerklasse, Vorschläge bei Tippfehlern
│     ├─ sql/lexer.js        Zerlegung in Tokens mit Zeile/Spalte
│     ├─ sql/parser.js       Syntaxbaum (rekursiver Abstieg, Tiefe begrenzt)
│     ├─ sql/values.js       Vergleich, NULL-Logik, Sortierung, Anzeige von Werten
│     ├─ sql/database.js     Tabellen, Datentypen, Schlüssel, CREATE/DROP/ALTER
│     ├─ sql/executor.js     Namensauflösung, SELECT/INSERT/UPDATE/DELETE, Grenzwerte
│     ├─ sql-import.js       Upload-Prüfung und Aufbau einer neuen Datenbank
│     ├─ state.js            aktuelle Datenbank, Zurücksetzen, Änderungsereignisse
│     ├─ samples/*.js        die vier Beispieldatenbanken (Inhalt = testdata/*.sql)
│     ├─ pages/*.js          die drei Seiten (+ gemeinsame Bausteine)
│     └─ app.js              Navigation, Verteilung der Änderungen, SCORM-Fortschritt
├─ testdata/                 SQL-Dateien für den Unterricht (siehe oben)
├─ preview/                  Vorschau
└─ README.md                 diese Datei
```

Der Ordner `src/` enthält ausschließlich Paketdateien – genau die Dateien, die im SCORM-ZIP landen. Build-Ergebnisse (ZIP) liegen nicht im Repository.

## Paket erstellen und in Moodle einbinden

Das SCORM-Paket ist ein ZIP-Archiv mit dem **Inhalt** des Ordners `src/`. `imsmanifest.xml` muss dabei direkt in der obersten Ebene des ZIP liegen, nicht in einem Unterordner `src/`.

- **Windows:** Ordner `src` öffnen, alle Dateien und Ordner markieren, dann *Senden an → ZIP-komprimierter Ordner*.
- **Andere Systeme:** im Ordner `src` z. B. `zip -r ../sql-simulator-scorm12.zip .` ausführen.

So wird das Paket in Moodle eingebunden:
1. Kurs → *Aktivität oder Material anlegen* → **Lernpaket (SCORM)**.
2. ZIP-Datei hochladen.
3. Bewertung: „Abschluss“ bzw. Status „completed“ ist gesetzt, sobald alle drei Seiten besucht wurden. Ein bereits gemeldeter Abschluss bleibt erhalten.

## Sicherheits- und Datenschutzkonzept

**Keine Codeausführung über Eingaben oder Uploads**
- SQL wird von einem eigenen Interpreter ausgewertet, nie als JavaScript. `innerHTML`, `eval`, `new Function` und `document.write` kommen nicht vor; das wird beim Bauen geprüft (siehe „Qualitätssicherung“).
- Alle Inhalte (Werte, Tabellen- und Spaltennamen, Dateinamen, SQL-Ausschnitte) werden nur als Text eingefügt. Eingeschleuster HTML-Code wie `<img onerror=…>` erscheint als Text.
- Unsichtbare Steuer-, Nullbreiten- und Richtungszeichen (z. B. U+202E) werden vor der Anzeige entfernt bzw. sichtbar ersetzt (Schutz vor optischer Täuschung).
- Event-Handler- und `style`-Attribute sowie `javascript:`-/`data:`-Adressen können über die DOM-Hilfsfunktionen gar nicht gesetzt werden.
- Tabellen, Spalten, Aliase und Gruppen liegen nur in `Map`/`Set`. Namen wie `__proto__` oder `constructor` sind daher harmlos (kein Prototype Pollution).

**Schutz vor Hängern und Speicherüberlauf im Browser**
- Verschachtelungstiefe höchstens 32 (Klammern, Unterabfragen, `NOT`).
- Zwischenergebnisse von Verknüpfungen höchstens 200.000 Zeilen. Ein vergessenes `ON` führt zu einer erklärenden Meldung zum kartesischen Produkt statt zum Absturz.
- Ergebnisse höchstens 25.000 Zeilen; angezeigt werden höchstens 1.000 Zeilen je Tabelle (mit Hinweis).
- Zeitbudget 3 Sekunden je Befehl (Upload: 10 Sekunden), danach Abbruch mit Meldung.
- `LIKE` wird ohne reguläre Ausdrücke ausgewertet (kein ReDoS).

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
- An Moodle gehen nur `cmi.core.lesson_status`, `cmi.core.exit` und die besuchten Seiten (`cmi.suspend_data`, z. B. `v=101`). Schreibzugriffe auf andere Datenelemente sind im Code gesperrt.
- Der Name der Lernenden wird nicht gelesen.
- Kein `localStorage`, keine Cookies.
- **Hinweis:** Nach dem Neuladen sind Datenbank, Eingaben und Änderungen weg – das ist bewusst so (Datensparsamkeit).

## Ausprobieren und Browser

`src/index.html` lässt sich auch ohne Lernplattform direkt im Browser öffnen. Die Anwendung läuft dann im Offline-Modus; die Fußzeile weist darauf hin.

**Unterstützte Browser:** aktuelle Versionen von Edge, Chrome, Firefox und Safari (ab ca. 2021).

## Qualitätssicherung

Vor jeder Veröffentlichung wird das Paket mit nicht veröffentlichten Entwicklungswerkzeugen gebaut und getestet. Sie verwenden nur Windows-PowerShell, .NET-Bordmittel und Microsoft Edge im Headless-Modus.

**Beim Bauen wird geprüft**, und das Paket wird nicht erstellt, wenn
- eine Datei in `src/` nicht im Manifest steht oder umgekehrt;
- `LICENSE.txt` von der `LICENSE` des Repositorys abweicht;
- die CSP fehlt oder verändert wurde, Inline-Skripte, Inline-Stile oder Event-Handler vorkommen;
- gefährliche APIs (HTML-Senken, `eval`, Netzwerk-, Speicher- und Cookie-Zugriffe) oder externe Adressen vorkommen;
- unsichtbare Richtungs- oder Nullbreitenzeichen im Quelltext stehen (Schutz vor „Trojan Source“);
- eine Textdatei kein UTF-8 ohne BOM mit LF-Zeilenenden ist;
- die eingebauten Beispieldatenbanken von `testdata/*.sql` abweichen;
- der SCORM-Wrapper von der Fassung des kNN-Pakets abweicht;
- im Ordner des Teilprojekts etwas anderes als `src/`, `preview/`, `testdata/` und `README.md` liegt.

**Automatisierte Tests** (über 140) im Browser, mit simulierter SCORM-Schnittstelle:
- Lexer und Parser einschließlich Positionsangaben;
- Abfragen mit Handrechnungen: alle Join-Arten, Gruppierung, `HAVING`, `NULL`-Logik, korrelierte Unterabfragen, Sortierung, `LIMIT`, `LIKE`;
- jede Fehlerklasse mit ihrer Meldung und ihrem Hinweis, darunter falsch geschriebene Namen und die Hinweise zu fehlender Verknüpfung, Text-Schreibung und Schlüsselwörtern;
- `INSERT`/`UPDATE`/`DELETE` mit Typ-, Schlüssel- und `CHECK`-Prüfungen sowie Atomarität;
- `WITH`-Abfragen, `INSERT … SELECT` und Sichten (Anlegen, Ersetzen, Löschen, ungültige und zirkuläre Sichten, Import im Export-Stil);
- erzeugter `CREATE TABLE`-Befehl: Er lässt sich für alle Beispieltabellen wieder einlesen und ergibt denselben Aufbau;
- Import der Beispieldateien, eines Exports im phpMyAdmin-Stil und fehlerhafter Dateien; Grenzwerte;
- präparierte Angriffe: HTML-/Skript-Einschleusung in Werten und Namen, `__proto__` als Name, Richtungszeichen, kartesisches Produkt, tiefe Verschachtelung, langsame `LIKE`-Muster, getarnte Binärdateien, übergroße Dateien, schneller Doppel-Upload;
- Klickpfade aller Seiten: Erhalt der Eingaben beim Seitenwechsel, Höhe der Scrollbereiche (5 bzw. 10 Zeilen), Strg + Enter, Zurücksetzen, Tastaturbedienung;
- SCORM-Meldungen;
- Härtung: keine externen Anfragen, keine CSP-Verstöße, Sperre durch Trusted Types, `eval` und Netzwerkzugriffe blockiert.

## Lizenz

- **Projekt:** MIT-Lizenz. Der Lizenztext liegt als `src/LICENSE.txt` im Paket und ist identisch mit der `LICENSE` im Stamm des Repositorys.
- **Code von Dritten:** keiner. Lexer, Parser, `LIKE`-Abgleich und Editierabstand sind Standardverfahren in eigener Umsetzung.
- **Daten:** alle Beispieldaten sind frei erfunden (MIT-Lizenz).
- **Weitere Hinweise:** Marken (Moodle™, SCORM®, MySQL® u. a.) stehen in `THIRD_PARTY_NOTICES.md` im Stamm des Repositorys.
