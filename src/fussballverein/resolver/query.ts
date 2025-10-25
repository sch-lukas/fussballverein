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

import { UseFilters, UseInterceptors } from '@nestjs/common';
import { Args, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import BigNumber from 'bignumber.js'; // eslint-disable-line @typescript-eslint/naming-convention
import { Public } from 'nest-keycloak-connect';
import { getLogger } from '../../logger/logger.js';
import { ResponseTimeInterceptor } from '../../logger/response-time.js';
import {
    fussballvereinService,
    type fussballvereinMitTitel,
    type fussballvereinMitTitelUndAbbildungen,
} from '../service/fussballverein-service.js';
import { createPageable } from '../service/pageable.js';
import { Slice } from '../service/slice.js';
import { Suchparameter } from '../service/suchparameter.js';
import { HttpExceptionFilter } from './http-exception-filter.js';

export type IdInput = {
    readonly id: string;
};

export type SuchparameterInput = {
    readonly suchparameter: Omit<Suchparameter, 'lieferbar'> & {
        lieferbar: boolean | undefined;
    };
};

@Resolver('fussballverein')
@UseFilters(HttpExceptionFilter)
@UseInterceptors(ResponseTimeInterceptor)
export class fussballvereinQueryResolver {
    readonly #service: fussballvereinService;

    readonly #logger = getLogger(fussballvereinQueryResolver.name);

    constructor(service: fussballvereinService) {
        this.#service = service;
    }

    @Query('fussballverein')
    @Public()
    async findById(
        @Args() { id }: IdInput,
    ): Promise<Readonly<fussballvereinMitTitelUndAbbildungen>> {
        this.#logger.debug('findById: id=%s', id);

        const fussballverein: Readonly<fussballvereinMitTitelUndAbbildungen> =
            await this.#service.findById({ id: Number(id) });

        this.#logger.debug('findById: fussballverein=%o', fussballverein);
        return fussballverein;
    }

    @Query('buecher')
    @Public()
    async find(
        @Args() input: SuchparameterInput | undefined,
    ): Promise<fussballvereinMitTitel[]> {
        this.#logger.debug('find: input=%s', JSON.stringify(input));
        const pageable = createPageable({});
        const suchparameter = input?.suchparameter;
        if (suchparameter !== undefined) {
            const { lieferbar } = suchparameter;
            if (lieferbar !== undefined) {
                // Boole'scher Wert bei GraphQL-Query
                // String bei Query-Parameter bei REST
                (suchparameter as any).lieferbar = lieferbar.toString();
            }
        }
        const buecherSlice: Readonly<Slice<Readonly<fussballvereinMitTitel>>> =
            await this.#service.find(suchparameter as any, pageable); // NOSONAR
        this.#logger.debug('find: buecherSlice=%o', buecherSlice);
        return buecherSlice.content;
    }

    @ResolveField('rabatt')
    rabatt(
        @Parent() fussballverein: fussballvereinMitTitel,
        short: boolean | undefined,
    ) {
        this.#logger.debug(
            'rabatt: fussballverein=%o, short=%s',
            fussballverein,
            short?.toString() ?? 'undefined',
        );
        // "Nullish Coalescing" ab ES2020
        const rabatt = fussballverein.rabatt ?? BigNumber(0);
        const shortStr = short === undefined || short ? '%' : 'Prozent';
        return `${rabatt.toString()} ${shortStr}`;
    }
}
