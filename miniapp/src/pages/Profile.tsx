import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Package, Receipt, Wallet, CreditCard, MapPin, Globe, LifeBuoy, RefreshCw, Moon, Sun, Heart } from "lucide-react";
import { api, type BalanceLine, type Lang, type OrderRow, type Purchase, type Product } from "../lib/api.ts";
import { useApp, useT } from "../store/app.ts";
import { useCart } from "../store/cart.ts";
import { Page, BottomSheet, Skeleton, Empty, Img, useToast } from "../components/ui.tsx";
import { ProductCard, useCatalogFmt } from "../components/ProductCard.tsx";
import { ProductSheet } from "../components/ProductSheet.tsx";
import { MapPicker } from "../components/MapPicker.tsx";
import { fmtDate, qty as fq, LANG_NAMES } from "../lib/format.ts";
import { haptic, openLink } from "../lib/telegram.ts";
import { StorePicker } from "../components/StorePicker.tsx";
import { track } from "../lib/analytics.ts";

type Sheet = null | "orders" | "purchases" | "card" | "address" | "language" | "favorites";

const STAGE_COLORS: Record<string, string> = {
  new: "bg-blue-50 text-blue-700", accepted: "bg-indigo-50 text-indigo-700", ready: "bg-amber-50 text-amber-700",
  delivering: "bg-purple-50 text-purple-700", done: "bg-emerald-50 text-emerald-700", canceled: "bg-red-50 text-red-600", other: "bg-slate-100 text-slate-600",
};

