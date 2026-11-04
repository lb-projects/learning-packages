-- Titel: Bibliothek
-- Beschreibung: Autorinnen und Autoren, Bücher, Leserinnen und Leser sowie Ausleihen (auch noch nicht zurückgegebene).
--
-- Beispieldatenbank für QUEST.
-- Alle Namen, Buchtitel und Werte sind frei erfunden; Ähnlichkeiten mit realen
-- Personen oder Werken wären zufällig. Lizenz: MIT (siehe LICENSE).

DROP TABLE IF EXISTS ausleihe;
DROP TABLE IF EXISTS buch;
DROP TABLE IF EXISTS autor;
DROP TABLE IF EXISTS leser;

CREATE TABLE autor (
  id INT PRIMARY KEY,
  Vorname VARCHAR(30),
  Nachname VARCHAR(30) NOT NULL,
  Geburtsjahr INT,
  Land VARCHAR(30)
);

CREATE TABLE buch (
  id INT PRIMARY KEY,
  Titel VARCHAR(80) NOT NULL,
  autor_id INT,
  Erscheinungsjahr INT,
  Genre VARCHAR(20),
  Seiten INT CHECK (Seiten > 0),
  Signatur VARCHAR(12) UNIQUE,
  FOREIGN KEY (autor_id) REFERENCES autor (id)
);

CREATE TABLE leser (
  id INT PRIMARY KEY,
  Vorname VARCHAR(30),
  Nachname VARCHAR(30) NOT NULL,
  Wohnort VARCHAR(40),
  Mitglied_seit DATE
);

CREATE TABLE ausleihe (
  id INT AUTO_INCREMENT PRIMARY KEY,
  buch_id INT NOT NULL,
  leser_id INT NOT NULL,
  Ausleihdatum DATE NOT NULL,
  Rueckgabedatum DATE,
  FOREIGN KEY (buch_id) REFERENCES buch (id),
  FOREIGN KEY (leser_id) REFERENCES leser (id),
  CONSTRAINT chk_rueckgabe CHECK (Rueckgabedatum IS NULL OR Rueckgabedatum >= Ausleihdatum)
);

INSERT INTO autor (id, Vorname, Nachname, Geburtsjahr, Land) VALUES
(1, 'Lena', 'Sommerfeld', 1975, 'Deutschland'),
(2, 'Jakob', 'Wintermann', 1962, 'Österreich'),
(3, 'Mara', 'Lindqvist', 1981, 'Schweden'),
(4, 'Henri', 'Delacourt', 1958, 'Frankreich'),
(5, 'Clara', 'Steinbach', 1990, 'Deutschland'),
(6, 'Oskar', 'Feldmann', 1948, 'Schweiz'),
(7, 'Ida', 'Kowalczyk', 1985, 'Polen'),
(8, 'Tobias', 'Rehberg', 1979, 'Deutschland');

INSERT INTO buch (id, Titel, autor_id, Erscheinungsjahr, Genre, Seiten, Signatur) VALUES
(1, 'Das Geheimnis der blauen Mühle', 1, 2015, 'Krimi', 312, 'KRI-SOM-1'),
(2, 'Nebel über dem Moorsee', 1, 2018, 'Krimi', 288, 'KRI-SOM-2'),
(3, 'Die Sternenkarte', 2, 2009, 'Abenteuer', 410, 'ABE-WIN-1'),
(4, 'Reise zum Glutberg', 2, 2012, 'Abenteuer', 356, 'ABE-WIN-2'),
(5, 'Der letzte Leuchtturm', 2, 2020, 'Roman', 274, 'ROM-WIN-1'),
(6, 'Winterlicht in Lund', 3, 2016, 'Roman', 330, 'ROM-LIN-1'),
(7, 'Stille Wasser, tiefe Spuren', 3, 2021, 'Krimi', 298, 'KRI-LIN-1'),
(8, 'Die Uhrmacherin von Lyon', 4, 2005, 'Roman', 452, 'ROM-DEL-1'),
(9, 'Fünf Tage im August', 4, 2011, 'Roman', 240, 'ROM-DEL-2'),
(10, 'Programmieren für Neugierige', 5, 2022, 'Sachbuch', 198, 'SAC-STE-1'),
(11, 'Datenbanken verstehen', 5, 2023, 'Sachbuch', 224, 'SAC-STE-2'),
(12, 'Seilschaft am Nebelgrat', 6, 1998, 'Abenteuer', 388, 'ABE-FEL-1'),
(13, 'Gletscherzeit', 6, 2003, 'Sachbuch', 176, 'SAC-FEL-1'),
(14, 'Der Garten der Zeit', 7, 2017, 'Fantasy', 520, 'FAN-KOW-1'),
(15, 'Das Lied der Drachenflöte', 7, 2019, 'Fantasy', 476, 'FAN-KOW-2'),
(16, 'Schattenreiter', 7, 2022, 'Fantasy', 498, 'FAN-KOW-3'),
(17, 'Kleine Geschichte der Zahlen', 5, 2019, 'Sachbuch', 160, 'SAC-STE-3'),
(18, 'Die Insel der Möwen', 1, 2023, 'Kinderbuch', 96, 'KIN-SOM-1'),
(19, 'Pip und der Regenbogen', 3, 2014, 'Kinderbuch', 48, 'KIN-LIN-1'),
(20, 'Mord im Museum', 4, 2015, 'Krimi', 344, 'KRI-DEL-1');

