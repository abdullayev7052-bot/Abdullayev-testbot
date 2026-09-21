import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import fs from "node:fs";
import { env } from "../env.ts";
import { prisma } from "../db.ts";
import { getSettings } from "../settings/store.ts";
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

  app.use(express.json({ limit: "5mb" }));
  app.use(cookieParser());

  // ngrok brauzer ogohlantirishini o'tkazib yuborish uchun sarlavha (mini app so'rovlari)
  app.use((_req, res, next) => { res.setHeader("ngrok-skip-browser-warning", "1"); next(); });

  app.get("/api/health", (_req, res) => { res.json({ ok: true, time: new Date().toISOString() }); });
  app.use("/api/app", appRouter);
  app.use("/api/admin", adminRouter);

  // Yuklangan fayllar: avval disk, keyin baza
  app.use("/uploads", express.static(env.UPLOADS_DIR, { maxAge: "7d", immutable: true }));
  app.get("/uploads/:name", async (req, res) => {
    const name = path.basename(String(req.params.name));
    const f = await prisma.upload.findUnique({ where: { name } }).catch(() => null);
    if (!f) { res.status(404).end(); return; }
    res.setHeader("Content-Type", f.mime);
    res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    res.setHeader("Content-Length", String(f.size));
    res.end(Buffer.from(f.data));
  });

  // PWA manifest va ikonka — admin paneldagi logo bilan bir xil
  const iconSvg = (emoji: string, color: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="${color}"/><text x="64" y="86" font-size="64" text-anchor="middle">${emoji}</text></svg>`;
  app.get(["/admin/icon", "/app/icon"], async (req, res) => {
    const ap = getSettings().adminPanel as Record<string, string>;
    const design = getSettings().design as Record<string, string>;
    const logo = req.path.startsWith("/admin") ? ap.logo : design.logoImage || ap.logo;
    if (logo && logo.startsWith("/uploads/")) {
      const f = await prisma.upload.findUnique({ where: { name: path.basename(logo) } }).catch(() => null);
      if (f) { res.setHeader("Content-Type", f.mime); res.setHeader("Cache-Control", "public, max-age=3600"); res.end(Buffer.from(f.data)); return; }
      const disk = path.join(env.UPLOADS_DIR, path.basename(logo));
      if (fs.existsSync(disk)) { res.setHeader("Cache-Control", "public, max-age=3600"); res.sendFile(disk); return; }
    }
    res.setHeader("Content-Type", "image/svg+xml"); res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(iconSvg(ap.emoji || "🛍", ap.primaryColor || "#2563eb"));
  });
  app.get("/admin/manifest.json", (_req, res) => {
    const ap = getSettings().adminPanel as Record<string, string>;
    res.setHeader("Cache-Control", "no-cache");
    res.json({ name: ap.title || "Admin panel", short_name: (ap.title || "Admin").slice(0, 12), start_url: "/admin/", scope: "/admin/", display: "standalone", background_color: "#f4f6fa", theme_color: ap.primaryColor || "#2563eb",
      icons: [{ src: "/admin/icon", sizes: "192x192", type: "image/png", purpose: "any" }, { src: "/admin/icon", sizes: "512x512", type: "image/png", purpose: "any maskable" }] });
  });
  app.get("/app/manifest.json", (_req, res) => {
    const g = getSettings().general as unknown as Record<string, Record<string, string>>;
    const design = getSettings().design as Record<string, string>;
    const name = (g.shopName?.uz as string) || "Do'kon";
    res.setHeader("Cache-Control", "no-cache");
    res.json({ name, short_name: name.slice(0, 12), start_url: "/app/", scope: "/app/", display: "standalone", background_color: design.bgColor || "#ffffff", theme_color: design.primaryColor || "#2563eb",
      icons: [{ src: "/app/icon", sizes: "192x192", type: "image/png" }, { src: "/app/icon", sizes: "512x512", type: "image/png", purpose: "any maskable" }] });
  });

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

/** Diskdagi eski yuklangan fayllarni bazaga ko'chirish (bir marta) */
export async function migrateDiskUploads() {
  try {
    if (!fs.existsSync(env.UPLOADS_DIR)) return;
    const files = fs.readdirSync(env.UPLOADS_DIR).filter((f) => /\.(png|jpe?g|webp|gif|svg|mp4|webm|mov)$/i.test(f));
    let n = 0;
    for (const f of files) {
      if (await prisma.upload.findUnique({ where: { name: f } })) continue;
      const data = fs.readFileSync(path.join(env.UPLOADS_DIR, f));
      const ext = f.split(".").pop()!.toLowerCase();
      const mime = ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" } as Record<string, string>)[ext] || "application/octet-stream";
      await prisma.upload.create({ data: { name: f, mime, size: data.length, data: new Uint8Array(data) as never } });
      n++;
    }
    if (n) log.info(`📦 ${n} ta eski fayl bazaga ko'chirildi`);
  } catch (e) { log.warn("migrateDiskUploads", (e as Error).message); }
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
