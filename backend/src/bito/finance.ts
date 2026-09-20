/**
 * Bito'dagi savdolar (trades) va to'lovlar (transactions) → mijozga Telegram xabar.
 * Webhook orqali tezkor, polling orqali kafolatli.
 */
import { prisma } from "../db.ts";
import { bito } from "./client.ts";
import { getSettings, lt } from "../settings/store.ts";
import type { Lang } from "../settings/schema.ts";
import { activity, errMsg, log } from "../logger.ts";
import { esc, fmtDate, money, qty } from "../utils/format.ts";
import { sendToUser } from "../bot/send.ts";
import type { BitoTrade, BitoTransaction } from "./types.ts";
import type { User } from "@prisma/client";

let orgCache: { at: number; map: Map<string, string> } | null = null;
async function orgName(id?: string): Promise<string> {
  if (!id) return "";
  if (!orgCache || Date.now() - orgCache.at > 10 * 60 * 1000) {
    try {
      const orgs = await bito.organizations();
      orgCache = { at: Date.now(), map: new Map(orgs.map((o) => [o._id, o.name])) };
    } catch { orgCache = { at: Date.now(), map: new Map() }; }
  }
  return orgCache.map.get(id) || "";
}

async function alreadySent(key: string): Promise<boolean> {
  try {
    await prisma.sentEvent.create({ data: { key } });
    return false;
  } catch {
    return true;
  }
}

async function userByCustomer(customerId?: string): Promise<User | null> {
  if (!customerId) return null;
  const u = await prisma.user.findUnique({ where: { bitoCustomerId: customerId } });
  if (!u || u.isBlocked || u.step !== "done") return null;
  return u;
}

function balanceText(amount: number, lang: Lang): string {
  const b = getSettings().bot;
  if (amount < 0) return `${lt(b.balanceDebt, lang)}: ${money(Math.abs(amount), lang)}`;
  if (amount > 0) return `${lt(b.balanceCredit, lang)}: ${money(amount, lang)}`;
  return lt(b.balanceZero, lang);
}

function sumBalances(list?: { amount: number; organization_id?: string }[], orgId?: string): number | null {
  if (!list || !list.length) return null;
  const rows = orgId ? list.filter((x) => !x.organization_id || x.organization_id === orgId) : list;
  if (!rows.length) return null;
  return rows.reduce((a, x) => a + Number(x.amount || 0), 0);
}

/** Savdo cheki matni */
export function receiptText(t: BitoTrade, lang: Lang): string {
  const b = getSettings().bot;
  const L = (k: keyof typeof b) => lt(b[k] as never, lang);
  const on = (k: string) => b[k] !== false;
  const lines: string[] = [];
  lines.push(`<b>${esc(t.is_refund ? L("lRefund") : L("receiptTitle"))}</b>`);
  if (on("rShowTime")) lines.push(`🕒 ${esc(L("lTime"))}: ${fmtDate(t.sold_at || t.date || t.created_at, lang)}`);
  if (on("rShowTrade")) lines.push(`🔢 ${esc(L("lTrade"))}: №${esc(t.number || t.uuid || "")}`);
  if (on("rShowCustomer") && t.customer?.name) lines.push(`👤 ${esc(L("lCustomer"))}: ${esc(t.customer.name)}`);
  const seller = t.responsible?.full_name || t.created_by?.full_name;
  if (on("rShowSeller") && seller) lines.push(`🧑‍💼 ${esc(L("lSeller"))}: ${esc(seller)}`);
  let totalQty = 0;
  for (const p of t.products || []) totalQty += Number(p.amount || 0);
  if (on("rShowProducts")) {
    lines.push("");
    lines.push(`🛒 <b>${esc(L("lProducts"))}:</b>`);
    (t.products || []).forEach((p, i) => {
      const unit = p.measure?.short_name || p.measure?.name || "";
      const sum = p.total_to_pay ?? p.total_price ?? p.price * p.amount;
      lines.push(`${i + 1}. ${esc(p.name || "")} — ${qty(p.amount)} ${esc(unit)} × ${money(p.price, lang, { suffix: false })} = ${money(sum, lang, { suffix: false })}`);
    });
  }
  lines.push("");
  if (on("rShowTotalQty")) lines.push(`📦 ${esc(L("lTotalQty"))}: ${qty(totalQty || t.total_amount || 0)}`);
  if (on("rShowDiscount") && t.total_discount) lines.push(`🏷 ${lang === "ru" ? "Скидка" : lang === "en" ? "Discount" : "Chegirma"}: ${money(t.total_discount, lang)}`);
  if (on("rShowTotal")) lines.push(`💰 <b>${esc(L("lTotal"))}: ${money(t.total_to_pay ?? t.total_price ?? 0, lang)}</b>`);
  const pays = (t.payments || []).filter((p) => Number(p.amount || p.paid || 0) > 0);
  if (on("rShowPayment") && pays.length) {
    const parts = pays.map((p) => `${esc(p.payment_method?.name || "")} — ${money(Number(p.amount || p.paid || 0), lang)}`);
    lines.push(`💳 ${esc(L("lPayment"))}: ${parts.join("; ")}`);
  }
  const byBalance = (t.by_balance || []).reduce((a, x) => a + Number(x.amount || x.paid || 0), 0);
  if (on("rShowPayment") && byBalance > 0) lines.push(`💼 ${lang === "ru" ? "С баланса" : lang === "en" ? "From balance" : "Balansdan"}: ${money(byBalance, lang)}`);
  const debt = Number(t.debt || 0);
  if (on("rShowDebt") && debt > 0 && !t.is_refund) lines.push(`📝 ${esc(L("lDebt"))}: ${money(debt, lang)}`);
  if (on("rShowDueDate") && t.is_installment_plan && t.installment_plan?.length) {
    const next = t.installment_plan.find((x) => x.date);
    if (next?.date) lines.push(`📅 ${esc(L("lDueDate"))}: ${fmtDate(next.date, lang, false)}`);
  }
  const before = sumBalances(t.customer_before_balance);
  const after = sumBalances(t.customer_after_balance);
  if ((on("rShowBefore") && before !== null) || (on("rShowAfter") && after !== null)) {
    lines.push("");
    if (on("rShowBefore") && before !== null) lines.push(`📊 ${esc(L("lBefore"))}: ${balanceText(before, lang)}`);
    if (on("rShowAfter") && after !== null) lines.push(`📊 <b>${esc(L("lAfter"))}: ${balanceText(after, lang)}</b>`);
  }
  return lines.filter((l, i, a) => !(l === "" && (i === a.length - 1 || a[i + 1] === ""))).join("\n");
}

