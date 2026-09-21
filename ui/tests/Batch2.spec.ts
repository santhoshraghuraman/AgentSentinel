import { test, expect } from '@playwright/test';

test.describe('Phase 4.5 Batch 2: Core Monitoring & Governance Pages', () => {

  test('Trajectories: loads forensic execution trace and deep inspection drawer', async ({ page }) => {
    // Mock sessions
    await page.route('**/api/v1/sessions', async (route) => {
      await route.fulfill({
        json: [
          {
            session_id: 'sess_traj_001',
            task_id: 'task_security_eval',
            agent_id: 'audit_agent',
            created_at: new Date().toISOString(),
            status: 'completed',
            verdict_counts: { ALLOW: 1, BLOCK: 1, ALERT: 0 },
            total_events: 2
          }
        ]
      });
    });

    // Mock audit events for session
    await page.route('**/api/v1/audit/sess_traj_001', async (route) => {
      await route.fulfill({
        json: [
          {
            interception_id: 'int_01',
            session_id: 'sess_traj_001',
            sequence_number: 1,
            timestamp: new Date().toISOString(),
            decision: 'ALLOW',
            execution_state: 'EXECUTED',
            tool_name: 'read_file',
            arguments: { path: '/workspace/config.json' },
            action_record: { risk_score: 0.1, auth_status: 'AUTHORIZED' }
          },
          {
            interception_id: 'int_02',
            session_id: 'sess_traj_001',
            sequence_number: 2,
            timestamp: new Date().toISOString(),
            decision: 'BLOCK',
            execution_state: 'BLOCKED',
            tool_name: 'delete_file',
            arguments: { path: '/workspace/db.sqlite' },
            action_record: { 
              risk_score: 0.95, 
              auth_status: 'UNAUTHORIZED',
              reasons: [{ description: 'Destructive delete prohibited by policy' }]
            }
          }
        ]
      });
    });

    await page.goto('/trajectories');

    // Heading and Session context
    await expect(page.locator('h1:has-text("Trajectories")')).toBeVisible();
    await expect(page.getByText('sess_traj_001').first()).toBeVisible();

    // Timeline execution trace steps
    await expect(page.getByText('STEP 01')).toBeVisible();
    await expect(page.getByText('read_file', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('STEP 02')).toBeVisible();
    await expect(page.getByText('delete_file', { exact: true }).first()).toBeVisible();

    // Deep inspection drawer
    await expect(page.getByText('DEEP INSPECTION DRAWER')).toBeVisible();
    await expect(page.getByText('Deep Dive in Decision Explorer')).toBeVisible();

    // Filter interaction
    await page.getByRole('button', { name: /Block/i }).click();
    await expect(page.getByText('delete_file', { exact: true }).first()).toBeVisible();
  });

  test('Agents & Sessions: renders active fleet workloads and inspector metrics', async ({ page }) => {
    await page.route('**/api/v1/sessions', async (route) => {
      await route.fulfill({
        json: [
          {
            session_id: 'sess_agent_alpha',
            task_id: 'task_sandbox_verify',
            agent_id: 'sentinel_worker',
            created_at: new Date().toISOString(),
            status: 'active',
            verdict_counts: { ALLOW: 3, BLOCK: 0, ALERT: 1 },
            total_events: 4
          }
        ]
      });
    });

    await page.route('**/api/v1/audit/sess_agent_alpha', async (route) => {
      await route.fulfill({
        json: [
          {
            interception_id: 'int_alpha_01',
            session_id: 'sess_agent_alpha',
            sequence_number: 1,
            timestamp: new Date().toISOString(),
            decision: 'ALLOW',
            execution_state: 'EXECUTED',
            tool_name: 'web_search',
            action: { category: 'network' },
            action_record: { risk_score: 0.2, auth_status: 'AUTHORIZED' }
          }
        ]
      });
    });

    await page.goto('/agents');

    // Page title and KPI cards
    await expect(page.getByRole('heading', { name: 'Agents & Sessions' })).toBeVisible();
    await expect(page.getByText('ACTIVE SESSIONS', { exact: true })).toBeVisible();
    await expect(page.getByText('MONITORED INTERCEPTIONS')).toBeVisible();
    await expect(page.getByText('ENFORCEMENT INTEGRITY')).toBeVisible();

    // Workload session list
    await expect(page.getByText('sess_agent_alpha')).toBeVisible();

    // Select session and inspect
    await page.getByText('sess_agent_alpha').click();
    await expect(page.getByText('SELECTED SESSION INSPECTOR')).toBeVisible();
    await expect(page.getByText('Cumulative Step Verdicts')).toBeVisible();
    await expect(page.getByText('web_search', { exact: true }).first()).toBeVisible();
  });

  test('Policies: renders governance rules list and authoring sandbox', async ({ page }) => {
    await page.route('**/api/v1/policies', async (route) => {
      await route.fulfill({
        json: [
          {
            policy_id: 'pol_block_root_write',
            decision: 'block',
            priority: 150,
            description: 'Strict prohibition of root filesystem mutation'
          },
          {
            policy_id: 'pol_allow_read',
            decision: 'allow',
            priority: 50,
            description: 'Permitted read-only evaluation of workspace assets'
          }
        ]
      });
    });

    await page.goto('/policies');

    // Heading and metrics
    await expect(page.locator('h1:has-text("Governance Policies")')).toBeVisible();
    await expect(page.getByText('TOTAL ACTIVE RULES')).toBeVisible();
    await expect(page.getByText('BLOCK POLICIES')).toBeVisible();
    await expect(page.getByText('ALLOW POLICIES')).toBeVisible();

    // Policies list cards
    await expect(page.getByText('pol_block_root_write')).toBeVisible();
    await expect(page.getByText('Strict prohibition of root filesystem mutation')).toBeVisible();
    await expect(page.getByText('pol_allow_read')).toBeVisible();

    // Authoring form
    await expect(page.getByText('POLICY AUTHORING SANDBOX')).toBeVisible();
    await expect(page.getByPlaceholder('e.g. block-destructive-file-write')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Register Policy Rule' })).toBeVisible();

    // Decision filter
    await page.getByRole('button', { name: /Block/i }).first().click();
    await expect(page.getByText('pol_block_root_write')).toBeVisible();
  });

  test('Tasks: renders task context boundaries, M6 pipeline, and registration form', async ({ page }) => {
    await page.route('**/api/v1/tasks', async (route) => {
      await route.fulfill({
        json: [
          {
            task_id: 'task_code_review',
            task_description: 'Analyze repository pull request and summarize changes without mutation',
            allowed_capability_count: 3,
            denied_capability_count: 2
          }
        ]
      });
    });

    await page.goto('/tasks');

    // Title and selector cards
    await expect(page.locator('h1:has-text("Task Authorization Contexts")')).toBeVisible();
    await expect(page.getByText('task_code_review').first()).toBeVisible();
    await expect(page.getByText('3 permitted', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('2 restricted', { exact: true }).first()).toBeVisible();

    // Two invariant panels
    await expect(page.getByText('PERMITTED INVARIANTS (ALLOWED)')).toBeVisible();
    await expect(page.getByText('STRICTLY PROHIBITED INVARIANTS (DENIED)')).toBeVisible();

    // Verification pipeline
    await expect(page.getByText('Context Boundary Verification Pipeline')).toBeVisible();
    await expect(page.getByText('M6 Task Invariant Verification')).toBeVisible();

    // Registration form
    await expect(page.getByText('TASK AUTHORIZATION REGISTRATION')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Register Task Context' }).first()).toBeVisible();
  });

});
