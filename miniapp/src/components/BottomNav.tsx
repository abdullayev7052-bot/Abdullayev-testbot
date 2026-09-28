import { NavLink, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { Home, Search, ShoppingCart, User } from "lucide-react";
import { useApp, useT } from "../store/app.ts";
import { useCart } from "../store/cart.ts";
import { haptic } from "../lib/telegram.ts";

export function BottomNav() {
  const { t, v } = useT();
  const count = useCart((s) => s.items.reduce((a, x) => a + x.qty, 0));
  const loc = useLocation();
  // Ulashish rejimidagi admin uchun faqat katalog va savatcha
  const shareAdmin = useApp((s) => !!s.data?.user.shareAdmin);
  const items = shareAdmin
    ? [
      { to: "/catalog", icon: Search, label: t("design", "navCatalog") },
      { to: "/cart", icon: ShoppingCart, label: t("design", "navCart"), badge: count },
    ]
    : [
      { to: "/", icon: Home, label: t("design", "navHome") },
      { to: "/catalog", icon: Search, label: t("design", "navCatalog") },
      { to: "/cart", icon: ShoppingCart, label: t("design", "navCart"), badge: count },
      { to: "/profile", icon: User, label: t("design", "navProfile") },
    ];
  const activeStyle = v<string>("design", "navActive", "pill");
  const labels = v<boolean>("design", "navLabels", true);
  const iconSize = v<number>("design", "navIconSize", 22);
  const floating = v<string>("design", "navStyle", "glass") === "floating";
  return (
    <nav className="fixed bottom-0 z-[500]" style={{
      left: "var(--nav-margin)", right: "var(--nav-margin)", bottom: floating ? "calc(var(--safe-bottom) + 8px)" : "0",
      paddingBottom: floating ? "0" : "var(--safe-bottom)",
      background: "var(--nav-bg)", backdropFilter: "var(--nav-blur)", WebkitBackdropFilter: "var(--nav-blur)",
      borderTop: floating ? "none" : "var(--nav-border)", border: floating ? "var(--nav-border)" : undefined,
      borderRadius: "var(--nav-radius)", boxShadow: "var(--nav-shadow)", overflow: "hidden",
    }}>
      <div className={`grid ${items.length === 2 ? "grid-cols-2" : "grid-cols-4"}`} style={{ height: "var(--nav-h)" }}>
        {items.map((it) => {
          const active = it.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(it.to);
          return (
            <NavLink key={it.to} to={it.to} onClick={() => haptic.select()} className="relative flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium">
              {active && activeStyle === "line" && <motion.span layoutId="nav-line" className="absolute top-0 w-10 h-[3px] rounded-b-full" style={{ background: "var(--primary)" }} />}
              <div className="relative">
                <motion.div animate={{ scale: active ? 1.08 : 1, y: active ? -1 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  className={`w-12 h-8 rounded-2xl flex items-center justify-center ${active ? (activeStyle === "pill" ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "text-[var(--primary)]") : "text-slate-400"}`}>
                  <it.icon size={iconSize} strokeWidth={active ? 2.4 : 2} />
                </motion.div>
                {active && activeStyle === "dot" && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full" style={{ background: "var(--primary)" }} />}
                <motion.span initial={false} animate={{ scale: it.badge ? 1 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 18 }}
                  className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--accent)] text-white text-[10px] font-bold flex items-center justify-center">
                  {it.badge ? (it.badge > 99 ? "99+" : it.badge) : ""}
                </motion.span>
              </div>
              {labels && <span className={active ? "text-[var(--primary)]" : "text-slate-400"}>{it.label}</span>}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
