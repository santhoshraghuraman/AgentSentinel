import { test, expect } from '@playwright/test';

test.describe('Settings / System Diagnostics Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/system/diagnostics', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          health: {
            status: "HEALTHY",
            version: "0.9.0",
            milestone: "M9"
          },
          database: {
            type: "SQLite",
            status: "HEALTHY"
          },
          llm: {
            provider: "Development",
            model: "qwen3",
            host: "http://localhost:11434",
            status: "MOCK_ACTIVE"
          },
          governance: {
            active_policies: 5,
            fail_safe_enabled: true
          }
        })
      });
    });
  });

  test('should load diagnostics information securely', async ({ page }) => {
    await page.goto('/settings');
    
    // Wait for header
    await expect(page.locator('h1:has-text("System Diagnostics")')).toBeVisible();

    // Verify sections render
    await expect(page.locator('text=AgentSentinel Core')).toBeVisible();
    await expect(page.locator('text=Persistence Layer')).toBeVisible();
    await expect(page.locator('text=Runtime Intelligence')).toBeVisible();
    await expect(page.locator('text=Governance & Security')).toBeVisible();

    // Verify data population
    await expect(page.getByText('0.9.0', { exact: true })).toBeVisible();
    await expect(page.locator('text=M9')).toBeVisible();
    await expect(page.getByText('SQLite', { exact: true })).toBeVisible();
    await expect(page.locator('text=Development')).toBeVisible();
    await expect(page.locator('text=qwen3')).toBeVisible();
    await expect(page.locator('text=ENABLED (BLOCK ON ERROR)')).toBeVisible();
    await expect(page.locator('text=5')).toBeVisible();
  });

  test('should show error state when backend is unreachable', async ({ page }) => {
    await page.route('**/api/v1/system/diagnostics', async (route) => {
      await route.abort('failed');
    });

    await page.goto('/settings');
    
    await expect(page.locator('text=Backend Unavailable')).toBeVisible();
    await expect(page.locator('text=Failed to reach the AgentSentinel backend')).toBeVisible();
  });
});
