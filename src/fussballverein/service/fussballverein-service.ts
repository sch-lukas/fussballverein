import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { getLogger } from '../../logger/logger.js';
import { PrismaService } from './prisma-service.js';

// Ladeprofile wie beim Vorbild
type VereinMitBasis = Prisma.FussballvereinGetPayload<{}>;
type VereinMitStadion = Prisma.FussballvereinGetPayload<{
    include: { stadion: true };
}>;
type VereinMitDetails = Prisma.FussballvereinGetPayload<{
    include: { stadion: true; spieler: true; logo_file: true };
}>;

type FindByIdParams = {
    readonly id: number;
    /** Analog zu "mitAbbildungen": steuert, ob Relationen mitgeladen werden */
    readonly mitDetails?: boolean; // optionaler Schalter, wie beim Vorbild
};

@Injectable()
export class FussballvereinService {
    readonly #prisma: PrismaClient;
    readonly #logger = getLogger(FussballvereinService.name);

    // vordefinierte include-Sets wie im Vorbild
    readonly #includeStadion = { stadion: true } as const;
    readonly #includeDetails = {
        stadion: true,
        spieler: true,
        logo_file: true,
    } as const;

    constructor(prisma: PrismaService) {
        this.#prisma = prisma.client;
    }

    async findById({
        id,
        mitDetails = false,
    }: FindByIdParams): Promise<
        Readonly<VereinMitDetails | VereinMitStadion | VereinMitBasis>
    > {
        this.#logger.debug(
            'findById: id=%d, mitDetails=%s',
            id,
            String(mitDetails),
        );

        const include = mitDetails
            ? this.#includeDetails
            : this.#includeStadion; // oder {} falls GAR nichts
        const verein = await this.#prisma.fussballverein.findUnique({
            where: { id },
            include, // exakt wie beim Vorbild: include wird dynamisch gewählt
        });

        if (verein === null) {
            this.#logger.debug(
                'Es gibt keinen Fußballverein mit der ID %d',
                id,
            );
            throw new NotFoundException(
                `Es gibt keinen Fußballverein mit der ID ${id}.`,
            );
        }

        this.#logger.debug('findById: verein=%o', verein);
        return verein;
    }
}
