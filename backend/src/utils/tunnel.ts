/**
 * Tunnel avtomatik ishga tushirish: ngrok (asosiy) yoki cloudflared (zaxira).
 * Foydalanuvchi alohida oynada ngrok'ni o'zi ishga tushirgan bo'lsa — hech narsa qilmaydi.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { env } from "../env.ts";
import { log } from "../logger.ts";
import { getPublicUrl, setPublicUrlManually } from "./publicUrl.ts";

let child: ChildProcess | null = null;

function findBin(name: string): Promise<string | null> {
  const local = [path.join(env.ROOT_DIR, `${name}.exe`), path.join(env.ROOT_DIR, name), path.join(env.ROOT_DIR, "tools", `${name}.exe`)];
  for (const p of local) if (fs.existsSync(p)) return Promise.resolve(p);
  return new Promise((resolve) => {
    execFile(process.platform === "win32" ? "where" : "which", [name], (err, stdout) => {
      if (err || !stdout.trim()) return resolve(null);
      resolve(stdout.trim().split(/\r?\n/)[0]);
    });
  });
}

function ngrokDomain(): string {
  const f = path.join(env.ROOT_DIR, "ngrok-domain.txt");
  try { return fs.readFileSync(f, "utf8").trim().split(/\r?\n/)[0].trim(); } catch { return ""; }
}

export function startTunnelAutostart() {
  if (env.PUBLIC_URL) return;
  const mode = (process.env.TUNNEL || "auto").toLowerCase();
  if (mode === "none") return;
  setTimeout(async () => {
    if (getPublicUrl()) return; // ngrok allaqachon ishlayapti (4040 orqali topildi)
    if (mode === "ngrok" || mode === "auto") {
      const bin = await findBin("ngrok");
      if (bin) {
        const domain = ngrokDomain();
        const args = ["http", ...(domain ? [`--url=${domain}`] : []), String(env.PORT)];
        log.info(`🚇 ngrok ishga tushirilmoqda: ${path.basename(bin)} ${args.join(" ")}`);
        child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
        let errBuf = "";
        child.stderr?.on("data", (d) => { errBuf += String(d); });
        child.stdout?.on("data", (d) => { errBuf += String(d); });
        child.on("exit", (code) => {
          child = null;
          if (code && code !== 0) {
            const m = errBuf.match(/ERR_NGROK_\d+[^\n]*|authtoken[^\n]*/i);
            log.warn(`ngrok to'xtadi (kod ${code}). ${m ? m[0] : ""}`.trim());
            log.warn("ngrok: authtoken kiritilganini tekshiring: ngrok config add-authtoken <token>");
          }
        });
        return;
      }
    }
    if (mode === "cloudflared" || mode === "auto") {
      const bin = await findBin("cloudflared");
      if (bin) {
        log.info("🚇 cloudflared tunnel ishga tushirilmoqda...");
        child = spawn(bin, ["tunnel", "--url", `http://localhost:${env.PORT}`, "--no-autoupdate"], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
        const onData = (d: Buffer) => {
          const m = String(d).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
          if (m && !getPublicUrl()) setPublicUrlManually(m[0]);
        };
        child.stdout?.on("data", onData);
        child.stderr?.on("data", onData);
        child.on("exit", () => { child = null; });
        return;
      }
    }
    log.warn("Tunnel dasturi topilmadi. ngrok (winget install ngrok.ngrok) yoki cloudflared o'rnating, yoki alohida oynada ishga tushiring.");
  }, 7000);

  const stop = () => { if (child) { try { child.kill(); } catch { /* ignore */ } } };
  process.on("exit", stop);
  process.on("SIGINT", () => { stop(); process.exit(0); });
  process.on("SIGTERM", () => { stop(); process.exit(0); });
}
