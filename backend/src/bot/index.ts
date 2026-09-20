import type { Bot } from "grammy";
import { bot as rawBot } from "./instance.ts";
import { userMiddleware, type MyContext } from "./context.ts";
import { registerStart } from "./handlers/start.ts";
import { registerMenu } from "./handlers/menu.ts";
import { registerGroup } from "./handlers/group.ts";
import { registerNotifications } from "./notify.ts";
import { getSettings, lt } from "../settings/store.ts";
import { env } from "../env.ts";
import { getPublicUrl, onPublicUrlChange } from "../utils/publicUrl.ts";
import { activity, errMsg, log } from "../logger.ts";
import { appUrl } from "./keyboards.ts";

export const bot = rawBot as unknown as Bot<MyContext>;

export async function setupBotCommands() {
  const cmds = [
    { command: "start", description: "Boshlash / Начать / Start" },
    { command: "buyurtmalar", description: "📦 Buyurtmalar" },
    { command: "xaridlar", description: "🧾 Xaridlar" },
    { command: "malumotlarim", description: "👤 Mening ma'lumotlarim" },
    { command: "sozlamalar", description: "⚙️ Sozlamalar" },
    { command: "balans", description: "💰 Hozirgi balans" },
    { command: "kartam", description: "💳 Mening kartam" },
    { command: "akt", description: "📑 Akt sverka" },
  ];
  await bot.api.setMyCommands(cmds, { scope: { type: "all_private_chats" } }).catch((e) => log.warn("setMyCommands", errMsg(e)));
  await bot.api.setMyCommands([{ command: "id", description: "Guruh ID sini ko'rsatish" }], { scope: { type: "all_group_chats" } }).catch(() => {});
  await updateMenuButton();
}

/** Chatning pastki chap "Menu" tugmasini Mini App'ga ulash */
export async function updateMenuButton() {
  const url = appUrl();
  const s = getSettings();
  try {
    if (url) {
      await bot.api.setChatMenuButton({ menu_button: { type: "web_app", text: lt(s.bot.menuButtonText, s.general.defaultLanguage).slice(0, 16) || "Shop", web_app: { url } } });
      log.info("🔘 Menu tugmasi Mini App'ga ulandi:", url);
    } else {
      await bot.api.setChatMenuButton({ menu_button: { type: "commands" } });
    }
  } catch (e) {
    log.warn("setChatMenuButton", errMsg(e));
  }
}

let handlersReady = false;
/** Handlerlarni ro'yxatdan o'tkazish (polling siz) */
export function setupBot() {
  if (handlersReady) return;
  handlersReady = true;
  bot.use(async (ctx, next) => {
    // Guruhlarda foydalanuvchini bazaga yozmaymiz, faqat shaxsiy chatda
    if (ctx.chat?.type === "private") return userMiddleware(ctx, next);
    return next();
  });

  registerNotifications();
  registerGroup(bot);
  // Bosh admin uchun admin panel havolasi
  bot.command("admin", async (ctx) => {
    if (ctx.chat.type !== "private") return;
    if (!env.ADMIN_TELEGRAM_ID || String(ctx.from?.id) !== env.ADMIN_TELEGRAM_ID) return;
    const pub = getPublicUrl();
    await ctx.reply(
      `🛠 <b>Admin panel</b>\n\nKompyuterda: <code>http://localhost:${env.PORT}/admin/</code>` +
      (pub ? `\nInternetdan: ${pub}/admin/` : "") +
      `\n\nMini App: ${appUrl() || "ngrok ishga tushirilmagan"}`,
      { parse_mode: "HTML", link_preview_options: { is_disabled: true } },
    );
  });

  registerStart(bot);
  registerMenu(bot);

  bot.catch((err) => {
    log.error("Bot xatosi:", errMsg(err.error));
    void activity("bot_error", errMsg(err.error));
  });
}

export async function startBot() {
  setupBot();
  await bot.api.deleteWebhook({ drop_pending_updates: false }).catch(() => {});
  const me = await bot.api.getMe();
  log.info(`🤖 Bot ishga tushdi: @${me.username}`);
  await setupBotCommands();
  onPublicUrlChange(() => { void updateMenuButton(); });

  const startPolling = (attempt = 1) => {
    bot.start({
      allowed_updates: ["message", "callback_query", "my_chat_member", "chat_member"],
      onStart: () => log.info("📡 Telegram polling faol"),
    }).catch((e) => {
      const msg = errMsg(e);
      // 409: boshqa nusxa hali ishlayapti (qayta deploy paytida) — kutib qayta urinamiz
      const delay = /409/.test(msg) ? Math.min(60_000, 5_000 * attempt) : 15_000;
      log.warn(`bot.start (${attempt}-urinish): ${msg} — ${delay / 1000}s dan keyin qayta`);
      setTimeout(() => startPolling(attempt + 1), delay);
    });
  };
  startPolling();
  return me;
}
