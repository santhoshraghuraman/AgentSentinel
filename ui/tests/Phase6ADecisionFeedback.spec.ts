/**
 * Phase6ADecisionFeedback.spec.ts
 *
 * Deterministic Playwright test suite for Phase 6A: Decision Feedback Correctness.
 * Proves truthful, unambiguous, accessible outcome presentations:
 * 1. ALLOW shows correct successful-execution state with tool output and correlation.
 * 2. ALERT shows distinct amber banner/toast and is NEVER presented as ALLOW.
 * 3. BLOCK remains clearly blocked with zero callable invocations.
 * 4. ALLOW followed by execution failure is distinguished from BLOCK.
 * 5. Conversational text-only LLM response shows conversational completion with zero tool calls.
 * 6. Malformed or failed tool proposals show orchestration failure.
 * 7. Decision trace and audit correlation remain intact.
 * 8. Notification accessibility (ARIA, Esc key, close button, reduced-motion) works.
 */

import { test, expect } from '@playwright/test';

test.describe('Phase 6A: Decision Feedback Correctness', () => {

  test.beforeEach(async ({ page }) => {
    // Mock diagnostics to ensure consistent UI state
    await page.route('**/api/v1/system/diagnostics', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          llm: { provider: 'Ollama', model: 'qwen3:4b', status: 'ready' },
          status: 'healthy',
          active_policies_count: 5
        })
      });
    });

    // Mock tasks to provide active context
    await page.route('**/api/v1/tasks', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            task_id: 'task_1',
            description: 'Test Task Context',
            allowed_capabilities: ['read_file', 'calculate'],
            allowed_capability_count: 2
          }
        ])
      });
    });
  });

  // ────────────────────────────────────────────────────────────
  // Test 1: ALLOW with successful tool execution
  // ────────────────────────────────────────────────────────────
  test('1. ALLOW shows truthful successful-execution state and tool trace', async ({ page }) => {
    const sessionId = 'session-allow-test-101';

    await page.route('**/api/v1/agent/run', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'completed',
          trace: [
            {
              type: 'tool_call',
              tool: 'read_file',
              arguments: { path: 'public_docs.txt' }
            },
            {
              type: 'execution_result',
              state: 'EXECUTED',
              output: 'AgentSentinel Runtime Architecture Overview'
            },
            {
              type: 'agent_response',
              content: 'The public docs explain AgentSentinel dual-verification runtime architecture.'
            }
          ]
        })
      });
    });

    await page.route(`**/api/v1/audit/${sessionId}`, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            event_id: 'ev-allow-1',
            session_id: sessionId,
            task_id: 'task_1',
            tool_name: 'read_file',
            interception_id: 'int-allow-101',
            decision: 'ALLOW',
            execution_state: 'EXECUTED',
            timestamp: new Date().toISOString(),
            action: { category: 'file_system_read', normalized_name: 'read_file' },
            action_record: {
              risk_severity: 'LOW',
              ml_probability: 0.05,
              auth_status: 'AUTHORIZED',
              reasons: [{ rule_type: 'ALLOW_LIST', description: 'Read allowed for public_docs.txt' }]
            }
          }
        ])
      });
    });

    await page.goto('http://localhost:5173/playground');
    await page.waitForSelector('h1:has-text("Runtime Playground")');

    // Click ALLOW scenario button
    await page.click('button:has-text("1. ALLOW (Benign)")');
    await page.fill('input#task-context-id', 'task_1');

    // Set the deterministic session ID
    await page.locator('label:has-text("Session ID") + div input, input[required]').first().fill(sessionId);

    // Execute task
    await page.click('button:has-text("Execute Agent Task")');

    // Verify ALLOW banner appears
    const banner = page.locator('[data-testid="governance-outcome-banner"][data-outcome="ALLOW"]');
    await expect(banner).toBeVisible();
    await expect(banner.locator('[data-testid="outcome-title"]')).toContainText('TASK AUTHORIZED (ALLOW)');
    await expect(banner.locator('[data-testid="outcome-badge"]')).toContainText('EXECUTED SUCCESSFULLY');

    // Verify trace renders tool call and execution outcome
    await expect(page.locator('span:has-text("Generated Tool Call")')).toBeVisible();
    await expect(page.locator('span:has-text("Execution Outcome: EXECUTED")')).toBeVisible();
    await expect(page.locator('pre:has-text("AgentSentinel Runtime Architecture Overview")')).toBeVisible();

    // Verify no ALERT or BLOCK banners are shown
    await expect(page.locator('[data-testid="governance-outcome-banner"][data-outcome="ALERT"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="governance-outcome-banner"][data-outcome="BLOCK"]')).not.toBeVisible();
  });

  // ────────────────────────────────────────────────────────────
  // Test 2: ALERT shows distinct amber notification and NEVER green ALLOW
  // ────────────────────────────────────────────────────────────
  test('2. ALERT shows high-visibility amber notification and is never presented as ALLOW', async ({ page }) => {
    const sessionId = 'session-alert-test-202';

    await page.route('**/api/v1/agent/run', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'completed',
          trace: [
            {
              type: 'tool_call',
              tool: 'calculate',
              arguments: { expression: '42 * 1337' }
            },
            {
              type: 'execution_result',
              state: 'EXECUTED',
              output: '56154'
            },
            {
              type: 'agent_response',
              content: 'Result is 56154'
            }
          ]
        })
      });
    });

    await page.route(`**/api/v1/audit/${sessionId}`, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            event_id: 'ev-alert-1',
            session_id: sessionId,
            task_id: 'task_1',
            tool_name: 'calculate',
            interception_id: 'int-alert-202',
            decision: 'ALERT',
            execution_state: 'EXECUTED',
            timestamp: new Date().toISOString(),
            action: { category: 'computation', normalized_name: 'calculate' },
            action_record: {
              risk_severity: 'MEDIUM',
              ml_probability: 0.35,
              auth_status: 'AUTHORIZED_MONITORED',
              reasons: [{ rule_type: 'MONITORED_TOOL', description: 'Action monitored by M7 policy' }]
            }
          }
        ])
      });
    });

    await page.goto('http://localhost:5173/playground');
    await page.waitForSelector('h1:has-text("Runtime Playground")');

    // Click ALERT scenario button
    await page.click('button:has-text("2. ALERT (Monitored)")');
    await page.locator('label:has-text("Session ID") + div input, input[required]').first().fill(sessionId);

    // Execute task
    await page.click('button:has-text("Execute Agent Task")');

    // Verify ALERT banner appears with distinct amber styling
    const alertBanner = page.locator('[data-testid="governance-outcome-banner"][data-outcome="ALERT"]');
    await expect(alertBanner).toBeVisible();
    await expect(alertBanner.locator('[data-testid="outcome-title"]')).toContainText('GOVERNANCE NOTICE — ALERT: ACTION MONITORED');
    await expect(alertBanner.locator('[data-testid="outcome-badge"]')).toContainText('POLICY: ALERT (MONITORED)');

    // Verify explanation declares monitored execution without approval gate
    await expect(alertBanner.locator('[data-testid="outcome-description"]')).toContainText('Under the current runtime governance contract, monitored actions proceed without a blocking human approval gate');

    // CRITICAL REQUIREMENT: Never display an ALERT as a green ALLOW outcome
    await expect(page.locator('[data-testid="governance-outcome-banner"][data-outcome="ALLOW"]')).not.toBeVisible();

    // Verify popup toast notification also appears
    const toast = page.locator('[data-testid="governance-alert-toast"]');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('GOVERNANCE NOTICE — ALERT');
    await expect(toast).toContainText('POLICY: ALERT (MONITORED)');
  });

  // ────────────────────────────────────────────────────────────
  // Test 3: BLOCK preserves zero-call enforcement presentation
  // ────────────────────────────────────────────────────────────
  test('3. BLOCK remains clearly blocked with zero callable invocations', async ({ page }) => {
    const sessionId = 'session-block-test-303';

    await page.route('**/api/v1/agent/run', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'blocked',
          trace: [
            {
              type: 'tool_call',
              tool: 'write_file',
              arguments: { path: '/etc/passwd', content: 'root:x:0:0' }
            },
            {
              type: 'execution_result',
              state: 'BLOCKED',
              output: 'Action blocked by AgentSentinel: write_file unauthorized under task_1 capability scope.'
            }
          ]
        })
      });
    });

    await page.route(`**/api/v1/audit/${sessionId}`, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            event_id: 'ev-block-1',
            session_id: sessionId,
            task_id: 'task_1',
            tool_name: 'write_file',
            interception_id: 'int-block-303',
            decision: 'BLOCK',
            execution_state: 'BLOCKED',
            timestamp: new Date().toISOString(),
            action: { category: 'file_system_write', normalized_name: 'write_file' },
            action_record: {
              risk_severity: 'CRITICAL',
              ml_probability: 0.98,
              auth_status: 'DENIED',
              reasons: [{ rule_type: 'HARD_GATE', description: 'Write access denied outside sandbox' }]
            }
          }
        ])
      });
    });

    await page.goto('http://localhost:5173/playground');
    await page.waitForSelector('h1:has-text("Runtime Playground")');

    // Click BLOCK scenario
    await page.click('button:has-text("3. BLOCK (Attack)")');
    await page.locator('label:has-text("Session ID") + div input, input[required]').first().fill(sessionId);

    // Execute task
    await page.click('button:has-text("Execute Agent Task")');

    // Verify BLOCK banner
    const blockBanner = page.locator('[data-testid="governance-outcome-banner"][data-outcome="BLOCK"]');
    await expect(blockBanner).toBeVisible();
    await expect(blockBanner.locator('[data-testid="outcome-title"]')).toContainText('THREAT NEUTRALIZED (BLOCK) — M8 ENFORCEMENT');
    await expect(blockBanner.locator('[data-testid="outcome-badge"]')).toContainText('CALLABLE: 0 INVOCATIONS');

    // Verify explanation affirms zero invocations occurred
    await expect(blockBanner.locator('[data-testid="outcome-description"]')).toContainText('The protected tool callable was invoked 0 times.');

    // Verify trace clearly marks outcome BLOCKED
    await expect(page.locator('span:has-text("Execution Outcome: BLOCKED")')).toBeVisible();

    // Verify neither ALLOW nor ALERT banners are present
    await expect(page.locator('[data-testid="governance-outcome-banner"][data-outcome="ALLOW"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="governance-outcome-banner"][data-outcome="ALERT"]')).not.toBeVisible();
  });

  // ────────────────────────────────────────────────────────────
  // Test 4: Execution failure after ALLOW is distinguishable from BLOCK
  // ────────────────────────────────────────────────────────────
  test('4. ALLOW followed by execution failure is distinguishable from BLOCK', async ({ page }) => {
    const sessionId = 'session-fault-test-404';

    await page.route('**/api/v1/agent/run', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'failed',
          trace: [
            {
              type: 'tool_call',
              tool: 'read_file',
              arguments: { path: 'non_existent_file.txt' }
            },
            {
              type: 'execution_result',
              state: 'EXECUTION_FAILED',
              output: 'FileNotFoundError: [Errno 2] No such file or directory: non_existent_file.txt'
            }
          ]
        })
      });
    });

    await page.route(`**/api/v1/audit/${sessionId}`, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            event_id: 'ev-fail-1',
            session_id: sessionId,
            task_id: 'task_1',
            tool_name: 'read_file',
            interception_id: 'int-fail-404',
            decision: 'ALLOW',
            execution_state: 'EXECUTION_FAILED',
            timestamp: new Date().toISOString(),
            action: { category: 'file_system_read', normalized_name: 'read_file' },
            action_record: {
              risk_severity: 'LOW',
              ml_probability: 0.08,
              auth_status: 'AUTHORIZED',
              reasons: [{ rule_type: 'ALLOW_LIST', description: 'Read operation authorized' }]
            }
          }
        ])
      });
    });

    await page.goto('http://localhost:5173/playground');
    await page.waitForSelector('h1:has-text("Runtime Playground")');

    // Click FAULT RECOVERY scenario
    await page.click('button:has-text("4. FAULT RECOVERY")');
    await page.locator('label:has-text("Session ID") + div input, input[required]').first().fill(sessionId);

    // Execute task
    await page.click('button:has-text("Execute Agent Task")');

    // Verify FAULT banner appears
    const faultBanner = page.locator('[data-testid="governance-outcome-banner"][data-outcome="FAULT"]');
    await expect(faultBanner).toBeVisible();
    await expect(faultBanner.locator('[data-testid="outcome-title"]')).toContainText('FAULT ENCOUNTERED (MONITORED) — TOOL EXECUTION EXCEPTION');
    await expect(faultBanner.locator('[data-testid="outcome-badge"]')).toContainText('GOVERNANCE: ALLOW');

    // Verify description explains it is distinct from BLOCK
    await expect(faultBanner.locator('[data-testid="outcome-description"]')).toContainText('Governed outcome is distinct from BLOCK (policy allowed execution).');

    // Verify it is NOT labeled as BLOCK
    await expect(page.locator('[data-testid="governance-outcome-banner"][data-outcome="BLOCK"]')).not.toBeVisible();
  });

  // ────────────────────────────────────────────────────────────
  // Test 5: Conversational text-only LLM response with zero tool calls
  // ────────────────────────────────────────────────────────────
  test('5. Conversational text-only response shows conversational completion with zero tool calls', async ({ page }) => {
    const sessionId = 'session-chat-test-505';

    await page.route('**/api/v1/agent/run', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'completed',
          trace: [
            {
              type: 'agent_response',
              content: 'AgentSentinel is a runtime behavioral governance framework for autonomous AI agents that intercepts tool calls at runtime.'
            }
          ]
        })
      });
    });

    await page.route(`**/api/v1/audit/${sessionId}`, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    await page.goto('http://localhost:5173/playground');
    await page.waitForSelector('h1:has-text("Runtime Playground")');

    // Click CONVERSATIONAL scenario
    await page.click('button:has-text("5. CONVERSATIONAL")');
    await page.locator('label:has-text("Session ID") + div input, input[required]').first().fill(sessionId);

    // Execute task
    await page.click('button:has-text("Execute Agent Task")');

    // Verify CONVERSATIONAL banner appears
    const chatBanner = page.locator('[data-testid="governance-outcome-banner"][data-outcome="CONVERSATIONAL"]');
    await expect(chatBanner).toBeVisible();
    await expect(chatBanner.locator('[data-testid="outcome-title"]')).toContainText('CONVERSATIONAL TASK COMPLETED — NO TOOL CALL WAS MADE');
    await expect(chatBanner.locator('[data-testid="outcome-badge"]')).toContainText('CONVERSATIONAL (0 TOOLS)');

    // Verify explanation states no tool calls were dispatched
    await expect(chatBanner.locator('[data-testid="outcome-description"]')).toContainText('No tool calls were formulated, requested, or dispatched to the M8 interception boundary.');

    // Verify response text is displayed
    await expect(page.locator('p:has-text("AgentSentinel is a runtime behavioral governance framework")')).toBeVisible();

    // Verify zero tool calls are displayed
    await expect(page.locator('span:has-text("Generated Tool Call")')).not.toBeVisible();
    await expect(page.locator('[data-testid="governance-outcome-banner"][data-outcome="ALLOW"]')).not.toBeVisible();
  });

  // ────────────────────────────────────────────────────────────
  // Test 6: Malformed or failed tool proposals show orchestration failure
  // ────────────────────────────────────────────────────────────
  test('6. Malformed tool proposal displays honest orchestration error state', async ({ page }) => {
    const sessionId = 'session-error-test-606';

    await page.route('**/api/v1/agent/run', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'error',
          trace: []
        })
      });
    });

    await page.route(`**/api/v1/audit/${sessionId}`, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    await page.goto('http://localhost:5173/playground');
    await page.waitForSelector('h1:has-text("Runtime Playground")');

    await page.locator('label:has-text("Session ID") + div input, input[required]').first().fill(sessionId);
    await page.click('button:has-text("Execute Agent Task")');

    // Verify ERROR banner
    const errorBanner = page.locator('[data-testid="governance-outcome-banner"][data-outcome="ERROR"]');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner.locator('[data-testid="outcome-title"]')).toContainText('AGENT ORCHESTRATION FAILED — MALFORMED PROPOSAL');
    await expect(errorBanner.locator('[data-testid="outcome-badge"]')).toContainText('ORCHESTRATION FAILED');

    // Verify it is NOT labeled as successful or ALLOW
    await expect(page.locator('[data-testid="governance-outcome-banner"][data-outcome="ALLOW"]')).not.toBeVisible();
  });

  // ────────────────────────────────────────────────────────────
  // Test 7: Direct Intercept Simulator outcome banners and audit correlation
  // ────────────────────────────────────────────────────────────
  test('7. Direct Intercept Simulator displays truthful ALERT banner and correlation evidence', async ({ page }) => {
    await page.route('**/api/v1/runtime/intercept', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          interception_id: 'int-sim-alert-707',
          sequence_number: 3,
          decision: 'ALERT',
          is_fail_safe: false,
          action_record: {
            risk_severity: 'MEDIUM',
            ml_probability: 0.42,
            auth_status: 'AUTHORIZED_MONITORED',
            reasons: [
              { rule_type: 'MONITORED_CALL', description: 'Action monitored under observation baseline' }
            ]
          },
          action: {
            tool_name: 'calculate',
            category: 'computation',
            is_mutating: false,
            is_destructive: false
          }
        })
      });
    });

    await page.goto('http://localhost:5173/playground');
    await page.waitForSelector('h1:has-text("Runtime Playground")');

    // Switch to Direct Intercept Simulator tab
    await page.click('button:has-text("Direct Intercept Simulator")');

    // Click Intercept Tool Call
    await page.click('button:has-text("Intercept Tool Call")');

    // Verify simulator outcome banner
    const simBanner = page.locator('[data-testid="simulator-outcome-banner"][data-outcome="ALERT"]');
    await expect(simBanner).toBeVisible();
    await expect(simBanner).toContainText('GOVERNANCE NOTICE — ALERT: ACTION MONITORED');

    // Verify interception ID is displayed
    await expect(page.locator('span:has-text("int-sim-alert-707")')).toBeVisible();

    // Verify toast is triggered
    await expect(page.locator('[data-testid="governance-alert-toast"]')).toBeVisible();
  });

  // ────────────────────────────────────────────────────────────
  // Test 8: Notification accessibility, Esc key, close button, and screen reader live regions
  // ────────────────────────────────────────────────────────────
  test('8. Alert toast notification accessibility: role=alert, Esc dismiss, and close button', async ({ page }) => {
    await page.route('**/api/v1/runtime/intercept', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          interception_id: 'int-accessibility-808',
          sequence_number: 1,
          decision: 'ALERT',
          is_fail_safe: false,
          action_record: { risk_severity: 'LOW', auth_status: 'AUTHORIZED', reasons: [] },
          action: { tool_name: 'test', category: 'computation' }
        })
      });
    });

    await page.goto('http://localhost:5173/playground');
    await page.click('button:has-text("Direct Intercept Simulator")');
    await page.click('button:has-text("Intercept Tool Call")');

    const toast = page.locator('[data-testid="governance-alert-toast"]');
    await expect(toast).toBeVisible();

    // Verify accessibility attributes
    await expect(toast).toHaveAttribute('role', 'alert');
    await expect(toast).toHaveAttribute('aria-live', 'assertive');

    // Verify dismiss button has accessible aria-label
    const dismissBtn = page.locator('[data-testid="dismiss-alert-toast"]');
    await expect(dismissBtn).toHaveAttribute('aria-label', 'Dismiss governance alert notification');

    // Dismiss using close button
    await dismissBtn.click();
    await expect(toast).not.toBeVisible();

    // Re-trigger by submitting again
    await page.click('button:has-text("Intercept Tool Call")');
    await expect(toast).toBeVisible();

    // Dismiss using Escape key
    await page.keyboard.press('Escape');
    await expect(toast).not.toBeVisible();
  });

});
