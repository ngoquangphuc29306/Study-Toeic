import React from 'react';
import { AlertTriangle, Check, CheckCircle2, XCircle } from 'lucide-react';
import type { SelectAllQuestion, SynonymPracticeResult } from '../../types';
import { normalizeSynonym } from '../../utils/normalizeSynonym';
import { useSynonymPracticeSession } from '../../hooks/useSynonymPracticeSession';
import { SynonymSessionHeader } from '../SynonymSessionHeader';

interface SelectAllSynonymsSessionProps { questions: SelectAllQuestion[]; onComplete: (result: SynonymPracticeResult) => void; onExit: () => void; }

export function SelectAllSynonymsSession({ questions, onComplete, onExit }: SelectAllSynonymsSessionProps) {
  const session = useSynonymPracticeSession({ mode: 'select-all', totalQuestions: questions.length, onComplete });
  const question = questions[session.questionIndex];
  const [selected, setSelected] = React.useState<string[]>([]);
  const [submitted, setSubmitted] = React.useState(false);

  if (!question) return null;
  const expected = new Set(question.correctAnswers.map(normalizeSynonym));
  const actual = new Set(selected.map(normalizeSynonym));
  const isCorrect = submitted && expected.size === actual.size && [...expected].every((answer) => actual.has(answer));

  const submit = () => {
    if (submitted) return;
    setSubmitted(true);
    session.recordAnswer({ vocabularyId: question.item.vocabularyId, word: question.item.word, userAnswers: selected, correctAnswers: question.correctAnswers, isCorrect: expected.size === actual.size && [...expected].every((answer) => actual.has(answer)) });
  };

  const next = () => { if (!submitted) return; setSelected([]); setSubmitted(false); session.next(); };

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <SynonymSessionHeader title={`Chọn tất cả${question.item.topicName ? ` (${question.item.topicName})` : ''}`} current={session.questionIndex + 1} total={questions.length} tone="indigo" score={session.score} onExit={onExit} />
      <div className="space-y-6 rounded-3xl border border-indigo-100 bg-white p-5 shadow-sm sm:p-8">
        <div className="space-y-2 border-b border-indigo-100 py-4 text-center"><span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-600">Chọn đủ synonym đúng</span><h2 className="mt-2 text-3xl font-black tracking-tight text-[#4A4544] sm:text-4xl">{question.item.word}</h2><p className="text-sm font-semibold text-[#77716F]">{question.item.meaning}</p><p className="pt-1 text-xs font-bold text-indigo-700">Tích chọn tất cả các đáp án đúng bên dưới.</p></div>
        <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Các lựa chọn synonym">{question.options.map((option) => { const isSelected = selected.includes(option.label); const isCorrectOption = submitted && option.isCorrect && isSelected; const isMissingOption = submitted && option.isCorrect && !isSelected; const isWrongOption = submitted && !option.isCorrect && isSelected; const optionClass = isCorrectOption ? 'border-emerald-500 bg-emerald-50 text-emerald-950' : isMissingOption ? 'border-amber-400 bg-amber-50 text-amber-950' : isWrongOption ? 'border-rose-500 bg-rose-50 text-rose-950' : submitted ? 'border-slate-200 bg-slate-50 text-slate-400 opacity-70' : isSelected ? 'border-indigo-500 bg-indigo-50 text-indigo-950' : 'border-slate-200 bg-white text-[#5C635D] hover:border-indigo-300 hover:bg-slate-50'; return <button type="button" key={option.id} disabled={submitted} aria-pressed={isSelected} onClick={() => setSelected((current) => isSelected ? current.filter((value) => value !== option.label) : [...current, option.label])} className={`flex min-h-14 items-center justify-between gap-3 rounded-2xl border p-4 text-left text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${optionClass}`}><span className="flex items-center gap-3"><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs ${isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white'}`}>{isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" aria-hidden="true" />}</span><span>{option.label}</span></span>{isCorrectOption && <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700"><CheckCircle2 className="h-3 w-3" aria-hidden="true" /> ĐÚNG</span>}{isMissingOption && <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700"><AlertTriangle className="h-3 w-3" aria-hidden="true" /> BỎ SÓT</span>}{isWrongOption && <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700"><XCircle className="h-3 w-3" aria-hidden="true" /> SAI</span>}</button>; })}</div>
        {submitted && <div className={`rounded-2xl border p-4 text-xs font-bold ${isCorrect ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-indigo-100 bg-indigo-50 text-indigo-900'}`}>{isCorrect ? <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Chính xác 100%.</p> : <><p className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" /> Xem lại các lựa chọn màu vàng và đỏ.</p><p className="mt-2 font-semibold">Trọn bộ synonym: <span className="font-extrabold">{question.correctAnswers.join(', ')}</span></p></>}</div>}
        <button type="button" disabled={!submitted && selected.length === 0} onClick={submitted ? next : submit} className="w-full rounded-2xl bg-indigo-600 px-5 py-3.5 text-sm font-extrabold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">{submitted ? (session.questionIndex + 1 === questions.length ? 'Xem kết quả' : 'Câu tiếp theo') : `Xác nhận đáp án (${selected.length} từ)`}</button>
      </div>
    </section>
  );
}
