/* Analitika hodisalari: navbatga yig'ilib, 3 soniyada bir marta serverga yuboriladi (UI ni sekinlashtirmaydi). */
import { tg, inTelegram, devUserId } from "./telegram.ts";

type Meta = Record<string, string | number | boolean | null>;
interface Ev { name: string; meta?: Meta; at: number }

const queue: Ev[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
const seen = new Set<string>();

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json", "ngrok-skip-browser-warning": "1", "X-Platform": tg?.platform || "web" };
  if (inTelegram && tg) h.Authorization = `tma ${tg.initData}`;
  else { const d = devUserId(); if (d) h["X-Dev-User"] = d; }
  return h;
}

export function flushEvents() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!queue.length) return;
  const events = queue.splice(0, 50);
  fetch("/api/app/events", { method: "POST", headers: headers(), body: JSON.stringify({ platform: tg?.platform || "web", events }), keepalive: true }).catch(() => {});
  if (queue.length) timer = setTimeout(flushEvents, 500);
}

/** Hodisa yozish. `once` — sahifa hayoti davomida bir marta (masalan app_open). */
export function track(name: string, meta?: Meta, opts?: { once?: string }) {
  if (opts?.once) { if (seen.has(opts.once)) return; seen.add(opts.once); }
  queue.push({ name, meta, at: Date.now() });
  if (queue.length >= 20) flushEvents();
  else if (!timer) timer = setTimeout(flushEvents, 3000);
}

// Ilova yopilganda/fonga o'tganda navbatdagilarni yuborish
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushEvents(); });
  window.addEventListener("pagehide", flushEvents);
}
