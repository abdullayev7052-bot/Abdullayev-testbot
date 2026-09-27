import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, type TargetAndTransition } from "motion/react";
import { useNavigate } from "react-router-dom";
import type { Banner } from "../lib/api.ts";
import { useT } from "../store/app.ts";
import { openLink, haptic, resolveTarget } from "../lib/telegram.ts";
import { Media } from "./ui.tsx";
import { track } from "../lib/analytics.ts";

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const { v } = useT();
  const nav = useNavigate();
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const interval = Math.max(2, v<number>("design", "bannersInterval", 4)) * 1000;
  const height = v<number>("design", "bannersHeight", 160);
  const radius = v<number>("design", "bannersRadius", 20);
  const anim = v<string>("design", "bannersAnimation", "slide");
  const speed = v<number>("design", "bannersSpeed", 420) / 1000;
  const dots = v<string>("design", "bannersDots", "inside");
  const autoplay = v<boolean>("design", "bannersAutoplay", true);
  const peek = v<number>("design", "bannersPeek", 16);
  const gap = v<number>("design", "bannersGap", 10);

  useEffect(() => {
    if (banners.length < 2 || !autoplay) return;
    timer.current = setInterval(() => { setDir(1); setI((x) => (x + 1) % banners.length); }, interval);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [banners.length, interval, i, autoplay]);

  if (!banners.length) return null;
  const go = (t: number) => { setDir(t > i ? 1 : -1); setI((t + banners.length) % banners.length); };
  const open = (b: Banner) => {
    haptic.light();
    track("banner_click", { bannerId: b.id, link: b.link || "", products: b.productIds?.length || 0 });
    // Bannerga mahsulotlar biriktirilgan bo'lsa — katalogda aynan o'shalar ko'rsatiladi
    if (b.productIds?.length) { nav(`/catalog?ids=${b.productIds.join(",")}`); return; }
    if (!b.link) return;
    const r = resolveTarget(b.link);
    if (r.path) nav(r.path); else if (r.url) openLink(r.url);
  };

  const Slide = ({ b }: { b: Banner }) => <Media src={b.image} className="w-full h-full object-cover pointer-events-none" />;

  // ---- Karusel: barcha bannerlar yonma-yon, yonidagilari ko'rinib turadi ----
  if (anim === "carousel") {
    return (
      <div className="my-2">
        <div className="overflow-hidden" style={{ paddingLeft: 16, paddingRight: 16 }}>
          <motion.div className="flex" style={{ gap }} animate={{ x: -i * 1 + "%" }} transition={{ duration: 0 }}>
            <motion.div className="flex w-full" style={{ gap }}
              animate={{ x: `calc(${-i * 100}% - ${i * gap}px)` }} transition={{ type: "spring", stiffness: 300, damping: 34, duration: speed }}
              drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={1} dragMomentum={false} dragTransition={{ bounceStiffness: 500, bounceDamping: 40 }}
              onDragEnd={(_, info) => { if (info.offset.x < -50) go(i + 1); else if (info.offset.x > 50) go(i - 1); }}>
              {banners.map((b) => (
                <div key={b.id} className="shrink-0 relative overflow-hidden" style={{ width: `calc(100% - ${peek}px)`, height, borderRadius: radius }} onClick={() => open(b)}>
                  <Slide b={b} />
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
        <Dots banners={banners} i={i} go={go} dots={dots} inside={false} />
      </div>
    );
  }

  const b = banners[i];
  const variants: Record<string, { initial: TargetAndTransition; animate: TargetAndTransition; exit: TargetAndTransition }> = {
    slide: { initial: { x: dir > 0 ? "100%" : "-100%", opacity: 0.6 }, animate: { x: 0, opacity: 1 }, exit: { x: dir > 0 ? "-100%" : "100%", opacity: 0.6 } },
    fade: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } },
    stack: { initial: { y: "22%", scale: 0.92, opacity: 0 }, animate: { y: 0, scale: 1, opacity: 1 }, exit: { y: "-8%", scale: 0.96, opacity: 0 } },
    zoom: { initial: { scale: 1.12, opacity: 0 }, animate: { scale: 1, opacity: 1 }, exit: { scale: 0.94, opacity: 0 } },
    flip: { initial: { rotateY: dir > 0 ? 65 : -65, opacity: 0 }, animate: { rotateY: 0, opacity: 1 }, exit: { rotateY: dir > 0 ? -65 : 65, opacity: 0 } },
    none: { initial: {}, animate: {}, exit: {} },
  };
  const vr = variants[anim] || variants.slide;

  return (
    <div className="wrap my-2">
      <div className="relative overflow-hidden" style={{ height, borderRadius: radius, perspective: anim === "flip" ? 900 : undefined }}>
        <AnimatePresence initial={false} custom={dir} mode={anim === "fade" || anim === "zoom" ? "sync" : "sync"}>
          <motion.div key={b.id} className="absolute inset-0" custom={dir}
            initial={vr.initial} animate={vr.animate} exit={vr.exit}
            transition={anim === "none" ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 30, duration: speed }}
            drag={banners.length > 1 ? "x" : false} dragConstraints={{ left: 0, right: 0 }} dragElastic={1} dragMomentum={false} dragTransition={{ bounceStiffness: 500, bounceDamping: 40 }}
            onDragEnd={(_, info) => { if (info.offset.x < -60) go(i + 1); else if (info.offset.x > 60) go(i - 1); }}
            onClick={() => open(b)}>
            <Slide b={b} />
          </motion.div>
        </AnimatePresence>
        {dots === "inside" && <Dots banners={banners} i={i} go={go} dots={dots} inside />}
      </div>
      {dots === "below" && <Dots banners={banners} i={i} go={go} dots={dots} inside={false} />}
    </div>
  );
}

function Dots({ banners, i, go, dots, inside }: { banners: Banner[]; i: number; go: (n: number) => void; dots: string; inside: boolean }) {
  if (banners.length < 2 || dots === "off") return null;
  return (
    <div className={inside ? "absolute bottom-3 left-0 right-0 flex justify-center gap-1.5" : "flex justify-center gap-1.5 mt-2"}>
      {banners.map((x, k) => (
        <button key={x.id} onClick={(e) => { e.stopPropagation(); go(k); }}
          className={`h-1.5 rounded-full transition-all ${k === i ? "w-5" : "w-1.5"}`}
          style={{ background: inside ? (k === i ? "#fff" : "rgba(255,255,255,.6)") : (k === i ? "var(--primary)" : "var(--line)") }} />
      ))}
    </div>
  );
}
