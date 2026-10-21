import { test, expect } from '@playwright/test';

test.describe('Transition-Time Readability & Safety (Phase 4C Follow-up)', () => {

  const baseEvent = {
    session_id: 'sess_timing_test',
    task_id: 'task_timing',
    agent_id: 'test_agent',
    decision: 'ALLOW',
    execution_state: 'EXECUTED',
    action_record: { risk_score: 0.1, auth_status: 'AUTHORIZED' },
  };

  test('formats millisecond, second, minute, hour, and day transitions correctly in UI', async ({ page }) => {
    const mockEvents = [
      {
        ...baseEvent,
        interception_id: 'evt_0',
        sequence_number: 1,
        timestamp: '2026-10-18T12:00:00.000Z',
        tool_name: 'tool_step_1',
      },
      {
        ...baseEvent,
        interception_id: 'evt_1',
        sequence_number: 2,
        timestamp: '2026-10-18T12:00:00.350Z', // +350 ms
        tool_name: 'tool_step_2',
      },
      {
        ...baseEvent,
        interception_id: 'evt_2',
        sequence_number: 3,
        timestamp: '2026-10-18T12:00:15.500Z', // +15.15 s (~15.2 s)
        tool_name: 'tool_step_3',
      },
      {
        ...baseEvent,
        interception_id: 'evt_3',
        sequence_number: 4,
        timestamp: '2026-10-18T12:05:45.500Z', // +330 s = 5.5 min
        tool_name: 'tool_step_4',
      },
      {
        ...baseEvent,
        interception_id: 'evt_4',
        sequence_number: 5,
        timestamp: '2026-10-18T15:35:45.500Z', // +3.5 hr = 12600 s = 3.5 hr
        tool_name: 'tool_step_5',
      },
      {
        ...baseEvent,
        interception_id: 'evt_5',
        sequence_number: 6,
        timestamp: '2026-10-21T03:35:45.500Z', // +2.5 days = 216000 s = 2.5 d
        tool_name: 'tool_step_6',
      },
    ];

    await page.route('**/api/v1/sessions', async (route) => {
      await route.fulfill({
        json: [
          {
            session_id: 'sess_timing_test',
            task_id: 'task_timing',
            status: 'completed',
            verdict_counts: { ALLOW: 6, ALERT: 0, BLOCK: 0 },
            total_events: 6,
          },
        ],
      });
    });

    await page.route('**/api/v1/audit/sess_timing_test', async (route) => {
      await route.fulfill({ json: mockEvents });
    });

    await page.goto('/trajectories');

    // Millisecond unit check
    await expect(page.getByText('350 ms')).toBeVisible();

    // Second unit check
    await expect(page.getByText('15.2 s')).toBeVisible();

    // Minute unit check
    await expect(page.getByText('5.5 min')).toBeVisible();

    // Hour unit check
    await expect(page.getByText('3.5 hr')).toBeVisible();

    // Day unit check
    await expect(page.getByText('2.5 d')).toBeVisible();
  });

  test('negative delta (clock skew) safely suppressed without rendering negative or corrupt text', async ({ page }) => {
    const mockEvents = [
      {
        ...baseEvent,
        interception_id: 'evt_skew_1',
        sequence_number: 1,
        timestamp: '2026-10-18T12:00:00.000Z',
        tool_name: 'step_before_skew',
      },
      {
        ...baseEvent,
        interception_id: 'evt_skew_2',
        sequence_number: 2,
        timestamp: '2026-10-18T11:59:50.000Z', // 10 seconds in the PAST (skew)
        tool_name: 'step_after_skew',
      },
    ];

    await page.route('**/api/v1/sessions', async (route) => {
      await route.fulfill({
        json: [
          {
            session_id: 'sess_timing_test',
            task_id: 'task_timing',
            status: 'completed',
            verdict_counts: { ALLOW: 2, ALERT: 0, BLOCK: 0 },
            total_events: 2,
          },
        ],
      });
    });

    await page.route('**/api/v1/audit/sess_timing_test', async (route) => {
      await route.fulfill({ json: mockEvents });
    });

    await page.goto('/trajectories');

    // Both steps rendered
    await expect(page.getByText('step_before_skew').first()).toBeVisible();
    await expect(page.getByText('step_after_skew').first()).toBeVisible();

    // Negative delta must NOT be rendered
    await expect(page.getByText(/-\d+/)).not.toBeVisible();
    await expect(page.getByText(/-10/)).not.toBeVisible();
  });

  test('missing or invalid timestamps safely handled with zero crashes', async ({ page }) => {
    const mockEvents = [
      {
        ...baseEvent,
        interception_id: 'evt_bad_1',
        sequence_number: 1,
        timestamp: 'not-a-valid-date',
        tool_name: 'step_invalid_ts',
      },
      {
        ...baseEvent,
        interception_id: 'evt_bad_2',
        sequence_number: 2,
        timestamp: '',
        tool_name: 'step_empty_ts',
      },
      {
        ...baseEvent,
        interception_id: 'evt_bad_3',
        sequence_number: 3,
        timestamp: '2026-10-18T12:00:05.000Z',
        tool_name: 'step_good_ts',
      },
    ];

    await page.route('**/api/v1/sessions', async (route) => {
      await route.fulfill({
        json: [
          {
            session_id: 'sess_timing_test',
            task_id: 'task_timing',
            status: 'completed',
            verdict_counts: { ALLOW: 3, ALERT: 0, BLOCK: 0 },
            total_events: 3,
          },
        ],
      });
    });

    await page.route('**/api/v1/audit/sess_timing_test', async (route) => {
      await route.fulfill({ json: mockEvents });
    });

    await page.goto('/trajectories');

    // All steps render cleanly without uncaught exceptions
    await expect(page.getByText('step_invalid_ts').first()).toBeVisible();
    await expect(page.getByText('step_empty_ts').first()).toBeVisible();
    await expect(page.getByText('step_good_ts').first()).toBeVisible();

    // No NaN or undefined in the DOM
    await expect(page.getByText('NaN', { exact: true })).not.toBeVisible();
    await expect(page.getByText('undefined', { exact: true })).not.toBeVisible();
  });
});
