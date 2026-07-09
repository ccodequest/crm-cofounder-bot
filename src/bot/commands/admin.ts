import { Telegraf } from 'telegraf';
import { TelegrafContext } from '../index.js';

export function registerAdminCommands(bot: Telegraf<TelegrafContext>) {
  bot.start(async (ctx) => {
    await ctx.reply(
      '🤖 *CRM Co-Founder Bot*\n\n'
      + 'I manage your team, tasks, and leads with an AI co-founder.\n\n'
      + '📌 *Quick Start:*\n'
      + '• Type /subscribe to register as a team member\n'
      + '• Owner: /sync @user1 @user2 to add people by mention\n'
      + '• /help — Full command list',
      { parse_mode: 'Markdown' }
    );
  });

  bot.help(async (ctx) => {
    const isOwner = ctx.isOwner;
    const commands = [
      '━━ *Getting Started* ━━',
      '✅ /subscribe — Register yourself as a team member',
      '📋 /sync @user1 @user2 — (Owner) Add people by @mention',
      '━━ *Tasks* ━━',
      '/assign "Name" "task" due:date — Assign work (use name or @)',
      '/done "details" — Report completion',
      '/status @Name — View workload',
      '/overdue — List overdue tasks',
      '━━ *Leads & CRM* ━━',
      '/lead "company, contact, info" — Create lead',
      '/research "domain" — Deep AI research on a company',
      '/capture_lead — (reply) Capture lead from a message',
      '/assign_lead "Name" "company" — Assign lead by name',
      '/assign_lead_auto "company" — AI recommends who gets the lead',
      '/stage "lead" "stage" — Move lead through pipeline',
      '/followup "lead" cadence:"weekly" — Schedule followup',
      '━━ *Team* ━━',
      '/team add @user role skills — Add member manually',
      '/team list — View all members',
      '/team role @user role — Change role',
      '/persona "Name" brutal|strict|neutral|gentle — Set AI tone',
      ...(isOwner ? [
        '━━ *Owner Review* ━━',
        '/review — AI co-founder reviews pending reports',
        '/approve — Approve last reviewed report',
        '/revise "feedback" — Request revision',
        '/call_founder — Escalate to founder',
        '/schema create "table" fields:"..." — Custom tables',
        '━━ *Pipelines* ━━',
        '/pipeline create "Sales" stages:"New,Contacted,Qualified"',
        '/pipeline_list — View pipelines',
        '/stage "lead" "stage" — Move lead in pipeline',
      ] : []),
    ];
    await ctx.reply(`*CRM Co-Founder Bot — Full Commands:*\n\n${commands.join('\n')}`, { parse_mode: 'Markdown' });
  });
}