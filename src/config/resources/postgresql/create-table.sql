-- Copyright (C) 2025 - present [Dein Name]
-- Hochschule Karlsruhe / Projekt Fussballverein
--
-- Dieses Programm ist freie Software: Sie können es unter den Bedingungen
-- der GNU General Public License, Version 3 oder höher, weitergeben und/oder ändern.
-- Weitere Informationen: https://www.gnu.org/licenses/

-- ================================================================
-- Aufruf:
-- docker compose exec db bash
-- psql --dbname=fussballverein --username=fussballverein --file=/sql/create-table.sql
-- ================================================================

-- ================================================================
-- Tablespace
-- ================================================================
SET default_tablespace = fussballvereinspace;

-- ================================================================
-- Schema anlegen und Suchpfad setzen
-- ================================================================
CREATE SCHEMA IF NOT EXISTS AUTHORIZATION fussballverein;

ALTER ROLE fussballverein SET search_path = 'fussballverein';
SET search_path TO 'fussballverein';

-- ================================================================
-- Tabelle: fussballverein (Haupttabelle)
-- ================================================================
CREATE TABLE IF NOT EXISTS fussballverein (
    id               integer GENERATED ALWAYS AS IDENTITY(START WITH 1000) PRIMARY KEY,
    name             text NOT NULL,
    gruendungsdatum  date,
    website          text,
    email            text,
    telefonnummer    text,
    mitgliederanzahl integer,
    version          integer NOT NULL DEFAULT 0,
    erzeugt          timestamp NOT NULL DEFAULT NOW(),
    aktualisiert     timestamp NOT NULL DEFAULT NOW()
);

-- ================================================================
-- Tabelle: stadion (1:1 Beziehung zu fussballverein)
-- ================================================================
CREATE TABLE IF NOT EXISTS stadion (
    id                integer GENERATED ALWAYS AS IDENTITY(START WITH 1000) PRIMARY KEY,
    stadt             text NOT NULL,
    strasse           text,
    hausnummer        text,
    kapazitaet        integer NOT NULL,
    fussballverein_id integer NOT NULL UNIQUE
        REFERENCES fussballverein ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS stadion_fussballverein_id_idx
    ON stadion(fussballverein_id);

-- ================================================================
-- Tabelle: spieler (1:n Beziehung zu fussballverein)
-- ================================================================
CREATE TABLE IF NOT EXISTS spieler (
    id                integer GENERATED ALWAYS AS IDENTITY(START WITH 1000) PRIMARY KEY,
    vorname           text NOT NULL,
    nachname          text NOT NULL,
    alter             integer,
    starker_fuss      text,
    fussballverein_id integer NOT NULL
        REFERENCES fussballverein ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS spieler_fussballverein_id_idx
    ON spieler(fussballverein_id);

-- ================================================================
-- Tabelle: logo_file (1:1 Beziehung zu fussballverein)
-- ================================================================
CREATE TABLE IF NOT EXISTS logo_file (
    id                 integer GENERATED ALWAYS AS IDENTITY(START WITH 1000) PRIMARY KEY,
    data               bytea NOT NULL,
    filename           text NOT NULL,
    mimetype           text,
    fussballverein_id  integer NOT NULL UNIQUE
        REFERENCES fussballverein ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS logo_file_fussballverein_id_idx
    ON logo_file(fussballverein_id);
