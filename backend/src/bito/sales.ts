/**
 * "Bu haftada X ta sotildi" ko'rsatkichi.
 * Manba sozlamadan tanlanadi: "bito" (Bito'dagi barcha savdolar) yoki "app" (faqat Mini App buyurtmalari).
 * Bito tomoni: POST reports/trade/by-product/pagin — davr ichidagi savdo qatorlari, mahsulot bo'yicha.
 * Hech qanday tashkilot/akkaunt qattiq yozilmagan — barchasi sozlamalardagi do'konlardan olinadi.
 */
import { prisma } from "../db.ts";
import { bito } from "./client.ts";
import { getSettings } from "../settings/store.ts";
import { listStores } from "./stores.ts";
import { errMsg, log } from "../logger.ts";

interface TradeProductRow {
  amount?: number;
  is_refund?: boolean;
  product?: { _id?: string };
  product_id?: string;
}

/** bitoId → oxirgi N kunda sotilgan miqdor */
let cache: { at: number; days: number; source: string; map: Map<string, number> } | null = null;
let inflight: Promise<Map<string, number>> | null = null;

export function salesCacheAge(): number | null {
  return cache ? Date.now() - cache.at : null;
}

/** Bito'dan: davr ichidagi savdo qatorlarini mahsulot bo'yicha yig'ish */
async function fetchFromBito(days: number): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const orgIds = [...new Set(listStores().map((s) => s.organizationId).filter(Boolean))];
  const from = new Date(Date.now() - days * 86400000).toISOString();
  const to = new Date().toISOString();
  const body: Record<string, unknown> = { date_from: from, date_to: to };
  if (orgIds.length) body.organization_ids = orgIds;
  for (let page = 1; page <= 100; page++) {
    const r = await bito.call<{ list?: TradeProductRow[]; data?: TradeProductRow[]; total?: number }>(
      "POST", "reports/trade/by-product/pagin", { ...body, page, limit: 200 },
    );
    const rows = r.list || r.data || [];
    for (const row of rows) {
      const id = row.product?._id || row.product_id;
      if (!id) continue;
      const qty = Number(row.amount || 0) * (row.is_refund ? -1 : 1);
      map.set(id, (map.get(id) || 0) + qty);
    }
    if (rows.length < 200) break;
  }
  return map;
}

/** Mini App: shu bot orqali berilgan buyurtmalardan (bekor qilinganlari hisobga olinmaydi) */
async function fetchFromApp(days: number): Promise<Map<string, number>> {
  const since = new Date(Date.now() - days * 86400000);
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: since }, stateKey: { not: "canceled" } },
    select: { items: true },
    take: 20000,
  });
  const map = new Map<string, number>();
  for (const o of orders) {
    const items = Array.isArray(o.items) ? (o.items as { bitoId?: string; qty?: number }[]) : [];
    for (const it of items) {
      if (!it.bitoId) continue;
      map.set(it.bitoId, (map.get(it.bitoId) || 0) + Number(it.qty || 0));
    }
  }
  return map;
}

/** Keshlangan "haftalik sotuv" jadvali (sozlamadagi manba va kunlar bo'yicha) */
export async function weeklySales(): Promise<Map<string, number>> {
  const c = getSettings().catalog;
  if (!c.weeklySalesEnabled) return new Map();
  const days = Math.max(1, Math.min(90, Number(c.weeklySalesDays || 7)));
  const source = c.weeklySalesSource === "app" ? "app" : "bito";
  const ttl = Math.max(1, Number(c.weeklySalesRefreshMin || 30)) * 60000;
  if (cache && cache.days === days && cache.source === source && Date.now() - cache.at < ttl) return cache.map;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const map = source === "app" ? await fetchFromApp(days) : await fetchFromBito(days);
      cache = { at: Date.now(), days, source, map };
      return map;
    } catch (e) {
      log.warn("Haftalik sotuv o'qilmadi:", errMsg(e));
      // Xato bo'lsa eski keshni (bo'lsa) saqlab qolamiz, aks holda bo'sh
      if (cache) { cache = { ...cache, at: Date.now() - ttl / 2 }; return cache.map; }
      cache = { at: Date.now(), days, source, map: new Map() };
      return cache.map;
    } finally { inflight = null; }
  })();
  return inflight;
}

export function invalidateWeeklySales() { cache = null; }

/** Bir nechta mahsulot uchun: productId → sotilgan miqdor (variantlar otasiga yig'iladi) */
export async function weeklySalesFor(products: { id: number; bitoId: string }[], childrenByParent?: Map<string, { bitoId: string }[]>): Promise<Map<number, number>> {
  const map = await weeklySales();
  const out = new Map<number, number>();
  if (!map.size) return out;
  for (const p of products) {
    let qty = map.get(p.bitoId) || 0;
    for (const kid of childrenByParent?.get(p.bitoId) || []) qty += map.get(kid.bitoId) || 0;
    if (qty > 0) out.set(p.id, qty);
  }
  return out;
}

/** "X ta insonning savatida" — oxirgi N soat ichida yangilangan savatchalar bo'yicha */
export async function inCartCounts(productIds: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  const c = getSettings().catalog;
  if (!c.inCartCountEnabled || !productIds.length) return out;
  const hours = Math.max(1, Math.min(168, Number(c.inCartCountHours || 24)));
  const since = new Date(Date.now() - hours * 3600000);
  const rows = await prisma.cartItem.groupBy({
    by: ["productId"],
    where: { productId: { in: productIds }, updatedAt: { gte: since }, qty: { gt: 0 } },
    _count: { userId: true },
  });
  for (const r of rows) out.set(r.productId, r._count.userId);
  return out;
}
