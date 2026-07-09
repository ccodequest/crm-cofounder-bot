import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const ownerId = process.env.OWNER_TELEGRAM_ID || '5445304526';

  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: Number(ownerId),
          text: '🔧 Test from Vercel function at ' + new Date().toISOString(),
        }),
      }
    );
    const data = await resp.json();
    res.status(200).json({ ok: true, telegram: data });
  } catch (err: any) {
    res.status(200).json({ ok: true, error: err?.message, stack: err?.stack });
  }
}
