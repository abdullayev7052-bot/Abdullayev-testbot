import { useEffect, useRef, useState, type ReactNode } from "react";
import { create } from "zustand";
import { Upload, X, Loader2 } from "lucide-react";
import { api } from "../lib/api.ts";

interface ToastState { items: { id: number; msg: string; kind: "ok" | "err" }[]; show: (msg: string, kind?: "ok" | "err") => void }
export const useToast = create<ToastState>((set, get) => ({
  items: [],
  show(msg, kind = "ok") {
    const id = Date.now() + Math.random();
    set({ items: [...get().items, { id, msg, kind }] });
    setTimeout(() => set({ items: get().items.filter((x) => x.id !== id) }), 3000);
  },
}));
export function Toaster() {
  const items = useToast((s) => s.items);
  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2">
      {items.map((t) => (
        <div key={t.id} className={`px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg text-white ${t.kind === "ok" ? "bg-slate-900" : "bg-red-600"}`}>{t.msg}</div>
      ))}
    </div>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" onClick={() => onChange(!value)} className="inline-flex items-center gap-2 select-none">
      <span className={`relative w-11 h-6 rounded-full transition-colors ${value ? "bg-blue-600" : "bg-slate-300"}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${value ? "left-[22px]" : "left-0.5"}`} />
      </span>
      {label && <span className="text-sm">{label}</span>}
    </button>
  );
}

export function ImageUpload({ value, onChange, aspect = "auto", hint }: { value: string; onChange: (v: string) => void; aspect?: string; hint?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast((s) => s.show);
  const pick = async (f?: File | null) => {
    if (!f) return;
    setBusy(true);
    try { onChange(await api.upload(f)); } catch (e) { toast((e as Error).message, "err"); } finally { setBusy(false); }
  };
  return (
    <div>
      <div className="flex items-start gap-3">
        <div className="w-32 h-32 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden relative" style={{ aspectRatio: aspect }}>
          {value ? <img src={value} className="w-full h-full object-cover" /> : <Upload className="text-slate-300" />}
          {busy && <div className="absolute inset-0 bg-white/70 flex items-center justify-center"><Loader2 className="animate-spin" /></div>}
        </div>
        <div className="space-y-2">
          <button type="button" className="btn btn-ghost" onClick={() => ref.current?.click()}><Upload size={16} /> Rasm yuklash</button>
          {value && <button type="button" className="btn btn-ghost text-red-600" onClick={() => onChange("")}><X size={16} /> O'chirish</button>}
          {hint && <div className="help">{hint}</div>}
        </div>
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}

export function Modal({ open, onClose, title, children, width = 560 }: { open: boolean; onClose: () => void; title: string; children: ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative card w-full max-h-[90vh] overflow-y-auto" style={{ maxWidth: width }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="font-semibold text-lg">{title}</div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function PageTitle({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div><h1 className="text-2xl font-bold">{title}</h1>{description && <p className="text-sm text-slate-500 mt-1">{description}</p>}</div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Spinner() {
  return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-400" /></div>;
}

export function confirmDialog(msg: string): boolean {
  return window.confirm(msg);
}
