/**
 * Savdo chekini Excel (.xlsx) shaklida tayyorlash.
 * Shablon: Tashkilot / Savdo raqami / Mijoz / Telefon + mahsulotlar jadvali + umumiy summa.
 * Hech qanday akkauntga bog'lanmagan — barcha ma'lumot savdoning o'zidan olinadi.
 */
import ExcelJS from "exceljs";
import type { BitoTrade } from "./types.ts";
import { getSettings, lt, normalizeLang } from "../settings/store.ts";
import type { Lang } from "../settings/schema.ts";

const T: Record<string, Record<Lang, string>> = {
  organization: { uz: "Tashkilot", ru: "Организация", en: "Organization" },
  number: { uz: "Savdo raqami", ru: "Номер продажи", en: "Sale number" },
  date: { uz: "Sana", ru: "Дата", en: "Date" },
  customer: { uz: "Mijoz", ru: "Клиент", en: "Customer" },
  phone: { uz: "Telefon raqami", ru: "Номер телефона", en: "Phone number" },
  seller: { uz: "Sotuvchi", ru: "Продавец", en: "Seller" },
  no: { uz: "№", ru: "№", en: "#" },
  product: { uz: "Mahsulot nomi", ru: "Наименование товара", en: "Product" },
  measure: { uz: "O'lchov birligi", ru: "Ед. изм.", en: "Unit" },
  qty: { uz: "Miqdori", ru: "Количество", en: "Qty" },
  price: { uz: "Narxi", ru: "Цена", en: "Price" },
  sum: { uz: "Jami summa", ru: "Сумма", en: "Total" },
  total: { uz: "Umumiy summa", ru: "Итого", en: "Grand total" },
  discount: { uz: "Chegirma", ru: "Скидка", en: "Discount" },
  debt: { uz: "Qarz", ru: "Долг", en: "Debt" },
  refund: { uz: "QAYTARISH", ru: "ВОЗВРАТ", en: "REFUND" },
  receipt: { uz: "Savdo cheki", ru: "Чек продажи", en: "Sales receipt" },
};
const t = (k: string, lang: Lang) => T[k]?.[lang] || k;

const BORDER = { style: "thin" as const, color: { argb: "FFD0D7E2" } };
const allBorders = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };

export interface ReceiptMeta {
  /** Mijoz nomi/telefoni — Bito bermasa, bizdagi foydalanuvchidan */
  customerName?: string | null;
  customerPhone?: string | null;
  organization?: string | null;
}

