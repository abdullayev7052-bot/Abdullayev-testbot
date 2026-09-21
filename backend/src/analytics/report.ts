/**
 * Dashboard analitikasi: foydalanuvchilar, buyurtmalar, funnel, qidiruv, platforma.
 * Barcha hisoblar bazada (Postgres) bajariladi; sanalar O'zbekiston vaqti bo'yicha guruhlanadi.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../db.ts";
import { getSettings, lt } from "../settings/store.ts";

export const TZ = "Asia/Tashkent";
const TZ_OFFSET = "+05:00";
export type Group = "day" | "week" | "month";

export interface ReportFilters {
  from: string;        // YYYY-MM-DD (mahalliy, inklyuziv)
  to: string;          // YYYY-MM-DD (mahalliy, inklyuziv)
  group: Group;
  storeId?: string | null;
  type?: string | null;      // delivery | pickup
  platform?: string | null;  // ios | android | tdesktop | web | ...
  lang?: string | null;      // uz | ru | en
}

// ---------- Sana yordamchilari (mahalliy sana = "YYYY-MM-DD") ----------
export const ymd = (d: Date) => new Date(d.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 10);
const dayStart = (s: string) => new Date(`${s}T00:00:00${TZ_OFFSET}`);
const addDays = (s: string, k: number) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
function truncLocal(s: string, g: Group): string {
  const d = new Date(`${s}T00:00:00Z`);
  if (g === "week") d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  if (g === "month") d.setUTCDate(1);
  return d.toISOString().slice(0, 10);
}
function nextBucket(s: string, g: Group): string {
  const d = new Date(`${s}T00:00:00Z`);
  if (g === "day") d.setUTCDate(d.getUTCDate() + 1);
  else if (g === "week") d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}
function bucketKeys(from: string, to: string, g: Group): string[] {
  const out: string[] = [];
  let k = truncLocal(from, g);
  const end = addDays(to, 1);
  while (k < end && out.length < 800) { out.push(k); k = nextBucket(k, g); }
  return out;
}
const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

type Row = Record<string, unknown>;
const q = <T = Row>(sql: Prisma.Sql) => prisma.$queryRaw<T[]>(sql);

/** "N kundan keyin qaytgan" — kogorta/retention uchun takrorlanuvchi parcha */
const retCols = (days: number, alias: string) => Prisma.sql`
  count(*) FILTER (WHERE u."createdAt" < (now() AT TIME ZONE 'UTC') - make_interval(days => ${days}::int))::int ${Prisma.raw("AS b" + alias)},
  count(*) FILTER (WHERE u."createdAt" < (now() AT TIME ZONE 'UTC') - make_interval(days => ${days}::int) AND EXISTS (SELECT 1 FROM "AppEvent" e WHERE e."userId" = u.id AND e."createdAt" >= u."createdAt" + make_interval(days => ${days}::int)))::int ${Prisma.raw("AS r" + alias)}`;

/** Qidiruvdan keyin (N daqiqa ichida) X hodisa qilgan foydalanuvchilar */
const afterSearch = (name: string, minutes: number, alias: string) => Prisma.sql`
  count(DISTINCT e."userId") FILTER (WHERE EXISTS (SELECT 1 FROM "AppEvent" x WHERE x."userId" = e."userId" AND x.name = ${name} AND x."createdAt" > e."createdAt" AND x."createdAt" < e."createdAt" + make_interval(mins => ${minutes}::int)))::int ${Prisma.raw("AS " + alias)}`;

