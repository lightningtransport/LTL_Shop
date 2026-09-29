// LTR-171: app icons from the brand logo. The full wordmark is unreadable at home-screen size, so the icon is
// the green bolt from public/ltl-logo.png, clipped out of the wordmark and centered on white.
//
//   node scripts/generate-app-icons.mjs
//
// Writes public/icon-512.png, icon-maskable-512.png, icon-192.png, apple-touch-icon.png and favicon-32.png.
import { chromium } from '@playwright/test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const logo = `data:image/png;base64,${readFileSync(`${publicDir}ltl-logo.png`).toString('base64')}`;

// The bolt in ltl-logo.png (1536×894) sits left of the wordmark. This polygon follows the gap between the bolt
// and the letters (the "L" of LIGHTNING and the "T" of TRANSPORT), so only the bolt is kept.
const BOLT_CLIP = [[0, 0], [318, 0], [213, 352], [360, 370], [368, 388], [55, 894], [0, 894]];
const BOLT_BOX = { x: 0, y: 0, width: 368, height: 894 };

// `height` is the bolt height as a share of the icon. Maskable icons keep it inside the 80% safe circle.
const ICONS = [
  { file: 'icon-512.png', size: 512, height: 0.8 },
  { file: 'icon-maskable-512.png', size: 512, height: 0.6 },
  { file: 'icon-192.png', size: 192, height: 0.8 },
  // iOS rounds the corners itself and ignores transparency.
  { file: 'apple-touch-icon.png', size: 180, height: 0.72 },
  { file: 'favicon-32.png', size: 32, height: 0.9 },
];

const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch(existsSync(localChrome) ? { executablePath: localChrome } : {});
const page = await browser.newPage();
await page.setContent('<canvas></canvas>');

for (const icon of ICONS) {
  const dataUrl = await page.evaluate(async ({ logo, icon, clip, box }) => {
    const image = new Image();
    image.src = logo;
    await image.decode();
    const canvas = document.querySelector('canvas');
    canvas.width = icon.size;
    canvas.height = icon.size;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, icon.size, icon.size);

    const scale = (icon.size * icon.height) / box.height;
    // Center the bolt's box; nudge right a little so its visual weight (the long left diagonal) looks centered.
    const offsetX = (icon.size - box.width * scale) / 2 + icon.size * 0.02;
    const offsetY = (icon.size - box.height * scale) / 2;
    // Draw the clipped bolt on its own transparent layer first.
    const layer = document.createElement('canvas');
    layer.width = icon.size;
    layer.height = icon.size;
    const boltContext = layer.getContext('2d');
    boltContext.imageSmoothingQuality = 'high';
    boltContext.translate(offsetX, offsetY);
    boltContext.scale(scale, scale);
    boltContext.beginPath();
    clip.forEach(([x, y], index) => (index ? boltContext.lineTo(x, y) : boltContext.moveTo(x, y)));
    boltContext.closePath();
    boltContext.clip();
    boltContext.drawImage(image, 0, 0);

    // The logo's bolt is a thin outline; thicken it (stamp the layer around a small circle) so it still reads
    // at 60pt on a home screen.
    const radius = Math.max(0.6, icon.size * 0.01);
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
      context.drawImage(layer, Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    context.drawImage(layer, 0, 0);
    return canvas.toDataURL('image/png');
  }, { logo, icon, clip: BOLT_CLIP, box: BOLT_BOX });

  writeFileSync(`${publicDir}${icon.file}`, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(`wrote public/${icon.file}`);
}

await browser.close();
