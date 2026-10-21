import { test, expect } from '@playwright/test';

test.describe('Phase 4D.1: Evidence-Grounded Forensic Explorer', () => {

  const mockAuditLedger = [
    {
      interception_id: 'int_corr_01',
      session_id: 'sess_corr_01',
      task_id: 'task_audit_01',
      sequence_number: 1,
      timestamp: '2026-10-18T10:00:00.000Z',
      decision: 'ALLOW',
      execution_state: 'EXECUTED',
      tool_name: 'read_config_file',
      arguments: { path: '/etc/app.conf' },
      execution_result: 'Config content loaded successfully',
      error_message: null,
      action: {
        normalized_name: 'read_file',
        category: 'FILE_SYSTEM_READ',
        resource: '/etc/app.conf',
        operation: 'read',
        is_mutating: false,
        is_destructive: false,
        source_dataset: 'synthetic'
      },
      action_record: {
        decision: 'ALLOW',
        risk_severity: 'LOW',
        risk_score: 0.12,
        ml_probability: 0.085,
        auth_status: 'AUTHORIZED',
        matched_policy_id: 'pol_allow_read',
        features: {
          call_frequency: 0.25,
          mutation_intensity: 0.0,
          destructive_intensity: 0.0,
          transition_entropy: 0.42
        },
        reasons: [
          { rule_type: 'ALLOW_POLICY', description: 'Matched explicit read authorization policy' }
        ]
      }
    },
    {
      interception_id: 'int_corr_02',
      session_id: 'sess_corr_01',
      task_id: 'task_audit_01',
      sequence_number: 2,
      timestamp: '2026-10-18T10:00:15.500Z', // +15.5 s
      decision: 'BLOCK',
      execution_state: 'BLOCKED',
      tool_name: 'delete_system_database',
      arguments: { database: 'production_users' },
      execution_result: null,
      error_message: 'Blocked by governance policy pol_block_destructive: deletion prohibited',
      action: {
        normalized_name: 'drop_database',
        category: 'DATABASE_MUTATION',
        resource: 'production_users',
        operation: 'delete',
        is_mutating: true,
        is_destructive: true,
        source_dataset: 'synthetic'
      },
      action_record: {
        decision: 'BLOCK',
        risk_severity: 'CRITICAL',
        risk_score: 0.95,
        ml_probability: 0.912,
        auth_status: 'UNAUTHORIZED',
        matched_policy_id: 'pol_block_destructive',
        features: {
          call_frequency: 0.5,
          mutation_intensity: 1.0,
          destructive_intensity: 1.0,
          transition_entropy: 0.88
        },
        reasons: [
          { rule_type: 'BLOCK_POLICY', description: 'Matched destructive action block policy' }
        ]
      }
    },
    {
      interception_id: 'int_fault_03',
      session_id: 'sess_corr_01',
      task_id: 'task_audit_01',
      sequence_number: 3,
      timestamp: '2026-10-18T10:01:00.000Z',
      decision: 'ALLOW',
      execution_state: 'EXECUTION_FAILED',
      tool_name: 'query_remote_endpoint',
      arguments: { host: 'api.internal.local' },
      execution_result: null,
      error_message: 'ConnectionRefusedError: [Errno 111] Connection refused',
      action: {
        normalized_name: 'network_query',
        category: 'NETWORK_QUERY',
        resource: 'api.internal.local',
        operation: 'connect',
        is_mutating: false,
        is_destructive: false,
        source_dataset: 'synthetic'
      },
      action_record: {
        decision: 'ALLOW',
        risk_severity: 'LOW',
        risk_score: 0.2,
        ml_probability: 0.15,
        auth_status: 'AUTHORIZED',
        matched_policy_id: 'pol_allow_net',
        features: {
          call_frequency: 0.3,
          mutation_intensity: 0.0,
          destructive_intensity: 0.0
        },
        reasons: []
      }
    },
    {
      interception_id: 'int_foreign_99',
      session_id: 'sess_other_99',
      task_id: 'task_other_02',
      sequence_number: 1,
      timestamp: '2026-10-18T10:05:00.000Z',
      decision: 'ALERT',
      execution_state: 'EXECUTED',
      tool_name: 'scan_network_ports',
      arguments: { target: '10.0.0.1' },
      execution_result: 'Ports scanned',
      error_message: null
    }
  ];

  async function gotoPage(page: any, url: string) {
    await page.goto(url);
    await page.locator('img[alt="AgentSentinel Logo"]').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  }

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/audit', async (route) => {
      await route.fulfill({ json: mockAuditLedger });
    });

    await page.route('**/api/v1/audit/sess_corr_01', async (route) => {
      await route.fulfill({
        json: [mockAuditLedger[0], mockAuditLedger[1], mockAuditLedger[2]],
      });
    });

    await page.route('**/api/v1/audit/sess_other_99', async (route) => {
      await route.fulfill({ json: [mockAuditLedger[3]] });
    });
  });

  test('renders all 7 pipeline stages with provenance badges when event is selected', async ({ page }) => {
    await gotoPage(page, '/decision-explorer');

    // Select the first event from dropdown
    await page.locator('select').selectOption('int_corr_01');

    // Verify all 7 stepper tabs exist
    const tabs = page.locator('[role="tab"]');
    await expect(tabs).toHaveCount(7);
    await expect(tabs.filter({ hasText: 'Semantic Ingest' })).toBeVisible();
    await expect(tabs.filter({ hasText: 'Context Cache' })).toBeVisible();
    await expect(tabs.filter({ hasText: 'Vectorization' })).toBeVisible();
    await expect(tabs.filter({ hasText: 'ML Inference' })).toBeVisible();
    await expect(tabs.filter({ hasText: 'Static Rules' })).toBeVisible();
    await expect(tabs.filter({ hasText: 'Decision Fusion' })).toBeVisible();
    await expect(tabs.filter({ hasText: 'Enforcement Gate' })).toBeVisible();

    // Verify provenance badges are present in stage detail
    await expect(page.locator('[data-testid="badge-provenance-recorded"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="badge-provenance-unavailable"]').first()).toBeVisible();

    // Verify Stage M1/M2 initial view
    await expect(page.getByText('Stage M1/M2: Ingestion & Action Normalization')).toBeVisible();
    await expect(page.getByText('FILE_SYSTEM_READ').first()).toBeVisible();
    await expect(page.locator('span, div').filter({ hasText: 'read_config_file' }).first()).toBeVisible();
  });

  test('interactive stage selection updates the forensic inspector panel', async ({ page }) => {
    await gotoPage(page, '/decision-explorer');
    await page.locator('select').selectOption('int_corr_01');

    // Click Stage M3: Context Cache
    await page.locator('[role="tab"]').filter({ hasText: 'Context Cache' }).click();
    await expect(page.getByText('Stage M3: Behavioral Sequence & Temporal Context')).toBeVisible();
    await expect(page.getByText('Step #1')).toBeVisible();

    // Click Stage M4: Vectorization
    await page.locator('[role="tab"]').filter({ hasText: 'Vectorization' }).click();
    await expect(page.getByText('Stage M4: 22-Dimensional Feature Extraction')).toBeVisible();
    await expect(page.getByText('call_frequency').first()).toBeVisible();

    // Click Stage M5: ML Inference
    await page.locator('[role="tab"]').filter({ hasText: 'ML Inference' }).click();
    await expect(page.getByText('Stage M5: Behavioral Risk Engine (ML Risk Signal)')).toBeVisible();
    await expect(page.getByText('8.5%')).toBeVisible(); // 0.085 * 100%
    await expect(page.getByText(/Developmental Calibration Note/i)).toBeVisible();

    // Click Stage M6: Task Auth
    await page.locator('[role="tab"]').filter({ hasText: 'Static Rules' }).click();
    await expect(page.getByText('Stage M6: Task-Context Authorization')).toBeVisible();
    await expect(page.getByText('task_audit_01').first()).toBeVisible();

    // Click Stage M7: Decision Fusion
    await page.locator('[role="tab"]').filter({ hasText: 'Decision Fusion' }).click();
    await expect(page.getByText('Stage M7: Policy Fusion Engine (Authoritative Verdict)')).toBeVisible();
    await expect(page.getByText('pol_allow_read')).toBeVisible();

    // Click Stage M8: Enforcement
    await page.locator('[role="tab"]').filter({ hasText: 'Enforcement Gate' }).click();
    await expect(page.getByText('Stage M8: Runtime Interceptor & Execution Gate')).toBeVisible();
    await expect(page.getByText('1 Invocation')).toBeVisible();
  });

  test('keyboard navigation switches active stage via Enter key', async ({ page }) => {
    await gotoPage(page, '/decision-explorer');
    await page.locator('select').selectOption('int_corr_01');

    const m5Tab = page.locator('[role="tab"]').filter({ hasText: 'ML Inference' });
    await m5Tab.focus();
    await page.keyboard.press('Enter');

    await expect(page.getByText('Stage M5: Behavioral Risk Engine (ML Risk Signal)')).toBeVisible();
    await expect(m5Tab).toHaveAttribute('aria-selected', 'true');
  });

  test('exact correlation via URL query parameters auto-selects event and stage', async ({ page }) => {
    await gotoPage(page, '/decision-explorer?session=sess_corr_01&interception=int_corr_02&stage=M5');

    // Correlation banner is visible
    const banner = page.locator('[data-testid="decision-correlation-banner"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('sess_corr_01');
    await expect(banner).toContainText('int_corr_02');

    // Event int_corr_02 is auto-selected
    await expect(page.locator('select')).toHaveValue('int_corr_02');
    await expect(page.locator('span').filter({ hasText: 'delete_system_database' }).first()).toBeVisible();

    // Stage M5 is selected
    await expect(page.getByText('Stage M5: Behavioral Risk Engine (ML Risk Signal)')).toBeVisible();
    await expect(page.getByText('91.2%')).toBeVisible();

    // Clearing correlation removes banner and query params
    await page.getByRole('button', { name: 'Clear Correlation Filter' }).click();
    await expect(banner).not.toBeVisible();
    expect(page.url()).not.toContain('session=sess_corr_01');
    expect(page.url()).not.toContain('interception=int_corr_02');
  });

  test('unmatched identifiers show warning notice and do not select arbitrary event', async ({ page }) => {
    // int_foreign_99 belongs to sess_other_99, NOT sess_corr_01
    await gotoPage(page, '/decision-explorer?session=sess_corr_01&interception=int_foreign_99');

    const unmatchedBanner = page.locator('[data-testid="decision-unmatched-banner"]');
    await expect(unmatchedBanner).toBeVisible();
    await expect(unmatchedBanner).toContainText('No audit record found matching session');

    // Empty state remains
    await expect(page.getByText('No Event Selected')).toBeVisible();
  });

  test('missing query parameter shows incomplete notice without selecting event', async ({ page }) => {
    await gotoPage(page, '/decision-explorer?session=sess_corr_01');

    const incompleteBanner = page.locator('[data-testid="decision-incomplete-banner"]');
    await expect(incompleteBanner).toBeVisible();
    await expect(incompleteBanner).toContainText(/both session and interception query parameters are required/i);

    await expect(page.getByText('No Event Selected')).toBeVisible();
  });

  test('M8 BLOCK guarantees 0 callable invocations invariant', async ({ page }) => {
    await gotoPage(page, '/decision-explorer');
    await page.locator('select').selectOption('int_corr_02'); // BLOCK event

    // Switch to M8 Enforcement stage
    await page.locator('[role="tab"]').filter({ hasText: 'Enforcement Gate' }).click();

    // Verify 0 Invocations
    await expect(page.getByText('0 Invocations')).toBeVisible();
    await expect(page.getByText('Guaranteed 0 by M8 interceptor')).toBeVisible();
  });

  test('M7 ALLOW vs M8 EXECUTION_FAILED distinction preserved honestly', async ({ page }) => {
    await gotoPage(page, '/decision-explorer');
    await page.locator('select').selectOption('int_fault_03'); // FAULT event

    // Check M7
    await page.locator('[role="tab"]').filter({ hasText: 'Decision Fusion' }).click();
    await expect(page.getByText('Stage M7: Policy Fusion Engine (Authoritative Verdict)')).toBeVisible();
    await expect(page.getByText('ALLOW', { exact: true }).first()).toBeVisible();

    // Check M8
    await page.locator('[role="tab"]').filter({ hasText: 'Enforcement Gate' }).click();
    await expect(page.getByText('EXECUTION_FAILED', { exact: true })).toBeVisible();
    await expect(page.getByText('1 Invocation')).toBeVisible();
    await expect(page.getByText('ConnectionRefusedError: [Errno 111] Connection refused').first()).toBeVisible();
  });

  test('deep link navigation from Trajectories page drawer to Decision Explorer', async ({ page }) => {
    await page.route('**/api/v1/sessions', async (route) => {
      await route.fulfill({
        json: [
          {
            session_id: 'sess_corr_01',
            task_id: 'task_audit_01',
            status: 'completed',
            verdict_counts: { ALLOW: 2, BLOCK: 1, ALERT: 0 },
            total_events: 3
          }
        ]
      });
    });

    await gotoPage(page, '/trajectories');

    // Click step 2 (BLOCK)
    const step2Node = page.locator('[role="option"]').filter({ hasText: 'STEP 02' });
    await step2Node.click();

    // Click "Deep Dive in Decision Explorer"
    const deepDiveLink = page.getByRole('link', { name: 'Deep Dive in Decision Explorer' });
    await expect(deepDiveLink).toBeVisible();
    await deepDiveLink.click();

    // Verify URL contains session and interception
    await page.waitForURL(/\/decision-explorer\?session=sess_corr_01&interception=int_corr_02/);

    // Verify Decision Explorer correlation banner and selected event
    await expect(page.locator('[data-testid="decision-correlation-banner"]')).toBeVisible();
    await expect(page.locator('select')).toHaveValue('int_corr_02');
    await expect(page.locator('span').filter({ hasText: 'delete_system_database' }).first()).toBeVisible();
  });

  test('Phase 4D.2: Replay bar renders with accessible controls, speed toggles, and live position announcement', async ({ page }) => {
    await gotoPage(page, '/decision-explorer');
    await page.locator('select').selectOption('int_corr_01');

    const replayBar = page.locator('[data-testid="historical-forensic-replay-bar"]');
    await expect(replayBar).toBeVisible();

    // Verify controls initial state on Step 1
    const resetBtn = page.getByRole('button', { name: 'Reset replay to first event' });
    const prevBtn = page.getByRole('button', { name: 'Previous event' });
    const playBtn = page.getByRole('button', { name: 'Play historical replay' });
    const nextBtn = page.getByRole('button', { name: 'Next event' });

    await expect(resetBtn).toBeDisabled();
    await expect(prevBtn).toBeDisabled();
    await expect(playBtn).toBeEnabled();
    await expect(nextBtn).toBeEnabled();

    // Verify speed toggle
    const speed1Btn = page.getByRole('button', { name: '1 second interval' });
    const speed2Btn = page.getByRole('button', { name: '2 seconds interval' });

    await expect(speed1Btn).toHaveAttribute('aria-pressed', 'true');
    await expect(speed2Btn).toHaveAttribute('aria-pressed', 'false');

    await speed2Btn.click();
    await expect(speed1Btn).toHaveAttribute('aria-pressed', 'false');
    await expect(speed2Btn).toHaveAttribute('aria-pressed', 'true');

    // Verify position display and live announcer
    await expect(page.locator('[data-testid="replay-position-display"]')).toHaveText('Step 1 of 3');
    const liveAnnouncer = page.locator('div[role="status"]');
    await expect(liveAnnouncer).toContainText('Step 1 of 3');
  });

  test('Phase 4D.2: Next and Prev manual step navigation synchronizes event, inspector, and URL', async ({ page }) => {
    await gotoPage(page, '/decision-explorer');
    await page.locator('select').selectOption('int_corr_01');

    const nextBtn = page.getByRole('button', { name: 'Next event' });
    const prevBtn = page.getByRole('button', { name: 'Previous event' });

    // Step 1 -> Step 2
    await nextBtn.click();
    await expect(page.locator('select')).toHaveValue('int_corr_02');
    await expect(page.locator('[data-testid="replay-position-display"]')).toHaveText('Step 2 of 3');
    await expect(prevBtn).toBeEnabled();
    expect(page.url()).toContain('interception=int_corr_02');

    // Step 2 -> Step 3
    await nextBtn.click();
    await expect(page.locator('select')).toHaveValue('int_fault_03');
    await expect(page.locator('[data-testid="replay-position-display"]')).toHaveText('Step 3 of 3');
    await expect(nextBtn).toBeDisabled(); // at final step
    await expect(page.locator('[data-testid="replay-status-badge"]')).toHaveText('AT END');
    expect(page.url()).toContain('interception=int_fault_03');

    // Step 3 -> Step 2
    await prevBtn.click();
    await expect(page.locator('select')).toHaveValue('int_corr_02');
    await expect(page.locator('[data-testid="replay-position-display"]')).toHaveText('Step 2 of 3');
    await expect(nextBtn).toBeEnabled();
    expect(page.url()).toContain('interception=int_corr_02');
  });

  test('Phase 4D.2: Reset button immediately rewinds to Step 1 and pauses playback', async ({ page }) => {
    await gotoPage(page, '/decision-explorer');
    await page.locator('select').selectOption('int_corr_01');

    const nextBtn = page.getByRole('button', { name: 'Next event' });
    const resetBtn = page.getByRole('button', { name: 'Reset replay to first event' });
    const prevBtn = page.getByRole('button', { name: 'Previous event' });

    // Advance to step 3
    await nextBtn.click();
    await nextBtn.click();
    await expect(page.locator('[data-testid="replay-position-display"]')).toHaveText('Step 3 of 3');

    // Click Reset
    await resetBtn.click();
    await expect(page.locator('select')).toHaveValue('int_corr_01');
    await expect(page.locator('[data-testid="replay-position-display"]')).toHaveText('Step 1 of 3');
    await expect(resetBtn).toBeDisabled();
    await expect(prevBtn).toBeDisabled();
    expect(page.url()).toContain('interception=int_corr_01');
  });

  test('Phase 4D.2: Play/Pause automated stepping advances across events and stops at final step', async ({ page }) => {
    await gotoPage(page, '/decision-explorer');
    await page.locator('select').selectOption('int_corr_01');

    const playBtn = page.getByRole('button', { name: 'Play historical replay' });
    await playBtn.click();

    // Verify playing status
    await expect(page.locator('[data-testid="replay-status-badge"]')).toContainText('PLAYING (1.0s)');

    // Automated advance to Step 2
    await expect(page.locator('[data-testid="replay-position-display"]')).toHaveText('Step 2 of 3', { timeout: 3000 });
    await expect(page.locator('select')).toHaveValue('int_corr_02');

    // Automated advance to Step 3 (final)
    await expect(page.locator('[data-testid="replay-position-display"]')).toHaveText('Step 3 of 3', { timeout: 3000 });
    await expect(page.locator('select')).toHaveValue('int_fault_03');

    // Automatically stops at final step
    await expect(page.locator('[data-testid="replay-status-badge"]')).toHaveText('AT END');
    await expect(page.getByRole('button', { name: 'Play historical replay' })).toBeVisible();
  });

  test('Phase 4D.2: Session change or manual event click pauses active playback and cleans up timer', async ({ page }) => {
    await gotoPage(page, '/decision-explorer');
    await page.locator('select').selectOption('int_corr_01');

    // Start playing
    await page.getByRole('button', { name: 'Play historical replay' }).click();
    await expect(page.locator('[data-testid="replay-status-badge"]')).toContainText('PLAYING');

    // Select foreign session event from another session
    await page.locator('select').selectOption('int_foreign_99');

    // Replay should be paused / at end since sess_other_99 has 1 event
    await expect(page.locator('[data-testid="replay-status-badge"]')).toHaveText('AT END');
    await expect(page.getByRole('button', { name: 'Previous event' })).toBeDisabled();
  });

  // ==========================================
  // Phase 4D.3: Limited Counterfactual Policy-Matrix Simulator
  // ==========================================

  test('Phase 4D.3: Opening and closing counterfactual preview drawer via button, close icon, and Escape key', async ({ page }) => {
    await gotoPage(page, '/decision-explorer');
    
    // Counterfactual button is disabled when no event is selected
    const openBtn = page.locator('[data-testid="open-counterfactual-drawer-btn"]');
    await expect(openBtn).toBeDisabled();

    // Select first event
    await page.locator('select').selectOption('int_corr_01');
    await expect(page).toHaveURL(/interception=int_corr_01/);
    await expect(openBtn).toBeEnabled();

    // Open drawer
    await openBtn.click();
    const drawer = page.locator('[data-testid="counterfactual-drawer"]');
    await expect(drawer).toBeVisible();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Verify required warning banner and scope disclaimer
    const warningBanner = page.locator('[data-testid="counterfactual-warning-banner"]');
    await expect(warningBanner).toContainText('SIMULATED — LIMITED BASELINE MATRIX PREVIEW');
    await expect(warningBanner).toContainText('This is not a re-evaluation of the complete policy engine.');
    await expect(warningBanner).toContainText('Policy condition expressions and raw task capability rules are not available through the current API and therefore are not simulated.');

    // Close via close button
    const closeBtn = page.locator('[data-testid="close-counterfactual-drawer-btn"]');
    await closeBtn.click();
    await expect(drawer).not.toBeVisible();

    // Reopen and close via Escape key
    await openBtn.click();
    await expect(drawer).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();
  });

  test('Phase 4D.3: Distinct separation between recorded historical facts and hypothetical preview output', async ({ page }) => {
    await gotoPage(page, '/decision-explorer');
    await page.locator('select').selectOption('int_corr_01');

    await page.locator('[data-testid="open-counterfactual-drawer-btn"]').click();

    // Recorded historical facts card must display exact historical facts
    await expect(page.locator('[data-testid="recorded-severity-display"]')).toHaveText('LOW');
    await expect(page.locator('[data-testid="recorded-auth-display"]')).toHaveText('AUTHORIZED');
    await expect(page.locator('[data-testid="recorded-decision-display"]')).toHaveText('ALLOW');
    await expect(page.locator('[data-testid="recorded-execution-display"]')).toHaveText('EXECUTED');
    await expect(page.getByText('RECORDED FACT')).toBeVisible();

    // Simulated output must be clearly marked with HYPOTHETICAL provenance
    const provenanceBadge = page.locator('[data-testid="hypothetical-provenance-badge"]');
    await expect(provenanceBadge).toHaveText('HYPOTHETICAL');
    await expect(provenanceBadge).not.toHaveText('RECORDED');

    // Historical M8 note
    await expect(page.getByText('Original M8 execution state remains: EXECUTED')).toBeVisible();
  });

  test('Phase 4D.3: Table-driven verification of all 18 supported baseline matrix combinations', async ({ page }) => {
    await gotoPage(page, '/decision-explorer');
    await page.locator('select').selectOption('int_corr_01');

    await page.locator('[data-testid="open-counterfactual-drawer-btn"]').click();

    const severitySelect = page.locator('[data-testid="hypothetical-severity-select"]');
    const authSelect = page.locator('[data-testid="hypothetical-auth-select"]');
    const verdictDisplay = page.locator('[data-testid="hypothetical-verdict-display"]');

    // Authoritative 18-combination matrix grounded in src/agentsentinel/governance/engine.py
    const matrixTestCases = [
      // NONE
      { severity: 'NONE', auth: 'AUTHORIZED', expected: 'ALLOW' },
      { severity: 'NONE', auth: 'UNAUTHORIZED', expected: 'ALERT' },
      { severity: 'NONE', auth: 'UNEVALUABLE', expected: 'BLOCK' },
      // LOW
      { severity: 'LOW', auth: 'AUTHORIZED', expected: 'ALLOW' },
      { severity: 'LOW', auth: 'UNAUTHORIZED', expected: 'ALERT' },
      { severity: 'LOW', auth: 'UNEVALUABLE', expected: 'BLOCK' },
      // MEDIUM
      { severity: 'MEDIUM', auth: 'AUTHORIZED', expected: 'ALLOW' },
      { severity: 'MEDIUM', auth: 'UNAUTHORIZED', expected: 'BLOCK' },
      { severity: 'MEDIUM', auth: 'UNEVALUABLE', expected: 'BLOCK' },
      // HIGH
      { severity: 'HIGH', auth: 'AUTHORIZED', expected: 'ALERT' },
      { severity: 'HIGH', auth: 'UNAUTHORIZED', expected: 'BLOCK' },
      { severity: 'HIGH', auth: 'UNEVALUABLE', expected: 'BLOCK' },
      // CRITICAL (Invariant 1: CRITICAL always BLOCK)
      { severity: 'CRITICAL', auth: 'AUTHORIZED', expected: 'BLOCK' },
      { severity: 'CRITICAL', auth: 'UNAUTHORIZED', expected: 'BLOCK' },
      { severity: 'CRITICAL', auth: 'UNEVALUABLE', expected: 'BLOCK' },
      // UNEVALUABLE Risk (Invariant 3: Unevaluable risk always BLOCK)
      { severity: 'UNEVALUABLE', auth: 'AUTHORIZED', expected: 'BLOCK' },
      { severity: 'UNEVALUABLE', auth: 'UNAUTHORIZED', expected: 'BLOCK' },
      { severity: 'UNEVALUABLE', auth: 'UNEVALUABLE', expected: 'BLOCK' }
    ];

    for (const { severity, auth, expected } of matrixTestCases) {
      await severitySelect.selectOption(severity);
      await authSelect.selectOption(auth);
      await expect(verdictDisplay).toHaveText(expected);
    }
  });

  test('Phase 4D.3: Unsupported and missing inputs produce explicit unavailable message without inventing verdicts', async ({ page }) => {
    await gotoPage(page, '/decision-explorer');
    await page.locator('select').selectOption('int_corr_01');

    await page.locator('[data-testid="open-counterfactual-drawer-btn"]').click();

    const severitySelect = page.locator('[data-testid="hypothetical-severity-select"]');
    const authSelect = page.locator('[data-testid="hypothetical-auth-select"]');
    const verdictDisplay = page.locator('[data-testid="hypothetical-verdict-display"]');
    const rationaleDisplay = page.locator('[data-testid="hypothetical-rationale-display"]');

    // Deselect severity
    await severitySelect.selectOption('');
    await expect(verdictDisplay).toHaveText('UNSUPPORTED');
    await expect(rationaleDisplay).toHaveText('Unsupported / unavailable for this preview.');

    // Select severity but deselect auth
    await severitySelect.selectOption('LOW');
    await authSelect.selectOption('');
    await expect(verdictDisplay).toHaveText('UNSUPPORTED');
    await expect(rationaleDisplay).toHaveText('Unsupported / unavailable for this preview.');
  });

  test('Phase 4D.3: Reset restores hypothetical inputs to recorded baseline without mutating historical event', async ({ page }) => {
    await gotoPage(page, '/decision-explorer');
    await page.locator('select').selectOption('int_corr_01');

    await page.locator('[data-testid="open-counterfactual-drawer-btn"]').click();

    const severitySelect = page.locator('[data-testid="hypothetical-severity-select"]');
    const authSelect = page.locator('[data-testid="hypothetical-auth-select"]');
    const resetBtn = page.locator('[data-testid="reset-hypothetical-inputs-btn"]');

    // Mutate hypothetical inputs to CRITICAL / UNAUTHORIZED
    await severitySelect.selectOption('CRITICAL');
    await authSelect.selectOption('UNAUTHORIZED');
    await expect(page.locator('[data-testid="hypothetical-verdict-display"]')).toHaveText('BLOCK');

    // Click Reset
    await resetBtn.click();

    // Verify hypothetical inputs restored to int_corr_01 recorded values (LOW / AUTHORIZED)
    await expect(severitySelect).toHaveValue('LOW');
    await expect(authSelect).toHaveValue('AUTHORIZED');
    await expect(page.locator('[data-testid="hypothetical-verdict-display"]')).toHaveText('ALLOW');

    // Verify historical recorded event values remain completely unchanged
    await expect(page.locator('[data-testid="recorded-severity-display"]')).toHaveText('LOW');
    await expect(page.locator('[data-testid="recorded-auth-display"]')).toHaveText('AUTHORIZED');
    await expect(page.locator('[data-testid="recorded-decision-display"]')).toHaveText('ALLOW');
    await expect(page.locator('[data-testid="recorded-execution-display"]')).toHaveText('EXECUTED');
    await expect(page.locator('select').first()).toHaveValue('int_corr_01');
  });

  test('Phase 4D.3: Zero mutation or execution API calls occur during simulation interactions', async ({ page }) => {
    const interceptedRequests: { method: string; url: string }[] = [];

    page.on('request', (request) => {
      interceptedRequests.push({
        method: request.method(),
        url: request.url()
      });
    });

    await gotoPage(page, '/decision-explorer');
    await page.locator('select').selectOption('int_corr_01');

    await page.locator('[data-testid="open-counterfactual-drawer-btn"]').click();

    const severitySelect = page.locator('[data-testid="hypothetical-severity-select"]');
    const authSelect = page.locator('[data-testid="hypothetical-auth-select"]');

    // Perform intensive simulations
    await severitySelect.selectOption('CRITICAL');
    await authSelect.selectOption('UNAUTHORIZED');
    await severitySelect.selectOption('HIGH');
    await authSelect.selectOption('AUTHORIZED');
    await severitySelect.selectOption('MEDIUM');
    await authSelect.selectOption('UNAUTHORIZED');
    await page.locator('[data-testid="reset-hypothetical-inputs-btn"]').click();

    // Invariant: Zero mutation requests
    const mutations = interceptedRequests.filter(r => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.method));
    expect(mutations).toHaveLength(0);

    // Invariant: Zero execution or intercept calls
    const executions = interceptedRequests.filter(r => r.url.includes('/agent/run') || r.url.includes('/runtime/intercept'));
    expect(executions).toHaveLength(0);
  });

  test('Phase 4D.3: Screen reader live announcement updates correctly on simulation changes', async ({ page }) => {
    await gotoPage(page, '/decision-explorer');
    await page.locator('select').selectOption('int_corr_01');
    await expect(page).toHaveURL(/interception=int_corr_01/);

    await page.locator('[data-testid="open-counterfactual-drawer-btn"]').click();

    const liveRegion = page.locator('[data-testid="counterfactual-live-announcer"]');
    await expect(liveRegion).toHaveAttribute('aria-live', 'polite');

    // Change to HIGH / UNAUTHORIZED
    await page.locator('[data-testid="hypothetical-severity-select"]').selectOption('HIGH');
    await page.locator('[data-testid="hypothetical-auth-select"]').selectOption('UNAUTHORIZED');

    await expect(liveRegion).toContainText('Counterfactual preview: Risk Severity HIGH, Authorization UNAUTHORIZED. Hypothetical verdict: BLOCK');
  });
});
