import { Telegraf } from 'telegraf';
import { TelegrafContext } from '../index.js';
import { ownerOnly } from '../middleware/auth.js';
import { createPipeline, addStage, getPipelines, getPipelineStages } from '../../services/pipeline-service.js';
import { updateLeadStage } from '../../services/lead-service.js';
import { getDb } from '../../services/db.js';

export function registerPipelineCommands(bot: Telegraf<TelegrafContext>) {
  bot.command('pipeline', ownerOnly(), async (ctx) => {
    const text = ctx.message.text.slice('/pipeline '.length).trim();
    const createMatch = text.match(/create\s+"([^"]+)"\s+stages:"([^"]+)"/);

    if (!createMatch) {
      return ctx.reply('Usage: /pipeline create "Pipeline Name" stages:"Stage1,Stage2,Stage3"');
    }

    const pipelineName = createMatch[1];
    const stageNames = createMatch[2].split(',').map(s => s.trim());

    try {
      const pipeline = await createPipeline(ctx.team!.id, pipelineName);

      for (let i = 0; i < stageNames.length; i++) {
        await addStage({
          pipelineId: pipeline.id,
          name: stageNames[i],
          order: i + 1,
        });
      }

      await ctx.reply(
        `✅ Pipeline "${pipelineName}" created with ${stageNames.length} stages:\n`
        + stageNames.map((s, i) => `  ${i + 1}. ${s}`).join('\n')
      );
    } catch (err: any) {
      await ctx.reply(`❌ ${err.message}`);
    }
  });

  bot.command('stage', async (ctx) => {
    const text = ctx.message.text.slice('/stage '.length).trim();
    const match = text.match(/"([^"]+)"\s+(.+)/);

    if (!match) {
      return ctx.reply('Usage: /stage "lead name" "stage name"');
    }

    const leadQuery = match[1];
    const stageName = match[2].trim();

    try {
      const prisma = getDb();
      const leads = await prisma.lead.findMany({
        where: { company_name: { contains: leadQuery, mode: 'insensitive' } },
        take: 1,
      });

      if (!leads || leads.length === 0) return ctx.reply(`❌ No lead matching "${leadQuery}"`);

      const stages = await getPipelineStages(leads[0].pipeline_id!);
      const stage = stages.find(s => s.name.toLowerCase() === stageName.toLowerCase());

      if (!stage) {
        const available = stages.map(s => s.name).join(', ');
        return ctx.reply(`❌ Stage "${stageName}" not found. Available: ${available}`);
      }

      await updateLeadStage(leads[0].id, stage.id);
      await ctx.reply(`✅ Lead "${leadQuery}" moved to "${stage.name}"`);
    } catch (err: any) {
      await ctx.reply(`❌ ${err.message}`);
    }
  });

  bot.command('pipeline_list', async (ctx) => {
    const pipelines = await getPipelines(ctx.team!.id);
    if (pipelines.length === 0) return ctx.reply('No pipelines defined. Use /pipeline create');

    const lines = pipelines.map((p: any) =>
      `*${p.name}*${p.is_default ? ' (default)' : ''}\n`
      + p.stages.map((s: any) => `  ${s.stage_order}. ${s.name}`).join('\n')
    );
    await ctx.reply(lines.join('\n\n'), { parse_mode: 'Markdown' });
  });
}
