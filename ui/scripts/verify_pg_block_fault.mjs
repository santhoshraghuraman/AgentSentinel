import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';

const BASE_URL = 'http://localhost:5173';
const DB_PATH = '../agentsentinel.db';

function checkDb(query, params = []) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            const fallbackDb = new sqlite3.Database('../test_acceptance.db');
            fallbackDb.all(query, params, (err2, rows) => {
                fallbackDb.close();
                if (err2) reject(err2);
                else resolve(rows);
            });
            return;
        }
        db.all(query, params, (err2, rows) => {
            db.close();
            if (err2) reject(err2);
            else resolve(rows);
        });
    });
  });
}

async function run() {
  console.log('[VERIFY] Launching Headed Chrome for BLOCK/FAULT Fix...');
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const results = [];

  const record = async (route, control, action, expected, actual, api, db, final, screenshotName) => {
    const spath = path.resolve(`../reports/${screenshotName}.png`);
    await page.screenshot({ path: spath, fullPage: true }).catch(() => {});
    screenshotName = `![${screenshotName}](./${screenshotName}.png)`;
    results.push({ route, control, action, expected, actual, api, db, final, screenshotName });
    console.log(`[RECORD] ${route} | ${control} -> ${final}`);
  };

  const execPlayground = async (scenario, buttonText, expectText) => {
      console.log(`\n--- Running ${scenario} ---`);
      
      await page.goto(BASE_URL + '/playground');
      await page.waitForTimeout(1000);
      await page.click('button:has-text("Direct Intercept Simulator")').catch(()=>{});
      await page.waitForTimeout(1000);
      await page.click('button:has-text("Live Agent Execution")').catch(()=>{});
      await page.waitForTimeout(1000);

      console.log(`Clicking quick scenario button: ${buttonText}`);
      await page.click(`button:has-text("${buttonText}")`);
      await page.waitForTimeout(500);
      
      let apiOk = false;
      let uiOk = false;
      
      try {
          console.log('Waiting for button to be enabled and clicking...');
          await Promise.all([
            page.waitForResponse(res => res.url().includes('/api/') && res.request().method() === 'POST', { timeout: 120000 }).then(() => { apiOk = true; }).catch(()=>{ apiOk = false; }),
            page.click('button:has-text("Execute Agent Task")', { timeout: 120000 })
          ]);
          
          console.log(`Waiting for ${expectText} in UI...`);
          await page.waitForSelector(`text=${expectText}`, { timeout: 120000 });
          uiOk = true;
      } catch(e) {
          console.error(`  ${scenario} error:`, e);
      }
      
      let dbOk = 'N/A';
      try {
          const dbLogs = await checkDb('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 1');
          dbOk = (dbLogs.length > 0 && dbLogs[0].action === expectText) ? 'PASS' : 'FAIL';
      } catch(e) {}
      
      await record('/playground', `Playground ${scenario}`, 'EXECUTE', `Result ${expectText}`, uiOk ? 'Processed' : 'Timeout/Failed', apiOk ? 'PASS' : 'FAIL', dbOk, uiOk ? 'PASS' : 'FAIL', `functional_pg_${scenario.toLowerCase()}`);
  };

  try {
    await execPlayground('BLOCK', '3. BLOCK', 'BLOCK');
    await execPlayground('FAULT', '4. FAULT', 'EXECUTION_FAILED');

  } catch(e) {
    console.error('Error during tests:', e);
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
}

run().catch(console.error);
