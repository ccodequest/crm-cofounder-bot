import { Telegraf, Context } from 'telegraf';
import { Team, TeamMember, PersonaProfile } from '../types/index.js';
import { loadTeamContext } from './middleware/context.js';
import { registerAdminCommands } from './commands/admin.js';
import { registerTeamCommands } from './commands/team.js';
import { registerWorkCommands } from './commands/work.js';
import { registerReviewCommands } from './commands/review.js';
import { registerPersonaCommands } from './commands/persona.js';
import { registerLeadCommands } from './commands/lead.js';
import { registerPipelineCommands } from './commands/pipeline.js';
import { registerSchemaCommands } from './commands/schema.js';

declare module 'telegraf' {
  interface Context {
    session?: {
      lastReviewId?: string;
      pendingAutoAssign?: {
        leadId: string;
        members: any[];
        messageId: number;
      };
    };
  }
}

export interface TelegrafContext extends Context {
  team?: Team;
  member?: TeamMember;
  isOwner?: boolean;
  isFounder?: boolean;
  persona?: PersonaProfile;
}

let bot: Telegraf<TelegrafContext> | null = null;

export function getBot(): Telegraf<TelegrafContext> {
  if (!bot) {
    bot = new Telegraf<TelegrafContext>(process.env.TELEGRAM_BOT_TOKEN!);
    bot.use(loadTeamContext());

    registerAdminCommands(bot);
    registerTeamCommands(bot);
    registerWorkCommands(bot);
    registerReviewCommands(bot);
    registerPersonaCommands(bot);
    registerLeadCommands(bot);
    registerPipelineCommands(bot);
    registerSchemaCommands(bot);
  }
  return bot;
}
