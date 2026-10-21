import { test, expect } from '@playwright/test';

test.describe('Phase 5B: Design Polish, Micro-Animations, and Responsive Refinement', () => {

  const mockMetrics = {
    total_interceptions: 45,
    decisions: { allow: 30, alert: 10, block: 5 },
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
      timestamp: '2026-10-18T10:00:00.450Z',
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
        body: JSON.stringify([{ time: '2026-10-18T10:00:00Z', allow: 30, alert: 10, block: 5 }]),
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

  test('Accurate scientific terminology in statistical visualizations (no unverified calibration claims)', async ({ page }) => {
    await setupDefaultRoutes(page);
    await page.goto('/');

    const riskCard = page.locator('[data-testid="risk-histogram-card"]');
    await expect(riskCard).toBeVisible();

    // Verify uncalibrated claim was replaced by accurate behavioral risk wording
    await expect(riskCard.getByText('Behavioral Risk Distribution')).toBeVisible();
    await expect(riskCard.getByText('Empirical Risk Calibration')).not.toBeVisible();
    await expect(riskCard.getByText('Frequency of evaluated actions across behavioral risk intervals (0.0 to 1.0).')).toBeVisible();
    await expect(riskCard.getByText('100% Evaluated')).toBeVisible();

    // Verify timing chart maintains strict distinction between transition intervals and internal pipeline timers
    const timingCard = page.locator('[data-testid="stage-latency-card"]');
    await expect(timingCard).toBeVisible();
    await expect(timingCard.getByText('SUB-STAGE PROFILING: UNAVAILABLE')).toBeVisible();
    await expect(timingCard.getByText('Internal M1–M8 microsecond breakdown is not persisted in the database schema.')).toBeVisible();
  });

  test('Drawer entry transitions and backdrop fade classes apply properly', async ({ page }) => {
    await setupDefaultRoutes(page);
    await page.goto('/decision-explorer?session=session-alpha&interception=evt-1');

    // Open What-If / Counterfactual drawer
    const openBtn = page.locator('[data-testid="open-counterfactual-drawer-btn"]');
    await expect(openBtn).toBeVisible();
    await openBtn.click();

    // Verify drawer backdrop has purposeful fade animation class
    const backdrop = page.locator('[data-testid="counterfactual-drawer-backdrop"]');
    await expect(backdrop).toBeVisible();
    await expect(backdrop).toHaveClass(/animate-backdrop-fade/);

    // Verify drawer body has slide animation class
    const drawer = page.locator('[data-testid="counterfactual-drawer"]');
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveClass(/animate-drawer-slide/);

    // Verify accessible role and attributes
    await expect(drawer).toHaveAttribute('role', 'dialog');
    await expect(drawer).toHaveAttribute('aria-modal', 'true');
    await expect(drawer).toHaveAttribute('aria-labelledby', 'counterfactual-drawer-title');

    // Close via accessible close button
    const closeBtn = page.locator('[data-testid="close-counterfactual-drawer-btn"]');
    await expect(closeBtn).toHaveAttribute('aria-label', 'Close Counterfactual Drawer');
    await closeBtn.click();
    await expect(drawer).not.toBeVisible();
  });

  test('Responsive behavior: Desktop (1280px), Tablet (768px), and Mobile (375px)', async ({ page }) => {
    await setupDefaultRoutes(page);

    // 1. Desktop: 1280 x 800
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await expect(page.locator('[data-testid="decision-distribution-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="risk-histogram-card"]')).toBeVisible();

    // 2. Tablet: 768 x 1024
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/decision-explorer?session=session-alpha&interception=evt-1');
    const stepperTabs = page.locator('[role="tab"]');
    await expect(stepperTabs.first()).toBeVisible();

    // 3. Mobile: 375 x 667
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Check that cards remain visible on mobile
    await expect(page.locator('[data-testid="decision-distribution-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="tool-category-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="risk-histogram-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="stage-latency-card"]')).toBeVisible();
  });

  test('Keyboard navigation and visible focus rings', async ({ page }) => {
    await setupDefaultRoutes(page);
    await page.goto('/');

    // Tab through sidebar links and verify they receive focus
    const firstSidebarLink = page.locator('aside nav a, aside a').first();
    await firstSidebarLink.focus();
    await expect(firstSidebarLink).toBeFocused();

    // Focus on Action button on Dashboard
    const syncButton = page.getByRole('button', { name: /Sync Pipeline/i });
    await syncButton.focus();
    await expect(syncButton).toBeFocused();
  });

  test('Respects prefers-reduced-motion in global stylesheet', async ({ page }) => {
    // Emulate reduced motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setupDefaultRoutes(page);
    await page.goto('/decision-explorer?session=session-alpha&interception=evt-1');

    // Open drawer
    await page.locator('[data-testid="open-counterfactual-drawer-btn"]').click();
    const drawer = page.locator('[data-testid="counterfactual-drawer"]');
    await expect(drawer).toBeVisible();

    // Verify computed animation property is none or 0.01ms under reduced motion
    const animationName = await drawer.evaluate((el) => {
      return window.getComputedStyle(el).animationName;
    });
    expect(animationName === 'none' || animationName === '').toBeTruthy();
  });
});
