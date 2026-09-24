import { create } from "zustand";
import { api, type Product } from "../lib/api.ts";

interface FavState {
  /** productId → yoqtirilganmi (server javobidan farqli, darhol o'zgaradi) */
  overrides: Record<number, boolean>;
  ids: Set<number>;
  loaded: boolean;
  load: () => Promise<void>;
  toggle: (p: Product) => Promise<boolean>;
  isFav: (p: Pick<Product, "id" | "favorite">) => boolean;
}

export const useFavorites = create<FavState>((set, get) => ({
  overrides: {},
  ids: new Set(),
  loaded: false,
  async load() {
    try {
      const r = await api.get<{ enabled: boolean; items: Product[] }>("/favorites");
      set({ ids: new Set(r.items.map((p) => p.id)), loaded: true, overrides: {} });
    } catch { set({ loaded: true }); }
  },
  async toggle(p) {
    const next = !get().isFav(p);
    set({ overrides: { ...get().overrides, [p.id]: next } });
    const ids = new Set(get().ids);
    if (next) ids.add(p.id); else ids.delete(p.id);
    set({ ids });
    try {
      if (next) await api.post("/favorites", { productId: p.id });
      else await api.del(`/favorites/${p.id}`);
    } catch {
      set({ overrides: { ...get().overrides, [p.id]: !next } });
    }
    return next;
  },
  isFav(p) {
    const o = get().overrides[p.id];
    return o === undefined ? get().ids.has(p.id) || !!p.favorite : o;
  },
}));

/** Ro'yxatdagi mahsulotga joriy "yoqtirilgan" holatini qo'llash */
export function withFav<T extends Product>(p: T, s: Pick<FavState, "overrides" | "ids">): T {
  const o = s.overrides[p.id];
  return { ...p, favorite: o === undefined ? s.ids.has(p.id) || !!p.favorite : o };
}
