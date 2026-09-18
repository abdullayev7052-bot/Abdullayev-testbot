# ☁️ Render.com'ga backend deploy qilish

Backend (`backend/`) bot + API + Mini App + Admin panelni **bitta** server sifatida ishga tushiradi.
Render'da deploy qilingach `https://<nom>.onrender.com/app/` — Mini App, `/admin/` — admin panel bo'ladi.
ngrok kerak emas.

## 1. Render'da xizmat yaratish

1. https://render.com → **Sign up** (GitHub bilan kiring).
2. **New +** → **Blueprint** → GitHub'dan `Abdullayev-testbot` repozitoriyasini tanlang.
   Render `render.yaml` faylini o'zi o'qiydi (build/start buyruqlari tayyor).
   *(Blueprint o'rniga **New + → Web Service** ham bo'ladi — u holda pastdagi qiymatlarni qo'lda kiriting.)*
3. **Environment** bo'limida so'ralgan qiymatlarni kiriting (`.env` faylingizdan nusxalang):

| Kalit | Qiymat |
|---|---|
| `DATABASE_URL` | Neon manzili (`postgresql://...neon.tech/neondb?sslmode=require`) |
| `BOT_TOKEN` | BotFather tokeni |
| `ADMIN_TELEGRAM_ID` | `5246953735` |
| `ADMIN_PASSWORD` | admin panel paroli |
| `BITO_API_KEY` | `login:secret` |
| `PUBLIC_URL` | **hozircha bo'sh qoldiring** — 5-qadamda to'ldirasiz |

4. **Apply / Create Web Service** → 3–5 daqiqa build bo'ladi. Loglarda `🤖 Bot ishga tushdi` chiqsa — tayyor.
5. Xizmat manzilini oling (masalan `https://bito-telegram-shop.onrender.com`) → **Environment** → `PUBLIC_URL` ga shu manzilni yozing → **Save** (xizmat qayta ishga tushadi).
   Shundan keyin bot Mini App tugmasini va Bito webhook'ini avtomatik shu manzilga ulaydi.

## 2. Qo'lda Web Service yaratsangiz (Blueprint'siz)

| Maydon | Qiymat |
|---|---|
| Runtime | Node |
| Build Command | `npm install --no-audit --no-fund && npm run db:generate && npm run build` |
| Start Command | `npm run db:check && npm start` |
| Health Check Path | `/api/health` |
| Env: `NODE_VERSION` | `22` |
| Env: `TUNNEL` | `none` |
| Env: `ALLOW_DEV_AUTH` | `false` |
| Env: `JWT_SECRET` | istalgan uzun tasodifiy matn |

Port kiritish shart emas — Render `PORT` ni o'zi beradi, backend uni o'qiydi.

## 3. Muhim: Free tarif haqida

Render **Free** tarifida server 15 daqiqa so'rov bo'lmasa **uxlab qoladi** — bot xabarlarga javob bermay qoladi,
Bito webhook'lari yo'qoladi. Ikki yo'l:

- **Starter** tarif (~$7/oy) — doim ishlaydi (tavsiya etiladi, `render.yaml`da shu tanlangan).
- Free'da qolsangiz — https://uptimerobot.com (bepul) da monitor yarating:
  `https://<nom>.onrender.com/api/health` manzilini har **5 daqiqada** tekshirsin. Server uxlamaydi.

## 4. Vercel'dagi frontend haqida

Backend Render'da Mini App va Admin panelni **o'zi** beradi (`/app/`, `/admin/`) — Vercel shart emas.
BotFather / Mini App manzili sifatida **Render manzilini** ishlating: `https://<nom>.onrender.com/app/`.

Agar baribir Vercel'dan foydalanmoqchi bo'lsangiz, Vercel loyihasi ildiziga `vercel.json` qo'shing
(API so'rovlarini Render'ga yo'naltiradi):

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://<nom>.onrender.com/api/:path*" },
    { "source": "/uploads/:path*", "destination": "https://<nom>.onrender.com/uploads/:path*" }
  ]
}
```

va Mini App `miniapp/vite.config.ts` da `base: "/app/"` ni `base: "/"` ga o'zgartiring (Vercel'da ildizda ochilishi uchun).
Lekin eng oddiy va ishonchli yo'l — hammasini Render'da qoldirish.

## 5. Yangilash

Kod o'zgarsa:

```bash
git add -A && git commit -m "yangilanish" && git push
```

Render har `push`dan keyin avtomatik qayta build qiladi (Auto-Deploy).

## 6. Tekshirish

- `https://<nom>.onrender.com/api/health` → `{"ok":true}`
- `https://<nom>.onrender.com/admin/` → admin panel (Boshqaruv panelida "Ommaviy manzil" Render manzili bo'lishi kerak)
- Botga `/start` → "🛍 Buyurtma berish" tugmasi Mini App'ni ochadi
- Admin panel → Boshqaruv paneli → **Webhook: ulangan** bo'lishi kerak

## 7. Muammolar

| Muammo | Yechim |
|---|---|
| Build'da `prisma generate` xatosi | Env'da `DATABASE_URL` borligini tekshiring |
| Bot javob bermayapti | Free tarif uxlagan → 3-bo'lim; yoki lokal kompyuterda ham `npm start` ishlab turibdi (bitta token bilan 2 ta bot polling bo'lmaydi — lokalni to'xtating) |
| Mini App tugmasi eski ngrok manzilini ochyapti | `PUBLIC_URL` ni Render manziliga o'zgartirib, Save qiling |
| Webhook "ulanmagan" | Admin panel → Bito integratsiyasi → **Webhookni ulash** tugmasi |
