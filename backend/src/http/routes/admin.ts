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
import { updateMenuButton } from "../../bot/index.ts";
import { sendToUser } from "../../bot/send.ts";
import { invalidateProductCache } from "./app.ts";
import { InputFile } from "grammy";

export const adminRouter = Router();

adminRouter.post("/login", adminLogin);
adminRouter.post("/logout", adminLogout);
adminRouter.use(adminAuth);
adminRouter.get("/me", (_req, res) => { res.json({ ok: true }); });

// ---------- Sozlamalar ----------
adminRouter.get("/schema", (_req, res) => { res.json(settingsSchema); });
adminRouter.get("/settings", (_req, res) => {
  const s = getSettings() as unknown as Record<string, Record<string, unknown>>;
  const out = { ...s, general: { ...s.general, adminPassword: "" } };
  res.json(out);
});
adminRouter.put("/settings/:section", async (req, res) => {
  const section = String(req.params.section);
  const patch = (req.body || {}) as Record<string, unknown>;
  const before = getSettings();
  if (section === "general" && typeof patch.adminPassword === "string" && patch.adminPassword.trim()) {
    await setAdminPassword(patch.adminPassword.trim());
    await activity("admin", "Admin paroli o'zgartirildi");
  }
  if (section === "general") patch.adminPassword = "";
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
  res.json({ ok: true, settings: { ...(getSettings() as unknown as Record<string, unknown>), general: { ...getSettings().general, adminPassword: "" } } });
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
adminRouter.get("/activity", async (req, res) => {
  const take = Math.min(300, Number(req.query.limit || 100));
  res.json(await prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take }));
});

// ---------- Fayl yuklash ----------
fs.mkdirSync(env.UPLOADS_DIR, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: env.UPLOADS_DIR,
    filename: (_req, file, cb) => {
      const ext = (path.extname(file.originalname) || ".png").toLowerCase().slice(0, 8);
      cb(null, `${Date.now()}-${randomBytes(4).toString("hex")}${ext}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(png|jpe?g|webp|gif|svg\+xml)$|^video\/mp4$/.test(file.mimetype)),
});
adminRouter.post("/upload", upload.single("file"), (req, res) => {
  const f = (req as Request & { file?: Express.Multer.File }).file;
  if (!f) { res.status(400).json({ error: "Fayl tanlanmadi (faqat rasm)" }); return; }
  res.json({ ok: true, path: `/uploads/${f.filename}`, url: `/uploads/${f.filename}` });
});

// ---------- Storis ----------
adminRouter.get("/stories", async (_req, res) => {
  res.json(await prisma.story.findMany({ orderBy: { sortOrder: "asc" }, include: { slides: { orderBy: { sortOrder: "asc" } } } }));
});
const storySchema = z.object({ title: z.string().trim().min(1).max(60), cover: z.string().min(1), active: z.boolean().optional(), expiresAt: z.string().nullable().optional() });
adminRouter.post("/stories", async (req, res) => {
  const b = storySchema.parse(req.body);
  const max = (await prisma.story.aggregate({ _max: { sortOrder: true } }))._max.sortOrder || 0;
  const st = await prisma.story.create({ data: { title: b.title, cover: b.cover, active: b.active ?? true, sortOrder: max + 1, expiresAt: b.expiresAt ? new Date(b.expiresAt) : null } });
  res.json(st);
});
adminRouter.put("/stories/:id", async (req, res) => {
  const b = storySchema.partial().extend({ sortOrder: z.number().optional() }).parse(req.body);
  const st = await prisma.story.update({ where: { id: Number(req.params.id) }, data: { ...b, expiresAt: b.expiresAt === undefined ? undefined : b.expiresAt ? new Date(b.expiresAt) : null } });
  res.json(st);
});
adminRouter.delete("/stories/:id", async (req, res) => {
  await prisma.story.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});
const slideSchema = z.object({ image: z.string().min(1), caption: z.string().max(200).nullable().optional(), link: z.string().max(300).nullable().optional(), duration: z.number().min(1).max(60).optional() });
adminRouter.post("/stories/:id/slides", async (req, res) => {
  const b = slideSchema.parse(req.body);
  const storyId = Number(req.params.id);
  const max = (await prisma.storySlide.aggregate({ where: { storyId }, _max: { sortOrder: true } }))._max.sortOrder || 0;
  res.json(await prisma.storySlide.create({ data: { storyId, image: b.image, caption: b.caption || null, link: b.link || null, duration: b.duration || 5, sortOrder: max + 1 } }));
});
adminRouter.put("/slides/:id", async (req, res) => {
  const b = slideSchema.partial().extend({ sortOrder: z.number().optional() }).parse(req.body);
  res.json(await prisma.storySlide.update({ where: { id: Number(req.params.id) }, data: b }));
});
adminRouter.delete("/slides/:id", async (req, res) => {
  await prisma.storySlide.delete({ where: { id: Number(req.params.id) } });
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
  const max = (await prisma.banner.aggregate({ _max: { sortOrder: true } }))._max.sortOrder || 0;
  res.json(await prisma.banner.create({ data: { image: b.image, title: b.title || null, subtitle: b.subtitle || null, link: b.link || null, textColor: b.textColor || "#ffffff", active: b.active ?? true, sortOrder: max + 1 } }));
});
adminRouter.put("/banners/:id", async (req, res) => {
  const b = bannerSchema.partial().extend({ sortOrder: z.number().optional() }).parse(req.body);
  res.json(await prisma.banner.update({ where: { id: Number(req.params.id) }, data: b }));
});
adminRouter.delete("/banners/:id", async (req, res) => { await prisma.banner.delete({ where: { id: Number(req.params.id) } }); res.json({ ok: true }); });
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
    products: products.map((p) => ({ id: p.id, bitoId: p.bitoId, name: p.name, image: bito.fileUrl(p.image), price: p.price, stock: p.stock, categoryId: p.categoryBitoId, categoryName: p.categoryName, hidden: p.hidden, featured: p.featured, sortOrder: p.sortOrder, boxItem: p.boxItem, sku: p.sku })),
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
adminRouter.post("/catalog/products/reorder", async (req, res) => {
  const ids = z.array(z.number()).parse((req.body as { ids?: number[] })?.ids);
  await prisma.$transaction(ids.map((id, i) => prisma.product.update({ where: { id }, data: { sortOrder: i + 1 } })));
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
  await prisma.$transaction(ids.map((id, i) => prisma.category.update({ where: { id }, data: { sortOrder: i + 1 } })));
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
  const b = z.object({ text: z.string().trim().min(1).max(3500), image: z.string().optional(), language: z.enum(["all", "uz", "ru", "en"]).optional() }).parse(req.body);
  const users = await prisma.user.findMany({ where: { step: "done", isBlocked: false, ...(b.language && b.language !== "all" ? { language: b.language } : {}) } });
  res.json({ ok: true, total: users.length });
  let sent = 0;
  (async () => {
    for (const usr of users) {
      try {
        if (b.image) {
          const file = path.join(env.UPLOADS_DIR, path.basename(b.image));
          await bot.api.sendPhoto(String(usr.telegramId), new InputFile(file), { caption: b.text, parse_mode: "HTML" });
        } else await sendToUser(usr.telegramId, b.text);
        sent++;
      } catch (e) { log.warn("broadcast", errMsg(e)); }
      await new Promise((r) => setTimeout(r, 60));
    }
    await activity("broadcast", `Xabar tarqatildi: ${sent}/${users.length}`);
  })().catch(() => {});
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
