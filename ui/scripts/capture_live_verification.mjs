import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto('http://localhost:5173/audit?session=live-arg-verify-1792428599215&interception=15189383-231c-4dcf-ada7-1958c9cbf5f4');
  await page.waitForTimeout(2500);
  await page.waitForSelector('[data-testid="audit-correlation-banner"]');
  const isolateBtn = page.locator('[data-testid="toggle-isolate-correlated"]');
  await isolateBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'reports/live_audit_argument_isolated.png' });
  await browser.close();
  console.log('Screenshot successfully saved to reports/live_audit_argument_isolated.png');
})();
