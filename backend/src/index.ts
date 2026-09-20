import { env } from "./env.ts";
import { prisma } from "./db.ts";
import { log, errMsg } from "./logger.ts";
import { loadSettings, getSettings } from "./settings/store.ts";
import { listen } from "./http/server.ts";
import { startBot } from "./bot/index.ts";
import { ensureContext, startCatalogSyncLoop } from "./bito/sync.ts";
import { startOrderReconcileLoop } from "./bito/orders.ts";
import { startFinancePollLoop } from "./bito/finance.ts";
import { ensureWebhookSubscription } from "./bito/webhook.ts";
import { getPublicUrl, onPublicUrlChange, startPublicUrlWatcher } from "./utils/publicUrl.ts";
import { startTunnelAutostart } from "./utils/tunnel.ts";

async function main() {
  log.info("🚀 Bito Telegram Shop ishga tushmoqda...");
  await prisma.$connect();
  await loadSettings();

  // Bito konteksti (tashkilot, ombor, narx, holatlar) — avtomatik
  try { await ensureContext(); } catch (e) { log.warn("Bito konteksti to'ldirilmadi:", errMsg(e)); }

  await listen();
  await startBot();

  await startPublicUrlWatcher();
  startTunnelAutostart();
  onPublicUrlChange((url) => { void ensureWebhookSubscription(url); });
  if (getPublicUrl()) void ensureWebhookSubscription(getPublicUrl());

  startCatalogSyncLoop();
  startOrderReconcileLoop();
  startFinancePollLoop();

  const s = getSettings();
  log.info(`✅ Tayyor. Bito: ${s.bito.apiKey ? s.bito.apiKey.split(":")[0] : "ulanmagan"} | Admin: http://localhost:${env.PORT}/admin/`);
  if (!getPublicUrl()) log.info("Ommaviy manzil hali yo'q — ngrok/cloudflared avtomatik ishga tushiriladi yoki alohida oynada: ngrok http " + env.PORT);
}

process.on("unhandledRejection", (e) => log.error("unhandledRejection", errMsg(e)));
process.on("uncaughtException", (e) => log.error("uncaughtException", errMsg(e)));

main().catch((e) => {
  log.error("Ishga tushirishda xato:", e);
  process.exit(1);
});
