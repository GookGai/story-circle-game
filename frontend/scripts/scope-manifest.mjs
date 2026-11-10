import { readFile, writeFile } from "node:fs/promises";

const file = new URL("../dist-ultigy/manifest.webmanifest", import.meta.url);
const manifest = JSON.parse(await readFile(file, "utf8"));
const prefix = "/story-circle";
manifest.id = prefix + manifest.id.replace(/\/$/, "");
manifest.scope = prefix + manifest.scope.replace(/\/$/, "");
manifest.start_url = prefix + manifest.start_url.replace(/^\/\?/, "?");
for (const icon of manifest.icons) icon.src = prefix + icon.src;
await writeFile(file, JSON.stringify(manifest, null, 2) + "\n");
