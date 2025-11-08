/* eslint-disable @typescript-eslint/no-non-null-assertion */
// Copyright (C) 2025 - present Juergen Zimmermann, Hochschule Karlsruhe
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

import { HttpStatus } from '@nestjs/common';
import { beforeAll, describe, expect, test } from 'vitest';
import {
    ACCEPT,
    APPLICATION_JSON,
    AUTHORIZATION,
    BEARER,
    CONTENT_TYPE,
    GRAPHQL_RESPONSE_JSON,
    POST,
    graphqlURL,
} from '../constants.mjs';
import { getToken } from '../token.mjs';
import { type GraphQLQuery } from './graphql.mjs';

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------
const idLoeschen = '4';
const nameExistiert = 'FC Bayern München';

// -----------------------------------------------------------------------------
// TYPDEFINITIONEN für Payloads (basierend auf mutation.ts)
// -----------------------------------------------------------------------------
type ErrorsType = {
    message: string;
    path: string[];
    extensions: { code: string };
};

type CreateSuccessType = {
    data: { create: { id: string } };
    errors?: undefined;
};
type CreateErrorsType = { data: { create: null }; errors: ErrorsType[] };

type UpdateSuccessType = {
    data: { update: { version: number } };
    errors?: undefined;
};
type UpdateErrorsType = { data: { update: null }; errors: ErrorsType[] };

