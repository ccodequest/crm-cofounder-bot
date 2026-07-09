import { VercelRequest, VercelResponse } from '@vercel/node';
import { getBot } from '../../src/bot/index.js';
import { checkRateLimit } from '../../src/utils/rateLimit.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const chatId = req.body?.message?.chat?.id || req.body?.callback_query?.message?.chat?.id;
    if (chatId) {
      const { allowed, retryAfter } = checkRateLimit(chatId);
      if (!allowed) {
        return res.status(429).json({ error: `Rate limited. Retry after ${retryAfter}s` });
      }
    }

    const bot = getBot();
    await bot.handleUpdate(req.body);
    res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('Webhook error:', err?.message, err?.stack);
    res.status(200).json({ ok: true });
  }
}