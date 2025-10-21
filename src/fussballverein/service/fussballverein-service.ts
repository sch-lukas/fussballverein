/**
 * Das Modul besteht aus der Klasse {@linkcode FussballvereinService}.
 * @packageDocumentation
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import {
    Fussballverein,
    Prisma,
    PrismaClient,
} from '../../generated/prisma/client.ts';
import { type FussballvereinInclude } from '../../generated/prisma/models/Fussballverein.js';
import { getLogger } from '../../logger/logger.js';
import { type Pageable } from './pageable.ts';
import { PrismaService } from './prisma-service.ts';
import { type Slice } from './slice.ts';
import { suchparameterNamen, type Suchparameter } from './suchparameter.ts';
import { WhereBuilder } from './where-builder.ts';

// Typdefinition für `findById`
type FindByIdParams = {
    // ID des gesuchten Fussballvereins
    readonly id: number;
    /** Sollen die Spieler mitgeladen werden? */
    readonly mitSpieler?: boolean;
};

export type FussballvereinMitStadion = Prisma.FussballvereinGetPayload<{
    include: { stadion: true };
}>;

export type FussballvereinMitStadionUndSpieler =
    Prisma.FussballvereinGetPayload<{
        include: {
            stadion: true;
            spieler: true;
        };
    }>;

/**
 * Die Klasse `FussballvereinService` implementiert das Lesen für Bücher und greift
 * mit _Prisma_ auf eine relationale DB zu.
 */
@Injectable()
export class FussballvereinService {
    static readonly ID_PATTERN = /^[1-9]\d{0,10}$/u;

