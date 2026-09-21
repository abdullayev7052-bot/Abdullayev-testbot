import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "../lib/api.ts";
import { track } from "../lib/analytics.ts";

export interface CartItem {
  productId: number;
  qty: number;        // umumiy dona (quti bo'lsa ham donaga aylantirilgan)
  boxCount: number;   // nechta quti (0 = dona rejimi)
  name: string;
  price: number;
  image: string | null;
  measure: string | null;
  boxItem: number;
  stock: number;
}

interface CartState {
  items: CartItem[];
  add: (p: Product, qty: number, boxCount?: number) => void;
  setQty: (productId: number, qty: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
  refreshSnapshot: (rows: { id: number; price: number; stock: number; name: string; image: string | null; boxItem: number; measure: string | null; available: boolean }[]) => void;
  count: () => number;
  total: () => number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add(p, qty, boxCount = 0) {
        track("add_to_cart", { productId: p.id, name: p.name, qty });
        const items = [...get().items];
        const i = items.findIndex((x) => x.productId === p.id);
        const snap = { name: p.name, price: p.price, image: p.image, measure: p.measure, boxItem: p.boxItem, stock: p.stock };
        if (i >= 0) items[i] = { ...items[i], ...snap, qty: items[i].qty + qty, boxCount: items[i].boxCount + boxCount };
        else items.push({ productId: p.id, qty, boxCount, ...snap });
        set({ items });
      },
      setQty(productId, qty) {
        if (qty <= 0) { set({ items: get().items.filter((x) => x.productId !== productId) }); return; }
        set({ items: get().items.map((x) => (x.productId === productId ? { ...x, qty, boxCount: x.boxItem > 0 && qty % x.boxItem === 0 && x.boxCount > 0 ? qty / x.boxItem : 0 } : x)) });
      },
      remove(productId) { set({ items: get().items.filter((x) => x.productId !== productId) }); },
      clear() { set({ items: [] }); },
      refreshSnapshot(rows) {
        const items = get().items
          .map((it) => { const r = rows.find((x) => x.id === it.productId); return r ? (r.available ? { ...it, price: r.price, stock: r.stock, name: r.name, image: r.image, boxItem: r.boxItem, measure: r.measure } : null) : it; })
          .filter(Boolean) as CartItem[];
        set({ items });
      },
      count: () => get().items.reduce((a, x) => a + x.qty, 0),
      total: () => get().items.reduce((a, x) => a + x.qty * x.price, 0),
    }),
    { name: "cart-v1" },
  ),
);
