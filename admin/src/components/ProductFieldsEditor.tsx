import { useMemo } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Star } from "lucide-react";
import type { Lang, LText, Options } from "../lib/api.ts";

export interface PField { key: string; label?: LText | string; show?: boolean; face?: boolean }

const LANGS: { k: Lang; label: string }[] = [{ k: "uz", label: "🇺🇿" }, { k: "ru", label: "🇷🇺" }, { k: "en", label: "🇬🇧" }];
/** Bito'dan kelmaydigan, o'rnatilgan maydonlar */
const BUILTIN: { key: string; label: string }[] = [
  { key: "note", label: "Izoh (Bito'dagi mahsulot izohi)" },
  { key: "category", label: "Kategoriya" },
  { key: "sku", label: "Artikul (SKU)" },
  { key: "measure", label: "O'lchov birligi" },
  { key: "box", label: "Qutidagi soni" },
];

const asText = (l: PField["label"], lang: Lang): string =>
  l && typeof l === "object" ? (l as LText)[lang] || "" : typeof l === "string" ? (lang === "uz" ? l : "") : "";

/**
 * Mahsulotning qo'shimcha ma'lumotlari: ko'rinish, nomlash, tartib va
 * "kartochka betiga chiqarish". Bog'lanish maydon ID si bo'yicha (cf:<id>).
 */
export function ProductFieldsEditor({ value, onChange, options }: { value: PField[]; onChange: (v: PField[]) => void; options?: Options | null }) {
  const bito = options?.["bito:productFields"] || [];
  const list = useMemo(() => {
    const rows: PField[] = Array.isArray(value) ? [...value] : [];
    const have = new Set(rows.map((r) => r.key));
    // Yangi paydo bo'lgan maydonlarni oxiriga qo'shamiz (Bito'da yangi qo'shilgan bo'lsa)
    for (const b of BUILTIN) if (!have.has(b.key)) rows.push({ key: b.key, show: b.key === "note" || b.key === "category" });
    for (const o of bito) if (!have.has(o.value)) rows.push({ key: o.value, show: true });
    return rows;
  }, [value, bito]);

  const bitoName = (key: string) => bito.find((o) => o.value === key)?.label || "";
  const title = (key: string) => BUILTIN.find((b) => b.key === key)?.label || bitoName(key) || key;
  const gone = (key: string) => key.startsWith("cf:") && bito.length > 0 && !bitoName(key);

  const patch = (i: number, p: Partial<PField>) => {
    const next = list.map((r, n) => (n === i ? { ...r, ...p } : r));
    // "Kartochka betida" — faqat bittasi
    if (p.face) for (let n = 0; n < next.length; n++) if (n !== i) next[n] = { ...next[n], face: false };
    onChange(next);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const setLabel = (i: number, lang: Lang, v: string) => {
    const cur = list[i].label;
    const obj: LText = cur && typeof cur === "object" ? { ...(cur as LText) } : { uz: "", ru: "", en: "" };
    obj[lang] = v;
    patch(i, { label: obj });
  };

  return (
    <div className="space-y-2">
      {list.map((f, i) => {
        const on = f.show !== false;
        return (
          <div key={f.key} className={`rounded-xl border p-3 ${on ? "border-slate-200" : "border-slate-100 bg-slate-50/60 opacity-70"}`}>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex flex-col">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="w-6 h-5 rounded text-slate-400 hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center"><ArrowUp size={13} /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === list.length - 1} className="w-6 h-5 rounded text-slate-400 hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center"><ArrowDown size={13} /></button>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {title(f.key)}
                  {gone(f.key) && <span className="text-xs text-red-500 font-normal"> · Bito'da topilmadi</span>}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">{f.key}</div>
              </div>
              <button type="button" onClick={() => patch(i, { face: !f.face })} title="Kartochka yuziga chiqarish"
                className={`h-8 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${f.face ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                <Star size={14} className={f.face ? "fill-amber-500 text-amber-500" : ""} /> Karta yuzida
              </button>
              <button type="button" onClick={() => patch(i, { show: !on })}
                className={`h-8 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${on ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {on ? <Eye size={14} /> : <EyeOff size={14} />} {on ? "Ko'rinadi" : "Yashirilgan"}
              </button>
            </div>
            {on && (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-500 shrink-0">Mini App'dagi nomi:</span>
                {LANGS.map((l) => (
                  <span key={l.k} className="inline-flex items-center gap-1">
                    <span className="text-xs">{l.label}</span>
                    <input className="input !py-1 !w-36" placeholder={bitoName(f.key) || title(f.key)} value={asText(f.label, l.k)} onChange={(e) => setLabel(i, l.k, e.target.value)} />
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div className="help">
        Bo'sh qoldirilsa — Bito'dagi nomi ishlatiladi. «Karta yuzida» belgilangan maydon mahsulot kartochkasida nom ostida ko'rinadi
        (masalan muallif ismi). Tartibni yuqoriga/pastga tugmalari bilan o'zgartiring.
      </div>
    </div>
  );
}
