-- Titel: Online-Shop
-- Beschreibung: Kategorien, Artikel mit Preisen, Kundinnen und Kunden, Bestellungen und Bestellpositionen.
--
-- Beispieldatenbank für die SQL Sandbox.
-- Alle Namen, Artikel und Werte sind frei erfunden; Ähnlichkeiten mit realen
-- Personen, Firmen oder Produkten wären zufällig. Lizenz: MIT (siehe LICENSE).

DROP TABLE IF EXISTS bestellposition;
DROP TABLE IF EXISTS bestellung;
DROP TABLE IF EXISTS kunde;
DROP TABLE IF EXISTS artikel;
DROP TABLE IF EXISTS kategorie;

CREATE TABLE kategorie (
  id INT PRIMARY KEY,
  Bezeichnung VARCHAR(30) NOT NULL
);

CREATE TABLE artikel (
  id INT PRIMARY KEY,
  Bezeichnung VARCHAR(50) NOT NULL,
  kategorie_id INT,
  Preis DECIMAL(8,2) NOT NULL CHECK (Preis >= 0),
  Lagerbestand INT DEFAULT 0 CHECK (Lagerbestand >= 0),
  FOREIGN KEY (kategorie_id) REFERENCES kategorie (id)
);

CREATE TABLE kunde (
  id INT PRIMARY KEY,
  Vorname VARCHAR(30),
  Nachname VARCHAR(30) NOT NULL,
  Wohnort VARCHAR(40),
  Registriert_am DATE
);

CREATE TABLE bestellung (
  id INT PRIMARY KEY,
  kunde_id INT NOT NULL,
  Bestelldatum DATE NOT NULL,
  Status ENUM('offen', 'versendet', 'geliefert') NOT NULL,
  FOREIGN KEY (kunde_id) REFERENCES kunde (id)
);

CREATE TABLE bestellposition (
  bestellung_id INT NOT NULL,
  artikel_id INT NOT NULL,
  Menge INT NOT NULL CHECK (Menge > 0),
  PRIMARY KEY (bestellung_id, artikel_id),
  FOREIGN KEY (bestellung_id) REFERENCES bestellung (id),
  FOREIGN KEY (artikel_id) REFERENCES artikel (id)
);

INSERT INTO kategorie (id, Bezeichnung) VALUES
(1, 'Bücher'),
(2, 'Elektronik'),
(3, 'Spielwaren'),
(4, 'Haushalt'),
(5, 'Sport'),
(6, 'Garten');

INSERT INTO artikel (id, Bezeichnung, kategorie_id, Preis, Lagerbestand) VALUES
(1, 'Sachbuch Sternenhimmel', 1, 24.90, 35),
(2, 'Kinderbuch Waldtiere', 1, 12.50, 60),
(3, 'Notizbuch A5', 1, 4.99, 250),
(4, 'Speicherstick 64 GB', 2, 9.99, 120),
(5, 'Kopfhörer kabellos', 2, 59.00, 18),
(6, 'Funklautsprecher', 2, 39.95, 0),
(7, 'Ladekabel 1 m', 2, 7.49, 300),
(8, 'Schreibtischlampe LED', 2, 34.90, 22),
(9, 'Brettspiel Inselabenteuer', 3, 29.99, 40),
(10, 'Puzzle 1000 Teile', 3, 14.95, 55),
(11, 'Kartenspiel Zahlenjagd', 3, 8.50, 80),
(12, 'Kochtopf-Set', 4, 89.00, 7),
(13, 'Kaffeebecher', 4, 6.90, 140),
(14, 'Messerblock', 4, 49.90, 12),
(15, 'Taschenlampe', 4, 15.99, 45),
(16, 'Fußball Größe 5', 5, 19.95, 30),
(17, 'Yogamatte', 5, 24.00, 25),
(18, 'Laufschuhe', 5, 79.90, 14),
(19, 'Springseil', 5, 5.95, 90),
(20, 'Wasserflasche 0,75 l', 5, 11.90, 0);

INSERT INTO kunde (id, Vorname, Nachname, Wohnort, Registriert_am) VALUES
(1, 'Andrea', 'Baumann', 'Musterstadt', '2022-03-14'),
(2, 'Bernd', 'Christ', 'Beispielhausen', '2022-07-01'),
(3, 'Carla', 'Dietrich', 'Musterstadt', '2023-01-20'),
(4, 'Dennis', 'Ebert', 'Waldmusterdorf', '2023-04-11'),
(5, 'Eva', 'Franke', 'Musterstadt', '2023-06-30'),
(6, 'Florian', 'Gruber', 'Beispielhausen', '2023-09-09'),
(7, 'Gül', 'Hamann', 'Musterstadt', '2024-01-15'),
(8, 'Henrik', 'Ilić', 'Waldmusterdorf', '2024-02-28'),
(9, 'Ines', 'Jakob', 'Musterstadt', '2024-05-05'),
(10, 'Jens', 'Kuhn', 'Beispielhausen', '2024-08-19'),
(11, 'Katja', 'Lenz', 'Musterstadt', '2024-10-02'),
(12, 'Lars', 'Martin', 'Waldmusterdorf', '2025-01-12');

INSERT INTO bestellung (id, kunde_id, Bestelldatum, Status) VALUES
(1, 1, '2024-10-03', 'geliefert'),
(2, 2, '2024-10-05', 'geliefert'),
(3, 1, '2024-10-19', 'geliefert'),
(4, 3, '2024-11-02', 'geliefert'),
(5, 5, '2024-11-08', 'geliefert'),
(6, 4, '2024-11-15', 'geliefert'),
(7, 6, '2024-11-22', 'geliefert'),
(8, 2, '2024-11-29', 'geliefert'),
(9, 7, '2024-12-01', 'geliefert'),
(10, 1, '2024-12-06', 'geliefert'),
(11, 8, '2024-12-10', 'geliefert'),
(12, 5, '2024-12-13', 'geliefert'),
(13, 9, '2024-12-18', 'geliefert'),
(14, 3, '2025-01-07', 'geliefert'),
(15, 10, '2025-01-15', 'versendet'),
(16, 6, '2025-01-21', 'versendet'),
(17, 1, '2025-01-28', 'versendet'),
(18, 7, '2025-02-03', 'offen'),
(19, 2, '2025-02-05', 'offen'),
(20, 9, '2025-02-06', 'offen');

INSERT INTO bestellposition (bestellung_id, artikel_id, Menge) VALUES
(1, 1, 1),
(1, 3, 3),
(2, 5, 1),
(2, 7, 2),
(3, 9, 1),
(3, 11, 2),
(4, 12, 1),
(4, 13, 4),
(5, 16, 2),
(5, 19, 1),
(6, 4, 3),
(6, 7, 1),
(6, 8, 1),
(7, 17, 1),
(7, 18, 1),
(8, 2, 2),
(8, 10, 1),
(9, 13, 6),
(9, 14, 1),
(10, 5, 1),
(10, 4, 2),
(11, 9, 1),
(11, 10, 2),
(11, 11, 1),
(12, 1, 1),
(12, 2, 1),
(13, 18, 1),
(13, 19, 2),
(13, 17, 1),
(14, 15, 2),
(14, 3, 5),
(15, 8, 1),
(15, 7, 3),
(16, 16, 1),
(17, 12, 1),
(17, 14, 1),
(17, 13, 2),
(18, 4, 1),
(18, 3, 2),
(19, 9, 2),
(20, 5, 1),
(20, 15, 1);
