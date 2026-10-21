import { test, expect } from '@playwright/test';

test.describe('Decision Explorer Data-Integrity Remediation Suite', () => {
  const mockIntegrityEvents = [
    {
      interception_id: 'int_write_01',
      session_id: 'sess_integ_01',
      task_id: 'task_playground_01',
      sequence_number: 1,
      timestamp: '2026-10-19T10:00:00.000Z',
      decision: 'BLOCK',
      execution_state: 'BLOCKED',
      tool_name: '', // Empty tool_name to test fallback to normalized_name
      arguments: { file_path: 'output.txt', content: 'UNAUTHORIZED_OVERRIDE' },
      execution_result: null,
      error_message: 'Blocked by AgentSentinel: task unauthorized for destructive writes',
      action: {
        normalized_name: 'write_file',
        category: 'FILE_SYSTEM_WRITE',
        resource: 'output.txt',
        operation: 'write',
        is_mutating: true,
        is_destructive: true,
        source_dataset: 'runtime_api'
      },
      action_record: {
        decision: 'BLOCK',
        risk_severity: 'CRITICAL',
        risk_score: 4,
        ml_probability: 0.8770,
        auth_status: 'UNAUTHORIZED_CATEGORY',
        matched_policy_id: 'pol_block_destructive',
        features: {
          category_counts: { file_system_read: 2, file_system_write: 1 },
          call_frequency: 0.85,
          mutation_intensity: 1.0,
          destructive_intensity: 1.0
        },
        reasons: [
          { rule_type: 'BLOCK_POLICY', description: 'Matched destructive action block policy' }
        ]
      }
    },
    {
      interception_id: 'int_read_02',
      session_id: 'sess_integ_01',
      task_id: 'task_playground_01',
      sequence_number: 2,
      timestamp: '2026-10-19T10:00:05.000Z',
      decision: 'ALLOW',
      execution_state: 'EXECUTED',
      tool_name: 'read_file',
      arguments: { path: 'public_docs.txt' },
      execution_result: 'Documentation loaded',
      error_message: null,
      action: {
        normalized_name: 'read_file',
        category: 'FILE_SYSTEM_READ',
        resource: 'public_docs.txt',
        operation: 'read',
        is_mutating: false,
        is_destructive: false,
        source_dataset: 'runtime_api'
      },
      action_record: {
        decision: 'ALLOW',
        risk_severity: 'LOW',
        risk_score: 1,
        ml_probability: 0.1250,
        auth_status: 'AUTHORIZED',
        matched_policy_id: 'pol_allow_read',
        features: {
          category_counts: { file_system_read: 3 },
          call_frequency: 0.20
        },
        reasons: []
      }
    }
  ];

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/audit', async (route) => {
      await route.fulfill({ json: mockIntegrityEvents });
    });

    await page.route('**/api/v1/audit/sess_integ_01', async (route) => {
      await route.fulfill({ json: mockIntegrityEvents });
    });

    await page.goto('/decision-explorer');
    await page.locator('img[alt="AgentSentinel Logo"]').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  });

  test('Issue 1: Tool Name shows normalized action write_file when event.tool_name is empty', async ({ page }) => {
    const select = page.locator('select');
    await select.waitFor();
    await select.selectOption('int_write_01');

    // Check Stage M1/M2 Tool Name display
    const m1m2Tab = page.locator('[role="tab"]').filter({ hasText: 'Semantic Ingest' });
    await m1m2Tab.click();

    // Verify Tool Name in Stage M1/M2 does NOT show N/A, but shows write_file
    const stageM1M2Card = page.locator('div.rounded-xl').filter({ hasText: 'Stage M1/M2: Ingestion & Action Normalization' });
    await expect(stageM1M2Card).toBeVisible();
    await expect(stageM1M2Card.locator('div.font-bold.text-slate-900.text-sm')).toHaveText('write_file');

    // Also check Panel 1 "Tool Executed:"
    const panelToolExecuted = page.locator('span:text-is("Tool Executed:") + span');
    await expect(panelToolExecuted).toHaveText('write_file');
  });

  test('Issue 2: Pipeline Status displays event actual execution telemetry rather than hardcoded N/A', async ({ page }) => {
    const select = page.locator('select');
    await select.waitFor();
    await select.selectOption('int_write_01');

    // Pipeline status card
    const pipelineStatusCard = page.locator('div.rounded-xl.p-4').filter({ has: page.locator('span:text-is("PIPELINE STATUS")') });
    await expect(pipelineStatusCard).toBeVisible();

    // Must show GATE: BLOCKED, not N/A
    await expect(pipelineStatusCard.locator('p.text-2xl')).toHaveText('GATE: BLOCKED');
    await expect(pipelineStatusCard).toContainText('Sequence: 1');
    await expect(pipelineStatusCard).toContainText('Gate Enforced');
    // Ensure no hardcoded "No telemetry data"
    await expect(pipelineStatusCard).not.toContainText('No telemetry data');
  });

  test('Issue 3: Feature attribution renders category_counts readably and avoids [object Object]', async ({ page }) => {
    const select = page.locator('select');
    await select.waitFor();
    await select.selectOption('int_write_01');

    // Navigate to Stage M4: Vectorization
    const m4Tab = page.locator('[role="tab"]').filter({ hasText: 'Vectorization' });
    await m4Tab.click();

    // Verify [object Object] is nowhere in the DOM
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('[object Object]');

    // Verify category_counts shows formatted keys
    await expect(page.getByTitle('category_counts')).toBeVisible();
    await expect(page.getByText('file_system_read: 2, file_system_write: 1').first()).toBeVisible();
  });

  test('Issue 4: Clarify risk score vs ML probability with accurate measurements', async ({ page }) => {
    const select = page.locator('select');
    await select.waitFor();
    await select.selectOption('int_write_01');

    // Check Summary Card 2 (Risk Severity Score)
    const riskCard = page.locator('div.rounded-xl.p-4').filter({ has: page.locator('span:text-is("RISK SEVERITY SCORE")') });
    await expect(riskCard).toBeVisible();
    await expect(riskCard.locator('p.text-2xl')).toHaveText('4');
    await expect(riskCard).toContainText('/ 4 max');
    await expect(riskCard).toContainText('CRITICAL');
    await expect(riskCard).toContainText('Discrete Severity (0–4 Scale)');
    await expect(riskCard).toContainText('ML P(unsafe): 0.8770');

    // Navigate to Stage M5: ML Inference
    const m5Tab = page.locator('[role="tab"]').filter({ hasText: 'ML Inference' });
    await m5Tab.click();

    // Check Stage M5 cards
    await expect(page.getByText('Continuous Model Signal: 0.8770 [0.0–1.0]')).toBeVisible();
    await expect(page.getByText('4 / 4')).toBeVisible();
    await expect(page.getByText('Discrete Severity Weight (NONE=0, LOW=1, MED=2, HIGH=3, CRIT=4)')).toBeVisible();
  });

  test('Issue 5: Session trajectory timeline entries show meaningful recorded action and resource names', async ({ page }) => {
    const select = page.locator('select');
    await select.waitFor();
    await select.selectOption('int_write_01');

    // Check timeline list
    const timeline = page.locator('div:has(> h3:text("Session Trajectory Timeline"))');
    await expect(timeline).toBeVisible();

    // Action 1 should show write_file (output.txt), NOT generic "action"
    await expect(page.locator('span.font-semibold:text("write_file (output.txt)")')).toBeVisible();

    // Action 2 should show read_file (public_docs.txt)
    await expect(page.locator('span.font-semibold:text("read_file (public_docs.txt)")')).toBeVisible();
  });
});
