/**
 * Admin panel menyu tuzilmasi (panelsturktura bo'yicha):
 * 1.1 Dashboard → 1.1.1 Kutilayotgan mahsulotlar
 * 2. Kontent: Storis, Banner, Post, Katalog boshqaruvi
 * 3. Integratsiya: Bito, Bot, Guruh
 * 4. Sozlamalar: Umumiy, Mini App (Dizayn, Katalog, Savatcha, Buyurtma, Profil), Bot (Bot matnlari, Buyurtma holatlari), Admin panel
 * 5.1 Jurnal
 */
import type { SectionDef } from "./api.ts";
import { allLangs, type TKey } from "./i18n.ts";

export interface NavItem { key: string; label: TKey; icon: string; to?: string; children?: NavItem[]; keywords?: string[] }
export interface NavSection { key: string; title?: TKey; items: NavItem[] }

export const NAV: NavSection[] = [
  { key: "top", items: [
    { key: "dashboard", label: "dashboard", icon: "layout-dashboard", to: "/", keywords: ["analitika", "hisobot", "statistika", "DAU", "MAU", "retention", "funnel", "konversiya", "sessiya", "buyurtmalar", "foydalanuvchilar", "qidiruv analitikasi", "platforma", "аналитика", "analytics"] },
  ] },
  { key: "content", title: "content", items: [
    { key: "stories", label: "stories", icon: "images", to: "/stories", keywords: ["slayd", "video", "hikoya", "сторис"] },
    { key: "banners", label: "banners", icon: "gallery-horizontal", to: "/banners", keywords: ["reklama", "aylanma", "баннер"] },
    { key: "broadcast", label: "broadcast", icon: "send", to: "/broadcast", keywords: ["xabar tarqatish", "rassilka", "рассылка", "aksiya", "yangilik", "broadcast"] },
  ] },
  { key: "control", title: "control", items: [
    { key: "catalog", label: "catalog", icon: "package", to: "/catalog", keywords: ["mahsulot", "kategoriya", "yashirish", "tavsiya", "chegirma", "tartib", "товары", "products", "nazorat"] },
    { key: "waitlist", label: "waitlist", icon: "bell", to: "/waitlist", keywords: ["kelganda eslating", "kutilmoqda", "ожидаемые", "istaklarim", "like", "yurakcha", "favourites", "избранное"] },
  ] },
  { key: "integration", title: "integration", items: [
    { key: "bito", label: "bito", icon: "plug", to: "/integration/bito", keywords: ["API kalit", "sinxronlash", "webhook", "tashkilot", "ombor", "narx", "ulanish", "интеграция"] },
    { key: "bot", label: "bot", icon: "bot", to: "/integration/bot", keywords: ["token", "BotFather", "ngrok", "ommaviy manzil", "public url", "Mini App manzili", "телеграм бот"] },
    { key: "groups", label: "groups", icon: "users", to: "/groups", keywords: ["guruh", "xodimlar", "staff", "buyurtmalar guruhi", "группы", "сотрудники"] },
  ] },
  { key: "settings", title: "settings", items: [
    { key: "general", label: "general", icon: "settings", to: "/settings/general", keywords: ["do'kon nomi", "tillar", "valyuta", "parol", "aloqa"] },
    { key: "miniapp", label: "miniapp", icon: "smartphone", children: [
      { key: "design", label: "design", icon: "palette", to: "/settings/design", keywords: ["rang", "logo", "splash", "animatsiya", "tungi rejim", "дизайн"] },
      { key: "catalogSettings", label: "catalogSettings", icon: "layout-grid", to: "/settings/catalog", keywords: ["qoldiq", "qidiruv", "ustunlar", "quti", "каталог"] },
      { key: "cart", label: "cart", icon: "shopping-cart", to: "/settings/checkout/cart", keywords: ["savatcha", "savat", "tozalash", "корзина"] },
      { key: "order", label: "order", icon: "clipboard-list", to: "/settings/checkout/order", keywords: ["yetkazib berish", "olib ketish", "xarita", "manzil", "rasmiylashtirish", "checkout", "заказ", "доставка"] },
      { key: "profile", label: "profile", icon: "user", to: "/settings/profile", keywords: ["balans", "karta", "xaridlar", "профиль"] },
    ] },
    { key: "botSettings", label: "bot", icon: "bot", children: [
      { key: "botTexts", label: "botTexts", icon: "message-square", to: "/settings/bot", keywords: ["ro'yxatdan o'tish", "menyu tugmalari", "chek", "to'lov", "salomlashish", "тексты бота"] },
      { key: "statuses", label: "statuses", icon: "list-checks", to: "/settings/statuses", keywords: ["holat", "status", "bekor", "qabul", "yetkazildi", "статусы"] },
    ] },
    { key: "adminPanel", label: "adminPanel", icon: "monitor", to: "/settings/adminPanel", keywords: ["brending", "logo", "rang", "tungi rejim", "ko'rinish", "админ-панель"] },
  ] },
  { key: "bottom", items: [
    { key: "activity", label: "activity", icon: "scroll-text", to: "/activity", keywords: ["jurnal", "log", "faoliyat", "xato", "журнал"] },
  ] },
];

