import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { api } from "../lib/api.ts";
import type { HomeBlock } from "../pages/HomeBlocks.tsx";

export interface LayoutRow { key: string; show?: boolean }

/** O'rnatilgan bloklar — o'chirilishi alohida sozlamalar bilan boshqariladi */
const BUILTIN: { key: string; label: string }[] = [
  { key: "stories", label: "Storis (doiralar)" },
  { key: "banners", label: "Bannerlar" },
  { key: "hero", label: "Asosiy vidjet (Hero)" },
  { key: "featured", label: "Tavsiya etamiz" },
  { key: "categories", label: "Kategoriyalar" },
  { key: "new", label: "Yangi kelganlar" },
];

/** Bosh sahifadagi bloklarning tartibi (o'rnatilgan + admin yaratgan bloklar) */
export function HomeLayoutEditor({ value, onChange }: { value: LayoutRow[]; onChange: (v: LayoutRow[]) => void }) {
  const blocks = useQuery({ queryKey: ["home-blocks"], queryFn: () => api.get<HomeBlock[]>("/home-blocks"), staleTime: 30000 });
  const custom = useMemo(() => (blocks.data || []).map((b) => ({ key: `block:${b.id}`, label: `${b.title.uz || "(nomsiz)"} — ${b.kind === "chips" ? "mini bloklar" : "mahsulotlar"}` })), [blocks.data]);
  const all = useMemo(() => [...BUILTIN, ...custom], [custom]);

  const rows = useMemo(() => {
    const list: LayoutRow[] = Array.isArray(value) ? value.filter((r) => all.some((a) => a.key === r.key)) : [];
    const have = new Set(list.map((r) => r.key));
    for (const a of all) if (!have.has(a.key)) list.push({ key: a.key, show: true });
    return list;
  }, [value, all]);

  const label = (key: string) => all.find((a) => a.key === key)?.label || key;
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => {
        return (
          <div key={r.key} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
            <GripVertical size={15} className="text-slate-300 shrink-0" />
            <span className="w-5 text-xs text-slate-400 tabular-nums">{i + 1}</span>
            <span className="flex-1 min-w-0 text-sm truncate">{label(r.key)}</span>
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center"><ArrowUp size={15} /></button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center"><ArrowDown size={15} /></button>
          </div>
        );
      })}
      <div className="help">Yuqoridagi blok bosh sahifada ham eng tepada turadi. Yangi bloklar <b>Nazorat → Katalog boshqaruvi → Bosh sahifa bloklari</b> da yaratiladi va shu ro'yxatda paydo bo'ladi.</div>
    </div>
  );
}
