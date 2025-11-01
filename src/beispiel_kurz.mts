// src/beispiel_kurz.mts
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

const adapter = new PrismaPg({
    connectionString: process.env['DATABASE_URL'],
});
const prisma = new PrismaClient({ adapter });

try {
    await prisma.$connect();
    const vereine = await prisma.fussballverein.findMany();
    console.log(`vereine=${JSON.stringify(vereine)}`);
} finally {
    await prisma.$disconnect();
}
