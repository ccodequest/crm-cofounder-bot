import { Telegraf } from 'telegraf';
import { TelegrafContext } from '../index.js';
import { chatCompletion } from '../../services/ai.js';
import { getDb } from '../../services/db.js';

interface AiAction {
  action: string;
  params: Record<string, any>;
  reason: string;
}

export function registerCasualChat(bot: Telegraf<TelegrafContext>) {
  bot.on('text', async (ctx, next) => {
    const text = ctx.message.text;
    if (text.startsWith('/')) return next();

    const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
    if (isGroup) {
      const botUsername = ctx.botInfo?.username?.toLowerCase();
      const isMentioned = ctx.message.entities?.some(
        e => e.type === 'mention' && text.slice(e.offset + 1, e.offset + e.length).toLowerCase() === botUsername
      );
      if (!isMentioned) return;
    }

    const userId = ctx.from?.id;
    const userName = ctx.from?.first_name || ctx.from?.username || 'User';

    try {
      await ctx.replyWithChatAction('typing');
      const prisma = getDb();

      const member = userId
        ? await prisma.teamMember.findFirst({ where: { telegram_id: BigInt(userId) } })
        : null;
      const team = member ? await prisma.team.findUnique({ where: { id: member.team_id } }) : null;

      const ownerId = Number(process.env.OWNER_TELEGRAM_ID);
      const isOwner = userId === ownerId;

      if (!team) {
        if (isOwner) {
          let t = await prisma.team.findFirst({ where: { owner_id: BigInt(ownerId) } });
          if (!t) {
            t = await prisma.team.create({ data: { name: 'Default Team', owner_id: BigInt(ownerId) } });
            await prisma.teamMember.create({
              data: { team_id: t.id, telegram_id: BigInt(ownerId), username: userName.toLowerCase(), role: 'owner' },
            });
          }
          ctx.team = t as any;
        } else {
          const r = await chatCompletion([{ role: 'system', content: `You are a helpful bot. Tell ${userName} to type /subscribe to register. Max 2 sentences.` }, { role: 'user', content: text }]);
          await ctx.reply(r);
          return;
        }
      }

      const teamId = (ctx.team || team)!.id;
      const allMembers = await prisma.teamMember.findMany({ where: { team_id: teamId } });
      const allTasks = await prisma.task.findMany({ where: { team_id: teamId }, include: { assignee: true } });
      const allLeads = await prisma.lead.findMany({ where: { team_id: teamId }, include: { assignee: true } });

      const intentResponse = await chatCompletion([
        {
          role: 'system',
          content: `You are a CRM intent parser. Given the user's message, output a JSON action. Available actions:

1. create_task: {"action":"create_task","params":{"title":"...","assignee_username":"...","due_date":"..."},"reason":"..."}
   - assignee_username is the @username without @. Infer from context.
   - due_date is optional. Parse natural dates.

2. report_done: {"action":"report_done","params":{"task_title":"...","content":"..."},"reason":"..."}

3. create_lead: {"action":"create_lead","params":{"company_name":"...","contact_name":"...","notes":"..."},"reason":"..."}

4. assign_lead: {"action":"assign_lead","params":{"company_name":"...","assignee_username":"..."},"reason":"..."}

5. get_status: {"action":"get_status","params":{"for_username":"..."},"reason":"..."}

6. get_summary: {"action":"get_summary","params":{},"reason":"..."}

7. list_members: {"action":"list_members","params":{},"reason":"..."}

8. casual_chat: {"action":"casual_chat","params":{"message":"..."},"reason":"..."}

Current team members: ${allMembers.map((m: any) => `@${m.username} (${m.role})`).join(', ')}
Current tasks: ${allTasks.map((t: any) => `"${t.title}" [${t.status}] → @${t.assignee?.username || 'none'}`).join('; ')}
Current leads: ${allLeads.map((l: any) => l.company_name || 'unnamed').join(', ')}

User: ${userName} (${isOwner ? 'owner' : member?.role || 'member'})
Role: ${isOwner ? 'Owner - can do everything' : 'Team member - can report done and ask status'}

Output ONLY valid JSON, nothing else.`,
        },
        { role: 'user', content: text },
      ], { temperature: 0.1 });

      let action: AiAction;
      try {
        const clean = intentResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        action = JSON.parse(clean);
      } catch {
        action = { action: 'casual_chat', params: { message: intentResponse }, reason: 'parse fallback' };
      }

      const speaker = ctx.from;
      const execute = async () => {
        switch (action.action) {
          case 'create_task': {
            if (!isOwner) return ctx.reply('❌ Only the owner can assign tasks.');
            const assignee = allMembers.find((m: any) => m.username === action.params.assignee_username?.toLowerCase());
            if (!assignee) return ctx.reply(`❌ Member @${action.params.assignee_username} not found. Use: ${allMembers.map((m: any) => '@' + m.username).join(', ')}`);
            const { createTask } = await import('../../services/task-service.js');
            const task = await createTask({
              teamId, title: action.params.title, dueDate: action.params.due_date,
              assigneeId: assignee.id, creatorId: member?.id || assignee.id,
            });
            try {
              await ctx.telegram.sendMessage(Number(assignee.telegram_id),
                `📋 *New Task*\n\n"${task.title}"${action.params.due_date ? '\nDue: ' + action.params.due_date : ''}\n\nReport with /done when finished.`);
            } catch {}
            return ctx.reply(`✅ Task "${task.title}" assigned to @${assignee.username}${action.params.due_date ? ' (due ' + action.params.due_date + ')' : ''}`);
          }

          case 'report_done': {
            if (!member) return ctx.reply('❌ Subscribe first with /subscribe');
            const myTasks = allTasks.filter((t: any) => t.assignee_id === member.id && ['pending', 'in_progress'].includes(t.status));
            let task = myTasks.find((t: any) => action.params.task_title && t.title.toLowerCase().includes(action.params.task_title.toLowerCase()));
            if (!task) task = myTasks[0];
            if (!task) return ctx.reply('❌ No pending tasks found for you.');
            const { submitReport } = await import('../../services/task-service.js');
            await submitReport({ taskId: task.id, reporterId: member.id, content: action.params.content || 'Completed.' });
            try {
              await ctx.telegram.sendMessage(ownerId,
                `📝 *Report from @${member.username}*\n\nTask: ${task.title}\n${action.params.content}\n\nUse /review to see all pending.`);
            } catch {}
            return ctx.reply('✅ Report submitted for owner review.');
          }

          case 'create_lead': {
            if (!isOwner) return ctx.reply('❌ Only the owner can create leads.');
            const { createLead, logLeadActivity } = await import('../../services/lead-service.js');
            const lead = await createLead({ teamId, companyName: action.params.company_name, contactName: action.params.contact_name, notes: action.params.notes });
            if (speaker?.id) await logLeadActivity(lead.id, 'created', action.params.notes || '', speaker.id);
            return ctx.reply(`✅ Lead created for ${lead.company_name || 'unnamed'}.`);
          }

          case 'assign_lead': {
            if (!isOwner) return ctx.reply('❌ Only the owner can assign leads.');
            const foundLead = allLeads.find((l: any) => l.company_name?.toLowerCase().includes(action.params.company_name?.toLowerCase()));
            if (!foundLead) return ctx.reply(`❌ No lead matching "${action.params.company_name}"`);
            const assignee = allMembers.find((m: any) => m.username === action.params.assignee_username?.toLowerCase());
            if (!assignee) return ctx.reply('❌ Member not found.');
            const { assignLead, logLeadActivity } = await import('../../services/lead-service.js');
            await assignLead(foundLead.id, assignee.id);
            if (speaker?.id) await logLeadActivity(foundLead.id, 'assigned', `to @${assignee.username}`, speaker.id);
            return ctx.reply(`✅ Lead "${foundLead.company_name}" assigned to @${assignee.username}.`);
          }

          case 'get_status': {
            const username = action.params.for_username || member?.username;
            const targetMember = allMembers.find((m: any) => m.username === username);
            if (!targetMember) return ctx.reply('Member not found.');
            const theirTasks = allTasks.filter((t: any) => t.assignee_id === targetMember.id);
            const pendingT = theirTasks.filter((t: any) => ['pending', 'in_progress'].includes(t.status));
            const doneT = theirTasks.filter((t: any) => t.status === 'completed');
            return ctx.reply(
              `📊 *@${targetMember.username} Status*\n`
              + `Pending: ${pendingT.length}\nCompleted: ${doneT.length}\n`
              + `${pendingT.length > 0 ? 'Active: ' + pendingT.map((t: any) => `"${t.title}"`).join(', ') : ''}`);
          }

          case 'get_summary': {
            const pTasks = allTasks.filter((t: any) => ['pending', 'in_progress'].includes(t.status));
            const oDue = allTasks.filter((t: any) => t.due_date && new Date(t.due_date) < new Date() && ['pending', 'in_progress'].includes(t.status));
            return ctx.reply(
              `📋 *Team Summary*\n`
              + `Members: ${allMembers.length}\n`
              + `Active tasks: ${pTasks.length}\n`
              + `Overdue: ${oDue.length}\n`
              + `Leads: ${allLeads.length}`);
          }

          case 'list_members': {
            return ctx.reply(`*Team Members:*\n${allMembers.map((m: any) => `• @${m.username} — ${m.role}`).join('\n')}`);
          }

          default: {
            const resp = await chatCompletion([
              { role: 'system', content: `You are the AI Co-Founder. Respond to ${userName} naturally. Max 3 sentences. Direct.` },
              { role: 'user', content: text },
            ]);
            return ctx.reply(resp);
          }
        }
      };

      await execute();
    } catch (err: any) {
      await ctx.reply(`⚠️ ${err.message}`);
    }
  });
}