import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useApp } from "./store/app.ts";
import { BottomNav } from "./components/BottomNav.tsx";
import { Toaster } from "./components/ui.tsx";
import { Home } from "./pages/Home.tsx";
import { Catalog } from "./pages/Catalog.tsx";
import { Cart } from "./pages/Cart.tsx";
import { Profile } from "./pages/Profile.tsx";
import { initTelegram, tg, inTelegram } from "./lib/telegram.ts";

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

function Shell() {
  const loc = useLocation();
  const nav = useNavigate();
  const { data, loading, error, load } = useApp();
  useEffect(() => { initTelegram(); void load(); }, [load]);

  // Telegram "Orqaga" tugmasi
  useEffect(() => {
    if (!tg || !inTelegram) return;
    const back = () => nav(-1);
    if (loc.pathname !== "/") { tg.BackButton.show(); tg.BackButton.onClick(back); } else tg.BackButton.hide();
    const app = tg;
    return () => app.BackButton.offClick(back);
  }, [loc.pathname, nav]);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [loc.pathname]);

  if (loading && !data) return <Splash />;
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
      <AnimatePresence mode="wait" initial={false}>
        <Routes location={loc} key={loc.pathname}>
          <Route path="/" element={<Home />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </AnimatePresence>
      <BottomNav />
      <Toaster />
    </>
  );
}

function Splash() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center">
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: [0.9, 1.05, 1], opacity: 1 }} transition={{ duration: 0.8 }} className="text-6xl">🛍</motion.div>
      <motion.div className="mt-6 h-1 w-28 rounded-full bg-slate-100 overflow-hidden">
        <motion.div className="h-full w-1/2 rounded-full" style={{ background: "var(--primary)" }} animate={{ x: ["-100%", "220%"] }} transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }} />
      </motion.div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter basename="/app">
        <Shell />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
