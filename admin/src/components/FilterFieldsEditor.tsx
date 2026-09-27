import { useMemo } from "react";
import { ArrowDown, ArrowUp, Check, X } from "lucide-react";
import type { Options } from "../lib/api.ts";

export interface FilterRow { key: string; show?: boolean }

/** Filtr oynasida chiqishi mumkin bo'lgan o'rnatilgan bo'limlar */
const BUILTIN: { key: string; label: string; note?: string }[] = [
  { key: "__sort", label: "Saralash", note: "Arzonidan / qimmatidan / yangilari / ommaboplari" },
  { key: "__price", label: "Narx oralig'i", note: "Ikki tomonlama chiziqcha" },
  { key: "category", label: "Kategoriya" },
  { key: "measure", label: "O'lchov birligi" },
  { key: "box", label: "Qutidagi soni" },
];

/**
 * Qidiruv yonidagi filtr oynasida qaysi ko'rsatkichlar chiqishini belgilaydi.
 * Masalan «Sahifa» maydonini o'chirib qo'ysangiz — filtrда umuman ko'rinmaydi.
 */
export function FilterFieldsEditor({ value, onChange, options }: { value: FilterRow[]; onChange: (v: FilterRow[]) => void; options?: Options | null }) {
  const bito = useMemo(() => (options?.["bito:productFields"] || []) as { value: string; label: string }[], [options]);
  const all = useMemo(() => [...BUILTIN, ...bito.map((b) => ({ key: b.value, label: b.label, note: undefined }))], [bito]);

  const rows = useMemo(() => {
    const list: FilterRow[] = Array.isArray(value) ? value.filter((r) => r && all.some((a) => a.key === r.key)) : [];
    const have = new Set(list.map((r) => r.key));
    for (const a of all) if (!have.has(a.key)) list.push({ key: a.key, show: true });
    return list;
  }, [value, all]);

  const meta = (key: string) => all.find((a) => a.key === key);
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const shown = rows.filter((r) => r.show !== false).length;

  return (
    <div className="space-y-1.5">
      <div className="text-xs text-slate-500 mb-1">Filtr oynasida ko'rinadi: <b>{shown}</b> ta</div>
      {rows.map((r, i) => {
        const on = r.show !== false;
        const m = meta(r.key);
        return (
          <div key={r.key} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${on ? "border-slate-200" : "border-slate-100 bg-slate-50/60"}`}>
            <span className="w-5 text-xs text-slate-400 tabular-nums">{i + 1}</span>
            <span className="flex-1 min-w-0">
              <span className={`block text-sm truncate ${on ? "" : "text-slate-400"}`}>{m?.label || r.key}</span>
              {m?.note && <span className="block text-[11px] text-slate-400">{m.note}</span>}
            </span>
            <button type="button" onClick={() => onChange(rows.map((x, n) => (n === i ? { ...x, show: !on } : x)))}
              className={`h-8 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 ${on ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
              {on ? <Check size={14} /> : <X size={14} />} {on ? "Filtrda bor" : "Yashirilgan"}
            </button>
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center shrink-0"><ArrowUp size={15} /></button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center shrink-0"><ArrowDown size={15} /></button>
          </div>
        );
      })}
      <div className="help">
        Maydon nomlari «Mahsulotning qo'shimcha ma'lumotlari» bo'limida belgilanadi. Bu yerda faqat filtrda chiqish-chiqmasligi
        va tartibi hal qilinadi. Bitta qiymatga ega maydon (hammasida bir xil) filtrda avtomatik chiqmaydi.
      </div>
    </div>
  );
}
