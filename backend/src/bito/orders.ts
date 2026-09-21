import { prisma } from "../db.ts";
import type { Order, User } from "@prisma/client";
import { bito, BitoError } from "./client.ts";
import { fill, getSettings, lt } from "../settings/store.ts";
import type { Lang } from "../settings/schema.ts";
import { events, type StageActor } from "../events.ts";
import { activity, errMsg, log } from "../logger.ts";
import { money, normalizePhone, qty, sleep } from "../utils/format.ts";
import { ensureCustomer, updateCustomerAddress } from "./customers.ts";
import type { BitoSaleOrder } from "./types.ts";
import { priceFor, userStore, exceptionPriceId } from "./stores.ts";

/** Bito'dagi ommaviy holat yangilanishi asinxron — shu vaqt ichida qayta o'qimaymiz */
const PUSH_GRACE_MS = 90_000;

export type Stage = "new" | "accepted" | "ready" | "delivering" | "done" | "canceled" | "other";
export const TERMINAL: Stage[] = ["done", "canceled"];

export interface OrderItemSnapshot {
  productId: number;
  bitoId: string;
  name: string;
  price: number;
  basePrice?: number;
  qty: number;
  boxCount?: number;
  boxItem?: number;
  measure?: string | null;
  image?: string | null;
}

export interface HistoryEntry {
  at: string;
  stage: Stage;
  stateName?: string;
  by: StageActor;
  kind?: "stage" | "products" | "traded";
}

