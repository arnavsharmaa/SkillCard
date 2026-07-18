import React from 'react';

// Detailed line-art renders so a judge can tell the three machines apart at a
// glance. type: 'humanoid' | 'quadruped' | 'arm'. Inherits currentColor for
// strokes; uses a soft accent fill for body panels and solid dots for "eyes".
export default function RobotAvatar({ type = 'humanoid', size = 44, className = '' }) {
  const svg = {
    width: size,
    height: size,
    viewBox: '0 0 64 64',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
  const panel = { fill: 'currentColor', fillOpacity: 0.12, stroke: 'currentColor' };
  const dot = { fill: 'currentColor', stroke: 'none' };

  if (type === 'quadruped') {
    // Spot-style quadruped inspector.
    return (
      <svg {...svg} className={className} aria-label="quadruped robot">
        {/* legs (behind body) */}
        <path d="M19 37l-3 11M25 38l-1 10M39 38l1 10M45 37l3 11" />
        <path d="M16 48h4M24 48h4M40 48h4M48 48h4" />
        {/* chassis */}
        <rect x="15" y="24" width="32" height="14" rx="5" {...panel} />
        <path d="M22 24v14M40 24v14" strokeOpacity="0.5" />
        {/* head + sensor */}
        <path d="M47 27h7l3 4v3l-3 2h-7" {...panel} />
        <circle cx="53" cy="30.5" r="2" {...dot} />
        {/* rear antenna */}
        <path d="M15 26l-5-4" />
      </svg>
    );
  }

  if (type === 'arm') {
    // Fixed-base 6DOF arm with a gripper reaching for an object.
    return (
      <svg {...svg} className={className} aria-label="robot arm">
        {/* base */}
        <path d="M16 55h22" />
        <path d="M20 55l3-8h10l3 8z" {...panel} />
        {/* segments + joints */}
        <path d="M28 47V34" />
        <circle cx="28" cy="33" r="3.2" {...panel} />
        <path d="M28 31l10-10" />
        <circle cx="39" cy="20" r="3.2" {...panel} />
        {/* gripper */}
        <path d="M41 18l5-5" />
        <path d="M46 13l3-2M46 13l-1 4M49 11l3 2M45 17l3 3" />
        {/* the transparent object it's reaching for */}
        <rect x="50" y="16" width="6" height="9" rx="2" strokeOpacity="0.45" strokeDasharray="2 2" />
      </svg>
    );
  }

  // Humanoid (default) — Atlas-style.
  return (
    <svg {...svg} className={className} aria-label="humanoid robot">
      {/* head with visor */}
      <rect x="22" y="9" width="20" height="15" rx="6" {...panel} />
      <rect x="25" y="14" width="14" height="5" rx="2.5" fill="currentColor" fillOpacity="0.9" stroke="none" />
      <circle cx="29" cy="16.5" r="1.4" fill="#0a0b0e" stroke="none" />
      <circle cx="35" cy="16.5" r="1.4" fill="#0a0b0e" stroke="none" />
      {/* neck */}
      <path d="M32 24v3" />
      {/* torso */}
      <rect x="23" y="27" width="18" height="17" rx="5" {...panel} />
      <circle cx="32" cy="35" r="2.2" {...dot} />
      {/* arms */}
      <path d="M23 30l-6 5v9M41 30l6 5v9" />
      {/* legs */}
      <path d="M28 44v11M36 44v11" />
      <path d="M25 55h5M34 55h5" />
    </svg>
  );
}
