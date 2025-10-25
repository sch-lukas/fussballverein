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
import { fussballvereinController } from../mail/module.tsoller/fussballverein-controller.ts';
import { fussballvereinWriteController } from../security/keycloak/module.tsrite-controller.ts';
import { fussballvereinMutationResolver } from '../fussballverein/resolver/mutation.ts';
import { fussballvereinQueryResolver } from '../fussballverein/resolver/query.ts';
import { fussballvereinService } from '../fussballverein/service/fussballverein-service.ts';
import { fussballvereinWriteService } from '../fussballverein/service/fussballverein-write-service.ts';
import { PrismaService } from '../fussballverein/service/prisma-service.ts';
import { WhereBuilder } from '../fussballverein/service/where-builder.ts';
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
    controllers: [fussballvereinController, fussballvereinWriteController],
    // Provider sind z.B. Service-Klassen fuer DI
    providers: [
        fussballvereinService,
        fussballvereinWriteService,
        fussballvereinQueryResolver,
        fussballvereinMutationResolver,
        PrismaService,
        WhereBuilder,
    ],
    // Export der Provider fuer DI in anderen Modulen
    exports: [fussballvereinService, fussballvereinWriteService],
})
export class fussballvereinModule {}
