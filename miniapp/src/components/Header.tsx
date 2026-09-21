import { motion } from "motion/react";
import { useApp, useT } from "../store/app.ts";
import { StorePicker } from "./StorePicker.tsx";

export function Header() {
  const { t, v } = useT();
  const user = useApp((s) => s.data?.user);
  const theme = useApp((s) => s.theme);
  const showGreeting = v<boolean>("design", "greetingShow", true);
  const showLogo = v<boolean>("design", "logoShow", true);
  const logo = v<string>("design", "logoImage", "");
  const size = v<number>("design", "logoSize", 44);
  const shape = v<string>("design", "logoShape", "circle");
  const pos = v<string>("design", "logoPosition", "right");
  const radius = shape === "circle" ? "50%" : shape === "rounded" ? "14px" : "4px";
  const name = user?.name || "";
  const logoEl = showLogo ? (
    <motion.div initial={{ scale: 0.6, opacity: 0, rotate: -10 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
      className="shrink-0 overflow-hidden flex items-center justify-center" style={{ width: size, height: size, borderRadius: radius, background: v<string>("design", "logoBg", "#f1f5f9") }}>
      {logo ? <img src={logo} alt="logo" className="w-full h-full object-cover" /> : <span style={{ fontSize: size * 0.5 }}>🛍</span>}
    </motion.div>
  ) : null;
  return (<>
    <div className="wrap safe-top pt-4 pb-2 flex items-center justify-between gap-3">
      {pos === "left" && logoEl}
      {showGreeting && (
        <motion.div initial={{ opacity: 0, x: pos === "left" ? 12 : -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35 }} className="min-w-0 flex-1">
          <div className="font-bold leading-tight truncate" style={{ fontSize: v<number>("design", "greetingSize", 20), color: theme === "dark" ? "var(--text)" : v<string>("design", "greetingColor", "#0f172a") }}>
            {t("design", "greetingText", { name })}
          </div>
          <div className="text-sm text-slate-500 mt-0.5 truncate">{t("design", "greetingSub")}</div>
        </motion.div>
      )}
      {pos !== "left" && logoEl}
    </div>
    <StorePicker />
  </>
  );
}
