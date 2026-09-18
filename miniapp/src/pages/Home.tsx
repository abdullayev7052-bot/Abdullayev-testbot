import { useState } from "react";
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
import type { Product } from "../lib/api.ts";
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

  return (
    <Page>
      <Header />
      {v<boolean>("design", "storiesShow", true) && <Stories stories={data.stories} />}
      {v<boolean>("design", "bannersShow", true) && <BannerCarousel banners={data.banners} />}

      {v<boolean>("design", "heroShow", true) && (
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
      )}

      {showFeatured && (
        <Section title={t("design", "featuredTitle")} onMore={() => nav("/catalog")}>
          <div className="flex gap-3 overflow-x-auto px-4 pb-2 hide-scroll">
            {data.featured.map((p, i) => (
              <div key={p.id} className="w-[46%] shrink-0"><ProductCard p={withWait(p, wl.overrides)} index={i} onOpen={setOpen} onWaitlist={onWaitlist} /></div>
            ))}
          </div>
        </Section>
      )}

      {showCats && (
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
      )}

      {showNew && (
        <Section title={t("design", "newTitle")}>
          <div className="flex gap-3 overflow-x-auto px-4 pb-2 hide-scroll">
            {data.newest.map((p, i) => (
              <div key={p.id} className="w-[46%] shrink-0"><ProductCard p={withWait(p, wl.overrides)} index={i} onOpen={setOpen} onWaitlist={onWaitlist} /></div>
            ))}
          </div>
        </Section>
      )}

      <ProductSheet product={open ? withWait(open, wl.overrides) : null} onClose={() => setOpen(null)} onWaitlist={onWaitlist} />
    </Page>
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
