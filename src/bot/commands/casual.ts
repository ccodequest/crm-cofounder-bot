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

      let member = userId
        ? await prisma.teamMember.findFirst({ where: { telegram_id: BigInt(userId) } })
        : null;
      let team = member ? await prisma.team.findUnique({ where: { id: member.team_id } }) : null;

      const ownerId = Number(process.env.OWNER_TELEGRAM_ID);
      const isOwner = userId === ownerId;

      if (!team && isOwner) {
        let t = await prisma.team.findFirst({ where: { owner_id: BigInt(ownerId) } });
        if (!t) {
          t = await prisma.team.create({ data: { name: 'Default Team', owner_id: BigInt(ownerId) } });
          member = await prisma.teamMember.create({
            data: { team_id: t.id, telegram_id: BigInt(ownerId), username: userName.toLowerCase(), role: 'owner' },
          });
        } else {
          member = await prisma.teamMember.findFirst({ where: { team_id: t.id, telegram_id: BigInt(ownerId) } });
          if (!member) {
            member = await prisma.teamMember.create({
              data: { team_id: t.id, telegram_id: BigInt(ownerId), username: userName.toLowerCase(), role: 'owner' },
            });
          }
        }
        team = t;
      }

      if (!team) {
        const r = await chatCompletion([
          { role: 'system', content: `You are a helpful bot. Tell ${userName} to type /subscribe to register. Max 2 sentences.` },
          { role: 'user', content: text },
        ]);
        await ctx.reply(r);
        return;
      }

      const teamId = team.id;

      const allMembers = await prisma.teamMember.findMany({
        where: { team_id: teamId },
        select: { id: true, username: true, nickname: true, telegram_id: true, role: true, skills: true },
      });
      const allTasks = await prisma.task.findMany({
        where: { team_id: teamId },
        include: { assignee: { select: { id: true, username: true } } },
        orderBy: { created_at: 'desc' },
        take: 20,
      });
      const allLeads = await prisma.lead.findMany({
        where: { team_id: teamId },
        include: { assignee: { select: { username: true } } },
      });
      const allPipelines = await prisma.pipeline.findMany({
        where: { team_id: teamId },
        include: { stages: { orderBy: { stage_order: 'asc' } } },
      });

      const membersList = allMembers.map((m: any) => `@${m.username}${m.nickname ? ' (aka ' + m.nickname + ')' : ''} (${m.role})`).join(', ');
      const tasksList = allTasks.map((t: any) => `"${t.title}" [${t.status}] → @${t.assignee?.username || 'none'}`).join('; ');
      const leadsList = allLeads.map((l: any) => `${l.company_name || 'unnamed'} → @${l.assignee?.username || 'none'}`).join('; ');

      const intentResponse = await chatCompletion([
        {
          role: 'system',
          content: `You are a CRM intent parser. Given the user's message, output a JSON action.

Current team data:
- Members: ${membersList || 'none'}
- Tasks: ${tasksList || 'none'}
- Leads: ${leadsList || 'none'}
- Pipelines: ${allPipelines.map((p: any) => `${p.name}: ${p.stages.map((s: any) => s.name).join(' > ')}`).join('; ') || 'none'}

Available actions:
1. create_task: {"action":"create_task","params":{"title":"...","assignee_username":"...","due_date":"(optional)"},"reason":"..."}
   - assignee_username is the @username WITHOUT the @ sign
2. report_done: {"action":"report_done","params":{"content":"..."},"reason":"..."}
3. create_lead: {"action":"create_lead","params":{"company_name":"...","contact_name":"...","notes":"..."},"reason":"..."}
4. assign_lead: {"action":"assign_lead","params":{"company_name":"...","assignee_username":"..."},"reason":"..."}
5. get_status: {"action":"get_status","params":{"for_username":"(optional)"},"reason":"..."}
6. get_summary: {"action":"get_summary","params":{},"reason":"..."}
7. casual_chat: {"action":"casual_chat","params":{"message":"response to user"},"reason":"..."}

User: ${userName} (${isOwner ? 'owner' : member?.role || 'member'})

IMPORTANT RULES:
- Only use existing @usernames from the members list above.
- For create_task, assignee_username MUST match one of these usernames or nicknames: ${allMembers.map((m: any) => m.username + (m.nickname ? ' (' + m.nickname + ')' : '')).join(', ')}
- If the mentioned username doesn't exist in the members list, use casual_chat and say the user needs to be added via /sync first.
- The owner can create tasks and leads. Members can only report done and ask status.
- Output ONLY valid JSON. No markdown. No backticks. Just the JSON object.`,
        },
        { role: 'user', content: text },
      ], { temperature: 0.1, maxTokens: 500 });

      let action: AiAction;
      try {
        const clean = intentResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        action = JSON.parse(clean);
      } catch {
        action = { action: 'casual_chat', params: { message: intentResponse }, reason: 'parse fallback' };
      }

      const executeAction = async (): Promise<string> => {
        switch (action.action) {
          case 'create_task': {
            if (!isOwner) return '❌ Only the owner can assign tasks.';
            const assignee = allMembers.find((m: any) =>
              m.username === (action.params.assignee_username || '').toLowerCase() ||
              m.nickname === (action.params.assignee_username || '').toLowerCase()
            );
            if (!assignee) return `❌ Member "${action.params.assignee_username}" not found. Members: ${allMembers.map((m: any) => '@' + m.username + (m.nickname ? ' (' + m.nickname + ')' : '')).join(', ')}`;
            const { createTask } = await import('../../services/task-service.js');
            const task = await createTask({
              teamId, title: action.params.title, dueDate: action.params.due_date,
              assigneeId: assignee.id, creatorId: member!.id,
            });
            const tid = Number(assignee.telegram_id);
            let dmStatus = '';
            try {
              await ctx.telegram.sendMessage(tid,
                `📋 *New Task*\n\n"${task.title}"${action.params.due_date ? '\nDue: ' + action.params.due_date : ''}\n\nUse /done when finished.`);
              dmStatus = ' ✅ DM sent';
            } catch (e: any) {
              dmStatus = ` ⚠️ DM failed (${e.message || 'user may need to start bot'})`;
            }
            return `✅ Task "${task.title}" assigned to @${assignee.username}${action.params.due_date ? ' (due ' + action.params.due_date + ')' : ''}${dmStatus}`;
          }

          case 'report_done': {
            if (!member) return '❌ Subscribe first with /subscribe';
            const myTasks = allTasks.filter((t: any) => t.assignee_id === member.id && ['pending', 'in_progress'].includes(t.status));
            const task = myTasks[0];
            if (!task) return '❌ No pending tasks found for you.';
            const { submitReport } = await import('../../services/task-service.js');
            await submitReport({ taskId: task.id, reporterId: member.id, content: action.params.content || 'Completed.' });
            try {
              await ctx.telegram.sendMessage(ownerId,
                `📝 *Report from @${member.username}*\n\nTask: ${task.title}\n${action.params.content}\n\nUse /review to see all pending.`);
            } catch (e: any) {
              console.error('owner DM failed:', e.message);
            }
            return '✅ Report submitted for owner review.';
          }

          case 'create_lead': {
            if (!isOwner) return '❌ Only the owner can create leads.';
            const { createLead, logLeadActivity } = await import('../../services/lead-service.js');
            const lead = await createLead({ teamId, companyName: action.params.company_name, contactName: action.params.contact_name, notes: action.params.notes });
            if (ctx.from?.id) await logLeadActivity(lead.id, 'created', action.params.notes || '', ctx.from.id);
            return `✅ Lead created for ${lead.company_name || 'unnamed'}.`;
          }

          case 'assign_lead': {
            if (!isOwner) return '❌ Only the owner can assign leads.';
            const foundLead = allLeads.find((l: any) => l.company_name?.toLowerCase().includes((action.params.company_name || '').toLowerCase()));
            if (!foundLead) return `❌ No lead matching "${action.params.company_name}"`;
            const assignee = allMembers.find((m: any) =>
              m.username === (action.params.assignee_username || '').toLowerCase() ||
              m.nickname === (action.params.assignee_username || '').toLowerCase()
            );
            if (!assignee) return '❌ Member not found.';
            const { assignLead, logLeadActivity } = await import('../../services/lead-service.js');
            await assignLead(foundLead.id, assignee.id);
            if (ctx.from?.id) await logLeadActivity(foundLead.id, 'assigned', `to @${assignee.username}`, ctx.from.id);
            return `✅ Lead "${foundLead.company_name}" assigned to @${assignee.username}.`;
          }

          case 'get_status': {
            const username = action.params.for_username || member?.username;
            const target = allMembers.find((m: any) => m.username === username);
            if (!target) return 'Member not found.';
            const theirTasks = allTasks.filter((t: any) => t.assignee_id === target.id);
            const pT = theirTasks.filter((t: any) => ['pending', 'in_progress'].includes(t.status));
            const dT = theirTasks.filter((t: any) => t.status === 'completed');
            return `📊 *@${target.username} Status*\nPending: ${pT.length}\nCompleted: ${dT.length}\n${pT.length > 0 ? 'Active: ' + pT.map((t: any) => `"${t.title}"`).join(', ') : ''}`;
          }

          case 'get_summary': {
            const pTasks = allTasks.filter((t: any) => ['pending', 'in_progress'].includes(t.status));
            return `📋 *Team Summary*\nMembers: ${allMembers.length}\nActive: ${pTasks.length}\nOverdue: ${allTasks.filter((t: any) => t.due_date && new Date(t.due_date) < new Date() && ['pending', 'in_progress'].includes(t.status)).length}\nLeads: ${allLeads.length}`;
          }

          default: {
            const resp = await chatCompletion([
              { role: 'system', content: `You are the AI Co-Founder. Respond to ${userName} naturally. Max 3 sentences. Direct. No fluff.` },
              { role: 'user', content: text },
            ]);
            return resp;
          }
        }
      };

      const result = await executeAction();
      await ctx.reply(result, { parse_mode: 'Markdown' });

    } catch (err: any) {
      await ctx.reply(`⚠️ ${err.message}`);
    }
  });
}