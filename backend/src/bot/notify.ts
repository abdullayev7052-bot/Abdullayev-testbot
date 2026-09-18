import type { Order, User } from "@prisma/client";
import { GrammyError } from "grammy";
import { bot } from "./instance.ts";
import { prisma } from "../db.ts";
import { events, type StageActor } from "../events.ts";
import { fill, getSettings, lt } from "../settings/store.ts";
import type { Lang } from "../settings/schema.ts";
import { esc, fmtDate, money, prettyPhone, qty } from "../utils/format.ts";
import { stageMessage, stageName, type HistoryEntry, type OrderItemSnapshot, type Stage } from "../bito/orders.ts";
import { groupOrderKeyboard } from "./keyboards.ts";
import { sendToUser } from "./send.ts";
import { onStockArrived } from "../bito/sync.ts";
import { activity, errMsg, log } from "../logger.ts";

function actorLabel(by: StageActor): string {
  if (by.type === "staff") return by.username ? `@${by.username}` + (by.name ? ` (${by.name})` : "") : by.name;
  if (by.type === "bito") return "Bito";
  if (by.type === "customer") return "mijoz";
  return "tizim";
}

/** Guruhdagi buyurtma kartochkasi matni (HTML) */
export function groupOrderText(order: Order, user?: User | null): string {
  const s = getSettings();
  const b = s.bot;
  const stage = (order.stateKey || "new") as Stage;
  const items = (order.items as unknown as OrderItemSnapshot[]) || [];
  const history = (order.history as unknown as HistoryEntry[]) || [];
  const title = stage === "new" ? b.groupTitleNew : `📋 BUYURTMA #${order.number || order.id}`;
  const lines: string[] = [`<b>${esc(title)}</b>`, ""];
  lines.push(`${esc(b.gTime)}: ${fmtDate(order.createdAt, "uz")}`);
  lines.push(`${esc(b.gCustomer)}: ${esc(order.customerName || user?.name || user?.tgFirstName || "—")}${user?.tgUsername ? ` (@${esc(user.tgUsername)})` : ""}`);
  lines.push(`${esc(b.gPhone)}: ${prettyPhone(order.phone)}`);
  lines.push(`${esc(b.gType)}: ${esc(order.type === "pickup" ? b.gPickup : b.gDelivery)}`);
  lines.push(`${esc(b.gNumber)}: <b>#${esc(order.number || order.id)}</b>`);
  lines.push(`${esc(b.gStatus)}: <b>${esc(stageName(stage, "uz", order.stateName))}</b>`);
  if (order.type === "delivery" && order.address) lines.push(`${esc(b.gAddress)}: ${esc(order.address)}`);
  if (order.comment) lines.push(`${esc(b.gComment)}: ${esc(order.comment)}`);
  lines.push("", `<b>${esc(b.gProducts)}:</b>`);
  items.forEach((it, i) => {
    const box = it.boxCount && it.boxItem ? ` (${it.boxCount} quti × ${qty(it.boxItem)})` : "";
    lines.push(`${i + 1}. ${esc(it.name)} — <b>${qty(it.qty)}</b> ${esc(it.measure || "dona")}${box}`);
  });
  const totalQty = items.reduce((a, x) => a + Number(x.qty || 0), 0);
  lines.push(`Jami: <b>${qty(totalQty)}</b> dona`);
  if (b.showTotalInGroup) lines.push(`Summa: <b>${money(order.total, "uz")}</b>`);
  if (history.length) {
    lines.push("", `<b>${esc(b.gHistory)}:</b>`);
    for (const h of history.slice(-12)) {
      lines.push(`• ${fmtDate(h.at, "uz")} — ${esc(stageName(h.stage, "uz", h.stateName))} — ${esc(actorLabel(h.by))}`);
    }
  }
  return lines.join("\n");
}

async function enabledGroups() {
  return prisma.adminGroup.findMany({ where: { enabled: true } });
}

