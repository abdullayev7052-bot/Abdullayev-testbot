import { create } from "zustand";
import { api, type Bootstrap, type Lang, type LText } from "../lib/api.ts";
import { cacheDesign } from "../lib/motion.ts";
import { setHapticEnabled } from "../lib/telegram.ts";

interface AppState {
  data: Bootstrap | null;
  lang: Lang;
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  setLang: (l: Lang) => void;
  patchUser: (p: Partial<Bootstrap["user"]>) => void;
}

export const useApp = create<AppState>((set, get) => ({
  data: null,
  lang: (localStorage.getItem("lang") as Lang) || "uz",
  loading: true,
  error: null,
  async load() {
    set({ loading: true, error: null });
    try {
      const data = await api.get<Bootstrap>("/bootstrap");
      const lang = data.user.language || get().lang;
      localStorage.setItem("lang", lang);
      set({ data, lang, loading: false });
      applyTheme(data.settings.design as Record<string, unknown>);
      cacheDesign(data.settings.design as Record<string, unknown>);
      setHapticEnabled((data.settings.design as Record<string, unknown>).hapticEnabled !== false);
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },
  setLang(l) {
    localStorage.setItem("lang", l);
    set({ lang: l });
    api.put("/profile", { language: l }).catch(() => {});
  },
  patchUser(p) {
    const d = get().data;
    if (d) set({ data: { ...d, user: { ...d.user, ...p } } });
  },
}));

function applyTheme(d: Record<string, unknown>) {
  const r = document.documentElement.style;
  if (d.primaryColor) r.setProperty("--primary", String(d.primaryColor));
  if (d.accentColor) r.setProperty("--accent", String(d.accentColor));
  if (d.bgColor) { r.setProperty("--bg", String(d.bgColor)); document.querySelector('meta[name="theme-color"]')?.setAttribute("content", String(d.bgColor)); }
  if (d.textColor) r.setProperty("--text", String(d.textColor));
  if (d.radius !== undefined) r.setProperty("--radius", `${Number(d.radius)}px`);
  if (d.storiesRingColor) r.setProperty("--ring", String(d.storiesRingColor));
  document.body.classList.toggle("reduced", d.animations === "reduced" || d.animations === "off");
}

/** Sozlamalardagi ko'p tilli matn */
export function useT() {
  const lang = useApp((s) => s.lang);
  const settings = useApp((s) => s.data?.settings);
  return {
    lang,
    settings: (settings || {}) as Record<string, Record<string, unknown>>,
    /** t("catalog", "addToCart") */
    t(section: string, key: string, vars?: Record<string, string | number>): string {
      const v = settings?.[section]?.[key] as LText | string | undefined;
      let s = !v ? "" : typeof v === "string" ? v : v[lang] || v.uz || v.ru || v.en || "";
      if (vars) for (const [k, val] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(val));
      return s;
    },
    /** Bo'lim qiymati (boolean/number) */
    v<T = unknown>(section: string, key: string, def?: T): T {
      const v = settings?.[section]?.[key];
      return (v === undefined ? def : v) as T;
    },
  };
}

export function lt(v: LText | string | undefined, lang: Lang): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  return v[lang] || v.uz || v.ru || v.en || "";
}
