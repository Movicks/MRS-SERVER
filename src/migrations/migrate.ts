import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  await prisma.$connect();

  try {
    const events = await prisma.eventRecord.findMany({
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }]
    });

    let seq = 0;
    for (const ev of events) {
      seq += 1;
      if (ev.seq !== seq) {
        await prisma.eventRecord.update({
          where: { id: ev.id },
          data: { seq }
        });
      }
    }

    await prisma.eventSequence.upsert({
      where: { name: 'event_store' },
      create: { name: 'event_store', value: seq },
      update: { value: seq }
    });

    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ ok: true, events: seq }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
