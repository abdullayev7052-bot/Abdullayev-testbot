import type { Bot } from "grammy";
import { InputFile } from "grammy";
import type { MyContext, BotTextKey } from "../context.ts";
import { languageKeyboard, mainKeyboard, openAppInline } from "../keyboards.ts";
import { getSettings, lt, normalizeLang } from "../../settings/store.ts";
import type { Lang } from "../../settings/schema.ts";
import { LANGS } from "../../settings/schema.ts";
import { prisma } from "../../db.ts";
import { bito } from "../../bito/client.ts";
import { fetchBalances, fetchCustomer } from "../../bito/customers.ts";
import { stageName, stageOf, type Stage } from "../../bito/orders.ts";
import { esc, fmtDate, money, prettyPhone, qty } from "../../utils/format.ts";
import { activity, errMsg, log } from "../../logger.ts";

type MenuKey = "mOrders" | "mPurchases" | "mMyInfo" | "mSettings" | "mBalance" | "mCard" | "mAkt";

/** Matn qaysi menyu tugmasiga mos kelishini aniqlash (barcha tillarda) */
function menuKeyOf(text: string): MenuKey | "openApp" | null {
  const b = getSettings().bot;
  const keys: (MenuKey | "openAppButton")[] = ["mOrders", "mPurchases", "mMyInfo", "mSettings", "mBalance", "mCard", "mAkt", "openAppButton"];
  const t = text.trim();
  for (const k of keys) {
    const v = b[k] as Record<Lang, string>;
    for (const l of LANGS) if (v?.[l] && v[l].trim() === t) return k === "openAppButton" ? "openApp" : k;
  }
  return null;
}

async function requireLinked(ctx: MyContext): Promise<string | null> {
  if (ctx.user.bitoCustomerId) return ctx.user.bitoCustomerId;
  // Kechiktirilgan bog'lash (ro'yxatdan o'tishda Bito ishlamagan bo'lsa)
  if (ctx.user.phone) {
    try {
      const { linkOrCreateCustomer } = await import("../../bito/customers.ts");
      const r = await linkOrCreateCustomer(ctx.user, { phone: ctx.user.phone, name: ctx.user.name || undefined });
      ctx.user = (await prisma.user.findUnique({ where: { id: ctx.user.id } }))!;
      return r.customer._id;
    } catch (e) {
      log.warn("requireLinked", errMsg(e));
    }
  }
  await ctx.reply(ctx.t("notLinked"));
  return null;
}

export async function showOrders(ctx: MyContext) {
  const lang = ctx.lang;
  const local = await prisma.order.findMany({ where: { userId: ctx.user.id }, orderBy: { createdAt: "desc" }, take: 15 });
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const o of local) {
    if (o.bitoId) seen.add(o.bitoId);
    const st = stageName((o.stateKey || "new") as Stage, lang, o.stateName);
    lines.push(`• <b>#${esc(o.number || o.id)}</b> — ${fmtDate(o.createdAt, lang)} — ${money(o.total, lang)}\n   ${esc(st)}`);
  }
  // Bito'da xodimlar tomonidan yaratilgan buyurtmalar
  const customerId = ctx.user.bitoCustomerId;
  if (customerId) {
    try {
      const r = await bito.ordersByCustomer(customerId, 1, 20);
      for (const o of r.list || []) {
        if (seen.has(o._id)) continue;
        const stage = stageOf(o.state_id, o.dynamic_state || { default_key: o.state });
        const st = stageName(stage, lang, o.dynamic_state?.name || o.state);
        lines.push(`• <b>#${esc(o.number || o.uuid || "")}</b> — ${fmtDate(o.date || o.created_at, lang)} — ${money(o.total_to_pay ?? o.total_price ?? 0, lang)}\n   ${esc(st)}`);
        if (lines.length >= 20) break;
      }
    } catch (e) { log.warn("ordersByCustomer", errMsg(e)); }
  }
  if (!lines.length) { await ctx.reply(ctx.t("noOrders"), { reply_markup: openAppInline(lang) }); return; }
  await ctx.reply(`<b>${esc(ctx.t("ordersTitle"))}</b>\n\n${lines.join("\n")}`, { parse_mode: "HTML" });
}

