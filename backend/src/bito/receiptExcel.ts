/**
 * Savdo chekini Excel (.xlsx) shaklida tayyorlash.
 * Bito'ning standart chek shabloni asosida:
 *   1-qator: Tashkilot nomi: … Savdo raqami: …
 *   2-qator: Sana: | <sana>
 *   3-qator: Mijoz: …
 *   4-qator: Telefon nomer mijoz: …
 *   6-qator: № | Tovar nomi | O'lchov birligi | Miqdori | Narxi | Jami summa
 *   7+:      mahsulotlar,  oxirida: Jami | miqdor | summa
 */
import ExcelJS from "exceljs";
import type { BitoTrade } from "./types.ts";
import { getSettings, lt, normalizeLang } from "../settings/store.ts";
import type { Lang } from "../settings/schema.ts";

const T: Record<string, Record<Lang, string>> = {
  orgLine: { uz: "Tashkilot nomi", ru: "Организация", en: "Organization" },
  numberLine: { uz: "Savdo raqami", ru: "Номер продажи", en: "Sale number" },
  date: { uz: "Sana", ru: "Дата", en: "Date" },
  customer: { uz: "Mijoz", ru: "Клиент", en: "Customer" },
  phone: { uz: "Telefon nomer mijoz", ru: "Телефон клиента", en: "Customer phone" },
  no: { uz: "№", ru: "№", en: "№" },
  product: { uz: "Tovar nomi", ru: "Наименование товара", en: "Product" },
  measure: { uz: "O'lchov birligi", ru: "Ед. изм.", en: "Unit" },
  qty: { uz: "Miqdori", ru: "Количество", en: "Qty" },
  price: { uz: "Narxi", ru: "Цена", en: "Price" },
  sum: { uz: "Jami summa", ru: "Сумма", en: "Total" },
  total: { uz: "Jami", ru: "Итого", en: "Total" },
  discount: { uz: "Chegirma", ru: "Скидка", en: "Discount" },
  debt: { uz: "Qarz", ru: "Долг", en: "Debt" },
  refund: { uz: "Qaytarish", ru: "Возврат", en: "Refund" },
  sheet: { uz: "Savdo cheki", ru: "Чек продажи", en: "Sales receipt" },
};
const t = (k: string, lang: Lang) => T[k]?.[lang] || k;

const THIN = { style: "thin" as const, color: { argb: "FF000000" } };
const BOX = { top: THIN, left: THIN, bottom: THIN, right: THIN };

export interface ReceiptMeta {
  customerName?: string | null;
  customerPhone?: string | null;
  organization?: string | null;
}

