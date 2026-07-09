import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const start = Date.now();
  try {
    const ownerId = Number(process.env.OWNER_TELEGRAM_ID);
    const { getDb } = await import('../../src/services/db.js');
    const prisma = getDb();

    const team = await prisma.team.findFirst({ where: { owner_id: BigInt(ownerId) } });
    if (!team) {
      res.status(200).json({ ok: false, error: 'No team' });
      return;
    }

    const task = await prisma.task.create({
      data: { team_id: team.id, title: 'direct test ' + Date.now(), assignee_id: null, creator_id: null }
    });

    const members = await prisma.teamMember.findMany({ where: { team_id: team.id } });
    const memberList = members.map((m: any) => `@${m.username} (${m.nickname || '-'}) tg:${m.telegram_id.toString()}`).join('\n');

    const token = process.env.TELEGRAM_BOT_TOKEN;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ownerId,
        text: `✅ DB Write OK\nTask: ${task.title}\n\nMembers:\n${memberList}`,
      }),
    });

    res.status(200).json({ ok: true, ms: Date.now() - start, task: task.id });
  } catch (err: any) {
    res.status(200).json({ ok: false, error: err.message, ms: Date.now() - start });
  }
}