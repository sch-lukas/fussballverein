// Copyright (C) 2025 - present [Dein Name]
// Hochschule Karlsruhe / Projekt Fussballverein
//
// Dieses Programm ist freie Software: Sie können es unter den Bedingungen
// der GNU General Public License, Version 3 oder höher, weitergeben und/oder ändern.
// Weitere Informationen: https://www.gnu.org/licenses/

import { Module } from '@nestjs/common';
// Pfade relativ zu: src/fussballverein/module.ts
import { FussballvereinController } from './controller/fussballverein-controller.js';
import { FussballvereinService } from './service/fussballverein-service.js';
import { PrismaService } from './service/prisma-service.js';
// Optional – nur einbinden, wenn du Keycloak/Mail wirklich nutzt
// import { KeycloakModule } from '../security/keycloak/module.js';
// import { MailModule } from '../mail/module.js';

/**
 * Modul für Fussballverein: nur Lesezugriff per ID.
 */
@Module({
    // imports: [KeycloakModule, MailModule], // <- erst aktivieren, wenn benötigt
    controllers: [FussballvereinController],
    providers: [FussballvereinService, PrismaService],
    exports: [FussballvereinService],
})
export class FussballvereinModule {}
