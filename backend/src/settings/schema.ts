/**
 * Admin paneldagi BARCHA sozlamalarning sxemasi.
 * Admin panel shu sxema asosida formalarni avtomatik chizadi,
 * backend esa shu yerdagi standart qiymatlardan foydalanadi.
 */

export type Lang = "uz" | "ru" | "en";
export type LText = Record<Lang, string>;
export const LANGS: Lang[] = ["uz", "ru", "en"];

export type FieldType =
  | "text"
  | "textarea"
  | "ltext"
  | "ltextarea"
  | "number"
  | "boolean"
  | "color"
  | "select"
  | "image"
  | "password"
  | "tags"
  | "latlng"
  | "stores"
  | "priceExceptions";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  help?: string;
  default: unknown;
  options?: { value: string; label: string }[];
  /** Dinamik variantlar manbai: bito:organizations | bito:warehouses | bito:prices | bito:employees | bito:states | bito:currencies */
  source?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholders?: string[];
}

export interface GroupDef {
  title: string;
  description?: string;
  /** Admin panelda bo'limning qaysi sahifasida ko'rsatiladi (masalan checkout: "cart" | "order"; general: "bot") */
  part?: string;
  fields: FieldDef[];
}

export interface SectionDef {
  key: string;
  title: string;
  icon: string;
  description?: string;
  groups: GroupDef[];
}

const L = (uz: string, ru: string, en: string): LText => ({ uz, ru, en });

