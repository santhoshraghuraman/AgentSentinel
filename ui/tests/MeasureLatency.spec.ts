import { test, expect } from '@playwright/test';

test('Measure Playground Latency', async ({ page }) => {
  test.setTimeout(120000); // 2 minutes
  
  await page.goto('http://localhost:5173/playground');
  await expect(page.locator('h1:has-text("Runtime Playground")')).toBeVisible();
  
  // Test Direct Intercept Simulator for deterministic latency benchmarking
  await page.click('button:has-text("Direct Intercept Simulator")');
  await expect(page.locator('button:has-text("Intercept Tool Call")')).toBeVisible();
  
  // Fill payload
  const uniqueSession = `latency-test-${Date.now()}`;
  await page.fill('input[value*="playground-session"]', uniqueSession);
  await page.fill('input[value*="read_file"]', 'read_file');
  const argsInput = page.locator('textarea').first();
  await argsInput.fill(JSON.stringify({ path: "public_docs.txt" }, null, 2));

  // T0: User Click
  const t0 = performance.now();
  await page.click('button:has-text("Intercept Tool Call")');
  
  // T1: Interception Acknowledged and Outcome Rendered
  const outcomeBanner = page.locator('[data-testid="simulator-outcome-banner"]');
  await expect(outcomeBanner).toBeVisible({ timeout: 15000 });
  const t1 = performance.now();
  
  const elapsedMs = t1 - t0;
  console.log(`Live Interception Roundtrip Latency: ${elapsedMs.toFixed(2)} ms`);
  expect(elapsedMs).toBeLessThan(15000); // Strict upper bound for live HTTP test
});
