import type { Lang } from "./api.ts";

export function money(n: number, suffix: string, decimals = 0): string {
  const v = Number(n || 0);
  const fixed = Math.abs(v).toFixed(decimals);
  const [int, frac] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${v < 0 ? "-" : ""}${grouped}${frac ? "." + frac : ""}${suffix ? " " + suffix : ""}`;
}

export function qty(n: number): string {
  const v = Number(n || 0);
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2).replace(/\.?0+$/, "");
}

export function fmtDate(d: string | Date, withTime = true): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  const p = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tashkent" }).formatToParts(date);
  const g = (t: string) => p.find((x) => x.type === t)?.value || "";
  return `${g("day")}.${g("month")}.${g("year")}${withTime ? ` ${g("hour")}:${g("minute")}` : ""}`;
}

/** Qoldiq yozuvi (sozlamaga qarab) */
export function stockLabel(stock: number, opts: { mode: string; steps: number[]; inStock: string; outOfStock: string; measure?: string | null }): { text: string; out: boolean } | null {
  const out = stock <= 0;
  if (out) return { text: opts.outOfStock, out: true };
  if (opts.mode === "hidden") return null;
  if (opts.mode === "available") return { text: opts.inStock, out: false };
  if (opts.mode === "range") {
    const steps = [...opts.steps].sort((a, b) => b - a);
    for (const s of steps) if (stock >= s) return { text: `${s}+`, out: false };
    return { text: qty(stock), out: false };
  }
  return { text: `${qty(stock)} ${opts.measure || ""}`.trim(), out: false };
}

export const LANG_NAMES: Record<Lang, string> = { uz: "O'zbek", ru: "Русский", en: "English" };
