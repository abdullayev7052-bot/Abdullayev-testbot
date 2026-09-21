import { Router, type Request, type Response } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "../../db.ts";
import { env } from "../../env.ts";
import { adminAuth, adminLogin, adminLogout, setAdminPassword } from "../auth.ts";
import { settingsSchema } from "../../settings/schema.ts";
import { getSettings, loadSettings, updateSection } from "../../settings/store.ts";
import { bito, testConnection } from "../../bito/client.ts";
import { autoMapStates, ensureContext, getSyncStatus, syncCatalog } from "../../bito/sync.ts";
import { ensureWebhookSubscription, getWebhookState } from "../../bito/webhook.ts";
import { getPublicUrl, setPublicUrlManually } from "../../utils/publicUrl.ts";
import { activity, errMsg, log } from "../../logger.ts";
import { bot } from "../../bot/instance.ts";
import { updateMenuButton, restartBot } from "../../bot/index.ts";
import { sendToUser } from "../../bot/send.ts";
import { invalidateProductCache } from "./app.ts";
import { priceFor, storeIsUzs } from "../../bito/stores.ts";
import { InputFile, InlineKeyboard } from "grammy";
import { buildReport, presetRange, ymd, type Group } from "../../analytics/report.ts";
import { listStores } from "../../bito/stores.ts";

export const adminRouter = Router();

adminRouter.get("/branding", (_req, res) => { res.json(getSettings().adminPanel); });
adminRouter.post("/login", adminLogin);
adminRouter.post("/logout", adminLogout);
adminRouter.use(adminAuth);
adminRouter.get("/me", (_req, res) => { res.json({ ok: true }); });

// ---------- Sozlamalar ----------
adminRouter.get("/schema", (_req, res) => { res.json(settingsSchema); });
adminRouter.get("/settings", (_req, res) => {
  const s = getSettings() as unknown as Record<string, Record<string, unknown>>;
  const out = { ...s, general: { ...s.general, adminPassword: "", botToken: s.general.botToken ? "••••••••" + String(s.general.botToken).slice(-6) : "" } };
  res.json(out);
});
adminRouter.put("/settings/:section", async (req, res) => {
  const section = String(req.params.section);
  const patch = (req.body || {}) as Record<string, unknown>;
  const before = getSettings();
  if (section === "general" && typeof patch.botToken === "string" && patch.botToken.startsWith("••••")) delete patch.botToken;
  if (section === "general" && typeof patch.adminPassword === "string" && patch.adminPassword.trim()) {
    await setAdminPassword(patch.adminPassword.trim());
    await activity("admin", "Admin paroli o'zgartirildi");
  }
  if (section === "general") patch.adminPassword = "";
  if (section === "general" && typeof patch.botToken === "string" && patch.botToken.trim() !== (before.general.botToken || "").trim()) {
    try { const me = await restartBot(patch.botToken); await activity("admin", `Bot almashtirildi: @${me.username}`); }
    catch (e) { res.status(400).json({ error: "Bot tokeni noto'g'ri: " + errMsg(e) }); return; }
  }
  try {
    await updateSection(section, patch);
  } catch (e) { res.status(400).json({ error: errMsg(e) }); return; }
  const after = getSettings();
  // Bito ulanishi o'zgarganda — kontekst, holatlar, webhook, sinxronizatsiya
  if (section === "bito") {
    const keyChanged = before.bito.apiKey !== after.bito.apiKey || before.bito.apiUrl !== after.bito.apiUrl;
    const orgChanged = before.bito.organizationId !== after.bito.organizationId;
    if (keyChanged) {
      await updateSection("bito", { organizationId: "", warehouseId: "", priceId: "", currencyId: "", responsibleId: "" }).catch(() => {});
      await updateSection("statuses", { newStateId: "", acceptedStateId: "", readyStateId: "", deliveringStateId: "", doneStateId: "", canceledStateId: "" }).catch(() => {});
      optionsCache = null;
    }
    if (keyChanged || orgChanged) {
      try { await ensureContext(); await autoMapStates(); } catch (e) { log.warn("ensureContext", errMsg(e)); }
      optionsCache = null;
    }
    invalidateProductCache();
    void syncCatalog("settings");
    const pub = getPublicUrl();
    if (pub) void ensureWebhookSubscription(pub, keyChanged);
  }
  if (section === "bot" || section === "general") void updateMenuButton();
  invalidateProductCache();
  res.json({ ok: true, settings: { ...(getSettings() as unknown as Record<string, unknown>), general: { ...getSettings().general, adminPassword: "", botToken: getSettings().general.botToken ? "••••••••" + String(getSettings().general.botToken).slice(-6) : "" } } });
});

