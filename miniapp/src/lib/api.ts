import { tg, inTelegram, devUserId } from "./telegram.ts";

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}

const BASE = "/api/app";

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json", "ngrok-skip-browser-warning": "1", "X-Platform": tg?.platform || "web" };
  if (inTelegram && tg) h.Authorization = `tma ${tg.initData}`;
  else { const d = devUserId(); if (d) h["X-Dev-User"] = d; }
  return h;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(BASE + path, { method, headers: headers(), body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
  if (!r.ok) {
    const j = (json || {}) as { error?: string; code?: string };
    throw new ApiError(j.error || `Xatolik (${r.status})`, r.status, j.code);
  }
  return json as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
};

// ---- Types ----
export type Lang = "uz" | "ru" | "en";
export type LText = Record<Lang, string>;

export interface StoreInfo { id: string; name: string; pickupAddress: string; pickupLocation: { lat: number; lng: number } | null }
export interface Product {
  id: number; bitoId: string; name: string; image: string | null; images: (string | null)[]; price: number; basePrice?: number; discountPercent?: number; stock: number; boxItem: number;
  measure: string | null; measureDecimals: number; sku: string | null; categoryId: string | null; categoryName: string | null; note: string | null;
  customFields: { name: string; value: string }[]; featured: boolean; inWaitlist: boolean;
}
export interface Category { id: string; name: string; parentId: string | null; image: string | null; count: number }
export interface Story { id: number; title: string; cover: string; slides: { id: number; image: string; caption: string | null; link: string | null; duration: number; buttonText?: string | null }[] }
export interface Banner { id: number; image: string; title: string | null; subtitle: string | null; link: string | null; textColor: string }
export interface Bootstrap {
  user: { id: number; telegramId: string; name: string; phone: string | null; language: Lang; address: string | null; lat: number | null; lng: number | null; registered: boolean; linked: boolean; storeId?: string };
  stores: StoreInfo[];
  store: StoreInfo;
  settings: Record<string, Record<string, unknown>> & { filesUrl: string };
  stories: Story[]; banners: Banner[]; categories: Category[]; featured: Product[]; newest: Product[]; productCount: number;
}
export interface ProductPage { total: number; page: number; limit: number; hasMore: boolean; items: Product[] }
export interface OrderItem { productId: number; bitoId: string; name: string; price: number; qty: number; boxCount?: number; boxItem?: number; measure?: string | null; image?: string | null }
export interface OrderRow { id: number; number: string; date: string; total: number; type: string; stage: string; status: string; items: OrderItem[]; address: string | null; comment: string | null; phone: string | null; source: "bot" | "bito" }
export interface Purchase { id: string; number: string; date: string; total: number; debt: number; seller: string; isRefund: boolean; itemsCount: number }
export interface BalanceLine { organization: string; amount: number; currency: string }