export function Profile() {
  const { t, v, lang } = useT();
  const app = useApp();
  const user = app.data!.user;
  const f = useCatalogFmt();
  const nav = useNavigate();
  const [sheet, setSheetRaw] = useState<Sheet>(null);
  const setSheet = (s: Sheet) => { if (s === "orders") track("order_history"); else if (s === "purchases") track("purchases"); else if (s === "card") track("card"); else if (s === "favorites") track("favorites_open"); setSheetRaw(s); };
  useEffect(() => { track("profile_open"); }, []);
  const [orderOpen, setOrderOpen] = useState<OrderRow | null>(null);
  const [productOpen, setProductOpen] = useState<Product | null>(null);
  const toast = useToast((s) => s.show);
  const cart = useCart();

  const balance = useQuery({ queryKey: ["balance"], queryFn: () => api.get<{ linked: boolean; balances: BalanceLine[] }>("/balance"), enabled: v<boolean>("profile", "showBalance", true), staleTime: 30000 });
  const orders = useQuery({ queryKey: ["orders"], queryFn: () => api.get<{ items: OrderRow[] }>("/orders"), enabled: sheet === "orders", staleTime: 10000 });
  const purchases = useQuery({ queryKey: ["purchases"], queryFn: () => api.get<{ items: Purchase[] }>("/purchases"), enabled: sheet === "purchases", staleTime: 30000 });
  const card = useQuery({ queryKey: ["card"], queryFn: () => api.get<{ card: string | null; png: string | null; name: string }>("/card"), enabled: sheet === "card", staleTime: 300000 });

  const reorder = async (o: OrderRow) => {
    const ids = o.items.map((i) => i.productId).filter(Boolean);
    if (!ids.length) return;
    const rows = await api.post<{ id: number; price: number; stock: number; name: string; image: string | null; boxItem: number; measure: string | null; available: boolean }[]>("/products/refresh", { ids });
    let added = 0;
    for (const it of o.items) {
      const r = rows.find((x) => x.id === it.productId);
      if (!r || !r.available) continue;
      cart.add({ id: r.id, name: r.name, price: r.price, image: r.image, measure: r.measure, boxItem: r.boxItem, stock: r.stock } as Product, it.qty, it.boxCount || 0);
      added++;
    }
    haptic.success();
    toast(t("profile", "reorderDone"));
    if (added) { setOrderOpen(null); setSheet(null); nav("/cart"); }
  };

  const balanceText = (b: BalanceLine) => b.amount < 0 ? `${t("profile", "debt")}: ${f.price(Math.abs(b.amount))}` : b.amount > 0 ? `${t("profile", "credit")}: ${f.price(b.amount)}` : t("profile", "noDebt");

  const favoritesEnabled = v<boolean>("catalog", "favoritesEnabled", true);
  const favorites = useQuery({ queryKey: ["favorites"], queryFn: () => api.get<{ enabled: boolean; items: Product[] }>("/favorites"), enabled: sheet === "favorites", staleTime: 10000 });
  const rows: { icon: React.ReactNode; label: string; onClick: () => void; show: boolean }[] = [
    { icon: <Package size={20} />, label: t("profile", "myOrders"), onClick: () => setSheet("orders"), show: true },
    { icon: <Heart size={20} />, label: t("catalog", "favoritesTitle"), onClick: () => setSheet("favorites"), show: favoritesEnabled },
    { icon: <Receipt size={20} />, label: t("profile", "purchases"), onClick: () => setSheet("purchases"), show: v<boolean>("profile", "showPurchases", true) },
    { icon: <CreditCard size={20} />, label: t("profile", "card"), onClick: () => setSheet("card"), show: v<boolean>("profile", "showCard", true) },
    { icon: <MapPin size={20} />, label: t("profile", "address"), onClick: () => setSheet("address"), show: v<boolean>("profile", "showAddress", true) },
    { icon: <Globe size={20} />, label: `${t("profile", "language")} · ${LANG_NAMES[lang]}`, onClick: () => setSheet("language"), show: v<boolean>("profile", "showLanguage", true) },
  ];
  const themeMode = v<string>("design", "darkMode", "user");
  const theme = useApp((s) => s.theme);
  const setTheme = useApp((s) => s.setTheme);
  const supportTg = v<string>("general", "supportTelegram", "");
  const supportPhone = v<string>("general", "supportPhone", "");

  return (
    <Page>
      <div className="wrap safe-top pt-4">
        <div className="text-2xl font-bold mb-3">{t("profile", "title")}</div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-4 flex items-center gap-3">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold text-white" style={{ background: "var(--primary)" }}>{(user.name || "?").slice(0, 1).toUpperCase()}</div>
          <div className="min-w-0"><div className="font-bold text-lg truncate">{user.name || "—"}</div><div className="text-sm text-slate-500">{user.phone || ""}</div></div>
        </motion.div>

        {v<boolean>("profile", "showBalance", true) && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card p-4 mt-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-600"><Wallet size={16} /> {t("profile", "balance")}</div>
            {balance.isLoading ? <Skeleton className="h-6 w-40 mt-2" /> : !balance.data?.balances?.length ? <div className="mt-2 text-emerald-600 font-semibold">{t("profile", "noDebt")}</div> : (
              <div className="mt-2 space-y-1.5">
                {balance.data.balances.map((b, i) => (
                  <div key={i} className="flex items-center justify-between"><span className="text-sm text-slate-500">{b.organization}</span><span className={`font-bold ${b.amount < 0 ? "text-red-600" : "text-emerald-600"}`}>{balanceText(b)}</span></div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        <div className="card mt-3 overflow-hidden">
          {rows.filter((r) => r.show).map((r, i) => (
            <motion.button key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }} onClick={() => { haptic.light(); r.onClick(); }}
              className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 last:border-0 active:bg-slate-50 text-left">
              <span className="text-[var(--primary)]">{r.icon}</span><span className="flex-1 font-medium">{r.label}</span><ChevronRight size={18} className="text-slate-300" />
            </motion.button>
          ))}
          <StorePicker inline />
          {themeMode === "user" && (
            <button onClick={() => { haptic.select(); setTheme(theme === "dark" ? "light" : "dark"); }} className="w-full flex items-center gap-3 px-4 py-3.5 border-t border-slate-100 text-left">
              <span className="text-[var(--primary)]">{theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}</span><span className="flex-1 font-medium">{t("design", "darkToggleLabel")}</span>
              <span className={`relative w-11 h-6 rounded-full transition-colors ${theme === "dark" ? "bg-[var(--primary)]" : "bg-slate-300"}`}><span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${theme === "dark" ? "left-[22px]" : "left-0.5"}`} /></span>
            </button>
          )}
          {(supportTg || supportPhone) && (
            <button onClick={() => openLink(supportTg ? `https://t.me/${supportTg.replace("@", "")}` : `tel:${supportPhone}`)} className="w-full flex items-center gap-3 px-4 py-3.5 border-t border-slate-100 text-left">
              <span className="text-[var(--primary)]"><LifeBuoy size={20} /></span><span className="flex-1 font-medium">{t("profile", "support")}</span><span className="text-sm text-slate-400">{supportTg ? `@${supportTg.replace("@", "")}` : supportPhone}</span>
            </button>
          )}
        </div>
      </div>

      {/* Buyurtmalar */}
      <BottomSheet open={sheet === "orders"} onClose={() => setSheet(null)} title={t("profile", "myOrders")} full>
        <div className="px-4 pb-8 space-y-2.5">
          {orders.isLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />) : !orders.data?.items.length ? <Empty emoji="📦" title={t("profile", "noOrders")} /> : orders.data.items.map((o, i) => (
            <motion.button key={`${o.source}-${o.id}-${o.number}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 * i }} onClick={() => setOrderOpen(o)} className="card w-full p-3.5 text-left">
              <div className="flex items-center justify-between"><div className="font-bold">#{o.number}</div><span className={`text-xs font-semibold px-2 py-1 rounded-full ${STAGE_COLORS[o.stage] || STAGE_COLORS.other}`}>{o.status}</span></div>
              <div className="text-xs text-slate-400 mt-1">{fmtDate(o.date)} · {o.items.length} · {o.type === "pickup" ? "🏪" : "🚚"}</div>
              <div className="font-semibold mt-1">{f.price(o.total)}</div>
            </motion.button>
          ))}
        </div>
      </BottomSheet>

      {/* Buyurtma tafsiloti */}
      <BottomSheet open={!!orderOpen} onClose={() => setOrderOpen(null)} title={orderOpen ? `${t("profile", "orderDetails")} #${orderOpen.number}` : ""}>
        {orderOpen && (
          <div className="px-4 pb-8">
            <div className="flex items-center justify-between mb-3"><span className="text-sm text-slate-500">{fmtDate(orderOpen.date)}</span><span className={`text-xs font-semibold px-2 py-1 rounded-full ${STAGE_COLORS[orderOpen.stage] || STAGE_COLORS.other}`}>{orderOpen.status}</span></div>
            <div className="space-y-2">
              {orderOpen.items.map((it, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Img src={it.image} className="w-12 h-12 rounded-xl shrink-0" />
                  <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{it.name}</div><div className="text-xs text-slate-400">{fq(it.qty)} × {f.price(it.price)}</div></div>
                  <div className="font-semibold text-sm">{f.price(it.price * it.qty)}</div>
                </div>
              ))}
            </div>
            {orderOpen.address && <div className="text-sm text-slate-500 mt-3">📍 {orderOpen.address}</div>}
            {orderOpen.comment && <div className="text-sm text-slate-500 mt-1">💬 {orderOpen.comment}</div>}
            <div className="flex justify-between font-bold text-lg mt-4 border-t border-slate-100 pt-3"><span>{t("checkout", "totalLabel")}</span><span>{f.price(orderOpen.total)}</span></div>
            <motion.button whileTap={{ scale: 0.98 }} onClick={() => { void reorder(orderOpen); }} className="w-full mt-4 py-3.5 rounded-2xl btn-primary flex items-center justify-center gap-2"><RefreshCw size={18} /> {t("profile", "reorder")}</motion.button>
          </div>
        )}
      </BottomSheet>

      {/* Istaklarim */}
      <BottomSheet open={sheet === "favorites"} onClose={() => setSheet(null)} title={t("catalog", "favoritesTitle")} full>
        <div className="px-4 pb-8">
          {favorites.isLoading ? (
            <div className="grid grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-52" />)}</div>
          ) : !favorites.data?.items.length ? (
            <Empty emoji="❤️" title={t("catalog", "favoritesEmpty")} hint={t("catalog", "favoritesEmptyHint")} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {favorites.data.items.map((p, i) => (
                <ProductCard key={p.id} p={p} index={i} onOpen={setProductOpen} onWaitlist={() => {}} />
              ))}
            </div>
          )}
        </div>
      </BottomSheet>
      <ProductSheet product={productOpen} onClose={() => { setProductOpen(null); void favorites.refetch(); }} onWaitlist={() => {}} />

      {/* Xaridlar */}
      <BottomSheet open={sheet === "purchases"} onClose={() => setSheet(null)} title={t("profile", "purchases")} full>
        <div className="px-4 pb-8 space-y-2.5">
          {purchases.isLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />) : !purchases.data?.items.length ? <Empty emoji="🧾" title={t("profile", "noPurchases")} /> : purchases.data.items.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 * i }} className="card p-3.5">
              <div className="flex items-center justify-between"><div className="font-bold">№{p.number} {p.isRefund && "↩️"}</div><div className="font-semibold">{f.price(p.total)}</div></div>
              <div className="text-xs text-slate-400 mt-1">{fmtDate(p.date)}{p.seller ? ` · ${p.seller}` : ""}{p.debt > 0 ? ` · ${t("profile", "debt")}: ${f.price(p.debt)}` : ""}</div>
            </motion.div>
          ))}
        </div>
      </BottomSheet>

      {/* Karta */}
      <BottomSheet open={sheet === "card"} onClose={() => setSheet(null)} title={t("profile", "card")}>
        <div className="px-4 pb-10 flex flex-col items-center">
          {card.isLoading ? <Skeleton className="h-32 w-full" /> : card.data?.png ? (
            <motion.div initial={{ rotateX: 40, opacity: 0 }} animate={{ rotateX: 0, opacity: 1 }} className="w-full rounded-2xl p-4 text-white" style={{ background: "linear-gradient(135deg, var(--primary), #0f172a)" }}>
              <div className="text-sm opacity-80">{card.data.name}</div>
              <div className="bg-white rounded-xl p-2 mt-3"><img src={card.data.png} alt="barcode" className="w-full" /></div>
              <div className="text-center font-mono tracking-widest mt-2 text-lg">{card.data.card}</div>
            </motion.div>
          ) : <Empty emoji="💳" title={t("profile", "card")} hint="—" />}
        </div>
      </BottomSheet>

      {/* Manzil */}
      <BottomSheet open={sheet === "address"} onClose={() => setSheet(null)} title={t("profile", "address")}><AddressEditor onDone={() => setSheet(null)} /></BottomSheet>

      {/* Til */}
      <BottomSheet open={sheet === "language"} onClose={() => setSheet(null)} title={t("profile", "language")}>
        <div className="px-4 pb-8 space-y-2">
          {(v<Lang[]>("general", "enabledLanguages", ["uz", "ru", "en"]) || ["uz", "ru", "en"]).map((l) => (
            <button key={l} onClick={() => { haptic.select(); app.setLang(l); setSheet(null); }} className={`w-full p-4 rounded-2xl border text-left font-semibold ${l === lang ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]" : "border-slate-200"}`}>{LANG_NAMES[l]}</button>
          ))}
        </div>
      </BottomSheet>
    </Page>
  );
}

function AddressEditor({ onDone }: { onDone: () => void }) {
  const { t, v } = useT();
  const app = useApp();
  const user = app.data!.user;
  const toast = useToast((s) => s.show);
  const [address, setAddress] = useState(user.address || "");
  const [lat, setLat] = useState<number | null>(user.lat);
  const [lng, setLng] = useState<number | null>(user.lng);
  const save = async () => {
    await api.put("/profile", { address, lat, lng });
    app.patchUser({ address, lat, lng });
    haptic.success(); toast(t("profile", "saved")); onDone();
  };
  return (
    <div className="px-4 pb-8 space-y-3">
      <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t("checkout", "addressPlaceholder")} />
      <MapPicker lat={lat || v<number>("checkout", "mapLat", 40.5286)} lng={lng || v<number>("checkout", "mapLng", 70.9425)} zoom={v<number>("checkout", "mapZoom", 13)} onChange={(la, ln) => { setLat(la); setLng(ln); }} myLocationLabel={t("checkout", "myLocation")} />
      <button onClick={() => { void save(); }} className="w-full py-3.5 rounded-2xl btn-primary">{t("profile", "save")}</button>
    </div>
  );
}