// ---------- Bito ----------
let optionsCache: { at: number; data: unknown } | null = null;
adminRouter.get("/bito/options", async (req, res) => {
  const force = req.query.force === "1";
  if (!force && optionsCache && Date.now() - optionsCache.at < 60000) { res.json(optionsCache.data); return; }
  const s = getSettings().bito;
  if (!s.apiKey) { res.json({ ok: false, error: "API kalit kiritilmagan" }); return; }
  try {
    const [orgs, whs, prices, currencies, employees, me] = await Promise.all([
      bito.organizations(), bito.warehouses(), bito.prices(), bito.currencies(), bito.employees(), bito.profile().catch(() => null),
    ]);
    const orgId = s.organizationId || orgs.find((o) => o.is_default)?._id || orgs[0]?._id;
    const states = orgId ? (await bito.states("saleOrders", orgId)).filter((st) => st.organization_id === orgId) : [];
    const emp = [...employees.map((e) => ({ value: e._id, label: e.full_name + (e.phone_number ? ` (${e.phone_number})` : "") }))];
    if (me && !emp.some((e) => e.value === me._id)) emp.unshift({ value: me._id, label: `${me.full_name} (akkaunt egasi)` });
    const data = {
      ok: true,
      "bito:organizations": orgs.map((o) => ({ value: o._id, label: o.name + (o.is_default ? " (asosiy)" : "") })),
      "bito:warehouses": whs.map((w) => ({ value: w._id, label: w.name + (orgs.find((o) => o._id === w.organization_id) ? ` — ${orgs.find((o) => o._id === w.organization_id)!.name}` : "") })),
      "bito:prices": prices.filter((p) => p.status !== "archived").map((p) => ({ value: p._id, label: `${p.name}${p.type === "income" ? " (tan narx)" : ""}` })),
      "bito:currencies": currencies.map((c) => ({ value: c._id, label: `${c.name} (${c.symbol || c.code || ""})` })),
      "bito:employees": emp,
      "bito:states": states.map((st) => ({ value: st._id, label: st.name + (st.default_key ? ` [${st.default_key}]` : "") })),
    };
    optionsCache = { at: Date.now(), data };
    res.json(data);
  } catch (e) {
    res.json({ ok: false, error: errMsg(e) });
  }
});
adminRouter.get("/bito/customers", async (req, res) => {
  const q = String(req.query.q || "").trim();
  try {
    const r = await bito.call<{ data: { _id: string; name: string; phone_number?: string }[] }>("POST", "customer/get-paging", { page: 1, limit: 30, ...(q ? { search: q } : {}) });
    res.json((r.data || []).map((c) => ({ id: c._id, name: c.name, phone: c.phone_number || "" })));
  } catch (e) { res.json([]); void e; }
});
adminRouter.get("/bito/customers/by-ids", async (req, res) => {
  const ids = String(req.query.ids || "").split(",").filter(Boolean).slice(0, 200);
  const out: { id: string; name: string; phone: string }[] = [];
  for (const id of ids) { try { const c = await bito.customerById(id); out.push({ id: c._id, name: c.name, phone: c.phone_number || "" }); } catch { out.push({ id, name: "?", phone: "" }); } }
  res.json(out);
});
adminRouter.post("/bito/test", async (req, res) => {
  const body = (req.body || {}) as { apiKey?: string; apiUrl?: string };
  res.json(await testConnection(body.apiKey ? { apiKey: body.apiKey, apiUrl: body.apiUrl } : undefined));
});
adminRouter.post("/bito/sync", async (_req, res) => {
  invalidateProductCache();
  const r = await syncCatalog("admin");
  res.json(r);
});
adminRouter.post("/bito/automap", async (_req, res) => {
  try { await ensureContext(); await autoMapStates(); optionsCache = null; res.json({ ok: true, statuses: getSettings().statuses, bito: getSettings().bito }); }
  catch (e) { res.status(400).json({ ok: false, error: errMsg(e) }); }
});
adminRouter.post("/bito/webhook", async (_req, res) => {
  const pub = getPublicUrl();
  if (!pub) { res.json({ ok: false, error: "Ommaviy manzil (ngrok) aniqlanmagan" }); return; }
  const st = await ensureWebhookSubscription(pub, true);
  res.json({ ok: !st?.error, state: st });
});
adminRouter.post("/public-url", async (req, res) => {
  const url = String((req.body as { url?: string })?.url || "").trim();
  if (url && !/^https:\/\//.test(url)) { res.status(400).json({ error: "Manzil https:// bilan boshlanishi kerak" }); return; }
  setPublicUrlManually(url);
  res.json({ ok: true, url: getPublicUrl() });
});

// ---------- Holat (dashboard) ----------
adminRouter.get("/status", async (_req, res) => {
  const [users, registered, products, orders, ordersToday, waitlist, groups, webhook, activityRows, me] = await Promise.all([
    prisma.user.count(), prisma.user.count({ where: { step: "done" } }), prisma.product.count({ where: { isDeleted: false } }),
    prisma.order.count(), prisma.order.count({ where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    prisma.waitlist.count({ where: { notifiedAt: null } }), prisma.adminGroup.findMany(), getWebhookState(),
    prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    bot.api.getMe().catch(() => null),
  ]);
  const s = getSettings();
  res.json({
    bot: me ? { username: me.username, name: me.first_name } : null,
    publicUrl: getPublicUrl(), port: env.PORT,
    appUrl: getPublicUrl() ? `${getPublicUrl()}/app/` : null,
    bito: { connected: !!s.bito.apiKey, apiKeyLogin: s.bito.apiKey.split(":")[0] || "", organizationId: s.bito.organizationId, priceId: s.bito.priceId, warehouseId: s.bito.warehouseId },
    sync: getSyncStatus(), webhook,
    counts: { users, registered, products, orders, ordersToday, waitlist, groups: groups.filter((g) => g.enabled).length },
    activity: activityRows,
  });
});
// ---------- Analitika (Dashboard) ----------
adminRouter.get("/analytics", async (req, res) => {
  const qs = req.query as Record<string, string | undefined>;
  const preset = qs.preset ? presetRange(qs.preset) : null;
  const isYmd = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const today = ymd(new Date());
  let from = preset?.from || (isYmd(qs.from) ? qs.from! : today);
  let to = preset?.to || (isYmd(qs.to) ? qs.to! : today);
  if (from > to) [from, to] = [to, from];
  const group = (["day", "week", "month"].includes(qs.group || "") ? qs.group : "day") as Group;
  try {
    const report = await buildReport({ from, to, group, storeId: qs.storeId || null, type: qs.type || null, platform: qs.platform || null, lang: qs.lang || null });
    res.json({ ...report, stores: listStores().map((s) => ({ id: s.id, name: s.name("uz") })) });
  } catch (e) { log.error("analytics", e); res.status(500).json({ error: errMsg(e) }); }
});
adminRouter.get("/activity", async (req, res) => {
  const take = Math.min(300, Number(req.query.limit || 100));
  res.json(await prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take }));
});

// ---------- Fayl yuklash ----------
fs.mkdirSync(env.UPLOADS_DIR, { recursive: true });
/** Media limitlari (server tomonida qat'iy, admin o'zgartira olmaydi) */
export const MEDIA_LIMITS = {
  imageBytes: 5 * 1024 * 1024,      // rasm: 5 MB
  gifBytes: 10 * 1024 * 1024,       // GIF: 10 MB
  videoBytes: 25 * 1024 * 1024,     // storis/banner video: 25 MB
  broadcastBytes: 50 * 1024 * 1024, // xabar tarqatish (Telegram chegarasi): 50 MB
  stories: 15, slidesPerStory: 10, banners: 12,
  totalBytes: 600 * 1024 * 1024,    // barcha yuklangan fayllar jami: 600 MB
};
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MEDIA_LIMITS.broadcastBytes },
  fileFilter: (_req, file, cb) => cb(null, /^image[/](png|jpe?g|webp|gif|svg[+]xml)$|^video[/](mp4|webm|quicktime)$/.test(file.mimetype)),
});
adminRouter.post("/upload", upload.single("file"), async (req, res) => {
  const f = (req as Request & { file?: Express.Multer.File }).file;
  if (!f) { res.status(400).json({ error: "Fayl tanlanmadi (rasm yoki video: mp4/webm/gif)" }); return; }
  const purpose = String(req.query.purpose || "media"); // media | broadcast
  const isGif = f.mimetype === "image/gif", isVid = f.mimetype.startsWith("video/");
  const max = purpose === "broadcast" ? MEDIA_LIMITS.broadcastBytes : isVid ? MEDIA_LIMITS.videoBytes : isGif ? MEDIA_LIMITS.gifBytes : MEDIA_LIMITS.imageBytes;
  if (f.size > max) { res.status(400).json({ error: `Fayl juda katta: ${(f.size / 1048576).toFixed(1)} MB. Limit: ${Math.round(max / 1048576)} MB (${isVid ? "video" : isGif ? "GIF" : "rasm"})` }); return; }
  const total = await prisma.upload.aggregate({ _sum: { size: true } });
  if ((total._sum.size || 0) + f.size > MEDIA_LIMITS.totalBytes) { res.status(400).json({ error: "Yuklangan fayllar umumiy limiti (600 MB) to'ldi. Eski storis/bannerlarni o'chiring." }); return; }
  const ext = (path.extname(f.originalname) || (f.mimetype.startsWith("video/") ? ".mp4" : ".png")).toLowerCase().slice(0, 8);
  const name = `${Date.now()}-${randomBytes(4).toString("hex")}${ext}`;
  await prisma.upload.create({ data: { name, mime: f.mimetype, size: f.size, data: new Uint8Array(f.buffer) as never } });
  res.json({ ok: true, path: `/uploads/${name}`, url: `/uploads/${name}`, mime: f.mimetype, size: f.size });
});

