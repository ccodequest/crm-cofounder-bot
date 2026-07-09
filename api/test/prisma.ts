import { VercelRequest, VercelResponse } from '@vercel/node';
import { Telegraf, Context } from 'telegraf';

interface MyCtx extends Context {
  team?: any;
  member?: any;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const start = Date.now();

  try {
    const bot = new Telegraf<MyCtx>(process.env.TELEGRAM_BOT_TOKEN!);

    // Load prisma in middleware (same as loadTeamContext)
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    bot.use(async (ctx, next) => {
      const userId = ctx.from?.id;
      if (!userId) return next();

      console.log('looking up user:', userId);
      const member = await prisma.teamMember.findUnique({
        where: { telegram_id: BigInt(userId) },
        include: { team: true },
      });
      console.log('member result:', member ? 'found' : 'not found');

      if (member) {
        ctx.team = member.team;
      }

      return next();
    });

    bot.start(async (ctx) => {
      await ctx.reply('✅ Telegraf + Prisma middleware /start works!');
    });

    const update = {
      update_id: 200,
      message: {
        message_id: 200,
        from: { id: 5445304526, is_bot: false, first_name: 'Harsh' },
        chat: { id: 5445304526, type: 'private' as const },
        date: Math.floor(Date.now() / 1000),
        text: '/start',
      },
    };

    await bot.handleUpdate(update);
    await prisma.$disconnect();
    res.status(200).json({ ok: true, ms: Date.now() - start });
  } catch (err: any) {
    res.status(200).json({ ok: false, error: err?.message, ms: Date.now() - start });
  }
}
