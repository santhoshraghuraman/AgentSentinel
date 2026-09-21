const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    try {
        await page.goto('http://localhost:5173/playground');
        await page.waitForTimeout(2000);
        const loc = page.locator('div').filter({ has: page.locator('label:has-text("Task Context ID")') }).locator('input');
        console.log("Count:", await loc.count());
    } catch (e) {
        console.error(e);
    }
    await browser.close();
})();
