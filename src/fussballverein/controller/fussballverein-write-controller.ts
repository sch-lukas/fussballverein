// src/fussballverein/controller/fussballverein-write.controller.ts

import {
    Body,
    Controller,
    Delete,
    Headers,
    HttpCode,
    HttpStatus,
    Param,
    ParseIntPipe,
    Post,
    Put,
    Req,
    Res,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
    ApiBadRequestResponse,
    ApiCreatedResponse,
    ApiForbiddenResponse,
    ApiHeader,
    ApiNoContentResponse,
    ApiOperation,
    ApiPreconditionFailedResponse,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { paths } from '../../config/paths.js';
import { getLogger } from '../../logger/logger.js';
import { ResponseTimeInterceptor } from '../../logger/response-time.js';
import {
    FussballvereinWriteService,
    type FussballvereinCreate,
    type FussballvereinUpdate,
} from '../service/fussballverein-write-service.js';
import { createBaseUri } from './create-base-uri.js';
import {
    FussballvereinDto,
    FussballvereinDtoOhneRef,
} from './fussballverein-dto.js';

// Annahme: Du hast Authentifizierung, ansonsten können die Guards entfernt werden
import { AuthGuard, Roles } from 'nest-keycloak-connect';
const MSG_FORBIDDEN = 'Kein Token mit ausreichender Berechtigung vorhanden';

@Controller(paths.rest)
@UseGuards(AuthGuard) // Annahme: Authentifizierung ist aktiv
@UseInterceptors(ResponseTimeInterceptor)
@ApiTags('Fussballverein REST-API (Schreiben)')
export class FussballvereinWriteController {
    readonly #service: FussballvereinWriteService;
    readonly #logger = getLogger(FussballvereinWriteController.name);

    constructor(service: FussballvereinWriteService) {
        this.#service = service;
    }

    /**
     * Ein neuer Fussballverein wird asynchron angelegt.
     */
    @Post()
    @Roles('admin', 'user') // Annahme: Rollenbasierte Berechtigung
    @ApiOperation({ summary: 'Einen neuen Fussballverein anlegen' })
    @ApiCreatedResponse({ description: 'Erfolgreich neu angelegt' })
    @ApiBadRequestResponse({ description: 'Fehlerhafte Vereinsdaten' })
    @ApiForbiddenResponse({ description: MSG_FORBIDDEN })
    async post(
        @Body() fussballvereinDto: FussballvereinDto,
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<Response> {
        this.#logger.debug('post: fussballvereinDto=%o', fussballvereinDto);

        const verein = this.#dtoToCreateInput(fussballvereinDto);
        const id = await this.#service.create(verein);

        const location = `${createBaseUri(req)}/${id}`;
        this.#logger.debug('post: location=%s', location);
        return res.location(location).send();
    }

    /**
     * Zu einem gegebenen Verein wird das Logo hochgeladen.
     */
    @Post('/logo/:id')
    @Roles('admin', 'user')
    @UseInterceptors(FileInterceptor('logo')) // Multer für das Feld 'logo'
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Logo für einen Verein hochladen' })
    @ApiCreatedResponse({ description: 'Logo erfolgreich hochgeladen' })
    @ApiBadRequestResponse({ description: 'Fehlerhafte Datei' })
    async addLogo(
        @Param(
            'id',
            new ParseIntPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND }),
        )
        id: number,
        @UploadedFile() file: Express.Multer.File,
    ): Promise<void> {
        this.#logger.debug('addLogo: id=%d, file=%s', id, file.originalname);
        const { buffer, originalname, size } = file;

        // Ruft die 'addFile'-Methode aus deinem Service auf
        await this.#service.addFile(id, buffer, originalname, size);
    }

    /**
     * Ein vorhandener Fussballverein wird asynchron aktualisiert.
     */
    @Put(':id')
    @Roles('admin', 'user')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Einen vorhandenen Verein aktualisieren' })
    @ApiHeader({
        name: 'If-Match',
        description: 'Header für optimistische Synchronisation, z.B. "0"',
        required: true,
    })
    @ApiNoContentResponse({ description: 'Erfolgreich aktualisiert' })
    @ApiBadRequestResponse({ description: 'Fehlerhafte Vereinsdaten' })
    @ApiPreconditionFailedResponse({
        description: 'Falsche Version im Header "If-Match"',
    })
    @ApiResponse({
        status: HttpStatus.PRECONDITION_REQUIRED,
        description: 'Header "If-Match" fehlt',
    })
    async put(
        @Body() fussballvereinDto: FussballvereinDtoOhneRef,
        @Param(
            'id',
            new ParseIntPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND }),
        )
        id: number,
        @Headers('If-Match') version: string | undefined,
        @Res() res: Response,
    ): Promise<Response> {
        this.#logger.debug(
            'put: id=%d, fussballvereinDto=%o, version=%s',
            id,
            fussballvereinDto,
            version,
        );

        if (version === undefined) {
            return res
                .status(HttpStatus.PRECONDITION_REQUIRED)
                .send('Header "If-Match" fehlt');
        }

        const verein = this.#dtoToUpdateInput(fussballvereinDto);
        const neueVersion = await this.#service.update({ id, verein, version });

        this.#logger.debug('put: neueVersion=%d', neueVersion);
        return res.header('ETag', `"${neueVersion}"`).send();
    }

    /**
     * Ein Fussballverein wird anhand seiner ID gelöscht.
     */
    @Delete(':id')
    @Roles('admin') // Nur Admins dürfen löschen
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Verein mit der ID löschen' })
    @ApiNoContentResponse({
        description: 'Der Verein wurde gelöscht oder war nicht vorhanden',
    })
    @ApiForbiddenResponse({ description: MSG_FORBIDDEN })
    async delete(@Param('id') id: number): Promise<void> {
        this.#logger.debug('delete: id=%d', id);
        await this.#service.delete(id);
    }

    /**
     * Hilfsmethode: Wandelt ein DTO in das Prisma-Format für `create` um.
     */
    #dtoToCreateInput(dto: FussballvereinDto): FussballvereinCreate {
        const spielerCreate = dto.spieler?.map((s) => ({
            vorname: s.vorname,
            nachname: s.nachname,
            alter: s.alter ?? null,
            starkerFuss: s.starkerFuss ?? null,
        }));

        const createInput: FussballvereinCreate = {
            name: dto.name,
            mitgliederanzahl: dto.mitgliederanzahl ?? null,
            website: dto.website ?? null,
            email: dto.email ?? null,
            telefonnummer: dto.telefonnummer ?? null,
            gruendungsdatum: dto.gruendungsdatum ?? null,
        };

        if (dto.stadion) {
            createInput.stadion = { create: dto.stadion };
        }
        if (spielerCreate) {
            createInput.spieler = { create: spielerCreate };
        }

        return createInput;
    }

    /**
     * Hilfsmethode: Wandelt ein DTO in das Prisma-Format für `update` um.
     */
    #dtoToUpdateInput(dto: FussballvereinDtoOhneRef): FussballvereinUpdate {
        // KORREKTUR: Cast auf 'any' um den strikten Typ-Check zu umgehen
        return {
            name: dto.name,
            mitgliederanzahl: dto.mitgliederanzahl,
            website: dto.website,
            email: dto.email,
            telefonnummer: dto.telefonnummer,
            gruendungsdatum: dto.gruendungsdatum,
        } as any;
    }
}
