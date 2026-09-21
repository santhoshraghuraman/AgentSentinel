import { test, expect } from '@playwright/test';

test.describe('Agents & Sessions Page', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept GET /sessions
    await page.route('**/api/v1/sessions', async (route) => {
      const mockSessions = [
        {
          session_id: 'test-session-456',
          task_id: 'task-123',
          agent_id: 'default',
          created_at: new Date().toISOString(),
          status: 'completed',
          verdict_counts: { ALLOW: 2, BLOCK: 1, ALERT: 0 },
          total_events: 3
        }
      ];
      await route.fulfill({ json: mockSessions });
    });

    // Intercept GET /audit/{session_id}
    await page.route('**/api/v1/audit/test-session-456', async (route) => {
      const mockSessionEvents = [
        {
          interception_id: 'test-intercept-123',
          session_id: 'test-session-456',
          sequence_number: 1,
          timestamp: new Date().toISOString(),
          decision: 'ALLOW',
          execution_state: 'PRE_EXECUTION',
          tool_name: 'test_tool',
          action: { category: 'file_system' },
          action_record: { risk_score: 5, auth_status: 'AUTHORIZED' }
        }
      ];
      await route.fulfill({ json: mockSessionEvents });
    });

    await page.goto('/agents');
  });

  test('should render empty state initially in detail view', async ({ page }) => {
    await expect(page.getByText('Agents & Sessions')).toBeVisible();
    await expect(page.getByText('No Session Selected')).toBeVisible();
  });

  test('should load sessions list', async ({ page }) => {
    await expect(page.getByText('test-session-456')).toBeVisible();
    await expect(page.getByText('COMPLETED', { exact: true })).toBeVisible();
    await expect(page.getByText('ALL: 2')).toBeVisible();
    await expect(page.getByText('BLK: 1')).toBeVisible();
  });

  test('should load and render session timeline when selected', async ({ page }) => {
    // Select the mocked session
    await page.getByText('test-session-456').click();
    
    // Verify header updates
    await expect(page.getByText('Total Interceptions')).toBeVisible();
    await expect(page.getByText('Total Interceptions').locator('..').locator('span').filter({ hasText: /^3$/ })).toBeVisible();

    // Verify timeline updates
    await expect(page.getByText('test_tool')).toBeVisible();
    await expect(page.getByText('PRE_EXECUTION')).toBeVisible();
    await expect(page.getByText('file_system')).toBeVisible();
    await expect(page.getByText('Deep Dive')).toBeVisible();
  });
});
