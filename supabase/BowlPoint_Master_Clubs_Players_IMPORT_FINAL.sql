-- ============================================================
-- BOWLPOINT - MASTER CLUBS + PLAYERS IMPORT
-- Source: Member as at 10.07.2026.xlsx
-- Sheet: All Members as at 10.07.2026
-- FINAL VERSION - matched to LIVE Supabase schema supplied by user
-- Players columns used: first_name, last_name, display_name,
-- club_id, date_registered, bsa_number, active
-- No phone/mobile column exists in the live players table, so
-- mobile numbers are intentionally not imported.
-- ============================================================

BEGIN;

-- Staging table
DROP TABLE IF EXISTS tmp_bowlpoint_members;
CREATE TEMP TABLE tmp_bowlpoint_members (
    given_names TEXT,
    surname TEXT,
    bsa_number TEXT,
    club_name TEXT,
    registration_date DATE
);

INSERT INTO tmp_bowlpoint_members
(given_names, surname, bsa_number, club_name, registration_date)
VALUES
('Derek William', 'Anderson', '70400', 'SED Deneysville Bowls Club', DATE '2021-08-10'),
('Hendrik Christiaan', 'Bester', '704061', 'SED Deneysville Bowls Club', DATE '2022-09-22'),
('Hendrina Glaudina', 'Bester', '75281', 'SED Deneysville Bowls Club', DATE '2023-04-21'),
('Jaco', 'Bester', '81779', 'SED Deneysville Bowls Club', DATE '2025-10-20'),
('Barend Daniël', 'Claassen', '79312', 'SED Deneysville Bowls Club', DATE '2024-10-29'),
('Sarette', 'Claassen', '79752', 'SED Deneysville Bowls Club', DATE '2025-01-03'),
('Sune', 'Claassen', '80468', 'SED Deneysville Bowls Club', DATE '2025-03-31'),
('Adele', 'Duvenage', '80937', 'SED Deneysville Bowls Club', DATE '2025-06-11'),
('Nico', 'Duvenage', '80848', 'SED Deneysville Bowls Club', DATE '2025-05-25'),
('Aletta Catharina Martha', 'Engelbrecht', '67960', 'SED Deneysville Bowls Club', DATE '2020-04-12'),
('Willem', 'Enslin', '76765', 'SED Deneysville Bowls Club', DATE '2023-11-20'),
('Willette', 'Enslin', '76764', 'SED Deneysville Bowls Club', DATE '2023-11-20'),
('Gesina Maria', 'Hattingh', '73952', 'SED Deneysville Bowls Club', DATE '2022-12-04'),
('Michael John', 'Holgate', '49709', 'SED Deneysville Bowls Club', DATE '2013-06-11'),
('Jeffrey William', 'Korte', '45752', 'SED Deneysville Bowls Club', DATE '2012-01-22'),
('Hester', 'Kotze', '56955', 'SED Deneysville Bowls Club', DATE '2016-01-01'),
('Pieter Daniël', 'Kotze', '56958', 'SED Deneysville Bowls Club', DATE '2016-01-01'),
('Heinz', 'Meyer', '76733', 'SED Deneysville Bowls Club', DATE '2023-11-13'),
('Margaretha', 'Müller', '74317', 'SED Deneysville Bowls Club', DATE '2023-01-10'),
('Schalk Harm', 'Müller', '74315', 'SED Deneysville Bowls Club', DATE '2023-01-10'),
('Charmaine Francis', 'Rudolph', '70254', 'SED Deneysville Bowls Club', DATE '2021-08-20'),
('Debbie', 'Smal', '80938', 'SED Deneysville Bowls Club', DATE '2025-06-11'),
('Johan', 'Smal', '80926', 'SED Deneysville Bowls Club', DATE '2025-06-10'),
('Mauritz Philip', 'Van Den Heever', '82713', 'SED Deneysville Bowls Club', DATE '2026-02-25'),
('Mark', 'Ward', '81781', 'SED Deneysville Bowls Club', DATE '2025-10-20'),
('Iain', 'Aitken', '24828', 'SED Henley On Klip Bowling Club', DATE '2009-09-21'),
('William Mason', 'Bailey', '83143', 'SED Henley On Klip Bowling Club', DATE '2026-05-01'),
('James Duncan', 'Bezuidenhout', '69586', 'SED Henley On Klip Bowling Club', DATE '2021-04-29'),
('Lauren', 'Coetzee', '67657', 'SED Henley On Klip Bowling Club', DATE '2020-02-04'),
('Rynard David', 'Coetzee', '67654', 'SED Henley On Klip Bowling Club', DATE '2020-02-04'),
('Tanja Ilana', 'De Wet', '83158', 'SED Henley On Klip Bowling Club', DATE '2026-05-05'),
('Etienne', 'Dekker', '74851', 'SED Henley On Klip Bowling Club', DATE '2023-03-03'),
('Lelanie', 'Dekker', '74850', 'SED Henley On Klip Bowling Club', DATE '2023-03-03'),
('Mike', 'Eagar', '24835', 'SED Henley On Klip Bowling Club', DATE '2009-09-21'),
('Tyrone', 'Frew', '69258', 'SED Henley On Klip Bowling Club', DATE '2021-03-16'),
('Christa', 'Gomez', '83159', 'SED Henley On Klip Bowling Club', DATE '2026-05-05'),
('Norma', 'Gove', '24838', 'SED Henley On Klip Bowling Club', DATE '2009-09-21'),
('Thomas Johannes', 'Jansen', '81105', 'SED Henley On Klip Bowling Club', DATE '2025-07-08'),
('Tracy', 'Meyeridricks', '8120', 'SED Henley On Klip Bowling Club', DATE '2009-09-21'),
('David Alexander', 'Morrison', '71568', 'SED Henley On Klip Bowling Club', DATE '2022-02-05'),
('Kiara', 'Nel', '602309', 'SED Henley On Klip Bowling Club', DATE '2026-01-28'),
('Karabo Martin', 'Nong', '602310', 'SED Henley On Klip Bowling Club', DATE '2026-01-28'),
('Andries Johannes', 'Oosthuizen', '69246', 'SED Henley On Klip Bowling Club', DATE '2021-03-15'),
('Cezanne', 'Pretorius', '83200', 'SED Henley On Klip Bowling Club', DATE '2026-05-11'),
('Marie', 'Prinsloo', '83141', 'SED Henley On Klip Bowling Club', DATE '2026-05-01'),
('Marthinus Johannes', 'Prinsloo', '602362', 'SED Henley On Klip Bowling Club', DATE '2026-05-01'),
('Nicholas Marthinus Stephanus', 'Prinsloo', '83140', 'SED Henley On Klip Bowling Club', DATE '2026-05-01'),
('Charlotte', 'Rossouw', '7217', 'SED Henley On Klip Bowling Club', DATE '2009-09-21'),
('Carina', 'van der Walt', '72674', 'SED Henley On Klip Bowling Club', DATE '2022-06-28'),
('Bradley Nicolas', 'Wilkinson', '600597', 'SED Henley On Klip Bowling Club', DATE '2017-03-10'),
('Jessie Dawn', 'Wilkinson', '601080', 'SED Henley On Klip Bowling Club', DATE '2019-04-05'),
('Nathan George', 'Wilkinson', '600840', 'SED Henley On Klip Bowling Club', DATE '2018-04-02'),
('Darryn', 'Young', '69594', 'SED Henley On Klip Bowling Club', DATE '2021-04-29'),
('Linda', 'Becker', '24861', 'SED Iscor Bowling Club', DATE '2009-09-21'),
('Annette', 'Booysen', '74453', 'SED Iscor Bowling Club', DATE '2023-01-20'),
('Kenneth William', 'Cutler', '24873', 'SED Iscor Bowling Club', DATE '2009-09-21'),
('Linda', 'Cutler', '24874', 'SED Iscor Bowling Club', DATE '2009-09-21'),
('Bosman', 'de Koker', '79955', 'SED Iscor Bowling Club', DATE '2025-01-21'),
('Nanna', 'de Koker', '79956', 'SED Iscor Bowling Club', DATE '2025-01-21'),
('Johanna Arnoldina Esme', 'Ferreira', '901314', 'SED Iscor Bowling Club', DATE '2026-03-03'),
('Jacobus Stefanus', 'Gericke', '901311', 'SED Iscor Bowling Club', DATE '2026-03-03'),
('Elsa', 'Gull', '901315', 'SED Iscor Bowling Club', DATE '2026-03-03'),
('Theresa Aletta', 'Jones', '57486', 'SED Iscor Bowling Club', DATE '2016-02-03'),
('Debbie', 'Kleynhans', '901316', 'SED Iscor Bowling Club', DATE '2026-03-03'),
('Pieter Johannes', 'Kleynhans', '82445', 'SED Iscor Bowling Club', DATE '2026-01-22'),
('Jacques', 'Lamont', '901028', 'SED Iscor Bowling Club', DATE '2025-01-11'),
('Annetjie', 'Nel', '24810', 'SED Iscor Bowling Club', DATE '2009-09-21'),
('Jacoba Hendrina', 'Nel', '75384', 'SED Iscor Bowling Club', DATE '2023-05-05'),
('Jan Abraham', 'Nel', '68596', 'SED Iscor Bowling Club', DATE '2020-12-05'),
('Hendrik Johannes', 'Posthumus', '69645', 'SED Iscor Bowling Club', DATE '2021-05-05'),
('Paul', 'Ras', '55973', 'SED Iscor Bowling Club', DATE '2015-07-26'),
('Andre', 'Schmidt', '82446', 'SED Iscor Bowling Club', DATE '2026-01-22'),
('Jacobus Petrus Johannes', 'Schwartz', '71613', 'SED Iscor Bowling Club', DATE '2022-02-08'),
('Masechaba', 'Sekete', '901318', 'SED Iscor Bowling Club', DATE '2026-03-03'),
('Helena', 'Shmidt', '901317', 'SED Iscor Bowling Club', DATE '2026-03-03'),
('Gertruida Johanna', 'Steyn', '73161', 'SED Iscor Bowling Club', DATE '2022-08-29'),
('Jacobus Frederik', 'Steyn', '66697', 'SED Iscor Bowling Club', DATE '2019-09-18'),
('Pieter Ernst Johannes', 'Strydom', '901312', 'SED Iscor Bowling Club', DATE '2026-03-03'),
('Salome Annalie', 'Strydom', '73673', 'SED Iscor Bowling Club', DATE '2022-11-01'),
('Johannes Petrus', 'van den Berg', '82222', 'SED Iscor Bowling Club', DATE '2025-12-29'),
('Paul', 'Van Den Berg', '24629', 'SED Iscor Bowling Club', DATE '2009-09-21'),
('Maria Jacoba', 'Van der Ryst', '57206', 'SED Iscor Bowling Club', DATE '2022-01-26'),
('Gottlieb Christiaan', 'Van Der Walt', '24935', 'SED Iscor Bowling Club', DATE '2009-09-21'),
('Susanna Elizabeth', 'van Rooyen', '901319', 'SED Iscor Bowling Club', DATE '2026-03-03'),
('Antoinette Mari', 'Venter', '81952', 'SED Iscor Bowling Club', DATE '2025-11-10'),
('Jacobus Johannes', 'Venter', '80766', 'SED Iscor Bowling Club', DATE '2025-05-15'),
('Jacobus Johannes', 'Venter', '901313', 'SED Iscor Bowling Club', DATE '2026-03-03'),
('Adam Johannes', 'Viljoen', '62020', 'SED Iscor Bowling Club', DATE '2017-11-01'),
('Elizabeth Johanna', 'Viljoen', '62021', 'SED Iscor Bowling Club', DATE '2017-11-01'),
('Hendrik', 'Wagenaar', '79957', 'SED Iscor Bowling Club', DATE '2025-01-21'),
('Tiesa', 'Wagenaar', '901320', 'SED Iscor Bowling Club', DATE '2026-03-03'),
('Alan', 'Wilson', '46555', 'SED Iscor Bowling Club', DATE '2012-04-25'),
('David John', 'Arnold', '68912', 'SED Meyerton Bowling Club', DATE '2021-01-19'),
('Werner', 'Barnard', '79245', 'SED Meyerton Bowling Club', DATE '2024-10-21'),
('Hendrik', 'Bester', '68174', 'SED Meyerton Bowling Club', DATE '2020-09-16'),
('Heather', 'Cronje', '59527', 'SED Meyerton Bowling Club', DATE '2016-11-23'),
('Rosalina', 'De Bruyn', '79244', 'SED Meyerton Bowling Club', DATE '2024-10-21'),
('Div', 'de Villiers', '60232', 'SED Meyerton Bowling Club', DATE '2017-02-05'),
('Janita', 'de Villiers', '60233', 'SED Meyerton Bowling Club', DATE '2017-02-05'),
('Johanna Francina', 'De Winnaar', '72063', 'SED Meyerton Bowling Club', DATE '2022-03-30'),
('Celeste', 'Dippenaar', '71735', 'SED Meyerton Bowling Club', DATE '2022-02-22'),
('Francois', 'Dippenaar', '71736', 'SED Meyerton Bowling Club', DATE '2022-02-22'),
('Stephanus', 'Ferreira', '71734', 'SED Meyerton Bowling Club', DATE '2022-02-22'),
('Daniel Francois', 'Haasbroek', '41205', 'SED Meyerton Bowling Club', DATE '2010-10-26'),
('Hylettje Maria', 'Haasbroek', '44344', 'SED Meyerton Bowling Club', DATE '2011-09-06'),
('Stephanie', 'Hanekom', '70892', 'SED Meyerton Bowling Club', DATE '2021-11-23'),
('Clifford Peter', 'Hartman', '66917', 'SED Meyerton Bowling Club', DATE '2019-10-23'),
('Margaret Anne', 'Hartman', '80569', 'SED Meyerton Bowling Club', DATE '2025-04-14'),
('Mike', 'Hartman', '79242', 'SED Meyerton Bowling Club', DATE '2024-10-21'),
('Sonja', 'Hartman', '67568', 'SED Meyerton Bowling Club', DATE '2020-01-22'),
('Reuben', 'Herbst', '601720', 'SED Meyerton Bowling Club', DATE '2023-01-19'),
('Albertus', 'Jansen van Rensburg', '75634', 'SED Meyerton Bowling Club', DATE '2023-06-06'),
('Andrea Jeannette', 'Kotze', '71732', 'SED Meyerton Bowling Club', DATE '2022-02-22'),
('Gabriel Jacobus', 'Kriel', '70609', 'SED Meyerton Bowling Club', DATE '2021-10-11'),
('Louise', 'Kriel', '71004', 'SED Meyerton Bowling Club', DATE '2021-12-04'),
('Francois Sarel', 'Kruger', '79239', 'SED Meyerton Bowling Club', DATE '2024-10-21'),
('Elsa', 'Liebenberg', '83520', 'SED Meyerton Bowling Club', DATE '2026-07-03'),
('Esther Maria', 'Lombard', '72062', 'SED Meyerton Bowling Club', DATE '2022-03-30'),
('Wynand Johannes', 'Lombard', '64581', 'SED Meyerton Bowling Club', DATE '2018-10-24'),
('Tommie', 'Louw', '25022', 'SED Meyerton Bowling Club', DATE '2009-09-21'),
('Dina', 'Marais', '25026', 'SED Meyerton Bowling Club', DATE '2009-09-21'),
('Anna Aletta Maria', 'Meyer', '45173', 'SED Meyerton Bowling Club', DATE '2015-07-14'),
('Corneluis Floris Johannes', 'Meyer', '45171', 'SED Meyerton Bowling Club', DATE '2013-01-15'),
('Magdalena', 'Neumann', '31254', 'SED Meyerton Bowling Club', DATE '2016-06-06'),
('Pieter', 'Potgieter', '81424', 'SED Meyerton Bowling Club', DATE '2025-08-22'),
('Rentia', 'Potgieter', '81426', 'SED Meyerton Bowling Club', DATE '2025-08-22'),
('Marthinus Petrus Jacobus', 'Rademan', '1369', 'SED Meyerton Bowling Club', DATE '2009-09-21'),
('Avis', 'Rogers', '50140', 'SED Meyerton Bowling Club', DATE '2013-09-03'),
('Marius', 'Serfontein', '52915', 'SED Meyerton Bowling Club', DATE '2014-08-11'),
('Zelda', 'Smit', '80849', 'SED Meyerton Bowling Club', DATE '2025-05-26'),
('Leonnardus Gerhardus', 'Smith', '75510', 'SED Meyerton Bowling Club', DATE '2023-05-23'),
('Esias Engelbertus', 'Smuts', '66918', 'SED Meyerton Bowling Club', DATE '2019-10-23'),
('Gerda', 'Smuts', '67101', 'SED Meyerton Bowling Club', DATE '2019-11-19'),
('Eleanor', 'Thomas', '70642', 'SED Meyerton Bowling Club', DATE '2021-10-13'),
('Gene', 'Thomas', '25052', 'SED Meyerton Bowling Club', DATE '2009-09-21'),
('Lea', 'Thomas', '25051', 'SED Meyerton Bowling Club', DATE '2009-09-21'),
('Anita', 'Van der Berg', '70239', 'SED Meyerton Bowling Club', DATE '2021-08-19'),
('Wynand PL', 'van der Berg', '67569', 'SED Meyerton Bowling Club', DATE '2020-01-22'),
('Benjamin', 'Van Der Linde', '45550', 'SED Meyerton Bowling Club', DATE '2012-01-09'),
('Louis', 'Van Niekerk', '82542', 'SED Meyerton Bowling Club', DATE '2026-02-03'),
('Susan', 'Van Niekerk', '82543', 'SED Meyerton Bowling Club', DATE '2026-02-03'),
('Bridget Bronwenn', 'van Rooyen', '74839', 'SED Meyerton Bowling Club', DATE '2023-03-02'),
('Nicoleen', 'Van Rooyen', '81875', 'SED Meyerton Bowling Club', DATE '2025-10-30'),
('Tonie', 'Van Tonder', '81874', 'SED Meyerton Bowling Club', DATE '2025-10-30'),
('Anton Theunis', 'Van Wyk', '83519', 'SED Meyerton Bowling Club', DATE '2026-07-03'),
('Daleen', 'Walters', '70852', 'SED Meyerton Bowling Club', DATE '2021-11-16'),
('Paul', 'Balderstone', '60511', 'SED Riverside Bowling Club', DATE '2017-03-15'),
('Marius', 'Barkhuizen', '81978', 'SED Riverside Bowling Club', DATE '2025-11-17'),
('Sonja', 'Barkhuizen', '78899', 'SED Riverside Bowling Club', DATE '2024-08-26'),
('Veronica Christine', 'Barnard', '81530', 'SED Riverside Bowling Club', DATE '2025-09-13'),
('James', 'Beaton', '41351', 'SED Riverside Bowling Club', DATE '2010-11-04'),
('Nicholas John', 'Bekker', '70725', 'SED Riverside Bowling Club', DATE '2021-10-24'),
('Martin', 'Bierman', '78090', 'SED Riverside Bowling Club', DATE '2024-04-22'),
('Johannes', 'Booysen', '34203', 'SED Riverside Bowling Club', DATE '2009-09-21'),
('Andre', 'Botha', '80231', 'SED Riverside Bowling Club', DATE '2025-02-24'),
('Daniel Jacobus', 'Botha', '70538', 'SED Riverside Bowling Club', DATE '2021-10-02'),
('Billy', 'Brennan', '25082', 'SED Riverside Bowling Club', DATE '2009-09-21'),
('Jako', 'Bronkhorst', '78043', 'SED Riverside Bowling Club', DATE '2024-04-17'),
('Heila Maria', 'Bruwer', '82462', 'SED Riverside Bowling Club', DATE '2026-01-23'),
('Stephanus Jacobus', 'Bruwer', '81863', 'SED Riverside Bowling Club', DATE '2025-10-28'),
('Stephanus Jacobus', 'Bruwer', '82953', 'SED Riverside Bowling Club', DATE '2026-04-01'),
('Jan-Albert', 'Coetzer', '74805', 'SED Riverside Bowling Club', DATE '2023-02-25'),
('Tania', 'Coetzer', '76167', 'SED Riverside Bowling Club', DATE '2023-08-28'),
('Estelle', 'Cronje', '82778', 'SED Riverside Bowling Club', DATE '2026-03-05'),
('Sean', 'Cunningham', '82510', 'SED Riverside Bowling Club', DATE '2026-01-30'),
('Emmarenthia', 'De Klerk', '56262', 'SED Riverside Bowling Club', DATE '2015-09-09'),
('Johannes', 'De Lange', '49283', 'SED Riverside Bowling Club', DATE '2013-03-29'),
('Melita', 'De Lange', '49263', 'SED Riverside Bowling Club', DATE '2013-03-26'),
('Harold', 'Dickerson', '65789', 'SED Riverside Bowling Club', DATE '2019-04-04'),
('Barton', 'Faber', '38334', 'SED Riverside Bowling Club', DATE '2009-11-27'),
('Christiaan Frederick', 'Ferreira', '74770', 'SED Riverside Bowling Club', DATE '2023-02-22'),
('Thomas Emmanuel', 'Ferreira', '74771', 'SED Riverside Bowling Club', DATE '2023-02-22'),
('Sophia Cecilia', 'Fouche', '75529', 'SED Riverside Bowling Club', DATE '2023-05-24'),
('Jestus', 'Fouche`', '75528', 'SED Riverside Bowling Club', DATE '2023-05-24'),
('Johan George', 'Geldenhuys', '68376', 'SED Riverside Bowling Club', DATE '2020-10-28'),
('William Shehan', 'Grant', '70535', 'SED Riverside Bowling Club', DATE '2021-10-01'),
('Eben', 'Groenewald', '34200', 'SED Riverside Bowling Club', DATE '2009-09-21'),
('Rochelle', 'Groenewald', '79516', 'SED Riverside Bowling Club', DATE '2024-11-27'),
('Geof', 'Harrison', '65996', 'SED Riverside Bowling Club', DATE '2019-05-12'),
('Zoltan Tibor', 'Hartmann', '78039', 'SED Riverside Bowling Club', DATE '2024-04-17'),
('Bennie', 'Herbst', '42664', 'SED Riverside Bowling Club', DATE '2011-01-31'),
('Lydia', 'Kemp', '50134', 'SED Riverside Bowling Club', DATE '2013-09-03'),
('Freddy', 'Koller', '70935', 'SED Riverside Bowling Club', DATE '2021-11-30'),
('Danie', 'Korkie', '25100', 'SED Riverside Bowling Club', DATE '2009-09-21'),
('Clara Isabella', 'Kriel', '76248', 'SED Riverside Bowling Club', DATE '2023-09-08'),
('Herman Willem', 'Kriel', '67114', 'SED Riverside Bowling Club', DATE '2019-11-20'),
('Nicolaas Mattheus', 'Liebetrau', '78905', 'SED Riverside Bowling Club', DATE '2024-08-26'),
('Anneke', 'Lingenfelder', '77534', 'SED Riverside Bowling Club', DATE '2024-02-16'),
('Victor Lodewyk', 'Lingenfelder', '77616', 'SED Riverside Bowling Club', DATE '2024-02-24'),
('Denise Joy', 'Marriott', '65625', 'SED Riverside Bowling Club', DATE '2019-03-12'),
('Gary', 'Marriott', '60349', 'SED Riverside Bowling Club', DATE '2017-02-21'),
('Mark', 'Mc Intyre', '76967', 'SED Riverside Bowling Club', DATE '2023-12-19'),
('Bennie D', 'Muller', '74806', 'SED Riverside Bowling Club', DATE '2023-02-25'),
('Evert', 'Muller', '80550', 'SED Riverside Bowling Club', DATE '2025-04-12'),
('Jacobus Daniel', 'Muller', '80232', 'SED Riverside Bowling Club', DATE '2025-02-24'),
('Johannes Theunis', 'Muller', '58212', 'SED Riverside Bowling Club', DATE '2016-05-09'),
('Barend Johannes Daniel', 'Nel', '74808', 'SED Riverside Bowling Club', DATE '2023-02-25'),
('Eamon Chris', 'Nel', '78902', 'SED Riverside Bowling Club', DATE '2024-08-26'),
('Helena Elizabeth Cathrina', 'Nel', '74807', 'SED Riverside Bowling Club', DATE '2023-02-25'),
('Terry', 'Newton', '56443', 'SED Riverside Bowling Club', DATE '2015-10-04'),
('Daniel Rudolph', 'Opperman', '69108', 'SED Riverside Bowling Club', DATE '2021-02-23'),
('Linda', 'Opperman', '70610', 'SED Riverside Bowling Club', DATE '2021-10-11'),
('Andre Trevor', 'Pieterse', '78091', 'SED Riverside Bowling Club', DATE '2024-04-22'),
('Rolf Mathias', 'Ramakers', '80549', 'SED Riverside Bowling Club', DATE '2025-04-12'),
('Hugh', 'Ramsden', '75675', 'SED Riverside Bowling Club', DATE '2023-06-12'),
('Nel', 'Roodt', '80233', 'SED Riverside Bowling Club', DATE '2025-02-24'),
('Alfred Edward', 'Ross', '80733', 'SED Riverside Bowling Club', DATE '2025-05-12'),
('Dorothea Maria', 'Ross', '81549', 'SED Riverside Bowling Club', DATE '2025-09-16'),
('Craig G', 'Sales', '80780', 'SED Riverside Bowling Club', DATE '2025-05-16'),
('Rosari', 'Sales', '82715', 'SED Riverside Bowling Club', DATE '2026-02-25'),
('George Charles', 'Schwartzel', '70533', 'SED Riverside Bowling Club', DATE '2021-10-01'),
('Lizette', 'Schwartzel', '70534', 'SED Riverside Bowling Club', DATE '2021-10-01'),
('Jürgen', 'Stalmann', '69619', 'SED Riverside Bowling Club', DATE '2021-05-03'),
('Mike', 'Stirling', '25127', 'SED Riverside Bowling Club', DATE '2009-09-21'),
('Michelle', 'Suskopf', '83102', 'SED Riverside Bowling Club', DATE '2026-04-23'),
('Philip Lodewicus', 'Thompson', '49570', 'SED Riverside Bowling Club', DATE '2013-05-13'),
('Thomas Ignatius', 'van der Merwe', '82653', 'SED Riverside Bowling Club', DATE '2026-02-18'),
('Martin', 'Van Der Walt', '60348', 'SED Riverside Bowling Club', DATE '2017-02-21'),
('Andries', 'Van Heerden', '81949', 'SED Riverside Bowling Club', DATE '2025-11-10'),
('Ilze', 'van Heerden', '82565', 'SED Riverside Bowling Club', DATE '2026-02-05'),
('Philippus L', 'van Zyl', '78881', 'SED Riverside Bowling Club', DATE '2024-08-22'),
('Anette', 'Venter', '71287', 'SED Riverside Bowling Club', DATE '2022-01-07'),
('Sarel Jacques', 'Venter', '74041', 'SED Riverside Bowling Club', DATE '2022-12-12'),
('Andre', 'Voges', '80806', 'SED Riverside Bowling Club', DATE '2025-05-20'),
('Tinus', 'Voges', '70724', 'SED Riverside Bowling Club', DATE '2021-10-24'),
('Jan', 'Vorster', '67116', 'SED Riverside Bowling Club', DATE '2019-11-20'),
('Frederik Jacobus', 'Wepener', '80280', 'SED Riverside Bowling Club', DATE '2025-03-03'),
('Bryan', 'Whittal', '61067', 'SED Riverside Bowling Club', DATE '2017-06-12'),
('Gareth', 'Whittal', '600715', 'SED Riverside Bowling Club', DATE '2017-10-25'),
('Gary', 'Whittal', '61066', 'SED Riverside Bowling Club', DATE '2017-06-12'),
('Barend Jacobus', 'Wiegand', '44351', 'SED Riverside Bowling Club', DATE '2011-09-07'),
('Harry', 'Wilson', '64539', 'SED Riverside Bowling Club', DATE '2018-10-17'),
('Graeme', 'Allison', '82224', 'SED Sasolburg Bowling Club', DATE '2025-12-29'),
('Alexander', 'Badenhorst', '601021', 'SED Sasolburg Bowling Club', DATE '2019-02-01'),
('Elsie Maria', 'Badenhorst', '65255', 'SED Sasolburg Bowling Club', DATE '2019-01-16'),
('Lewies Michael', 'Badenhorst', '601541', 'SED Sasolburg Bowling Club', DATE '2021-12-13'),
('Louis Andries', 'Badenhorst', '67387', 'SED Sasolburg Bowling Club', DATE '2020-01-06'),
('Lourens Petrus', 'Badenhorst', '65398', 'SED Sasolburg Bowling Club', DATE '2019-02-04'),
('Anna Catharina', 'Bester', '68718', 'SED Sasolburg Bowling Club', DATE '2020-12-24'),
('Dirk Jacobus', 'Bester', '82654', 'SED Sasolburg Bowling Club', DATE '2026-02-18'),
('Lizette', 'Bester', '72309', 'SED Sasolburg Bowling Club', DATE '2022-05-03'),
('Michiel Daniel', 'Bester', '72058', 'SED Sasolburg Bowling Club', DATE '2022-03-29'),
('Dirk', 'Beukes', '82557', 'SED Sasolburg Bowling Club', DATE '2026-02-04'),
('Elaine', 'Buchanan', '77104', 'SED Sasolburg Bowling Club', DATE '2024-01-08'),
('Harry John', 'Buchanan', '67391', 'SED Sasolburg Bowling Club', DATE '2020-01-06'),
('Rassie', 'Claassen', '77096', 'SED Sasolburg Bowling Club', DATE '2024-01-08'),
('Henry', 'Colin', '81867', 'SED Sasolburg Bowling Club', DATE '2025-10-29'),
('Deon', 'Conradie', '76432', 'SED Sasolburg Bowling Club', DATE '2023-10-11'),
('Philippus Jacobus', 'De Kock', '78430', 'SED Sasolburg Bowling Club', DATE '2024-06-08'),
('Piet', 'de Kock', '82220', 'SED Sasolburg Bowling Club', DATE '2025-12-29'),
('Antonetta Gertruida', 'de Wet', '82558', 'SED Sasolburg Bowling Club', DATE '2026-02-04'),
('Nicholaas Elias', 'Delport', '72874', 'SED Sasolburg Bowling Club', DATE '2022-07-26'),
('Annatjie', 'Du Plessis', '76208', 'SED Sasolburg Bowling Club', DATE '2023-09-04'),
('Pieter', 'du Plessis', '82221', 'SED Sasolburg Bowling Club', DATE '2025-12-29'),
('Ronel', 'du Plooy', '65931', 'SED Sasolburg Bowling Club', DATE '2019-05-03'),
('Willie', 'du Plooy', '79751', 'SED Sasolburg Bowling Club', DATE '2025-01-03'),
('Cleaton', 'Duguid', '74393', 'SED Sasolburg Bowling Club', DATE '2023-01-15'),
('Jaques', 'Fourie', '65259', 'SED Sasolburg Bowling Club', DATE '2019-01-16'),
('Lizelle', 'Fourie', '65256', 'SED Sasolburg Bowling Club', DATE '2019-01-16'),
('Sonya', 'Fourie', '601456', 'SED Sasolburg Bowling Club', DATE '2021-03-23'),
('Tanya', 'Fourie', '601457', 'SED Sasolburg Bowling Club', DATE '2021-03-23'),
('Elizabeth', 'Greeff', '46223', 'SED Sasolburg Bowling Club', DATE '2012-03-06'),
('Jenny', 'Green', '83485', 'SED Sasolburg Bowling Club', DATE '2026-06-25'),
('Apie', 'Greyling', '78969', 'SED Sasolburg Bowling Club', DATE '2024-09-04'),
('Ana Maria', 'Hill', '59886', 'SED Sasolburg Bowling Club', DATE '2017-01-10'),
('Paul Leslie', 'Hill', '33346', 'SED Sasolburg Bowling Club', DATE '2009-09-21'),
('Charmaine', 'Janse van Rensburg', '82941', 'SED Sasolburg Bowling Club', DATE '2026-03-31'),
('Elsabe', 'Janse van Rensburg', '25682', 'SED Sasolburg Bowling Club', DATE '2021-12-12'),
('Jacobus', 'Janse van Rensburg', '25681', 'SED Sasolburg Bowling Club', DATE '2009-09-21'),
('Francois', 'Louw', '79750', 'SED Sasolburg Bowling Club', DATE '2025-01-03'),
('Marlene', 'Louw', '79749', 'SED Sasolburg Bowling Club', DATE '2025-01-03'),
('Roelof', 'Louw', '77097', 'SED Sasolburg Bowling Club', DATE '2024-01-08'),
('Katie', 'Marx', '20245', 'SED Sasolburg Bowling Club', DATE '2009-09-21'),
('Dirk Frederik', 'Meyer', '67390', 'SED Sasolburg Bowling Club', DATE '2020-01-06'),
('Valerie', 'Nel', '73963', 'SED Sasolburg Bowling Club', DATE '2022-12-05'),
('Frederik Johannes', 'Oosthuizen', '69847', 'SED Sasolburg Bowling Club', DATE '2021-06-03'),
('Rina', 'Payne', '67392', 'SED Sasolburg Bowling Club', DATE '2020-01-06'),
('Jose', 'Ribeiro', '65260', 'SED Sasolburg Bowling Club', DATE '2019-01-16'),
('Manuel De Freitas', 'Ribeiro', '65262', 'SED Sasolburg Bowling Club', DATE '2019-01-16'),
('Serita', 'Ribeiro', '65257', 'SED Sasolburg Bowling Club', DATE '2019-01-16'),
('Veronique', 'Ribeiro', '601814', 'SED Sasolburg Bowling Club', DATE '2023-08-02'),
('Alwyn', 'Roux', '65049', 'SED Sasolburg Bowling Club', DATE '2019-01-02'),
('Martinus Johannes', 'Schoeman', '71078', 'SED Sasolburg Bowling Club', DATE '2021-12-12'),
('Alexander Isaac', 'Slater', '69576', 'SED Sasolburg Bowling Club', DATE '2021-04-28'),
('Gerda', 'Smit', '83151', 'SED Sasolburg Bowling Club', DATE '2026-05-04'),
('Janet', 'Smit', '73933', 'SED Sasolburg Bowling Club', DATE '2022-12-01'),
('Johannes Bernadus', 'Steenberg', '602120', 'SED Sasolburg Bowling Club', DATE '2024-12-17'),
('Nathan', 'Steenberg', '602119', 'SED Sasolburg Bowling Club', DATE '2024-12-17'),
('Barend Sebastiaan', 'Steyn', '81450', 'SED Sasolburg Bowling Club', DATE '2025-08-27'),
('Erica', 'Steyn', '901004', 'SED Sasolburg Bowling Club', DATE '2025-12-01'),
('Simoné Sebastiaan', 'Steyn', '601775', 'SED Sasolburg Bowling Club', DATE '2023-05-15'),
('Sus', 'Stoltz', '77098', 'SED Sasolburg Bowling Club', DATE '2024-01-08'),
('Lawrence', 'Thysse', '65048', 'SED Sasolburg Bowling Club', DATE '2019-01-02'),
('Petronella', 'van der Merwe', '80864', 'SED Sasolburg Bowling Club', DATE '2025-05-28'),
('Danica', 'van Hulst', '601867', 'SED Sasolburg Bowling Club', DATE '2023-12-08'),
('Jacobus Petrus', 'van Jaarsveld', '59777', 'SED Sasolburg Bowling Club', DATE '2016-12-29'),
('Franz-Petrus', 'van Kradenburg', '620013', 'SED Sasolburg Bowling Club', DATE '2024-02-01'),
('Jan', 'Viljoen', '901031', 'SED Sasolburg Bowling Club', DATE '2025-12-01'),
('Johannes van Eck', 'Viljoen', '59842', 'SED Sasolburg Bowling Club', DATE '2017-01-06'),
('Leonie', 'Viljoen', '61103', 'SED Sasolburg Bowling Club', DATE '2017-06-19'),
('Petrus Christoffel', 'Viljoen', '66027', 'SED Sasolburg Bowling Club', DATE '2022-11-23'),
('Lizet', 'Visagie', '83345', 'SED Sasolburg Bowling Club', DATE '2026-06-02'),
('Sol', 'Visagie', '82223', 'SED Sasolburg Bowling Club', DATE '2025-12-29'),
('Catharina P', 'Vos', '72403', 'SED Sasolburg Bowling Club', DATE '2022-05-14'),
('Donald Gordon', 'Watt-Pringle', '48606', 'SED Sasolburg Bowling Club', DATE '2013-01-15'),
('Willie', 'White', '50491', 'SED Sasolburg Bowling Club', DATE '2013-10-19'),
('Amber', 'Alexanders', '601449', 'SED Vanderbijlpark Town Bowling Club', DATE '2021-03-06'),
('Elizabeth', 'Alexanders', '63000', 'SED Vanderbijlpark Town Bowling Club', DATE '2018-03-04'),
('Hendrik Christiaan', 'Bester', '73113', 'SED Vanderbijlpark Town Bowling Club', DATE '2022-08-21'),
('Hendrik Jacobus', 'Bierman', '43254', 'SED Vanderbijlpark Town Bowling Club', DATE '2011-03-23'),
('Jacob Johannes', 'Breedt', '71021', 'SED Vanderbijlpark Town Bowling Club', DATE '2021-12-07'),
('Antoinette', 'Broodryk', '80067', 'SED Vanderbijlpark Town Bowling Club', DATE '2025-02-01'),
('Leilah Peach', 'Cadwell', '602287', 'SED Vanderbijlpark Town Bowling Club', DATE '2025-12-08'),
('Olivia', 'Cadwell', '78737', 'SED Vanderbijlpark Town Bowling Club', DATE '2024-07-29'),
('Tarryn', 'Cadwell', '69138', 'SED Vanderbijlpark Town Bowling Club', DATE '2021-03-01'),
('Terence', 'Cadwell', '25183', 'SED Vanderbijlpark Town Bowling Club', DATE '2009-09-21'),
('Susanna Jacoba', 'Cranswick', '83423', 'SED Vanderbijlpark Town Bowling Club', DATE '2026-06-15'),
('Norman', 'De Goede', '24875', 'SED Vanderbijlpark Town Bowling Club', DATE '2009-09-21'),
('Basil Aubrey', 'de Klerk', '38224', 'SED Vanderbijlpark Town Bowling Club', DATE '2009-11-23'),
('Elize', 'de Klerk', '16429', 'SED Vanderbijlpark Town Bowling Club', DATE '2009-09-21'),
('Elizabeth Agatha', 'de Lange', '78976', 'SED Vanderbijlpark Town Bowling Club', DATE '2024-09-05'),
('Johann', 'Delport', '600939', 'SED Vanderbijlpark Town Bowling Club', DATE '2018-09-19'),
('Louis', 'Grove', '83269', 'SED Vanderbijlpark Town Bowling Club', DATE '2026-05-23'),
('Andries Adam', 'Grundlingh', '77332', 'SED Vanderbijlpark Town Bowling Club', DATE '2024-01-26'),
('Joshua', 'Haarhoff', '43893', 'SED Vanderbijlpark Town Bowling Club', DATE '2011-06-24'),
('Anna Johanna', 'Hattingh', '24889', 'SED Vanderbijlpark Town Bowling Club', DATE '2009-09-21'),
('Abraham Carel', 'Kock', '60271', 'SED Vanderbijlpark Town Bowling Club', DATE '2017-02-10'),
('James Thomas', 'Kock', '74823', 'SED Vanderbijlpark Town Bowling Club', DATE '2023-03-01'),
('Louise', 'Kock', '78736', 'SED Vanderbijlpark Town Bowling Club', DATE '2024-07-29'),
('Morne', 'Kretschmer', '34710', 'SED Vanderbijlpark Town Bowling Club', DATE '2009-09-21'),
('Engela', 'Kruger', '67081', 'SED Vanderbijlpark Town Bowling Club', DATE '2019-11-18'),
('Theuns Jacobus', 'Kruger', '601447', 'SED Vanderbijlpark Town Bowling Club', DATE '2021-03-06'),
('Tinus', 'Kruger', '67703', 'SED Vanderbijlpark Town Bowling Club', DATE '2020-02-11'),
('Chris', 'Kruyshaar', '25206', 'SED Vanderbijlpark Town Bowling Club', DATE '2009-09-21'),
('Kevin', 'Lawson', '75160', 'SED Vanderbijlpark Town Bowling Club', DATE '2023-04-08'),
('Pierre', 'Lombard', '61640', 'SED Vanderbijlpark Town Bowling Club', DATE '2017-09-19'),
('Annika Marinda', 'Loots', '79954', 'SED Vanderbijlpark Town Bowling Club', DATE '2025-01-21'),
('Jacobus Adriaan', 'Loots', '79953', 'SED Vanderbijlpark Town Bowling Club', DATE '2025-01-21'),
('George Farmer', 'Lotter', '31061', 'SED Vanderbijlpark Town Bowling Club', DATE '2009-09-21'),
('Ingrid', 'Mans', '83424', 'SED Vanderbijlpark Town Bowling Club', DATE '2026-06-15'),
('Stan', 'Marshall', '23236', 'SED Vanderbijlpark Town Bowling Club', DATE '2009-09-21'),
('Megan Joy', 'Olivier', '602326', 'SED Vanderbijlpark Town Bowling Club', DATE '2026-03-01'),
('Louis Johannes', 'Pienaar', '77387', 'SED Vanderbijlpark Town Bowling Club', DATE '2024-02-02'),
('Stephen John', 'Ramage', '69241', 'SED Vanderbijlpark Town Bowling Club', DATE '2021-03-14'),
('Lucy', 'Randall', '81473', 'SED Vanderbijlpark Town Bowling Club', DATE '2025-09-03'),
('Sharolyn Ruth', 'Redfern', '49535', 'SED Vanderbijlpark Town Bowling Club', DATE '2013-05-06'),
('Eldred Llewellyn', 'Rudman', '49396', 'SED Vanderbijlpark Town Bowling Club', DATE '2013-04-16'),
('Jan Christoff', 'Scholtz', '602113', 'SED Vanderbijlpark Town Bowling Club', DATE '2024-11-29'),
('Abraham Willem', 'Schutte', '18807', 'SED Vanderbijlpark Town Bowling Club', DATE '2009-09-21'),
('Flip', 'Schutte', '59841', 'SED Vanderbijlpark Town Bowling Club', DATE '2017-01-06'),
('James McKay', 'Stewart', '25178', 'SED Vanderbijlpark Town Bowling Club', DATE '2009-09-21'),
('Anette Elmarie', 'Steyn', '66699', 'SED Vanderbijlpark Town Bowling Club', DATE '2019-09-18'),
('Barend', 'Steyn', '601425', 'SED Vanderbijlpark Town Bowling Club', DATE '2020-12-29'),
('Barend', 'Steyn', '66601', 'SED Vanderbijlpark Town Bowling Club', DATE '2019-09-05'),
('Lize-Marie', 'Steyn', '601481', 'SED Vanderbijlpark Town Bowling Club', DATE '2021-05-05'),
('Victor', 'Strydom', '75161', 'SED Vanderbijlpark Town Bowling Club', DATE '2023-04-08'),
('Marinda', 'Troskie', '16427', 'SED Vanderbijlpark Town Bowling Club', DATE '2009-09-21'),
('Elmar', 'van den Broek', '81269', 'SED Vanderbijlpark Town Bowling Club', DATE '2025-08-01'),
('Johan', 'van Helsdingen', '61641', 'SED Vanderbijlpark Town Bowling Club', DATE '2017-09-19'),
('Albert', 'Van Wyk', '64906', 'SED Vanderbijlpark Town Bowling Club', DATE '2018-12-10'),
('Jeanre', 'van Wyk', '601020', 'SED Vanderbijlpark Town Bowling Club', DATE '2019-02-01'),
('Kaelin', 'Van Wyk', '601664', 'SED Vanderbijlpark Town Bowling Club', DATE '2022-08-30'),
('Pieter J', 'van Zyl', '81901', 'SED Vanderbijlpark Town Bowling Club', DATE '2025-11-02'),
('Anne-Marie', 'Victor', '63110', 'SED Vanderbijlpark Town Bowling Club', DATE '2018-03-19'),
('Gabriel', 'Wolvaard', '64799', 'SED Vanderbijlpark Town Bowling Club', DATE '2018-11-28'),
('Laetitia', 'Wolvaard', '64800', 'SED Vanderbijlpark Town Bowling Club', DATE '2018-11-28');