// ---------- Storis ----------
adminRouter.get("/stories", async (_req, res) => {
  res.json(await prisma.story.findMany({ orderBy: { sortOrder: "asc" }, include: { slides: { orderBy: { sortOrder: "asc" } } } }));
});
const storySchema = z.object({ title: z.string().trim().min(1).max(60), cover: z.string().min(1), active: z.boolean().optional(), expiresAt: z.string().nullable().optional() });
adminRouter.post("/stories", async (req, res) => {
  const b = storySchema.parse(req.body);
  if ((await prisma.story.count()) >= MEDIA_LIMITS.stories) { res.status(400).json({ error: `Storislar limiti: ko'pi bilan ${MEDIA_LIMITS.stories} ta. Eskisini o'chiring.` }); return; }
  const max = (await prisma.story.aggregate({ _max: { sortOrder: true } }))._max.sortOrder || 0;
  const st = await prisma.story.create({ data: { title: b.title, cover: b.cover, active: b.active ?? true, sortOrder: max + 1, expiresAt: b.expiresAt ? new Date(b.expiresAt) : null } });
  res.json(st);
});
adminRouter.put("/stories/:id", async (req, res) => {
  const b = storySchema.partial().extend({ sortOrder: z.number().optional() }).parse(req.body);
  const st = await prisma.story.update({ where: { id: Number(req.params.id) }, data: { ...b, expiresAt: b.expiresAt === undefined ? undefined : b.expiresAt ? new Date(b.expiresAt) : null } });
  res.json(st);
});
async function dropUpload(url: string | null | undefined) {
  if (!url || !url.startsWith("/uploads/")) return;
  const name = path.basename(url);
  const used = await Promise.all([prisma.story.count({ where: { cover: url } }), prisma.storySlide.count({ where: { image: url } }), prisma.banner.count({ where: { image: url } })]);
  if (used.reduce((x, y) => x + y, 0) <= 1) await prisma.upload.deleteMany({ where: { name } }).catch(() => {});
}
adminRouter.get("/media/limits", async (_req, res) => {
  const [stories, banners, total] = await Promise.all([prisma.story.count(), prisma.banner.count(), prisma.upload.aggregate({ _sum: { size: true } })]);
  res.json({ ...MEDIA_LIMITS, used: { stories, banners, bytes: total._sum.size || 0 } });
});
adminRouter.delete("/stories/:id", async (req, res) => {
  const st = await prisma.story.findUnique({ where: { id: Number(req.params.id) }, include: { slides: true } });
  await prisma.story.delete({ where: { id: Number(req.params.id) } });
  if (st) { await dropUpload(st.cover); for (const sl of st.slides) await dropUpload(sl.image); }
  res.json({ ok: true });
});
const slideSchema = z.object({ image: z.string().min(1), caption: z.string().max(200).nullable().optional(), link: z.string().max(300).nullable().optional(), duration: z.number().min(1).max(180).optional(), buttonText: z.string().max(60).nullable().optional() });
adminRouter.post("/stories/:id/slides", async (req, res) => {
  const b = slideSchema.parse(req.body);
  const storyId = Number(req.params.id);
  if ((await prisma.storySlide.count({ where: { storyId } })) >= MEDIA_LIMITS.slidesPerStory) { res.status(400).json({ error: `Bitta storisda ko'pi bilan ${MEDIA_LIMITS.slidesPerStory} ta slayd.` }); return; }
  const max = (await prisma.storySlide.aggregate({ where: { storyId }, _max: { sortOrder: true } }))._max.sortOrder || 0;
  res.json(await prisma.storySlide.create({ data: { storyId, image: b.image, caption: b.caption || null, link: b.link || null, duration: b.duration || 5, buttonText: b.buttonText || null, sortOrder: max + 1 } }));
});
adminRouter.put("/slides/:id", async (req, res) => {
  const b = slideSchema.partial().extend({ sortOrder: z.number().optional() }).parse(req.body);
  res.json(await prisma.storySlide.update({ where: { id: Number(req.params.id) }, data: b }));
});
adminRouter.delete("/slides/:id", async (req, res) => {
  const sl = await prisma.storySlide.findUnique({ where: { id: Number(req.params.id) } });
  await prisma.storySlide.delete({ where: { id: Number(req.params.id) } });
  if (sl) await dropUpload(sl.image);
  res.json({ ok: true });
});
adminRouter.post("/stories/reorder", async (req, res) => {
  const ids = z.array(z.number()).parse((req.body as { ids?: number[] })?.ids);
  await Promise.all(ids.map((id, i) => prisma.story.update({ where: { id }, data: { sortOrder: i + 1 } })));
  res.json({ ok: true });
});

