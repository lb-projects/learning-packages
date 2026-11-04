-- Titel: Vereinsmitglieder (3. Normalform verletzt)
-- Beschreibung: Mitgliederliste eines Vereins mit transitiven Abhängigkeiten und einem Widerspruch in den Daten.
--
-- Übungsdatei für QUEST (Seite 6 „Redundanzen“).
-- Absichtlich enthalten: Zur PLZ 12347 sind zwei verschiedene Schreibweisen des Orts
-- gespeichert – so sieht eine bereits eingetretene Änderungsanomalie aus.
-- Alle Namen und Werte sind frei erfunden. Lizenz: MIT (siehe LICENSE).

DROP TABLE IF EXISTS mitglied;

CREATE TABLE mitglied (
  id INT PRIMARY KEY AUTO_INCREMENT,
  Name VARCHAR(40),
  PLZ CHAR(5),
  Ort VARCHAR(40),
  Abteilung VARCHAR(20),
  Abteilungsleitung VARCHAR(40),
  Beitrag DECIMAL(6,2)
);

INSERT INTO mitglied (id, Name, PLZ, Ort, Abteilung, Abteilungsleitung, Beitrag) VALUES
  (1, 'Jana Busch', '12345', 'Musterstadt', 'Fußball', 'Uwe Kern', 60.00),
  (2, 'Leon Haas', '12347', 'Beispielhausen', 'Fußball', 'Uwe Kern', 60.00),
  (3, 'Nele Franke', '12345', 'Musterstadt', 'Tennis', 'Bettina Stahl', 90.00),
  (4, 'Ole Witt', '12349', 'Waldmusterdorf', 'Schwimmen', 'Ingo Ries', 45.00),
  (5, 'Pia Kuhn', '12347', 'Beispielhsn.', 'Tennis', 'Bettina Stahl', 90.00),
  (6, 'Max Sauer', '12345', 'Musterstadt', 'Fußball', 'Uwe Kern', 60.00),
  (7, 'Tina Ernst', '12349', 'Waldmusterdorf', 'Schwimmen', 'Ingo Ries', 45.00),
  (8, 'Jan Albers', '12351', 'Kleinmusterhof', 'Leichtathletik', 'Rita Moll', 50.00);
