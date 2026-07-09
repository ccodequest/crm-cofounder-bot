import { VercelRequest, VercelResponse } from '@vercel/node';
import { getBot } from '../../src/bot/index.js';
import { checkRateLimit } from '../../src/utils/rateLimit.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const timeout = setTimeout(() => {
    res.status(200).json({ ok: true, timeout: true });
  }, 9500);

  try {
    if (req.method !== 'POST') {
      clearTimeout(timeout);
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const chatId = req.body?.message?.chat?.id || req.body?.callback_query?.message?.chat?.id;
    if (chatId) {
      const { allowed, retryAfter } = checkRateLimit(chatId);
      if (!allowed) {
        clearTimeout(timeout);
        return res.status(429).json({ error: `Rate limited. Retry after ${retryAfter}s` });
      }
    }

    const bot = getBot();
    await bot.handleUpdate(req.body);
    clearTimeout(timeout);
    res.status(200).json({ ok: true });
  } catch (err: any) {
    clearTimeout(timeout);
    console.error('Webhook error:', err?.message, err?.stack);
    res.status(200).json({ ok: true });
  }
}