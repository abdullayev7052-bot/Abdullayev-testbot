import { prisma } from "../db.ts";
import { log } from "../logger.ts";

/** Mini App / botdan keladigan hodisa nomlari (faqat shular qabul qilinadi) */
export const EVENT_NAMES = [
  "app_open",        // Mini App ochildi
  "product_view",    // mahsulot kartochkasi ochildi  {productId, name}
  "category_view",   // kategoriya tanlandi           {categoryId}
  "search",          // qidiruv                       {q, results}
  "add_to_cart",     // savatchaga qo'shildi          {productId, qty}
  "checkout_start",  // rasmiylashtirish boshlandi    {items, total}
  "order_created",   // buyurtma berildi (server)     {orderId, total, type, storeId}
  "waitlist_add",    // "kelganda eslating" (server)  {productId}
  "favorite_add",    // "istaklarim"ga qo'shildi (server) {productId}
  "favorites_open",  // "Istaklarim" bo'limi ochildi
  "profile_open",    // profil sahifasi
  "order_history",   // "Mening buyurtmalarim"
  "purchases",       // "Xaridlar"
  "card",            // "Karta"
  "story_view",      // storis ochildi                {storyId}
  "banner_click",    // banner bosildi                {bannerId}
  "bot_start",       // botga birinchi marta kirdi
  "bot_active",      // botda faollik (30 daqiqada bir marta yoziladi)
] as const;
export type EventName = (typeof EVENT_NAMES)[number];
const NAMES = new Set<string>(EVENT_NAMES);
export const isEventName = (s: unknown): s is EventName => typeof s === "string" && NAMES.has(s);

interface Pending { userId: number | null; name: string; platform: string | null; meta: object | null; createdAt: Date }
let buffer: Pending[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

/** Hodisani navbatga qo'yish — 2 soniyada bir marta bazaga jamlab yoziladi (so'rovni sekinlashtirmaydi) */
export function track(userId: number | null, name: EventName, meta?: Record<string, unknown> | null, platform?: string | null, at?: Date) {
  buffer.push({ userId, name, platform: normPlatform(platform), meta: meta ? (trim(meta) as object) : null, createdAt: at || new Date() });
  if (buffer.length >= 200) void flush();
  else if (!timer) timer = setTimeout(() => { void flush(); }, 2000);
}

export async function flush() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!buffer.length) return;
  const rows = buffer; buffer = [];
  try {
    await prisma.appEvent.createMany({ data: rows.map((r) => ({ userId: r.userId, name: r.name, platform: r.platform, meta: r.meta ?? undefined, createdAt: r.createdAt })) });
  } catch (e) { log.warn("analytics flush", e); }
}

/** Telegram platform nomini qisqartirish */
export function normPlatform(p?: string | null): string | null {
  if (!p) return null;
  const s = String(p).toLowerCase().slice(0, 20);
  if (s === "unknown" || s === "") return null;
  return s;
}

/** Meta ichidagi satrlarni cheklash (bazani shishirmaslik uchun) */
function trim(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta).slice(0, 12)) {
    if (typeof v === "string") out[k] = v.slice(0, 120);
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
  }
  return out;
}

// ---- Foydalanuvchi "oxirgi faollik" belgisi (10 daqiqada bir marta yangilanadi) ----
const touched = new Map<number, number>();
export function touchUser(userId: number) {
  const now = Date.now();
  const last = touched.get(userId) || 0;
  if (now - last < 10 * 60 * 1000) return;
  touched.set(userId, now);
  if (touched.size > 20000) touched.clear();
  prisma.user.update({ where: { id: userId }, data: { lastActiveAt: new Date(now) } }).catch(() => {});
}

// ---- Bot faolligi: har foydalanuvchi uchun 30 daqiqada bir marta ----
const botSeen = new Map<number, number>();
export function trackBotActivity(userId: number, isNew: boolean) {
  touchUser(userId);
  const now = Date.now();
  if (isNew) track(userId, "bot_start", null, "bot");
  const last = botSeen.get(userId) || 0;
  if (now - last < 30 * 60 * 1000) return;
  botSeen.set(userId, now);
  if (botSeen.size > 20000) botSeen.clear();
  track(userId, "bot_active", null, "bot");
}

/** 400 kundan eski hodisalarni tozalash (kuniga bir marta chaqiriladi) */
export async function pruneEvents(days = 400) {
  try {
    const r = await prisma.appEvent.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - days * 86400000) } } });
    if (r.count) log.info(`analytics: ${r.count} ta eski hodisa o'chirildi`);
  } catch (e) { log.warn("analytics prune", e); }
}
