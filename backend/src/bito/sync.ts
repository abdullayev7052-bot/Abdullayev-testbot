import { prisma } from "../db.ts";
import { bito } from "./client.ts";
import { getSettings, updateSection } from "../settings/store.ts";
import { buildSearchKey } from "../utils/search.ts";
import { activity, errMsg, log } from "../logger.ts";
import type { BitoProduct } from "./types.ts";
import { allPriceIds, listStores, setCurrencyCodes } from "./stores.ts";

let running = false;
let lastResult: { at: string; ok: boolean; message: string; products: number; categories: number } | null = null;
let stockArrivedHandler: ((productIds: number[]) => Promise<void>) | null = null;

export function onStockArrived(fn: (productIds: number[]) => Promise<void>) {
  stockArrivedHandler = fn;
}

export function getSyncStatus() {
  return { running, last: lastResult };
}

/** Bo'sh qolgan kontekst sozlamalarini Bito'dan avtomatik to'ldirish */
export async function ensureContext(): Promise<void> {
  const s = getSettings().bito;
  if (!s.apiKey) return;
  const patch: Record<string, unknown> = {};
  let orgId = s.organizationId;
  if (!orgId) {
    const orgs = await bito.organizations();
    const def = orgs.find((o) => o.is_default) || orgs.find((o) => o.type === "main") || orgs[0];
    if (def) { orgId = def._id; patch.organizationId = def._id; if (!s.currencyId && def.currency_id) patch.currencyId = def.currency_id; }
  }
  if (!s.warehouseId && orgId) {
    const whs = await bito.warehouses();
    const wh = whs.find((w) => w.organization_id === orgId && w.is_main) || whs.find((w) => w.organization_id === orgId) || whs[0];
    if (wh) patch.warehouseId = wh._id;
  }
  if (!s.priceId) {
    const prices = await bito.prices();
    const sale = prices.filter((p) => p.type === "sale" && p.status !== "archived");
    const pick = sale.find((p) => p.is_default) || sale.find((p) => !/\$/.test(p.name)) || sale[0] || prices[0];
    if (pick) { patch.priceId = pick._id; if (!s.currencyId && !patch.currencyId && pick.currency_id) patch.currencyId = pick.currency_id; }
  }
  if (!s.currencyId && !patch.currencyId) {
    const cur = await bito.currencies();
    const main = cur.find((c) => c.is_main) || cur[0];
    if (main) patch.currencyId = main._id;
  }
  if (!s.responsibleId) {
    try { const me = await bito.profile(); if (me?._id) patch.responsibleId = me._id; } catch { /* ignore */ }
  }
  if (Object.keys(patch).length) {
    await updateSection("bito", patch);
    log.info("Bito konteksti avtomatik to'ldirildi:", patch);
  }
  // Holatlar
  const st = getSettings().statuses;
  if (!st.newStateId || !st.doneStateId || !st.canceledStateId) await autoMapStates();
}

