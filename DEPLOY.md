# ☁️ Railway.com — asosiy server

Backend (`backend/`) bot + API + Mini App + Admin panelni **bitta** xizmat sifatida ishga tushiradi.
Railway manzili: `https://<nom>.up.railway.app` → Mini App `/app/`, Admin panel `/admin/`.
ngrok, Vercel, Render kerak emas.

## 1. Railway'da bir marta sozlash

1. https://railway.com → **New Project → Deploy from GitHub repo** → `Abdullayev-testbot`.
   Railway `railway.json` faylini o'zi o'qiydi (build/start buyruqlari tayyor).
2. Xizmat → **Variables** → **Raw Editor** → quyidagini qo'yib, qiymatlarni `.env` faylingizdan to'ldiring:

```
DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require
BOT_TOKEN=123456:ABC...
ADMIN_TELEGRAM_ID=5246953735
ADMIN_PASSWORD=admin123
JWT_SECRET=uzun-tasodifiy-matn
BITO_API_KEY=login:secret
TUNNEL=none
ALLOW_DEV_AUTH=false
PUBLIC_URL=
```

3. Xizmat → **Settings → Networking → Generate Domain** → manzil chiqadi (masalan `https://abdullayev-testbot-production.up.railway.app`).
4. **Variables** → `PUBLIC_URL` ga shu manzilni yozing (oxirida `/` siz) → saqlang. Xizmat qayta ishga tushadi va bot Mini App tugmasini + Bito webhook'ini avtomatik shu manzilga ulaydi.
5. **Deployments** → loglarda `🤖 Bot ishga tushdi` va `🔘 Menu tugmasi Mini App'ga ulandi` chiqsa — tayyor.

> `PORT` kiritish shart emas — Railway o'zi beradi.

## 2. Avtomatik yangilanish (GitHub → Railway)

Railway GitHub'ga ulangan: `main` branch'ga har **push** bo'lganda 2–4 daqiqada avtomatik qayta build qilib ishga tushiradi.
Tekshirish: xizmat → **Settings → Source** → *Branch: main*, *Auto deploy: yoqilgan* (standart yoqilgan).

Kompyuterdan yangilanish yuborish — bitta usul:

**`deploy.bat`** ni ikki marta bosing (commit + push, Railway o'zi deploy qiladi).

Yoki terminalda:

```bash
git add -A && git commit -m "yangilanish" && git push
```

## 3. Tekshirish

- `https://<nom>.up.railway.app/api/health` → `{"ok":true}`
- `https://<nom>.up.railway.app/admin/` → admin panel; Integratsiya → Bot bo'limida "Ommaviy manzil" = Railway manzili, "Webhook: ulangan"
- Botda `/start` → "🛍 Buyurtma berish" Mini App'ni ochadi

## 4. Muammolar

| Muammo | Yechim |
|---|---|
| Build xatosi `prisma generate` | Variables'da `DATABASE_URL` borligini tekshiring |
| Bot javob bermayapti / 409 Conflict | Bitta bot tokeni bilan **faqat bitta** server ishlashi kerak. Lokal `start.bat`, Render, boshqa nusxalar o'chirilgan bo'lsin |
| Mini App tugmasi eski manzilni ochyapti | `PUBLIC_URL` Railway manzili ekanini tekshiring, Redeploy qiling |
| Webhook "ulanmagan" | Admin panel → Bito integratsiyasi → **Webhookni ulash** |
| Deploy tushmadi | Railway → Deployments → loglar; GitHub'da push bo'lganini tekshiring (`git log origin/main -1`) |

## 5. Lokal test (ixtiyoriy)

Kompyuterda sinash uchun `start.bat` — lekin Railway ishlab turganda **botni** ikki joyda ishlatib bo'lmaydi.
Lokalda faqat Mini App/admin'ni ko'rmoqchi bo'lsangiz, `.env` ga vaqtincha boshqa test-bot tokenini qo'ying.
