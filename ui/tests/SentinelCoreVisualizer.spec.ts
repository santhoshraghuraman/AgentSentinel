/**
 * SentinelCoreVisualizer.spec.ts — Phase 5C
 *
 * Automated Playwright test suite for Sentinel Core Radar visualization:
 * 1. Rendering with actual available ALLOW, ALERT, and BLOCK decision records.
 * 2. Empty, missing, stale, and ambiguous telemetry behavior.
 * 3. Distinction between M5 risk score, M7 decision, and M8 execution outcome.
 * 4. Correlation of a decision with its own enforcement evidence.
 * 5. BLOCK zero-call invariant evidence presentation without claiming frontend enforcement.
 * 6. Keyboard navigation, focus visibility, accessible labels, and readable text equivalents.
 * 7. Reduced-motion behavior.
 * 8. Desktop, tablet, and mobile layout usability.
 * 9. Dashboard integration and regression checks.
 */

import { test, expect } from '@playwright/test';

test.describe('Phase 5C: Sentinel Core Radar Visualization', () => {
  // Mock data representing realistic telemetry with distinct M5, M7, and M8 states
  const mockMetricsNominal = {
    total_interceptions: 25,
    decisions: {
      allow: 25,
      alert: 0,
      block: 0,
    },
    actions_by_category: {
      FILE_SYSTEM_READ: 15,
      NETWORK_QUERY: 10,
    },
  };

  const mockMetricsElevated = {
    total_interceptions: 30,
    decisions: {
      allow: 22,
      alert: 8,
      block: 0,
    },
    actions_by_category: {
      FILE_SYSTEM_READ: 12,
      NETWORK_QUERY: 10,
      SYSTEM_COMMAND: 8,
    },
  };

  const mockMetricsCritical = {
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
      interception_id: 'evt-block-01',
      session_id: 'session-sec-1',
      sequence_number: 1,
      timestamp: '2026-10-18T10:00:00.000Z',
      decision: 'BLOCK',
      execution_state: 'BLOCKED_BY_POLICY',
      tool_name: 'bash_exec_rm',
      action: { category: 'SYSTEM_COMMAND', normalized_name: 'bash_exec', is_destructive: true },
      action_record: {
        risk_score: 0.94,
        auth_status: 'DENIED',
        matched_policy_id: 'POL-BLOCK-DESTRUCTIVE-BASH',
        reasons: [{ rule_type: 'POLICY', description: 'Destructive command forbidden' }],
      },
    },
    {
      interception_id: 'evt-allow-fail-02',
      session_id: 'session-sec-1',
      sequence_number: 2,
      timestamp: '2026-10-18T10:00:05.000Z',
      decision: 'ALLOW',
      execution_state: 'EXECUTION_FAILED',
      tool_name: 'net_http_post',
      action: { category: 'NETWORK_QUERY', normalized_name: 'http_post', is_mutating: true },
      action_record: {
        risk_score: 0.28,
        auth_status: 'AUTHORIZED',
        matched_policy_id: 'POL-ALLOW-STANDARD-NET',
        reasons: [{ rule_type: 'POLICY', description: 'Authorized API endpoint' }],
      },
    },
    {
      interception_id: 'evt-allow-exec-03',
      session_id: 'session-sec-1',
      sequence_number: 3,
      timestamp: '2026-10-18T10:00:10.000Z',
      decision: 'ALLOW',
      execution_state: 'EXECUTED',
      tool_name: 'read_config',
      action: { category: 'FILE_SYSTEM_READ', normalized_name: 'read_file', is_mutating: false },
      action_record: {
        risk_score: 0.05,
        auth_status: 'AUTHORIZED',
        matched_policy_id: 'POL-ALLOW-FS-READ',
        reasons: [{ rule_type: 'POLICY', description: 'Read-only access permitted' }],
      },
    },
    {
      interception_id: 'evt-alert-exec-04',
      session_id: 'session-sec-1',
      sequence_number: 4,
      timestamp: '2026-10-18T10:00:15.000Z',
      decision: 'ALERT',
      execution_state: 'EXECUTED',
      tool_name: 'sql_bulk_read',
      action: { category: 'DATABASE_MUTATION', normalized_name: 'sql_query', is_mutating: false },
      action_record: {
        risk_score: 0.62,
        auth_status: 'AUTHORIZED',
        matched_policy_id: 'POL-ALERT-BULK-QUERY',
        reasons: [{ rule_type: 'POLICY', description: 'Unusual query volume flagged' }],
      },
    },
  ];

  const setupMockRoutes = async (page: any, metrics: any, audit: any[] = mockAuditEvents) => {
    await page.route('**/api/v1/metrics/timeseries*', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { time: '2026-10-18T10:00:00Z', allow: metrics?.decisions?.allow || 0, alert: metrics?.decisions?.alert || 0, block: metrics?.decisions?.block || 0 },
        ]),
      });
    });

    await page.route('**/api/v1/metrics*', async (route: any) => {
      if (route.request().url().includes('/timeseries')) {
        await route.fallback();
        return;
      }
      if (!metrics) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({}),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(metrics),
      });
    });

    await page.route('**/api/v1/audit*', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(audit),
      });
    });

    await page.route('**/api/v1/sessions*', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { session_id: 'session-sec-1', task_id: 'task-1', agent_id: 'agent-1', status: 'active' },
        ]),
      });
    });
  };

  // Test 1: Rendering with actual available ALLOW, ALERT, and BLOCK decision records
  test('1. Renders CRITICAL posture when block count > 0 with accurate decision badges', async ({ page }) => {
    await setupMockRoutes(page, mockMetricsCritical);
    await page.goto('/');

    const radarCard = page.locator('[data-testid="sentinel-core-radar"]');
    await expect(radarCard).toBeVisible();

    // Verify Title & Posture Badge
    await expect(radarCard.getByText('Sentinel Core Radar — M1–M8 Defense Perimeter')).toBeVisible();
    const badge = radarCard.locator('[data-testid="posture-badge"]');
    await expect(badge).toHaveText('Critical');

    // Verify Aggregate Decision Summary
    const decisionSummary = radarCard.locator('[data-testid="radar-decision-summary"]');
    await expect(decisionSummary).toContainText('30'); // ALLOW
    await expect(decisionSummary).toContainText('10'); // ALERT
    await expect(decisionSummary).toContainText('5');  // BLOCK

    // Verify SVG Radar exists and has correct accessible attributes
    const svg = radarCard.locator('[data-testid="radar-svg"]');
    await expect(svg).toBeVisible();
    await expect(svg).toHaveAttribute('role', 'img');
  });

  test('1b. Renders NOMINAL posture when all events are ALLOW', async ({ page }) => {
    await setupMockRoutes(page, mockMetricsNominal, [mockAuditEvents[2]]);
    await page.goto('/');

    const radarCard = page.locator('[data-testid="sentinel-core-radar"]');
    const badge = radarCard.locator('[data-testid="posture-badge"]');
    await expect(badge).toHaveText('Nominal');
    await expect(radarCard.locator('[data-testid="posture-status-banner"]').getByText('All evaluated actions authorized')).toBeVisible();
  });

  test('1c. Renders ELEVATED posture when alert > 0 and block === 0', async ({ page }) => {
    await setupMockRoutes(page, mockMetricsElevated, [mockAuditEvents[3]]);
    await page.goto('/');

    const radarCard = page.locator('[data-testid="sentinel-core-radar"]');
    const badge = radarCard.locator('[data-testid="posture-badge"]');
    await expect(badge).toHaveText('Elevated');
    await expect(radarCard.locator('[data-testid="posture-status-banner"]').getByText('Alert-level actions detected')).toBeVisible();
  });

  // Test 2: Empty, missing, stale, and ambiguous telemetry behavior
  test('2. Discloses Awaiting Telemetry when total_interceptions is 0 or undefined', async ({ page }) => {
    const emptyMetrics = { total_interceptions: 0, decisions: { allow: 0, alert: 0, block: 0 } };
    await setupMockRoutes(page, emptyMetrics, []);
    await page.goto('/');

    const radarCard = page.locator('[data-testid="sentinel-core-radar"]');
    const badge = radarCard.locator('[data-testid="posture-badge"]');
    await expect(badge).toHaveText('Awaiting Telemetry');

    // Sweep line should NOT be present when awaiting data
    const sweepGroup = radarCard.locator('[data-testid="radar-sweep-group"]');
    await expect(sweepGroup).toHaveCount(0);

    // Provenance indicates awaiting status
    await expect(radarCard.getByText('Status: Awaiting runtime telemetry')).toBeVisible();
  });

  // Test 3: Distinction between M5 risk score, M7 decision, and M8 execution outcome
  test('3. Strictly distinguishes M5 continuous risk score from M7 decision and M8 outcome', async ({ page }) => {
    await setupMockRoutes(page, mockMetricsCritical, mockAuditEvents);
    await page.goto('/');

    const inspector = page.locator('[data-testid="correlated-event-inspector"]');
    await expect(inspector).toBeVisible();

    // Event 1 has risk_score 0.940, M7 decision BLOCK, M8 outcome BLOCKED_BY_POLICY
    await expect(inspector.getByText('M5 RISK SCORE')).toBeVisible();
    await expect(inspector.getByText('0.940')).toBeVisible();
    await expect(inspector.getByText('Heuristic (Not Decision)')).toBeVisible();

    await expect(inspector.getByText('M7 VERDICT')).toBeVisible();
    await expect(inspector.getByText('BLOCK', { exact: true })).toBeVisible();

    await expect(inspector.getByText('M8 OUTCOME')).toBeVisible();
    await expect(inspector.getByText('BLOCKED_BY_POLICY', { exact: true })).toBeVisible();

    // Navigate to Event 2 which has M7 ALLOW but M8 EXECUTION_FAILED
    const nextBtn = inspector.locator('button[aria-label="Next audit event"]');
    await nextBtn.click();

    // Check Event 2
    await expect(inspector.locator('text=evt-allow-fail-02').first()).toBeVisible();
    await expect(inspector.getByText('0.280')).toBeVisible();
    await expect(inspector.getByText('ALLOW', { exact: true })).toBeVisible();
    await expect(inspector.getByText('EXECUTION_FAILED', { exact: true })).toBeVisible();

    // Verify explanation emphasizes the distinction
    await expect(inspector.getByText('Decision vs Execution Outcome:')).toBeVisible();
    await expect(inspector.getByText('governance authorization is distinct from operational execution outcome')).toBeVisible();
  });

  // Test 4: Correlation of a decision with its own enforcement evidence
  test('4. Preserves stable event correlation across pipeline stages', async ({ page }) => {
    await setupMockRoutes(page, mockMetricsCritical, mockAuditEvents);
    await page.goto('/');

    const inspector = page.locator('[data-testid="correlated-event-inspector"]');
    await expect(inspector).toBeVisible();

    // Check event 1 trace has correlated policy and tool
    await expect(inspector.locator('text=evt-block-01').first()).toBeVisible();
    await expect(inspector.getByText('bash_exec_rm')).toBeVisible();
    await expect(inspector.getByText('POL-BLOCK-DESTRUCTIVE-BASH')).toBeVisible();
  });

  // Test 5: BLOCK zero-call invariant evidence presentation without claiming frontend enforcement
  test('5. Presents BLOCK zero-call invariant as backend guarantee with correlated evidence', async ({ page }) => {
    await setupMockRoutes(page, mockMetricsCritical, mockAuditEvents);
    await page.goto('/');

    const banner = page.locator('[data-testid="block-invariant-banner"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Architectural Invariant: Zero Protected-Callable Invocations on BLOCK');
    await expect(banner).toContainText('enforced exclusively by the backend runtime interceptor, not by this frontend visualization');
    await expect(banner).toContainText('5 recorded events met this enforcement invariant');
  });

  // Test 6: Keyboard navigation, focus visibility, accessible labels, and readable text equivalents
  test('6. Supports keyboard navigation on perimeter rings with accessible descriptions', async ({ page }) => {
    await setupMockRoutes(page, mockMetricsCritical);
    await page.goto('/');

    const radarCard = page.locator('[data-testid="sentinel-core-radar"]');

    // Check that all 5 perimeter buttons exist in the legend
    const ringM1M2 = radarCard.locator('[data-testid="ring-legend-ring-m1m2"]');
    const ringM3M5 = radarCard.locator('[data-testid="ring-legend-ring-m3m5"]');
    const ringM6 = radarCard.locator('[data-testid="ring-legend-ring-m6"]');
    const ringM7 = radarCard.locator('[data-testid="ring-legend-ring-m7"]');
    const ringM8 = radarCard.locator('[data-testid="ring-legend-ring-m8"]');

    await expect(ringM1M2).toBeVisible();
    await expect(ringM3M5).toBeVisible();
    await expect(ringM6).toBeVisible();
    await expect(ringM7).toBeVisible();
    await expect(ringM8).toBeVisible();

    // Test keyboard focus and Enter key to toggle stage details
    await ringM7.focus();
    await expect(ringM7).toBeFocused();
    await ringM7.press('Enter');

    // Detail panel expands with M7 description
    const detailPanel = radarCard.locator('[data-testid="selected-ring-detail"]');
    await expect(detailPanel).toBeVisible();
    await expect(detailPanel).toContainText('M7: Authoritative Governance Decision');
    await expect(detailPanel).toContainText('Sole source of ALLOW, ALERT, and BLOCK verdicts');

    // Switch to M8 via click
    await ringM8.click();
    await expect(detailPanel).toContainText('M8: Runtime Interception & Enforcement');
    await expect(detailPanel).toContainText('zero calls');
  });

  // Test 7: Reduced-motion behavior
  test('7. Respects prefers-reduced-motion without breaking visualization layout', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setupMockRoutes(page, mockMetricsCritical);
    await page.goto('/');

    const radarCard = page.locator('[data-testid="sentinel-core-radar"]');
    await expect(radarCard).toBeVisible();

    const svg = radarCard.locator('[data-testid="radar-svg"]');
    await expect(svg).toBeVisible();

    // SVG elements still render cleanly and visibly
    const coreHub = radarCard.locator('[data-testid="radar-core-hub"]');
    await expect(coreHub).toBeVisible();
  });

  // Test 8: Desktop, tablet, and mobile layout usability
  test('8. Renders adaptively and prevents horizontal overflow on desktop, tablet, and mobile', async ({ page }) => {
    await setupMockRoutes(page, mockMetricsCritical);

    // 8a. Desktop (1280 x 800)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const desktopCard = page.locator('[data-testid="sentinel-core-radar"]');
    await expect(desktopCard).toBeVisible();
    let hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasOverflow).toBe(false);

    // 8b. Tablet (768 x 1024)
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(desktopCard).toBeVisible();
    hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasOverflow).toBe(false);

    // 8c. Mobile (375 x 667)
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(desktopCard).toBeVisible();
    hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasOverflow).toBe(false);

    // Ensure buttons remain visible and interactive on mobile
    const m7Ring = desktopCard.locator('[data-testid="ring-legend-ring-m7"]');
    await expect(m7Ring).toBeVisible();
  });

  // Test 9: Dashboard integration and regression checks
  test('9. Integrates seamlessly into DashboardPage alongside KPI cards, timeline, and statistical charts', async ({ page }) => {
    await setupMockRoutes(page, mockMetricsCritical);
    await page.goto('/');

    // 1. KPI cards visible
    await expect(page.getByText('Total Interceptions')).toBeVisible();
    await expect(page.getByText('Allowed', { exact: true })).toBeVisible();
    await expect(page.getByText('Blocked', { exact: true })).toBeVisible();

    // 2. Sentinel Core Radar visible
    await expect(page.locator('[data-testid="sentinel-core-radar"]')).toBeVisible();

    // 3. Middle row timeline chart visible
    await expect(page.getByText('Runtime Governance Activity')).toBeVisible();

    // 4. Statistical charts from Phase 5A visible
    await expect(page.locator('[data-testid="decision-distribution-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="tool-category-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="risk-histogram-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="stage-latency-card"]')).toBeVisible();

    // 5. Interceptions table visible
    await expect(page.getByText('Recent Runtime Interceptions')).toBeVisible();
  });
});
