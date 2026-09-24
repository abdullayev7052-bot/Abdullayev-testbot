import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { Product, User } from "@prisma/client";
import { prisma } from "../../db.ts";
import { appAuth, type AppRequest } from "../auth.ts";
import { getSettings, lt, normalizeLang, publicSettings } from "../../settings/store.ts";
import type { Lang } from "../../settings/schema.ts";
import { bito } from "../../bito/client.ts";
import { fetchBalances, fetchCustomer } from "../../bito/customers.ts";
import { createOrder, OrderValidationError, stageName, stageOf, type OrderItemSnapshot, type Stage } from "../../bito/orders.ts";
import { matchScore } from "../../utils/search.ts";
import { normalizePhone } from "../../utils/format.ts";
import { activity, errMsg, log } from "../../logger.ts";
import { sendToUser } from "../../bot/send.ts";
import { fill } from "../../settings/store.ts";
import { esc } from "../../utils/format.ts";
import { isMultiStore, listStores, priceFor, userStore, getStore } from "../../bito/stores.ts";
import { EVENT_NAMES, isEventName, normPlatform, track } from "../../analytics/track.ts";
import { inCartCounts, weeklySales } from "../../bito/sales.ts";

export const appRouter = Router();
appRouter.use(appAuth);

const u = (req: Request) => (req as AppRequest).user;
/** Mini App yuborgan Telegram platformasi (X-Platform sarlavhasi) */
const plat = (req: Request) => normPlatform(req.header("x-platform"));

type PUser = Pick<User, "storeId" | "bitoCustomerId">;
interface Marks { waitIds?: Set<number>; favIds?: Set<number>; variants?: Map<number, Product[]> }
function serializeProduct(p: Product, user: PUser, marks?: Marks) {
  const pr = priceFor(p, user);
  const kids = marks?.variants?.get(p.id) || [];
  const variants = kids.map((k) => {
    const kp = priceFor(k, user);
    const imgs = ((k.images as string[]) || []).map((x) => bito.fileUrl(x));
    return {
      id: k.id, bitoId: k.bitoId, label: k.variantLabel || k.name, name: k.name,
      attrs: (k.variantAttrs as { name: string; value: string }[]) || [],
      price: kp.price, basePrice: kp.basePrice, discountPercent: kp.discountPercent, stock: kp.stock,
      image: bito.fileUrl(k.image), images: imgs, boxItem: k.boxItem, sku: k.sku,
    };
  });
  return {
    id: p.id, bitoId: p.bitoId, name: p.name, image: bito.fileUrl(p.image), images: ((p.images as string[]) || []).map((x) => bito.fileUrl(x)),
    price: pr.price, basePrice: pr.basePrice, discountPercent: pr.discountPercent, stock: pr.stock, boxItem: p.boxItem, measure: p.measure, measureDecimals: p.measureDecimals, sku: p.sku,
    categoryId: p.categoryBitoId, categoryName: p.categoryName, note: p.note, customFields: p.customFields, featured: p.featured,
    inWaitlist: marks?.waitIds ? marks.waitIds.has(p.id) : false,
    favorite: marks?.favIds ? marks.favIds.has(p.id) : false,
    isParent: p.isParent && variants.length > 0,
    variants,
    createdAt: p.syncedAt,
  };
}
/** Foydalanuvchi do'koniga tegishli va narxi > 0 (sozlamaga ko'ra) mahsulotlar */
function forUser(list: Product[], user: PUser): Product[] {
  const s = getSettings().catalog;
  const storeId = userStore(user).id;
  const variantsOn = s.variantsEnabled !== false;
  return list.filter((p) => {
    // Variantlar yoqilgan bo'lsa — ro'yxatda faqat ota kartochka ko'rinadi
    if (variantsOn && p.parentBitoId) return false;
    if (!variantsOn && p.isParent) return false;
    const st = (p.stores as Record<string, unknown>) || {};
    if (Object.keys(st).length && !st[storeId]) return false;
    if (s.hideZeroPrice && priceFor(p, user).price <= 0) return false;
    return true;
  });
}

