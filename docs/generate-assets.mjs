import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(output);
const sampleSettings = {
  version: 1,
  proxyUri: 'socks5://localhost:10808',
  exceptions: ['example.com', '*.example.com', '*.internal.test']
};
const files = new Map([
  ['/options/index.html', 'text/html'],
  ['/options/options.css', 'text/css'],
  ['/options/options.js', 'text/javascript'],
  ['/popup/index.html', 'text/html'],
  ['/popup/popup.css', 'text/css'],
  ['/popup/popup.js', 'text/javascript'],
  ['/src/core.js', 'text/javascript'],
  ['/docs/privacy-policy.html', 'text/html']
]);
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (!files.has(pathname)) {
    response.writeHead(404).end();
    return;
  }
  try {
    response.writeHead(200, { 'Content-Type': `${files.get(pathname)}; charset=utf-8` });
    response.end(await readFile(path.join(root, pathname.slice(1))));
  } catch {
    response.writeHead(500).end();
  }
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ channel: process.env.CHROME_CHANNEL || 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const pageErrors = [];
  context.on('weberror', (error) => pageErrors.push(error.error().message));
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    return route.abort();
  });
  await context.addInitScript(({ settings }) => {
    const state = { ok: true, enabled: true, routingEnabled: true, controlledByThisExtension: true, error: '', settings };
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        runtime: {
          sendMessage: async (message) => {
            if (message.type === 'set-enabled') state.enabled = message.enabled;
            else if (message.type === 'set-routing-enabled') state.routingEnabled = message.routingEnabled;
            else if (message.type === 'save-settings') state.settings = message.settings;
            return structuredClone(state);
          },
          openOptionsPage: () => {}
        }
      }
    });
  }, { settings: sampleSettings });
  for (const directory of ['icons', 'screenshots', 'promo']) {
    await mkdir(path.join(output, directory), { recursive: true });
  }

  const page = await context.newPage();
  await page.goto(`${origin}/options/index.html`);
  await page.locator('#proxy-uri:enabled').waitFor();
  assert.equal(await page.locator('#proxy-uri').inputValue(), sampleSettings.proxyUri);
  assert.equal(await page.locator('.mask-item').count(), sampleSettings.exceptions.length);
  await page.screenshot({ path: path.join(output, 'screenshots/02-settings.png') });

  await page.evaluate(() => {
    const popup = document.createElement('iframe');
    popup.id = 'store-popup-preview';
    popup.title = 'SOCKS5 Route popup';
    popup.src = '/popup/index.html';
    Object.assign(popup.style, {
      position: 'fixed', right: '24px', top: '88px', width: '340px', height: '660px',
      border: '0', boxShadow: '0 8px 32px #182a2733', zIndex: '10'
    });
    document.body.append(popup);
  });
  const popup = page.frameLocator('#store-popup-preview');
  await popup.locator('#enabled:enabled').waitFor();
  assert.equal(await popup.locator('#enabled').isChecked(), true);
  assert.equal(await popup.locator('#routing-enabled').isChecked(), true);
  assert.equal(await popup.locator('#pattern-list li').count(), sampleSettings.exceptions.length);
  const popupHeight = await popup.locator('body').evaluate((body) => Math.ceil(body.getBoundingClientRect().height));
  assert.ok(popupHeight + 88 <= 800, 'Popup must fit within the screenshot');
  await page.locator('#store-popup-preview').evaluate((frame, height) => { frame.style.height = `${height}px`; }, popupHeight);
  await page.screenshot({ path: path.join(output, 'screenshots/01-popup-and-routing.png') });
  await popup.locator('#enabled').uncheck();
  await popup.locator('#enabled:enabled').waitFor();
  assert.equal(await popup.locator('#status-description').textContent(), 'Chrome connects directly without a proxy');

  const canvasPage = await context.newPage();
  await canvasPage.goto(`${origin}/docs/privacy-policy.html`);
  for (const size of [16, 32, 48, 128]) {
    const data = await canvasPage.evaluate((size) => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const drawing = canvas.getContext('2d');
      drawing.scale(size / 128, size / 128);
      drawing.fillStyle = '#195b4c';
      drawing.beginPath();
      drawing.roundRect(16, 16, 96, 96, 8);
      drawing.fill();
      drawing.strokeStyle = '#ffffffcc';
      drawing.lineWidth = 1;
      drawing.stroke();
      drawing.fillStyle = '#ffffff';
      drawing.font = '700 66px "Avenir Next", sans-serif';
      drawing.textAlign = 'center';
      drawing.textBaseline = 'middle';
      drawing.fillText('S', 64, 68);
      return canvas.toDataURL('image/png').split(',')[1];
    }, size);
    await writeFile(path.join(output, `icons/icon-${size}.png`), Buffer.from(data, 'base64'));
  }

  const promo = await canvasPage.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 440;
    canvas.height = 280;
    const drawing = canvas.getContext('2d');
    drawing.fillStyle = '#195b4c';
    drawing.fillRect(0, 0, 440, 280);
    drawing.fillStyle = '#ffffff';
    drawing.beginPath();
    drawing.roundRect(32, 32, 56, 56, 6);
    drawing.fill();
    drawing.fillStyle = '#195b4c';
    drawing.font = '700 38px "Avenir Next", sans-serif';
    drawing.textAlign = 'center';
    drawing.fillText('S', 60, 74);
    drawing.textAlign = 'left';
    drawing.fillStyle = '#ffffff';
    drawing.font = '700 32px "Avenir Next", sans-serif';
    drawing.fillText('SOCKS5 Route', 108, 72);
    drawing.strokeStyle = '#b9d7c6';
    drawing.lineWidth = 3;
    drawing.lineCap = 'round';
    drawing.lineJoin = 'round';
    drawing.beginPath();
    drawing.moveTo(60, 166);
    drawing.lineTo(180, 166);
    drawing.lineTo(220, 134);
    drawing.lineTo(356, 134);
    drawing.moveTo(180, 166);
    drawing.lineTo(220, 218);
    drawing.lineTo(356, 218);
    drawing.stroke();
    for (const [left, top, color] of [[44, 150, '#ffffff'], [348, 118, '#8cdec2'], [348, 202, '#edcc74']]) {
      drawing.fillStyle = color;
      drawing.beginPath();
      drawing.roundRect(left, top, 32, 32, 4);
      drawing.fill();
    }
    drawing.fillStyle = '#ffffff';
    drawing.font = '600 12px "Avenir Next", sans-serif';
    drawing.fillText('SOCKS5', 258, 120);
    drawing.fillStyle = '#edcc74';
    drawing.fillText('DIRECT', 258, 204);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await writeFile(path.join(output, 'promo/small-440x280.png'), Buffer.from(promo, 'base64'));

  await canvasPage.setViewportSize({ width: 375, height: 812 });
  await canvasPage.goto(`${origin}/docs/privacy-policy.html`);
  assert.equal(await canvasPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.ok(await canvasPage.locator('h1').isVisible());
  assert.deepEqual(pageErrors, []);
  for (const [relativePath, width, height] of [
    ...[16, 32, 48, 128].map((size) => [`icons/icon-${size}.png`, size, size]),
    ['promo/small-440x280.png', 440, 280],
    ['screenshots/01-popup-and-routing.png', 1280, 800],
    ['screenshots/02-settings.png', 1280, 800]
  ]) {
    const image = await readFile(path.join(output, relativePath));
    assert.equal(image.subarray(1, 4).toString(), 'PNG');
    assert.equal(image.readUInt32BE(16), width);
    assert.equal(image.readUInt32BE(20), height);
    console.log(`${relativePath}: ${width}x${height}`);
  }
  console.log('Rendered actual UI with synthetic data; no Chrome proxy settings or external network requests were used.');
} finally {
  if (browser) await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}