import { GrammyError } from "grammy";
import type { InlineKeyboard, Keyboard } from "grammy";
import { bot } from "./instance.ts";
import { prisma } from "../db.ts";
import { log } from "../logger.ts";

type Markup = InlineKeyboard | Keyboard | { remove_keyboard: true };

/** Foydalanuvchiga xavfsiz xabar yuborish (bloklaganlarni belgilab qo'yadi) */
export async function sendToUser(telegramId: bigint | number | string, text: string, opts?: { reply_markup?: Markup; disable_notification?: boolean }): Promise<number | null> {
  try {
    const m = await bot.api.sendMessage(String(telegramId), text, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: opts?.reply_markup as never,
      disable_notification: opts?.disable_notification,
    });
    return m.message_id;
  } catch (e) {
    if (e instanceof GrammyError && (e.error_code === 403 || /chat not found|bot was blocked|user is deactivated/i.test(e.description))) {
      await prisma.user.updateMany({ where: { telegramId: BigInt(telegramId) }, data: { isBlocked: true } }).catch(() => {});
      log.warn(`Foydalanuvchi ${telegramId} botni bloklagan`);
      return null;
    }
    log.error("sendToUser", (e as Error).message);
    return null;
  }
}

export async function sendPhotoToUser(telegramId: bigint | number | string, photo: Buffer | string, caption?: string): Promise<boolean> {
  try {
    const { InputFile } = await import("grammy");
    await bot.api.sendPhoto(String(telegramId), typeof photo === "string" ? photo : new InputFile(photo, "card.png"), { caption, parse_mode: "HTML" });
    return true;
  } catch (e) {
    log.error("sendPhotoToUser", (e as Error).message);
    return false;
  }
}

export async function sendDocumentToUser(telegramId: bigint | number | string, file: Buffer, filename: string, caption?: string): Promise<boolean> {
  try {
    const { InputFile } = await import("grammy");
    await bot.api.sendDocument(String(telegramId), new InputFile(file, filename), { caption, parse_mode: "HTML" });
    return true;
  } catch (e) {
    log.error("sendDocumentToUser", (e as Error).message);
    return false;
  }
}
