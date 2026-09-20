import { motion } from "motion/react";
import { Plus, Bell, BellRing } from "lucide-react";
import type { Product } from "../lib/api.ts";
import { useT } from "../store/app.ts";
import { useCart } from "../store/cart.ts";
import { money, stockLabel } from "../lib/format.ts";
import { haptic } from "../lib/telegram.ts";
import { Img, QtyStepper } from "./ui.tsx";
import { cardVariants, tapScale } from "../lib/motion.ts";

export function useCatalogFmt() {
  const { t, v, lang } = useT();
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
  return (
    <motion.div layout {...cardVariants(index)} className="card overflow-hidden flex flex-col">
      <motion.button whileTap={{ scale: tapScale() }} onClick={() => { haptic.light(); onOpen(p); }} className="text-left">
        <div className="relative">
          <Img src={p.image} alt={p.name} className={`aspect-square w-full ${out ? "opacity-60 grayscale-[35%]" : ""}`} />
          {st && (
            <span className={`absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.out ? "bg-slate-800/80 text-white" : "bg-white/90 text-slate-700"}`}>{st.text}</span>
          )}
          {p.featured && <span className="absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: "var(--accent)" }}>★</span>}
        </div>
        <div className="px-3 pt-2.5">
          <div className="text-[13px] font-medium leading-snug line-clamp-2 min-h-[36px]">{p.name}</div>
          {f.showSku && p.sku && <div className="text-[11px] text-slate-400 mt-0.5">#{p.sku}</div>}
          <div className="font-bold mt-1">{f.price(p.price)}</div>
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
