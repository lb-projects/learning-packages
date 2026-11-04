-- Titel: Arztpraxis-Termine (3. Normalform verletzt)
-- Beschreibung: Terminliste einer Gemeinschaftspraxis mit Angaben zu Ärzten und Krankenkassen in jeder Zeile.
--
-- Übungsdatei für QUEST (Seite 6 „Redundanzen“).
-- Der Schlüssel (id) ist AUTO_INCREMENT und alle übrigen Spalten dürfen leer sein: Die
-- Einfügeanomalie zeigt hier einen unvollständigen Datensatz statt einer Fehlermeldung.
-- Dr. Lorenz kommt nur einmal vor, die Kasse „Bergland“ nur zweimal.
-- Alle Namen, Praxen und Kassen sind frei erfunden. Lizenz: MIT (siehe LICENSE).

DROP TABLE IF EXISTS termin;

CREATE TABLE termin (
  id INT PRIMARY KEY AUTO_INCREMENT,
  Datum DATE,
  Patient VARCHAR(40),
  Arzt VARCHAR(30),
  Fachgebiet VARCHAR(30),
  Zimmer VARCHAR(5),
  Versicherung VARCHAR(30),
  Versicherung_Telefon VARCHAR(20)
);

INSERT INTO termin (id, Datum, Patient, Arzt, Fachgebiet, Zimmer, Versicherung, Versicherung_Telefon) VALUES
  (1, '2024-10-07', 'Mia Holz', 'Dr. Brandt', 'Innere Medizin', 'Z1', 'Nordkasse', '0800 111111'),
  (2, '2024-10-07', 'Leo Frank', 'Dr. Sander', 'Orthopädie', 'Z2', 'Nordkasse', '0800 111111'),
  (3, '2024-10-08', 'Hanna Gross', 'Dr. Brandt', 'Innere Medizin', 'Z1', 'Sonnenschutz', '0800 222222'),
  (4, '2024-10-08', 'Tom Maier', 'Dr. Lorenz', 'Hautarzt', 'Z3', 'Sonnenschutz', '0800 222222'),
  (5, '2024-10-09', 'Ida Beck', 'Dr. Sander', 'Orthopädie', 'Z2', 'Sonnenschutz', '0800 222222'),
  (6, '2024-10-09', 'Paul Engel', 'Dr. Brandt', 'Innere Medizin', 'Z1', 'Nordkasse', '0800 111111'),
  (7, '2024-10-10', 'Lena Ahrens', 'Dr. Sander', 'Orthopädie', 'Z2', 'Bergland', '0800 333333'),
  (8, '2024-10-10', 'Max Winter', 'Dr. Brandt', 'Innere Medizin', 'Z1', 'Bergland', '0800 333333');
