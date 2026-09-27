import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ChevronRight } from "lucide-react";
import { useApp, useT } from "../store/app.ts";
import { Header } from "../components/Header.tsx";
import { Stories } from "../components/Stories.tsx";
import { BannerCarousel } from "../components/BannerCarousel.tsx";
import { ProductCard } from "../components/ProductCard.tsx";
import { ProductSheet } from "../components/ProductSheet.tsx";
import { Page, Img, useToast } from "../components/ui.tsx";
import { useWaitlist, withWait } from "../store/waitlist.ts";
import type { HomeBlock, Product } from "../lib/api.ts";
import { haptic } from "../lib/telegram.ts";

export function Home() {
  const { t, v } = useT();
  const data = useApp((s) => s.data)!;
  const nav = useNavigate();
  const [open, setOpen] = useState<Product | null>(null);
  const wl = useWaitlist();
  const toast = useToast((s) => s.show);
  const onWaitlist = async (p: Product) => {
    const next = await wl.toggle(p);
    toast(next ? t("catalog", "notifiedLabel") : t("catalog", "notifyLabel"));
    if (open && open.id === p.id) setOpen({ ...open, inWaitlist: next });
  };
  const topCats = data.categories.filter((c) => !c.parentId);
  const showFeatured = v<boolean>("design", "featuredShow", true) && data.featured.length > 0;
  const showNew = v<boolean>("design", "newShow", false) && data.newest.length > 0;
  const showCats = v<boolean>("design", "categoriesShow", true) && topCats.length > 0;
  const blocks = data.blocks || [];

  // Bosh sahifa tartibi (admin panelda sozlanadi); bo'sh bo'lsa — standart tartib
  const order = useMemo(() => {
    const cfg = (v<{ key: string; show?: boolean }[]>("design", "homeOrder", []) || []).filter((r) => r && r.key);
    const defaults = ["stories", "banners", "hero", "featured", "categories", "new", ...blocks.map((b) => b.key)];
    const rows = cfg.length ? cfg.filter((r) => r.show !== false).map((r) => r.key) : defaults;
    for (const k of defaults) if (!rows.includes(k) && !cfg.some((r) => r.key === k)) rows.push(k);
    return rows;
  }, [v, blocks]);

  const renderRow = (key: string) => {
    if (key === "stories") return v<boolean>("design", "storiesShow", true) ? <Stories key="stories" stories={data.stories} /> : null;
    if (key === "banners") return v<boolean>("design", "bannersShow", true) ? <BannerCarousel key="banners" banners={data.banners} /> : null;
    if (key === "hero") return v<boolean>("design", "heroShow", true) ? hero : null;
    if (key === "featured") return showFeatured ? featuredRow : null;
    if (key === "categories") return showCats ? catsRow : null;
    if (key === "new") return showNew ? newRow : null;
    const b = blocks.find((x) => x.key === key);
    return b ? <BlockRow key={b.key} b={b} onOpen={setOpen} onWaitlist={onWaitlist} overrides={wl.overrides} /> : null;
  };

  const hero = (
    <motion.div className="wrap my-3" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <motion.button whileTap={{ scale: 0.98 }} onClick={() => { haptic.medium(); nav("/catalog"); }}
              className="w-full text-left rounded-[var(--radius)] p-5 text-white relative overflow-hidden shadow-lg"
              style={{ background: `linear-gradient(135deg, ${v<string>("design", "heroColor", "#2563eb")}, ${v<string>("design", "heroColor2", "#7c3aed")})` }}>
              <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/10" />
              <div className="absolute right-6 bottom-2 text-6xl opacity-90 select-none">{v<string>("design", "heroEmoji", "🛍")}</div>
              <div className="text-xl font-bold">{t("design", "heroTitle")}</div>
              <div className="text-sm opacity-90 mt-1 max-w-[70%]">{t("design", "heroSubtitle")}</div>
              <div className="inline-flex items-center gap-1.5 mt-4 bg-white/20 backdrop-blur px-3.5 py-2 rounded-xl text-sm font-semibold">
                {t("design", "heroButton")} <ArrowRight size={16} />
              </div>
            </motion.button>
          </motion.div>
  );
  const featuredRow = (
    <Section title={t("design", "featuredTitle")} onMore={() => nav("/catalog")}>
            <div className="flex gap-3 overflow-x-auto px-4 pb-2 hide-scroll items-stretch">
              {data.featured.map((p, i) => (
                <div key={p.id} className="w-[46%] shrink-0"><ProductCard p={withWait(p, wl.overrides)} index={i} onOpen={setOpen} onWaitlist={onWaitlist} /></div>
              ))}
            </div>
          </Section>
  );
  const catsRow = (
    <Section title={t("design", "categoriesTitle")} onMore={() => nav("/catalog")}>
            <div className="grid grid-cols-2 gap-3 px-4">
              {topCats.slice(0, 8).map((c, i) => (
                <motion.button key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }} whileTap={{ scale: 0.97 }}
                  onClick={() => { haptic.light(); nav(`/catalog?category=${c.id}`); }} className="card flex items-center gap-3 p-2.5 text-left">
                  {v<boolean>("catalog", "showCategoryImages", true) && <Img src={c.image} className="w-12 h-12 rounded-xl shrink-0" fallback="📦" />}
                  <div className="min-w-0"><div className="text-sm font-semibold truncate">{c.name}</div><div className="text-xs text-slate-400">{c.count}</div></div>
                </motion.button>
              ))}
            </div>
          </Section>
  );
  const newRow = (
    <Section title={t("design", "newTitle")}>
            <div className="flex gap-3 overflow-x-auto px-4 pb-2 hide-scroll items-stretch">
              {data.newest.map((p, i) => (
                <div key={p.id} className="w-[46%] shrink-0"><ProductCard p={withWait(p, wl.overrides)} index={i} onOpen={setOpen} onWaitlist={onWaitlist} /></div>
              ))}
            </div>
          </Section>
  );

  return (
    <Page>
      <Header />
      {order.map((k) => <div key={k}>{renderRow(k)}</div>)}
      <ProductSheet product={open ? withWait(open, wl.overrides) : null} onClose={() => setOpen(null)} onWaitlist={onWaitlist} />
    </Page>
  );
}

