import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const API_URL = process.env.API_URL || 'http://127.0.0.1:8000/api/v1';

async function measureAPI() {
    console.log('[PERF] Measuring API Latency...');
    const endpoints = [
        '/health',
        '/system/diagnostics',
        '/audit',
        '/sessions',
        '/tasks',
        '/policies',
        '/reports/compliance'
    ];
    
    const results = {};
    for (const ep of endpoints) {
        const start = performance.now();
        try {
            const r = await fetch(`${API_URL}${ep}`);
            await r.text();
            const end = performance.now();
            results[ep] = `${(end - start).toFixed(2)} ms`;
        } catch(e) {
            results[ep] = 'ERROR';
        }
    }
    return results;
}

async function waitForServices() {
    console.log('[PERF] Waiting 3s for services to be ready...');
    await new Promise(r => setTimeout(r, 3000));
    console.log('[PERF] Proceeding.');
}

async function runPerf() {
    await waitForServices();
    console.log('[PERF] Starting Performance Measurement...');
    const apiResults = await measureAPI();
    
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    const client = await page.context().newCDPSession(page);
    await client.send('Performance.enable');

    const metrics = {};
    const fpsData = {};

    const routes = [
        '/dashboard', '/live', '/trajectories', '/agents', '/settings',
        '/playground', '/evaluation', '/datasets', '/reports', '/tasks',
        '/policies'
    ];

    for (const r of routes) {
        console.log(`[PERF] Navigating to ${r}...`);
        
        // Setup frame counting
        let frames = 0;
        let dropped = 0;
        let lastFrameTime = performance.now();
        
        client.on('Tracing.dataCollected', () => {}); // Just in case
        
        // Instead of tracing, use requestAnimationFrame via page.evaluate
        const start = performance.now();
        await page.goto(`${BASE_URL}${r}`, { waitUntil: 'networkidle', timeout: 10000 });
        const end = performance.now();
        
        const loadTime = end - start;
        
        const fpsResult = await page.evaluate(() => {
            return new Promise(resolve => {
                let frameCount = 0;
                let startTime = performance.now();
                let lastFrame = startTime;
                let longFrames = 0;
                
                function tick(now) {
                    frameCount++;
                    if (now - lastFrame > 16.66) longFrames++; // Anything over ~60fps threshold
                    lastFrame = now;
                    
                    if (now - startTime < 2000) {
                        requestAnimationFrame(tick);
                    } else {
                        resolve({
                            frameCount,
                            longFrames,
                            duration: now - startTime,
                            avgFps: (frameCount / ((now - startTime) / 1000))
                        });
                    }
                }
                requestAnimationFrame(tick);
            });
        });

        metrics[r] = {
            load_time_ms: loadTime.toFixed(2),
            avg_fps: fpsResult.avgFps.toFixed(2),
            long_frames_2sec: fpsResult.longFrames
        };
        
        // Measure DOM size
        const domNodes = await page.evaluate(() => document.querySelectorAll('*').length);
        metrics[r].dom_nodes = domNodes;
    }
    
    await browser.close();
    
    const finalReport = {
        api_latency: apiResults,
        frontend_metrics: metrics
    };
    
    fs.writeFileSync('performance_baseline.json', JSON.stringify(finalReport, null, 2));
    console.log('[PERF] Measurement complete. Results written to performance_baseline.json');
}

runPerf().catch(console.error);
