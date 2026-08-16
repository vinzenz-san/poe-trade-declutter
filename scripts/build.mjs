import { context, build } from "esbuild";

const watch = process.argv.includes("--watch");

const options = {
  entryPoints: ["src/content.ts", "src/background.ts"],
  outdir: "dist",
  bundle: true,
  format: "iife",
  target: "es2022",
  sourcemap: true,
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("Watching for changes...");
} else {
  await build(options);
  console.log("Build complete.");
}