let curCache: { at: number; map: Map<string, { name: string; symbol: string }> } | null = null;
async function currencyMap(): Promise<Map<string, { name: string; symbol: string }>> {
  if (!curCache || Date.now() - curCache.at > 10 * 60 * 1000) {
    try { const list = await bito.currencies(); curCache = { at: Date.now(), map: new Map(list.map((c) => [c._id, { name: c.name, symbol: c.symbol || c.code || c.name }])) }; }
    catch { curCache = { at: Date.now(), map: new Map() }; }
  }
  return curCache.map;
}

/** Valyuta bilan summa: "1 500 000 so'm" / "120 $" */
function moneyCur(amount: number, symbol: string | undefined, lang: Lang): string {
  if (!symbol || /^(uzs|so'?m|сум|sum)$/i.test(symbol)) return money(amount, lang);
  return money(amount, lang, { suffix: false }) + " " + symbol;
}

/** To'lov xabari matni */
export async function paymentText(tx: BitoTransaction, lang: Lang): Promise<string> {
  const b = getSettings().bot;
  const L = (k: keyof typeof b) => lt(b[k] as never, lang);
  const on = (k: string) => b[k] !== false;
  const isRefund = tx.type === "expense";
  const cur = await currencyMap();
  const sym = tx.currency?.symbol || tx.currency?.name || "";
  const lines: string[] = [];
  lines.push(`<b>${esc(isRefund ? L("lRefund") : L("paymentTitle"))}</b>`);
  if (on("pShowTime")) lines.push(`🕒 ${esc(L("lTime"))}: ${fmtDate(tx.date || tx.created_at, lang)}`);
  if (on("pShowNumber") && tx.number) lines.push(`🔢 №${esc(tx.number)}`);
  if (on("pShowAmount")) lines.push(`💰 <b>${esc(L("lAmount"))}: ${moneyCur(tx.amount ?? tx.amount_in_main ?? 0, sym, lang)}</b>`);
  if (on("pShowMethod") && tx.payment_method?.name) lines.push(`💳 ${esc(L("lPayment"))}: ${esc(tx.payment_method.name)}`);
  if (on("pShowType") && tx.payment_type?.name) lines.push(`📂 ${esc(tx.payment_type.name)}`);
  if (on("pShowReceivedBy") && tx.created_by?.full_name) lines.push(`🧑‍💼 ${esc(L("lReceivedBy"))}: ${esc(tx.created_by.full_name)}`);
  if (on("pShowCashbox") && tx.cashbox?.name) lines.push(`🏦 ${esc(L("lCashbox"))}: ${esc(tx.cashbox.name)}`);
  const org = await orgName(tx.organization_id);
  if (on("pShowOrganization") && org) lines.push(`🏢 ${esc(L("lOrganization"))}: ${esc(org)}`);
  if (on("pShowDescription") && tx.description) lines.push(`💬 ${esc(tx.description)}`);
  const perCurrency = (rows?: { currency_id?: string; amount: number; organization_id?: string }[]) => {
    const list = (rows || []).filter((r) => !tx.organization_id || !r.organization_id || r.organization_id === tx.organization_id);
    return list.map((r) => { const c = r.currency_id ? cur.get(r.currency_id) : undefined; const a = Number(r.amount || 0);
      const label = a < 0 ? L("balanceDebt") : a > 0 ? L("balanceCredit") : L("balanceZero");
      return a === 0 ? esc(label) : `${esc(label)}: ${moneyCur(Math.abs(a), c?.symbol, lang)}`; });
  };
  const before = perCurrency(tx.human_before_balance);
  const after = perCurrency(tx.human_after_balance);
  if ((on("pShowBefore") && before.length) || (on("pShowAfter") && after.length)) {
    lines.push("");
    if (on("pShowBefore") && before.length) lines.push(`📊 ${esc(L("lBefore"))}: ${before.join(" · ")}`);
    if (on("pShowAfter") && after.length) lines.push(`📊 <b>${esc(L("lAfter"))}: ${after.join(" · ")}</b>`);
  }
  return lines.join("\n");
}

/** Bitta savdoni qayta ishlash (webhook yoki polling) */
export async function processTrade(tradeId: string, preloaded?: BitoTrade): Promise<void> {
  const s = getSettings();
  if (!s.bot.notifyTrades) return;
  let t: BitoTrade;
  try { t = preloaded && preloaded.products ? preloaded : await bito.tradeForBot(tradeId); } catch (e) { log.warn("tradeForBot", errMsg(e)); return; }
  if (!t || t.state === "canceled" || t.state === "draft") return;
  const custId = t.customer?._id || t.customer_id;
  const user = await userByCustomer(custId);
  if (!user) return;
  if (await alreadySent(`trade:${t._id}`)) return;
  const text = receiptText(t, user.language as Lang);
  await sendToUser(user.telegramId, text);
  await activity("receipt_sent", `Chek yuborildi: №${t.number} → ${user.name || user.phone}`);
}

/** Bitta tranzaksiyani qayta ishlash */
export async function processTransaction(txId: string, preloaded?: BitoTransaction): Promise<void> {
  const s = getSettings();
  if (!s.bot.notifyPayments) return;
  let tx: BitoTransaction;
  try { tx = preloaded || await bito.transactionById(txId); } catch (e) { log.warn("transactionById", errMsg(e)); return; }
  if (!tx || tx.is_deleted) return;
  if (tx.state && tx.state !== "done") return;
  const custId = tx.customer?._id || tx.customer_id;
  if (!custId) return;
  if (tx.trade_id && !s.bot.notifyPaymentsWithTrade) return;
  const user = await userByCustomer(custId);
  if (!user) return;
  if (await alreadySent(`tx:${tx._id}`)) return;
  const text = await paymentText(tx, user.language as Lang);
  await sendToUser(user.telegramId, text);
  await activity("payment_sent", `To'lov xabari: №${tx.number} → ${user.name || user.phone}`);
}

async function getState(key: string): Promise<string | null> {
  const r = await prisma.syncState.findUnique({ where: { key } });
  return (r?.value as { at?: string } | null)?.at || null;
}
async function setState(key: string, at: string) {
  await prisma.syncState.upsert({ where: { key }, create: { key, value: { at } }, update: { value: { at } } });
}

/** Polling: oxirgi tekshiruvdan keyin yangilangan savdo va to'lovlar */
export async function pollFinance(): Promise<void> {
  const s = getSettings();
  if (!s.bito.apiKey) return;
  const now = new Date().toISOString();
  // Savdolar
  try {
    let since = await getState("trades");
    if (!since) { await setState("trades", now); since = now; }
    const page = await bito.tradesPage({ page: 1, limit: 100, updated_at: since });
    const list = (page.data || []).filter((t) => !t.updated_at || t.updated_at >= since!);
    for (const t of list) {
      if (t.state !== "done" && t.state !== "in_progress") continue;
      await processTrade(t._id);
    }
    await setState("trades", now);
  } catch (e) { log.warn("pollFinance trades", errMsg(e)); }
  // To'lovlar
  try {
    let since = await getState("transactions");
    if (!since) { await setState("transactions", now); since = now; }
    const page = await bito.transactionsPage({ page: 1, limit: 100, date_from: since });
    for (const tx of page.data || []) {
      if (tx.customer?._id || tx.customer_id) await processTransaction(tx._id, tx);
    }
    await setState("transactions", now);
  } catch (e) { log.warn("pollFinance transactions", errMsg(e)); }
}

let timer: NodeJS.Timeout | null = null;
export function startFinancePollLoop() {
  const tick = async () => {
    await pollFinance();
    const sec = Math.max(15, Number(getSettings().bito.pollIntervalSec || 60));
    timer = setTimeout(tick, sec * 1000);
  };
  if (timer) clearTimeout(timer);
  timer = setTimeout(tick, 30000);
}