// ---------- Bannerlar ----------
adminRouter.get("/banners", async (_req, res) => { res.json(await prisma.banner.findMany({ orderBy: { sortOrder: "asc" } })); });
const bannerSchema = z.object({ image: z.string().min(1), title: z.string().max(80).nullable().optional(), subtitle: z.string().max(160).nullable().optional(), link: z.string().max(300).nullable().optional(), textColor: z.string().max(20).optional(), active: z.boolean().optional() });
adminRouter.post("/banners", async (req, res) => {
  const b = bannerSchema.parse(req.body);
  if ((await prisma.banner.count()) >= MEDIA_LIMITS.banners) { res.status(400).json({ error: `Bannerlar limiti: ko'pi bilan ${MEDIA_LIMITS.banners} ta. Eskisini o'chiring.` }); return; }
  const max = (await prisma.banner.aggregate({ _max: { sortOrder: true } }))._max.sortOrder || 0;
  res.json(await prisma.banner.create({ data: { image: b.image, title: b.title || null, subtitle: b.subtitle || null, link: b.link || null, textColor: b.textColor || "#ffffff", active: b.active ?? true, sortOrder: max + 1 } }));
});
adminRouter.put("/banners/:id", async (req, res) => {
  const b = bannerSchema.partial().extend({ sortOrder: z.number().optional() }).parse(req.body);
  res.json(await prisma.banner.update({ where: { id: Number(req.params.id) }, data: b }));
});
adminRouter.delete("/banners/:id", async (req, res) => { const b = await prisma.banner.findUnique({ where: { id: Number(req.params.id) } }); await prisma.banner.delete({ where: { id: Number(req.params.id) } }); if (b) await dropUpload(b.image); res.json({ ok: true }); });
adminRouter.post("/banners/reorder", async (req, res) => {
  const ids = z.array(z.number()).parse((req.body as { ids?: number[] })?.ids);
  await Promise.all(ids.map((id, i) => prisma.banner.update({ where: { id }, data: { sortOrder: i + 1 } })));
  res.json({ ok: true });
});

