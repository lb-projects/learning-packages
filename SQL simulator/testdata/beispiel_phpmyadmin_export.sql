-- Beispiel im Stil eines Datenbank-Exports (z. B. aus phpMyAdmin) für den SQL-Simulator.
-- Zeigt, dass typische Export-Bestandteile verstanden werden:
-- Backticks, ENGINE/CHARSET-Angaben, SET-/Transaktionsbefehle, Sonderkommentare
-- sowie Schlüssel und AUTO_INCREMENT über ALTER TABLE am Dateiende.
-- Thema: Kursangebot einer erfundenen Musikschule. Alle Daten sind frei erfunden.
-- Lizenz: MIT (siehe LICENSE).

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

/*!40101 SET NAMES utf8mb4 */;

-- --------------------------------------------------------
-- Tabellenstruktur für Tabelle `kurs`
-- --------------------------------------------------------

CREATE TABLE `kurs` (
  `id` int(11) NOT NULL,
  `Titel` varchar(60) NOT NULL,
  `Instrument` varchar(30) DEFAULT NULL,
  `Wochentag` enum('Mo','Di','Mi','Do','Fr','Sa') NOT NULL,
  `Gebuehr` decimal(6,2) NOT NULL DEFAULT 0.00,
  `Plaetze` tinyint(3) UNSIGNED NOT NULL DEFAULT 8
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `kurs` (`id`, `Titel`, `Instrument`, `Wochentag`, `Gebuehr`, `Plaetze`) VALUES
(1, 'Gitarre für Anfänger', 'Gitarre', 'Mo', 45.00, 8),
(2, 'Klavier Grundkurs', 'Klavier', 'Di', 60.00, 4),
(3, 'Trommelgruppe', 'Schlagzeug', 'Mi', 35.00, 10),
(4, 'Chor für alle', NULL, 'Do', 20.00, 30),
(5, 'Geige Mittelstufe', 'Geige', 'Fr', 55.00, 5),
(6, 'Ukulele am Samstag', 'Ukulele', 'Sa', 30.00, 12);

-- --------------------------------------------------------
-- Tabellenstruktur für Tabelle `teilnehmer`
-- --------------------------------------------------------

CREATE TABLE `teilnehmer` (
  `id` int(11) NOT NULL,
  `Vorname` varchar(30) DEFAULT NULL,
  `Nachname` varchar(30) NOT NULL,
  `Geburtsjahr` year(4) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `teilnehmer` (`id`, `Vorname`, `Nachname`, `Geburtsjahr`) VALUES
(1, 'Aylin', 'Brecht', 2010),
(2, 'Bruno', 'Claasen', 1985),
(3, 'Carlotta', 'Dahl', 2012),
(4, 'Dieter', 'Eberle', 1958),
(5, 'Esra', 'Fromm', 2008),
(6, 'Fritz', 'Gehrke', 1999),
(7, 'Greta', 'Haupt', 2014),
(8, 'Hugo', 'Iversen', NULL);

-- --------------------------------------------------------
-- Tabellenstruktur für Tabelle `anmeldung`
-- --------------------------------------------------------

CREATE TABLE `anmeldung` (
  `id` int(11) NOT NULL,
  `kurs_id` int(11) NOT NULL,
  `teilnehmer_id` int(11) NOT NULL,
  `angemeldet_am` date NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `anmeldung` (`id`, `kurs_id`, `teilnehmer_id`, `angemeldet_am`) VALUES
(1, 1, 1, '2024-08-20'),
(2, 1, 5, '2024-08-22'),
(3, 2, 3, '2024-08-25'),
(4, 3, 7, '2024-09-01'),
(5, 4, 2, '2024-09-02'),
(6, 4, 4, '2024-09-02'),
(7, 4, 6, '2024-09-03'),
(8, 5, 5, '2024-09-05'),
(9, 1, 6, '2024-09-06'),
(10, 3, 1, '2024-09-10');

-- --------------------------------------------------------
-- Indizes, AUTO_INCREMENT und Fremdschlüssel
-- --------------------------------------------------------

ALTER TABLE `kurs`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `teilnehmer`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `anmeldung`
  ADD PRIMARY KEY (`id`),
  ADD KEY `kurs_id` (`kurs_id`),
  ADD KEY `teilnehmer_id` (`teilnehmer_id`);

ALTER TABLE `kurs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

ALTER TABLE `anmeldung`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

ALTER TABLE `anmeldung`
  ADD CONSTRAINT `anmeldung_ibfk_1` FOREIGN KEY (`kurs_id`) REFERENCES `kurs` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `anmeldung_ibfk_2` FOREIGN KEY (`teilnehmer_id`) REFERENCES `teilnehmer` (`id`);

COMMIT;
