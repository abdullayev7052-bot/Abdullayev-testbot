import type { Bot } from "grammy";
import { InputFile, InlineKeyboard } from "grammy";
import type { MyContext, BotTextKey } from "../context.ts";
import { languageKeyboard, mainKeyboard, openAppInline, storeKeyboard } from "../keyboards.ts";
import { isMultiStore, userStore, getStore } from "../../bito/stores.ts";
import { getSettings, lt, normalizeLang } from "../../settings/store.ts";
import type { Lang } from "../../settings/schema.ts";
import { LANGS } from "../../settings/schema.ts";
import { prisma } from "../../db.ts";
import { bito } from "../../bito/client.ts";
import { fetchBalances, fetchCustomer } from "../../bito/customers.ts";
import { stageName, stageOf, type Stage } from "../../bito/orders.ts";
import { esc, fmtDate, money, prettyPhone, qty } from "../../utils/format.ts";
import { activity, errMsg, log } from "../../logger.ts";

type MenuKey = "mOrders" | "mPurchases" | "mMyInfo" | "mSettings" | "mBalance" | "mCard" | "mAkt" | "mStore";

/** Matn qaysi menyu tugmasiga mos kelishini aniqlash (barcha tillarda) */
function menuKeyOf(text: string): MenuKey | "openApp" | null {
  const b = getSettings().bot;
  const keys: (MenuKey | "openAppButton")[] = ["mOrders", "mPurchases", "mMyInfo", "mSettings", "mBalance", "mCard", "mAkt", "openAppButton"];
  const t = text.trim();
  for (const k of keys) {
    const v = b[k] as Record<Lang, string>;
    for (const l of LANGS) if (v?.[l] && v[l].trim() === t) return k === "openAppButton" ? "openApp" : k;
  }
  const sb = getSettings().bito.storeButton as Record<Lang, string>;
  for (const l of LANGS) if (sb?.[l] && sb[l].trim() === t) return "mStore";
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
  const limit = Math.max(3, Number(getSettings().bot.listLimit || 10));
  const storeOrg = userStore(ctx.user).organizationId;
  const local = await prisma.order.findMany({ where: { userId: ctx.user.id, ...(isMultiStore() ? { storeId: userStore(ctx.user).id } : {}) }, orderBy: { createdAt: "desc" }, take: limit });
  const rows: { key: string; number: string; date: string | Date; total: number; status: string }[] = [];
  const seen = new Set<string>();
  for (const o of local) {
    if (o.bitoId) seen.add(o.bitoId);
    rows.push({ key: `od:l:${o.id}`, number: String(o.number || o.id), date: o.createdAt, total: o.total, status: stageName((o.stateKey || "new") as Stage, lang, o.stateName) });
  }
  const customerId = ctx.user.bitoCustomerId;
  if (customerId && rows.length < limit) {
    try {
      const r = await bito.ordersByCustomer(customerId, 1, limit);
      for (const o of r.list || []) {
        if (seen.has(o._id)) continue;
        if (isMultiStore() && storeOrg && o.organization_id && o.organization_id !== storeOrg) continue;
        const stage = stageOf(o.state_id, o.dynamic_state || { default_key: o.state });
        rows.push({ key: `od:b:${o._id}`, number: String(o.number || o.uuid || ""), date: o.date || o.created_at || "", total: o.total_to_pay ?? o.total_price ?? 0, status: stageName(stage, lang, o.dynamic_state?.name || o.state) });
        if (rows.length >= limit) break;
      }
    } catch (e) { log.warn("ordersByCustomer", errMsg(e)); }
  }
  if (!rows.length) { await ctx.reply(ctx.t("noOrders"), { reply_markup: openAppInline(lang) }); return; }
  const lines = rows.map((r) => `• <b>#${esc(r.number)}</b> — ${fmtDate(r.date, lang, false)} — ${money(r.total, lang)} · ${esc(r.status)}`);
  const kb = new InlineKeyboard();
  rows.forEach((r, i) => { kb.text(`#${r.number}`, r.key); if (i % 3 === 2) kb.row(); });
  await ctx.reply(`<b>${esc(ctx.t("ordersTitle"))}</b>\n\n${lines.join("\n")}\n\n${esc(ctx.t("listHint"))}`, { parse_mode: "HTML", reply_markup: kb });
}