INSERT INTO leser (id, Vorname, Nachname, Wohnort, Mitglied_seit) VALUES
(1, 'Sven', 'Albers', 'Musterstadt', '2019-03-01'),
(2, 'Greta', 'Bauer', 'Musterstadt', '2020-09-15'),
(3, 'Yusuf', 'Demir', 'Beispielhausen', '2021-01-10'),
(4, 'Frieda', 'Ernst', 'Musterstadt', '2018-06-20'),
(5, 'Karl', 'Fiedler', 'Waldmusterdorf', '2022-02-02'),
(6, 'Hanna', 'Gerber', 'Beispielhausen', '2023-05-12'),
(7, 'Ole', 'Hansen', 'Musterstadt', '2017-11-30'),
(8, 'Ronja', 'Illner', 'Musterstadt', '2024-01-08'),
(9, 'Mats', 'Jansen', 'Waldmusterdorf', '2020-04-25'),
(10, 'Pia', 'Kühn', 'Beispielhausen', '2021-08-17'),
(11, 'Theo', 'Lindner', 'Musterstadt', '2024-09-03'),
(12, 'Wiebke', 'Marx', 'Beispielhausen', '2016-02-14');

INSERT INTO ausleihe (buch_id, leser_id, Ausleihdatum, Rueckgabedatum) VALUES
(1, 1, '2024-09-02', '2024-09-20'),
(3, 2, '2024-09-05', '2024-09-30'),
(14, 3, '2024-09-10', '2024-10-08'),
(10, 4, '2024-09-12', '2024-09-26'),
(6, 5, '2024-09-18', '2024-10-15'),
(2, 1, '2024-09-21', '2024-10-10'),
(15, 3, '2024-10-09', '2024-11-05'),
(11, 6, '2024-10-11', '2024-10-25'),
(18, 8, '2024-10-14', '2024-10-21'),
(7, 7, '2024-10-17', '2024-11-12'),
(1, 9, '2024-10-22', '2024-11-08'),
(5, 4, '2024-10-28', '2024-11-20'),
(16, 3, '2024-11-06', '2024-12-03'),
(4, 2, '2024-11-08', '2024-12-01'),
(20, 1, '2024-11-12', '2024-11-29'),
(9, 10, '2024-11-15', '2024-12-10'),
(10, 6, '2024-11-20', '2024-12-04'),
(17, 11, '2024-11-25', '2024-12-09'),
(8, 12, '2024-12-02', '2025-01-07'),
(14, 9, '2024-12-05', '2025-01-02'),
(2, 7, '2024-12-10', '2025-01-08'),
(11, 4, '2025-01-07', '2025-01-21'),
(6, 2, '2025-01-09', NULL),
(15, 5, '2025-01-14', '2025-02-04'),
(3, 10, '2025-01-20', NULL),
(18, 11, '2025-01-22', '2025-01-29'),
(1, 6, '2025-01-28', NULL),
(16, 9, '2025-02-03', NULL),
(10, 3, '2025-02-05', NULL),
(7, 1, '2025-02-10', NULL);
