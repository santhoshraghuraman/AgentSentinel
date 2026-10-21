import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const outDir = 'C:\\Users\\91959\\.gemini\\antigravity-ide\\brain\\85f09cb5-97c0-4826-bd7c-f9c60a002b99\\screenshots\\phase_4b';
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

  console.log('--- Capturing Phase 4B Playground Desktop Screenshots ---');

  // 1.1 Desktop Idle
  await page.goto('http://localhost:5173/playground', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2300); // wait for splash dismiss
  await page.screenshot({ path: path.join(outDir, '01_playground_desktop_idle.png'), fullPage: false });
  console.log('Captured: 01_playground_desktop_idle.png');

  // 1.2 Direct Intercept Simulator Tab
  await page.click('button:has-text("Direct Intercept Simulator")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("Intercept Tool Call")');
  await page.waitForSelector('div:has-text("Interception ID:")', { timeout: 10000 });
  await page.screenshot({ path: path.join(outDir, '02_playground_desktop_simulator.png'), fullPage: false });
  console.log('Captured: 02_playground_desktop_simulator.png');

  // Return to Live Agent tab
  await page.click('button:has-text("Live Agent Execution (User Task)")');
  await page.waitForTimeout(500);

  // 1.3 Trigger BLOCK Scenario and capture evidence
  console.log('Dispatching BLOCK scenario...');
  await page.click('button:has-text("3. BLOCK")');
  await page.waitForTimeout(500);
  await Promise.all([
    page.waitForResponse(res => res.url().includes('/agent/run') && res.request().method() === 'POST', { timeout: 120000 }),
    page.click('button:has-text("Execute Agent Task")')
  ]);
  await page.waitForSelector('div:has-text("THREAT NEUTRALIZED (BLOCK)")', { timeout: 120000 });
  // Expand M8 decision details
  const expandBtn = await page.$('button:has-text("M8 Decision Rationale & Risk Evidence")');
  if (expandBtn) {
    await expandBtn.click();
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: path.join(outDir, '03_playground_desktop_block_outcome.png'), fullPage: false });
  console.log('Captured: 03_playground_desktop_block_outcome.png');

  // 1.4 Trigger FAULT Scenario and capture evidence
  console.log('Dispatching FAULT scenario...');
  await page.click('button:has-text("4. FAULT")');
  await page.waitForTimeout(500);
  await Promise.all([
    page.waitForResponse(res => res.url().includes('/agent/run') && res.request().method() === 'POST', { timeout: 120000 }),
    page.click('button:has-text("Execute Agent Task")')
  ]);
  await page.waitForSelector('div:has-text("FAULT ENCOUNTERED (MONITORED)")', { timeout: 120000 });
  await page.screenshot({ path: path.join(outDir, '04_playground_desktop_fault_outcome.png'), fullPage: false });
  console.log('Captured: 04_playground_desktop_fault_outcome.png');

  await desktopContext.close();

  // 2. Mobile Context (390x844)
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true
  });
  const mobilePage = await mobileContext.newPage();

  console.log('--- Capturing Phase 4B Playground Mobile Screenshots ---');
  await mobilePage.goto('http://localhost:5173/playground', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(2300);
  await mobilePage.screenshot({ path: path.join(outDir, '05_playground_mobile_idle.png'), fullPage: false });
  console.log('Captured: 05_playground_mobile_idle.png');

  // Mobile scroll down to show cards and inputs
  await mobilePage.evaluate(() => window.scrollBy(0, 400));
  await mobilePage.waitForTimeout(400);
  await mobilePage.screenshot({ path: path.join(outDir, '06_playground_mobile_scrolled.png'), fullPage: false });
  console.log('Captured: 06_playground_mobile_scrolled.png');

  await mobileContext.close();
  await browser.close();
  console.log('Phase 4B Screenshot audit completed successfully.');
}

run().catch(console.error);
