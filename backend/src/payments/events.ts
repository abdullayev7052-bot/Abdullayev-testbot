/** To'lov holati o'zgarganda mijozga va guruhga xabar berish */
import type { Payment } from "@prisma/client";
import { prisma } from "../db.ts";
import { getSettings, lt, fill } from "../settings/store.ts";
import { sendToUser } from "../bot/send.ts";
import { bot } from "../bot/instance.ts";
import { esc, money } from "../utils/format.ts";
import { errMsg, log } from "../logger.ts";
import type { Lang } from "../settings/schema.ts";

async function notify(payment: Payment, kind: "paid" | "canceled") {
  const p = getSettings().payments;
  const order = payment.orderId ? await prisma.order.findUnique({ where: { id: payment.orderId }, include: { user: true } }) : null;
  const lang = (order?.user?.language || "uz") as Lang;
  const sum = money(payment.amount / 100, lang);
  const num = order?.number || String(order?.id || "");

  // Mijozga
  const tpl = kind === "paid" ? p.paymePaidMsg : p.paymeCanceledMsg;
  const text = fill(lt(tpl, lang), { number: num, amount: sum });
  if (order?.user?.telegramId && text.trim()) {
    await sendToUser(order.user.telegramId, esc(text)).catch(() => {});
  }

  // Buyurtmalar guruhiga
  if (p.paymeNotifyGroup !== false && order) {
    const groups = await prisma.adminGroup.findMany({ where: { enabled: true } });
    const line = kind === "paid"
      ? `💳 <b>To'lov qabul qilindi</b>\nBuyurtma: <b>#${esc(num)}</b>\nSumma: <b>${esc(sum)}</b>\nTizim: Payme${payment.sandbox ? " (sinov)" : ""}`
      : `↩️ <b>To'lov bekor qilindi</b>\nBuyurtma: <b>#${esc(num)}</b>\nSumma: <b>${esc(sum)}</b>`;
    for (const g of groups) {
      await bot.api.sendMessage(g.chatId, line, { parse_mode: "HTML" }).catch((e) => log.warn("payme group", errMsg(e)));
    }
  }
}

export async function onPaymentPaid(payment: Payment) {
  await notify(payment, "paid");
}

export async function onPaymentCanceled(payment: Payment) {
  await notify(payment, "canceled");
}