/** Sozlama bo'limi (+ qismi) qaysi sahifada ko'rsatiladi */
export function settingsRoute(section: string, part?: string): string {
  if (section === "bito") return "/integration/bito";
  if (section === "general" && part === "bot") return "/integration/bot";
  if (section === "checkout") return `/settings/checkout/${part || "order"}`;
  return `/settings/${section}`;
}

export interface SearchEntry { id: string; title: string; path: string[]; to: string; kind: "menu" | "field"; text: string }

/** Qidiruv indeksi: menyular (barcha tillarda) + sozlama maydonlari (bo'lim → guruh → maydon) */
export function buildSearchIndex(schema: SectionDef[] | undefined, t: (k: TKey | string, fb?: string) => string): SearchEntry[] {
  const out: SearchEntry[] = [];
  const routePath = new Map<string, string[]>(); // marshrut → menyu yo'li (masalan: Sozlamalar › Mini App › Savatcha)
  const walk = (items: NavItem[], path: string[]) => {
    for (const it of items) {
      const title = t(it.label);
      if (it.to) {
        routePath.set(it.to, [...path, title]);
        out.push({ id: "nav:" + it.key, title, path, to: it.to, kind: "menu", text: [...allLangs(it.label), ...(it.keywords || []), ...path].join(" ").toLowerCase() });
      }
      if (it.children) walk(it.children, [...path, title]);
    }
  };
  for (const s of NAV) walk(s.items, s.title ? [t(s.title)] : []);
  for (const sec of schema || []) {
    const secTitle = t(`sec.${sec.key}`, sec.title);
    for (const g of sec.groups) {
      const to = settingsRoute(sec.key, g.part);
      const path = routePath.get(to) || [t("settings"), secTitle];
      out.push({ id: `group:${sec.key}:${g.title}`, title: g.title, path, to: `${to}?focus=${encodeURIComponent("group:" + g.title)}`, kind: "field", text: [g.title, g.description || "", ...path, sec.title].join(" ").toLowerCase() });
      for (const f of g.fields) {
        out.push({ id: `field:${sec.key}:${f.key}`, title: f.label, path: [...path, g.title], to: `${to}?focus=${encodeURIComponent(f.key)}`, kind: "field", text: [f.label, f.help || "", g.title, ...path, sec.title, f.key].join(" ").toLowerCase() });
      }
    }
  }
  return out;
}

/** Oddiy qidiruv: har bir so'z matnda uchrashi kerak; sarlavhada boshlanishi ustun */
export function searchEntries(index: SearchEntry[], query: string, limit = 30): SearchEntry[] {
  const q = query.trim().toLowerCase().replace(/[’ʻ`]/g, "'");
  if (!q) return [];
  const words = q.split(/\s+/).filter(Boolean);
  const scored: { e: SearchEntry; s: number }[] = [];
  for (const e of index) {
    const text = e.text.replace(/[’ʻ`]/g, "'");
    const title = e.title.toLowerCase().replace(/[’ʻ`]/g, "'");
    if (!words.every((w) => text.includes(w))) continue;
    let s = e.kind === "menu" ? 20 : 0;
    if (title.startsWith(q)) s += 50; else if (title.includes(q)) s += 30;
    if (words.every((w) => title.includes(w))) s += 10;
    scored.push({ e, s });
  }
  return scored.sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.e);
}
