// Copyright (C) 2016 - present Juergen Zimmermann, Hochschule Karlsruhe
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
 * Das Modul besteht aus der Klasse {@linkcode FussballvereinService}.
 * @packageDocumentation
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import {
    type logo_file, // <-- snake_case Typ vom Prisma-Client
    Prisma,
    PrismaClient,
} from '../../generated/prisma/client.js';
import { getLogger } from '../../logger/logger.js';
import { type Pageable } from './pageable.js';
import { PrismaService } from './prisma-service.js';
import { type Slice } from './slice.js';
import { type Suchparameter, suchparameterNamen } from './suchparameter.js';
import { WhereBuilder } from './where-builder.js';

// -----------------------------------------------------------------------------
// Typdefinitionen für Include-Varianten
// -----------------------------------------------------------------------------

export type FussballvereinMitBasis = Prisma.FussballvereinGetPayload<{}>;

export type FussballvereinMitSpielern = Prisma.FussballvereinGetPayload<{
    include: { spieler: true };
}>;

export type FussballvereinMitStadion = Prisma.FussballvereinGetPayload<{
    include: { stadion: true };
}>;

export type FussballvereinMitLogo = Prisma.FussballvereinGetPayload<{
    include: { logo_file: true }; // <-- snake_case Relation
}>;

export type FussballvereinMitAllen = Prisma.FussballvereinGetPayload<{
    include: {
        spieler: true;
        stadion: true;
        logo_file: true; // <-- snake_case Relation
    };
}>;

// -----------------------------------------------------------------------------
// Typdefinition für findById-Parameter
// -----------------------------------------------------------------------------

type FindByIdParams = {
    readonly id: number;
    readonly mitSpielern?: boolean;
    readonly mitStadion?: boolean;
    readonly mitLogo?: boolean;
};

/**
 * Die Klasse `FussballvereinService` implementiert das Lesen für Vereine und
 * greift mit _Prisma_ auf eine relationale DB zu.
 */
@Injectable()
export class FussballvereinService {
    static readonly ID_PATTERN = /^[1-9]\d{0,10}$/u;

    readonly #prisma: PrismaClient;
    readonly #whereBuilder: WhereBuilder;

    // Häufig verwendete Include-Objekte (werden unten kombiniert)
    readonly #includeSpieler = { spieler: true } as const;
    readonly #includeStadion = { stadion: true } as const;
    readonly #includeLogo = { logo_file: true } as const; // <-- snake_case

    readonly #logger = getLogger(FussballvereinService.name);

    constructor(prisma: PrismaService, whereBuilder: WhereBuilder) {
        this.#prisma = prisma.client;
        this.#whereBuilder = whereBuilder;
    }

    /**
     * Einen Verein asynchron anhand seiner ID suchen.
     */
    async findById({
        id,
        mitSpielern = false,
        mitStadion = false,
        mitLogo = false,
    }: FindByIdParams): Promise<Readonly<FussballvereinMitAllen>> {
        this.#logger.debug(
            'findById: id=%d, mitSpielern=%s, mitStadion=%s, mitLogo=%s',
            id,
            String(mitSpielern),
            String(mitStadion),
            String(mitLogo),
        );

        // Include-Objekt dynamisch zusammensetzen
        const include: Record<string, true> = {};
        if (mitSpielern) Object.assign(include, this.#includeSpieler);
        if (mitStadion) Object.assign(include, this.#includeStadion);
        if (mitLogo) Object.assign(include, this.#includeLogo);

        const verein:
            | FussballvereinMitAllen
            | Prisma.FussballvereinGetPayload<{}>
            | null = await this.#prisma.fussballverein.findUnique({
            where: { id },
            ...(Object.keys(include).length > 0 ? { include } : {}),
        });

        if (verein === null) {
            this.#logger.debug('Es gibt keinen Verein mit der ID %d', id);
            throw new NotFoundException(
                `Es gibt keinen Verein mit der ID ${id}.`,
            );
        }

        this.#logger.debug('findById: verein=%o', verein);
        return verein as FussballvereinMitAllen;
    }