/** Bito holat ID'sidan bizning bosqichni aniqlash */
export function stageOf(stateId: string | null | undefined, dynamic?: { default_key?: string; name?: string } | null): Stage {
  const st = getSettings().statuses;
  if (stateId) {
    if (stateId === st.newStateId) return "new";
    if (stateId === st.acceptedStateId) return "accepted";
    if (stateId === st.readyStateId) return "ready";
    if (stateId === st.deliveringStateId) return "delivering";
    if (stateId === st.doneStateId) return "done";
    if (stateId === st.canceledStateId) return "canceled";
  }
  // Boshqa tashkilot holatlari: nom bo'yicha asosiy holatlar bilan solishtirish
  if (dynamic?.name) {
    const norm = (x: string) => x.toLowerCase().replace(/['’ʻ`]/g, "").trim();
    const n = norm(dynamic.name);
    const names: [Stage, string][] = [["new", lt(st.nameNew, "uz")], ["accepted", lt(st.nameAccepted, "uz")], ["ready", lt(st.nameReady, "uz")], ["delivering", lt(st.nameDelivering, "uz")], ["done", lt(st.nameDone, "uz")], ["canceled", lt(st.nameCanceled, "uz")]];
    for (const [stage, nm] of names) if (nm && norm(nm) === n) return stage;
  }
  const k = dynamic?.default_key;
  if (k === "new") return "new";
  if (k === "done") return "done";
  if (k === "canceled") return "canceled";
  if (k === "in_progress" || k === "accepted") return "accepted";
  return "other";
}

/** Do'kon (tashkilot) uchun mos holat ID: asosiy holat nomi bo'yicha o'sha tashkilot holatlaridan topiladi */
const statesCache = new Map<string, { at: number; list: { _id: string; name: string; default_key?: string }[] }>();
async function orgStates(orgId: string) {
  const c = statesCache.get(orgId);
  if (c && Date.now() - c.at < 10 * 60 * 1000) return c.list;
  const list = (await bito.states("saleOrders", orgId)).filter((x) => x.organization_id === orgId);
  statesCache.set(orgId, { at: Date.now(), list });
  return list;
}
export async function stateIdForStore(stage: Stage, storeId: string): Promise<string> {
  const mainId = stageStateId(stage);
  if (storeId === "main" || !mainId) return mainId;
  try {
    const { getStore } = await import("./stores.ts");
    const mainOrg = getSettings().bito.organizationId;
    const store = getStore(storeId);
    if (!store.organizationId || store.organizationId === mainOrg) return mainId;
    const [mainStates, orgList] = await Promise.all([orgStates(mainOrg), orgStates(store.organizationId)]);
    const ref = mainStates.find((x) => x._id === mainId);
    if (!ref) return mainId;
    const norm = (x: string) => x.toLowerCase().replace(/['’ʻ`]/g, "").trim();
    const hit = orgList.find((x) => norm(x.name) === norm(ref.name)) || (ref.default_key ? orgList.find((x) => x.default_key === ref.default_key) : undefined);
    return hit?._id || "";
  } catch (e) { log.warn("stateIdForStore", errMsg(e)); return mainId; }
}

export function stageStateId(stage: Stage): string {
  const st = getSettings().statuses;
  return ({ new: st.newStateId, accepted: st.acceptedStateId, ready: st.readyStateId, delivering: st.deliveringStateId, done: st.doneStateId, canceled: st.canceledStateId, other: "" } as Record<Stage, string>)[stage];
}

export function stageName(stage: Stage, lang: Lang, fallback?: string | null): string {
  const st = getSettings().statuses;
  const map: Record<Stage, string> = {
    new: lt(st.nameNew, lang), accepted: lt(st.nameAccepted, lang), ready: lt(st.nameReady, lang), delivering: lt(st.nameDelivering, lang),
    done: lt(st.nameDone, lang), canceled: lt(st.nameCanceled, lang), other: fallback || "",
  };
  return map[stage] || fallback || stage;
}

export function stageMessage(stage: Stage, lang: Lang, vars: Record<string, string | number>): string {
  const st = getSettings().statuses;
  const tpl: Record<Stage, string> = {
    new: "", accepted: lt(st.msgAccepted, lang), ready: lt(st.msgReady, lang), delivering: lt(st.msgDelivering, lang),
    done: lt(st.msgDone, lang), canceled: lt(st.msgCanceled, lang), other: lt(st.msgOther, lang),
  };
  return fill(tpl[stage] || "", vars).trim();
}

/** Keyingi bosqich tugmalari (guruh uchun) */
export function nextStages(stage: Stage, type: string): Stage[] {
  if (stage === "new") return ["accepted", "canceled"];
  if (stage === "accepted") return ["ready", "canceled"];
  if (stage === "ready") return type === "pickup" ? ["done", "canceled"] : ["delivering", "canceled"];
  if (stage === "delivering") return ["done", "canceled"];
  if (stage === "other") return ["accepted", "ready", "done", "canceled"];
  return [];
}

export interface CreateOrderInput {
  items: { productId: number; qty: number; boxCount?: number }[];
  type: "delivery" | "pickup";
  phone: string;
  name?: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
  comment?: string;
}

export class OrderValidationError extends Error {
  constructor(message: string, public code: string) { super(message); }
}

/** Mini App savatchasidan Bito'da buyurtma yaratish */
export async function createOrder(user: User, input: CreateOrderInput, lang: Lang): Promise<Order> {
  const s = getSettings();
  const store = userStore(user);
  const b = { ...s.bito, organizationId: store.organizationId, warehouseId: store.warehouseId, priceId: exceptionPriceId(user) || store.priceId, currencyId: store.currencyId, responsibleId: store.responsibleId };
  const c = s.checkout;
  if (!input.items.length) throw new OrderValidationError("Savatcha bo'sh", "empty");
  if (input.type === "delivery" && !c.deliveryEnabled) throw new OrderValidationError("Yetkazib berish o'chirilgan", "type");
  if (input.type === "pickup" && !c.pickupEnabled) throw new OrderValidationError("Olib ketish o'chirilgan", "type");

  const ids = input.items.map((i) => i.productId);
  const products = await prisma.product.findMany({ where: { id: { in: ids }, isDeleted: false, hidden: false } });
  const snapshot: OrderItemSnapshot[] = [];
  let total = 0;
  let count = 0;
  for (const it of input.items) {
    const p = products.find((x) => x.id === it.productId);
    if (!p) throw new OrderValidationError("Mahsulot topilmadi", "product");
    const q = Number(it.qty);
    if (!Number.isFinite(q) || q <= 0) throw new OrderValidationError("Miqdor noto'g'ri", "qty");
    if (q > s.catalog.maxQtyPerItem) throw new OrderValidationError("Miqdor juda katta", "qty");
    const pr = priceFor(p, user);
    if (s.catalog.checkStockOnCheckout && !s.catalog.allowOrderOutOfStock && q > pr.stock) {
      throw new OrderValidationError(fill(lt(c.errorStock as never, lang), { product: p.name, stock: qty(pr.stock) }), "stock");
    }
    snapshot.push({ productId: p.id, bitoId: p.bitoId, name: p.name, price: pr.price, basePrice: pr.basePrice, qty: q, boxCount: it.boxCount || 0, boxItem: p.boxItem, measure: p.measure, image: p.image });
    total += pr.price * q;
    count += q;
  }
  if (c.minOrderTotal > 0 && total < c.minOrderTotal) {
    throw new OrderValidationError(fill(lt(c.errorMin as never, lang), { min: money(c.minOrderTotal, lang) }), "min");
  }
  const phone = normalizePhone(input.phone || user.phone || "");
  if (!phone) throw new OrderValidationError("Telefon raqam kiritilmagan", "phone");
  const isDelivery = input.type === "delivery";
  if (isDelivery && !(input.address || "").trim() && !(input.lat && input.lng)) throw new OrderValidationError("Manzil kiritilmagan", "address");
  if (isDelivery && c.requireLocation && !(input.lat && input.lng)) throw new OrderValidationError("Xaritadan joylashuvni belgilang", "location");

  // Bito mijozi
  const customerId = await ensureCustomer(user, { name: input.name, phone });

  const typeLabel = isDelivery ? s.bot.gDelivery : s.bot.gPickup;
  const noteLines = [
    `Telegram bot | ${typeLabel}${store.id !== "main" ? ` | ${store.name("uz")}` : ""}`,
    `Tel: ${phone}`,
    isDelivery && input.address ? `Manzil: ${input.address}` : "",
    isDelivery && input.lat && input.lng ? `Xarita: https://maps.google.com/?q=${input.lat},${input.lng}` : "",
    input.comment ? `Izoh: ${input.comment}` : "",
  ].filter(Boolean);

  const payload = {
    organization_id: b.organizationId,
    customer_id: customerId,
    responsible_id: b.responsibleId,
    state: "new",
    state_id: (await stateIdForStore("new", store.id)) || undefined,
    date: new Date().toISOString(),
    note: noteLines.join("\n"),
    discounts: [] as unknown[],
    price_id: b.priceId || undefined,
    currency_id: b.currencyId || undefined,
    products: snapshot.map((i) => ({
      product_id: i.bitoId, amount: i.qty, price: i.price, real_price: i.basePrice ?? i.price, price_id: b.priceId, warehouse_id: b.warehouseId,
      box_count: i.boxCount || 0, box_item: i.boxItem || 0,
    })),
    delivery_address: isDelivery && input.lat && input.lng
      ? { lat: input.lat, long: input.lng, human_address: { addres: input.address || "", address: input.address || "" } }
      : undefined,
  };

  let created: BitoSaleOrder;
  try {
    created = await bito.orderCreate(payload);
  } catch (e) {
    await activity("order_error", "Bito'da buyurtma yaratilmadi: " + errMsg(e), { payload });
    throw new OrderValidationError("Bito'da buyurtma yaratilmadi: " + errMsg(e), "bito");
  }

  // Mijoz ma'lumotlarini yangilash (manzil, telefon)
  const userPatch: Record<string, unknown> = { phone };
  if (input.name && input.name.trim()) userPatch.name = input.name.trim();
  if (isDelivery) { if (input.address) userPatch.address = input.address; if (input.lat && input.lng) { userPatch.lat = input.lat; userPatch.lng = input.lng; } }
  const updatedUser = await prisma.user.update({ where: { id: user.id }, data: userPatch });
  if (isDelivery && input.lat && input.lng) void updateCustomerAddress(customerId, input.lat, input.lng, input.address || "");

  const stage: Stage = stageOf(created.state_id, created.dynamic_state);
  const history: HistoryEntry[] = [{ at: new Date().toISOString(), stage: "new", stateName: created.dynamic_state?.name, by: { type: "customer" } }];
  const order = await prisma.order.create({
    data: {
      bitoId: created._id, number: created.number || created.uuid || null, userId: user.id, type: input.type, storeId: store.id,
      stateId: created.state_id, stateKey: stage, stateName: created.dynamic_state?.name || null,
      items: snapshot as unknown as object, total, itemsCount: count, phone, customerName: updatedUser.name || input.name || null,
      address: isDelivery ? input.address || null : null, lat: isDelivery ? input.lat || null : null, lng: isDelivery ? input.lng || null : null,
      comment: input.comment || null, history: history as unknown as object, bitoPayload: payload as unknown as object,
    },
  });
  await activity("order_created", `Buyurtma #${order.number} yaratildi (${updatedUser.name || phone})`, { orderId: order.id });
  events.emitApp("order:created", order, updatedUser);
  return order;
}

/** Bosqichni o'zgartirish (guruh tugmasi yoki Bito'dan kelgan o'zgarish) */
export async function applyStage(order: Order, stage: Stage, by: StageActor, opts?: { pushToBito?: boolean; stateId?: string; stateName?: string }): Promise<Order> {
  const prev = order.stateKey;
  let stateId = opts?.stateId || (order.storeId && order.storeId !== "main" ? await stateIdForStore(stage, order.storeId) : stageStateId(stage));
  if (opts?.pushToBito) {
    if (!stateId) throw new Error(`"${stage}" bosqichi uchun Bito holati sozlanmagan (Admin panel → Buyurtma holatlari)`);
    if (!order.bitoId) throw new Error("Buyurtma Bito bilan bog'lanmagan");
    try {
      await bito.orderSetState([order.bitoId], stateId);
    } catch (e) {
      if (e instanceof BitoError) throw new Error("Bito: " + e.message);
      throw e;
    }
    verifyPushLater(order.bitoId, stateId);
  }
  const history = ((order.history as unknown as HistoryEntry[]) || []).slice(-30);
  history.push({ at: new Date().toISOString(), stage, stateName: opts?.stateName, by });
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { stateKey: stage, stateId: stateId || order.stateId, stateName: opts?.stateName || null, history: history as unknown as object },
  });
  await activity("order_stage", `Buyurtma #${order.number}: ${prev} → ${stage} (${by.type === "staff" ? by.name : by.type})`);
  events.emitApp("order:stage", updated, prev, by);
  return updated;
}

/** Bulk yangilanish qo'llanganini 20 soniyadan keyin tekshirib, kerak bo'lsa bir marta qayta yuborish */
function verifyPushLater(bitoId: string, stateId: string, attempt = 1) {
  setTimeout(async () => {
    try {
      const r = await bito.orderById(bitoId);
      if (r.state_id === stateId) return;
      if (attempt >= 3) { log.warn(`Bito holati qo'llanmadi: ${bitoId} → ${stateId}`); return; }
      await bito.orderSetState([bitoId], stateId);
      verifyPushLater(bitoId, stateId, attempt + 1);
    } catch (e) { log.warn("verifyPushLater", errMsg(e)); }
  }, 20_000);
}

/** Bito'da mahsulotlar o'zgargan yoki savdoga o'tkazilgan bo'lsa — tarixga yozib, guruh xabarini yangilash */
async function syncOrderExtras(order: Order, r: BitoSaleOrder): Promise<Order> {
  const history = ((order.history as unknown as HistoryEntry[]) || []).slice(-30);
  const items = (order.items as unknown as OrderItemSnapshot[]) || [];
  let changed = false;
  // 1) mahsulotlar
  if (Array.isArray(r.products) && r.products.length) {
    const sig = (list: { bitoId?: string; product_id?: string; qty?: number; amount?: number; price?: number }[]) =>
      list.map((x) => `${x.bitoId || x.product_id}:${Number(x.qty ?? x.amount ?? 0)}:${Number(x.price ?? 0)}`).sort().join("|");
    if (sig(items) !== sig(r.products)) {
      const localById = new Map(items.map((i) => [i.bitoId, i]));
      const products = await prisma.product.findMany({ where: { bitoId: { in: r.products.map((p) => p.product_id) } } });
      const byBito = new Map(products.map((p) => [p.bitoId, p]));
      const next: OrderItemSnapshot[] = r.products.map((p) => {
        const loc = localById.get(p.product_id); const db = byBito.get(p.product_id);
        return { productId: loc?.productId ?? db?.id ?? 0, bitoId: p.product_id, name: p.name || loc?.name || db?.name || "", price: Number(p.price || 0), qty: Number(p.amount || 0),
          boxCount: p.box_count || 0, boxItem: loc?.boxItem ?? db?.boxItem ?? 0, measure: p.measure?.short_name || loc?.measure || db?.measure || null, image: loc?.image ?? db?.image ?? null };
      });
      const total = next.reduce((a, x) => a + x.price * x.qty, 0);
      history.push({ at: new Date().toISOString(), stage: (order.stateKey || "new") as Stage, by: { type: "bito" }, kind: "products" });
      order = await prisma.order.update({ where: { id: order.id }, data: { items: next as unknown as object, total, itemsCount: next.reduce((a, x) => a + x.qty, 0), history: history as unknown as object } });
      changed = true;
    }
  }
  // 2) savdoga o'tkazildi
  if (Array.isArray(r.trades) && r.trades.length && !history.some((h) => h.kind === "traded")) {
    history.push({ at: new Date().toISOString(), stage: (order.stateKey || "new") as Stage, by: { type: "bito" }, kind: "traded" });
    order = await prisma.order.update({ where: { id: order.id }, data: { history: history as unknown as object } });
    changed = true;
  }
  if (changed) {
    await activity("order_updated", `Buyurtma #${order.number}: Bito'dan yangilandi`);
    events.emitApp("order:updated", order);
  }
  return order;
}

/** Bito'dagi holat bizdagidan farq qilsa — yangilash */
export async function reconcileOrder(order: Order, remote?: BitoSaleOrder): Promise<Order> {
  if (!order.bitoId) return order;
  const r = remote || (await bito.orderById(order.bitoId));
  if (!r) return order;
  if (!order.number && (r.number || r.uuid)) order = await prisma.order.update({ where: { id: order.id }, data: { number: r.number || r.uuid } });
  order = await syncOrderExtras(order, r);
  if (r.state_id && r.state_id !== order.stateId) {
    // Biz yaqinda Bito'ga holat yuborgan bo'lsak (bulk yangilanish asinxron) — Bito ulgurishini kutamiz
    const hist = (order.history as unknown as HistoryEntry[]) || [];
    const last = hist[hist.length - 1];
    const recentlyPushed = last && last.by.type === "staff" && Date.now() - new Date(last.at).getTime() < PUSH_GRACE_MS;
    if (recentlyPushed) return order;
    const stage = stageOf(r.state_id, r.dynamic_state);
    return applyStage(order, stage, { type: "bito" }, { stateId: r.state_id, stateName: r.dynamic_state?.name });
  }
  return order;
}

let pollTimer: NodeJS.Timeout | null = null;
/** Faol buyurtmalarni Bito bilan solishtirib turish (webhook kelmasa ham ishlaydi) */
export function startOrderReconcileLoop() {
  const tick = async () => {
    try {
      const s = getSettings();
      if (s.bito.apiKey) {
        const active = await prisma.order.findMany({
          where: { bitoId: { not: null }, stateKey: { notIn: TERMINAL } },
          orderBy: { updatedAt: "asc" }, take: 40,
        });
        for (const o of active) {
          try { await reconcileOrder(o); } catch (e) { log.warn("reconcile #" + o.number, errMsg(e)); }
          await sleep(150); // Bito rate-limit uchun
        }
      }
    } catch (e) {
      log.error("order reconcile loop", e);
    }
    const sec = Math.max(15, Number(getSettings().bito.pollIntervalSec || 60));
    pollTimer = setTimeout(tick, sec * 1000);
  };
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = setTimeout(tick, 20000);
}
