import { beforeAll, describe, expect, test } from 'vitest';
import {
    APPLICATION_JSON,
    AUTHORIZATION,
    BEARER,
    CONTENT_TYPE,
    GRAPHQL_RESPONSE_JSON,
    POST,
    graphqlURL,
} from '../constants.mjs';
import { getToken } from '../token.mjs';

let tokenAdmin: string;

const gqlFetch = async (query: string) => {
    const headers = new Headers();
    headers.append(CONTENT_TYPE, APPLICATION_JSON);
    headers.append(AUTHORIZATION, `${BEARER} ${tokenAdmin}`);
    headers.append('Accept', GRAPHQL_RESPONSE_JSON);

    return fetch(graphqlURL, {
        method: POST,
        body: JSON.stringify({ query }),
        headers,
    });
};

describe('GraphQL Mutation (Minimaltest)', () => {
    let createdId: string;

    beforeAll(async () => {
        tokenAdmin = await getToken('admin', 'p');
    });

    test('Verein erstellen', async () => {
        const name = `Testverein_${Date.now()}`;
        const mutation = `
            mutation {
                create(input: {
                    name: "${name}",
                    gruendungsdatum: "2025-01-01T00:00:00Z"
                }) {
                    id
                }
            }
        `;

        const response = await gqlFetch(mutation);

        expect(response.status).toBe(200);

        const body = await response.json();

        expect(body.data.create.id).toBeDefined();

        createdId = body.data.create.id; // speichern für später
    });

    test('Verein wieder löschen (DB Zustand wiederherstellen)', async () => {
        const mutation = `
            mutation {
                delete(id: "${createdId}") {
                    success
                }
            }
        `;

        const response = await gqlFetch(mutation);

        expect(response.status).toBe(200);

        const body = await response.json();

        expect(body.data.delete.success).toBe(true);
    });
});
