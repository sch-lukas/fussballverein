// Copyright (C) 2025 - present [Dein Name]
// Hochschule Karlsruhe / Projekt Fussballverein
//
// Dieses Programm ist freie Software: Sie können es unter den Bedingungen
// der GNU General Public License, Version 3 oder höher, weitergeben und/oder ändern.
// Weitere Informationen: https://www.gnu.org/licenses/

/**
 * Controller-Klasse für die REST-Schnittstelle des Moduls "Fussballverein".
 * Hier zunächst nur: Suche eines Vereins per ID.
 * @packageDocumentation
 */

import {
    Controller,
    Get,
    Headers,
    HttpStatus,
    NotFoundException,
    Param,
    ParseIntPipe,
    Req,
    Res,
    UseInterceptors,
} from '@nestjs/common';
import {
    ApiHeader,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { type Request, type Response } from 'express';
import { Public } from 'nest-keycloak-connect';
import { paths } from '../../config/paths.js';
import { getLogger } from '../../logger/logger.js';
import { ResponseTimeInterceptor } from '../../logger/response-time.js';
import { type Fussballverein } from '../entity/fussballverein.js';
import { FussballvereinService } from '../service/fussballverein-service.js';

/**
 * Controller-Klasse für `Fussballverein`.
 */
@Controller(paths.rest)
@UseInterceptors(ResponseTimeInterceptor)
@ApiTags('Fussballverein REST-API')
export class FussballvereinController {
    readonly #service: FussballvereinService;
    readonly #logger = getLogger(FussballvereinController.name);

    constructor(service: FussballvereinService) {
        this.#service = service;
    }

    /**
     * Suche eines Fußballvereins anhand seiner ID.
     *
     * - Gibt bei Erfolg `200 OK` und den Verein als JSON zurück.
     * - Gibt `404 Not Found`, falls kein Verein mit dieser ID existiert.
     * - Nutzt ETag (Header `If-None-Match`), um unnötige Datenübertragung zu vermeiden.
     */
    @Get(':id')
    @Public()
    @ApiOperation({ summary: 'Suche eines Fußballvereins per ID' })
    @ApiParam({
        name: 'id',
        description: 'ID des Vereins, z. B. 1000',
    })
    @ApiHeader({
        name: 'If-None-Match',
        description: 'Header für bedingte GET-Requests, z. B. "0"',
        required: false,
    })
    @ApiOkResponse({ description: 'Der Verein wurde gefunden' })
    @ApiNotFoundResponse({ description: 'Kein Verein zur ID gefunden' })
    @ApiResponse({
        status: HttpStatus.NOT_MODIFIED,
        description: 'Der Verein wurde bereits heruntergeladen (ETag matcht)',
    })
    async getById(
        @Param(
            'id',
            new ParseIntPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND }),
        )
        id: number,
        @Req() req: Request,
        @Headers('If-None-Match') version: string | undefined,
        @Res() res: Response,
    ): Promise<Response<Fussballverein>> {
        this.#logger.debug('getById: id=%d, version=%s', id, version ?? '-1');

        // Prüfen, ob JSON akzeptiert wird
        if (req.accepts(['json', 'html']) === false) {
            this.#logger.debug('getById: akzeptierte Formate=%o', req.accepted);
            return res.sendStatus(HttpStatus.NOT_ACCEPTABLE);
        }

        // Datenbankaufruf
        const verein = await this.#service.findById({ id });
        this.#logger.debug('getById(): verein=%o', verein);

        if (verein === undefined) {
            throw new NotFoundException(
                `Kein Fußballverein mit ID ${id} gefunden.`,
            );
        }

        // ETag-Handling
        const versionDb = verein.version;
        if (version === `"${versionDb}"`) {
            this.#logger.debug('getById: NOT_MODIFIED');
            return res.sendStatus(HttpStatus.NOT_MODIFIED);
        }

        this.#logger.debug('getById: versionDb=%d', versionDb ?? -1);
        res.header('ETag', `"${versionDb}"`);

        return res.json(verein);
    }
}
