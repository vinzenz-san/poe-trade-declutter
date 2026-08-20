import { execSync } from "node:child_process";
import { createWriteStream, mkdirSync, rmSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import archiver from "archiver";
import { rootDir, stageTarget } from "./stageTarget.mjs";

const pkg = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8"));

const releaseDir = path.join(rootDir, "release");
const stagingRoot = path.join(releaseDir, "staging");

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
  stageTarget(target, stageDir);

  const outFile = path.join(releaseDir, `v${pkg.version}-${target}.zip`);
  const bytes = await zipDir(stageDir, outFile);
  console.log(`${outFile} (${bytes} bytes)`);
}

async function buildSourceZip() {
  // AMO reviews minified/bundled output against the original source, so this ships everything needed
  // to reproduce the build (excluding node_modules/dist/release, which pnpm install + pnpm build regenerate).
  const outFile = path.join(releaseDir, `v${pkg.version}-source.zip`);
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

// Only clear the scratch staging dir, not releaseDir itself — releaseDir
// accumulates zips across versions so older release builds stay available.
rmSync(stagingRoot, { recursive: true, force: true });
mkdirSync(releaseDir, { recursive: true });
console.log("Building...");
execSync("pnpm build", { cwd: rootDir, stdio: "inherit" });

await buildTarget("firefox");
await buildTarget("chrome");
await buildSourceZip();

rmSync(stagingRoot, { recursive: true, force: true });
console.log("Done.");
