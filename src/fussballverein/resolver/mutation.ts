// Copyright (C) 2021 - present Juergen Zimmermann, Hochschule Karlsruhe
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
import { getLogger } from '../../logger/logger.ts';
import { ResponseTimeInterceptor } from '../../logger/response-time.ts';
import { fussballvereinDTO } from '../controller/fussballverein-dto.ts';
import {
    fussballvereinCreate,
    fussballvereinUpdate,
    fussballvereinWriteService,
} from '../service/fussballverein-write-service.ts';
import { HttpExceptionFilter } from './http-exception-filter.ts';
import { type IdInput } from './query.ts';

// Authentifizierung und Autorisierung durch
//  GraphQL Shield
//      https://www.graphql-shield.com
//      https://github.com/maticzav/graphql-shield
//      https://github.com/nestjs/graphql/issues/92
//      https://github.com/maticzav/graphql-shield/issues/213
//  GraphQL AuthZ
//      https://github.com/AstrumU/graphql-authz
//      https://www.the-guild.dev/blog/graphql-authz

export type CreatePayload = {
    readonly id: number;
};

export type UpdatePayload = {
    readonly version: number;
};

export type DeletePayload = {
    readonly success: boolean;
};

export class fussballvereinUpdateDTO extends fussballvereinDTO {
    @IsNumberString()
    readonly id!: string;

    @IsInt()
    @Min(0)
    readonly version!: number;
}
@Resolver('fussballverein')
// alternativ: globale Aktivierung der Guards https://docs.nestjs.com/security/authorization#basic-rbac-implementation
@UseGuards(AuthGuard)
@UseFilters(HttpExceptionFilter)
@UseInterceptors(ResponseTimeInterceptor)
export class fussballvereinMutationResolver {
    readonly #service: fussballvereinWriteService;

    readonly #logger = getLogger(fussballvereinMutationResolver.name);

    constructor(service: fussballvereinWriteService) {
        this.#service = service;
    }

    @Mutation()
    @Roles('admin', 'user')
    async create(@Args('input') fussballvereinDTO: fussballvereinDTO) {
        this.#logger.debug('create: fussballvereinDTO=%o', fussballvereinDTO);

        const fussballverein =
            this.#fussballvereinDtoTofussballvereinCreate(fussballvereinDTO);
        const id = await this.#service.create(fussballverein);
        this.#logger.debug('createfussballverein: id=%d', id);
        const payload: CreatePayload = { id };
        return payload;
    }

    @Mutation()
    @Roles('admin', 'user')
    async update(@Args('input') fussballvereinDTO: fussballvereinUpdateDTO) {
        this.#logger.debug('update: fussballverein=%o', fussballvereinDTO);

        const fussballverein =
            this.#fussballvereinUpdateDtoTofussballvereinUpdate(
                fussballvereinDTO,
            );
        const versionStr = `"${fussballvereinDTO.version.toString()}"`;

        const versionResult = await this.#service.update({
            id: Number.parseInt(fussballvereinDTO.id, 10),
            fussballverein,
            version: versionStr,
        });
        // TODO BadUserInputError
        this.#logger.debug(
            'updatefussballverein: versionResult=%d',
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

    #fussballvereinDtoTofussballvereinCreate(
        fussballvereinDTO: fussballvereinDTO,
    ): fussballvereinCreate {
        // "Optional Chaining" ab ES2020
        const abbildungen = fussballvereinDTO.abbildungen?.map((spielerDTO) => {
            const abbildung = {
                beschriftung: spielerDTO.beschriftung,
                contentType: spielerDTO.contentType,
            };
            return abbildung;
        });
        const fussballverein: fussballvereinCreate = {
            version: 0,
            isbn: fussballvereinDTO.isbn,
            rating: fussballvereinDTO.rating,
            art: fussballvereinDTO.art ?? null,
            preis: fussballvereinDTO.preis.toNumber(),
            rabatt: fussballvereinDTO.rabatt?.toNumber() ?? 0,
            lieferbar: fussballvereinDTO.lieferbar ?? false,
            datum: fussballvereinDTO.datum ?? null,
            homepage: fussballvereinDTO.homepage ?? null,
            schlagwoerter: fussballvereinDTO.schlagwoerter ?? [],
            titel: {
                create: {
                    titel: fussballvereinDTO.titel.titel,
                    untertitel: fussballvereinDTO.titel.untertitel ?? null,
                },
            },
            abbildungen: { create: abbildungen ?? [] },
        };
        return fussballverein;
    }

    #fussballvereinUpdateDtoTofussballvereinUpdate(
        fussballvereinDTO: fussballvereinUpdateDTO,
    ): fussballvereinUpdate {
        return {
            isbn: fussballvereinDTO.isbn,
            rating: fussballvereinDTO.rating,
            art: fussballvereinDTO.art ?? null,
            preis: fussballvereinDTO.preis.toNumber(),
            rabatt: fussballvereinDTO.rabatt?.toNumber() ?? 0,
            lieferbar: fussballvereinDTO.lieferbar ?? false,
            datum: fussballvereinDTO.datum ?? null,
            homepage: fussballvereinDTO.homepage ?? null,
            schlagwoerter: fussballvereinDTO.schlagwoerter ?? [],
        };
    }

    // #errorMsgCreatefussballverein(err: CreateError) {
    //     switch (err.type) {
    //         case 'IsbnExists': {
    //             return `Die ISBN ${err.isbn} existiert bereits`;
    //         }
    //         default: {
    //             return 'Unbekannter Fehler';
    //         }
    //     }
    // }

    // #errorMsgUpdatefussballverein(err: UpdateError) {
    //     switch (err.type) {
    //         case 'fussballvereinNotExists': {
    //             return `Es gibt kein fussballverein mit der ID ${err.id}`;
    //         }
    //         case 'VersionInvalid': {
    //             return `"${err.version}" ist keine gueltige Versionsnummer`;
    //         }
    //         case 'VersionOutdated': {
    //             return `Die Versionsnummer "${err.version}" ist nicht mehr aktuell`;
    //         }
    //         default: {
    //             return 'Unbekannter Fehler';
    //         }
    //     }
    // }
}