/** Admin panelda yaratilgan blok: mahsulotlar qatori yoki rasmli mini bloklar */
function BlockRow({ b, onOpen, onWaitlist, overrides }: { b: HomeBlock; onOpen: (p: Product) => void; onWaitlist: (p: Product) => void; overrides: Record<number, boolean> }) {
  const nav = useNavigate();
  const style = b.style || {};
  if (b.kind === "chips") {
    const size = Number(style.size || 72);
    const shape = String(style.shape || "circle");
    const radius = shape === "circle" ? size : shape === "square" ? 0 : Number(style.radius ?? 16);
    return (
      <Section title={b.title}>
        <div className="flex gap-3 overflow-x-auto px-4 pb-2 hide-scroll items-stretch">
          {(b.entries || []).map((e, i) => (
            <motion.button key={e.value} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i }} whileTap={{ scale: 0.95 }}
              onClick={() => { haptic.light(); nav(`/catalog?f_${encodeURIComponent(b.fieldKey || "")}=${encodeURIComponent(e.value)}`); }}
              className="shrink-0 flex flex-col items-center gap-1.5" style={{ width: size + 12 }}>
              <div className="overflow-hidden bg-slate-100 flex items-center justify-center" style={{ width: size, height: size, borderRadius: radius }}>
                {e.image ? <Img src={e.image} className="w-full h-full" /> : <span className="text-xl">🏷</span>}
              </div>
              {style.showTitle !== false && <span className="text-[11px] leading-tight text-center line-clamp-2" style={{ width: size + 10 }}>{e.title || e.value}</span>}
            </motion.button>
          ))}
        </div>
      </Section>
    );
  }
  return (
    <Section title={b.title} onMore={() => nav("/catalog")}>
      <div className="flex gap-3 overflow-x-auto px-4 pb-2 hide-scroll items-stretch">
        {(b.items || []).map((p, i) => (
          <div key={p.id} className="w-[46%] shrink-0"><ProductCard p={withWait(p, overrides)} index={i} onOpen={onOpen} onWaitlist={onWaitlist} /></div>
        ))}
      </div>
    </Section>
  );
}

function Section({ title, children, onMore }: { title: string; children: React.ReactNode; onMore?: () => void }) {
  return (
    <motion.section className="mt-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
      <div className="wrap flex items-center justify-between mb-2">
        <h2 className="text-base font-bold">{title}</h2>
        {onMore && <button onClick={onMore} className="text-sm text-slate-400 flex items-center">→<ChevronRight size={16} /></button>}
      </div>
      {children}
    </motion.section>
  );
}
