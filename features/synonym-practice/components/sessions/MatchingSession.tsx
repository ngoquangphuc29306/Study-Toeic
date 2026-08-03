import React from 'react';
import { ArrowRight, CheckCircle2, Link2, XCircle } from 'lucide-react';
import type { MatchingQuestion, SynonymPracticeResult } from '../../types';
import { shuffle } from '../../utils/shuffle';
import { useSynonymPracticeSession } from '../../hooks/useSynonymPracticeSession';
import { SynonymSessionHeader } from '../SynonymSessionHeader';

interface MatchingSessionProps { question: MatchingQuestion; onComplete: (result: SynonymPracticeResult) => void; onExit: () => void; }

export function MatchingSession({ question, onComplete, onExit }: MatchingSessionProps) {
  const session = useSynonymPracticeSession({ mode: 'matching', totalQuestions: question.pairs.length, onComplete });
  const [shuffledPairs] = React.useState(() => shuffle(question.pairs));
  const [leftId, setLeftId] = React.useState<string | null>(null);
  const [matched, setMatched] = React.useState<string[]>([]);
  const [wrongId, setWrongId] = React.useState<string | null>(null);

  const chooseRight = (pairId: string) => {
    if (!leftId || matched.includes(pairId)) return;
    if (leftId === pairId) {
      const nextMatched = [...matched, pairId];
      setMatched(nextMatched);
      setLeftId(null);
      if (nextMatched.length === question.pairs.length) {
        question.pairs.forEach((pair) => session.recordAnswer({ vocabularyId: pair.item.vocabularyId, word: pair.item.word, userAnswers: [pair.synonym], correctAnswers: [pair.synonym], isCorrect: true }));
        session.finish();
      }
    } else {
      setWrongId(pairId);
      window.setTimeout(() => { setWrongId(null); setLeftId(null); }, 450);
    }
  };

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <SynonymSessionHeader title="Ghép cặp synonym" current={matched.length} total={question.pairs.length} onExit={onExit} />
      <div className="space-y-6 rounded-3xl border border-[#FCE7F3] bg-white p-5 shadow-sm sm:p-8">
        <p className="text-center text-xs font-medium text-[#77716F]">Chọn một từ ở cột trái, sau đó chọn synonym tương ứng ở cột phải.</p>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="space-y-3"><span className="block text-center text-xs font-bold text-[#A39A98]">Từ vựng gốc</span>{question.pairs.map((pair) => { const isMatched = matched.includes(pair.id); const isSelected = leftId === pair.id; return <button type="button" key={pair.id} disabled={isMatched} aria-pressed={isSelected} onClick={() => setLeftId(pair.id)} className={`flex w-full items-center justify-between rounded-2xl border p-3 text-left text-xs font-extrabold transition sm:p-3.5 sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] ${isMatched ? 'border-emerald-300 bg-emerald-50 text-emerald-800 opacity-75' : isSelected ? 'border-[#F472B6] bg-[#FFF1F2] text-[#D95476] ring-2 ring-pink-100' : 'border-slate-200 bg-white text-[#5C635D] hover:border-[#F472B6]'}`}>{pair.item.word}{isMatched ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Đã ghép đúng" /> : <Link2 className="h-4 w-4 shrink-0 text-[#D7A1A9]" aria-hidden="true" />}</button>; })}</div>
          <div className="space-y-3"><span className="block text-center text-xs font-bold text-[#A39A98]">Từ đồng nghĩa</span>{shuffledPairs.map((pair) => { const isMatched = matched.includes(pair.id); const isWrong = wrongId === pair.id; return <button type="button" key={`${pair.id}-right`} disabled={isMatched} onClick={() => chooseRight(pair.id)} className={`flex w-full items-center justify-between rounded-2xl border p-3 text-left text-xs font-extrabold transition sm:p-3.5 sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] ${isMatched ? 'border-emerald-300 bg-emerald-50 text-emerald-800 opacity-75' : isWrong ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-[#5C635D] hover:border-[#F472B6]'}`}>{pair.synonym}{isMatched ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Đã ghép đúng" /> : <ArrowRight className="h-4 w-4 shrink-0 text-[#D7A1A9]" aria-hidden="true" />}</button>; })}</div>
        </div>
        {wrongId && <p className="flex items-center gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700"><XCircle className="h-4 w-4" aria-hidden="true" /> Chưa đúng, hãy thử lại.</p>}
        {matched.length === question.pairs.length && <p className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Đã ghép đủ tất cả cặp.</p>}
      </div>
    </section>
  );
}
