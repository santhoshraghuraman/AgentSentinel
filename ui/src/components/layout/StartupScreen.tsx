import { useState, useEffect } from 'react';
import { cn } from '../../utils/cn';

export function StartupScreen({ children }: { children: React.ReactNode }) {
  const [showSplash, setShowSplash] = useState(true);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    // Show splash for 1.5 seconds, then fade out for 0.5s
    const timer1 = setTimeout(() => setFade(true), 1500);
    const timer2 = setTimeout(() => setShowSplash(false), 2000);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  return (
    <>
      {showSplash && (
        <div 
          className={cn(
            "fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F4F5FB] motion-safe:transition-opacity duration-500 pointer-events-none",
            fade ? "opacity-0" : "opacity-100"
          )}
        >
          <div className="flex flex-col items-center motion-safe:animate-pulse">
            <img src="/logo-full.png" alt="AgentSentinel Logo" className="w-80 h-auto" />
          </div>
        </div>
      )}
      {/* Render children with stable wrapper to prevent remounting and state loss */}
      <div className={cn("motion-safe:transition-opacity duration-500 h-full", fade || !showSplash ? "opacity-100" : "opacity-0")}>
        {children}
      </div>
    </>
  );
}