// ---------- Katalog boshqaruvi ----------
adminRouter.get("/catalog", async (_req, res) => {
  const [products, categories] = await Promise.all([
    prisma.product.findMany({ where: { isDeleted: false }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    prisma.category.findMany({ where: { isDeleted: false }, orderBy: { sortOrder: "asc" } }),
  ]);
  res.json({
    products: products.map((p) => ({ id: p.id, bitoId: p.bitoId, name: p.name, image: bito.fileUrl(p.image), price: p.price, finalPrice: priceFor(p, { storeId: "main", bitoCustomerId: null }).price, discountPercent: p.discountPercent, roundStep: p.roundStep, roundMode: p.roundMode, stock: p.stock, categoryId: p.categoryBitoId, categoryName: p.categoryName, hidden: p.hidden, featured: p.featured, sortOrder: p.sortOrder, boxItem: p.boxItem, sku: p.sku })),
    uzs: storeIsUzs("main"),
    categories: categories.map((c) => ({ id: c.id, bitoId: c.bitoId, name: c.name, parentId: c.parentId, image: bito.fileUrl(c.image), hidden: c.hidden, sortOrder: c.sortOrder, itemCount: c.itemCount })),
    sync: getSyncStatus(),
  });
});
adminRouter.put("/catalog/products/:id", async (req, res) => {
  const b = z.object({ hidden: z.boolean().optional(), featured: z.boolean().optional(), sortOrder: z.number().optional() }).parse(req.body);
  const p = await prisma.product.update({ where: { id: Number(req.params.id) }, data: b });
  invalidateProductCache();
  res.json({ ok: true, id: p.id, hidden: p.hidden, featured: p.featured, sortOrder: p.sortOrder });
});
adminRouter.post("/catalog/products/bulk", async (req, res) => {
  const b = z.object({ ids: z.array(z.number()), hidden: z.boolean().optional(), featured: z.boolean().optional() }).parse(req.body);
  const data: Record<string, boolean> = {};
  if (b.hidden !== undefined) data.hidden = b.hidden;
  if (b.featured !== undefined) data.featured = b.featured;
  await prisma.product.updateMany({ where: { id: { in: b.ids } }, data });
  invalidateProductCache();
  res.json({ ok: true });
});
adminRouter.post("/catalog/products/discount", async (req, res) => {
  const b = z.object({ ids: z.array(z.number()).min(1), percent: z.number().min(0).max(100), roundStep: z.number().int().min(0).optional(), roundMode: z.enum(["nearest", "up", "down"]).optional() }).parse(req.body);
  await prisma.product.updateMany({ where: { id: { in: b.ids } }, data: { discountPercent: b.percent, roundStep: b.percent > 0 ? (b.roundStep || 0) : 0, roundMode: b.roundMode || "nearest" } });
  invalidateProductCache();
  await activity("discount", `Chegirma ${b.percent}% → ${b.ids.length} ta mahsulot${b.roundStep ? ` (yaxlitlash /${b.roundStep} ${b.roundMode})` : ""}`);
  res.json({ ok: true });
});
adminRouter.post("/catalog/products/reorder", async (req, res) => {
  const ids = z.array(z.number()).parse((req.body as { ids?: number[] })?.ids);
  const orders = ids.map((_, i) => i + 1);
  await prisma.$executeRaw`UPDATE "Product" AS p SET "sortOrder" = v.ord FROM unnest(${ids}::int[], ${orders}::int[]) AS v(id, ord) WHERE p.id = v.id`;
  invalidateProductCache();
  res.json({ ok: true });
});
adminRouter.put("/catalog/categories/:id", async (req, res) => {
  const b = z.object({ hidden: z.boolean().optional(), sortOrder: z.number().optional() }).parse(req.body);
  const c = await prisma.category.update({ where: { id: Number(req.params.id) }, data: b });
  res.json({ ok: true, id: c.id, hidden: c.hidden, sortOrder: c.sortOrder });
});
adminRouter.post("/catalog/categories/reorder", async (req, res) => {
  const ids = z.array(z.number()).parse((req.body as { ids?: number[] })?.ids);
  const orders = ids.map((_, i) => i + 1);
  await prisma.$executeRaw`UPDATE "Category" AS c SET "sortOrder" = v.ord FROM unnest(${ids}::int[], ${orders}::int[]) AS v(id, ord) WHERE c.id = v.id`;
  res.json({ ok: true });
});

// ---------- Kutilayotgan mahsulotlar ----------
adminRouter.get("/waitlist", async (_req, res) => {
  const rows = await prisma.waitlist.findMany({ orderBy: { createdAt: "desc" }, include: { user: true, product: true }, take: 500 });
  res.json(rows.map((w) => ({
    id: w.id, createdAt: w.createdAt, notifiedAt: w.notifiedAt,
    product: { id: w.product.id, name: w.product.name, stock: w.product.stock, image: bito.fileUrl(w.product.image) },
    user: { id: w.user.id, name: w.user.name || w.user.tgFirstName, phone: w.user.phone, username: w.user.tgUsername, telegramId: String(w.user.telegramId) },
  })));
});
adminRouter.delete("/waitlist/:id", async (req, res) => { await prisma.waitlist.delete({ where: { id: Number(req.params.id) } }); res.json({ ok: true }); });

// ---------- Guruhlar va xodimlar ----------
adminRouter.get("/groups", async (_req, res) => { res.json(await prisma.adminGroup.findMany({ orderBy: { createdAt: "desc" } })); });
adminRouter.post("/groups", async (req, res) => {
  const b = z.object({ chatId: z.string().trim().min(3), title: z.string().optional() }).parse(req.body);
  const g = await prisma.adminGroup.upsert({ where: { chatId: b.chatId }, create: { chatId: b.chatId, title: b.title || null, enabled: true }, update: { enabled: true, title: b.title || undefined } });
  res.json(g);
});
adminRouter.put("/groups/:id", async (req, res) => {
  const b = z.object({ enabled: z.boolean() }).parse(req.body);
  res.json(await prisma.adminGroup.update({ where: { id: Number(req.params.id) }, data: b }));
});
adminRouter.delete("/groups/:id", async (req, res) => { await prisma.adminGroup.delete({ where: { id: Number(req.params.id) } }); res.json({ ok: true }); });
adminRouter.post("/groups/:id/test", async (req, res) => {
  const g = await prisma.adminGroup.findUnique({ where: { id: Number(req.params.id) } });
  if (!g) { res.status(404).json({ error: "not found" }); return; }
  try { await bot.api.sendMessage(g.chatId, "✅ Test: bot bu guruhga xabar yubora oladi."); res.json({ ok: true }); }
  catch (e) { res.json({ ok: false, error: errMsg(e) }); }
});
adminRouter.get("/staff", async (_req, res) => { res.json(await prisma.staff.findMany({ orderBy: { createdAt: "desc" } })); });
adminRouter.post("/staff", async (req, res) => {
  const b = z.object({ telegramId: z.string().trim().regex(/^\d+$/), name: z.string().max(80).optional(), username: z.string().max(80).optional(), role: z.string().optional() }).parse(req.body);
  res.json(await prisma.staff.upsert({ where: { telegramId: b.telegramId }, create: { telegramId: b.telegramId, name: b.name || null, username: b.username || null, role: b.role || "staff" }, update: { name: b.name || undefined, username: b.username || undefined, role: b.role || undefined } }));
});
adminRouter.delete("/staff/:id", async (req, res) => { await prisma.staff.delete({ where: { id: Number(req.params.id) } }); res.json({ ok: true }); });

// ---------- Xabar tarqatish ----------
adminRouter.post("/broadcast", async (req, res) => {
  const b = z.object({
    text: z.string().trim().min(1).max(3500),
    media: z.string().optional(),
    mediaType: z.enum(["photo", "video", "document", "animation"]).optional(),
    hd: z.boolean().optional(),
    language: z.enum(["all", "uz", "ru", "en"]).optional(),
    buttonText: z.string().trim().max(60).optional(),
    buttonTarget: z.string().trim().max(300).optional(),
  }).parse(req.body);
  const users = await prisma.user.findMany({ where: { step: "done", isBlocked: false, ...(b.language && b.language !== "all" ? { language: b.language } : {}) } });
  res.json({ ok: true, total: users.length });
  // Tugma: url / product:ID / category:ID → Mini App ichida ochiladi
  const pub = getPublicUrl();
  let markup: InlineKeyboard | undefined;
  if (b.buttonText && b.buttonTarget) {
    const t = b.buttonTarget;
    const kb = new InlineKeyboard();
    if (/^https?:\/\//.test(t)) kb.url(b.buttonText, t);
    else if (pub) kb.webApp(b.buttonText, `${pub}/app/?go=${encodeURIComponent(t)}`);
    if (kb.inline_keyboard.length) markup = kb;
  }
  const mediaName = b.media ? path.basename(b.media) : null;
  const dbFile = mediaName ? await prisma.upload.findUnique({ where: { name: mediaName } }) : null;
  const diskPath = mediaName ? path.join(env.UPLOADS_DIR, mediaName) : null;
  const file: InputFile | null = dbFile ? new InputFile(Buffer.from(dbFile.data), dbFile.name) : diskPath && fs.existsSync(diskPath) ? new InputFile(diskPath) : null;
  const isVideo = mediaName ? /[.](mp4|webm|mov)$/i.test(mediaName) : false;
  const isGif = mediaName ? /[.]gif$/i.test(mediaName) : false;
  const type = b.mediaType || (isVideo ? "video" : isGif ? "animation" : b.hd ? "document" : "photo");
  let sent = 0;
  let fileId: string | null = null;
  (async () => {
    for (const usr of users) {
      try {
        const chat = String(usr.telegramId);
        const media = fileId || file;
        const opts = { caption: b.text, parse_mode: "HTML" as const, reply_markup: markup };
        let m: { photo?: { file_id: string }[]; video?: { file_id: string }; document?: { file_id: string }; animation?: { file_id: string } } | null = null;
        if (!media) await bot.api.sendMessage(chat, b.text, { parse_mode: "HTML", reply_markup: markup, link_preview_options: { is_disabled: true } });
        else if (type === "video") m = await bot.api.sendVideo(chat, media, { ...opts, supports_streaming: true });
        else if (type === "animation") m = await bot.api.sendAnimation(chat, media, opts);
        else if (type === "document") m = await bot.api.sendDocument(chat, media, opts);
        else m = await bot.api.sendPhoto(chat, media, opts);
        // Telegram'ga bir marta yuklab, keyin file_id bilan yuborish (tez va sifatli)
        if (m && !fileId) fileId = m.video?.file_id || m.document?.file_id || m.animation?.file_id || m.photo?.[m.photo.length - 1]?.file_id || null;
        sent++;
      } catch (e) { log.warn("broadcast", errMsg(e)); }
      await new Promise((r) => setTimeout(r, 50));
    }
    await activity("broadcast", `Xabar tarqatildi: ${sent}/${users.length}`);
  })().catch(() => {});
});

/** Havola tanlash uchun mahsulot/kategoriya ro'yxati (id + nom) */
adminRouter.get("/picker", async (_req, res) => {
  const [products, categories] = await Promise.all([
    prisma.product.findMany({ where: { isDeleted: false }, select: { id: true, name: true, bitoId: true, categoryName: true }, orderBy: { name: "asc" } }),
    prisma.category.findMany({ where: { isDeleted: false }, select: { bitoId: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  res.json({ products: products.map((p) => ({ id: p.id, name: p.name, category: p.categoryName })), categories: categories.map((c) => ({ id: c.bitoId, name: c.name })) });
});

// ---------- Foydalanuvchilar statistikasi ----------
adminRouter.get("/users/summary", async (_req, res) => {
  const [total, registered, linked, blocked] = await Promise.all([
    prisma.user.count(), prisma.user.count({ where: { step: "done" } }), prisma.user.count({ where: { bitoCustomerId: { not: null } } }), prisma.user.count({ where: { isBlocked: true } }),
  ]);
  res.json({ total, registered, linked, blocked });
});

adminRouter.post("/settings/reload", async (_req, res) => { await loadSettings(); res.json({ ok: true }); });

adminRouter.use((err: unknown, _req: Request, res: Response, _next: unknown) => {
  if (err instanceof z.ZodError) { res.status(400).json({ error: "Ma'lumotlar noto'g'ri: " + err.issues.map((i) => i.path.join(".") + " " + i.message).join("; ") }); return; }
  log.error("admin api", err);
  res.status(500).json({ error: errMsg(err) });
});
