// src/fussballverein/rest/fussballverein-get-by-id.test.ts

import { HttpStatus } from '@nestjs/common';
import { beforeAll, describe, expect, test } from 'vitest';
import {
    AUTHORIZATION,
    BEARER,
    CONTENT_TYPE,
    IF_NONE_MATCH,
    restURL,
} from '../constants.mjs';
import { getToken } from '../token.mjs'; // Annahme: Wird importiert

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------
// IDs 1 und 2 sind vorhanden (FC Bayern München, TSG Hoffenheim)
const idsVorhanden = [1, 2];
const idNichtVorhanden = 999999;
const idFalsch = 'xyz';

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
describe('GET /rest/fussballvereine/:id (Lesen)', () => {
    let tokenUser: string; // Token wird fuer alle Lese-Tests benötigt, da @Roles('admin', 'user')

    beforeAll(async () => {
        // Token mit der Rolle 'user' abrufen
        tokenUser = await getToken('user', 'p');
    });

    test.concurrent.each(idsVorhanden)(
        'Verein zu vorhandener ID %i abrufen (200 OK)',
        async (id) => {
            // given
            const url = `${restURL}/${id}`;
            const headers = new Headers();
            // Auth-Header hinzufügen, um 401 Unauthorized zu verhindern
            headers.append(AUTHORIZATION, `${BEARER} ${tokenUser}`);

            // when
            const response = await fetch(url, { headers });
            const { status, headers: responseHeaders } = response;

            // then
            expect(status).toBe(HttpStatus.OK);
            expect(responseHeaders.get(CONTENT_TYPE)).toMatch(/json/iu);
            expect(responseHeaders.get('ETag')).toBeDefined();

            const body = (await response.json()) as { id: number };
            expect(body.id).toBe(id);
        },
    );

    test.concurrent(
        'Kein Verein zu nicht-vorhandener ID (404 Not Found)',
        async () => {
            // given
            const url = `${restURL}/${idNichtVorhanden}`;
            const headers = new Headers();
            headers.append(AUTHORIZATION, `${BEARER} ${tokenUser}`);

            // when
            const { status } = await fetch(url, { headers });

            // then
            expect(status).toBe(HttpStatus.NOT_FOUND);
        },
    );

    test.concurrent('Kein Verein zu falscher ID (404 Not Found)', async () => {
        // given
        const url = `${restURL}/${idFalsch}`;
        const headers = new Headers();
        headers.append(AUTHORIZATION, `${BEARER} ${tokenUser}`);

        // when
        const { status } = await fetch(url, { headers });

        // then
        // Erwartet 404, da die ParseIntPipe fehlschlaegt
        expect(status).toBe(HttpStatus.NOT_FOUND);
    });

    test.concurrent.each(idsVorhanden)(
        'Verein zu ID %i mit korrekter If-None-Match Version (304 Not Modified)',
        async (id) => {
            // given
            const url = `${restURL}/${id}`;

            // 1. Zuerst aktuelle Version mit Auth abrufen
            const authHeaders = new Headers();
            authHeaders.append(AUTHORIZATION, `${BEARER} ${tokenUser}`);
            const initialResponse = await fetch(url, { headers: authHeaders });

            // Wenn der Token korrekt ist, sollte 200 OK kommen
            expect(initialResponse.status).toBe(HttpStatus.OK);
            const actualETag = initialResponse.headers.get('ETag');
            expect(actualETag).toBeDefined();

            // 2. Erneuten Request mit If-None-Match und Auth senden
            const requestHeaders = new Headers();
            requestHeaders.append(AUTHORIZATION, `${BEARER} ${tokenUser}`);
            // Header: If-None-Match mit dem gerade erhaltenen ETag
            requestHeaders.append(IF_NONE_MATCH, actualETag as string);

            // when
            const response = await fetch(url, { headers: requestHeaders });
            const { status } = response;

            // then
            // Erwartet 304, da If-None-Match = ETag
            expect(status).toBe(HttpStatus.NOT_MODIFIED);
            const body = await response.text();
            expect(body).toBe('');
        },
    );

    test.concurrent.each(idsVorhanden)(
        'Verein zu ID %i mit falscher If-None-Match Version (200 OK)',
        async (id) => {
            // given
            const url = `${restURL}/${id}`;
            const headers = new Headers();
            headers.append(AUTHORIZATION, `${BEARER} ${tokenUser}`);
            // Version "0" ist absichtlich falsch, um 200 OK zu erzwingen
            headers.append(IF_NONE_MATCH, '"0"');

            // when
            const { status, headers: resultHeaders } = await fetch(url, {
                headers,
            });

            // then
            // Erwartet 200 OK, da der ETag "1" (aus DB) NICHT mit "0" übereinstimmt
            expect(status).toBe(HttpStatus.OK);
            expect(resultHeaders.get('ETag')).toBeDefined();
            // Erwartet, dass der neue (aktuelle) ETag zurückkommt
            expect(resultHeaders.get('ETag')).toBe('"1"');
        },
    );
});
