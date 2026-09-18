import { useState } from "react";
import type { FieldDef, Lang, LText, Options } from "../lib/api.ts";
import { ImageUpload, Toggle } from "./ui.tsx";

const LANGS: { k: Lang; label: string }[] = [{ k: "uz", label: "🇺🇿 UZ" }, { k: "ru", label: "🇷🇺 RU" }, { k: "en", label: "🇬🇧 EN" }];

export function Field({ def, value, onChange, options }: { def: FieldDef; value: unknown; onChange: (v: unknown) => void; options?: Options | null }) {
  const [lang, setLang] = useState<Lang>("uz");
  const ph = def.placeholders?.length ? <div className="help">O'zgaruvchilar: {def.placeholders.map((p) => <code key={p} className="bg-slate-100 px-1 rounded mr-1">{p}</code>)}</div> : null;
  const help = def.help ? <div className="help">{def.help}</div> : null;

  switch (def.type) {
    case "boolean":
      return <div className="flex items-center justify-between py-1"><span className="text-sm font-medium">{def.label}</span><Toggle value={!!value} onChange={onChange} /></div>;
    case "number":
      return <div><label className="label">{def.label}</label><input type="number" className="input max-w-xs" value={value === undefined || value === null ? "" : String(value)} min={def.min} max={def.max} step={def.step || 1} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} />{help}</div>;
    case "color":
      return (
        <div><label className="label">{def.label}</label>
          <div className="flex items-center gap-2"><input type="color" className="w-10 h-10 rounded-lg border border-slate-200 p-0.5 cursor-pointer" value={String(value || "#000000")} onChange={(e) => onChange(e.target.value)} /><input className="input max-w-[140px] font-mono" value={String(value || "")} onChange={(e) => onChange(e.target.value)} /></div>{help}
        </div>
      );
    case "select": {
      const opts = def.source ? options?.[def.source] || [] : def.options || [];
      const missing = def.source && !options?.[def.source];
      return (
        <div><label className="label">{def.label}</label>
          <select className="input max-w-md" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
            <option value="">— tanlanmagan —</option>
            {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            {!!value && !opts.some((o) => o.value === value) && <option value={String(value)}>{String(value)} (joriy)</option>}
          </select>
          {missing && <div className="help text-amber-600">Ro'yxat Bito'dan yuklanmadi — avval API kalitni saqlang.</div>}{help}
        </div>
      );
    }
    case "image":
      return <div><label className="label">{def.label}</label><ImageUpload value={String(value || "")} onChange={onChange} hint={def.help} /></div>;
    case "password":
      return <div><label className="label">{def.label}</label><input type="password" className="input max-w-md" value={String(value || "")} onChange={(e) => onChange(e.target.value)} autoComplete="new-password" />{help}</div>;
    case "tags":
      return <div><label className="label">{def.label}</label><input className="input max-w-md" value={Array.isArray(value) ? (value as string[]).join(", ") : String(value || "")} onChange={(e) => onChange(e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} />{help}</div>;
    case "textarea":
      return <div><label className="label">{def.label}</label><textarea className="input" rows={3} value={String(value || "")} onChange={(e) => onChange(e.target.value)} />{help}{ph}</div>;
    case "ltext":
    case "ltextarea": {
      const v = (value && typeof value === "object" ? value : { uz: "", ru: "", en: "" }) as LText;
      const set = (l: Lang, s: string) => onChange({ ...v, [l]: s });
      return (
        <div>
          <div className="flex items-center justify-between mb-1.5"><label className="label !mb-0">{def.label}</label>
            <div className="flex gap-1">{LANGS.map((l) => <button key={l.k} type="button" onClick={() => setLang(l.k)} className={`text-xs px-2 py-1 rounded-md ${lang === l.k ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"} ${!v[l.k] ? "opacity-60" : ""}`}>{l.label}</button>)}</div>
          </div>
          {def.type === "ltext" ? <input className="input" value={v[lang] || ""} onChange={(e) => set(lang, e.target.value)} /> : <textarea className="input" rows={3} value={v[lang] || ""} onChange={(e) => set(lang, e.target.value)} />}
          {help}{ph}
        </div>
      );
    }
    default:
      return <div><label className="label">{def.label}</label><input className="input" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />{help}{ph}</div>;
  }
}