export async function buildReport(f: ReportFilters) {
  const group: Group = (["day", "week", "month"] as Group[]).includes(f.group) ? f.group : "day";
  const from = dayStart(f.from), to = dayStart(addDays(f.to, 1));
  const platform = f.platform || null, lang = f.lang || null, storeId = f.storeId || null, type = f.type || null;
  const now = new Date();
  const todayStart = dayStart(ymd(now));
  const d7 = new Date(now.getTime() - 7 * 86400000), d14 = new Date(now.getTime() - 14 * 86400000), d30 = new Date(now.getTime() - 30 * 86400000);
  const earliest = d30 < from ? d30 : from;

  // Filtr parchalari (e = AppEvent, u = User, o = Order)
  const evF = Prisma.sql`e."userId" IS NOT NULL AND (${platform}::text IS NULL OR e.platform = ${platform}) AND (${lang}::text IS NULL OR u.language = ${lang})`;
  const evP = Prisma.sql`e."createdAt" >= ${from} AND e."createdAt" < ${to} AND ${evF}`;
  const uF = Prisma.sql`(${lang}::text IS NULL OR u.language = ${lang})`;
  const oF = Prisma.sql`(${storeId}::text IS NULL OR o."storeId" = ${storeId}) AND (${type}::text IS NULL OR o.type = ${type}) AND ${uF}`;
  const oP = Prisma.sql`o."createdAt" >= ${from} AND o."createdAt" < ${to} AND ${oF}`;
  // Prisma DateTime = timestamp (tz'siz, UTC) → avval UTC deb belgilab, keyin mahalliy vaqtga o'tkazamiz
  const bucket = (col: Prisma.Sql) => Prisma.sql`to_char(date_trunc(${group}, (${col} AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}), 'YYYY-MM-DD')`;
  const EV = Prisma.sql`FROM "AppEvent" e LEFT JOIN "User" u ON u.id = e."userId"`;
  const OR = Prisma.sql`FROM "Order" o JOIN "User" u ON u.id = o."userId"`;

  const [
    userTotals, active, inactive, retention, cohorts,
    sNew, sActive, sOrders,
    orderTotals, orderQuick, byStage, byType, byStore, ordersRaw,
    eventsByName, funnelBase, orderUsers, convSplit,
    searchTop, searchStats, searchNext, platforms, langs, topViewed, misc,
  ] = await Promise.all([
    // Foydalanuvchilar: jami, ro'yxatdan o'tgan, yangilar
    q(Prisma.sql`SELECT count(*)::int AS total, count(*) FILTER (WHERE u.step = 'done')::int AS registered,
      count(*) FILTER (WHERE u."createdAt" >= ${todayStart})::int AS today, count(*) FILTER (WHERE u."createdAt" >= ${d7})::int AS week,
      count(*) FILTER (WHERE u."createdAt" >= ${d30})::int AS month, count(*) FILTER (WHERE u."createdAt" >= ${from} AND u."createdAt" < ${to})::int AS period
      FROM "User" u WHERE ${uF}`),
    // DAU / WAU / MAU / davrda faol
    q(Prisma.sql`SELECT count(DISTINCT e."userId") FILTER (WHERE e."createdAt" >= ${todayStart})::int AS dau,
      count(DISTINCT e."userId") FILTER (WHERE e."createdAt" >= ${d7})::int AS wau, count(DISTINCT e."userId") FILTER (WHERE e."createdAt" >= ${d30})::int AS mau,
      count(DISTINCT e."userId") FILTER (WHERE e."createdAt" >= ${from} AND e."createdAt" < ${to})::int AS period
      ${EV} WHERE e."createdAt" >= ${earliest} AND ${evF}`),
    // Faol bo'lmay qolganlar
    q(Prisma.sql`SELECT count(*) FILTER (WHERE coalesce(u."lastActiveAt", u."createdAt") < ${d7})::int AS d7,
      count(*) FILTER (WHERE coalesce(u."lastActiveAt", u."createdAt") < ${d14})::int AS d14,
      count(*) FILTER (WHERE coalesce(u."lastActiveAt", u."createdAt") < ${d30})::int AS d30 FROM "User" u WHERE ${uF}`),
    // Retention (davrda qo'shilganlar: N kundan keyin qaytganlar)
    q(Prisma.sql`SELECT ${retCols(1, "1")}, ${retCols(7, "7")}, ${retCols(30, "30")}
      FROM "User" u WHERE u."createdAt" >= ${from} AND u."createdAt" < ${to} AND ${uF}`),
    // Kogortalar (qo'shilgan davr bo'yicha)
    q(Prisma.sql`SELECT ${bucket(Prisma.sql`u."createdAt"`)} AS b, count(*)::int AS size, ${retCols(1, "1")}, ${retCols(7, "7")}, ${retCols(30, "30")}
      FROM "User" u WHERE u."createdAt" >= ${from} AND u."createdAt" < ${to} AND ${uF} GROUP BY 1 ORDER BY 1`),
    // Seriyalar
    q(Prisma.sql`SELECT ${bucket(Prisma.sql`u."createdAt"`)} AS b, count(*)::int AS c FROM "User" u WHERE u."createdAt" >= ${from} AND u."createdAt" < ${to} AND ${uF} GROUP BY 1`),
    q(Prisma.sql`SELECT ${bucket(Prisma.sql`e."createdAt"`)} AS b, count(DISTINCT e."userId")::int AS c, count(*) FILTER (WHERE e.name = 'app_open')::int AS opens ${EV} WHERE ${evP} GROUP BY 1`),
    q(Prisma.sql`SELECT ${bucket(Prisma.sql`o."createdAt"`)} AS b, count(*)::int AS c, coalesce(sum(o.total), 0)::float8 AS s, count(*) FILTER (WHERE o."stateKey" = 'canceled')::int AS canceled ${OR} WHERE ${oP} GROUP BY 1`),
    // Buyurtmalar
    q(Prisma.sql`SELECT count(*)::int AS c, coalesce(sum(o.total), 0)::float8 AS s, count(*) FILTER (WHERE o."stateKey" = 'canceled')::int AS canceled,
      coalesce(sum(o.total) FILTER (WHERE o."stateKey" IS DISTINCT FROM 'canceled'), 0)::float8 AS s_ok, count(*) FILTER (WHERE o."stateKey" IS DISTINCT FROM 'canceled')::int AS c_ok, count(DISTINCT o."userId")::int AS buyers
      ${OR} WHERE ${oP}`),
    q(Prisma.sql`SELECT count(*) FILTER (WHERE o."createdAt" >= ${todayStart})::int AS c_today, coalesce(sum(o.total) FILTER (WHERE o."createdAt" >= ${todayStart}), 0)::float8 AS s_today,
      count(*) FILTER (WHERE o."createdAt" >= ${d7})::int AS c_week, coalesce(sum(o.total) FILTER (WHERE o."createdAt" >= ${d7}), 0)::float8 AS s_week,
      count(*) FILTER (WHERE o."createdAt" >= ${d30})::int AS c_month, coalesce(sum(o.total) FILTER (WHERE o."createdAt" >= ${d30}), 0)::float8 AS s_month, count(*)::int AS c_all
      ${OR} WHERE ${oF}`),
    q(Prisma.sql`SELECT coalesce(o."stateKey", 'new') AS k, count(*)::int AS c, coalesce(sum(o.total), 0)::float8 AS s ${OR} WHERE ${oP} GROUP BY 1`),
    q(Prisma.sql`SELECT o.type AS k, count(*)::int AS c, coalesce(sum(o.total), 0)::float8 AS s ${OR} WHERE ${oP} GROUP BY 1`),
    q(Prisma.sql`SELECT o."storeId" AS k, count(*)::int AS c, coalesce(sum(o.total), 0)::float8 AS s ${OR} WHERE ${oP} GROUP BY 1 ORDER BY 2 DESC`),
    q<{ items: unknown }>(Prisma.sql`SELECT o.items ${OR} WHERE ${oP} AND o."stateKey" IS DISTINCT FROM 'canceled' ORDER BY o."createdAt" DESC LIMIT 5000`),
    // Hodisalar (funksiyalar + funnel)
    q(Prisma.sql`SELECT e.name AS k, count(*)::int AS c, count(DISTINCT e."userId")::int AS u ${EV} WHERE ${evP} GROUP BY 1`),
    q(Prisma.sql`SELECT count(DISTINCT e."userId")::int AS c ${EV} WHERE ${evP}`),
    q(Prisma.sql`SELECT count(DISTINCT o."userId")::int AS c ${OR} WHERE ${oP}`),
    // Konversiya: yangi vs qaytgan (Mini App ochganlar ichida)
    q(Prisma.sql`WITH opened AS (SELECT DISTINCT e."userId" uid ${EV} WHERE e.name = 'app_open' AND ${evP}),
      ordered AS (SELECT DISTINCT o."userId" uid ${OR} WHERE ${oP})
      SELECT (u."createdAt" >= ${from}) AS isnew, count(DISTINCT op.uid)::int AS opened, count(DISTINCT od.uid)::int AS ordered
      FROM opened op JOIN "User" u ON u.id = op.uid LEFT JOIN ordered od ON od.uid = op.uid GROUP BY 1`),
    // Qidiruv
    q(Prisma.sql`SELECT lower(trim(e.meta->>'q')) AS k, count(*)::int AS c, max(coalesce((e.meta->>'results')::int, 0))::int AS best
      ${EV} WHERE e.name = 'search' AND ${evP} AND coalesce(e.meta->>'q', '') <> '' GROUP BY 1 ORDER BY 2 DESC LIMIT 60`),
    q(Prisma.sql`SELECT count(*)::int AS c, count(DISTINCT e."userId")::int AS u, count(*) FILTER (WHERE coalesce((e.meta->>'results')::int, 0) = 0)::int AS zero ${EV} WHERE e.name = 'search' AND ${evP}`),
    q(Prisma.sql`SELECT ${afterSearch("product_view", 30, "view")}, ${afterSearch("add_to_cart", 30, "cart")}, ${afterSearch("order_created", 120, "ordered")} ${EV} WHERE e.name = 'search' AND ${evP}`),
    // Platforma
    q(Prisma.sql`SELECT coalesce(e.platform, 'unknown') AS k, count(DISTINCT e."userId")::int AS u, count(*) FILTER (WHERE e.name = 'app_open')::int AS opens
      ${EV} WHERE ${evP} AND e.name NOT IN ('bot_start', 'bot_active') GROUP BY 1 ORDER BY 2 DESC`),
    q(Prisma.sql`SELECT u.language AS k, count(*)::int AS c FROM "User" u WHERE ${uF} GROUP BY 1 ORDER BY 2 DESC`),
    // Eng ko'p ko'rilgan mahsulotlar
    q(Prisma.sql`SELECT (e.meta->>'productId')::int AS id, max(e.meta->>'name') AS name, count(*)::int AS c, count(DISTINCT e."userId")::int AS u
      ${EV} WHERE e.name = 'product_view' AND ${evP} AND (e.meta->>'productId') ~ '^[0-9]+$' GROUP BY 1 ORDER BY 3 DESC LIMIT 10`),
    Promise.all([prisma.product.count({ where: { isDeleted: false } }), prisma.waitlist.count({ where: { notifiedAt: null } })]),
  ]);

  // ---- Seriyalarni bo'sh chelaklar bilan to'ldirish ----
  const keys = bucketKeys(f.from, f.to, group);
  const m = (rows: Row[]) => new Map(rows.map((r) => [String(r.b), r]));
  const mNew = m(sNew), mAct = m(sActive), mOrd = m(sOrders);
  const series = keys.map((k) => ({
    date: k,
    newUsers: n(mNew.get(k)?.c), activeUsers: n(mAct.get(k)?.c), appOpens: n(mAct.get(k)?.opens),
    orders: n(mOrd.get(k)?.c), revenue: n(mOrd.get(k)?.s), canceled: n(mOrd.get(k)?.canceled),
  }));

  // ---- Buyurtma holatlari (mijozga ko'rinadigan nomlar bilan) ----
  const st = getSettings().statuses as Record<string, unknown>;
  const name = (k: string) => { const v = st[k]; return v && typeof v === "object" ? lt(v as never, "uz") : String(v || ""); };
  const stageLabel: Record<string, string> = {
    new: name("nameNew"), accepted: name("nameAccepted"), ready: name("nameReady"), delivering: name("nameDelivering"), done: name("nameDone"), canceled: name("nameCanceled"), other: "Boshqa",
  };
  const stageOrder = ["new", "accepted", "ready", "delivering", "done", "canceled", "other"];
  const stageMap = new Map(byStage.map((r) => [String(r.k), r]));
  const statuses = stageOrder.map((k) => ({ key: k, label: stageLabel[k] || k, count: n(stageMap.get(k)?.c), sum: n(stageMap.get(k)?.s) }));
  for (const [k, r] of stageMap) if (!stageOrder.includes(k)) statuses.push({ key: k, label: k, count: n(r.c), sum: n(r.s) });

  // ---- Eng ko'p sotilgan mahsulotlar (buyurtma tarkibidan) ----
  const sold = new Map<string, { id: number | null; name: string; qty: number; sum: number; orders: number }>();
  for (const row of ordersRaw) {
    const items = Array.isArray(row.items) ? (row.items as { productId?: number; name?: string; price?: number; qty?: number }[]) : [];
    for (const it of items) {
      const key = String(it.productId ?? it.name ?? "?");
      const cur = sold.get(key) || { id: it.productId ?? null, name: it.name || key, qty: 0, sum: 0, orders: 0 };
      cur.qty += n(it.qty); cur.sum += n(it.price) * n(it.qty); cur.orders += 1;
      sold.set(key, cur);
    }
  }
  const topSold = [...sold.values()].sort((a, b) => b.sum - a.sum).slice(0, 10);

  // ---- Funnel ----
  const ev = new Map(eventsByName.map((r) => [String(r.k), r]));
  const evUsers = (k: string) => n(ev.get(k)?.u);
  const evCount = (k: string) => n(ev.get(k)?.c);
  const funnelSteps = [
    { key: "bot", label: "Botga / ilovaga kirgan", users: n(funnelBase[0]?.c) },
    { key: "app_open", label: "Mini App ochgan", users: evUsers("app_open") },
    { key: "product_view", label: "Mahsulot ko'rgan", users: evUsers("product_view") },
    { key: "add_to_cart", label: "Savatga qo'shgan", users: evUsers("add_to_cart") },
    { key: "checkout_start", label: "Rasmiylashtirishni boshlagan", users: evUsers("checkout_start") },
    { key: "order", label: "Buyurtma bergan", users: n(orderUsers[0]?.c) },
  ];
  const base = funnelSteps[1].users || funnelSteps[0].users;
  const funnel = funnelSteps.map((s, i) => ({ ...s, pct: pct(s.users, base), step: i > 0 ? pct(s.users, funnelSteps[i - 1].users) : 100 }));

  const conv = { new: { opened: 0, ordered: 0 }, returning: { opened: 0, ordered: 0 } };
  for (const r of convSplit) { const t = r.isnew ? conv.new : conv.returning; t.opened += n(r.opened); t.ordered += n(r.ordered); }

  const features = [
    ["product_view", "Mahsulot ko'rish"], ["category_view", "Kategoriya tanlash"], ["search", "Qidiruv"], ["add_to_cart", "Savatga qo'shish"], ["checkout_start", "Rasmiylashtirish"],
    ["order_created", "Buyurtma berish"], ["waitlist_add", "Kelganda eslating"], ["story_view", "Storis ko'rish"], ["banner_click", "Banner bosish"], ["profile_open", "Profil"],
    ["order_history", "Buyurtmalar tarixi"], ["purchases", "Xaridlar (Bito)"], ["card", "Karta"], ["bot_active", "Bot bilan muloqot"],
  ].map(([key, label]) => ({ key, label, count: evCount(key), users: evUsers(key) }));

  const ut = userTotals[0] || {}, ac = active[0] || {}, ina = inactive[0] || {}, rt = retention[0] || {}, ot = orderTotals[0] || {}, oq = orderQuick[0] || {}, ss = searchStats[0] || {}, sn = searchNext[0] || {};
  const searchers = n(ss.u);
  const ret = (b: unknown, r: unknown) => ({ base: n(b), returned: n(r), pct: pct(n(r), n(b)) });
  return {
    range: { from: f.from, to: f.to, group, tz: TZ },
    filters: { storeId, type, platform, lang },
    tracking: { since: await trackingSince() },
    users: {
      total: n(ut.total), registered: n(ut.registered),
      new: { today: n(ut.today), week: n(ut.week), month: n(ut.month), period: n(ut.period) },
      dau: n(ac.dau), wau: n(ac.wau), mau: n(ac.mau), activePeriod: n(ac.period), stickiness: pct(n(ac.dau), n(ac.mau)),
      inactive: { d7: n(ina.d7), d14: n(ina.d14), d30: n(ina.d30) },
      retention: { d1: ret(rt.b1, rt.r1), d7: ret(rt.b7, rt.r7), d30: ret(rt.b30, rt.r30) },
      cohorts: cohorts.map((r) => ({ date: String(r.b), size: n(r.size), d1: n(r.b1) ? pct(n(r.r1), n(r.b1)) : null, d7: n(r.b7) ? pct(n(r.r7), n(r.b7)) : null, d30: n(r.b30) ? pct(n(r.r30), n(r.b30)) : null })),
      languages: langs.map((r) => ({ key: String(r.k), count: n(r.c) })),
    },
    orders: {
      period: { count: n(ot.c), sum: n(ot.s), canceled: n(ot.canceled), cancelRate: pct(n(ot.canceled), n(ot.c)), aov: n(ot.c_ok) ? Math.round(n(ot.s_ok) / n(ot.c_ok)) : 0, buyers: n(ot.buyers) },
      quick: { today: { count: n(oq.c_today), sum: n(oq.s_today) }, week: { count: n(oq.c_week), sum: n(oq.s_week) }, month: { count: n(oq.c_month), sum: n(oq.s_month) }, all: n(oq.c_all) },
      statuses, byType: byType.map((r) => ({ key: String(r.k), count: n(r.c), sum: n(r.s) })), byStore: byStore.map((r) => ({ key: String(r.k), count: n(r.c), sum: n(r.s) })),
      topSold,
    },
    series,
    funnel,
    conversion: {
      overall: pct(n(orderUsers[0]?.c), evUsers("app_open")),
      new: { ...conv.new, pct: pct(conv.new.ordered, conv.new.opened) }, returning: { ...conv.returning, pct: pct(conv.returning.ordered, conv.returning.opened) },
    },
    features,
    search: {
      total: n(ss.c), users: searchers, zero: n(ss.zero),
      top: searchTop.filter((r) => n(r.best) > 0).slice(0, 15).map((r) => ({ q: String(r.k), count: n(r.c) })),
      zeroResult: searchTop.filter((r) => n(r.best) === 0).slice(0, 15).map((r) => ({ q: String(r.k), count: n(r.c) })),
      toView: { users: n(sn.view), pct: pct(n(sn.view), searchers) }, toCart: { users: n(sn.cart), pct: pct(n(sn.cart), searchers) }, toOrder: { users: n(sn.ordered), pct: pct(n(sn.ordered), searchers) },
    },
    platforms: platforms.map((r) => ({ key: String(r.k), users: n(r.u), opens: n(r.opens) })),
    topViewed: topViewed.map((r) => ({ id: n(r.id), name: String(r.name || ""), count: n(r.c), users: n(r.u) })),
    misc: { products: misc[0], waitlist: misc[1] },
  };
}

