import sharp from "sharp";

const TARGET_WIDTH = 1280;
const TARGET_HEIGHT = 800;
const BACKGROUND = { r: 0, g: 0, b: 0 };

const files = ["screenshots/screenshot_1.png", "screenshots/screenshot_2.png"];

for (const file of files) {
  const outFile = file.replace(/\.png$/, `_${TARGET_WIDTH}x${TARGET_HEIGHT}.png`);
  await sharp(file)
    .flatten({ background: BACKGROUND })
    .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: "contain", background: BACKGROUND })
    .png()
    .toFile(outFile);
  console.log(outFile);
}
