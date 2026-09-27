import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Check, RotateCcw } from "lucide-react";
import { api, type FiltersData } from "../lib/api.ts";
import { useT } from "../store/app.ts";
import { BottomSheet, Skeleton } from "./ui.tsx";
import { haptic } from "../lib/telegram.ts";
import { money } from "../lib/format.ts";

export interface CatalogFilters {
  /** maydon kaliti → tanlangan qiymatlar */
  fields: Record<string, string[]>;
  minPrice: number;
  maxPrice: number;
  sort: string;
}
export const emptyFilters: CatalogFilters = { fields: {}, minPrice: 0, maxPrice: 0, sort: "" };
export const filtersCount = (f: CatalogFilters) =>
  Object.values(f.fields).reduce((a, v) => a + (v?.length ? 1 : 0), 0) + (f.minPrice || f.maxPrice ? 1 : 0) + (f.sort ? 1 : 0);

/** Narx oralig'i: ikki tomondan siljitiladigan chiziqcha */
function PriceRange({ min, max, value, onChange, fmt }: { min: number; max: number; value: [number, number]; onChange: (v: [number, number]) => void; fmt: (n: number) => string }) {
  const [lo, hi] = value;
  const pct = (v: number) => (max > min ? ((v - min) / (max - min)) * 100 : 0);
  return (
    <div className="pt-1">
      <div className="flex items-center justify-between text-sm font-semibold mb-2">
        <span>{fmt(lo)}</span><span className="text-slate-400">—</span><span>{fmt(hi)}</span>
      </div>
      <div className="relative h-9">
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-slate-200" />
        <div className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full" style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%`, background: "var(--primary)" }} />
        <input type="range" min={min} max={max} value={lo} step={Math.max(1, Math.round((max - min) / 200))}
          onChange={(e) => onChange([Math.min(Number(e.target.value), hi), hi])}
          className="range-thumb absolute inset-0 w-full appearance-none bg-transparent pointer-events-none" />
        <input type="range" min={min} max={max} value={hi} step={Math.max(1, Math.round((max - min) / 200))}
          onChange={(e) => onChange([lo, Math.max(Number(e.target.value), lo)])}
          className="range-thumb absolute inset-0 w-full appearance-none bg-transparent pointer-events-none" />
      </div>
    </div>
  );
}

