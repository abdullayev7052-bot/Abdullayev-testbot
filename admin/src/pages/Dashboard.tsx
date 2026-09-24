import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { RefreshCw, Users, UserPlus, Activity, Moon, Repeat, ShoppingBag, Wallet, Receipt, XCircle, Bell, Package, Search, Smartphone, Filter, Info, Timer, Heart } from "lucide-react";
import { api } from "../lib/api.ts";
import { PageTitle, Spinner } from "../components/ui.tsx";
import { BarLineChart, Example, HBars, InfoDot, Stat, fmtMoney, fmtN, fmtPct } from "../components/charts.tsx";
import { useSettings } from "./Settings.tsx";

/* ---------- Server javobi ---------- */
interface KV { key: string; count: number; sum: number }
interface Report {
  range: { from: string; to: string; group: "day" | "week" | "month"; tz: string };
  filters: { storeId: string | null; type: string | null; platform: string | null; lang: string | null };
  tracking: { since: string | null };
  users: {
    total: number; registered: number; new: { today: number; week: number; month: number; period: number };
    dau: number; wau: number; mau: number; activePeriod: number; stickiness: number;
    inactive: { d7: number; d14: number; d30: number };
    retention: Record<"d1" | "d7" | "d30", { base: number; returned: number; pct: number }>;
    cohorts: { date: string; size: number; d1: number | null; d7: number | null; d30: number | null }[];
    languages: { key: string; count: number }[];
  };
  orders: {
    period: { count: number; sum: number; canceled: number; cancelRate: number; aov: number; buyers: number };
    quick: { today: { count: number; sum: number }; week: { count: number; sum: number }; month: { count: number; sum: number }; all: number };
    statuses: { key: string; label: string; count: number; sum: number }[]; byType: KV[]; byStore: KV[];
  };
  sessions: { count: number; users: number; avgSec: number; medianSec: number; avgEvents: number; perUser: number; bounceRate: number };
  series: { date: string; newUsers: number; activeUsers: number; appOpens: number; orders: number; revenue: number; canceled: number }[];
  funnel: { key: string; label: string; users: number; pct: number; step: number }[];
  conversion: { overall: number; new: { opened: number; ordered: number; pct: number }; returning: { opened: number; ordered: number; pct: number } };
  features: { key: string; label: string; count: number; users: number }[];
  search: { total: number; users: number; zero: number; top: { q: string; count: number }[]; zeroResult: { q: string; count: number }[]; toView: { users: number; pct: number }; toCart: { users: number; pct: number }; toOrder: { users: number; pct: number } };
  platforms: { key: string; users: number; opens: number }[];
  topViewed: { id: number; name: string; count: number; users: number }[];
  misc: { products: number; waitlist: number; favorites: number };
  stores: { id: string; name: string }[];
}

const PRESETS: { key: string; label: string }[] = [
  { key: "today", label: "Bugun" }, { key: "yesterday", label: "Kecha" }, { key: "7d", label: "7 kun" }, { key: "30d", label: "30 kun" },
  { key: "90d", label: "90 kun" }, { key: "month", label: "Bu oy" }, { key: "prevMonth", label: "O'tgan oy" }, { key: "year", label: "Bu yil" }, { key: "all", label: "Hammasi" },
];
const PLATFORMS: Record<string, string> = { ios: "iOS", android: "Android", tdesktop: "Telegram Desktop", macos: "Telegram macOS", web: "Web", weba: "Telegram Web (A)", webk: "Telegram Web (K)", unknown: "Noma'lum", bot: "Bot" };
const LANGS: Record<string, string> = { uz: "O'zbek", ru: "Rus", en: "Ingliz" };
const STAGE_TONE: Record<string, string> = { new: "#3b82f6", accepted: "#8b5cf6", ready: "#06b6d4", delivering: "#f59e0b", done: "#10b981", canceled: "#ef4444", other: "#94a3b8" };

/** Soniyani odam o'qiydigan ko'rinishga: 95 → "1 daq 35 s" */
function fmtDur(sec: number): string {
  if (!sec) return "0 s";
  const m = Math.floor(sec / 60), r = Math.round(sec % 60);
  if (m >= 60) { const h = Math.floor(m / 60); return `${h} soat ${m % 60} daq`; }
  return m ? `${m} daq ${r} s` : `${r} s`;
}

