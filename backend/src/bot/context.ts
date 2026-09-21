import type { Context, NextFunction } from "grammy";
import type { User } from "@prisma/client";
import { prisma } from "../db.ts";
import { fill, getSettings, lt, normalizeLang, type AppSettings } from "../settings/store.ts";
import type { Lang } from "../settings/schema.ts";
import { trackBotActivity } from "../analytics/track.ts";

export type BotTextKey = keyof AppSettings["bot"];

export interface MyContext extends Context {
  user: User;
  lang: Lang;
  /** Sozlamalardagi ko'p tilli matn */
  t: (key: BotTextKey, vars?: Record<string, string | number | undefined>) => string;
}

/** Shaxsiy chatlarda foydalanuvchini bazadan yuklash / yaratish */
export async function userMiddleware(ctx: MyContext, next: NextFunction) {
  const from = ctx.from;
  if (!from || from.is_bot) return next();
  const tgId = BigInt(from.id);
  let user = await prisma.user.findUnique({ where: { telegramId: tgId } });
  const isNew = !user;
  if (!user) {
    user = await prisma.user.create({
      data: {
        telegramId: tgId, tgUsername: from.username || null, tgFirstName: from.first_name || null,
        language: getSettings().general.languageMode === "telegram" ? normalizeLang(from.language_code?.slice(0, 2)) : normalizeLang(undefined),
      },
    });
  } else if (user.tgUsername !== (from.username || null) || user.tgFirstName !== (from.first_name || null) || user.isBlocked) {
    user = await prisma.user.update({ where: { id: user.id }, data: { tgUsername: from.username || null, tgFirstName: from.first_name || null, isBlocked: false } });
  }
  ctx.user = user;
  trackBotActivity(user.id, isNew);
  ctx.lang = normalizeLang(user.language);
  ctx.t = (key, vars) => {
    const v = getSettings().bot[key];
    const text = typeof v === "string" ? v : lt(v as never, ctx.lang);
    return vars ? fill(text, vars) : text;
  };
  return next();
}

export async function setUserStep(ctx: MyContext, step: string, extra: Record<string, unknown> = {}) {
  ctx.user = await prisma.user.update({ where: { id: ctx.user.id }, data: { step, ...extra } });
}
