import React from 'react';
import { CheckCircle2, CircleHelp, Sparkles, XCircle } from 'lucide-react';
import type { MultipleChoiceQuestion, SynonymPracticeResult } from '../../types';
import { normalizeSynonym } from '../../utils/normalizeSynonym';
import { useSynonymPracticeSession } from '../../hooks/useSynonymPracticeSession';
import { SynonymSessionHeader } from '../SynonymSessionHeader';

interface MultipleChoiceSessionProps {
  questions: MultipleChoiceQuestion[];
  onComplete: (result: SynonymPracticeResult) => void;
  onExit: () => void;
}

export function MultipleChoiceSession({ questions, onComplete, onExit }: MultipleChoiceSessionProps) {
  const session = useSynonymPracticeSession({ mode: 'multiple-choice', totalQuestions: questions.length, onComplete });
  const question = questions[session.questionIndex];
  const [selected, setSelected] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(false);

  if (!question) return null;
  const isCorrect = submitted && selected ? normalizeSynonym(selected) === normalizeSynonym(question.correctAnswers[0]) : false;

  const submit = () => {
    if (!selected || submitted) return;
    const correct = normalizeSynonym(selected) === normalizeSynonym(question.correctAnswers[0]);
    setSubmitted(true);
    session.recordAnswer({ vocabularyId: question.item.vocabularyId, word: question.item.word, userAnswers: [selected], correctAnswers: question.correctAnswers, isCorrect: correct });
  };

  const next = () => {
    if (!submitted) return;
    setSelected(null);
    setSubmitted(false);
    session.next();
  };

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <SynonymSessionHeader title={`Trắc nghiệm${question.item.topicName ? ` (${question.item.topicName})` : ''}`} current={session.questionIndex + 1} total={questions.length} score={session.score} onExit={onExit} />
      <div className="space-y-6 rounded-3xl border border-[#FCE7F3] bg-white p-5 shadow-sm sm:p-8">
        <div className="space-y-2 border-b border-[#FCE7F3] py-4 text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-[#A39A98]">Từ nào gần nghĩa nhất với</span>
          <h2 className="text-3xl font-black tracking-tight text-[#F472B6] sm:text-4xl">{question.item.word}</h2>
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-[#77716F]">
            {question.item.ipa && <span>{question.item.ipa}</span>}
            {question.item.ipa && <span aria-hidden="true">•</span>}
            <span className="font-bold text-[#5C635D]">{question.item.meaning}</span>
            {question.item.topicName && <span className="rounded-md bg-pink-50 px-2 py-0.5 text-[10px] font-bold text-[#F472B6]">{question.item.topicName}</span>}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Các lựa chọn synonym">
          {question.options.map((option, index) => {
            const optionCorrect = submitted && option.isCorrect;
            const optionWrong = submitted && selected === option.label && !option.isCorrect;
            const badgeClass = optionCorrect ? 'bg-emerald-500 text-white' : optionWrong ? 'bg-rose-500 text-white' : selected === option.label ? 'bg-[#F472B6] text-white' : 'bg-[#FFF1F2] text-[#F472B6]';
            const optionClass = optionCorrect ? 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-100' : optionWrong ? 'border-rose-500 bg-rose-50 text-rose-950 ring-2 ring-rose-100' : submitted ? 'border-slate-200 bg-slate-50 text-slate-400 opacity-70' : selected === option.label ? 'border-[#F472B6] bg-[#FFF1F2] text-[#D95476]' : 'border-[#FCE7F3] bg-white text-[#5C635D] hover:border-[#F472B6] hover:bg-[#FFF9FA]';
            return <button type="button" key={option.id} disabled={submitted} onClick={() => setSelected(option.label)} role="radio" aria-checked={selected === option.label} className={`flex min-h-14 items-center justify-between gap-3 rounded-2xl border p-4 text-left text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] ${optionClass}`}><span className="flex items-center gap-3"><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold ${badgeClass}`}>{String.fromCharCode(65 + index)}</span><span>{option.label}</span></span>{optionCorrect && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />}{optionWrong && <XCircle className="h-5 w-5 shrink-0 text-rose-600" aria-hidden="true" />}{!submitted && !optionCorrect && !optionWrong && <CircleHelp className="h-5 w-5 shrink-0 text-[#D7A1A9]" aria-hidden="true" />}</button>;
          })}
        </div>

        {submitted && <div className="space-y-3 rounded-2xl border border-[#FCE7F3] bg-[#FFF9FA] p-5"><div className="flex items-center gap-2 text-xs font-bold text-[#4A4544]"><Sparkles className="h-4 w-4 text-[#F472B6]" aria-hidden="true" /><span>{isCorrect ? 'Chính xác!' : 'Đáp án cần nhớ'}</span></div><p className="text-xs leading-relaxed text-[#77716F]"><strong className="text-[#4A4544]">{question.correctAnswers[0]}</strong> và <strong className="text-[#4A4544]">{question.item.word}</strong> đều liên quan đến nghĩa <em>{question.item.meaning}</em>.</p><div className="flex justify-end"><button type="button" onClick={next} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#F472B6] to-[#ED4F8E] px-6 py-2.5 text-xs font-extrabold text-white shadow-md shadow-pink-200 transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]">{session.questionIndex + 1 === questions.length ? 'Xem kết quả' : 'Câu tiếp theo'}<span aria-hidden="true">→</span></button></div></div>}
        {!submitted && <button type="button" disabled={!selected} onClick={submit} className="w-full rounded-2xl bg-gradient-to-r from-[#F472B6] to-[#ED4F8E] px-5 py-3.5 text-sm font-extrabold text-white shadow-md shadow-pink-200 transition hover:opacity-95 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:bg-none disabled:text-slate-400 disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]">Kiểm tra đáp án</button>}
      </div>
    </section>
  );
}
