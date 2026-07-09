import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Remove the old sulthan1999 with telegram_id = 0
  const old = await prisma.teamMember.findMany({ where: { telegram_id: BigInt(0) } });
  for (const m of old) {
    console.log('Deleting old entry:', m.username, m.id);
    await prisma.teamMember.delete({ where: { id: m.id } });
  }

  // Update owner role
  const owner = await prisma.teamMember.findFirst({ where: { telegram_id: BigInt(5445304526) } });
  if (owner) {
    await prisma.teamMember.update({ where: { id: owner.id }, data: { role: 'owner' } });
    console.log('Set owner role for @' + owner.username);
  }

  console.log('\n=== CLEANED MEMBERS ===');
  const members = await prisma.teamMember.findMany();
  for (const m of members) {
    console.log(`@${m.username} (${m.nickname || '-'}) — tg: ${m.telegram_id.toString()} — role: ${m.role}`);
  }

  await prisma.$disconnect();
}

main();