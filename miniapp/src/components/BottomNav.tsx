import { NavLink, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { Home, Search, ShoppingCart, User } from "lucide-react";
import { useT } from "../store/app.ts";
import { useCart } from "../store/cart.ts";
import { haptic } from "../lib/telegram.ts";

export function BottomNav() {
  const { t } = useT();
  const count = useCart((s) => s.items.reduce((a, x) => a + x.qty, 0));
  const loc = useLocation();
  const items = [
    { to: "/", icon: Home, label: t("design", "navHome") },
    { to: "/catalog", icon: Search, label: t("design", "navCatalog") },
    { to: "/cart", icon: ShoppingCart, label: t("design", "navCart"), badge: count },
    { to: "/profile", icon: User, label: t("design", "navProfile") },
  ];
  return (
    <nav className="fixed left-0 right-0 bottom-0 z-[500] bg-white/90 backdrop-blur-xl border-t border-slate-100" style={{ paddingBottom: "var(--safe-bottom)" }}>
      <div className="grid grid-cols-4" style={{ height: "var(--nav-h)" }}>
        {items.map((it) => {
          const active = it.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(it.to);
          return (
            <NavLink key={it.to} to={it.to} onClick={() => haptic.select()} className="relative flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium">
              <div className="relative">
                <motion.div animate={{ scale: active ? 1.08 : 1, y: active ? -1 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  className={`w-12 h-8 rounded-2xl flex items-center justify-center ${active ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "text-slate-400"}`}>
                  <it.icon size={22} strokeWidth={active ? 2.4 : 2} />
                </motion.div>
                <motion.span initial={false} animate={{ scale: it.badge ? 1 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 18 }}
                  className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--accent)] text-white text-[10px] font-bold flex items-center justify-center">
                  {it.badge ? (it.badge > 99 ? "99+" : it.badge) : ""}
                </motion.span>
              </div>
              <span className={active ? "text-[var(--primary)]" : "text-slate-400"}>{it.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