let productCache: { at: number; list: Product[] } | null = null;
async function visibleProducts(): Promise<Product[]> {
  if (productCache && Date.now() - productCache.at < 20000) return productCache.list;
  const s = getSettings().catalog;
  void s;
  const list = await prisma.product.findMany({ where: { isDeleted: false, hidden: false } });
  productCache = { at: Date.now(), list };
  return list;
}
export function invalidateProductCache() { productCache = null; }

function sortProducts(list: Product[], user: PUser): Product[] {
  const s = getSettings().catalog;
  const cmp: Record<string, (a: Product, b: Product) => number> = {
    manual: (a, b) => a.sortOrder - b.sortOrder || a.id - b.id,
    name_asc: (a, b) => a.name.localeCompare(b.name, "uz"),
    name_desc: (a, b) => b.name.localeCompare(a.name, "uz"),
    price_asc: (a, b) => a.price - b.price,
    price_desc: (a, b) => b.price - a.price,
    newest: (a, b) => createdTs(b) - createdTs(a),
  };
  const base = cmp[s.sortMode] || cmp.manual;
  const out = [...list].sort(base);
  if (s.outOfStockLast) out.sort((a, b) => Number(priceFor(b, user).stock > 0) - Number(priceFor(a, user).stock > 0));
  return out;
}

async function userWaitIds(userId: number): Promise<Set<number>> {
  const rows = await prisma.waitlist.findMany({ where: { userId, notifiedAt: null }, select: { productId: true } });
  return new Set(rows.map((r) => r.productId));
}
async function userFavIds(userId: number): Promise<Set<number>> {
  if (!getSettings().catalog.favoritesEnabled) return new Set();
  const rows = await prisma.favorite.findMany({ where: { userId }, select: { productId: true } });
  return new Set(rows.map((r) => r.productId));
}

/** Ota kartochkalar uchun variantlar: parent.id → variant mahsulotlar (do'kon/narx bo'yicha filtrlangan) */
async function variantsFor(parents: Product[], user: PUser): Promise<Map<number, Product[]>> {
  const out = new Map<number, Product[]>();
  const s = getSettings().catalog;
  if (s.variantsEnabled === false) return out;
  const ids = parents.filter((p) => p.isParent).map((p) => p.bitoId);
  if (!ids.length) return out;
  const all = await visibleProducts();
  const storeId = userStore(user).id;
  const byParent = new Map<string, Product[]>();
  for (const k of all) {
    if (!k.parentBitoId || !ids.includes(k.parentBitoId)) continue;
    const st = (k.stores as Record<string, unknown>) || {};
    if (Object.keys(st).length && !st[storeId]) continue;
    const arr = byParent.get(k.parentBitoId) || [];
    arr.push(k);
    byParent.set(k.parentBitoId, arr);
  }
  for (const p of parents) {
    const kids = byParent.get(p.bitoId);
    if (kids?.length) out.set(p.id, kids.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "uz")));
  }
  return out;
}

/** Mahsulot foydalanuvchi do'koniga tegishlimi (variant bolalari uchun ham ishlaydi) */
function inUserStore(p: Product, user: PUser): boolean {
  const st = (p.stores as Record<string, unknown>) || {};
  return !Object.keys(st).length || !!st[userStore(user).id];
}

/** Ro'yxat uchun belgilar (istaklar, kutilayotganlar, variantlar) */
async function marksFor(list: Product[], user: User): Promise<Marks> {
  const [waitIds, favIds, variants] = await Promise.all([userWaitIds(user.id), userFavIds(user.id), variantsFor(list, user)]);
  return { waitIds, favIds, variants };
}

