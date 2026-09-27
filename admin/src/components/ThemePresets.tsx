import { Sparkles } from "lucide-react";

/** Tayyor uslub shablonlari — bosilganda bir nechta sozlama birdaniga to'ldiriladi */
export interface Preset {
  key: string;
  name: string;
  note: string;
  colors: [string, string, string];
  values: Record<string, unknown>;
}

export const PRESETS: Preset[] = [
  {
    key: "telegram", name: "Telegram", note: "Toza, shisha panel, ko'k urg'u",
    colors: ["#2AABEE", "#ffffff", "#f1f5f9"],
    values: {
      primaryColor: "#2AABEE", accentColor: "#f97316", bgColor: "#ffffff", textColor: "#0f172a",
      fontFamily: "inter", fontScale: 100, headingWeight: "700", letterSpacing: 0,
      bgStyle: "solid", surfaceStyle: "soft", cardBlur: 14, cardOpacity: 100, inputStyle: "soft",
      radius: 16, navStyle: "glass", navRadius: 0, navBlur: 20, navOpacity: 85, navActive: "pill", navLabels: true, navShadow: false,
      pageTransition: "ios", motionPreset: "smooth",
    },
  },
  {
    key: "ios26", name: "iOS 26 — Liquid Glass", note: "Shisha yuzalar, yumshoq dog'lar, suzuvchi panel",
    colors: ["#0A84FF", "#f5f7ff", "#e9efff"],
    values: {
      primaryColor: "#0A84FF", accentColor: "#FF375F", bgColor: "#f7f8fc", textColor: "#111827", bgColor2: "#e6eeff",
      fontFamily: "system", fontScale: 100, headingWeight: "700", letterSpacing: -0.2,
      bgStyle: "mesh", surfaceStyle: "glass", cardBlur: 22, cardOpacity: 75, inputStyle: "glass",
      radius: 24, navStyle: "floating", navRadius: 26, navBlur: 26, navOpacity: 70, navActive: "pill", navLabels: true, navShadow: true,
      pageTransition: "ios", motionPreset: "smooth",
    },
  },
  {
    key: "duolingo", name: "Duolingo", note: "Yorqin, qalin shrift, o'yin kayfiyati",
    colors: ["#58CC02", "#ffffff", "#FFC800"],
    values: {
      primaryColor: "#58CC02", accentColor: "#FFC800", bgColor: "#ffffff", textColor: "#3C3C3C",
      fontFamily: "rubik", fontScale: 105, headingWeight: "800", letterSpacing: 0,
      bgStyle: "solid", surfaceStyle: "flat", cardBlur: 0, cardOpacity: 100, inputStyle: "outline",
      radius: 20, navStyle: "solid", navRadius: 0, navBlur: 0, navOpacity: 100, navActive: "pill", navLabels: true, navShadow: true,
      pageTransition: "up", motionPreset: "bouncy", cardEntrance: "pop",
    },
  },
  {
    key: "spotify", name: "Spotify Dark", note: "Tungi, kontrastli, yashil urg'u",
    colors: ["#1DB954", "#121212", "#1f1f1f"],
    values: {
      primaryColor: "#1DB954", accentColor: "#1DB954", bgColor: "#121212", textColor: "#f5f5f5",
      darkMode: "on", darkBg: "#121212", darkCard: "#1c1c1c", darkText: "#f5f5f5",
      fontFamily: "montserrat", fontScale: 100, headingWeight: "800", letterSpacing: -0.2,
      bgStyle: "solid", surfaceStyle: "flat", cardOpacity: 100, inputStyle: "soft",
      radius: 14, navStyle: "solid", navRadius: 0, navBlur: 0, navOpacity: 100, navActive: "plain", navLabels: true, navShadow: false,
      pageTransition: "fade", motionPreset: "snappy",
    },
  },
  {
    key: "payme", name: "Payme / Click", note: "Ishonchli fintech ko'rinish, gradient fon",
    colors: ["#00CCCC", "#0b1f3a", "#f2f7ff"],
    values: {
      primaryColor: "#00A3A3", accentColor: "#FFB020", bgColor: "#f4f8fb", bgColor2: "#e7f5f5", textColor: "#0b1f3a",
      fontFamily: "onest", fontScale: 100, headingWeight: "700", letterSpacing: 0,
      bgStyle: "gradient", surfaceStyle: "soft", cardBlur: 10, cardOpacity: 100, inputStyle: "soft",
      radius: 18, navStyle: "glass", navRadius: 22, navBlur: 18, navOpacity: 88, navActive: "line", navLabels: true, navShadow: true,
      pageTransition: "ios", motionPreset: "smooth",
    },
  },
  {
    key: "calm", name: "Soft & Calm", note: "Yumshoq, tinch ranglar, edgeless",
    colors: ["#7C9A92", "#FBF9F4", "#EAE3D6"],
    values: {
      primaryColor: "#7C9A92", accentColor: "#C98B6B", bgColor: "#FBF9F4", bgColor2: "#F1ECE1", textColor: "#3E3A34",
      fontFamily: "nunito", fontScale: 100, headingWeight: "600", letterSpacing: 0.2,
      bgStyle: "gradient", surfaceStyle: "outline", cardBlur: 0, cardOpacity: 100, inputStyle: "outline",
      radius: 22, navStyle: "borderless", navRadius: 0, navBlur: 12, navOpacity: 92, navActive: "dot", navLabels: true, navShadow: false,
      pageTransition: "fade", motionPreset: "smooth",
    },
  },
  {
    key: "silk", name: "Ipak yo'li", note: "Markaziy Osiyo ranglari, iliq va yorqin",
    colors: ["#1F7A8C", "#F6E9D7", "#E07A5F"],
    values: {
      primaryColor: "#1F7A8C", accentColor: "#E07A5F", bgColor: "#FDF8F0", bgColor2: "#F6E9D7", textColor: "#2B2118",
      fontFamily: "manrope", fontScale: 100, headingWeight: "700", letterSpacing: 0,
      bgStyle: "mesh", surfaceStyle: "soft", cardBlur: 12, cardOpacity: 100, inputStyle: "soft",
      radius: 20, navStyle: "floating", navRadius: 24, navBlur: 18, navOpacity: 88, navActive: "pill", navLabels: true, navShadow: true,
      pageTransition: "ios", motionPreset: "smooth",
    },
  },
  {
    key: "mono", name: "Minimal Mono", note: "Oq-qora, shovqinsiz, mahsulot rasmlari asosiy",
    colors: ["#111827", "#ffffff", "#f3f4f6"],
    values: {
      primaryColor: "#111827", accentColor: "#ef4444", bgColor: "#ffffff", textColor: "#111827",
      fontFamily: "inter", fontScale: 100, headingWeight: "600", letterSpacing: -0.1,
      bgStyle: "solid", surfaceStyle: "outline", cardBlur: 0, cardOpacity: 100, inputStyle: "outline",
      radius: 12, navStyle: "borderless", navRadius: 0, navBlur: 0, navOpacity: 100, navActive: "line", navLabels: false, navShadow: false,
      pageTransition: "fade", motionPreset: "snappy",
    },
  },
];

export function ThemePresets({ onApply }: { onApply: (values: Record<string, unknown>) => void }) {
  return (
    <div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {PRESETS.map((p) => (
          <button key={p.key} type="button" onClick={() => onApply({ ...p.values, presetPicker: p.key })}
            className="text-left rounded-2xl border border-slate-200 p-3 hover:border-[var(--primary)] hover:shadow-sm transition-all">
            <div className="flex items-center gap-2 mb-2">
              {p.colors.map((c) => <span key={c} className="w-6 h-6 rounded-lg border border-black/5" style={{ background: c }} />)}
              <Sparkles size={14} className="ml-auto text-slate-300" />
            </div>
            <div className="font-semibold text-sm">{p.name}</div>
            <div className="text-xs text-slate-500 leading-snug mt-0.5">{p.note}</div>
          </button>
        ))}
      </div>
      <div className="help">Shablon bosilganda quyidagi sozlamalar to'ldiriladi — keyin istalganini alohida o'zgartirishingiz mumkin. Saqlashni unutmang.</div>
    </div>
  );
}
