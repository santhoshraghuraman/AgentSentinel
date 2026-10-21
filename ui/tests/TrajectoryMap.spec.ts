import { test, expect } from '@playwright/test';

test.describe('Phase 4C: Security Trajectory Map', () => {

  const mockSession = [
    {
      session_id: 'sess_traj_4c',
      task_id: 'task_security_eval',
      agent_id: 'audit_agent',
      created_at: '2026-10-18T10:00:00Z',
      status: 'completed',
      verdict_counts: { ALLOW: 1, ALERT: 1, BLOCK: 1 },
      total_events: 3,
    },
  ];

  const mockEvents = [
    {
      interception_id: 'int_4c_01',
      session_id: 'sess_traj_4c',
      sequence_number: 1,
      timestamp: '2026-10-18T10:00:00.000Z',
      decision: 'ALLOW',
      execution_state: 'EXECUTED',
      tool_name: 'read_config_file',
      arguments: { path: '/workspace/app_config.yaml' },
      action: {
        category: 'file_system',
        normalized_name: 'fs:read',
        is_mutating: false,
        is_destructive: false,
      },
      action_record: {
        risk_score: 0.05,
        auth_status: 'AUTHORIZED',
        policy_id: 'pol_fs_read_allow',
      },
    },
    {
      interception_id: 'int_4c_02',
      session_id: 'sess_traj_4c',
      sequence_number: 2,
      timestamp: '2026-10-18T10:00:01.500Z',
      decision: 'ALERT',
      execution_state: 'EXECUTED',
      tool_name: 'write_temp_cache',
      arguments: { path: '/tmp/cache.bin', size_bytes: 4096 },
      action: {
        category: 'file_system',
        normalized_name: 'fs:write',
        is_mutating: true,
        is_destructive: false,
      },
      action_record: {
        risk_score: 0.65,
        auth_status: 'ELEVATED_MONITORING',
        reasons: [{ description: 'High frequency write activity detected' }],
      },
    },
    {
      interception_id: 'int_4c_03',
      session_id: 'sess_traj_4c',
      sequence_number: 3,
      timestamp: '2026-10-18T10:00:02.100Z',
      decision: 'BLOCK',
      execution_state: 'BLOCKED',
      tool_name: 'drop_database_table',
      arguments: { table: 'users_primary' },
      action: {
        category: 'database',
        normalized_name: 'db:drop',
        is_mutating: true,
        is_destructive: true,
      },
      action_record: {
        risk_score: 0.98,
        auth_status: 'UNAUTHORIZED',
        reasons: [{ description: 'Destructive table deletion prohibited by policy pol_db_protect' }],
      },
    },
  ];

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/sessions', async (route) => {
      await route.fulfill({ json: mockSession });
    });
    await page.route('**/api/v1/audit/sess_traj_4c', async (route) => {
      await route.fulfill({ json: mockEvents });
    });
  });

  test('renders Security Trajectory Map with nodes, timing deltas, and posture classification', async ({ page }) => {
    await page.goto('/trajectories');

    // Page title and session identifier
    await expect(page.locator('h1:has-text("Trajectories")')).toBeVisible();
    await expect(page.getByText('sess_traj_4c').first()).toBeVisible();

    // Map container exists with listbox accessibility role
    const mapContainer = page.locator('[role="listbox"][aria-label*="Security Trajectory Map"]');
    await expect(mapContainer).toBeVisible();

    // Posture classification badge (THREAT NEUTRALIZED because step 3 is BLOCK)
    await expect(page.getByText('THREAT NEUTRALIZED')).toBeVisible();

    // Three-tier provenance legend
    await expect(page.getByText('Evidence Classification')).toBeVisible();
    await expect(page.getByText('OBSERVED')).toBeVisible();
    await expect(page.getByText('DECIDED')).toBeVisible();
    await expect(page.getByText('INFERRED')).toBeVisible();

    // Verify all 3 steps render in sequence within the map container
    await expect(mapContainer.getByText('STEP 01')).toBeVisible();
    await expect(mapContainer.getByText('read_config_file')).toBeVisible();

    await expect(mapContainer.getByText('STEP 02')).toBeVisible();
    await expect(mapContainer.getByText('write_temp_cache')).toBeVisible();

    await expect(mapContainer.getByText('STEP 03')).toBeVisible();
    await expect(mapContainer.getByText('drop_database_table')).toBeVisible();

    // Verify delta timestamps (+1.5s between step 1 & 2, +600ms between step 2 & 3)
    await expect(page.getByText('1.5 s')).toBeVisible();
    await expect(page.getByText('600 ms')).toBeVisible();

    // Verify mutation & category badges
    await expect(mapContainer.getByText('MUT').first()).toBeVisible();
    await expect(mapContainer.getByText('DESTR', { exact: true })).toBeVisible();

    // Verify block reason appears on the blocked node
    await expect(mapContainer.getByText('Destructive table deletion prohibited by policy pol_db_protect')).toBeVisible();
  });

  test('synchronizes node selection with the Deep Inspection Drawer', async ({ page }) => {
    await page.goto('/trajectories');

    // Default selection is step 1
    await expect(page.getByText('DEEP INSPECTION DRAWER')).toBeVisible();

    // Click step 2 node
    const step2Node = page.locator('[role="option"]').filter({ hasText: 'STEP 02' });
    await step2Node.click();

    // Drawer updates to step 2 details
    await expect(page.getByText('ELEVATED_MONITORING')).toBeVisible();
    await expect(page.getByText('Step 2: write_temp_cache')).toBeVisible();

    // Click step 3 node
    const step3Node = page.locator('[role="option"]').filter({ hasText: 'STEP 03' });
    await step3Node.click();

    // Drawer updates to step 3 details
    await expect(page.getByText('UNAUTHORIZED')).toBeVisible();
    await expect(page.getByText('Step 3: drop_database_table')).toBeVisible();
  });

  test('supports keyboard navigation on nodes (Enter / Space)', async ({ page }) => {
    await page.goto('/trajectories');

    const step2Node = page.locator('[role="option"]').filter({ hasText: 'STEP 02' });
    await step2Node.focus();
    await page.keyboard.press('Enter');

    // Selection should be active on step 2
    await expect(step2Node).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Step 2: write_temp_cache')).toBeVisible();

    const step3Node = page.locator('[role="option"]').filter({ hasText: 'STEP 03' });
    await step3Node.focus();
    await page.keyboard.press('Space');

    // Selection should be active on step 3
    await expect(step3Node).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Step 3: drop_database_table')).toBeVisible();
  });

  test('toggles seamlessly between Map view and Trace view', async ({ page }) => {
    await page.goto('/trajectories');

    // By default, Map view is active
    await expect(page.locator('[role="listbox"][aria-label*="Security Trajectory Map"]')).toBeVisible();

    // Toggle to Trace view
    const traceBtn = page.getByRole('button', { name: 'Switch to Trace view' });
    await traceBtn.click();

    // Legacy timeline execution trace is visible
    await expect(page.getByText('Trajectory Execution Trace')).toBeVisible();
    await expect(page.locator('[role="listbox"][aria-label*="Security Trajectory Map"]')).not.toBeVisible();

    // Toggle back to Map view
    const mapBtn = page.getByRole('button', { name: 'Switch to Security Trajectory Map view' });
    await mapBtn.click();

    // SecurityTrajectoryMap is visible again
    await expect(page.locator('[role="listbox"][aria-label*="Security Trajectory Map"]')).toBeVisible();
  });

  test('filters nodes by decision tab (ALL, ALLOW, ALERT, BLOCK)', async ({ page }) => {
    await page.goto('/trajectories');
    const mapContainer = page.locator('[role="listbox"][aria-label*="Security Trajectory Map"]');

    // Filter to BLOCK only
    await page.getByRole('button', { name: /Block/i }).click();

    // Only step 3 should be visible in the map
    await expect(mapContainer.getByText('drop_database_table')).toBeVisible();
    await expect(mapContainer.getByText('read_config_file')).not.toBeVisible();

    // Filter to ALLOW only
    await page.getByRole('button', { name: /Allow/i }).click();

    // Only step 1 should be visible in the map
    await expect(mapContainer.getByText('read_config_file')).toBeVisible();
    await expect(mapContainer.getByText('drop_database_table')).not.toBeVisible();

    // Filter back to ALL
    await page.getByRole('button', { name: /^All\b/i }).click();
    await expect(mapContainer.getByText('read_config_file')).toBeVisible();
    await expect(mapContainer.getByText('drop_database_table')).toBeVisible();
  });

  test('renders empty state cleanly when session has no events', async ({ page }) => {
    await page.route('**/api/v1/audit/sess_traj_4c', async (route) => {
      await route.fulfill({ json: [] });
    });

    await page.goto('/trajectories');

    await expect(page.getByText('No Audit Records')).toBeVisible();
    await expect(page.getByText('No runtime interceptions were recorded for session')).toBeVisible();
  });

  test('responsive mobile layout (375x667) renders map without horizontal scroll breaking', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/trajectories');

    // Map and nodes render
    await expect(page.locator('[role="listbox"][aria-label*="Security Trajectory Map"]')).toBeVisible();
    await expect(page.getByText('THREAT NEUTRALIZED')).toBeVisible();
    await expect(page.getByText('STEP 01')).toBeVisible();
  });
});
