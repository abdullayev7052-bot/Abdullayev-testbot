import { motion, AnimatePresence } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { create } from "zustand";
import { X } from "lucide-react";
import { haptic } from "../lib/telegram.ts";

/* ---------- Sahifa o'tish animatsiyasi ---------- */
export function Page({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={`page ${className}`}
      initial={{ opacity: 0, y: 14, scale: 0.995 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.995 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ---------- Pastdan chiquvchi oyna ---------- */
export function BottomSheet({ open, onClose, children, full = false, title }: { open: boolean; onClose: () => void; children: ReactNode; full?: boolean; title?: string }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[600]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <div className="absolute inset-0 bg-black/45" onClick={onClose} />
          <motion.div
            className="absolute left-0 right-0 bottom-0 bg-white rounded-t-[26px] flex flex-col"
            style={{ maxHeight: full ? "96dvh" : "88dvh" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320, mass: 0.8 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => { if (info.offset.y > 120 || info.velocity.y > 800) onClose(); }}
          >
            <div className="flex justify-center pt-2 pb-1"><div className="w-10 h-1.5 rounded-full bg-slate-200" /></div>
            {title && (
              <div className="flex items-center justify-between px-5 pb-2">
                <div className="text-lg font-semibold">{title}</div>
                <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"><X size={18} /></button>
              </div>
            )}
            <div className="overflow-y-auto flex-1 min-h-0">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- Miqdor tanlash ---------- */
export function QtyStepper({ value, onChange, min = 0, max = 100000, size = "md", manual = true, step = 1 }: { value: number; onChange: (v: number) => void; min?: number; max?: number; size?: "sm" | "md" | "lg"; manual?: boolean; step?: number }) {
  const [text, setText] = useState(String(value));
  useEffect(() => { setText(String(value)); }, [value]);
  const h = size === "sm" ? "h-8" : size === "lg" ? "h-12" : "h-10";
  const w = size === "sm" ? "w-8" : size === "lg" ? "w-12" : "w-10";
  const commit = () => {
    const n = Math.floor(Number(text.replace(",", ".")));
    if (!Number.isFinite(n) || n < min) { setText(String(value)); return; }
    onChange(Math.min(max, n));
  };
  const btn = `${w} ${h} flex items-center justify-center rounded-xl bg-slate-100 active:bg-slate-200 text-lg font-semibold select-none`;
  return (
    <div className={`inline-flex items-center gap-1 ${size === "sm" ? "text-sm" : ""}`}>
      <motion.button whileTap={{ scale: 0.88 }} className={btn} onClick={() => { haptic.light(); onChange(Math.max(min, value - step)); }}>−</motion.button>
      {manual ? (
        <input
          className={`${h} text-center font-semibold bg-white rounded-xl border border-slate-200 focus:border-[var(--primary)] outline-none ${size === "sm" ? "w-11" : "w-14"}`}
          inputMode="numeric" value={text} onChange={(e) => setText(e.target.value.replace(/[^\d]/g, ""))} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
      ) : (
        <div className={`${h} min-w-9 flex items-center justify-center font-semibold`}>{value}</div>
      )}
      <motion.button whileTap={{ scale: 0.88 }} className={btn} onClick={() => { haptic.light(); onChange(Math.min(max, value + step)); }}>+</motion.button>
    </div>
  );
}

/* ---------- Skeleton ---------- */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

/* ---------- Toast ---------- */
interface ToastState { msg: string | null; kind: "ok" | "err"; show: (msg: string, kind?: "ok" | "err") => void }
export const useToast = create<ToastState>((set) => ({
  msg: null, kind: "ok",
  show(msg, kind = "ok") { set({ msg, kind }); setTimeout(() => set({ msg: null }), 2200); },
}));
export function Toaster() {
  const { msg, kind } = useToast();
  return (
    <AnimatePresence>
      {msg && (
        <motion.div className="fixed left-4 right-4 z-[700] flex justify-center pointer-events-none" style={{ top: "calc(env(safe-area-inset-top, 0px) + 14px)" }}
          initial={{ opacity: 0, y: -20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }} transition={{ type: "spring", damping: 22, stiffness: 300 }}>
          <div className={`px-4 py-2.5 rounded-2xl text-sm font-medium shadow-lg text-white ${kind === "ok" ? "bg-slate-900" : "bg-red-500"}`}>{msg}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- Bo'sh holat ---------- */
export function Empty({ emoji = "🛒", title, hint, action }: { emoji?: string; title: string; hint?: string; action?: ReactNode }) {
  return (
    <motion.div className="flex flex-col items-center justify-center text-center py-16 px-6" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
      <div className="text-6xl mb-4">{emoji}</div>
      <div className="text-lg font-semibold">{title}</div>
      {hint && <div className="text-sm text-slate-500 mt-1">{hint}</div>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}

/* ---------- Rasm (yuklanish animatsiyasi bilan) ---------- */
export function Img({ src, alt = "", className = "", fallback = "🖼" }: { src: string | null | undefined; alt?: string; className?: string; fallback?: string }) {
  const [state, setState] = useState<"loading" | "ok" | "err">(src ? "loading" : "err");
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    setState(src ? "loading" : "err");
    // Keshdan kelgan rasm onLoad ni chaqirmasligi mumkin
    const t = setTimeout(() => { const el = ref.current; if (el && el.complete) setState(el.naturalWidth > 0 ? "ok" : "err"); }, 50);
    return () => clearTimeout(t);
  }, [src]);
  if (!src || state === "err") return <div className={`flex items-center justify-center bg-slate-100 text-slate-300 text-3xl ${className}`}>{fallback}</div>;
  return (
    <div className={`relative overflow-hidden bg-slate-100 ${className}`}>
      {state === "loading" && <div className="absolute inset-0 skeleton rounded-none" />}
      <img ref={ref} src={src} alt={alt} loading="lazy" onLoad={() => setState("ok")} onError={() => setState("err")}
        className={`w-full h-full object-cover transition-opacity duration-300 ${state === "ok" ? "opacity-100" : "opacity-0"}`} />
    </div>
  );
}

/* ---------- Segment tanlagich ---------- */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; hint?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <motion.button key={o.value} whileTap={{ scale: 0.97 }} onClick={() => { haptic.select(); onChange(o.value); }}
            className={`rounded-2xl border p-3 text-left transition-colors ${active ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-slate-200 bg-white"}`}>
            <div className={`font-semibold ${active ? "text-[var(--primary)]" : ""}`}>{o.label}</div>
            {o.hint && <div className="text-xs text-slate-500 mt-0.5">{o.hint}</div>}
          </motion.button>
        );
      })}
    </div>
  );
}
