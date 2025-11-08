// src/fussballverein/rest/fussballverein-post.test.ts (Final & Korrigiert)

import { HttpStatus } from '@nestjs/common';
import { beforeAll, describe, expect, test } from 'vitest';
import { type FussballvereinDto } from '../../../src/fussballverein/controller/fussballverein-dto.js';
// KORREKTUR: Importiere FussballvereinService, um auf ID_PATTERN zugreifen zu können
import { FussballvereinService } from '../../../src/fussballverein/service/fussballverein-service.js';
import {
    APPLICATION_JSON,
    AUTHORIZATION,
    BEARER,
    CONTENT_TYPE,
    LOCATION,
    POST,
    restURL,
} from '../constants.mjs';
import { getToken } from '../token.mjs';

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------

// Daten fuer einen neuen, vollstaendigen Verein (inkl. Stadion und Spieler)
const neuerVerein: FussballvereinDto = {
    name: `Testverein ${Date.now()}`, // Eindeutigen Namen generieren
    mitgliederanzahl: 50000,
    website: 'https://testverein-neu.com',
    email: 'kontakt@testverein-neu.com',
    telefonnummer: '+49-30-123456',
    // KORREKTUR: Vollstaendiges ISO-8601 Format fuer Prisma
    gruendungsdatum: '2020-07-20T00:00:00Z',
    stadion: {
        stadt: 'Berlin',
        kapazitaet: 60000,
        strasse: 'Testallee',
        hausnummer: '10',
    },
    spieler: [
        {
            vorname: 'Max',
            nachname: 'Mustermann',
            alter: 25,
            starkerFuss: 'Rechts',
        },
        {
            vorname: 'Lisa',
            nachname: 'Musterfrau',
            alter: 22,
            starkerFuss: 'Links',
        },
    ],
};

// Daten mit absichtlich ungueltigen Werten zur Validierung
const neuerVereinInvalid: Record<string, unknown> = {
    // name: 'a', <--- ENTFERNT, da dies g&uuml;ltig ist (keine MinLength)
    mitgliederanzahl: -1, // Muss >= 0 sein
    website: 'keine-url', // Falsche URL
    email: 'keine-email', // Falsches Format
    stadion: {
        stadt: '', // Darf nicht leer sein
        kapazitaet: 500000, // Zu hoch (Max 200000)
    },
    spieler: [
        {
            vorname: 'a',
            nachname: 'b',
            alter: 10, // Zu jung (Min 16)
            starkerFuss: 'Unbekannt', // Ungültiges Enum-Muster
        },
    ],
};

// Daten fuer den Konflikt-Test (Name Existiert bereits)
const nameExistiert = 'FC Bayern München'; // Angenommen, dieser existiert

type MessageType = { message: string | string[] };

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
describe('POST /rest/fussballvereine', () => {
    let tokenAdmin: string;
    let tokenUser: string;

    beforeAll(async () => {
        // Token fuer Erstellung notwendig (Roles('admin', 'user'))
        tokenAdmin = await getToken('admin', 'p');
        tokenUser = await getToken('user', 'p');
    });

    test('Neuen Fussballverein erstellen (201 Created)', async () => {
        // given
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(AUTHORIZATION, `${BEARER} ${tokenAdmin}`); // Admin-Token

        // when
        const response = await fetch(restURL, {
            method: POST,
            body: JSON.stringify(neuerVerein),
            headers,
        });

        // then
        const { status } = response;
        expect(status).toBe(HttpStatus.CREATED);

        const responseHeaders = response.headers;
        const location = responseHeaders.get(LOCATION);

        // Pruefe Location-Header
        expect(location).toBeDefined();

        // Extrahiere die ID aus dem Location-Header
        const indexLastSlash = location?.lastIndexOf('/') ?? -1;
        expect(indexLastSlash).not.toBe(-1);

        const idStr = location?.slice(indexLastSlash + 1);

        expect(idStr).toBeDefined();
        // Pruefe, ob die ID das korrekte Muster hat
        expect(FussballvereinService.ID_PATTERN.test(idStr ?? '')).toBe(true);
    });

    test.concurrent(
        'Neuen Verein mit ungueltigen Daten (400 Bad Request)',
        async () => {
            // given
            const headers = new Headers();
            headers.append(CONTENT_TYPE, APPLICATION_JSON);
            headers.append(AUTHORIZATION, `${BEARER} ${tokenUser}`);

            // Erwartete Fehlermeldungen: name wurde entfernt, da es g&uuml;ltig war
            const expectedMsgContains = [
                'mitgliederanzahl',
                'website',
                'email',
                'stadion.stadt',
                'stadion.kapazitaet',
                'spieler.0.alter',
                'spieler.0.starkerFuss',
            ];

            // when
            const response = await fetch(restURL, {
                method: POST,
                body: JSON.stringify(neuerVereinInvalid),
                headers,
            });

            // then
            const { status } = response;
            expect(status).toBe(HttpStatus.BAD_REQUEST);

            const body = (await response.json()) as MessageType;
            const messages = body.message as string[];

            expect(messages).toBeDefined();
            // Prueft, ob die Meldungen alle erwarteten ungueltigen Felder referenzieren
            expectedMsgContains.forEach((expectedPart) => {
                const found = messages.some((msg) =>
                    msg.includes(expectedPart),
                );
                expect(found).toBe(true);
            });
        },
    );

    test.concurrent(
        'Neuen Verein, aber ohne Token (401 Unauthorized)',
        async () => {
            // given
            const headers = new Headers();
            headers.append(CONTENT_TYPE, APPLICATION_JSON);

            // when
            const { status } = await fetch(restURL, {
                method: POST,
                body: JSON.stringify(neuerVerein),
                headers,
            });

            // then
            // Erwartet 401 Unauthorized, da AuthGuard aktiv ist
            expect(status).toBe(HttpStatus.UNAUTHORIZED);
        },
    );

    test.concurrent(
        'Neuen Verein, aber mit falschem Token (401 Unauthorized)',
        async () => {
            // given
            const headers = new Headers();
            headers.append(CONTENT_TYPE, APPLICATION_JSON);
            headers.append(AUTHORIZATION, `${BEARER} FALSCHER_TOKEN`);

            // when
            const { status } = await fetch(restURL, {
                method: POST,
                body: JSON.stringify(neuerVerein),
                headers,
            });

            // then
            expect(status).toBe(HttpStatus.UNAUTHORIZED);
        },
    );

    test.concurrent.todo('Abgelaufener Token');
});
