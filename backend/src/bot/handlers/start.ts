import type { Bot } from "grammy";
import type { MyContext } from "../context.ts";
import { setUserStep } from "../context.ts";
import { contactKeyboard, mainKeyboard, openAppInline } from "../keyboards.ts";
import { linkOrCreateCustomer } from "../../bito/customers.ts";
import { normalizePhone } from "../../utils/format.ts";
import { activity, errMsg, log } from "../../logger.ts";
import { prisma } from "../../db.ts";

export async function sendMainMenu(ctx: MyContext, text?: string) {
  const name = ctx.user.name || ctx.user.tgFirstName || "";
  await ctx.reply(text || ctx.t("welcomeBack", { name }), { reply_markup: mainKeyboard(ctx.lang), parse_mode: "HTML" });
  const inline = openAppInline(ctx.lang);
  if (inline) await ctx.reply(ctx.t("openAppButton"), { reply_markup: inline });
}

export function registerStart(bot: Bot<MyContext>) {
  bot.command("start", async (ctx) => {
    if (ctx.chat.type !== "private") return;
    if (ctx.user.step === "done") {
      await sendMainMenu(ctx);
      return;
    }
    await ctx.reply(ctx.t("welcome"), { parse_mode: "HTML" });
    await ctx.reply(ctx.t("askPhone"), { reply_markup: contactKeyboard(ctx.lang), parse_mode: "HTML" });
    await setUserStep(ctx, "phone");
  });

  // Telefon raqam (kontakt)
  bot.on("message:contact", async (ctx) => {
    if (ctx.chat.type !== "private") return;
    const c = ctx.message.contact;
    // Xavfsizlik: faqat o'z kontakti (Telegram user_id mos kelishi shart)
    if (!c.user_id || c.user_id !== ctx.from.id) {
      await ctx.reply(ctx.t("wrongContact"), { reply_markup: contactKeyboard(ctx.lang), parse_mode: "HTML" });
      return;
    }
    const phone = normalizePhone(c.phone_number);
    if (!phone) {
      await ctx.reply(ctx.t("wrongContact"), { reply_markup: contactKeyboard(ctx.lang), parse_mode: "HTML" });
      return;
    }
    // Bir xil raqam boshqa Telegram akkauntga bog'langan bo'lsa — eski bog'lanishni tozalaymiz (raqam egasi hozirgi odam)
    await prisma.user.updateMany({ where: { phone, NOT: { id: ctx.user.id } }, data: { phone: null, bitoCustomerId: null, step: "new" } });
    await setUserStep(ctx, "phone", { phone });

    try {
      const existing = await linkOrCreateCustomerIfExists(ctx, phone);
      if (existing) {
        await setUserStep(ctx, "done");
        await ctx.reply(ctx.t("registered"), { reply_markup: mainKeyboard(ctx.lang), parse_mode: "HTML" });
      { const inline = openAppInline(ctx.lang); if (inline) await ctx.reply(ctx.t("openAppButton"), { reply_markup: inline }); }
        return;
      }
    } catch (e) {
      log.warn("Bito mijozini tekshirishda xato:", errMsg(e));
      await activity("bito_error", "Ro'yxatdan o'tishda Bito xatosi: " + errMsg(e));
    }
    await setUserStep(ctx, "name");
    await ctx.reply(ctx.t("askName"), { reply_markup: { remove_keyboard: true }, parse_mode: "HTML" });
  });

  // Ism (matn) — faqat "name" bosqichida
  bot.on("message:text", async (ctx, next) => {
    if (ctx.chat.type !== "private") return next();
    if (ctx.user.step === "name") {
      const name = ctx.message.text.trim().slice(0, 80);
      if (!name || name.startsWith("/")) { await ctx.reply(ctx.t("askName")); return; }
      ctx.user = await prisma.user.update({ where: { id: ctx.user.id }, data: { name } });
      try {
        if (ctx.user.phone) await linkOrCreateCustomer(ctx.user, { phone: ctx.user.phone, name });
      } catch (e) {
        log.warn("Bito'da mijoz yaratilmadi:", errMsg(e));
        await activity("bito_error", `Mijoz yaratilmadi (${name}, ${ctx.user.phone}): ${errMsg(e)}`);
      }
      await setUserStep(ctx, "done");
      await ctx.reply(ctx.t("registered"), { reply_markup: mainKeyboard(ctx.lang), parse_mode: "HTML" });
      { const inline = openAppInline(ctx.lang); if (inline) await ctx.reply(ctx.t("openAppButton"), { reply_markup: inline }); }
      return;
    }
    if (ctx.user.step !== "done") {
      await ctx.reply(ctx.t("askPhone"), { reply_markup: contactKeyboard(ctx.lang), parse_mode: "HTML" });
      return;
    }
    return next();
  });
}

/** Bito'da shu raqamli mijoz bo'lsa — bog'laydi va ismini oladi. Bo'lmasa null. */
async function linkOrCreateCustomerIfExists(ctx: MyContext, phone: string): Promise<boolean> {
  const { bito } = await import("../../bito/client.ts");
  const existing = await bito.customerByPhone(phone);
  if (!existing) return false;
  await linkOrCreateCustomer(ctx.user, { phone });
  ctx.user = (await prisma.user.findUnique({ where: { id: ctx.user.id } }))!;
  if (!ctx.user.name && existing.name) ctx.user = await prisma.user.update({ where: { id: ctx.user.id }, data: { name: existing.name } });
  return true;
}