export async function showPurchases(ctx: MyContext) {
  const customerId = await requireLinked(ctx);
  if (!customerId) return;
  const lang = ctx.lang;
  try {
    const r = await bito.tradesPage({ page: 1, limit: 20, customer_id: customerId });
    const list = (r.data || []).filter((t) => t.state !== "canceled");
    if (!list.length) { await ctx.reply(ctx.t("noPurchases")); return; }
    const lines = list.map((t) => {
      const seller = t.responsible?.full_name || t.created_by?.full_name || "";
      const dbt = Number(t.debt || 0);
      return `• <b>№${esc(t.number || t.uuid || "")}</b> — ${fmtDate(t.sold_at || t.date || t.created_at, lang)}\n   ${money(t.total_to_pay ?? t.total_price ?? 0, lang)}${dbt > 0 ? ` (${esc(ctx.t("lDebt"))}: ${money(dbt, lang)})` : ""}${seller ? ` · ${esc(seller)}` : ""}${t.is_refund ? " ↩️" : ""}`;
    });
    await ctx.reply(`<b>${esc(ctx.t("purchasesTitle"))}</b>\n\n${lines.join("\n")}`, { parse_mode: "HTML" });
  } catch (e) {
    log.warn("showPurchases", errMsg(e));
    await ctx.reply(ctx.t("errorGeneric"));
  }
}

export async function showMyInfo(ctx: MyContext) {
  let name = ctx.user.name || ctx.user.tgFirstName || "—";
  let phone = ctx.user.phone || "";
  if (ctx.user.bitoCustomerId) {
    const c = await fetchCustomer(ctx.user);
    if (c) { name = c.name || name; phone = c.phone_number || phone; }
  }
  await ctx.reply(ctx.t("myInfo", { name: esc(name), phone: prettyPhone(phone), tg: String(ctx.user.telegramId) }), { parse_mode: "HTML" });
}

export async function showSettings(ctx: MyContext) {
  await ctx.reply(ctx.t("chooseLanguage"), { reply_markup: languageKeyboard() });
}

export async function showBalance(ctx: MyContext) {
  const customerId = await requireLinked(ctx);
  if (!customerId) return;
  const lang = ctx.lang;
  const rows = await fetchBalances(ctx.user);
  const lines: string[] = [`<b>${esc(ctx.t("balanceTitle"))}</b>`, ""];
  if (!rows.length) lines.push(ctx.t("balanceZero"));
  for (const r of rows) {
    let txt: string;
    if (r.amount < 0) txt = `🔴 ${esc(ctx.t("balanceDebt"))}: <b>${money(Math.abs(r.amount), lang)}</b>`;
    else if (r.amount > 0) txt = `🟢 ${esc(ctx.t("balanceCredit"))}: <b>${money(r.amount, lang)}</b>`;
    else txt = `✅ ${esc(ctx.t("balanceZero"))}`;
    lines.push(r.organization ? `🏢 ${esc(r.organization)}\n${txt}` : txt);
  }
  await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
}

export async function showCard(ctx: MyContext) {
  const customerId = await requireLinked(ctx);
  if (!customerId) return;
  const c = await fetchCustomer(ctx.user);
  const card = c?.loyalty_card_id?.trim();
  if (!card) { await ctx.reply(ctx.t("noCard")); return; }
  try {
    const bwip = await import("bwip-js/node");
    const png = await bwip.toBuffer({ bcid: "code128", text: card, scale: 4, height: 18, includetext: true, textxalign: "center", paddingwidth: 12, paddingheight: 10, backgroundcolor: "FFFFFF" });
    await ctx.replyWithPhoto(new InputFile(png, "card.png"), { caption: ctx.t("cardCaption", { card, name: esc(c?.name || ctx.user.name || "") }), parse_mode: "HTML" });
  } catch (e) {
    log.warn("card", errMsg(e));
    await ctx.reply(ctx.t("cardCaption", { card, name: esc(c?.name || "") }), { parse_mode: "HTML" });
  }
}

