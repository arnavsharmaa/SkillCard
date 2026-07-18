import React from 'react';

// Distinct line-art renders so a judge can tell the three machines apart at a
// glance. type: 'humanoid' | 'quadruped' | 'arm'. Inherits currentColor.
export default function RobotAvatar({ type = 'humanoid', size = 44, className = '' }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 64 64',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.4,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  if (type === 'quadruped') {
    // Spot-style quadruped inspector.
    return (
      <svg {...common} className={className} aria-label="quadruped robot">
        <rect x="16" y="22" width="30" height="14" rx="4" />
        <path d="M46 26h7l3 4" />
        <circle cx="53" cy="27.5" r="1.6" fill="currentColor" stroke="none" />
        <path d="M20 36l-4 12M28 36l-2 12M38 36l2 12M44 36l5 12" />
        <path d="M16 25l-5-3" />
      </svg>
    );
  }

  if (type === 'arm') {
    // Fixed-base 6DOF arm with a gripper.
    return (
      <svg {...common} className={className} aria-label="robot arm">
        <path d="M18 54h20" />
        <path d="M28 54v-9" />
        <circle cx="28" cy="43" r="3" fill="currentColor" stroke="none" />
        <path d="M28 41l9-11" />
        <circle cx="38" cy="29" r="3" fill="currentColor" stroke="none" />
        <path d="M40 27l6-6" />
        <path d="M46 21l3-3M46 21l-1 4M49 18l3 1M45 25l3 2" />
      </svg>
    );
  }

  // Humanoid (default).
  return (
    <svg {...common} className={className} aria-label="humanoid robot">
      <rect x="23" y="10" width="18" height="14" rx="5" />
      <circle cx="29" cy="17" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="35" cy="17" r="1.7" fill="currentColor" stroke="none" />
      <path d="M32 24v4" />
      <rect x="24" y="28" width="16" height="16" rx="4" />
      <path d="M24 31l-6 9M40 31l6 9" />
      <path d="M28 44l-2 10M36 44l2 10" />
    </svg>
  );
}
