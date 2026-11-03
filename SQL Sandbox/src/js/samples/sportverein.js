/**
 * @file samples/sportverein.js
 * @description Beispieldatenbank „Sportverein“ für die SQL Sandbox.
 *
 * Der SQL-Text ist identisch mit testdata/sportverein.sql (der Build prüft das).
 * Alle Daten sind frei erfunden. Lizenz: MIT (siehe LICENSE.txt).
 */
(function (ns) {
  'use strict';

  ns.samples = ns.samples || [];
  ns.samples.push({
    id: 'sportverein',
    title: 'Sportverein',
    description: 'Abteilungen, Trainerinnen und Trainer, Mannschaften, Mitglieder mit Beiträgen und Spiele mit Ergebnissen.',
    sql: `-- Titel: Sportverein
-- Beschreibung: Abteilungen, Trainerinnen und Trainer, Mannschaften, Mitglieder mit Beiträgen und Spiele mit Ergebnissen.
--
-- Beispieldatenbank für die SQL Sandbox.
-- Alle Namen, Vereine und Werte sind frei erfunden; Ähnlichkeiten mit realen
-- Personen oder Vereinen wären zufällig. Lizenz: MIT (siehe LICENSE).

DROP TABLE IF EXISTS spiel;
DROP TABLE IF EXISTS mitglied;
DROP TABLE IF EXISTS mannschaft;
DROP TABLE IF EXISTS trainer;
DROP TABLE IF EXISTS abteilung;

CREATE TABLE abteilung (
  id INT PRIMARY KEY,
  Bezeichnung VARCHAR(30) NOT NULL
);

CREATE TABLE trainer (
  id INT PRIMARY KEY,
  Vorname VARCHAR(30),
  Nachname VARCHAR(30) NOT NULL,
  Lizenz CHAR(1)
);

CREATE TABLE mannschaft (
  id INT PRIMARY KEY,
  Bezeichnung VARCHAR(40) NOT NULL,
  abteilung_id INT NOT NULL,
  trainer_id INT,
  Altersklasse VARCHAR(20),
  FOREIGN KEY (abteilung_id) REFERENCES abteilung (id),
  FOREIGN KEY (trainer_id) REFERENCES trainer (id)
);

CREATE TABLE mitglied (
  id INT PRIMARY KEY,
  Vorname VARCHAR(30),
  Nachname VARCHAR(30) NOT NULL,
  Geburtsjahr INT,
  Eintrittsdatum DATE,
  Beitrag DECIMAL(6,2) CHECK (Beitrag >= 0),
  mannschaft_id INT,
  FOREIGN KEY (mannschaft_id) REFERENCES mannschaft (id)
);

CREATE TABLE spiel (
  id INT PRIMARY KEY,
  mannschaft_id INT NOT NULL,
  Gegner VARCHAR(40) NOT NULL,
  Datum DATE NOT NULL,
  Heimspiel BOOLEAN,
  Tore_eigene INT,
  Tore_gegner INT,
  FOREIGN KEY (mannschaft_id) REFERENCES mannschaft (id),
  CHECK (Tore_eigene >= 0 AND Tore_gegner >= 0)
);

INSERT INTO abteilung (id, Bezeichnung) VALUES
(1, 'Fußball'),
(2, 'Handball'),
(3, 'Tischtennis'),
(4, 'Schwimmen');

INSERT INTO trainer (id, Vorname, Nachname, Lizenz) VALUES
(1, 'Uwe', 'Brenner', 'B'),
(2, 'Sandra', 'Ostermann', 'A'),
(3, 'Kemal', 'Arslan', 'C'),
(4, 'Birgit', 'Heller', 'B'),
(5, 'Ralf', 'Nowak', NULL),
(6, 'Tanja', 'Seidel', 'C');

INSERT INTO mannschaft (id, Bezeichnung, abteilung_id, trainer_id, Altersklasse) VALUES
(1, 'Fußball Herren I', 1, 1, 'Erwachsene'),
(2, 'Fußball Damen', 1, 2, 'Erwachsene'),
(3, 'Fußball C-Jugend', 1, 3, 'U15'),
(4, 'Handball Herren', 2, 4, 'Erwachsene'),
(5, 'Handball B-Jugend', 2, NULL, 'U17'),
(6, 'Tischtennis I', 3, 5, 'Erwachsene'),
(7, 'Schwimmen Leistungsgruppe', 4, 6, 'gemischt'),
(8, 'Tischtennis Jugend', 3, NULL, 'U18');

INSERT INTO mitglied (id, Vorname, Nachname, Geburtsjahr, Eintrittsdatum, Beitrag, mannschaft_id) VALUES
(1, 'Kevin', 'Adler', 1996, '2012-04-01', 120.00, 1),
(2, 'Dominik', 'Bach', 1994, '2010-08-15', 120.00, 1),
(3, 'Marco', 'Conrad', 1999, '2015-01-10', 120.00, 1),
(4, 'Patrick', 'Dorn', 2001, '2018-07-01', 120.00, 1),
(5, 'Sebastian', 'Eckert', 1997, '2019-02-20', 120.00, 1),
(6, 'Nina', 'Fabian', 1998, '2016-09-01', 120.00, 2),
(7, 'Sarah', 'Gottschalk', 2000, '2017-03-12', 120.00, 2),
(8, 'Melanie', 'Hertel', 1995, '2013-05-05', 120.00, 2),
(9, 'Vanessa', 'Imhof', 2002, '2020-08-01', 120.00, 2),
(10, 'Jana', 'Jäger', 2003, '2021-01-15', 120.00, 2),
(11, 'Leon', 'Kern', 2010, '2019-09-01', 60.00, 3),
(12, 'Ali', 'Lang', 2011, '2020-09-01', 60.00, 3),
(13, 'Mats', 'Moser', 2010, '2018-04-15', 60.00, 3),
(14, 'Paul', 'Noack', 2011, '2021-03-01', 60.00, 3),
(15, 'Elias', 'Otto', 2010, '2022-09-01', 60.00, 3),
(16, 'Benedikt', 'Paulsen', 1990, '2008-01-01', 110.00, 4),
(17, 'Christian', 'Quast', 1993, '2011-06-01', 110.00, 4),
(18, 'Fabian', 'Reuter', 1998, '2016-02-01', 110.00, 4),
(19, 'Hendrik', 'Stark', 1996, '2014-10-01', 110.00, 4),
(20, 'Robin', 'Thiel', 2008, '2019-09-01', 60.00, 5),
(21, 'Luca', 'Ulrich', 2009, '2020-09-01', 60.00, 5),
(22, 'Jannik', 'Voigt', 2008, '2018-09-01', 60.00, 5),
(23, 'Gerhard', 'Walter', 1961, '1985-03-01', 90.00, 6),
(24, 'Monika', 'Xanten', 1968, '1992-01-15', 90.00, 6),
(25, 'Rainer', 'Yilmaz', 1972, '2001-05-01', 90.00, 6),
(26, 'Lisa', 'Zeller', 2005, '2015-09-01', 80.00, 7),
(27, 'Jonas', 'Arnold', 2006, '2016-09-01', 80.00, 7),
(28, 'Mila', 'Böhm', 2007, '2017-09-01', 80.00, 7),
(29, 'Theresa', 'Dreher', 2004, '2014-09-01', 80.00, 7),
(30, 'Samuel', 'Ertl', 2009, '2023-01-10', 60.00, 8),
(31, 'Ben', 'Fink', 2010, '2023-09-01', 60.00, 8),
(32, 'Helga', 'Grimm', 1955, '1978-01-01', 45.00, NULL),
(33, 'Werner', 'Horn', 1952, '1975-06-01', 45.00, NULL),
(34, 'Sophie', 'Jost', 2015, '2024-09-01', 40.00, NULL),
(35, 'Emil', 'Kurz', 2016, '2025-01-10', 40.00, NULL),
(36, 'Petra', 'Lutz', 1980, '2024-03-01', NULL, NULL);

INSERT INTO spiel (id, mannschaft_id, Gegner, Datum, Heimspiel, Tore_eigene, Tore_gegner) VALUES
(1, 1, 'SV Musterstadt-Nord', '2024-09-07', TRUE, 2, 1),
(2, 1, 'TSV Beispielhausen', '2024-09-14', FALSE, 0, 0),
(3, 1, 'FC Waldmusterdorf', '2024-09-21', TRUE, 3, 2),
(4, 1, 'SpVgg Am Bach', '2024-09-28', FALSE, 1, 4),
(5, 2, 'TSV Beispielhausen', '2024-09-08', FALSE, 3, 1),
(6, 2, 'SG Lindenhain', '2024-09-22', TRUE, 2, 2),
(7, 2, 'FC Waldmusterdorf', '2024-10-06', TRUE, 4, 0),
(8, 3, 'SV Musterstadt-Nord', '2024-09-11', TRUE, 5, 3),
(9, 3, 'JSG Am Bach', '2024-09-25', FALSE, 1, 2),
(10, 3, 'TSV Beispielhausen', '2024-10-09', TRUE, 2, 2),
(11, 4, 'HSG Beispielhausen', '2024-09-15', TRUE, 27, 24),
(12, 4, 'TV Musterstadt', '2024-09-29', FALSE, 22, 29),
(13, 4, 'HC Waldmusterdorf', '2024-10-13', TRUE, 31, 25),
(14, 5, 'HSG Beispielhausen', '2024-09-21', FALSE, 18, 20),
(15, 5, 'TV Musterstadt', '2024-10-05', TRUE, 24, 19),
(16, 6, 'TTC Lindenhain', '2024-09-19', TRUE, 9, 5),
(17, 6, 'TTV Beispielhausen', '2024-10-03', FALSE, 7, 9),
(18, 1, 'SV Musterstadt-Nord', '2025-03-08', FALSE, NULL, NULL),
(19, 2, 'SG Lindenhain', '2025-03-09', FALSE, NULL, NULL),
(20, 4, 'TV Musterstadt', '2025-03-15', TRUE, NULL, NULL);
`
  });
})(window.SQLSIM = window.SQLSIM || {});
