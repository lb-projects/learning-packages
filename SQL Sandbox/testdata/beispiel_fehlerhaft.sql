-- Absichtlich fehlerhafte Datei für die SQL Sandbox.
-- Beim Hochladen erscheint eine Fehlermeldung mit Zeilen- und Spaltenangabe;
-- die bisher geladene Datenbank bleibt unverändert.
-- Aufgabe: Finden und beheben Sie die Fehler (es sind zwei).
-- Lizenz: MIT (siehe LICENSE).

DROP TABLE IF EXISTS haustier;

CREATE TABLE haustier (
  id INT PRIMARY KEY,
  Name VARCHAR(30) NOT NULL,
  Tierart VARCHAR(20),
  Geburtsjahr INT
);

INSERT INTO haustier (id, Name, Tierart, Geburtsjahr) VALUES
(1, 'Bello', 'Hund', 2019),
(2, 'Minka', 'Katze', 2021),
(3, 'Hoppel' 'Kaninchen', 2022),
(4, 'Goldi', 'Fisch', 2023);

INSERT INTO haustier (id, Name, Tierart, Geburtsjahr) VALUES
(2, 'Rocky', 'Hund', 2020);