let trackingSinceCache: { at: number; value: string | null } | null = null;
/** Hodisalar qachondan yozila boshlagan (undan oldingi davr uchun analitika bo'sh bo'ladi) */
async function trackingSince(): Promise<string | null> {
  if (trackingSinceCache && Date.now() - trackingSinceCache.at < 600000 && trackingSinceCache.value) return trackingSinceCache.value;
  const first = await prisma.appEvent.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } });
  trackingSinceCache = { at: Date.now(), value: first ? first.createdAt.toISOString() : null };
  return trackingSinceCache.value;
}

/** Tez filtrlar (davr) — admin paneldagi tugmalar uchun */
export function presetRange(preset: string): { from: string; to: string } {
  const today = ymd(new Date());
  switch (preset) {
    case "yesterday": { const y = addDays(today, -1); return { from: y, to: y }; }
    case "7d": return { from: addDays(today, -6), to: today };
    case "30d": return { from: addDays(today, -29), to: today };
    case "90d": return { from: addDays(today, -89), to: today };
    case "month": return { from: today.slice(0, 8) + "01", to: today };
    case "prevMonth": { const end = addDays(today.slice(0, 8) + "01", -1); return { from: end.slice(0, 8) + "01", to: end }; }
    case "year": return { from: today.slice(0, 5) + "01-01", to: today };
    case "all": return { from: "2024-01-01", to: today };
    default: return { from: today, to: today };
  }
}