-- ============================================================
-- CREATE CLUBS
-- ============================================================
DO $$
DECLARE
    r RECORD;
    v_short_name TEXT;
BEGIN
    FOR r IN
        SELECT DISTINCT TRIM(club_name) AS club_name
        FROM tmp_bowlpoint_members
        WHERE NULLIF(TRIM(club_name), '') IS NOT NULL
    LOOP
        -- Use known abbreviations only where the source name makes them clear.
        v_short_name := CASE
            WHEN UPPER(TRIM(r.club_name)) LIKE '%DENEYSVILLE%' THEN 'DBC'
            WHEN UPPER(TRIM(r.club_name)) LIKE '%HENLEY-ON-KLIP%' THEN 'HOK'
            WHEN UPPER(TRIM(r.club_name)) LIKE '%HENLEY ON KLIP%' THEN 'HOK'
            WHEN UPPER(TRIM(r.club_name)) LIKE '%ISCOR%' THEN 'IBC'
            WHEN UPPER(TRIM(r.club_name)) LIKE '%MEYERTON%' THEN 'MBC'
            WHEN UPPER(TRIM(r.club_name)) LIKE '%RIVERSIDE%' THEN 'RBC'
            WHEN UPPER(TRIM(r.club_name)) LIKE '%SASOLBURG%' THEN 'SBC'
            WHEN UPPER(TRIM(r.club_name)) LIKE '%VANDERBIJLPARK%' THEN 'VDB'
            ELSE NULL
        END;

        INSERT INTO clubs (name, short_name, active)
        VALUES (r.club_name, v_short_name, TRUE)
        ON CONFLICT (name) DO UPDATE
        SET short_name = COALESCE(clubs.short_name, EXCLUDED.short_name),
            active = TRUE,
            updated_at = NOW();
    END LOOP;
