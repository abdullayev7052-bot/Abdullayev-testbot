import { create } from "zustand";

export type UiLang = "uz" | "ru" | "en";
const KEY = "admin-lang";

const D = {
  dashboard: { uz: "Boshqaruv paneli", ru: "Панель управления", en: "Dashboard" },
  settings: { uz: "Sozlamalar", ru: "Настройки", en: "Settings" },
  content: { uz: "Kontent", ru: "Контент", en: "Content" },
  bot: { uz: "Bot", ru: "Бот", en: "Bot" },
  stories: { uz: "Storis", ru: "Сторис", en: "Stories" },
  banners: { uz: "Bannerlar", ru: "Баннеры", en: "Banners" },
  catalog: { uz: "Katalog boshqaruvi", ru: "Управление каталогом", en: "Catalog management" },
  waitlist: { uz: "Kutilayotgan mahsulotlar", ru: "Ожидаемые товары", en: "Waitlist" },
  groups: { uz: "Guruhlar va xodimlar", ru: "Группы и сотрудники", en: "Groups & staff" },
  broadcast: { uz: "Xabar tarqatish", ru: "Рассылка", en: "Broadcast" },
  activity: { uz: "Jurnal", ru: "Журнал", en: "Activity log" },
  light: { uz: "Yorug' rejim", ru: "Светлая тема", en: "Light mode" },
  dark: { uz: "Tungi rejim", ru: "Тёмная тема", en: "Dark mode" },
  logout: { uz: "Chiqish", ru: "Выйти", en: "Log out" },
  login: { uz: "Kirish", ru: "Войти", en: "Sign in" },
  password: { uz: "Parol", ru: "Пароль", en: "Password" },
  language: { uz: "Til", ru: "Язык", en: "Language" },
  save: { uz: "Saqlash", ru: "Сохранить", en: "Save" },
  refresh: { uz: "Yangilash", ru: "Обновить", en: "Refresh" },
  // Sozlamalar bo'limlari (backend schema kalitlari bo'yicha)
  "sec.general": { uz: "Umumiy", ru: "Общие", en: "General" },
  "sec.adminPanel": { uz: "Admin panel ko'rinishi", ru: "Вид админ-панели", en: "Admin panel look" },
  "sec.bito": { uz: "Bito integratsiyasi", ru: "Интеграция Bito", en: "Bito integration" },
  "sec.statuses": { uz: "Buyurtma holatlari", ru: "Статусы заказов", en: "Order statuses" },
  "sec.bot": { uz: "Bot matnlari", ru: "Тексты бота", en: "Bot texts" },
  "sec.design": { uz: "Mini App dizayni", ru: "Дизайн Mini App", en: "Mini App design" },
  "sec.catalog": { uz: "Katalog", ru: "Каталог", en: "Catalog" },
  "sec.checkout": { uz: "Savatcha va buyurtma", ru: "Корзина и заказ", en: "Cart & checkout" },
  "sec.profile": { uz: "Profil", ru: "Профиль", en: "Profile" },
} as const;
export type TKey = keyof typeof D;

interface LangState { lang: UiLang; setLang: (l: UiLang) => void }
export const useLang = create<LangState>((set) => ({
  lang: ((): UiLang => { try { const v = localStorage.getItem(KEY); return v === "ru" || v === "en" ? v : "uz"; } catch { return "uz"; } })(),
  setLang: (lang) => { try { localStorage.setItem(KEY, lang); } catch { /* ignore */ } set({ lang }); },
}));

/** Admin interfeysi matnlari (nav, tugmalar). Maydon nomlari hozircha o'zbekcha. */
export function useT() {
  const lang = useLang((s) => s.lang);
  return (k: TKey | string, fallback?: string) => (D as Record<string, Record<UiLang, string>>)[k]?.[lang] ?? fallback ?? k;
}
