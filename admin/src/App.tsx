import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Settings, Plug, ListChecks, Bot, Palette, LayoutGrid, ShoppingCart, User, Images, GalleryHorizontal, Package, Bell, Users, Send, ScrollText, LogOut, Menu, X } from "lucide-react";
import { api } from "./lib/api.ts";
import { Toaster, useToast } from "./components/ui.tsx";
import { Dashboard } from "./pages/Dashboard.tsx";
import { SettingsPage, useSchema } from "./pages/Settings.tsx";
import { StoriesPage, BannersPage } from "./pages/Media.tsx";
import { CatalogPage } from "./pages/Catalog.tsx";
import { ActivityPage, BroadcastPage, GroupsPage, WaitlistPage } from "./pages/Misc.tsx";

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });
const ICONS: Record<string, React.ComponentType<{ size?: number }>> = { settings: Settings, plug: Plug, "list-checks": ListChecks, bot: Bot, palette: Palette, "layout-grid": LayoutGrid, "shopping-cart": ShoppingCart, user: User };

function Login({ onOk }: { onOk: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { await api.post("/login", { password: pw }); onOk(); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={submit} className="card p-8 w-full max-w-sm space-y-4">
        <div className="text-center"><div className="text-4xl mb-2">🛍</div><div className="text-xl font-bold">Admin panel</div><div className="text-sm text-slate-500">Bito Telegram Shop</div></div>
        <div><label className="label">Parol</label><input type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus /></div>
        {err && <div className="text-sm text-red-600">{err}</div>}
        <button className="btn btn-primary w-full justify-center" disabled={busy}>Kirish</button>
        <div className="text-xs text-slate-400 text-center">Boshlang'ich parol .env faylida (ADMIN_PASSWORD)</div>
      </form>
    </div>
  );
}

function Shell({ onLogout }: { onLogout: () => void }) {
  const schema = useSchema();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [loc.pathname]);
  const link = "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100";
  const active = "!bg-blue-600 !text-white";
  const Item = ({ to, icon: Icon, label }: { to: string; icon: React.ComponentType<{ size?: number }>; label: string }) => (
    <NavLink to={to} className={({ isActive }) => `${link} ${isActive ? active : ""}`}><Icon size={17} />{label}</NavLink>
  );
  const nav = (
    <nav className="p-3 space-y-1 text-sm">
      <Item to="/" icon={LayoutDashboard} label="Boshqaruv paneli" />
      <div className="text-[11px] font-semibold text-slate-400 uppercase px-3 pt-4 pb-1">Sozlamalar</div>
      {(schema.data || []).map((s) => <Item key={s.key} to={`/settings/${s.key}`} icon={ICONS[s.icon] || Settings} label={s.title} />)}
      <div className="text-[11px] font-semibold text-slate-400 uppercase px-3 pt-4 pb-1">Kontent</div>
      <Item to="/stories" icon={Images} label="Storis" />
      <Item to="/banners" icon={GalleryHorizontal} label="Bannerlar" />
      <Item to="/catalog" icon={Package} label="Katalog boshqaruvi" />
      <div className="text-[11px] font-semibold text-slate-400 uppercase px-3 pt-4 pb-1">Bot</div>
      <Item to="/waitlist" icon={Bell} label="Kutilayotgan mahsulotlar" />
      <Item to="/groups" icon={Users} label="Guruhlar va xodimlar" />
      <Item to="/broadcast" icon={Send} label="Xabar tarqatish" />
      <Item to="/activity" icon={ScrollText} label="Jurnal" />
      <button onClick={onLogout} className={`${link} w-full mt-4 text-red-600`}><LogOut size={17} /> Chiqish</button>
    </nav>
  );
  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden md:block w-64 shrink-0 bg-white border-r border-slate-200 sticky top-0 h-screen overflow-y-auto">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2"><span className="text-2xl">🛍</span><div><div className="font-bold leading-tight">Bito Shop</div><div className="text-xs text-slate-500">Admin panel</div></div></div>
        {nav}
      </aside>
      <div className="md:hidden sticky top-0 z-50 bg-white border-b border-slate-200 flex items-center justify-between px-4 py-3">
        <div className="font-bold">🛍 Bito Shop</div>
        <button onClick={() => setOpen(!open)} className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center">{open ? <X /> : <Menu />}</button>
      </div>
      {open && <div className="md:hidden fixed inset-0 z-40 bg-white pt-14 overflow-y-auto">{nav}</div>}
      <main className="flex-1 min-w-0 p-4 md:p-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/settings/:section" element={<SettingsPage />} />
          <Route path="/stories" element={<StoriesPage />} />
          <Route path="/banners" element={<BannersPage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/waitlist" element={<WaitlistPage />} />
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/broadcast" element={<BroadcastPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function Root() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => api.get<{ ok: boolean }>("/me"), retry: false });
  const toast = useToast((s) => s.show);
  useEffect(() => {
    const h = () => { qc.setQueryData(["me"], null); };
    window.addEventListener("admin-unauthorized", h);
    return () => window.removeEventListener("admin-unauthorized", h);
  }, []);
  if (me.isLoading) return null;
  if (!me.data) return <Login onOk={() => { qc.setQueryData(["me"], { ok: true }); }} />;
  return <Shell onLogout={() => { void api.post("/logout").then(() => { qc.setQueryData(["me"], null); qc.clear(); toast("Chiqdingiz"); }); }} />;
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter basename="/admin">
        <Root />
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