// ---------- Boshlang'ich ma'lumot ----------
appRouter.get("/bootstrap", async (req, res) => {
  const user = u(req);
  const s = getSettings();
  const [stories, banners, categories, products] = await Promise.all([
    prisma.story.findMany({ where: { active: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, orderBy: { sortOrder: "asc" }, include: { slides: { orderBy: { sortOrder: "asc" } } } }),
    prisma.banner.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.category.findMany({ where: { isDeleted: false, hidden: false }, orderBy: { sortOrder: "asc" } }),
    visibleProducts().then((l) => forUser(l, user)),
  ]);
  const counts = new Map<string, number>();
  for (const p of products) if (p.categoryBitoId) counts.set(p.categoryBitoId, (counts.get(p.categoryBitoId) || 0) + 1);
  // ota kategoriya hisobiga bolalarini qo'shamiz
  const byId = new Map(categories.map((c) => [c.bitoId, c]));
  const totalCount = (id: string): number => {
    let n = counts.get(id) || 0;
    for (const c of categories) if (c.parentId === id) n += totalCount(c.bitoId);
    return n;
  };
  const cats = categories
    .map((c) => ({ id: c.bitoId, name: c.name, parentId: c.parentId && byId.has(c.parentId) ? c.parentId : null, image: bito.fileUrl(c.image), count: totalCount(c.bitoId) }))
    .filter((c) => c.count > 0);
  const featuredList = sortProducts(products.filter((p) => p.featured), user).slice(0, 20);
  const newestList = [...products].sort((a, b) => createdTs(b) - createdTs(a)).slice(0, 10);
  const marks = await marksFor([...featuredList, ...newestList], user);
  const featured = featuredList.map((p) => serializeProduct(p, user, marks));
  const newest = newestList.map((p) => serializeProduct(p, user, marks));
  const lang = normalizeLang(user.language);
  const store = userStore(user);
  const stores = isMultiStore() ? listStores().map((st) => ({ id: st.id, name: st.name(lang), pickupAddress: st.pickupAddress(lang), pickupLocation: st.pickupLocation })) : [];
  res.json({
    user: {
      id: user.id, telegramId: String(user.telegramId), name: user.name || user.tgFirstName || "", phone: user.phone, language: normalizeLang(user.language),
      address: user.address, lat: user.lat, lng: user.lng, registered: user.step === "done", linked: !!user.bitoCustomerId,
      storeId: store.id,
    },
    stores,
    store: { id: store.id, name: store.name(lang), pickupAddress: store.pickupAddress(lang), pickupLocation: store.pickupLocation },
    settings: publicSettings(),
    stories: stories.map((st) => ({ id: st.id, title: st.title, cover: st.cover, slides: st.slides.map((sl) => ({ id: sl.id, image: sl.image, caption: sl.caption, link: sl.link, duration: sl.duration || s.design.storiesDefaultDuration || 5, buttonText: sl.buttonText || null })) })).filter((st) => st.slides.length),
    banners: banners.map((b) => ({ id: b.id, image: b.image, title: b.title, subtitle: b.subtitle, link: b.link, textColor: b.textColor })),
    categories: cats,
    featured, newest, productCount: products.length,
  });
});

// ---------- Mahsulotlar ----------
appRouter.get("/products", async (req, res) => {
  const user = u(req);
  const s = getSettings().catalog;
  const q = String(req.query.q || "").trim();
  const category = String(req.query.category || "");
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 40)));
  let list = forUser(await visibleProducts(), user);
  if (!s.showOutOfStock) list = list.filter((p) => priceFor(p, user).stock > 0);
  if (category) {
    const cats = await prisma.category.findMany({ where: { isDeleted: false }, select: { bitoId: true, parentId: true } });
    const ids = new Set<string>([category]);
    let grew = true;
    while (grew) { grew = false; for (const c of cats) if (c.parentId && ids.has(c.parentId) && !ids.has(c.bitoId)) { ids.add(c.bitoId); grew = true; } }
    list = list.filter((p) => p.categoryBitoId && ids.has(p.categoryBitoId));
  }
  if (q && q.length >= Math.max(1, s.searchMinChars)) {
    const scored = list.map((p) => ({ p, sc: matchScore(q, p.searchKey, s.searchFuzzy) })).filter((x) => x.sc > 0);
    scored.sort((a, b) => b.sc - a.sc || a.p.sortOrder - b.p.sortOrder);
    list = scored.map((x) => x.p);
  } else {
    list = sortProducts(list, user);
  }
  const total = list.length;
  const slice = list.slice((page - 1) * limit, page * limit);
  const marks = await marksFor(slice, user);
  if (page === 1 && q) track(user.id, "search", { q: q.slice(0, 80), results: total }, plat(req));
  else if (page === 1 && category && !q) track(user.id, "category_view", { categoryId: category }, plat(req));
  res.json({ total, page, limit, hasMore: page * limit < total, items: slice.map((p) => serializeProduct(p, user, marks)) });
});

