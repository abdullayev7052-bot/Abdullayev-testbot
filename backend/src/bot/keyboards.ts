import { InlineKeyboard, Keyboard } from "grammy";
import type { Order } from "@prisma/client";
import { getSettings, lt } from "../settings/store.ts";
import type { Lang } from "../settings/schema.ts";
import { getPublicUrl } from "../utils/publicUrl.ts";
import { bito } from "../bito/client.ts";
import { nextStages, type Stage } from "../bito/orders.ts";

export function appUrl(): string | null {
  const u = getPublicUrl();
  if (!u || !u.startsWith("https://")) return null;
  return `${u}/app/`;
}

export function contactKeyboard(lang: Lang): Keyboard {
  const b = getSettings().bot;
  return new Keyboard().requestContact(lt(b.phoneButton, lang)).resized().oneTime();
}

export function mainKeyboard(lang: Lang): Keyboard {
  const b = getSettings().bot;
  const kb = new Keyboard();
  // Pastki klaviaturadagi web_app tugmasi initData bermaydi — matnli tugma, bosilganda inline tugma yuboriladi
  kb.text(lt(b.openAppButton, lang)).row();
  kb.text(lt(b.mOrders, lang)).text(lt(b.mPurchases, lang)).row();
  kb.text(lt(b.mMyInfo, lang)).text(lt(b.mSettings, lang)).row();
  kb.text(lt(b.mBalance, lang)).text(lt(b.mCard, lang)).row();
  kb.text(lt(b.mAkt, lang));
  return kb.resized().persistent();
}

export function openAppInline(lang: Lang): InlineKeyboard | undefined {
  const url = appUrl();
  if (!url) return undefined;
  return new InlineKeyboard().webApp(lt(getSettings().bot.openAppButton, lang), url);
}

export function languageKeyboard(): InlineKeyboard {
  const s = getSettings().general;
  const enabled = (s.enabledLanguages?.length ? s.enabledLanguages : ["uz", "ru", "en"]) as Lang[];
  const names: Record<Lang, string> = { uz: "🇺🇿 O'zbek", ru: "🇷🇺 Русский", en: "🇬🇧 English" };
  const kb = new InlineKeyboard();
  for (const l of enabled) kb.text(names[l], `lang:${l}`);
  return kb;
}

/** Guruhdagi buyurtma xabari tugmalari */
export function groupOrderKeyboard(order: Order): InlineKeyboard | undefined {
  const s = getSettings();
  const st = s.statuses;
  const b = s.bot;
  const on = (k: string) => b[k] !== false;
  if (!b.gButtonsEnabled) return undefined;
  const kb = new InlineKeyboard();
  let any = false;
  if (on("gBtnBito") && order.bitoId) { kb.url(st.btnBito, bito.webOrderUrl(order.bitoId)); any = true; }
  if (on("gBtnLocation") && order.type === "delivery" && order.lat && order.lng) {
    kb.url(st.btnLocation, `https://maps.google.com/?q=${order.lat},${order.lng}`);
    kb.url("🗺 Yandex", `https://yandex.uz/maps/?pt=${order.lng},${order.lat}&z=16&l=map`);
    any = true;
  }
  if (any) kb.row();
  const stage = (order.stateKey || "new") as Stage;
  const labels: Record<Stage, string> = {
    new: "", accepted: st.btnAccept, ready: st.btnReady, delivering: st.btnDispatch,
    done: order.type === "pickup" ? st.btnPickedUp : st.btnDelivered, canceled: st.btnCancel, other: "",
  };
  const allowed: Record<Stage, boolean> = { new: true, accepted: on("gBtnAccept"), ready: on("gBtnReady"), delivering: on("gBtnDispatch"), done: on("gBtnDone"), canceled: on("gBtnCancel"), other: true };
  const next = nextStages(stage, order.type).filter((x) => allowed[x]);
  const main = next.filter((x) => x !== "canceled");
  for (const n of main) { kb.text(labels[n], `st:${order.id}:${n}`); any = true; }
  if (main.length) kb.row();
  if (next.includes("canceled")) { kb.text(st.btnCancel, `st:${order.id}:canceled`); any = true; }
  return any ? kb : undefined;
}
