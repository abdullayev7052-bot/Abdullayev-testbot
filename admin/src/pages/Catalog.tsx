import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Star, ArrowUp, ArrowDown, RefreshCw, Search, ArrowDownAZ, Copy, ChevronsUp, ChevronsDown, Percent } from "lucide-react";
import { api } from "../lib/api.ts";
import { Modal, PageTitle, Spinner, Toggle, useToast } from "../components/ui.tsx";

interface P { id: number; bitoId: string; name: string; image: string | null; price: number; stock: number; categoryId: string | null; categoryName: string | null; hidden: boolean; featured: boolean; sortOrder: number; boxItem: number; sku: string | null; finalPrice?: number; discountPercent?: number; roundStep?: number; roundMode?: string }
interface C { id: number; bitoId: string; name: string; parentId: string | null; image: string | null; hidden: boolean; sortOrder: number; itemCount: number }
interface Data { products: P[]; categories: C[]; uzs?: boolean; sync: { running: boolean; last: { at: string; ok: boolean; message: string } | null } }

/** Tartibni serverga yuborishni 600 ms kechiktirib, bir nechta bosishni bittaga jamlash */
function useDebouncedReorder(url: string) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<number[] | null>(null);
  const toast = useToast((s) => s.show);
  return (ids: number[]) => {
    pending.current = ids;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const list = pending.current; pending.current = null;
      if (list) api.post(url, { ids: list }).catch((e) => toast("Tartib saqlanmadi: " + (e as Error).message, "err"));
    }, 600);
  };
}

