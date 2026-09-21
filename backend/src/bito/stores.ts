import type { Product, User } from "@prisma/client";
import { getSettings, lt, type StoreDef } from "../settings/store.ts";
import type { Lang } from "../settings/schema.ts";

export interface StoreContext {
  id: string;
  name: (lang: Lang) => string;
  organizationId: string;
  warehouseId: string;
  priceId: string;
  currencyId: string;
  responsibleId: string;
  stockSource: "warehouse" | "organization";
  pickupAddress: (lang: Lang) => string;
  pickupLocation: { lat: number; lng: number } | null;
}

/** Yoqilgan do'konlar ro'yxati (birinchisi — asosiy) */
export function listStores(): StoreContext[] {
  const s = getSettings();
  const b = s.bito;
  const c = s.checkout as Record<string, unknown>;
  const main: StoreContext = {
    id: "main",
    name: (lang) => lt(b.mainStoreName, lang),
    organizationId: b.organizationId, warehouseId: b.warehouseId, priceId: b.priceId, currencyId: b.currencyId, responsibleId: b.responsibleId,
    stockSource: b.stockSource || "warehouse",
    pickupAddress: (lang) => lt(c.pickupAddress as never, lang),
    pickupLocation: (c.pickupLocation as { lat: number; lng: number }) || null,
  };
  if (!b.multiStore) return [main];
  const extra = (Array.isArray(b.stores) ? b.stores : []).filter((st: StoreDef) => st && st.enabled !== false && st.organizationId).map((st: StoreDef): StoreContext => ({
    id: st.id,
    name: (lang) => lt(st.name, lang) || st.id,
    organizationId: st.organizationId, warehouseId: st.warehouseId || "", priceId: st.priceId || b.priceId, currencyId: st.currencyId || b.currencyId,
    responsibleId: st.responsibleId || b.responsibleId, stockSource: st.stockSource || "warehouse",
    pickupAddress: (lang) => lt(st.pickupAddress, lang) || lt(c.pickupAddress as never, lang),
    pickupLocation: st.pickupLocation || null,
  }));
  return [main, ...extra];
}

export function isMultiStore(): boolean {
  return !!getSettings().bito.multiStore && listStores().length > 1;
}

export function getStore(id: string | null | undefined): StoreContext {
  const all = listStores();
  return all.find((s) => s.id === id) || all[0];
}

export function userStore(user: { storeId?: string | null }): StoreContext {
  return getStore(user.storeId);
}

/** Mijoz uchun istisno narx turi (agar yoqilgan va ro'yxatda bo'lsa) */
export function exceptionPriceId(user: { bitoCustomerId?: string | null }): string | null {
  const b = getSettings().bito;
  if (!b.priceExceptionsEnabled || !user.bitoCustomerId) return null;
  for (const ex of b.priceExceptions || []) if (ex.priceId && (ex.customerIds || []).includes(user.bitoCustomerId)) return ex.priceId;
  return null;
}

/** Barcha kerakli narx ro'yxatlari (sinxronizatsiya uchun) */
export function allPriceIds(): string[] {
  const b = getSettings().bito;
  const ids = new Set<string>();
  for (const s of listStores()) if (s.priceId) ids.add(s.priceId);
  if (b.priceExceptionsEnabled) for (const ex of b.priceExceptions || []) if (ex.priceId) ids.add(ex.priceId);
  return [...ids];
}

/** Yaxlitlash: step (100/500/1000/...), mode nearest|up|down */
export function roundPrice(v: number, step: number, mode: string): number {
  if (!step || step <= 0) return Math.round(v);
  const q = v / step;
  const n = mode === "up" ? Math.ceil(q - 1e-9) : mode === "down" ? Math.floor(q + 1e-9) : Math.round(q);
  return n * step;
}

export interface Priced { price: number; basePrice: number; discountPercent: number; stock: number; available: boolean }

/** Mahsulotning mijoz uchun yakuniy narxi va qoldig'i (do'kon, istisno narx, chegirma, yaxlitlash) */
export function priceFor(p: Product, user: Pick<User, "storeId" | "bitoCustomerId">): Priced {
  const store = userStore(user);
  const currencyIsUzs = storeIsUzs(store.id);
  const stores = (p.stores as Record<string, { price?: number; stock?: number; available?: boolean }>) || {};
  const st = stores[store.id] || (store.id === "main" ? { price: p.price, stock: p.stock, available: p.isAvailableForSale } : undefined);
  const prices = (p.prices as Record<string, number>) || {};
  const exId = exceptionPriceId(user);
  let base = exId && prices[exId] !== undefined ? Number(prices[exId]) : Number(st?.price ?? p.price ?? 0);
  base = Number.isFinite(base) ? base : 0;
  let price = base;
  const d = Number(p.discountPercent || 0);
  if (d > 0) {
    price = base * (1 - d / 100);
    price = currencyIsUzs && p.roundStep > 0 ? roundPrice(price, p.roundStep, p.roundMode) : Math.round(price * 100) / 100;
  }
  return { price, basePrice: base, discountPercent: d, stock: Number(st?.stock ?? 0), available: st ? st.available !== false : store.id === "main" };
}

let currencyCodes = new Map<string, string>();
export function setCurrencyCodes(m: Map<string, string>) { currencyCodes = m; }
/** Do'kon valyutasi so'mmi (yaxlitlash faqat so'mda) */
export function storeIsUzs(storeId: string | null | undefined): boolean {
  const st = getStore(storeId);
  const code = (currencyCodes.get(st.currencyId) || "uzs").toLowerCase();
  return /uzs|so'?m|сум|sum/.test(code);
}
