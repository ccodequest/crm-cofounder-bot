import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const team = await prisma.team.findFirst({ where: { owner_id: BigInt(5445304526) } });
  if (!team) { console.log('No team found'); return; }
  console.log('Team ID:', team.id);

  const members = [
    { telegram_id: 6828535782, username: 'zaid', nickname: 'zaid' },
    { telegram_id: 2028346741, username: 'sulthan1999', nickname: 'sallu' },
    { telegram_id: 7298536133, username: 'shreyas', nickname: 'shreyas' },
  ];

  for (const m of members) {
    try {
      await prisma.teamMember.upsert({
        where: { telegram_id: BigInt(m.telegram_id) },
        create: { team_id: team.id, telegram_id: BigInt(m.telegram_id), username: m.username, nickname: m.nickname, role: 'member', skills: [] },
        update: { username: m.username, nickname: m.nickname },
      });
      console.log('✅', m.username, '(' + m.nickname + ')');
    } catch (e: any) {
      console.log('❌', m.username, e.message);
    }
  }

  await prisma.$disconnect();
}

main();