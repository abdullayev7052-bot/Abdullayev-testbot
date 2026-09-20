import { Bot } from "grammy";
import { env } from "../env.ts";

/**
 * Bot obyekti alohida faylda — boshqa modullar sikl (circular import) siz foydalanadi.
 * `export let` — token almashtirilganda barcha modullar yangi obyektni ko'radi.
 */
export let bot = new Bot(env.BOT_TOKEN);
export let botToken = env.BOT_TOKEN;

export function createBot(token: string): Bot {
  botToken = token;
  bot = new Bot(token);
  return bot;
}
