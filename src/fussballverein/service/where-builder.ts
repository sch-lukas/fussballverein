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

/**
 * Das Modul besteht aus der Klasse {@linkcode WhereBuilder}.
 * @packageDocumentation
 */

import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { type FussballvereinWhereInput } from '../../generated/prisma/models/Fussballverein.js';
import { getLogger } from '../../logger/logger.js';
import { type Suchparameter } from './suchparameter.js';

/**
 * Die Klasse `WhereBuilder` baut die WHERE-Klausel für DB-Anfragen mit _Prisma_.
 */
@Injectable()
export class WhereBuilder {
    readonly #logger = getLogger(WhereBuilder.name);

    /**
     * WHERE-Klausel für die flexible Suche nach Fussballvereinen bauen.
     *
     * Unterstützte Parameter:
     * - `name`: Teilstring, case-insensitive
     * - `gruendungsdatum`: untere Grenze (>=)
     * - `website`, `email`, `telefonnummer`: exakter Vergleich
     * - `mitgliederanzahl`: Mindestwert (>=)
     * - `stadt`: Teilstring via Relation `stadion`
     * - `kapazitaet`: Mindestwert (>=) via Relation `stadion`
     *
     * @param suchparameter JSON-Objekt mit Suchparametern.
     * @returns FussballvereinWhereInput
     */
    // eslint-disable-next-line max-lines-per-function, prettier/prettier, sonarjs/cognitive-complexity
    build(suchparameter: Suchparameter): FussballvereinWhereInput {
        this.#logger.debug('build: suchparameter=%o', suchparameter);

        let where: FussballvereinWhereInput = {};

        // Alle Parameter iterieren
        Object.entries(suchparameter ?? {}).forEach(([key, value]) => {
            switch (key) {
                case 'name':
                    where.name = {
                        contains: value as string,
                        mode: Prisma.QueryMode.insensitive,
                    };
                    break;

                case 'gruendungsdatum': {
                    const date = new Date(value as string);
                    if (!Number.isNaN(date.getTime())) {
                        where.gruendungsdatum = { gte: date };
                    }
                    break;
                }

                case 'website':
                    where.website = { equals: value as string };
                    break;

                case 'email':
                    where.email = { equals: value as string };
                    break;

                case 'telefonnummer':
                    where.telefonnummer = {
                        contains: value as string,
                        mode: Prisma.QueryMode.insensitive,
                    };
                    break;

                case 'mitgliederanzahl': {
                    const anzahl = Number.parseInt(value as string, 10);
                    if (!Number.isNaN(anzahl)) {
                        where.mitgliederanzahl = { gte: anzahl };
                    }
                    break;
                }

                case 'stadt':
                    where.stadion = {
                        is: {
                            stadt: {
                                contains: value as string,
                                mode: Prisma.QueryMode.insensitive,
                            },
                        },
                    };
                    break;

                case 'kapazitaet': {
                    const kapazitaet = Number.parseInt(value as string, 10);
                    if (!Number.isNaN(kapazitaet)) {
                        where.stadion = {
                            is: { kapazitaet: { gte: kapazitaet } },
                        };
                    }
                    break;
                }

                default:
                    this.#logger.debug('Unbekannter Suchparameter: %s', key);
                    break;
            }
        });

        this.#logger.debug('build: where=%o', where);
        return where;
    }
}
