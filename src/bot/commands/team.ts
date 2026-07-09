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
        m => `• @${m.username} — ${m.role} (Skills: ${m.skills.join(', ') || 'none'})${m.telegram_id > 0 ? ' ✅' : ' ⏳'}`
      );
      await ctx.reply(`*Team Members:*\n${lines.join('\n')}\n\n✅ = registered · ⏳ = only @mention, hasn't messaged bot yet`, { parse_mode: 'Markdown' });
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

  bot.command('sync', ownerOnly(), async (ctx) => {
    const entities = ctx.message.entities || [];
    const mentions = entities.filter(e => e.type === 'mention');

    if (mentions.length === 0) {
      return ctx.reply('Usage: /sync @user1 @user2 @user3\nTag the people you want to add as team members.');
    }

    let added = 0;
    for (const entity of mentions) {
      const username = ctx.message.text.slice(entity.offset + 1, entity.offset + entity.length).toLowerCase();
      try {
        await addMember(ctx.team!.id, 0, username, 'member', []);
        added++;
      } catch (e: any) {
        if (!e.message?.includes('Unique constraint')) {
          console.error('sync add error:', e.message);
        }
      }
    }

    await ctx.reply(`✅ Synced ${added} member(s) from mentions. They\'ll be fully registered when they first message the bot.\nUse /team list to see them.`);
  });

  bot.command('subscribe', async (ctx) => {
    const userId = ctx.from?.id;
    const username = ctx.from?.username?.toLowerCase();
    const firstName = ctx.from?.first_name;

    if (!userId) return ctx.reply('❌ Could not identify you.');

    const prisma = getDb();
    let team = await prisma.team.findFirst({ where: { owner_id: BigInt(Number(process.env.OWNER_TELEGRAM_ID)) } });

    if (!team) {
      team = await prisma.team.create({
        data: { name: 'Default Team', owner_id: BigInt(Number(process.env.OWNER_TELEGRAM_ID)) },
      });
    }

    const displayName = username || `${firstName}_${userId}`;

    try {
      const existing = await prisma.teamMember.findFirst({
        where: { team_id: team.id, telegram_id: BigInt(userId) },
      });

      if (existing) {
        await ctx.reply(`✅ You\'re already registered as @${existing.username || displayName}!`);
        return;
      }

      await addMember(team.id, userId, displayName, 'member', []);
      await ctx.reply(`✅ Subscribed! You\'re now a team member (@${displayName}).\nUse /done "what you completed" when you finish tasks.`);
    } catch (err: any) {
      await ctx.reply(`❌ ${err.message}`);
    }
  });
}