export async function buildTradeExcel(trade: BitoTrade, langRaw: string, meta: ReceiptMeta = {}): Promise<Buffer> {
  const lang = normalizeLang(langRaw);
  const s = getSettings();
  const decimals = Math.max(0, Math.min(3, Number(s.general.priceDecimals || 0)));
  const moneyFmt = decimals ? `#,##0.${"0".repeat(decimals)}` : "#,##0";

  const wb = new ExcelJS.Workbook();
  wb.created = new Date();
  const ws = wb.addWorksheet(t("sheet", lang));
  ws.properties.defaultRowHeight = 15.75;
  // Ustun kengliklari — Bito shabloni bilan bir xil
  ws.columns = [
    { key: "a", width: 7.71 },
    { key: "b", width: 23.71 },
    { key: "c", width: 19.57 },
    { key: "d", width: 11.57 },
    { key: "e", width: 21 },
    { key: "f", width: 33 },
  ];

  const org = meta.organization || trade.organization?.name || "";
  const number = String(trade.number || trade.uuid || "");
  const customer = trade.customer?.name || meta.customerName || "";
  const phone = trade.customer?.phone_number || meta.customerPhone || "";
  const dateStr = new Date(trade.sold_at || trade.date || trade.created_at || Date.now())
    .toLocaleString(lang === "ru" ? "ru-RU" : lang === "en" ? "en-US" : "uz-UZ");

  // --- 1-qator: tashkilot va savdo raqami ---
  ws.mergeCells("A1:F1");
  const head = ws.getCell("A1");
  head.value = `${t("orgLine", lang)}: ${org}    ${t("numberLine", lang)}: ${number}${trade.is_refund ? `  (${t("refund", lang)})` : ""}`;
  head.font = { bold: true, size: 12 };
  head.alignment = { vertical: "middle" };
  ws.getRow(1).height = 20;

  // --- 2-qator: sana ---
  ws.getCell("A2").value = `${t("date", lang)}:`;
  ws.getCell("A2").font = { bold: true };
  ws.getCell("B2").value = dateStr;

  // --- 3-4 qatorlar: mijoz va telefon ---
  ws.mergeCells("A3:F3");
  ws.getCell("A3").value = `${t("customer", lang)}: ${customer}`;
  ws.mergeCells("A4:F4");
  ws.getCell("A4").value = `${t("phone", lang)}: ${phone}`;

  // --- 6-qator: jadval sarlavhasi ---
  const HEAD_ROW = 6;
  const heads = [t("no", lang), t("product", lang), t("measure", lang), t("qty", lang), t("price", lang), t("sum", lang)];
  heads.forEach((h, i) => {
    const c = ws.getCell(HEAD_ROW, i + 1);
    c.value = h;
    c.font = { bold: true };
    c.alignment = { horizontal: i === 0 ? "center" : i >= 3 ? "center" : "left", vertical: "middle", wrapText: true };
    c.border = BOX;
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
  });
  ws.getRow(HEAD_ROW).height = 20;

  // --- Mahsulotlar ---
  let totalQty = 0;
  let totalSum = 0;
  const products = trade.products || [];
  products.forEach((p, i) => {
    const r = HEAD_ROW + 1 + i;
    const qty = Number(p.amount || 0);
    const price = Number(p.price || 0);
    const sum = Number(p.total_to_pay ?? p.total_price ?? price * qty);
    totalQty += qty;
    totalSum += sum;
    const cells: (string | number)[] = [i + 1, p.name || "", p.measure?.short_name || p.measure?.name || "", qty, price, sum];
    cells.forEach((v, ci) => {
      const c = ws.getCell(r, ci + 1);
      c.value = v;
      c.border = BOX;
      c.alignment = ci === 0 ? { horizontal: "center", vertical: "middle" }
        : ci === 1 || ci === 2 ? { horizontal: "left", vertical: "middle", wrapText: ci === 1 }
          : { horizontal: "right", vertical: "middle" };
      if (ci === 3) c.numFmt = "#,##0.###";
      if (ci >= 4) c.numFmt = moneyFmt;
    });
  });

  // --- Yakuniy qator: Jami | miqdor | summa ---
  const totalRow = HEAD_ROW + products.length + 1;
  for (let col = 1; col <= 6; col++) {
    const c = ws.getCell(totalRow, col);
    c.border = BOX;
    c.font = { bold: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
  }
  ws.getCell(totalRow, 2).value = t("total", lang);
  ws.getCell(totalRow, 2).alignment = { horizontal: "left", vertical: "middle" };
  ws.getCell(totalRow, 4).value = totalQty;
  ws.getCell(totalRow, 4).numFmt = "#,##0.###";
  ws.getCell(totalRow, 4).alignment = { horizontal: "right", vertical: "middle" };
  ws.getCell(totalRow, 6).value = Number(trade.total_to_pay ?? trade.total_price ?? totalSum);
  ws.getCell(totalRow, 6).numFmt = moneyFmt;
  ws.getCell(totalRow, 6).alignment = { horizontal: "right", vertical: "middle" };

  // --- Qo'shimcha: chegirma va qarz (bo'lsa) ---
  let extra = totalRow + 1;
  const addExtra = (label: string, value: number) => {
    ws.getCell(extra, 5).value = `${label}:`;
    ws.getCell(extra, 5).alignment = { horizontal: "right" };
    ws.getCell(extra, 6).value = value;
    ws.getCell(extra, 6).numFmt = moneyFmt;
    ws.getCell(extra, 6).alignment = { horizontal: "right" };
    extra++;
  };
  if (Number(trade.total_discount || 0) > 0) addExtra(t("discount", lang), Number(trade.total_discount));
  if (Number(trade.debt || 0) > 0 && !trade.is_refund) addExtra(t("debt", lang), Number(trade.debt));

  ws.pageSetup = { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/** Fayl nomi: chek-123-2026-09-27.xlsx */
export function receiptFileName(trade: BitoTrade): string {
  const num = String(trade.number || trade.uuid || trade._id).replace(/[^\w-]+/g, "");
  const d = new Date(trade.sold_at || trade.date || trade.created_at || Date.now()).toISOString().slice(0, 10);
  return `chek-${num}-${d}.xlsx`;
}