appRouter.get("/products/:id", async (req, res) => {
  const user = u(req);
  const p = await prisma.product.findUnique({ where: { id: Number(req.params.id) } });
  if (!p || p.isDeleted || p.hidden) { res.status(404).json({ error: "not found" }); return; }
  const marks = await marksFor([p], user);
  res.json({ ...serializeProduct(p, user, marks), stats: await productStats(p, marks.variants?.get(p.id) || []) });
});

/** Mahsulot kartochkasidagi qo'shimcha ko'rsatkichlar: haftalik sotuv va savatchadagilar soni */
async function productStats(p: Product, kids: Product[]): Promise<{ soldWeek: number | null; inCart: number | null }> {
  const c = getSettings().catalog;
  const ids = [p.id, ...kids.map((k) => k.id)];
  const [sales, carts] = await Promise.all([
    c.weeklySalesEnabled ? weeklySales() : Promise.resolve(new Map<string, number>()),
    inCartCounts(ids),
  ]);
  let sold = 0;
  for (const bid of [p.bitoId, ...kids.map((k) => k.bitoId)]) sold += sales.get(bid) || 0;
  let inCart = 0;
  for (const id of ids) inCart += carts.get(id) || 0;
  const minSold = Math.max(1, Number(c.weeklySalesMin || 1));
  const minCart = Math.max(1, Number(c.inCartCountMin || 1));
  return {
    soldWeek: c.weeklySalesEnabled && sold >= minSold ? Math.round(sold * 100) / 100 : null,
    inCart: c.inCartCountEnabled && inCart >= minCart ? inCart : null,
  };
}


/** Savatchadagi mahsulotlarning joriy narx/qoldig'ini tekshirish */
appRouter.post("/products/refresh", async (req, res) => {
  const user = u(req);
  const ids = z.array(z.number()).max(200).parse((req.body as { ids?: number[] })?.ids || []);
  const list = await prisma.product.findMany({ where: { id: { in: ids } } });
  res.json(list.map((p) => { const pr = priceFor(p, user); return { id: p.id, price: pr.price, basePrice: pr.basePrice, discountPercent: pr.discountPercent, stock: pr.stock, name: p.name, image: bito.fileUrl(p.image), boxItem: p.boxItem, measure: p.measure, available: !p.isDeleted && !p.hidden && inUserStore(p, user) }; }));
});

// ---------- Kelganda eslating ----------
appRouter.post("/waitlist", async (req, res) => {
  const user = u(req);
  const s = getSettings();
  if (!s.catalog.notifyEnabled) { res.status(400).json({ error: "disabled" }); return; }
  const productId = z.number().parse((req.body as { productId?: number })?.productId);
  const p = await prisma.product.findUnique({ where: { id: productId } });
  if (!p) { res.status(404).json({ error: "not found" }); return; }
  await prisma.waitlist.upsert({ where: { userId_productId: { userId: user.id, productId } }, create: { userId: user.id, productId }, update: { notifiedAt: null } });
  await activity("waitlist_added", `"${p.name}" kutilmoqda → ${user.name || user.phone || user.telegramId}`);
  track(user.id, "waitlist_add", { productId: p.id, name: p.name }, plat(req));
  if (s.bot.waitlistNotifyBot && user.step === "done") {
    const lang = normalizeLang(user.language);
    sendToUser(user.telegramId, esc(fill(lt(s.bot.waitlistAdded, lang), { product: p.name })), { disable_notification: true }).catch(() => {});
  }
  res.json({ ok: true });
});
appRouter.delete("/waitlist/:productId", async (req, res) => {
  const user = u(req);
  await prisma.waitlist.deleteMany({ where: { userId: user.id, productId: Number(req.params.productId) } });
  res.json({ ok: true });
});

