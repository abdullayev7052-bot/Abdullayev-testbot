/**
 * To'lov havolasini yasash (Payme chekini GET usulida yuborish).
 * Formati: <checkout_url>/base64("m=<kassa>;ac.<maydon>=<buyurtma>;a=<tiyin>;l=uz;c=<qaytish>")
 * Telefonda Payme ilovasi bo'lsa, havola to'g'ridan-to'g'ri ilovada ochiladi.
 */
import type { Order } from "@prisma/client";
import { getSettings } from "../settings/store.ts";
import { getPublicUrl } from "../utils/publicUrl.ts";

export interface PayLink { url: string; provider: "payme"; amount: number; mode: "test" | "live" }

/** To'lov yoqilganmi va sozlamalari to'liqmi */
export function paymeReady(): { ok: boolean; reason?: string } {
  const p = getSettings().payments;
  if (!p.paymeEnabled) return { ok: false, reason: "Payme o'chirilgan" };
  if (!p.paymeMerchantId) return { ok: false, reason: "Kassa ID (Merchant ID) kiritilmagan" };
  const key = p.paymeMode === "live" ? p.paymeKey : p.paymeTestKey || p.paymeKey;
  if (!key) return { ok: false, reason: "Payme kaliti kiritilmagan" };
  return { ok: true };
}

/** Buyurtma uchun to'lov havolasi */
export function paymeLink(order: Pick<Order, "id" | "total">, lang = "uz"): PayLink {
  const p = getSettings().payments;
  const mode = p.paymeMode === "live" ? "live" : "test";
  const base = (mode === "live" ? p.paymeCheckoutUrl || "https://checkout.paycom.uz" : p.paymeTestCheckoutUrl || "https://test.paycom.uz").replace(/\/+$/, "");
  const amount = Math.round(Number(order.total || 0) * 100);
  const field = (p.paymeAccountField || "order_id").trim();

  const parts = [
    `m=${p.paymeMerchantId}`,
    `ac.${field}=${order.id}`,
    `a=${amount}`,
    `l=${["uz", "ru", "en"].includes(lang) ? lang : "uz"}`,
  ];
  const back = (p.paymeReturnUrl || "").trim() || `${(getPublicUrl() || "").replace(/\/+$/, "")}/app/?go=order:${order.id}`;
  if (back && /^https?:\/\//.test(back)) {
    parts.push(`c=${back}`);
    if (p.paymeCallbackTimeout) parts.push(`ct=${p.paymeCallbackTimeout}`);
  }

  const payload = Buffer.from(parts.join(";"), "utf8").toString("base64");
  return { url: `${base}/${payload}`, provider: "payme", amount, mode };
}
