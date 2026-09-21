import { useState } from "react";
import { Store, ChevronDown, Check } from "lucide-react";
import { useApp, useT } from "../store/app.ts";
import { BottomSheet, Tap, useToast } from "./ui.tsx";
import { useCart } from "../store/cart.ts";
import { haptic } from "../lib/telegram.ts";

/** Ko'p do'kon rejimida do'kon tanlash (faqat admin yoqgan bo'lsa ko'rinadi) */
export function StorePicker({ inline = false }: { inline?: boolean }) {
  const { t, lang } = useT();
  const data = useApp((s) => s.data);
  const setStore = useApp((s) => s.setStore);
  const toast = useToast((s) => s.show);
  const cart = useCart();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!data || !data.stores || data.stores.length < 2) return null;
  const cur = data.store;
  const choose = async (id: string) => {
    if (id === cur.id) { setOpen(false); return; }
    setBusy(true); haptic.select();
    try { await setStore(id); cart.clear(); setOpen(false); toast(t("bito", "storeChanged", { store: data.stores.find((s) => s.id === id)?.name || "" })); }
    catch (e) { toast((e as Error).message, "err"); } finally { setBusy(false); }
  };
  void lang;
  const btn = (
    <Tap onClick={() => { haptic.light(); setOpen(true); }} className={inline ? "w-full flex items-center gap-3 px-4 py-3.5 border-t border-slate-100 text-left" : "wrap mt-1 mb-1"}>
      {inline ? (<><span className="text-[var(--primary)]"><Store size={20} /></span><span className="flex-1 font-medium">{t("bito", "storeButton")}</span><span className="text-sm text-slate-400">{cur.name}</span></>) : (
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full bg-[var(--primary-soft)] text-[var(--primary)]"><Store size={15} /> {cur.name} <ChevronDown size={14} /></span>
      )}
    </Tap>
  );
  return (<>
    {btn}
    <BottomSheet open={open} onClose={() => setOpen(false)} title={t("bito", "storeChooseLabel")}>
      <div className="px-4 pb-8 space-y-2">
        {data.stores.map((s) => (
          <Tap key={s.id} disabled={busy} onClick={() => { void choose(s.id); }} className={`w-full p-4 rounded-2xl border text-left flex items-center gap-3 ${s.id === cur.id ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-slate-200"}`}>
            <Store size={20} className="text-[var(--primary)]" />
            <div className="flex-1 min-w-0"><div className="font-semibold">{s.name}</div>{s.pickupAddress && <div className="text-xs text-slate-500 truncate">{s.pickupAddress}</div>}</div>
            {s.id === cur.id && <Check size={18} className="text-[var(--primary)]" />}
          </Tap>
        ))}
      </div>
    </BottomSheet>
  </>);
}
