import { getSettings } from "../settings/store.ts";
import { log } from "../logger.ts";
import type {
  BitoBalance, BitoCategory, BitoCurrency, BitoCustomField, BitoCustomer, BitoEmployee, BitoEnvelope, BitoOrganization, BitoPaging,
  BitoPrice, BitoPriceItem, BitoProduct, BitoSaleOrder, BitoSaleOrderCreate, BitoState, BitoTrade, BitoTransaction, BitoWarehouse,
} from "./types.ts";

export class BitoError extends Error {
  constructor(message: string, public code?: number, public status?: number, public data?: unknown) {
    super(message);
    this.name = "BitoError";
  }
}

type Cfg = { apiKey?: string; apiUrl?: string };

function cfg(over?: Cfg) {
  const s = getSettings().bito;
  return {
    apiKey: over?.apiKey ?? s.apiKey,
    apiUrl: (over?.apiUrl ?? s.apiUrl ?? "").replace(/\/+$/, ""),
  };
}

async function call<T>(method: "GET" | "POST" | "PUT" | "DELETE", path: string, body?: unknown, over?: Cfg): Promise<T> {
  const c = cfg(over);
  if (!c.apiKey) throw new BitoError("Bito API kaliti kiritilmagan (Admin panel → Bito integratsiyasi)");
  const url = c.apiUrl + "/" + path.replace(/^\/+/, "");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: { "api-key": c.apiKey, "Content-Type": "application/json", "Accept-Language": "uz" },
      body: body !== undefined && method !== "GET" ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    throw new BitoError(`Bito bilan aloqa yo'q: ${(e as Error).message}`);
  }
  clearTimeout(timer);
  const text = await res.text();
  let json: BitoEnvelope<T> | null = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  if (!json) throw new BitoError(`Bito noto'g'ri javob (${res.status}) ${path}`, undefined, res.status, text.slice(0, 200));
  if (json.code !== 0 || !res.ok) {
    const msg = json.messages?.uz || json.message || `Bito xatosi (${res.status})`;
    throw new BitoError(msg, json.code, res.status, json.data);
  }
  return json.data;
}

/** Barcha sahifalarni ketma-ket o'qish (get-paging) */
async function allPages<T>(path: string, body: Record<string, unknown>, limit = 200, max = 100000): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= 500; page++) {
    const r = await call<BitoPaging<T> | { list?: T[]; total?: number } | T[]>("POST", path, { ...body, page, limit });
    let items: T[] = [];
    if (Array.isArray(r)) items = r;
    else if ("data" in r && Array.isArray(r.data)) items = r.data;
    else if ("list" in r && Array.isArray(r.list)) items = r.list!;
    out.push(...items);
    if (items.length < limit || out.length >= max) break;
  }
  return out;
}

