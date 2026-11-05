const PENDING_MODULE = "fegcon.module-recovery.pending.v1";
const LAST_RELOAD = "fegcon.module-recovery.last.v1";
type RecoveryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function isModuleLoadError(error: unknown): boolean {
  const message =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Loading chunk .+ failed|ChunkLoadError/i.test(
    message,
  );
}

/** One page refresh for outdated frontend files; never retries a financial request. */
export function requestModuleReload(
  view: string,
  options: {
    storage?: RecoveryStorage;
    reload?: () => void;
    now?: number;
    force?: boolean;
  } = {},
): boolean {
  if (typeof window === "undefined" && !options.reload) return false;
  const reload = options.reload ?? (() => window.location.reload());
  try {
    const storage = options.storage ?? window.sessionStorage;
    const now = options.now ?? Date.now();
    const last = Number(storage.getItem(LAST_RELOAD) ?? 0);
    if (!options.force && last > 0 && now - last < 30000) return false;
    storage.setItem(PENDING_MODULE, view);
    storage.setItem(LAST_RELOAD, String(now));
  } catch {
    // Without a working reload guard, require a deliberate click rather than risk a loop.
    if (!options.force) return false;
  }
  reload();
  return true;
}

export function takeRecoveredModule(storage?: RecoveryStorage): string | null {
  try {
    const target = storage ?? window.sessionStorage;
    const view = target.getItem(PENDING_MODULE);
    target.removeItem(PENDING_MODULE);
    return view;
  } catch {
    return null;
  }
}
