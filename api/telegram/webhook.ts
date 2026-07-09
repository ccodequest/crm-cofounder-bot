import { VercelRequest, VercelResponse } from '@vercel/node';
import { getBot } from '../../src/bot/index.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = req.headers['x-telegram-bot-api-secret-token'];
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret && secret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const bodyType = typeof req.body;
  const typeName = req.headers['content-type'];

  try {
    const update = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const bot = getBot();
    await bot.handleUpdate(update);
    res.status(200).json({ ok: true, type: bodyType, ct: typeName });
  } catch (err: any) {
    console.error('Webhook error:', err?.message, err?.stack);
    res.status(200).json({
      ok: true,
      error: err?.message,
      type: bodyType,
      ct: typeName,
      body: typeof req.body === 'string' ? req.body.slice(0, 200) : JSON.stringify(req.body).slice(0, 200),
    });
  }
}
