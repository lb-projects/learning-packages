/**
 * @file samples/schule.js
 * @description Beispieldatenbank „Schule“ für QUEST.
 *
 * Der SQL-Text ist identisch mit testdata/schule.sql (der Build prüft das).
 * Alle Daten sind frei erfunden. Lizenz: MIT (siehe LICENSE.txt).
 */
(function (ns) {
  'use strict';

  ns.samples = ns.samples || [];
  ns.samples.push({
    id: 'schule',
    title: 'Schule',
    description: 'Schulen, Lehrkräfte, Klassen, Schülerinnen und Schüler, Fächer und Noten.',
    sql: `-- Titel: Schule
-- Beschreibung: Schulen, Lehrkräfte, Klassen, Schülerinnen und Schüler, Fächer und Noten.
--
-- Beispieldatenbank für QUEST.
-- Alle Namen, Adressen und Werte sind frei erfunden; Ähnlichkeiten mit realen
-- Personen oder Schulen wären zufällig. Lizenz: MIT (siehe LICENSE).

DROP TABLE IF EXISTS note;
DROP TABLE IF EXISTS schueler;
DROP TABLE IF EXISTS klasse;
DROP TABLE IF EXISTS lehrkraft;
DROP TABLE IF EXISTS fach;
DROP TABLE IF EXISTS schule;

CREATE TABLE schule (
  id INT PRIMARY KEY,
  Name VARCHAR(60) NOT NULL,
  Adresse VARCHAR(60),
  Ort VARCHAR(40),
  Schulart VARCHAR(20)
);

CREATE TABLE lehrkraft (
  id INT PRIMARY KEY,
  Vorname VARCHAR(30),
  Nachname VARCHAR(30) NOT NULL,
  Kuerzel CHAR(3),
  schule_id INT,
  FOREIGN KEY (schule_id) REFERENCES schule (id)
);

CREATE TABLE klasse (
  id INT PRIMARY KEY,
  Bezeichnung VARCHAR(10) NOT NULL,
  Jahrgangsstufe INT CHECK (Jahrgangsstufe BETWEEN 1 AND 13),
  schule_id INT,
  klassenleitung_id INT,
  FOREIGN KEY (schule_id) REFERENCES schule (id),
  FOREIGN KEY (klassenleitung_id) REFERENCES lehrkraft (id)
);

CREATE TABLE schueler (
  id INT PRIMARY KEY,
  Vorname VARCHAR(30),
  Nachname VARCHAR(30) NOT NULL,
  Geburtsdatum DATE,
  Wohnort VARCHAR(40),
  klasse_id INT,
  FOREIGN KEY (klasse_id) REFERENCES klasse (id)
);

CREATE TABLE fach (
  id INT PRIMARY KEY,
  Bezeichnung VARCHAR(30) NOT NULL,
  Kuerzel VARCHAR(5)
);

CREATE TABLE note (
  id INT AUTO_INCREMENT PRIMARY KEY,
  schueler_id INT NOT NULL,
  fach_id INT NOT NULL,
  Note INT NOT NULL CHECK (Note BETWEEN 1 AND 6),
  Art VARCHAR(20),
  Datum DATE,
  FOREIGN KEY (schueler_id) REFERENCES schueler (id),
  FOREIGN KEY (fach_id) REFERENCES fach (id)
);

INSERT INTO schule (id, Name, Adresse, Ort, Schulart) VALUES
(1, 'Gymnasium am Lindenhain', 'Lindenweg 12', 'Musterstadt', 'Gymnasium'),
(2, 'Realschule Beispielhausen', 'Schulstraße 4', 'Beispielhausen', 'Realschule'),
(3, 'Mittelschule am Bach', 'Bachgasse 7', 'Musterstadt', 'Mittelschule');

INSERT INTO lehrkraft (id, Vorname, Nachname, Kuerzel, schule_id) VALUES
(1, 'Anna', 'Berger', 'BER', 1),
(2, 'Thomas', 'Krüger', 'KRU', 1),
(3, 'Sabine', 'Hoffmann', 'HOF', 1),
(4, 'Michael', 'Wagner', 'WAG', 1),
(5, 'Julia', 'Schäfer', 'SCH', 2),
(6, 'Stefan', 'Lorenz', 'LOR', 2),
(7, 'Katrin', 'Vogel', 'VOG', 2),
(8, 'Markus', 'Brandt', 'BRA', 3),
(9, 'Elena', 'Roth', 'ROT', 3),
(10, 'Peter', 'Hahn', 'HAH', 1);

INSERT INTO klasse (id, Bezeichnung, Jahrgangsstufe, schule_id, klassenleitung_id) VALUES
(1, '5a', 5, 1, 1),
(2, '5b', 5, 1, 2),
(3, '7a', 7, 1, 3),
(4, '10c', 10, 1, 4),
(5, '6a', 6, 2, 5),
(6, '8b', 8, 2, 6),
(7, '9a', 9, 2, 7),
(8, '7m', 7, 3, 8);

INSERT INTO schueler (id, Vorname, Nachname, Geburtsdatum, Wohnort, klasse_id) VALUES
(1, 'Lukas', 'Schmidt', '2013-04-12', 'Musterstadt', 1),
(2, 'Emma', 'Meier', '2013-09-03', 'Musterstadt', 1),
(3, 'Noah', 'Weber', '2014-01-22', 'Beispielhausen', 1),
(4, 'Mia', 'Fischer', '2013-06-30', 'Musterstadt', 1),
(5, 'Paul', 'Becker', '2013-11-08', NULL, 1),
(6, 'Leonie', 'Schulz', '2013-02-17', 'Musterstadt', 2),
(7, 'Felix', 'Wolf', '2013-08-25', 'Waldmusterdorf', 2),
(8, 'Hannah', 'Neumann', '2014-03-05', 'Musterstadt', 2),
(9, 'Jonas', 'Braun', '2013-05-19', 'Beispielhausen', 2),
(10, 'Lea', 'Zimmermann', '2013-12-01', 'Musterstadt', 2),
(11, 'Ben', 'Hartmann', '2011-07-14', 'Musterstadt', 3),
(12, 'Marie', 'Krause', '2011-10-02', 'Waldmusterdorf', 3),
(13, 'Elias', 'Richter', '2012-02-28', 'Musterstadt', 3),
(14, 'Sophie', 'Klein', '2011-04-09', 'Beispielhausen', 3),
(15, 'Finn', 'Schröder', '2011-09-21', 'Musterstadt', 3),
(16, 'Laura', 'Lange', '2008-11-30', 'Musterstadt', 4),
(17, 'Tim', 'Schmitt', '2009-03-16', 'Musterstadt', 4),
(18, 'Lina', 'Werner', '2009-01-07', 'Waldmusterdorf', 4),
(19, 'David', 'König', '2008-10-12', 'Beispielhausen', 4),
(20, 'Clara', 'Huber', '2009-06-25', NULL, 4),
(21, 'Moritz', 'Kaiser', '2012-05-03', 'Beispielhausen', 5),
(22, 'Johanna', 'Fuchs', '2012-08-19', 'Beispielhausen', 5),
(23, 'Luis', 'Peters', '2013-01-11', 'Waldmusterdorf', 5),
(24, 'Amelie', 'Scholz', '2012-04-27', 'Beispielhausen', 5),
(25, 'Niklas', 'Jung', '2012-10-15', 'Beispielhausen', 5),
(26, 'Anna', 'Möller', '2010-06-08', 'Beispielhausen', 6),
(27, 'Jan', 'Keller', '2010-12-20', 'Musterstadt', 6),
(28, 'Ella', 'Frank', '2011-02-14', 'Beispielhausen', 6),
(29, 'Leon', 'Berger', '2010-09-01', 'Beispielhausen', 6),
(30, 'Nele', 'Graf', '2010-05-23', 'Waldmusterdorf', 6),
(31, 'Max', 'Lehmann', '2009-07-29', 'Beispielhausen', 7),
(32, 'Emilia', 'Sommer', '2010-01-18', 'Beispielhausen', 7),
(33, 'Tom', 'Winter', '2009-11-04', 'Musterstadt', 7),
(34, 'Lara', 'Ludwig', '2009-08-12', 'Beispielhausen', 7),
(35, 'Erik', 'Vogt', '2009-04-02', 'Beispielhausen', 7),
(36, 'Julian', 'Haas', '2011-03-26', 'Musterstadt', 8),
(37, 'Sarah', 'Engel', '2011-07-07', 'Musterstadt', 8),
(38, 'Simon', 'Pohl', '2012-01-30', 'Waldmusterdorf', 8),
(39, 'Maja', 'Albrecht', '2011-11-11', 'Musterstadt', 8),
(40, 'Linus', 'Sauer', '2011-05-16', 'Musterstadt', 8);

INSERT INTO fach (id, Bezeichnung, Kuerzel) VALUES
(1, 'Mathematik', 'M'),
(2, 'Deutsch', 'D'),
(3, 'Englisch', 'E'),
(4, 'Biologie', 'B'),
(5, 'Geschichte', 'G'),
(6, 'Informatik', 'Inf'),
(7, 'Kunst', 'Ku');

INSERT INTO note (schueler_id, fach_id, Note, Art, Datum) VALUES
(1, 1, 2, 'Schulaufgabe', '2024-11-14'),
(2, 1, 3, 'Schulaufgabe', '2024-11-14'),
(3, 1, 1, 'Schulaufgabe', '2024-11-14'),
(4, 1, 4, 'Schulaufgabe', '2024-11-14'),
(5, 1, 3, 'Schulaufgabe', '2024-11-14'),
(6, 1, 2, 'Schulaufgabe', '2024-11-14'),
(7, 1, 5, 'Schulaufgabe', '2024-11-14'),
(8, 1, 3, 'Schulaufgabe', '2024-11-14'),
(9, 1, 2, 'Schulaufgabe', '2024-11-14'),
(10, 1, 1, 'Schulaufgabe', '2024-11-14'),
(11, 1, 3, 'Schulaufgabe', '2024-11-14'),
(12, 1, 4, 'Schulaufgabe', '2024-11-14'),
(13, 1, 2, 'Schulaufgabe', '2024-11-14'),
(14, 1, 3, 'Schulaufgabe', '2024-11-14'),
(15, 1, 5, 'Schulaufgabe', '2024-11-14'),
(16, 1, 1, 'Schulaufgabe', '2024-11-14'),
(17, 1, 2, 'Schulaufgabe', '2024-11-14'),
(18, 1, 3, 'Schulaufgabe', '2024-11-14'),
(19, 1, 4, 'Schulaufgabe', '2024-11-14'),
(20, 1, 2, 'Schulaufgabe', '2024-11-14'),
(21, 1, 3, 'Schulaufgabe', '2024-11-20'),
(22, 1, 3, 'Schulaufgabe', '2024-11-20'),
(23, 1, 2, 'Schulaufgabe', '2024-11-20'),
(24, 1, 4, 'Schulaufgabe', '2024-11-20'),
(25, 1, 1, 'Schulaufgabe', '2024-11-20'),
(26, 1, 2, 'Schulaufgabe', '2024-11-20'),
(27, 1, 5, 'Schulaufgabe', '2024-11-20'),
(28, 1, 3, 'Schulaufgabe', '2024-11-20'),
(29, 1, 2, 'Schulaufgabe', '2024-11-20'),
(30, 1, 4, 'Schulaufgabe', '2024-11-20'),
(31, 1, 3, 'Schulaufgabe', '2024-11-20'),
(32, 1, 1, 'Schulaufgabe', '2024-11-20'),
(33, 1, 4, 'Schulaufgabe', '2024-11-20'),
(34, 1, 2, 'Schulaufgabe', '2024-11-20'),
(35, 1, 3, 'Schulaufgabe', '2024-11-20'),
(36, 1, 4, 'Schulaufgabe', '2024-11-27'),
(37, 1, 2, 'Schulaufgabe', '2024-11-27'),
(38, 1, 3, 'Schulaufgabe', '2024-11-27'),
(39, 1, 6, 'Schulaufgabe', '2024-11-27'),
(40, 1, 2, 'Schulaufgabe', '2024-11-27'),
(1, 2, 1, 'Stegreifaufgabe', '2024-12-05'),
(2, 2, 2, 'Stegreifaufgabe', '2024-12-05'),
(3, 2, 3, 'Stegreifaufgabe', '2024-12-05'),
(4, 2, 2, 'Stegreifaufgabe', '2024-12-05'),
(5, 2, 4, 'Stegreifaufgabe', '2024-12-05'),
(6, 2, 3, 'Stegreifaufgabe', '2024-12-05'),
(7, 2, 3, 'Stegreifaufgabe', '2024-12-05'),
(8, 2, 2, 'Stegreifaufgabe', '2024-12-05'),
(9, 2, 1, 'Stegreifaufgabe', '2024-12-05'),
(10, 2, 2, 'Stegreifaufgabe', '2024-12-05'),
(11, 2, 2, 'Stegreifaufgabe', '2024-12-05'),
(12, 2, 3, 'Stegreifaufgabe', '2024-12-05'),
(13, 2, 4, 'Stegreifaufgabe', '2024-12-05'),
(14, 2, 1, 'Stegreifaufgabe', '2024-12-05'),
(15, 2, 3, 'Stegreifaufgabe', '2024-12-05'),
(16, 2, 2, 'Stegreifaufgabe', '2024-12-05'),
(17, 2, 4, 'Stegreifaufgabe', '2024-12-05'),
(18, 2, 2, 'Stegreifaufgabe', '2024-12-05'),
(19, 2, 3, 'Stegreifaufgabe', '2024-12-05'),
(20, 2, 1, 'Stegreifaufgabe', '2024-12-05'),
(21, 2, 4, 'Stegreifaufgabe', '2024-12-10'),
(22, 2, 2, 'Stegreifaufgabe', '2024-12-10'),
(23, 2, 3, 'Stegreifaufgabe', '2024-12-10'),
(24, 2, 2, 'Stegreifaufgabe', '2024-12-10'),
(25, 2, 2, 'Stegreifaufgabe', '2024-12-10'),
(26, 2, 3, 'Stegreifaufgabe', '2024-12-10'),
(27, 2, 4, 'Stegreifaufgabe', '2024-12-10'),
(28, 2, 1, 'Stegreifaufgabe', '2024-12-10'),
(29, 2, 3, 'Stegreifaufgabe', '2024-12-10'),
(30, 2, 2, 'Stegreifaufgabe', '2024-12-10'),
(31, 2, 2, 'Stegreifaufgabe', '2024-12-10'),
(32, 2, 3, 'Stegreifaufgabe', '2024-12-10'),
(33, 2, 2, 'Stegreifaufgabe', '2024-12-10'),
(34, 2, 3, 'Stegreifaufgabe', '2024-12-10'),
(35, 2, 4, 'Stegreifaufgabe', '2024-12-10'),
(36, 2, 3, 'Stegreifaufgabe', '2024-12-12'),
(37, 2, 1, 'Stegreifaufgabe', '2024-12-12'),
(38, 2, 4, 'Stegreifaufgabe', '2024-12-12'),
(39, 2, 5, 'Stegreifaufgabe', '2024-12-12'),
(40, 2, 2, 'Stegreifaufgabe', '2024-12-12'),
(16, 6, 1, 'Referat', '2025-01-23'),
(17, 6, 2, 'Referat', '2025-01-23'),
(18, 6, 2, 'Referat', '2025-01-23'),
(19, 6, 3, 'Referat', '2025-01-23'),
(20, 6, 1, 'Referat', '2025-01-23'),
(31, 3, 3, 'Schulaufgabe', '2025-02-04'),
(32, 3, 2, 'Schulaufgabe', '2025-02-04'),
(33, 3, 4, 'Schulaufgabe', '2025-02-04'),
(34, 3, 2, 'Schulaufgabe', '2025-02-04'),
(35, 3, 3, 'Schulaufgabe', '2025-02-04'),
(11, 4, 2, 'Stegreifaufgabe', '2025-01-15'),
(12, 4, 3, 'Stegreifaufgabe', '2025-01-15'),
(13, 4, 1, 'Stegreifaufgabe', '2025-01-15'),
(14, 4, 2, 'Stegreifaufgabe', '2025-01-15'),
(15, 4, 4, 'Stegreifaufgabe', '2025-01-15'),
(26, 5, 3, 'Referat', '2025-02-11'),
(27, 5, 2, 'Referat', '2025-02-11'),
(28, 5, 1, 'Referat', '2025-02-11'),
(29, 5, 3, 'Referat', '2025-02-11'),
(30, 5, 2, 'Referat', '2025-02-11');
`
  });
})(window.SQLSIM = window.SQLSIM || {});
