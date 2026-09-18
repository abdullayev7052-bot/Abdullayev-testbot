import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Star, ArrowUp, ArrowDown, RefreshCw, Search, ArrowDownAZ } from "lucide-react";
import { api } from "../lib/api.ts";
import { PageTitle, Spinner, Toggle, useToast } from "../components/ui.tsx";

interface P { id: number; bitoId: string; name: string; image: string | null; price: number; stock: number; categoryId: string | null; categoryName: string | null; hidden: boolean; featured: boolean; sortOrder: number; boxItem: number; sku: string | null }
interface C { id: number; bitoId: string; name: string; parentId: string | null; image: string | null; hidden: boolean; sortOrder: number; itemCount: number }
interface Data { products: P[]; categories: C[]; sync: { running: boolean; last: { at: string; ok: boolean; message: string } | null } }

export function CatalogPage() {
  const qc = useQueryClient();
  const toast = useToast((s) => s.show);
  const q = useQuery({ queryKey: ["catalog"], queryFn: () => api.get<Data>("/catalog") });
  const [tab, setTab] = useState<"products" | "categories">("products");
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("");
  const [sel, setSel] = useState<Set<number>>(new Set());
  const refresh = () => qc.invalidateQueries({ queryKey: ["catalog"] });

  const products = useMemo(() => {
    let list = q.data?.products || [];
    if (cat) list = list.filter((p) => p.categoryId === cat);
    if (search.trim()) { const s = search.toLowerCase(); list = list.filter((p) => p.name.toLowerCase().includes(s) || (p.sku || "").includes(s)); }
    return list;
  }, [q.data, cat, search]);

  const patch = async (id: number, body: Partial<P>) => {
    await api.put(`/catalog/products/${id}`, body);
    qc.setQueryData<Data>(["catalog"], (d) => d && { ...d, products: d.products.map((p) => (p.id === id ? { ...p, ...body } : p)) });
  };
  const patchCat = async (id: number, body: Partial<C>) => {
    await api.put(`/catalog/categories/${id}`, body);
    qc.setQueryData<Data>(["catalog"], (d) => d && { ...d, categories: d.categories.map((c) => (c.id === id ? { ...c, ...body } : c)) });
  };
  const moveP = async (i: number, dir: -1 | 1) => {
    const all = [...(q.data?.products || [])];
    const idxAll = all.findIndex((p) => p.id === products[i].id);
    const target = products[i + dir]; if (!target) return;
    const idxT = all.findIndex((p) => p.id === target.id);
    [all[idxAll], all[idxT]] = [all[idxT], all[idxAll]];
    await api.post("/catalog/products/reorder", { ids: all.map((p) => p.id) }); await refresh();
  };
  const moveC = async (list: C[], i: number, dir: -1 | 1) => {
    const ids = list.map((c) => c.id); const j = i + dir; if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await api.post("/catalog/categories/reorder", { ids }); await refresh();
  };
  const bulk = async (body: { hidden?: boolean; featured?: boolean }) => {
    await api.post("/catalog/products/bulk", { ids: [...sel], ...body }); setSel(new Set()); await refresh(); toast("Bajarildi");
  };
  const sortAZ = async () => {
    const all = [...(q.data?.products || [])].sort((a, b) => a.name.localeCompare(b.name, "uz"));
    await api.post("/catalog/products/reorder", { ids: all.map((p) => p.id) }); await refresh(); toast("A–Z tartiblandi");
  };
  if (q.isLoading || !q.data) return <Spinner />;
  const cats = q.data.categories;

  return (
    <div>
      <PageTitle title="Katalog boshqaruvi" description="Mahsulotlar va kategoriyalar Bito'dan avtomatik keladi. Bu yerda faqat ko'rinish, tartib va tavsiya belgilanadi." actions={
        <button className="btn btn-ghost" onClick={() => { void api.post("/bito/sync").then(async (r: unknown) => { toast((r as { message: string }).message); await refresh(); }); }}><RefreshCw size={16} /> Bito'dan yangilash</button>
      } />
      <div className="text-xs text-slate-500 mb-3">Oxirgi sinxronizatsiya: {q.data.sync.last?.message || "—"}</div>
      <div className="flex gap-2 mb-4">
        <button className={`btn ${tab === "products" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("products")}>Mahsulotlar ({q.data.products.length})</button>
        <button className={`btn ${tab === "categories" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("categories")}>Kategoriyalar ({cats.length})</button>
      </div>

      {tab === "products" ? (
        <div className="card">
          <div className="p-3 flex flex-wrap gap-2 items-center border-b border-slate-100">
            <div className="relative flex-1 min-w-[200px]"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className="input pl-9" placeholder="Qidirish..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <select className="input max-w-xs" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Barcha kategoriyalar</option>{cats.map((c) => <option key={c.bitoId} value={c.bitoId}>{c.name}</option>)}</select>
            <button className="btn btn-ghost" onClick={() => { void sortAZ(); }}><ArrowDownAZ size={16} /> A–Z tartiblash</button>
            {sel.size > 0 && (
              <div className="flex gap-1.5 items-center bg-blue-50 rounded-lg px-2 py-1">
                <span className="text-xs font-semibold text-blue-700">{sel.size} tanlandi:</span>
                <button className="btn btn-ghost !py-1 !px-2 text-xs" onClick={() => { void bulk({ hidden: true }); }}>Yashirish</button>
                <button className="btn btn-ghost !py-1 !px-2 text-xs" onClick={() => { void bulk({ hidden: false }); }}>Ko'rsatish</button>
                <button className="btn btn-ghost !py-1 !px-2 text-xs" onClick={() => { void bulk({ featured: true }); }}>Tavsiyaga</button>
                <button className="btn btn-ghost !py-1 !px-2 text-xs" onClick={() => { void bulk({ featured: false }); }}>Tavsiyadan olib tashlash</button>
              </div>
            )}
          </div>
          <div className="divide-y divide-slate-100">
            {products.map((p, i) => (
              <div key={p.id} className={`flex items-center gap-3 px-3 py-2 ${p.hidden ? "opacity-50" : ""}`}>
                <input type="checkbox" checked={sel.has(p.id)} onChange={(e) => { const s = new Set(sel); if (e.target.checked) s.add(p.id); else s.delete(p.id); setSel(s); }} />
                {p.image ? <img src={p.image} className="w-10 h-10 rounded-lg object-cover bg-slate-100" /> : <div className="w-10 h-10 rounded-lg bg-slate-100" />}
                <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{p.name}</div><div className="text-xs text-slate-500">{p.categoryName || "—"} · {p.price.toLocaleString()} · qoldiq {p.stock}{p.boxItem ? ` · quti ${p.boxItem}` : ""}</div></div>
                <button title="Tavsiya etilgan" className={`w-8 h-8 rounded-lg flex items-center justify-center ${p.featured ? "bg-amber-100 text-amber-600" : "text-slate-300 hover:bg-slate-100"}`} onClick={() => { void patch(p.id, { featured: !p.featured }); }}><Star size={16} fill={p.featured ? "currentColor" : "none"} /></button>
                <button title={p.hidden ? "Ko'rsatish" : "Yashirish"} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100" onClick={() => { void patch(p.id, { hidden: !p.hidden }); }}>{p.hidden ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                <button className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100" onClick={() => { void moveP(i, -1); }}><ArrowUp size={16} /></button>
                <button className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100" onClick={() => { void moveP(i, 1); }}><ArrowDown size={16} /></button>
              </div>
            ))}
            {!products.length && <div className="p-8 text-center text-slate-400">Mahsulot topilmadi</div>}
          </div>
        </div>
      ) : (
        <div className="card divide-y divide-slate-100">
          {cats.map((c, i) => (
            <div key={c.id} className={`flex items-center gap-3 px-3 py-2 ${c.hidden ? "opacity-50" : ""}`}>
              {c.image ? <img src={c.image} className="w-10 h-10 rounded-lg object-cover bg-slate-100" /> : <div className="w-10 h-10 rounded-lg bg-slate-100" />}
              <div className="flex-1 min-w-0"><div className="text-sm font-medium">{c.parentId ? "↳ " : ""}{c.name}</div><div className="text-xs text-slate-500">{c.itemCount} ta mahsulot{c.parentId ? ` · ost-kategoriya: ${cats.find((x) => x.bitoId === c.parentId)?.name || ""}` : ""}</div></div>
              <Toggle value={!c.hidden} onChange={(v) => { void patchCat(c.id, { hidden: !v }); }} label={c.hidden ? "Yashirilgan" : "Ko'rinadi"} />
              <button className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100" onClick={() => { void moveC(cats, i, -1); }}><ArrowUp size={16} /></button>
              <button className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100" onClick={() => { void moveC(cats, i, 1); }}><ArrowDown size={16} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
