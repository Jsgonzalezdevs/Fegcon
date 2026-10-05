import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const release = resolve(root, "release");
const publicDir = resolve(release, "public");
const source = resolve(root, "cpanel");

await rm(resolve(publicDir, "api"), { recursive: true, force: true });
await cp(resolve(source, "api"), resolve(publicDir, "api"), { recursive: true, force: true });
await cp(resolve(source, ".htaccess"), resolve(publicDir, ".htaccess"), { force: true });
await cp(resolve(source, "setup.php"), resolve(publicDir, "setup.php"), { force: true });
await mkdir(resolve(release, "database"), { recursive: true });
await cp(resolve(source, "database", "001_core.sql"), resolve(release, "database", "001_core.sql"), { force: true });
await cp(resolve(source, "README.md"), resolve(release, "README.md"), { force: true });
console.log("cPanel release prepared in release/");
