// src/fussballverein/service/fussballverein-service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import {
    type LogoFile, // Korrekter Typ-Import
    Prisma,
    PrismaClient,
} from '../../generated/prisma/client.js';
import { getLogger } from '../../logger/logger.js';
import { type Pageable } from './pageable.js';
import { PrismaService } from './prisma-service.js';
import { type Slice } from './slice.js';
import { type Suchparameter, suchparameterNamen } from './suchparameter.js';
import { WhereBuilder } from './where-builder.js';

// --- Korrekte Typdefinitionen für Payloads ---
export type FussballvereinMitBasis = Prisma.FussballvereinGetPayload<{}>;
export type FussballvereinMitSpielern = Prisma.FussballvereinGetPayload<{
    include: { spieler: true };
}>;
export type FussballvereinMitStadion = Prisma.FussballvereinGetPayload<{
    include: { stadion: true };
}>;
export type FussballvereinMitLogo = Prisma.FussballvereinGetPayload<{
    include: { logoFile: true }; // Korrekt: camelCase
}>;
export type FussballvereinMitAllen = Prisma.FussballvereinGetPayload<{
    include: {
        spieler: true;
        stadion: true;
        logoFile: true; // Korrekt: camelCase
    };
}>;

type FindByIdParams = {
    readonly id: number;
    readonly mitSpielern?: boolean;
    readonly mitStadion?: boolean;
    readonly mitLogo?: boolean;
};

@Injectable()
export class FussballvereinService {
    readonly #prisma: PrismaClient;
    readonly #whereBuilder: WhereBuilder;

    // --- Korrekte Include-Objekte ---
    readonly #includeSpieler = { spieler: true } as const;
    readonly #includeStadion = { stadion: true } as const;
    readonly #includeLogo = { logoFile: true } as const; // Korrekt: camelCase

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
            mitSpielern,
            mitStadion,
            mitLogo,
        );

        const include: any = {}; // any, um dynamische Zuweisung zu erlauben
        if (mitSpielern) Object.assign(include, this.#includeSpieler);
        if (mitStadion) Object.assign(include, this.#includeStadion);
        if (mitLogo) Object.assign(include, this.#includeLogo); // Nutzt das korrekte Objekt

        const verein = await this.#prisma.fussballverein.findUnique({
            where: { id },
            ...(Object.keys(include).length > 0 ? { include } : {}),
        });

        if (verein === null) {
            throw new NotFoundException(
                `Es gibt keinen Verein mit der ID ${id}.`,
            );
        }
        this.#logger.debug('findById: verein=%o', verein);
        return verein as FussballvereinMitAllen;
    }

    /**
     * Logo-Datei zu einem Verein anhand der Vereins-ID suchen.
     */
    async findLogoById(id: number): Promise<Readonly<LogoFile>> {
        this.#logger.debug('findLogoById: id=%d', id);

        const vereinWithLogo = await this.#prisma.fussballverein.findUnique({
            where: { id },
            include: {
                logoFile: true, // Lädt die korrekte Relation
            },
        });

        // Korrekte Prüfung auf null/undefined für die Relation
        if (
            vereinWithLogo?.logoFile === null ||
            vereinWithLogo?.logoFile === undefined
        ) {
            throw new NotFoundException(
                `Kein Logo für den Verein mit der ID ${id} gefunden.`,
            );
        }

        this.#logger.debug(
            'findLogoById: logoFile gefunden=%o',
            vereinWithLogo.logoFile,
        );
        return vereinWithLogo.logoFile;
    }

    /**
     * Vereine asynchron suchen (mit Paginierung und Filter).
     */
    async find(
        suchparameter: Suchparameter,
        pageable: Pageable,
    ): Promise<Readonly<Slice<Readonly<FussballvereinMitBasis>>>> {
        this.#logger.debug(
            'find: suchparameter=%s, pageable=%o',
            JSON.stringify(suchparameter),
            pageable,
        );

        // Wenn keine Suchparameter, alle Vereine mit Paginierung holen
        if (
            suchparameter === undefined ||
            Object.keys(suchparameter).length === 0
        ) {
            return await this.#findAll(pageable);
        }

        // Suchparameter validieren (wie im Original)
        if (
            !this.#checkKeys(Object.keys(suchparameter)) ||
            !this.#checkEnums()
        ) {
            throw new NotFoundException('Ungueltige Suchparameter');
        }

        // Prisma WHERE-Klausel bauen
        const where = this.#whereBuilder.build(suchparameter);
        const { number, size } = pageable;

        const vereine = await this.#prisma.fussballverein.findMany({
            where,
            skip: number * size,
            take: size,
            // Optional: Standard-Sortierung
            // orderBy: { id: 'asc' },
        });

        if (vereine.length === 0) {
            throw new NotFoundException(
                `Keine Vereine gefunden: ${JSON.stringify(suchparameter)}, Seite ${pageable.number}`,
            );
        }

        // Gesamtzahl für Paginierung ermitteln
        const totalElements = await this.count(suchparameter);
        return this.#createSlice(vereine, totalElements);
    }

    /**
     * Anzahl der Vereine zählen (mit optionalen Filtern).
     */
    async count(suchparameter: Suchparameter = {}): Promise<number> {
        this.#logger.debug('count: suchparameter=%o', suchparameter);
        const where = this.#whereBuilder.build(suchparameter);
        const count = await this.#prisma.fussballverein.count({ where });
        this.#logger.debug('count: %d', count);
        return count;
    }

    // --- Private Hilfsmethoden (genau wie im Original) ---

    async #findAll(
        pageable: Pageable,
    ): Promise<Readonly<Slice<FussballvereinMitBasis>>> {
        const { number, size } = pageable;

        const vereine = await this.#prisma.fussballverein.findMany({
            skip: number * size,
            take: size,
            // orderBy: { id: 'asc' },
        });

        if (vereine.length === 0) {
            throw new NotFoundException(`Ungueltige Seite "${number}"`);
        }

        const totalElements = await this.count(); // Zählt alle Elemente
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

    #checkKeys(keys: string[]): boolean {
        this.#logger.debug('#checkKeys: keys=%o', keys);
        let validKeys = true;
        keys.forEach((key) => {
            // Prüft, ob der Schlüssel ein gültiger Suchparameter ist
            if (!suchparameterNamen.includes(key as any)) {
                // 'as any' zur Typ-Umgehung
                this.#logger.debug(
                    '#checkKeys: ungueltiger Suchparameter "%s"',
                    key,
                );
                validKeys = false;
            }
        });
        return validKeys;
    }

    #checkEnums(): boolean {
        // Hier könnten Prüfungen für Enum-Werte stehen, falls du welche hättest
        this.#logger.debug('#checkEnums: keine Enum-Pruefungen erforderlich');
        return true;
    }
}