    /**
     * Logo-Datei (Binärdaten) zu einem Verein suchen.
     */
    async findFileByFussballvereinId(
        fussballvereinId: number,
    ): Promise<Readonly<logo_file> | undefined> {
        // <-- snake_case Typ
        this.#logger.debug(
            'findFileByFussballvereinId: fussballvereinId=%d',
            fussballvereinId,
        );

        const logo: logo_file | null = await this.#prisma.logo_file.findUnique({
            where: { fussballverein_id: fussballvereinId }, // <-- snake_case FK
        });

        if (logo === null) {
            this.#logger.debug(
                'findFileByFussballvereinId: Keine Datei gefunden',
            );
            return;
        }

        this.#logger.debug(
            'findFileByFussballvereinId: id=%s, byteLength=%d, filename=%s, mimetype=%s, fussballverein_id=%d',
            logo.id,
            logo.data.byteLength,
            logo.filename,
            logo.mimetype ?? 'undefined',
            logo.fussballverein_id, // <-- snake_case Feld
        );

        return logo;
    }

    /**
     * Vereine asynchron suchen.
     */
    async find(
        suchparameter: Suchparameter | undefined,
        pageable: Pageable,
    ): Promise<Readonly<Slice<Readonly<FussballvereinMitBasis>>>> {
        this.#logger.debug(
            'find: suchparameter=%s, pageable=%o',
            JSON.stringify(suchparameter),
            pageable,
        );

        if (
            suchparameter === undefined ||
            Object.keys(suchparameter).length === 0
        ) {
            return await this.#findAll(pageable);
        }

        if (
            !this.#checkKeys(Object.keys(suchparameter)) ||
            !this.#checkEnums() // <-- ohne Argument
        ) {
            this.#logger.debug('Ungueltige Suchparameter');
            throw new NotFoundException('Ungueltige Suchparameter');
        }

        const where = this.#whereBuilder.build(suchparameter);
        const { number, size } = pageable;

        const vereine: FussballvereinMitBasis[] =
            await this.#prisma.fussballverein.findMany({
                where,
                skip: number * size,
                take: size,
            });

        if (vereine.length === 0) {
            this.#logger.debug('find: Keine Vereine gefunden');
            throw new NotFoundException(
                `Keine Vereine gefunden: ${JSON.stringify(
                    suchparameter,
                )}, Seite ${pageable.number}`,
            );
        }

        const totalElements = await this.count();
        return this.#createSlice(vereine, totalElements);
    }

    async count(): Promise<number> {
        this.#logger.debug('count');
        const count = await this.#prisma.fussballverein.count();
        this.#logger.debug('count: %d', count);
        return count;
    }

    // -----------------------------------------------------------------------------
    // Private Hilfsmethoden
    // -----------------------------------------------------------------------------

    async #findAll(
        pageable: Pageable,
    ): Promise<Readonly<Slice<FussballvereinMitBasis>>> {
        const { number, size } = pageable;

        const vereine: FussballvereinMitBasis[] =
            await this.#prisma.fussballverein.findMany({
                skip: number * size,
                take: size,
            });

        if (vereine.length === 0) {
            this.#logger.debug('#findAll: Keine Vereine gefunden');
            throw new NotFoundException(`Ungueltige Seite "${number}"`);
        }

        const totalElements = await this.count();
        return this.#createSlice(vereine, totalElements);
    }

    #createSlice(
        vereine: FussballvereinMitBasis[],
        totalElements: number,
    ): Readonly<Slice<FussballvereinMitBasis>> {
        const vereinSlice: Slice<FussballvereinMitBasis> = {
            content: vereine,
            totalElements,
        };
        this.#logger.debug('createSlice: vereinSlice=%o', vereinSlice);
        return vereinSlice;
    }

    #checkKeys(keys: string[]) {
        this.#logger.debug('#checkKeys: keys=%o', keys);
        let validKeys = true;
        keys.forEach((key) => {
            if (
                !suchparameterNamen.includes(key) &&
                key !== 'name' &&
                key !== 'stadt' &&
                key !== 'gruendungsdatum'
            ) {
                this.#logger.debug(
                    '#checkKeys: ungueltiger Suchparameter "%s"',
                    key,
                );
                validKeys = false;
            }
        });
        return validKeys;
    }

    #checkEnums() {
        this.#logger.debug('#checkEnums: keine Enum-Pruefungen erforderlich');
        return true;
    }
}
