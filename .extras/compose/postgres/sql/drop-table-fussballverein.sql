-- Copyright (C) 2025 - present Dein Name
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
-- GNU General Public License for more details.
--
-- You should have received a copy of the GNU General Public License
-- along with this program.  If not, see <https://www.gnu.org/licenses/>.

-- Aufruf:
-- docker compose exec db bash
-- psql --dbname=fussballverein --username=fussballverein --file=/sql/drop-table-fussballverein.sql

SET search_path TO 'fussballverein';

-- https://www.postgresql.org/docs/current/sql-droptable.html

DROP TABLE IF EXISTS spieler CASCADE;
DROP TABLE IF EXISTS stadion CASCADE;
DROP TABLE IF EXISTS fussballverein CASCADE;
