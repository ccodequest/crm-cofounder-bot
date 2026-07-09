import { Middleware } from 'telegraf';
import { TelegrafContext } from '../index.js';

export function ownerOnly(): Middleware<TelegrafContext> {
  return (ctx, next) => {
    const ownerId = Number(process.env.OWNER_TELEGRAM_ID);
    if (ctx.from?.id !== ownerId) {
      return ctx.reply('⛔ Only the Owner can use this command.');
    }
    return next();
  };
}

export function founderOrOwner(): Middleware<TelegrafContext> {
  return (ctx, next) => {
    const ownerId = Number(process.env.OWNER_TELEGRAM_ID);
    const founderId = Number(process.env.FOUNDER_TELEGRAM_ID);
    const userId = ctx.from?.id;
    if (userId !== ownerId && userId !== founderId) {
      return ctx.reply('⛔ Only Owner or Founder can use this command.');
    }
    return next();
  };
}
