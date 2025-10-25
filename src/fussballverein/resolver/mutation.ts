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

// eslint-disable-next-line max-classes-per-file
import { UseFilters, UseGuards, UseInterceptors } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { IsInt, IsNumberString, Min } from 'class-validator';
import { AuthGuard, Roles } from 'nest-keycloak-connect';
import { getLogger } from '../../logger/logger.js';
import { ResponseTimeInterceptor } from '../../logger/response-time.js';

import { FussballvereinDto } from '../controller/fussballverein-dto.js';
import {
    FussballvereinWriteService,
    type FussballvereinCreate,
    type FussballvereinUpdate,
} from '../service/fussballverein-write-service.js';
import { HttpExceptionFilter } from './http-exception-filter.js';
import { type IdInput } from './query.js';

// Authentifizierung und Autorisierung durch
//  GraphQL Shield / GraphQL AuthZ (analog zum Buch-Beispiel)

export type CreatePayload = {
    readonly id: number;
};

export type UpdatePayload = {
    readonly version: number;
};

export type DeletePayload = {
    readonly success: boolean;
};

export class FussballvereinUpdateDTO extends FussballvereinDto {
    @IsNumberString()
    readonly id!: string;

    @IsInt()
    @Min(0)
    readonly version!: number;
}

@Resolver('Fussballverein')
// alternativ: globale Aktivierung der Guards https://docs.nestjs.com/security/authorization#basic-rbac-implementation
@UseGuards(AuthGuard)
@UseFilters(HttpExceptionFilter)
@UseInterceptors(ResponseTimeInterceptor)
export class FussballvereinMutationResolver {
    readonly #service: FussballvereinWriteService;

    readonly #logger = getLogger(FussballvereinMutationResolver.name);

    constructor(service: FussballvereinWriteService) {
        this.#service = service;
    }

    @Mutation()
    @Roles('admin', 'user')
    async create(@Args('input') dto: FussballvereinDto) {
        this.#logger.debug('create: dto=%o', dto);

        const verein = this.#dtoToCreate(dto);
        const id = await this.#service.create(verein);

        this.#logger.debug('createFussballverein: id=%d', id);
        const payload: CreatePayload = { id };
        return payload;
    }

    @Mutation()
    @Roles('admin', 'user')
    async update(@Args('input') dto: FussballvereinUpdateDTO) {
        this.#logger.debug('update: dto=%o', dto);

        const verein = this.#dtoToUpdate(dto);
        const versionStr = `"${dto.version.toString()}"`;

        const versionResult = await this.#service.update({
            id: Number.parseInt(dto.id, 10),
            verein,
            version: versionStr,
        });

        this.#logger.debug(
            'updateFussballverein: versionResult=%d',
            versionResult,
        );
        const payload: UpdatePayload = { version: versionResult };
        return payload;
    }

    @Mutation()
    @Roles('admin')
    async delete(@Args() id: IdInput) {
        const idValue = id.id;
        this.#logger.debug('delete: idValue=%s', idValue);

        await this.#service.delete(Number(idValue));
        const payload: DeletePayload = { success: true };
        return payload;
    }

    // -------------------------------------------------------------------------
    // Mapping-Helper
    // -------------------------------------------------------------------------

    #dtoToCreate(dto: FussballvereinDto): FussballvereinCreate {
        // Nested Create für Stadion (optional)
        const stadionCreate =
            dto.stadion === undefined
                ? undefined
                : {
                      create: {
                          stadt: dto.stadion.stadt,
                          strasse: dto.stadion.strasse ?? null,
                          hausnummer: dto.stadion.hausnummer ?? null,
                          kapazitaet: dto.stadion.kapazitaet,
                      },
                  };

        // Nested Create für Spieler (optional)
        const spielerCreate =
            dto.spieler === undefined
                ? undefined
                : {
                      create: dto.spieler.map((s) => ({
                          vorname: s.vorname,
                          nachname: s.nachname,
                          alter: s.alter ?? null,
                          // In deinem Prisma-Client heißt es laut Fehlermeldungen `starkerFuss` (camelCase)
                          starkerFuss: s.starkerFuss ?? null,
                      })),
                  };

        const verein: FussballvereinCreate = {
            version: 0,
            name: dto.name,
            gruendungsdatum: dto.gruendungsdatum ?? null,
            website: dto.website ?? null,
            email: dto.email ?? null,
            telefonnummer: dto.telefonnummer ?? null,
            mitgliederanzahl:
                dto.mitgliederanzahl !== undefined
                    ? Number(dto.mitgliederanzahl)
                    : null,
            ...(stadionCreate !== undefined ? { stadion: stadionCreate } : {}),
            ...(spielerCreate !== undefined ? { spieler: spielerCreate } : {}),
        };
        return verein;
    }

    #dtoToUpdate(dto: FussballvereinUpdateDTO): FussballvereinUpdate {
        // Hinweis: Nested Updates (stadion/spieler) sind hier bewusst nicht enthalten.
        // Wenn benötigt, kann man sie analog mit `upsert/update/create/deleteMany` ergänzen.
        const verein: FussballvereinUpdate = {
            name: dto.name,
            gruendungsdatum: dto.gruendungsdatum ?? null,
            website: dto.website ?? null,
            email: dto.email ?? null,
            telefonnummer: dto.telefonnummer ?? null,
            mitgliederanzahl:
                dto.mitgliederanzahl !== undefined
                    ? Number(dto.mitgliederanzahl)
                    : null,
        };
        return verein;
    }
}
