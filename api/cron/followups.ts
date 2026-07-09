import { VercelRequest, VercelResponse } from '@vercel/node';
import { getPendingFollowups } from '../../src/services/task-service.js';
import { getBot } from '../../src/bot/index.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const followups = await getPendingFollowups();
    const bot = getBot() as any;
    let notified = 0;

    for (const f of followups) {
      if (f.team_members?.telegram_id) {
        try {
          await bot.telegram.sendMessage(
            f.team_members.telegram_id,
            `⏰ *Follow-up Reminder*\n\n${f.notes || 'Follow up on your assigned item.'}\nDue: ${f.due_date?.slice(0, 10)}`,
            { parse_mode: 'Markdown' }
          );
          notified++;
        } catch {}
      }
    }

    res.status(200).json({ notified, total: followups.length });
  } catch (err: any) {
    console.error('Cron error:', err);
    res.status(500).json({ error: err.message });
  }
}
