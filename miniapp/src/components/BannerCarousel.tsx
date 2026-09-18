import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";
import type { Banner } from "../lib/api.ts";
import { useT } from "../store/app.ts";
import { openLink, haptic } from "../lib/telegram.ts";

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const { v } = useT();
  const nav = useNavigate();
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const interval = Math.max(2, v<number>("design", "bannersInterval", 4)) * 1000;
  const height = v<number>("design", "bannersHeight", 160);
  const radius = v<number>("design", "bannersRadius", 20);

  useEffect(() => {
    if (banners.length < 2) return;
    timer.current = setInterval(() => { setDir(1); setI((x) => (x + 1) % banners.length); }, interval);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [banners.length, interval, i]);

  if (!banners.length) return null;
  const b = banners[i];
  const go = (n: number) => { setDir(n > i ? 1 : -1); setI((n + banners.length) % banners.length); };
  const onClick = () => {
    if (!b.link) return;
    haptic.light();
    if (b.link.startsWith("category:")) nav(`/catalog?category=${b.link.slice(9)}`);
    else if (b.link.startsWith("product:")) nav(`/catalog?product=${b.link.slice(8)}`);
    else if (b.link.startsWith("/")) nav(b.link);
    else openLink(b.link);
  };
  return (
    <div className="wrap my-2">
      <div className="relative overflow-hidden" style={{ height, borderRadius: radius }}>
        <AnimatePresence initial={false} custom={dir}>
          <motion.div key={b.id} className="absolute inset-0" custom={dir}
            initial={{ x: dir > 0 ? "100%" : "-100%", opacity: 0.6 }} animate={{ x: 0, opacity: 1 }} exit={{ x: dir > 0 ? "-100%" : "100%", opacity: 0.6 }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            drag={banners.length > 1 ? "x" : false} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.2}
            onDragEnd={(_, info) => { if (info.offset.x < -60) go(i + 1); else if (info.offset.x > 60) go(i - 1); }}
            onClick={onClick}>
            <img src={b.image} alt="" className="w-full h-full object-cover pointer-events-none" draggable={false} />
            {(b.title || b.subtitle) && (
              <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/10 to-transparent p-5 flex flex-col justify-center" style={{ color: b.textColor || "#fff" }}>
                {b.title && <div className="text-xl font-bold drop-shadow leading-tight">{b.title}</div>}
                {b.subtitle && <div className="text-sm opacity-90 mt-1 drop-shadow">{b.subtitle}</div>}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
        {banners.length > 1 && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {banners.map((x, n) => (
              <button key={x.id} onClick={(e) => { e.stopPropagation(); go(n); }} className={`h-1.5 rounded-full transition-all ${n === i ? "w-5 bg-white" : "w-1.5 bg-white/60"}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
