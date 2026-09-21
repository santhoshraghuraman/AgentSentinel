# Phase B Performance Baseline
**Date:** 2026-09-18
**Environment:** Windows / Python Localhost

## Measured Metrics

### API Latency
- `/health`: 23.85 ms
- `/system/diagnostics`: **2044.94 ms** (CRITICAL BOTTLENECK)
- `/audit`: 10.02 ms
- `/sessions`: 17.03 ms
- `/tasks`: 5.66 ms
- `/policies`: 4.74 ms
- `/reports/compliance`: 23.40 ms

### Frontend Route Load Times & DOM Size
- `/dashboard`: 1604.42 ms (336 DOM Nodes)
- `/live`: 740.03 ms (699 DOM Nodes)
- `/audit`: 642.45 ms (663 DOM Nodes)
- `/decision-explorer`: 612.49 ms (198 DOM Nodes)
- `/agents`: **4713.52 ms** (922 DOM Nodes) (CRITICAL BOTTLENECK)
- `/settings`: **2630.00 ms** (232 DOM Nodes)
- `/trajectories`: **2688.26 ms** (371 DOM Nodes)

### 120 FPS Target & Rendering Smoothness
- **Measured Average FPS:** ~60 FPS (Headless Chromium vSync Limit)
- **Frame Budget:** 120 FPS requires a frame budget of ~8.33 ms. 60 FPS requires ~16.66 ms.
- **Dropped/Long Frames:** Across all routes, the application drops over **60% of frames** (averaging ~75 frames exceeding 16.66ms out of 120 frames in a 2-second render window). 
- **120 FPS Achieved:** **No.** The application cannot currently sustain a smooth 60 FPS, let alone 120 FPS, due to massive render blocking and JS thread contention.

## Identified Bottlenecks (Ranked)
1. **`/agents` Route Load Time:** Taking nearly 5 seconds to load, indicating heavy unoptimized client-side data processing, excessive re-renders, or un-memoized derived calculations.
2. **`/system/diagnostics` API Endpoint:** Blocking for over 2 seconds, which severely degrades any page relying on system health metrics (likely causing the slowdown on `/settings` and `/trajectories` as well).
3. **React State & Render Jank:** Over 60% of frames exceed the 16.66ms budget during page load and live data polling, indicating expensive React render cycles and lack of `React.memo` or efficient data reconciliation in arrays.
4. **`/settings` and `/trajectories` Routes:** Taking over 2.6 seconds to load, largely blocked by expensive network or render waterfalls.
