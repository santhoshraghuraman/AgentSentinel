import { test, expect } from '@playwright/test';

test.describe('Phase 5A: Telemetry & Statistical Visualizations', () => {

  const mockMetrics = {
    total_interceptions: 45,
    decisions: {
      allow: 30,
      alert: 10,
      block: 5,
    },
    actions_by_category: {
      FILE_SYSTEM_READ: 20,
      NETWORK_QUERY: 12,
      DATABASE_MUTATION: 8,
      SYSTEM_COMMAND: 5,
    },
  };

  const mockAuditEvents = [
    {
      interception_id: 'evt-1',
      session_id: 'session-alpha',
      sequence_number: 1,
      timestamp: '2026-10-18T10:00:00.000Z',
      decision: 'ALLOW',
      execution_state: 'EXECUTED',
      tool_name: 'fs_read_file',
      action: { category: 'FILE_SYSTEM_READ', normalized_name: 'fs_read' },
      action_record: { risk_score: 0.15, auth_status: 'AUTHORIZED' },
    },
    {
      interception_id: 'evt-2',
      session_id: 'session-alpha',
      sequence_number: 2,
      timestamp: '2026-10-18T10:00:00.450Z', // +450ms
      decision: 'ALLOW',
      execution_state: 'EXECUTED',
      tool_name: 'net_http_get',
      action: { category: 'NETWORK_QUERY', normalized_name: 'net_get' },
      action_record: { risk_score: 0.35, auth_status: 'AUTHORIZED' },
    },
    {
      interception_id: 'evt-3',
      session_id: 'session-alpha',
      sequence_number: 3,
      timestamp: '2026-10-18T10:00:02.000Z', // +1.55s
      decision: 'ALERT',
      execution_state: 'EXECUTED',
      tool_name: 'db_update_record',
      action: { category: 'DATABASE_MUTATION', normalized_name: 'db_update' },
      action_record: { risk_score: 0.65, auth_status: 'FLAGGED' },
    },
    {
      interception_id: 'evt-4',
      session_id: 'session-alpha',
      sequence_number: 4,
      timestamp: '2026-10-18T10:00:05.500Z', // +3.5s
      decision: 'BLOCK',
      execution_state: 'BLOCKED_BY_POLICY',
      tool_name: 'sys_exec_bash',
      action: { category: 'SYSTEM_COMMAND', normalized_name: 'sys_exec' },
      action_record: { risk_score: 0.92, auth_status: 'DENIED' },
    },
  ];

  const setupDefaultRoutes = async (page: any) => {
    await page.route('**/api/v1/metrics/timeseries*', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { time: '2026-10-18T10:00:00Z', allow: 30, alert: 10, block: 5 },
        ]),
      });
    });

    await page.route('**/api/v1/metrics*', async (route: any) => {
      if (route.request().url().includes('/timeseries')) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockMetrics),
      });
    });

    await page.route('**/api/v1/audit*', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockAuditEvents),
      });
    });

    await page.route('**/api/v1/sessions*', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { session_id: 'session-alpha', task_id: 'task-1', agent_id: 'agent-1', status: 'active' },
        ]),
      });
    });
  };

  test('M7 Decision Distribution Chart renders verdicts, counts, and percentages accurately', async ({ page }) => {
    await setupDefaultRoutes(page);
    await page.goto('/');

    const card = page.locator('[data-testid="decision-distribution-card"]');
    await expect(card).toBeVisible();

    // Verify Title and Subtext
    await expect(card.getByText('M7 Policy Decisions')).toBeVisible();
    await expect(card.getByText('Authoritative Invariants')).toBeVisible();

    // Verify Verdict Counts from mock: allow=30, alert=10, block=5
    await expect(card.locator('[data-testid="decision-stat-allow"]')).toContainText('30');
    await expect(card.locator('[data-testid="decision-stat-allow"]')).toContainText('(67%)');

    await expect(card.locator('[data-testid="decision-stat-alert"]')).toContainText('10');
    await expect(card.locator('[data-testid="decision-stat-alert"]')).toContainText('(22%)');

    await expect(card.locator('[data-testid="decision-stat-block"]')).toContainText('5');
    await expect(card.locator('[data-testid="decision-stat-block"]')).toContainText('(11%)');

    // Verify Total Count badge
    await expect(card.getByText('Total: 45')).toBeVisible();
  });

  test('M2 Tool Category Distribution Chart renders normalized categories and counts', async ({ page }) => {
    await setupDefaultRoutes(page);
    await page.goto('/');

    const card = page.locator('[data-testid="tool-category-card"]');
    await expect(card).toBeVisible();

    // Verify Title and Subtext
    await expect(card.getByText('M2 Tool Categories')).toBeVisible();
    await expect(card.getByText('Semantic Normalization')).toBeVisible();

    // Verify Category badges
    await expect(card.getByText('FS Read:')).toBeVisible();
    await expect(card.getByText('Network:')).toBeVisible();
    await expect(card.getByText('Database:')).toBeVisible();
    await expect(card.getByText('System Cmd:')).toBeVisible();

    // Verify total calls badge
    await expect(card.getByText('Total: 45 calls')).toBeVisible();
  });

  test('M5 Behavioral Risk Histogram renders binned scores and summary statistics', async ({ page }) => {
    await setupDefaultRoutes(page);
    await page.goto('/');

    const card = page.locator('[data-testid="risk-histogram-card"]');
    await expect(card).toBeVisible();

    // Verify Title and Provenance
    await expect(card.getByText('M5 Behavioral Risk Histogram')).toBeVisible();
    await expect(card.getByText('Behavioral Risk Distribution')).toBeVisible();

    // Verify Summary Statistics via test IDs:
    // scores: [0.15, 0.35, 0.65, 0.92] -> sum = 2.07 -> mean = 0.5175 -> toFixed(3) = "0.517", max = 0.920
    await expect(card.locator('[data-testid="mean-risk-score"]')).toContainText('0.517');
    await expect(card.locator('[data-testid="peak-risk-score"]')).toContainText('0.920');
    await expect(card.locator('[data-testid="scored-events-count"]')).toContainText('4');
  });

  test('Inter-Action Transition Timing renders transition deltas and truthful sub-stage unavailability banner', async ({ page }) => {
    await setupDefaultRoutes(page);
    await page.goto('/');

    const card = page.locator('[data-testid="stage-latency-card"]');
    await expect(card).toBeVisible();

    // Verify Title and Provenance
    await expect(card.getByText('Inter-Action Transition Timing')).toBeVisible();
    await expect(card.getByText('Temporal Observability')).toBeVisible();

    // Verify Truthful Provenance Banner
    await expect(card.getByText('SUB-STAGE PROFILING: UNAVAILABLE')).toBeVisible();
    await expect(card.getByText('Internal M1–M8 microsecond breakdown is not persisted in the database schema.')).toBeVisible();

    // Verify Measured Count: 3 transitions among 4 events
    await expect(card.locator('[data-testid="measured-transitions-count"]')).toContainText('3');

    // Verify Peak Transition Delta: 3.5 s
    await expect(card.locator('[data-testid="peak-transition-delta"]')).toContainText('3.5 s');
  });

  test('Empty states render truthfully when zero events are present', async ({ page }) => {
    await page.route('**/api/v1/metrics/timeseries*', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/api/v1/metrics*', async (route: any) => {
      if (route.request().url().includes('/timeseries')) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total_interceptions: 0,
          decisions: { allow: 0, alert: 0, block: 0 },
          actions_by_category: {},
        }),
      });
    });

    await page.route('**/api/v1/audit*', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/api/v1/sessions*', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/');

    // Check empty states in all 4 cards
    await expect(page.getByText('No policy verdicts recorded yet.')).toBeVisible();
    await expect(page.getByText('No tool actions categorized yet.')).toBeVisible();
    await expect(page.getByText('No behavioral risk scores evaluated yet.')).toBeVisible();
    await expect(page.getByText('Insufficient sequential events for transition delta.')).toBeVisible();
  });
});
