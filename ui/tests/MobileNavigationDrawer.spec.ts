import { test, expect } from '@playwright/test';

test.describe('Mobile Navigation Drawer (DEF-VIS-04 Verification)', () => {
  test('Mobile viewport (375x812): Drawer opens, closes via X, Escape, backdrop, and nav links', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('http://localhost:5173/');
    await page.waitForTimeout(2500); // Allow splash screen to dismiss

    // 1. Verify desktop sidebar is hidden and hamburger button is visible
    const hamburgerBtn = page.locator('button[aria-label="Open navigation menu"]');
    await expect(hamburgerBtn).toBeVisible();

    const desktopSidebar = page.locator('aside.hidden');
    await expect(desktopSidebar).toBeHidden();

    // 2. Open drawer
    await hamburgerBtn.click();
    const drawer = page.locator('[role="dialog"][aria-label="Navigation drawer"]');
    await expect(drawer).toBeVisible();

    // 3. Close via Close (X) button
    const closeBtn = drawer.locator('button[aria-label="Close navigation menu"]');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(drawer).toBeHidden();

    // 4. Reopen and close via Escape key
    await hamburgerBtn.click();
    await expect(drawer).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();

    // 5. Reopen and close via backdrop click
    await hamburgerBtn.click();
    await expect(drawer).toBeVisible();
    // Backdrop is the sibling with bg-slate-900/50
    const backdrop = page.locator('.fixed.inset-0.bg-slate-900\\/50');
    await backdrop.click({ position: { x: 350, y: 400 }, force: true });
    await expect(drawer).toBeHidden();

    // 6. Reopen and navigate via link
    await hamburgerBtn.click();
    await expect(drawer).toBeVisible();
    const liveMonitorLink = drawer.locator('a:has-text("Live Monitor")');
    await expect(liveMonitorLink).toBeVisible();
    await liveMonitorLink.click();
    await expect(drawer).toBeHidden();
    await expect(page).toHaveURL(/.*\/live/);
  });

  test('Desktop viewport (1280x900): Hamburger button is hidden and desktop sidebar is visible', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('http://localhost:5173/');
    await page.waitForTimeout(2500);

    const hamburgerBtn = page.locator('button[aria-label="Open navigation menu"]');
    await expect(hamburgerBtn).toBeHidden();

    const desktopSidebar = page.locator('aside').first();
    await expect(desktopSidebar).toBeVisible();
  });
});
