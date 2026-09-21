import { prisma } from "../db.ts";
import { env } from "../env.ts";
import { buildDefaults, settingsSchema, type Lang, type LText } from "./schema.ts";
import { log } from "../logger.ts";

export interface AppSettings {
  general: {
    shopName: LText; supportPhone: string; supportTelegram: string; defaultLanguage: Lang;
    enabledLanguages: Lang[]; currencySuffix: LText; priceDecimals: number; adminPassword: string; languageMode: "default" | "telegram"; botToken: string;
  };
  adminPanel: Record<string, unknown>;
  bito: {
    apiKey: string; apiUrl: string; filesUrl: string; webBaseUrl: string;
    organizationId: string; warehouseId: string; priceId: string; currencyId: string; responsibleId: string;
    stockSource: "warehouse" | "organization"; customerOrganizations: "all" | "selected";
    syncIntervalSec: number; pollIntervalSec: number; webhookEnabled: boolean; onlyAvailableForSale: boolean;
    priceExceptionsEnabled: boolean; priceExceptions: { priceId: string; customerIds: string[]; customerNames?: string[]; priceName?: string }[];
    multiStore: boolean; mainStoreName: LText; stores: StoreDef[]; storeChooseLabel: LText; storeButton: LText; storeChanged: LText;
  };
  statuses: {
    newStateId: string; acceptedStateId: string; readyStateId: string; deliveringStateId: string; doneStateId: string; canceledStateId: string;
    btnAccept: string; btnReady: string; btnDispatch: string; btnDelivered: string; btnPickedUp: string; btnCancel: string; btnBito: string; btnLocation: string;
    nameNew: LText; nameAccepted: LText; nameReady: LText; nameDelivering: LText; nameDone: LText; nameCanceled: LText;
    msgAccepted: LText; msgReady: LText; msgDelivering: LText; msgDone: LText; msgCanceled: LText; msgOther: LText;
  };
  bot: {
    welcome: LText; askPhone: LText; phoneButton: LText; wrongContact: LText; askName: LText; registered: LText; welcomeBack: LText;
    openAppButton: LText; menuButtonText: LText;
    mOrders: LText; mPurchases: LText; mMyInfo: LText; mSettings: LText; mBalance: LText; mCard: LText; mAkt: LText;
    orderReceived: LText; orderReceivedPickup: LText; noOrders: LText; ordersTitle: LText; noPurchases: LText; purchasesTitle: LText;
    myInfo: LText; balanceTitle: LText; balanceDebt: LText; balanceCredit: LText; balanceZero: LText; cardCaption: LText; noCard: LText;
    aktCaption: LText; aktPreparing: LText; aktMonths: number; chooseLanguage: LText; languageChanged: LText; notLinked: LText; errorGeneric: LText;
    notifyTrades: boolean; notifyPayments: boolean; notifyPaymentsWithTrade: boolean;
    receiptTitle: LText; lTime: LText; lTrade: LText; lCustomer: LText; lSeller: LText; lProducts: LText; lTotalQty: LText; lTotal: LText;
    lPayment: LText; lDebt: LText; lBefore: LText; lAfter: LText; lRefund: LText; paymentTitle: LText; lAmount: LText; lReceivedBy: LText; lOrganization: LText; lDueDate: LText;
    waitlistAdded: LText; waitlistArrived: LText; waitlistNotifyBot: boolean;
    staffMode: "group" | "list"; groupNotAllowed: string; groupTitleNew: string; gTime: string; gCustomer: string; gPhone: string; gType: string;
    gDelivery: string; gPickup: string; gNumber: string; gStatus: string; gAddress: string; gComment: string; gProducts: string; gHistory: string; showTotalInGroup: boolean;
    gProductsChanged: string; gTraded: string; gButtonsEnabled: boolean;
    [key: string]: unknown;
  };
  design: Record<string, unknown>;
  catalog: {
    stockDisplay: "exact" | "range" | "available" | "hidden"; rangeSteps: string; inStockLabel: LText; outOfStockLabel: LText;
    showOutOfStock: boolean; outOfStockLast: boolean; allowOrderOutOfStock: boolean; checkStockOnCheckout: boolean;
    notifyEnabled: boolean; notifyLabel: LText; notifiedLabel: LText;
    sortMode: string; columns: number; showCategoryImages: boolean; showSku: boolean; hideZeroPrice: boolean; quickAddEnabled: boolean;
    allCategoriesLabel: LText; catalogTitle: LText; descriptionTitle: LText; noDescription: LText; emptyCatalog: LText;
    searchPlaceholder: LText; searchMinChars: number; searchFuzzy: boolean;
    allowManualQty: boolean; maxQtyPerItem: number; boxModeEnabled: boolean; boxLabel: LText; pieceLabel: LText; boxHint: LText; addToCart: LText; inCartLabel: LText;
  };
  checkout: {
    deliveryEnabled: boolean; pickupEnabled: boolean; defaultType: "delivery" | "pickup"; deliveryLabel: LText; pickupLabel: LText;
    deliveryHint: LText; pickupHint: LText; pickupAddress: LText; deliveryFee: number; freeDeliveryFrom: number; minOrderTotal: number;
    requireLocation: boolean; mapLat: number; mapLng: number; mapZoom: number; commentEnabled: boolean;
    [key: string]: unknown;
  };
  profile: Record<string, unknown>;
}