    readonly #prisma: PrismaClient;
    readonly #whereBuilder: WhereBuilder;
    readonly #includeStadion: FussballvereinInclude = { stadion: true };
    readonly #includeStadionUndSpieler: FussballvereinInclude = {
        stadion: true,
        spieler: true,
    };

    readonly #logger = getLogger(FussballvereinService.name);

    constructor(prisma: PrismaService, whereBuilder: WhereBuilder) {
        this.#prisma = prisma.client;
        this.#whereBuilder = whereBuilder;
    }

    // Rueckgabetyp Promise bei asynchronen Funktionen
    //    ab ES2015
    //    vergleiche Task<> bei C#
    // Status eines Promise:
    //    Pending: das Resultat ist noch nicht vorhanden, weil die asynchrone
    //             Operation noch nicht abgeschlossen ist
    //    Fulfilled: die asynchrone Operation ist abgeschlossen und
    //               das Promise-Objekt hat einen Wert
    //    Rejected: die asynchrone Operation ist fehlgeschlagen and das
    //              Promise-Objekt wird nicht den Status "fulfilled" erreichen.
    //              Im Promise-Objekt ist dann die Fehlerursache enthalten.

    /**
     * Ein Fussballverein asynchron anhand seiner ID suchen
     * @param id ID des gesuchten Fussballvereines
     * @returns Das gefundene Fussballverein in einem Promise aus ES2015.
     * @throws NotFoundException falls kein Fussballverein mit der ID existiert
     */
    // https://2ality.com/2015/01/es6-destructuring.html#simulating-named-parameters-in-javascript
    async findById({
        id,
        mitSpieler = false,
    }: FindByIdParams): Promise<Readonly<FussballvereinMitStadionUndSpieler>> {
        this.#logger.debug('findById: id=%d', id);

        // Das Resultat ist null, falls kein Datensatz gefunden
        // Lesen: Keine Transaktion erforderlich
        const include = mitSpieler
            ? this.#includeStadionUndSpieler
            : this.#includeStadion;
        const fussballverein: FussballvereinMitStadionUndSpieler | null =
            await this.#prisma.fussballverein.findUnique({
                where: { id },
                include,
            });
        if (fussballverein === null) {
            this.#logger.debug('Es gibt kein Fussballverein mit der ID %d', id);
            throw new NotFoundException(
                `Es gibt kein Fussballverein mit der ID ${id}.`,
            );
        }
        // nullish coalescing operator
        fussballverein.schlagwoerter ??= [];

        this.#logger.debug('findById: fussballverein=%o', fussballverein);
        return fussballverein;
    }

    /**
     * Binärdatei zu einem Fussballverein suchen.
     * @param fussballvereinId ID des zugehörigen Fussballvereins.
     * @returns Binärdatei oder undefined als Promise.
     */
    async findFileByFussballvereinId(
        fussballvereinId: number,
    ): Promise<Readonly<Fussballverein> | undefined> {
        this.#logger.debug(
            'findFileByFussballvereinId: fussballvereinId=%d',
            fussballvereinId,
        );
        const fussballverein: Fussballverein | null =
            await this.#prisma.fussballverein.findUnique({
                where: { fussballvereinId },
            });
        if (fussballverein === null) {
            this.#logger.debug(
                'findFileByFussballvereinId: Keine Datei gefunden',
            );
            return;
        }

        this.#logger.debug(
            'findFileByFussballvereinId: id=%s, byteLength=%d, filename=%s, mimetype=%s, fussballvereinId=%d',
            fussballverein.id,
            fussballverein.data.byteLength,
            fussballverein.filename,
            fussballverein.mimetype ?? 'undefined',
            fussballverein.fussballvereinId,
        );

        // als Datei im Wurzelverzeichnis des Projekts speichern:
        // import { writeFile } from 'node:fs/promises';
        // await writeFile(fussballverein.filename, fussballverein.data);

        return fussballverein;
    }

    /**
     * Bücher asynchron suchen.
     * @param suchparameter JSON-Objekt mit Suchparameter.
     * @param pageable Maximale Anzahl an Datensätzen und Seitennummer.
     * @returns Ein JSON-Array mit den gefundenen Büchern.
     * @throws NotFoundException falls keine Bücher gefunden wurden.
     */
    async find(
        suchparameter: Suchparameter | undefined,
        pageable: Pageable,
    ): Promise<Readonly<Slice<Readonly<FussballvereinMitStadion>>>> {
        this.#logger.debug(
            'find: suchparameter=%s, pageable=%o',
            JSON.stringify(suchparameter),
            pageable,
        );

        // Keine Suchparameter?
        if (suchparameter === undefined) {
            return await this.#findAll(pageable);
        }
        const keys = Object.keys(suchparameter);
        if (keys.length === 0) {
            return await this.#findAll(pageable);
        }

        // Falsche Namen fuer Suchparameter?
        if (!this.#checkKeys(keys) || !this.#checkEnums(suchparameter)) {
            this.#logger.debug('Ungueltige Suchparameter');
            throw new NotFoundException('Ungueltige Suchparameter');
        }

        // Das Resultat ist eine leere Liste, falls nichts gefunden
        // Lesen: Keine Transaktion erforderlich
        const where = this.#whereBuilder.build(suchparameter);
        const { number, size } = pageable;
        const buecher: FussballvereinMitStadion[] =
            await this.#prisma.fussballverein.findMany({
                where,
                skip: number * size,
                take: size,
                include: this.#includeStadion,
            });
        if (buecher.length === 0) {
            this.#logger.debug('find: Keine Buecher gefunden');
            throw new NotFoundException(
                `Keine Buecher gefunden: ${JSON.stringify(suchparameter)}, Seite ${pageable.number}}`,
            );
        }
        const totalElements = await this.count();
        return this.#createSlice(buecher, totalElements);
    }

    /**
     * Anzahl aller Bücher zurückliefern.
     * @returns Ein JSON-Array mit den gefundenen Büchern.
     */
    async count() {
        this.#logger.debug('count');
        const count = await this.#prisma.fussballverein.count();
        this.#logger.debug('count: %d', count);
        return count;
    }

    async #findAll(
        pageable: Pageable,
    ): Promise<Readonly<Slice<FussballvereinMitStadion>>> {
        const { number, size } = pageable;
        const buecher: FussballvereinMitStadion[] =
            await this.#prisma.fussballverein.findMany({
                skip: number * size,
                take: size,
                include: this.#includeStadion,
            });
        if (buecher.length === 0) {
            this.#logger.debug('#findAll: Keine Buecher gefunden');
            throw new NotFoundException(`Ungueltige Seite "${number}"`);
        }
        const totalElements = await this.count();
        return this.#createSlice(buecher, totalElements);
    }

    #createSlice(
        buecher: FussballvereinMitStadion[],
        totalElements: number,
    ): Readonly<Slice<FussballvereinMitStadion>> {
        buecher.forEach((fussballverein) => {
            fussballverein.schlagwoerter ??= [];
        });
        const fussballvereinSlice: Slice<FussballvereinMitStadion> = {
            content: buecher,
            totalElements,
        };
        this.#logger.debug(
            'createSlice: fussballvereinSlice=%o',
            fussballvereinSlice,
        );
        return fussballvereinSlice;
    }

    #checkKeys(keys: string[]) {
        this.#logger.debug('#checkKeys: keys=%o', keys);
        // Ist jeder Suchparameter auch eine Property von Fussballverein oder "schlagwoerter"?
        let validKeys = true;
        keys.forEach((key) => {
            if (
                !suchparameterNamen.includes(key) &&
                key !== 'javascript' &&
                key !== 'typescript' &&
                key !== 'java' &&
                key !== 'python'
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

    #checkEnums(suchparameter: Suchparameter) {
        const { art } = suchparameter;
        this.#logger.debug(
            '#checkEnums: Suchparameter "art=%s"',
            art ?? 'undefined',
        );
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        return (
            art === undefined ||
            art === 'EPUB' ||
            art === 'HARDCOVER' ||
            art === 'PAPERBACK'
        );
    }
}
