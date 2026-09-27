import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Grid3x3, Images, Plus, Trash2, Save, Search } from "lucide-react";
import { api, type Lang, type LText, type Options } from "../lib/api.ts";
import { ImageUpload, Modal, Spinner, Toggle, confirmDialog, useToast } from "../components/ui.tsx";

export interface HomeBlock {
  id: number; kind: "products" | "chips"; source: string; fieldKey: string | null;
  title: Partial<LText>; style: Record<string, unknown>; limit: number; active: boolean; sortOrder: number;
  items: { id: number; productId: number | null; productName: string | null; value: string | null; image: string | null; title: string | null; sortOrder: number }[];
}
interface P { id: number; name: string; categoryName: string | null; image: string | null }

const LANGS: { k: Lang; f: string }[] = [{ k: "uz", f: "🇺🇿" }, { k: "ru", f: "🇷🇺" }, { k: "en", f: "🇬🇧" }];
const SOURCES: { value: string; label: string }[] = [
  { value: "manual", label: "Qo'lda tanlangan mahsulotlar" },
  { value: "featured", label: "Tavsiya etilganlar (★)" },
  { value: "new", label: "Yangi qo'shilganlar" },
  { value: "popular", label: "Ommabop (tartib bo'yicha)" },
  { value: "field", label: "Qo'shimcha maydon qiymati bo'yicha" },
];
const SHAPES = [{ value: "circle", label: "Doira" }, { value: "rounded", label: "Yumaloq burchak" }, { value: "square", label: "Kvadrat" }];

