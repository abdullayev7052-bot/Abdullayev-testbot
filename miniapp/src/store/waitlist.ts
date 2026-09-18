import { create } from "zustand";
import { api, type Product } from "../lib/api.ts";
import { haptic } from "../lib/telegram.ts";

interface WaitState {
  overrides: Record<number, boolean>;
  toggle: (p: Product) => Promise<boolean>;
  is: (p: Product) => boolean;
}

export const useWaitlist = create<WaitState>((set, get) => ({
  overrides: {},
  is(p) { const o = get().overrides[p.id]; return o === undefined ? p.inWaitlist : o; },
  async toggle(p) {
    const cur = get().is(p);
    const next = !cur;
    set({ overrides: { ...get().overrides, [p.id]: next } });
    try {
      if (next) await api.post("/waitlist", { productId: p.id });
      else await api.del(`/waitlist/${p.id}`);
      haptic.success();
    } catch {
      set({ overrides: { ...get().overrides, [p.id]: cur } });
      haptic.error();
    }
    return next;
  },
}));

/** Mahsulotga override qo'llash */
export function withWait(p: Product, overrides: Record<number, boolean>): Product {
  const o = overrides[p.id];
  return o === undefined ? p : { ...p, inWaitlist: o };
}
