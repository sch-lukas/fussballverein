// src/fussballverein/rest/fussballverein-delete.test.ts (Angepasst)

import { HttpStatus } from '@nestjs/common';
import { beforeAll, describe, expect, test } from 'vitest';
import { AUTHORIZATION, BEARER, DELETE, restURL } from '../constants.mjs'; // Annahme: Wird importiert
import { getToken } from '../token.mjs'; // Annahme: Wird importiert

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------
const ID_ZU_LOESCHEN = '999';
const ID_NICHT_VORHANDEN = '999999';

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
// Test-Suite
describe('DELETE /rest/fussballvereine/:id', () => {
    let tokenAdmin: string;
    // tokenUser wird nicht mehr benötigt

    // Token einmalig fuer alle Tests abrufen
    beforeAll(async () => {
        tokenAdmin = await getToken('admin', 'p');
        // tokenUser = await getToken('user', 'p'); <-- Entfernt
    });

    test.concurrent(
        'Vorhandenen Verein als "admin" loeschen (204)',
        async () => {
            // given
            const url = `${restURL}/${ID_ZU_LOESCHEN}`;
            const headers = new Headers();
            headers.append(AUTHORIZATION, `${BEARER} ${tokenAdmin}`);

            // when
            const { status } = await fetch(url, {
                method: DELETE,
                headers,
            });

            // then
            expect(status).toBe(HttpStatus.NO_CONTENT);
        },
    );

    test.concurrent(
        'Nicht vorhandenen Verein als "admin" loeschen (204)',
        async () => {
            // given
            const url = `${restURL}/${ID_NICHT_VORHANDEN}`;
            const headers = new Headers();
            headers.append(AUTHORIZATION, `${BEARER} ${tokenAdmin}`);

            // when
            const { status } = await fetch(url, {
                method: DELETE,
                headers,
            });

            // then
            expect(status).toBe(HttpStatus.NO_CONTENT);
        },
    );

    test.concurrent(
        'Verein loeschen, aber ohne Token (401 Unauthorized)',
        async () => {
            // given
            const url = `${restURL}/${ID_ZU_LOESCHEN}`;

            // when
            const { status } = await fetch(url, { method: DELETE });

            // then
            expect(status).toBe(HttpStatus.UNAUTHORIZED);
        },
    );

    test.concurrent(
        'Verein loeschen, aber mit falschem Token (401 Unauthorized)',
        async () => {
            // given
            const url = `${restURL}/${ID_ZU_LOESCHEN}`;
            const headers = new Headers();
            headers.append(AUTHORIZATION, `${BEARER} FALSCHER_TOKEN`);

            // when
            const { status } = await fetch(url, {
                method: DELETE,
                headers,
            });

            // then
            expect(status).toBe(HttpStatus.UNAUTHORIZED);
        },
    );
});
