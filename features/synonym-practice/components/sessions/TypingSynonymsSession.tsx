import React from 'react';
import { CheckCircle2, Keyboard, XCircle } from 'lucide-react';
import type { SynonymPracticeItem, SynonymPracticeResult } from '../../types';
import { normalizeSynonym } from '../../utils/normalizeSynonym';
import { useSynonymPracticeSession } from '../../hooks/useSynonymPracticeSession';
import { SynonymSessionHeader } from '../SynonymSessionHeader';

interface TypingSynonymsSessionProps { items: SynonymPracticeItem[]; onComplete: (result: SynonymPracticeResult) => void; onExit: () => void; }

export function TypingSynonymsSession({ items, onComplete, onExit }: TypingSynonymsSessionProps) {
  const session = useSynonymPracticeSession({ mode: 'typing', totalQuestions: items.length, onComplete });
  const item = items[session.questionIndex];
  const [value, setValue] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);
  if (!item) return null;
  const isCorrect = submitted && item.synonyms.includes(normalizeSynonym(value));

  const submit = () => {
    if (submitted || !value.trim()) return;
    const answer = normalizeSynonym(value);
    const correct = item.synonyms.includes(answer);
    setSubmitted(true);
    session.recordAnswer({ vocabularyId: item.vocabularyId, word: item.word, userAnswers: [answer], correctAnswers: item.synonyms, isCorrect: correct });
  };

  const next = () => { if (!submitted) return; setValue(''); setSubmitted(false); session.next(); };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => { if (event.key === 'Enter') { event.preventDefault(); if (submitted) next(); else submit(); } };

  return (
    <section className="mx-auto max-w-xl space-y-6">
      <SynonymSessionHeader title={`Nhập đáp án${item.topicName ? ` (${item.topicName})` : ''}`} current={session.questionIndex + 1} total={items.length} tone="amber" score={session.score} onExit={onExit} />
      <div className="space-y-6 rounded-3xl border border-[#FCE7F3] bg-white p-5 shadow-sm sm:p-8">
        <div className="space-y-2 border-b border-[#FCE7F3] py-4 text-center"><span className="text-xs font-bold text-[#A39A98]">Nhập một từ đồng nghĩa với</span><h2 className="text-3xl font-black tracking-tight text-[#F472B6] sm:text-4xl">{item.word}</h2><div className="flex flex-wrap items-center justify-center gap-2 text-xs text-[#77716F]">{item.ipa && <span>{item.ipa}</span>}{item.ipa && <span aria-hidden="true">•</span>}<span className="font-bold text-[#5C635D]">{item.meaning}</span></div></div>
        <label className="block text-xs font-extrabold text-[#4A4544]">Câu trả lời<input autoFocus value={value} disabled={submitted} onChange={(event) => setValue(event.target.value)} onKeyDown={handleKeyDown} className="mt-2 w-full rounded-2xl border border-[#FCE7F3] bg-[#FFF9FA] px-4 py-3.5 text-base font-bold text-[#4A4544] outline-none transition placeholder:text-[#B8AEB0] focus:border-[#F472B6] focus:bg-white focus:ring-2 focus:ring-pink-100" placeholder="Nhập câu trả lời..." aria-describedby="typing-hint" /></label>
        <p id="typing-hint" className="flex items-center gap-1.5 text-xs text-[#91898A]"><Keyboard className="h-3.5 w-3.5" aria-hidden="true" /> Enter để kiểm tra, Enter lần nữa để sang câu tiếp theo.</p>
        {!submitted && <button type="button" disabled={!value.trim()} onClick={submit} className="w-full rounded-2xl bg-slate-800 px-5 py-3.5 text-xs font-extrabold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]">Kiểm tra đáp án</button>}
        {submitted && <div className={`space-y-2 rounded-2xl border p-4 ${isCorrect ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}><p className={`flex items-center gap-2 text-xs font-extrabold ${isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>{isCorrect ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <XCircle className="h-4 w-4" aria-hidden="true" />}{isCorrect ? 'Chính xác! Rất tốt.' : 'Chưa chính xác.'}</p><p className="text-xs text-[#5C635D]">Các đáp án chấp nhận: <strong className="text-[#4A4544]">{item.synonyms.join(', ')}</strong></p><button type="button" onClick={next} className="mt-2 w-full rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]">{session.questionIndex + 1 === items.length ? 'Xem kết quả' : 'Câu tiếp theo'}</button></div>}
      </div>
    </section>
  );
}
