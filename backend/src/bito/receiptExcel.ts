/**
 * Savdo chekini Excel (.xlsx) shaklida tayyorlash.
 * Bitta toza varaq: yuqorida ma'lumotlar, ostida bitta jadval, eng pastda yakun.
 * Birlashtirilgan kataklar ishlatilmaydi — fayl har qanday dasturda bir xil ochiladi.
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
  totalQty: { uz: "Jami miqdor", ru: "Всего количество", en: "Total qty" },
  refund: { uz: "QAYTARISH", ru: "ВОЗВРАТ", en: "REFUND" },
  receipt: { uz: "Savdo cheki", ru: "Чек продажи", en: "Sales receipt" },
};
const t = (k: string, lang: Lang) => T[k]?.[lang] || k;

const THIN = { style: "thin" as const, color: { argb: "FFD0D7E2" } };
const BOX = { top: THIN, left: THIN, bottom: THIN, right: THIN };

export interface ReceiptMeta {
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
  const ws = wb.addWorksheet(t("receipt", lang));
  ws.properties.defaultRowHeight = 18;
  ws.columns = [
    { key: "a", width: 6 },
    { key: "b", width: 42 },
    { key: "c", width: 14 },
    { key: "d", width: 12 },
    { key: "e", width: 16 },
    { key: "f", width: 18 },
  ];

  // --- 1-qator: do'kon nomi ---
  const title = ws.getCell("A1");
  title.value = `${lt(s.general.shopName, lang)} — ${trade.is_refund ? t("refund", lang) : t("receipt", lang)}`;
  title.font = { size: 14, bold: true };

  // --- Ma'lumotlar: A ustunda nomi, B ustunda qiymati ---
  const org = meta.organization || trade.organization?.name || "";
  const seller = trade.responsible?.full_name || trade.created_by?.full_name || "";
  const dateStr = new Date(trade.sold_at || trade.date || trade.created_at || Date.now())
    .toLocaleString(lang === "ru" ? "ru-RU" : lang === "en" ? "en-US" : "uz-UZ");
  const info: [string, string][] = ([
    [t("organization", lang), org],
    [t("number", lang), `№${trade.number || trade.uuid || ""}`],
    [t("date", lang), dateStr],
    [t("customer", lang), trade.customer?.name || meta.customerName || ""],
    [t("phone", lang), trade.customer?.phone_number || meta.customerPhone || ""],
    [t("seller", lang), seller],
  ] as [string, string][]).filter(([, v]) => v !== "" && v !== "№");

  let row = 3;
  for (const [k, v] of info) {
    ws.getCell(`A${row}`).value = `${k}:`;
    ws.getCell(`A${row}`).font = { bold: true };
    ws.getCell(`A${row}`).alignment = { horizontal: "left" };
    ws.getCell(`B${row}`).value = v;
    row++;
  }

  // --- Jadval sarlavhasi ---
  const headRow = row + 1;
  const heads = [t("no", lang), t("product", lang), t("measure", lang), t("qty", lang), `${t("price", lang)}, ${suffix}`, `${t("sum", lang)}, ${suffix}`];
  heads.forEach((h, i) => {
    const c = ws.getCell(headRow, i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = BOX;
  });
  ws.getRow(headRow).height = 24;

  // --- Mahsulotlar ---
  let total = 0;
  let totalQty = 0;
  const products = trade.products || [];
  products.forEach((p, i) => {
    const r = headRow + 1 + i;
    const qty = Number(p.amount || 0);
    const price = Number(p.price || 0);
    const sum = Number(p.total_to_pay ?? p.total_price ?? price * qty);
    total += sum;
    totalQty += qty;
    const values: (string | number)[] = [i + 1, p.name || "", p.measure?.short_name || p.measure?.name || "", qty, price, sum];
    values.forEach((v, ci) => {
      const c = ws.getCell(r, ci + 1);
      c.value = v;
      c.border = BOX;
      c.alignment = ci === 1 ? { vertical: "middle", horizontal: "left", wrapText: true }
        : ci >= 4 ? { vertical: "middle", horizontal: "right" }
          : { vertical: "middle", horizontal: "center" };
      if (ci === 3) c.numFmt = "#,##0.###";
      if (ci >= 4) c.numFmt = moneyFmt;
    });
  });
  const lastItemRow = headRow + products.length;

  // --- Yakuniy qatorlar: nomi E ustunda, qiymati F ustunda (birlashtirishsiz) ---
  let sumRow = lastItemRow + 1;
  const addTotal = (label: string, value: number, bold = false, fmt = moneyFmt) => {
    const l = ws.getCell(`E${sumRow}`);
    l.value = label;
    l.font = { bold };
    l.alignment = { horizontal: "right", vertical: "middle" };
    l.border = BOX;
    const v = ws.getCell(`F${sumRow}`);
    v.value = value;
    v.numFmt = fmt;
    v.font = { bold };
    v.alignment = { horizontal: "right", vertical: "middle" };
    v.border = BOX;
    if (bold) {
      const fill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFEFF4FF" } };
      l.fill = fill;
      v.fill = fill;
    }
    sumRow++;
  };
  addTotal(`${t("totalQty", lang)}:`, totalQty, false, "#,##0.###");
  if (trade.total_discount) addTotal(`${t("discount", lang)}:`, Number(trade.total_discount));
  addTotal(`${t("total", lang)}, ${suffix}:`, Number(trade.total_to_pay ?? trade.total_price ?? total), true);
  if (Number(trade.debt || 0) > 0 && !trade.is_refund) addTotal(`${t("debt", lang)}:`, Number(trade.debt));

  // Chop etish uchun: bitta sahifa eniga sig'sin
  ws.pageSetup = { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } };
  ws.views = [{ state: "frozen", ySplit: headRow }];

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/** Fayl nomi: chek-123-2026-09-27.xlsx */
export function receiptFileName(trade: BitoTrade): string {
  const num = String(trade.number || trade.uuid || trade._id).replace(/[^\w-]+/g, "");
  const d = new Date(trade.sold_at || trade.date || trade.created_at || Date.now()).toISOString().slice(0, 10);
  return `chek-${num}-${d}.xlsx`;
}
