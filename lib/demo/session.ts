export const DEMO_ACTIVE_KEY = "fegcon.demo.active.v1";
export const DEMO_DATA_KEY = "fegcon.demo.data.v1";
export type DemoStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
let browserStorage: DemoStorage | null = null;
export function demoStorage(): DemoStorage | null {
  try {
    if (typeof window === "undefined") return null;
    if (browserStorage) return browserStorage;
    const local = window.localStorage;
    const session = window.sessionStorage;
    // Migrate previous demo records while keeping login state limited to this tab.
    if (local.getItem(DEMO_DATA_KEY) === null) {
      const previous = session.getItem(DEMO_DATA_KEY);
      if (previous !== null) local.setItem(DEMO_DATA_KEY, previous);
    }
    browserStorage = {
      getItem: (key) => key === DEMO_ACTIVE_KEY ? session.getItem(key) : local.getItem(key),
      setItem: (key, value) => key === DEMO_ACTIVE_KEY ? session.setItem(key, value) : local.setItem(key, value),
      removeItem: (key) => key === DEMO_ACTIVE_KEY ? session.removeItem(key) : local.removeItem(key),
    };
    return browserStorage;
  } catch {
    return null;
  }
}
let pageIsDemo = false;
export function enterDemo(storage: DemoStorage) {
  storage.setItem(DEMO_ACTIVE_KEY, "true");
  if (storage === demoStorage()) pageIsDemo = true;
}
export function isDemoActive(storage = demoStorage()): boolean {
  if (pageIsDemo && storage === demoStorage()) return true;
  try {
    return storage?.getItem(DEMO_ACTIVE_KEY) === "true";
  } catch {
    return false;
  }
}
export function resetDemo(storage = demoStorage()) {
  storage?.removeItem(DEMO_DATA_KEY);
}
export function exitDemo(storage = demoStorage()) {
  if (storage === demoStorage()) pageIsDemo = false;
  storage?.removeItem(DEMO_ACTIVE_KEY);
}
