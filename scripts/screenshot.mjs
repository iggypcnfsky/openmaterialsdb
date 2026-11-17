// Usage: BASE_URL=http://localhost:3000 node scripts/screenshot.mjs [prefix]
import { chromium } from 'playwright-core';
const base = process.env.BASE_URL || 'http://localhost:3000';
const prefix = process.argv[2] || 'local';
const exe = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const b = await chromium.launch({ executablePath: exe, headless: true });
for (const theme of ['light', 'dark']) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: theme, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.addInitScript((t) => localStorage.setItem('omdb-theme', t), theme);
  for (const [name, path] of [['home', '/'], ['detail-316l', '/materials/stainless-steel-316l'], ['detail-teak', '/materials/teak'], ['compare', '/compare?m=stainless-steel-316l&m=aluminium-5083&m=titanium-grade-2']]) {
    if (theme === 'dark' && name.startsWith('compare')) continue;
    await p.goto(base + path, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    const font = await p.evaluate(() => document.fonts.check('16px "Google Sans Flex"'));
    const file = `screenshots/${prefix}-${name}-${theme}.png`;
    await p.screenshot({ path: file, fullPage: name !== 'home' });
    console.log(file, 'GoogleSansFlex loaded:', font);
  }
  await ctx.close();
}
await b.close();
