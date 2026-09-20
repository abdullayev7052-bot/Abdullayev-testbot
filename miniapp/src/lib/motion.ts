import type { Transition, Variants } from "motion/react";
import { useApp } from "../store/app.ts";

type Design = Record<string, unknown>;

export function design(): Design {
  return (useApp.getState().data?.settings.design as Design) || cachedDesign();
}

const CACHE_KEY = "design-cache";
export function cacheDesign(d: Design) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(d)); } catch { /* ignore */ } }
export function cachedDesign(): Design { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); } catch { return {}; } }

export function animLevel(): "full" | "reduced" | "off" {
  const a = design().animations;
  return a === "reduced" || a === "off" ? a : "full";
}

/** Harakat xarakteri: spring parametrlari */
export function spring(kind: "page" | "card" | "sheet" | "tap" = "card"): Transition {
  const preset = String(design().motionPreset || "smooth");
  const lvl = animLevel();
  if (lvl === "off") return { duration: 0 };
  if (lvl === "reduced") return { duration: 0.12, ease: "easeOut" };
  const table: Record<string, Record<string, Transition>> = {
    smooth: { page: { type: "spring", stiffness: 260, damping: 30, mass: 0.9 }, card: { type: "spring", stiffness: 300, damping: 28 }, sheet: { type: "spring", stiffness: 320, damping: 30, mass: 0.8 }, tap: { type: "spring", stiffness: 500, damping: 30 } },
    bouncy: { page: { type: "spring", stiffness: 300, damping: 18 }, card: { type: "spring", stiffness: 380, damping: 16 }, sheet: { type: "spring", stiffness: 340, damping: 20 }, tap: { type: "spring", stiffness: 600, damping: 14 } },
    snappy: { page: { duration: 0.18, ease: [0.2, 0.9, 0.3, 1] }, card: { duration: 0.16, ease: "easeOut" }, sheet: { duration: 0.22, ease: [0.2, 0.9, 0.3, 1] }, tap: { duration: 0.08 } },
  };
  return (table[preset] || table.smooth)[kind];
}

/** Sahifa o'tish variantlari */
export function pageVariants(): Variants {
  const t = String(design().pageTransition || "ios");
  if (animLevel() === "off" || t === "none") return { initial: {}, animate: {}, exit: {} };
  switch (t) {
    case "fade": return { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
    case "zoom": return { initial: { opacity: 0, scale: 0.94 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 1.03 } };
    case "up": return { initial: { opacity: 0, y: 28 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -12 } };
    default: return { initial: { opacity: 0, x: 40 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -30 } };
  }
}

/** Kartochka kirish effekti */
export function cardVariants(index = 0): { initial: Record<string, number>; animate: Record<string, number>; transition: Transition } {
  const d = design();
  const lvl = animLevel();
  const e = String(d.cardEntrance || "rise");
  const stagger = d.cardStagger !== false && lvl === "full" ? Math.min(index, 10) * 0.04 : 0;
  const base = { ...spring("card"), delay: stagger };
  if (lvl === "off" || e === "none") return { initial: {}, animate: {}, transition: { duration: 0 } };
  if (e === "fade") return { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: base };
  if (e === "pop") return { initial: { opacity: 0, scale: 0.85 }, animate: { opacity: 1, scale: 1 }, transition: base };
  return { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: base };
}

export function tapScale(): number {
  if (animLevel() === "off") return 1;
  const v = Number(design().tapScale);
  return Number.isFinite(v) && v > 0.5 && v <= 1 ? v : 0.96;
}

export function hapticEnabled(): boolean {
  return design().hapticEnabled !== false;
}