/** Nazorat → Katalog boshqaruvi ichidagi "Bosh sahifa bloklari" bo'limi */
export function HomeBlocksTab({ products, options }: { products: P[]; options?: Options | null }) {
  const qc = useQueryClient();
  const toast = useToast((s) => s.show);
  const q = useQuery({ queryKey: ["home-blocks"], queryFn: () => api.get<HomeBlock[]>("/home-blocks") });
  const [edit, setEdit] = useState<HomeBlock | null>(null);
  const blocks = q.data || [];
  const fieldOptions = useMemo(() => [
    { value: "category", label: "Kategoriya" },
    ...((options?.["bito:productFields"] || []) as { value: string; label: string }[]),
  ], [options]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["home-blocks"] });
  const create = async (kind: "products" | "chips") => {
    const b = await api.post<HomeBlock>("/home-blocks", {
      kind, source: kind === "chips" ? "field" : "manual",
      title: { uz: kind === "chips" ? "Mualliflar" : "Hafta bestsellerlari", ru: "", en: "" },
      style: kind === "chips" ? { shape: "circle", size: 72, showTitle: true } : { columns: 2 },
      limit: kind === "chips" ? 12 : 10,
    });
    await refresh();
    setEdit(b);
  };
  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const ids = blocks.map((b) => b.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await api.post("/home-blocks/reorder", { ids });
    await refresh();
  };

  if (q.isLoading) return <Spinner />;
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <button className="btn btn-primary" onClick={() => { void create("products"); }}><Plus size={16} /> Mahsulotlar bloki</button>
        <button className="btn btn-ghost" onClick={() => { void create("chips"); }}><Plus size={16} /> Mini bloklar (rasmli)</button>
        <div className="help w-full">
          <b>Mahsulotlar bloki</b> — bosh sahifada mahsulotlar qatori (masalan «Hafta bestsellerlari»).{" "}
          <b>Mini bloklar</b> — rasmli doiralar (masalan «Mualliflar»); bosilganda katalog shu qiymat bo'yicha filtrlanadi.
          Bloklarning bosh sahifadagi o'rnini <b>Sozlamalar → Mini App → Dizayn → Bosh sahifadagi bloklar</b> da o'zgartirasiz.
        </div>
      </div>

      <div className="space-y-2">
        {blocks.map((b, i) => (
          <div key={b.id} className="card p-4 flex items-center gap-3 flex-wrap">
            <div className="flex flex-col">
              <button onClick={() => { void move(i, -1); }} disabled={i === 0} className="w-6 h-5 rounded text-slate-400 hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center"><ArrowUp size={13} /></button>
              <button onClick={() => { void move(i, 1); }} disabled={i === blocks.length - 1} className="w-6 h-5 rounded text-slate-400 hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center"><ArrowDown size={13} /></button>
            </div>
            <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${b.kind === "chips" ? "bg-violet-50 text-violet-600" : "bg-blue-50 text-blue-600"}`}>
              {b.kind === "chips" ? <Images size={17} /> : <Grid3x3 size={17} />}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{b.title.uz || "(nomsiz)"}</div>
              <div className="text-xs text-slate-500">
                {b.kind === "chips" ? "Mini bloklar" : "Mahsulotlar"} · {SOURCES.find((x) => x.value === b.source)?.label || b.source}
                {b.fieldKey ? ` · ${fieldOptions.find((f) => f.value === b.fieldKey)?.label || b.fieldKey}` : ""}
                {b.items.length ? ` · ${b.items.length} ta tanlangan` : ""}
              </div>
            </div>
            <Toggle value={b.active} onChange={(v) => { void api.put(`/home-blocks/${b.id}`, { active: v }).then(refresh); }} />
            <button className="btn btn-ghost !py-1.5" onClick={() => setEdit(b)}>Sozlash</button>
            <button className="w-8 h-8 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50"
              onClick={() => { if (confirmDialog("Blok o'chirilsinmi?")) void api.del(`/home-blocks/${b.id}`).then(refresh); }}><Trash2 size={16} /></button>
          </div>
        ))}
        {!blocks.length && <div className="card p-8 text-center text-slate-400 text-sm">Hali blok yo'q. Yuqoridagi tugmalar bilan qo'shing.</div>}
      </div>

      {edit && <BlockEditor block={edit} products={products} fieldOptions={fieldOptions} onClose={() => setEdit(null)} onSaved={() => { void refresh(); toast("Saqlandi ✅"); }} />}
    </div>
  );
}

function BlockEditor({ block, products, fieldOptions, onClose, onSaved }: {
  block: HomeBlock; products: P[]; fieldOptions: { value: string; label: string }[]; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast((s) => s.show);
  const [b, setB] = useState<HomeBlock>(block);
  const [picked, setPicked] = useState<number[]>(block.items.filter((i) => i.productId).map((i) => i.productId!));
  const [entries, setEntries] = useState<{ value: string; image?: string; title?: string }[]>(
    block.items.filter((i) => i.value).map((i) => ({ value: i.value!, image: i.image || undefined, title: i.title || undefined })),
  );
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const style = (b.style || {}) as Record<string, unknown>;
  const setStyle = (k: string, v: unknown) => setB({ ...b, style: { ...style, [k]: v } });

  const values = useQuery({
    queryKey: ["field-values", b.fieldKey],
    queryFn: () => api.get<{ value: string; count: number }[]>(`/field-values?key=${encodeURIComponent(b.fieldKey || "")}`),
    enabled: b.kind === "chips" && !!b.fieldKey,
  });
  useEffect(() => { if (b.kind === "chips" && !b.fieldKey && fieldOptions[0]) setB((x) => ({ ...x, fieldKey: fieldOptions[0].value })); }, [b.kind, b.fieldKey, fieldOptions]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const list = s ? products.filter((p) => p.name.toLowerCase().includes(s)) : products;
    return list.slice(0, 200);
  }, [products, search]);

  const save = async () => {
    setBusy(true);
    try {
      await api.put(`/home-blocks/${b.id}`, { kind: b.kind, source: b.source, fieldKey: b.fieldKey, title: b.title, style: b.style, limit: b.limit, active: b.active });
      if (b.kind === "chips") await api.put(`/home-blocks/${b.id}/items`, { entries });
      else if (b.source === "manual") await api.put(`/home-blocks/${b.id}/items`, { products: picked });
      else if (b.source === "field") await api.put(`/home-blocks/${b.id}/items`, { entries: entries.map((e) => ({ value: e.value })) });
      onSaved();
      onClose();
    } catch (e) { toast((e as Error).message, "err"); } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={b.kind === "chips" ? "Mini bloklar" : "Mahsulotlar bloki"} width={720}>
      <div className="space-y-4">
        <div>
          <label className="label">Sarlavha</label>
          <div className="flex flex-wrap gap-2">
            {LANGS.map((l) => (
              <span key={l.k} className="inline-flex items-center gap-1">
                <span>{l.f}</span>
                <input className="input !w-44" value={b.title[l.k] || ""} onChange={(e) => setB({ ...b, title: { ...b.title, [l.k]: e.target.value } })} />
              </span>
            ))}
          </div>
        </div>

        {b.kind === "products" ? (
          <div>
            <label className="label">Mahsulotlar qayerdan olinsin</label>
            <select className="input max-w-sm" value={b.source} onChange={(e) => setB({ ...b, source: e.target.value })}>
              {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        ) : null}

        {(b.kind === "chips" || b.source === "field") && (
          <div>
            <label className="label">Qaysi qo'shimcha maydon</label>
            <select className="input max-w-sm" value={b.fieldKey || ""} onChange={(e) => setB({ ...b, fieldKey: e.target.value })}>
              <option value="">— tanlang —</option>
              {fieldOptions.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <div className="help">Masalan «add-1» (Muallif) tanlansa — har bir muallif uchun alohida doira chiqadi.</div>
          </div>
        )}

        <div className="flex flex-wrap gap-4 items-end">
          <div><label className="label">Nechta ko'rsatilsin</label><input type="number" className="input !w-28" min={1} max={60} value={b.limit} onChange={(e) => setB({ ...b, limit: Number(e.target.value) })} /></div>
          {b.kind === "chips" ? (
            <>
              <div><label className="label">Shakli</label>
                <select className="input !w-44" value={String(style.shape || "circle")} onChange={(e) => setStyle("shape", e.target.value)}>
                  {SHAPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div><label className="label">O'lchami (px)</label><input type="number" className="input !w-28" min={40} max={140} value={Number(style.size || 72)} onChange={(e) => setStyle("size", Number(e.target.value))} /></div>
              <div><label className="label">Burchak (px)</label><input type="number" className="input !w-28" min={0} max={40} value={Number(style.radius ?? 16)} onChange={(e) => setStyle("radius", Number(e.target.value))} /></div>
              <Toggle value={style.showTitle !== false} onChange={(v) => setStyle("showTitle", v)} label="Rasm ostida nomi" />
            </>
          ) : (
            <div><label className="label">Ustunlar</label><input type="number" className="input !w-28" min={1} max={3} value={Number(style.columns || 2)} onChange={(e) => setStyle("columns", Number(e.target.value))} /></div>
          )}
        </div>

        {b.kind === "products" && b.source === "manual" && (
          <div>
            <label className="label">Mahsulotlarni tanlang ({picked.length} ta)</label>
            <div className="relative mb-2"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" placeholder="Mahsulot nomi..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
              {filtered.map((p) => {
                const on = picked.includes(p.id);
                return (
                  <label key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
                    <input type="checkbox" checked={on} onChange={() => setPicked(on ? picked.filter((x) => x !== p.id) : [...picked, p.id])} />
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="text-xs text-slate-400">{p.categoryName || ""}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {(b.kind === "chips" || b.source === "field") && b.fieldKey && (
          <div>
            <label className="label">Qiymatlar {b.kind === "chips" ? "va ularning rasmlari" : ""}</label>
            {values.isLoading ? <Spinner /> : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {(values.data || []).map((v) => {
                  const idx = entries.findIndex((e) => e.value === v.value);
                  const on = idx >= 0;
                  return (
                    <div key={v.value} className={`rounded-xl border p-2.5 ${on ? "border-slate-200" : "border-slate-100 bg-slate-50/60"}`}>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={on} onChange={() => setEntries(on ? entries.filter((_, i) => i !== idx) : [...entries, { value: v.value }])} />
                        <span className="flex-1 truncate font-medium">{v.value}</span>
                        <span className="text-xs text-slate-400">{v.count} ta mahsulot</span>
                      </label>
                      {on && b.kind === "chips" && (
                        <div className="mt-2 pl-6 flex items-start gap-3 flex-wrap">
                          <ImageUpload value={entries[idx].image || ""} onChange={(img) => setEntries(entries.map((e, i) => (i === idx ? { ...e, image: img } : e)))} hint="Doirada ko'rinadigan rasm" />
                          <div><label className="label">Ko'rinadigan nom (ixtiyoriy)</label>
                            <input className="input !w-52" placeholder={v.value} value={entries[idx].title || ""} onChange={(e) => setEntries(entries.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)))} /></div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {!values.data?.length && <div className="text-sm text-slate-400 py-4">Bu maydonda qiymatlar topilmadi</div>}
              </div>
            )}
            <div className="help">Hech narsa tanlanmasa — eng ko'p uchraydigan qiymatlar avtomatik chiqadi (rasmsiz).</div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button className="btn btn-ghost" onClick={onClose}>Bekor qilish</button>
          <button className="btn btn-primary" disabled={busy} onClick={() => { void save(); }}><Save size={16} /> {busy ? "Saqlanmoqda…" : "Saqlash"}</button>
        </div>
      </div>
    </Modal>
  );
}
