import { useSyncExternalStore } from "react";
import { getState, subscribe, type State } from "@/store";

/**
 * Read the store from React. Pass a selector to subscribe to one slice.
 * The selector must return a stable reference for unchanged state.
 */
export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(getState()),
    () => selector(getState()),
  );
}
