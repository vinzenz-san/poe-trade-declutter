import { execSync } from "node:child_process";
import path from "node:path";
import { rootDir, stageTarget } from "./stageTarget.mjs";

// Assembles a "Load unpacked"-ready folder at dist-unpacked/<target> so you
// don't have to build → zip → unzip just to test a change locally. Re-run
// this (or keep `pnpm dev` running in another terminal for the JS bundle
// and re-run just this script after each change) then reload the extension
// from chrome://extensions or about:debugging.
const target = process.argv[2] === "firefox" ? "firefox" : "chrome";
const outDir = path.join(rootDir, "dist-unpacked", target);

execSync("pnpm build", { cwd: rootDir, stdio: "inherit" });
stageTarget(target, outDir);

console.log(`Staged at ${outDir}`);
console.log(
  target === "chrome"
    ? "Load unpacked: chrome://extensions -> Developer mode -> Load unpacked -> select that folder."
    : "Load Temporary Add-on: about:debugging#/runtime/this-firefox -> select dist-unpacked/firefox/manifest.json."
);
