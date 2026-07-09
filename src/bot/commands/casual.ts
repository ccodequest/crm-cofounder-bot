import { Telegraf } from 'telegraf';
import { TelegrafContext } from '../index.js';

export function registerCasualChat(bot: Telegraf<TelegrafContext>) {
  bot.on('text', async (ctx, next) => {
    const text = ctx.message.text;

    const pending = ctx.session?.pendingAutoAssign;
    if (pending) {
      const choice = parseInt(text);
      if (!isNaN(choice) && choice >= 1 && choice <= pending.members.length) {
        const { assignLead, logLeadActivity } = await import('../../services/lead-service.js');
        const selected = pending.members[choice - 1];
        await assignLead(pending.leadId, selected.id);
        await logLeadActivity(pending.leadId, 'assigned', `Auto-assigned to @${selected.username}`, ctx.from!.id);
        try {
          await ctx.telegram.sendMessage(Number(selected.telegram_id), `📋 *Lead Auto-Assigned to You*\n\nCheck and follow up.`);
        } catch {}
        await ctx.reply(`✅ Lead auto-assigned to @${selected.username}`);
        if (ctx.session) delete ctx.session.pendingAutoAssign;
        return;
      } else {
        if (ctx.session) delete ctx.session.pendingAutoAssign;
      }
    }

    if (text.startsWith('/')) return next();

    const name = ctx.from?.first_name || ctx.from?.username || 'User';

    try {
      await ctx.replyWithChatAction('typing');
      const { chatCompletion } = await import('../../services/ai.js');
      const response = await chatCompletion([
        {
          role: 'system',
          content: `You are a helpful CRM bot assistant. Direct and concise. Speaking to ${name}. Max 3 sentences. Answer questions, give advice, or chat casually. If asked about work, help with task management.`,
        },
        { role: 'user', content: text },
      ]);
      await ctx.reply(response);
    } catch (err: any) {
      await ctx.reply(`⚠️ ${err.message}`);
    }
  });
}