-- Titel: Kontaktliste (1. Normalform verletzt)
-- Beschreibung: Teilnehmerliste einer Arbeitsgemeinschaft mit Listen in einer Spalte und Wiederholungsgruppen.
--
-- Übungsdatei für die SQL Sandbox (Seite 6 „Redundanzen“).
-- Alle Namen und Werte sind fiktiv. Lizenz: MIT (siehe LICENSE).

DROP TABLE IF EXISTS teilnehmer;

CREATE TABLE teilnehmer (
  id INT PRIMARY KEY,
  Name VARCHAR(40) NOT NULL,
  Telefon1 VARCHAR(20),
  Telefon2 VARCHAR(20),
  Telefon3 VARCHAR(20),
  Hobbys VARCHAR(100),
  Adresse VARCHAR(80)
);

INSERT INTO teilnehmer (id, Name, Telefon1, Telefon2, Telefon3, Hobbys, Adresse) VALUES
  (1, 'Lea Fuchs', '0123 456801', '0123 456802', NULL, 'Fußball, Schach', 'Musterweg 3, 12345 Musterstadt'),
  (2, 'Noah Kraft', '0123 456803', NULL, NULL, 'Gitarre', 'Lindenallee 8, 12347 Beispielhausen'),
  (3, 'Ida Seitz', '0123 456804', '0123 456805', '0123 456806', 'Lesen, Schwimmen, Zeichnen', 'Am Bach 1, 12349 Waldmusterdorf'),
  (4, 'Elias Brandt', '0123 456807', NULL, NULL, 'Schach; Programmieren', 'Musterweg 17, 12345 Musterstadt'),
  (5, 'Mila Graf', NULL, NULL, NULL, 'Tanzen', 'Ringstraße 5, 12347 Beispielhausen'),
  (6, 'Finn Ott', '0123 456808', '0123 456809', NULL, 'Fußball, Gitarre', 'Bergstraße 2, 12345 Musterstadt');
