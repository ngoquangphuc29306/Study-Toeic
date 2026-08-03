export const motionTokens = {
  duration: {
    instant: 0.12,
    fast: 0.18,
    normal: 0.28,
    slow: 0.4,
    celebration: 0.6,
  },
  distance: {
    small: 4,
    medium: 8,
    large: 16,
  },
  ease: {
    standard: 'power2.out',
    emphasized: 'power3.out',
  },
} as const;
