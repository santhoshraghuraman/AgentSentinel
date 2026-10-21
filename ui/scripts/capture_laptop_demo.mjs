import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const outDir = 'C:\\Users\\91959\\.gemini\\antigravity-ide\\brain\\85f09cb5-97c0-4826-bd7c-f9c60a002b99\\screenshots\\laptop_freeze';
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function run() {
  const browser = await chromium.launch({ headless: true });

  const consoleErrors = [];
  const failedRequests = [];

  const setupLogging = (page) => {
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[CONSOLE ERROR] ${msg.text()}`);
      }
    });
    page.on('requestfailed', req => {
      failedRequests.push(`[FAILED REQUEST] ${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
    });
  };

  // ==========================================
  // VIEWPORT 1: 1280 x 800 (16:10 Laptop)
  // ==========================================
  console.log('=== LAPTOP VERIFICATION: 1280 x 800 ===');
  const ctx1280 = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page1280 = await ctx1280.newPage();
  setupLogging(page1280);

  // 1. Dashboard 3D
  await page1280.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page1280.waitForTimeout(2500); // splash fade

  const view3dBtn = page1280.locator('[data-testid="view-mode-toggle"]');
  if (await view3dBtn.isVisible()) {
    await view3dBtn.click();
    await page1280.waitForTimeout(1500);
  }

  // Select M7
  const m7Overlay = page1280.locator('[data-testid="stage-overlay-btn-ring-m7"]');
  if (await m7Overlay.isVisible()) {
    await m7Overlay.click();
    await page1280.waitForTimeout(400);
  }
  await page1280.screenshot({ path: path.join(outDir, '01_laptop_1280x800_overview_3d_m7.png'), fullPage: false });
  console.log('Saved: 01_laptop_1280x800_overview_3d_m7.png');

  // Select M8
  const m8Overlay = page1280.locator('[data-testid="stage-overlay-btn-ring-m8"]');
  if (await m8Overlay.isVisible()) {
    await m8Overlay.click();
    await page1280.waitForTimeout(400);
  }
  await page1280.screenshot({ path: path.join(outDir, '01b_laptop_1280x800_overview_3d_m8.png'), fullPage: false });
  console.log('Saved: 01b_laptop_1280x800_overview_3d_m8.png');

  // 2. Dashboard 2D
  const view2dBtn = page1280.locator('[data-testid="view-mode-2d-toggle"]');
  if (await view2dBtn.isVisible()) {
    await view2dBtn.click();
    await page1280.waitForTimeout(800);
  }
  await page1280.screenshot({ path: path.join(outDir, '02_laptop_1280x800_overview_2d.png'), fullPage: false });
  console.log('Saved: 02_laptop_1280x800_overview_2d.png');

  // 3. Playground: Interception test & execution
  await page1280.goto('http://localhost:5173/playground', { waitUntil: 'networkidle' });
  await page1280.waitForTimeout(2500);

  // Use Direct Intercept Simulator for deterministic real task submission
  const simulatorTab = page1280.locator('button:has-text("Direct Intercept Simulator")');
  if (await simulatorTab.isVisible()) {
    await simulatorTab.click();
    await page1280.waitForTimeout(400);
  }

  const testSessionId = `laptop-demo-${Date.now()}`;
  await page1280.fill('input[value*="playground-session"]', testSessionId);
  await page1280.fill('input[value*="read_file"]', 'read_file');
  const argsInput = page1280.locator('textarea').first();
  await argsInput.fill(JSON.stringify({ path: "public_docs.txt" }, null, 2));

  // Click Intercept
  const interceptBtn = page1280.locator('button:has-text("Intercept Tool Call")');
  await interceptBtn.click();
  await page1280.waitForSelector('[data-testid="simulator-outcome-banner"]', { timeout: 10000 });
  await page1280.waitForTimeout(600);

  await page1280.screenshot({ path: path.join(outDir, '03_laptop_1280x800_playground_allow.png'), fullPage: false });
  console.log('Saved: 03_laptop_1280x800_playground_allow.png');

  // Also submit a BLOCK scenario (delete / dangerous write)
  await page1280.fill('input[value*="read_file"]', 'delete_file');
  await argsInput.fill(JSON.stringify({ path: "/etc/shadow" }, null, 2));
  await interceptBtn.click();
  await page1280.waitForTimeout(1000);
  await page1280.screenshot({ path: path.join(outDir, '03b_laptop_1280x800_playground_block.png'), fullPage: false });
  console.log('Saved: 03b_laptop_1280x800_playground_block.png');

  // 4. Decision Explorer
  await page1280.goto('http://localhost:5173/decision-explorer', { waitUntil: 'networkidle' });
  await page1280.waitForTimeout(2500);
  await page1280.screenshot({ path: path.join(outDir, '04_laptop_1280x800_decision_explorer.png'), fullPage: false });
  console.log('Saved: 04_laptop_1280x800_decision_explorer.png');

  // 5. Trajectories
  await page1280.goto('http://localhost:5173/trajectories', { waitUntil: 'networkidle' });
  await page1280.waitForTimeout(2500);
  await page1280.screenshot({ path: path.join(outDir, '05_laptop_1280x800_trajectories.png'), fullPage: false });
  console.log('Saved: 05_laptop_1280x800_trajectories.png');

  await ctx1280.close();

  // ==========================================
  // VIEWPORT 2: 1366 x 768 (16:9 Standard Laptop)
  // ==========================================
  console.log('=== LAPTOP VERIFICATION: 1366 x 768 ===');
  const ctx1366 = await browser.newContext({
    viewport: { width: 1366, height: 768 }
  });
  const page1366 = await ctx1366.newPage();
  setupLogging(page1366);

  // 1. Dashboard 3D
  await page1366.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page1366.waitForTimeout(2500);

  const view3dBtn1366 = page1366.locator('[data-testid="view-mode-toggle"]');
  if (await view3dBtn1366.isVisible()) {
    await view3dBtn1366.click();
    await page1366.waitForTimeout(1500);
  }

  // Select M7
  const m7Overlay1366 = page1366.locator('[data-testid="stage-overlay-btn-ring-m7"]');
  if (await m7Overlay1366.isVisible()) {
    await m7Overlay1366.click();
    await page1366.waitForTimeout(400);
  }
  await page1366.screenshot({ path: path.join(outDir, '06_laptop_1366x768_overview_3d_m7.png'), fullPage: false });
  console.log('Saved: 06_laptop_1366x768_overview_3d_m7.png');

  // 2. Dashboard 2D
  const view2dBtn1366 = page1366.locator('[data-testid="view-mode-2d-toggle"]');
  if (await view2dBtn1366.isVisible()) {
    await view2dBtn1366.click();
    await page1366.waitForTimeout(800);
  }
  await page1366.screenshot({ path: path.join(outDir, '07_laptop_1366x768_overview_2d.png'), fullPage: false });
  console.log('Saved: 07_laptop_1366x768_overview_2d.png');

  // 3. Playground
  await page1366.goto('http://localhost:5173/playground', { waitUntil: 'networkidle' });
  await page1366.waitForTimeout(2500);
  await page1366.screenshot({ path: path.join(outDir, '08_laptop_1366x768_playground.png'), fullPage: false });
  console.log('Saved: 08_laptop_1366x768_playground.png');

  // 4. Decision Explorer
  await page1366.goto('http://localhost:5173/decision-explorer', { waitUntil: 'networkidle' });
  await page1366.waitForTimeout(2500);
  await page1366.screenshot({ path: path.join(outDir, '09_laptop_1366x768_decision_explorer.png'), fullPage: false });
  console.log('Saved: 09_laptop_1366x768_decision_explorer.png');

  await ctx1366.close();
  await browser.close();

  console.log('=== LAPTOP VERIFICATION SUMMARY ===');
  console.log(`Console Errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.log(consoleErrors.join('\n'));
  }
  console.log(`Failed Requests: ${failedRequests.length}`);
  if (failedRequests.length > 0) {
    console.log(failedRequests.join('\n'));
  }
}

run().catch(err => {
  console.error('Laptop capture script error:', err);
  process.exit(1);
});
