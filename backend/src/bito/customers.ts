import type { User } from "@prisma/client";
import { prisma } from "../db.ts";
import { bito } from "./client.ts";
import { getSettings } from "../settings/store.ts";
import { activity, errMsg, log } from "../logger.ts";
import { normalizePhone } from "../utils/format.ts";
import type { BitoCustomer } from "./types.ts";

async function targetOrganizationIds(): Promise<string[]> {
  const b = getSettings().bito;
  if (b.customerOrganizations === "selected" && b.organizationId) return [b.organizationId];
  try {
    const orgs = await bito.organizations();
    const ids = orgs.filter((o) => o.is_active !== false).map((o) => o._id);
    return ids.length ? ids : b.organizationId ? [b.organizationId] : [];
  } catch {
    return b.organizationId ? [b.organizationId] : [];
  }
}

/** Bito mijozini Telegram foydalanuvchisi bilan bog'lash (telegram_id yozish) */
async function linkTelegram(customer: BitoCustomer, user: User): Promise<void> {
  const tg = Number(user.telegramId);
  if (customer.telegram_id && String(customer.telegram_id) === String(tg)) return;
  try {
    await bito.customerUpdate({
      _id: customer._id,
      name: customer.name,
      organization_ids: customer.organization_ids || [],
      telegram_id: tg,
      telegram_link: user.tgUsername ? `https://t.me/${user.tgUsername}` : customer.telegram_link || "",
    });
  } catch (e) {
    log.warn("Bito mijozga telegram_id yozilmadi:", errMsg(e));
  }
}

export interface LinkResult {
  customer: BitoCustomer;
  isNew: boolean;
}

/** Telefon raqam bo'yicha Bito mijozini topish yoki yaratish va foydalanuvchiga bog'lash */
export async function linkOrCreateCustomer(user: User, opts: { phone: string; name?: string }): Promise<LinkResult> {
  const phone = normalizePhone(opts.phone);
  const existing = await bito.customerByPhone(phone);
  if (existing) {
    await linkTelegram(existing, user);
    await prisma.user.update({ where: { id: user.id }, data: { bitoCustomerId: existing._id, phone, name: user.name || existing.name } });
    await activity("customer_linked", `Bito mijozi bog'landi: ${existing.name} (${phone})`);
    return { customer: existing, isNew: false };
  }
  const name = (opts.name || user.name || user.tgFirstName || phone).trim();
  const created = await bito.customerCreate({
    name,
    type: "natural",
    phone_number: phone,
    organization_ids: await targetOrganizationIds(),
    telegram_id: Number(user.telegramId),
    telegram_link: user.tgUsername ? `https://t.me/${user.tgUsername}` : "",
    state: "new",
  });
  await prisma.user.update({ where: { id: user.id }, data: { bitoCustomerId: created._id, phone, name } });
  await activity("customer_created", `Bito'da yangi mijoz yaratildi: ${name} (${phone})`);
  return { customer: created, isNew: true };
}

/** Buyurtma uchun mijoz ID'sini kafolatlash */
export async function ensureCustomer(user: User, opts: { phone: string; name?: string }): Promise<string> {
  if (user.bitoCustomerId) {
    if (opts.name && opts.name.trim() && opts.name.trim() !== user.name) {
      // Ism o'zgargan bo'lsa Bito'da ham yangilaymiz
      try {
        const c = await bito.customerById(user.bitoCustomerId);
        await bito.customerUpdate({ _id: c._id, name: opts.name.trim(), organization_ids: c.organization_ids || [] });
      } catch (e) { log.warn("Mijoz ismi yangilanmadi:", errMsg(e)); }
    }
    return user.bitoCustomerId;
  }
  const r = await linkOrCreateCustomer(user, opts);
  return r.customer._id;
}

/** Bito'dagi mijoz ma'lumotlari (balans, karta) */
export async function fetchCustomer(user: User): Promise<BitoCustomer | null> {
  if (!user.bitoCustomerId) return null;
  try {
    return await bito.customerById(user.bitoCustomerId);
  } catch (e) {
    log.warn("customerById", errMsg(e));
    return null;
  }
}

export interface BalanceLine { organization: string; amount: number; currency: string }

/** Mijozning tashkilotlar bo'yicha balansi (manfiy = qarzdor, musbat = haqdor) */
export async function fetchBalances(user: User, onlyStore = true): Promise<BalanceLine[]> {
  if (!user.bitoCustomerId) return [];
  const s = getSettings().bito;
  const out: BalanceLine[] = [];
  const { isMultiStore, userStore } = await import("./stores.ts");
  const orgFilter = onlyStore && isMultiStore() ? userStore(user).organizationId : "";
  try {
    const r = await bito.balance(user.bitoCustomerId, s.currencyId);
    for (const row of r.data || []) {
      if (orgFilter && row.organization?._id !== orgFilter) continue;
      for (const bal of row.balances || []) {
        out.push({ organization: row.organization?.name || "", amount: Number(bal.amount || 0), currency: bal.currency?.symbol || bal.currency?.name || "" });
      }
    }
  } catch (e) {
    log.warn("balance", errMsg(e));
    const c = await fetchCustomer(user);
    if (c && typeof c.balance === "number") out.push({ organization: "", amount: c.balance, currency: "" });
  }
  return out;
}

/** Mijozning yetkazib berish manzilini Bito'da yangilash */
export async function updateCustomerAddress(customerId: string, lat: number, lng: number, address: string): Promise<void> {
  try {
    const c = await bito.customerById(customerId);
    await bito.customerUpdate({
      _id: c._id,
      name: c.name,
      organization_ids: c.organization_ids || [],
      address: address || c.address || "",
      delivery_address: { lat, long: lng, human_address: { address: address || "" } },
    });
  } catch (e) {
    log.warn("Mijoz manzili yangilanmadi:", errMsg(e));
  }
}
