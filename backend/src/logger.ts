import { prisma } from "./db.ts";

function ts() {
  return new Date().toLocaleTimeString("uz-UZ", { hour12: false });
}

export const log = {
  info: (...a: unknown[]) => console.log(`[${ts()}]`, ...a),
  warn: (...a: unknown[]) => console.warn(`[${ts()}] ⚠️`, ...a),
  error: (...a: unknown[]) => console.error(`[${ts()}] ❌`, ...a),
};

/** Admin panelda ko'rinadigan faoliyat jurnali */
export async function activity(type: string, message: string, meta?: unknown) {
  log.info(`[${type}] ${message}`);
  try {
    await prisma.activityLog.create({ data: { type, message, meta: meta === undefined ? undefined : (meta as object) } });
  } catch {
    /* jurnal yozilmasa ham ish davom etadi */
  }
}

export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
