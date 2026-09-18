/**
 * Aqlli qidiruv: kirill/lotin, apostroflar, x/h, q/k kabi farqlarga chidamli.
 * "Baxtiyor" ≈ "Baxtiyer" ≈ "бахтиер"
 */

const CYR: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "ts", ч: "ch", ш: "sh", щ: "sh",
  ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya", ў: "o", қ: "q", ғ: "g", ҳ: "h",
};

export function translit(s: string): string {
  let out = "";
  for (const ch of s.toLowerCase()) out += ch in CYR ? CYR[ch] : ch;
  return out;
}

/** Qidiruv kaliti: kichik harf, lotin, apostrofsiz, x=h, q=k, ye=e, yo=o, diakritikasiz */
export function looseKey(s: string): string {
  return translit(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ʻʼ’'`´‘]/g, "")
    .replace(/h/g, "x")
    .replace(/q/g, "k")
    .replace(/w/g, "v")
    .replace(/c(?!h)/g, "s")
    .replace(/ye/g, "e")
    .replace(/yo/g, "o")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  const t = ` ${s} `;
  for (let i = 0; i < t.length - 1; i++) {
    const b = t.slice(i, i + 2);
    m.set(b, (m.get(b) || 0) + 1);
  }
  return m;
}

/** Dice koeffitsienti (0..1) */
export function dice(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = bigrams(a), B = bigrams(b);
  let shared = 0, total = 0;
  for (const [k, v] of A) { total += v; if (B.has(k)) shared += Math.min(v, B.get(k)!); }
  for (const v of B.values()) total += v;
  return (2 * shared) / total;
}

/** Mahsulot uchun oldindan hisoblangan kalit */
export function buildSearchKey(...parts: (string | null | undefined)[]): string {
  return looseKey(parts.filter(Boolean).join(" "));
}

/**
 * Ball: 0 — mos emas. 1 — to'liq/qism sifatida mos. 0.5..0.99 — o'xshash.
 */
export function matchScore(query: string, key: string, fuzzy = true): number {
  const q = looseKey(query);
  if (!q) return 0;
  if (!key) return 0;
  if (key.includes(q)) return key.startsWith(q) ? 1 : 0.95;
  const qWords = q.split(" ").filter(Boolean);
  const kWords = key.split(" ").filter(Boolean);
  // barcha so'zlar qism sifatida topilsa
  if (qWords.length > 1 && qWords.every((w) => kWords.some((k) => k.includes(w)))) return 0.9;
  if (!fuzzy) return 0;
  let best = 0;
  for (const qw of qWords) {
    let wBest = 0;
    for (const kw of kWords) {
      if (kw.includes(qw)) { wBest = 0.9; break; }
      const d = dice(qw, kw);
      if (d > wBest) wBest = d;
      // so'z boshi bilan solishtirish (uzun so'zlar ichida)
      if (kw.length > qw.length) {
        const d2 = dice(qw, kw.slice(0, qw.length + 1));
        if (d2 > wBest) wBest = d2 * 0.97;
      }
    }
    best += wBest;
  }
  best = best / qWords.length;
  return best >= 0.55 ? best : 0;
}
