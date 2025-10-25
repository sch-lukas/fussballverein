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

import { Module } from '@nestjs/common';
import { MailModule } from '../mail/module.js';
import { KeycloakModule } from '../security/keycloak/module.js';

import { FussballvereinGetController } from './controller/fussballverein-controller.js';
import { FussballvereinWriteController } from './controller/fussballverein-write-controller.js';

import { FussballvereinMutationResolver } from './resolver/mutation.js';
import { FussballvereinQueryResolver } from './resolver/query.js';

import { FussballvereinService } from './service/fussballverein-service.js';
import { FussballvereinWriteService } from './service/fussballverein-write-service.js';
import { PrismaService } from './service/prisma-service.js';
import { WhereBuilder } from './service/where-builder.js';

/**
 * Das Modul besteht aus Controller- und Service-Klassen für die Verwaltung von
 * Fussballvereinen.
 * @packageDocumentation
 */

/**
 * Die dekorierte Modul-Klasse mit Controller- und Service-Klassen sowie der
 * Funktionalität für Prisma.
 */
@Module({
    imports: [KeycloakModule, MailModule],
    controllers: [FussballvereinGetController, FussballvereinWriteController],
    providers: [
        FussballvereinService,
        FussballvereinWriteService,
        FussballvereinQueryResolver,
        FussballvereinMutationResolver,
        PrismaService,
        WhereBuilder,
    ],
    exports: [FussballvereinService, FussballvereinWriteService],
})
export class FussballvereinModule {}
