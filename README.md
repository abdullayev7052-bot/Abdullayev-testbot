# 🛍 Bito Telegram Shop — Mini App + Bot + Admin panel

Bito ERP bilan to'liq integratsiyalangan Telegram do'kon:

| Qism | Nima qiladi | Manzil |
|---|---|---|
| **Backend** (`backend/`) | Telegram bot, API, Bito integratsiyasi, sinxronizatsiya | `http://localhost:4000` |
| **Mini App** (`miniapp/`) | Mijozlar uchun do'kon (Telegram ichida ochiladi) | `https://<ngrok>/app/` |
| **Admin panel** (`admin/`) | Barcha sozlamalar, storis, bannerlar, katalog, guruhlar | `http://localhost:4000/admin/` |

Mahsulotlar, narxlar, qoldiqlar, mijozlar, buyurtmalar, savdolar, to'lovlar — **hammasi Bito'dan**. Bu loyihada mahsulot qo'lda qo'shilmaydi.

---

## 1. Talablar

- **Node.js 20+** (sizda v24 o'rnatilgan) — https://nodejs.org
- **ngrok** (Mini App'ni Telegram'da ochish uchun) — pastda o'rnatish yo'riqnomasi
- Internet (Neon bazasi va Bito API uchun)

## 2. Birinchi marta ishga tushirish

Barcha kalitlar allaqachon `.env` fayliga yozilgan (baza, bot tokeni, Bito kaliti, admin ID).

**Eng oson yo'l:** `start.bat` faylini ikki marta bosing. U o'zi:
1. paketlarni o'rnatadi,
2. bazani tayyorlaydi (`prisma db push` + `seed`),
3. Mini App va Admin panelni build qiladi,
4. serverni ishga tushiradi.

**Terminal orqali (xuddi shu narsa):**

```bash
npm run setup
```

```bash
npm start
```

Terminalda shunday yozuvlar chiqadi:

```
🌍 HTTP server: http://localhost:4000  (admin: http://localhost:4000/admin/)
🤖 Bot ishga tushdi: @Birliktest_mijozbot
📡 Telegram polling faol
🔄 Katalog sinxronlandi: 109 mahsulot, 12 kategoriya
```

## 3. Har kuni ishga tushirish

Ikki oyna kerak:

1. `start.bat` (yoki `npm start`) — server + bot
2. `ngrok.bat` (yoki `ngrok http 4000`) — Mini App uchun internet manzil

Server ngrok manzilini **avtomatik aniqlaydi** (har 15 soniyada tekshiradi), botdagi "🛍 Buyurtma berish" tugmasini va pastki chap **Menu** tugmasini shu manzilga ulaydi, Bito webhook'ini ham shu manzilga obuna qiladi. Hech narsani qo'lda kiritish shart emas.

> Admin panel → Integratsiya → Bot bo'limida "Ommaviy manzil" ko'rinib turadi. ngrok topilmasa, manzilni o'sha yerda qo'lda ham kiritsa bo'ladi.

## 4. ngrok — o'rnatish va doimiy bepul domen

1. https://ngrok.com → **Sign up** (bepul).
2. O'rnatish (PowerShell):
   ```bash
   winget install ngrok.ngrok
   ```
   (yoki https://ngrok.com/download dan `ngrok.exe` yuklab, shu papkaga qo'ying)
3. ngrok saytida **Your Authtoken** bo'limidagi tokenni oling va bir marta bajaring:
   ```bash
   ngrok config add-authtoken SIZNING_TOKENINGIZ
   ```
4. **Doimiy bepul domen** (tavsiya etiladi, aks holda har ishga tushirishda manzil o'zgaradi):
   ngrok saytida **Domains → New Domain** (bepul 1 ta beriladi), masalan `birlik-shop.ngrok-free.app`.
   Shu domenni loyiha papkasida `ngrok-domain.txt` fayliga yozib qo'ying (bitta qator). `ngrok.bat` uni o'zi ishlatadi.
   Qo'lda:
   ```bash
   ngrok http --url=birlik-shop.ngrok-free.app 4000
   ```
5. Domen bo'lmasa oddiy:
   ```bash
   ngrok http 4000
   ```

ngrok ishga tushgach 10–15 soniyada terminalda `🌐 Ommaviy manzil: https://...` yozuvi chiqadi — tayyor.

## 5. Telegram — BotFather va guruh

**Mini App tugmasi** avtomatik ulanadi (`setChatMenuButton`). Qo'shimcha hech narsa shart emas. Xohlasangiz BotFather'da `/setmenubutton` → botni tanlang → manzil: `https://<domen>/app/` → nomi: `Do'kon`.

**Buyurtmalar guruhi:**
1. Telegramda guruh yarating, botni qo'shing va **administrator** qiling (xabar tahrirlashi uchun).
2. Bot guruhga qo'shilgach o'zi "Guruh ID: ..." deb yozadi. Agar botni **bosh admin** (`.env` → `ADMIN_TELEGRAM_ID`) qo'shsa — guruh avtomatik yoqiladi. Aks holda Admin panel → **Guruhlar va xodimlar** → guruhni yoqing.
3. Guruhda `/id` yozsangiz — guruh ID va sizning ID ko'rinadi.

Bosh admin botga `/admin` yozsa — admin panel va Mini App havolalarini oladi.

## 6. Admin panel

Manzil: `http://localhost:4000/admin/` · Parol: `.env` → `ADMIN_PASSWORD` (boshlang'ich `admin123`, keyin **Umumiy** bo'limida o'zgartiring).

Menyu tuzilmasi (chap tomonda; burchakdagi 🔍 yoki **Ctrl+K** — bo'lim, menyu va istalgan sozlamani nomi bo'yicha qidirish):

| Bo'lim / menyu | Nima bor |
|---|---|
| **Dashboard** | Analitika va hisobotlar: davr (bugun / 7 kun / oy / yil / ixtiyoriy), kun-hafta-oy bo'yicha guruhlash, do'kon, buyurtma turi, platforma, til filtrlari. Foydalanuvchilar (jami, yangi, DAU/WAU/MAU, DAU/MAU, faol bo'lmay qolganlar, retention D1/D7/D30, kogortalar), **sessiyalar** (o'rtacha necha daqiqa o'tiriladi, bir mijozga sessiya, tez chiqib ketganlar), buyurtmalar (soni, summa, AOV, holatlar, bekor qilish darajasi, tur/do'kon bo'yicha), funnel va konversiya (yangi/qaytgan), funksiyalardan foydalanish, qidiruv analitikasi, platforma va tillar. Tushunish qiyin ko'rsatkichlar yonida **ⓘ** — bosilsa misollar bilan tushuntiriladi |
| **Kontent → Storis** | Doira storislar, har birida bir nechta slayd (rasm/video, davomiylik, matn, havola), tugash sanasi |
| **Kontent → Banner** | Aylanma bannerlar (rasm, sarlavha, izoh, havola, matn rangi) |
| **Kontent → Post** | Mijozlarga bot orqali matn/rasm/video yuborish (tugma bilan). Filtrlar: til va **«faqat shu mahsulotni Istaklarimga qo'shganlarga»** |
| **Nazorat → Katalog boshqaruvi** | Mahsulotlarni yashirish/ko'rsatish, tavsiyaga qo'shish (★), chegirma, tartib, kategoriyalarni yashirish va tartiblash |
| **Nazorat → Kutilayotgan mahsulotlar** | Ikki bo'lim: "Kelganda eslating" so'rovlari va **Istaklarim (❤️)** — kim qaysi mahsulotni yoqtirgani, eng ko'p yoqtirilganlar |
| **Integratsiya → Bito** | Ulanish holati, sinxronizatsiya, webhook; API kalit, tashkilot, ombor, narx turi, do'konlar, narx istisnolari, sinxronizatsiya oraliqlari |
| **Integratsiya → Bot** | Bot holati, ruxsat etilgan guruhlar soni, ommaviy manzil (ngrok), Mini App manzili, bot tokeni |
| **Integratsiya → Guruh** | Buyurtma guruhlari (yoqish/o'chirish/test), holatni o'zgartira oladigan xodimlar |
| **Sozlamalar → Umumiy** | Do'kon nomi, tillar, valyuta belgisi, aloqa, admin parol |
| **Sozlamalar → Mini App → Dizayn** | Ranglar, animatsiya, splash, salomlashish, logo, storis/banner ko'rinishi, hero vidjet, bloklar, pastki navigatsiya |
| **Sozlamalar → Mini App → Katalog** | Qoldiq ko'rinishi, "Kelganda eslating", **Istaklarim (❤️)**, mahsulot kartochkasidagi ko'rsatkichlar (*bu haftada X sotildi* — Bito yoki Mini App bo'yicha; *X ta insonning savatida*), **variantli mahsulotlar**, tartib, ustunlar, qidiruv, quti rejimi |
| **Sozlamalar → Mini App → Savatcha** | Savatcha matnlari va xatti-harakati (tozalash tasdig'i, surib o'chirish, …) |
| **Sozlamalar → Mini App → Buyurtma** | Yetkazib berish / olib ketish, narxlar, minimal summa, xarita, majburiy joylashuv, rasmiylashtirish matnlari, muvaffaqiyat xabari, avto-yopilish |
| **Sozlamalar → Mini App → Profil** | Profildagi bloklar va matnlar |
| **Sozlamalar → Bot → Bot matnlari** | Salomlashish, telefon/ism so'rash, menyu tugmalari, buyurtma xabarlari, chek/to'lov matnlari, guruh xabari shabloni, kim holatni o'zgartira oladi |
| **Sozlamalar → Bot → Buyurtma holatlari** | Bito holatlariga bog'lash, guruh tugmalari, mijozga ko'rinadigan holat nomlari, holat o'zgarganda boradigan xabarlar |
| **Sozlamalar → Admin panel** | Panel nomi, logo, rang, tungi rejim |
| **Jurnal** | Bot va integratsiya faoliyati, xatolar |

Har bir matn **3 tilda** (UZ/RU/EN) — maydon ustidagi tugmalar bilan almashtiriladi. `{name}`, `{order}`, `{status}` kabi o'zgaruvchilar maydon ostida ko'rsatilgan.

## 7. Bito — boshqa akkauntga ulash

1. Bito'ga kiring → **Sozlamalar → Integratsiyalar → Maxsus integratsiya** → yangi integratsiya (rol: to'liq huquqli / egasi) → **API kalit** (`login:secret`).
2. Admin panel → **Bito integratsiyasi** → API kalitni kiriting → **Saqlash**.
3. Tizim o'zi: tashkilot, ombor, narx turi, valyuta, mas'ul xodim va buyurtma holatlarini avtomatik to'ldiradi, katalogni yuklaydi, webhookni ulaydi. Xohlasangiz "Kontekst" bo'limida boshqasini tanlab, qayta saqlang.
4. **Buyurtma holatlari** bo'limini tekshiring: Yangi / Qabul qilingan / Tayyor / Yetkazilmoqda / Bajarildi / Bekor qilingan — Bito'dagi holatlar ro'yxatidan tanlanadi (nomi mos bo'lsa avtomatik). Bito'da yangi holat qo'shsangiz (masalan "Yo'lda") — shu yerda bog'lang.

**Mahsulotlar** `Mahsulotlarni yangilash oralig'i` (standart 5 daqiqa) va Bito webhook'lari orqali yangilanadi. "Hozir sinxronlash" tugmasi bilan darhol yangilash mumkin.

## 8. Mijoz oqimi (bot)

1. `/start` → salomlashish → **telefon raqamni ulashish** (faqat o'z kontakti qabul qilinadi).
2. Raqam Bito'da bo'lsa — mijoz bog'lanadi (ismi, balansi, kartasi Bito'dan). Bo'lmasa — ism so'raladi va Bito'da yangi mijoz yaratiladi (Telegram ID ham yoziladi).
3. "Ro'yxatdan o'tdingiz" + asosiy menyu:
   `🛍 Buyurtma berish` (Mini App) · `📦 Buyurtmalar` · `🧾 Xaridlar` · `👤 Mening ma'lumotlarim` · `⚙️ Sozlamalar` (til) · `💰 Hozirgi balans` · `💳 Mening kartam` (shtrix-kod) · `📑 Akt sverka` (xlsx)
   Buyruqlar: `/buyurtmalar /xaridlar /malumotlarim /sozlamalar /balans /kartam /akt`

**Mini App:** Bosh sahifa (salomlashish, logo, storis, bannerlar, hero, tavsiya, kategoriyalar) → Katalog (aqlli qidiruv: kirill/lotin, xatolarga chidamli; kategoriya teglari; ➕ tezkor qo'shish) → Mahsulot oynasi (rasm, izoh, +/−, qo'lda miqdor, quti rejimi) → Savatcha → Rasmiylashtirish (Yetkazib berish / Olib ketish, telefon avtomatik, manzil + xarita) → Tasdiqlash → Bito'da buyurtma → bot xabari.

**Buyurtma yaratilganda:**
- Bito → CRM → Buyurtmalar bo'limida paydo bo'ladi (izohda turi, telefon, manzil, xarita havolasi; mijoz kartasida joylashuv yangilanadi).
- Mijozga bot orqali "Buyurtmangiz qabul qilindi" xabari.
- Guruhga kartochka: vaqt, mijoz, telefon, turi, raqam, holati, manzil, mahsulotlar (summasiz), tarix + tugmalar: **Bito** (buyurtma sahifasi), **Joylashuv** (Google/Yandex), **Qabul qilish → Tayyor → Yo'lga chiqish → Yetkazildi** (olib ketishda: **Olib ketildi**), **Bekor qilish**.
- Tugma bosilganda Bito'dagi holat o'zgaradi, kartochka tahrirlanadi (kim, qachon), mijozga xabar boradi. Bito'da qo'lda holat o'zgartirilsa ham (webhook + har 60 s tekshiruv) kartochka va mijoz yangilanadi.

**Avtomatik bildirishnomalar (Bito'dan):**
- Har bir **savdo** → mijozga chek (vaqt, savdo raqami, sotuvchi, mahsulotlar, jami, to'lov usullari, qarzga yozilgani, avvalgi/keyingi balans).
- Har bir **to'lov / balans to'ldirish** → summa, usul, kim qabul qilgani, tashkilot, keyingi balans.
- **"Kelganda eslating"** → Bito'da qoldiq 0 dan ko'p bo'lishi bilan xabar.

## 9. Xavfsizlik

- Telefon raqam faqat **o'z kontakti** orqali qabul qilinadi (Telegram `user_id` tekshiriladi) — boshqaning kontaktini yuborib bo'lmaydi.
- Mini App so'rovlari Telegram `initData` imzosi bilan tekshiriladi; har bir mijoz faqat o'z ma'lumotini ko'radi.
- Guruh tugmalarini faqat ruxsat etilgan guruh a'zolari yoki "Xodimlar" ro'yxatidagilar bosa oladi (sozlanadi).
- Bito webhook'lari HMAC imzo bilan tekshiriladi. Admin panel parol + cookie.
- Mijozga Bito havolalari berilmaydi — faqat matn/fayl.

## 10. Muammolar

| Muammo | Yechim |
|---|---|
| `Port 4000 ochilmadi` | `.env` da `PORT=4100` (yoki boshqa) qiling. (3000 port Windows tomonidan band bo'lgani uchun 4000 tanlangan) |
| Botda "Mini App manzili sozlanmagan" | ngrok ishlamayapti. `ngrok.bat` ni ishga tushiring, 15 soniya kuting |
| Mini App ochilmayapti / oq ekran | `npm run build` bajaring, serverni qayta ishga tushiring |
| "Bito API kaliti kiritilmagan" / 401 | Admin panel → Bito integratsiyasi → kalitni tekshiring ("Ulanishni tekshirish") |
| Buyurtma guruhga tushmayapti | Guruhlar bo'limida guruh **yoqilganmi**, bot guruhda **adminmi** |
| Holat tugmasi "Bito holati sozlanmagan" | Buyurtma holatlari bo'limida bog'lang (yoki "avtomatik bog'lash") |
| Webhook ulanmagan | Faqat Bito akkaunt **egasi** integratsiyasi obuna qila oladi; ulanmasa ham polling (60 s) ishlaydi |
| Mahsulot rasmi yo'q | Bito'da mahsulotga rasm qo'shing — keyingi sinxronizatsiyada keladi |

**Loglar:** terminal oynasi va Admin panel → Jurnal.

## 11. Terminal buyruqlari

```bash
npm run setup
```
Birinchi o'rnatish (paketlar + baza + seed + build).

```bash
npm start
```
Serverni ishga tushirish (bot + API + Mini App + Admin).

```bash
npm run build
```
Mini App va Admin panelni qayta build qilish (kod o'zgarsa).

```bash
npm run db:push
```
Baza sxemasini yangilash.

```bash
npm run db:seed
```
Boshlang'ich ma'lumotlar (xavfsiz, qayta ishlatish mumkin).

```bash
npm run db:studio
```
Bazani brauzerda ko'rish (Prisma Studio).

## 12. `.env` fayli

| Kalit | Ma'nosi |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL manzili (to'g'ridan-to'g'ri, `-pooler`siz host) |
| `BOT_TOKEN` | BotFather tokeni |
| `ADMIN_TELEGRAM_ID` | Bosh admin Telegram ID (guruhni avto-yoqish, `/admin` buyrug'i) |
| `ADMIN_PASSWORD` | Admin panel boshlang'ich paroli |
| `JWT_SECRET` | Sessiya kaliti (istalgan uzun matn) |
| `PORT` | Server porti (4000) |
| `PUBLIC_URL` | Bo'sh qoldiring — ngrok'dan avtomatik olinadi |
| `BITO_API_KEY` | Faqat birinchi ishga tushirishda bazaga yoziladi; keyin admin paneldan boshqariladi |
| `ALLOW_DEV_AUTH` | `true` bo'lsa brauzerda `http://localhost:4000/app/?dev_user=<telegram_id>` bilan test qilish mumkin (ishlab chiqarishda `false` qiling) |

## 13. Eslatma: Bito "Kutilayotgan tovarlar"

Bito'ning Integration API'sida Marketing → "Kutilayotgan tovarlar" bo'limi uchun endpoint yo'q (rasmiy OpenAPI'da mavjud emas). Shuning uchun "Kelganda eslating" ro'yxati **admin panelda** (Kutilayotgan mahsulotlar) yuritiladi va xabar Bito'dagi qoldiq o'zgarishi asosida avtomatik yuboriladi. Bito API'da bu bo'lim paydo bo'lsa, `backend/src/http/routes/app.ts` dagi `/waitlist` yo'nalishiga bitta chaqiruv qo'shish kifoya.

## 14. Mahsulot / kategoriya ID'sini qayerdan olish mumkin?

Banner, storis slaydi yoki tarqatiladigan xabar tugmasiga havola qo'yishda **ID yozish shart emas** — admin panelda
"Havola" maydonida **Mahsulot** yoki **Kategoriya** tugmasini bosib, ro'yxatdan tanlaysiz (qidiruv bor). Tizim o'zi
`product:21` yoki `category:6a84...` ko'rinishida saqlaydi va mijoz bosganda Mini App ichida o'sha mahsulot/kategoriya ochiladi.

ID'ni qo'lda ko'rmoqchi bo'lsangiz: Admin panel → **Katalog boshqaruvi** → har bir mahsulot ostida `ID 21` (bosilsa nusxalanadi),
kategoriyalarda **ID nusxalash** tugmasi.

## 15. Yangi imkoniyatlar (2026-09-20)

- **Admin panel ko'rinishi** bo'limi: panel nomi, logo, emoji, biznes nomi, rang, tungi rejim (foydalanuvchi tanlaydi / avto / doim)
- Admin panel telefonga moslashgan; brauzerda "Bosh ekranga qo'shish" qilsa — ilova kabi ochiladi (PWA)
- Mini App'da tungi rejim: Dizayn → "Tungi rejim" (o'chirilgan / doim / Telegram mavzusi / mijoz tanlaydi — Profil'da tugma)
- **Umumiy → Telegram bot**: bot tokenini almashtirish (saqlangach bot darhol yangi tokenda ishlaydi)
- **Umumiy → Yangi foydalanuvchi tili**: har doim standart til yoki Telegram tiliga qarab
- Storis va bannerlarga **GIF / ovozsiz video** (mp4) yuklash; xabar tarqatishga video, katta rasm (asl sifatda) va **tugma** (mahsulot/kategoriya/havola)
- Yuklangan fayllar bazada saqlanadi — server qayta deploy bo'lsa ham yo'qolmaydi
- Bot: "Xaridlar" va "Buyurtmalar" — qisqa ro'yxat + raqamli tugmalar, tugma bosilganda batafsil chek/buyurtma
- To'lov xabari: summa (valyuta bilan), kassa, tashkilot, har valyuta bo'yicha balans — har bir qator yoqish/o'chirish
- Chek qatorlari va guruh xabaridagi har bir qator/tugma — yoqish/o'chirish (Bot matnlari bo'limi)
- Guruh xabari: tarix Telegram "quote" ko'rinishida; ismlar profil havolasi bilan (username ko'rsatilmaydi); Bito'da mahsulotlar o'zgarsa yoki buyurtma savdoga o'tkazilsa — tarixga yoziladi va xabar yangilanadi
- Holat o'zgarganda mijozga xabar — faqat bir marta

## 16. Ko'p do'kon, narx istisnolari, chegirmalar (2026-09-21)

**Qo'shimcha tashkilotlar (do'konlar)** — Admin → *Bito integratsiyasi* → "Qo'shimcha tashkilotlar" → tugmani yoqing → "Do'kon qo'shish".
Har bir do'kon uchun: nom (3 tilda), Bito tashkiloti, ombor, narx turi, valyuta, mas'ul xodim, qoldiq manbai, olib ketish manzili va xaritadagi joyi.
Saqlangach katalog barcha do'konlar bo'yicha qayta sinxronlanadi. Mijoz Mini App (yuqoridagi 🏬 chip yoki Profil) yoki botdagi "🏬 Do'kon" tugmasi orqali do'konni tanlaydi;
mahsulotlar, narxlar, qoldiq, qarz, buyurtmalar va xaridlar tanlangan do'kon bo'yicha ko'rsatiladi. Buyurtma o'sha tashkilotga, uning ombori va narx turi bilan tushadi. Tugma o'chiq bo'lsa hech narsa o'zgarmaydi.

**Narx istisnolari** — *Bito integratsiyasi* → "Mijozlar uchun narx istisnolari" → yoqing → "Istisno qo'shish" → narx turini tanlang → "Mijoz qo'shish" (Bito mijozlari ism/telefon bo'yicha qidiriladi, bir nechtasini qo'shish mumkin).
Ro'yxatdagi mijozlar ilovada shu narxni ko'radi va buyurtma ham shu narxda tushadi.

**Chegirma** — *Katalog boshqaruvi* → mahsulotlarni belgilang → "% Chegirma" → foiz → (so'm bo'lsa) yaxlitlash: qadam 100/500/1000/5000/10000 va turi (eng yaqiniga / yuqoriga / pastga).
Mini App'da eski narx chizilgan holda va -X% belgisi bilan ko'rinadi; buyurtma Bito'ga chegirmali narx bilan tushadi. 0% — chegirmani olib tashlaydi.

**Media limitlari (o'zgartirib bo'lmaydi):** storis 15 ta (har birida 10 slayd), banner 12 ta; rasm 5 MB, GIF 10 MB, video 25 MB, xabar tarqatish fayli 50 MB, umumiy 600 MB.
Barcha yuklangan fayllar bazada saqlanadi — qayta deploy qilinganda yo'qolmaydi.

**Istaklarim (❤️):** mahsulot kartochkasidagi yurakcha — mijoz bosgan mahsulotlar *Profil → Istaklarim* da to'planadi. Admin panelda kim nimani yoqtirgani ko'rinadi (*Nazorat → Kutilayotgan mahsulotlar → Istaklarim*), va aynan shu mahsulotni yoqtirganlarga *Kontent → Post* orqali xabar yuborish mumkin. O'chirib qo'yilsa — Mini App'da yurakcha ham, "Istaklarim" bo'limi ham ko'rinmaydi.

**Variantli mahsulotlar:** Bito'da atribut bilan ochilgan mahsulot (masalan *Futbolka Adidas* → Rang: Qora/Oq/Ko'k × O'lcham: S/M/L/XL) Mini App'da **bitta kartochka** bo'lib turadi. Ochilganda atributlar tugmalari chiqadi, tanlanganda o'sha variantning narxi, qoldig'i va rasmlari ko'rsatiladi; savatchaga *"Futbolka Adidas / Ko'k / S"* ko'rinishida tushadi va Bito'ga aynan o'sha variant yuboriladi. Tugagan variantlar chizilgan holda ko'rinadi. Ota mahsulot ro'yxatda eng arzon variant narxi va variantlar qoldig'i yig'indisi bilan turadi.

**Mahsulot kartochkasidagi ko'rsatkichlar** (*Sozlamalar → Mini App → Katalog* da yoqiladi): «Bu haftada X ta sotildi» (manba: **Bito** — do'kondagi barcha savdolar, yoki **Mini App** — faqat shu bot orqali berilgan buyurtmalar; davr va yangilanish oralig'i sozlanadi) va «X ta insonning savatida» (hozir savatda turgan, lekin hali buyurtma bermagan mijozlar soni).

**Boshqa:** admin panel tili (menyu pastida UZ/RU/EN), PWA/bookmark ikonkasi = admin logo (*Admin panel ko'rinishi* → Logo), telefonda storis slaydini o'chirish tugmasi doim ko'rinadi, "Mahsulot keldi" xabaridagi tugma mahsulot kartochkasini ochadi.