export const bito = {
  call,
  allPages,

  // --- Ma'lumotnomalar ---
  profile: (over?: Cfg) => call<BitoEmployee & { username?: string; company_name?: string }>("GET", "profile/getMe", undefined, over),
  organizations: (over?: Cfg) => call<BitoOrganization[]>("GET", "organization/get-all", undefined, over),
  warehouses: (over?: Cfg) => call<BitoWarehouse[]>("POST", "warehouse/get-all", {}, over),
  prices: (over?: Cfg) => call<BitoPrice[]>("GET", "price/get-all", undefined, over),
  currencies: (over?: Cfg) => call<BitoCurrency[]>("GET", "currency/get-all", undefined, over),
  employees: (over?: Cfg) => allPages<BitoEmployee>("employee/get-paging", {}, 200).catch(() => [] as BitoEmployee[]),
  states: (type: "saleOrders" | "trades", organizationId?: string, over?: Cfg) =>
    call<BitoState[]>("POST", "states/get-all", organizationId ? { type, organization_id: organizationId } : { type }, over),
  customFields: () => call<BitoCustomField[]>("GET", "custom-field/get-all").catch(() => [] as BitoCustomField[]),

  // --- Mijozlar ---
  customerByPhone: async (phone: string): Promise<BitoCustomer | null> => {
    try {
      const r = await call<BitoCustomer | null>("GET", `customer/get-by-phone-number?phone_number=${encodeURIComponent(phone)}`);
      return r && r._id ? r : null;
    } catch (e) {
      if (e instanceof BitoError && (e.status === 400 || e.status === 404)) return null;
      throw e;
    }
  },
  customerById: (id: string) => call<BitoCustomer>("GET", `customer/get-by-id/${id}`),
  customerCreate: (data: Record<string, unknown>) => call<BitoCustomer>("POST", "customer/create", data),
  customerUpdate: (data: Record<string, unknown> & { _id: string }) => call<BitoCustomer>("PUT", "customer/update", data),
  balance: (customerId: string, currencyId: string) =>
    call<BitoBalance>("GET", `balance/get-by-customer?customer_id=${customerId}&currency_id=${currencyId}`),

  // --- Mahsulotlar ---
  products: (body: Record<string, unknown>) => allPages<BitoProduct>("product/get-paging", body, 200),
  productsPage: (body: Record<string, unknown>) => call<BitoPaging<BitoProduct>>("POST", "product/get-paging", body),
  productById: (id: string) => call<BitoProduct>("GET", `product/get-by-id/${id}`),
  priceItems: (priceId: string, organizationId?: string) =>
    allPages<BitoPriceItem>("price/items/get-paging", organizationId ? { price_id: priceId, organization_id: organizationId } : { price_id: priceId }, 200),
  categories: () => allPages<BitoCategory>("category/get-paging", {}, 200),
  deletedProducts: (since: string) => call<string[]>("GET", `product/get-deleted?deleted_at=${encodeURIComponent(since)}`).catch(() => [] as string[]),

  // --- Buyurtmalar ---
  orderCreate: (data: BitoSaleOrderCreate) => call<BitoSaleOrder>("POST", "sale-order/create", data),
  orderById: (id: string) => call<BitoSaleOrder>("GET", `sale-order/get-by-id/${id}`),
  orderByIdForBot: (id: string) => call<BitoSaleOrder>("GET", `sale-order/get-by-id/for-bot/${id}`),
  ordersByCustomer: (customerId: string, page = 1, limit = 20) =>
    call<{ list: BitoSaleOrder[]; total: number }>("POST", "sale-order/get-by-customer/for-bot", { customer_id: customerId, page, limit }),
  orderSetState: (ids: string[], stateId: string) => call<unknown>("POST", "sale-order/update-status-many", { ids, state_id: stateId }),
  ordersPage: (body: Record<string, unknown>) => call<BitoPaging<BitoSaleOrder>>("POST", "sale-order/get-paging", body),

  // --- Savdo va to'lovlar ---
  tradesPage: (body: Record<string, unknown>) => call<BitoPaging<BitoTrade>>("POST", "trade/get-paging", body),
  tradeForBot: (id: string) => call<BitoTrade>("GET", `trade/get-by-id/for-bot/${id}`),
  transactionsPage: (body: Record<string, unknown>) => call<BitoPaging<BitoTransaction>>("POST", "transaction/get-paging", body),
  transactionById: (id: string) => call<BitoTransaction>("GET", `transaction/get-by-id/${id}`),

  // --- Akt sverka ---
  reconActExport: (body: Record<string, unknown>) => call<string>("POST", "recon-act/get-all/export", { page: 1, limit: 1000, ext_type: "xlsx", locale: "uz", ...body }),

  // --- Webhook ---
  webhookSubscribe: (destination: string, events: string[]) =>
    call<{ destination: string; events: string[]; secret: string }>("POST", "webhook/subscribe", { destination, events }),
  webhookUnsubscribe: async (destination: string) => {
    // Bito bu so'rovda _id (akkaunt id) ni ham talab qiladi
    let id = "000000000000000000000000";
    try { const me = await call<{ _id: string }>("GET", "profile/getMe"); if (me?._id) id = me._id; } catch { /* ignore */ }
    return call<unknown>("POST", "webhook/unsubscribe", { _id: id, destination });
  },
  webhookGetAll: () => call<{ secret: string | null; destinations: { destination: string; events: string[] }[] }>("POST", "webhook/get-all", {}),

  /** Bito'dagi rasm yo'lini to'liq URL ga aylantirish */
  fileUrl(path: string | null | undefined): string | null {
    if (!path) return null;
    if (/^https?:\/\//.test(path)) return path;
    const base = getSettings().bito.filesUrl.replace(/\/+$/, "");
    return base + (path.startsWith("/") ? path : "/uploads/" + path);
  },

  /** Bito veb-ilovasidagi buyurtma sahifasi */
  webOrderUrl(orderId: string): string {
    const s = getSettings().bito;
    let base = (s.webBaseUrl || "").replace(/\/+$/, "");
    if (!base) {
      const login = (s.apiKey || "").split(":")[0];
      base = login ? `https://${login}.bito.uz` : "https://app.bito.uz";
    }
    return `${base}/customer/orders/info/${orderId}`;
  },
};

export async function testConnection(over?: Cfg): Promise<{ ok: boolean; message: string; profile?: { name: string; company: string; username: string } }> {
  try {
    const p = await bito.profile(over);
    return { ok: true, message: "Ulanish muvaffaqiyatli", profile: { name: p.full_name, company: p.company_name || "", username: p.username || "" } };
  } catch (e) {
    log.warn("Bito ulanish xatosi:", (e as Error).message);
    return { ok: false, message: (e as Error).message };
  }
}
