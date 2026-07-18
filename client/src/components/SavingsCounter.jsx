import React, { useEffect, useRef, useState } from 'react';

// The single most important number in the app. Ticks up when a task completes.
export default function SavingsCounter({ value }) {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const start = from.current;
    const end = value;
    if (start === end) return;
    const dur = 900;
    const t0 = performance.now();
    let raf;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = end;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <div className="flex flex-col items-end leading-none">
      <span className="text-[11px] uppercase tracking-[0.2em] text-muted mb-1">
        Total saved vs human labor
      </span>
      <span className="font-mono font-extrabold text-accent tabular-nums text-4xl sm:text-5xl md:text-6xl">
        ${display.toLocaleString('en-US')}
      </span>
    </div>
  );
}
