import React from 'react';

// Minimal SVG line chart. Inherits currentColor for the stroke. Fills a faint
// area under the line. Expects an array of numbers.
export default function Sparkline({ points, width = 220, height = 44, className = '' }) {
  if (!points || points.length < 2) {
    return <div className="text-[11px] text-muted">Run a couple of tasks to see the trend.</div>;
  }
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const stepX = width / (points.length - 1);
  const xy = points.map((p, i) => [i * stepX, height - ((p - min) / range) * height]);
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `0,${height} ${line} ${width},${height}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} preserveAspectRatio="none">
      <polygon points={area} fill="currentColor" fillOpacity="0.12" />
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {xy.length > 0 && (
        <circle cx={xy[xy.length - 1][0]} cy={xy[xy.length - 1][1]} r="2.5" fill="currentColor" />
      )}
    </svg>
  );
}
