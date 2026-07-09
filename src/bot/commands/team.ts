import { Telegraf } from 'telegraf';
import { TelegrafContext } from '../index.js';
import { ownerOnly } from '../middleware/auth.js';
import { addMember, listMembers, updateMemberRole } from '../../services/team-service.js';
import { getDb } from '../../services/db.js';

export function registerTeamCommands(bot: Telegraf<TelegrafContext>) {
  bot.command('team', ownerOnly(), async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    const subcommand = args[0]?.toLowerCase();

    if (subcommand === 'add') {
      const mention = args[1];
      const role = args[2] || 'member';
      const skills = args.slice(3) || [];
      const username = mention?.replace('@', '');

      if (!mention || !username) {
        return ctx.reply('Usage: /team add @username role skill1 skill2');
      }

      const entity = ctx.message.entities?.find(e => e.type === 'mention');
      const mentionedUsername = entity
        ? ctx.message.text.slice(entity.offset + 1, entity.offset + entity.length)
        : username;

      try {
        await addMember(ctx.team!.id, 0, mentionedUsername, role, skills);
        await ctx.reply(`✅ Added @${username} as ${role}`);
      } catch (err: any) {
        await ctx.reply(`❌ ${err.message}`);
      }
    } else if (subcommand === 'list') {
      const members = await listMembers(ctx.team!.id);
      if (members.length === 0) {
        return ctx.reply('No team members yet.');
      }
      const lines = members.map(
        m => `• @${m.username} — ${m.role} (Skills: ${m.skills.join(', ') || 'none'})`
      );
      await ctx.reply(`*Team Members:*\n${lines.join('\n')}`, { parse_mode: 'Markdown' });
    } else if (subcommand === 'role') {
      const mention = args[1];
      const newRole = args[2];
      if (!mention || !newRole) {
        return ctx.reply('Usage: /team role @username role');
      }
      const entity = ctx.message.entities?.find(e => e.type === 'mention');
      if (!entity) return ctx.reply('User not found');
      const mentionedUsername = ctx.message.text.slice(entity.offset + 1, entity.offset + entity.length);

      try {
        const prisma = getDb();
        const member = await prisma.teamMember.findFirst({
          where: { username: mentionedUsername },
        });

        if (!member) return ctx.reply('Member not found');
        await updateMemberRole(Number(member.telegram_id), newRole);
        await ctx.reply(`✅ Updated @${mentionedUsername} role to ${newRole}`);
      } catch (err: any) {
        await ctx.reply(`❌ ${err.message}`);
      }
    } else {
      await ctx.reply('Available: /team add, /team list, /team role');
    }
  });

  bot.command('sync_group', ownerOnly(), async (ctx) => {
    if (!ctx.chat || ctx.chat.type === 'private') {
      return ctx.reply('❌ Run this in a group where the bot is a member.');
    }

    await ctx.reply('🔄 Fetching group members...');

    try {
      const admins = await ctx.getChatAdministrators();
      const chatMembers = admins.filter(m => !m.user.is_bot);

      let added = 0;
      for (const m of chatMembers) {
        const username = m.user.username || `${m.user.first_name}_${m.user.id}`;
        try {
          await addMember(ctx.team!.id, m.user.id, username.toLowerCase(), 'member', []);
          added++;
        } catch (e: any) {
          if (!e.message?.includes('Unique constraint')) {
            console.error('sync add error:', e.message);
          }
        }
      }

      await ctx.reply(`✅ Synced ${added} members from group.\nUse /team list to see them.`);
    } catch (err: any) {
      await ctx.reply(`❌ Sync failed: ${err.message}`);
    }
  });
}