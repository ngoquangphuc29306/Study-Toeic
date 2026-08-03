interface SynonymProgressBarProps {
  current: number;
  total: number;
  label?: string;
  tone?: 'rose' | 'indigo' | 'amber';
  showDetails?: boolean;
}

export function SynonymProgressBar({ current, total, label = 'Tiến độ', tone = 'rose', showDetails = true }: SynonymProgressBarProps) {
  const value = total ? Math.min(100, (current / total) * 100) : 0;
  const toneClasses = {
    rose: 'from-[#F472B6] to-[#ED4F8E]',
    indigo: 'from-[#6366F1] to-[#818CF8]',
    amber: 'from-[#F59E0B] to-[#FBBF24]',
  } as const;

  return (
    <div className="space-y-2" aria-label={`${label}: ${current} trên ${total}`}>
      {showDetails && <div className="flex items-center justify-between text-xs font-bold text-[#77716F]"><span>{label}</span><span>{current}/{total}</span></div>}
      <div className="h-2.5 overflow-hidden rounded-full bg-[#FBE8E8]" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={current}>
        <div className={`h-full rounded-full bg-gradient-to-r ${toneClasses[tone]} transition-[width] duration-500`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
