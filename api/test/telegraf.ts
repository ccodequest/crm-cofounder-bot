import { VercelRequest, VercelResponse } from '@vercel/node';
import { Telegraf } from 'telegraf';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const ownerId = process.env.OWNER_TELEGRAM_ID || '5445304526';
  const start = Date.now();

  try {
    const bot = new Telegraf(token!);
    bot.start(async (ctx) => {
      await ctx.reply('✅ Telegraf minimal /start works!');
    });

    const update = {
      update_id: 999,
      message: {
        message_id: 999,
        from: { id: Number(ownerId), is_bot: false, first_name: 'Test' },
        chat: { id: Number(ownerId), type: 'private' as const },
        date: Math.floor(Date.now() / 1000),
        text: '/start',
      },
    };

    await bot.handleUpdate(update);
    res.status(200).json({ ok: true, ms: Date.now() - start });
  } catch (err: any) {
    res.status(200).json({ ok: false, error: err?.message, stack: err?.stack, ms: Date.now() - start });
  }
}
