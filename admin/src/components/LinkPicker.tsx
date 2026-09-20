import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.ts";

interface Picker { products: { id: number; name: string; category: string | null }[]; categories: { id: string; name: string }[] }

/**
 * Havola tanlash: URL / Mahsulot / Kategoriya.
 * Qiymat: "https://..." | "product:ID" | "category:ID" | ""
 */
export function LinkPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const q = useQuery({ queryKey: ["picker"], queryFn: () => api.get<Picker>("/picker"), staleTime: 60000 });
  const kind = value.startsWith("product:") ? "product" : value.startsWith("category:") ? "category" : value ? "url" : "none";
  const [search, setSearch] = useState("");
  const products = useMemo(() => {
    const s = search.trim().toLowerCase();
    const list = q.data?.products || [];
    return (s ? list.filter((p) => p.name.toLowerCase().includes(s)) : list).slice(0, 200);
  }, [q.data, search]);
  const setKind = (k: string) => onChange(k === "url" ? "https://" : k === "product" ? "product:" : k === "category" ? "category:" : "");
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {[["none", "Havolasiz"], ["product", "Mahsulot"], ["category", "Kategoriya"], ["url", "Havola (URL)"]].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setKind(k)} className={`text-xs px-3 py-1.5 rounded-lg border ${kind === k ? "bg-[var(--primary)] text-white border-transparent" : "btn-ghost"}`}>{l}</button>
        ))}
      </div>
      {kind === "url" && <input className="input" placeholder="https://... yoki https://t.me/..." value={value} onChange={(e) => onChange(e.target.value)} />}
      {kind === "product" && (
        <div className="space-y-1.5">
          <input className="input" placeholder="Mahsulot nomini qidiring..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
            <option value="product:">— mahsulotni tanlang —</option>
            {products.map((p) => <option key={p.id} value={`product:${p.id}`}>{p.name}{p.category ? ` — ${p.category}` : ""} (ID {p.id})</option>)}
          </select>
        </div>
      )}
      {kind === "category" && (
        <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="category:">— kategoriyani tanlang —</option>
          {(q.data?.categories || []).map((c) => <option key={c.id} value={`category:${c.id}`}>{c.name}</option>)}
        </select>
      )}
      {value && kind !== "url" && kind !== "none" && <div className="help">Saqlanadigan qiymat: <code className="bg-slate-100 px-1 rounded">{value}</code> — mijoz bosganda Mini App ichida ochiladi</div>}
    </div>
  );
}
