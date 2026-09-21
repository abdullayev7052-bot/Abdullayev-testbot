import { useEffect, useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import type { Options, LText, Lang } from "../lib/api.ts";
import { api } from "../lib/api.ts";
import { LatLngPicker } from "./LatLngPicker.tsx";
import { Toggle } from "./ui.tsx";

export interface StoreDef {
  id: string; name: LText; organizationId: string; warehouseId: string; priceId: string; currencyId: string; responsibleId: string;
  stockSource: "warehouse" | "organization"; pickupAddress?: LText; pickupLocation?: { lat: number; lng: number }; enabled?: boolean;
}
const empty = (): StoreDef => ({ id: "s" + Date.now().toString(36), name: { uz: "", ru: "", en: "" }, organizationId: "", warehouseId: "", priceId: "", currencyId: "", responsibleId: "", stockSource: "warehouse", pickupAddress: { uz: "", ru: "", en: "" }, pickupLocation: { lat: 41.311, lng: 69.279 }, enabled: true });

function Sel({ label, value, onChange, opts }: { label: string; value: string; onChange: (v: string) => void; opts?: { value: string; label: string }[] }) {
  return (
    <div><label className="label">{label}</label>
      <select className="input" value={value || ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">— tanlanmagan —</option>
        {(opts || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
function LT({ label, value, onChange }: { label: string; value: LText; onChange: (v: LText) => void }) {
  const [lang, setLang] = useState<Lang>("uz");
  const v = value || { uz: "", ru: "", en: "" };
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5"><label className="label !mb-0">{label}</label>
        <div className="flex gap-1">{(["uz", "ru", "en"] as Lang[]).map((l) => <button key={l} type="button" onClick={() => setLang(l)} className={`text-xs px-2 py-1 rounded-md ${lang === l ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>{l.toUpperCase()}</button>)}</div>
      </div>
      <input className="input" value={v[lang] || ""} onChange={(e) => onChange({ ...v, [lang]: e.target.value })} />
    </div>
  );
}

/** Qo'shimcha do'konlar (tashkilotlar) ro'yxati */
export function StoresEditor({ value, onChange, options }: { value: StoreDef[]; onChange: (v: StoreDef[]) => void; options?: Options | null }) {
  const list = Array.isArray(value) ? value : [];
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const set = (i: number, patch: Partial<StoreDef>) => onChange(list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <div className="space-y-3">
      {list.map((s, i) => (
        <div key={s.id} className="card p-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setOpenIdx(openIdx === i ? null : i)} className="flex-1 text-left font-semibold flex items-center gap-2">{openIdx === i ? <ChevronUp size={16} /> : <ChevronDown size={16} />} {s.name?.uz || "Yangi do'kon"} <span className="text-xs font-normal text-slate-500">{options?.["bito:organizations"]?.find((o) => o.value === s.organizationId)?.label || ""}</span></button>
            <Toggle value={s.enabled !== false} onChange={(v) => set(i, { enabled: v })} />
            <button type="button" className="w-8 h-8 rounded-lg text-red-500 hover:bg-red-50 flex items-center justify-center" onClick={() => onChange(list.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
          </div>
          {openIdx === i && (
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              <div className="sm:col-span-2"><LT label="Do'kon nomi (mijozga ko'rinadi)" value={s.name} onChange={(v) => set(i, { name: v })} /></div>
              <Sel label="Tashkilot (filial)" value={s.organizationId} onChange={(v) => set(i, { organizationId: v })} opts={options?.["bito:organizations"]} />
              <Sel label="Ombor" value={s.warehouseId} onChange={(v) => set(i, { warehouseId: v })} opts={options?.["bito:warehouses"]} />
              <Sel label="Mijozga ko'rinadigan narx turi" value={s.priceId} onChange={(v) => set(i, { priceId: v })} opts={options?.["bito:prices"]} />
              <Sel label="Valyuta" value={s.currencyId} onChange={(v) => set(i, { currencyId: v })} opts={options?.["bito:currencies"]} />
              <Sel label="Buyurtmalar uchun mas'ul xodim" value={s.responsibleId} onChange={(v) => set(i, { responsibleId: v })} opts={options?.["bito:employees"]} />
              <Sel label="Qoldiq manbai" value={s.stockSource} onChange={(v) => set(i, { stockSource: (v || "warehouse") as StoreDef["stockSource"] })} opts={[{ value: "warehouse", label: "Tanlangan ombor" }, { value: "organization", label: "Butun tashkilot" }]} />
              <div className="sm:col-span-2"><LT label="Do'kon manzili (olib ketish uchun)" value={s.pickupAddress || { uz: "", ru: "", en: "" }} onChange={(v) => set(i, { pickupAddress: v })} /></div>
              <div className="sm:col-span-2"><label className="label">Do'kon joylashuvi (xaritada)</label><LatLngPicker value={s.pickupLocation || { lat: 41.311, lng: 69.279 }} onChange={(v) => set(i, { pickupLocation: v })} /></div>
            </div>
          )}
        </div>
      ))}
      <button type="button" className="btn btn-ghost" onClick={() => { onChange([...list, empty()]); setOpenIdx(list.length); }}><Plus size={16} /> Do'kon qo'shish</button>
      <div className="help">Asosiy do'kon — yuqoridagi "Kontekst" bo'limi. Bu yerdagilar qo'shimcha. Saqlangach katalog barcha do'konlar bo'yicha qayta sinxronlanadi.</div>
    </div>
  );
}

/** Mijozlar uchun narx istisnolari */
export interface PriceException { priceId: string; customerIds: string[]; customerNames?: string[]; priceName?: string }
export function PriceExceptionsEditor({ value, onChange, options }: { value: PriceException[]; onChange: (v: PriceException[]) => void; options?: Options | null }) {
  const list = Array.isArray(value) ? value : [];
  const [q, setQ] = useState("");
  const [found, setFound] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    if (active === null) return;
    const t = setTimeout(() => { api.get<{ id: string; name: string; phone: string }[]>(`/bito/customers?q=${encodeURIComponent(q)}`).then(setFound).catch(() => setFound([])); }, 300);
    return () => clearTimeout(t);
  }, [q, active]);
  const set = (i: number, patch: Partial<PriceException>) => onChange(list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const addCustomer = (i: number, c: { id: string; name: string }) => {
    const ex = list[i]; if (ex.customerIds.includes(c.id)) return;
    set(i, { customerIds: [...ex.customerIds, c.id], customerNames: [...(ex.customerNames || []), c.name] });
  };
  const removeCustomer = (i: number, idx: number) => {
    const ex = list[i];
    set(i, { customerIds: ex.customerIds.filter((_, k) => k !== idx), customerNames: (ex.customerNames || []).filter((_, k) => k !== idx) });
  };
  return (
    <div className="space-y-3">
      {list.map((ex, i) => (
        <div key={i} className="card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex-1"><Sel label="Narx turi" value={ex.priceId} onChange={(v) => set(i, { priceId: v, priceName: options?.["bito:prices"]?.find((o) => o.value === v)?.label })} opts={options?.["bito:prices"]} /></div>
            <button type="button" className="w-8 h-8 mt-5 rounded-lg text-red-500 hover:bg-red-50 flex items-center justify-center" onClick={() => onChange(list.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ex.customerIds.map((id, k) => <span key={id} className="badge bg-blue-50 text-blue-700 gap-1">{ex.customerNames?.[k] || id}<button type="button" onClick={() => removeCustomer(i, k)} className="ml-1 text-blue-400 hover:text-red-500">×</button></span>)}
            {!ex.customerIds.length && <span className="text-xs text-slate-400">Mijoz tanlanmagan</span>}
          </div>
          {active === i ? (
            <div className="space-y-1.5">
              <input className="input" autoFocus placeholder="Mijoz ismi yoki telefoni (Bito'dan qidiradi)..." value={q} onChange={(e) => setQ(e.target.value)} />
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
                {found.map((c) => <button key={c.id} type="button" onClick={() => addCustomer(i, c)} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex justify-between"><span>{c.name}</span><span className="text-slate-400">{c.phone}</span></button>)}
                {!found.length && <div className="px-3 py-2 text-xs text-slate-400">Topilmadi</div>}
              </div>
              <button type="button" className="btn btn-ghost !py-1 !px-2 text-xs" onClick={() => setActive(null)}>Yopish</button>
            </div>
          ) : <button type="button" className="btn btn-ghost !py-1 !px-2 text-xs" onClick={() => { setActive(i); setQ(""); }}><Plus size={14} /> Mijoz qo'shish</button>}
        </div>
      ))}
      <button type="button" className="btn btn-ghost" onClick={() => onChange([...list, { priceId: "", customerIds: [], customerNames: [] }])}><Plus size={16} /> Istisno qo'shish</button>
      <div className="help">Ro'yxatdagi mijozlar Mini App'da tanlangan narx turini ko'radi; buyurtma ham shu narxda Bito'ga tushadi. Saqlangach narxlar qayta sinxronlanadi.</div>
    </div>
  );
}