export async function showAkt(ctx: MyContext) {
  const customerId = await requireLinked(ctx);
  if (!customerId) return;
  const s = getSettings();
  const lang = ctx.lang;
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - Math.max(1, Number(s.bot.aktMonths || 12)));
  const wait = await ctx.reply(ctx.t("aktPreparing"));
  try {
    const path = await bito.reconActExport({
      customer_id: customerId, organization_id: s.bito.organizationId || undefined,
      date_from: from.toISOString(), date_to: to.toISOString(), locale: lang === "en" ? "en" : lang === "ru" ? "ru" : "uz",
    });
    const url = bito.fileUrl(path.startsWith("/") ? path : `/uploads/${path}`)!;
    const r = await fetch(url);
    if (!r.ok) throw new Error("Fayl yuklanmadi: " + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    const fname = `akt-sverka-${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}.xlsx`;
    await ctx.replyWithDocument(new InputFile(buf, fname), { caption: ctx.t("aktCaption", { from: fmtDate(from, lang, false), to: fmtDate(to, lang, false) }), parse_mode: "HTML" });
    await activity("akt_sent", `Akt sverka yuborildi → ${ctx.user.name || ctx.user.phone}`);
  } catch (e) {
    log.warn("akt", errMsg(e));
    await ctx.reply(ctx.t("errorGeneric"));
  } finally {
    ctx.api.deleteMessage(ctx.chat!.id, wait.message_id).catch(() => {});
  }
}

export function registerMenu(bot: Bot<MyContext>) {
  const only = (fn: (ctx: MyContext) => Promise<void>) => async (ctx: MyContext) => {
    if (ctx.chat?.type !== "private") return;
    if (ctx.user.step !== "done") { await ctx.reply(ctx.t("askPhone")); return; }
    try { await fn(ctx); } catch (e) { log.error("menu", e); await ctx.reply(ctx.t("errorGeneric")); }
  };

  bot.command(["buyurtmalar", "orders", "zakazy"], only(showOrders));
  bot.command(["xaridlar", "purchases", "pokupki"], only(showPurchases));
  bot.command(["malumotlarim", "me", "myinfo"], only(showMyInfo));
  bot.command(["sozlamalar", "settings"], only(showSettings));
  bot.command(["balans", "balance"], only(showBalance));
  bot.command(["kartam", "card"], only(showCard));
  bot.command(["akt", "sverka"], only(showAkt));
  bot.command("menu", only(async (ctx) => { await ctx.reply("👇", { reply_markup: mainKeyboard(ctx.lang) }); }));

  bot.callbackQuery(/^lang:(uz|ru|en)$/, async (ctx) => {
    const lang = normalizeLang(ctx.match[1]);
    ctx.user = await prisma.user.update({ where: { id: ctx.user.id }, data: { language: lang } });
    ctx.lang = lang;
    await ctx.answerCallbackQuery({ text: ctx.t("languageChanged") });
    await ctx.editMessageText(ctx.t("languageChanged")).catch(() => {});
    await ctx.reply(ctx.t("welcomeBack", { name: ctx.user.name || ctx.user.tgFirstName || "" }), { reply_markup: mainKeyboard(lang), parse_mode: "HTML" });
  });

  bot.on("message:text", async (ctx, next) => {
    if (ctx.chat.type !== "private") return next();
    const key = menuKeyOf(ctx.message.text);
    if (!key) return next();
    if (ctx.user.step !== "done") { await ctx.reply(ctx.t("askPhone")); return; }
    const map: Record<MenuKey | "openApp", (c: MyContext) => Promise<void>> = {
      mOrders: showOrders, mPurchases: showPurchases, mMyInfo: showMyInfo, mSettings: showSettings, mBalance: showBalance, mCard: showCard, mAkt: showAkt,
      openApp: async (c) => {
        const kb = openAppInline(c.lang);
        if (kb) await c.reply(lt(getSettings().bot.openAppButton, c.lang), { reply_markup: kb });
        else await c.reply("⚠️ Mini App manzili hali sozlanmagan (ngrok ishga tushirilmagan yoki PUBLIC_URL berilmagan).");
      },
    };
    try { await map[key](ctx); } catch (e) { log.error("menu", e); await ctx.reply(ctx.t("errorGeneric")); }
  });
}

export const menuTextKeys: BotTextKey[] = ["mOrders", "mPurchases", "mMyInfo", "mSettings", "mBalance", "mCard", "mAkt"];
export { qty };
