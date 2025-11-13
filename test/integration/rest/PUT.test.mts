// src/fussballverein/rest/fussballverein-put.test.ts

import { HttpStatus } from '@nestjs/common';
import { beforeAll, describe, expect, test } from 'vitest';
import { type FussballvereinDtoOhneRef } from '../../../src/fussballverein/controller/fussballverein-dto.js';
import {
    APPLICATION_JSON,
    AUTHORIZATION,
    BEARER,
    CONTENT_TYPE,
    IF_MATCH,
    PUT,
    restURL,
} from '../constants.mjs';
import { getToken } from '../token.mjs';

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------
// ID 1 ist vorhanden (FC Bayern München)
const idVorhanden = '1';
const idNichtVorhanden = '999999';

// Daten zur Aktualisierung (muss FussballvereinDtoOhneRef entsprechen)
const geaenderterVerein: FussballvereinDtoOhneRef = {
    name: 'FC Bayern München (Geadnert)',
    mitgliederanzahl: 310000,
    website: 'https://fcbayern-geandert.com',
    email: 'kontakt@geandert.com',
    telefonnummer: '+49-89-111111',
    // HINWEIS: Hier wurde das Datum im DTO korrigiert, um ISO-8601 zu erfüllen
    gruendungsdatum: '1900-02-27T00:00:00Z',
};

// Daten zur Aktualisierung einer nicht vorhandenen ID
const geaenderterVereinIdNichtVorhanden: FussballvereinDtoOhneRef = {
    name: 'Verein Nicht Vorhanden',
    mitgliederanzahl: 10,
    gruendungsdatum: '2020-01-01T00:00:00Z',
};

