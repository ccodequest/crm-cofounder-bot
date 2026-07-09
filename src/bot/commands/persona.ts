import { Telegraf } from 'telegraf';
import { TelegrafContext } from '../index.js';
import { ownerOnly } from '../middleware/auth.js';
import { setPersonaTone, listPersonas } from '../../services/persona-service.js';
import { getDb } from '../../services/db.js';
import { Tone } from '../../types/index.js';

const VALID_TONES: Tone[] = ['brutal', 'strict', 'neutral', 'gentle', 'auto'];

export function registerPersonaCommands(bot: Telegraf<TelegrafContext>) {
  bot.command('persona', ownerOnly(), async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    const subcommand = args[0]?.toLowerCase();

    if (subcommand === 'list') {
      const personas = await listPersonas(ctx.team!.id);
      if (personas.length === 0) {
        return ctx.reply('No custom personas set. All members use default tone.');
      }
      const lines = personas.map((p: any) =>
        `• @${p.username || p.telegram_id} → *${p.tone}*`
      );
      await ctx.reply(`*Persona Profiles:*\n${lines.join('\n')}`, { parse_mode: 'Markdown' });
      return;
    }

    const identifier = args[0]?.replace('@', '');
    const tone = args[1]?.toLowerCase() as Tone;

    if (!identifier || !tone || !VALID_TONES.includes(tone)) {
      return ctx.reply(`Usage: /persona "Name" ${VALID_TONES.join('|')}\n/persona list`);
    }

    const prisma = getDb();
    const member = await prisma.teamMember.findFirst({
      where: {
        OR: [
          { username: identifier.toLowerCase() },
          { username: { contains: identifier, mode: 'insensitive' } },
        ],
      },
    });

    if (!member) return ctx.reply(`❌ No member found matching "${identifier}". Use /team list to see all members.`);

    try {
      await setPersonaTone(ctx.team!.id, Number(member.telegram_id), tone, ctx.from!.id);
      await ctx.reply(`✅ @${member.username} tone set to *${tone}*`, { parse_mode: 'Markdown' });
    } catch (err: any) {
      await ctx.reply(`❌ ${err.message}`);
    }
  });
}
