import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tasks = await prisma.task.findMany({
    include: { assignee: true, reports: true },
    orderBy: { created_at: 'desc' },
  });

  console.log('=== ALL TASKS ===');
  if (tasks.length === 0) {
    console.log('No tasks found.');
  } else {
    for (const t of tasks) {
      console.log(`\n[${t.id.slice(0, 8)}] "${t.title}"`);
      console.log(`   Status: ${t.status} | Priority: ${t.priority}`);
      console.log(`   Assignee: ${t.assignee?.username || 'none'} (ID: ${t.assignee?.telegram_id?.toString() || 'N/A'})`);
      console.log(`   Due: ${t.due_date?.toISOString().slice(0, 10) || 'no deadline'}`);
      console.log(`   Reports: ${t.reports.length}`);
      for (const r of t.reports) {
        console.log(`     - "${r.content.slice(0, 60)}" [${r.status}]`);
      }
    }
  }

  console.log('\n=== MEMBERS ===');
  const members = await prisma.teamMember.findMany();
  for (const m of members) {
    console.log(`@${m.username} (${m.nickname || '-'}) — tg: ${m.telegram_id.toString()} — role: ${m.role}`);
  }

  await prisma.$disconnect();
}

main();