export async function buildTradeExcel(trade: BitoTrade, langRaw: string, meta: ReceiptMeta = {}): Promise<Buffer> {
  const lang = normalizeLang(langRaw);
  const s = getSettings();
  const suffix = lt(s.general.currencySuffix, lang);
  const decimals = Math.max(0, Math.min(3, Number(s.general.priceDecimals || 0)));
  const moneyFmt = decimals ? `#,##0.${"0".repeat(decimals)}` : "#,##0";

  const wb = new ExcelJS.Workbook();
  wb.creator = lt(s.general.shopName, lang) || "Shop";
  wb.created = new Date();
  const ws = wb.addWorksheet(t("receipt", lang), { pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1 } });
  ws.columns = [
    { width: 6 },   // №
    { width: 44 },  // nomi
    { width: 14 },  // o'lchov
    { width: 12 },  // miqdor
    { width: 16 },  // narx
    { width: 18 },  // jami
  ];

  // --- Sarlavha ---
  ws.mergeCells("A1:F1");
  const title = ws.getCell("A1");
  title.value = `${lt(s.general.shopName, lang)} — ${trade.is_refund ? t("refund", lang) : t("receipt", lang)}`;
  title.font = { size: 14, bold: true };
  title.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 24;

  // --- Ma'lumotlar bloki ---
  const org = meta.organization || trade.organization?.name || "";
  const seller = trade.responsible?.full_name || trade.created_by?.full_name || "";
  const dateStr = new Date(trade.sold_at || trade.date || trade.created_at || Date.now()).toLocaleString(lang === "ru" ? "ru-RU" : lang === "en" ? "en-US" : "uz-UZ");
  const info: [string, string][] = ([
    [t("organization", lang), org],
    [t("number", lang), `№${trade.number || trade.uuid || ""}`],
    [t("date", lang), dateStr],
    [t("customer", lang), trade.customer?.name || meta.customerName || ""],
    [t("phone", lang), trade.customer?.phone_number || meta.customerPhone || ""],
    [t("seller", lang), seller],
  ] as [string, string][]).filter(([, v]) => v !== "");

  let row = 3;
  for (const [k, v] of info) {
    ws.getCell(`A${row}`).value = `${k}:`;
    ws.getCell(`A${row}`).font = { bold: true };
    ws.mergeCells(`B${row}:F${row}`);
    ws.getCell(`B${row}`).value = v;
    row++;
  }

  // --- Jadval sarlavhasi ---
  row += 1;
  const headRow = row;
  const heads = [t("no", lang), t("product", lang), t("measure", lang), t("qty", lang), `${t("price", lang)}, ${suffix}`, `${t("sum", lang)}, ${suffix}`];
  heads.forEach((h, i) => {
    const c = ws.getCell(headRow, i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = allBorders;
  });
  ws.getRow(headRow).height = 22;

  // --- Mahsulotlar ---
  let total = 0;
  let totalQty = 0;
  (trade.products || []).forEach((p, i) => {
    const r = headRow + 1 + i;
    const qty = Number(p.amount || 0);
    const price = Number(p.price || 0);
    const sum = Number(p.total_to_pay ?? p.total_price ?? price * qty);
    total += sum;
    totalQty += qty;
    const cells: (string | number)[] = [i + 1, p.name || "", p.measure?.short_name || p.measure?.name || "", qty, price, sum];
    cells.forEach((v, ci) => {
      const c = ws.getCell(r, ci + 1);
      c.value = v;
      c.border = allBorders;
      c.alignment = { vertical: "middle", horizontal: ci === 1 ? "left" : "center", wrapText: ci === 1 };
      if (ci >= 3) c.numFmt = ci === 3 ? "#,##0.###" : moneyFmt;
      if (ci >= 4) c.alignment = { vertical: "middle", horizontal: "right" };
    });
  });

  const lastRow = headRow + (trade.products?.length || 0);
  // --- Yakuniy qatorlar ---
  let sumRow = lastRow + 1;
  const addSummary = (label: string, value: number, bold = false) => {
    ws.mergeCells(`A${sumRow}:E${sumRow}`);
    const l = ws.getCell(`A${sumRow}`);
    l.value = label;
    l.alignment = { horizontal: "right", vertical: "middle" };
    l.font = { bold };
    const v = ws.getCell(`F${sumRow}`);
    v.value = value;
    v.numFmt = moneyFmt;
    v.font = { bold };
    v.alignment = { horizontal: "right", vertical: "middle" };
    l.border = allBorders;
    v.border = allBorders;
    if (bold) {
      l.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF4FF" } };
      v.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF4FF" } };
    }
    sumRow++;
  };
  if (trade.total_discount) addSummary(`${t("discount", lang)}, ${suffix}:`, Number(trade.total_discount));
  addSummary(`${t("total", lang)}, ${suffix}:`, Number(trade.total_to_pay ?? trade.total_price ?? total), true);
  if (Number(trade.debt || 0) > 0 && !trade.is_refund) addSummary(`${t("debt", lang)}, ${suffix}:`, Number(trade.debt));

  // Miqdor yig'indisi izoh sifatida
  ws.getCell(`A${sumRow + 1}`).value = `${t("qty", lang)}: ${totalQty}`;
  ws.getCell(`A${sumRow + 1}`).font = { size: 9, color: { argb: "FF64748B" } };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/** Fayl nomi: chek-№123-2026-09-27.xlsx */
export function receiptFileName(trade: BitoTrade): string {
  const num = String(trade.number || trade.uuid || trade._id).replace(/[^\w-]+/g, "");
  const d = new Date(trade.sold_at || trade.date || trade.created_at || Date.now()).toISOString().slice(0, 10);
  return `chek-${num}-${d}.xlsx`;
}
