/**
 * Admin paneldagi dizayn sozlamalarini CSS o'zgaruvchilariga aylantiradi:
 * shrift, fon (gradient/mesh/rasm), kartochka uslubi (shisha/soya/chiziq), navigatsiya.
 */

type D = Record<string, unknown>;
const num = (d: D, k: string, def: number) => { const v = Number(d[k]); return Number.isFinite(v) ? v : def; };
const str = (d: D, k: string, def: string) => (typeof d[k] === "string" && d[k] ? String(d[k]) : def);

const FONTS: Record<string, { stack: string; google?: string }> = {
  system: { stack: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' },
  inter: { stack: '"Inter", -apple-system, sans-serif', google: "Inter:wght@400;500;600;700;800" },
  manrope: { stack: '"Manrope", -apple-system, sans-serif', google: "Manrope:wght@400;500;600;700;800" },
  rubik: { stack: '"Rubik", -apple-system, sans-serif', google: "Rubik:wght@400;500;600;700;800" },
  nunito: { stack: '"Nunito", -apple-system, sans-serif', google: "Nunito:wght@400;500;600;700;800" },
  poppins: { stack: '"Poppins", -apple-system, sans-serif', google: "Poppins:wght@400;500;600;700" },
  montserrat: { stack: '"Montserrat", -apple-system, sans-serif', google: "Montserrat:wght@400;500;600;700;800" },
  golos: { stack: '"Golos Text", -apple-system, sans-serif', google: "Golos+Text:wght@400;500;600;700;800" },
  onest: { stack: '"Onest", -apple-system, sans-serif', google: "Onest:wght@400;500;600;700;800" },
};

let loadedFont = "";
function loadFont(key: string) {
  const f = FONTS[key] || FONTS.system;
  if (f.google && loadedFont !== key) {
    loadedFont = key;
    const id = "app-font";
    document.getElementById(id)?.remove();
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${f.google}&display=swap`;
    document.head.appendChild(link);
  }
  return f.stack;
}

/** Mijoz o'zi tanlagan matn o'lchami (kichik/o'rtacha/katta) */
export type UserScale = "sm" | "md" | "lg";
const SCALE: Record<UserScale, number> = { sm: 0.92, md: 1, lg: 1.12 };
export function getUserScale(): UserScale {
  const v = localStorage.getItem("app-font-size");
  return v === "sm" || v === "lg" ? v : "md";
}
export function setUserScale(v: UserScale) {
  localStorage.setItem("app-font-size", v);
}

/** Barcha dizayn sozlamalarini hujjatga qo'llash */
export function applyDesign(d: D, theme: "light" | "dark" = "light") {
  const r = document.documentElement.style;
  const rootFont = 16 * (num(d, "fontScale", 100) / 100) * SCALE[getUserScale()];
  document.documentElement.style.fontSize = `${Math.round(rootFont * 100) / 100}px`;
  r.setProperty("--font", loadFont(str(d, "fontFamily", "system")));
  r.setProperty("--heading-weight", str(d, "headingWeight", "700"));
  r.setProperty("--letter-spacing", `${num(d, "letterSpacing", 0)}px`);

  // ---- Fon ----
  const bg = theme === "dark" ? str(d, "darkBg", "#0f172a") : str(d, "bgColor", "#ffffff");
  const bg2 = str(d, "bgColor2", "#eef2ff");
  const style = str(d, "bgStyle", "solid");
  let bgImage = "none";
  if (theme === "light") {
    if (style === "gradient") bgImage = `linear-gradient(180deg, ${bg2} 0%, ${bg} 55%)`;
    else if (style === "mesh") {
      bgImage = `radial-gradient(60% 45% at 12% 0%, ${bg2} 0%, transparent 60%), radial-gradient(55% 40% at 95% 8%, ${bg2} 0%, transparent 55%), radial-gradient(70% 50% at 50% 100%, ${bg2} 0%, transparent 60%)`;
    } else if (style === "image" && str(d, "bgImage", "")) {
      bgImage = `linear-gradient(${bg}${Math.round((1 - num(d, "bgImageOpacity", 100) / 100) * 255).toString(16).padStart(2, "0")}, ${bg}${Math.round((1 - num(d, "bgImageOpacity", 100) / 100) * 255).toString(16).padStart(2, "0")}), url("${str(d, "bgImage", "")}")`;
    }
  }
  r.setProperty("--bg-image", bgImage);
  r.setProperty("--bg-size", style === "image" ? "cover" : "auto");

  // ---- Kartochka yuzalari ----
  const surface = str(d, "surfaceStyle", "soft");
  const cardBase = theme === "dark" ? str(d, "darkCard", "#1e293b") : "#ffffff";
  const opacity = num(d, "cardOpacity", 100) / 100;
  const blur = num(d, "cardBlur", 14);
  const glass = surface === "glass";
  r.setProperty("--card", glass || opacity < 1 ? hexToRgba(cardBase, glass ? Math.min(opacity, 0.82) : opacity) : cardBase);
  r.setProperty("--card-blur", glass ? `saturate(180%) blur(${blur}px)` : "none");
  r.setProperty("--card-shadow", surface === "soft" ? "0 1px 2px rgba(15,23,42,.04), 0 8px 24px -12px rgba(15,23,42,.12)"
    : surface === "glass" ? "0 8px 32px -16px rgba(15,23,42,.25)" : "none");
  r.setProperty("--card-border", surface === "outline" || glass ? "1px solid var(--line)" : "1px solid transparent");
  r.setProperty("--input-bg", str(d, "inputStyle", "soft") === "outline" ? "transparent" : glass ? hexToRgba(cardBase, 0.6) : "var(--soft)");
  r.setProperty("--input-border", str(d, "inputStyle", "soft") === "soft" ? "1px solid transparent" : "1px solid var(--line)");

  // ---- Pastki navigatsiya ----
  const navStyle = str(d, "navStyle", "glass");
  const navOpacity = num(d, "navOpacity", 85) / 100;
  const navBase = theme === "dark" ? str(d, "darkCard", "#1e293b") : "#ffffff";
  r.setProperty("--nav-h", `${num(d, "navHeight", 64)}px`);
  r.setProperty("--nav-radius", `${num(d, "navRadius", 0)}px`);
  r.setProperty("--nav-bg", navStyle === "solid" ? navBase : hexToRgba(navBase, navOpacity));
  r.setProperty("--nav-blur", navStyle === "glass" || navStyle === "floating" ? `saturate(180%) blur(${num(d, "navBlur", 18)}px)` : "none");
  r.setProperty("--nav-border", navStyle === "borderless" || navStyle === "floating" ? "none" : "1px solid var(--line)");
  r.setProperty("--nav-shadow", d.navShadow === false ? "none" : navStyle === "floating" ? "0 10px 30px -10px rgba(15,23,42,.3)" : "0 -2px 20px -12px rgba(15,23,42,.25)");
  r.setProperty("--nav-margin", navStyle === "floating" ? "10px" : "0px");
}

function hexToRgba(hex: string, a: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return hex;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${a})`;
}
