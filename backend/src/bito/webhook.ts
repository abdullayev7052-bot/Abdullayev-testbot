import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { prisma } from "../db.ts";
import { bito } from "./client.ts";
import { getSettings } from "../settings/store.ts";
import { activity, errMsg, log } from "../logger.ts";
import { reconcileOrder } from "./orders.ts";
import { processTrade, processTransaction } from "./finance.ts";
import { scheduleCatalogSync, syncOneProduct } from "./sync.ts";
import { events } from "../events.ts";

export const WEBHOOK_EVENTS = [
  "saleOrders.create", "saleOrders.update", "saleOrders.status_change", "saleOrders.delete",
  "trades.create", "trades.update", "trades.status_change",
  "transactions.create", "transactions.update", "transactions.status_change",
  "products.create", "products.update", "products.delete",
  "productStocks.create", "productStocks.update", "productStocks.delete", "productStocks.status_change",
  "productPrices.create", "productPrices.update", "productPrices.delete",
  "productCategories.create", "productCategories.update", "productCategories.delete",
];

interface WebhookState { destination: string; secret: string; events: string[]; at: string; error?: string }

export async function getWebhookState(): Promise<WebhookState | null> {
  const r = await prisma.syncState.findUnique({ where: { key: "webhook" } });
  return (r?.value as unknown as WebhookState) || null;
}

/** Ommaviy manzil ma'lum bo'lganda Bito'ga obuna bo'lish (yoki yangilash) */
export async function ensureWebhookSubscription(publicUrl: string, force = false): Promise<WebhookState | null> {
  const s = getSettings().bito;
  if (!s.apiKey || !s.webhookEnabled || !publicUrl) return null;
  const destination = `${publicUrl.replace(/\/+$/, "")}/api/bito/webhook`;
  const cur = await getWebhookState();
  if (!force && cur && cur.destination === destination && cur.secret && !cur.error) return cur;
  try {
    // Eski manzillarni tozalash (ngrok manzili o'zgarganda)
    if (cur?.destination && cur.destination !== destination) {
      await bito.webhookUnsubscribe(cur.destination).catch(() => {});
    }
    const r = await bito.webhookSubscribe(destination, WEBHOOK_EVENTS);
    const state: WebhookState = { destination, secret: r.secret, events: r.events || WEBHOOK_EVENTS, at: new Date().toISOString() };
    await prisma.syncState.upsert({ where: { key: "webhook" }, create: { key: "webhook", value: state as never }, update: { value: state as never } });
    await activity("webhook", `Bito webhook ulandi: ${destination}`);
    return state;
  } catch (e) {
    const state: WebhookState = { destination, secret: cur?.secret || "", events: [], at: new Date().toISOString(), error: errMsg(e) };
    await prisma.syncState.upsert({ where: { key: "webhook" }, create: { key: "webhook", value: state as never }, update: { value: state as never } });
    await activity("webhook_error", `Bito webhook ulanmadi: ${errMsg(e)}`);
    return state;
  }
}

function verifySignature(raw: Buffer, header: string | undefined, secret: string): boolean {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=")));
  const t = parts.t, v1 = parts.v1;
  if (!t || !v1) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(t)) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.`).update(raw).digest("hex");
  const a = Buffer.from(expected, "hex"), b = Buffer.from(String(v1), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Express: POST /api/bito/webhook (raw body) */
export async function webhookHandler(req: Request, res: Response) {
  const raw: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === "string" ? req.body : JSON.stringify(req.body || {}));
  const state = await getWebhookState();
  const s = getSettings().bito;
  const sig = req.header("x-bito-signature");
  const apiKeyHeader = req.header("api-key");
  const okSig = state?.secret ? verifySignature(raw, sig, state.secret) : false;
  const okKey = !!apiKeyHeader && apiKeyHeader === s.apiKey;
  if (!okSig && !okKey) {
    log.warn("Webhook imzosi noto'g'ri");
    res.status(401).json({ ok: false });
    return;
  }
  let payload: { collection_name?: string; action?: string; id?: string; organization_id?: string } = {};
  try { payload = JSON.parse(raw.toString("utf8")); } catch { res.status(400).json({ ok: false }); return; }
  res.json({ ok: true });
  if (!payload.collection_name || !payload.id) return;
  events.emitApp("webhook", payload as never);
  dispatch(payload.collection_name, payload.action || "", payload.id).catch((e) => log.error("webhook dispatch", e));
}

async function dispatch(collection: string, action: string, id: string) {
  log.info(`📥 Webhook: ${collection}.${action} ${id}`);
  switch (collection) {
    case "saleOrders": {
      const order = await prisma.order.findUnique({ where: { bitoId: id } });
      if (order && action !== "delete") await reconcileOrder(order);
      break;
    }
    case "trades":
      await processTrade(id);
      break;
    case "transactions":
      await processTransaction(id);
      break;
    case "products":
      if (action === "delete") await prisma.product.updateMany({ where: { bitoId: id }, data: { isDeleted: true, stock: 0 } });
      else await syncOneProduct(id);
      break;
    case "productStocks":
    case "productPrices":
    case "productCategories":
      scheduleCatalogSync(8000, collection);
      break;
  }
}
