/* eslint-disable @typescript-eslint/no-non-null-assertion */
// src/fussballverein/test/integration/graphql/query.test.mts

import { HttpStatus } from '@nestjs/common';
import { beforeAll, describe, expect, test } from 'vitest';
import { type FussballvereinMitAllen } from '../../../src/fussballverein/service/fussballverein-service.js';
import {
    ACCEPT,
    APPLICATION_JSON,
    CONTENT_TYPE,
    GRAPHQL_RESPONSE_JSON,
    POST,
    graphqlURL,
} from '../constants.mjs';
import { type GraphQLQuery } from './graphql.mjs';

// -----------------------------------------------------------------------------
// TYPDEFINITIONEN für Payloads (basierend auf query.ts)
// -----------------------------------------------------------------------------
type FussballvereinDTO = FussballvereinMitAllen; // Für findById (mit allen Relationen)

type SingleSuccessType = {
    data: { fussballverein: FussballvereinDTO };
    errors?: undefined;
};
type SearchSuccessType = {
    data: { fussballvereine: FussballvereinDTO[] };
    errors?: undefined;
};

export type ErrorsType = {
    message: string;
    path: string[];
    extensions: { code: string };
}[];
type SingleErrorsType = { data: { fussballverein: null }; errors: ErrorsType };
type SearchErrorsType = { data: { fussballvereine: null }; errors: ErrorsType };

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------
const idsVorhanden = [1, 2];
const nameArray = ['bayern', 'tsg'];
const nameNichtVorhanden = ['bundesliga', 'regionalliga'];
const mitgliederMin = [10000, 100000];
const mitgliederNichtVorhanden = 99999999;

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
// Test-Suite
describe('GraphQL Queries (Fussballverein)', () => {
    let headers: Headers;

    beforeAll(() => {
        headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(ACCEPT, GRAPHQL_RESPONSE_JSON);
    });

    // -------------------------------------------------------------------------
    // QUERY: findById (Einzelabruf)
    // -------------------------------------------------------------------------
    test.concurrent.each(idsVorhanden)(
        'Verein zu ID %i abrufen',
        async (id) => {
            // given
            const query: GraphQLQuery = {
                query: `
                {
                    fussballverein(id: "${id}") {
                        version
                        name
                        mitgliederanzahl
                        stadion {
                            stadt
                            kapazitaet
                        }
                        spieler {
                            vorname
                            nachname
                            alter
                        }
                    }
                }
            `,
            };

            // when
            const response = await fetch(graphqlURL, {
                method: POST,
                body: JSON.stringify(query),
                headers,
            });

            // then
            const { status } = response;

            expect(status).toBe(HttpStatus.OK);
            expect(response.headers.get(CONTENT_TYPE)).toMatch(
                /application\/graphql-response\+json/iu,
            );

            const { data, errors } =
                (await response.json()) as SingleSuccessType;

            expect(errors).toBeUndefined();
            expect(data).toBeDefined();

            const { fussballverein: verein } = data;

            // Prüft die Basisdaten und Relations
            expect(verein.name).toMatch(/^\w/u);
            expect(verein.version).toBeGreaterThan(-1);
            expect(verein.stadion).toBeDefined();
            expect(verein.spieler).toBeDefined();
        },
    );

    test.concurrent('Verein zu nicht-vorhandener ID', async () => {
        // given
        const id = '999999';
        const query: GraphQLQuery = {
            query: `
                {
                    fussballverein(id: "${id}") {
                        name
                    }
                }
            `,
        };

        // when
        const response = await fetch(graphqlURL, {
            method: POST,
            body: JSON.stringify(query),
            headers,
        });

        // then
        const { status } = response;

        expect(status).toBe(HttpStatus.OK);

        const { data, errors } = (await response.json()) as SingleErrorsType;

        expect(data.fussballverein).toBeNull();
        expect(errors).toHaveLength(1);

        const [error] = errors;
        const { message, path, extensions } = error!;

        // Fehler kommt von NotFoundException, gefiltert durch HttpExceptionFilter
        expect(message).toBe(`Es gibt keinen Verein mit der ID ${id}.`);
        expect(path).toBeDefined();
        expect(path![0]).toBe('fussballverein');
        expect(extensions).toBeDefined();
        expect(extensions!.code).toBe('BAD_USER_INPUT');
    });

    // -------------------------------------------------------------------------
    // QUERY: find (Suche)
    // -------------------------------------------------------------------------
    test.concurrent.each(nameArray)(
        'Vereine zu Teil-Name %s suchen',
        async (name) => {
            // given
            const query: GraphQLQuery = {
                query: `
                    {
                        fussballvereine(suchparameter: {
                            name: "${name}"
                        }) {
                            name
                        }
                    }
                `,
            };

            // when
            const response = await fetch(graphqlURL, {
                method: POST,
                body: JSON.stringify(query),
                headers,
            });

            // then
            const { status } = response;

            expect(status).toBe(HttpStatus.OK);

            const { data, errors } =
                (await response.json()) as SearchSuccessType;

            expect(errors).toBeUndefined();
            expect(data).toBeDefined();

            const { fussballvereine } = data;

            expect(fussballvereine).not.toHaveLength(0);

            // Prüft, ob jeder Name den Teilstring enthält
            fussballvereine.forEach((verein) =>
                expect(verein.name.toLowerCase()).toStrictEqual(
                    expect.stringContaining(name),
                ),
            );
        },
    );

    test.concurrent.each(nameNichtVorhanden)(
        'Verein zu nicht vorhandenem Teil-Name %s',
        async (name) => {
            // given
            const query: GraphQLQuery = {
                query: `
                    {
                        fussballvereine(suchparameter: {
                            name: "${name}"
                        }) {
                            name
                        }
                    }
                `,
            };

            // when
            const response = await fetch(graphqlURL, {
                method: POST,
                body: JSON.stringify(query),
                headers,
            });

            // then
            const { status } = response;

            expect(status).toBe(HttpStatus.OK);

            const { data, errors } =
                (await response.json()) as SearchErrorsType;

            expect(data.fussballvereine).toBeNull();
            expect(errors).toHaveLength(1);

            const [error] = errors;
            const { message, extensions } = error!;

            expect(message).toMatch(/^Keine Vereine gefunden:/u); // Erwartet Meldung aus Service
            expect(extensions!.code).toBe('BAD_USER_INPUT');
        },
    );

    test.concurrent.each(mitgliederMin)(
        'Vereine mit Mindest-Mitgliederanzahl %i',
        async (mitgliederanzahl) => {
            // given
            const query: GraphQLQuery = {
                query: `
                    {
                        fussballvereine(suchparameter: {
                            mitgliederanzahl: ${mitgliederanzahl}
                        }) {
                            mitgliederanzahl
                        }
                    }
                `,
            };

            // when
            const response = await fetch(graphqlURL, {
                method: POST,
                body: JSON.stringify(query),
                headers,
            });

            // then
            const { status } = response;

            expect(status).toBe(HttpStatus.OK);

            const { data, errors } =
                (await response.json()) as SearchSuccessType;

            expect(errors).toBeUndefined();
            expect(data).toBeDefined();

            const { fussballvereine } = data;

            expect(fussballvereine).not.toHaveLength(0);

            // Jedes Ergebnis muss die Mindest-Mitgliederanzahl erfüllen
            fussballvereine.forEach((verein) => {
                expect(verein.mitgliederanzahl).toBeGreaterThanOrEqual(
                    mitgliederanzahl,
                );
            });
        },
    );

    test.concurrent(
        'Kein Verein zu nicht-vorhandener Mitgliederanzahl',
        async () => {
            // given
            const rating = mitgliederNichtVorhanden;
            const query: GraphQLQuery = {
                query: `
                {
                    fussballvereine(suchparameter: {
                        mitgliederanzahl: ${rating}
                    }) {
                        name
                    }
                }
            `,
            };

            // when
            const response = await fetch(graphqlURL, {
                method: POST,
                body: JSON.stringify(query),
                headers,
            });

            // then
            const { status } = response;

            expect(status).toBe(HttpStatus.OK);

            const { data, errors } =
                (await response.json()) as SearchErrorsType;

            expect(data.fussballvereine).toBeNull();
            expect(errors).toHaveLength(1);

            const [error] = errors;
            const { message, extensions } = error!;

            expect(message).toMatch(/^Keine Vereine gefunden:/u);
            expect(extensions!.code).toBe('BAD_USER_INPUT');
        },
    );
});

/* eslint-enable @typescript-eslint/no-non-null-assertion */
