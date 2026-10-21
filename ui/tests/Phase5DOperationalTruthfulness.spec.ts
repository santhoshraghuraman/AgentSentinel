/**
 * Phase5DOperationalTruthfulness.spec.ts
 *
 * Dedicated verification suite for Phase 5D:
 * Operational Truthfulness, Temporal Posture Disambiguation, Telemetry Freshness,
 * and Screen Reader Accessibility.
 */

import { test, expect } from '@playwright/test';

const mockHistoricalMetrics = {
  total_interceptions: 129,
  decisions: { allow: 61, alert: 20, block: 48 },
  actions_by_category: { file_system_read: 83, file_system_write: 17, code_execution: 12 },
};

const mockRecent1hMetrics = {
  total_interceptions: 5,
  decisions: { allow: 5, alert: 0, block: 0 },
  actions_by_category: { file_system_read: 5 },
};

const mockRecent24hMetrics = {
  total_interceptions: 16,
  decisions: { allow: 14, alert: 0, block: 2 },
  actions_by_category: { file_system_read: 14, file_system_write: 2 },
};

const now = Date.now();

const mockRecentAuditEvents = [
  {
    event_id: 'audit-recent-1',
    session_id: 'session-demo-1',
    task_id: 'task-1',
    tool_name: 'read_file',
    interception_id: 'int-recent-001',
    decision: 'ALLOW',
    execution_state: 'EXECUTED',
    timestamp: new Date(now - 30 * 1000).toISOString(), // 30 seconds ago (Live)
    action: {
      category: 'file_system_read',
      normalized_name: 'read_file',
      arguments: { file_path: 'public_docs.txt' }
    },
    action_record: {
      risk_score: 0.12,
      matched_policy_id: 'policy-allow-read'
    }
  },
  {
    event_id: 'audit-recent-2',
    session_id: 'session-demo-1',
    task_id: 'task-1',
    tool_name: 'calculate',
    interception_id: 'int-recent-002',
    decision: 'ALERT',
    execution_state: 'EXECUTED',
    timestamp: new Date(now - 120 * 1000).toISOString(), // 2 minutes ago
    action: {
      category: 'calculation',
      normalized_name: 'calculate',
      arguments: { expression: '42 * 1337' }
    },
    action_record: {
      risk_score: 0.58,
      matched_policy_id: 'policy-alert-calc'
    }
  }
];

const mockIdleAuditEvents = [
  {
    event_id: 'audit-old-1',
    session_id: 'session-old-1',
    task_id: 'task-1',
    tool_name: 'read_file',
    interception_id: 'int-old-001',
    decision: 'ALLOW',
    execution_state: 'EXECUTED',
    timestamp: new Date(now - 2 * 3600 * 1000).toISOString(), // 2 hours ago (Idle)
    action: {
      category: 'file_system_read',
      normalized_name: 'read_file',
      arguments: { file_path: 'docs.txt' }
    },
    action_record: {
      risk_score: 0.05,
      matched_policy_id: 'policy-allow-read'
    }
  }
];

