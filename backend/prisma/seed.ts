/**
 * Boshlang'ich ma'lumotlar: .env dagi Bito kaliti, bosh admin, namunaviy banner/storis.
 * Bir necha marta ishga tushirsa ham xavfsiz (mavjudlarini o'zgartirmaydi).
 */
import { env } from "../src/env.ts";
import { prisma } from "../src/db.ts";
import { loadSettings, updateSection } from "../src/settings/store.ts";
import { setAdminPassword, getAdminPasswordHash } from "../src/http/auth.ts";
import { ensureContext, syncCatalog } from "../src/bito/sync.ts";

async function main() {
  await prisma.$connect();
  const s = await loadSettings();

  if (!s.bito.apiKey && env.BITO_API_KEY) {
    await updateSection("bito", { apiKey: env.BITO_API_KEY, apiUrl: env.BITO_API_URL, filesUrl: env.BITO_FILES_URL });
    console.log("✔ Bito API kaliti bazaga yozildi");
  }

  const authRow = await prisma.setting.findUnique({ where: { key: "auth" } });
  if (!authRow) {
    await setAdminPassword(env.ADMIN_PASSWORD);
    console.log("✔ Admin paroli o'rnatildi (.env → ADMIN_PASSWORD)");
  } else {
    await getAdminPasswordHash();
  }

  if (env.ADMIN_TELEGRAM_ID) {
    await prisma.staff.upsert({ where: { telegramId: env.ADMIN_TELEGRAM_ID }, create: { telegramId: env.ADMIN_TELEGRAM_ID, name: "Bosh admin", role: "admin" }, update: { role: "admin" } });
    console.log("✔ Bosh admin xodimlar ro'yxatiga qo'shildi");
  }

  if ((await prisma.banner.count()) === 0) {
    await prisma.banner.create({ data: { image: "/uploads/sample-banner.svg", title: "Xush kelibsiz!", subtitle: "Bannerlarni admin paneldan o'zgartiring", textColor: "#ffffff", sortOrder: 1 } });
    console.log("✔ Namunaviy banner qo'shildi");
  }

  try {
    await ensureContext();
    const r = await syncCatalog("seed");
    console.log("✔ Bito katalogi:", r?.message);
  } catch (e) {
    console.log("⚠ Bito bilan sinxronizatsiya qilinmadi:", (e as Error).message);
  }
  await prisma.$disconnect();
  console.log("✅ Seed yakunlandi");
}

main().catch((e) => { console.error(e); process.exit(1); });
