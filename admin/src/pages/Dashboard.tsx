import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Bot, Globe, Plug, RefreshCw, Users, Package, ShoppingBag, Bell, Link2, Copy } from "lucide-react";
import { api } from "../lib/api.ts";
import { PageTitle, Spinner, useToast } from "../components/ui.tsx";

interface Status {
  bot: { username: string; name: string } | null; publicUrl: string; port: number; appUrl: string | null;
  bito: { connected: boolean; apiKeyLogin: string; organizationId: string; priceId: string; warehouseId: string };
  sync: { running: boolean; last: { at: string; ok: boolean; message: string } | null };
  webhook: { destination: string; secret: string; at: string; error?: string } | null;
  counts: { users: number; registered: number; products: number; orders: number; ordersToday: number; waitlist: number; groups: number };
  activity: { id: number; type: string; message: string; createdAt: string }[];
}

export function Dashboard() {
  const qc = useQueryClient();
  const toast = useToast((s) => s.show);
  const st = useQuery({ queryKey: ["status"], queryFn: () => api.get<Status>("/status"), refetchInterval: 15000 });
  const [url, setUrl] = useState("");
  if (st.isLoading || !st.data) return <Spinner />;
  const d = st.data;
  const copy = (t: string) => { navigator.clipboard.writeText(t).then(() => toast("Nusxalandi")); };
  const setPublic = async () => {
    try { await api.post("/public-url", { url }); toast("Saqlandi"); await qc.invalidateQueries({ queryKey: ["status"] }); } catch (e) { toast((e as Error).message, "err"); }
  };
  const Tile = ({ icon, label, value, to }: { icon: React.ReactNode; label: string; value: React.ReactNode; to?: string }) => {
    const body = <div className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow"><div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">{icon}</div><div><div className="text-xs text-slate-500">{label}</div><div className="text-lg font-bold">{value}</div></div></div>;
    return to ? <Link to={to}>{body}</Link> : body;
  };
  return (
    <div>
      <PageTitle title="Boshqaruv paneli" description="Tizim holati va tezkor ma'lumotlar" actions={<button className="btn btn-ghost" onClick={() => qc.invalidateQueries({ queryKey: ["status"] })}><RefreshCw size={16} /> Yangilash</button>} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Tile icon={<Users size={20} />} label="Ro'yxatdan o'tganlar" value={`${d.counts.registered} / ${d.counts.users}`} />
        <Tile icon={<ShoppingBag size={20} />} label="Buyurtmalar (bugun / jami)" value={`${d.counts.ordersToday} / ${d.counts.orders}`} />
        <Tile icon={<Package size={20} />} label="Mahsulotlar (Bito)" value={d.counts.products} to="/catalog" />
        <Tile icon={<Bell size={20} />} label="Kutilayotgan mahsulotlar" value={d.counts.waitlist} to="/waitlist" />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5 space-y-3">
          <div className="font-semibold flex items-center gap-2"><Bot size={18} /> Telegram bot</div>
          {d.bot ? <div className="text-sm">@{d.bot.username} — <span className="text-emerald-600 font-medium">ishlayapti</span></div> : <div className="text-sm text-red-600">Bot ulanmagan (.env → BOT_TOKEN)</div>}
          <div className="text-sm">Ruxsat etilgan guruhlar: <b>{d.counts.groups}</b> <Link className="text-blue-600 ml-1" to="/groups">sozlash →</Link></div>
          <div className="font-semibold flex items-center gap-2 pt-2"><Globe size={18} /> Ommaviy manzil (ngrok)</div>
          {d.publicUrl ? (
            <div className="text-sm space-y-1">
              <div className="flex items-center gap-2"><code className="bg-slate-100 px-2 py-0.5 rounded">{d.publicUrl}</code><button className="text-slate-400 hover:text-slate-700" onClick={() => copy(d.publicUrl)}><Copy size={14} /></button></div>
              <div>Mini App: <code className="bg-slate-100 px-2 py-0.5 rounded">{d.appUrl}</code> <button className="text-slate-400 hover:text-slate-700" onClick={() => copy(d.appUrl || "")}><Copy size={14} /></button></div>
              <div className="text-emerald-600">✅ Botdagi "Buyurtma berish" tugmasi shu manzilga ulangan</div>
            </div>
          ) : (
            <div className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3">ngrok topilmadi. Terminalda <code>ngrok http {d.port}</code> ni ishga tushiring — manzil avtomatik aniqlanadi. Yoki qo'lda kiriting:</div>
          )}
          <div className="flex gap-2"><input className="input" placeholder="https://xxxx.ngrok-free.app" value={url} onChange={(e) => setUrl(e.target.value)} /><button className="btn btn-ghost" onClick={() => { void setPublic(); }}>Saqlash</button></div>
        </div>
        <div className="card p-5 space-y-3">
          <div className="font-semibold flex items-center gap-2"><Plug size={18} /> Bito integratsiyasi</div>
          {d.bito.connected ? <div className="text-sm">Akkaunt: <b>{d.bito.apiKeyLogin}</b> — <span className="text-emerald-600 font-medium">ulangan</span></div> : <div className="text-sm text-red-600">API kalit kiritilmagan. <Link className="text-blue-600" to="/settings/bito">Sozlash →</Link></div>}
          <div className="text-sm">Oxirgi sinxronizatsiya: {d.sync.last ? <span className={d.sync.last.ok ? "text-emerald-600" : "text-red-600"}>{d.sync.last.message} ({new Date(d.sync.last.at).toLocaleTimeString()})</span> : "—"}{d.sync.running && " ⏳"}</div>
          <div className="text-sm flex items-start gap-2"><Link2 size={16} className="mt-0.5 shrink-0" /><span>Webhook: {d.webhook ? (d.webhook.error ? <span className="text-red-600">xato — {d.webhook.error}</span> : <span className="text-emerald-600">ulangan ({d.webhook.destination})</span>) : <span className="text-slate-500">ulanmagan (ngrok manzili kerak)</span>}</span></div>
          <div className="flex gap-2 pt-1">
            <button className="btn btn-ghost" onClick={() => { void api.post("/bito/sync").then(() => { toast("Sinxronlandi"); qc.invalidateQueries({ queryKey: ["status"] }); }); }}><RefreshCw size={16} /> Sinxronlash</button>
            <Link className="btn btn-ghost" to="/settings/bito">Sozlamalar</Link>
          </div>
        </div>
      </div>
      <div className="card p-5 mt-4">
        <div className="font-semibold mb-3">So'nggi faoliyat</div>
        <div className="divide-y divide-slate-100 text-sm">
          {d.activity.map((a) => (
            <div key={a.id} className="py-2 flex gap-3"><span className="text-slate-400 w-36 shrink-0">{new Date(a.createdAt).toLocaleString()}</span><span className={`badge ${/error|missing/.test(a.type) ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600"}`}>{a.type}</span><span>{a.message}</span></div>
          ))}
          {!d.activity.length && <div className="text-slate-400 py-4">Hali faoliyat yo'q</div>}
        </div>
      </div>
    </div>
  );
}
