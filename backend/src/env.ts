import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const BACKEND_DIR = path.resolve(__dirname, "..");

// Bitta .env fayl — loyiha ildizida. (Zaxira: backend/.env)
for (const p of [path.join(ROOT_DIR, ".env"), path.join(BACKEND_DIR, ".env")]) {
  if (fs.existsSync(p)) dotenv.config({ path: p, override: false, quiet: true });
}

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`.env faylida ${name} ko'rsatilmagan`);
  return v;
}

export const env = {
  DATABASE_URL: req("DATABASE_URL"),
  BOT_TOKEN: req("BOT_TOKEN"),
  ADMIN_TELEGRAM_ID: process.env.ADMIN_TELEGRAM_ID || "",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "admin123",
  JWT_SECRET: process.env.JWT_SECRET || "change-me-secret",
  PORT: Number(process.env.PORT || 4000),
  PUBLIC_URL: (process.env.PUBLIC_URL || "").replace(/\/+$/, ""),
  BITO_API_KEY: process.env.BITO_API_KEY || "",
  BITO_API_URL: process.env.BITO_API_URL || "https://api.bito.uz/integration-api/integration/api/v2",
  BITO_FILES_URL: process.env.BITO_FILES_URL || "https://api.bito.uz/upload-api/public",
  ALLOW_DEV_AUTH: process.env.ALLOW_DEV_AUTH === "true",
  ROOT_DIR,
  BACKEND_DIR,
  UPLOADS_DIR: path.join(BACKEND_DIR, "uploads"),
};
