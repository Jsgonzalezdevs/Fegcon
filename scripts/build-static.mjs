import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { build } from "vite";
import { publishStaticBuild } from "./publish-static.mjs";

const root = resolve(import.meta.dirname, "..");
const temporaryRoot = join(root, ".sites-runtime");
await mkdir(temporaryRoot, { recursive: true });
const stagedDir = await mkdtemp(join(temporaryRoot, "static-build-"));
try {
  await build({
    configFile: join(root, "vite.static.config.ts"),
    build: { outDir: stagedDir, emptyOutDir: true },
  });
  await publishStaticBuild(stagedDir, join(root, "release/public"));
  console.log(
    "Frontend publicado sin eliminar los módulos de pestañas abiertas.",
  );
} finally {
  await rm(stagedDir, { recursive: true, force: true });
}
