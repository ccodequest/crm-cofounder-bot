import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function main() {
  console.log('Testing DB...');
  const team = await p.team.findFirst();
  if (!team) { console.log('NO TEAM'); return; }
  console.log('Team:', team.id, team.name);

  const task = await p.task.create({
    data: { team_id: team.id, title: 'test-' + Date.now(), assignee_id: null, creator_id: null }
  });
  console.log('Created task:', task.id, task.title);

  const found = await p.task.findUnique({ where: { id: task.id } });
  console.log('Found task:', found?.title);

  await p.task.delete({ where: { id: task.id } });
  console.log('Cleanup OK');
  await p.$disconnect();
}

main();