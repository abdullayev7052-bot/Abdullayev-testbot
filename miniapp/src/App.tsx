import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useApp } from "./store/app.ts";
import { BottomNav } from "./components/BottomNav.tsx";
import { Toaster } from "./components/ui.tsx";
import { Home } from "./pages/Home.tsx";
import { Catalog } from "./pages/Catalog.tsx";
import { Cart } from "./pages/Cart.tsx";
import { Profile } from "./pages/Profile.tsx";
import { initTelegram, tg, inTelegram, resolveTarget, openLink } from "./lib/telegram.ts";
import { cachedDesign } from "./lib/motion.ts";

const BASENAME = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL.slice(0, -1) : import.meta.env.BASE_URL;
const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

function Shell() {
  const loc = useLocation();
  const nav = useNavigate();
  const { data, loading, error, load } = useApp();
  const [splashDone, setSplashDone] = useState(false);
  useEffect(() => {
    initTelegram(); void load();
    const d = cachedDesign();
    const min = d.splashShow === false ? 0 : Math.max(0, Math.min(5000, Number(d.splashMinMs ?? 600)));
    const t = setTimeout(() => setSplashDone(true), min);
    return () => clearTimeout(t);
  }, [load]);

  // Telegram "Orqaga" tugmasi
  useEffect(() => {
    if (!tg || !inTelegram) return;
    const back = () => nav(-1);
    if (loc.pathname !== "/") { tg.BackButton.show(); tg.BackButton.onClick(back); } else tg.BackButton.hide();
    const app = tg;
    return () => app.BackButton.offClick(back);
  }, [loc.pathname, nav]);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [loc.pathname]);

  // Chuqur havola: ?go=product:ID | category:ID | https://...  (yoki Telegram start_param)
  useEffect(() => {
    if (!data) return;
    const p = new URLSearchParams(window.location.search);
    const raw = p.get("go") || tg?.initDataUnsafe?.start_param || "";
    if (!raw) return;
    const go = raw.replace(/^(product|category)_/, "$1:");
    if (p.has("go")) { p.delete("go"); const q = p.toString(); window.history.replaceState({}, "", window.location.pathname + (q ? "?" + q : "")); }
    const r = resolveTarget(go);
    if (r.path) setTimeout(() => nav(r.path!, { replace: true }), 50);
    else if (r.url) openLink(r.url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!data]);

  if ((loading && !data) || !splashDone) return <Splash />;
  if (error && !data) return (
    <div className="min-h-dvh flex flex-col items-center justify-center text-center p-8">
      <div className="text-5xl mb-3">😕</div>
      <div className="font-semibold">Ma'lumot yuklanmadi</div>
      <div className="text-sm text-slate-500 mt-1">{error}</div>
      <button onClick={() => load()} className="mt-5 px-5 py-3 rounded-2xl btn-primary">Qayta urinish</button>
    </div>
  );
  if (!data) return null;
  return (
    <>
      <div key={loc.pathname}>
        <Routes location={loc}>
          <Route path="/" element={<Home />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </div>
      <BottomNav />
      <Toaster />
    </>
  );
}

function Splash() {
  const d = cachedDesign();
  if (d.splashShow === false) return <div className="min-h-dvh" style={{ background: String(d.splashBg || "#fff") }} />;
  const type = String(d.splashType || "emoji");
  const anim = String(d.splashAnimation || "pulse");
  const size = Number(d.splashImageSize || 96);
  const lang = (localStorage.getItem("lang") || "uz") as "uz" | "ru" | "en";
  const txt = d.splashText && typeof d.splashText === "object" ? (d.splashText as Record<string, string>)[lang] || "" : "";
  const animate: Record<string, unknown> =
    anim === "bounce" ? { y: [0, -18, 0], scale: [1, 1.05, 1] } :
    anim === "spin" ? { rotate: [0, 360] } :
    anim === "fade" ? { opacity: [0.3, 1, 0.3] } :
    anim === "none" ? {} : { scale: [0.92, 1.06, 0.92] };
  const transition = anim === "spin" ? { repeat: Infinity, duration: 1.4, ease: "linear" as const } : { repeat: Infinity, duration: 1.2, ease: "easeInOut" as const };
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center" style={{ background: String(d.splashBg || "#fff") }}>
      {type !== "none" && (
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ opacity: 1, ...animate }} transition={transition}>
          {type === "image" && d.splashImage
            ? <img src={String(d.splashImage)} alt="" style={{ width: size, height: size, objectFit: "contain" }} />
            : <div style={{ fontSize: Math.round(size * 0.66), lineHeight: 1 }}>{String(d.splashEmoji || "🛍")}</div>}
        </motion.div>
      )}
      {txt && <div className="mt-4 text-lg font-semibold" style={{ color: "var(--text)" }}>{txt}</div>}
      <motion.div className="mt-6 h-1 w-28 rounded-full bg-slate-100 overflow-hidden">
        <motion.div className="h-full w-1/2 rounded-full" style={{ background: "var(--primary)" }} animate={{ x: ["-100%", "220%"] }} transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }} />
      </motion.div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter basename={BASENAME}>
        <Shell />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
