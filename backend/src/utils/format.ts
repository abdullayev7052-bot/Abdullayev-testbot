import type { Lang } from "../settings/schema.ts";
import { getSettings, lt } from "../settings/store.ts";

/** 1830000 -> "1 830 000 so'm" */
export function money(amount: number | null | undefined, lang: Lang, opts?: { suffix?: boolean; decimals?: number }): string {
  const s = getSettings();
  const n = Number(amount || 0);
  const decimals = opts?.decimals ?? s.general.priceDecimals ?? 0;
  const abs = Math.abs(n);
  const fixed = abs.toFixed(decimals);
  const [int, frac] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const body = frac ? `${grouped}.${frac}` : grouped;
  const sign = n < 0 ? "-" : "";
  const suffix = opts?.suffix === false ? "" : " " + lt(s.general.currencySuffix, lang);
  return `${sign}${body}${suffix}`;
}

/** Miqdor: 3 -> "3", 2.5 -> "2.5" */
export function qty(n: number | null | undefined, decimals = 0): string {
  const v = Number(n || 0);
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(Math.max(decimals, 2)).replace(/\.?0+$/, "");
}

export function fmtDate(d: string | Date | null | undefined, lang: Lang = "uz", withTime = true): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  void lang;
  const parts = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tashkent" }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  const dd = `${get("day")}.${get("month")}.${get("year")}`;
  return withTime ? `${dd} ${get("hour")}:${get("minute")}` : dd;
}

/** +998901234567 ko'rinishiga keltirish */
export function normalizePhone(raw: string): string {
  let d = (raw || "").replace(/[^\d]/g, "");
  if (d.length === 9) d = "998" + d;
  if (d.length === 12 && d.startsWith("998")) return "+" + d;
  if (d.length > 0) return "+" + d;
  return "";
}

export function prettyPhone(p: string | null | undefined): string {
  const n = normalizePhone(p || "");
  const m = n.match(/^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/);
  if (m) return `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
  return n || "—";
}

export function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