/** Bito'dagi buyurtma holatlarini nomiga qarab avtomatik bog'lash */
export async function autoMapStates(): Promise<void> {
  const s = getSettings();
  const orgId = s.bito.organizationId;
  if (!s.bito.apiKey || !orgId) return;
  const states = (await bito.states("saleOrders", orgId)).filter((x) => x.organization_id === orgId);
  const norm = (x: string) => x.toLowerCase().replace(/['’ʻ`]/g, "");
  const byName = (...names: string[]) => states.find((st) => names.some((n) => norm(st.name).includes(norm(n))));
  const byKey = (k: string) => states.find((st) => st.default_key === k);
  const patch: Record<string, string> = {};
  const cur = s.statuses;
  const set = (key: keyof typeof cur, v?: { _id: string }) => { if (v && !cur[key]) patch[key] = v._id; };
  set("newStateId", byKey("new") || byName("yangi", "новый", "new"));
  set("acceptedStateId", byName("qabul", "принят", "accepted") || byKey("in_progress") || byKey("accepted"));
  set("readyStateId", byName("tayyor", "готов", "ready"));
  set("deliveringStateId", byName("yetkazilmoqda", "yo'lda", "доставля", "delivering", "в пути"));
  set("doneStateId", byKey("done") || byName("bajarildi", "выполнен", "done", "completed"));
  set("canceledStateId", byKey("canceled") || byName("bekor", "отмен", "cancel"));
  if (Object.keys(patch).length) {
    await updateSection("statuses", patch);
    log.info("Buyurtma holatlari avtomatik bog'landi:", patch);
  }
}

const CMP_KEYS = ["name", "searchKey", "image", "price", "priceId", "currencyId", "stock", "boxItem", "measure", "measureDecimals", "sku", "barcode", "note", "categoryBitoId", "categoryName", "isAvailableForSale", "isDeleted"] as const;
function productChanged(old: Record<string, unknown>, data: Record<string, unknown>): boolean {
  for (const k of CMP_KEYS) if ((old[k] ?? null) !== (data[k] ?? null)) return true;
  if (JSON.stringify(old.images) !== JSON.stringify(data.images)) return true;
  if (JSON.stringify(old.customFields) !== JSON.stringify(data.customFields)) return true;
  if (JSON.stringify(old.stores) !== JSON.stringify(data.stores)) return true;
  if (JSON.stringify(old.prices) !== JSON.stringify(data.prices)) return true;
  const a = old.bitoUpdatedAt instanceof Date ? old.bitoUpdatedAt.getTime() : null;
  const b = data.bitoUpdatedAt instanceof Date ? data.bitoUpdatedAt.getTime() : null;
  return a !== b;
}

function stockOf(p: BitoProduct, orgId: string, warehouseId: string, source: string): number {
  if (source === "warehouse" && warehouseId) {
    const w = p._warehouses?.[warehouseId];
    if (w) return Number(w.amount || 0);
    return 0;
  }
  const o = p.organizations?.find((x) => x.organization_id === orgId);
  return Number(o?.amount || 0);
}

function priceOf(p: BitoProduct, orgId: string, priceId: string, map: Map<string, number>): number {
  const m = map.get(p._id);
  if (m !== undefined) return m;
  const o = p.organizations?.find((x) => x.organization_id === orgId);
  const pr = o?.prices?.find((x) => x.price_id === priceId);
  return Number(pr?.amount || 0);
}

function customFieldsOf(p: BitoProduct, defs: Map<string, string>): { name: string; value: string }[] {
  const out: { name: string; value: string }[] = [];
  for (const cf of p.custom_fields || []) {
    const name = defs.get(cf._id);
    if (!name || cf.value === null || cf.value === undefined || cf.value === "") continue;
    out.push({ name, value: String(cf.value) });
  }
  return out;
}

/** Bito → mahalliy kesh: barcha mahsulotlar, narxlar, kategoriyalar */
export async function syncCatalog(reason = "interval"): Promise<typeof lastResult> {
  if (running) return lastResult;
  const s = getSettings();
  if (!s.bito.apiKey) { lastResult = { at: new Date().toISOString(), ok: false, message: "API kalit yo'q", products: 0, categories: 0 }; return lastResult; }
  running = true;
  const started = Date.now();
  try {
    await ensureContext();
    const b = getSettings().bito;
    const orgId = b.organizationId;
    const stores = listStores();
    const priceIds = allPriceIds();
    const [products, categories, cfDefs, currencies, ...priceLists] = await Promise.all([
      bito.products({ is_product: true }),
      bito.categories(),
      bito.customFields(),
      bito.currencies().catch(() => []),
      ...priceIds.map((pid) => bito.priceItems(pid).catch((e) => { log.warn("Narxlar o'qilmadi:", pid, errMsg(e)); return []; })),
    ]);
    setCurrencyCodes(new Map(currencies.map((c) => [c._id, (c.code || c.symbol || c.name || "").toLowerCase()])));
    // key: "<orgId>:<priceId>" → Map<productId, amount>; "*:<priceId>" — istalgan tashkilot (zaxira)
    const priceMaps = new Map<string, Map<string, number>>();
    priceIds.forEach((pid, i) => {
      for (const it of priceLists[i]) {
        if (!it.product?._id) continue;
        for (const key of [`${it.organization_id}:${pid}`, `*:${pid}`]) {
          if (!priceMaps.has(key)) priceMaps.set(key, new Map());
          const m = priceMaps.get(key)!;
          if (key.startsWith("*:") && m.has(it.product._id)) continue;
          m.set(it.product._id, Number(it.amount || 0));
        }
      }
    });
    const priceLookup = (org: string, pid: string, productId: string, p: BitoProduct): number => {
      // Avval shu tashkilot narxi, bo'lmasa istalgan tashkilotdagi shu narx turi
      const v = priceMaps.get(`${org}:${pid}`)?.get(productId) ?? priceMaps.get(`*:${pid}`)?.get(productId);
      if (v !== undefined) return v;
      return priceOf(p, org, pid, new Map());
    };
    const defs = new Map<string, string>();
    for (const d of cfDefs) if (d.table_name === "products") defs.set(d._id, d.name);

    // Mavjud keshdagi qoldiqlar (0 → >0 o'tishini aniqlash uchun)
    const existing = await prisma.product.findMany();
    const oldById = new Map(existing.map((e) => [e.bitoId, e]));
    const seen = new Set<string>();
    const arrived: number[] = [];
    const updates: { id: number; data: Record<string, unknown> }[] = [];
    const creates: Record<string, unknown>[] = [];
    let maxOrder = 0;
    const orderRows = await prisma.product.aggregate({ _max: { sortOrder: true } });
    maxOrder = orderRows._max.sortOrder || 0;

    for (const p of products) {
      if (p.is_parent) continue;
      if (p.is_deleted || p.is_archived) continue;
      const org = p.organizations?.find((x) => x.organization_id === orgId);
      // Do'konlar bo'yicha narx/qoldiq
      const storesData: Record<string, { price: number; stock: number; available: boolean }> = {};
      for (const st of stores) {
        const sOrg = p.organizations?.find((x) => x.organization_id === st.organizationId);
        if (st.organizationId && p.organizations?.length && !sOrg) continue;
        if (b.onlyAvailableForSale && sOrg && sOrg.is_available === false) continue;
        const sStock = stockOf(p, st.organizationId, st.warehouseId, st.stockSource);
        storesData[st.id] = { price: priceLookup(st.organizationId, st.priceId, p._id, p), stock: sStock, available: sOrg ? sOrg.is_available_for_sale !== false || sStock > 0 : true };
      }
      if (!Object.keys(storesData).length) continue; // hech qaysi do'konga tegishli emas
      seen.add(p._id);
      const main = storesData.main || Object.values(storesData)[0];
      const stock = main.stock;
      const price = main.price;
      const pricesAll: Record<string, number> = {};
      for (const pid of priceIds) pricesAll[pid] = priceLookup(orgId, pid, p._id, p);
      const images = (p.images && p.images.length ? p.images : p.image ? [p.image] : []).filter(Boolean) as string[];
      const data = {
        name: p.name,
        searchKey: buildSearchKey(p.name, p.sku, p.barcode, p.category?.name),
        image: images[0] || null,
        images,
        price,
        priceId: b.priceId || null,
        currencyId: b.currencyId || null,
        stock,
        stores: storesData,
        prices: pricesAll,
        boxItem: Number(p.box_item || 0),
        measure: p.measure?.short_name || p.measure?.name || null,
        measureDecimals: Number(p.measure?.decimal_count || 0),
        sku: p.sku || null,
        barcode: p.barcode || null,
        note: p.note || null,
        customFields: customFieldsOf(p, defs),
        categoryBitoId: p.category?._id || null,
        categoryName: p.category?.name || null,
        isAvailableForSale: main.available,
        isDeleted: false,
        bitoUpdatedAt: p.updated_at ? new Date(p.updated_at) : null,
        syncedAt: new Date(),
      };
      const old = oldById.get(p._id);
      if (old) {
        if (productChanged(old, data)) updates.push({ id: old.id, data });
        const oldStores = (old.stores as Record<string, { stock?: number }>) || {};
        const wasOut = old.isDeleted || (old.stock <= 0 && !Object.values(oldStores).some((x) => Number(x?.stock || 0) > 0));
        const nowIn = Object.values(storesData).some((x) => x.stock > 0);
        if (wasOut && nowIn) arrived.push(old.id);
      } else {
        maxOrder += 1;
        creates.push({ ...data, bitoId: p._id, sortOrder: maxOrder });
      }
    }
    // Yozuvlar: faqat o'zgarganlar, guruhlab
    for (let i = 0; i < updates.length; i += 10) {
      await Promise.all(updates.slice(i, i + 10).map((u) => prisma.product.update({ where: { id: u.id }, data: u.data })));
    }
    if (creates.length) await prisma.product.createMany({ data: creates as never });
    // Bito'da yo'q bo'lib qolganlar
    const gone = existing.filter((e) => !seen.has(e.bitoId) && !e.isDeleted).map((e) => e.id);
    if (gone.length) await prisma.product.updateMany({ where: { id: { in: gone } }, data: { isDeleted: true, stock: 0 } });

    // Kategoriyalar
    const catSeen = new Set<string>();
    const catMax = (await prisma.category.aggregate({ _max: { sortOrder: true } }))._max.sortOrder || 0;
    let catOrder = catMax;
    for (const c of categories) {
      catSeen.add(c._id);
      const data = { name: c.name, parentId: c.parent_id || null, image: c.image || null, itemCount: Number(c.item_count || 0), isDeleted: false, syncedAt: new Date() };
      const ex = await prisma.category.findUnique({ where: { bitoId: c._id } });
      if (ex) await prisma.category.update({ where: { id: ex.id }, data });
      else { catOrder += 1; await prisma.category.create({ data: { ...data, bitoId: c._id, sortOrder: catOrder } }); }
    }
    await prisma.category.updateMany({ where: { bitoId: { notIn: [...catSeen] }, isDeleted: false }, data: { isDeleted: true } });

    await prisma.syncState.upsert({ where: { key: "catalog" }, create: { key: "catalog", value: { at: new Date().toISOString() } }, update: { value: { at: new Date().toISOString() } } });
    lastResult = { at: new Date().toISOString(), ok: true, message: `${seen.size} mahsulot, ${catSeen.size} kategoriya (${Date.now() - started} ms, ${reason})`, products: seen.size, categories: catSeen.size };
    log.info("🔄 Katalog sinxronlandi:", lastResult.message);
    if (arrived.length && stockArrivedHandler) {
      stockArrivedHandler(arrived).catch((e) => log.error("waitlist notify", e));
    }
  } catch (e) {
    lastResult = { at: new Date().toISOString(), ok: false, message: errMsg(e), products: 0, categories: 0 };
    await activity("sync_error", "Katalog sinxronizatsiya xatosi: " + errMsg(e));
  } finally {
    running = false;
  }
  return lastResult;
}

/** Bitta mahsulotni yangilash (webhook orqali) */
export async function syncOneProduct(bitoId: string): Promise<void> {
  const b = getSettings().bito;
  if (!b.apiKey) return;
  try {
    const p = await bito.productById(bitoId);
    const old = await prisma.product.findUnique({ where: { bitoId } });
    if (!p || p.is_deleted || p.is_archived) {
      if (old) await prisma.product.update({ where: { id: old.id }, data: { isDeleted: true, stock: 0 } });
      return;
    }
    const stock = stockOf(p, b.organizationId, b.warehouseId, b.stockSource);
    const images = (p.images && p.images.length ? p.images : p.image ? [p.image] : []).filter(Boolean) as string[];
    const price = old?.price ?? 0;
    const oldStores = (old?.stores as Record<string, { price: number; stock: number; available: boolean }>) || {};
    const storesData: Record<string, { price: number; stock: number; available: boolean }> = {};
    for (const st of listStores()) {
      const sOrg = p.organizations?.find((x) => x.organization_id === st.organizationId);
      if (st.organizationId && p.organizations?.length && !sOrg) continue;
      const sStock = stockOf(p, st.organizationId, st.warehouseId, st.stockSource);
      storesData[st.id] = { price: oldStores[st.id]?.price ?? priceOf(p, st.organizationId, st.priceId, new Map()) ?? 0, stock: sStock, available: sOrg ? sOrg.is_available_for_sale !== false || sStock > 0 : true };
    }
    const data = {
      name: p.name, searchKey: buildSearchKey(p.name, p.sku, p.barcode, p.category?.name), image: images[0] || null, images,
      stock, boxItem: Number(p.box_item || 0), measure: p.measure?.short_name || p.measure?.name || null,
      measureDecimals: Number(p.measure?.decimal_count || 0), sku: p.sku || null, barcode: p.barcode || null, note: p.note || null,
      categoryBitoId: p.category?._id || null, categoryName: p.category?.name || null, isDeleted: false,
      bitoUpdatedAt: p.updated_at ? new Date(p.updated_at) : null, syncedAt: new Date(),
      price: storesData.main?.price ?? (priceOf(p, b.organizationId, b.priceId, new Map()) || price),
      stores: storesData,
    };
    if (old) {
      await prisma.product.update({ where: { id: old.id }, data });
      const wasOut = old.isDeleted || (old.stock <= 0 && !Object.values(oldStores).some((x) => Number(x?.stock || 0) > 0));
      if (wasOut && Object.values(storesData).some((x) => x.stock > 0) && stockArrivedHandler) await stockArrivedHandler([old.id]);
    } else {
      const max = (await prisma.product.aggregate({ _max: { sortOrder: true } }))._max.sortOrder || 0;
      await prisma.product.create({ data: { ...data, bitoId, sortOrder: max + 1 } });
    }
  } catch (e) {
    log.warn("syncOneProduct", bitoId, errMsg(e));
  }
}

let debounceTimer: NodeJS.Timeout | null = null;
/** Ko'p webhook kelganda bitta sinxronizatsiyaga jamlash */
export function scheduleCatalogSync(delayMs = 8000, reason = "webhook") {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => { debounceTimer = null; void syncCatalog(reason); }, delayMs);
}

let intervalTimer: NodeJS.Timeout | null = null;
export function startCatalogSyncLoop() {
  const tick = async () => {
    await syncCatalog("interval");
    const sec = Math.max(30, Number(getSettings().bito.syncIntervalSec || 300));
    intervalTimer = setTimeout(tick, sec * 1000);
  };
  if (intervalTimer) clearTimeout(intervalTimer);
  void tick();
}
