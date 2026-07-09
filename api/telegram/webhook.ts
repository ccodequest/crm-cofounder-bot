import { VercelRequest, VercelResponse } from '@vercel/node';
import { Telegraf, Context } from 'telegraf';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
    bot.start(async (ctx) => {
      await ctx.reply('🤖 *CRM Co-Founder Bot*\n\nLive! Try /help', { parse_mode: 'Markdown' });
    });
    bot.help(async (ctx) => {
      await ctx.reply('*Commands:*\n• /start — Begin\n• /help — This', { parse_mode: 'Markdown' });
    });

    await bot.handleUpdate(req.body);
    res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('Webhook error:', err?.message, err?.stack);
    res.status(200).json({ ok: true });
  }
}
