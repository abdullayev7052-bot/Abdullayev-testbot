/**
 * Ulashish rejimi: admin savatni yoki bitta mahsulot/kategoriyani havola qilib ulashadi.
 * Havola: https://t.me/<bot>?start=<kod> — botga start bosmagan odam uchun ham ishlaydi.
 * Mijoz tugmani bosganda Mini App ochilib, savatga o'sha mahsulotlar tushadi.
 */
import { randomBytes } from "node:crypto";
import { prisma } from "../db.ts";
import { getSettings } from "../settings/store.ts";

export type ShareKind = "cart" | "product" | "category";
export interface SharePayload {
  items?: { productId: number; qty: number; boxCount?: number }[];
  productId?: number;
  categoryId?: string;
}

/** Foydalanuvchi ulashish rejimidagi adminmi (sozlamadagi Telegram ID ro'yxati bo'yicha) */
export function isShareAdmin(telegramId: bigint | number | string | null | undefined): boolean {
  if (telegramId === null || telegramId === undefined) return false;
  const list = getSettings().general.shareAdmins;
  const ids = Array.isArray(list) ? list : String(list || "").split(/[\s,;]+/);
  const me = String(telegramId).trim();
  return ids.map((x) => String(x).trim()).filter(Boolean).includes(me);
}

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
function newCode(len = 8): string {
  const b = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[b[i] % ALPHABET.length];
  return out;
}

export async function createShare(kind: ShareKind, payload: SharePayload, createdBy?: number | null): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    const exists = await prisma.share.findUnique({ where: { code }, select: { code: true } });
    if (exists) continue;
    await prisma.share.create({ data: { code, kind, payload: payload as object, createdBy: createdBy ?? null } });
    return code;
  }
  throw new Error("Havola yaratilmadi, qayta urinib ko'ring");
}

export async function readShare(code: string, countOpen = false) {
  const row = await prisma.share.findUnique({ where: { code } });
  if (!row) return null;
  if (countOpen) prisma.share.update({ where: { code }, data: { opens: { increment: 1 } } }).catch(() => {});
  return { code: row.code, kind: row.kind as ShareKind, payload: (row.payload as SharePayload) || {} };
}

/** 90 kundan eski havolalarni tozalash */
export async function pruneShares(days = 90) {
  await prisma.share.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - days * 86400000) } } }).catch(() => {});
}
