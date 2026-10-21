import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const routes = [
  { name: '01_dashboard', path: '/' },
  { name: '02_live_monitor', path: '/live' },
  { name: '03_decision_explorer', path: '/decision-explorer' },
  { name: '04_playground', path: '/playground' },
  { name: '05_trajectories', path: '/trajectories' },
  { name: '06_agents', path: '/agents' },
  { name: '07_policies', path: '/policies' },
  { name: '08_tasks', path: '/tasks' },
  { name: '09_audit', path: '/audit' },
  { name: '10_datasets', path: '/datasets' },
  { name: '11_evaluation', path: '/evaluation' },
  { name: '12_reports', path: '/reports' },
  { name: '13_settings', path: '/settings' },
  { name: '14_diagnostics', path: '/system/diagnostics' },
];

const outDir = 'C:\\Users\\91959\\.gemini\\antigravity-ide\\brain\\85f09cb5-97c0-4826-bd7c-f9c60a002b99\\screenshots\\phase_4a';
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  
  // 1. Desktop captures (1280x800)
  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const desktopPage = await desktopContext.newPage();

  console.log('--- Capturing Desktop Viewports (1280x800) ---');
  for (const r of routes) {
    try {
      await desktopPage.goto(`http://localhost:5173${r.path}`, { waitUntil: 'networkidle', timeout: 15000 });
      // Wait for StartupScreen splash overlay to completely dismiss
      await desktopPage.waitForTimeout(2200);
      const filePath = path.join(outDir, `${r.name}_desktop.png`);
      await desktopPage.screenshot({ path: filePath, fullPage: false });
      console.log(`[DESKTOP] Captured ${r.name} -> ${filePath}`);
    } catch (err) {
      console.error(`[DESKTOP ERROR] Failed on ${r.name}:`, err.message);
    }
  }
  await desktopContext.close();

  // 2. Narrow/Mobile captures (390x844)
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true
  });
  const mobilePage = await mobileContext.newPage();

  console.log('--- Capturing Narrow Viewports (390x844) ---');
  for (const r of routes) {
    try {
      await mobilePage.goto(`http://localhost:5173${r.path}`, { waitUntil: 'networkidle', timeout: 15000 });
      // Wait for StartupScreen splash overlay to completely dismiss
      await mobilePage.waitForTimeout(2200);
      const filePath = path.join(outDir, `${r.name}_mobile.png`);
      await mobilePage.screenshot({ path: filePath, fullPage: false });
      console.log(`[MOBILE] Captured ${r.name} -> ${filePath}`);
    } catch (err) {
      console.error(`[MOBILE ERROR] Failed on ${r.name}:`, err.message);
    }
  }
  await mobileContext.close();

  await browser.close();
  console.log('All captures complete.');
}

run().catch(console.error);
