import { test, expect } from '@playwright/test';

test.describe('Correlated Audit Navigation (Phase 4C Follow-up)', () => {

  const mockAuditLedger = [
    {
      interception_id: 'int_corr_01',
      session_id: 'sess_corr_01',
      task_id: 'task_alpha',
      sequence_number: 1,
      timestamp: '2026-10-18T10:00:00Z',
      decision: 'ALLOW',
      execution_state: 'EXECUTED',
      tool_name: 'read_config_file',
      arguments: { path: '/etc/app.conf' },
      action: { category: 'file_system' },
      execution_result: 'Config content loaded',
      error_message: null,
    },
    {
      interception_id: 'int_corr_02',
      session_id: 'sess_corr_01',
      task_id: 'task_alpha',
      sequence_number: 2,
      timestamp: '2026-10-18T10:01:30Z',
      decision: 'BLOCK',
      execution_state: 'BLOCKED',
      tool_name: 'delete_database',
      arguments: { table: 'customers' },
      action: { category: 'database' },
      execution_result: null,
      error_message: 'Blocked by governance policy pol_protect_db',
    },
    {
      interception_id: 'int_foreign_99',
      session_id: 'sess_other_99',
      task_id: 'task_beta',
      sequence_number: 1,
      timestamp: '2026-10-18T10:05:00Z',
      decision: 'ALERT',
      execution_state: 'EXECUTED',
      tool_name: 'scan_network_ports',
      arguments: { host: '192.168.1.1' },
      action: { category: 'network', normalized_name: 'scan_network_ports' },
      execution_result: 'Port 80 open',
      error_message: null,
    },
    {
      interception_id: '001097cf-a493-45fd-a234-faac4f653d19',
      session_id: 'live-alert-1792417945840',
      task_id: '',
      sequence_number: 1,
      timestamp: '2026-10-19T13:52:26Z',
      decision: 'ALERT',
      execution_state: 'ATTEMPTED',
      tool_name: '',
      arguments: {},
      action: {
        category: 'unknown',
        normalized_name: 'calculate',
        operation: null,
        resource: null,
      },
      execution_result: null,
      error_message: null,
    },
  ];

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/audit', async (route) => {
      await route.fulfill({ json: mockAuditLedger });
    });
  });

  test('successful correlation: opens exact record when both valid identifiers match', async ({ page }) => {
    await page.goto('/audit?session=sess_corr_01&interception=int_corr_02');

    // Correlation banner is visible
    const banner = page.locator('[data-testid="audit-correlation-banner"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('sess_corr_01');
    await expect(banner).toContainText('int_corr_02');

    // The matched card has CORRELATED badge
    const matchedCard = page.locator('[data-testid="audit-card-int_corr_02"]');
    await expect(matchedCard).toBeVisible();
    await expect(matchedCard.locator('[data-testid="correlated-badge"]')).toBeVisible();

    // The matched card is auto-expanded (execution error message visible)
    await expect(matchedCard.getByText('Blocked by governance policy pol_protect_db')).toBeVisible();

    // Other cards are NOT expanded
    const otherCard = page.locator('[data-testid="audit-card-int_corr_01"]');
    await expect(otherCard.getByText('Config content loaded')).not.toBeVisible();
  });

  test('clearing correlation filter removes banner and query parameters', async ({ page }) => {
    await page.goto('/audit?session=sess_corr_01&interception=int_corr_02');

    const banner = page.locator('[data-testid="audit-correlation-banner"]');
    await expect(banner).toBeVisible();

    // Click Clear Correlation Filter
    await page.getByRole('button', { name: 'Clear Correlation Filter' }).click();

    // Banner disappears and URL is cleaned
    await expect(banner).not.toBeVisible();
    expect(page.url()).not.toContain('session=sess_corr_01');
    expect(page.url()).not.toContain('interception=int_corr_02');
  });

  test('missing interception parameter: shows incomplete notice and never auto-expands', async ({ page }) => {
    await page.goto('/audit?session=sess_corr_01');

    // Incomplete banner is visible
    const incompleteBanner = page.locator('[data-testid="audit-incomplete-banner"]');
    await expect(incompleteBanner).toBeVisible();
    await expect(incompleteBanner).toContainText(/both session and interception query parameters are required/i);

    // No cards have the CORRELATED badge
    await expect(page.locator('[data-testid="correlated-badge"]')).not.toBeVisible();

    // Cards are not auto-expanded
    await expect(page.getByText('Blocked by governance policy pol_protect_db')).not.toBeVisible();
    await expect(page.getByText('Config content loaded')).not.toBeVisible();
  });

  test('missing session parameter: shows incomplete notice and never auto-expands', async ({ page }) => {
    await page.goto('/audit?interception=int_corr_02');

    const incompleteBanner = page.locator('[data-testid="audit-incomplete-banner"]');
    await expect(incompleteBanner).toBeVisible();

    // No cards have the CORRELATED badge
    await expect(page.locator('[data-testid="correlated-badge"]')).not.toBeVisible();
  });

  test('unmatched identifiers: interception does not belong to session shows unmatched notice', async ({ page }) => {
    // int_foreign_99 belongs to sess_other_99, NOT sess_corr_01
    await page.goto('/audit?session=sess_corr_01&interception=int_foreign_99');

    // Unmatched notice is visible
    const unmatchedBanner = page.locator('[data-testid="audit-unmatched-banner"]');
    await expect(unmatchedBanner).toBeVisible();
    await expect(unmatchedBanner).toContainText('No audit record found matching session');

    // No card is marked correlated
    await expect(page.locator('[data-testid="correlated-badge"]')).not.toBeVisible();

    // Neither card is auto-expanded
    await expect(page.getByText('Port 80 open')).not.toBeVisible();
  });

  test('invalid / non-existent IDs: shows unmatched notice and never selects latest event', async ({ page }) => {
    await page.goto('/audit?session=sess_nonexistent&interception=int_fake_999');

    const unmatchedBanner = page.locator('[data-testid="audit-unmatched-banner"]');
    await expect(unmatchedBanner).toBeVisible();

    // Ensure it did not arbitrarily select any card
    await expect(page.locator('[data-testid="correlated-badge"]')).not.toBeVisible();
    await expect(page.getByText('Blocked by governance policy pol_protect_db')).not.toBeVisible();
  });

  test('ordinary /audit navigation preserves all existing filters and controls', async ({ page }) => {
    await page.goto('/audit');

    // No correlation or warning banners
    await expect(page.locator('[data-testid="audit-correlation-banner"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="audit-unmatched-banner"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="audit-incomplete-banner"]')).not.toBeVisible();

    // All events rendered
    await expect(page.getByText('read_config_file')).toBeVisible();
    await expect(page.getByText('delete_database')).toBeVisible();
    await expect(page.getByText('scan_network_ports')).toBeVisible();

    // Decision select filter still works
    await page.locator('select').selectOption('BLOCK');
    await expect(page.getByText('delete_database')).toBeVisible();
    await expect(page.getByText('read_config_file')).not.toBeVisible();
  });

  test('end-to-end trajectory to audit correlation navigation', async ({ page }) => {
    // Mock sessions
    await page.route('**/api/v1/sessions', async (route) => {
      await route.fulfill({
        json: [
          {
            session_id: 'sess_corr_01',
            task_id: 'task_alpha',
            agent_id: 'audit_agent',
            created_at: new Date().toISOString(),
            status: 'completed',
            verdict_counts: { ALLOW: 1, BLOCK: 1, ALERT: 0 },
            total_events: 2,
          },
        ],
      });
    });

    // Mock audit by session
    await page.route('**/api/v1/audit/sess_corr_01', async (route) => {
      await route.fulfill({
        json: [mockAuditLedger[0], mockAuditLedger[1]],
      });
    });

    await page.goto('/trajectories');

    // Click step 2 (delete_database, BLOCK)
    const step2Node = page.locator('[role="option"]').filter({ hasText: 'STEP 02' });
    await step2Node.click();

    // Click "View in Audit Ledger" link in the Deep Inspection Drawer
    const auditLink = page.getByRole('link', { name: 'View in Audit Ledger' });
    await expect(auditLink).toBeVisible();
    await auditLink.click();

    // Verifies navigation to /audit with exact session and interception query params
    await page.waitForURL(/\/audit\?session=sess_corr_01&interception=int_corr_02/);

    // Correlated banner and auto-expanded card are verified in Audit page
    await expect(page.locator('[data-testid="audit-correlation-banner"]')).toBeVisible();
    const correlatedCard = page.locator('[data-testid="audit-card-int_corr_02"]');
    await expect(correlatedCard).toBeVisible();
    await expect(correlatedCard.locator('[data-testid="correlated-badge"]')).toBeVisible();
    await expect(correlatedCard.getByText('Blocked by governance policy pol_protect_db')).toBeVisible();
  });

  test('exact interception ID search strictly filters to matching record and excludes unrelated records', async ({ page }) => {
    await page.goto('/audit');

    // Search specifically for the calculate legacy event by exact interception ID
    const searchInput = page.getByPlaceholder('Search by Interception ID, Session, Task, or Tool...');
    await searchInput.fill('001097cf-a493-45fd-a234-faac4f653d19');

    // Exactly one matching card is visible
    const matchedCard = page.locator('[data-testid="audit-card-001097cf-a493-45fd-a234-faac4f653d19"]');
    await expect(matchedCard).toBeVisible();

    // Verify un-inferred provenance in card: calculate action name is displayed
    await expect(matchedCard.getByText('calculate')).toBeVisible();

    // All other unrelated records are excluded from the visible list
    await expect(page.locator('[data-testid="audit-card-int_corr_01"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="audit-card-int_corr_02"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="audit-card-int_foreign_99"]')).not.toBeVisible();
  });

  test('search matches action normalized_name even when legacy tool_name is empty', async ({ page }) => {
    await page.goto('/audit');

    const searchInput = page.getByPlaceholder('Search by Interception ID, Session, Task, or Tool...');
    await searchInput.fill('calculate');

    // Matches the calculate event
    const matchedCard = page.locator('[data-testid="audit-card-001097cf-a493-45fd-a234-faac4f653d19"]');
    await expect(matchedCard).toBeVisible();

    // Unrelated records are excluded
    await expect(page.locator('[data-testid="audit-card-int_corr_01"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="audit-card-int_corr_02"]')).not.toBeVisible();
  });

  test('isolating correlated record filters out unrelated records from the ledger', async ({ page }) => {
    await page.goto('/audit?session=sess_corr_01&interception=int_corr_02');

    const banner = page.locator('[data-testid="audit-correlation-banner"]');
    await expect(banner).toBeVisible();

    // Before isolation, ledger shows other records in background
    await expect(page.locator('[data-testid="audit-card-int_corr_01"]')).toBeVisible();

    // Click Isolate Correlated Record
    const isolateBtn = page.locator('[data-testid="toggle-isolate-correlated"]');
    await expect(isolateBtn).toBeVisible();
    await isolateBtn.click();

    // Banner indicates only correlated record is shown
    await expect(banner).toContainText('Showing only correlated record');

    // Correlated card is visible, unrelated cards are hidden
    await expect(page.locator('[data-testid="audit-card-int_corr_02"]')).toBeVisible();
    await expect(page.locator('[data-testid="audit-card-int_corr_01"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="audit-card-int_foreign_99"]')).not.toBeVisible();

    // Click Show All Records to restore
    await page.getByRole('button', { name: 'Show All Records' }).click();
    await expect(page.locator('[data-testid="audit-card-int_corr_01"]')).toBeVisible();
  });
});

