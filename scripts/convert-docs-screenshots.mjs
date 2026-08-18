// Converts the landing page's gallery screenshots from PNG to WebP —
// same convention StartGrid's docs/index.html uses — since the site
// gallery only needs to look good in a browser, not survive a Chrome Web
// Store review's exact-dimension requirement (that's what
// pad-screenshots.mjs + the top-level screenshots/*_1280x800.png are for).
// Source images live in the repo-root screenshots/ folder; output goes to
// docs/screenshots/ for the landing page to reference.
//
// The four source screenshots have wildly different native aspect ratios
// (a near-square dropdown crop next to a wide full-page shot), which made
// the 2-column CSS grid gallery look jagged/misaligned — same problem
// pad-screenshots.mjs already solves for the store submission, just at a
// smaller size (the gallery doesn't need Chrome's exact 1280x800) and
// padded with the site's own dark background color instead of pure black
// so it blends into the page instead of showing as a black bar.

import sharp from "sharp";

const QUALITY = 82;
const TARGET_WIDTH = 960;
const TARGET_HEIGHT = 600;
const BACKGROUND = "#020617"; // matches docs/style.css's --bg

const files = [
  "screenshot_1.png",
  "screenshot_2.png",
  "Screenshot_3.png",
  "Screenshot_4.png",
];

for (const file of files) {
  const outName = file.toLowerCase().replace(/\.png$/, ".webp");
  const outFile = `docs/screenshots/${outName}`;
  await sharp(`screenshots/${file}`)
    .flatten({ background: BACKGROUND })
    .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: "contain", background: BACKGROUND })
    .webp({ quality: QUALITY })
    .toFile(outFile);
  console.log(outFile);
}