// Daten zur Invalidierung
const geaenderterVereinInvalid: Record<string, unknown> = {
    name: '', // Darf nicht leer sein
    mitgliederanzahl: -1, // Muss >= 0 sein
    website: 'keine-url', // Falsche URL
    email: 'keine-email', // Falsches Format
};

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
// Test-Suite
describe('PUT /rest/fussballvereine/:id', () => {
    let tokenAdmin: string;
    let tokenUser: string;

    beforeAll(async () => {
        tokenAdmin = await getToken('admin', 'p');
        tokenUser = await getToken('user', 'p');
    });

    // -------------------------------------------------------------------------
    // Erfolgsfall (inkl. Optimistischer Sperre)
    // -------------------------------------------------------------------------
    test('Vorhandenen Verein aendern und inkrementierten ETag erhalten (204 No Content)', async () => {
        // given
        const url = `${restURL}/${idVorhanden}`;

        // 1. Zuerst die aktuelle Version (ETag) mit Auth abrufen
        const initialResponse = await fetch(url, {
            // GET ist fuer User erlaubt
            headers: { [AUTHORIZATION]: `${BEARER} ${tokenUser}` },
        });
        const currentETag = initialResponse.headers.get('ETag');

        expect(currentETag).toBeDefined();

        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        // PUT ist fuer Admin und User erlaubt
        headers.append(AUTHORIZATION, `${BEARER} ${tokenAdmin}`);
        // If-Match: MUSS die aktuelle ETag-Version enthalten
        headers.append(IF_MATCH, currentETag as string);

        // when
        const response = await fetch(url, {
            method: PUT,
            body: JSON.stringify(geaenderterVerein),
            headers,
        });

        // then
        expect(response.status).toBe(HttpStatus.NO_CONTENT); // 204

        // Pruefe, ob der ETag-Header mit der neuen Version zurueckgegeben wurde
        const newETag = response.headers.get('ETag');

        expect(newETag).toBeDefined();

        // Prueft, ob die Version inkrementiert wurde (z.B. "1" -> "2")
        const currentVersion = Number.parseInt(
            currentETag?.slice(1, -1) ?? '0',
        );
        const newVersion = Number.parseInt(newETag?.slice(1, -1) ?? '0');

        expect(newVersion).toBe(currentVersion + 1);
    });

    // -------------------------------------------------------------------------
    // Fehlerfall: ID existiert nicht
    // -------------------------------------------------------------------------
    test('Nicht-vorhandenen Verein aendern (404 Not Found)', async () => {
        // given
        const url = `${restURL}/${idNichtVorhanden}`;
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(IF_MATCH, '"0"');
        headers.append(AUTHORIZATION, `${BEARER} ${tokenAdmin}`);

        // when
        const { status } = await fetch(url, {
            method: PUT,
            body: JSON.stringify(geaenderterVereinIdNichtVorhanden),
            headers,
        });

        // then
        // NotFoundException im Service fuehrt zu 404
        expect(status).toBe(HttpStatus.NOT_FOUND);
    });

    // -------------------------------------------------------------------------
    // Fehlerfall: Ungueltige Daten (Validierung)
    // -------------------------------------------------------------------------
    test('Vorhandenen Verein aendern, aber mit ungueltigen Daten (400 Bad Request)', async () => {
        // given
        const url = `${restURL}/${idVorhanden}`;
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(IF_MATCH, '"0"');
        headers.append(AUTHORIZATION, `${BEARER} ${tokenAdmin}`);

        const expectedMsg = [
            expect.stringMatching(/^name /u),
            expect.stringMatching(/^mitgliederanzahl /u),
            expect.stringMatching(/^website /u),
            expect.stringMatching(/^email /u),
        ];

        // when
        const response = await fetch(url, {
            method: PUT,
            body: JSON.stringify(geaenderterVereinInvalid),
            headers,
        });

        // then
        // ValidationPipe fuehrt zu 400 Bad Request
        expect(response.status).toBe(HttpStatus.BAD_REQUEST);

        const body = (await response.json()) as { message: string[] };
        const messages = body.message;

        expect(messages).toBeDefined();
        // Prueft, ob alle erwarteten Fehlermeldungen enthalten sind
        expect(messages).toStrictEqual(expect.arrayContaining(expectedMsg));
    });

    // -------------------------------------------------------------------------
    // Fehlerfall: Optimistische Sperre - Header fehlt
    // -------------------------------------------------------------------------
    test('Vorhandenen Verein aendern, aber ohne Versionsnummer (428 Precondition Required)', async () => {
        // given
        const url = `${restURL}/${idVorhanden}`;
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(AUTHORIZATION, `${BEARER} ${tokenAdmin}`); // If-Match fehlt absichtlich

        // when
        const response = await fetch(url, {
            method: PUT,
            body: JSON.stringify(geaenderterVerein),
            headers,
        });

        // then
        expect(response.status).toBe(HttpStatus.PRECONDITION_REQUIRED); // 428

        const body = await response.text();
        // Pruefe den erwarteten Body-Text vom Controller

        expect(body).toBe(`Header "${IF_MATCH}" fehlt`);
    });

    // -------------------------------------------------------------------------
    // Fehlerfall: Optimistische Sperre - Veraltete Version
    // -------------------------------------------------------------------------
    test('Vorhandenen Verein aendern, aber mit alter Versionsnummer (412 Precondition Failed)', async () => {
        // given
        const url = `${restURL}/${idVorhanden}`;
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(AUTHORIZATION, `${BEARER} ${tokenAdmin}`);

        // Eine Version, die definitiv kleiner als die aktuelle DB-Version (die ist meist >= 1) ist
        headers.append(IF_MATCH, '"-1"');

        // when
        const response = await fetch(url, {
            method: PUT,
            body: JSON.stringify(geaenderterVerein),
            headers,
        });

        // then
        expect(response.status).toBe(HttpStatus.PRECONDITION_FAILED); // 412

        const { message, statusCode } = (await response.json()) as {
            message: string;
            statusCode: number;
        };

        expect(message).toMatch(/Versionsnummer/u);
        expect(statusCode).toBe(HttpStatus.PRECONDITION_FAILED);
    });

    // -------------------------------------------------------------------------
    // Fehlerfall: Authentifizierung
    // -------------------------------------------------------------------------
    test('Vorhandenen Verein aendern, aber ohne Token (401 Unauthorized)', async () => {
        // given
        const url = `${restURL}/${idVorhanden}`;
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(IF_MATCH, '"0"'); // If-Match ist ok, aber Auth fehlt

        // when
        const { status } = await fetch(url, {
            method: PUT,
            body: JSON.stringify(geaenderterVerein),
            headers,
        });

        // then
        expect(status).toBe(HttpStatus.UNAUTHORIZED);
    });
});