/** Yangi buyurtma: mijozga tasdiq + guruhlarga kartochka */
async function onOrderCreated(order: Order, user: User) {
  const lang = user.language as Lang;
  const vars = { order: order.number || String(order.id), name: user.name || "", total: money(order.total, lang) };
  const text = order.type === "pickup" ? lt(getSettings().bot.orderReceivedPickup, lang) : lt(getSettings().bot.orderReceived, lang);
  const mid = await sendToUser(user.telegramId, esc(fill(text, vars)).replace(/&lt;b&gt;/g, "<b>").replace(/&lt;\/b&gt;/g, "</b>"));
  if (mid) await prisma.order.update({ where: { id: order.id }, data: { customerMessageId: mid } });

  const groups = await enabledGroups();
  if (!groups.length) {
    await activity("group_missing", `Buyurtma #${order.number} uchun yoqilgan guruh yo'q (Admin panel → Guruhlar)`);
    return;
  }
  const html = groupOrderText(order, user);
  for (const g of groups) {
    try {
      const m = await bot.api.sendMessage(g.chatId, html, { parse_mode: "HTML", reply_markup: groupOrderKeyboard(order), link_preview_options: { is_disabled: true } });
      if (!order.groupMessageId) {
        order = await prisma.order.update({ where: { id: order.id }, data: { groupChatId: g.chatId, groupMessageId: m.message_id } });
      }
    } catch (e) {
      log.error("Guruhga yuborilmadi", g.chatId, errMsg(e));
      if (e instanceof GrammyError && /chat not found|kicked|not a member/i.test(e.description)) {
        await prisma.adminGroup.update({ where: { id: g.id }, data: { enabled: false } }).catch(() => {});
      }
    }
  }
}

/** Guruhdagi kartochkani yangilash */
export async function refreshGroupMessage(order: Order) {
  if (!order.groupChatId || !order.groupMessageId) return;
  const user = await prisma.user.findUnique({ where: { id: order.userId } });
  try {
    await bot.api.editMessageText(order.groupChatId, order.groupMessageId, groupOrderText(order, user), {
      parse_mode: "HTML", reply_markup: groupOrderKeyboard(order), link_preview_options: { is_disabled: true },
    });
  } catch (e) {
    if (e instanceof GrammyError && /message is not modified/i.test(e.description)) return;
    log.warn("editMessageText", errMsg(e));
  }
}

/** Holat o'zgardi: guruh kartochkasi + mijozga xabar */
async function onOrderStage(order: Order, prev: string | null, _by: StageActor) {
  await refreshGroupMessage(order);
  const stage = (order.stateKey || "other") as Stage;
  if (stage === "new" || stage === prev) return;
  const user = await prisma.user.findUnique({ where: { id: order.userId } });
  if (!user || user.isBlocked) return;
  const lang = user.language as Lang;
  const msg = stageMessage(stage, lang, { order: order.number || String(order.id), status: stageName(stage, lang, order.stateName), name: user.name || "" });
  if (msg) await sendToUser(user.telegramId, esc(msg));
}

/** "Kelganda eslating": mahsulot qoldig'i paydo bo'ldi */
async function notifyWaitlist(productIds: number[]) {
  const entries = await prisma.waitlist.findMany({ where: { productId: { in: productIds }, notifiedAt: null }, include: { user: true, product: true } });
  for (const w of entries) {
    if (w.user.isBlocked) continue;
    const lang = w.user.language as Lang;
    const text = fill(lt(getSettings().bot.waitlistArrived, lang), { product: w.product.name });
    const { openAppInline } = await import("./keyboards.ts");
    await sendToUser(w.user.telegramId, esc(text), { reply_markup: openAppInline(lang) });
    await prisma.waitlist.update({ where: { id: w.id }, data: { notifiedAt: new Date() } });
    await activity("waitlist_notified", `"${w.product.name}" keldi → ${w.user.name || w.user.phone}`);
  }
}

export function registerNotifications() {
  events.onApp("order:created", onOrderCreated);
  events.onApp("order:stage", onOrderStage);
  onStockArrived(notifyWaitlist);
}
