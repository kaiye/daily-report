import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { ensureDir } from '../utils/io.js';

export async function renderPng(htmlContent, outputPath, width = 900) {
  ensureDir(path.dirname(outputPath));
  const tmpHtml = path.join(os.tmpdir(), `daily-report-${Date.now()}.html`);
  fs.writeFileSync(tmpHtml, htmlContent, 'utf-8');

  try {
    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width, height: 1200 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await page.goto(`file://${tmpHtml}`);
    await page.waitForLoadState('networkidle');
    const height = await page.evaluate('document.body.scrollHeight');
    await page.setViewportSize({ width, height: Math.max(Number(height || 800), 800) });
    await page.screenshot({ path: outputPath, fullPage: true });
    await context.close();
    await browser.close();
    console.log(`  ✅ PNG saved: ${outputPath}`);
    return true;
  } catch (err) {
    console.error(`  ⚠  Playwright failed: ${err.message || String(err)}`);
    console.error('     Install with: npm install && npx playwright install chromium --with-deps');
    return false;
  } finally {
    try {
      fs.unlinkSync(tmpHtml);
    } catch {
      // ignore cleanup errors
    }
  }
}
