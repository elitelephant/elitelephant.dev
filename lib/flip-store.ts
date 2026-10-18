// State shared by the card and the scene. The scene reads it every frame with get(), without re-rendering.
import { useSyncExternalStore } from "react";

export type FlipState = {
  flipped: boolean;
  cardEl: HTMLElement | null;
};

// The server always renders the front.
const SERVER: FlipState = { flipped: false, cardEl: null };

let state = SERVER;
const listeners = new Set<() => void>();
const kicks = new Set<(flipped: boolean) => void>();

export const flipStore = {
  get: () => state,
  set(patch: Partial<FlipState>) {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
  // The card passing edge-on (90°) pushes the air; `flipped` is the face now showing.
  onKick(fn: (flipped: boolean) => void) {
    kicks.add(fn);
    return () => void kicks.delete(fn);
  },
  emitKick(flipped: boolean) {
    kicks.forEach((fn) => fn(flipped));
  },
};

export function useStore<T>(select: (s: FlipState) => T): T {
  return useSyncExternalStore(flipStore.subscribe, () => select(state), () => select(SERVER));
}
