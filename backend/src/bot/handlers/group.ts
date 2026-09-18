import type { Bot } from "grammy";
import type { MyContext } from "../context.ts";
import { prisma } from "../../db.ts";
import { env } from "../../env.ts";
import { getSettings } from "../../settings/store.ts";
import { applyStage, nextStages, type Stage } from "../../bito/orders.ts";
import { activity, errMsg, log } from "../../logger.ts";

async function isStaff(ctx: MyContext, chatId: string): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;
  const tg = String(from.id);
  if (env.ADMIN_TELEGRAM_ID && tg === env.ADMIN_TELEGRAM_ID) return true;
  const staff = await prisma.staff.findUnique({ where: { telegramId: tg } });
  if (staff) return true;
  const mode = getSettings().bot.staffMode;
  if (mode === "list") return false;
  // "group" rejimi: ruxsat etilgan guruh a'zosi
  const g = await prisma.adminGroup.findUnique({ where: { chatId } });
  return !!g?.enabled;
}

export function registerGroup(bot: Bot<MyContext>) {
  // Bot guruhga qo'shildi / chiqarildi
  bot.on("my_chat_member", async (ctx) => {
    const chat = ctx.chat;
    if (chat.type !== "group" && chat.type !== "supergroup") return;
    const status = ctx.myChatMember.new_chat_member.status;
    const chatId = String(chat.id);
    if (status === "member" || status === "administrator") {
      const byAdmin = env.ADMIN_TELEGRAM_ID && String(ctx.from.id) === env.ADMIN_TELEGRAM_ID;
      const g = await prisma.adminGroup.upsert({
        where: { chatId },
        create: { chatId, title: chat.title, enabled: !!byAdmin },
        update: { title: chat.title, ...(byAdmin ? { enabled: true } : {}) },
      });
      await activity("group_added", `Bot guruhga qo'shildi: ${chat.title} (${chatId})${g.enabled ? " — yoqilgan" : ""}`);
      await ctx.reply(
        `👋 Salom! Bu guruh ID: <code>${chatId}</code>\n\n` +
        (g.enabled
          ? "✅ Bu guruh buyurtmalar uchun <b>yoqilgan</b>. Yangi buyurtmalar shu yerga tushadi."
          : "Buyurtmalar tushishi uchun admin panelda <b>Guruhlar</b> bo'limida shu guruhni yoqing.") +
        "\n\nℹ️ Xabarlarni tahrirlashi uchun botni guruh <b>administratori</b> qiling.",
        { parse_mode: "HTML" },
      ).catch(() => {});
    } else if (status === "left" || status === "kicked") {
      await prisma.adminGroup.updateMany({ where: { chatId }, data: { enabled: false } });
      await activity("group_removed", `Bot guruhdan chiqarildi: ${chat.title} (${chatId})`);
    }
  });

  // Guruh ID sini bilish uchun
  bot.command("id", async (ctx) => {
    await ctx.reply(`Chat ID: <code>${ctx.chat.id}</code>\nSizning ID: <code>${ctx.from?.id}</code>`, { parse_mode: "HTML" });
  });

  // Holat tugmalari: st:<orderId>:<stage>
  bot.callbackQuery(/^st:(\d+):(new|accepted|ready|delivering|done|canceled)$/, async (ctx) => {
    const orderId = Number(ctx.match[1]);
    const stage = ctx.match[2] as Stage;
    const chatId = String(ctx.chat?.id || "");
    const s = getSettings();
    if (!(await isStaff(ctx, chatId))) {
      await ctx.answerCallbackQuery({ text: s.bot.groupNotAllowed, show_alert: true });
      return;
    }
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) { await ctx.answerCallbackQuery({ text: "Buyurtma topilmadi", show_alert: true }); return; }
    const allowed = nextStages((order.stateKey || "new") as Stage, order.type);
    if (!allowed.includes(stage)) {
      await ctx.answerCallbackQuery({ text: "Bu holat allaqachon o'zgargan. Xabar yangilanmoqda...", show_alert: false });
      const { refreshGroupMessage } = await import("../notify.ts");
      await refreshGroupMessage(order);
      return;
    }
    const from = ctx.from;
    const by = { type: "staff" as const, name: [from.first_name, from.last_name].filter(Boolean).join(" "), username: from.username, telegramId: String(from.id) };
    try {
      await applyStage(order, stage, by, { pushToBito: true });
      await ctx.answerCallbackQuery({ text: "✅ Bito'da yangilandi" });
    } catch (e) {
      log.error("stage change", errMsg(e));
      await ctx.answerCallbackQuery({ text: "❌ " + errMsg(e).slice(0, 180), show_alert: true });
    }
  });
}
