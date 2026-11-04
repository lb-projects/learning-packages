-- Titel: Kursbuchung (nicht normalisiert)
-- Beschreibung: Wahlkurse einer Schule – absichtlich nicht normalisiert, zum Üben von Normalformen und Anomalien.
--
-- Beispieldatenbank für die SQL Sandbox (Seite 6 „Redundanzen“).
-- Die Tabellen „belegung“ und „kontakt“ verletzen bewusst Normalformen;
-- „raum“ ist normalisiert und dient zum Vergleich.
-- Alle Namen und Werte sind frei erfunden; Ähnlichkeiten mit realen
-- Personen oder Schulen wären zufällig. Lizenz: MIT (siehe LICENSE).

DROP TABLE IF EXISTS belegung;
DROP TABLE IF EXISTS kontakt;
DROP TABLE IF EXISTS raum;

CREATE TABLE belegung (
  schueler_nr INT NOT NULL,
  kurs_nr INT NOT NULL,
  Schueler_Name VARCHAR(40) NOT NULL,
  Klasse VARCHAR(5) NOT NULL,
  Klassenleitung VARCHAR(40),
  Kurs_Titel VARCHAR(40) NOT NULL,
  Lehrkraft VARCHAR(40),
  Sprechstunde VARCHAR(20),
  Note INT CHECK (Note BETWEEN 1 AND 6),
  PRIMARY KEY (schueler_nr, kurs_nr)
);

CREATE TABLE kontakt (
  schueler_nr INT PRIMARY KEY,
  Telefonnummern VARCHAR(80),
  Erziehungsberechtigte1 VARCHAR(40),
  Erziehungsberechtigte2 VARCHAR(40),
  PLZ CHAR(5),
  Ort VARCHAR(40)
);

CREATE TABLE raum (
  Raumnummer VARCHAR(5) PRIMARY KEY,
  Gebaeude VARCHAR(20) NOT NULL,
  Plaetze INT
);

INSERT INTO belegung (schueler_nr, kurs_nr, Schueler_Name, Klasse, Klassenleitung, Kurs_Titel, Lehrkraft, Sprechstunde, Note) VALUES
  (1, 101, 'Lena Bauer', '9a', 'Frau Lindner', 'Theater', 'Herr Albrecht', 'Mo 4. Stunde', 2),
  (1, 102, 'Lena Bauer', '9a', 'Frau Lindner', 'Robotik', 'Frau Kraus', 'Mi 2. Stunde', 1),
  (2, 101, 'Jonas Keller', '9a', 'Frau Lindner', 'Theater', 'Herr Albrecht', 'Mo 4. Stunde', 3),
  (2, 104, 'Jonas Keller', '9a', 'Frau Lindner', 'Schach', 'Herr Albrecht', 'Mo 4. Stunde', 2),
  (3, 102, 'Mira Schulze', '9b', 'Herr Brandl', 'Robotik', 'Frau Kraus', 'Mi 2. Stunde', 2),
  (3, 103, 'Mira Schulze', '9b', 'Herr Brandl', 'Chor', 'Frau Moser', 'Do 5. Stunde', 1),
  (4, 103, 'Tim Vogt', '9b', 'Herr Brandl', 'Chor', 'Frau Moser', 'Do 5. Stunde', 3),
  (4, 104, 'Tim Vogt', '9b', 'Herr Brandl', 'Schach', 'Herr Albrecht', 'Mo 4. Stunde', 4),
  (5, 101, 'Sara Engel', '9a', 'Frau Lindner', 'Theater', 'Herr Albrecht', 'Mo 4. Stunde', 1),
  (5, 103, 'Sara Engel', '9a', 'Frau Lindner', 'Chor', 'Frau Moser', 'Do 5. Stunde', 2),
  (6, 102, 'Paul Winter', '10a', 'Frau Seidel', 'Robotik', 'Frau Kraus', 'Mi 2. Stunde', 3),
  (6, 104, 'Paul Winter', '10a', 'Frau Seidel', 'Schach', 'Herr Albrecht', 'Mo 4. Stunde', 2),
  (7, 103, 'Emma Roth', '10a', 'Frau Seidel', 'Chor', 'Frau Moser', 'Do 5. Stunde', 2),
  (7, 105, 'Emma Roth', '10a', 'Frau Seidel', 'Astronomie', 'Frau Kraus', 'Mi 2. Stunde', 1),
  (8, 101, 'Ben Hartmann', '9b', 'Herr Brandl', 'Theater', 'Herr Albrecht', 'Mo 4. Stunde', 4),
  (8, 102, 'Ben Hartmann', '9b', 'Herr Brandl', 'Robotik', 'Frau Kraus', 'Mi 2. Stunde', 2);

INSERT INTO kontakt (schueler_nr, Telefonnummern, Erziehungsberechtigte1, Erziehungsberechtigte2, PLZ, Ort) VALUES
  (1, '0123 456701, 0123 456702', 'Anja Bauer', 'Martin Bauer', '12345', 'Musterstadt'),
  (2, '0123 456703', 'Claudia Keller', NULL, '12345', 'Musterstadt'),
  (3, '0123 456704, 0123 456705', 'Ute Schulze', 'Ralf Schulze', '12347', 'Beispielhausen'),
  (4, '0123 456706', 'Dirk Vogt', NULL, '12349', 'Waldmusterdorf'),
  (5, '0123 456707; 0123 456708', 'Petra Engel', 'Jens Engel', '12347', 'Beispielhausen'),
  (6, '0123 456709', 'Karin Winter', 'Thomas Winter', '12345', 'Musterstadt'),
  (7, '0123 456710, 0123 456711', 'Sabine Roth', NULL, '12349', 'Waldmusterdorf'),
  (8, '0123 456712', 'Frank Hartmann', 'Eva Hartmann', '12345', 'Musterstadt');

INSERT INTO raum (Raumnummer, Gebaeude, Plaetze) VALUES
  ('A101', 'Altbau', 30),
  ('A102', 'Altbau', 28),
  ('N201', 'Neubau', 32),
  ('N202', 'Neubau', 24),
  ('AULA', 'Altbau', 200);
