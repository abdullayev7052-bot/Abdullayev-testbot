/**
 * Payme (Paycom) Merchant API — JSON-RPC 2.0.
 *
 * Payme Business bizning serverga so'rov yuboradi, biz javob qaytaramiz:
 *   CheckPerformTransaction → to'lov mumkinmi
 *   CreateTransaction       → tranzaksiya yaratish (buyurtma "to'lov kutilmoqda")
 *   PerformTransaction      → pul yechildi, buyurtma "to'landi"
 *   CancelTransaction       → bekor qilish / pulni qaytarish
 *   CheckTransaction        → holatni tekshirish
 *   GetStatement            → davr bo'yicha tranzaksiyalar ro'yxati
 *
 * Hujjat: https://developer.help.paycom.uz
 */
import type { Request, Response } from "express";
import { prisma } from "../db.ts";
import { getSettings } from "../settings/store.ts";
import { activity, errMsg, log } from "../logger.ts";
import { onPaymentPaid, onPaymentCanceled } from "./events.ts";

/* ========================= Xatolik kodlari ========================= */
export const PaymeError = {
  TransportNotPost: -32300,
  JsonParse: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  NotAllowed: -32504,
  Internal: -32400,
  WrongAmount: -31001,
  TransactionNotFound: -31003,
  CantCancel: -31007,
  CantDo: -31008,
  /** account xatolari: -31050 … -31099 */
  AccountNotFound: -31050,
  OrderAlreadyPaid: -31051,
  OrderCanceled: -31052,
} as const;

/** Tranzaksiya holatlari (Payme spetsifikatsiyasi) */
export const TxState = { Created: 1, Done: 2, Canceled: -1, CanceledAfterDone: -2 } as const;

/** Bekor qilish sabablari */
export const TxReason = { ReceiverNotFound: 1, DebitError: 2, ExecutionError: 3, Timeout: 4, Refund: 5, Unknown: 10 } as const;

/** Payme tranzaksiyani 12 soatdan keyin taymaut bo'yicha bekor qiladi */
const TIMEOUT_MS = 12 * 60 * 60 * 1000;

type L = { uz: string; ru: string; en: string };
class RpcError extends Error {
  constructor(public code: number, public localized: L, public data?: string) {
    super(localized.ru);
  }
}
const fail = (code: number, uz: string, ru: string, en: string, data?: string) => new RpcError(code, { uz, ru, en }, data);

/* ========================= Yordamchilar ========================= */

/** Faol kalit(lar): ishchi rejimda asosiy kalit, sinov rejimida test kaliti. Ikkalasi ham qabul qilinadi. */
function keys(): { live: string; test: string; login: string } {
  const p = getSettings().payments;
  return { live: (p.paymeKey || "").trim(), test: (p.paymeTestKey || "").trim(), login: (p.paymeLogin || "Paycom").trim() };
}

/** Basic avtorizatsiyani tekshirish. Qaytaradi: sinov kaliti ishlatilganmi */
function checkAuth(req: Request): { ok: boolean; sandbox: boolean } {
  const h = req.header("authorization") || "";
  const m = /^Basic\s+(.+)$/i.exec(h.trim());
  if (!m) return { ok: false, sandbox: false };
  let decoded = "";
  try { decoded = Buffer.from(m[1], "base64").toString("utf8"); } catch { return { ok: false, sandbox: false }; }
  const i = decoded.indexOf(":");
  if (i < 0) return { ok: false, sandbox: false };
  const login = decoded.slice(0, i);
  const pass = decoded.slice(i + 1);
  const k = keys();
  // Login odatda "Paycom" — lekin asosiysi kalit. Login sozlamada ko'rsatilgan bo'lsa, tekshiramiz.
  if (k.login && login !== k.login) return { ok: false, sandbox: false };
  if (k.live && pass === k.live) return { ok: true, sandbox: false };
  if (k.test && pass === k.test) return { ok: true, sandbox: true };
  return { ok: false, sandbox: false };
}

/** Buyurtma summasi tiyinda */
function orderAmountTiyin(total: number): number {
  return Math.round(Number(total || 0) * 100);
}

