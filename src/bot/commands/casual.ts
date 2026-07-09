import { Telegraf } from 'telegraf';
import { TelegrafContext } from '../index.js';

export function registerCasualChat(bot: Telegraf<TelegrafContext>) {
  bot.on('text', async (ctx, next) => {
    if (!ctx.team || !ctx.member) return next();

    const text = ctx.message.text;

    if (text.startsWith('/')) return next();

    const pending = ctx.session?.pendingAutoAssign;
    if (pending) {
      const choice = parseInt(text);
      if (!isNaN(choice) && choice >= 1 && choice <= pending.members.length) {
        const { assignLead, logLeadActivity } = await import('../../services/lead-service.js');
        const selected = pending.members[choice - 1];
        await assignLead(pending.leadId, selected.id);
        await logLeadActivity(pending.leadId, 'assigned', `Auto-assigned to @${selected.username}`, ctx.from!.id);

        try {
          await ctx.telegram.sendMessage(
            Number(selected.telegram_id),
            `📋 *Lead Auto-Assigned to You*\n\nCheck and follow up.`
          );
        } catch {}

        await ctx.reply(`✅ Lead auto-assigned to @${selected.username}`);
        if (ctx.session) delete ctx.session.pendingAutoAssign;
        return;
      } else {
        if (ctx.session) delete ctx.session.pendingAutoAssign;
      }
    }

    const name = ctx.from?.first_name || ctx.member?.username || 'User';

    try {
      await ctx.replyWithChatAction('typing');
      const { chatCompletion } = await import('../../services/ai.js');
      const response = await chatCompletion([
        {
          role: 'system',
          content: `You are the AI Co-Founder of a team. Direct, no sugarcoating. Speaking to ${name}. Be concise. Max 3 sentences. No fluff.`,
        },
        { role: 'user', content: text },
      ]);
      await ctx.reply(response);
    } catch (err: any) {
      await ctx.reply(`⚠️ ${err.message}`);
    }
  });
}