export const DEMO_ACTIVE_KEY = "fegcon.demo.active.v1";
export const DEMO_DATA_KEY = "fegcon.demo.data.v1";
export type DemoStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export function demoStorage(): DemoStorage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
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
  storage?.removeItem(DEMO_DATA_KEY);
}
