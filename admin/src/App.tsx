import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Settings, Plug, ListChecks, Bot, Palette, LayoutGrid, ShoppingCart, User, Images, GalleryHorizontal, Package, Bell, Users, Send, ScrollText, LogOut, Menu, X, Moon, Sun } from "lucide-react";
import { api } from "./lib/api.ts";
import { Toaster, useToast } from "./components/ui.tsx";
import { Dashboard } from "./pages/Dashboard.tsx";
import { SettingsPage, useSchema } from "./pages/Settings.tsx";
import { StoriesPage, BannersPage } from "./pages/Media.tsx";
import { useLang, useT, type UiLang } from "./lib/i18n.ts";
import { CatalogPage } from "./pages/Catalog.tsx";
import { ActivityPage, BroadcastPage, GroupsPage, WaitlistPage } from "./pages/Misc.tsx";

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });
const ICONS: Record<string, React.ComponentType<{ size?: number }>> = { settings: Settings, plug: Plug, "list-checks": ListChecks, bot: Bot, palette: Palette, "layout-grid": LayoutGrid, "shopping-cart": ShoppingCart, user: User, "layout-dashboard": LayoutDashboard };

interface Branding { title?: string; subtitle?: string; businessName?: string; emoji?: string; logo?: string; primaryColor?: string; darkMode?: string }

function useBranding() {
  return useQuery({ queryKey: ["branding"], queryFn: () => api.get<Branding>("/branding"), staleTime: 60000, retry: 0 });
}

function useTheme(branding?: Branding) {
  const mode = branding?.darkMode || "user";
  const [pref, setPref] = useState<"light" | "dark">(() => (localStorage.getItem("admin-theme") === "dark" ? "dark" : "light"));
  const theme = mode === "dark" ? "dark" : mode === "light" ? "light" : mode === "auto" ? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light") : pref;
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0b1220" : branding?.primaryColor || "#2563eb");
  }, [theme, branding?.primaryColor]);
  useEffect(() => { if (branding?.primaryColor) document.documentElement.style.setProperty("--primary", branding.primaryColor); }, [branding?.primaryColor]);
  const toggle = () => { const n = pref === "dark" ? "light" : "dark"; localStorage.setItem("admin-theme", n); setPref(n); };
  return { theme, toggle, canToggle: mode === "user" };
}

function Logo({ b, size = 32 }: { b?: Branding; size?: number }) {
  if (b?.logo) return <img src={b.logo} alt="" style={{ width: size, height: size }} className="rounded-lg object-cover" />;
  return <span style={{ fontSize: size * 0.8, lineHeight: 1 }}>{b?.emoji || "🛍"}</span>;
}

function Login({ onOk, b }: { onOk: () => void; b?: Branding }) {
  const t = useT();
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
        <div className="text-center"><div className="mb-2 flex justify-center"><Logo b={b} size={56} /></div><div className="text-xl font-bold">{b?.title || "Admin panel"}</div><div className="text-sm text-slate-500">{b?.businessName || ""}</div></div>
        <div><label className="label">{t("password")}</label><input type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus /></div>
        {err && <div className="text-sm text-red-600">{err}</div>}
        <button className="btn btn-primary w-full justify-center" disabled={busy}>{t("login")}</button>
      </form>
    </div>
  );
}

