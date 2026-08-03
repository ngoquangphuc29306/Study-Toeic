import { ArrowLeft, Flame } from 'lucide-react';
import { SynonymProgressBar } from './SynonymProgressBar';

interface SynonymSessionHeaderProps {
  title: string;
  current: number;
  total: number;
  tone?: 'rose' | 'indigo' | 'amber';
  score?: number;
  onExit: () => void;
}

export function SynonymSessionHeader({ title, current, total, tone = 'rose', score, onExit }: SynonymSessionHeaderProps) {
  const scoreClasses = {
    rose: 'border-[#FCE7F3] bg-[#FFF1F2] text-[#D95476]',
    indigo: 'border-indigo-100 bg-indigo-50 text-indigo-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
  } as const;

  return (
    <div className="flex items-center justify-between gap-3">
      <button type="button" onClick={onExit} className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl border border-[#FCE7F3] bg-white px-3 py-2.5 text-xs font-bold text-[#5C635D] transition hover:bg-[#FFF9FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Thoát session</span>
      </button>
      <div className="min-w-0 flex-1 max-w-xs space-y-1.5">
        <div className="flex justify-between gap-3 text-xs font-bold text-[#5C635D]">
          <span className="truncate">{title}</span>
          <span className="shrink-0">{current} / {total}</span>
        </div>
        <SynonymProgressBar current={current} total={total} tone={tone} showDetails={false} />
      </div>
      {typeof score === 'number' ? (
        <div className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-extrabold ${scoreClasses[tone]}`}>
          <Flame className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Điểm {score}</span>
        </div>
      ) : <div className="w-7 shrink-0" aria-hidden="true" />}
    </div>
  );
}
