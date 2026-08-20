import { mkdirSync, cpSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseManifest = JSON.parse(readFileSync(path.join(rootDir, "manifest.json"), "utf8"));

// Files shared by both browser targets, copied as-is into each target dir.
const SHARED_FILES = ["content.css", "icons"];
const SHARED_DIST_FILES = ["content.js", "content.js.map", "background.js", "background.js.map"];

// Firefox's manifest.json (source of truth for shared fields) already has `background.scripts` and
// `browser_specific_settings`; Chrome's MV3 requires `background.service_worker` and rejects the
// Firefox-only gecko key, so this derives the Chrome variant rather than hand-maintaining two files.
export function manifestFor(target) {
  const manifest = structuredClone(baseManifest);
  if (target === "chrome") {
    delete manifest.browser_specific_settings;
    manifest.background = { service_worker: "dist/background.js" };
  }
  return manifest;
}

// Assembles a self-contained, "Load unpacked"-ready extension folder for
// `target` ("firefox" | "chrome") at outDir: manifest.json + dist/*.js +
// content.css + icons, all in one place. Requires `pnpm build` to have
// already produced dist/content.js and dist/background.js.
export function stageTarget(target, outDir) {
  mkdirSync(path.join(outDir, "dist"), { recursive: true });

  for (const file of SHARED_FILES) {
    cpSync(path.join(rootDir, file), path.join(outDir, file), { recursive: true });
  }
  for (const file of SHARED_DIST_FILES) {
    cpSync(path.join(rootDir, "dist", file), path.join(outDir, "dist", file));
  }
  writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifestFor(target), null, 2));
}

export { rootDir };
