import { motion } from "motion/react";
import { Plus, Bell, BellRing, Heart } from "lucide-react";
import type { Product } from "../lib/api.ts";
import { useApp, useT } from "../store/app.ts";
import { themedColor } from "../lib/colors.ts";
import { useCart } from "../store/cart.ts";
import { money, stockLabel } from "../lib/format.ts";
import { haptic } from "../lib/telegram.ts";
import { Img, QtyStepper } from "./ui.tsx";
import { cardVariants, tapScale } from "../lib/motion.ts";
import { useFavorites } from "../store/favorites.ts";

export function useCatalogFmt() {
  const { t, v, lang } = useT();
  const theme = useApp((s) => s.theme);
  const suffix = t("general", "currencySuffix");
  const decimals = v<number>("general", "priceDecimals", 0);
  const steps = String(v<string>("catalog", "rangeSteps", "10,50")).split(",").map((x) => Number(x.trim())).filter((x) => x > 0);
  return {
    lang,
    price: (n: number) => money(n, suffix, decimals),
    stock: (p: Product) => stockLabel(p.stock, { mode: v<string>("catalog", "stockDisplay", "range"), steps, inStock: t("catalog", "inStockLabel"), outOfStock: t("catalog", "outOfStockLabel"), measure: p.measure }),
    canOrderOut: v<boolean>("catalog", "allowOrderOutOfStock", false),
    notifyEnabled: v<boolean>("catalog", "notifyEnabled", true),
    quickAdd: v<boolean>("catalog", "quickAddEnabled", true),
    favoritesEnabled: v<boolean>("catalog", "favoritesEnabled", true),
    faceLabelShow: v<boolean>("catalog", "faceLabelShow", false),
    faceSize: v<number>("catalog", "faceSize", 12),
    faceStyle: {
      color: themedColor(theme, v<string>("catalog", "faceColor", ""), v<string>("catalog", "faceColorDark", ""), "var(--muted)"),
      fontSize: v<number>("catalog", "faceSize", 12),
      fontWeight: v<string>("catalog", "faceWeight", "500"),
      fontStyle: v<boolean>("catalog", "faceItalic", false) ? "italic" : "normal",
    } as React.CSSProperties,
    nameSize: v<number>("catalog", "nameSize", 13),
    nameColorResolved: themedColor(theme, v<string>("catalog", "nameColor", ""), v<string>("catalog", "nameColorDark", ""), "var(--text)"),
    detailLabelColor: themedColor(theme, v<string>("catalog", "detailLabelColor", ""), v<string>("catalog", "detailLabelColorDark", ""), "var(--muted)"),
    detailValueColor: themedColor(theme, v<string>("catalog", "detailValueColor", ""), v<string>("catalog", "detailValueColorDark", ""), "var(--text)"),
    placeholderNameColor: themedColor(theme, v<string>("catalog", "placeholderNameColor", ""), v<string>("catalog", "placeholderNameColorDark", ""), "var(--text)"),
    nameWeight: v<string>("catalog", "nameWeight", "500"),
    /** Karta yuzida qo'shimcha matn sozlanganmi — barcha kartochkalarda joy ajratiladi */
    faceConfigured: ((v<{ face?: boolean; show?: boolean }[]>("catalog", "productFields", []) || []).some((f) => f?.face && f?.show !== false)),
    showSku: v<boolean>("catalog", "showSku", false),
  };
}

