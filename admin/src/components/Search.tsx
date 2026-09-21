import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search as SearchIcon, X, CornerDownLeft, SlidersHorizontal, Menu } from "lucide-react";
import type { SectionDef } from "../lib/api.ts";
import { buildSearchIndex, searchEntries, type SearchEntry } from "../lib/nav.ts";
import { useT } from "../lib/i18n.ts";

/** Admin panel bo'ylab qidiruv (menyular + sozlamalar). Ctrl+K / ⌘K bilan ham ochiladi. */
export function SearchPalette({ open, onClose, schema }: { open: boolean; onClose: () => void; schema?: SectionDef[] }) {
  const t = useT();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const index = useMemo(() => buildSearchIndex(schema, t), [schema, t]);
  const results = useMemo(() => searchEntries(index, q), [index, q]);

  useEffect(() => { if (open) { setQ(""); setCursor(0); setTimeout(() => input.current?.focus(), 30); } }, [open]);
  useEffect(() => { setCursor(0); }, [q]);

  const go = (e: SearchEntry) => { onClose(); nav(e.to); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === "Enter" && results[cursor]) { e.preventDefault(); go(results[cursor]); }
    else if (e.key === "Escape") onClose();
  };
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center p-3 pt-[10vh]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative card w-full max-w-xl overflow-hidden shadow-2xl">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
          <SearchIcon size={18} className="text-slate-400 shrink-0" />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder={t("searchHint")} className="flex-1 bg-transparent outline-none text-base" />
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center"><X size={18} /></button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {q.trim() && !results.length && <div className="p-6 text-center text-slate-400 text-sm">{t("searchEmpty")}</div>}
          {!q.trim() && <div className="p-6 text-center text-slate-400 text-sm">{t("searchHint")}</div>}
          {results.map((r, i) => (
            <button key={r.id} onMouseEnter={() => setCursor(i)} onClick={() => go(r)} className={`w-full text-left px-4 py-2.5 flex items-center gap-3 ${i === cursor ? "bg-[var(--primary)] text-white" : "hover:bg-slate-50"}`}>
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${i === cursor ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>{r.kind === "menu" ? <Menu size={15} /> : <SlidersHorizontal size={15} />}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium truncate">{r.title}</span>
                {r.path.length > 0 && <span className={`block text-xs truncate ${i === cursor ? "text-white/80" : "text-slate-400"}`}>{r.path.join(" › ")}</span>}
              </span>
              {i === cursor && <CornerDownLeft size={14} className="shrink-0 opacity-70" />}
            </button>
          ))}
        </div>
        <div className="px-4 py-2 border-t border-slate-100 text-[11px] text-slate-400 flex gap-3"><span>↑↓ — tanlash</span><span>Enter — ochish</span><span>Esc — yopish</span><span className="ml-auto">Ctrl+K</span></div>
      </div>
    </div>
  );
}

export function useSearchHotkey(setOpen: (v: boolean | ((o: boolean) => boolean)) => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [setOpen]);
}
