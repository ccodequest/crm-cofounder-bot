import { Telegraf } from 'telegraf';
import { TelegrafContext } from '../index.js';
import { ownerOnly } from '../middleware/auth.js';
import { createLead, assignLead, saveEnrichment, logLeadActivity } from '../../services/lead-service.js';
import { researchLead, chatCompletion } from '../../services/ai.js';
import { getDb } from '../../services/db.js';
import { scheduleFollowup } from '../../services/task-service.js';

export function registerLeadCommands(bot: Telegraf<TelegrafContext>) {
  bot.command('lead', async (ctx) => {
    const text = ctx.message.text.slice('/lead '.length).trim();
    if (!text) return ctx.reply('Usage: /lead "Company name, contact, info..."');

    try {
      const lead = await createLead({
        teamId: ctx.team!.id,
        notes: text,
        source: 'manual',
      });

      await logLeadActivity(lead.id, 'created', text, ctx.from!.id);
      await ctx.reply(`✅ Lead created for "${text.slice(0, 50)}..." (ID: ${lead.id.slice(0, 8)})`);

      const domainMatch = text.match(/([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/);
      if (domainMatch) {
        await ctx.reply('🔍 Researching lead...');
        try {
          const research = await researchLead(domainMatch[1]);
          await saveEnrichment(lead.id, { raw_research: research, researched_at: new Date().toISOString() });

          await ctx.reply(`*Lead Research Results:*\n\n${research}`, { parse_mode: 'Markdown' });
        } catch (err: any) {
          await ctx.reply(`⚠️ Research failed: ${err.message}`);
        }
      }
    } catch (err: any) {
      await ctx.reply(`❌ ${err.message}`);
    }
  });

  bot.command('research', async (ctx) => {
    const domain = ctx.message.text.slice('/research '.length).trim();
    if (!domain) return ctx.reply('Usage: /research "domain.com"');

    await ctx.reply('🔍 Deep researching lead...');

    try {
      const research = await researchLead(domain);
      await ctx.reply(`*Deep Research Results for ${domain}:*\n\n${research}`, { parse_mode: 'Markdown' });
    } catch (err: any) {
      await ctx.reply(`❌ Research failed: ${err.message}`);
    }
  });

  bot.command('capture_lead', async (ctx) => {
    if (!ctx.message.reply_to_message) {
      return ctx.reply('Reply to a message with /capture_lead to extract lead info.');
    }

    const repliedText = (ctx.message.reply_to_message as any).text ||
                        (ctx.message.reply_to_message as any).caption || '';

    if (!repliedText) return ctx.reply('No text found in replied message.');

    try {
      const lead = await createLead({
        teamId: ctx.team!.id,
        notes: repliedText,
        source: 'telegram_capture',
      });

      await logLeadActivity(lead.id, 'captured', repliedText, ctx.from!.id);

      const extractionPrompt = `Extract lead information from this message:\n"${repliedText}"\nReturn as: Company, Contact, Role, Email, Phone, Notes.`;
      const extraction = await chatCompletion([
        { role: 'system', content: 'Extract structured lead info from text.' },
        { role: 'user', content: extractionPrompt },
      ]);

      await ctx.reply(
        `✅ Lead captured!\n\n*Extracted info:*\n${extraction}`,
        { parse_mode: 'Markdown' }
      );
    } catch (err: any) {
      await ctx.reply(`❌ ${err.message}`);
    }
  });

  bot.command('assign_lead', ownerOnly(), async (ctx) => {
    const text = ctx.message.text.slice('/assign_lead '.length).trim();
    const nameMatch = text.match(/^@?(\S+)/);
    const leadMatch = text.match(/"([^"]+)"/);

    if (!nameMatch || !leadMatch) {
      return ctx.reply('Usage: /assign_lead "Name" "lead company name"');
    }

    const identifier = nameMatch[1];
    const leadQuery = leadMatch[1];

    try {
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

      const leads = await prisma.lead.findMany({
        where: { company_name: { contains: leadQuery, mode: 'insensitive' } },
        take: 1,
      });

      if (!leads || leads.length === 0) {
        return ctx.reply(`❌ No lead found matching "${leadQuery}"`);
      }

      await assignLead(leads[0].id, member.id);
      await logLeadActivity(leads[0].id, 'assigned', `Assigned to @${member.username}`, ctx.from!.id);

      try {
        await ctx.telegram.sendMessage(
          Number(member.telegram_id),
          `📋 *Lead Assigned to You*\n\n${leads[0].company_name || leadQuery}\n\nFollow up and report back.`
        );
      } catch {}

      await ctx.reply(`✅ Lead "${leads[0].company_name || leadQuery}" assigned to @${member.username}`);
    } catch (err: any) {
      await ctx.reply(`❌ ${err.message}`);
    }
  });

  bot.command('assign_lead_auto', ownerOnly(), async (ctx) => {
    const text = ctx.message.text.slice('/assign_lead_auto '.length).trim();
    const leadMatch = text.match(/"([^"]+)"/);

    if (!leadMatch) {
      return ctx.reply('Usage: /assign_lead_auto "lead company name"');
    }

    const leadQuery = leadMatch[1];

    try {
      const prisma = getDb();
      const leads = await prisma.lead.findMany({
        where: { company_name: { contains: leadQuery, mode: 'insensitive' } },
        take: 1,
      });

      if (!leads || leads.length === 0) {
        return ctx.reply(`❌ No lead found matching "${leadQuery}"`);
      }

      const lead = leads[0];
      const members = await prisma.teamMember.findMany({
        where: { team_id: ctx.team!.id },
        orderBy: { role: 'asc' },
        take: 3,
      });

      if (!members || members.length === 0) {
        return ctx.reply('No team members available to assign.');
      }

      const recommendations = members.map((m: any, i: number) =>
        `${i + 1}. @${m.username} (${m.role})`
      );

      await ctx.reply(
        `🤖 *AI Lead Assignment:*\nLead: ${lead.company_name || leadQuery}\n\nRecommended assignees:\n${recommendations.join('\n')}\n\nReply with number (1-${members.length}) to assign.`,
        { parse_mode: 'Markdown' }
      );

      ctx.session = ctx.session || {};
      ctx.session.pendingAutoAssign = {
        leadId: lead.id,
        members,
        messageId: 0,
      };
    } catch (err: any) {
      await ctx.reply(`❌ ${err.message}`);
    }
  });

  }
