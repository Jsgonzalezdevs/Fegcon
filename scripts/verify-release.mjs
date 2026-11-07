import assert from "node:assert/strict";
import { readFile, readdir, access } from "node:fs/promises";
import { resolve, dirname } from "node:path";

const root = resolve(import.meta.dirname, "..");
const publicDir = resolve(root, "release/public");
const html = await readFile(resolve(publicDir, "index.html"), "utf8");
const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?]+)"/g)].map(
  (match) => match[1],
);
assert.ok(assets.length >= 2, "El HTML debe enlazar los assets compilados.");
for (const asset of assets) await access(resolve(publicDir, `.${asset}`));
// Check split-module references as well as the entry, including retained versions.
let checkedImports = 0;
for (const filename of await readdir(resolve(publicDir, "assets"))) {
  if (!filename.endsWith(".js")) continue;
  const sourcePath = resolve(publicDir, "assets", filename);
  const source = await readFile(sourcePath, "utf8");
  for (const match of source.matchAll(
    /["']((?:\.\/|\/?assets\/)[^"'\s]+?\.(?:js|css))["']/g,
  )) {
    const dependency = match[1].startsWith("./")
      ? resolve(dirname(sourcePath), match[1])
      : resolve(publicDir, match[1].replace(/^\//, ""));
    await access(dependency);
    checkedImports++;
  }
}
for (const file of [
  "api/index.php",
  "api/bootstrap.php",
  "api/.htaccess",
  ".htaccess",
  "setup.php",
]) {
  assert.equal(
    await readFile(resolve(publicDir, file), "utf8"),
    await readFile(resolve(root, "cpanel", file), "utf8"),
    `El paquete contiene una copia desactualizada de ${file}`,
  );
}
for (const asset of ["brand/fegcon-original-transparente-d1050291ae39.png", "favicon.ico"]) {
  assert.deepEqual(
    await readFile(resolve(publicDir, asset)),
    await readFile(resolve(root, "public", asset)),
    `La identidad original no está sincronizada: ${asset}`,
  );
}
assert.ok(
  html.includes('href="/favicon.ico"'),
  "El navegador debe usar el ícono oficial de FEGCON.",
);
const files = await readdir(publicDir, { recursive: true });
assert.ok(
  !files.some((file) =>
    /(^|\/)(?:qa(?:-preview)?\.|config\.php$|\.env)/.test(file),
  ),
  "El paquete no debe incluir la galería de desarrollo ni credenciales.",
);
assert.ok(
  !html.includes("qa-preview"),
  "La entrada de producción no puede incluir la galería.",
);
console.log(
  `Paquete cPanel verificado: ${assets.length} assets iniciales y ${checkedImports} referencias de módulos, API sincronizada, sin galería de desarrollo.`,
);
