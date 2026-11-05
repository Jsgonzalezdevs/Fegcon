import {
  access,
  copyFile,
  cp,
  mkdir,
  readdir,
  readFile,
  rename,
} from "node:fs/promises";
import { join } from "node:path";

async function verifyImmutableFiles(source, target) {
  let entries;
  try {
    entries = await readdir(source, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    const from = join(source, entry.name),
      to = join(target, entry.name);
    if (entry.isDirectory()) {
      await verifyImmutableFiles(from, to);
      continue;
    }
    let existing;
    try {
      existing = await readFile(to);
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    if (!existing.equals(await readFile(from)))
      throw new Error(
        `Un asset existente cambió de contenido sin cambiar su nombre: ${entry.name}`,
      );
  }
}

/** Publish the new entry last, keeping immutable files used by already-open tabs. */
export async function publishStaticBuild(stagedDir, publicDir) {
  await access(join(stagedDir, "index.html"));
  await verifyImmutableFiles(
    join(stagedDir, "assets"),
    join(publicDir, "assets"),
  );
  await mkdir(publicDir, { recursive: true });
  for (const entry of await readdir(stagedDir, { withFileTypes: true })) {
    if (entry.name === "index.html") continue;
    if (entry.name === "api" || entry.name === "setup.php")
      throw new Error("La compilación frontend no puede reemplazar la API.");
    await cp(join(stagedDir, entry.name), join(publicDir, entry.name), {
      recursive: true,
    });
  }
  const pendingEntry = join(publicDir, ".index.html.next");
  await copyFile(join(stagedDir, "index.html"), pendingEntry);
  await rename(pendingEntry, join(publicDir, "index.html"));
}