// ---------- Profil ----------
const profileSchema = z.object({
  name: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(300).optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  language: z.enum(["uz", "ru", "en"]).optional(),
  storeId: z.string().max(40).optional(),
});
appRouter.put("/profile", async (req, res) => {
  const user = u(req);
  const body = profileSchema.parse(req.body || {});
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name || null;
  if (body.phone !== undefined && body.phone) data.phone = normalizePhone(body.phone);
  if (body.address !== undefined) data.address = body.address || null;
  if (body.lat !== undefined) data.lat = body.lat;
  if (body.lng !== undefined) data.lng = body.lng;
  if (body.language) data.language = normalizeLang(body.language);
  if (body.storeId !== undefined) data.storeId = getStore(body.storeId).id;
  const updated = await prisma.user.update({ where: { id: user.id }, data });
  res.json({ ok: true, user: { name: updated.name, phone: updated.phone, address: updated.address, lat: updated.lat, lng: updated.lng, language: updated.language, storeId: updated.storeId } });
});

appRouter.get("/balance", async (req, res) => {
  const user = u(req);
  const rows = await fetchBalances(user);
  res.json({ linked: !!user.bitoCustomerId, balances: rows });
});

appRouter.get("/card", async (req, res) => {
  const user = u(req);
  const c = await fetchCustomer(user);
  const card = c?.loyalty_card_id?.trim() || null;
  let png: string | null = null;
  if (card) {
    try {
      const bwip = await import("bwip-js/node");
      const buf = await bwip.toBuffer({ bcid: "code128", text: card, scale: 3, height: 16, includetext: true, textxalign: "center", paddingwidth: 10, paddingheight: 8, backgroundcolor: "FFFFFF" });
      png = "data:image/png;base64," + buf.toString("base64");
    } catch (e) { log.warn("card png", errMsg(e)); }
  }
  res.json({ card, png, name: c?.name || user.name });
});

appRouter.get("/purchases", async (req, res) => {
  const user = u(req);
  if (!user.bitoCustomerId) { res.json({ items: [] }); return; }
  try {
    const orgId = userStore(user).organizationId;
    const r = await bito.tradesPage({ page: 1, limit: 50, customer_id: user.bitoCustomerId, ...(isMultiStore() && orgId ? { organization_id: orgId } : {}) });
    res.json({
      items: (r.data || []).filter((t) => t.state !== "canceled").map((t) => ({
        id: t._id, number: t.number || t.uuid, date: t.sold_at || t.date || t.created_at, total: t.total_to_pay ?? t.total_price ?? 0,
        debt: t.debt || 0, seller: t.responsible?.full_name || t.created_by?.full_name || "", isRefund: !!t.is_refund, itemsCount: t.total_amount || 0,
      })),
    });
  } catch (e) {
    log.warn("purchases", errMsg(e));
    res.json({ items: [], error: errMsg(e) });
  }
});

