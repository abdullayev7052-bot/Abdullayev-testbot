import { EventEmitter } from "node:events";
import type { Order, User } from "@prisma/client";

/** Modullar orasidagi bog'liqlikni kamaytirish uchun ichki hodisalar */
export interface AppEvents {
  "order:created": [order: Order, user: User];
  "order:stage": [order: Order, prev: string | null, by: StageActor];
  "order:updated": [order: Order];
  "webhook": [payload: { collection_name: string; action: string; id: string; organization_id?: string }];
}

export type StageActor = { type: "staff"; name: string; username?: string; telegramId: string } | { type: "bito" } | { type: "customer" } | { type: "system" };

class TypedEmitter extends EventEmitter {
  emitApp<K extends keyof AppEvents>(event: K, ...args: AppEvents[K]) {
    return this.emit(event, ...args);
  }
  onApp<K extends keyof AppEvents>(event: K, fn: (...args: AppEvents[K]) => void | Promise<void>) {
    this.on(event, (...args: unknown[]) => {
      Promise.resolve((fn as (...a: unknown[]) => unknown)(...args)).catch((e) => console.error(`[event ${event}]`, e));
    });
    return this;
  }
}

export const events = new TypedEmitter();
events.setMaxListeners(50);
