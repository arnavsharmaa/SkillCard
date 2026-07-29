import React, { useEffect, useRef, useState } from 'react';

// The single most important number in the app. Ticks up when a task completes.
export default function SavingsCounter({ value }) {
  const [display, setDisplay] = useState(value);
  const [delta, setDelta] = useState(null);
  const [ticking, setTicking] = useState(false);
  // Tracks the number currently on screen every frame, so a value change mid-tick
  // (e.g. Reset while ticking) animates from where we actually are — not from a
  // stale target — instead of freezing at a partial value.
  const displayRef = useRef(value);

  useEffect(() => {
    const start = displayRef.current;
    const end = value;
    if (start === end) return;
    if (end > start) setDelta({ amount: end - start, key: Date.now() });
    else setDelta(null); // reset / decrease: clear any lingering "+$" chip
    setTicking(true);
    const dur = 1100;
    const t0 = performance.now();
    let raf;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const cur = Math.round(start + (end - start) * eased);
      displayRef.current = cur;
      setDisplay(cur);
      if (p < 1) raf = requestAnimationFrame(step);
      else {
        displayRef.current = end;
        setTicking(false);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <div className="relative flex flex-col items-end leading-none">
      <span className="text-[11px] sm:text-xs uppercase tracking-[0.24em] text-muted mb-1.5">
        Total saved vs human labor
      </span>
      <span
        className={`savings-number font-mono font-extrabold text-accent tabular-nums text-5xl sm:text-6xl md:text-7xl xl:text-8xl origin-right transition-transform duration-300 ${
          ticking ? 'savings-number-hot scale-[1.04]' : ''
        }`}
      >
        ${display.toLocaleString('en-US')}
      </span>
      {delta && (
        <span
          key={delta.key}
          className="delta-chip absolute right-full top-1/2 mr-4 font-mono font-bold text-accent text-xl sm:text-2xl whitespace-nowrap"
        >
          +${delta.amount.toLocaleString('en-US')}
        </span>
      )}
    </div>
  );
}