appRouter.get("/purchases/:id", async (req, res) => {
  const user = u(req);
  try {
    const t = await bito.tradeForBot(String(req.params.id));
    if (!t || (t.customer?._id || t.customer_id) !== user.bitoCustomerId) { res.status(404).json({ error: "not found" }); return; }
    res.json({
      id: t._id, number: t.number, date: t.sold_at || t.date, total: t.total_to_pay ?? t.total_price, debt: t.debt || 0,
      seller: t.responsible?.full_name || "", payments: (t.payments || []).map((p) => ({ method: p.payment_method?.name, amount: p.amount || p.paid })),
      items: (t.products || []).map((p) => ({ bitoId: p.product_id, name: p.name, qty: p.amount, price: p.price, total: p.total_to_pay ?? p.total_price, measure: p.measure?.short_name })),
    });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// ---------- Buyurtmalar ----------
appRouter.get("/orders", async (req, res) => {
  const user = u(req);
  const lang = normalizeLang(user.language);
  const storeOrg = userStore(user).organizationId;
  const local = await prisma.order.findMany({ where: { userId: user.id, ...(isMultiStore() ? { storeId: userStore(user).id } : {}) }, orderBy: { createdAt: "desc" }, take: 50 });
  const seen = new Set(local.map((o) => o.bitoId).filter(Boolean) as string[]);
  const localIds = await prisma.product.findMany({ where: { isDeleted: false }, select: { id: true, bitoId: true } });
  const idMap = new Map(localIds.map((p) => [p.bitoId, p.id]));
  const items = local.map((o) => ({
    id: o.id, number: o.number || String(o.id), date: o.createdAt, total: o.total, type: o.type, stage: o.stateKey, status: stageName((o.stateKey || "new") as Stage, lang, o.stateName),
    items: ((o.items as unknown as OrderItemSnapshot[]) || []).map((it) => ({ ...it, productId: idMap.get(it.bitoId) ?? it.productId, image: bito.fileUrl(it.image) })),
    address: o.address, comment: o.comment, phone: o.phone, source: "bot" as const,
  }));
  if (user.bitoCustomerId) {
    try {
      const r = await bito.ordersByCustomer(user.bitoCustomerId, 1, 30);
      for (const o of r.list || []) {
        if (seen.has(o._id)) continue;
        if (isMultiStore() && storeOrg && o.organization_id && o.organization_id !== storeOrg) continue;
        const stage = stageOf(o.state_id, o.dynamic_state || { default_key: o.state });
        items.push({
          id: 0, number: o.number || o.uuid || "", date: (o.date || o.created_at || new Date().toISOString()) as unknown as Date, total: o.total_to_pay ?? o.total_price ?? 0, type: "delivery",
          stage, status: stageName(stage, lang, o.dynamic_state?.name || o.state),
          items: (o.products || []).map((p) => ({ productId: idMap.get(p.product_id) ?? 0, bitoId: p.product_id, name: p.name || "", price: p.price, qty: p.amount, measure: p.measure?.short_name || null, image: bito.fileUrl(p.image) })),
          address: null, comment: null, phone: null, source: "bito" as const,
        } as never);
      }
      items.sort((a, b) => new Date(b.date as never).getTime() - new Date(a.date as never).getTime());
    } catch (e) { log.warn("ordersByCustomer", errMsg(e)); }
  }
  res.json({ items });
});

/** Mahsulot Bito tizimiga qo'shilgan vaqti ("Yangi kelganlar" uchun) */
const createdTs = (p: { bitoCreatedAt: Date | null; syncedAt: Date }) => (p.bitoCreatedAt || p.syncedAt).getTime();
const orderSchema = z.object({
  items: z.array(z.object({ productId: z.number().int(), qty: z.number().positive(), boxCount: z.number().min(0).optional() })).min(1).max(100),
  type: z.enum(["delivery", "pickup"]),
  phone: z.string().trim().min(5).max(30),
  name: z.string().trim().max(80).optional(),
  address: z.string().trim().max(300).optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  comment: z.string().trim().max(500).optional(),
});
appRouter.post("/orders", async (req, res) => {
  const user = u(req);
  const lang = normalizeLang(user.language);
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Ma'lumotlar noto'g'ri", code: "validation" }); return; }
  try {
    const order = await createOrder(user, parsed.data, lang);
    invalidateProductCache();
    // Buyurtma berilgan mahsulotlar endi "savatda turganlar" qatorida emas
    prisma.cartItem.deleteMany({ where: { userId: user.id, productId: { in: parsed.data.items.map((i) => i.productId) } } }).catch(() => {});
    track(user.id, "order_created", { orderId: order.id, total: order.total, type: order.type, storeId: order.storeId, items: order.itemsCount }, plat(req));
    res.json({ ok: true, order: { id: order.id, number: order.number || String(order.id), total: order.total } });
  } catch (e) {
    if (e instanceof OrderValidationError) { res.status(400).json({ error: e.message, code: e.code }); return; }
    log.error("createOrder", e);
    res.status(500).json({ error: errMsg(e), code: "server" });
  }
});

// ---------- Istaklarim (Favourites) ----------
appRouter.get("/favorites", async (req, res) => {
  const user = u(req);
  if (!getSettings().catalog.favoritesEnabled) { res.json({ enabled: false, items: [] }); return; }
  const rows = await prisma.favorite.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { product: true } });
  const list = rows.map((r) => r.product).filter((p) => !p.isDeleted && !p.hidden);
  const marks = await marksFor(list, user);
  res.json({ enabled: true, items: list.map((p) => serializeProduct(p, user, { ...marks, favIds: new Set(list.map((x) => x.id)) })) });
});
appRouter.post("/favorites", async (req, res) => {
  const user = u(req);
  if (!getSettings().catalog.favoritesEnabled) { res.status(400).json({ error: "disabled" }); return; }
  const productId = z.number().parse((req.body as { productId?: number })?.productId);
  const p = await prisma.product.findUnique({ where: { id: productId } });
  if (!p) { res.status(404).json({ error: "not found" }); return; }
  await prisma.favorite.upsert({ where: { userId_productId: { userId: user.id, productId } }, create: { userId: user.id, productId }, update: {} });
  track(user.id, "favorite_add", { productId, name: p.name }, plat(req));
  res.json({ ok: true });
});
appRouter.delete("/favorites/:productId", async (req, res) => {
  const user = u(req);
  await prisma.favorite.deleteMany({ where: { userId: user.id, productId: Number(req.params.productId) } });
  res.json({ ok: true });
});

// ---------- Savatcha nusxasi ("X ta insonning savatida" uchun) ----------
const cartSchema = z.object({ items: z.array(z.object({ productId: z.number(), qty: z.number().min(0) })).max(200) });
appRouter.put("/cart", async (req, res) => {
  const user = u(req);
  const parsed = cartSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "bad cart" }); return; }
  const items = parsed.data.items.filter((x) => x.qty > 0);
  const ids = items.map((x) => x.productId);
  await prisma.$transaction([
    prisma.cartItem.deleteMany({ where: { userId: user.id, ...(ids.length ? { productId: { notIn: ids } } : {}) } }),
    ...items.map((it) => prisma.cartItem.upsert({
      where: { userId_productId: { userId: user.id, productId: it.productId } },
      create: { userId: user.id, productId: it.productId, qty: it.qty },
      update: { qty: it.qty },
    })),
  ]);
  res.json({ ok: true });
});

