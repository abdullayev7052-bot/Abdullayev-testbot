import { tg } from "./telegram.ts";

export type ThemeMode = "off" | "on" | "auto" | "user";
const KEY = "theme-pref";

export function userPref(): "light" | "dark" | null {
  const v = localStorage.getItem(KEY);
  return v === "dark" || v === "light" ? v : null;
}
export function setUserPref(v: "light" | "dark") { localStorage.setItem(KEY, v); }

export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "on") return "dark";
  if (mode === "off") return "light";
  if (mode === "user") {
    const p = userPref();
    if (p) return p;
  }
  const tgScheme = tg?.colorScheme;
  if (tgScheme) return tgScheme === "dark" ? "dark" : "light";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: "light" | "dark", colors: { bg?: string; card?: string; text?: string }) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  const r = root.style;
  if (theme === "dark") {
    if (colors.bg) r.setProperty("--dark-bg", colors.bg);
    if (colors.card) r.setProperty("--dark-card", colors.card);
    if (colors.text) r.setProperty("--dark-text", colors.text);
  }
  const bg = theme === "dark" ? colors.bg || "#0f172a" : (getComputedStyle(root).getPropertyValue("--bg").trim() || "#ffffff");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg);
  try { tg?.setHeaderColor(bg); tg?.setBackgroundColor(bg); } catch { /* eski versiya */ }
}
