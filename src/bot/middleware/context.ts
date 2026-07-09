import { Middleware } from 'telegraf';
import { getDb } from '../../services/db.js';
import { TelegrafContext } from '../index.js';

export function loadTeamContext(): Middleware<TelegrafContext> {
  return async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return next();

    const prisma = getDb();
    const member = await prisma.teamMember.findUnique({
      where: { telegram_id: BigInt(userId) },
      include: { team: true },
    });

    if (member) {
      ctx.team = member.team as any;
      ctx.member = member as any;

      const ownerId = Number(process.env.OWNER_TELEGRAM_ID);
      const founderId = Number(process.env.FOUNDER_TELEGRAM_ID);
      ctx.isOwner = userId === ownerId;
      ctx.isFounder = userId === founderId;

      const persona = await prisma.personaProfile.findFirst({
        where: { telegram_id: BigInt(userId) },
      });

      ctx.persona = persona as any;
    }

    return next();
  };
}
