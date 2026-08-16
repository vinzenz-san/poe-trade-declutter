import { execSync } from "node:child_process";
import { createWriteStream, mkdirSync, rmSync, cpSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import archiver from "archiver";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8"));
const baseManifest = JSON.parse(readFileSync(path.join(rootDir, "manifest.json"), "utf8"));

const releaseDir = path.join(rootDir, "release");
const stagingRoot = path.join(releaseDir, "staging");

// Files shared by both browser targets, copied as-is into each staging dir.
const SHARED_FILES = ["content.css", "icons"];
const SHARED_DIST_FILES = ["content.js", "content.js.map", "background.js", "background.js.map"];

// Firefox's manifest.json (source of truth for shared fields) already has `background.scripts` and
// `browser_specific_settings`; Chrome's MV3 requires `background.service_worker` and rejects the
// Firefox-only gecko key, so this derives the Chrome variant rather than hand-maintaining two files.
function manifestFor(target) {
  const manifest = structuredClone(baseManifest);
  if (target === "chrome") {
    delete manifest.browser_specific_settings;
    manifest.background = { service_worker: "dist/background.js" };
  }
  return manifest;
}

function zipDir(srcDir, outFile) {
  return new Promise((resolve, reject) => {
    mkdirSync(path.dirname(outFile), { recursive: true });
    const output = createWriteStream(outFile);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", () => resolve(archive.pointer()));
    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(srcDir, false);
    archive.finalize();
  });
}

async function buildTarget(target) {
  const stageDir = path.join(stagingRoot, target);
  mkdirSync(path.join(stageDir, "dist"), { recursive: true });

  for (const file of SHARED_FILES) {
    cpSync(path.join(rootDir, file), path.join(stageDir, file), { recursive: true });
  }
  for (const file of SHARED_DIST_FILES) {
    cpSync(path.join(rootDir, "dist", file), path.join(stageDir, "dist", file));
  }
  writeFileSync(path.join(stageDir, "manifest.json"), JSON.stringify(manifestFor(target), null, 2));

  const outFile = path.join(releaseDir, `poe-trade-declutter-${target}-v${pkg.version}.zip`);
  const bytes = await zipDir(stageDir, outFile);
  console.log(`${outFile} (${bytes} bytes)`);
}

async function buildSourceZip() {
  // AMO reviews minified/bundled output against the original source, so this ships everything needed
  // to reproduce the build (excluding node_modules/dist/release, which pnpm install + pnpm build regenerate).
  const outFile = path.join(releaseDir, `poe-trade-declutter-source-v${pkg.version}.zip`);
  mkdirSync(releaseDir, { recursive: true });
  const output = createWriteStream(outFile);
  const archive = archiver("zip", { zlib: { level: 9 } });
  const done = new Promise((resolve, reject) => {
    output.on("close", () => resolve(archive.pointer()));
    archive.on("error", reject);
  });
  archive.pipe(output);

  const includeFiles = [
    "content.css",
    "manifest.json",
    "icon-source.png",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tsconfig.json",
    "README.md",
    "LICENSE",
  ];
  const includeDirs = ["src", "scripts", "icons", "docs"];

  for (const file of includeFiles) {
    archive.file(path.join(rootDir, file), { name: file });
  }
  for (const dir of includeDirs) {
    archive.directory(path.join(rootDir, dir), dir);
  }
  archive.finalize();
  const bytes = await done;
  console.log(`${outFile} (${bytes} bytes)`);
}

rmSync(releaseDir, { recursive: true, force: true });
console.log("Building...");
execSync("pnpm build", { cwd: rootDir, stdio: "inherit" });

await buildTarget("firefox");
await buildTarget("chrome");
await buildSourceZip();

rmSync(stagingRoot, { recursive: true, force: true });
console.log("Done.");
