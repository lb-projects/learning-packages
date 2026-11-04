-- Titel: Ausleihe (2. Normalform verletzt)
-- Beschreibung: Ausleihen einer Schulbibliothek in einer einzigen Tabelle mit zusammengesetztem Schlüssel.
--
-- Übungsdatei für QUEST (Seite 6 „Redundanzen“).
-- Alle Namen, Titel und Werte sind frei erfunden; Ähnlichkeiten mit realen
-- Personen oder Werken wären zufällig. Lizenz: MIT (siehe LICENSE).

DROP TABLE IF EXISTS ausleihe;

CREATE TABLE ausleihe (
  leser_nr INT NOT NULL,
  buch_nr INT NOT NULL,
  Ausleihdatum DATE NOT NULL,
  Rueckgabe DATE,
  Leser_Name VARCHAR(40) NOT NULL,
  Leser_Klasse VARCHAR(5),
  Buch_Titel VARCHAR(60) NOT NULL,
  Autor VARCHAR(40),
  PRIMARY KEY (leser_nr, buch_nr, Ausleihdatum)
);

INSERT INTO ausleihe (leser_nr, buch_nr, Ausleihdatum, Rueckgabe, Leser_Name, Leser_Klasse, Buch_Titel, Autor) VALUES
  (1, 11, '2024-09-16', '2024-09-30', 'Lina Weber', '7a', 'Das Rätsel im Nebelwald', 'Hanna Sommer'),
  (1, 12, '2024-10-01', '2024-10-21', 'Lina Weber', '7a', 'Sternenfahrer', 'Moritz Klee'),
  (2, 11, '2024-10-02', '2024-10-14', 'Karl Busch', '7b', 'Das Rätsel im Nebelwald', 'Hanna Sommer'),
  (2, 13, '2024-10-15', NULL, 'Karl Busch', '7b', 'Kochen für Entdecker', 'Greta Hain'),
  (3, 12, '2024-10-22', '2024-11-05', 'Sophie Arnold', '8a', 'Sternenfahrer', 'Moritz Klee'),
  (3, 14, '2024-11-06', NULL, 'Sophie Arnold', '8a', 'Die Insel der Zahlen', 'Moritz Klee'),
  (1, 11, '2024-11-04', NULL, 'Lina Weber', '7a', 'Das Rätsel im Nebelwald', 'Hanna Sommer'),
  (4, 15, '2024-11-07', NULL, 'Anton Pohl', '8b', 'Geschichten vom Leuchtturm', 'Greta Hain'),
  (4, 12, '2024-09-20', '2024-10-01', 'Anton Pohl', '8b', 'Sternenfahrer', 'Moritz Klee'),
  (5, 13, '2024-09-23', '2024-10-07', 'Marie Lang', '7a', 'Kochen für Entdecker', 'Greta Hain');