type DeleteSuccessType = {
    data: { delete: { success: boolean } };
    errors?: undefined;
};
type DeleteErrorsType = { data: { delete: null }; errors: ErrorsType[] };

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
// Test-Suite
describe('GraphQL Mutations (Fussballverein)', () => {
    let tokenAdmin: string;
    let tokenUser: string;

    beforeAll(async () => {
        tokenAdmin = await getToken('admin', 'p');
        tokenUser = await getToken('user', 'p');
    });

    // -------------------------------------------------------------------------
    // MUTATION: CREATE (Einfuegen)
    // -------------------------------------------------------------------------
    test('Neuen Fussballverein erstellen (success)', async () => {
        // given
        const neuerName = `Testverein-${Date.now()}`;
        const mutation: GraphQLQuery = {
            query: `
                mutation {
                    create(
                        input: {
                            name: "${neuerName}",
                            mitgliederanzahl: 1000,
                            website: "https://new.test",
                            email: "new@test.com",
                            gruendungsdatum: "2025-01-01T00:00:00Z",
                            stadion: {
                                stadt: "Neuhausen",
                                kapazitaet: 10000,
                            },
                            spieler: [{
                                vorname: "Neo",
                                nachname: "Spieler",
                                alter: 20,
                                starkerFuss: Rechts
                            }]
                        }
                    ) {
                        id
                    }
                }
            `,
        };
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(ACCEPT, GRAPHQL_RESPONSE_JSON);
        headers.append(AUTHORIZATION, `${BEARER} ${tokenAdmin}`);

        // when
        const response = await fetch(graphqlURL, {
            method: POST,
            body: JSON.stringify(mutation),
            headers,
        });

        // then
        const { status } = response;
        expect(status).toBe(HttpStatus.OK);

        const { data, errors } = (await response.json()) as CreateSuccessType;

        expect(errors).toBeUndefined();
        expect(data).toBeDefined();

        const { create } = data;
        // Der Wert der Mutation ist die generierte ID
        expect(create).toBeDefined();

        const { id } = create;
        expect(parseInt(id, 10)).toBeGreaterThan(0);
    });

    test('Verein mit ungueltigen Werten neu anlegen (400 Bad Request / BAD_USER_INPUT)', async () => {
        // given
        const mutation: GraphQLQuery = {
            query: `
                mutation {
                    create(
                        input: {
                            name: "",         # Ungueltig
                            mitgliederanzahl: -5, # Ungueltig
                            email: "falsch",  # Ungueltig
                            gruendungsdatum: "2025-01-01", # Ungueltig (keine Zeit/Zone)
                            stadion: {
                                stadt: "",    # Ungueltig
                                kapazitaet: 300000 # Ungueltig
                            }
                        }
                    ) {
                        id
                    }
                }
            `,
        };
        // Erwartete Fehlermeldungen (nur eine Nachricht mit allen Fehlern)
        const expectedMsgParts = [
            'name must be longer than or equal to 1 characters',
            'mitgliederanzahl must not be less than 0',
            'email must be an email',
            'gruendungsdatum must be a valid ISO 8601 date string',
            'stadion.stadt should not be empty',
            'stadion.kapazitaet must not be greater than 200000',
        ];
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(ACCEPT, GRAPHQL_RESPONSE_JSON);
        headers.append(AUTHORIZATION, `${BEARER} ${tokenAdmin}`);

        // when
        const response = await fetch(graphqlURL, {
            method: POST,
            body: JSON.stringify(mutation),
            headers,
        });

        // then
        expect(response.status).toBe(HttpStatus.OK);

        const { data, errors } = (await response.json()) as CreateErrorsType;

        expect(data.create).toBeNull();
        expect(errors).toHaveLength(1);

        const [error] = errors; // error ist jetzt ErrorsType | undefined

        expect(error).toBeDefined(); // Explizite Zusicherung

        const { message, extensions } = error!; // Non-Null Operator für Destrukturierung

        // Prueft, ob der Fehlercode korrekt aus der Exception gefiltert wurde
        expect(extensions.code).toBe('BAD_USER_INPUT');

        // Prueft, ob die Fehlermeldung alle erwarteten Validierungsfehler enthält
        expectedMsgParts.forEach((part) => expect(message).toContain(part));
    });

    test('Verein mit Name existiert bereits (422 / BAD_USER_INPUT)', async () => {
        // given
        const mutation: GraphQLQuery = {
            query: `
                mutation {
                    create(
                        input: {
                            name: "${nameExistiert}", # Konflikt
                            gruendungsdatum: "2025-01-01T00:00:00Z"
                        }
                    ) {
                        id
                    }
                }
            `,
        };
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(AUTHORIZATION, `${BEARER} ${tokenAdmin}`);

        // when
        const response = await fetch(graphqlURL, {
            method: POST,
            body: JSON.stringify(mutation),
            headers,
        });

        // then
        expect(response.status).toBe(HttpStatus.OK);
        const { data, errors } = (await response.json()) as CreateErrorsType;

        expect(data.create).toBeNull();
        expect(errors).toHaveLength(1);

        const [error] = errors; // error ist jetzt ErrorsType | undefined
        expect(error).toBeDefined();

        expect(error.extensions.code).toBe('BAD_USER_INPUT'); // NameExistsException wird zu 422/BAD_USER_INPUT
        expect(error.message).toContain(
            `Der Vereinsname "${nameExistiert}" existiert bereits`,
        );
    });

    // -------------------------------------------------------------------------
    // MUTATION: UPDATE (Aktualisieren)
    // -------------------------------------------------------------------------
    test('Verein aktualisieren mit Optimistischer Sperre (success)', async () => {
        // ID 1 (FC Bayern M&uuml;nchen) hat version 1. Wir senden 1.
        const idVorhanden = '1';
        const mutation: GraphQLQuery = {
            query: `
                mutation {
                    update(
                        input: {
                            id: "${idVorhanden}",
                            version: 1, # Aktuelle Version
                            name: "FC Bayern München NEU",
                            gruendungsdatum: "2025-04-04T00:00:00Z",
                            email: "neue@email.com"
                        }
                    ) {
                        version
                    }
                }
            `,
        };
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(AUTHORIZATION, `${BEARER} ${tokenAdmin}`);

        // when
        const response = await fetch(graphqlURL, {
            method: POST,
            body: JSON.stringify(mutation),
            headers,
        });

        // then
        expect(response.status).toBe(HttpStatus.OK);
        const { data, errors } = (await response.json()) as UpdateSuccessType;

        expect(errors).toBeUndefined();
        // Erwartet: Die inkrementierte Version (1 + 1 = 2)
        expect(data.update.version).toBe(2);
    });

    test('Verein mit alter Versionsnummer aktualisieren (412 / BAD_USER_INPUT)', async () => {
        // given
        const idVorhanden = '1';
        const mutation: GraphQLQuery = {
            query: `
                mutation {
                    update(
                        input: {
                            id: "${idVorhanden}",
                            version: -1, # Veraltete Version
                            name: "FC Bayern München Veraltet"
                        }
                    ) {
                        version
                    }
                }
            `,
        };
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(AUTHORIZATION, `${BEARER} ${tokenAdmin}`);

        // when
        const response = await fetch(graphqlURL, {
            method: POST,
            body: JSON.stringify(mutation),
            headers,
        });

        // then
        expect(response.status).toBe(HttpStatus.OK);
        const { data, errors } = (await response.json()) as UpdateErrorsType;

        expect(data.update).toBeNull();
        expect(errors).toHaveLength(1);

        const [error] = errors!; // KORREKTUR: Non-Null Operator hier
        expect(error).toBeDefined();

        expect(error.extensions.code).toBe('BAD_USER_INPUT'); // VersionOutdatedException
        expect(error.message).toContain(
            'Die Versionsnummer -1 ist nicht aktuell',
        );
        expect(error.path![0]).toBe('update');
    });

    // -------------------------------------------------------------------------
    // MUTATION: DELETE (Loeschen)
    // -------------------------------------------------------------------------
    test('Verein loeschen als "admin" (success)', async () => {
        // given
        const mutation: GraphQLQuery = {
            query: `
                mutation {
                    delete(id: "${idLoeschen}") {
                        success
                    }
                }
            `,
        };
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(AUTHORIZATION, `${BEARER} ${tokenAdmin}`);

        // when
        const response = await fetch(graphqlURL, {
            method: POST,
            body: JSON.stringify(mutation),
            headers,
        });

        // then
        expect(response.status).toBe(HttpStatus.OK);
        const { data, errors } = (await response.json()) as DeleteSuccessType;

        expect(errors).toBeUndefined();
        expect(data.delete.success).toBe(true);
    });

    test('Verein loeschen als "user" (Forbidden / BAD_USER_INPUT)', async () => {
        // given
        const idLoeschenForbidden = '3'; // Barcelona
        const mutation: GraphQLQuery = {
            query: `
                mutation {
                    delete(id: "${idLoeschenForbidden}") {
                        success
                    }
                }
            `,
        };
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(AUTHORIZATION, `${BEARER} ${tokenUser}`); // User-Token

        // when
        const response = await fetch(graphqlURL, {
            method: POST,
            body: JSON.stringify(mutation),
            headers,
        });

        // then
        expect(response.status).toBe(HttpStatus.OK);
        const { data, errors } = (await response.json()) as DeleteErrorsType;

        expect(data.delete).toBeNull();
        expect(errors).toHaveLength(1);

        const [error] = errors!;
        expect(error).toBeDefined();

        expect(error.extensions.code).toBe('BAD_USER_INPUT');
        expect(error.message).toBe('Forbidden resource');
    });
});
/* eslint-enable @typescript-eslint/no-non-null-assertion */
