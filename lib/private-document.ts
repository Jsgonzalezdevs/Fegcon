import { demoStorage, isDemoActive, type DemoStorage } from "./demo/session.ts";

/** Demo links must never expose a real API URL, including “open in a new tab”. */
export function privateDocumentHref(
  realPath: string,
  storage: DemoStorage | null = demoStorage(),
): string {
  return isDemoActive(storage) ? "#demo-document" : realPath;
}
