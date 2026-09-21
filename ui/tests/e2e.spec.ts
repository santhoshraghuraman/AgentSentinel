import { test, expect } from '@playwright/test';

test.describe('AgentSentinel E2E', () => {
  test('should load the dashboard', async ({ page }) => {
    await page.goto('http://localhost:5173/');
    await expect(page.locator('h1:has-text("Overview Dashboard")').first()).toBeVisible();
  });

  test('should load trajectories', async ({ page }) => {
    await page.goto('http://localhost:5173/trajectories');
    await expect(page.locator('h1:has-text("Trajectories")')).toBeVisible();
    
    // Type in an invalid session
    await page.fill('input[placeholder="Enter Session ID..."]', 'unknown_session_123');
    await page.click('button:has-text("Analyze Session")');
    // Wait for the empty state
    await page.waitForTimeout(1000);
  });

  test('should load policies', async ({ page }) => {
    await page.goto('http://localhost:5173/policies');
    await expect(page.locator('h1:has-text("Governance Policies")')).toBeVisible();
  });

  test('should load playground', async ({ page }) => {
    await page.goto('http://localhost:5173/playground');
    await expect(page.locator('h1:has-text("Runtime Playground")')).toBeVisible();
  });

  test('should load reports', async ({ page }) => {
    await page.goto('http://localhost:5173/reports');
    await expect(page.locator('h1:has-text("Compliance & Governance Reports")')).toBeVisible();
  });

  test('should load evaluation', async ({ page }) => {
    await page.goto('http://localhost:5173/evaluation');
    await expect(page.locator('h1:has-text("Research Model Evaluation")')).toBeVisible();
  });

  test('should load datasets', async ({ page }) => {
    await page.goto('http://localhost:5173/datasets');
    await expect(page.locator('h1:has-text("Datasets & Benchmark Corpus")')).toBeVisible();
  });
});
