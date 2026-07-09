import { Telegraf } from 'telegraf';
import { TelegrafContext } from '../index.js';

export function registerAdminCommands(bot: Telegraf<TelegrafContext>) {
  bot.start(async (ctx) => {
    await ctx.reply(
      '🤖 *CRM Co-Founder Bot*\n\n'
      + 'I manage your team, tasks, and leads with an AI co-founder that keeps everyone accountable.\n\n'
      + 'Commands:\n'
      + '• /team add/list/role — Manage team\n'
      + '• /assign @user task due:date — Assign work\n'
      + '• /done details — Report completion\n'
      + '• /review — Co-founder reviews reports\n'
      + '• /lead company info — Create lead\n'
      + '• /research domain — Deep lead research\n'
      + '• /persona @user tone — Set bot tone\n'
      + '• /help — Full command list',
      { parse_mode: 'Markdown' }
    );
  });

  bot.help(async (ctx) => {
    const isOwner = ctx.isOwner;
    const commands = [
      '/assign @user "task" due:date — Assign work',
      '/done "details" — Report completion',
      '/status @user — View workload',
      '/overdue — List overdue items',
      '/lead "company, contact, info" — Create lead',
      '/research "domain" — Deep AI research',
      '/capture_lead — (reply) Capture lead from message',
      '/pipeline create name stages:"..." — Create pipeline',
      '/stage "lead" "stage" — Move lead',
      '/followup "lead" cadence:"weekly" — Schedule followup',
      '/team add @user role skills',
      '/team list',
      '/persona @user brutal|strict|neutral|gentle',
      ...(isOwner ? [
        '/review — Co-founder reviews pending reports',
        '/approve — Approve report',
        '/revise "feedback" — Request revision',
        '/call_founder — Escalate to founder',
        '/schema create "table" fields:"..."',
      ] : []),
    ];
    await ctx.reply(`*Commands:*\n${commands.map(c => `• ${c}`).join('\n')}`, { parse_mode: 'Markdown' });
  });
}
