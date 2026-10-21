import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const outDir = 'C:\\Users\\91959\\.gemini\\antigravity-ide\\brain\\85f09cb5-97c0-4826-bd7c-f9c60a002b99\\screenshots\\phase_6e1';
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
        consoleErrors.push(msg.text());
      }
    });
    page.on('requestfailed', req => {
      failedRequests.push(`${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
    });
  };

  // 1. Desktop 3D: 1280 x 900
  console.log('--- 1. Desktop 3D: 1280x900 ---');
  const desktop3dContext = await browser.newContext({
    viewport: { width: 1280, height: 900 }
  });
  const page3d = await desktop3dContext.newPage();
  setupLogging(page3d);
  await page3d.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page3d.waitForTimeout(2500); // Allow splash screen to dismiss completely

  // Switch to 3D View mode
  const view3dBtn = page3d.locator('[data-testid="view-mode-toggle"]');
  if (await view3dBtn.isVisible()) {
    await view3dBtn.click();
    await page3d.waitForTimeout(1500); // Allow ThreeJS 3D scene to render
  }
  
  // Select stage M7
  const m7Overlay = page3d.locator('[data-testid="stage-overlay-btn-ring-m7"]');
  if (await m7Overlay.isVisible()) {
    await m7Overlay.click();
    await page3d.waitForTimeout(500);
  }
  await page3d.screenshot({ path: path.join(outDir, '01_desktop_3d_1280x900_m7.png'), fullPage: false });
  console.log('Saved: 01_desktop_3d_1280x900_m7.png');

  // Select stage M8
  const m8Overlay = page3d.locator('[data-testid="stage-overlay-btn-ring-m8"]');
  if (await m8Overlay.isVisible()) {
    await m8Overlay.click();
    await page3d.waitForTimeout(500);
  }
  await page3d.screenshot({ path: path.join(outDir, '01b_desktop_3d_1280x900_m8.png'), fullPage: false });
  console.log('Saved: 01b_desktop_3d_1280x900_m8.png');

  // 2. Desktop 2D: 1280 x 900
  console.log('--- 2. Desktop 2D: 1280x900 ---');
  const view2dBtn = page3d.locator('[data-testid="view-mode-2d-toggle"]');
  if (await view2dBtn.isVisible()) {
    await view2dBtn.click();
    await page3d.waitForTimeout(1000);
  }
  await page3d.screenshot({ path: path.join(outDir, '02_desktop_2d_1280x900.png'), fullPage: false });
  console.log('Saved: 02_desktop_2d_1280x900.png');
  await desktop3dContext.close();

  // 3. Tablet: 768 x 1024
  console.log('--- 3. Tablet: 768x1024 ---');
  const tabletContext = await browser.newContext({
    viewport: { width: 768, height: 1024 }
  });
  const pageTablet = await tabletContext.newPage();
  setupLogging(pageTablet);
  await pageTablet.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await pageTablet.waitForTimeout(2500); // Allow splash screen to dismiss completely
  
  // 2D radar mode on tablet to inspect heading wrap at 768px (DEF-VIS-03)
  await pageTablet.screenshot({ path: path.join(outDir, '03_tablet_2d_768x1024.png'), fullPage: false });
  console.log('Saved: 03_tablet_2d_768x1024.png');

  // Switch to 3D on tablet
  const tablet3dBtn = pageTablet.locator('[data-testid="view-mode-toggle"]');
  if (await tablet3dBtn.isVisible()) {
    await tablet3dBtn.click();
    await pageTablet.waitForTimeout(1200);
  }
  await pageTablet.screenshot({ path: path.join(outDir, '03b_tablet_3d_768x1024.png'), fullPage: false });
  console.log('Saved: 03b_tablet_3d_768x1024.png');
  await tabletContext.close();

  // 4. Mobile: 375 x 812
  console.log('--- 4. Mobile: 375x812 ---');
  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 812 }
  });
  const pageMobile = await mobileContext.newPage();
  setupLogging(pageMobile);
  await pageMobile.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await pageMobile.waitForTimeout(2500);

  // 4a. Mobile Closed State (Main content full width, no permanent sidebar occlusion)
  await pageMobile.screenshot({ path: path.join(outDir, '04a_mobile_375x812_closed.png'), fullPage: false });
  console.log('Saved: 04a_mobile_375x812_closed.png');

  // Verify hamburger button exists and open drawer
  const menuButton = pageMobile.locator('button[aria-label="Open navigation menu"]');
  const isMenuVisible = await menuButton.isVisible();
  console.log('Mobile menu button visible:', isMenuVisible);
  await menuButton.click();
  await pageMobile.waitForTimeout(600);

  // 4b. Mobile Drawer Open
  const drawer = pageMobile.locator('[role="dialog"][aria-label="Navigation drawer"]');
  const isDrawerVisible = await drawer.isVisible();
  console.log('Mobile drawer visible:', isDrawerVisible);
  await pageMobile.screenshot({ path: path.join(outDir, '04b_mobile_375x812_drawer_open.png'), fullPage: false });
  console.log('Saved: 04b_mobile_375x812_drawer_open.png');

  // 4c. Test Close via Escape Key
  await pageMobile.keyboard.press('Escape');
  await pageMobile.waitForTimeout(400);
  const isDrawerClosedAfterEscape = !(await drawer.isVisible());
  console.log('Drawer closed after Escape:', isDrawerClosedAfterEscape);
  await pageMobile.screenshot({ path: path.join(outDir, '04c_mobile_375x812_closed_via_escape.png'), fullPage: false });
  console.log('Saved: 04c_mobile_375x812_closed_via_escape.png');

  // 4d. Reopen and Close via Close button (X)
  await menuButton.click();
  await pageMobile.waitForTimeout(400);
  const closeButton = pageMobile.locator('button[aria-label="Close navigation menu"]');
  await closeButton.click();
  await pageMobile.waitForTimeout(400);
  const isDrawerClosedAfterX = !(await drawer.isVisible());
  console.log('Drawer closed after X button:', isDrawerClosedAfterX);

  await mobileContext.close();

  // 5. Narrow Mobile: 320 x 720
  console.log('--- 5. Narrow Mobile: 320x720 ---');
  const narrowContext = await browser.newContext({
    viewport: { width: 320, height: 720 }
  });
  const pageNarrow = await narrowContext.newPage();
  setupLogging(pageNarrow);
  await pageNarrow.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await pageNarrow.waitForTimeout(2500);

  // Check horizontal overflow
  const overflowCheck = await pageNarrow.evaluate(() => {
    return {
      bodyScrollWidth: document.body.scrollWidth,
      bodyClientWidth: document.body.clientWidth,
      docScrollWidth: document.documentElement.scrollWidth,
      docClientWidth: document.documentElement.clientWidth,
    };
  });
  console.log('Narrow 320px overflow check:', overflowCheck);

  await pageNarrow.screenshot({ path: path.join(outDir, '05a_narrow_mobile_320x720_closed.png'), fullPage: false });
  console.log('Saved: 05a_narrow_mobile_320x720_closed.png');

  // Open drawer on narrow mobile
  const narrowMenuBtn = pageNarrow.locator('button[aria-label="Open navigation menu"]');
  await narrowMenuBtn.click();
  await pageNarrow.waitForTimeout(600);
  await pageNarrow.screenshot({ path: path.join(outDir, '05b_narrow_mobile_320x720_drawer.png'), fullPage: false });
  console.log('Saved: 05b_narrow_mobile_320x720_drawer.png');

  await narrowContext.close();
  await browser.close();

  console.log('--- Verification Summary ---');
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
  console.error('Capture script error:', err);
  process.exit(1);
});
