SET default_tablespace = fussballvereinspace;

-- Schema
CREATE SCHEMA IF NOT EXISTS AUTHORIZATION fussballverein;

ALTER ROLE fussballverein SET search_path = 'fussballverein';
SET search_path TO 'fussballverein';

-- Fussballverein
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

-- Stadion (1:1 zu Fussballverein)
CREATE TABLE IF NOT EXISTS stadion (
    id                integer GENERATED ALWAYS AS IDENTITY(START WITH 1000) PRIMARY KEY,
    stadt             text NOT NULL,
    strasse           text,
    hausnummer        text,
    kapazitaet        integer NOT NULL,
    fussballverein_id integer NOT NULL UNIQUE REFERENCES fussballverein ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS stadion_fussballverein_id_idx ON stadion(fussballverein_id);

-- Spieler (1:n zu Fussballverein)
CREATE TABLE IF NOT EXISTS spieler (
    id                integer GENERATED ALWAYS AS IDENTITY(START WITH 1000) PRIMARY KEY,
    vorname           text NOT NULL,
    nachname          text NOT NULL,
    alter             integer,
    starker_fuss      text,
    fussballverein_id integer NOT NULL REFERENCES fussballverein ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS spieler_fussballverein_id_idx ON spieler(fussballverein_id);