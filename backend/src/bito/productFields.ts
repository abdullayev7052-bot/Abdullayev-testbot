/**
 * Mahsulotning qo'shimcha ma'lumotlari (Bito custom fields + izoh, kategoriya, SKU, o'lchov)
 * admin sozlamalari bo'yicha tartiblab, nomlab beradi.
 * Bog'lanish maydon ID si bo'yicha — Bito'da yoki admin panelda nom o'zgarsa ham buzilmaydi.
 */
import type { Product } from "@prisma/client";
import { getSettings, lt } from "../settings/store.ts";
import type { Lang } from "../settings/schema.ts";

export interface ProductField { key: string; label?: unknown; show?: boolean; face?: boolean }
export interface ProductDetail { key: string; label: string; value: string }

const BUILTIN: Record<string, Record<Lang, string>> = {
  category: { uz: "Kategoriya", ru: "Категория", en: "Category" },
  note: { uz: "Izoh", ru: "Описание", en: "Description" },
  sku: { uz: "Artikul", ru: "Артикул", en: "SKU" },
  measure: { uz: "O'lchov birligi", ru: "Ед. изм.", en: "Unit" },
  box: { uz: "Qutidagi soni", ru: "В коробке", en: "Per box" },
};

type CF = { id?: string; name?: string; value?: string };

/** Bo'sh hisoblanadigan qiymatlar: "", " ", "-", "—", "null", "undefined" */
function clean(v: unknown): string | null {
  if (v === null || v === undefined || typeof v === "boolean") return null;
  const s = String(v).trim();
  if (!s) return null;
  if (/^(-+|—+|null|undefined|nan)$/i.test(s)) return null;
  return s;
}

/** Mahsulotdagi bitta kalitning xom qiymati (bo'sh bo'lsa — null, ya'ni umuman ko'rsatilmaydi) */
function rawValue(p: Product, key: string): { value: string; bitoName: string } | null {
  if (key.startsWith("cf:")) {
    const id = key.slice(3);
    const list = (p.customFields as CF[]) || [];
    const cf = list.find((x) => x.id === id);
    if (!cf) return null;
    const v = clean(cf.value);
    return v ? { value: v, bitoName: cf.name || "" } : null;
  }
  const by = (v: unknown) => { const c = clean(v); return c ? { value: c, bitoName: "" } : null; };
  switch (key) {
    case "category": return by(p.categoryName);
    case "note": return by(p.note);
    case "sku": return by(p.sku);
    case "measure": return by(p.measure);
    case "box": return p.boxItem > 0 ? { value: String(p.boxItem), bitoName: "" } : null;
    default: return null;
  }
}

/** Sozlamadagi ro'yxat; bo'sh bo'lsa — standart tartib (izoh, kategoriya, keyin Bito maydonlari) */
export function configuredFields(p?: Product): ProductField[] {
  const cfg = (getSettings().catalog.productFields as ProductField[]) || [];
  if (cfg.length) return cfg;
  const auto: ProductField[] = [{ key: "note", show: true }, { key: "category", show: true }];
  for (const cf of ((p?.customFields as CF[]) || [])) if (cf.id) auto.push({ key: `cf:${cf.id}`, show: true });
  return auto;
}

function labelOf(f: ProductField, key: string, bitoName: string, lang: Lang): string {
  const custom = f.label && typeof f.label === "object" ? lt(f.label as never, lang) : typeof f.label === "string" ? f.label : "";
  if (custom && custom.trim()) return custom.trim();
  if (bitoName) return bitoName;
  const b = BUILTIN[key];
  return b ? b[lang] : key;
}

/** Mahsulot ichidagi ro'yxat (tartiblangan, yoqilganlari). Qiymati bo'lmagan maydon umuman chiqmaydi. */
export function detailsFor(p: Product, lang: Lang, fallback?: Product[]): ProductDetail[] {
  const out: ProductDetail[] = [];
  for (const f of configuredFields(p)) {
    if (f.show === false) continue;
    let raw = rawValue(p, f.key);
    // Ota kartochkada bo'sh bo'lsa — variantlaridan qidiramiz
    if (!raw && fallback?.length) for (const k of fallback) { raw = rawValue(k, f.key); if (raw) break; }
    if (!raw) continue;
    out.push({ key: f.key, label: labelOf(f, f.key, raw.bitoName, lang), value: raw.value });
  }
  return out;
}

/** Kartochka betidagi qo'shimcha matn (masalan muallif ismi) */
export function faceTextFor(p: Product, lang: Lang, fallback?: Product[]): { label: string; value: string } | null {
  const f = configuredFields(p).find((x) => x.face && x.show !== false);
  if (!f) return null;
  let raw = rawValue(p, f.key);
  if (!raw && fallback?.length) for (const k of fallback) { raw = rawValue(k, f.key); if (raw) break; }
  if (!raw) return null;
  return { label: labelOf(f, f.key, raw.bitoName, lang), value: raw.value };
}

/** Mini App filtrlari uchun: qaysi maydonlar bo'yicha filtrlash mumkin va ularning qiymatlari */
export function filterableFields(): ProductField[] {
  return configuredFields().filter((f) => f.show !== false && f.key !== "note" && f.key !== "sku");
}

/** Mahsulotdagi kalit qiymati (filtrlash uchun, nomlanmagan holda) */
export function valueOf(p: Product, key: string): string | null {
  return rawValue(p, key)?.value ?? null;
}