export function CatalogPage() {
  const qc = useQueryClient();
  const toast = useToast((s) => s.show);
  const q = useQuery({ queryKey: ["catalog"], queryFn: () => api.get<Data>("/catalog"), staleTime: 30000 });
  const [tab, setTab] = useState<"products" | "categories">("products");
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("");
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [disc, setDisc] = useState<{ percent: number; round: boolean; step: number; mode: string } | null>(null);
  const reorderP = useDebouncedReorder("/catalog/products/reorder");
  const reorderC = useDebouncedReorder("/catalog/categories/reorder");

  // Lokal (optimistik) nusxa — har bosishda serverni kutmaymiz
  const [products, setProducts] = useState<P[]>([]);
  const [cats, setCats] = useState<C[]>([]);
  useEffect(() => { if (q.data) { setProducts(q.data.products); setCats(q.data.categories); } }, [q.data]);

  const visible = useMemo(() => {
    let list = products;
    if (cat) list = list.filter((p) => p.categoryId === cat);
    if (search.trim()) { const s = search.toLowerCase(); list = list.filter((p) => p.name.toLowerCase().includes(s) || (p.sku || "").includes(s) || String(p.id) === s); }
    return list;
  }, [products, cat, search]);

  const patch = (id: number, body: Partial<P>) => {
    setProducts((l) => l.map((p) => (p.id === id ? { ...p, ...body } : p)));
    api.put(`/catalog/products/${id}`, body).catch((e) => { toast((e as Error).message, "err"); void qc.invalidateQueries({ queryKey: ["catalog"] }); });
  };
  const patchCat = (id: number, body: Partial<C>) => {
    setCats((l) => l.map((c) => (c.id === id ? { ...c, ...body } : c)));
    api.put(`/catalog/categories/${id}`, body).catch((e) => { toast((e as Error).message, "err"); void qc.invalidateQueries({ queryKey: ["catalog"] }); });
  };
  /** Mahsulotni ko'rinadigan ro'yxat ichida siljitish (butun ro'yxat tartibini saqlab) */
  const moveP = (id: number, to: "up" | "down" | "top" | "bottom") => {
    setProducts((all) => {
      const list = [...all];
      const idx = list.findIndex((p) => p.id === id);
      if (idx < 0) return all;
      const visIds = visible.map((p) => p.id);
      const vi = visIds.indexOf(id);
      let targetVisIdx = to === "up" ? vi - 1 : to === "down" ? vi + 1 : to === "top" ? 0 : visIds.length - 1;
      if (targetVisIdx < 0 || targetVisIdx >= visIds.length || targetVisIdx === vi) return all;
      const targetId = visIds[targetVisIdx];
      const tIdx = list.findIndex((p) => p.id === targetId);
      const [item] = list.splice(idx, 1);
      list.splice(tIdx, 0, item);
      const withOrder = list.map((p, i) => ({ ...p, sortOrder: i + 1 }));
      reorderP(withOrder.map((p) => p.id));
      return withOrder;
    });
  };
  const moveC = (i: number, dir: -1 | 1) => {
    setCats((all) => {
      const list = [...all]; const j = i + dir; if (j < 0 || j >= list.length) return all;
      [list[i], list[j]] = [list[j], list[i]];
      reorderC(list.map((c) => c.id));
      return list;
    });
  };
  const bulk = async (body: { hidden?: boolean; featured?: boolean }) => {
    const ids = [...sel];
    setProducts((l) => l.map((p) => (sel.has(p.id) ? { ...p, ...body } : p)));
    setSel(new Set());
    try { await api.post("/catalog/products/bulk", { ids, ...body }); toast(`${ids.length} ta mahsulot yangilandi`); } catch (e) { toast((e as Error).message, "err"); void qc.invalidateQueries({ queryKey: ["catalog"] }); }
  };
  const applyDiscount = async () => {
    if (!disc) return;
    const ids = [...sel];
    const body = { ids, percent: disc.percent, roundStep: disc.round && q.data?.uzs ? disc.step : 0, roundMode: disc.mode };
    setDisc(null); setSel(new Set());
    try { await api.post("/catalog/products/discount", body); toast(body.percent > 0 ? `${ids.length} ta mahsulotga ${body.percent}% chegirma` : "Chegirma olib tashlandi"); await qc.invalidateQueries({ queryKey: ["catalog"] }); } catch (e) { toast((e as Error).message, "err"); }
  };
  const sortAZ = () => {
    setProducts((all) => { const l = [...all].sort((a, b) => a.name.localeCompare(b.name, "uz")).map((p, i) => ({ ...p, sortOrder: i + 1 })); reorderP(l.map((p) => p.id)); return l; });
    toast("A–Z tartiblandi");
  };
  const sync = async () => {
    setBusy(true);
    try { const r = await api.post<{ ok: boolean; message: string }>("/bito/sync"); toast(r.message); await qc.invalidateQueries({ queryKey: ["catalog"] }); } catch (e) { toast((e as Error).message, "err"); } finally { setBusy(false); }
  };
  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast(`Nusxalandi: ${t}`));
  const IconBtn = ({ onClick, title, children, active }: { onClick: () => void; title: string; children: React.ReactNode; active?: boolean }) => (
    <button title={title} onClick={onClick} className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${active ? "bg-amber-100 text-amber-600" : "text-slate-400 hover:bg-slate-100"}`}>{children}</button>
  );

  if (q.isLoading || !q.data) return <Spinner />;

  return (
    <div>
      <PageTitle title="Katalog boshqaruvi" description="Mahsulotlar va kategoriyalar Bito'dan avtomatik keladi. Bu yerda ko'rinish, tartib va tavsiya belgilanadi. ID — banner/storis/xabar havolasi uchun." actions={
        <button className="btn btn-ghost" disabled={busy} onClick={() => { void sync(); }}><RefreshCw size={16} className={busy ? "animate-spin" : ""} /> Bito'dan yangilash</button>
      } />
      <div className="text-xs text-slate-500 mb-3">Oxirgi sinxronizatsiya: {q.data.sync.last?.message || "—"}</div>
      <div className="flex gap-2 mb-4">
        <button className={`btn ${tab === "products" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("products")}>Mahsulotlar ({products.length})</button>
        <button className={`btn ${tab === "categories" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("categories")}>Kategoriyalar ({cats.length})</button>
      </div>

      {tab === "products" ? (
        <div className="card">
          <div className="p-3 flex flex-wrap gap-2 items-center border-b border-slate-100">
            <div className="relative flex-1 min-w-[180px]"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className="input pl-9" placeholder="Nomi, SKU yoki ID..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <select className="input w-auto max-w-[220px]" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Barcha kategoriyalar</option>{cats.map((c) => <option key={c.bitoId} value={c.bitoId}>{c.name}</option>)}</select>
            <button className="btn btn-ghost" onClick={sortAZ}><ArrowDownAZ size={16} /> A–Z</button>
            {sel.size > 0 && (
              <div className="flex flex-wrap gap-1.5 items-center bg-blue-50 rounded-lg px-2 py-1 w-full sm:w-auto">
                <span className="text-xs font-semibold text-blue-700">{sel.size} tanlandi:</span>
                <button className="btn btn-ghost !py-1 !px-2 text-xs" onClick={() => { void bulk({ hidden: true }); }}>Yashirish</button>
                <button className="btn btn-ghost !py-1 !px-2 text-xs" onClick={() => { void bulk({ hidden: false }); }}>Ko'rsatish</button>
                <button className="btn btn-ghost !py-1 !px-2 text-xs" onClick={() => { void bulk({ featured: true }); }}>★ Tavsiyaga</button>
                <button className="btn btn-ghost !py-1 !px-2 text-xs" onClick={() => { void bulk({ featured: false }); }}>Tavsiyadan olish</button>
                <button className="btn btn-ghost !py-1 !px-2 text-xs text-rose-600" onClick={() => setDisc({ percent: 10, round: true, step: 1000, mode: "nearest" })}><Percent size={12} /> Chegirma</button>
              </div>
            )}
          </div>
          <div className="divide-y divide-slate-100">
            {visible.map((p) => (
              <div key={p.id} className={`flex items-center gap-2 px-2 sm:px-3 py-2 ${p.hidden ? "opacity-50" : ""}`}>
                <input type="checkbox" className="shrink-0" checked={sel.has(p.id)} onChange={(e) => { const s = new Set(sel); if (e.target.checked) s.add(p.id); else s.delete(p.id); setSel(s); }} />
                {p.image ? <img src={p.image} className="w-10 h-10 rounded-lg object-cover bg-slate-100 shrink-0" loading="lazy" /> : <div className="w-10 h-10 rounded-lg bg-slate-100 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-xs text-slate-500 truncate">{p.categoryName || "—"} · {p.discountPercent ? <><s className="text-slate-400">{p.price.toLocaleString()}</s> <b className="text-rose-600">{(p.finalPrice ?? p.price).toLocaleString()}</b> <span className="badge bg-rose-50 text-rose-600">-{p.discountPercent}%</span></> : p.price.toLocaleString()} · qoldiq {p.stock}{p.boxItem ? ` · quti ${p.boxItem}` : ""}</div>
                  <button onClick={() => { void copy(`product:${p.id}`); }} className="text-[11px] text-blue-600 inline-flex items-center gap-1 mt-0.5"><Copy size={11} /> ID {p.id}</button>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <IconBtn title="Tavsiya etilgan" active={p.featured} onClick={() => patch(p.id, { featured: !p.featured })}><Star size={16} fill={p.featured ? "currentColor" : "none"} /></IconBtn>
                  <IconBtn title={p.hidden ? "Ko'rsatish" : "Yashirish"} onClick={() => patch(p.id, { hidden: !p.hidden })}>{p.hidden ? <EyeOff size={16} /> : <Eye size={16} />}</IconBtn>
                  <div className="hidden sm:flex">
                    <IconBtn title="Eng yuqoriga" onClick={() => moveP(p.id, "top")}><ChevronsUp size={16} /></IconBtn>
                    <IconBtn title="Yuqoriga" onClick={() => moveP(p.id, "up")}><ArrowUp size={16} /></IconBtn>
                    <IconBtn title="Pastga" onClick={() => moveP(p.id, "down")}><ArrowDown size={16} /></IconBtn>
                    <IconBtn title="Eng pastga" onClick={() => moveP(p.id, "bottom")}><ChevronsDown size={16} /></IconBtn>
                  </div>
                  <div className="flex sm:hidden flex-col">
                    <IconBtn title="Yuqoriga" onClick={() => moveP(p.id, "up")}><ArrowUp size={14} /></IconBtn>
                    <IconBtn title="Pastga" onClick={() => moveP(p.id, "down")}><ArrowDown size={14} /></IconBtn>
                  </div>
                </div>
              </div>
            ))}
            {!visible.length && <div className="p-8 text-center text-slate-400">Mahsulot topilmadi</div>}
          </div>
        </div>
      ) : (
        <div className="card divide-y divide-slate-100">
          {cats.map((c, i) => (
            <div key={c.id} className={`flex items-center gap-2 px-2 sm:px-3 py-2 ${c.hidden ? "opacity-50" : ""}`}>
              {c.image ? <img src={c.image} className="w-10 h-10 rounded-lg object-cover bg-slate-100 shrink-0" loading="lazy" /> : <div className="w-10 h-10 rounded-lg bg-slate-100 shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{c.parentId ? "↳ " : ""}{c.name}</div>
                <div className="text-xs text-slate-500 truncate">{c.itemCount} ta mahsulot{c.parentId ? ` · ${cats.find((x) => x.bitoId === c.parentId)?.name || ""}` : ""}</div>
                <button onClick={() => { void copy(`category:${c.bitoId}`); }} className="text-[11px] text-blue-600 inline-flex items-center gap-1 mt-0.5"><Copy size={11} /> ID nusxalash</button>
              </div>
              <Toggle value={!c.hidden} onChange={(v) => patchCat(c.id, { hidden: !v })} />
              <IconBtn title="Yuqoriga" onClick={() => moveC(i, -1)}><ArrowUp size={16} /></IconBtn>
              <IconBtn title="Pastga" onClick={() => moveC(i, 1)}><ArrowDown size={16} /></IconBtn>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!disc} onClose={() => setDisc(null)} title={`Chegirma belgilash (${sel.size} ta mahsulot)`}>
        {disc && (
          <div className="space-y-4">
            <div><label className="label">Chegirma foizi (%)</label><input type="number" className="input max-w-xs" min={0} max={99} value={disc.percent} onChange={(e) => setDisc({ ...disc, percent: Math.max(0, Math.min(99, Number(e.target.value) || 0)) })} />
              <div className="help">0 — chegirmani olib tashlaydi. Chegirma narxi Mini App'da chizilgan eski narx bilan ko'rsatiladi, buyurtma ham Bito'ga shu narxda tushadi.</div></div>
            {q.data?.uzs ? (
              <>
                <div className="flex items-center justify-between"><span className="text-sm font-medium">Narxni yaxlitlash</span><Toggle value={disc.round} onChange={(v) => setDisc({ ...disc, round: v })} /></div>
                {disc.round && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div><label className="label">Yaxlitlash qadami</label>
                      <select className="input" value={disc.step} onChange={(e) => setDisc({ ...disc, step: Number(e.target.value) })}>{[100, 500, 1000, 5000, 10000].map((s) => <option key={s} value={s}>{s.toLocaleString()} so'm</option>)}</select></div>
                    <div><label className="label">Yaxlitlash turi</label>
                      <select className="input" value={disc.mode} onChange={(e) => setDisc({ ...disc, mode: e.target.value })}><option value="nearest">Eng yaqiniga</option><option value="up">Yuqoriga</option><option value="down">Pastga</option></select></div>
                  </div>
                )}
              </>
            ) : <div className="help">Yaxlitlash faqat so'm valyutasida ishlaydi.</div>}
            <div className="flex justify-end gap-2"><button className="btn btn-ghost" onClick={() => setDisc(null)}>Bekor</button><button className="btn btn-primary" onClick={() => { void applyDiscount(); }}>{disc.percent > 0 ? "Qo'llash" : "Chegirmani olib tashlash"}</button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
