import { test, expect } from '@playwright/test';

test.describe('Live End-to-End Audit Argument-Preservation Verification (No Mocks)', () => {
  const sessionId = 'live-arg-verify-1792428599215';
  const interceptionId = '15189383-231c-4dcf-ada7-1958c9cbf5f4';

  test('live record displays preserved arguments and correlation without mocks', async ({ page }) => {
    // Navigate directly to the live frontend with correlation query params
    await page.goto(`/audit?session=${sessionId}&interception=${interceptionId}`);

    // 1. Verify Correlation Banner
    const banner = page.locator('[data-testid="audit-correlation-banner"]');
    await expect(banner).toBeVisible({ timeout: 10000 });
    await expect(banner).toContainText(sessionId);
    await expect(banner).toContainText(interceptionId);

    // 2. Verify Correlated Card is Highlighted
    const card = page.locator(`[data-testid="audit-card-${interceptionId}"]`);
    await expect(card).toBeVisible();
    await expect(card.locator('[data-testid="correlated-badge"]')).toBeVisible();

    // 3. Verify Tool Name
    await expect(card.getByText('calculate').first()).toBeVisible();

    // 4. Verify Auto-Expanded Card displays the preserved invocation argument
    // Look for expression and 42 * 1337 in the invocation arguments container
    await expect(card.getByText('Invocation Arguments')).toBeVisible();
    await expect(card.getByText('expression')).toBeVisible();
    await expect(card.getByText('42 * 1337')).toBeVisible();

    // 5. Verify Normalized Semantics (honest UNKNOWN category, null operation/resource)
    await expect(card.getByText('Normalized Semantics (M2)')).toBeVisible();
    await expect(card.getByText('unknown')).toBeVisible();

    // 6. Test Isolate Correlated Record
    const isolateBtn = page.locator('[data-testid="toggle-isolate-correlated"]');
    await isolateBtn.click();
    await expect(banner).toContainText('Showing only correlated record');
    await expect(card).toBeVisible();

    // 7. Test exact Interception ID search
    await isolateBtn.click(); // Restore all
    const searchInput = page.getByPlaceholder('Search by Interception ID, Session, Task, or Tool...');
    await searchInput.fill(interceptionId);
    await expect(card).toBeVisible();
    await expect(card.getByText('42 * 1337')).toBeVisible();
  });
});
