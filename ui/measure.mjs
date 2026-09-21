import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/live');
  
  // Wait for the connection
  await page.waitForTimeout(2000);
  
  // Fill prompt
  await page.fill('input[type="text"]', 'Use the read_file tool to read public_docs.txt.');
  
  console.log('Sending prompt...');
  const start = Date.now();
  
  // Click submit
  await page.click('button:has-text("Send")');
  
  // Wait for the tool call
  await page.waitForSelector('text=Tool Call Requested', { timeout: 60000 });
  const toolCallTime = Date.now();
  console.log('click -> tool call:', (toolCallTime - start) + 'ms');
  
  // Wait for execution or decision
  await page.waitForSelector('text=allow', { timeout: 60000 });
  const decisionTime = Date.now();
  console.log('click -> governance decision:', (decisionTime - start) + 'ms');
  
  // Wait for final response
  await page.waitForSelector('text=execution_success', { timeout: 60000 });
  const finalTime = Date.now();
  console.log('click -> final response:', (finalTime - start) + 'ms');
  
  await browser.close();
})();