export function ProductCard({ p, onOpen, onWaitlist, index = 0 }: { p: Product; onOpen: (p: Product) => void; onWaitlist: (p: Product) => void; index?: number }) {
  const { t } = useT();
  const f = useCatalogFmt();
  const item = useCart((s) => s.items.find((x) => x.productId === p.id));
  const add = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);
  const st = f.stock(p);
  const out = p.stock <= 0 && !f.canOrderOut;
  // Uzun nomlar uchun shriftni biroz kichraytiramiz (kartochkalar bir xil bo'lib qolsin)
  const len = p.name.length;
  const shrink = len > 64 ? 0.8 : len > 46 ? 0.87 : len > 32 ? 0.93 : 1;
  const fontSize = Math.max(10, Math.round(f.nameSize * shrink * 10) / 10);
  const lineHeight = 1.25;
  const nameBox = Math.round(fontSize * lineHeight * 2);
  // Tungi rejimda yorug' rejim rangi qo'llanilmaydi — aks holda matn ko'rinmay qoladi
  const nameStyle: React.CSSProperties = { color: f.nameColorResolved, fontSize, fontWeight: f.nameWeight, lineHeight };
  const fav = useFavorites((s) => s.isFav(p));
  const toggleFav = useFavorites((s) => s.toggle);
  return (
    <motion.div layout {...cardVariants(index)} className="card overflow-hidden flex flex-col h-full">
      <motion.button whileTap={{ scale: tapScale() }} onClick={() => { haptic.light(); onOpen(p); }} className="text-left">
        <div className="relative">
          <Img src={p.image} alt={p.name} name={p.name} className={`aspect-square w-full ${out ? "opacity-60 grayscale-[35%]" : ""}`} />
          {st && (
            <span className={`absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.out ? "bg-slate-800/80 text-white" : "bg-white/90 text-slate-700"}`}>{st.text}</span>
          )}
          {f.favoritesEnabled && (
            <motion.span role="button" whileTap={{ scale: 0.8 }} onClick={(e) => { e.stopPropagation(); haptic.light(); void toggleFav(p); }}
              className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-white/85 backdrop-blur flex items-center justify-center shadow-sm">
              <Heart size={17} className={fav ? "fill-red-500 text-red-500" : "text-slate-400"} />
            </motion.span>
          )}
          {p.discountPercent ? <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: "var(--accent)" }}>-{p.discountPercent}%</span> : p.featured && <span className="absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: "var(--accent)" }}>★</span>}
        </div>
        <div className="px-3 pt-2.5">
          {/* Nomi doim 2 qatorga sig'adi: uzun bo'lsa shrift avtomatik kichrayadi, ortiqchasi kesiladi */}
          <div className="line-clamp-2 overflow-hidden" style={{ ...nameStyle, height: nameBox }}>{p.name}</div>
          {(p.face?.value || f.faceConfigured) ? (
            <div className="line-clamp-1 overflow-hidden mt-0.5" style={{ ...f.faceStyle, height: Math.round(f.faceSize * 1.35) }}>
              {p.face?.value ? `${f.faceLabelShow ? `${p.face.label}: ` : ""}${p.face.value}` : ""}
            </div>
          ) : null}
          {f.showSku && p.sku && <div className="text-[11px] text-slate-400 mt-0.5">#{p.sku}</div>}
          <div className="font-bold mt-1 flex items-baseline gap-1.5 flex-wrap">{f.price(p.price)}{p.discountPercent && p.basePrice ? <span className="text-[11px] font-normal text-slate-400 line-through">{f.price(p.basePrice)}</span> : null}</div>
        </div>
      </motion.button>
      <div className="px-3 pb-3 pt-2 mt-auto">
        {out ? (
          f.notifyEnabled ? (
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => { haptic.medium(); onWaitlist(p); }}
              className={`w-full h-9 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 ${p.inWaitlist ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
              {p.inWaitlist ? <BellRing size={14} /> : <Bell size={14} />}
              {p.inWaitlist ? t("catalog", "notifiedLabel") : t("catalog", "notifyLabel")}
            </motion.button>
          ) : <div className="h-9" />
        ) : item ? (
          <div className="flex justify-center"><QtyStepper size="sm" value={item.qty} onChange={(q) => setQty(p.id, q)} manual={false} /></div>
        ) : f.quickAdd ? (
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => { haptic.medium(); add(p, 1); }}
            className="w-full h-9 rounded-xl btn-primary flex items-center justify-center gap-1 text-sm"><Plus size={18} strokeWidth={2.5} /></motion.button>
        ) : (
          <button onClick={() => onOpen(p)} className="w-full h-9 rounded-xl bg-slate-100 text-sm font-semibold">{t("catalog", "addToCart")}</button>
        )}
      </div>
    </motion.div>
  );
}
