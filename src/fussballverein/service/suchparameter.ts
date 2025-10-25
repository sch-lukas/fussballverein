// Copyright (C) 2025 - present [Dein Name]
// Hochschule Karlsruhe / Projekt Fussballverein
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

/**
 * Das Modul besteht aus Typdefinitionen für die Suche in `FussballvereinService`.
 * @packageDocumentation
 */

// Typdefinition für `find`
export type Suchparameter = {
    /** Teilstring-Suche (case-insensitive) auf dem Vereinsnamen */
    readonly name?: string;

    /**
     * Untere Grenze für das Gründungsdatum (>=).
     * Erwartet ISO-String, z. B. "1999-05-01".
     */
    readonly gruendungsdatum?: string;

    /** Teilstring-Suche (case-insensitive) auf der Stadt des Stadions */
    readonly stadt?: string;

    /** Exakte Suche auf Website (falls benötigt) */
    readonly website?: string;

    /** Exakte Suche auf Email (falls benötigt) */
    readonly email?: string;

    /** Exakte/Teilstring-Suche auf Telefonnummer (falls benötigt) */
    readonly telefonnummer?: string;

    /**
     * Mitgliederanzahl (z. B. als Unter-/Obergrenze im WhereBuilder erweiterbar).
     * Erlaubt auch String, damit Query-Strings direkt übernommen werden können.
     */
    readonly mitgliederanzahl?: number | string;

    /**
     * Stadion-Kapazität (optional, falls du später Filter im WhereBuilder ergänzt).
     */
    readonly kapazitaet?: number | string;
};

// Gueltige Namen fuer die Suchparameter
export const suchparameterNamen = [
    'name',
    'gruendungsdatum',
    'stadt',
    'website',
    'email',
    'telefonnummer',
    'mitgliederanzahl',
    'kapazitaet',
] as const;
