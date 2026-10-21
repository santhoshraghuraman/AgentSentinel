import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const outDir = 'C:\\Users\\91959\\.gemini\\antigravity-ide\\brain\\85f09cb5-97c0-4826-bd7c-f9c60a002b99\\screenshots\\phase_4c';
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function run() {
  const browser = await chromium.launch({ headless: true });

  // 1. Desktop Context (1920x1080)
  const desktopContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await desktopContext.newPage();

  console.log('--- Capturing Phase 4C Security Trajectory Map Desktop Screenshots ---');

  // Load trajectories page
  await page.goto('http://localhost:5173/trajectories', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Capture empty state on default session if it has 0 records
  await page.screenshot({ path: path.join(outDir, '06_trajectories_map_empty_state.png'), fullPage: false });
  console.log('Captured: 06_trajectories_map_empty_state.png');

  // Select playground-session-1 (which has real audit events)
  console.log('Selecting active session: playground-session-1...');
  const selectElem = await page.$('select');
  if (selectElem) {
    await selectElem.selectOption('playground-session-1');
  } else {
    await page.fill('input[placeholder*="Session ID"]', 'playground-session-1');
    await page.click('button:has-text("Analyze Session")');
  }

  // Wait for trajectory nodes to be rendered
  await page.waitForSelector('[role="option"]', { timeout: 10000 });
  await page.waitForTimeout(500);

  // 1.1 Desktop Active Session Map View (Default Map mode)
  await page.screenshot({ path: path.join(outDir, '01_trajectories_map_desktop_active_session.png'), fullPage: false });
  console.log('Captured: 01_trajectories_map_desktop_active_session.png');

  // 1.2 Select a different node (step 2 - BLOCK node)
  const nodes = await page.$$('[role="option"]');
  console.log(`Found ${nodes.length} trajectory nodes in DOM.`);
  if (nodes.length > 1) {
    await nodes[1].click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outDir, '02_trajectories_map_node_selected.png'), fullPage: false });
    console.log('Captured: 02_trajectories_map_node_selected.png');
  }

  // 1.3 Decision Filter Tab (Block)
  const blockBtn = await page.$('button:has-text("Block")');
  if (blockBtn) {
    await blockBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outDir, '03_trajectories_map_block_filter.png'), fullPage: false });
    console.log('Captured: 03_trajectories_map_block_filter.png');
  }

  // Reset to All
  const allBtn = await page.$('button:has-text("All")');
  if (allBtn) {
    await allBtn.click();
    await page.waitForTimeout(500);
  }

  // 1.4 Switch to Trace View
  const traceToggle = await page.$('button[aria-label="Switch to Trace view"]');
  if (traceToggle) {
    await traceToggle.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outDir, '04_trajectories_trace_view_desktop.png'), fullPage: false });
    console.log('Captured: 04_trajectories_trace_view_desktop.png');
  }

  // Switch back to Map View
  const mapToggle = await page.$('button[aria-label="Switch to Security Trajectory Map view"]');
  if (mapToggle) {
    await mapToggle.click();
    await page.waitForTimeout(500);
  }

  // 2. Mobile Viewport (375x667)
  console.log('--- Capturing Phase 4C Security Trajectory Map Mobile Screenshots ---');
  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 667 }
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('http://localhost:5173/trajectories', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);
  const mobileSelect = await mobilePage.$('select');
  if (mobileSelect) {
    await mobileSelect.selectOption('playground-session-1');
    try {
      await mobilePage.waitForSelector('[role="option"]', { timeout: 10000 });
      await mobilePage.waitForTimeout(500);
    } catch (e) {
      console.log('Mobile wait timed out, continuing...');
    }
  }
  await mobilePage.screenshot({ path: path.join(outDir, '05_trajectories_map_mobile_375w.png'), fullPage: false });
  console.log('Captured: 05_trajectories_map_mobile_375w.png');

  await browser.close();
  console.log('--- Phase 4C Screenshot Capture Complete ---');
}

run().catch(err => {
  console.error('Error capturing screenshots:', err);
  process.exit(1);
});
