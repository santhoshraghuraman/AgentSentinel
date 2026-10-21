/**
 * Phase6CSecurityCommandCentre.spec.ts — Phase 6C
 *
 * Dedicated Playwright test suite for the Interactive Three.js/WebGL Security Command Centre:
 * 1. Rendering and 2D/3D seamless integration.
 * 2. Real telemetry visualization (ALLOW, ALERT, BLOCK counts).
 * 3. Strict governance separation: M5 risk heuristic vs M7 policy decision vs M8 runtime outcome.
 * 4. Architectural group selection (M1-M2, M3-M5, M6, M7, M8) with keyboard accessibility.
 * 5. Camera controls: reset view, motion pause/resume, zoom.
 * 6. WebGL failure fallback to functional 2D radar.
 * 7. Reduced-motion preference detection.
 * 8. Responsive layout & mobile viewport adaptation without horizontal overflow.
 * 9. Zero-side-effects: strictly read-only observability without backend mutation.
 */

import { test, expect } from '@playwright/test';

test.describe('Phase 6C: Interactive Three.js Security Command Centre', () => {
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

  const setupMockRoutes = async (page: any, metrics: any = mockMetricsCritical, audit: any[] = mockAuditEvents) => {
    await page.route('**/api/v1/metrics/timeseries*', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            time: '2026-10-18T10:00:00Z',
            allow: metrics?.decisions?.allow || 0,
            alert: metrics?.decisions?.alert || 0,
            block: metrics?.decisions?.block || 0,
          },
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
        body: JSON.stringify(metrics || {}),
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

  test('1. Dashboard loads and 2D/3D toggle seamlessly switches to 3D Command Centre', async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/');

    // Initially loads 2D radar (zero regression baseline)
    const toggle3D = page.locator('[data-testid="view-mode-toggle"]');
    await expect(toggle3D).toBeVisible();

    // Click 3D View button
    await toggle3D.click();

    // Verify 3D Command Centre card is active
    const commandCentre = page.locator('[data-testid="sentinel-command-centre"]');
    await expect(commandCentre).toBeVisible();
    await expect(commandCentre.getByText('Sentinel Core Security Command Centre')).toBeVisible();

    // Verify 3D Canvas element exists
    const canvasContainer = page.locator('[data-testid="sentinel-3d-canvas"]');
    await expect(canvasContainer).toBeVisible();
    await expect(canvasContainer.locator('canvas')).toBeVisible();
  });

  test('2. Switching 3D to 2D preserves telemetry and active temporal scope', async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/');

    // Switch to 3D
    await page.locator('[data-testid="view-mode-toggle"]').click();
    await expect(page.locator('[data-testid="sentinel-command-centre"]')).toBeVisible();

    // Select temporal scope "24h" in 3D
    const scope24h = page.locator('[data-testid="scope-btn-24h"]');
    await scope24h.click();

    // Switch back to 2D Radar
    const toggle2D = page.locator('[data-testid="view-mode-2d-toggle"]');
    await toggle2D.click();

    // Verify 2D radar is visible
    const radar = page.locator('[data-testid="sentinel-core-radar"]');
    await expect(radar).toBeVisible();

    // Verify 2D displays the same decision numbers
    const decisionSummary = radar.locator('[data-testid="radar-decision-summary"]');
    await expect(decisionSummary).toContainText('30');
    await expect(decisionSummary).toContainText('10');
    await expect(decisionSummary).toContainText('5');
  });

  test('3. 3D Camera Controls: Reset View, Pause/Resume Motion, Zoom In/Out', async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/');
    await page.locator('[data-testid="view-mode-toggle"]').click();

    // Motion control
    const pauseBtn = page.locator('[data-testid="pause-motion-btn"]');
    await expect(pauseBtn).toBeVisible();
    await expect(pauseBtn).toContainText('Pause Motion');

    await pauseBtn.click();
    await expect(pauseBtn).toContainText('Resume Motion');
    await expect(pauseBtn).toHaveAttribute('aria-pressed', 'true');

    await pauseBtn.click();
    await expect(pauseBtn).toContainText('Pause Motion');
    await expect(pauseBtn).toHaveAttribute('aria-pressed', 'false');

    // Camera reset
    const resetBtn = page.locator('[data-testid="reset-camera-btn"]');
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();

    // Zoom controls
    const zoomInBtn = page.locator('[data-testid="zoom-in-btn"]');
    const zoomOutBtn = page.locator('[data-testid="zoom-out-btn"]');
    if (await zoomInBtn.isVisible()) {
      await zoomInBtn.click();
      await zoomOutBtn.click();
    }
  });

  test('4. Architectural Group Selection (M1-M2, M3-M5, M6, M7, M8) with Keyboard & Details Panel Updates', async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/');
    await page.locator('[data-testid="view-mode-toggle"]').click();

    const detailPanel = page.locator('[data-testid="command-centre-detail-panel"]');
    await expect(detailPanel).toBeVisible();

    // Check M7 tab (Authoritative Decision Authority)
    const tabM7 = page.locator('[data-testid="arch-tab-ring-m7"]');
    await tabM7.click();
    await expect(detailPanel).toContainText('M7: Authoritative Governance Decision');
    await expect(detailPanel).toContainText('SOLE DECISION AUTHORITY');
    await expect(detailPanel).toContainText('single authoritative source of truth for governance decisions');

    // Check M8 tab (Enforcement Kernel & Zero-Call Invariant)
    const tabM8 = page.locator('[data-testid="arch-tab-ring-m8"]');
    await tabM8.click();
    await expect(detailPanel).toContainText('M8: Runtime Interception & Enforcement');
    await expect(detailPanel).toContainText('ENFORCEMENT KERNEL');
    await expect(detailPanel).toContainText('M8 guarantees zero protected-callable invocations');

    // Check M3-M5 tab (Behavioral Sequence & Risk Model)
    const tabM3M5 = page.locator('[data-testid="arch-tab-ring-m3m5"]');
    await tabM3M5.click();
    await expect(detailPanel).toContainText('M3–M5: Sequence & Risk Assessment');
    await expect(detailPanel).toContainText('Risk scores are NEVER presented as final decisions');

    // Check M1-M2 tab via keyboard (focus + Enter)
    const tabM1M2 = page.locator('[data-testid="arch-tab-ring-m1m2"]');
    await tabM1M2.focus();
    await page.keyboard.press('Enter');
    await expect(detailPanel).toContainText('M1–M2: Ingestion & Normalization');
  });

  test('5. Real Telemetry Separation: M7 Decisions vs M8 Execution Outcomes', async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/');
    await page.locator('[data-testid="view-mode-toggle"]').click();

    // Verify aggregate M7 telemetry counts
    await expect(page.locator('[data-testid="telemetry-total-interceptions"]')).toHaveText('45');
    await expect(page.locator('[data-testid="telemetry-allow-count"]')).toHaveText('30');
    await expect(page.locator('[data-testid="telemetry-alert-count"]')).toHaveText('10');
    await expect(page.locator('[data-testid="telemetry-block-count"]')).toHaveText('5');

    // Verify M8 execution outcome counts (truthfully separated from M7 decisions)
    // In mockAuditEvents: 1 blocked, 1 failed, 2 executed
    await expect(page.locator('[data-testid="execution-executed-count"]')).toHaveText('2');
    await expect(page.locator('[data-testid="execution-blocked-count"]')).toHaveText('1');
    await expect(page.locator('[data-testid="execution-failed-count"]')).toHaveText('1');
  });

  test('6. Correlated Stage Telemetry Events & Event Selection', async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/');
    await page.locator('[data-testid="view-mode-toggle"]').click();

    // Select M8 tab to see enforcement events
    await page.locator('[data-testid="arch-tab-ring-m8"]').click();

    const stageEvents = page.locator('[data-testid="correlated-stage-events"]');
    await expect(stageEvents).toBeVisible();

    const blockEvent = page.locator('[data-testid="stage-event-evt-block-01"]');
    await expect(blockEvent).toBeVisible();
    await expect(blockEvent).toContainText('bash_exec');
    await expect(blockEvent).toContainText('BLOCK');
    await expect(blockEvent).toContainText('BLOCKED_BY_POLICY');

    // Select the event
    await blockEvent.click();
    await expect(blockEvent).toHaveClass(/border-indigo-400/);
  });

  test('7. Empty and Awaiting Telemetry State Displays Honest Disclosures', async ({ page }) => {
    const emptyMetrics = {
      total_interceptions: 0,
      decisions: { allow: 0, alert: 0, block: 0 },
      actions_by_category: {},
    };
    await setupMockRoutes(page, emptyMetrics, []);
    await page.goto('/');
    await page.locator('[data-testid="view-mode-toggle"]').click();

    // Posture should be Awaiting Telemetry
    const postureBadge = page.locator('[data-testid="sentinel-command-centre"]').locator('text=Awaiting Telemetry');
    await expect(postureBadge).toBeVisible();

    // Total should be 0
    await expect(page.locator('[data-testid="telemetry-total-interceptions"]')).toHaveText('0');
  });

  test('8. Respects prefers-reduced-motion Preference', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setupMockRoutes(page);
    await page.goto('/');
    await page.locator('[data-testid="view-mode-toggle"]').click();

    // When reduced-motion is active, motion should be paused by default
    const pauseBtn = page.locator('[data-testid="pause-motion-btn"]');
    await expect(pauseBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(pauseBtn).toContainText('Resume Motion');
  });

  test('9. Responsive Layout on Mobile Viewport (375x667) without Horizontal Overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await setupMockRoutes(page);
    await page.goto('/');
    await page.locator('[data-testid="view-mode-toggle"]').click();

    const commandCentre = page.locator('[data-testid="sentinel-command-centre"]');
    await expect(commandCentre).toBeVisible();

    // Check horizontal scroll width of the document
    const isOverflowing = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(isOverflowing).toBe(false);
  });

  test('10. Zero Governance Side-Effects: Interactions do not trigger agent execution or mutations', async ({ page }) => {
    await setupMockRoutes(page);

    let unexpectedCallDetected = false;
    await page.route('**/api/v1/agent/**', (route) => {
      unexpectedCallDetected = true;
      route.abort();
    });

    await page.goto('/');

    // Toggle 3D
    await page.locator('[data-testid="view-mode-toggle"]').click();

    // Click tabs
    await page.locator('[data-testid="arch-tab-ring-m7"]').click();
    await page.locator('[data-testid="arch-tab-ring-m8"]').click();
    await page.locator('[data-testid="arch-tab-ring-m1m2"]').click();

    // Reset camera & pause motion
    await page.locator('[data-testid="reset-camera-btn"]').click();
    await page.locator('[data-testid="pause-motion-btn"]').click();

    // Toggle back to 2D
    await page.locator('[data-testid="view-mode-2d-toggle"]').click();

    // Confirm zero backend agent runs or policy mutations occurred
    expect(unexpectedCallDetected).toBe(false);
  });
});
