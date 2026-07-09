import { Telegraf } from 'telegraf';
import { TelegrafContext } from '../index.js';
import { ownerOnly } from '../middleware/auth.js';
import { createDynamicTable, listDynamicTables } from '../../services/schema-service.js';

export function registerSchemaCommands(bot: Telegraf<TelegrafContext>) {
  bot.command('schema', ownerOnly(), async (ctx) => {
    const text = ctx.message.text.slice('/schema '.length).trim();
    const createMatch = text.match(/create\s+"(\w+)"\s+fields:"([^"]+)"/);

    if (createMatch) {
      const tableName = createMatch[1];
      const fieldsStr = createMatch[2];
      const fields: Record<string, string> = {};

      fieldsStr.split(',').forEach(f => {
        const [name, type] = f.trim().split(':');
        if (name && type) fields[name.trim()] = type.trim();
      });

      try {
        const result = await createDynamicTable(tableName, fields, ctx.from!.id);
        await ctx.reply(
          `✅ Table "custom_${tableName}" created (v${result.version})\n`
          + `Fields: ${Object.keys(fields).join(', ')}`
        );
      } catch (err: any) {
        await ctx.reply(`❌ ${err.message}`);
      }
    } else if (text === 'list') {
      const tables = await listDynamicTables();
      if (tables.length === 0) return ctx.reply('No custom tables created yet.');
      const lines = tables.map(t =>
        `• custom_${t.table_name} (v${t.version}) — Fields: ${Object.keys(t.schema_json).join(', ')}`
      );
      await ctx.reply(`*Custom Tables:*\n${lines.join('\n')}`, { parse_mode: 'Markdown' });
    } else {
      await ctx.reply('Usage:\n/schema create "table_name" fields:"field1:text,field2:number,field3:date"');
    }
  });
}
