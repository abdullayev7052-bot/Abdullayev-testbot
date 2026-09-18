import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { User } from "@prisma/client";
import { env } from "../env.ts";
import { prisma } from "../db.ts";
import { normalizeLang } from "../settings/store.ts";

export interface TgInitUser { id: number; first_name?: string; last_name?: string; username?: string; language_code?: string }

/** Telegram Mini App initData imzosini tekshirish */
export function verifyInitData(initData: string): TgInitUser | null {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return null;
    params.delete("hash");
    const pairs = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`);
    const secret = createHmac("sha256", "WebAppData").update(env.BOT_TOKEN).digest();
    const calc = createHmac("sha256", secret).update(pairs.join("\n")).digest("hex");
    const a = Buffer.from(calc, "hex"), b = Buffer.from(hash, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const authDate = Number(params.get("auth_date") || 0);
    if (!authDate || Date.now() / 1000 - authDate > 60 * 60 * 24 * 3) return null;
    const user = JSON.parse(params.get("user") || "null");
    if (!user || !user.id) return null;
    return user as TgInitUser;
  } catch {
    return null;
  }
}

export interface AppRequest extends Request {
  user: User;
}

/** Mini App uchun autentifikatsiya: Authorization: tma <initData> */
export async function appAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization") || "";
  let tg: TgInitUser | null = null;
  if (header.startsWith("tma ")) tg = verifyInitData(header.slice(4));
  if (!tg && env.ALLOW_DEV_AUTH) {
    const dev = req.header("x-dev-user") || (req.query.dev_user as string);
    if (dev && /^\d+$/.test(dev)) tg = { id: Number(dev), first_name: "Dev" };
  }
  if (!tg) { res.status(401).json({ error: "unauthorized" }); return; }
  const tgId = BigInt(tg.id);
  let user = await prisma.user.findUnique({ where: { telegramId: tgId } });
  if (!user) {
    user = await prisma.user.create({
      data: { telegramId: tgId, tgUsername: tg.username || null, tgFirstName: tg.first_name || null, language: normalizeLang(tg.language_code?.slice(0, 2)) },
    });
  }
  (req as AppRequest).user = user;
  next();
}

// ---------------- Admin ----------------

const COOKIE = "admin_token";

export async function getAdminPasswordHash(): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key: "auth" } });
  const v = row?.value as { passwordHash?: string } | null;
  if (v?.passwordHash) return v.passwordHash;
  return bcrypt.hashSync(env.ADMIN_PASSWORD, 8);
}

export async function setAdminPassword(password: string) {
  const passwordHash = bcrypt.hashSync(password, 10);
  await prisma.setting.upsert({ where: { key: "auth" }, create: { key: "auth", value: { passwordHash } }, update: { value: { passwordHash } } });
}

export async function adminLogin(req: Request, res: Response) {
  const password = String((req.body as { password?: string })?.password || "");
  const hash = await getAdminPasswordHash();
  if (!password || !bcrypt.compareSync(password, hash)) { res.status(401).json({ error: "Parol noto'g'ri" }); return; }
  const token = jwt.sign({ role: "admin" }, env.JWT_SECRET, { expiresIn: "7d" });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 3600 * 1000, path: "/" });
  res.json({ ok: true });
}

export function adminLogout(_req: Request, res: Response) {
  res.clearCookie(COOKIE, { path: "/" });
  res.json({ ok: true });
}

export function adminAuth(req: Request, res: Response, next: NextFunction) {
  const token = (req as Request & { cookies?: Record<string, string> }).cookies?.[COOKIE] || (req.header("authorization") || "").replace(/^Bearer /, "");
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { role?: string };
    if (payload.role !== "admin") throw new Error("no");
    next();
  } catch {
    res.status(401).json({ error: "unauthorized" });
  }
}