export function FilterSheet({ open, onClose, category, value, onApply }: {
  open: boolean; onClose: () => void; category: string; value: CatalogFilters; onApply: (f: CatalogFilters) => void;
}) {
  const { t, v: setting } = useT();
  const suffix = t("general", "currencySuffix");
  const fmt = (n: number) => money(n, suffix, 0);
  const data = useQuery({
    queryKey: ["filters", category],
    queryFn: () => api.get<FiltersData>(`/filters?category=${encodeURIComponent(category)}`),
    enabled: open,
    staleTime: 60000,
  });
  const [draft, setDraft] = useState<CatalogFilters>(value);
  useEffect(() => { if (open) setDraft(value); }, [open, value]);

  const price = data.data?.price;
  const range = useMemo<[number, number]>(() => {
    if (!price) return [0, 0];
    return [draft.minPrice || price.min, draft.maxPrice || price.max];
  }, [price, draft.minPrice, draft.maxPrice]);

  const SORTS: { key: string; label: string }[] = [
    { key: "", label: t("catalog", "sortDefault") },
    { key: "price_asc", label: t("catalog", "sortPriceAsc") },
    { key: "price_desc", label: t("catalog", "sortPriceDesc") },
    { key: "newest", label: t("catalog", "sortNewest") },
    { key: "popular", label: t("catalog", "sortPopular") },
    { key: "name_asc", label: t("catalog", "sortNameAsc") },
  ];

  const toggle = (key: string, val: string) => {
    haptic.select();
    setDraft((d) => {
      const cur = d.fields[key] || [];
      const next = cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val];
      const fields = { ...d.fields };
      if (next.length) fields[key] = next; else delete fields[key];
      return { ...d, fields };
    });
  };
  const reset = () => { haptic.medium(); setDraft(emptyFilters); };
  const apply = () => { haptic.success(); onApply({ ...draft, minPrice: price && range[0] > price.min ? range[0] : 0, maxPrice: price && range[1] < price.max ? range[1] : 0 }); onClose(); };
  const maxValues = setting<number>("catalog", "filterMaxValues", 12);

  return (
    <BottomSheet open={open} onClose={onClose} title={t("catalog", "filterTitle")} full>
      <div className="px-4 pb-28">
        {data.isLoading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : (
          <>
            <div className="mb-5">
              <div className="text-sm font-semibold mb-2">{t("catalog", "sortTitle")}</div>
              <div className="flex flex-wrap gap-2">
                {SORTS.map((s) => (
                  <button key={s.key} onClick={() => { haptic.select(); setDraft((d) => ({ ...d, sort: s.key })); }}
                    className={`px-3.5 py-2 rounded-xl text-sm font-semibold border ${draft.sort === s.key ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]" : "border-slate-200 text-slate-600"}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {price && price.max > price.min && (
              <div className="mb-5">
                <div className="text-sm font-semibold mb-1">{t("catalog", "filterPrice")}</div>
                <PriceRange min={price.min} max={price.max} value={range} fmt={fmt}
                  onChange={([lo, hi]) => setDraft((d) => ({ ...d, minPrice: lo, maxPrice: hi }))} />
              </div>
            )}

            {(data.data?.fields || []).map((f) => (
              <FieldBlock key={f.key} f={f} selected={draft.fields[f.key] || []} onToggle={(val) => toggle(f.key, val)} maxValues={maxValues} moreLabel={t("catalog", "filterMore")} />
            ))}

            {!data.data?.fields.length && !price && <div className="text-sm text-slate-400 py-6 text-center">{t("catalog", "filterEmpty")}</div>}
          </>
        )}
      </div>

      <div className="fixed left-0 right-0 bottom-0 z-[610] p-4 bg-white/95 backdrop-blur border-t border-slate-100 flex gap-2" style={{ paddingBottom: "calc(var(--safe-bottom) + 16px)" }}>
        <button onClick={reset} className="h-12 px-4 rounded-2xl bg-slate-100 text-slate-600 font-semibold flex items-center gap-2"><RotateCcw size={18} /> {t("catalog", "filterReset")}</button>
        <motion.button whileTap={{ scale: 0.97 }} onClick={apply} className="flex-1 h-12 rounded-2xl btn-primary font-semibold flex items-center justify-center gap-2">
          <Check size={18} /> {t("catalog", "filterApply")}
        </motion.button>
      </div>
    </BottomSheet>
  );
}

function FieldBlock({ f, selected, onToggle, maxValues, moreLabel }: {
  f: { key: string; label: string; values: { value: string; count: number }[] };
  selected: string[]; onToggle: (v: string) => void; maxValues: number; moreLabel: string;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? f.values : f.values.slice(0, maxValues);
  return (
    <div className="mb-5">
      <div className="text-sm font-semibold mb-2">{f.label}</div>
      <div className="flex flex-wrap gap-2">
        {shown.map((v) => {
          const on = selected.includes(v.value);
          return (
            <button key={v.value} onClick={() => onToggle(v.value)}
              className={`px-3 py-2 rounded-xl text-sm border transition-colors ${on ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)] font-semibold" : "border-slate-200 text-slate-600"}`}>
              {v.value} <span className="text-xs text-slate-400">{v.count}</span>
            </button>
          );
        })}
        {f.values.length > maxValues && (
          <button onClick={() => setAll((x) => !x)} className="px-3 py-2 rounded-xl text-sm text-[var(--primary)] font-semibold">
            {all ? "−" : `${moreLabel} ${f.values.length - maxValues}`}
          </button>
        )}
      </div>
    </div>
  );
}
