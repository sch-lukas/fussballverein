// Copyright (C) 2025 - present [Dein Name]
// Hochschule Karlsruhe / Projekt Fussballverein
//
// Dieses Programm ist freie Software: Sie können es unter den Bedingungen
// der GNU General Public License, Version 3 oder höher, weitergeben und/oder ändern.
// Weitere Informationen: https://www.gnu.org/licenses/

/**
 * Das Modul besteht aus der Klasse {@linkcode FussballvereinService}.
 * @packageDocumentation
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { getLogger } from '../../logger/logger.js';
import { type Fussballverein } from '../entity/fussballverein.js';
import { PrismaService } from './prisma-service.js';
import { PrismaClient } from '../../generated/prisma/client.ts';

// Typdefinition für `findById`
type FindByIdParams = {
    /** ID des gesuchten Vereins */
    readonly id: number;
};

/**
 * Die Klasse `FussballvereinService` implementiert das Lesen für Fußballvereine
 * und greift mit _Prisma_ auf eine relationale DB zu.
 */
@Injectable()
export class FussballvereinService {
    static readonly ID_PATTERN = /^[1-9]\d{0,10}$/u;

    readonly #prisma: PrismaClient;
    readonly #logger = getLogger(FussballvereinService.name);

    constructor(prisma: PrismaService) {
        this.#prisma = prisma.client;
    }

    /**
     * Einen Fußballverein asynchron anhand seiner ID suchen.
     * @param id ID des gesuchten Vereins
     * @returns Der gefundene Verein als Promise.
     * @throws NotFoundException falls kein Verein mit der ID existiert
     */
    async findById({ id }: FindByIdParams): Promise<Readonly<Fussballverein>> {
        this.#logger.debug('findById: id=%d', id);

        // Lesen: Keine Transaktion erforderlich
        const verein = await this.#prisma.fussballverein.findUnique({
            where: { id },
            // Minimaler Start: keine Beziehungen laden.
            // Später erweiterbar mit include: { stadion: true, spieler: true, logo_file: true }
        });

        if (verein === null) {
            this.#logger.debug(
                'Es gibt keinen Fußballverein mit der ID %d',
                id,
            );
            throw new NotFoundException(
                `Es gibt keinen Fußballverein mit der ID ${id}.`,
            );
        }

        this.#logger.debug('findById: verein=%o', verein);
        return verein;
    }
}
