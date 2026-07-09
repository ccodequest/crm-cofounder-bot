import { VercelRequest, VercelResponse } from '@vercel/node';
import { getBot } from '../../src/bot/index.js';

let coldStart = true;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = req.headers['x-telegram-bot-api-secret-token'];
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret && secret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const bot = getBot();
    await bot.handleUpdate(req.body);
    res.status(200).json({ ok: true, cold: coldStart });
  } catch (err: any) {
    console.error('Webhook error:', err?.message, err?.stack);
    res.status(200).json({ ok: true, error: err?.message });
  } finally {
    coldStart = false;
  }
}
