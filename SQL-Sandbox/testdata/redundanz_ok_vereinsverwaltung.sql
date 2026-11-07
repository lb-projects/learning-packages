-- Titel: Vereinsverwaltung (normalisiert, Gegenprobe)
-- Beschreibung: Dieselben Informationen wie in der Vereinsliste, aber auf mehrere Tabellen verteilt – ohne Anomalien.
--
-- Übungsdatei für die SQL Sandbox (Seite 6 „Redundanzen“).
-- Alle Tabellen sind in der 3. Normalform: Wohnort und Abteilungsleitung stehen nur je einmal.
-- Zum Vergleich mit „redundanz_3nf_verein.sql“. Auf der Seite erscheinen mit den passenden
-- Abhängigkeiten keine Verstöße und keine Anomalien.
-- Alle Namen und Werte sind fiktiv. Lizenz: MIT (siehe LICENSE).

DROP TABLE IF EXISTS mitgliedschaft;
DROP TABLE IF EXISTS mitglied;
DROP TABLE IF EXISTS abteilung;
DROP TABLE IF EXISTS ort;

CREATE TABLE ort (
  PLZ CHAR(5) PRIMARY KEY,
  Ort VARCHAR(40) NOT NULL
);

CREATE TABLE abteilung (
  id INT PRIMARY KEY,
  Bezeichnung VARCHAR(30) NOT NULL,
  Leitung VARCHAR(40),
  Beitrag DECIMAL(6,2)
);

CREATE TABLE mitglied (
  id INT PRIMARY KEY,
  Name VARCHAR(40) NOT NULL,
  PLZ CHAR(5),
  FOREIGN KEY (PLZ) REFERENCES ort (PLZ)
);

CREATE TABLE mitgliedschaft (
  mitglied_id INT NOT NULL,
  abteilung_id INT NOT NULL,
  Eintritt DATE,
  PRIMARY KEY (mitglied_id, abteilung_id),
  FOREIGN KEY (mitglied_id) REFERENCES mitglied (id),
  FOREIGN KEY (abteilung_id) REFERENCES abteilung (id)
);

INSERT INTO ort (PLZ, Ort) VALUES
  ('12345', 'Musterstadt'),
  ('12347', 'Beispielhausen'),
  ('12349', 'Waldmusterdorf');

INSERT INTO abteilung (id, Bezeichnung, Leitung, Beitrag) VALUES
  (1, 'Fußball', 'Uwe Kern', 60.00),
  (2, 'Tennis', 'Bettina Stahl', 90.00),
  (3, 'Schwimmen', 'Ingo Ries', 45.00);

INSERT INTO mitglied (id, Name, PLZ) VALUES
  (1, 'Jana Busch', '12345'),
  (2, 'Leon Haas', '12347'),
  (3, 'Nele Franke', '12345'),
  (4, 'Ole Witt', '12349'),
  (5, 'Pia Kuhn', '12347'),
  (6, 'Max Sauer', '12345');

INSERT INTO mitgliedschaft (mitglied_id, abteilung_id, Eintritt) VALUES
  (1, 1, '2021-03-01'),
  (2, 1, '2022-08-15'),
  (3, 2, '2020-01-10'),
  (4, 3, '2023-05-02'),
  (5, 2, '2022-02-20'),
  (6, 1, '2019-09-01'),
  (6, 3, '2023-06-12');
