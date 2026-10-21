/**
 * RuntimePlaygroundWorkflow.spec.ts
 *
 * Deterministic Playwright test suite for Pre-Phase-6D Runtime Playground Workflow Completion:
 * 1. Task submission without PDF executes successfully and correlates audit record without fallback.
 * 2. Task submission with valid PDF attaches document, displays untrusted badges, and passes context.
 * 3. Task requesting tool where model returns text only displays honest MISSING_TOOL outcome (not CONVERSATIONAL or ALLOW).
 * 4. Conversational task preset with zero tool calls displays CONVERSATIONAL outcome without mislabeling.
 * 5. Tool execution failure (FAULT) is clearly distinguished from BLOCK and shows error output.
 * 6. Submission state prevents duplicate dispatch and shows active dispatching feedback.
 */

import { test, expect } from '@playwright/test';

test.describe('Runtime Playground End-to-End Workflow Completion', () => {

  test.beforeEach(async ({ page }) => {
    // Mock diagnostics
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

    // Mock tasks
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

  // 1. Task submission without PDF executes and correlates audit
  test('1. Task submission without PDF executes successfully and correlates audit record without fallback', async ({ page }) => {
    const sessionId = 'workflow-allow-session-1';

    await page.route('**/api/v1/agent/run', async route => {
      const body = JSON.parse(route.request().postData() || '{}');
      expect(body.document_context).toBeUndefined();

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
            event_id: 'ev-allow-wf-1',
            session_id: sessionId,
            task_id: 'task_1',
            tool_name: 'read_file',
            interception_id: 'int-allow-wf-101',
            decision: 'ALLOW',
            execution_state: 'EXECUTED',
            timestamp: new Date().toISOString(),
            action: { category: 'file_system_read', normalized_name: 'read_file' },
            action_record: {
              risk_severity: 'LOW',
              ml_probability: 0.05,
              auth_status: 'AUTHORIZED',
              reasons: [{ rule_type: 'ALLOW_LIST', description: 'Read operation authorized in sandbox' }]
            }
          }
        ])
      });
    });

    await page.goto('http://localhost:5173/playground');
    await page.waitForSelector('h1:has-text("Runtime Playground")');

    // Scenario 1 ALLOW is selected by default; set explicit session ID
    await page.fill('[data-testid="agent-session-id"]', sessionId);

    // Verify PDF is optional and not attached
    await expect(page.locator('[data-testid="pdf-upload-dropzone"]')).toBeVisible();
    await expect(page.locator('[data-testid="attached-pdf-card"]')).not.toBeVisible();

    // Execute task
    await page.click('button:has-text("Execute Agent Task")');

    // Verify ALLOW banner appears
    const allowBanner = page.locator('[data-testid="governance-outcome-banner"][data-outcome="ALLOW"]');
    await expect(allowBanner).toBeVisible();
    await expect(allowBanner.locator('[data-testid="outcome-title"]')).toContainText('TASK AUTHORIZED (ALLOW)');

    // Verify correlated audit evidence header
    await expect(page.locator('span:has-text("int-allow-wf-101")')).toBeVisible();

    // Verify concluding response
    const agentResponse = page.locator('[data-testid="trace-step-agent-response"]');
    await expect(agentResponse).toBeVisible();
    await expect(agentResponse).toContainText('The public docs explain AgentSentinel dual-verification');
  });

  // 2. Task submission with valid PDF attaches document and passes context
  test('2. Task submission with valid PDF attaches document, displays untrusted badges, and passes context', async ({ page }) => {
    const sessionId = 'workflow-pdf-session-2';

    await page.route('**/api/v1/agent/run', async route => {
      const body = JSON.parse(route.request().postData() || '{}');
      expect(body.document_context).toContain('AgentSentinel Security Evaluation Brief');
      expect(body.document_filename).toBe('security_audit_spec.pdf');

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'completed',
          trace: [
            {
              type: 'document_ingestion',
              filename: 'security_audit_spec.pdf',
              characters_extracted: 785,
              page_count: 2,
              preview: 'AgentSentinel Security Evaluation Brief: Section 1 Executive Summary...',
              untrusted_input: true
            },
            {
              type: 'agent_response',
              content: 'The document mandates zero-trust runtime interception.'
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

    // Load sample PDF
    await page.click('[data-testid="load-sample-pdf-button"]');
    await expect(page.locator('[data-testid="attached-pdf-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="untrusted-data-badge"]')).toBeVisible();

    // Set session ID and submit
    await page.fill('[data-testid="agent-session-id"]', sessionId);
    await page.click('button:has-text("Execute Agent Task")');

    // Verify document ingestion trace step
    const docTrace = page.locator('[data-testid="trace-step-document-ingestion"]');
    await expect(docTrace).toBeVisible();
    await expect(docTrace).toContainText('security_audit_spec.pdf');
    await expect(docTrace).toContainText('UNTRUSTED DATA');
  });

  // 3. Task requesting tool where model returns text only displays honest MISSING_TOOL outcome
  test('3. Task requesting tool where model returns text only displays honest MISSING_TOOL outcome', async ({ page }) => {
    const sessionId = 'workflow-missing-tool-3';

    await page.route('**/api/v1/agent/run', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'completed',
          trace: [
            {
              type: 'agent_response',
              content: 'I understand you want to read public_docs.txt, but I am answering directly without tool calls.'
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

    // Scenario 1 ALLOW is selected (expects read_file tool call)
    await page.fill('[data-testid="agent-session-id"]', sessionId);
    await page.click('button:has-text("Execute Agent Task")');

    // Must NOT be labeled as ALLOW or CONVERSATIONAL
    await expect(page.locator('[data-testid="governance-outcome-banner"][data-outcome="ALLOW"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="governance-outcome-banner"][data-outcome="CONVERSATIONAL"]')).not.toBeVisible();

    // Must be labeled as MISSING_TOOL
    const missingBanner = page.locator('[data-testid="governance-outcome-banner"][data-outcome="MISSING_TOOL"]');
    await expect(missingBanner).toBeVisible();
    await expect(missingBanner.locator('[data-testid="outcome-title"]')).toContainText('TASK INCOMPLETE — NO TOOL CALL FORMULATED BY MODEL');
    await expect(missingBanner.locator('[data-testid="outcome-badge"]')).toContainText('MISSING TOOL CALL (0 TOOLS)');
    await expect(missingBanner.locator('[data-testid="outcome-description"]')).toContainText('This response is NOT an authorization decision, and the requested tool was not executed.');
  });

  // 4. Conversational task preset displays CONVERSATIONAL outcome
  test('4. Conversational task preset with zero tool calls displays CONVERSATIONAL outcome', async ({ page }) => {
    const sessionId = 'workflow-chat-4';

    await page.route('**/api/v1/agent/run', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'completed',
          trace: [
            {
              type: 'agent_response',
              content: 'AgentSentinel is a runtime zero-trust governance framework.'
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

    // Select CONVERSATIONAL scenario
    await page.click('button:has-text("5. CONVERSATIONAL")');
    await page.fill('[data-testid="agent-session-id"]', sessionId);
    await page.click('button:has-text("Execute Agent Task")');

    // Verify CONVERSATIONAL banner
    const chatBanner = page.locator('[data-testid="governance-outcome-banner"][data-outcome="CONVERSATIONAL"]');
    await expect(chatBanner).toBeVisible();
    await expect(chatBanner.locator('[data-testid="outcome-title"]')).toContainText('CONVERSATIONAL TASK COMPLETED — NO TOOL CALL WAS MADE');
  });

  // 5. Tool execution failure (FAULT) is distinguished from BLOCK
  test('5. Tool execution failure (FAULT) is clearly distinguished from BLOCK', async ({ page }) => {
    const sessionId = 'workflow-fault-5';

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
            event_id: 'ev-fault-wf-5',
            session_id: sessionId,
            task_id: 'task_1',
            tool_name: 'read_file',
            interception_id: 'int-fault-wf-5',
            decision: 'ALLOW',
            execution_state: 'EXECUTION_FAILED',
            timestamp: new Date().toISOString(),
            action: { category: 'file_system_read', normalized_name: 'read_file' },
            action_record: {
              risk_severity: 'LOW',
              ml_probability: 0.05,
              auth_status: 'AUTHORIZED',
              reasons: [{ rule_type: 'ALLOW_LIST', description: 'Read operation authorized in sandbox' }]
            }
          }
        ])
      });
    });

    await page.goto('http://localhost:5173/playground');
    await page.waitForSelector('h1:has-text("Runtime Playground")');

    // Click FAULT RECOVERY preset
    await page.click('button:has-text("4. FAULT RECOVERY")');
    await page.fill('[data-testid="agent-session-id"]', sessionId);
    await page.click('button:has-text("Execute Agent Task")');

    // Verify FAULT banner
    const faultBanner = page.locator('[data-testid="governance-outcome-banner"][data-outcome="FAULT"]');
    await expect(faultBanner).toBeVisible();
    await expect(faultBanner.locator('[data-testid="outcome-title"]')).toContainText('FAULT ENCOUNTERED (MONITORED) — TOOL EXECUTION EXCEPTION');
    await expect(faultBanner.locator('[data-testid="outcome-badge"]')).toContainText('GOVERNANCE: ALLOW');

    // Must NOT be labeled as BLOCK
    await expect(page.locator('[data-testid="governance-outcome-banner"][data-outcome="BLOCK"]')).not.toBeVisible();
  });

  // 6. Submission state prevents duplicate dispatch and shows active dispatching feedback
  test('6. Submission state prevents duplicate dispatch and shows active dispatching feedback', async ({ page }) => {
    let requestCount = 0;

    await page.route('**/api/v1/agent/run', async route => {
      requestCount++;
      // Delay response to check pending UI state
      await new Promise(resolve => setTimeout(resolve, 800));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'completed',
          trace: [
            {
              type: 'agent_response',
              content: 'Task completed cleanly.'
            }
          ]
        })
      });
    });

    await page.goto('http://localhost:5173/playground');
    await page.waitForSelector('h1:has-text("Runtime Playground")');

    const submitButton = page.locator('button:has-text("Execute Agent Task")');
    await expect(submitButton).toBeEnabled();

    // Trigger submission
    await submitButton.click();

    // While pending, submit button must be disabled with loading text
    await expect(page.locator('button:has-text("Agent Executing via Sentinel Runtime...")')).toBeDisabled();
    // Dispatching badge in header must be visible
    await expect(page.locator('span:has-text("DISPATCHING")')).toBeVisible();

    // Wait for completion
    await expect(page.locator('p:has-text("Task completed cleanly.")')).toBeVisible();
    expect(requestCount).toBe(1);
  });

});