export interface StoreDef {
  id: string; name: LText; organizationId: string; warehouseId: string; priceId: string; currencyId: string; responsibleId: string;
  stockSource: "warehouse" | "organization"; pickupAddress?: LText; pickupLocation?: { lat: number; lng: number }; enabled?: boolean;
}

const defaults = buildDefaults();
let cache: AppSettings | null = null;

function deepMerge(base: Record<string, unknown>, over: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined || v === null) continue;
    const b = base[k];
    if (b && typeof b === "object" && !Array.isArray(b) && typeof v === "object" && !Array.isArray(v)) {
      out[k] = deepMerge(b as Record<string, unknown>, v as Record<string, unknown>);
    } else out[k] = v;
  }
  return out;
}

/** Bazadan barcha sozlamalarni o'qib, standart qiymatlar bilan birlashtiradi */
export async function loadSettings(): Promise<AppSettings> {
  const rows = await prisma.setting.findMany();
  const merged: Record<string, Record<string, unknown>> = {};
  for (const section of settingsSchema) {
    const row = rows.find((r) => r.key === section.key);
    merged[section.key] = deepMerge(defaults[section.key], (row?.value as Record<string, unknown>) || {});
  }
  // .env dagi boshlang'ich Bito qiymatlari (faqat baza bo'sh bo'lsa) — bazaga ham yoziladi
  const bito = merged.bito as AppSettings["bito"];
  if (!bito.apiKey && env.BITO_API_KEY) {
    bito.apiKey = env.BITO_API_KEY;
    const row = rows.find((r) => r.key === "bito");
    const cur = (row?.value as Record<string, unknown>) || {};
    await prisma.setting.upsert({ where: { key: "bito" }, create: { key: "bito", value: { ...cur, apiKey: env.BITO_API_KEY } as object }, update: { value: { ...cur, apiKey: env.BITO_API_KEY } as object } });
  }
  if (!bito.apiUrl) bito.apiUrl = env.BITO_API_URL;
  if (!bito.filesUrl) bito.filesUrl = env.BITO_FILES_URL;
  cache = merged as unknown as AppSettings;
  return cache;
}

export function getSettings(): AppSettings {
  if (!cache) throw new Error("Sozlamalar hali yuklanmagan");
  return cache;
}

export async function updateSection(section: string, patch: Record<string, unknown>): Promise<AppSettings> {
  if (!defaults[section]) throw new Error("Noma'lum bo'lim: " + section);
  const row = await prisma.setting.findUnique({ where: { key: section } });
  const current = (row?.value as Record<string, unknown>) || {};
  const next = { ...current };
  for (const [k, v] of Object.entries(patch)) {
    if (!(k in defaults[section])) continue;
    next[k] = v;
  }
  await prisma.setting.upsert({ where: { key: section }, create: { key: section, value: next as object }, update: { value: next as object } });
  const s = await loadSettings();
  log.info(`Sozlamalar yangilandi: ${section}`);
  return s;
}

/** Ko'p tilli matn: tanlangan tilda, bo'lmasa uz, bo'lmasa istalgan */
export function lt(t: LText | string | undefined, lang: Lang): string {
  if (!t) return "";
  if (typeof t === "string") return t;
  return t[lang] || t.uz || t.ru || t.en || "";
}

/** {name} kabi o'zgaruvchilarni almashtirish */
export function fill(template: string, vars: Record<string, string | number | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined || vars[k] === null ? m : String(vars[k])));
}

export function normalizeLang(l: unknown): Lang {
  const s = getSettings();
  const enabled = (s.general.enabledLanguages?.length ? s.general.enabledLanguages : ["uz", "ru", "en"]) as Lang[];
  if (typeof l === "string" && enabled.includes(l as Lang)) return l as Lang;
  return enabled.includes(s.general.defaultLanguage) ? s.general.defaultLanguage : enabled[0];
}

/** Mini App uchun ommaviy (maxfiy bo'lmagan) sozlamalar */
export function publicSettings(): Record<string, unknown> {
  const s = getSettings();
  const { adminPassword: _p, ...general } = s.general;
  return {
    general,
    design: s.design,
    catalog: s.catalog,
    checkout: s.checkout,
    profile: s.profile,
    statuses: {
      nameNew: s.statuses.nameNew, nameAccepted: s.statuses.nameAccepted, nameReady: s.statuses.nameReady,
      nameDelivering: s.statuses.nameDelivering, nameDone: s.statuses.nameDone, nameCanceled: s.statuses.nameCanceled,
    },
    bot: { openAppButton: s.bot.openAppButton },
    bito: { multiStore: s.bito.multiStore, storeButton: s.bito.storeButton, storeChooseLabel: s.bito.storeChooseLabel, storeChanged: s.bito.storeChanged },
    filesUrl: s.bito.filesUrl.replace(/\/+$/, ""),
  };
}
