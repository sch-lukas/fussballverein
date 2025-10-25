import {
    Controller,
    Get,
    Headers,
    HttpStatus,
    NotFoundException,
    Param,
    ParseIntPipe,
    Query,
    Req,
    Res,
    StreamableFile,
    UseInterceptors,
} from '@nestjs/common';
import {
    ApiHeader,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiProperty,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { type Request, type Response } from 'express';
import { Public } from 'nest-keycloak-connect';
import { paths } from '../../config/paths.js';
import { getLogger } from '../../logger/logger.js';
import { ResponseTimeInterceptor } from '../../logger/response-time.js';
import { FussballvereinDto } from '../controller/fussballverein-dto.ts';
import { FussballvereinService } from '../service/fussballverein-service.js';
import { createPageable } from '../service/pageable.js';
import { type Suchparameter } from '../service/suchparameter.js';
import { createPage, Page } from './page.js';

// Annahme: Dein Suchparameter-Objekt
export class FussballvereinQuery implements Suchparameter {
    @ApiProperty({ required: false })
    declare readonly name?: string;

    @ApiProperty({ required: false })
    declare readonly mitgliederanzahl?: number;

    // Fügen Sie hier alle Query-Parameter hinzu, die Sie filtern möchten
    // Z.B. declare readonly website?: string;

    @ApiProperty({ required: false })
    declare size?: string;

    @ApiProperty({ required: false })
    declare page?: string;

    @ApiProperty({ required: false })
    declare only?: 'count';
}

export type CountResult = Record<'count', number>;

@Controller(paths.rest)
@UseInterceptors(ResponseTimeInterceptor)
@ApiTags('Fussballverein REST-API (Lesen)')
export class FussballvereinGetController {
    readonly #service: FussballvereinService;
    readonly #logger = getLogger(FussballvereinGetController.name);

    constructor(service: FussballvereinService) {
        this.#service = service;
    }

    /**
     * Ein Fussballverein wird asynchron anhand seiner ID als Pfadparameter gesucht.
     */
    // eslint-disable-next-line max-params
    @Get(':id')
    @Public()
    @ApiOperation({ summary: 'Suche mit der ID des Fussballvereins' })
    @ApiParam({ name: 'id', description: 'Z.B. 1' })
    @ApiHeader({
        name: 'If-None-Match',
        description: 'Header für bedingte GET-Requests, z.B. "0"',
        required: false,
    })
    @ApiOkResponse({
        description: 'Der Verein wurde gefunden',
        type: FussballvereinDto,
    }) // Nutzt dein DTO
    @ApiNotFoundResponse({ description: 'Kein Verein zur ID gefunden' })
    @ApiResponse({
        status: HttpStatus.NOT_MODIFIED,
        description: 'Der Verein wurde bereits heruntergeladen',
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
    ): Promise<Response<FussballvereinDto>> {
        this.#logger.debug('getById: id=%d, version=%s', id, version ?? '-1');

        if (req.accepts(['json', 'html']) === false) {
            this.#logger.debug('getById: accepted=%o', req.accepted);
            return res.sendStatus(HttpStatus.NOT_ACCEPTABLE);
        }

        const verein = await this.#service.findById({ id });
        if (!verein) {
            throw new NotFoundException(
                `Kein Fussballverein mit ID ${id} gefunden.`,
            );
        }

        // ETags-Logik (genau wie beim Prof)
        const versionDb = verein.version;
        if (version === `"${versionDb}"`) {
            this.#logger.debug('getById: NOT_MODIFIED');
            return res.sendStatus(HttpStatus.NOT_MODIFIED);
        }
        res.header('ETag', `"${versionDb}"`);

        // Wichtig: Rückgabe muss in dein DTO-Format umgewandelt werden
        this.#logger.debug('getById: verein=%o', verein);
        return res.json(verein); // Angenommen, der Service liefert bereits ein geeignetes Response-Objekt
    }

    /**
     * Vereine werden mit Query-Parametern asynchron gesucht.
     */
    @Get()
    @Public()
    @ApiOperation({ summary: 'Suche mit Suchparameter' })
    @ApiOkResponse({
        description: 'Eine evtl. leere Liste mit Vereinen',
        type: [FussballvereinDto],
    })
    async get(
        @Query() query: FussballvereinQuery,
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<Response<Page<FussballvereinDto> | CountResult>> {
        this.#logger.debug('get: query=%o', query);

        if (req.accepts(['json', 'html']) === false) {
            this.#logger.debug('get: accepted=%o', req.accepted);
            return res.sendStatus(HttpStatus.NOT_ACCEPTABLE);
        }

        const { only } = query;
        if (only === 'count') {
            // Logik für Zählung (count)
            const count = await this.#service.count(query);
            this.#logger.debug('get: count=%d', count);
            return res.json({ count: count });
        }

        const { page, size } = query; // <-- Destrukturierung (Zeile 154)

        // Entferne Paginierungs-Schlüssel aus Query, um nur Suchparameter zu behalten
        delete query['page'];
        delete query['size'];
        delete query['only'];

        this.#logger.debug(
            'get: page=%s, size=%s',
            page ?? 'undefined',
            size ?? 'undefined',
        );

        // Entferne undefinierte Query-Parameter, um die Suche zu säubern
        const keys = Object.keys(query) as (keyof FussballvereinQuery)[];
        keys.forEach((key) => {
            if (query[key] === undefined) {
                delete query[key];
            }
        });
        this.#logger.debug('get: query (gesäubert)=%o', query);

        // Paginierungs- und Suchlogik implementieren
        const pageable = createPageable({ number: page, size });
        const vereineSlice = await this.#service.find(query, pageable);
        const vereinPage = createPage(vereineSlice, pageable);
        this.#logger.debug('get: vereinPage=%o', vereinPage);

        return res.json(vereinPage).send();
    }

    /**
     * Zu einem Verein mit gegebener ID wird das zugehörige Logo heruntergeladen.
     */
    @Get('/logo/:id')
    @Public()
    @ApiOperation({ description: 'Suche nach Logo mit der Vereins-ID' })
    @ApiParam({ name: 'id', description: 'Z.B. 1' })
    @ApiNotFoundResponse({ description: 'Kein Logo zur Vereins-ID gefunden' })
    @ApiOkResponse({ description: 'Das Logo wurde gefunden' })
    async getLogoById(
        @Param('id') idStr: string,
        @Res({ passthrough: true }) res: Response,
    ): Promise<StreamableFile> {
        this.#logger.debug('getLogoById: id:%s', idStr);

        const id = Number(idStr);
        if (!Number.isInteger(id)) {
            throw new NotFoundException(`Die ID ${idStr} ist ungueltig.`);
        }

        // Der Service liefert jetzt direkt das LogoFile-Objekt
        const logoFile = await this.#service.findLogoById(id);

        // Der Controller greift auf die korrekten Felder des LogoFile-Objekts zu
        res.contentType(logoFile.mimetype ?? 'application/octet-stream').set({
            'Content-Disposition': `inline; filename="${logoFile.filename}"`,
        });

        // Schickt den Buffer (logoFile.data) als StreamableFile zurück
        return new StreamableFile(logoFile.data);
    }
}
