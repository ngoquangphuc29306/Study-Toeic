/**
 * Presentation-only class tokens for the TOEIC CBT reconstruction.
 * These are deliberately scoped to the TOEIC feature so the main application
 * theme stays untouched.
 */
export const toeicPrototype = {
  page: 'min-h-[100dvh] bg-[#FFF9FA] text-slate-800',
  canvas: 'bg-[#FFF9FA]',
  surface: 'border border-[#FCE7F3] bg-white shadow-[0_8px_24px_rgba(236,72,153,0.08)]',
  panel: 'rounded-3xl border border-[#FCE7F3] bg-white shadow-[0_8px_24px_rgba(236,72,153,0.08)]',
  mutedPanel: 'rounded-2xl border border-[#FCE7F3] bg-[#FFF8FA]',
  primaryButton: 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#EC4899] px-4 text-sm font-extrabold text-white shadow-[0_5px_12px_rgba(236,72,153,0.2)] transition-[background-color,transform,box-shadow] duration-200 hover:bg-[#DB2777] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none',
  secondaryButton: 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-pink-200 bg-white px-4 text-sm font-bold text-slate-700 transition-colors duration-200 hover:bg-pink-50 hover:text-pink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none',
  iconButton: 'inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors duration-200 hover:border-pink-200 hover:bg-pink-50 hover:text-pink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none',
  activeTab: 'bg-[#EC4899] text-white shadow-[0_4px_10px_rgba(236,72,153,0.18)]',
  inactiveTab: 'border border-pink-200 bg-white text-slate-600 hover:border-pink-300 hover:bg-pink-50 hover:text-pink-700',
  focusRing: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] focus-visible:ring-offset-2',
} as const;