/** account obyektidan buyurtma raqamini olish */
function orderIdFromAccount(account: Record<string, unknown> | undefined): number | null {
  const p = getSettings().payments;
  const field = (p.paymeAccountField || "order_id").trim();
  const raw = account?.[field] ?? account?.order_id ?? account?.order ?? account?.id;
  const n = Number(String(raw ?? "").trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}

const accountError = (code: number, uz: string, ru: string, en: string) =>
  fail(code, uz, ru, en, getSettings().payments.paymeAccountField || "order_id");

/** Buyurtmani topish va to'lovga tayyorligini tekshirish */
async function findPayableOrder(account: Record<string, unknown> | undefined, amount?: number) {
  const id = orderIdFromAccount(account);
  if (!id) throw accountError(PaymeError.AccountNotFound, "Buyurtma raqami noto'g'ri", "Неверный номер заказа", "Invalid order number");

  const order = await prisma.order.findUnique({ where: { id }, include: { user: true } });
  if (!order) throw accountError(PaymeError.AccountNotFound, "Buyurtma topilmadi", "Заказ не найден", "Order not found");
  if (order.stateKey === "canceled") {
    throw accountError(PaymeError.OrderCanceled, "Buyurtma bekor qilingan", "Заказ отменён", "Order is canceled");
  }
  if (order.isPaid) {
    throw accountError(PaymeError.OrderAlreadyPaid, "Buyurtma allaqachon to'langan", "Заказ уже оплачен", "Order is already paid");
  }

  if (amount !== undefined) {
    const need = orderAmountTiyin(order.total);
    if (!need || amount !== need) {
      throw fail(PaymeError.WrongAmount, "Summa noto'g'ri", "Неверная сумма", "Invalid amount");
    }
    const p = getSettings().payments;
    const sum = amount / 100;
    if (p.paymeMinAmount && sum < p.paymeMinAmount) {
      throw fail(PaymeError.WrongAmount, "Summa juda kichik", "Сумма слишком мала", "Amount is too small");
    }
    if (p.paymeMaxAmount && sum > p.paymeMaxAmount) {
      throw fail(PaymeError.WrongAmount, "Summa juda katta", "Сумма слишком велика", "Amount is too large");
    }
  }
  return order;
}

/** Taymaut bo'yicha bekor qilish kerakmi */
function expired(createdMs: bigint | number): boolean {
  return Date.now() - Number(createdMs) > TIMEOUT_MS;
}

/* ========================= Metodlar ========================= */

async function checkPerformTransaction(params: { amount?: number; account?: Record<string, unknown> }) {
  const order = await findPayableOrder(params.account, params.amount);
  const p = getSettings().payments;
  const result: Record<string, unknown> = { allow: true };

  if (p.paymeFiscal) {
    result.detail = buildDetail(order.items as unknown as OrderItem[], order.total);
  }
  return result;
}

interface OrderItem { productId?: number; name?: string; price?: number; qty?: number; ikpu?: string; packageCode?: string; vat?: number }

/** Fiskal chek tafsilotlari (ИКПУ, НДС) */
function buildDetail(items: OrderItem[], total: number) {
  const p = getSettings().payments;
  const list = Array.isArray(items) ? items : [];
  const mapped = list.map((it) => ({
    title: String(it.name || "Mahsulot").slice(0, 120),
    price: Math.round(Number(it.price || 0) * 100),
    count: Number(it.qty || 1),
    code: String(it.ikpu || p.paymeIkpu || ""),
    package_code: String(it.packageCode || p.paymePackageCode || ""),
    vat_percent: Number(it.vat ?? p.paymeVatPercent ?? 0),
  }));
  // Mahsulotlar yig'indisi buyurtma summasidan farq qilsa, fiskal chek yuborilmaydi
  const sum = mapped.reduce((s, x) => s + x.price * x.count, 0);
  if (!mapped.length || sum !== Math.round(Number(total || 0) * 100)) return undefined;
  return { receipt_type: 0, items: mapped };
}

async function createTransaction(params: { id: string; time: number; amount: number; account?: Record<string, unknown> }, sandbox: boolean) {
  const existing = await prisma.payment.findUnique({ where: { paycomId: params.id } });
  if (existing) {
    if (existing.state !== TxState.Created) {
      throw fail(PaymeError.CantDo, "Tranzaksiya holati mos emas", "Состояние транзакции не позволяет", "Transaction state does not allow this");
    }
    if (expired(existing.createTime)) {
      await cancelPayment(existing.id, TxReason.Timeout);
      throw fail(PaymeError.CantDo, "Tranzaksiya vaqti tugadi", "Время транзакции истекло", "Transaction timed out");
    }
    return { create_time: Number(existing.createTime), transaction: String(existing.id), state: existing.state };
  }

  const order = await findPayableOrder(params.account, params.amount);

  // Shu buyurtma uchun boshqa kutilayotgan tranzaksiya bo'lmasligi kerak
  const pending = await prisma.payment.findFirst({ where: { orderId: order.id, state: TxState.Created } });
  if (pending) {
    if (expired(pending.createTime)) await cancelPayment(pending.id, TxReason.Timeout);
    else throw fail(PaymeError.CantDo, "Bu buyurtma uchun to'lov allaqachon boshlangan", "Для этого заказа уже создана транзакция", "A transaction already exists for this order");
  }

  const now = Date.now();
  const created = await prisma.payment.create({
    data: {
      provider: "payme",
      orderId: order.id,
      userId: order.userId,
      amount: params.amount,
      state: TxState.Created,
      paycomId: params.id,
      paycomTime: BigInt(params.time || now),
      createTime: BigInt(now),
      account: (params.account || {}) as object,
      sandbox,
    },
  });
  await prisma.order.update({ where: { id: order.id }, data: { paymentState: "pending", paymentProvider: "payme" } }).catch(() => {});
  await activity("payme", `To'lov boshlandi: #${order.number || order.id} — ${(params.amount / 100).toLocaleString("ru-RU")} so'm`, { paymentId: created.id });
  return { create_time: now, transaction: String(created.id), state: TxState.Created };
}

async function performTransaction(params: { id: string }) {
  const row = await prisma.payment.findUnique({ where: { paycomId: params.id } });
  if (!row) throw fail(PaymeError.TransactionNotFound, "Tranzaksiya topilmadi", "Транзакция не найдена", "Transaction not found");

  if (row.state === TxState.Done) {
    return { transaction: String(row.id), perform_time: Number(row.performTime), state: row.state };
  }
  if (row.state !== TxState.Created) {
    throw fail(PaymeError.CantDo, "Tranzaksiya holati mos emas", "Состояние транзакции не позволяет", "Transaction state does not allow this");
  }
  if (expired(row.createTime)) {
    await cancelPayment(row.id, TxReason.Timeout);
    throw fail(PaymeError.CantDo, "Tranzaksiya vaqti tugadi", "Время транзакции истекло", "Transaction timed out");
  }

  const now = Date.now();
  const done = await prisma.payment.update({
    where: { id: row.id },
    data: { state: TxState.Done, performTime: BigInt(now) },
  });
  if (done.orderId) {
    await prisma.order.update({
      where: { id: done.orderId },
      data: { isPaid: true, paidAt: new Date(now), paymentState: "paid", paymentProvider: "payme" },
    }).catch(() => {});
  }
  await activity("payme", `To'lov qabul qilindi: ${(done.amount / 100).toLocaleString("ru-RU")} so'm`, { paymentId: done.id, orderId: done.orderId });
  void onPaymentPaid(done).catch((e) => log.error("payme paid hook", errMsg(e)));
  return { transaction: String(done.id), perform_time: now, state: TxState.Done };
}

/** Ichki bekor qilish (taymaut yoki Payme so'rovi bo'yicha) */
async function cancelPayment(id: number, reason: number) {
  const row = await prisma.payment.findUnique({ where: { id } });
  if (!row) return null;
  const now = Date.now();
  const state = row.state === TxState.Done ? TxState.CanceledAfterDone : TxState.Canceled;
  const updated = await prisma.payment.update({
    where: { id },
    data: { state, reason, cancelTime: row.cancelTime ? row.cancelTime : BigInt(now) },
  });
  if (updated.orderId) {
    await prisma.order.update({
      where: { id: updated.orderId },
      data: { isPaid: false, paidAt: null, paymentState: "canceled" },
    }).catch(() => {});
  }
  await activity("payme", `To'lov bekor qilindi (sabab ${reason}): ${(updated.amount / 100).toLocaleString("ru-RU")} so'm`, { paymentId: updated.id, orderId: updated.orderId });
  void onPaymentCanceled(updated).catch((e) => log.error("payme cancel hook", errMsg(e)));
  return updated;
}

async function cancelTransaction(params: { id: string; reason?: number }) {
  const row = await prisma.payment.findUnique({ where: { paycomId: params.id } });
  if (!row) throw fail(PaymeError.TransactionNotFound, "Tranzaksiya topilmadi", "Транзакция не найдена", "Transaction not found");

  if (row.state === TxState.Canceled || row.state === TxState.CanceledAfterDone) {
    return { transaction: String(row.id), cancel_time: Number(row.cancelTime), state: row.state };
  }

  // Buyurtma yetkazib berilgan bo'lsa, pulni qaytarib bo'lmaydi
  if (row.state === TxState.Done && row.orderId) {
    const order = await prisma.order.findUnique({ where: { id: row.orderId } });
    const p = getSettings().payments;
    if (p.paymeBlockRefundWhenDone !== false && order?.stateKey === "done") {
      throw fail(PaymeError.CantCancel, "Buyurtma yetkazib berilgan, bekor qilib bo'lmaydi", "Заказ выполнен, отменить невозможно", "Order is delivered, cannot cancel");
    }
  }

  const updated = await cancelPayment(row.id, params.reason ?? TxReason.Unknown);
  return { transaction: String(updated!.id), cancel_time: Number(updated!.cancelTime), state: updated!.state };
}

async function checkTransaction(params: { id: string }) {
  const row = await prisma.payment.findUnique({ where: { paycomId: params.id } });
  if (!row) throw fail(PaymeError.TransactionNotFound, "Tranzaksiya topilmadi", "Транзакция не найдена", "Transaction not found");
  return {
    create_time: Number(row.createTime),
    perform_time: Number(row.performTime),
    cancel_time: Number(row.cancelTime),
    transaction: String(row.id),
    state: row.state,
    reason: row.reason ?? null,
  };
}

async function getStatement(params: { from: number; to: number }) {
  const rows = await prisma.payment.findMany({
    where: { provider: "payme", paycomTime: { gte: BigInt(params.from || 0), lte: BigInt(params.to || 0) } },
    orderBy: { paycomTime: "asc" },
  });
  return {
    transactions: rows.map((r) => ({
      id: r.paycomId,
      time: Number(r.paycomTime),
      amount: r.amount,
      account: r.account,
      create_time: Number(r.createTime),
      perform_time: Number(r.performTime),
      cancel_time: Number(r.cancelTime),
      transaction: String(r.id),
      state: r.state,
      reason: r.reason ?? null,
    })),
  };
}

/* ========================= HTTP ========================= */

/** Express: POST /api/payme */
export async function paymeHandler(req: Request, res: Response) {
  const raw: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {}));
  const send = (id: unknown, body: Record<string, unknown>) => res.status(200).json({ jsonrpc: "2.0", id: id ?? 0, ...body });
  const sendErr = (id: unknown, code: number, l: L, data?: string) =>
    send(id, { error: { code, message: l, ...(data ? { data } : {}) } });

  if (req.method !== "POST") {
    sendErr(0, PaymeError.TransportNotPost, { uz: "Faqat POST", ru: "Требуется POST", en: "POST required" });
    return;
  }

  let body: { method?: string; params?: Record<string, unknown>; id?: unknown };
  try {
    body = JSON.parse(raw.toString("utf8") || "{}");
  } catch {
    sendErr(0, PaymeError.JsonParse, { uz: "JSON xato", ru: "Ошибка разбора JSON", en: "JSON parse error" });
    return;
  }

  const p = getSettings().payments;
  if (!p.paymeEnabled) {
    sendErr(body.id, PaymeError.NotAllowed, { uz: "To'lov tizimi o'chirilgan", ru: "Приём платежей отключён", en: "Payments are disabled" });
    return;
  }

  const auth = checkAuth(req);
  if (!auth.ok) {
    sendErr(body.id, PaymeError.NotAllowed, { uz: "Ruxsat yo'q", ru: "Недостаточно привилегий для выполнения метода", en: "Insufficient privileges" });
    return;
  }
  if (p.paymeMode === "live" && auth.sandbox) {
    sendErr(body.id, PaymeError.NotAllowed, { uz: "Sinov kaliti ishchi rejimda ishlamaydi", ru: "Тестовый ключ недоступен в рабочем режиме", en: "Test key is not allowed in live mode" });
    return;
  }

  if (!body.method || typeof body.method !== "string" || (body.params !== undefined && typeof body.params !== "object")) {
    sendErr(body.id, PaymeError.InvalidRequest, { uz: "So'rov formati noto'g'ri", ru: "Неверный формат запроса", en: "Invalid request" });
    return;
  }

  const params = (body.params || {}) as never;
  try {
    let result: unknown;
    switch (body.method) {
      case "CheckPerformTransaction": result = await checkPerformTransaction(params); break;
      case "CreateTransaction": result = await createTransaction(params, auth.sandbox); break;
      case "PerformTransaction": result = await performTransaction(params); break;
      case "CancelTransaction": result = await cancelTransaction(params); break;
      case "CheckTransaction": result = await checkTransaction(params); break;
      case "GetStatement": result = await getStatement(params); break;
      default:
        sendErr(body.id, PaymeError.MethodNotFound, { uz: "Metod topilmadi", ru: "Запрашиваемый метод не найден", en: "Method not found" }, body.method);
        return;
    }
    send(body.id, { result });
  } catch (e) {
    if (e instanceof RpcError) {
      sendErr(body.id, e.code, e.localized, e.data);
      return;
    }
    log.error("payme", errMsg(e));
    await activity("payme_error", `Payme so'rovida xatolik (${body.method}): ${errMsg(e)}`);
    sendErr(body.id, PaymeError.Internal, { uz: "Ichki xatolik", ru: "Внутренняя ошибка", en: "Internal error" });
  }
}

/** Eskirgan (12 soatdan oshgan) to'lovlarni bekor qilish — vaqti-vaqti bilan chaqiriladi */
export async function pruneStalePayments(): Promise<number> {
  const rows = await prisma.payment.findMany({
    where: { state: TxState.Created, createTime: { lt: BigInt(Date.now() - TIMEOUT_MS) } },
    select: { id: true },
  });
  for (const r of rows) await cancelPayment(r.id, TxReason.Timeout).catch(() => {});
  return rows.length;
}
