/**
 * Admin paneldagi rang sozlamalari yorug' rejim uchun mo'ljallangan.
 * Tungi rejimda ular qo'llanilsa matn ko'rinmay qoladi, shuning uchun:
 * tungi rejimda alohida rang berilgan bo'lsa — o'sha, aks holda ilovaning o'z rangi (--text / --muted).
 */
export function themedColor(theme: "light" | "dark", light: string | undefined, dark: string | undefined, fallback = "var(--text)"): string {
  const pick = theme === "dark" ? dark : light;
  const v = (pick || "").trim();
  return v || fallback;
}
