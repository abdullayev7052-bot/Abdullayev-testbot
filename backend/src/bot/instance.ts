import { Bot } from "grammy";
import { env } from "../env.ts";

/** Bot obyekti alohida faylda — boshqa modullar sikl (circular import) siz foydalanadi */
export const bot = new Bot(env.BOT_TOKEN);
