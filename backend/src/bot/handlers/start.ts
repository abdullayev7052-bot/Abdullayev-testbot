import type { Bot } from "grammy";
import type { MyContext } from "../context.ts";
import { setUserStep } from "../context.ts";
import { contactKeyboard, mainKeyboard, openAppInline } from "../keyboards.ts";
import { linkOrCreateCustomer } from "../../bito/customers.ts";
import { esc, normalizePhone } from "../../utils/format.ts";
import { activity, errMsg, log } from "../../logger.ts";
import { prisma } from "../../db.ts";
import { InlineKeyboard } from "grammy";
import { getSettings, lt } from "../../settings/store.ts";
import { isShareAdmin, readShare } from "../../bito/share.ts";
import { appUrl } from "../keyboards.ts";
import { money } from "../../utils/format.ts";

export async function sendMainMenu(ctx: MyContext, text?: string) {
  const name = ctx.user.name || ctx.user.tgFirstName || "";
  await ctx.reply(text || ctx.t("welcomeBack", { name }), { reply_markup: mainKeyboard(ctx.lang), parse_mode: "HTML" });
  const inline = openAppInline(ctx.lang);
  if (inline) await ctx.reply(ctx.t("openAppButton"), { reply_markup: inline });
}

/** Ulashish rejimidagi admin uchun qisqa menyu (ro'yxatdan o'tish talab qilinmaydi) */
async function sendShareAdminMenu(ctx: MyContext) {
  const b = getSettings().bot;
  const url = appUrl();
  const kb = url ? new InlineKeyboard().webApp(lt(b.openAppButton, ctx.lang), url) : undefined;
  await ctx.reply(
    `👋 <b>Ulashish rejimi</b>\n\n${lt(b.shareAdminHint as never, ctx.lang)}`,
    { parse_mode: "HTML", reply_markup: kb },
  );
}

/** Ulashilgan savatni ko'rsatib, Mini App'ni ochadigan tugma yuborish */
async function sendSharedCart(ctx: MyContext, code: string): Promise<boolean> {
  const row = await readShare(code, false);
  if (!row) return false;
  const st = getSettings();
  const url = appUrl();
  const lang = ctx.lang;
  let text = `<b>${esc(lt(st.general.shareIntro, lang))}</b>`;
  let go = `share:${code}`;

  if (row.kind === "cart") {
    const items = row.payload.items || [];
    const products = await prisma.product.findMany({ where: { id: { in: items.map((x) => x.productId) } } });
    const byId = new Map(products.map((p) => [p.id, p]));
    let total = 0;
    const lines: string[] = [];
    items.forEach((it, i) => {
      const p = byId.get(it.productId);
      if (!p) return;
      const sum = p.price * it.qty;
      total += sum;
      lines.push(`${i + 1}. ${esc(p.name)} — ${it.qty} × ${money(p.price, lang, { suffix: false })}`);
    });
    if (!lines.length) return false;
    text += "\n\n" + lines.join("\n") + `\n\n💰 <b>${money(total, lang)}</b>`;
  } else if (row.kind === "product" && row.payload.productId) {
    const p = await prisma.product.findUnique({ where: { id: row.payload.productId } });
    if (!p) return false;
    text += `\n\n🛍 <b>${esc(p.name)}</b> — ${money(p.price, lang)}`;
    go = `product:${p.id}`;
  } else if (row.kind === "category" && row.payload.categoryId) {
    go = `category:${row.payload.categoryId}`;
  }

  const kb = url ? new InlineKeyboard().webApp(lt(st.general.shareOpenButton, lang), `${url}?go=${encodeURIComponent(go)}`) : undefined;
  await ctx.reply(text, { parse_mode: "HTML", reply_markup: kb, link_preview_options: { is_disabled: true } });
  // Ro'yxatdan o'tmagan mijoz keyin odatdagidek davom etadi
  if (ctx.user.step !== "done" && !isShareAdmin(ctx.user.telegramId)) {
    await ctx.reply(ctx.t("askPhone"), { reply_markup: contactKeyboard(ctx.lang), parse_mode: "HTML" });
    await setUserStep(ctx, "phone");
  }
  return true;
}

export function registerStart(bot: Bot<MyContext>) {
  bot.command("start", async (ctx) => {
    if (ctx.chat.type !== "private") return;
    const payload = (ctx.match || "").toString().trim();

    // Admin ulashgan havola: /start <kod>
    if (payload && /^[a-z0-9]{6,12}$/i.test(payload)) {
      const handled = await sendSharedCart(ctx, payload);
      if (handled) return;
    }

    // Ulashish rejimidagi admin — ro'yxatdan o'tkazilmaydi
    if (isShareAdmin(ctx.user.telegramId)) {
      await sendShareAdminMenu(ctx);
      return;
    }

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