function fmtDate(s: string, group: string) {
  const [y, m, d] = s.split("-");
  if (group === "month") return `${m}.${y}`;
  return `${d}.${m}`;
}

export function Dashboard() {
  const [params, setParams] = useSearchParams();
  const preset = params.get("preset") || (params.get("from") ? "" : "30d");
  const from = params.get("from") || "", to = params.get("to") || "";
  const group = params.get("group") || "day";
  const storeId = params.get("storeId") || "", type = params.get("type") || "", platform = params.get("platform") || "", lang = params.get("lang") || "";
  const setP = (patch: Record<string, string>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) { if (v) p.set(k, v); else p.delete(k); }
    setParams(p, { replace: true });
  };
  const qs = new URLSearchParams({ ...(preset ? { preset } : { from, to }), group, storeId, type, platform, lang }).toString();
  const rep = useQuery({ queryKey: ["analytics", qs], queryFn: () => api.get<Report>(`/analytics?${qs}`), refetchInterval: 60000, placeholderData: (prev) => prev });
  const settings = useSettings();
  const suffix = useMemo(() => { const c = settings.data?.general?.currencySuffix as Record<string, string> | undefined; return c?.uz || "so'm"; }, [settings.data]);
  const money = (v: number) => fmtMoney(v, suffix);
  const d = rep.data;

  const filterBar = (
    <div className="card p-3 md:p-4 mb-5 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => <button key={p.key} onClick={() => setP({ preset: p.key, from: "", to: "" })} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${preset === p.key ? "bg-[var(--primary)] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{p.label}</button>)}
      </div>
      <div className="flex flex-wrap gap-2 items-center text-sm">
        <span className="text-slate-500 flex items-center gap-1"><Filter size={14} /> Davr:</span>
        <input type="date" className="input !w-auto !py-1.5" value={from || d?.range.from || ""} onChange={(e) => setP({ preset: "", from: e.target.value, to: to || d?.range.to || e.target.value })} />
        <span className="text-slate-400">—</span>
        <input type="date" className="input !w-auto !py-1.5" value={to || d?.range.to || ""} onChange={(e) => setP({ preset: "", to: e.target.value, from: from || d?.range.from || e.target.value })} />
        <select className="input !w-auto !py-1.5" value={group} onChange={(e) => setP({ group: e.target.value })}><option value="day">Kunlar bo'yicha</option><option value="week">Haftalar bo'yicha</option><option value="month">Oylar bo'yicha</option></select>
        {d && d.stores.length > 1 && <select className="input !w-auto !py-1.5" value={storeId} onChange={(e) => setP({ storeId: e.target.value })}><option value="">Barcha do'konlar</option>{d.stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
        <select className="input !w-auto !py-1.5" value={type} onChange={(e) => setP({ type: e.target.value })}><option value="">Barcha buyurtma turlari</option><option value="delivery">Yetkazib berish</option><option value="pickup">Olib ketish</option></select>
        <select className="input !w-auto !py-1.5" value={platform} onChange={(e) => setP({ platform: e.target.value })}><option value="">Barcha platformalar</option>{Object.entries(PLATFORMS).filter(([k]) => k !== "bot" && k !== "unknown").map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select className="input !w-auto !py-1.5" value={lang} onChange={(e) => setP({ lang: e.target.value })}><option value="">Barcha tillar</option>{Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        {(storeId || type || platform || lang) && <button className="text-blue-600 text-sm" onClick={() => setP({ storeId: "", type: "", platform: "", lang: "" })}>Filtrlarni tozalash</button>}
      </div>
    </div>
  );

  if (!d) return <div><PageTitle title="Dashboard" description="Analitika va hisobotlar" />{filterBar}<Spinner /></div>;

  const g = d.range.group;
  const series = d.series.map((s) => ({ ...s, label: fmtDate(s.date, g) }));
  const stageColor = (k: string) => STAGE_TONE[k] || STAGE_TONE.other;
  const since = d.tracking.since ? new Date(d.tracking.since) : null;
  const Card = ({ title, icon, children, hint, info }: { title: string; icon?: React.ReactNode; children: React.ReactNode; hint?: string; info?: React.ReactNode }) => (
    <div className="card p-5"><div className="font-semibold flex items-center gap-2 mb-3">{icon}{title}{info}{hint && <span className="text-xs font-normal text-slate-400 ml-auto">{hint}</span>}</div>{children}</div>
  );
  const Table = ({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) => (
    <div className="overflow-x-auto -mx-2"><table className="w-full text-sm min-w-[320px]"><thead><tr className="text-xs text-slate-400 text-left">{head.map((h, i) => <th key={i} className={`px-2 pb-2 font-medium ${i ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-slate-100">{r.map((c, j) => <td key={j} className={`px-2 py-1.5 ${j ? "text-right tabular-nums" : ""}`}>{c}</td>)}</tr>)}{!rows.length && <tr><td colSpan={head.length} className="px-2 py-4 text-center text-slate-400">Ma'lumot yo'q</td></tr>}</tbody></table></div>
  );
  const periodLabel = `${d.range.from.split("-").reverse().join(".")} — ${d.range.to.split("-").reverse().join(".")}`;

  return (
    <div>
      <PageTitle title="Dashboard" description={`Analitika va hisobotlar · ${periodLabel}`} actions={<button className="btn btn-ghost" onClick={() => rep.refetch()}><RefreshCw size={16} className={rep.isFetching ? "animate-spin" : ""} /> Yangilash</button>} />
      {filterBar}
      {since && <div className="text-xs text-slate-500 flex items-center gap-1.5 mb-4 -mt-2"><Info size={13} /> Foydalanuvchi harakatlari {since.toLocaleDateString()} dan boshlab yozilmoqda — undan oldingi davrda faqat buyurtma va ro'yxat ma'lumotlari bor.</div>}
      {!since && <div className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-4 -mt-2">Hali hodisalar yozilmagan — mijozlar Mini App'ni ochishi bilan DAU, funnel va qidiruv ko'rsatkichlari paydo bo'ladi.</div>}

      {/* ===== Foydalanuvchilar ===== */}
      <h2 className="font-bold text-lg mb-3 flex items-center gap-2"><Users size={18} /> Foydalanuvchilar</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <Stat icon={<Users size={20} />} label="Jami foydalanuvchilar" value={fmtN(d.users.total)} sub={<>ro'yxatdan o'tgan: <b>{fmtN(d.users.registered)}</b></>}
          info={<InfoDot title="Jami foydalanuvchilar">
            <p>Bot yoki Mini App'dan hech bo'lmaganda bir marta foydalangan <b>har xil</b> Telegram foydalanuvchilari soni. Bir odam 10 marta kirsa ham — 1 ta hisoblanadi.</p>
            <p><b>Ro'yxatdan o'tgan</b> — telefon raqami va ismini kiritib, buyurtma bera oladigan holatga kelganlar.</p>
            <Example>{`Jami: 12 540
Ro'yxatdan o'tgan: 8 310
→ 4 230 kishi kirgan, lekin ro'yxatdan o'tmagan`}</Example>
          </InfoDot>} />
        <Stat icon={<UserPlus size={20} />} tone="green" label="Yangi foydalanuvchilar" value={fmtN(d.users.new.period)} sub={<>bugun {fmtN(d.users.new.today)} · 7 kun {fmtN(d.users.new.week)} · 30 kun {fmtN(d.users.new.month)}</>} />
        <Stat icon={<Activity size={20} />} tone="violet" label="DAU · WAU · MAU"
          info={<InfoDot title="DAU · WAU · MAU — faol foydalanuvchilar">
            <p>Bu uchta raqam ilovadan <b>necha xil odam</b> foydalanayotganini ko'rsatadi:</p>
            <p><b>DAU</b> (Daily Active Users) — bugun faol bo'lganlar.<br /><b>WAU</b> (Weekly) — oxirgi 7 kunda faol bo'lganlar.<br /><b>MAU</b> (Monthly) — oxirgi 30 kunda faol bo'lganlar.</p>
            <p>«Faol» degani: ilovani ochgan yoki biror amal qilgan (mahsulot ko'rgan, qidirgan, savatga qo'shgan). Har bir odam bir marta sanaladi.</p>
            <Example>{`DAU: 843 — bugun 843 xil odam kirdi
WAU: 3 421 — shu hafta 3 421 xil odam
MAU: 8 940 — shu oyda 8 940 xil odam`}</Example>
          </InfoDot>} value={<>{fmtN(d.users.dau)} <span className="text-slate-300 font-normal">·</span> {fmtN(d.users.wau)} <span className="text-slate-300 font-normal">·</span> {fmtN(d.users.mau)}</>} sub={<>davrda faol: <b>{fmtN(d.users.activePeriod)}</b></>} />
        <Stat icon={<Repeat size={20} />} tone="amber" label="DAU / MAU (qaytish darajasi)" value={fmtPct(d.users.stickiness)} sub="vaqt davomida o'zgarishini kuzating"
          info={<InfoDot title="DAU / MAU — mijozlar qanchalik tez-tez qaytadi">
            <p>Bugungi faollarni oylik faollarga bo'lib chiqadigan foiz. Mijozlar ilovaga qanchalik tez-tez qaytayotganini bitta raqamda ko'rsatadi.</p>
            <Example>{`DAU: 843
MAU: 8 940
843 ÷ 8 940 × 100 = 9,4%`}</Example>
            <p>9,4% degani: oyiga bir marta bo'lsa ham kirgan odamlarning ~10% i har kuni kiradi. Bu «yaxshi/yomon» degan baho emas — <b>vaqt davomida o'zgarishini</b> kuzatish kerak: o'ssa — ilova odat bo'lyapti, tushsa — mijozlar sovuyapti.</p>
          </InfoDot>} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat icon={<Moon size={20} />} tone="slate" label="Faol bo'lmay qolganlar" value={fmtN(d.users.inactive.d30)} sub={<>30 kun: {fmtN(d.users.inactive.d30)} · 14 kun: {fmtN(d.users.inactive.d14)} · 7 kun: {fmtN(d.users.inactive.d7)}</>}
          info={<InfoDot title="Faol bo'lmay qolgan mijozlar">
            <p>Ilgari kirgan, lekin belgilangan kundan beri qaytmagan mijozlar soni.</p>
            <Example>{`30 kundan beri qaytmagan: 1 248
14 kundan beri: 634
7 kundan beri: 391`}</Example>
            <p>Qoida oddiy: mijozning oxirgi harakati (yoki ro'yxatdan o'tgan sanasi) shu kundan eski bo'lsa — «qaytmagan» deb sanaladi.</p>
            <p><b>Nima qilish mumkin:</b> shularga <b>Kontent → Post</b> orqali chegirma yoki yangilik haqida xabar yuborish.</p>
          </InfoDot>} />
        {(["d1", "d7", "d30"] as const).map((k) => { const r = d.users.retention[k]; return <Stat key={k} tone="green" label={`Retention ${k.toUpperCase()}`} value={r.base ? fmtPct(r.pct) : "—"} sub={r.base ? `${fmtN(r.returned)} / ${fmtN(r.base)} qaytdi` : `${k.slice(1)} kundan katta foydalanuvchi hali yo'q`}
          info={<InfoDot title={`Retention D${k.slice(1)} — qaytib kelganlar`}>
            <p>Birinchi marta kirgan mijozlarning qanchasi <b>{k.slice(1)} kundan keyin</b> yana qaytib kelganini ko'rsatadi.</p>
            <Example>{`1-sentabrda 100 ta yangi mijoz keldi
${k === "d1" ? "2-sentabrda (1 kundan keyin)" : k === "d7" ? "8-sentabrda (7 kundan keyin)" : "1-oktabrda (30 kundan keyin)"} ulardan 23 tasi qaytdi
→ Retention D${k.slice(1)} = 23%`}</Example>
            <p>D1 — ilova birinchi taassurot qoldirdimi; D7 — foydali bo'ldimi; D30 — doimiy mijozga aylandimi.</p>
            <p>Pastdagi <b>Kogorta</b> jadvali xuddi shu narsani qo'shilgan kunlar bo'yicha alohida ko'rsatadi.</p>
          </InfoDot>} />; })}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat icon={<Timer size={20} />} tone="blue" label="O'rtacha sessiya davomiyligi" value={fmtDur(d.sessions.avgSec)}
          sub={<>mediana: {fmtDur(d.sessions.medianSec)} · sessiyalar: {fmtN(d.sessions.count)}</>}
          info={<InfoDot title="O'rtacha sessiya davomiyligi (Mini App'da qancha vaqt o'tiriladi)">
            <p>Bitta mijoz Mini App'ni ochgandan to yopgunicha o'rtacha necha daqiqa ichida ish qilishini ko'rsatadi.</p>
            <p>Sessiya — mijozning uzluksiz harakatlari. Agar mijoz 30 daqiqadan ko'proq hech nima qilmasa, keyingi harakati <b>yangi sessiya</b> deb hisoblanadi. Davomiylik = sessiyadagi birinchi va oxirgi harakat orasidagi vaqt.</p>
            <Example>{`Mijoz 19:00 da ilovani ochdi
19:00 — ilovani ochdi
19:02 — 3 ta mahsulot ko'rdi
19:05 — savatga qo'shdi
19:07 — buyurtma berdi va yopdi
→ sessiya davomiyligi: 7 daqiqa`}</Example>
            <p><b>Mediana</b> — o'rtachadan ishonchliroq: sessiyalarning yarmi shundan qisqa, yarmi uzun. Bitta juda uzun sessiya o'rtachani ko'taradi, mediana esa o'zgarmaydi.</p>
            <p><b>Nega muhim:</b> vaqt qisqarib borsa — mijozlar kerakli narsani topa olmayapti; uzayib, lekin buyurtma ko'paymasa — katalogda chalkashlik bor.</p>
          </InfoDot>} />
        <Stat icon={<Activity size={20} />} tone="violet" label="Bir mijozga sessiya" value={d.sessions.perUser ? String(d.sessions.perUser).replace(".", ",") : "0"}
          sub={<>sessiyada ~{String(d.sessions.avgEvents).replace(".", ",")} ta harakat</>}
          info={<InfoDot title="Bir mijozga to'g'ri keladigan sessiyalar soni">
            <p>Tanlangan davrda bitta mijoz ilovani o'rtacha necha marta ochib-yopganini ko'rsatadi.</p>
            <Example>{`Davrda 300 ta sessiya bo'ldi
Ularni 100 ta har xil mijoz qilgan
→ bir mijozga 3 sessiya`}</Example>
            <p>Soni ko'p bo'lsa — mijozlar qaytib kelmoqda. 1 ga yaqin bo'lsa — ko'pchilik bir marta kirib, qaytmayapti.</p>
          </InfoDot>} />
        <Stat icon={<XCircle size={20} />} tone="amber" label="Tez chiqib ketganlar" value={fmtPct(d.sessions.bounceRate)}
          sub="30 soniyadan kam qolganlar"
          info={<InfoDot title="Tez chiqib ketganlar (bounce)">
            <p>Ilovani ochib, 30 soniyadan kam vaqt ichida hech narsa qilmay yopib ketganlar ulushi.</p>
            <Example>{`100 ta sessiyadan 28 tasi
30 soniyagacha davom etdi
→ 28%`}</Example>
            <p>Yuqori bo'lsa: ilova sekin ochilyapti, bosh sahifada qiziqarli narsa yo'q yoki narx/qoldiq noto'g'ri ko'rinayotgan bo'lishi mumkin.</p>
          </InfoDot>} />
        <Stat icon={<Heart size={20} />} tone="red" label="Istaklarga qo'shilganlar" value={fmtN(d.misc.favorites)} sub="jami ❤️ belgilar" to="/waitlist"
          info={<InfoDot title="Istaklarim (❤️)">
            <p>Mijozlar mahsulot kartochkasidagi yurakchani bosib saqlab qo'ygan mahsulotlar soni (jami barcha mijozlar bo'yicha).</p>
            <p>Kim nimani yoqtirgani: <b>Nazorat → Kutilayotgan mahsulotlar → Istaklarim</b>. Aynan shu mahsulotni yoqtirganlarga xabar yuborish: <b>Kontent → Post</b>.</p>
          </InfoDot>} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2"><Card title="Foydalanuvchilar dinamikasi" hint={g === "day" ? "kunlar" : g === "week" ? "haftalar" : "oylar"}>
          <BarLineChart data={series.map((s) => ({ label: s.label, bar: s.activeUsers, line: s.newUsers }))} barLabel="Faol foydalanuvchilar" lineLabel="Yangi foydalanuvchilar" lineColor="#10b981" />
        </Card></div>
        <Card title="Kogorta retention" hint="qo'shilgan davr bo'yicha">
          <Table head={["Kogorta", "Soni", "D1", "D7", "D30"]} rows={d.users.cohorts.slice(-12).map((c) => [fmtDate(c.date, g), fmtN(c.size), c.d1 === null ? "—" : fmtPct(c.d1), c.d7 === null ? "—" : fmtPct(c.d7), c.d30 === null ? "—" : fmtPct(c.d30)])} />
        </Card>
      </div>

      {/* ===== Buyurtmalar ===== */}
      <h2 className="font-bold text-lg mb-3 flex items-center gap-2"><ShoppingBag size={18} /> Buyurtmalar</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat icon={<ShoppingBag size={20} />} label="Buyurtmalar (davrda)" value={fmtN(d.orders.period.count)} sub={<>bugun {fmtN(d.orders.quick.today.count)} · 7 kun {fmtN(d.orders.quick.week.count)} · 30 kun {fmtN(d.orders.quick.month.count)} · jami {fmtN(d.orders.quick.all)}</>} />
        <Stat icon={<Wallet size={20} />} tone="green" label="Buyurtmalar summasi" value={money(d.orders.period.sum)} sub={<>bugun {money(d.orders.quick.today.sum)} · 7 kun {money(d.orders.quick.week.sum)} · 30 kun {money(d.orders.quick.month.sum)}</>} />
        <Stat icon={<Receipt size={20} />} tone="violet" label="O'rtacha buyurtma (AOV)" value={money(d.orders.period.aov)} sub={<>xaridorlar: <b>{fmtN(d.orders.period.buyers)}</b></>}
          info={<InfoDot title="AOV — o'rtacha buyurtma qiymati">
            <p>Bitta buyurtmaga o'rtacha qancha pul tushishini ko'rsatadi (bekor qilinganlar hisobga olinmaydi).</p>
            <Example>{`Jami summa: 62 200 000 so'm
Buyurtmalar: 1 000 ta
62 200 000 ÷ 1 000 = 62 200 so'm`}</Example>
            <p>Buyurtmalar soni o'zi yetarli ma'lumot emas: 1 000 ta kichik buyurtma va 300 ta katta buyurtma butunlay boshqa daromad beradi. AOV o'ssa — mijozlar ko'proq mahsulot olyapti.</p>
            <p><b>Xaridorlar</b> — shu davrda kamida bitta buyurtma bergan har xil mijozlar soni.</p>
          </InfoDot>} />
        <Stat icon={<XCircle size={20} />} tone="red" label="Bekor qilish darajasi" value={fmtPct(d.orders.period.cancelRate)} sub={`${fmtN(d.orders.period.canceled)} ta bekor qilingan`} />
      </div>
      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2"><Card title="Buyurtmalar dinamikasi">
          <BarLineChart data={series.map((s) => ({ label: s.label, bar: s.orders, line: s.revenue }))} barLabel="Buyurtmalar soni" lineLabel="Summa" fmtLine={(v) => fmtMoney(v, "")} />
        </Card></div>
        <Card title="Buyurtma holatlari">
          <HBars rows={d.orders.statuses.filter((s) => s.count > 0 || ["new", "accepted", "ready", "delivering", "done", "canceled"].includes(s.key)).map((s) => ({ label: s.label, value: s.count, hint: s.count ? money(s.sum) : undefined, color: stageColor(s.key) }))} />
          <div className="text-xs text-slate-500 mt-3">Bekor qilish darajasi: <b>{fmtPct(d.orders.period.cancelRate)}</b></div>
        </Card>
      </div>
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <Card title="Turi bo'yicha">
          <HBars rows={d.orders.byType.map((r) => ({ label: r.key === "delivery" ? "Yetkazib berish" : r.key === "pickup" ? "Olib ketish" : r.key, value: r.count, hint: money(r.sum) }))} />
          {d.orders.byStore.length > 1 && <><div className="font-semibold text-sm mt-4 mb-2">Do'konlar bo'yicha</div><HBars color="#8b5cf6" rows={d.orders.byStore.map((r) => ({ label: d.stores.find((s) => s.id === r.key)?.name || r.key, value: r.count, hint: money(r.sum) }))} /></>}
        </Card>
        <Card title="Eng ko'p ko'rilgan mahsulotlar">
          <Table head={["Mahsulot", "Ko'rishlar", "Odamlar"]} rows={d.topViewed.map((p) => [<span className="line-clamp-1" title={p.name}>{p.name || `#${p.id}`}</span>, fmtN(p.count), fmtN(p.users)])} />
        </Card>
      </div>

      {/* ===== Funnel ===== */}
      <h2 className="font-bold text-lg mb-3 flex items-center gap-2"><Filter size={18} /> Buyurtma funneli va konversiya</h2>
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2"><Card title="Funnel" hint="davr ichida, unikal foydalanuvchilar" info={<InfoDot title="Funnel — mijozlar qayerda chiqib ketyapti">
          <p>Mijoz buyurtmaga qadar bosqichma-bosqich o'tadi. Funnel har bosqichda nechta odam qolganini ko'rsatadi — shundan qayerda ko'p odam «tushib qolayotgani» ko'rinadi.</p>
          <Example>{`Mini App ochdi      5 000   100%
Mahsulot ko'rdi     4 200    84%
Savatga qo'shdi     1 800    36%
Rasmiylashtirish    1 200    24%
Buyurtma berdi        930  18,6%`}</Example>
          <p>Bu misolda eng katta yo'qotish «mahsulot ko'rdi → savatga qo'shdi» orasida (84% dan 36% ga) — demak narx yoki qoldiq bilan bog'liq muammo bor.</p>
          <p><b>Umumiy %</b> — boshidan hisoblanadi. <b>Oldingi bosqichdan %</b> — faqat bitta oldingi qadamga nisbatan.</p>
        </InfoDot>}>
          <Table head={["Bosqich", "Foydalanuvchilar", "Umumiy %", "Oldingi bosqichdan %"]} rows={d.funnel.map((f, i) => [
            <span className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-[var(--primary)] text-white text-[11px] flex items-center justify-center shrink-0">{i + 1}</span>{f.label}</span>,
            fmtN(f.users), <b>{fmtPct(Math.min(100, f.pct))}</b>, i ? fmtPct(Math.min(100, f.step)) : "—",
          ])} />
          <div className="mt-3"><HBars rows={d.funnel.map((f) => ({ label: f.label, value: f.users, hint: fmtPct(Math.min(100, f.pct)) }))} /></div>
        </Card></div>
        <Card title="Buyurtmaga aylanish (Conversion)" info={<InfoDot title="Konversiya — buyurtmaga aylanish foizi">
          <p>Mini App'ni ochgan mijozlarning necha foizi buyurtma berganini ko'rsatadi.</p>
          <Example>{`Ilovani ochdi: 5 000 kishi
Buyurtma berdi: 930 kishi
930 ÷ 5 000 × 100 = 18,6%`}</Example>
          <p><b>Yangi</b> — shu davrda birinchi marta kelganlar. <b>Qaytgan</b> — ilgaridan bor mijozlar. Odatda qaytgan mijozlarda foiz yuqori bo'ladi; yangilarda past bo'lsa — birinchi tanishuv qiyin kechyapti.</p>
          <p>Davrni «Bugun / 7 kun / Bu oy» qilib almashtirsangiz — kunlik, haftalik va oylik konversiyani ko'rasiz.</p>
        </InfoDot>}>
          <div className="text-4xl font-bold text-[var(--primary)]">{fmtPct(d.conversion.overall)}</div>
          <div className="text-sm text-slate-500 mt-1">Mini App'ni ochganlardan buyurtma berganlar ulushi</div>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between text-sm"><span>Yangi foydalanuvchilar</span><b>{fmtPct(d.conversion.new.pct)}</b></div>
            <div className="text-xs text-slate-400 -mt-2">{fmtN(d.conversion.new.ordered)} / {fmtN(d.conversion.new.opened)}</div>
            <div className="flex items-center justify-between text-sm"><span>Qaytgan foydalanuvchilar</span><b>{fmtPct(d.conversion.returning.pct)}</b></div>
            <div className="text-xs text-slate-400 -mt-2">{fmtN(d.conversion.returning.ordered)} / {fmtN(d.conversion.returning.opened)}</div>
          </div>
          <div className="text-xs text-slate-400 mt-4">Davrni "Bugun / 7 kun / Bu oy" qilib kunlik, haftalik, oylik konversiyani ko'ring.</div>
        </Card>
      </div>

      {/* ===== Xatti-harakat, qidiruv, platforma ===== */}
      <h2 className="font-bold text-lg mb-3 flex items-center gap-2"><Activity size={18} /> Foydalanuvchi xatti-harakati</h2>
      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card title="Qaysi funksiyalar ko'proq ishlatiladi" hint="harakatlar soni">
          <HBars rows={d.features.filter((f) => f.count > 0).sort((a, b) => b.count - a.count).map((f) => ({ label: f.label, value: f.count, hint: `${fmtN(f.users)} kishi` }))} />
        </Card>
        <Card title="Qidiruv analitikasi" icon={<Search size={16} />} info={<InfoDot title="Qidiruv analitikasi">
            <p>Mijozlar katalogda nimani qidirayotganini ko'rsatadi — bu ular <b>nimani xohlayotganini</b> to'g'ridan-to'g'ri aytadi.</p>
            <p><b>Natijasiz qidiruvlar</b> eng qimmatli qism: mijoz qidirgan, lekin hech narsa chiqmagan.</p>
            <Example>{`"nike"          842 marta
"oq krossovka"  613 marta
"41 razmer"     401 marta
Natijasiz: "adidas" — 96 marta`}</Example>
            <p>«adidas» 96 marta natijasiz qidirilgan bo'lsa: yo shunday mahsulot yo'q (olib kelish kerak), yo Bito'dagi nomi boshqacha yozilgan.</p>
            <p><b>Qidiruv → savat / buyurtma</b> — qidirganlarning qanchasi oxirigacha borgani.</p>
          </InfoDot>}>
          <div className="grid grid-cols-3 gap-2 mb-3 text-center">
            <div className="bg-slate-50 rounded-xl p-2"><div className="text-lg font-bold">{fmtN(d.search.total)}</div><div className="text-[11px] text-slate-500">qidiruvlar</div></div>
            <div className="bg-slate-50 rounded-xl p-2"><div className="text-lg font-bold">{fmtN(d.search.users)}</div><div className="text-[11px] text-slate-500">qidirganlar</div></div>
            <div className="bg-slate-50 rounded-xl p-2"><div className="text-lg font-bold text-red-600">{fmtN(d.search.zero)}</div><div className="text-[11px] text-slate-500">natijasiz</div></div>
          </div>
          <div className="text-xs text-slate-500 space-y-1 mb-3">
            <div className="flex justify-between"><span>Qidiruv → mahsulot ko'rdi</span><b>{fmtPct(d.search.toView.pct)}</b></div>
            <div className="flex justify-between"><span>Qidiruv → savatga qo'shdi</span><b>{fmtPct(d.search.toCart.pct)}</b></div>
            <div className="flex justify-between"><span>Qidiruv → buyurtma berdi</span><b>{fmtPct(d.search.toOrder.pct)}</b></div>
          </div>
          <div className="font-semibold text-sm mb-1">Eng ko'p qidirilganlar</div>
          <Table head={["So'rov", "Marta"]} rows={d.search.top.slice(0, 8).map((s) => [`"${s.q}"`, fmtN(s.count)])} />
          {d.search.zeroResult.length > 0 && <><div className="font-semibold text-sm mt-3 mb-1 text-red-600">Natija chiqmagan qidiruvlar</div><Table head={["So'rov", "Marta"]} rows={d.search.zeroResult.slice(0, 8).map((s) => [`"${s.q}"`, fmtN(s.count)])} /></>}
        </Card>
        <div className="space-y-4">
          <Card title="Qurilma va platforma" icon={<Smartphone size={16} />}>
            {(() => { const tot = d.platforms.reduce((a, p) => a + p.users, 0); return <HBars rows={d.platforms.map((p) => ({ label: PLATFORMS[p.key] || p.key, value: p.users, hint: tot ? fmtPct((p.users / tot) * 100) : undefined }))} />; })()}
          </Card>
          <Card title="Tillar" hint="barcha foydalanuvchilar">
            {(() => { const tot = d.users.languages.reduce((a, p) => a + p.count, 0); return <HBars color="#10b981" rows={d.users.languages.map((p) => ({ label: LANGS[p.key] || p.key, value: p.count, hint: tot ? fmtPct((p.count / tot) * 100) : undefined }))} />; })()}
          </Card>
        </div>
      </div>

      {/* ===== Tezkor havolalar ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat icon={<Bell size={20} />} tone="amber" label="Kutilayotgan mahsulotlar" value={fmtN(d.misc.waitlist)} sub="ochish →" to="/waitlist" />
        <Stat icon={<Package size={20} />} tone="slate" label="Mahsulotlar (Bito)" value={fmtN(d.misc.products)} sub="katalog boshqaruvi →" to="/catalog" />
      </div>
    </div>
  );
}
