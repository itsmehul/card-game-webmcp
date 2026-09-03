import { mkdir, copyFile, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import inquirer from "inquirer";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const logoPath = path.join(root, "public", "logo.svg");
const appDir = path.join(root, "app");
const publicDir = path.join(root, "public");

const FELT = { r: 11, g: 31, b: 20 }; // matches body bg #0b1f14

async function rasterize(svg, size) {
  return sharp(svg).resize(size, size).png().toBuffer();
}

async function writePng(filePath, buffer) {
  await writeFile(filePath, buffer);
  console.log(`  wrote ${path.relative(root, filePath)}`);
}

async function generateFavicon(svg) {
  const sizes = [16, 32, 48];
  const pngs = await Promise.all(sizes.map((s) => rasterize(svg, s)));
  const ico = await pngToIco(pngs);
  await writeFile(path.join(appDir, "favicon.ico"), ico);
  await writeFile(path.join(publicDir, "favicon.ico"), ico);
  console.log("  wrote app/favicon.ico");
  console.log("  wrote public/favicon.ico");
}

async function generateAppIcons(svg) {
  await copyFile(logoPath, path.join(appDir, "icon.svg"));
  console.log("  wrote app/icon.svg");

  const apple = await rasterize(svg, 180);
  await writePng(path.join(appDir, "apple-icon.png"), apple);
  await writePng(path.join(publicDir, "apple-touch-icon.png"), apple);

  for (const size of [192, 512]) {
    const buf = await rasterize(svg, size);
    await writePng(path.join(publicDir, `icon-${size}.png`), buf);
  }
}

async function generateSocial(svg) {
  const logoSize = 420;
  const logo = await sharp(svg).resize(logoSize, logoSize).png().toBuffer();

  const og = await sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 3,
      background: FELT,
    },
  })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toBuffer();

  await writePng(path.join(appDir, "opengraph-image.png"), og);
  await writePng(path.join(appDir, "twitter-image.png"), og);
  await writePng(path.join(publicDir, "og.png"), og);

  await writeFile(
    path.join(appDir, "opengraph-image.alt.txt"),
    "Card Table — learn and play card games with WebMCP\n",
  );
  await writeFile(
    path.join(appDir, "twitter-image.alt.txt"),
    "Card Table — learn and play card games with WebMCP\n",
  );
  console.log("  wrote app/opengraph-image.alt.txt");
  console.log("  wrote app/twitter-image.alt.txt");
}

const allTargets = ["favicon", "icons", "social"];
const skipPrompt = process.argv.includes("--all") || !process.stdin.isTTY;

const targets = skipPrompt
  ? allTargets
  : (
      await inquirer.prompt([
        {
          type: "checkbox",
          name: "targets",
          message: "Generate image assets from public/logo.svg",
          choices: [
            { name: "Favicon (.ico)", value: "favicon", checked: true },
            {
              name: "App icons (icon.svg, apple-icon, PWA sizes)",
              value: "icons",
              checked: true,
            },
            { name: "Social / OG images", value: "social", checked: true },
          ],
          validate: (v) => (v.length ? true : "Select at least one target"),
        },
      ])
    ).targets;

const svg = await readFile(logoPath);
await mkdir(appDir, { recursive: true });

console.log("\nGenerating from public/logo.svg…");
if (targets.includes("favicon")) await generateFavicon(svg);
if (targets.includes("icons")) await generateAppIcons(svg);
if (targets.includes("social")) await generateSocial(svg);
console.log("\nDone.");
