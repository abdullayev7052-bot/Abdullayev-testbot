import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, animate as animateValue, useMotionValue, type TargetAndTransition } from "motion/react";
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

  // ---- Karusel: barcha bannerlar yonma-yon, barmoq bilan 1:1 suriladi ----
  if (anim === "carousel") {
    return <Carousel banners={banners} i={i} go={go} open={open} Slide={Slide} height={height} radius={radius} peek={peek} gap={gap} dots={dots} />;
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
            onDragEnd={(_, info) => {
              const far = Math.abs(info.offset.x) > window.innerWidth * 0.22;
              const fast = Math.abs(info.velocity.x) > 300;
              if (!far && !fast) return;
              if (info.offset.x < 0) go(i + 1); else go(i - 1);
            }}
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

/** Karusel: x qiymati barmoq bilan bevosita boshqariladi (animatsiya xalaqit bermaydi) */
function Carousel({ banners, i, go, open, Slide, height, radius, peek, gap, dots }: {
  banners: Banner[]; i: number; go: (n: number) => void; open: (b: Banner) => void;
  Slide: (p: { b: Banner }) => React.ReactElement; height: number; radius: number; peek: number; gap: number; dots: string;
}) {
  const x = useMotionValue(0);
  const strip = useRef<HTMLDivElement>(null);
  const slideW = () => ((strip.current?.firstElementChild as HTMLElement)?.offsetWidth || 0) + gap;

  // Indeks o'zgarganda joriy o'rinni yumshoq siljitamiz
  useEffect(() => {
    const target = -i * slideW();
    const controls = animateValue(x, target, { type: "spring", stiffness: 320, damping: 36, restDelta: 0.5 });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, gap, banners.length]);

  return (
    <div className="my-2">
      <div className="overflow-hidden px-4">
        <motion.div ref={strip} className="flex" style={{ gap, x }}
          drag={banners.length > 1 ? "x" : false}
          dragConstraints={{ left: -(banners.length - 1) * slideW(), right: 0 }}
          dragElastic={0.12}
          dragMomentum={false}
          onDragEnd={(_, info) => {
            const w = slideW() || 1;
            const moved = -x.get() / w;               // qaysi slaydga eng yaqin
            const fast = Math.abs(info.velocity.x) > 350;
            let next = fast ? (info.velocity.x < 0 ? Math.ceil(moved) : Math.floor(moved)) : Math.round(moved);
            next = Math.max(0, Math.min(banners.length - 1, next));
            if (next === i) animateValue(x, -i * w, { type: "spring", stiffness: 320, damping: 36 });
            else go(next);
          }}>
          {banners.map((b) => (
            <div key={b.id} className="shrink-0 relative overflow-hidden" style={{ width: `calc(100% - ${peek}px)`, height, borderRadius: radius }} onClick={() => open(b)}>
              <Slide b={b} />
            </div>
          ))}
        </motion.div>
      </div>
      <Dots banners={banners} i={i} go={go} dots={dots} inside={false} />
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
