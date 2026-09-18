import { env } from "../env.ts";
import { log } from "../logger.ts";

let current = env.PUBLIC_URL || "";
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
export function startPublicUrlWatcher() {
  if (env.PUBLIC_URL) {
    setUrl(env.PUBLIC_URL);
    return;
  }
  const tick = async () => {
    const u = await detectNgrokUrl();
    if (u) setUrl(u);
  };
  void tick();
  setInterval(tick, 15000);
}

/** Admin paneldan qo'lda o'rnatish */
export function setPublicUrlManually(url: string) {
  setUrl(url.replace(/\/+$/, ""));
}
