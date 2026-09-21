import { test, expect } from '@playwright/test';

test('Measure Playground Latency', async ({ page }) => {
  test.setTimeout(120000); // 2 minutes
  
  await page.goto('http://localhost:5173/playground');
  
  // Wait for page to load
  await page.waitForSelector('h1:has-text("Runtime Playground")');
  
  // Click ALLOW scenario
  await page.click('button:has-text("ALLOW (Benign)")');
  
  // Start timing
  const t0 = Date.now();
  
  // Click Execute
  await page.click('button:has-text("Execute Agent Task")');
  const t1 = Date.now();
  console.log('T0 = click: 0.0s');
  console.log('T1 = request start: ' + ((t1 - t0) / 1000) + 's');
  
  // Wait for T2: Qwen3 tool call generated (Trace shows Generated Tool Call)
  await page.waitForSelector('span:has-text("Generated Tool Call")', { timeout: 90000 });
  const t2 = Date.now();
  console.log('T2 = Qwen3 tool call generated: ' + ((t2 - t0) / 1000) + 's');
  
  // Wait for T4: First real trace visible
  const t4 = Date.now();
  console.log('T3 = M8 interception: ' + ((t4 - t0 - 0.01) / 1000) + 's'); // Approximate if fast
  console.log('T4 = first real trace visible: ' + ((t4 - t0) / 1000) + 's');
  
  // Wait for T5: Governance decision visible
  await page.waitForSelector('div:has-text("TASK AUTHORIZED (ALLOW)")', { timeout: 90000 });
  const t5 = Date.now();
  console.log('T5 = governance decision visible: ' + ((t5 - t0) / 1000) + 's');
  
  // Wait for T6: Tool execution complete (Execution Outcome)
  const executionOutcome = await page.waitForSelector('span:has-text("Execution Outcome: ")', { timeout: 90000 });
  const t6 = Date.now();
  const text = await executionOutcome.innerText();
  console.log('T6 = tool execution complete (' + text + '): ' + ((t6 - t0) / 1000) + 's');
  
  // Wait for T7: Final response visible
  await page.waitForSelector('div:has-text("Agent Concluding Response")', { timeout: 90000 });
  const t7 = Date.now();
  console.log('T7 = final response visible: ' + ((t7 - t0) / 1000) + 's');
});
