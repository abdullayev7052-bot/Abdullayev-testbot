import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { create } from "zustand";
import { X, Trash2 } from "lucide-react";
import { haptic } from "../lib/telegram.ts";
import { pageVariants, spring, tapScale } from "../lib/motion.ts";

/** Chiqish animatsiyasi uchun elementni biroz ushlab turish (AnimatePresence o'rniga, ishonchli) */
export function usePresence(open: boolean, ms = 220): { mounted: boolean; visible: boolean } {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);
  useEffect(() => {
    if (open) { setMounted(true); const r = requestAnimationFrame(() => setVisible(true)); return () => cancelAnimationFrame(r); }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), ms);
    return () => clearTimeout(t);
  }, [open, ms]);
  return { mounted, visible };
}

/* ---------- Sahifa o'tish animatsiyasi ---------- */
export function Page({ children, className = "" }: { children: ReactNode; className?: string }) {
  const v = pageVariants();
  return (
    <motion.div className={`page ${className}`} initial={v.initial as never} animate={v.animate as never} exit={v.exit as never} transition={spring("page")}>
      {children}
    </motion.div>
  );
}

/** Bosganda kichrayadigan tugma (sozlamadagi kuch bilan) */
export function Tap({ children, className = "", onClick, disabled }: { children: ReactNode; className?: string; onClick?: () => void; disabled?: boolean }) {
  return <motion.button whileTap={{ scale: tapScale() }} transition={spring("tap")} className={className} onClick={onClick} disabled={disabled}>{children}</motion.button>;
}

/* ---------- Tasdiq oynasi (Ha / Yo'q) ---------- */
export function ConfirmDialog({ open, title, text, yes, no, onYes, onNo, danger = true }: { open: boolean; title: string; text?: string; yes: string; no: string; onYes: () => void; onNo: () => void; danger?: boolean }) {
  const { mounted, visible } = usePresence(open, 200);
  if (!mounted) return null;
  return (
    <div className="fixed inset-0 z-[650] flex items-center justify-center p-6">
      <motion.div className="absolute inset-0 bg-black/45" initial={{ opacity: 0 }} animate={{ opacity: visible ? 1 : 0 }} transition={{ duration: 0.18 }} onClick={onNo} />
      <motion.div className="relative bg-white rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl" initial={{ scale: 0.85, y: 20, opacity: 0 }} animate={visible ? { scale: 1, y: 0, opacity: 1 } : { scale: 0.9, y: 10, opacity: 0 }} transition={visible ? spring("sheet") : { duration: 0.18 }}>
        <div className="text-5xl mb-3">{danger ? "🗑" : "❓"}</div>
        <div className="text-lg font-bold">{title}</div>
        {text && <div className="text-sm text-slate-500 mt-1.5">{text}</div>}
        <div className="grid grid-cols-2 gap-2 mt-5">
          <Tap className="py-3 rounded-2xl bg-slate-100 font-semibold" onClick={onNo}>{no}</Tap>
          <Tap className={`py-3 rounded-2xl font-semibold text-white ${danger ? "bg-red-500" : "btn-primary"}`} onClick={onYes}>{yes}</Tap>
        </div>
      </motion.div>
    </div>
  );
}

/* ---------- Chapga surib o'chirish ---------- */
export function SwipeToDelete({ children, onDelete, label, enabled = true, className = "" }: { children: ReactNode; onDelete: () => void; label: string; enabled?: boolean; className?: string }) {
  const x = useMotionValue(0);
  const bg = useTransform(x, [-140, -60, 0], [1, 0.9, 0]);
  const iconScale = useTransform(x, [-140, -70, 0], [1.15, 1, 0.6]);
  const [gone, setGone] = useState(false);
  if (!enabled) return <div className={className}>{children}</div>;
  return (
    <div className={`relative overflow-hidden rounded-[var(--radius)] ${className}`}>
      <motion.div className="absolute inset-y-0 right-0 w-full bg-red-500 flex items-center justify-end pr-6 text-white" style={{ opacity: bg }}>
        <motion.div style={{ scale: iconScale }} className="flex flex-col items-center gap-0.5 text-xs font-semibold"><Trash2 size={22} />{label}</motion.div>
      </motion.div>
      <motion.div
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -160, right: 0 }}
        dragElastic={{ left: 0.15, right: 0 }}
        onDragEnd={(_, info) => {
          if (info.offset.x < -110 || info.velocity.x < -600) {
            haptic.medium(); setGone(true);
            animate(x, -600, { duration: 0.22 }).then(() => onDelete());
          } else animate(x, 0, spring("card"));
        }}
        className={`relative bg-white ${gone ? "pointer-events-none" : ""}`}
      >
        {children}
      </motion.div>
    </div>
  );
}

/* ---------- Pastdan chiquvchi oyna ---------- */
export function BottomSheet({ open, onClose, children, full = false, title }: { open: boolean; onClose: () => void; children: ReactNode; full?: boolean; title?: string }) {
  const { mounted, visible } = usePresence(open, 260);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  if (!mounted) return null;
  return (
    <div className="fixed inset-0 z-[600]">
      <motion.div className="absolute inset-0 bg-black/45" initial={{ opacity: 0 }} animate={{ opacity: visible ? 1 : 0 }} transition={{ duration: 0.2 }} onClick={onClose} />
      <motion.div
        className="absolute left-0 right-0 bottom-0 bg-white rounded-t-[26px] flex flex-col"
        style={{ maxHeight: full ? "96dvh" : "88dvh" }}
        initial={{ y: "100%" }}
        animate={{ y: visible ? 0 : "100%" }}
        transition={visible ? spring("sheet") : { duration: 0.22, ease: "easeIn" }}
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
    </div>
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
  const { mounted, visible } = usePresence(!!msg, 200);
  const [last, setLast] = useState<{ msg: string; kind: string }>({ msg: "", kind: "ok" });
  useEffect(() => { if (msg) setLast({ msg, kind }); }, [msg, kind]);
  if (!mounted) return null;
  return (
    <div className="fixed left-4 right-4 z-[700] flex justify-center pointer-events-none" style={{ top: "calc(env(safe-area-inset-top, 0px) + 14px)" }}>
      <motion.div initial={{ opacity: 0, y: -20, scale: 0.95 }} animate={visible ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: -10, scale: 0.95 }} transition={visible ? spring("card") : { duration: 0.18 }}>
        <div className={`px-4 py-2.5 rounded-2xl text-sm font-medium shadow-lg text-white ${last.kind === "ok" ? "bg-slate-900" : "bg-red-500"}`}>{last.msg}</div>
      </motion.div>
    </div>
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