END $$;

-- ============================================================
-- IMPORT / UPDATE PLAYERS
-- Existing players are matched by BSA number where available.
-- No phone/mobile field is referenced.
-- ============================================================
DO $$
DECLARE
    r RECORD;
    v_club_id UUID;
    v_player_id UUID;
BEGIN
    FOR r IN SELECT * FROM tmp_bowlpoint_members LOOP
        -- Find the club using its exact source name.
        SELECT id INTO v_club_id
        FROM clubs
        WHERE LOWER(TRIM(name)) = LOWER(TRIM(r.club_name))
        LIMIT 1;

        IF v_club_id IS NULL THEN
            RAISE EXCEPTION 'Club not found for member: % / %', r.given_names, r.surname;
        END IF;

        v_player_id := NULL;

        -- BSA number is the preferred stable identifier.
        IF NULLIF(TRIM(r.bsa_number), '') IS NOT NULL THEN
            SELECT id INTO v_player_id
            FROM players
            WHERE TRIM(bsa_number) = TRIM(r.bsa_number)
            ORDER BY created_at
            LIMIT 1;
        END IF;

        IF v_player_id IS NOT NULL THEN
            UPDATE players
            SET first_name = r.given_names,
                last_name = r.surname,
                display_name = TRIM(COALESCE(r.given_names, '') || ' ' || COALESCE(r.surname, '')),
                club_id = v_club_id,
                date_registered = r.registration_date,
                bsa_number = NULLIF(TRIM(r.bsa_number), ''),
                active = TRUE,
                updated_at = NOW()
            WHERE id = v_player_id;
        ELSE
            INSERT INTO players
                (first_name, last_name, display_name, club_id, date_registered, bsa_number, active)
            VALUES
                (r.given_names,
                 r.surname,
                 TRIM(COALESCE(r.given_names, '') || ' ' || COALESCE(r.surname, '')),
                 v_club_id,
                 r.registration_date,
                 NULLIF(TRIM(r.bsa_number), ''),
                 TRUE);
        END IF;
    END LOOP;
END $$;

DROP TABLE IF EXISTS tmp_bowlpoint_members;
COMMIT;

-- ============================================================
-- VERIFICATION
-- ============================================================
SELECT COUNT(*) AS total_clubs FROM clubs;
SELECT COUNT(*) AS total_players FROM players;
SELECT COUNT(*) AS players_with_bsa_number
FROM players
WHERE NULLIF(TRIM(bsa_number), '') IS NOT NULL;
SELECT COUNT(*) AS active_players
FROM players
WHERE active = TRUE;

-- Duplicate BSA numbers (should ideally return zero rows).
SELECT bsa_number, COUNT(*) AS duplicate_count
FROM players
WHERE NULLIF(TRIM(bsa_number), '') IS NOT NULL
GROUP BY bsa_number
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, bsa_number;

-- Members whose club_id is missing after import (should return zero rows).
SELECT COUNT(*) AS players_without_club
FROM players
WHERE active = TRUE AND club_id IS NULL;