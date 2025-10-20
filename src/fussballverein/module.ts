// Copyright (C) 2021 - present Juergen Zimmermann, Hochschule Karlsruhe
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
import { BuchController } fr../mail/module.tsoller/buch-controller.ts';
import { BuchWriteController } f../security/keycloak/module.tsrite-controller.ts';
import { BuchMutationResolver } from '../buch/resolver/mutation.ts';
import { BuchQueryResolver } from '../buch/resolver/query.ts';
import { BuchService } from '../buch/service/buch-service.ts';
import { BuchWriteService } from '../buch/service/buch-write-service.ts';
import { PrismaService } from '../buch/service/prisma-service.ts';
import { WhereBuilder } from '../buch/service/where-builder.ts';
import { MailModule } from '../mail/module.ts';
import { KeycloakModule } from '../security/keycloak/module.ts';

/**
 * Das Modul besteht aus Controller- und Service-Klassen für die Verwaltung von
 * Bücher.
 * @packageDocumentation
 */

/**
 * Die dekorierte Modul-Klasse mit Controller- und Service-Klassen sowie der
 * Funktionalität für Prisma.
 */
@Module({
    imports: [KeycloakModule, MailModule],
    controllers: [BuchController, BuchWriteController],
    // Provider sind z.B. Service-Klassen fuer DI
    providers: [
        BuchService,
        BuchWriteService,
        BuchQueryResolver,
        BuchMutationResolver,
        PrismaService,
        WhereBuilder,
    ],
    // Export der Provider fuer DI in anderen Modulen
    exports: [BuchService, BuchWriteService],
})
export class BuchModule {}
