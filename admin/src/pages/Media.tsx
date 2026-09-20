import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ArrowUp, ArrowDown, Pencil, Images } from "lucide-react";
import { api } from "../lib/api.ts";
import { ImageUpload, Modal, PageTitle, Spinner, Toggle, useToast, confirmDialog, isVideoUrl } from "../components/ui.tsx";
import { LinkPicker } from "../components/LinkPicker.tsx";

interface Slide { id: number; image: string; caption: string | null; link: string | null; duration: number; sortOrder: number }
interface Story { id: number; title: string; cover: string; active: boolean; sortOrder: number; expiresAt: string | null; slides: Slide[] }
interface Banner { id: number; image: string; title: string | null; subtitle: string | null; link: string | null; textColor: string; active: boolean; sortOrder: number }

/* ================= STORIS ================= */
export function StoriesPage() {
  const qc = useQueryClient();
  const toast = useToast((s) => s.show);
  const q = useQuery({ queryKey: ["stories"], queryFn: () => api.get<Story[]>("/stories") });
  const [edit, setEdit] = useState<Partial<Story> | null>(null);
  const [slideFor, setSlideFor] = useState<Story | null>(null);
  const [slide, setSlide] = useState<Partial<Slide>>({});
  const refresh = () => qc.invalidateQueries({ queryKey: ["stories"] });

  const saveStory = async () => {
    if (!edit) return;
    if (!edit.title || !edit.cover) { toast("Sarlavha va muqova rasmi kerak", "err"); return; }
    try {
      const body = { title: edit.title, cover: edit.cover, active: edit.active ?? true, expiresAt: edit.expiresAt || null };
      if (edit.id) await api.put(`/stories/${edit.id}`, body); else await api.post("/stories", body);
      setEdit(null); toast("Saqlandi"); await refresh();
    } catch (e) { toast((e as Error).message, "err"); }
  };
  const addSlide = async () => {
    if (!slideFor || !slide.image) { toast("Slayd rasmi kerak", "err"); return; }
    try {
      await api.post(`/stories/${slideFor.id}/slides`, { image: slide.image, caption: slide.caption || null, link: slide.link || null, duration: slide.duration || 5 });
      setSlide({}); toast("Slayd qo'shildi"); await refresh();
      const fresh = await api.get<Story[]>("/stories"); setSlideFor(fresh.find((s) => s.id === slideFor.id) || null);
    } catch (e) { toast((e as Error).message, "err"); }
  };
  const move = async (list: Story[], i: number, dir: -1 | 1) => {
    const ids = list.map((s) => s.id); const j = i + dir; if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await api.post("/stories/reorder", { ids }); await refresh();
  };
  if (q.isLoading) return <Spinner />;
  const list = q.data || [];
  return (
    <div>
      <PageTitle title="Storis" description="Instagram uslubidagi doira storislar. Har bir storisda bir nechta slayd bo'lishi mumkin." actions={<button className="btn btn-primary" onClick={() => setEdit({ active: true })}><Plus size={16} /> Yangi storis</button>} />
      {!list.length && <div className="card p-8 text-center text-slate-500">Hali storis yo'q. "Yangi storis" tugmasini bosing.</div>}
      <div className="grid md:grid-cols-2 gap-3">
        {list.map((s, i) => (
          <div key={s.id} className={`card p-4 flex gap-4 ${!s.active ? "opacity-60" : ""}`}>
            <img src={s.cover} className="w-16 h-16 rounded-full object-cover ring-2 ring-orange-400 ring-offset-2" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{s.title}</div>
              <div className="text-xs text-slate-500">{s.slides.length} ta slayd · {s.active ? "faol" : "o'chirilgan"}{s.expiresAt ? ` · ${new Date(s.expiresAt).toLocaleDateString()} gacha` : ""}</div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {s.slides.map((sl) => isVideoUrl(sl.image) ? <video key={sl.id} src={sl.image} muted className="w-9 h-12 rounded-md object-cover border border-slate-200" /> : <img key={sl.id} src={sl.image} title={`${sl.duration}s`} className="w-9 h-12 rounded-md object-cover border border-slate-200" />)}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                <button className="btn btn-ghost !px-2 !py-1 text-xs" onClick={() => setSlideFor(s)}><Images size={14} /> Slaydlar</button>
                <button className="btn btn-ghost !px-2 !py-1 text-xs" onClick={() => setEdit(s)}><Pencil size={14} /></button>
                <button className="btn btn-ghost !px-2 !py-1 text-xs" onClick={() => { void move(list, i, -1); }}><ArrowUp size={14} /></button>
                <button className="btn btn-ghost !px-2 !py-1 text-xs" onClick={() => { void move(list, i, 1); }}><ArrowDown size={14} /></button>
                <button className="btn btn-danger !px-2 !py-1 text-xs" onClick={() => { if (confirmDialog("O'chirilsinmi?")) void api.del(`/stories/${s.id}`).then(refresh); }}><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Storisni tahrirlash" : "Yangi storis"}>
        {edit && (
          <div className="space-y-4">
            <div><label className="label">Sarlavha (doira ostida)</label><input className="input" value={edit.title || ""} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></div>
            <div><label className="label">Muqova rasmi (doira)</label><ImageUpload value={edit.cover || ""} onChange={(v) => setEdit({ ...edit, cover: v })} hint="Kvadrat rasm tavsiya etiladi" /></div>
            <div><label className="label">Tugash sanasi (ixtiyoriy)</label><input type="datetime-local" className="input max-w-xs" value={edit.expiresAt ? edit.expiresAt.slice(0, 16) : ""} onChange={(e) => setEdit({ ...edit, expiresAt: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
            <Toggle value={edit.active ?? true} onChange={(v) => setEdit({ ...edit, active: v })} label="Faol" />
            <div className="flex justify-end gap-2"><button className="btn btn-ghost" onClick={() => setEdit(null)}>Bekor</button><button className="btn btn-primary" onClick={() => { void saveStory(); }}>Saqlash</button></div>
          </div>
        )}
      </Modal>

      <Modal open={!!slideFor} onClose={() => setSlideFor(null)} title={`Slaydlar — ${slideFor?.title || ""}`} width={720}>
        {slideFor && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {slideFor.slides.map((sl) => (
                <div key={sl.id} className="relative group">
                  {isVideoUrl(sl.image) ? <video src={sl.image} className="w-full aspect-[9/16] object-cover rounded-lg" muted autoPlay loop playsInline /> : <img src={sl.image} className="w-full aspect-[9/16] object-cover rounded-lg" />}
                  <div className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1.5 rounded">{sl.duration}s</div>
                  <button className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-600 text-white items-center justify-center hidden group-hover:flex" onClick={() => { void api.del(`/slides/${sl.id}`).then(async () => { await refresh(); const fresh = await api.get<Story[]>("/stories"); setSlideFor(fresh.find((s) => s.id === slideFor.id) || null); }); }}><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <div className="font-semibold text-sm">Yangi slayd</div>
              <ImageUpload video value={slide.image || ""} onChange={(v) => setSlide({ ...slide, image: v })} hint="Vertikal (9:16) rasm, GIF yoki ovozsiz qisqa video (mp4, 60 MB gacha)" />
              <div className="grid sm:grid-cols-3 gap-3">
                <div><label className="label">Matn (ixtiyoriy)</label><input className="input" value={slide.caption || ""} onChange={(e) => setSlide({ ...slide, caption: e.target.value })} /></div>
                <div className="sm:col-span-3"><label className="label">Havola (ixtiyoriy)</label><LinkPicker value={slide.link || ""} onChange={(v) => setSlide({ ...slide, link: v })} /></div>
                <div><label className="label">Davomiylik (soniya)</label><input type="number" className="input" min={1} max={60} value={slide.duration || 5} onChange={(e) => setSlide({ ...slide, duration: Number(e.target.value) })} /></div>
              </div>
              <button className="btn btn-primary" onClick={() => { void addSlide(); }}><Plus size={16} /> Slayd qo'shish</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ================= BANNERLAR ================= */
export function BannersPage() {
  const qc = useQueryClient();
  const toast = useToast((s) => s.show);
  const q = useQuery({ queryKey: ["banners"], queryFn: () => api.get<Banner[]>("/banners") });
  const [edit, setEdit] = useState<Partial<Banner> | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["banners"] });
  const save = async () => {
    if (!edit?.image) { toast("Rasm kerak", "err"); return; }
    try {
      const body = { image: edit.image, title: edit.title || null, subtitle: edit.subtitle || null, link: edit.link || null, textColor: edit.textColor || "#ffffff", active: edit.active ?? true };
      if (edit.id) await api.put(`/banners/${edit.id}`, body); else await api.post("/banners", body);
      setEdit(null); toast("Saqlandi"); await refresh();
    } catch (e) { toast((e as Error).message, "err"); }
  };
  const move = async (list: Banner[], i: number, dir: -1 | 1) => {
    const ids = list.map((s) => s.id); const j = i + dir; if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await api.post("/banners/reorder", { ids }); await refresh();
  };
  if (q.isLoading) return <Spinner />;
  const list = q.data || [];
  return (
    <div>
      <PageTitle title="Bannerlar" description="Bosh sahifadagi aylanma bannerlar (rasm, GIF yoki ovozsiz video). Havola mahsulot/kategoriya bo'lsa Mini App ichida ochiladi." actions={<button className="btn btn-primary" onClick={() => setEdit({ active: true, textColor: "#ffffff" })}><Plus size={16} /> Yangi banner</button>} />
      <div className="grid md:grid-cols-2 gap-3">
        {list.map((b, i) => (
          <div key={b.id} className={`card overflow-hidden ${!b.active ? "opacity-60" : ""}`}>
            <div className="relative h-36">{isVideoUrl(b.image) ? <video src={b.image} className="w-full h-full object-cover" muted autoPlay loop playsInline /> : <img src={b.image} className="w-full h-full object-cover" />}{(b.title || b.subtitle) && <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent p-4 flex flex-col justify-center" style={{ color: b.textColor }}><div className="font-bold text-lg">{b.title}</div><div className="text-sm opacity-90">{b.subtitle}</div></div>}</div>
            <div className="p-3 flex flex-wrap gap-1.5 items-center">
              <span className="text-xs text-slate-500 flex-1 truncate">{b.link || "havolasiz"}</span>
              <button className="btn btn-ghost !px-2 !py-1 text-xs" onClick={() => setEdit(b)}><Pencil size={14} /></button>
              <button className="btn btn-ghost !px-2 !py-1 text-xs" onClick={() => { void move(list, i, -1); }}><ArrowUp size={14} /></button>
              <button className="btn btn-ghost !px-2 !py-1 text-xs" onClick={() => { void move(list, i, 1); }}><ArrowDown size={14} /></button>
              <button className="btn btn-danger !px-2 !py-1 text-xs" onClick={() => { if (confirmDialog("O'chirilsinmi?")) void api.del(`/banners/${b.id}`).then(refresh); }}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Bannerni tahrirlash" : "Yangi banner"}>
        {edit && (
          <div className="space-y-4">
            <ImageUpload video value={edit.image || ""} onChange={(v) => setEdit({ ...edit, image: v })} hint="Tavsiya: 1200×480 px rasm, GIF yoki qisqa video" />
            <div><label className="label">Sarlavha</label><input className="input" value={edit.title || ""} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></div>
            <div><label className="label">Izoh</label><input className="input" value={edit.subtitle || ""} onChange={(e) => setEdit({ ...edit, subtitle: e.target.value })} /></div>
            <div><label className="label">Havola</label><LinkPicker value={edit.link || ""} onChange={(v) => setEdit({ ...edit, link: v })} /></div>
            <div><label className="label">Matn rangi</label><div className="flex gap-2"><input type="color" value={edit.textColor || "#ffffff"} onChange={(e) => setEdit({ ...edit, textColor: e.target.value })} className="w-10 h-10 rounded-lg border p-0.5" /><input className="input max-w-[140px] font-mono" value={edit.textColor || ""} onChange={(e) => setEdit({ ...edit, textColor: e.target.value })} /></div></div>
            <Toggle value={edit.active ?? true} onChange={(v) => setEdit({ ...edit, active: v })} label="Faol" />
            <div className="flex justify-end gap-2"><button className="btn btn-ghost" onClick={() => setEdit(null)}>Bekor</button><button className="btn btn-primary" onClick={() => { void save(); }}>Saqlash</button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
