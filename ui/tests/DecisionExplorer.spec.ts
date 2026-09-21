import { test, expect } from '@playwright/test';

test.describe('Decision Explorer Page', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept the API calls
    await page.route('**/api/v1/audit', async (route) => {
      const mockAuditEvents = [
        {
          interception_id: 'test-intercept-123',
          session_id: 'test-session-456',
          sequence_number: 1,
          timestamp: new Date().toISOString(),
          decision: 'ALLOW',
          execution_state: 'PRE_EXECUTION',
          tool_name: 'test_tool',
          arguments: { query: 'test' },
          action_record: {
            risk_score: 15,
            ml_probability: 0.1,
            auth_status: 'AUTHORIZED',
            features: { f1: 0.5 },
            reasons: []
          }
        }
      ];
      await route.fulfill({ json: mockAuditEvents });
    });

    await page.route('**/api/v1/audit/test-session-456', async (route) => {
      const mockSessionEvents = [
        {
          interception_id: 'test-intercept-123',
          session_id: 'test-session-456',
          sequence_number: 1,
          timestamp: new Date().toISOString(),
          decision: 'ALLOW',
          execution_state: 'PRE_EXECUTION',
          tool_name: 'test_tool'
        }
      ];
      await route.fulfill({ json: mockSessionEvents });
    });

    await page.goto('/decision-explorer');
  });

  test('should render empty state initially', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Decision Explorer', exact: true })).toBeVisible();
    await expect(page.getByText('No Event Selected')).toBeVisible();
  });

  test('should load and render event details when selected', async ({ page }) => {
    // Wait for the dropdown to be populated
    const select = page.locator('select');
    await select.waitFor();
    
    // Select the mocked event
    await select.selectOption('test-intercept-123');
    
    // Verify summary cards
    await expect(page.getByText('15', { exact: true })).toBeVisible(); // Risk Score
    await expect(page.getByText('AUTHORIZED')).toBeVisible(); // Auth Status
    await expect(page.locator('p.text-xl.font-bold:has-text("ALLOW")')).toBeVisible(); // Decision
    
    // Verify Pipeline stepper
    await expect(page.getByText('Semantic Ingest')).toBeVisible();
    await expect(page.getByText('Decision Fusion', { exact: true })).toBeVisible();
    
    // Verify panels
    await expect(page.locator('span.font-semibold:has-text("test_tool")').first()).toBeVisible();
    await expect(page.getByText('Phase 1: Ingest & Normalization')).toBeVisible();
    await expect(page.getByText('Phase 2: ML Inference & Auth')).toBeVisible();
    await expect(page.getByText('Phase 3: Decision Fusion (M8)')).toBeVisible();
    
    // Verify Temporal Trajectory
    await expect(page.getByText('Session Trajectory Timeline')).toBeVisible();
    await expect(page.getByText('#1')).toBeVisible();
  });
});