// ---------- Analitika hodisalari (Mini App'dan) ----------
const eventsSchema = z.object({
  platform: z.string().max(20).optional(),
  events: z.array(z.object({ name: z.string().max(40), meta: z.record(z.string(), z.unknown()).optional(), at: z.number().optional() })).max(50),
});
appRouter.post("/events", async (req, res) => {
  const user = u(req);
  const parsed = eventsSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "bad events" }); return; }
  const platform = normPlatform(parsed.data.platform) || plat(req);
  const now = Date.now();
  for (const e of parsed.data.events) {
    // faqat ruxsat etilgan nomlar; server tomonida yoziladiganlar (order_created, search...) mijozdan qabul qilinmaydi
    if (!isEventName(e.name) || ["order_created", "search", "category_view", "waitlist_add", "favorite_add", "bot_start", "bot_active"].includes(e.name)) continue;
    const at = e.at && Math.abs(now - e.at) < 6 * 3600 * 1000 ? new Date(e.at) : undefined;
    track(user.id, e.name, e.meta || null, platform, at);
  }
  res.json({ ok: true, accepted: EVENT_NAMES.length });
});

// ---------- Geokodlash (manzilni xaritadan aniqlash) ----------
appRouter.get("/geocode", async (req, res) => {
  const lat = Number(req.query.lat), lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) { res.status(400).json({ error: "bad" }); return; }
  const lang = String(req.query.lang || "uz");
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=${lang === "en" ? "en" : lang === "ru" ? "ru" : "uz"}&zoom=18`, {
      headers: { "User-Agent": "bito-telegram-shop/1.0 (localhost)" },
    });
    const j = (await r.json()) as { display_name?: string; address?: Record<string, string> };
    const a = j.address || {};
    const street = [a.road || a.pedestrian || a.residential, a.house_number].filter(Boolean).join(" ");
    const district = a.city_district || a.suburb || a.borough || a.district || a.neighbourhood;
    const city = a.city || a.town || a.village || a.county;
    const short = [district, street || a.neighbourhood, city && city !== district ? city : ""].filter(Boolean).join(", ");
    res.json({ address: short || j.display_name || "" });
  } catch {
    res.json({ address: "" });
  }
});

appRouter.use((err: unknown, _req: Request, res: Response, _next: unknown) => {
  if (err instanceof z.ZodError) { res.status(400).json({ error: "Ma'lumotlar noto'g'ri" }); return; }
  log.error("app api", err);
  res.status(500).json({ error: errMsg(err) });
});

export type { Lang };
