import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import type { Story } from "../lib/api.ts";
import { useT } from "../store/app.ts";
import { haptic, openLink, resolveTarget } from "../lib/telegram.ts";
import { useNavigate } from "react-router-dom";
import { isVideo } from "./ui.tsx";

const SEEN_KEY = "stories-seen";
function seenSet(): Set<string> { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]")); } catch { return new Set(); } }
function markSeen(id: number) { const s = seenSet(); s.add(String(id)); localStorage.setItem(SEEN_KEY, JSON.stringify([...s])); }

export function Stories({ stories }: { stories: Story[] }) {
  const { v } = useT();
  const [open, setOpen] = useState<number | null>(null);
  const [, force] = useState(0);
  const size = v<number>("design", "storiesSize", 66);
  if (!stories.length) return null;
  const seen = seenSet();
  return (
    <>
      <div className="flex gap-3 overflow-x-auto px-4 py-2 hide-scroll">
        {stories.map((st, i) => (
          <motion.button key={st.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} whileTap={{ scale: 0.92 }}
            onClick={() => { haptic.light(); setOpen(i); }} className="flex flex-col items-center gap-1.5 shrink-0" style={{ width: size + 8 }}>
            <div className={`story-ring p-[2.5px] rounded-full ${seen.has(String(st.id)) ? "seen" : ""}`} style={{ width: size, height: size }}>
              <div className="w-full h-full rounded-full bg-white p-[2px]">
                <img src={st.cover} alt={st.title} className="w-full h-full rounded-full object-cover" />
              </div>
            </div>
            <span className="text-[11px] text-slate-600 truncate w-full text-center">{st.title}</span>
          </motion.button>
        ))}
      </div>
      {open !== null && (
        <StoryViewer stories={stories} start={open} onClose={() => { setOpen(null); force((x) => x + 1); }} />
      )}
    </>
  );
}

/* Instagram uslubidagi to'liq ekran ko'ruvchi */
function StoryViewer({ stories, start, onClose }: { stories: Story[]; start: number; onClose: () => void }) {
  const nav = useNavigate();
  const go = (link: string) => { const r = resolveTarget(link); onClose(); if (r.path) nav(r.path); else if (r.url) openLink(r.url); };
  const [si, setSi] = useState(start);   // story index
  const [sl, setSl] = useState(0);       // slide index
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const raf = useRef<number>(0);
  const startedAt = useRef<number>(0);
  const elapsedBefore = useRef<number>(0);
  const story = stories[si];
  const slide = story?.slides[sl];

  const next = useCallback(() => {
    if (!story) return;
    if (sl + 1 < story.slides.length) { setSl(sl + 1); return; }
    markSeen(story.id);
    if (si + 1 < stories.length) { setSi(si + 1); setSl(0); return; }
    onClose();
  }, [si, sl, story, stories.length, onClose]);
  const prev = useCallback(() => {
    if (sl > 0) { setSl(sl - 1); return; }
    if (si > 0) { setSi(si - 1); setSl(stories[si - 1].slides.length - 1); return; }
    setSl(0);
  }, [si, sl, stories]);

  useEffect(() => { if (story) markSeen(story.id); }, [story]);

  // taymer
  useEffect(() => {
    if (!slide) return;
    const dur = (slide.duration || 5) * 1000;
    elapsedBefore.current = 0;
    startedAt.current = performance.now();
    setProgress(0);
    let done = false;
    const tick = (now: number) => {
      if (done) return;
      if (!paused) {
        const el = elapsedBefore.current + (now - startedAt.current);
        const p = Math.min(1, el / dur);
        setProgress(p);
        if (p >= 1) { done = true; next(); return; }
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { done = true; cancelAnimationFrame(raf.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [si, sl]);

  // pauza/davom
  useEffect(() => {
    if (paused) { elapsedBefore.current += performance.now() - startedAt.current; }
    else { startedAt.current = performance.now(); }
  }, [paused]);

  if (!story || !slide) return null;
  const hold = { onPointerDown: () => setPaused(true), onPointerUp: () => setPaused(false), onPointerCancel: () => setPaused(false), onPointerLeave: () => setPaused(false) };
  return (
    <motion.div className="fixed inset-0 z-[800] bg-black" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.22 }}>
      <AnimatePresence mode="wait">
        {isVideo(slide.image)
          ? <motion.video key={`${si}-${sl}`} src={slide.image} className="absolute inset-0 w-full h-full object-cover" autoPlay muted playsInline loop initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} />
          : <motion.img key={`${si}-${sl}`} src={slide.image} className="absolute inset-0 w-full h-full object-cover" initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} draggable={false} />}
      </AnimatePresence>
      <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent h-32 pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent h-40 pointer-events-none" />
      {/* progress */}
      <div className="absolute left-2 right-2 flex gap-1 safe-top" style={{ top: "calc(env(safe-area-inset-top, 0px) + 10px)" }}>
        {story.slides.map((s, i) => (
          <div key={s.id} className="progress-bar flex-1"><div style={{ width: i < sl ? "100%" : i === sl ? `${progress * 100}%` : "0%" }} /></div>
        ))}
      </div>
      <div className="absolute left-3 right-3 flex items-center gap-2 text-white" style={{ top: "calc(env(safe-area-inset-top, 0px) + 22px)" }}>
        <img src={story.cover} className="w-8 h-8 rounded-full object-cover border border-white/60" />
        <div className="text-sm font-semibold drop-shadow">{story.title}</div>
        <button onClick={onClose} className="ml-auto w-9 h-9 rounded-full bg-black/30 flex items-center justify-center"><X size={20} /></button>
      </div>
      {/* tap zones */}
      <div className="absolute inset-0 flex" {...hold}>
        <div className="w-1/3 h-full" onClick={() => { haptic.select(); prev(); }} />
        <div className="w-2/3 h-full" onClick={() => { haptic.select(); next(); }} />
      </div>
      {(slide.caption || slide.link) && (
        <div className="absolute left-4 right-4 text-white" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}>
          {slide.caption && <div className="text-base font-medium drop-shadow mb-3">{slide.caption}</div>}
          {slide.link && (
            <button onClick={() => go(slide.link!)} className="w-full py-3 rounded-2xl bg-white text-slate-900 font-semibold">→</button>
          )}
        </div>
      )}
    </motion.div>
  );
}
