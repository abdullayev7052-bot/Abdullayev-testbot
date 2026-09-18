import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import fs from "node:fs";
import { env } from "../env.ts";
import { log } from "../logger.ts";
import { appRouter } from "./routes/app.ts";
import { adminRouter } from "./routes/admin.ts";
import { webhookHandler } from "../bito/webhook.ts";

export function createServer() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", true);

  // Bito webhook — xom (raw) tana imzo tekshiruvi uchun
  app.post("/api/bito/webhook", express.raw({ type: "*/*", limit: "1mb" }), (req, res) => { void webhookHandler(req, res); });

  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());

  // ngrok brauzer ogohlantirishini o'tkazib yuborish uchun sarlavha (mini app so'rovlari)
  app.use((_req, res, next) => { res.setHeader("ngrok-skip-browser-warning", "1"); next(); });

  app.get("/api/health", (_req, res) => { res.json({ ok: true, time: new Date().toISOString() }); });
  app.use("/api/app", appRouter);
  app.use("/api/admin", adminRouter);

  // Yuklangan fayllar
  app.use("/uploads", express.static(env.UPLOADS_DIR, { maxAge: "7d", immutable: true }));

  // Mini App va Admin panel (build qilingan)
  const miniDist = path.join(env.ROOT_DIR, "miniapp", "dist");
  const adminDist = path.join(env.ROOT_DIR, "admin", "dist");
  serveSpa(app, "/app", miniDist, "Mini App hali build qilinmagan. Terminalda: npm run build");
  serveSpa(app, "/admin", adminDist, "Admin panel hali build qilinmagan. Terminalda: npm run build");

  app.get("/", (_req, res) => {
    res.type("html").send(`<!doctype html><meta charset="utf-8"><title>Bito Telegram Shop</title>
<body style="font-family:system-ui;max-width:640px;margin:60px auto;line-height:1.6">
<h2>🛍 Bito Telegram Shop backend ishlayapti</h2>
<ul><li><a href="/admin/">Admin panel</a></li><li><a href="/app/?dev_user=${env.ADMIN_TELEGRAM_ID || 0}">Mini App (brauzer test)</a></li><li><a href="/api/health">API health</a></li></ul>
</body>`);
  });

  app.use((_req, res) => { res.status(404).json({ error: "not found" }); });
  return app;
}

function serveSpa(app: express.Express, prefix: string, dist: string, missingMsg: string) {
  const index = path.join(dist, "index.html");
  app.use(prefix, express.static(dist, { index: false, maxAge: "1h" }));
  app.get(`${prefix}{/*splat}`, (req, res) => {
    if (!req.path.endsWith("/") && req.path === prefix) { res.redirect(prefix + "/" + (req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "")); return; }
    if (!fs.existsSync(index)) { res.status(503).type("text").send(missingMsg); return; }
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(index);
  });
}

export function listen() {
  const app = createServer();
  return new Promise<void>((resolve, reject) => {
    const portHint = `.env faylida PORT qiymatini o'zgartiring (masalan 4000, 4100, 5000) va qayta ishga tushiring.`;
    const server = app.listen(env.PORT, () => {
      const addr = server.address();
      if (!addr) {
        reject(new Error(`Port ${env.PORT} band yoki Windows tomonidan taqiqlangan. ${portHint}`));
        return;
      }
      log.info(`🌍 HTTP server: http://localhost:${env.PORT}  (admin: http://localhost:${env.PORT}/admin/)`);
      resolve();
    });
    server.on("error", (e: NodeJS.ErrnoException) => {
      if (e.code === "EACCES" || e.code === "EADDRINUSE") {
        reject(new Error(`Port ${env.PORT} ochilmadi (${e.code}) — band yoki Windows tomonidan taqiqlangan. ${portHint}`));
      } else reject(e);
    });
  });
}
