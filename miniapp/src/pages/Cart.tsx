import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2, MapPin, CheckCircle2, Navigation } from "lucide-react";
import { api, ApiError, type Product } from "../lib/api.ts";
import { ProductSheet } from "../components/ProductSheet.tsx";
import { useWaitlist } from "../store/waitlist.ts";
import { openLink } from "../lib/telegram.ts";
import { useApp, useT } from "../store/app.ts";
import { useCart } from "../store/cart.ts";
import { Page, QtyStepper, Empty, Img, Segmented, ConfirmDialog, SwipeToDelete, useToast } from "../components/ui.tsx";
import { MapPicker } from "../components/MapPicker.tsx";
import { useCatalogFmt } from "../components/ProductCard.tsx";
import { qty as fq } from "../lib/format.ts";
import { closeApp, haptic } from "../lib/telegram.ts";

type Step = "cart" | "checkout" | "success";

export function Cart() {
  const { t, v } = useT();
  const nav = useNavigate();
  const f = useCatalogFmt();
  const cart = useCart();
  const app = useApp();
  const user = app.data!.user;
  const [step, setStep] = useState<Step>("cart");
  const [type, setType] = useState<"delivery" | "pickup">(() => {
    const d = v<"delivery" | "pickup">("checkout", "defaultType", "delivery");
    const del = v<boolean>("checkout", "deliveryEnabled", true), pick = v<boolean>("checkout", "pickupEnabled", true);
    return d === "delivery" && del ? "delivery" : pick ? "pickup" : "delivery";
  });
  const [name, setName] = useState(user.name || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [address, setAddress] = useState(user.address || "");
  const [lat, setLat] = useState<number | null>(user.lat);
  const [lng, setLng] = useState<number | null>(user.lng);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState("");
  const [doneType, setDoneType] = useState<"delivery" | "pickup">("delivery");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [openProduct, setOpenProduct] = useState<Product | null>(null);
  const [addrAuto, setAddrAuto] = useState(false);
  const wl = useWaitlist();
  const toast = useToast((s) => s.show);
  const swipeDelete = v<boolean>("checkout", "swipeDelete", true);
  const itemTap = v<boolean>("checkout", "cartItemTap", true);
  const pickupLoc = v<{ lat: number; lng: number } | null>("checkout", "pickupLocation", null);
  const clearAll = () => {
    if (v<boolean>("checkout", "confirmClear", true)) setConfirmOpen(true);
    else { haptic.medium(); cart.clear(); }
  };
  const openItem = async (productId: number) => {
    if (!itemTap) return;
    try { haptic.light(); setOpenProduct(await api.get<Product>(`/products/${productId}`)); } catch { /* o'chirilgan mahsulot */ }
  };
  const onWaitlist = async (p: Product) => { const next = await wl.toggle(p); toast(next ? t("catalog", "notifiedLabel") : t("catalog", "notifyLabel")); setOpenProduct({ ...p, inWaitlist: next }); };

  // Savatchadagi narx/qoldiqni yangilash
  useEffect(() => {
    if (!cart.items.length) return;
    api.post<{ id: number; price: number; stock: number; name: string; image: string | null; boxItem: number; measure: string | null; available: boolean }[]>("/products/refresh", { ids: cart.items.map((x) => x.productId) })
      .then((rows) => cart.refreshSnapshot(rows)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subtotal = cart.total();
  const fee = useMemo(() => {
    if (type !== "delivery") return 0;
    const fee = v<number>("checkout", "deliveryFee", 0), free = v<number>("checkout", "freeDeliveryFrom", 0);
    if (free > 0 && subtotal >= free) return 0;
    return fee;
  }, [type, subtotal, v]);
  const total = subtotal + fee;
  const delEnabled = v<boolean>("checkout", "deliveryEnabled", true), pickEnabled = v<boolean>("checkout", "pickupEnabled", true);
  const requireLocation = v<boolean>("checkout", "requireLocation", true);
  const mapLat = v<number>("checkout", "mapLat", 40.5286), mapLng = v<number>("checkout", "mapLng", 70.9425);

  const onPick = async (la: number, ln: number) => {
    setLat(la); setLng(ln);
    if (!v<boolean>("checkout", "autoAddress", true)) return;
    try {
      const r = await api.get<{ address: string }>(`/geocode?lat=${la}&lng=${ln}&lang=${f.lang}`);
      if (!r.address) return;
      const overwrite = v<boolean>("checkout", "autoAddressOverwrite", false);
      if (overwrite || addrAuto || !address.trim()) { setAddress(r.address); setAddrAuto(true); }
    } catch { /* ignore */ }
  };

  const submit = async () => {
    setError(null);
    if (!phone.trim()) { setError(t("checkout", "phoneLabel")); return; }
    if (type === "delivery" && !address.trim() && !(lat && lng)) { setError(t("checkout", "addressLabel")); return; }
    if (type === "delivery" && requireLocation && !(lat && lng)) { setError(t("checkout", "mapLabel")); haptic.error(); return; }
    setBusy(true);
    try {
      const r = await api.post<{ ok: true; order: { id: number; number: string; total: number } }>("/orders", {
        items: cart.items.map((x) => ({ productId: x.productId, qty: x.qty, boxCount: x.boxCount || 0 })),
        type, phone, name, address: type === "delivery" ? address : undefined, lat: type === "delivery" ? lat : null, lng: type === "delivery" ? lng : null, comment: comment || undefined,
      });
      haptic.success();
      setOrderNumber(r.order.number);
      setDoneType(type);
      cart.clear();
      app.patchUser({ name, phone, address: type === "delivery" ? address : user.address, lat: type === "delivery" ? lat : user.lat, lng: type === "delivery" ? lng : user.lng });
      setStep("success");
      const sec = v<number>("checkout", "autoCloseSec", 3);
      if (sec > 0) setTimeout(() => closeApp(), sec * 1000);
    } catch (e) {
      haptic.error();
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally { setBusy(false); }
  };

  if (step === "success") {
    return (
      <Page>
        <div className="min-h-[80dvh] flex flex-col items-center justify-center text-center px-8">
          <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 14 }}>
            <CheckCircle2 size={96} className="text-emerald-500" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-2xl font-bold mt-6">{t("checkout", "successTitle")}</motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-slate-500 mt-2 whitespace-pre-line">{t("checkout", doneType === "pickup" ? "successMessagePickup" : "successMessage", { order: orderNumber })}</motion.div>
          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} onClick={() => { nav("/profile"); }} className="mt-8 px-6 py-3 rounded-2xl bg-slate-100 font-semibold">{t("profile", "myOrders")}</motion.button>
        </div>
      </Page>
    );
  }

  if (!cart.items.length) {
    return (
      <Page>
        <div className="wrap safe-top pt-4"><div className="text-2xl font-bold">{t("checkout", "cartTitle")}</div></div>
        <Empty emoji="🛒" title={t("checkout", "emptyCart")} hint={t("checkout", "emptyCartHint")} action={<button onClick={() => nav("/catalog")} className="px-5 py-3 rounded-2xl btn-primary">{t("checkout", "goCatalog")}</button>} />
      </Page>
    );
  }

  return (
    <Page>
      <div className="wrap safe-top pt-4 flex items-center gap-2">
        {step === "checkout" && <button onClick={() => setStep("cart")} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"><ArrowLeft size={18} /></button>}
        <div className="text-2xl font-bold flex-1">{step === "cart" ? t("checkout", "cartTitle") : t("checkout", "checkoutTitle")}</div>
        {step === "cart" && <button onClick={clearAll} className="text-sm text-slate-400 flex items-center gap-1"><Trash2 size={14} />{t("checkout", "clearCart")}</button>}
      </div>

      {step === "cart" ? (
          <motion.div key="cart" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }} className="wrap mt-3 space-y-2.5">
            <AnimatePresence initial={false}>
              {cart.items.map((it) => (
                <motion.div key={it.productId} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0, x: 40 }}>
                <SwipeToDelete enabled={swipeDelete} label={t("checkout", "deleteLabel")} onDelete={() => cart.remove(it.productId)} className="card">
                <div className="p-3 flex gap-3">
                  <button onClick={() => { void openItem(it.productId); }} className="shrink-0"><Img src={it.image} className="w-20 h-20 rounded-xl" /></button>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <button onClick={() => { void openItem(it.productId); }} className="text-left text-sm font-medium line-clamp-2">{it.name}</button>
                    <div className="text-xs text-slate-400 mt-0.5">{f.price(it.price)} × {fq(it.qty)}{it.boxCount ? ` (${it.boxCount} ${t("catalog", "boxLabel").toLowerCase()})` : ""}{it.stock < it.qty ? ` · ⚠️ ${fq(it.stock)}` : ""}</div>
                    <div className="mt-auto flex items-center justify-between pt-1">
                      <div className="font-bold">{f.price(it.price * it.qty)}</div>
                      <QtyStepper size="sm" value={it.qty} onChange={(q) => cart.setQty(it.productId, q)} step={it.boxCount && it.boxItem ? it.boxItem : 1} />
                    </div>
                  </div>
                </div>
                </SwipeToDelete>
                </motion.div>
              ))}
            </AnimatePresence>
            <Summary itemsLabel={t("checkout", "itemsLabel")} subtotal={f.price(subtotal)} count={cart.count()} />
          </motion.div>
        ) : (
          <motion.div key="checkout" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }} className="wrap mt-3 space-y-4">
            {(delEnabled && pickEnabled) && (
              <Segmented value={type} onChange={setType} options={[
                ...(delEnabled ? [{ value: "delivery" as const, label: `🚚 ${t("checkout", "deliveryLabel")}`, hint: t("checkout", "deliveryHint") }] : []),
                ...(pickEnabled ? [{ value: "pickup" as const, label: `🏪 ${t("checkout", "pickupLabel")}`, hint: t("checkout", "pickupHint") }] : []),
              ]} />
            )}
            {type === "pickup" && (
              <div className="card p-4">
                <div className="flex gap-3 items-start"><MapPin className="shrink-0 text-[var(--primary)]" size={20} /><div><div className="text-sm font-semibold">{t("checkout", "pickupLabel")}</div><div className="text-sm text-slate-500">{t("checkout", "pickupAddress")}</div></div></div>
                {v<boolean>("checkout", "pickupShowMap", true) && pickupLoc && pickupLoc.lat && pickupLoc.lng && (
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <button onClick={() => { haptic.light(); openLink(`https://www.google.com/maps/dir/?api=1&destination=${pickupLoc.lat},${pickupLoc.lng}`); }} className="py-2.5 rounded-xl bg-slate-100 text-sm font-semibold flex items-center justify-center gap-1.5"><Navigation size={15} /> Google — {t("checkout", "pickupRouteLabel")}</button>
                    <button onClick={() => { haptic.light(); openLink(`https://yandex.uz/maps/?rtext=~${pickupLoc.lat},${pickupLoc.lng}&rtt=auto`); }} className="py-2.5 rounded-xl bg-slate-100 text-sm font-semibold flex items-center justify-center gap-1.5"><Navigation size={15} /> Yandex — {t("checkout", "pickupRouteLabel")}</button>
                  </div>
                )}
              </div>
            )}
            <div className="card p-4 space-y-3">
              <Field label={t("checkout", "nameLabel")}><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label={t("checkout", "phoneLabel")}><input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 123 45 67" /></Field>
              {type === "delivery" && (
                <>
                  <Field label={t("checkout", "addressLabel")}><input className="input" value={address} onChange={(e) => { setAddress(e.target.value); setAddrAuto(false); }} placeholder={t("checkout", "addressPlaceholder")} /></Field>
                  <div>
                    <div className="text-xs font-semibold text-slate-500 mb-1.5 flex items-center justify-between">
                      <span>{t("checkout", "mapLabel")}{requireLocation && <span className="text-red-500"> *</span>}</span>
                      {lat && lng && <span className="text-emerald-600 font-medium">✓</span>}
                    </div>
                    <MapPicker lat={lat || mapLat} lng={lng || mapLng} zoom={v<number>("checkout", "mapZoom", 13)} onChange={onPick} myLocationLabel={t("checkout", "myLocation")} />
                  </div>
                </>
              )}
              {v<boolean>("checkout", "commentEnabled", true) && (
                <Field label={t("checkout", "commentLabel")}><textarea className="input" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} /></Field>
              )}
            </div>
            <Summary itemsLabel={t("checkout", "itemsLabel")} subtotal={f.price(subtotal)} count={cart.count()}
              fee={type === "delivery" ? { label: t("checkout", "deliveryFeeLabel"), value: fee > 0 ? f.price(fee) : t("checkout", "freeLabel") } : undefined}
              total={{ label: t("checkout", "totalLabel"), value: f.price(total) }} />
            {error && <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-red-50 text-red-600 text-sm p-3">{error}</motion.div>}
          </motion.div>
        )}

      <div className="fixed left-0 right-0 z-[500] p-4 bg-white/95 backdrop-blur border-t border-slate-100" style={{ bottom: "calc(var(--nav-h) + var(--safe-bottom))" }}>
        <div className="flex items-center justify-between mb-2 text-sm"><span className="text-slate-500">{t("checkout", "totalLabel")}</span><span className="text-lg font-bold">{f.price(step === "cart" ? subtotal : total)}</span></div>
        {step === "cart" ? (
          <motion.button whileTap={{ scale: 0.98 }} onClick={() => { haptic.medium(); setStep("checkout"); window.scrollTo({ top: 0 }); }} className="w-full py-3.5 rounded-2xl btn-primary text-base">{t("checkout", "checkoutButton")}</motion.button>
        ) : (
          <motion.button whileTap={{ scale: 0.98 }} disabled={busy} onClick={() => { void submit(); }} className="w-full py-3.5 rounded-2xl btn-primary text-base">{busy ? "⏳" : t("checkout", "confirmButton")}</motion.button>
        )}
      </div>
      <div className="h-24" />
      <ConfirmDialog open={confirmOpen} title={t("checkout", "confirmClearTitle")} text={t("checkout", "confirmClearText")} yes={t("checkout", "yesLabel")} no={t("checkout", "noLabel")}
        onNo={() => setConfirmOpen(false)} onYes={() => { setConfirmOpen(false); haptic.medium(); cart.clear(); }} />
      <ProductSheet product={openProduct} onClose={() => setOpenProduct(null)} onWaitlist={onWaitlist} />
    </Page>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><div className="text-xs font-semibold text-slate-500 mb-1.5">{label}</div>{children}</label>;
}

function Summary({ itemsLabel, subtotal, count, fee, total }: { itemsLabel: string; subtotal: string; count: number; fee?: { label: string; value: string }; total?: { label: string; value: string } }) {
  return (
    <div className="card p-4 text-sm space-y-2">
      <div className="flex justify-between"><span className="text-slate-500">{itemsLabel} ({fq(count)})</span><span className="font-medium">{subtotal}</span></div>
      {fee && <div className="flex justify-between"><span className="text-slate-500">{fee.label}</span><span className="font-medium">{fee.value}</span></div>}
      {total && <div className="flex justify-between border-t border-slate-100 pt-2 text-base"><span className="font-semibold">{total.label}</span><span className="font-bold">{total.value}</span></div>}
    </div>
  );
}
