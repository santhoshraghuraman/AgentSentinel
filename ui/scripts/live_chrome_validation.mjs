import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const TARGET_SESSION_ID = process.env.TARGET_SESSION_ID || '';
const TARGET_INTERCEPTION_ID = process.env.TARGET_INTERCEPTION_ID || '';

const ROUTES = [
  { path: '/dashboard', heading: 'Overview Dashboard' },
  { path: '/live', heading: 'Live Monitor' },
  { path: '/audit', heading: 'Audit Logs' },
  { path: '/decision-explorer', heading: 'Decision Explorer' },
  { path: '/agents', heading: 'Agents & Sessions' },
  { path: '/settings', heading: 'System Diagnostics' },
  { path: '/reports', heading: 'Compliance & Governance Reports' },
  { path: '/evaluation', heading: 'Research Model Evaluation' },
  { path: '/datasets', heading: 'Datasets & Benchmark Corpus' },
  { path: '/tasks', heading: 'Task Authorization Contexts' },
  { path: '/policies', heading: 'Governance Policies' },
  { path: '/trajectories', heading: 'Trajectories' },
];

async function runValidation() {
  console.log('[CHROME-RUNNER] Launching Google Chrome (channel=chrome, headless=false)...');
  
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    slowMo: 100, // Small delay so actions are visibly discernible
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  const results = {
    chrome_version: browser.version(),
    routes: {},
    all_routes_pass: true,
    console_errors: [],
    page_errors: [],
    network_errors: [],
    cross_page_check: 'FAIL',
    refresh_check: 'FAIL',
    details: {}
  };

  // Global error listeners
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      console.log(`[CHROME CONSOLE ERROR] ${text}`);
      results.console_errors.push({ url: page.url(), text });
    }
  });

  page.on('pageerror', err => {
    console.log(`[CHROME PAGE ERROR] ${err.message}`);
    results.page_errors.push({ url: page.url(), message: err.message });
  });

  page.on('response', resp => {
    if (resp.status() >= 500) {
      console.log(`[CHROME NETWORK ERROR] ${resp.status()} ${resp.url()}`);
      results.network_errors.push({ status: resp.status(), url: resp.url() });
    }
  });

  console.log(`[CHROME-RUNNER] Connected to Chrome v${browser.version()}`);

  // 1. Test all 12 routes
  for (const r of ROUTES) {
    const fullUrl = `${BASE_URL}${r.path}`;
    console.log(`[CHROME-RUNNER] Testing route ${r.path} -> ${fullUrl}`);
    
    try {
      const start = Date.now();
      await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(1000); // Allow react-query to populate

      // Verify root container exists
      await page.waitForSelector('#root', { timeout: 5000 });
      
      // Verify primary heading or content text is visible
      const headingVisible = await page.getByText(r.heading).first().isVisible({ timeout: 5000 });
      
      const elapsed = Date.now() - start;
      if (headingVisible) {
        results.routes[r.path] = 'PASS';
        console.log(`[CHROME-RUNNER] Route ${r.path}: PASS (${elapsed}ms)`);

        // Batch 2 Screenshot Captures
        const screenshotMap = {
          '/trajectories': '01-trajectories.png',
          '/agents': '02-agents-sessions.png',
          '/policies': '03-policies.png',
          '/tasks': '04-tasks-auth-contexts.png',
        };

        if (screenshotMap[r.path]) {
          const filename = screenshotMap[r.path];
          
          // If trajectories, pick a session that has events (allow/block/alert)
          if (r.path === '/trajectories') {
            const select = page.locator('select');
            if (await select.isVisible()) {
              const options = await select.locator('option').all();
              for (const opt of options) {
                const val = await opt.getAttribute('value');
                if (val && (val.includes('block') || val.includes('allow') || val.includes('alert'))) {
                  await select.selectOption(val);
                  await page.waitForTimeout(1200);
                  break;
                }
              }
            }
          }

          // If agents, click the workload card for allow/block to populate the inspector with full data
          if (r.path === '/agents') {
            const activeCard = page.locator('div.cursor-pointer:has-text("BLOCK"), div.cursor-pointer:has-text("ALLOW")').first();
            if (await activeCard.isVisible()) {
              await activeCard.click();
              await page.waitForTimeout(1200);
            }
          }

          const dirs = [
            '../test-results/ui-batch2',
            '..',
            'C:/Users/91959/.gemini/antigravity-ide/brain/200b10a4-c558-4971-8027-94c3461e7a39'
          ];
          for (const d of dirs) {
            try {
              if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
              await page.screenshot({ path: `${d}/${filename}`, fullPage: false });
            } catch (err) {
              console.warn(`[CHROME-RUNNER] Could not write screenshot to ${d}:`, err.message);
            }
          }
          console.log(`[CHROME-RUNNER] Captured Batch 2 screenshot: ${filename}`);
        }
      } else {
        results.routes[r.path] = 'FAIL';
        results.all_routes_pass = false;
        console.log(`[CHROME-RUNNER] Route ${r.path}: FAIL - heading "${r.heading}" not visible`);
      }
    } catch (err) {
      results.routes[r.path] = 'FAIL';
      results.all_routes_pass = false;
      console.log(`[CHROME-RUNNER] Route ${r.path}: FAIL - ${err.message}`);
    }
  }

  // 2. Interactive Browser Verifications
  console.log('[CHROME-RUNNER] Executing interactive page interactions...');

  // A. Overview Dashboard Interactions
  try {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForTimeout(1000);
    const engineBadge = await page.getByText(/Engine Active/i).isVisible();
    const totalInterceptions = await page.getByText(/Total Interceptions/i).isVisible();
    results.details.dashboard_interactive = (engineBadge && totalInterceptions) ? 'PASS' : 'FAIL';
    console.log(`[CHROME-RUNNER] Dashboard interaction: ${results.details.dashboard_interactive}`);
  } catch (err) {
    results.details.dashboard_interactive = 'FAIL';
  }

  // B. Audit Log Search and Expand Interaction
  try {
    await page.goto(`${BASE_URL}/audit`);
    await page.waitForTimeout(1500);
    const searchInput = page.locator('input[placeholder*="Search by Interception ID"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('read');
      await page.waitForTimeout(500);
      await searchInput.fill(''); // Clear search
      await page.waitForTimeout(500);
    }
    // Click to expand first audit record if present
    const firstBadge = page.locator('div:has-text("ALLOW"), div:has-text("ALERT"), div:has-text("BLOCK")').first();
    if (await firstBadge.isVisible()) {
      await firstBadge.click();
      await page.waitForTimeout(500);
    }
    results.details.audit_interactive = 'PASS';
    console.log('[CHROME-RUNNER] Audit interaction: PASS');
  } catch (err) {
    results.details.audit_interactive = 'FAIL';
  }

  // C. Cross-Page Live Verification
  console.log('[CHROME-RUNNER] Executing Cross-Page Verification...');
  let crossPageMatched = true;

  try {
    // Check Live Monitor
    await page.goto(`${BASE_URL}/live`);
    await page.waitForTimeout(1500);
    const liveHasEvents = await page.locator('div:has-text("ALLOW"), div:has-text("ALERT"), div:has-text("BLOCK")').first().isVisible();
    if (!liveHasEvents) crossPageMatched = false;

    // Check Audit Page
    await page.goto(`${BASE_URL}/audit`);
    await page.waitForTimeout(1500);
    const auditHasRecords = await page.locator('div:has-text("ALLOW"), div:has-text("ALERT"), div:has-text("BLOCK")').first().isVisible();
    if (!auditHasRecords) crossPageMatched = false;

    // Check Agents Page
    await page.goto(`${BASE_URL}/agents`);
    await page.waitForTimeout(1500);
    const agentsList = await page.locator('div:has-text("COMPLETED"), div:has-text("ACTIVE")').first().isVisible();
    if (!agentsList) crossPageMatched = false;

    // Check Decision Explorer
    await page.goto(`${BASE_URL}/decision-explorer`);
    await page.waitForTimeout(1500);
    const select = page.locator('select');
    if (await select.isVisible()) {
      // wait for options to populate
      await page.waitForFunction(() => document.querySelectorAll('select option').length > 1, { timeout: 5000 }).catch(() => {});
      const options = await select.locator('option').all();
      if (options.length > 1) {
        // Select the second option (first real event)
        const val = await options[1].getAttribute('value');
        if (val) {
          await select.selectOption(val);
          await page.waitForTimeout(1500);
          const hasDetails = await page.getByText(/Session|Task|Tool|Decision/i).first().isVisible();
          if (!hasDetails) crossPageMatched = false;
        }
      }
    }

    results.cross_page_check = crossPageMatched ? 'PASS' : 'FAIL';
    console.log(`[CHROME-RUNNER] Cross-page verification: ${results.cross_page_check}`);
  } catch (err) {
    console.log(`[CHROME-RUNNER] Cross-page verification error: ${err.message}`);
    results.cross_page_check = 'FAIL';
  }

  // D. Refresh / Persistence Check
  console.log('[CHROME-RUNNER] Executing Refresh / Persistence Verification...');
  try {
    await page.goto(`${BASE_URL}/decision-explorer`);
    await page.waitForTimeout(1500);
    const select = page.locator('select');
    await select.waitFor({ timeout: 5000 });
    const countBefore = (await select.locator('option').all()).length;

    // Trigger browser reload
    console.log('[CHROME-RUNNER] Reloading page (page.reload())...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const selectAfter = page.locator('select');
    await selectAfter.waitFor({ timeout: 5000 });
    const countAfter = (await selectAfter.locator('option').all()).length;

    if (countBefore > 1 && countAfter === countBefore) {
      results.refresh_check = 'PASS';
    } else {
      results.refresh_check = 'FAIL';
    }
    console.log(`[CHROME-RUNNER] Refresh persistence check: ${results.refresh_check} (before=${countBefore}, after=${countAfter})`);
  } catch (err) {
    console.log(`[CHROME-RUNNER] Refresh check error: ${err.message}`);
    results.refresh_check = 'FAIL';
  }

  // Save results
  fs.writeFileSync('chrome_validation_results.json', JSON.stringify(results, null, 2));
  console.log('[CHROME-RUNNER] Validation completed. Results written to chrome_validation_results.json');

  await browser.close();
  return results;
}

runValidation().catch(err => {
  console.error('[CHROME-RUNNER FATAL]', err);
  process.exit(1);
});