test.describe('Phase 5D: Operational Truthfulness & Temporal Posture Disambiguation', () => {

  test('1. Temporal scope selector toggles between All-Time, Last 24h, and Last 1h with distinct scoped metrics', async ({ page }) => {
    // Intercept metrics requests based on since query param
    await page.route('**/api/v1/metrics*', async (route) => {
      const url = new URL(route.request().url());
      const sinceParam = url.searchParams.get('since');
      
      if (!sinceParam) {
        // All-time query
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockHistoricalMetrics),
        });
      } else {
        const sinceVal = Number(sinceParam);
        const diffHr = (Date.now() - sinceVal) / (3600 * 1000);
        if (diffHr < 2) {
          // Last 1h query
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockRecent1hMetrics),
          });
        } else {
          // Last 24h query
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockRecent24hMetrics),
          });
        }
      }
    });

    await page.route('**/api/v1/audit*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockRecentAuditEvents),
      });
    });

    await page.route('**/api/v1/health*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', version: '1.0.0' }),
      });
    });

    await page.goto('/');

    const radar = page.locator('[data-testid="sentinel-core-radar"]');
    await expect(radar).toBeVisible();

    // Verify temporal scope selector is visible
    const scopeGroup = radar.locator('[data-testid="radar-temporal-scope"]');
    await expect(scopeGroup).toBeVisible();

    // Default scope is All-Time (Cumulative) -> Critical (from 48 historical blocks)
    const banner = radar.locator('[data-testid="posture-status-banner"]');
    await expect(banner).toContainText('All-Time Cumulative');
    await expect(banner).toContainText('Critical');

    // Click 'Last 1h' scope button
    const btn1h = radar.locator('[data-testid="scope-button-1h"]');
    await btn1h.click();

    // Posture shifts to Nominal (Last 1 Hour) because recent 1h has 0 blocks and 0 alerts
    await expect(banner).toContainText('Last 1 Hour');
    await expect(banner).toContainText('Nominal');
    await expect(radar.locator('[data-testid="posture-badge"]')).toHaveText('Nominal');

    // Click 'Last 24h' scope button
    const btn24h = radar.locator('[data-testid="scope-button-24h"]');
    await btn24h.click();

    // Posture shifts to Critical (Last 24 Hours) because past 24h has 2 blocks
    await expect(banner).toContainText('Last 24 Hours');
    await expect(banner).toContainText('Critical');
    await expect(banner).toContainText('2 BLOCKS recorded');

    // Click 'All-Time' scope button to return to cumulative baseline
    const btnAll = radar.locator('[data-testid="scope-button-all"]');
    await btnAll.click();

    await expect(banner).toContainText('All-Time Cumulative');
    await expect(banner).toContainText('48 BLOCKS recorded');
  });

  test('2. Truthfully displays Live Telemetry when audit events are recent (< 5 min)', async ({ page }) => {
    await page.route('**/api/v1/metrics*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockRecent1hMetrics),
      });
    });

    await page.route('**/api/v1/audit*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockRecentAuditEvents),
      });
    });

    await page.goto('/');

    const freshnessBadge = page.locator('[data-testid="telemetry-freshness-badge"]');
    await expect(freshnessBadge).toBeVisible();
    await expect(freshnessBadge).toContainText('Live Telemetry');
  });

  test('3. Truthfully displays Idle Telemetry when audit events are older than 5 min', async ({ page }) => {
    await page.route('**/api/v1/metrics*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockHistoricalMetrics),
      });
    });

    await page.route('**/api/v1/audit*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockIdleAuditEvents),
      });
    });

    await page.goto('/');

    const freshnessBadge = page.locator('[data-testid="telemetry-freshness-badge"]');
    await expect(freshnessBadge).toBeVisible();
    await expect(freshnessBadge).toContainText('Idle Telemetry');
    await expect(freshnessBadge).toContainText('ago');
  });

  test('4. Provides accessible screen-reader live announcement (aria-live="polite") on trace pagination', async ({ page }) => {
    await page.route('**/api/v1/metrics*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockRecent1hMetrics),
      });
    });

    await page.route('**/api/v1/audit*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockRecentAuditEvents),
      });
    });

    await page.goto('/');

    const inspector = page.locator('[data-testid="correlated-event-inspector"]');
    await expect(inspector).toBeVisible();

    // Check aria-live region exists
    const liveRegion = inspector.locator('[aria-live="polite"]');
    await expect(liveRegion).toBeAttached();
    await expect(liveRegion).toContainText('Showing audit event 1 of 2');
    await expect(liveRegion).toContainText('int-recent-001');

    // Click Next Event button
    const nextBtn = inspector.locator('button[aria-label="Next audit event"]');
    await nextBtn.click();

    // Check aria-live region announced Event 2 of 2
    await expect(liveRegion).toContainText('Showing audit event 2 of 2');
    await expect(liveRegion).toContainText('int-recent-002');
  });
});
