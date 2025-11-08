// src/fussballverein/rest/fussballverein-get-search.test.ts

import { HttpStatus } from '@nestjs/common';
import { describe, expect, test } from 'vitest';
import { type Page } from '../../../src/fussballverein/controller/page.js';
import { type FussballvereinMitBasis } from '../../../src/fussballverein/service/fussballverein-service.js';
import { CONTENT_TYPE, restURL } from '../constants.mjs';

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------
const nameArray = ['bayern', 'tsg'];
const nameNichtVorhanden = ['bundesliga', 'regionalliga'];
const mitgliederMin = [10000, 100000];
const stadtArray = ['münchen', 'sinsheim'];

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
// Test-Suite
describe('GET /rest/fussballvereine (Suchen)', () => {
    test.concurrent(
        'Alle Vereine mit Paginierung (keine Query-Parameter)',
        async () => {
            // given
            const expectedMinCount = 4;

            // when
            const response = await fetch(restURL);
            const { status, headers } = response;

            // then
            expect(status).toBe(HttpStatus.OK);
            expect(headers.get(CONTENT_TYPE)).toMatch(/json/iu);

            const body =
                (await response.json()) as Page<FussballvereinMitBasis>;

            expect(body.content.length).toBeGreaterThanOrEqual(1);
            expect(body.page.totalElements).toBeGreaterThanOrEqual(
                expectedMinCount,
            );
        },
    );

    test.concurrent.each(nameArray)(
        'Vereine mit Teil-Namen %s suchen (200 OK)',
        async (name) => {
            // given
            const params = new URLSearchParams({ name });
            const url = `${restURL}?${params}`;

            // when
            const response = await fetch(url);
            const { status, headers } = response;

            // then
            expect(status).toBe(HttpStatus.OK);
            expect(headers.get(CONTENT_TYPE)).toMatch(/json/iu);

            const body =
                (await response.json()) as Page<FussballvereinMitBasis>;

            expect(body).toBeDefined();
            expect(body.content.length).toBeGreaterThanOrEqual(1);

            // Prüft, ob jeder Name den Teilstring enthält (case-insensitive)
            body.content
                .map((verein) => verein.name)
                .forEach((n) => {
                    expect(n?.toLowerCase()).toStrictEqual(
                        expect.stringContaining(name),
                    );
                });
        },
    );

    test.concurrent.each(nameNichtVorhanden)(
        'Vereine zu nicht vorhandenem Teil-Namen %s suchen (404 Not Found)',
        async (name) => {
            // given
            const params = new URLSearchParams({ name });
            const url = `${restURL}?${params}`;

            // when
            const { status } = await fetch(url);

            // then

            expect(status).toBe(HttpStatus.NOT_FOUND);
        },
    );

    test.concurrent.each(mitgliederMin)(
        'Vereine mit Mindest-Mitgliederanzahl %i suchen (200 OK)',
        async (mitgliederanzahl) => {
            // given
            const params = new URLSearchParams({
                mitgliederanzahl: mitgliederanzahl.toString(),
            });
            const url = `${restURL}?${params}`;

            // when
            const response = await fetch(url);
            const { status, headers } = response;

            // then
            expect(status).toBe(HttpStatus.OK);
            expect(headers.get(CONTENT_TYPE)).toMatch(/json/iu);

            const body =
                (await response.json()) as Page<FussballvereinMitBasis>;

            // Jedes Ergebnis muss die Mindest-Mitgliederanzahl erfüllen
            body.content
                .map((verein) => verein.mitgliederanzahl)
                .forEach((anzahl) => {
                    expect(anzahl).toBeGreaterThanOrEqual(mitgliederanzahl);
                });
        },
    );

    test.concurrent.each(stadtArray)(
        'Vereine mit Stadion in Stadt %s suchen (200 OK)',
        async (stadt) => {
            // given
            const params = new URLSearchParams({ stadt });
            const url = `${restURL}?${params}`;

            // when
            const response = await fetch(url);
            const { status, headers } = response;

            // then
            expect(status).toBe(HttpStatus.OK);
            expect(headers.get(CONTENT_TYPE)).toMatch(/json/iu);

            const body =
                (await response.json()) as Page<FussballvereinMitBasis>;

            expect(body.content.length).toBeGreaterThanOrEqual(1);
        },
    );

    test.concurrent(
        'Keine Vereine zu einer nicht-vorhandenen Property (404 Not Found)',
        async () => {
            // given
            const params = new URLSearchParams({ foo: 'bar' });
            const url = `${restURL}?${params}`;

            // when
            const { status } = await fetch(url);

            // then

            expect(status).toBe(HttpStatus.NOT_FOUND);
        },
    );
});
