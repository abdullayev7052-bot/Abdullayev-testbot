import { env } from "../env.ts";
import { log } from "../logger.ts";
import { prisma } from "../db.ts";

/** Hosting platformalari beradigan domen (Railway, Render, Fly, Heroku) */
function platformUrl(): string {
  const d = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RENDER_EXTERNAL_HOSTNAME || process.env.FLY_APP_NAME && `${process.env.FLY_APP_NAME}.fly.dev` || "";
  if (!d) return process.env.RENDER_EXTERNAL_URL || "";
  return d.startsWith("http") ? d : `https://${d}`;
}

let current = "";
const listeners: ((url: string) => void)[] = [];

export function getPublicUrl(): string {
  return current;
}

export function onPublicUrlChange(fn: (url: string) => void) {
  listeners.push(fn);
}

/** ngrok'ning lokal API'sidan (127.0.0.1:4040) ommaviy https manzilni aniqlash */
export async function detectNgrokUrl(): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000);
    const r = await fetch("http://127.0.0.1:4040/api/tunnels", { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const j = (await r.json()) as { tunnels?: { public_url: string; proto: string; config?: { addr?: string } }[] };
    const tunnels = (j.tunnels || []).filter((x) => x.public_url?.startsWith("https://"));
    if (!tunnels.length) return null;
    // Bizning portga yo'naltirilganini tanlaymiz
    const mine = tunnels.find((x) => (x.config?.addr || "").endsWith(":" + env.PORT)) || tunnels[0];
    return mine.public_url.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function setUrl(url: string) {
  if (url === current) return;
  current = url;
  log.info(`🌐 Ommaviy manzil: ${url}`);
  for (const fn of listeners) {
    try { fn(url); } catch (e) { log.error("publicUrl listener", e); }
  }
}

/** Har 15 soniyada ngrok manzilini tekshirib turadi (agar .env da PUBLIC_URL berilmagan bo'lsa) */
export async function startPublicUrlWatcher() {
  if (env.PUBLIC_URL) { setUrl(env.PUBLIC_URL); return; }
  const platform = platformUrl();
  if (platform) { setUrl(platform); return; }
  // Admin paneldan qo'lda saqlangan manzil
  try {
    const row = await prisma.syncState.findUnique({ where: { key: "publicUrl" } });
    const saved = (row?.value as { url?: string } | null)?.url;
    if (saved) { setUrl(saved); return; }
  } catch { /* ignore */ }
  const tick = async () => {
    const u = await detectNgrokUrl();
    if (u) setUrl(u);
  };
  void tick();
  setInterval(tick, 15000);
}

/** Admin paneldan qo'lda o'rnatish (bazada saqlanadi) */
export function setPublicUrlManually(url: string) {
  const u = url.replace(/[/]+$/, "");
  setUrl(u);
  prisma.syncState.upsert({ where: { key: "publicUrl" }, create: { key: "publicUrl", value: { url: u } }, update: { value: { url: u } } }).catch(() => {});
}
