import { Telegraf } from 'telegraf';
import { TelegrafContext } from '../index.js';
import { ownerOnly } from '../middleware/auth.js';
import { getPendingReports } from '../../services/task-service.js';
import { reviewReport, generateFounderBriefing } from '../../services/ai.js';
import { getPersona } from '../../services/persona-service.js';
import { getDb } from '../../services/db.js';
import { Tone } from '../../types/index.js';

export function registerReviewCommands(bot: Telegraf<TelegrafContext>) {
  bot.command('review', ownerOnly(), async (ctx) => {
    const reports = await getPendingReports(ctx.team!.id);
    if (reports.length === 0) {
      return ctx.reply('No pending reports to review.');
    }

    await ctx.reply(`📋 ${reports.length} report(s) pending review. Analyzing with AI Co-Founder...`);

    for (const report of reports) {
      const prisma = getDb();
      const assignee = report.reporter_id
        ? await prisma.teamMember.findUnique({ where: { id: report.reporter_id } })
        : null;

      const memberName = assignee?.username || 'Unknown';
      const persona = assignee ? await getPersona(Number(assignee.telegram_id)) : null;
      const tone: Tone = persona?.tone || 'strict';

      try {
        const analysis = await reviewReport(
          report.content,
          report.task?.title || 'Unknown task',
          memberName,
          tone
        );

        await prisma.taskReport.update({
          where: { id: report.id },
          data: { cofounder_analysis: { analysis, reviewed_at: new Date().toISOString() } },
        });

        await ctx.reply(
          `*AI Co-Founder Review:* @${memberName} — "${report.task?.title}"\n\n${analysis}\n\n`
          + `Use /approve or /revise "feedback" to respond.`,
          { parse_mode: 'Markdown' }
        );

        ctx.session = ctx.session || {};
        ctx.session.lastReviewId = report.id;
      } catch (err: any) {
        await ctx.reply(`❌ AI review failed for @${memberName}: ${err.message}`);
      }
    }
  });

  bot.command('approve', ownerOnly(), async (ctx) => {
    const reviewId = ctx.session?.lastReviewId;
    if (!reviewId) return ctx.reply('No review in session. Run /review first.');

    const prisma = getDb();
    await prisma.taskReport.update({
      where: { id: reviewId },
      data: { status: 'approved', reviewer_notes: 'Approved by Owner' },
    });

    const report = await prisma.taskReport.findUnique({
      where: { id: reviewId },
      include: { task: true, reporter: true },
    });

    if (report?.reporter?.telegram_id) {
      try {
        await ctx.telegram.sendMessage(
          Number(report.reporter.telegram_id),
          `✅ Your report for "${report.task?.title}" has been approved.`
        );
      } catch {}
    }

    await ctx.reply('✅ Report approved.');
  });

  bot.command('revise', ownerOnly(), async (ctx) => {
    const reviewId = ctx.session?.lastReviewId;
    const feedback = ctx.message.text.slice('/revise '.length).trim();
    if (!reviewId) return ctx.reply('No review in session. Run /review first.');
    if (!feedback) return ctx.reply('Usage: /revise "What needs to change"');

    const prisma = getDb();
    await prisma.taskReport.update({
      where: { id: reviewId },
      data: { status: 'revision_required', reviewer_notes: feedback },
    });

    const report = await prisma.taskReport.findUnique({
      where: { id: reviewId },
      include: { task: true, reporter: true },
    });

    if (report?.reporter?.telegram_id) {
      try {
        await ctx.telegram.sendMessage(
          Number(report.reporter.telegram_id),
          `🔄 *Revision Required* for "${report.task?.title}"\n\n${feedback}\n\nPlease update and resubmit with /done.`,
          { parse_mode: 'Markdown' }
        );
      } catch {}
    }

    await ctx.reply(`🔄 Revision requested. ${feedback}`);
  });

  bot.command('call_founder', ownerOnly(), async (ctx) => {
    const reviewId = ctx.session?.lastReviewId;
    if (!reviewId) return ctx.reply('No review in session. Run /review first.');

    const prisma = getDb();
    const report = await prisma.taskReport.findUnique({
      where: { id: reviewId },
      include: { task: true },
    });

    if (!report) return ctx.reply('Report not found.');

    try {
      const debateSummary = `Owner reviewed report. Report: "${report.content}". ` +
        `Status: ${report.status}. Owner notes: ${report.reviewer_notes || 'none'}.`;

      const briefing = await generateFounderBriefing(
        debateSummary,
        report.content,
        report.task?.title || 'Unknown'
      );

      const founderId = Number(process.env.FOUNDER_TELEGRAM_ID);
      if (founderId) {
        await ctx.telegram.sendMessage(
          founderId,
          `📋 *Founder Briefing from AI Co-Founder*\n\n${briefing}\n\n---\nOwner @${ctx.from?.username} requested escalation.`,
          { parse_mode: 'Markdown' }
        );
        await ctx.reply('📋 Founder has been briefed with full context.');
      } else {
        await ctx.reply('⚠️ Founder Telegram ID not configured.');
      }
    } catch (err: any) {
      await ctx.reply(`❌ Failed to brief founder: ${err.message}`);
    }
  });
}
