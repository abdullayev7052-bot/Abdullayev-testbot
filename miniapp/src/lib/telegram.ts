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
    tg.setHeaderColor("#ffffff");
    tg.setBackgroundColor("#ffffff");
    tg.disableVerticalSwipes?.();
  } catch { /* eski versiyalar */ }
}

export const haptic = {
  light: () => tg?.HapticFeedback?.impactOccurred("light"),
  medium: () => tg?.HapticFeedback?.impactOccurred("medium"),
  success: () => tg?.HapticFeedback?.notificationOccurred("success"),
  error: () => tg?.HapticFeedback?.notificationOccurred("error"),
  select: () => tg?.HapticFeedback?.selectionChanged(),
};

export function closeApp() {
  if (tg && inTelegram) tg.close();
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
