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

import { UseFilters, UseInterceptors } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { Public } from 'nest-keycloak-connect';
import { getLogger } from '../../logger/logger.js';
import { ResponseTimeInterceptor } from '../../logger/response-time.js';
import {
    FussballvereinService,
    type FussballvereinMitAllen,
    type FussballvereinMitBasis,
} from '../service/fussballverein-service.js';
import { createPageable } from '../service/pageable.js';
import { type Slice } from '../service/slice.js';
import { type Suchparameter } from '../service/suchparameter.js';
import { HttpExceptionFilter } from './http-exception-filter.js';

export type IdInput = {
    readonly id: string;
};

export type SuchparameterInput = {
    readonly suchparameter: Suchparameter | undefined;
};

@Resolver('Fussballverein')
@UseFilters(HttpExceptionFilter)
@UseInterceptors(ResponseTimeInterceptor)
export class FussballvereinQueryResolver {
    readonly #service: FussballvereinService;

    readonly #logger = getLogger(FussballvereinQueryResolver.name);

    constructor(service: FussballvereinService) {
        this.#service = service;
    }

    @Query('fussballverein')
    @Public()
    async findById(
        @Args() { id }: IdInput,
    ): Promise<Readonly<FussballvereinMitAllen>> {
        this.#logger.debug('findById: id=%s', id);

        // Bei der Detailansicht typischerweise alle Relationen laden
        const verein = await this.#service.findById({
            id: Number(id),
            mitSpielern: true,
            mitStadion: true,
            mitLogo: true,
        });

        this.#logger.debug('findById: verein=%o', verein);
        return verein;
    }

    @Query('fussballvereine')
    @Public()
    async find(
        @Args() input: SuchparameterInput | undefined,
    ): Promise<Readonly<FussballvereinMitBasis>[]> {
        this.#logger.debug('find: input=%s', JSON.stringify(input));
        const pageable = createPageable({});
        const suchparameter = input?.suchparameter;

        const vereineSlice: Readonly<Slice<Readonly<FussballvereinMitBasis>>> =
            await this.#service.find(suchparameter, pageable);

        this.#logger.debug('find: vereineSlice=%o', vereineSlice);
        return vereineSlice.content;
    }
}