/** Bitta buyurtma tafsiloti (mijoz uchun) */
export async function sendOrderDetail(ctx: MyContext, key: string) {
  const lang = ctx.lang;
  const b = getSettings().bot;
  const L = (k: keyof typeof b) => lt(b[k] as never, lang);
  const [, src, id] = key.split(":");
  let number = "", date: string | Date = "", status = "", type = "", address = "", total = 0;
  let items: { name: string; qty: number; price: number; measure?: string | null }[] = [];
  if (src === "l") {
    const o = await prisma.order.findFirst({ where: { id: Number(id), userId: ctx.user.id } });
    if (!o) { await ctx.reply(ctx.t("noOrders")); return; }
    number = String(o.number || o.id); date = o.createdAt; status = stageName((o.stateKey || "new") as Stage, lang, o.stateName);
    type = o.type === "pickup" ? lt(getSettings().checkout.pickupLabel, lang) : lt(getSettings().checkout.deliveryLabel, lang);
    address = o.address || ""; total = o.total;
    items = ((o.items as unknown as { name: string; qty: number; price: number; measure?: string | null }[]) || []);
  } else {
    try {
      const o = await bito.orderByIdForBot(id);
      if (!o || (o.customer?._id && o.customer._id !== ctx.user.bitoCustomerId)) { await ctx.reply(ctx.t("noOrders")); return; }
      number = String(o.number || o.uuid || ""); date = o.date || o.created_at || "";
      status = stageName(stageOf(o.state_id, o.dynamic_state || { default_key: o.state }), lang, o.dynamic_state?.name || o.state);
      total = o.total_to_pay ?? o.total_price ?? 0;
      items = (o.products || []).map((p) => ({ name: p.name || "", qty: p.amount, price: p.price, measure: p.measure?.short_name }));
    } catch (e) { log.warn("orderByIdForBot", errMsg(e)); await ctx.reply(ctx.t("errorGeneric")); return; }
  }
  const lines = [`<b>${esc(L("orderDetailTitle"))} #${esc(number)}</b>`, `🕒 ${esc(L("lTime"))}: ${fmtDate(date, lang)}`, `📌 ${esc(L("lStatus"))}: <b>${esc(status)}</b>`];
  if (type) lines.push(`🚚 ${esc(L("lType"))}: ${esc(type)}`);
  if (address) lines.push(`📍 ${esc(L("lAddress"))}: ${esc(address)}`);
  lines.push("", `🛒 <b>${esc(L("lProducts"))}:</b>`);
  let tq = 0;
  items.forEach((it, i) => { tq += Number(it.qty || 0); lines.push(`${i + 1}. ${esc(it.name)} — ${qty(it.qty)} ${esc(it.measure || "")} × ${money(it.price, lang, { suffix: false })} = ${money(it.price * it.qty, lang, { suffix: false })}`); });
  lines.push("", `📦 ${esc(L("lTotalQty"))}: ${qty(tq)}`, `💰 <b>${esc(L("lTotal"))}: ${money(total, lang)}</b>`);
  await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
}

export async function showPurchases(ctx: MyContext) {
  const customerId = await requireLinked(ctx);
  if (!customerId) return;
  const lang = ctx.lang;
  const limit = Math.max(3, Number(getSettings().bot.listLimit || 10));
  try {
    const orgId = userStore(ctx.user).organizationId;
    const r = await bito.tradesPage({ page: 1, limit, customer_id: customerId, ...(isMultiStore() && orgId ? { organization_id: orgId } : {}) });
    const list = (r.data || []).filter((t) => t.state !== "canceled");
    if (!list.length) { await ctx.reply(ctx.t("noPurchases")); return; }
    const lines = list.map((t) => `• <b>№${esc(t.number || t.uuid || "")}</b> — ${fmtDate(t.sold_at || t.date || t.created_at, lang, false)} — ${money(t.total_to_pay ?? t.total_price ?? 0, lang)}${t.is_refund ? " ↩️" : ""}`);
    const kb = new InlineKeyboard();
    list.forEach((t, i) => { kb.text(`№${t.number || ""}`, `tr:${t._id}`); if (i % 3 === 2) kb.row(); });
    await ctx.reply(`<b>${esc(ctx.t("purchasesTitle"))}</b>\n\n${lines.join("\n")}\n\n${esc(ctx.t("listHint"))}`, { parse_mode: "HTML", reply_markup: kb });
  } catch (e) {
    log.warn("showPurchases", errMsg(e));
    await ctx.reply(ctx.t("errorGeneric"));
  }
}

/** Bitta xarid cheki (tugma bosilganda) */
export async function sendTradeDetail(ctx: MyContext, tradeId: string) {
  try {
    const t = await bito.tradeForBot(tradeId);
    if (!t || (t.customer?._id || t.customer_id) !== ctx.user.bitoCustomerId) { await ctx.reply(ctx.t("noPurchases")); return; }
    const { receiptText } = await import("../../bito/finance.ts");
    await ctx.reply(receiptText(t, ctx.lang), { parse_mode: "HTML" });
  } catch (e) { log.warn("tradeForBot", errMsg(e)); await ctx.reply(ctx.t("errorGeneric")); }
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

export async function showStore(ctx: MyContext) {
  if (!isMultiStore()) return;
  const cur = userStore(ctx.user);
  await ctx.reply(`${lt(getSettings().bito.storeChooseLabel, ctx.lang)}\n\n${esc(cur.name(ctx.lang))}`, { parse_mode: "HTML", reply_markup: storeKeyboard(ctx.lang, cur.id) });
}

export function registerMenu(bot: Bot<MyContext>) {
  bot.callbackQuery(/^store:([a-zA-Z0-9_-]+)$/, async (ctx) => {
    const st = getStore(ctx.match[1]);
    ctx.user = await prisma.user.update({ where: { id: ctx.user.id }, data: { storeId: st.id } });
    const { fill } = await import("../../settings/store.ts");
    await ctx.answerCallbackQuery({ text: fill(lt(getSettings().bito.storeChanged, ctx.lang), { store: st.name(ctx.lang) }) }).catch(() => {});
    await ctx.editMessageText(`${lt(getSettings().bito.storeChooseLabel, ctx.lang)}\n\n✅ ${esc(st.name(ctx.lang))}`, { parse_mode: "HTML", reply_markup: storeKeyboard(ctx.lang, st.id) }).catch(() => {});
  });
  bot.command(["dokon", "store"], async (ctx) => { if (ctx.chat.type === "private" && ctx.user.step === "done") await showStore(ctx); });

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

  bot.callbackQuery(/^tr:([a-f0-9]{24})$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    if (ctx.user?.step !== "done") return;
    await sendTradeDetail(ctx, ctx.match[1]);
  });
  bot.callbackQuery(/^od:(l|b):([a-zA-Z0-9]+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    if (ctx.user?.step !== "done") return;
    await sendOrderDetail(ctx, `od:${ctx.match[1]}:${ctx.match[2]}`);
  });

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
      mOrders: showOrders, mPurchases: showPurchases, mMyInfo: showMyInfo, mSettings: showSettings, mBalance: showBalance, mCard: showCard, mAkt: showAkt, mStore: showStore,
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
