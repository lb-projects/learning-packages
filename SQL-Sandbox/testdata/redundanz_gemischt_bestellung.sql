-- Titel: Bestellungen in einer Tabelle (mehrere Verstöße) und Lieferanten ohne Schlüssel
-- Beschreibung: Eine Tabelle mit Teilabhängigkeiten und transitiver Abhängigkeit; dazu eine Tabelle ohne Primärschlüssel.
--
-- Übungsdatei für die SQL Sandbox (Seite 6 „Redundanzen“).
-- „bestellung_flach“ verletzt die 2. und die 3. Normalform gleichzeitig; mehrere Verstöße
-- lassen sich auf der Seite nacheinander auswählen. „lieferant“ hat keinen Schlüssel und
-- enthält einen doppelten Datensatz: 2. und 3. Normalform sind nicht beurteilbar.
-- Alle Namen und Werte sind frei erfunden. Lizenz: MIT (siehe LICENSE).

DROP TABLE IF EXISTS bestellung_flach;
DROP TABLE IF EXISTS lieferant;

CREATE TABLE bestellung_flach (
  bestell_nr INT NOT NULL,
  artikel_nr INT NOT NULL,
  Menge INT CHECK (Menge > 0),
  Bestelldatum DATE,
  Kunde_Nr INT,
  Kunde_Name VARCHAR(40),
  Kunde_Ort VARCHAR(40),
  Artikel_Bezeichnung VARCHAR(40),
  Einzelpreis DECIMAL(7,2),
  PRIMARY KEY (bestell_nr, artikel_nr)
);

CREATE TABLE lieferant (
  Name VARCHAR(40),
  Ort VARCHAR(40),
  Telefon VARCHAR(20)
);

INSERT INTO bestellung_flach (bestell_nr, artikel_nr, Menge, Bestelldatum, Kunde_Nr, Kunde_Name, Kunde_Ort, Artikel_Bezeichnung, Einzelpreis) VALUES
  (1001, 7, 1, '2024-09-02', 501, 'Julia Kern', 'Musterstadt', 'Schreibtischlampe', 24.90),
  (1001, 8, 3, '2024-09-02', 501, 'Julia Kern', 'Musterstadt', 'Notizbuch', 4.50),
  (1002, 8, 2, '2024-09-05', 502, 'Marco Dietz', 'Beispielhausen', 'Notizbuch', 4.50),
  (1002, 9, 4, '2024-09-05', 502, 'Marco Dietz', 'Beispielhausen', 'Kaffeebecher', 7.90),
  (1003, 9, 1, '2024-09-09', 501, 'Julia Kern', 'Musterstadt', 'Kaffeebecher', 7.90),
  (1003, 7, 2, '2024-09-09', 501, 'Julia Kern', 'Musterstadt', 'Schreibtischlampe', 24.90),
  (1004, 8, 5, '2024-09-12', 503, 'Nina Falk', 'Waldmusterdorf', 'Notizbuch', 4.50),
  (1004, 10, 1, '2024-09-12', 503, 'Nina Falk', 'Waldmusterdorf', 'Tastatur', 39.00);

INSERT INTO lieferant (Name, Ort, Telefon) VALUES
  ('Papierhof GmbH', 'Musterstadt', '0123 900100'),
  ('Lichtwerk AG', 'Beispielhausen', '0123 900200'),
  ('Papierhof GmbH', 'Musterstadt', '0123 900100'),
  ('Keramik Roth', 'Waldmusterdorf', '0123 900300');
