import { test, expect } from '@playwright/test';

test.describe('Phase 4.5 Batch 3: Audit, Datasets, Evaluation, Reports, Settings', () => {

  test('Audit Logs: renders full ledger and filter', async ({ page }) => {
    await page.route('**/api/v1/audit', async (route) => {
      await route.fulfill({
        json: [
          {
            interception_id: 'int_01',
            session_id: 'sess_123',
            task_id: 'task_xyz',
            sequence_number: 1,
            timestamp: new Date().toISOString(),
            decision: 'ALLOW',
            execution_state: 'EXECUTED',
            tool_name: 'read_file',
            arguments: { path: '/workspace/config.json' },
            action: { category: 'file_system' },
            execution_result: 'File contents...',
            error_message: null
          },
          {
            interception_id: 'int_02',
            session_id: 'sess_123',
            task_id: 'task_xyz',
            sequence_number: 2,
            timestamp: new Date().toISOString(),
            decision: 'BLOCK',
            execution_state: 'BLOCKED',
            tool_name: 'delete_file',
            arguments: { path: '/workspace/db.sqlite' },
            action: { category: 'file_system' },
            execution_result: null,
            error_message: 'Blocked by policy'
          }
        ]
      });
    });

    await page.goto('/audit');

    // Title and stats
    await expect(page.locator('h1:has-text("Audit Logs")')).toBeVisible();
    await expect(page.getByText('EVENTS: 2')).toBeVisible();

    // Check list renders
    await expect(page.getByText('read_file', { exact: true })).toBeVisible();
    await expect(page.getByText('delete_file', { exact: true })).toBeVisible();

    // Filter
    await page.locator('select').selectOption('BLOCK');
    await expect(page.getByText('delete_file', { exact: true })).toBeVisible();
    await expect(page.getByText('read_file', { exact: true })).not.toBeVisible();
  });

  test('Datasets: renders corpus information', async ({ page }) => {
    await page.route('**/api/v1/research/datasets', async (route) => {
      await route.fulfill({
        json: [
          {
            id: 'ds_1',
            name: 'Agent Trajectories Alpha',
            role: 'TRAINING',
            format: 'JSONL',
            description: 'Core training set.',
            source_path: '/data/alpha.jsonl',
            size_bytes: 1048576,
            sha256: 'abc123hash',
            trajectory_count: 5000,
            ml_model_target: 'random_forest',
            label_distribution: { safe: 4500, unsafe: 500 }
          }
        ]
      });
    });

    await page.goto('/datasets');

    await expect(page.locator('h1:has-text("Datasets & Benchmark Corpus")')).toBeVisible();
    await expect(page.getByText('Agent Trajectories Alpha')).toBeVisible();
    await expect(page.getByText('5,000')).toBeVisible(); // trajectory count
    await expect(page.getByText('1.00 MB')).toBeVisible();
  });

  test('Evaluation: renders ML evaluation metrics', async ({ page }) => {
    await page.route('**/api/v1/research/evaluation', async (route) => {
      await route.fulfill({
        json: {
          model_type: 'random_forest',
          dataset_source: 'Agent Trajectories Alpha',
          total_dataset_records: 5000,
          training_samples: 3750,
          evaluation_samples: 1250,
          class_distribution: { safe_samples: 4500, unsafe_samples: 500 },
          random_seed: 42,
          trained_at: new Date().toISOString(),
          accuracy: 0.95,
          precision: 0.96,
          recall: 0.94,
          f1_score: 0.949,
          roc_auc: 0.98,
          false_positive_rate: 0.05,
          false_negative_rate: 0.06,
          confusion_matrix: {
            true_negative: 1000,
            false_positive: 50,
            false_negative: 20,
            true_positive: 180
          },
          feature_importances: {
            risk_score: 0.8,
            priority: 0.2
          }
        }
      });
    });

    await page.goto('/evaluation');

    await expect(page.locator('h1:has-text("Research Model Evaluation")')).toBeVisible();
    await expect(page.getByText('95.0%').first()).toBeVisible(); // Accuracy
    await expect(page.getByText('True Negative (Safe)')).toBeVisible();
    await expect(page.getByText('1000')).toBeVisible();
  });

  test('Reports: renders compliance report', async ({ page }) => {
    await page.route('**/api/v1/reports/compliance', async (route) => {
      await route.fulfill({
        json: {
          platform: 'AgentSentinel Core',
          compliance_status: 'COMPLIANT',
          report_id: 'REP-1234',
          generated_at: new Date().toISOString(),
          posture: {
            total_interceptions: 1500,
            alert_rate: 0.1,
            block_rate: 0.05,
            decisions: { allow: 1275, alert: 150, block: 75 },
            execution_states: { executed: 1400, blocked: 75, execution_failed: 25 }
          },
          governance: {
            active_policies_count: 5,
            total_registered_sessions: 10
          },
          ml_baseline: {
            model_type: 'random_forest',
            accuracy: 0.95,
            f1_score: 0.949
          }
        }
      });
    });

    await page.goto('/reports');

    await expect(page.locator('h1:has-text("Compliance & Governance Reports")')).toBeVisible();
    await expect(page.getByText('COMPLIANT')).toBeVisible();
    await expect(page.getByText('1500').first()).toBeVisible(); // Total Interceptions
  });

  test('Settings: renders system diagnostics', async ({ page }) => {
    await page.route('**/api/v1/system/diagnostics', async (route) => {
      await route.fulfill({
        json: {
          health: { status: 'healthy', version: '1.0.0', milestone: 'M12' },
          database: { type: 'SQLite', status: 'available' },
          llm: { provider: 'Ollama', model: 'qwen3:4b', host: 'http://localhost:11434', status: 'available' },
          governance: { fail_safe_enabled: true, active_policies: 5 }
        }
      });
    });

    await page.goto('/settings');

    await expect(page.locator('h1:has-text("System Diagnostics")')).toBeVisible();
    await expect(page.getByText('AgentSentinel Core', { exact: true })).toBeVisible();
    await expect(page.getByText('ENABLED (BLOCK ON ERROR)')).toBeVisible();
    await expect(page.getByText('qwen3:4b')).toBeVisible();
  });

});
