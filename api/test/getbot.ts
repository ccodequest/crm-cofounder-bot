import { VercelRequest, VercelResponse } from '@vercel/node';
import { getBot } from '../../src/bot/index.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const start = Date.now();
  try {
    const bot = getBot();
    const t1 = Date.now();

    const update = {
      update_id: 200,
      message: {
        message_id: 200,
        from: { id: 5445304526, is_bot: false, first_name: 'Harsh' },
        chat: { id: 5445304526, type: 'private' as const, first_name: 'Harsh' },
        date: Math.floor(Date.now() / 1000),
        text: '/start',
      },
    };

    const t2 = Date.now();
    await bot.handleUpdate(update);
    const t3 = Date.now();

    res.status(200).json({ ok: true, getBotMs: t1 - start, handleMs: t3 - t2, total: t3 - start });
  } catch (err: any) {
    res.status(200).json({ ok: false, error: err?.message, total: Date.now() - start });
  }
}
