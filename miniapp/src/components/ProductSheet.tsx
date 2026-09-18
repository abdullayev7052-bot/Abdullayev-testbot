import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bell, BellRing, Check } from "lucide-react";
import type { Product } from "../lib/api.ts";
import { useT } from "../store/app.ts";
import { useCart } from "../store/cart.ts";
import { haptic } from "../lib/telegram.ts";
import { BottomSheet, Img, QtyStepper, useToast } from "./ui.tsx";
import { useCatalogFmt } from "./ProductCard.tsx";
import { qty as fq } from "../lib/format.ts";

export function ProductSheet({ product, onClose, onWaitlist }: { product: Product | null; onClose: () => void; onWaitlist: (p: Product) => void }) {
  const { t, v } = useT();
  const f = useCatalogFmt();
  const add = useCart((s) => s.add);
  const inCart = useCart((s) => s.items.find((x) => x.productId === product?.id));
  const toast = useToast((s) => s.show);
  const [mode, setMode] = useState<"piece" | "box">("piece");
  const [count, setCount] = useState(1);
  const [img, setImg] = useState(0);
  const [added, setAdded] = useState(false);
  useEffect(() => { setMode("piece"); setCount(1); setImg(0); setAdded(false); }, [product?.id]);

  const boxEnabled = v<boolean>("catalog", "boxModeEnabled", true) && (product?.boxItem || 0) > 0;
  const manual = v<boolean>("catalog", "allowManualQty", true);
  const maxQty = v<number>("catalog", "maxQtyPerItem", 1000);
  const totalQty = mode === "box" ? count * (product?.boxItem || 1) : count;
  const total = (product?.price || 0) * totalQty;
  const out = !!product && product.stock <= 0 && !f.canOrderOut;
  const bullets = useMemo(() => {
    if (!product) return [] as string[];
    const b: string[] = [];
    for (const cf of product.customFields || []) b.push(`${cf.name}: ${cf.value}`);
    if (product.note) for (const line of product.note.split(/\r?\n|•|;/)) { const s = line.trim(); if (s) b.push(s); }
    if (product.categoryName) b.push(`${t("design", "categoriesTitle")}: ${product.categoryName}`);
    if (product.boxItem > 0) b.push(t("catalog", "boxHint", { n: fq(product.boxItem) }));
    if (f.showSku && product.sku) b.push(`SKU: ${product.sku}`);
    return b;
  }, [product, t, f.showSku]);
  const images = (product?.images?.filter(Boolean) as string[] | undefined) || [];
  const st = product ? f.stock(product) : null;

  const submit = () => {
    if (!product) return;
    haptic.success();
    add(product, totalQty, mode === "box" ? count : 0);
    setAdded(true);
    toast(`${t("catalog", "inCartLabel")}: ${product.name} × ${fq(totalQty)}`);
    setTimeout(onClose, 450);
  };

  return (
    <BottomSheet open={!!product} onClose={onClose} full>
      {product && (
        <div className="pb-28">
          {/* Rasm galereyasi */}
          <div className="relative mx-4 mt-1 rounded-2xl overflow-hidden bg-slate-50">
            <AnimatePresence mode="wait">
              <motion.div key={img} initial={{ opacity: 0, scale: 1.02 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                drag={images.length > 1 ? "x" : false} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.15}
                onDragEnd={(_, i) => { if (i.offset.x < -50) setImg((x) => (x + 1) % images.length); else if (i.offset.x > 50) setImg((x) => (x - 1 + images.length) % images.length); }}>
                <Img src={images[img] || product.image} className="w-full aspect-[4/3]" fallback="🛍" />
              </motion.div>
            </AnimatePresence>
            {images.length > 1 && (
              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                {images.map((_, n) => <span key={n} className={`h-1.5 rounded-full transition-all ${n === img ? "w-5 bg-slate-800" : "w-1.5 bg-slate-400/60"}`} />)}
              </div>
            )}
            {st && <span className={`absolute top-3 left-3 text-xs font-semibold px-2.5 py-1 rounded-full ${st.out ? "bg-slate-800 text-white" : "bg-white/90 text-slate-700"}`}>{st.text}</span>}
          </div>

          <div className="px-5 pt-4">
            <div className="text-xl font-bold leading-snug">{product.name}</div>
            <div className="text-2xl font-extrabold mt-1" style={{ color: "var(--primary)" }}>{f.price(product.price)}</div>
            {product.measure && <div className="text-xs text-slate-500 mt-0.5">1 {product.measure}</div>}

            <div className="mt-5">
              <div className="text-sm font-semibold text-slate-700 mb-2">{t("catalog", "descriptionTitle")}</div>
              {bullets.length ? (
                <ul className="space-y-1.5">
                  {bullets.map((b, i) => (
                    <motion.li key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }} className="flex gap-2 text-[15px] text-slate-700">
                      <span className="mt-[9px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--primary)" }} /><span>{b}</span>
                    </motion.li>
                  ))}
                </ul>
              ) : <div className="text-sm text-slate-400">{t("catalog", "noDescription")}</div>}
            </div>

            {!out && (
              <div className="mt-6">
                {boxEnabled && (
                  <div className="flex gap-2 mb-3">
                    {(["piece", "box"] as const).map((m) => (
                      <button key={m} onClick={() => { haptic.select(); setMode(m); setCount(1); }}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${mode === m ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]" : "border-slate-200 text-slate-600"}`}>
                        {m === "piece" ? t("catalog", "pieceLabel") : t("catalog", "boxLabel")}
                        {m === "box" && <span className="block text-[11px] font-normal text-slate-400">{t("catalog", "boxHint", { n: fq(product.boxItem) })}</span>}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-500">
                    {mode === "box" ? `${count} × ${fq(product.boxItem)} = ${fq(totalQty)} ${product.measure || ""}` : inCart ? `${t("catalog", "inCartLabel")}: ${fq(inCart.qty)}` : ""}
                  </div>
                  <QtyStepper value={count} onChange={(n) => setCount(Math.max(1, Math.min(maxQty, n)))} min={1} max={maxQty} size="lg" manual={manual} />
                </div>
              </div>
            )}
          </div>

          {/* Sticky CTA */}
          <div className="fixed left-0 right-0 bottom-0 z-[610] p-4 bg-white/95 backdrop-blur border-t border-slate-100" style={{ paddingBottom: "calc(var(--safe-bottom) + 16px)" }}>
            {out ? (
              f.notifyEnabled ? (
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => { haptic.medium(); onWaitlist(product); }}
                  className={`w-full h-13 py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2 ${product.inWaitlist ? "bg-emerald-50 text-emerald-700" : "bg-slate-900 text-white"}`}>
                  {product.inWaitlist ? <BellRing size={18} /> : <Bell size={18} />}
                  {product.inWaitlist ? t("catalog", "notifiedLabel") : t("catalog", "notifyLabel")}
                </motion.button>
              ) : <div className="w-full py-3.5 rounded-2xl bg-slate-100 text-slate-500 text-center font-semibold">{t("catalog", "outOfStockLabel")}</div>
            ) : (
              <motion.button whileTap={{ scale: 0.97 }} onClick={submit} className="w-full py-3.5 rounded-2xl btn-primary text-base flex items-center justify-center gap-2">
                {added ? <Check size={20} /> : null}
                {t("catalog", "addToCart")} — {f.price(total)}
              </motion.button>
            )}
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
