import { Telegraf } from 'telegraf';
import { TelegrafContext } from '../index.js';
import { chatCompletion } from '../../services/ai.js';
import { getDb } from '../../services/db.js';
import { getPersona } from '../../services/persona-service.js';

export function registerCasualChat(bot: Telegraf<TelegrafContext>) {
  bot.on('text', async (ctx) => {
    if (!ctx.team || !ctx.member) return;

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
          await ctx.telegram.sendMessage(
            Number(selected.telegram_id),
            `📋 *Lead Auto-Assigned to You*\n\nCheck and follow up.`
          );
        } catch {}

        await ctx.reply(`✅ Lead auto-assigned to @${selected.username}`);
        if (ctx.session) delete ctx.session.pendingAutoAssign;
        return;
      }
    }

    const isOwner = ctx.isOwner;
    const persona = await getPersona(ctx.from!.id);
    const tone = persona?.tone || 'strict';
    const name = ctx.from?.first_name || ctx.member?.username || 'User';

    const prisma = getDb();
    const recentTasks = await prisma.task.findMany({
      where: { assignee_id: ctx.member!.id },
      orderBy: { created_at: 'desc' },
      take: 3,
      include: { reports: { take: 1, orderBy: { created_at: 'desc' } } },
    });

    const taskContext = recentTasks.length > 0
      ? `\n\nUser's recent tasks:\n${recentTasks.map((t: any) => `- "${t.title}" (${t.status})`).join('\n')}`
      : '';

    const roleContext = isOwner ? 'You are the Owner/Founder.'
      : `You are a team member (${ctx.member?.role || 'member'}).`;

    try {
      await ctx.replyWithChatAction('typing');
      const response = await chatCompletion([
        {
          role: 'system', content:
          `You are the AI Co-Founder of a team. Your tone is ${tone} — direct, no sugarcoating.`
          + `\n${roleContext}`
          + `\nYou are speaking to ${name} in a casual chat. Help them with their work, answer questions,`
          + ` give advice, or just chat. But always keep the context that this is about work and productivity.`
          + `\nIf asked about team status, task progress, or leads, answer based on available info.`
          + `\nBe concise. Max 3-4 sentences. No fluff.${taskContext}`,
        },
        { role: 'user', content: text },
      ]);

      await ctx.reply(response);
    } catch (err: any) {
      await ctx.reply(`⚠️ ${err.message}`);
    }
  });
}