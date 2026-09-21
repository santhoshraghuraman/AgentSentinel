import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5173';

async function run() {
  console.log('[VERIFY] Launching Headed Chrome for BLOCK/FAULT Diagnostic...');
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    await page.goto(BASE_URL + '/playground');
    await page.waitForTimeout(1000);
    await page.click('button:has-text("Direct Intercept Simulator")').catch(()=>{});
    await page.waitForTimeout(1000);
    await page.click('button:has-text("Live Agent Execution")').catch(()=>{});
    await page.waitForTimeout(1000);

    const execPlayground = async (scenario, ctxId, prompt) => {
        console.log(`\n--- Running ${scenario} ---`);
        await page.fill('#task-context-id', ctxId);
        await page.fill('textarea', prompt);
        await page.waitForTimeout(1000);
        
        console.log('Clicking Execute Agent Task...');
        await page.click('button:has-text("Execute Agent Task")');
        
        console.log('Waiting for network or DOM changes...');
        await page.waitForTimeout(10000);
        
        const html = await page.content();
        console.log(`Check DOM for ${scenario} status:`);
        if (html.includes('BLOCK')) console.log('Found BLOCK in DOM');
        else if (html.includes('EXECUTION_FAILED')) console.log('Found EXECUTION_FAILED in DOM');
        else console.log('No status found');
        
        const spath = path.resolve(`../reports/diagnostic_pg_${scenario.toLowerCase()}.png`);
        await page.screenshot({ path: spath, fullPage: true });
        console.log(`Saved screenshot to ${spath}`);
    };

    // Only test BLOCK and FAULT
    await execPlayground('BLOCK', 'task-write-live', 'Use write_file tool.');
    
    // reset for FAULT? Actually, clicking execute again might be what failed!
    await execPlayground('FAULT', 'task-read-live', 'Read missing file.');

  } catch(e) {
    console.error('Error during functional tests:', e);
  }

  await browser.close();
}

run().catch(console.error);
