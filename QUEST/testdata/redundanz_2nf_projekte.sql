-- Titel: Projektmitarbeit (2. Normalform verletzt)
-- Beschreibung: Mitarbeit an Projekten in einer Tabelle; Mitarbeiter- und Projektdaten stehen bei jeder Zuordnung erneut.
--
-- Übungsdatei für QUEST (Seite 6 „Redundanzen“).
-- Besonderheiten für die Anomalien: Mitarbeiter 4 und Projekt 12 kommen nur einmal vor
-- (Löschanomalie), die übrigen mehrfach (Änderungsanomalie).
-- Alle Namen, Firmen und Werte sind frei erfunden. Lizenz: MIT (siehe LICENSE).

DROP TABLE IF EXISTS projektmitarbeit;

CREATE TABLE projektmitarbeit (
  mitarbeiter_nr INT NOT NULL,
  projekt_nr INT NOT NULL,
  Stunden INT CHECK (Stunden >= 0),
  Mitarbeiter_Name VARCHAR(40) NOT NULL,
  Abteilung VARCHAR(30),
  Projekt_Titel VARCHAR(40) NOT NULL,
  Auftraggeber VARCHAR(40),
  Budget DECIMAL(9,2),
  PRIMARY KEY (mitarbeiter_nr, projekt_nr)
);

INSERT INTO projektmitarbeit (mitarbeiter_nr, projekt_nr, Stunden, Mitarbeiter_Name, Abteilung, Projekt_Titel, Auftraggeber, Budget) VALUES
  (1, 10, 40, 'Anna Krug', 'Entwicklung', 'Kundenportal', 'Nordwind GmbH', 40000.00),
  (1, 13, 25, 'Anna Krug', 'Entwicklung', 'Datenmigration', 'Nordwind GmbH', 31000.00),
  (2, 10, 35, 'Boris Lenz', 'Entwicklung', 'Kundenportal', 'Nordwind GmbH', 40000.00),
  (2, 11, 10, 'Boris Lenz', 'Entwicklung', 'Lagerumzug', 'Intern', 15000.00),
  (3, 12, 20, 'Carla Nowak', 'Vertrieb', 'Messeauftritt', 'Sonnental AG', 22000.00),
  (3, 10, 8, 'Carla Nowak', 'Vertrieb', 'Kundenportal', 'Nordwind GmbH', 40000.00),
  (4, 11, 30, 'Dieter Pohl', 'Einkauf', 'Lagerumzug', 'Intern', 15000.00),
  (5, 10, 12, 'Eva Rau', 'Vertrieb', 'Kundenportal', 'Nordwind GmbH', 40000.00),
  (5, 13, 18, 'Eva Rau', 'Vertrieb', 'Datenmigration', 'Nordwind GmbH', 31000.00);
