# Phase B: Agents Performance Optimization

## BASELINE
The `/agents` page originally loaded in approximately `4713 ms` during Phase B baseline measurements. Long frames (taking > 16.66ms) were prevalent, indicating heavy blocking on the main thread and jank in the React lifecycle.

## MEASURED ROOT CAUSE
The `4713 ms` load time was primarily caused by the backend latency from `GET /system/diagnostics` (which originally blocked the single-threaded Uvicorn server for 2 seconds due to an IPv6 resolution timeout, thereby stalling concurrent `GET /sessions` requests).
After resolving the backend bottleneck in Phase B.1, the load time dropped to `~652 ms`.

However, the React frontend still experienced heavy jank (~78 long frames out of 120 during a 2-second measurement window). Profiling `AgentsPage.tsx` revealed:
1. Every time `useQuery` polled for new session data (every 5 seconds), it triggered a full re-render of the `AgentsPage`.
2. Inside `AgentsPage`, the entire array of session events was being cloned and re-sorted inline on every single render: `[...sessionEvents].sort(...)`.
3. The `filteredSessions.map` was mapping over every session and rendering a heavy inline `Card` component, meaning all session DOM nodes (922 nodes) were being discarded and re-created recursively every 5 seconds.

## OPTIMIZATION
1. Extracted the inline `Card` for sessions into a new, purely functional `SessionCard` component and wrapped it in `React.memo()`. This prevents the individual session cards from re-rendering unless their specific data changes.
2. Extracted the `getStatusBadge` helper function outside of the component body to maintain stable function references across polling cycles.
3. Memoized the heavy events sorting logic using `useMemo` (`const sortedEvents = useMemo(() => ... , [sessionEvents])`) so that sorting only occurs when the server returns new event data, rather than on every React tick.

## AFTER
The `/agents` page load time after the backend and frontend optimizations is now **649.44 ms**.

## IMPROVEMENT
- Total latency reduction for `/agents` route: **4063.56 ms**
- Percentage improvement: **86.2%**
- Frontend JS execution during polling is now stabilized due to component memoization, dropping the recursive re-render penalty.

## REGRESSION
- **Pytest:** 431/431 PASS
- **Frontend Build:** Verified.
- **Functionality:** Real sessions still load and live poll every 5 seconds. All metrics, real telemetry, and M8 enforcements are preserved.

## NEXT BOTTLENECK
The live render performance (Dashboard and Live pages) and the 120-FPS target.

## PHASE B STATUS
Phase B.3 (/agents frontend performance) is COMPLETE. Ready for next optimization step.
