/**
 * Bito ichidan tanlangan mijozlarga bizning botdan xabar yuborish.
 *
 * Bito "Sms yuborish → Servise: Bot" tugmasi o'z boti orqali yuboradi va bizga
 * hech qanday so'rov yubormaydi. Shuning uchun boshqa, Bito ichidagi harakatdan
 * foydalanamiz: operator mijozlarni tanlab, ularni maxsus **mijoz kategoriyasiga**
 * biriktiradi. Bito bizga `customers.update` webhookini yuboradi, biz esa xabar
 * matnini Bito SMS shablonidan olib, mijozning Telegramiga o'z botimizdan yuboramiz
 * va kategoriyani avvalgi holiga qaytaramiz.
 */
import { prisma } from "../db.ts";
import { bito } from "./client.ts";
import { getSettings } from "../settings/store.ts";
import { sendToUser } from "../bot/send.ts";
import { activity, errMsg, log } from "../logger.ts";
import { esc } from "../utils/format.ts";

/** Kategoriya nomi → id (qisqa vaqt xotirada saqlanadi) */
let catCache: { at: number; id: string | null; name: string } = { at: 0, id: null, name: "" };

/** Sozlamadagi nom bo'yicha "xabar" kategoriyasini topish (bo'lmasa — yaratish) */
async function broadcastCategoryId(): Promise<string | null> {
  const s = getSettings().bito;
  const name = (s.msgCategory || "").trim();
  if (!name) return null;
  if (catCache.name === name && catCache.id && Date.now() - catCache.at < 5 * 60_000) return catCache.id;
  try {
    const list = await bito.customerCategories();
    let row = list.find((c) => (c.name || "").trim().toLowerCase() === name.toLowerCase());
    if (!row && s.msgCreateCategory !== false) {
      row = await bito.customerCategoryCreate(name);
      await activity("bito_msg", `Bito'da «${name}» mijoz kategoriyasi yaratildi`);
    }
    catCache = { at: Date.now(), id: row?._id || null, name };
    return catCache.id;
  } catch (e) {
    log.warn("Xabar kategoriyasi topilmadi:", errMsg(e));
    return null;
  }
}

/** Yuboriladigan matn: Bito'dagi eng oxirgi SMS shabloni */
async function messageText(): Promise<string | null> {
  try {
    const list = await bito.smsTemplates(10);
    const first = list[0];
    const text = (first?.content || "").trim();
    return text || null;
  } catch (e) {
    log.warn("SMS shabloni o'qilmadi:", errMsg(e));
    return null;
  }
}

/** Takroriy yuborishning oldini olish */
async function once(key: string): Promise<boolean> {
  try {
    await prisma.sentEvent.create({ data: { key } });
    return true;
  } catch {
    return false;
  }
}

/**
 * `customers.create|update` webhooki kelganda chaqiriladi.
 * Mijoz xabar kategoriyasiga biriktirilgan bo'lsa — botdan xabar yuboriladi.
 */
export async function onCustomerChanged(customerId: string): Promise<void> {
  const s = getSettings().bito;
  if (!s.msgEnabled) return;

  const customer = await bito.customerById(customerId).catch(() => null);
  if (!customer) return;

  const catId = await broadcastCategoryId();
  const current = (customer as { category_id?: string | null }).category_id || null;

  // Oddiy o'zgarish: mijozning haqiqiy kategoriyasini eslab qolamiz (keyin qaytarish uchun)
  if (!catId || current !== catId) {
    await prisma.user.updateMany({ where: { bitoCustomerId: customerId }, data: { bitoCategoryId: current } }).catch(() => {});
    return;
  }

  // Xabar kategoriyasiga biriktirildi — demak operator xabar yubormoqchi
  const user = await prisma.user.findUnique({ where: { bitoCustomerId: customerId } });
  const text = await messageText();
  const tgId = user?.telegramId ?? (customer.telegram_id ? BigInt(customer.telegram_id) : null);

  if (text && tgId && user && !user.isBlocked && user.step === "done") {
    const stamp = (customer as { updated_at?: string }).updated_at || "";
    const key = `bito_msg:${customerId}:${stamp}`;
    if (await once(key)) {
      const sent = await sendToUser(tgId, esc(text));
      await activity(
        "bito_msg",
        sent
          ? `Botdan xabar yuborildi: ${customer.name || customerId}`
          : `Xabar yuborilmadi (mijoz botni bloklagan yoki chat yo'q): ${customer.name || customerId}`,
        { customerId, text: text.slice(0, 500) },
      );
    }
  } else if (!text) {
    await activity("bito_msg_error", "Xabar yuborilmadi: Bito'da SMS shabloni yo'q (Integratsiyalar → Sms shablonlari)");
  } else if (!tgId || !user) {
    await activity("bito_msg_error", `Xabar yuborilmadi: «${customer.name || customerId}» botdan ro'yxatdan o'tmagan`);
  }

  // Kategoriyani avvalgi holiga qaytaramiz — mijoz kartochkasi toza qoladi
  if (s.msgRestore !== false) {
    const back = user?.bitoCategoryId ?? null;
    // Bito `name` va `organization_ids` ni majburiy talab qiladi — mijozning o'z qiymatlarini qaytaramiz
    const c = customer as unknown as { name: string; organization_ids?: string[]; phone_number?: string };
    await bito.customerUpdate({
      _id: customerId,
      name: c.name,
      organization_ids: c.organization_ids || [],
      phone_number: c.phone_number,
      category_id: back,
    }).catch((e) => log.warn("Kategoriya qaytarilmadi:", errMsg(e)));
  }
}
