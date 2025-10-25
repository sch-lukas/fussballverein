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
 * Das Modul besteht aus der Klasse {@linkcode FussballvereinWriteService} für die
 * Schreiboperationen im Anwendungskern.
 * @packageDocumentation
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { fileTypeFromBuffer } from 'file-type';
import { type Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { getLogger } from '../../logger/logger.js';
import { MailService } from '../../mail/mail-service.js';
import {
    NameExistsException,
    VersionInvalidException,
    VersionOutdatedException,
} from './exceptions.js';
import { FussballvereinService } from './fussballverein-service.js';
import { PrismaService } from './prisma-service.js';

// ----- Typen für Create / Update ------------------------------------------------

export type FussballvereinCreate = Prisma.FussballvereinCreateInput;

type FussballvereinCreated = Prisma.FussballvereinGetPayload<{
    include: {
        spieler: true;
        stadion: true;
        logoFile: true;
    };
}>;

export type FussballvereinUpdate = Prisma.FussballvereinUpdateInput;

/** Typdefinitionen zum Aktualisieren eines Vereins mit `update`. */
export type UpdateParams = {
    /** ID des zu aktualisierenden Vereins. */
    readonly id: number | undefined;
    /** Objekt mit den zu aktualisierenden Werten. */
    readonly verein: FussballvereinUpdate;
    /** Versionsnummer für die zu aktualisierenden Werte. */
    readonly version: string;
};

type FussballvereinUpdated = Prisma.FussballvereinGetPayload<{}>;

// snake_case-Typen aus Prisma
type LogoFileCreate = Prisma.LogoFileUncheckedCreateInput;
export type LogoFileCreated = Prisma.LogoFileGetPayload<{}>;

/**
 * Die Klasse `FussballvereinWriteService` implementiert den Anwendungskern für das
 * Schreiben von Vereinen und greift mit _Prisma_ auf die DB zu.
 */
@Injectable()
export class FussballvereinWriteService {
    // z.B. `"0"`, `"1"`, ... wie im Vorbild
    private static readonly VERSION_PATTERN = /^"\d{1,3}"/u;

    readonly #prisma: PrismaClient;
    readonly #readService: FussballvereinService;
    readonly #mailService: MailService;

    readonly #logger = getLogger(FussballvereinWriteService.name);

    // eslint-disable-next-line max-params
    constructor(
        prisma: PrismaService,
        readService: FussballvereinService,
        mailService: MailService,
    ) {
        this.#prisma = prisma.client;
        this.#readService = readService;
        this.#mailService = mailService;
    }

    /**
     * Ein neuer Verein soll angelegt werden.
     * @param verein Der neu abzulegende Verein
     * @returns Die ID des neu angelegten Vereins
     * @throws NameExistsException falls der Vereinsname bereits existiert
     */
    async create(verein: FussballvereinCreate) {
        this.#logger.debug('create: verein=%o', verein);
        await this.#validateCreate(verein);

        // Neuer Datensatz mit generierter ID
        let vereinDb: FussballvereinCreated | undefined;
        await this.#prisma.$transaction(async (tx) => {
            vereinDb = await tx.fussballverein.create({
                data: verein,
                include: { spieler: true, stadion: true, logoFile: true }, // snake_case!
            });
        });

        await this.#sendmail({
            id: vereinDb?.id ?? 'N/A',
            name: vereinDb?.name ?? 'N/A',
        });

        this.#logger.debug('create: vereinDb.id=%s', vereinDb?.id ?? 'N/A');
        return vereinDb?.id ?? Number.NaN;
    }

    /**
     * Zu einem vorhandenen Verein eine Binärdatei (Logo) abspeichern.
     * @param fussballvereinId ID des vorhandenen Vereins
     * @param data Bytes der Datei als Buffer (Node)
     * @param filename Dateiname
     * @param size Dateigröße in Bytes
     * @returns Entity-Objekt für `logoFile`
     */
    // eslint-disable-next-line max-params
    async addFile(
        fussballvereinId: number,
        data: Uint8Array<ArrayBufferLike>,
        filename: string,
        size: number,
    ): Promise<Readonly<LogoFileCreated> | undefined> {
        this.#logger.debug(
            'addFile: fussballvereinId=%d, filename=%s, size=%d',
            fussballvereinId,
            filename,
            size,
        );

        // TODO Dateigroesse pruefen, ggf. Mimetype-Whitelist

        let logoCreated: LogoFileCreated | undefined;
        await this.#prisma.$transaction(async (tx) => {
            // Verein ermitteln, falls vorhanden
            const verein = await tx.fussballverein.findUnique({
                where: { id: fussballvereinId },
            });
            if (verein === null) {
                this.#logger.debug(
                    'Es gibt keinen Verein mit der ID %d',
                    fussballvereinId,
                );
                throw new NotFoundException(
                    `Es gibt keinen Verein mit der ID ${fussballvereinId}.`,
                );
            }

            // evtl. vorhandene Datei löschen (1:1)
            await tx.logoFile.deleteMany({
                where: { fussballvereinId: fussballvereinId }, // <-- snake_case
            });

            const fileType = await fileTypeFromBuffer(data);
            const mimetype = fileType?.mime ?? null;
            this.#logger.debug('addFile: mimetype=%s', mimetype ?? 'undefined');

            const logo: LogoFileCreate = {
                filename,
                data,
                mimetype,
                fussballvereinId: fussballvereinId, // <-- snake_case
            };
            logoCreated = await tx.logoFile.create({ data: logo });
        });

        this.#logger.debug(
            'addFile: id=%d, byteLength=%d, filename=%s, mimetype=%s',
            logoCreated?.id ?? Number.NaN,
            logoCreated?.data.byteLength ?? Number.NaN,
            logoCreated?.filename ?? 'undefined',
            logoCreated?.mimetype ?? 'null',
        );
        return logoCreated;
    }

    /**
     * Ein vorhandener Verein soll aktualisiert werden. "Destructured" Argument
     * mit id (ID des zu aktualisierenden Vereins), verein (zu aktualisierende Felder)
     * und version (Versionsnummer für optimistische Synchronisation).
     * @returns Die neue Versionsnummer gemäß optimistischer Synchronisation
     * @throws NotFoundException falls kein Verein zur ID vorhanden ist
     * @throws VersionInvalidException falls die Versionsnummer ungültig ist
     * @throws VersionOutdatedException falls die Versionsnummer veraltet ist
     */
    // https://2ality.com/2015/01/es6-destructuring.html#simulating-named-parameters-in-javascript
    async update({ id, verein, version }: UpdateParams) {
        this.#logger.debug(
            'update: id=%d, verein=%o, version=%s',
            id ?? Number.NaN,
            verein,
            version,
        );
        if (id === undefined) {
            this.#logger.debug('update: Keine gueltige ID');
            throw new NotFoundException(
                `Es gibt keinen Verein mit der ID ${id}.`,
            );
        }

        await this.#validateUpdate(id, version);

        // Optimistic Locking: version += 1
        verein.version = { increment: 1 };

        let vereinUpdated: FussballvereinUpdated | undefined;
        await this.#prisma.$transaction(async (tx) => {
            vereinUpdated = await tx.fussballverein.update({
                data: verein,
                where: { id },
            });
        });
        this.#logger.debug(
            'update: vereinUpdated=%s',
            JSON.stringify(vereinUpdated),
        );

        return vereinUpdated?.version ?? Number.NaN;
    }

    /**
     * Ein Verein wird asynchron anhand seiner ID gelöscht.
     *
     * @param id ID des zu löschenden Vereins
     * @returns true, falls der Verein vorhanden war und gelöscht wurde. Sonst false.
     */
    async delete(id: number) {
        this.#logger.debug('delete: id=%d', id);

        const verein = await this.#prisma.fussballverein.findUnique({
            where: { id },
        });
        if (verein === null) {
            this.#logger.debug('delete: not found');
            return false;
        }

        await this.#prisma.$transaction(async (tx) => {
            await tx.fussballverein.delete({ where: { id } });
        });

        this.#logger.debug('delete');
        return true;
    }

    // ----- Validierungen & Helper ------------------------------------------------

    async #validateCreate({
        name,
    }: Prisma.FussballvereinCreateInput): Promise<undefined> {
        this.#logger.debug('#validateCreate: name=%s', name ?? 'undefined');
        if (name === undefined) {
            this.#logger.debug('#validateCreate: ok (kein Name gesetzt)');
            return;
        }

        const anzahl = await this.#prisma.fussballverein.count({
            where: { name },
        });
        if (anzahl > 0) {
            this.#logger.debug('#validateCreate: name existiert: %s', name);
            throw new NameExistsException(name as string);
        }
        this.#logger.debug('#validateCreate: ok');
    }

    async #sendmail({ id, name }: { id: number | 'N/A'; name: string }) {
        const subject = `Neuer Verein ${id}`;
        const body = `Der Verein <strong>${name}</strong> ist angelegt`;
        await this.#mailService.sendmail({ subject, body });
    }

    async #validateUpdate(id: number, versionStr: string) {
        this.#logger.debug(
            '#validateUpdate: id=%d, versionStr=%s',
            id,
            versionStr,
        );
        if (!FussballvereinWriteService.VERSION_PATTERN.test(versionStr)) {
            throw new VersionInvalidException(versionStr);
        }

        // versionStr ist z.B. '"0"' => Zahl extrahieren
        const version = Number.parseInt(versionStr.slice(1, -1), 10);

        // vorhandenen Datensatz inkl. aktueller Version laden
        const vereinDb = await this.#readService.findById({ id });

        if (version < vereinDb.version) {
            this.#logger.debug(
                '#validateUpdate: versionDb=%d',
                vereinDb.version,
            );
            throw new VersionOutdatedException(version);
        }
    }
}
