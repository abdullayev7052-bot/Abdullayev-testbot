import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus, Send, MessageSquare, Users } from "lucide-react";
import { api } from "../lib/api.ts";
import { ImageUpload, PageTitle, Spinner, Toggle, useToast, confirmDialog } from "../components/ui.tsx";
import { LinkPicker } from "../components/LinkPicker.tsx";

/* ============ Kutilayotgan mahsulotlar ============ */
interface W { id: number; createdAt: string; notifiedAt: string | null; product: { id: number; name: string; stock: number; image: string | null }; user: { id: number; name: string | null; phone: string | null; username: string | null; telegramId: string } }
export function WaitlistPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["waitlist"], queryFn: () => api.get<W[]>("/waitlist"), refetchInterval: 30000 });
  if (q.isLoading) return <Spinner />;
  const list = q.data || [];
  const pending = list.filter((w) => !w.notifiedAt);
  const done = list.filter((w) => w.notifiedAt);
  const Row = ({ w }: { w: W }) => (
    <div className="flex items-center gap-3 px-3 py-2">
      {w.product.image ? <img src={w.product.image} className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 rounded-lg bg-slate-100" />}
      <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{w.product.name}</div><div className="text-xs text-slate-500">qoldiq: {w.product.stock} · {new Date(w.createdAt).toLocaleString()}</div></div>
      <div className="text-sm text-right"><div>{w.user.name || "—"}{w.user.username ? ` (@${w.user.username})` : ""}</div><div className="text-xs text-slate-500">{w.user.phone || w.user.telegramId}</div></div>
      {w.notifiedAt ? <span className="badge bg-emerald-50 text-emerald-700">xabar berildi</span> : <span className="badge bg-amber-50 text-amber-700">kutilmoqda</span>}
      <button className="w-8 h-8 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50" onClick={() => { if (confirmDialog("O'chirilsinmi?")) void api.del(`/waitlist/${w.id}`).then(() => qc.invalidateQueries({ queryKey: ["waitlist"] })); }}><Trash2 size={16} /></button>
    </div>
  );
  return (
    <div>
      <PageTitle title="Kutilayotgan mahsulotlar" description="Mijozlar 'Kelganda eslating' tugmasini bosgan mahsulotlar. Bito'da qoldiq paydo bo'lishi bilan mijozga avtomatik xabar boradi." />
      <div className="card mb-4"><div className="px-3 py-2 font-semibold text-sm border-b border-slate-100">Kutilmoqda ({pending.length})</div><div className="divide-y divide-slate-100">{pending.map((w) => <Row key={w.id} w={w} />)}{!pending.length && <div className="p-6 text-center text-slate-400 text-sm">Hozircha yo'q</div>}</div></div>
      <div className="card"><div className="px-3 py-2 font-semibold text-sm border-b border-slate-100">Xabar berilganlar ({done.length})</div><div className="divide-y divide-slate-100">{done.map((w) => <Row key={w.id} w={w} />)}{!done.length && <div className="p-6 text-center text-slate-400 text-sm">Hozircha yo'q</div>}</div></div>
    </div>
  );
}

/* ============ Guruhlar va xodimlar ============ */
interface G { id: number; chatId: string; title: string | null; enabled: boolean; createdAt: string }
interface S { id: number; telegramId: string; name: string | null; username: string | null; role: string }
export function GroupsPage() {
  const qc = useQueryClient();
  const toast = useToast((s) => s.show);
  const groups = useQuery({ queryKey: ["groups"], queryFn: () => api.get<G[]>("/groups"), refetchInterval: 15000 });
  const staff = useQuery({ queryKey: ["staff"], queryFn: () => api.get<S[]>("/staff") });
  const [chatId, setChatId] = useState("");
  const [st, setSt] = useState({ telegramId: "", name: "", username: "" });
  if (groups.isLoading || staff.isLoading) return <Spinner />;
  return (
    <div className="max-w-4xl">
      <PageTitle title="Guruhlar va xodimlar" description="Buyurtmalar tushadigan Telegram guruhlari va holatni o'zgartira oladigan xodimlar" />
      <div className="card p-5 mb-4">
        <div className="font-semibold flex items-center gap-2 mb-1"><MessageSquare size={18} /> Buyurtmalar guruhlari</div>
        <div className="text-sm text-slate-500 mb-3">Botni guruhga qo'shing va <b>administrator</b> qiling — guruh shu ro'yxatda paydo bo'ladi. Keyin uni yoqing. Guruh ID sini bilish uchun guruhda <code>/id</code> yozing.</div>
        <div className="divide-y divide-slate-100">
          {(groups.data || []).map((g) => (
            <div key={g.id} className="flex items-center gap-3 py-2">
              <div className="flex-1"><div className="font-medium text-sm">{g.title || "Guruh"}</div><div className="text-xs text-slate-500 font-mono">{g.chatId}</div></div>
              <Toggle value={g.enabled} onChange={(v) => { void api.put(`/groups/${g.id}`, { enabled: v }).then(() => qc.invalidateQueries({ queryKey: ["groups"] })); }} label={g.enabled ? "Yoqilgan" : "O'chirilgan"} />
              <button className="btn btn-ghost !py-1 !px-2 text-xs" onClick={() => { void api.post<{ ok: boolean; error?: string }>(`/groups/${g.id}/test`).then((r) => toast(r.ok ? "✅ Test xabar yuborildi" : "❌ " + r.error, r.ok ? "ok" : "err")); }}><Send size={14} /> Test</button>
              <button className="w-8 h-8 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50" onClick={() => { if (confirmDialog("O'chirilsinmi?")) void api.del(`/groups/${g.id}`).then(() => qc.invalidateQueries({ queryKey: ["groups"] })); }}><Trash2 size={16} /></button>
            </div>
          ))}
          {!groups.data?.length && <div className="py-4 text-sm text-slate-400">Bot hali hech qanday guruhga qo'shilmagan.</div>}
        </div>
        <div className="flex gap-2 mt-3"><input className="input max-w-xs font-mono" placeholder="-1001234567890" value={chatId} onChange={(e) => setChatId(e.target.value)} /><button className="btn btn-ghost" onClick={() => { void api.post("/groups", { chatId: chatId.trim() }).then(() => { setChatId(""); qc.invalidateQueries({ queryKey: ["groups"] }); }).catch((e) => toast(e.message, "err")); }}><Plus size={16} /> ID bo'yicha qo'shish</button></div>
      </div>
      <div className="card p-5">
        <div className="font-semibold flex items-center gap-2 mb-1"><Users size={18} /> Xodimlar</div>
        <div className="text-sm text-slate-500 mb-3">"Bot matnlari → Guruh sozlamalari → Holatni kim o'zgartira oladi" bo'limida <b>Faqat xodimlar</b> tanlangan bo'lsa, faqat shu ro'yxatdagilar tugmalarni bosa oladi. Telegram ID ni bilish uchun botga <code>/id</code> yozing.</div>
        <div className="divide-y divide-slate-100">
          {(staff.data || []).map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-2">
              <div className="flex-1"><div className="font-medium text-sm">{s.name || "—"} {s.username ? <span className="text-slate-400">@{s.username}</span> : null}</div><div className="text-xs text-slate-500 font-mono">{s.telegramId} · {s.role}</div></div>
              <button className="w-8 h-8 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50" onClick={() => { if (confirmDialog("O'chirilsinmi?")) void api.del(`/staff/${s.id}`).then(() => qc.invalidateQueries({ queryKey: ["staff"] })); }}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
        <div className="grid sm:grid-cols-4 gap-2 mt-3">
          <input className="input font-mono" placeholder="Telegram ID" value={st.telegramId} onChange={(e) => setSt({ ...st, telegramId: e.target.value })} />
          <input className="input" placeholder="Ismi" value={st.name} onChange={(e) => setSt({ ...st, name: e.target.value })} />
          <input className="input" placeholder="username (@siz)" value={st.username} onChange={(e) => setSt({ ...st, username: e.target.value })} />
          <button className="btn btn-primary" onClick={() => { void api.post("/staff", { telegramId: st.telegramId.trim(), name: st.name, username: st.username.replace("@", "") }).then(() => { setSt({ telegramId: "", name: "", username: "" }); qc.invalidateQueries({ queryKey: ["staff"] }); }).catch((e) => toast(e.message, "err")); }}><Plus size={16} /> Qo'shish</button>
        </div>
      </div>
    </div>
  );
}

/* ============ Xabar tarqatish ============ */
export function BroadcastPage() {
  const toast = useToast((s) => s.show);
  const [text, setText] = useState("");
  const [media, setMedia] = useState("");
  const [hd, setHd] = useState(false);
  const [language, setLanguage] = useState("all");
  const [buttonText, setButtonText] = useState("");
  const [buttonTarget, setButtonTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!text.trim()) return;
    if (buttonText.trim() && (!buttonTarget || buttonTarget === "product:" || buttonTarget === "category:" || buttonTarget === "https://")) { toast("Tugma uchun havola/mahsulot/kategoriyani tanlang", "err"); return; }
    if (!confirmDialog("Barcha ro'yxatdan o'tgan mijozlarga yuborilsinmi?")) return;
    setBusy(true);
    try {
      const r = await api.post<{ total: number }>("/broadcast", { text, media: media || undefined, hd, language, buttonText: buttonText.trim() || undefined, buttonTarget: buttonText.trim() ? buttonTarget : undefined });
      toast(`Yuborilmoqda: ${r.total} ta mijoz`); setText(""); setMedia(""); setButtonText(""); setButtonTarget("");
    } catch (e) { toast((e as Error).message, "err"); } finally { setBusy(false); }
  };
  return (
    <div className="max-w-2xl">
      <PageTitle title="Post — xabar tarqatish" description="Barcha ro'yxatdan o'tgan mijozlarga bot orqali xabar (aksiya, yangilik) yuborish" />
      <div className="card p-5 space-y-4">
        <div><label className="label">Matn (HTML: &lt;b&gt;, &lt;i&gt;, &lt;a href&gt;)</label><textarea className="input" rows={6} value={text} onChange={(e) => setText(e.target.value)} /></div>
        <div><label className="label">Rasm / video / GIF (ixtiyoriy, 60 MB gacha)</label><ImageUpload video value={media} onChange={setMedia} hint="Video — mp4 tavsiya etiladi. Telegram'ga bir marta yuklanadi, keyin hammaga tez tarqatiladi." /></div>
        {media && !/\.(mp4|webm|mov|gif)$/i.test(media) && <Toggle value={hd} onChange={setHd} label="Rasmni siqmasdan, asl sifatda (fayl sifatida) yuborish" />}
        <div className="card p-4 space-y-3 bg-slate-50">
          <div className="font-semibold text-sm">Xabar ostidagi tugma (ixtiyoriy)</div>
          <div><label className="label">Tugma matni</label><input className="input" placeholder="Masalan: 🛍 Buyurtma berish" value={buttonText} onChange={(e) => setButtonText(e.target.value)} /></div>
          <div><label className="label">Tugma qayerga olib boradi</label><LinkPicker value={buttonTarget} onChange={setButtonTarget} /></div>
          <div className="help">Mahsulot yoki kategoriya tanlansa — mijoz tugmani bosganda Mini App ochilib, to'g'ridan-to'g'ri o'sha mahsulot/kategoriya ko'rsatiladi.</div>
        </div>
        <div><label className="label">Kimlarga</label><select className="input max-w-xs" value={language} onChange={(e) => setLanguage(e.target.value)}><option value="all">Barchaga</option><option value="uz">Faqat o'zbek tilidagilarga</option><option value="ru">Faqat rus tilidagilarga</option><option value="en">Faqat ingliz tilidagilarga</option></select></div>
        <button className="btn btn-primary" disabled={busy || !text.trim()} onClick={() => { void send(); }}><Send size={16} /> Yuborish</button>
      </div>
    </div>
  );
}

/* ============ Jurnal ============ */
interface A { id: number; type: string; message: string; createdAt: string }
export function ActivityPage() {
  const q = useQuery({ queryKey: ["activity"], queryFn: () => api.get<A[]>("/activity?limit=300"), refetchInterval: 10000 });
  if (q.isLoading) return <Spinner />;
  return (
    <div>
      <PageTitle title="Jurnal" description="Bot va integratsiya faoliyati" />
      <div className="card divide-y divide-slate-100 text-sm">
        {(q.data || []).map((a) => (
          <div key={a.id} className="py-2 px-3 flex gap-3"><span className="text-slate-400 w-40 shrink-0">{new Date(a.createdAt).toLocaleString()}</span><span className={`badge ${/error|missing/.test(a.type) ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600"}`}>{a.type}</span><span>{a.message}</span></div>
        ))}
      </div>
    </div>
  );
}
