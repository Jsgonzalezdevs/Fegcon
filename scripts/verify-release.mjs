import assert from "node:assert/strict";
import { readFile, readdir, access } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const publicDir = resolve(root, "release/public");
const html = await readFile(resolve(publicDir, "index.html"), "utf8");
const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?]+)"/g)].map(
  (match) => match[1],
);
assert.ok(assets.length >= 2, "El HTML debe enlazar los assets compilados.");
for (const asset of assets) await access(resolve(publicDir, `.${asset}`));
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
  `Paquete cPanel verificado: ${assets.length} assets iniciales, API sincronizada, sin galería de desarrollo.`,
);
