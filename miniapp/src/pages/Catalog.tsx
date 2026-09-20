import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { Search, X } from "lucide-react";
import { api, type Product, type ProductPage } from "../lib/api.ts";
import { useApp, useT } from "../store/app.ts";
import { ProductCard } from "../components/ProductCard.tsx";
import { ProductSheet } from "../components/ProductSheet.tsx";
import { Page, Skeleton, Empty, useToast, Img } from "../components/ui.tsx";
import { useWaitlist, withWait } from "../store/waitlist.ts";
import { haptic } from "../lib/telegram.ts";

function useDebounced<T>(v: T, ms: number): T {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

export function Catalog() {
  const { t, v } = useT();
  const data = useApp((s) => s.data)!;
  const [params, setParams] = useSearchParams();
  const category = params.get("category") || "";
  const [q, setQ] = useState(params.get("q") || "");
  const dq = useDebounced(q.trim(), 250);
  const minChars = v<number>("catalog", "searchMinChars", 3);
  const effQ = dq.length >= minChars ? dq : "";
  const [open, setOpen] = useState<Product | null>(null);
  const wl = useWaitlist();
  const toast = useToast((s) => s.show);
  const cols = v<number>("catalog", "columns", 2);
  const sentinel = useRef<HTMLDivElement>(null);

  const query = useInfiniteQuery({
    queryKey: ["products", category, effQ],
    queryFn: ({ pageParam }) => api.get<ProductPage>(`/products?page=${pageParam}&limit=40&category=${encodeURIComponent(category)}&q=${encodeURIComponent(effQ)}`),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    staleTime: 20000,
  });
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) || [], [query.data]);
  const total = query.data?.pages[0]?.total ?? 0;

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting && query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage(); }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage, query]);

  // ?product=ID orqali ochish (banner havolasi)
  useEffect(() => {
    const pid = params.get("product");
    if (pid) api.get<Product>(`/products/${pid}`).then(setOpen).catch(() => {});
  }, [params]);

  const onWaitlist = async (p: Product) => {
    const next = await wl.toggle(p);
    toast(next ? t("catalog", "notifiedLabel") : t("catalog", "notifyLabel"));
    if (open && open.id === p.id) setOpen({ ...open, inWaitlist: next });
  };
  const setCategory = (id: string) => { haptic.select(); const p = new URLSearchParams(params); if (id) p.set("category", id); else p.delete("category"); setParams(p, { replace: true }); };

  const cats = data.categories;
  // Chips: barchasi + tanlangan kategoriya yo'li + shu darajadagi kategoriyalar
  const chips = useMemo(() => {
    const current = cats.find((c) => c.id === category);
    const level = current ? (cats.some((c) => c.parentId === current.id) ? current.id : current.parentId) : null;
    const siblings = cats.filter((c) => (c.parentId || null) === (level || null));
    const trail: typeof cats = [];
    let cur = current;
    while (cur) { trail.unshift(cur); cur = cats.find((c) => c.id === cur!.parentId) || undefined; }
    return { siblings, trail, level };
  }, [cats, category]);

  return (
    <Page>
      <div className="sticky top-0 z-[450] bg-white/95 backdrop-blur safe-top">
        <div className="wrap pt-3 pb-2">
          <div className="text-2xl font-bold mb-2">{t("catalog", "catalogTitle")}</div>
          <div className="relative">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("catalog", "searchPlaceholder")} className="input pl-10 pr-10 py-3 rounded-2xl bg-slate-50 border-transparent" />
              {q && (
                <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center"><X size={14} /></motion.button>
              )}
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 hide-scroll">
          <button className={`chip ${!category ? "active" : ""}`} onClick={() => setCategory("")}>{t("catalog", "allCategoriesLabel")}</button>
          {chips.trail.map((c) => (
            <button key={c.id} className={`chip ${c.id === category ? "active" : ""}`} onClick={() => setCategory(c.parentId && c.id === category ? c.parentId : c.id)}>{c.name}</button>
          ))}
          {chips.siblings.filter((c) => !chips.trail.some((x) => x.id === c.id)).map((c) => (
            <button key={c.id} className={`chip ${c.id === category ? "active" : ""}`} onClick={() => setCategory(c.id)}>
              {v<boolean>("catalog", "showCategoryImages", true) && c.image ? <Img src={c.image} className="inline-block w-5 h-5 rounded-full mr-1.5 align-middle" /> : null}{c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="wrap pt-2">
        {query.isLoading ? (
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="card overflow-hidden"><Skeleton className="aspect-square rounded-none" /><div className="p-3 space-y-2"><Skeleton className="h-3 w-4/5" /><Skeleton className="h-3 w-2/5" /><Skeleton className="h-8 w-full mt-2" /></div></div>)}
          </div>
        ) : items.length === 0 ? (
          <Empty emoji="🔍" title={t("catalog", "emptyCatalog")} />
        ) : (
          <>
            {effQ && <div className="text-xs text-slate-400 mb-2">{total} · «{effQ}»</div>}
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
              {items.map((p, i) => <ProductCard key={p.id} p={withWait(p, wl.overrides)} index={i % 40} onOpen={setOpen} onWaitlist={onWaitlist} />)}
            </div>
            <div ref={sentinel} className="h-6" />
            {query.isFetchingNextPage && <div className="text-center text-xs text-slate-400 py-3">…</div>}
          </>
        )}
      </div>
      <ProductSheet product={open ? withWait(open, wl.overrides) : null} onClose={() => { setOpen(null); if (params.get("product")) { const p = new URLSearchParams(params); p.delete("product"); setParams(p, { replace: true }); } }} onWaitlist={onWaitlist} />
    </Page>
  );
}
