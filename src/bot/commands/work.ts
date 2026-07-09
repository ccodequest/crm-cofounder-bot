import { Telegraf } from 'telegraf';
import { TelegrafContext } from '../index.js';
import { ownerOnly } from '../middleware/auth.js';
import { createTask, getTasksForMember, submitReport, getOverdueTasks, scheduleFollowup } from '../../services/task-service.js';
import { getDb } from '../../services/db.js';

export function registerWorkCommands(bot: Telegraf<TelegrafContext>) {
  bot.command('assign', ownerOnly(), async (ctx) => {
    const text = ctx.message.text.slice('/assign '.length).trim();
    const mentionMatch = text.match(/@(\S+)/);
    const taskMatch = text.match(/"([^"]+)"/);
    const dueMatch = text.match(/due:(\S+)/);

    if (!mentionMatch || !taskMatch) {
      return ctx.reply('Usage: /assign @username "Task description" due:2025-01-20');
    }

    const username = mentionMatch[1];
    const title = taskMatch[1];
    const dueDate = dueMatch ? dueMatch[1] : null;

    try {
      const prisma = getDb();
      const assignee = await prisma.teamMember.findFirst({
        where: { username },
      });

      if (!assignee) return ctx.reply(`❌ Member @${username} not found`);

      const task = await createTask({
        teamId: ctx.team!.id,
        title,
        dueDate: dueDate || undefined,
        assigneeId: assignee.id,
        creatorId: ctx.member!.id,
      });

      try {
        await ctx.telegram.sendMessage(
          Number(assignee.telegram_id),
          `📋 *New Task Assigned*\n\n"${title}"\nDue: ${dueDate || 'No deadline'}\n\nUse /done "completion details" when finished.`,
          { parse_mode: 'Markdown' }
        );
      } catch {}

      await ctx.reply(`✅ Task "${title}" assigned to @${username}`);
    } catch (err: any) {
      await ctx.reply(`❌ ${err.message}`);
    }
  });

  bot.command('done', async (ctx) => {
    const content = ctx.message.text.slice('/done '.length).trim();
    if (!content) return ctx.reply('Usage: /done "What you completed"');

    const prisma = getDb();
    const tasks = await prisma.task.findMany({
      where: {
        assignee_id: ctx.member!.id,
        status: { in: ['pending', 'in_progress'] },
      },
      orderBy: { created_at: 'asc' },
      take: 1,
    });

    if (!tasks || tasks.length === 0) {
      return ctx.reply('You have no pending tasks to report on.');
    }

    try {
      const report = await submitReport({
        taskId: tasks[0].id,
        reporterId: ctx.member!.id,
        content,
      });

      const ownerId = Number(process.env.OWNER_TELEGRAM_ID);
      try {
        await ctx.telegram.sendMessage(
          ownerId,
          `📝 *Report from @${ctx.from!.username}*\n\nTask: ${tasks[0].title}\nReport: ${content}\n\nUse /review to see all pending reports.`,
          { parse_mode: 'Markdown' }
        );
      } catch {}

      await ctx.reply('✅ Report submitted and pending owner review.');
    } catch (err: any) {
      await ctx.reply(`❌ ${err.message}`);
    }
  });

  bot.command('status', async (ctx) => {
    const mention = ctx.message.text.match(/@(\S+)/);
    let memberId = ctx.member!.id;

    if (mention && ctx.isOwner) {
      const prisma = getDb();
      const member = await prisma.teamMember.findFirst({
        where: { username: mention[1] },
      });
      if (member) memberId = member.id;
    }

    const tasks = await getTasksForMember(memberId);
    const pending = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
    const completed = tasks.filter(t => t.status === 'completed');

    await ctx.reply(
      `📊 *Workload:*\n`
      + `Pending: ${pending.length}\n`
      + `Completed: ${completed.length}\n`
      + `Total: ${tasks.length}`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('overdue', ownerOnly(), async (ctx) => {
    const overdue = await getOverdueTasks(ctx.team!.id);
    if (overdue.length === 0) return ctx.reply('✅ No overdue tasks.');

    const lines = overdue.map((t: any) =>
      `• "${t.title}" — @${t.assignee?.username || 'unknown'} (Due: ${t.due_date?.toISOString().slice(0, 10)})`
    );
    await ctx.reply(`⚠️ *Overdue Tasks:*\n${lines.join('\n')}`, { parse_mode: 'Markdown' });
  });

  bot.command('followup', ownerOnly(), async (ctx) => {
    const text = ctx.message.text.slice('/followup '.length).trim();
    const leadMatch = text.match(/"([^"]+)"/);
    const cadenceMatch = text.match(/cadence:"([^"]+)"/);

    if (!leadMatch) {
      return ctx.reply('Usage: /followup "lead name" cadence:"weekly" [notes]');
    }

    const leadQuery = leadMatch[1];
    const cadence = cadenceMatch ? cadenceMatch[1] : undefined;
    const notes = text.replace(leadMatch[0], '').replace(cadenceMatch?.[0] || '', '').trim() || undefined;

    try {
      const prisma = getDb();
      const leads = await prisma.lead.findMany({
        where: {
          company_name: { contains: leadQuery, mode: 'insensitive' },
        },
        take: 1,
      });

      if (!leads || leads.length === 0) {
        return ctx.reply(`❌ No lead found matching "${leadQuery}"`);
      }

      const lead = leads[0];
      if (!lead.assigned_to) return ctx.reply('Lead has no assignee. Use /assign_lead first.');

      await scheduleFollowup({
        teamId: ctx.team!.id,
        relatedType: 'lead',
        relatedId: lead.id,
        assigneeId: lead.assigned_to,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        cadence,
        notes,
      });

      await ctx.reply(`✅ Follow-up scheduled for ${leadQuery}`);
    } catch (err: any) {
      await ctx.reply(`❌ ${err.message}`);
    }
  });
}
