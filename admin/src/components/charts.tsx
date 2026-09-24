import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Info, X } from "lucide-react";

/* Kutubxonasiz, yengil SVG grafiklar (tungi rejimga mos, CSS o'zgaruvchilar orqali) */

export const fmtN = (v: number) => new Intl.NumberFormat("ru-RU").format(Math.round(v));
/** Pulni qisqa ko'rinishda: 18.4 mln, 1.2 mlrd */
export function fmtMoney(v: number, suffix = "so'm"): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(a >= 1e10 ? 0 : 1).replace(".", ",")} mlrd ${suffix}`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(".", ",")} mln ${suffix}`;
  return `${fmtN(v)} ${suffix}`;
}
export const fmtPct = (v: number) => `${(Math.round(v * 10) / 10).toString().replace(".", ",")}%`;

export interface SeriesPoint { label: string; bar?: number; line?: number }

/** Ustunlar (bar) + chiziq (line, o'ng o'q) grafigi. Sichqoncha bilan qiymatlar ko'rinadi. */
export function BarLineChart({ data, barLabel, lineLabel, height = 220, barColor = "var(--primary)", lineColor = "#f59e0b", fmtBar = fmtN, fmtLine = fmtN }: {
  data: SeriesPoint[]; barLabel: string; lineLabel?: string; height?: number; barColor?: string; lineColor?: string; fmtBar?: (v: number) => string; fmtLine?: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = height, padL = 44, padR = lineLabel ? 56 : 12, padT = 12, padB = 28;
  const iw = W - padL - padR, ih = H - padT - padB;
  const n = Math.max(1, data.length);
  const maxBar = Math.max(1, ...data.map((d) => d.bar || 0));
  const maxLine = Math.max(1, ...data.map((d) => d.line || 0));
  const step = iw / n;
  const bw = Math.max(2, Math.min(40, step * 0.62));
  const x = (i: number) => padL + step * i + step / 2;
  const yB = (v: number) => padT + ih - (v / maxBar) * ih;
  const yL = (v: number) => padT + ih - (v / maxLine) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const labelEvery = Math.ceil(n / 8);
  const linePath = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${yL(d.line || 0).toFixed(1)}`).join(" ");
  const h = hover !== null ? data[hover] : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={padT + ih - t * ih} y2={padT + ih - t * ih} stroke="currentColor" strokeOpacity="0.08" />
            <text x={padL - 6} y={padT + ih - t * ih + 4} fontSize="10" textAnchor="end" fill="currentColor" fillOpacity="0.5">{fmtN(maxBar * t)}</text>
            {lineLabel && <text x={W - padR + 6} y={padT + ih - t * ih + 4} fontSize="10" fill={lineColor}>{fmtLine(maxLine * t)}</text>}
          </g>
        ))}
        {data.map((d, i) => (
          <g key={i} onMouseEnter={() => setHover(i)}>
            <rect x={padL + step * i} y={padT} width={step} height={ih} fill="transparent" />
            <rect x={x(i) - bw / 2} y={yB(d.bar || 0)} width={bw} height={Math.max(0, padT + ih - yB(d.bar || 0))} rx={3} fill={barColor} fillOpacity={hover === i ? 1 : 0.75} />
            {i % labelEvery === 0 && <text x={x(i)} y={H - 8} fontSize="10" textAnchor="middle" fill="currentColor" fillOpacity="0.55">{d.label}</text>}
          </g>
        ))}
        {lineLabel && <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2.2" strokeLinejoin="round" />}
        {lineLabel && data.map((d, i) => <circle key={i} cx={x(i)} cy={yL(d.line || 0)} r={hover === i ? 4.5 : 2.5} fill={lineColor} />)}
        {h && hover !== null && <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + ih} stroke="currentColor" strokeOpacity="0.25" strokeDasharray="3 3" />}
      </svg>
      {h && (
        <div className="absolute top-1 left-12 text-xs bg-slate-900 text-white rounded-lg px-2.5 py-1.5 shadow pointer-events-none">
          <div className="font-semibold">{h.label}</div>
          <div><span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ background: barColor }} />{barLabel}: {fmtBar(h.bar || 0)}</div>
          {lineLabel && <div><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: lineColor }} />{lineLabel}: {fmtLine(h.line || 0)}</div>}
        </div>
      )}
      <div className="flex gap-4 text-xs text-slate-500 mt-1 px-1">
        <span><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1 align-middle" style={{ background: barColor }} />{barLabel}</span>
        {lineLabel && <span><span className="inline-block w-2.5 h-2.5 rounded-full mr-1 align-middle" style={{ background: lineColor }} />{lineLabel}</span>}
      </div>
    </div>
  );
}

/** Gorizontal ustunlar ro'yxati (funnel, holatlar, funksiyalar, platforma) */
export function HBars({ rows, color = "var(--primary)", fmt = fmtN }: { rows: { label: string; value: number; hint?: string; color?: string }[]; color?: string; fmt?: (v: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i}>
          <div className="flex items-center justify-between text-sm mb-1"><span className="truncate mr-2">{r.label}</span><span className="font-semibold tabular-nums shrink-0">{fmt(r.value)}{r.hint && <span className="text-slate-400 font-normal ml-1.5">· {r.hint}</span>}</span></div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${(r.value / max) * 100}%`, background: r.color || color }} /></div>
        </div>
      ))}
      {!rows.length && <div className="text-sm text-slate-400">Ma'lumot yo'q</div>}
    </div>
  );
}

/** Statistika plitkasi */
export function Stat({ label, value, sub, icon, tone = "blue", to, info }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon?: React.ReactNode; tone?: "blue" | "green" | "amber" | "red" | "violet" | "slate"; to?: string; info?: React.ReactNode }) {
  const tones: Record<string, string> = { blue: "bg-blue-50 text-blue-600", green: "bg-emerald-50 text-emerald-600", amber: "bg-amber-50 text-amber-600", red: "bg-red-50 text-red-600", violet: "bg-violet-50 text-violet-600", slate: "bg-slate-100 text-slate-600" };
  const body = (
    <div className="card p-4 h-full flex gap-3 hover:shadow-md transition-shadow">
      {icon && <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tones[tone]}`}>{icon}</div>}
      <div className="min-w-0 flex-1"><div className="text-xs text-slate-500 flex items-center gap-1.5"><span className="truncate">{label}</span>{info}</div><div className="text-xl font-bold leading-tight mt-0.5 tabular-nums">{value}</div>{sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}</div>
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

/** Ko'rsatkich yonidagi «i» tugmasi — bosilganda tushuntirish va misol chiqadi */
export function InfoDot({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);
  return (
    <>
      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }} title="Bu nima?"
        className="w-5 h-5 rounded-full border border-slate-300 text-slate-400 hover:text-[var(--primary)] hover:border-[var(--primary)] flex items-center justify-center shrink-0">
        <Info size={12} />
      </button>
      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative card w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <div className="font-semibold">{title}</div>
              <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center"><X size={18} /></button>
            </div>
            <div className="p-5 text-sm leading-relaxed space-y-2.5 text-slate-600">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}

/** Misol bloki (InfoDot ichida) */
export function Example({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-[13px] font-mono whitespace-pre-line">{children}</div>;
}
