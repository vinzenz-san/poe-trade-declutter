import sharp from "sharp";

const sizes = [16, 32, 48, 128];

for (const size of sizes) {
  await sharp("icon-source.png")
    .resize(size, size, { kernel: "nearest" })
    .png()
    .toFile(`icons/icon-${size}.png`);
  console.log(`icons/icon-${size}.png`);
}