export const settingsSchema: SectionDef[] = [
  {
    key: "general",
    title: "Umumiy",
    icon: "settings",
    description: "Do'kon nomi, tillar va aloqa ma'lumotlari",
    groups: [
      {
        title: "Do'kon",
        fields: [
          { key: "shopName", label: "Do'kon nomi", type: "ltext", default: L("Birlik kitoblar do'koni", "Магазин книг Birlik", "Birlik bookstore") },
          { key: "supportPhone", label: "Aloqa telefoni", type: "text", default: "+998 90 000 00 00" },
          { key: "supportTelegram", label: "Aloqa uchun Telegram (username, @siz)", type: "text", default: "" },
          { key: "defaultLanguage", label: "Standart til", type: "select", default: "uz", options: [
            { value: "uz", label: "O'zbek" }, { value: "ru", label: "Русский" }, { value: "en", label: "English" },
          ] },
          { key: "enabledLanguages", label: "Yoqilgan tillar", type: "tags", default: ["uz", "ru", "en"], help: "uz, ru, en" },
          { key: "languageMode", label: "Yangi foydalanuvchi tili", type: "select", default: "default", options: [
            { value: "default", label: "Har doim standart til" }, { value: "telegram", label: "Telegram tiliga qarab (bo'lmasa standart)" },
          ] },
          { key: "currencySuffix", label: "Valyuta belgisi (narx yonida)", type: "ltext", default: L("so'm", "сум", "UZS") },
          { key: "priceDecimals", label: "Narxda kasr xonalari", type: "number", default: 0, min: 0, max: 3 },
        ],
      },
      {
        title: "Admin panel",
        fields: [
          { key: "adminPassword", label: "Admin panel paroli (bo'sh qoldirilsa o'zgarmaydi)", type: "password", default: "" },
        ],
      },
      {
        title: "Telegram bot",
        part: "bot",
        description: "Botni almashtirish: BotFather'dan yangi token oling va shu yerga kiriting. Saqlangach bot darhol yangi tokenda ishga tushadi.",
        fields: [
          { key: "botToken", label: "Bot tokeni (bo'sh qoldirilsa .env dagi ishlatiladi)", type: "password", default: "" },
        ],
      },
    ],
  },
  {
    key: "adminPanel",
    title: "Admin panel ko'rinishi",
    icon: "layout-dashboard",
    description: "Admin panelning nomi, logosi, rangi va tungi rejim",
    groups: [
      {
        title: "Brending",
        fields: [
          { key: "title", label: "Panel nomi (yuqori chapda)", type: "text", default: "Bito Shop" },
          { key: "subtitle", label: "Kichik yozuv", type: "text", default: "Admin panel" },
          { key: "businessName", label: "Biznes nomi (kirish sahifasida)", type: "text", default: "Bito Telegram Shop" },
          { key: "emoji", label: "Emoji (logo bo'lmasa)", type: "text", default: "🛍" },
          { key: "logo", label: "Logo rasmi", type: "image", default: "" },
          { key: "primaryColor", label: "Asosiy rang", type: "color", default: "#2563eb" },
        ],
      },
      {
        title: "Tungi rejim (dark mode)",
        fields: [
          { key: "darkMode", label: "Rejim", type: "select", default: "user", options: [
            { value: "user", label: "Foydalanuvchi o'zi tanlaydi (tugma)" }, { value: "auto", label: "Qurilma sozlamasiga qarab" }, { value: "light", label: "Doim yorug'" }, { value: "dark", label: "Doim tungi" },
          ] },
        ],
      },
    ],
  },
  {
    key: "bito",
    title: "Bito integratsiyasi",
    icon: "plug",
    description: "Istalgan Bito akkauntiga ulash uchun shu yerdagi qiymatlarni o'zgartiring",
    groups: [
      {
        title: "Ulanish",
        description: "API kalit: Bito → Sozlamalar → Integratsiyalar → Maxsus integratsiya",
        fields: [
          { key: "apiKey", label: "API kalit (login:secret)", type: "text", default: "" },
          { key: "apiUrl", label: "API manzili", type: "text", default: "https://api.bito.uz/integration-api/integration/api/v2" },
          { key: "filesUrl", label: "Fayllar (rasmlar) manzili", type: "text", default: "https://api.bito.uz/upload-api/public" },
          { key: "webBaseUrl", label: "Bito veb manzili (guruhdagi 'Bito' tugmasi uchun)", type: "text", default: "", help: "Masalan: https://kokand-test.bito.uz. Bo'sh bo'lsa API kalitdagi logindan avtomatik olinadi." },
        ],
      },
      {
        title: "Kontekst",
        description: "Ulanishni saqlagach, ro'yxatlar Bito'dan avtomatik yuklanadi",
        fields: [
          { key: "organizationId", label: "Tashkilot (filial)", type: "select", default: "", source: "bito:organizations" },
          { key: "warehouseId", label: "Ombor (buyurtma va qoldiq uchun)", type: "select", default: "", source: "bito:warehouses" },
          { key: "priceId", label: "Mijozga ko'rinadigan narx turi", type: "select", default: "", source: "bito:prices" },
          { key: "currencyId", label: "Valyuta", type: "select", default: "", source: "bito:currencies" },
          { key: "responsibleId", label: "Buyurtmalar uchun mas'ul xodim", type: "select", default: "", source: "bito:employees" },
          { key: "stockSource", label: "Qoldiq manbai", type: "select", default: "warehouse", options: [
            { value: "warehouse", label: "Tanlangan ombor" }, { value: "organization", label: "Butun tashkilot" },
          ] },
          { key: "customerOrganizations", label: "Yangi mijozni qaysi tashkilotlarga qo'shish", type: "select", default: "all", options: [
            { value: "all", label: "Barcha tashkilotlarga" }, { value: "selected", label: "Faqat tanlangan tashkilotga" },
          ] },
        ],
      },
      {
        title: "Mijozlar uchun narx istisnolari",
        description: "Tanlangan mijozlar Mini App'da boshqa narx turini ko'radi va buyurtma shu narxda hisoblanadi",
        fields: [
          { key: "priceExceptionsEnabled", label: "Istisnolar", type: "boolean", default: false },
          { key: "priceExceptions", label: "Istisnolar ro'yxati", type: "priceExceptions", default: [] },
        ],
      },
      {
        title: "Qo'shimcha tashkilotlar (do'konlar)",
        description: "Yoqilsa mijozlar Mini App va botda do'kon tanlaydi: mahsulotlar, narxlar, qoldiq, qarzdorlik, buyurtma va xaridlar tanlangan do'kon bo'yicha ko'rsatiladi",
        fields: [
          { key: "multiStore", label: "Tashkilot qo'shish", type: "boolean", default: false },
          { key: "mainStoreName", label: "Asosiy do'kon nomi (yuqoridagi kontekst)", type: "ltext", default: L("Asosiy do'kon", "Основной магазин", "Main store") },
          { key: "stores", label: "Qo'shimcha do'konlar", type: "stores", default: [] },
          { key: "storeChooseLabel", label: "Do'kon tanlash sarlavhasi", type: "ltext", default: L("🏬 Do'konni tanlang", "🏬 Выберите магазин", "🏬 Choose a store") },
          { key: "storeButton", label: "Do'kon tugmasi (bot/Mini App)", type: "ltext", default: L("🏬 Do'kon", "🏬 Магазин", "🏬 Store") },
          { key: "storeChanged", label: "Do'kon o'zgartirildi xabari", type: "ltext", default: L("✅ Do'kon tanlandi: {store}", "✅ Магазин выбран: {store}", "✅ Store selected: {store}"), placeholders: ["{store}"] },
        ],
      },
      {
        title: "Sinxronizatsiya",
        fields: [
          { key: "syncIntervalSec", label: "Mahsulotlarni yangilash oralig'i (soniya)", type: "number", default: 300, min: 30 },
          { key: "pollIntervalSec", label: "Buyurtma/savdo/to'lovlarni tekshirish oralig'i (soniya)", type: "number", default: 60, min: 15 },
          { key: "webhookEnabled", label: "Bito webhooklaridan foydalanish (tezkor yangilanish)", type: "boolean", default: true },
          { key: "onlyAvailableForSale", label: "Bito'da 'mavjud emas' deb belgilangan mahsulotlarni yashirish", type: "boolean", default: false },
        ],
      },
    ],
  },
  {
    key: "statuses",
    title: "Buyurtma holatlari",
    icon: "list-checks",
    description: "Bito'dagi holatlar bilan bog'lash va mijozga boradigan xabarlar",
    groups: [
      {
        title: "Bito holatlariga bog'lash",
        description: "Har bir bosqich uchun Bito'dagi mos holatni tanlang (ro'yxat Bito'dan yuklanadi)",
        fields: [
          { key: "newStateId", label: "Yangi buyurtma", type: "select", default: "", source: "bito:states" },
          { key: "acceptedStateId", label: "Qabul qilingan", type: "select", default: "", source: "bito:states" },
          { key: "readyStateId", label: "Tayyor", type: "select", default: "", source: "bito:states" },
          { key: "deliveringStateId", label: "Yetkazilmoqda", type: "select", default: "", source: "bito:states" },
          { key: "doneStateId", label: "Bajarildi", type: "select", default: "", source: "bito:states" },
          { key: "canceledStateId", label: "Bekor qilingan", type: "select", default: "", source: "bito:states" },
        ],
      },
      {
        title: "Guruhdagi tugmalar",
        fields: [
          { key: "btnAccept", label: "Qabul qilish", type: "text", default: "✅ Qabul qilish" },
          { key: "btnReady", label: "Tayyor", type: "text", default: "📦 Tayyor" },
          { key: "btnDispatch", label: "Yo'lga chiqish", type: "text", default: "🚚 Yo'lga chiqish" },
          { key: "btnDelivered", label: "Yetkazildi", type: "text", default: "🏁 Yetkazildi" },
          { key: "btnPickedUp", label: "Olib ketildi", type: "text", default: "🏁 Olib ketildi" },
          { key: "btnCancel", label: "Bekor qilish", type: "text", default: "❌ Bekor qilish" },
          { key: "btnBito", label: "Bito tugmasi", type: "text", default: "🔗 Bito" },
          { key: "btnLocation", label: "Joylashuv tugmasi", type: "text", default: "📍 Joylashuv" },
        ],
      },
      {
        title: "Mijozga ko'rinadigan holat nomlari",
        fields: [
          { key: "nameNew", label: "Yangi", type: "ltext", default: L("Yangi", "Новый", "New") },
          { key: "nameAccepted", label: "Qabul qilingan", type: "ltext", default: L("Qabul qilingan", "Принят", "Accepted") },
          { key: "nameReady", label: "Tayyor", type: "ltext", default: L("Tayyor", "Готов", "Ready") },
          { key: "nameDelivering", label: "Yetkazilmoqda", type: "ltext", default: L("Yetkazilmoqda", "Доставляется", "Delivering") },
          { key: "nameDone", label: "Bajarildi", type: "ltext", default: L("Bajarildi", "Выполнен", "Completed") },
          { key: "nameCanceled", label: "Bekor qilingan", type: "ltext", default: L("Bekor qilingan", "Отменён", "Canceled") },
        ],
      },
      {
        title: "Holat o'zgarganda mijozga xabar",
        description: "Bo'sh qoldirilsa xabar yuborilmaydi. O'zgaruvchilar: {order} — buyurtma raqami, {status} — holat nomi, {name} — mijoz ismi",
        fields: [
          { key: "msgAccepted", label: "Qabul qilinganda", type: "ltextarea", default: L("✅ #{order} buyurtmangiz qabul qilindi. Tez orada tayyorlaymiz!", "✅ Ваш заказ #{order} принят. Скоро подготовим!", "✅ Your order #{order} has been accepted. We'll prepare it soon!"), placeholders: ["{order}", "{status}", "{name}"] },
          { key: "msgReady", label: "Tayyor bo'lganda", type: "ltextarea", default: L("📦 #{order} buyurtmangiz tayyor!", "📦 Ваш заказ #{order} готов!", "📦 Your order #{order} is ready!"), placeholders: ["{order}", "{status}", "{name}"] },
          { key: "msgDelivering", label: "Yo'lga chiqqanda", type: "ltextarea", default: L("🚚 #{order} buyurtmangiz yo'lga chiqdi. Kuryer tez orada yetib boradi.", "🚚 Ваш заказ #{order} в пути. Курьер скоро прибудет.", "🚚 Your order #{order} is on its way. The courier will arrive soon."), placeholders: ["{order}", "{status}", "{name}"] },
          { key: "msgDone", label: "Bajarilganda", type: "ltextarea", default: L("🏁 #{order} buyurtmangiz bajarildi. Xaridingiz uchun rahmat! 🤗", "🏁 Ваш заказ #{order} выполнен. Спасибо за покупку! 🤗", "🏁 Your order #{order} is completed. Thank you for your purchase! 🤗"), placeholders: ["{order}", "{status}", "{name}"] },
          { key: "msgCanceled", label: "Bekor qilinganda", type: "ltextarea", default: L("❌ #{order} buyurtmangiz bekor qilindi. Savollar bo'lsa biz bilan bog'laning.", "❌ Ваш заказ #{order} отменён. Свяжитесь с нами при вопросах.", "❌ Your order #{order} was canceled. Contact us if you have questions."), placeholders: ["{order}", "{status}", "{name}"] },
          { key: "msgOther", label: "Boshqa (maxsus) holatga o'tganda", type: "ltextarea", default: L("ℹ️ #{order} buyurtmangiz holati: {status}", "ℹ️ Статус заказа #{order}: {status}", "ℹ️ Order #{order} status: {status}"), placeholders: ["{order}", "{status}", "{name}"] },
        ],
      },
    ],
  },
  {
    key: "bot",
    title: "Bot matnlari",
    icon: "bot",
    description: "Telegram botdagi barcha xabarlar va tugmalar (3 tilda)",
    groups: [
      {
        title: "Ro'yxatdan o'tish",
        fields: [
          { key: "welcome", label: "Salomlashish (/start)", type: "ltextarea", default: L("Assalomu alaykum! \"Birlik\" kitoblar do'konining rasmiy telegram botiga xush kelibsiz 😊", "Здравствуйте! Добро пожаловать в официальный телеграм-бот книжного магазина \"Birlik\" 😊", "Hello! Welcome to the official Telegram bot of the \"Birlik\" bookstore 😊") },
          { key: "askPhone", label: "Telefon so'rash", type: "ltextarea", default: L("Botdan foydalanish uchun iltimos telefon raqamingizni yuboring! 💌", "Для использования бота, пожалуйста, отправьте свой номер телефона! 💌", "To use the bot, please share your phone number! 💌") },
          { key: "phoneButton", label: "Telefon ulashish tugmasi", type: "ltext", default: L("📱 Telefon raqamni ulashish", "📱 Поделиться номером", "📱 Share phone number") },
          { key: "wrongContact", label: "Begona kontakt yuborilganda", type: "ltextarea", default: L("⚠️ Xavfsizlik uchun faqat o'zingizning raqamingizni pastdagi tugma orqali yuboring.", "⚠️ В целях безопасности отправьте только свой номер через кнопку ниже.", "⚠️ For security, please share only your own number using the button below.") },
          { key: "askName", label: "Ism so'rash", type: "ltextarea", default: L("Sizni kim deb murojaat qilishimizni hohlaysiz? 😇", "Как к вам обращаться? 😇", "What should we call you? 😇") },
          { key: "registered", label: "Ro'yxatdan o'tdi", type: "ltextarea", default: L("Ro'yxatdan muvaffaqiyatli o'tdingiz! Xaridni boshlashingiz mumkin 🤗", "Вы успешно зарегистрированы! Можете начать покупки 🤗", "You have registered successfully! You can start shopping 🤗") },
          { key: "welcomeBack", label: "Qayta /start bosganda", type: "ltextarea", default: L("Xush kelibsiz, {name}! Buyurtma berish uchun pastdagi tugmani bosing 👇", "С возвращением, {name}! Нажмите кнопку ниже, чтобы сделать заказ 👇", "Welcome back, {name}! Tap the button below to order 👇"), placeholders: ["{name}"] },
          { key: "openAppButton", label: "Mini App tugmasi", type: "ltext", default: L("🛍 Buyurtma berish", "🛍 Сделать заказ", "🛍 Place an order") },
          { key: "menuButtonText", label: "Chat menyu tugmasi (pastki chap)", type: "ltext", default: L("Do'kon", "Магазин", "Shop") },
        ],
      },
      {
        title: "Asosiy menyu tugmalari",
        fields: [
          { key: "mOrders", label: "Buyurtmalar", type: "ltext", default: L("📦 Buyurtmalar", "📦 Заказы", "📦 Orders") },
          { key: "mPurchases", label: "Xaridlar", type: "ltext", default: L("🧾 Xaridlar", "🧾 Покупки", "🧾 Purchases") },
          { key: "mMyInfo", label: "Mening ma'lumotlarim", type: "ltext", default: L("👤 Mening ma'lumotlarim", "👤 Мои данные", "👤 My info") },
          { key: "mSettings", label: "Sozlamalar", type: "ltext", default: L("⚙️ Sozlamalar", "⚙️ Настройки", "⚙️ Settings") },
          { key: "mBalance", label: "Hozirgi balans", type: "ltext", default: L("💰 Hozirgi balans", "💰 Текущий баланс", "💰 Current balance") },
          { key: "mCard", label: "Mening kartam", type: "ltext", default: L("💳 Mening kartam", "💳 Моя карта", "💳 My card") },
          { key: "mAkt", label: "Akt sverka", type: "ltext", default: L("📑 Akt sverka", "📑 Акт сверки", "📑 Reconciliation act") },
        ],
      },
      {
        title: "Buyurtma xabarlari",
        fields: [
          { key: "orderReceived", label: "Buyurtma qabul qilindi (Mini App yopilgach)", type: "ltextarea", default: L("Buyurtmangiz muvaffaqiyatli qabul qilindi! Kuryerimiz tez orada bog'lanadi 🚚\n\nBuyurtma raqami: #{order}", "Ваш заказ успешно принят! Наш курьер скоро свяжется с вами 🚚\n\nНомер заказа: #{order}", "Your order has been received! Our courier will contact you soon 🚚\n\nOrder number: #{order}"), placeholders: ["{order}", "{name}", "{total}"] },
          { key: "orderReceivedPickup", label: "Buyurtma qabul qilindi (olib ketish)", type: "ltextarea", default: L("Buyurtmangiz qabul qilindi! Tayyor bo'lganda xabar beramiz 🛍\n\nBuyurtma raqami: #{order}", "Ваш заказ принят! Сообщим, когда будет готов 🛍\n\nНомер заказа: #{order}", "Your order has been received! We'll notify you when it's ready 🛍\n\nOrder number: #{order}"), placeholders: ["{order}", "{name}", "{total}"] },
          { key: "noOrders", label: "Buyurtmalar yo'q", type: "ltext", default: L("Sizda hali buyurtmalar yo'q.", "У вас пока нет заказов.", "You have no orders yet.") },
          { key: "ordersTitle", label: "Buyurtmalar sarlavhasi", type: "ltext", default: L("📦 Sizning buyurtmalaringiz:", "📦 Ваши заказы:", "📦 Your orders:") },
          { key: "noPurchases", label: "Xaridlar yo'q", type: "ltext", default: L("Xaridlar tarixi bo'sh.", "История покупок пуста.", "Purchase history is empty.") },
          { key: "listHint", label: "Ro'yxat ostidagi izoh", type: "ltext", default: L("Batafsil ko'rish uchun raqamni bosing 👇", "Нажмите номер, чтобы открыть подробности 👇", "Tap a number to see details 👇") },
          { key: "listLimit", label: "Ro'yxatda nechta ko'rsatish", type: "number", default: 10, min: 3, max: 30 },
          { key: "orderDetailTitle", label: "Buyurtma tafsiloti sarlavhasi", type: "ltext", default: L("📦 Buyurtma", "📦 Заказ", "📦 Order") },
          { key: "lStatus", label: "Holat", type: "ltext", default: L("Holat", "Статус", "Status") },
          { key: "lType", label: "Turi", type: "ltext", default: L("Turi", "Тип", "Type") },
          { key: "lAddress", label: "Manzil", type: "ltext", default: L("Manzil", "Адрес", "Address") },
          { key: "purchasesTitle", label: "Xaridlar sarlavhasi", type: "ltext", default: L("🧾 Xaridlar tarixi:", "🧾 История покупок:", "🧾 Purchase history:") },
        ],
      },
      {
        title: "Ma'lumotlar, balans, karta, akt",
        fields: [
          { key: "myInfo", label: "Mening ma'lumotlarim", type: "ltextarea", default: L("👤 Ism: {name}\n📱 Telefon: {phone}\n🆔 Telegram ID: {tg}", "👤 Имя: {name}\n📱 Телефон: {phone}\n🆔 Telegram ID: {tg}", "👤 Name: {name}\n📱 Phone: {phone}\n🆔 Telegram ID: {tg}"), placeholders: ["{name}", "{phone}", "{tg}"] },
          { key: "balanceTitle", label: "Balans sarlavhasi", type: "ltext", default: L("💰 Hozirgi balansingiz:", "💰 Ваш текущий баланс:", "💰 Your current balance:") },
          { key: "balanceDebt", label: "Qarzdorlik matni", type: "ltext", default: L("Qarzdorlik", "Задолженность", "Debt") },
          { key: "balanceCredit", label: "Haqdorlik matni", type: "ltext", default: L("Haqdorlik", "Переплата", "Credit") },
          { key: "balanceZero", label: "Balans nol", type: "ltext", default: L("Qarzdorlik yo'q ✅", "Задолженности нет ✅", "No debt ✅") },
          { key: "cardCaption", label: "Karta rasmi ostidagi matn", type: "ltextarea", default: L("💳 Sizning sodiqlik kartangiz\nRaqam: {card}", "💳 Ваша карта лояльности\nНомер: {card}", "💳 Your loyalty card\nNumber: {card}"), placeholders: ["{card}", "{name}"] },
          { key: "noCard", label: "Karta yo'q", type: "ltext", default: L("Sizga hali sodiqlik kartasi biriktirilmagan.", "Карта лояльности пока не привязана.", "No loyalty card is linked yet.") },
          { key: "aktCaption", label: "Akt sverka fayli ostidagi matn", type: "ltextarea", default: L("📑 Oldi-berdi hisoboti (akt sverka)\nDavr: {from} — {to}", "📑 Акт сверки\nПериод: {from} — {to}", "📑 Reconciliation act\nPeriod: {from} — {to}"), placeholders: ["{from}", "{to}"] },
          { key: "aktPreparing", label: "Akt tayyorlanmoqda", type: "ltext", default: L("⏳ Hisobot tayyorlanmoqda...", "⏳ Отчёт готовится...", "⏳ Preparing the report...") },
          { key: "aktMonths", label: "Akt sverka davri (oy)", type: "number", default: 12, min: 1, max: 60 },
          { key: "chooseLanguage", label: "Til tanlash", type: "ltext", default: L("🌐 Tilni tanlang:", "🌐 Выберите язык:", "🌐 Choose language:") },
          { key: "languageChanged", label: "Til o'zgardi", type: "ltext", default: L("✅ Til o'zgartirildi", "✅ Язык изменён", "✅ Language changed") },
          { key: "notLinked", label: "Bito'ga ulanmagan", type: "ltext", default: L("Ma'lumot topilmadi. Iltimos /start bosib qayta ro'yxatdan o'ting.", "Данные не найдены. Нажмите /start для повторной регистрации.", "No data found. Please press /start to register again.") },
          { key: "errorGeneric", label: "Umumiy xato", type: "ltext", default: L("⚠️ Xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.", "⚠️ Произошла ошибка. Попробуйте позже.", "⚠️ Something went wrong. Please try again later.") },
        ],
      },
      {
        title: "Savdo cheki va to'lovlar (Bito'dan avtomatik)",
        fields: [
          { key: "notifyTrades", label: "Har bir savdoda mijozga chek yuborish", type: "boolean", default: true },
          { key: "notifyPayments", label: "Har bir to'lov/balans to'ldirilganda xabar yuborish", type: "boolean", default: true },
          { key: "notifyPaymentsWithTrade", label: "Savdo bilan BIR VAQTDA qilingan to'lovni ham alohida yuborish (chekdan tashqari)", type: "boolean", default: false, help: "Keyinroq qilingan qarz to'lovlari bu sozlamadan qat'i nazar har doim yuboriladi" },
          { key: "receiptTitle", label: "Chek sarlavhasi", type: "ltext", default: L("🧾 Xarid cheki", "🧾 Чек покупки", "🧾 Purchase receipt") },
          { key: "rShowTime", label: "Chekda: Vaqt", type: "boolean", default: true },
          { key: "rShowTrade", label: "Chekda: Savdo raqami", type: "boolean", default: true },
          { key: "rShowCustomer", label: "Chekda: Mijoz", type: "boolean", default: true },
          { key: "rShowSeller", label: "Chekda: Sotuvchi", type: "boolean", default: true },
          { key: "rShowProducts", label: "Chekda: Mahsulotlar", type: "boolean", default: true },
          { key: "rShowTotalQty", label: "Chekda: Jami miqdori", type: "boolean", default: true },
          { key: "rShowTotal", label: "Chekda: Jami", type: "boolean", default: true },
          { key: "rShowDiscount", label: "Chekda: Chegirma", type: "boolean", default: true },
          { key: "rShowPayment", label: "Chekda: To'lov usuli", type: "boolean", default: true },
          { key: "rShowDebt", label: "Chekda: Qarzga yozildi", type: "boolean", default: true },
          { key: "rShowBefore", label: "Chekda: Avvalgi balans", type: "boolean", default: true },
          { key: "rShowAfter", label: "Chekda: Hozirgi balans", type: "boolean", default: true },
          { key: "rShowDueDate", label: "Chekda: To'lov muddati", type: "boolean", default: true },

          { key: "lTime", label: "Vaqt", type: "ltext", default: L("Vaqt", "Время", "Time") },
          { key: "lTrade", label: "Savdo", type: "ltext", default: L("Savdo", "Продажа", "Sale") },
          { key: "lCustomer", label: "Mijoz", type: "ltext", default: L("Mijoz", "Клиент", "Customer") },
          { key: "lSeller", label: "Sotuvchi", type: "ltext", default: L("Sotuvchi", "Продавец", "Seller") },
          { key: "lProducts", label: "Mahsulotlar", type: "ltext", default: L("Mahsulotlar", "Товары", "Products") },
          { key: "lTotalQty", label: "Jami miqdori", type: "ltext", default: L("Jami miqdori", "Общее количество", "Total quantity") },
          { key: "lTotal", label: "Jami", type: "ltext", default: L("Jami", "Итого", "Total") },
          { key: "lPayment", label: "To'lov usuli", type: "ltext", default: L("To'lov usuli", "Способ оплаты", "Payment method") },
          { key: "lDebt", label: "Qarzga yozildi", type: "ltext", default: L("Qarzga yozildi", "Записано в долг", "Added to debt") },
          { key: "lBefore", label: "Xariddan avvalgi balans", type: "ltext", default: L("Avvalgi balans", "Баланс до", "Balance before") },
          { key: "lAfter", label: "Xariddan keyingi balans", type: "ltext", default: L("Hozirgi balans", "Баланс после", "Balance after") },
          { key: "lRefund", label: "Qaytarish", type: "ltext", default: L("↩️ Qaytarish", "↩️ Возврат", "↩️ Refund") },
          { key: "paymentTitle", label: "To'lov xabari sarlavhasi", type: "ltext", default: L("💸 To'lov qabul qilindi", "💸 Платёж принят", "💸 Payment received") },
          { key: "lCashbox", label: "Kassa", type: "ltext", default: L("Kassa", "Касса", "Cashbox") },
          { key: "pShowTime", label: "To'lovda: Vaqt", type: "boolean", default: true },
          { key: "pShowNumber", label: "To'lovda: Raqam", type: "boolean", default: false },
          { key: "pShowTrade", label: "To'lovda: Qaysi savdo uchun (savdo raqami)", type: "boolean", default: true },
          { key: "pShowAmount", label: "To'lovda: Summa", type: "boolean", default: true },
          { key: "pShowMethod", label: "To'lovda: To'lov usuli", type: "boolean", default: true },
          { key: "pShowType", label: "To'lovda: To'lov turi", type: "boolean", default: false },
          { key: "pShowReceivedBy", label: "To'lovda: Qabul qildi", type: "boolean", default: true },
          { key: "pShowCashbox", label: "To'lovda: Kassa", type: "boolean", default: true },
          { key: "pShowOrganization", label: "To'lovda: Tashkilot", type: "boolean", default: true },
          { key: "pShowDescription", label: "To'lovda: Izoh", type: "boolean", default: true },
          { key: "pShowBefore", label: "To'lovda: Avvalgi balans", type: "boolean", default: false },
          { key: "pShowAfter", label: "To'lovda: Hozirgi balans (har valyuta alohida)", type: "boolean", default: true },

          { key: "lAmount", label: "Summa", type: "ltext", default: L("Summa", "Сумма", "Amount") },
          { key: "lReceivedBy", label: "Qabul qildi", type: "ltext", default: L("Qabul qildi", "Принял", "Received by") },
          { key: "lOrganization", label: "Tashkilot", type: "ltext", default: L("Tashkilot", "Организация", "Organization") },
          { key: "lDueDate", label: "To'lov muddati", type: "ltext", default: L("To'lov muddati", "Срок оплаты", "Due date") },
        ],
      },
      {
        title: "Kelganda eslating",
        fields: [
          { key: "waitlistAdded", label: "Ro'yxatga qo'shildi (botga xabar)", type: "ltextarea", default: L("🔔 \"{product}\" sotuvga kelganda sizga xabar beramiz.", "🔔 Мы сообщим вам, когда \"{product}\" появится в продаже.", "🔔 We'll notify you when \"{product}\" is back in stock."), placeholders: ["{product}"] },
          { key: "waitlistArrived", label: "Mahsulot keldi", type: "ltextarea", default: L("🎉 \"{product}\" nomli mahsulotni so'ragan edingiz — u sotuvga keldi! Bemalol xarid qilishingiz mumkin.", "🎉 Вы интересовались товаром \"{product}\" — он снова в продаже! Можете оформить заказ.", "🎉 You asked about \"{product}\" — it's back in stock! Feel free to order."), placeholders: ["{product}"] },
          { key: "waitlistNotifyBot", label: "Ro'yxatga qo'shilganda botga ham xabar yuborish", type: "boolean", default: true },
        ],
      },
      {
        title: "Guruh (adminlar) sozlamalari",
        fields: [
          { key: "staffMode", label: "Holatni kim o'zgartira oladi", type: "select", default: "group", options: [
            { value: "group", label: "Ruxsat etilgan guruhning istalgan a'zosi" },
            { value: "list", label: "Faqat 'Xodimlar' ro'yxatidagilar" },
          ] },
          { key: "groupNotAllowed", label: "Ruxsatsiz odam bosganda", type: "text", default: "⛔ Sizda bu amal uchun ruxsat yo'q" },
          { key: "groupTitleNew", label: "Guruh xabari sarlavhasi", type: "text", default: "🆕 YANGI BUYURTMA" },
          { key: "gTime", label: "Vaqt", type: "text", default: "🕒 Vaqt" },
          { key: "gCustomer", label: "Mijoz", type: "text", default: "👤 Mijoz" },
          { key: "gPhone", label: "Telefon", type: "text", default: "📱 Telefon" },
          { key: "gType", label: "Turi", type: "text", default: "🚚 Turi" },
          { key: "gDelivery", label: "Yetkazib berish (qiymat)", type: "text", default: "Yetkazib berish" },
          { key: "gPickup", label: "Olib ketish (qiymat)", type: "text", default: "Olib ketish" },
          { key: "gNumber", label: "Buyurtma raqami", type: "text", default: "🔢 Buyurtma raqami" },
          { key: "gStatus", label: "Holati", type: "text", default: "📌 Holati" },
          { key: "gAddress", label: "Manzil", type: "text", default: "📍 Manzil" },
          { key: "gComment", label: "Izoh", type: "text", default: "💬 Izoh" },
          { key: "gProducts", label: "Mahsulotlar", type: "text", default: "🛒 Mahsulotlar" },
          { key: "gHistory", label: "Tarix", type: "text", default: "📜 Tarix" },
          { key: "showTotalInGroup", label: "Guruhda jami summani ko'rsatish", type: "boolean", default: false },
          { key: "gShowTime", label: "Guruhda: Vaqt", type: "boolean", default: true },
          { key: "gShowCustomer", label: "Guruhda: Mijoz", type: "boolean", default: true },
          { key: "gShowPhone", label: "Guruhda: Telefon", type: "boolean", default: true },
          { key: "gShowType", label: "Guruhda: Turi", type: "boolean", default: true },
          { key: "gShowNumber", label: "Guruhda: Buyurtma raqami", type: "boolean", default: true },
          { key: "gShowStatus", label: "Guruhda: Holati", type: "boolean", default: true },
          { key: "gShowAddress", label: "Guruhda: Manzil", type: "boolean", default: true },
          { key: "gShowComment", label: "Guruhda: Izoh", type: "boolean", default: true },
          { key: "gShowProducts", label: "Guruhda: Mahsulotlar", type: "boolean", default: true },
          { key: "gShowHistory", label: "Guruhda: Tarix", type: "boolean", default: true },
          { key: "gProductsChanged", label: "Tarix: mahsulotlar o'zgartirildi", type: "text", default: "Mahsulotlar tizimdan o'zgartirildi" },
          { key: "gTraded", label: "Tarix: savdoga o'tkazildi", type: "text", default: "Savdoga o'tkazildi" },
          { key: "gButtonsEnabled", label: "Guruhda tugmalarni ko'rsatish (umuman)", type: "boolean", default: true },
          { key: "gBtnAccept", label: "Tugma: Qabul qilish", type: "boolean", default: true },
          { key: "gBtnReady", label: "Tugma: Tayyor", type: "boolean", default: true },
          { key: "gBtnDispatch", label: "Tugma: Yo'lga chiqish", type: "boolean", default: true },
          { key: "gBtnDone", label: "Tugma: Yetkazildi / Olib ketildi", type: "boolean", default: true },
          { key: "gBtnCancel", label: "Tugma: Bekor qilish", type: "boolean", default: true },
          { key: "gBtnBito", label: "Tugma: Bito", type: "boolean", default: true },
          { key: "gBtnLocation", label: "Tugma: Joylashuv", type: "boolean", default: true },

        ],
      },
    ],
  },
  {
    key: "design",
    title: "Mini App dizayni",
    icon: "palette",
    description: "Ranglar, logo, salomlashish, bloklar",
    groups: [
      {
        title: "Ranglar va uslub",
        fields: [
          { key: "primaryColor", label: "Asosiy rang", type: "color", default: "#2563eb" },
          { key: "accentColor", label: "Qo'shimcha rang (chegirma, belgilar)", type: "color", default: "#f97316" },
          { key: "bgColor", label: "Fon rangi", type: "color", default: "#ffffff" },
          { key: "textColor", label: "Matn rangi", type: "color", default: "#0f172a" },
          { key: "radius", label: "Burchak yumaloqligi (px)", type: "number", default: 18, min: 0, max: 40 },
          { key: "darkMode", label: "Tungi rejim (dark mode)", type: "select", default: "user", options: [
            { value: "off", label: "O'chirilgan (doim yorug')" }, { value: "on", label: "Doim tungi" }, { value: "auto", label: "Telegram mavzusiga qarab" }, { value: "user", label: "Mijoz o'zi tanlaydi (Profil → tugma)" },
          ] },
          { key: "darkBg", label: "Tungi fon rangi", type: "color", default: "#0f172a" },
          { key: "darkCard", label: "Tungi kartochka rangi", type: "color", default: "#1e293b" },
          { key: "darkText", label: "Tungi matn rangi", type: "color", default: "#f1f5f9" },
          { key: "darkToggleLabel", label: "Profildagi tugma matni", type: "ltext", default: L("🌙 Tungi rejim", "🌙 Тёмная тема", "🌙 Dark mode") },
          { key: "animations", label: "Animatsiyalar", type: "select", default: "full", options: [
            { value: "full", label: "To'liq" }, { value: "reduced", label: "Kamaytirilgan" }, { value: "off", label: "O'chirilgan" },
          ] },
        ],
      },
      {
        title: "Animatsiya uslubi",
        description: "Dunyodagi mashhur Mini App'lar (Telegram Wallet, Notcoin, Hamster, Blum, Major) uslublari asosida",
        fields: [
          { key: "pageTransition", label: "Bo'limlar orasidagi o'tish", type: "select", default: "ios", options: [
            { value: "ios", label: "iOS — yon tomondan surilish (Wallet, Telegram)" },
            { value: "fade", label: "Yumshoq so'nish (Blum)" },
            { value: "zoom", label: "Kattalashib chiqish (Notcoin)" },
            { value: "up", label: "Pastdan ko'tarilish (Hamster)" },
            { value: "none", label: "O'tish animatsiyasisiz" },
          ] },
          { key: "motionPreset", label: "Harakat xarakteri", type: "select", default: "smooth", options: [
            { value: "smooth", label: "Silliq (premium)" },
            { value: "bouncy", label: "Sakrovchi (o'yin uslubi)" },
            { value: "snappy", label: "Tez va aniq" },
          ] },
          { key: "cardStagger", label: "Kartochkalar ketma-ket paydo bo'lishi", type: "boolean", default: true },
          { key: "cardEntrance", label: "Kartochka kirish effekti", type: "select", default: "rise", options: [
            { value: "rise", label: "Pastdan ko'tarilish" }, { value: "fade", label: "So'nib chiqish" }, { value: "pop", label: "Kattalashib chiqish" }, { value: "none", label: "Yo'q" },
          ] },
          { key: "tapScale", label: "Bosganda kichrayish kuchi (0.85–1)", type: "number", default: 0.96, min: 0.8, max: 1, step: 0.01 },
          { key: "hapticEnabled", label: "Vibratsiya (haptic) javoblari", type: "boolean", default: true },
        ],
      },
      {
        title: "Kirish ekrani (splash)",
        description: "Mini App ochilganda ko'rinadigan birinchi ekran",
        fields: [
          { key: "splashShow", label: "Ko'rsatish", type: "boolean", default: true },
          { key: "splashType", label: "Belgi turi", type: "select", default: "emoji", options: [
            { value: "emoji", label: "Emoji / matn" }, { value: "image", label: "Rasm (logo)" }, { value: "none", label: "Belgisiz" },
          ] },
          { key: "splashEmoji", label: "Emoji yoki qisqa matn", type: "text", default: "🛍" },
          { key: "splashImage", label: "Rasm", type: "image", default: "" },
          { key: "splashImageSize", label: "Rasm o'lchami (px)", type: "number", default: 96, min: 40, max: 240 },
          { key: "splashText", label: "Ostidagi matn", type: "ltext", default: L("", "", "") },
          { key: "splashBg", label: "Fon rangi", type: "color", default: "#ffffff" },
          { key: "splashAnimation", label: "Animatsiya", type: "select", default: "pulse", options: [
            { value: "pulse", label: "Pulsatsiya" }, { value: "bounce", label: "Sakrash" }, { value: "spin", label: "Aylanish" }, { value: "fade", label: "So'nib chiqish" }, { value: "none", label: "Yo'q" },
          ] },
          { key: "splashMinMs", label: "Minimal ko'rsatish vaqti (ms)", type: "number", default: 600, min: 0, max: 5000, step: 100 },
        ],
      },
      {
        title: "Salomlashish (header)",
        fields: [
          { key: "greetingShow", label: "Ko'rsatish", type: "boolean", default: true },
          { key: "greetingText", label: "Matn", type: "ltext", default: L("Assalomu alaykum, {name}", "Здравствуйте, {name}", "Hello, {name}"), placeholders: ["{name}"] },
          { key: "greetingSub", label: "Kichik matn", type: "ltext", default: L("Xush kelibsiz! 👋", "Добро пожаловать! 👋", "Welcome! 👋") },
          { key: "greetingSize", label: "Shrift o'lchami (px)", type: "number", default: 20, min: 12, max: 40 },
          { key: "greetingColor", label: "Rangi", type: "color", default: "#0f172a" },
        ],
      },
      {
        title: "Logo",
        fields: [
          { key: "logoShow", label: "Ko'rsatish", type: "boolean", default: true },
          { key: "logoImage", label: "Logo rasmi", type: "image", default: "" },
          { key: "logoSize", label: "O'lchami (px)", type: "number", default: 44, min: 24, max: 120 },
          { key: "logoShape", label: "Shakli", type: "select", default: "circle", options: [
            { value: "circle", label: "Doira" }, { value: "rounded", label: "Yumaloq burchak" }, { value: "square", label: "Kvadrat" },
          ] },
          { key: "logoPosition", label: "Joylashuvi", type: "select", default: "right", options: [
            { value: "right", label: "O'ng tomonda" }, { value: "left", label: "Chap tomonda" },
          ] },
          { key: "logoBg", label: "Logo foni", type: "color", default: "#f1f5f9" },
        ],
      },
      {
        title: "Storis",
        fields: [
          { key: "storiesShow", label: "Ko'rsatish", type: "boolean", default: true },
          { key: "storiesSize", label: "Doira o'lchami (px)", type: "number", default: 66, min: 44, max: 100 },
          { key: "storiesRingColor", label: "Halqa rangi (ko'rilmagan)", type: "color", default: "#f97316" },
          { key: "storiesDefaultDuration", label: "Standart davomiylik (soniya)", type: "number", default: 5, min: 1, max: 180, help: "Har bir slaydga o'z davomiyligini berish mumkin; bu faqat ko'rsatilmaganda ishlaydi." },
          { key: "storyButton", label: "Havola tugmasi matni", type: "ltext", default: L("→", "→", "→"), help: "Slaydda havola bo'lsa pastdagi tugma matni (masalan: 🛒 Buyurtma berish). Har bir slaydda alohida matn ham berish mumkin." },
          { key: "storiesSound", label: "Videolar ovoz bilan", type: "boolean", default: true, help: "O'chiq bo'lsa videolar ovozsiz ijro etiladi." },
        ],
      },
      {
        title: "Bannerlar",
        fields: [
          { key: "bannersShow", label: "Ko'rsatish", type: "boolean", default: true },
          { key: "bannersInterval", label: "Avto-aylanish oralig'i (soniya)", type: "number", default: 4, min: 2, max: 30 },
          { key: "bannersHeight", label: "Balandligi (px)", type: "number", default: 160, min: 100, max: 320 },
          { key: "bannersRadius", label: "Burchak (px)", type: "number", default: 20, min: 0, max: 40 },
        ],
      },
      {
        title: "Asosiy vidjet (Hero)",
        fields: [
          { key: "heroShow", label: "Ko'rsatish", type: "boolean", default: true },
          { key: "heroTitle", label: "Sarlavha", type: "ltext", default: L("Yangi buyurtma berish", "Сделать новый заказ", "Place a new order") },
          { key: "heroSubtitle", label: "Izoh", type: "ltext", default: L("Katalogdan tanlang — biz yetkazib beramiz", "Выберите из каталога — мы доставим", "Choose from the catalog — we deliver") },
          { key: "heroButton", label: "Tugma matni", type: "ltext", default: L("Katalogga o'tish", "Перейти в каталог", "Open catalog") },
          { key: "heroEmoji", label: "Emoji", type: "text", default: "🛍" },
          { key: "heroColor", label: "Fon rangi", type: "color", default: "#2563eb" },
          { key: "heroColor2", label: "Gradient ikkinchi rang", type: "color", default: "#7c3aed" },
        ],
      },
      {
        title: "Bosh sahifadagi bloklar",
        fields: [
          { key: "featuredShow", label: "Tavsiya etilgan mahsulotlar", type: "boolean", default: true },
          { key: "featuredTitle", label: "Sarlavha", type: "ltext", default: L("Tavsiya etamiz", "Рекомендуем", "Recommended") },
          { key: "categoriesShow", label: "Kategoriyalar bloki", type: "boolean", default: true },
          { key: "categoriesTitle", label: "Sarlavha", type: "ltext", default: L("Kategoriyalar", "Категории", "Categories") },
          { key: "newShow", label: "Yangi mahsulotlar", type: "boolean", default: false },
          { key: "newTitle", label: "Sarlavha", type: "ltext", default: L("Yangi kelganlar", "Новинки", "New arrivals") },
        ],
      },
      {
        title: "Pastki navigatsiya",
        fields: [
          { key: "navHome", label: "Bosh sahifa", type: "ltext", default: L("Bosh sahifa", "Главная", "Home") },
          { key: "navCatalog", label: "Katalog", type: "ltext", default: L("Katalog", "Каталог", "Catalog") },
          { key: "navCart", label: "Savatcha", type: "ltext", default: L("Savatcha", "Корзина", "Cart") },
          { key: "navProfile", label: "Profil", type: "ltext", default: L("Profil", "Профиль", "Profile") },
        ],
      },
    ],
  },
  {
    key: "catalog",
    title: "Katalog",
    icon: "layout-grid",
    description: "Mahsulotlar qanday ko'rinishi, qoldiq, qidiruv, quti",
    groups: [
      {
        title: "Qoldiq (miqdor) ko'rinishi",
        fields: [
          { key: "stockDisplay", label: "Qoldiqni ko'rsatish", type: "select", default: "range", options: [
            { value: "exact", label: "Aniq miqdor (masalan 7 dona)" },
            { value: "range", label: "Diapazon (10+, 50+)" },
            { value: "available", label: "Faqat 'Mavjud' / 'Sotuvda yo'q'" },
            { value: "hidden", label: "Ko'rsatilmasin" },
          ] },
          { key: "rangeSteps", label: "Diapazon chegaralari (vergul bilan)", type: "text", default: "10,50", help: "Masalan: 10,50 → 10+ va 50+" },
          { key: "inStockLabel", label: "Mavjud matni", type: "ltext", default: L("Mavjud", "В наличии", "In stock") },
          { key: "outOfStockLabel", label: "Sotuvda yo'q matni", type: "ltext", default: L("Sotuvda yo'q", "Нет в наличии", "Out of stock") },
          { key: "showOutOfStock", label: "Sotuvda yo'q mahsulotlarni ko'rsatish", type: "boolean", default: true },
          { key: "outOfStockLast", label: "Sotuvda yo'qlarni ro'yxat oxiriga qo'yish", type: "boolean", default: true },
          { key: "allowOrderOutOfStock", label: "Qoldiq bo'lmasa ham buyurtma berishga ruxsat", type: "boolean", default: false },
          { key: "checkStockOnCheckout", label: "Buyurtmada qoldiqdan ko'p miqdorni cheklash", type: "boolean", default: true },
        ],
      },
      {
        title: "Kelganda eslating",
        fields: [
          { key: "notifyEnabled", label: "Funksiyani yoqish", type: "boolean", default: true },
          { key: "notifyLabel", label: "Tugma matni", type: "ltext", default: L("🔔 Kelganda eslating", "🔔 Сообщить о поступлении", "🔔 Notify me") },
          { key: "notifiedLabel", label: "Ro'yxatga qo'shilgandan keyingi matn", type: "ltext", default: L("✅ Xabar beramiz", "✅ Сообщим", "✅ We'll notify you") },
        ],
      },
      {
        title: "Istaklarim (yurakcha)",
        description: "Mahsulot kartochkasidagi ❤️ tugma. Mijoz bosgan mahsulotlar Profil → Istaklarim bo'limida ko'rinadi.",
        fields: [
          { key: "favoritesEnabled", label: "Funksiyani yoqish", type: "boolean", default: true },
          { key: "favoritesTitle", label: "Bo'lim nomi", type: "ltext", default: L("Istaklarim", "Избранное", "Favourites") },
          { key: "favoritesEmpty", label: "Bo'sh bo'lganda", type: "ltext", default: L("Hali hech narsa qo'shmagansiz", "Пока ничего не добавлено", "Nothing added yet") },
          { key: "favoritesEmptyHint", label: "Bo'sh bo'lganda izoh", type: "ltext", default: L("Yoqqan mahsulotdagi ❤️ ni bosing — shu yerda saqlanadi", "Нажмите ❤️ на товаре — он сохранится здесь", "Tap ❤️ on a product — it will be saved here") },
          { key: "favoriteAdded", label: "Qo'shilganda xabar", type: "ltext", default: L("❤️ Istaklarimga qo'shildi", "❤️ Добавлено в избранное", "❤️ Added to favourites") },
          { key: "favoriteRemoved", label: "Olib tashlanganda xabar", type: "ltext", default: L("Istaklarimdan olib tashlandi", "Удалено из избранного", "Removed from favourites") },
        ],
      },
      {
        title: "Mahsulot kartochkasidagi ko'rsatkichlar",
        description: "Mahsulot ochilganda izoh tarzida ko'rinadigan qo'shimcha ma'lumotlar",
        fields: [
          { key: "weeklySalesEnabled", label: "«Bu haftada X ta sotildi» ni ko'rsatish", type: "boolean", default: false },
          { key: "weeklySalesSource", label: "Ma'lumot qayerdan olinsin", type: "select", default: "bito", options: [
            { value: "bito", label: "Bito bo'yicha (do'kondagi barcha savdolar)" },
            { value: "app", label: "Mini App bo'yicha (faqat shu bot orqali berilgan buyurtmalar)" },
          ] },
          { key: "weeklySalesDays", label: "Necha kunlik davr", type: "number", default: 7, min: 1, max: 90 },
          { key: "weeklySalesRefreshMin", label: "Ma'lumotni necha daqiqada yangilash", type: "number", default: 30, min: 5, max: 720 },
          { key: "weeklySalesMin", label: "Shu sondan kam sotilgan bo'lsa ko'rsatilmasin", type: "number", default: 1, min: 1 },
          { key: "weeklySalesText", label: "Matn", type: "ltext", default: L("Bu haftada {n} ta sotildi", "На этой неделе продано {n}", "{n} sold this week"), placeholders: ["{n}"] },
          { key: "inCartCountEnabled", label: "«X ta insonning savatida» ni ko'rsatish", type: "boolean", default: false },
          { key: "inCartCountHours", label: "Savatcha necha soat ichida yangilangan bo'lsa hisoblansin", type: "number", default: 24, min: 1, max: 168 },
          { key: "inCartCountMin", label: "Shu sondan kam bo'lsa ko'rsatilmasin", type: "number", default: 2, min: 1 },
          { key: "inCartCountText", label: "Matn", type: "ltext", default: L("{n} ta insonning savatida", "У {n} человек в корзине", "In {n} people's carts"), placeholders: ["{n}"] },
        ],
      },
      {
        title: "Variantli mahsulotlar",
        description: "Bito'da variant (atribut) bilan ochilgan mahsulotlar — masalan «Futbolka / Qora / S»",
        fields: [
          { key: "variantsEnabled", label: "Variantlarni bitta kartochka ostida ko'rsatish", type: "boolean", default: true },
          { key: "variantChooseLabel", label: "Tanlash sarlavhasi", type: "ltext", default: L("Variantni tanlang", "Выберите вариант", "Choose a variant") },
          { key: "variantPickHint", label: "Tanlanmaganda tugma matni", type: "ltext", default: L("Variantni tanlang", "Выберите вариант", "Select a variant") },
          { key: "variantOutLabel", label: "Variant tugagan bo'lsa", type: "ltext", default: L("tugagan", "нет в наличии", "out of stock") },
          { key: "variantFromLabel", label: "Narx oldidagi so'z (eng arzon variant)", type: "ltext", default: L("dan", "от", "from"), help: "Masalan: «45 000 so'm dan». Bo'sh qoldirilsa — oddiy narx" },
        ],
      },
      {
        title: "Tartib va ko'rinish",
        fields: [
          { key: "sortMode", label: "Mahsulotlar tartibi", type: "select", default: "manual", options: [
            { value: "manual", label: "Qo'lda (Katalog boshqaruvi bo'limida)" },
            { value: "name_asc", label: "Nomi A → Z" },
            { value: "name_desc", label: "Nomi Z → A" },
            { value: "price_asc", label: "Narx: arzondan" },
            { value: "price_desc", label: "Narx: qimmatdan" },
            { value: "newest", label: "Yangi qo'shilganlar avval" },
          ] },
          { key: "columns", label: "Ustunlar soni", type: "number", default: 2, min: 1, max: 3 },
          { key: "showCategoryImages", label: "Kategoriya rasmlarini ko'rsatish", type: "boolean", default: true },
          { key: "showSku", label: "Artikul (SKU) ko'rsatish", type: "boolean", default: false },
          { key: "hideZeroPrice", label: "Narxi 0 bo'lgan mahsulotlarni yashirish", type: "boolean", default: true },
          { key: "quickAddEnabled", label: "Kartochkada ➕ tezkor qo'shish", type: "boolean", default: true },
          { key: "allCategoriesLabel", label: "'Barchasi' tegi", type: "ltext", default: L("Barchasi", "Все", "All") },
          { key: "catalogTitle", label: "Katalog sarlavhasi", type: "ltext", default: L("Katalog", "Каталог", "Catalog") },
          { key: "descriptionTitle", label: "Mahsulot izohi sarlavhasi", type: "ltext", default: L("Mahsulot haqida", "О товаре", "About the product") },
          { key: "noDescription", label: "Izoh yo'q matni", type: "ltext", default: L("Qo'shimcha ma'lumot mavjud emas", "Дополнительная информация отсутствует", "No additional information") },
          { key: "emptyCatalog", label: "Mahsulot topilmadi", type: "ltext", default: L("Hech narsa topilmadi 🙈", "Ничего не найдено 🙈", "Nothing found 🙈") },
        ],
      },
      {
        title: "Qidiruv",
        fields: [
          { key: "searchPlaceholder", label: "Qidiruv maydoni matni", type: "ltext", default: L("Mahsulot qidirish...", "Поиск товара...", "Search products...") },
          { key: "searchMinChars", label: "Minimal harflar soni", type: "number", default: 3, min: 1, max: 5 },
          { key: "searchFuzzy", label: "Aqlli (kirill/lotin, xatolarga chidamli) qidiruv", type: "boolean", default: true },
        ],
      },
      {
        title: "Miqdor va quti",
        fields: [
          { key: "allowManualQty", label: "Miqdorni qo'lda kiritish katakchasi", type: "boolean", default: true },
          { key: "maxQtyPerItem", label: "Bitta mahsulot uchun maksimal miqdor", type: "number", default: 1000, min: 1 },
          { key: "boxModeEnabled", label: "Quti bilan buyurtma (Bito'da 'qutidagi soni' bo'lsa)", type: "boolean", default: true },
          { key: "boxLabel", label: "Quti bo'limi nomi", type: "ltext", default: L("Quti", "Коробка", "Box") },
          { key: "pieceLabel", label: "Dona bo'limi nomi", type: "ltext", default: L("Dona", "Штука", "Piece") },
          { key: "boxHint", label: "Quti izohi", type: "ltext", default: L("qutidagi soni — {n}", "в коробке — {n}", "per box — {n}"), placeholders: ["{n}"] },
          { key: "addToCart", label: "Savatchaga qo'shish tugmasi", type: "ltext", default: L("Savatchaga qo'shish", "Добавить в корзину", "Add to cart") },
          { key: "inCartLabel", label: "Savatchada (kartochkada)", type: "ltext", default: L("Savatchada", "В корзине", "In cart") },
        ],
      },
    ],
  },
  {
    key: "checkout",
    title: "Savatcha va buyurtma",
    icon: "shopping-cart",
    description: "Buyurtmani rasmiylashtirish jarayoni",
    groups: [
      {
        title: "Turi",
        part: "order",
        fields: [
          { key: "deliveryEnabled", label: "Yetkazib berish", type: "boolean", default: true },
          { key: "pickupEnabled", label: "Olib ketish", type: "boolean", default: true },
          { key: "defaultType", label: "Standart tur", type: "select", default: "delivery", options: [
            { value: "delivery", label: "Yetkazib berish" }, { value: "pickup", label: "Olib ketish" },
          ] },
          { key: "deliveryLabel", label: "Yetkazib berish matni", type: "ltext", default: L("Yetkazib berish", "Доставка", "Delivery") },
          { key: "pickupLabel", label: "Olib ketish matni", type: "ltext", default: L("Olib ketish", "Самовывоз", "Pickup") },
          { key: "deliveryHint", label: "Yetkazib berish izohi", type: "ltext", default: L("Kuryer manzilingizga yetkazadi", "Курьер доставит по адресу", "Courier delivers to your address") },
          { key: "pickupHint", label: "Olib ketish izohi", type: "ltext", default: L("Do'kondan o'zingiz olib ketasiz", "Заберёте сами из магазина", "You pick up from the store") },
          { key: "pickupAddress", label: "Do'kon manzili (olib ketish uchun)", type: "ltext", default: L("Qo'qon sh., Istiqlol ko'chasi 1", "г. Коканд, ул. Истиклол 1", "Kokand, Istiqlol st. 1") },
          { key: "pickupLocation", label: "Do'kon joylashuvi (xaritada belgilang)", type: "latlng", default: { lat: 40.5361, lng: 70.9268 }, help: "Mijoz 'Olib ketish'ni tanlaganda shu nuqtaga Google/Yandex xarita orqali yo'nalish ola oladi" },
          { key: "pickupShowMap", label: "Olib ketishda xarita tugmalarini ko'rsatish", type: "boolean", default: true },
          { key: "pickupRouteLabel", label: "Yo'nalish tugmasi matni", type: "ltext", default: L("Yo'nalish", "Маршрут", "Directions") },
          { key: "deliveryFee", label: "Yetkazib berish narxi (0 = bepul)", type: "number", default: 0, min: 0 },
          { key: "freeDeliveryFrom", label: "Shu summadan boshlab bepul (0 = o'chirilgan)", type: "number", default: 0, min: 0 },
          { key: "minOrderTotal", label: "Minimal buyurtma summasi", type: "number", default: 0, min: 0 },
        ],
      },
      {
        title: "Manzil va xarita",
        part: "order",
        fields: [
          { key: "requireLocation", label: "Yetkazib berishda xaritadan joylashuv MAJBURIY (o'chirilsa — ixtiyoriy)", type: "boolean", default: true },
          { key: "autoAddress", label: "Xaritadan belgilanganda manzilni avtomatik yozish", type: "boolean", default: true },
          { key: "autoAddressOverwrite", label: "Avtomatik manzil qo'lda yozilganini ham almashtirsin", type: "boolean", default: false, help: "O'chirilgan bo'lsa — mijoz qo'lda yozgan manzil saqlanadi, faqat bo'sh bo'lsa to'ldiriladi" },
          { key: "mapLat", label: "Xarita markazi — kenglik (lat)", type: "number", default: 40.5286, step: 0.0001 },
          { key: "mapLng", label: "Xarita markazi — uzunlik (lng)", type: "number", default: 70.9425, step: 0.0001 },
          { key: "mapZoom", label: "Xarita masshtabi", type: "number", default: 13, min: 5, max: 19 },
          { key: "commentEnabled", label: "Izoh maydoni", type: "boolean", default: true },
        ],
      },
      {
        title: "Savatcha matnlari va xatti-harakati",
        part: "cart",
        fields: [
          { key: "cartTitle", label: "Savatcha sarlavhasi", type: "ltext", default: L("Savatcha", "Корзина", "Cart") },
          { key: "emptyCart", label: "Savatcha bo'sh", type: "ltext", default: L("Savatchangiz bo'sh", "Ваша корзина пуста", "Your cart is empty") },
          { key: "emptyCartHint", label: "Bo'sh savatcha izohi", type: "ltext", default: L("Katalogdan mahsulot tanlang", "Выберите товары в каталоге", "Pick something from the catalog") },
          { key: "goCatalog", label: "Katalogga o'tish tugmasi", type: "ltext", default: L("Katalogga o'tish", "В каталог", "Go to catalog") },
          { key: "checkoutButton", label: "Rasmiylashtirish tugmasi", type: "ltext", default: L("Buyurtmani rasmiylashtirish", "Оформить заказ", "Checkout") },
          { key: "totalLabel", label: "Jami", type: "ltext", default: L("Jami", "Итого", "Total") },
          { key: "itemsLabel", label: "Mahsulotlar", type: "ltext", default: L("Mahsulotlar", "Товары", "Items") },
          { key: "deliveryFeeLabel", label: "Yetkazib berish (summa yonida)", type: "ltext", default: L("Yetkazib berish", "Доставка", "Delivery") },
          { key: "freeLabel", label: "Bepul", type: "ltext", default: L("Bepul", "Бесплатно", "Free") },
          { key: "clearCart", label: "Savatni tozalash", type: "ltext", default: L("Tozalash", "Очистить", "Clear") },
          { key: "confirmClear", label: "Tozalashdan oldin tasdiq so'rash", type: "boolean", default: true },
          { key: "confirmClearTitle", label: "Tasdiq sarlavhasi", type: "ltext", default: L("Savatchani tozalash?", "Очистить корзину?", "Clear the cart?") },
          { key: "confirmClearText", label: "Tasdiq matni", type: "ltext", default: L("Barcha tanlangan mahsulotlar o'chib ketadi", "Все выбранные товары будут удалены", "All selected items will be removed") },
          { key: "yesLabel", label: "Ha", type: "ltext", default: L("Ha, tozalash", "Да, очистить", "Yes, clear") },
          { key: "noLabel", label: "Yo'q", type: "ltext", default: L("Yo'q", "Нет", "No") },
          { key: "swipeDelete", label: "Mahsulotni chapga surib o'chirish", type: "boolean", default: true },
          { key: "deleteLabel", label: "O'chirish (surishda)", type: "ltext", default: L("O'chirish", "Удалить", "Delete") },
          { key: "cartItemTap", label: "Savatchadagi mahsulotni bosganda tafsilotini ochish", type: "boolean", default: true },
        ],
      },
      {
        title: "Rasmiylashtirish matnlari",
        part: "order",
        fields: [
          { key: "confirmButton", label: "Tasdiqlash tugmasi", type: "ltext", default: L("Buyurtmani tasdiqlash", "Подтвердить заказ", "Confirm order") },
          { key: "checkoutTitle", label: "Rasmiylashtirish sarlavhasi", type: "ltext", default: L("Buyurtmani rasmiylashtirish", "Оформление заказа", "Checkout") },
          { key: "phoneLabel", label: "Telefon", type: "ltext", default: L("Telefon raqam", "Номер телефона", "Phone number") },
          { key: "nameLabel", label: "Ism", type: "ltext", default: L("Ismingiz", "Ваше имя", "Your name") },
          { key: "addressLabel", label: "Manzil", type: "ltext", default: L("Manzil", "Адрес", "Address") },
          { key: "addressPlaceholder", label: "Manzil maydoni matni", type: "ltext", default: L("Ko'cha, uy, kvartira...", "Улица, дом, квартира...", "Street, building, apartment...") },
          { key: "mapLabel", label: "Xarita sarlavhasi", type: "ltext", default: L("Joylashuvni belgilang", "Укажите местоположение", "Set your location") },
          { key: "myLocation", label: "Mening joylashuvim tugmasi", type: "ltext", default: L("📍 Mening joylashuvim", "📍 Моё местоположение", "📍 My location") },
          { key: "commentLabel", label: "Izoh", type: "ltext", default: L("Izoh (ixtiyoriy)", "Комментарий (необязательно)", "Comment (optional)") },
          { key: "successTitle", label: "Muvaffaqiyat sarlavhasi", type: "ltext", default: L("Buyurtma qabul qilindi!", "Заказ принят!", "Order received!") },
          { key: "successMessage", label: "Muvaffaqiyat matni", type: "ltextarea", default: L("Buyurtmangiz #{order} qabul qilindi. Kuryerimiz tez orada bog'lanadi 🚚", "Ваш заказ #{order} принят. Курьер скоро свяжется с вами 🚚", "Your order #{order} has been received. Our courier will contact you soon 🚚"), placeholders: ["{order}"] },
          { key: "successMessagePickup", label: "Muvaffaqiyat matni (olib ketish)", type: "ltextarea", default: L("Buyurtmangiz #{order} qabul qilindi. Tayyor bo'lganda xabar beramiz 🛍", "Ваш заказ #{order} принят. Сообщим, когда будет готов 🛍", "Your order #{order} has been received. We'll notify you when it's ready 🛍"), placeholders: ["{order}"] },
          { key: "autoCloseSec", label: "Necha soniyadan keyin Mini App yopilsin (0 = yopilmasin)", type: "number", default: 3, min: 0, max: 30 },
          { key: "errorStock", label: "Qoldiq yetarli emas xabari", type: "ltext", default: L("\"{product}\" uchun qoldiq yetarli emas (mavjud: {stock})", "Недостаточно остатка для \"{product}\" (доступно: {stock})", "Not enough stock for \"{product}\" (available: {stock})"), placeholders: ["{product}", "{stock}"] },
          { key: "errorMin", label: "Minimal summa xabari", type: "ltext", default: L("Minimal buyurtma summasi: {min}", "Минимальная сумма заказа: {min}", "Minimum order amount: {min}"), placeholders: ["{min}"] },
        ],
      },
    ],
  },
  {
    key: "profile",
    title: "Profil",
    icon: "user",
    description: "Profil bo'limidagi bloklar va matnlar",
    groups: [
      {
        title: "Bloklar",
        fields: [
          { key: "showBalance", label: "Balansni ko'rsatish", type: "boolean", default: true },
          { key: "showPurchases", label: "Xaridlar tarixini ko'rsatish", type: "boolean", default: true },
          { key: "showCard", label: "Sodiqlik kartasini ko'rsatish", type: "boolean", default: true },
          { key: "showLanguage", label: "Til tanlashni ko'rsatish", type: "boolean", default: true },
          { key: "showAddress", label: "Saqlangan manzilni ko'rsatish", type: "boolean", default: true },
        ],
      },
      {
        title: "Matnlar",
        fields: [
          { key: "title", label: "Sarlavha", type: "ltext", default: L("Profil", "Профиль", "Profile") },
          { key: "myOrders", label: "Mening buyurtmalarim", type: "ltext", default: L("📜 Mening buyurtmalarim", "📜 Мои заказы", "📜 My orders") },
          { key: "purchases", label: "Xaridlar tarixi", type: "ltext", default: L("🧾 Xaridlar tarixi", "🧾 История покупок", "🧾 Purchase history") },
          { key: "balance", label: "Balans", type: "ltext", default: L("💰 Balans", "💰 Баланс", "💰 Balance") },
          { key: "card", label: "Sodiqlik kartasi", type: "ltext", default: L("💳 Sodiqlik kartasi", "💳 Карта лояльности", "💳 Loyalty card") },
          { key: "language", label: "Til", type: "ltext", default: L("🌐 Til", "🌐 Язык", "🌐 Language") },
          { key: "address", label: "Manzil", type: "ltext", default: L("📍 Saqlangan manzil", "📍 Сохранённый адрес", "📍 Saved address") },
          { key: "reorder", label: "Yana buyurtma qilish tugmasi", type: "ltext", default: L("🔁 Yana shundan buyurtma qilish", "🔁 Заказать снова", "🔁 Order again") },
          { key: "reorderDone", label: "Savatga qo'shildi", type: "ltext", default: L("Mahsulotlar savatchaga qo'shildi", "Товары добавлены в корзину", "Items added to cart") },
          { key: "noOrders", label: "Buyurtmalar yo'q", type: "ltext", default: L("Hali buyurtmalar yo'q", "Заказов пока нет", "No orders yet") },
          { key: "noPurchases", label: "Xaridlar yo'q", type: "ltext", default: L("Xaridlar tarixi bo'sh", "История покупок пуста", "No purchases yet") },
          { key: "debt", label: "Qarzdorlik", type: "ltext", default: L("Qarzdorlik", "Задолженность", "Debt") },
          { key: "credit", label: "Haqdorlik", type: "ltext", default: L("Haqdorlik", "Переплата", "Credit") },
          { key: "noDebt", label: "Qarz yo'q", type: "ltext", default: L("Qarzdorlik yo'q", "Задолженности нет", "No debt") },
          { key: "orderDetails", label: "Buyurtma tafsiloti", type: "ltext", default: L("Buyurtma tafsilotlari", "Детали заказа", "Order details") },
          { key: "save", label: "Saqlash", type: "ltext", default: L("Saqlash", "Сохранить", "Save") },
          { key: "saved", label: "Saqlandi", type: "ltext", default: L("Saqlandi ✅", "Сохранено ✅", "Saved ✅") },
          { key: "support", label: "Yordam", type: "ltext", default: L("🆘 Yordam", "🆘 Помощь", "🆘 Support") },
        ],
      },
    ],
  },
];

/** Sxemadan standart qiymatlar obyektini yasash */
export function buildDefaults(): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const s of settingsSchema) {
    out[s.key] = {};
    for (const g of s.groups) for (const f of g.fields) out[s.key][f.key] = f.default;
  }
  return out;
}

export function fieldDef(section: string, key: string): FieldDef | undefined {
  const s = settingsSchema.find((x) => x.key === section);
  if (!s) return undefined;
  for (const g of s.groups) {
    const f = g.fields.find((x) => x.key === key);
    if (f) return f;
  }
  return undefined;
}