function Shell({ onLogout, b, theme }: { onLogout: () => void; b?: Branding; theme: ReturnType<typeof useTheme> }) {
  const schema = useSchema();
  const loc = useLocation();
  const t = useT();
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [loc.pathname]);
  const link = "flex items-center gap-2.5 px-3 py-2.5 md:py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100";
  const active = "!bg-[var(--primary)] !text-white";
  const Item = ({ to, icon: Icon, label }: { to: string; icon: React.ComponentType<{ size?: number }>; label: string }) => (
    <NavLink to={to} className={({ isActive }) => `${link} ${isActive ? active : ""}`}><Icon size={17} />{label}</NavLink>
  );
  const nav = (
    <nav className="p-3 space-y-1 text-sm">
      <Item to="/" icon={LayoutDashboard} label={t("dashboard")} />
      <div className="text-[11px] font-semibold text-slate-400 uppercase px-3 pt-4 pb-1">{t("settings")}</div>
      {(schema.data || []).map((s) => <Item key={s.key} to={`/settings/${s.key}`} icon={ICONS[s.icon] || Settings} label={t(`sec.${s.key}`, s.title)} />)}
      <div className="text-[11px] font-semibold text-slate-400 uppercase px-3 pt-4 pb-1">{t("content")}</div>
      <Item to="/stories" icon={Images} label={t("stories")} />
      <Item to="/banners" icon={GalleryHorizontal} label={t("banners")} />
      <Item to="/catalog" icon={Package} label={t("catalog")} />
      <div className="text-[11px] font-semibold text-slate-400 uppercase px-3 pt-4 pb-1">{t("bot")}</div>
      <Item to="/waitlist" icon={Bell} label={t("waitlist")} />
      <Item to="/groups" icon={Users} label={t("groups")} />
      <Item to="/broadcast" icon={Send} label={t("broadcast")} />
      <Item to="/activity" icon={ScrollText} label={t("activity")} />
      {theme.canToggle && <button onClick={theme.toggle} className={`${link} w-full mt-2`}>{theme.theme === "dark" ? <Sun size={17} /> : <Moon size={17} />} {theme.theme === "dark" ? t("light") : t("dark")}</button>}
      <div className="flex items-center gap-1 px-3 pt-3"><span className="text-xs text-slate-400 mr-1">{t("language")}:</span>{(["uz", "ru", "en"] as UiLang[]).map((l) => <button key={l} onClick={() => setLang(l)} className={`text-xs px-2 py-1 rounded-md ${lang === l ? "bg-[var(--primary)] text-white" : "bg-slate-100 text-slate-600"}`}>{l.toUpperCase()}</button>)}</div>
      <button onClick={onLogout} className={`${link} w-full mt-2 text-red-600`}><LogOut size={17} /> {t("logout")}</button>
    </nav>
  );
  const brand = (
    <div className="flex items-center gap-2 min-w-0"><Logo b={b} /><div className="min-w-0"><div className="font-bold leading-tight truncate">{b?.title || "Admin"}</div><div className="text-xs text-slate-500 truncate">{b?.subtitle || ""}</div></div></div>
  );
  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden md:block w-64 shrink-0 bg-white border-r border-slate-200 sticky top-0 h-screen overflow-y-auto">
        <div className="px-5 py-4 border-b border-slate-100">{brand}</div>
        {nav}
      </aside>
      <div className="md:hidden sticky top-0 z-50 bg-white border-b border-slate-200 flex items-center justify-between px-3 py-2" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)" }}>
        {brand}
        <div className="flex items-center gap-1">
          {theme.canToggle && <button onClick={theme.toggle} className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center">{theme.theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>}
          <button onClick={() => setOpen(!open)} className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center">{open ? <X /> : <Menu />}</button>
        </div>
      </div>
      {open && <div className="md:hidden fixed inset-0 z-40 bg-white pt-16 overflow-y-auto">{nav}</div>}
      <main className="flex-1 min-w-0 p-3 md:p-8">
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
  const branding = useBranding();
  const theme = useTheme(branding.data);
  const toast = useToast((s) => s.show);
  useEffect(() => {
    const h = () => { qc.setQueryData(["me"], null); };
    window.addEventListener("admin-unauthorized", h);
    return () => window.removeEventListener("admin-unauthorized", h);
  }, []);
  useEffect(() => { document.title = branding.data?.title || "Admin panel"; }, [branding.data?.title]);
  if (me.isLoading) return null;
  if (!me.data) return <Login b={branding.data} onOk={() => { qc.setQueryData(["me"], { ok: true }); }} />;
  return <Shell b={branding.data} theme={theme} onLogout={() => { void api.post("/logout").then(() => { qc.setQueryData(["me"], null); qc.clear(); toast("Chiqdingiz"); }); }} />;
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
