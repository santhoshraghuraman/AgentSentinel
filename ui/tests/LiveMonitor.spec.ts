import { test, expect } from '@playwright/test';

test.describe('Dashboard & Live Monitor UI Tests', () => {
  test('Dashboard loads and renders metrics', async ({ page }) => {
    // Mock the metrics endpoint
    await page.route('**/metrics', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total_interceptions: 15,
          decisions: { allow: 10, alert: 3, block: 2 },
          actions_by_category: { os_interaction: 15 }
        })
      });
    });

    await page.goto('/');
    
    // Check header
    await expect(page.getByRole('heading', { name: 'Overview Dashboard' })).toBeVisible();
    
    // Check metric cards
    await expect(page.getByText('Total Interceptions')).toBeVisible();
    await expect(page.getByRole('heading', { name: '15' })).toBeVisible();
    
    await expect(page.getByText('Allowed')).toBeVisible();
    await expect(page.getByRole('heading', { name: '10' })).toBeVisible();

    await expect(page.getByText('Blocked', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '2' })).toBeVisible();
  });

  test('Live Monitor loads and renders events', async ({ page }) => {
    // Mock the live events endpoint
    await page.route('**/events/live?limit=50', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            interception_id: 'evt-123',
            session_id: 'sess-456',
            sequence_number: 1,
            timestamp: new Date().toISOString(),
            decision: 'BLOCK',
            execution_state: 'NOT_EXECUTED',
            action: { tool_name: 'test_tool', arguments: { p: 1 } },
            action_record: {
              decision: 'BLOCK',
              risk_score: 0.95,
              ml_probability: 0.99,
              reasons: []
            }
          }
        ])
      });
    });

    await page.goto('/monitor');
    
    // Check header
    await expect(page.getByRole('heading', { name: 'Live Monitor' })).toBeVisible();
    
    // Check event feed
    await expect(page.getByText('test_tool')).toBeVisible();
    await expect(page.getByText('BLOCK', { exact: true })).toBeVisible();
    await expect(page.getByText('Risk: 0.95')).toBeVisible();
  });
});
