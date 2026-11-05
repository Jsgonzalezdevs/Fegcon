import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { publishStaticBuild } from "../scripts/publish-static.mjs";
import {
  isModuleLoadError,
  requestModuleReload,
  takeRecoveredModule,
} from "../lib/module-recovery.ts";

const storage = () => {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
};

test("a new frontend keeps old chunks and the PHP API for tabs opened before the update", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "fegcon-release-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const output = join(root, "public"),
    stage = join(root, "stage");
  await mkdir(join(output, "assets"), { recursive: true });
  await mkdir(join(output, "api"), { recursive: true });
  await mkdir(join(stage, "assets"), { recursive: true });
  await writeFile(
    join(output, "assets", "credits-old.js"),
    "export const oldModule = true",
  );
  await writeFile(join(output, "api", "index.php"), "PRIVATE API PLACEHOLDER");
  await writeFile(join(output, "index.html"), "old entry");
  await writeFile(
    join(stage, "assets", "credits-new.js"),
    "export const newModule = true",
  );
  await writeFile(join(stage, "index.html"), "new entry");
  await publishStaticBuild(stage, output);
  assert.equal(
    await readFile(join(output, "assets", "credits-old.js"), "utf8"),
    "export const oldModule = true",
  );
  assert.equal(
    await readFile(join(output, "assets", "credits-new.js"), "utf8"),
    "export const newModule = true",
  );
  assert.equal(
    await readFile(join(output, "api", "index.php"), "utf8"),
    "PRIVATE API PLACEHOLDER",
  );
  assert.equal(await readFile(join(output, "index.html"), "utf8"), "new entry");
});

test("invalid builds and immutable filename collisions leave the working entry intact", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "fegcon-release-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const output = join(root, "public"),
    stage = join(root, "stage");
  await mkdir(join(output, "assets"), { recursive: true });
  await mkdir(join(stage, "assets"), { recursive: true });
  await writeFile(join(output, "index.html"), "working entry");
  await writeFile(
    join(output, "assets", "module-hash.js"),
    "old immutable content",
  );
  await assert.rejects(publishStaticBuild(stage, output));
  assert.equal(
    await readFile(join(output, "index.html"), "utf8"),
    "working entry",
  );
  await writeFile(join(stage, "index.html"), "broken entry");
  await writeFile(join(stage, "assets", "module-hash.js"), "different content");
  await assert.rejects(
    publishStaticBuild(stage, output),
    /sin cambiar su nombre/,
  );
  assert.equal(
    await readFile(join(output, "index.html"), "utf8"),
    "working entry",
  );
});

test("module recovery recognizes chunk failures without hiding ordinary rendering bugs", () => {
  for (const error of [
    new TypeError(
      "Failed to fetch dynamically imported module: /assets/credits-old.js",
    ),
    new Error("Importing a module script failed."),
    new Error("Unable to preload CSS for /assets/style-old.css"),
  ])
    assert.equal(isModuleLoadError(error), true);
  assert.equal(
    isModuleLoadError(
      new TypeError("Cannot read properties of undefined (reading 'id')"),
    ),
    false,
  );
});

test("recovery refreshes once, restores the requested module, and leaves demo data intact", () => {
  const saved = storage();
  saved.setItem("fegcon.demo.data.v1", "existing demo changes");
  let reloads = 0;
  const reload = () => reloads++;
  assert.equal(
    requestModuleReload("creditos", { storage: saved, reload, now: 100000 }),
    true,
  );
  assert.equal(reloads, 1);
  assert.equal(takeRecoveredModule(saved), "creditos");
  assert.equal(takeRecoveredModule(saved), null);
  assert.equal(
    requestModuleReload("creditos", { storage: saved, reload, now: 100001 }),
    false,
  );
  assert.equal(reloads, 1);
  assert.equal(saved.getItem("fegcon.demo.data.v1"), "existing demo changes");
  assert.equal(
    requestModuleReload("creditos", {
      storage: saved,
      reload,
      now: 100002,
      force: true,
    }),
    true,
  );
  assert.equal(reloads, 2);
});
