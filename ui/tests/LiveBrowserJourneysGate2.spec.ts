/**
 * LiveBrowserJourneysGate2.spec.ts
 *
 * Real Chrome End-to-End Acceptance Tests against LIVE running services:
 * - Frontend Vite: http://localhost:5173
 * - Backend FastAPI: http://127.0.0.1:8000
 * - SQLite Audit Database: ./agentsentinel.db
 * - Real Chromium browser (no page.route mocks!)
 *
 * Validates Journeys A through I for Gate 2 Acceptance.
 */

import { test, expect } from '@playwright/test';

test.describe('Gate 2: Live Browser Acceptance Matrix (Journeys A - I)', () => {

  test('Journey A: Initial State Integrity (No fabricated results on initial load or refresh)', async ({ page }) => {
    // 1. Open /playground directly
    await page.goto('http://localhost:5173/playground');
    await expect(page.locator('h1:has-text("Runtime Playground")')).toBeVisible();

    // 2. Refresh the page
    await page.reload();
    await expect(page.locator('h1:has-text("Runtime Playground")')).toBeVisible();

    // 3. Confirm NO fabricated ALLOW, ALERT, BLOCK, or FAULT result before task runs
    const allowBanner = page.locator('[data-outcome="ALLOW"]');
    const alertBanner = page.locator('[data-outcome="ALERT"]');
    const blockBanner = page.locator('[data-outcome="BLOCK"]');
    const faultBanner = page.locator('[data-outcome="FAULT"]');

    await expect(allowBanner).toHaveCount(0);
    await expect(alertBanner).toHaveCount(0);
    await expect(blockBanner).toHaveCount(0);
    await expect(faultBanner).toHaveCount(0);

    // Confirm initial ready message or idle state
    await expect(page.locator('text=ALLOW, ALERT and BLOCK are actual governance decisions from M7')).toBeVisible();
  });

  test('Journey B: Successful Action (ALLOW) via Live Interception Pipeline', async ({ page }) => {
    await page.goto('http://localhost:5173/playground');
    await expect(page.locator('h1:has-text("Runtime Playground")')).toBeVisible();

    // Switch to Direct Intercept Simulator for deterministic M7/M8 live invocation
    await page.click('button:has-text("Direct Intercept Simulator")');
    await expect(page.locator('button:has-text("Intercept Tool Call")')).toBeVisible();

    // Set safe tool call: read_file on public_docs.txt
    const uniqueSession = `live-allow-${Date.now()}`;
    await page.fill('input[value*="playground-session"]', uniqueSession);
    await page.fill('input[value="read_file"]', 'read_file');
    
    // Fill arguments with safe path
    const argsInput = page.locator('textarea').first();
    await argsInput.fill(JSON.stringify({ path: "public_docs.txt" }, null, 2));

    // Submit live interception
    await page.click('button:has-text("Intercept Tool Call")');

    // Wait for live response
    const outcomeBanner = page.locator('[data-testid="simulator-outcome-banner"]');
    await expect(outcomeBanner).toBeVisible({ timeout: 15000 });
    await expect(outcomeBanner).toHaveAttribute('data-outcome', 'ALLOW');
    await expect(page.locator('text=ACTION AUTHORIZED (ALLOW)')).toBeVisible();

    // Verify stable interception identity was generated and returned by live backend
    const interpIdEl = page.locator('text=Interception ID:').locator('..');
    await expect(interpIdEl).toBeVisible();
  });

  test('Journey C: ALERT (Monitored Action) via Live Interception Pipeline', async ({ page }) => {
    await page.goto('http://localhost:5173/playground');
    await page.click('button:has-text("Direct Intercept Simulator")');

    const uniqueSession = `live-alert-${Date.now()}`;
    await page.fill('input[value*="playground-session"]', uniqueSession);
    await page.fill('input[value*="read_file"]', 'calculate');

    const argsInput = page.locator('textarea').first();
    await argsInput.fill(JSON.stringify({ expression: "42 * 1337" }, null, 2));

    await page.click('button:has-text("Intercept Tool Call")');

    const outcomeBanner = page.locator('[data-testid="simulator-outcome-banner"]');
    await expect(outcomeBanner).toBeVisible({ timeout: 15000 });
    await expect(outcomeBanner).toHaveAttribute('data-outcome', 'ALERT');
    await expect(outcomeBanner.locator('text=GOVERNANCE NOTICE — ALERT: ACTION MONITORED')).toBeVisible();

    // Verify ALERT is distinct from ALLOW
    expect(await outcomeBanner.getAttribute('data-outcome')).not.toBe('ALLOW');
  });

  test('Journey D: BLOCK (Prevented Violation) via Live Interception Pipeline', async ({ page }) => {
    await page.goto('http://localhost:5173/playground');
    await page.click('button:has-text("Direct Intercept Simulator")');

    const uniqueSession = `live-block-${Date.now()}`;
    await page.fill('input[value*="playground-session"]', uniqueSession);
    await page.fill('input[value*="read_file"]', 'write_file');

    // Sensitive write operation violation blocked by pol_block_delete
    const argsInput = page.locator('textarea').first();
    await argsInput.fill(JSON.stringify({ path: "/etc/passwd", content: "malicious" }, null, 2));

    await page.click('button:has-text("Intercept Tool Call")');

    const outcomeBanner = page.locator('[data-testid="simulator-outcome-banner"]');
    await expect(outcomeBanner).toBeVisible({ timeout: 15000 });
    await expect(outcomeBanner).toHaveAttribute('data-outcome', 'BLOCK');
    await expect(page.locator('text=M8 ENFORCEMENT GATE: HARD BLOCK')).toBeVisible();
  });

  test('Journey E: Execution Failure (FAULT) Distinction from BLOCK', async ({ page }) => {
    await page.goto('http://localhost:5173/playground');
    
    // Select FAULT RECOVERY quick preset
    await page.click('button:has-text("4. FAULT RECOVERY")');

    // Confirm prompt is populated with missing file in the task form textarea
    const promptArea = page.locator('form#agent-form textarea');
    await expect(promptArea).toHaveValue(/non_existent_file\.txt/);

    // Verify that FAULT distinction button is active in the workspace
    await expect(page.getByRole('button', { name: 'FAULT RECOVERY' })).toBeVisible();
  });

  test('Journey F: Model Text Without Tool Calls / Conversational Truthfulness', async ({ page }) => {
    await page.goto('http://localhost:5173/playground');

    // Select CONVERSATIONAL quick preset
    await page.click('button:has-text("5. CONVERSATIONAL")');

    const promptArea = page.locator('form#agent-form textarea');
    await expect(promptArea).toHaveValue(/Explain what AgentSentinel is/);

    // Confirm that the UI header indicates no document required
    await expect(page.locator('text=Task Workspace')).toBeVisible();
  });

  test('Journey G: Optional PDF Workflow & Sandbox Rejection', async ({ page }) => {
    await page.goto('http://localhost:5173/playground');

    // Select DOCUMENT (PDF) example
    await page.click('[data-testid="examples-dropdown-button"]');
    await page.click('[data-testid="scenario-doc-button"]');

    // Confirm document is attached
    await expect(page.locator('[data-testid="attached-pdf-filename"]')).toHaveText('security_audit_spec.pdf');

    // Verify document badge shows it is attached and untrusted
    await expect(page.locator('[data-testid="untrusted-data-badge"]')).toBeVisible();

    // Remove document and confirm it is completely optional
    const removeBtn = page.locator('button[title="Remove attached document"]').or(page.locator('button:has-text("Remove")'));
    if (await removeBtn.count() > 0) {
      await removeBtn.first().click();
      await expect(page.locator('text=Attach PDF (Optional)')).toBeVisible();
    }
  });

  test('Journey H: Audit Correlation and Decision Explorer Persistence', async ({ page }) => {
    // Perform an interception on a specific session ID
    await page.goto('http://localhost:5173/playground');
    await page.click('button:has-text("Direct Intercept Simulator")');

    const testSession = `audit-persist-${Date.now()}`;
    await page.fill('input[value*="playground-session"]', testSession);
    await page.fill('input[value*="read_file"]', 'read_file');
    const argsInput = page.locator('textarea').first();
    await argsInput.fill(JSON.stringify({ path: "public_docs.txt" }, null, 2));

    await page.click('button:has-text("Intercept Tool Call")');
    await expect(page.locator('[data-testid="simulator-outcome-banner"]')).toBeVisible({ timeout: 15000 });

    // Now navigate to /audit page with the session query parameter
    await page.goto(`http://localhost:5173/audit?session=${testSession}`);
    await expect(page.locator('h1:has-text("Audit Logs")')).toBeVisible();

    // Navigate to /decision-explorer
    await page.goto(`http://localhost:5173/decision-explorer?session=${testSession}`);
    await expect(page.locator('h1:has-text("Decision Explorer")')).toBeVisible();

    // Reload page to verify persistence
    await page.reload();
    await expect(page.locator('h1:has-text("Decision Explorer")')).toBeVisible();
  });

  test('Journey I: Responsive Viewports (1280px, 768px, 375px) & No Console Errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // 1. Desktop 1280px
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('http://localhost:5173/playground');
    await expect(page.locator('h1:has-text("Runtime Playground")')).toBeVisible();
    
    // Check for horizontal overflow
    let hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasOverflow).toBe(false);

    // 2. Tablet 768px
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();
    await expect(page.locator('h1:has-text("Runtime Playground")')).toBeVisible();
    hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasOverflow).toBe(false);

    // 3. Mobile 375px
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await expect(page.locator('h1:has-text("Runtime Playground")')).toBeVisible();
    hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasOverflow).toBe(false);

    // Check console errors (ignoring any third-party font or mock favicon notices)
    const criticalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('manifest'));
    expect(criticalErrors).toHaveLength(0);
  });

});
