import { useMemo } from "react";
import { motion } from "motion/react";
import { useT } from "../store/app.ts";
import { Img, Skeleton, Empty } from "./ui.tsx";
import { useCatalogFmt } from "./ProductCard.tsx";
import { qty as fq } from "../lib/format.ts";

export interface HistoryRow {
  id: string | number;
  number: string;
  date: string;
  total: number;
  status: string;
  stage: string;
  org?: string | null;
  items?: { name: string; qty: number; price: number; image?: string | null; measure?: string | null }[];
}

export const STAGE_TONE: Record<string, string> = {
  new: "bg-blue-50 text-blue-600",
  accepted: "bg-violet-50 text-violet-600",
  ready: "bg-cyan-50 text-cyan-700",
  delivering: "bg-amber-50 text-amber-700",
  done: "bg-emerald-50 text-emerald-700",
  canceled: "bg-red-50 text-red-600",
  other: "bg-slate-100 text-slate-600",
};

const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const dayLabel = (key: string, todayLabel: string, yesterdayLabel: string) => {
  const now = new Date();
  const t = dayKey(now.toISOString());
  const y = dayKey(new Date(now.getTime() - 86400000).toISOString());
  if (key === t) return todayLabel;
  if (key === y) return yesterdayLabel;
  const [yy, mm, dd] = key.split("-");
  return `${dd}.${mm}.${yy}`;
};
export const dateTime = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Sana bo'yicha guruhlangan tarix ro'yxati (buyurtmalar yoki xaridlar) */
export function HistoryList({ rows, loading, onOpen, emptyTitle, emptyEmoji }: {
  rows: HistoryRow[]; loading?: boolean; onOpen: (r: HistoryRow) => void; emptyTitle: string; emptyEmoji: string;
}) {
  const { t } = useT();
  const f = useCatalogFmt();
  const groups = useMemo(() => {
    const map = new Map<string, HistoryRow[]>();
    for (const r of rows) {
      const k = dayKey(r.date);
      const arr = map.get(k) || [];
      arr.push(r);
      map.set(k, arr);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [rows]);

  if (loading) return <div className="space-y-2.5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>;
  if (!rows.length) return <Empty emoji={emptyEmoji} title={emptyTitle} />;

  return (
    <div className="space-y-4">
      {groups.map(([key, list]) => (
        <div key={key}>
          <div className="text-xs text-slate-400 mb-1.5 px-1">{dayLabel(key, t("profile", "today"), t("profile", "yesterday"))}</div>
          <div className="space-y-2">
            {list.map((r, i) => (
              <motion.button key={`${r.id}-${r.number}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 * i }}
                onClick={() => onOpen(r)} className="w-full rounded-2xl bg-[var(--soft)] p-3.5 text-left">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-lg font-bold leading-tight">#{r.number}</div>
                    {r.org && <div className="text-sm text-slate-400 mt-0.5">{r.org}</div>}
                  </div>
                  <span className={`text-sm font-semibold px-3 py-1.5 rounded-xl shrink-0 ${STAGE_TONE[r.stage] || STAGE_TONE.other}`}>{r.status}</span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-slate-200/70">
                  <span className="text-sm text-slate-600">{dateTime(r.date)}</span>
                  <span className="text-sm font-semibold">{f.price(r.total)}</span>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Tafsilot oynasi ichidagi ma'lumotlar (raqam, holat, tashkilot, sana + mahsulotlar + jami) */
export function HistoryDetails({ row }: { row: HistoryRow }) {
  const { t } = useT();
  const f = useCatalogFmt();
  const Line = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-slate-400">{label}:</span>
      <span className="font-semibold text-right">{children}</span>
    </div>
  );
  return (
    <div className="px-4 pb-8">
      <div className="text-[15px]">
        <Line label={t("profile", "detailNumber")}>#{row.number}</Line>
        <Line label={t("profile", "detailStatus")}>
          <span className={`text-sm font-semibold px-3 py-1 rounded-xl ${STAGE_TONE[row.stage] || STAGE_TONE.other}`}>{row.status}</span>
        </Line>
        {row.org ? <Line label={t("profile", "detailOrg")}>{row.org}</Line> : null}
        <Line label={t("profile", "detailDate")}>{dateTime(row.date)}</Line>
      </div>

      {row.items?.length ? (
        <>
          <div className="border-t border-slate-100 mt-3 pt-4">
            <div className="text-lg font-bold mb-2">{t("profile", "detailProducts")}</div>
            <div className="space-y-3">
              {row.items.map((it, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Img src={it.image} name={it.name} className="w-14 h-14 rounded-xl shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] leading-snug line-clamp-2">{it.name}</div>
                    <div className="text-sm text-slate-400 mt-0.5">{fq(it.qty)} {it.measure || t("profile", "pieceShort")}</div>
                  </div>
                  <div className="font-semibold text-[15px] shrink-0">{f.price(it.price * it.qty)}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}

      <div className="flex items-center justify-between border-t border-slate-100 mt-4 pt-3 text-lg font-bold" style={{ color: "var(--primary)" }}>
        <span>{t("profile", "detailTotal")}:</span>
        <span>{f.price(row.total)}</span>
      </div>
    </div>
  );
}
