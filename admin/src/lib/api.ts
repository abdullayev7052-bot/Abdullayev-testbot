export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

const BASE = "/api/admin";

async function request<T>(method: string, path: string, body?: unknown, raw?: FormData): Promise<T> {
  const r = await fetch(BASE + path, {
    method,
    credentials: "include",
    headers: raw ? {} : { "Content-Type": "application/json" },
    body: raw ? raw : body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
  if (r.status === 401 && !path.startsWith("/login")) {
    window.dispatchEvent(new CustomEvent("admin-unauthorized"));
  }
  if (!r.ok) throw new ApiError(((json || {}) as { error?: string }).error || `Xatolik (${r.status})`, r.status);
  return json as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
  upload: async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append("file", file);
    const r = await request<{ path: string }>("POST", "/upload", undefined, fd);
    return r.path;
  },
};

export type Lang = "uz" | "ru" | "en";
export type LText = Record<Lang, string>;
export interface FieldDef { key: string; label: string; type: string; help?: string; default: unknown; options?: { value: string; label: string }[]; source?: string; min?: number; max?: number; step?: number; placeholders?: string[] }
export interface GroupDef { title: string; description?: string; part?: string; fields: FieldDef[] }
export interface SectionDef { key: string; title: string; icon: string; description?: string; groups: GroupDef[] }
export type Settings = Record<string, Record<string, unknown>>;
export type Options = Record<string, { value: string; label: string }[]> & { ok?: boolean; error?: string };
