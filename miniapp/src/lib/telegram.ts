/* Telegram WebApp SDK uchun yupqa qatlam. Brauzerda (Telegram'siz) ham ishlaydi. */

interface TgWebApp {
  initData: string;
  initDataUnsafe: { user?: { id: number; first_name?: string; last_name?: string; username?: string; language_code?: string }; start_param?: string };
  ready(): void;
  expand(): void;
  close(): void;
  isExpanded: boolean;
  colorScheme: "light" | "dark";
  themeParams: Record<string, string>;
  setHeaderColor(c: string): void;
  setBackgroundColor(c: string): void;
  enableClosingConfirmation(): void;
  disableClosingConfirmation(): void;
  disableVerticalSwipes?(): void;
  requestFullscreen?(): void;
  HapticFeedback?: {
    impactOccurred(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void;
    notificationOccurred(type: "error" | "success" | "warning"): void;
    selectionChanged(): void;
  };
  openLink(url: string, opts?: { try_instant_view?: boolean }): void;
  openTelegramLink(url: string): void;
  BackButton: { show(): void; hide(): void; onClick(fn: () => void): void; offClick(fn: () => void): void; isVisible: boolean };
  version: string;
  platform: string;
  safeAreaInset?: { top: number; bottom: number };
  onEvent?(event: string, cb: () => void): void;
  offEvent?(event: string, cb: () => void): void;
  contentSafeAreaInset?: { top: number; bottom: number };
}

declare global {
  interface Window { Telegram?: { WebApp?: TgWebApp } }
}

export const tg: TgWebApp | undefined = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
export const inTelegram = !!(tg && tg.initData);

export function initTelegram() {
  if (!tg) return;
  try {
    tg.ready();
    tg.expand();
    tg.disableVerticalSwipes?.();
  } catch { /* eski versiyalar */ }
}

let hapticOn = true;
export function setHapticEnabled(v: boolean) { hapticOn = v; }
const h = () => (hapticOn ? tg?.HapticFeedback : undefined);
export const haptic = {
  light: () => h()?.impactOccurred("light"),
  medium: () => h()?.impactOccurred("medium"),
  success: () => h()?.notificationOccurred("success"),
  error: () => h()?.notificationOccurred("error"),
  select: () => h()?.selectionChanged(),
};

export function closeApp() {
  if (tg && inTelegram) tg.close();
}

/** Telegram ulashish oynasi (kanal/chat tanlash) */
export function shareViaTelegram(url: string, text: string) {
  const link = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  if (tg && inTelegram) tg.openTelegramLink(link);
  else window.open(link, "_blank");
}

/** Havolani nusxalash (Telegram ichida ham ishlaydi) */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* pastdagi zaxira usul */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

export function openLink(url: string) {
  if (!url) return;
  if (/^https?:\/\/t\.me\//.test(url) && tg) tg.openTelegramLink(url);
  else if (tg && inTelegram) tg.openLink(url);
  else window.open(url, "_blank");
}

/** Brauzer testi uchun: ?dev_user=<telegram_id> */
export function devUserId(): string | null {
  const p = new URLSearchParams(window.location.search);
  const v = p.get("dev_user");
  if (v) { localStorage.setItem("dev_user", v); return v; }
  return localStorage.getItem("dev_user");
}

/** Banner/storis/xabar havolasi: product:ID | category:ID | /yo'l | https://... */
export function resolveTarget(target: string): { path?: string; url?: string } {
  const s = (target || "").trim();
  if (!s) return {};
  if (s.startsWith("share:")) return { path: `/cart?share=${encodeURIComponent(s.slice(6))}` };
  if (s.startsWith("product:")) return { path: `/catalog?product=${encodeURIComponent(s.slice(8))}` };
  if (s.startsWith("category:")) return { path: `/catalog?category=${encodeURIComponent(s.slice(9))}` };
  if (s.startsWith("/")) return { path: s };
  return { url: s };
}
