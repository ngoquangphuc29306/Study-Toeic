'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { BookOpenCheck, Brain, CheckCircle2, Filter, GitCompareArrows, Keyboard, Layers, ListChecks, Play, Sparkles } from 'lucide-react';
import type { Collection, Topic, Vocabulary } from '../../../lib/types';
import { usePrefersReducedMotion } from '../../../hooks/use-prefers-reduced-motion';
import { motionTokens } from '../../../lib/animation/motionTokens';
import type { MatchingQuestion, MultipleChoiceQuestion, SelectAllQuestion, SynonymPracticeFilters, SynonymPracticeItem, SynonymPracticeMode, SynonymPracticeResult } from '../types';
import { buildMatchingQuestion, buildMultipleChoiceQuestions, buildSelectAllQuestions, getFilteredSynonymItems, mapVocabularyToSynonymItems } from '../services/synonymPracticeService';
import { shuffle } from '../utils/shuffle';
import { useToast } from '../../../contexts/ToastContext';
import { SynonymEmptyState } from './SynonymEmptyState';
import { SynonymPracticeResults } from './SynonymPracticeResults';
import { SynonymPracticeSetup } from './SynonymPracticeSetup';
import { MatchingSession } from './sessions/MatchingSession';
import { MultipleChoiceSession } from './sessions/MultipleChoiceSession';
import { SelectAllSynonymsSession } from './sessions/SelectAllSynonymsSession';
import { TypingSynonymsSession } from './sessions/TypingSynonymsSession';

interface SynonymPracticeProps {
  vocabularies: Vocabulary[];
  topics: Topic[];
  collections: Collection[];
  selectedTopicId?: string;
  onOpenEditVocabulary: (vocabulary: Vocabulary) => void;
  onOpenVocabularyManager: () => void;
}

type View = 'home' | 'setup' | 'session' | 'results';

const modes: Array<{
  id: SynonymPracticeMode;
  title: string;
  description: string;
  icon: typeof Brain;
  tone: 'rose' | 'indigo' | 'amber';
  iconClass: string;
  badgeClass: string;
}> = [
  { id: 'multiple-choice', title: 'Chọn đáp án', description: 'Tìm một synonym đúng trong bốn lựa chọn thật.', icon: ListChecks, tone: 'rose', iconClass: 'bg-[#FFF1F2] text-[#F472B6]', badgeClass: 'border-emerald-100 bg-emerald-50 text-emerald-700' },
  { id: 'matching', title: 'Nối cặp', description: 'Ghép từ gốc với synonym tương ứng để luyện phản xạ.', icon: GitCompareArrows, tone: 'rose', iconClass: 'bg-[#FFF1F2] text-[#F472B6]', badgeClass: 'border-emerald-100 bg-emerald-50 text-emerald-700' },
  { id: 'select-all', title: 'Chọn tất cả', description: 'Chọn đủ và chỉ chọn các synonym đúng.', icon: CheckCircle2, tone: 'indigo', iconClass: 'bg-indigo-50 text-indigo-600', badgeClass: 'border-indigo-100 bg-indigo-50 text-indigo-700' },
  { id: 'typing', title: 'Gõ đáp án', description: 'Tự nhớ và gõ một synonym bạn biết.', icon: Keyboard, tone: 'amber', iconClass: 'bg-amber-50 text-amber-600', badgeClass: 'border-amber-100 bg-amber-50 text-amber-700' },
];

export function SynonymPractice({ vocabularies, topics, collections, selectedTopicId = 'all', onOpenEditVocabulary, onOpenVocabularyManager }: SynonymPracticeProps) {
  const { showToast } = useToast();
  const prefersReducedMotion = usePrefersReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const items = useMemo(() => mapVocabularyToSynonymItems(vocabularies, topics, collections), [collections, topics, vocabularies]);
  const initialTopicId = selectedTopicId !== 'all' && items.some((item) => item.topicId === selectedTopicId) ? selectedTopicId : 'all';
  const [view, setView] = useState<View>('home');
  const [mode, setMode] = useState<SynonymPracticeMode>('multiple-choice');
  const [filters, setFilters] = useState<SynonymPracticeFilters>({ collectionId: 'all', topicId: initialTopicId });
  const [questionCount, setQuestionCount] = useState(10);
  const [result, setResult] = useState<SynonymPracticeResult | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const [sessionData, setSessionData] = useState<{ mode: SynonymPracticeMode; items: SynonymPracticeItem[]; multipleChoice?: MultipleChoiceQuestion[]; matching?: MatchingQuestion; selectAll?: SelectAllQuestion[] } | null>(null);

  useEffect(() => {
    if (prefersReducedMotion || !rootRef.current) return;

    const context = gsap.context(() => {
      const timeline = gsap.timeline({ defaults: { ease: motionTokens.ease.standard } });
      timeline
        .fromTo('.synonym-hero', { y: 12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: motionTokens.duration.normal, clearProps: 'transform,opacity,visibility' })
        .fromTo('.synonym-stat', { y: 8, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: motionTokens.duration.fast, stagger: 0.05, clearProps: 'transform,opacity,visibility' }, '-=0.12')
        .fromTo('.synonym-filter, .synonym-mode-card, .synonym-missing', { y: 10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: motionTokens.duration.fast, stagger: 0.05, clearProps: 'transform,opacity,visibility' }, '-=0.08');
    }, rootRef);

    return () => context.revert();
  }, [prefersReducedMotion, view]);

  const filteredItems = useMemo(() => getFilteredSynonymItems(items, filters.collectionId, filters.topicId), [filters, items]);
  const matchingTopics = topics.filter((topic) => filters.collectionId === 'all' || topic.collection_id === filters.collectionId);
  const missingSynonyms = vocabularies.filter((vocabulary) => !items.some((item) => item.vocabularyId === vocabulary.id));
  const sectionsWithSynonyms = new Set(items.map((item) => item.topicId).filter(Boolean)).size;
  const synonymCount = items.reduce((total, item) => total + item.synonyms.length, 0);

  const startSetup = (nextMode: SynonymPracticeMode) => {
    setMode(nextMode);
    setView('setup');
  };

  const startSession = (retryItems?: SynonymPracticeItem[]) => {
    const pool = retryItems || filteredItems;
    let nextData: typeof sessionData = null;

    if (mode === 'multiple-choice') {
      const questions = buildMultipleChoiceQuestions(pool, questionCount);
      if (!questions.length) { showToast('Chưa đủ vocabulary thật để tạo 4 lựa chọn cho mode này.', 'error'); return; }
      nextData = { mode, items: pool, multipleChoice: questions };
    } else if (mode === 'matching') {
      const matching = buildMatchingQuestion(pool, questionCount);
      if (!matching) { showToast('Cần ít nhất 2 vocabulary có synonym để tạo round nối cặp.', 'error'); return; }
      nextData = { mode, items: pool, matching };
    } else if (mode === 'select-all') {
      const questions = buildSelectAllQuestions(pool, questionCount);
      if (!questions.length) { showToast('Chưa đủ vocabulary thật để tạo 6-8 lựa chọn cho mode này.', 'error'); return; }
      nextData = { mode, items: pool, selectAll: questions };
    } else {
      const typingItems = shuffle(pool).slice(0, questionCount);
      if (!typingItems.length) { showToast('Chưa có vocabulary đủ điều kiện cho mode gõ đáp án.', 'error'); return; }
      nextData = { mode, items: typingItems };
    }

    setSessionData(nextData);
    setResult(null);
    setSessionKey((current) => current + 1);
    setView('session');
  };

  const startNewSession = () => { setView('setup'); setResult(null); setSessionData(null); };
  const retryIncorrect = () => {
    if (!result) return;
    const incorrectIds = new Set(result.answers.filter((answer) => !answer.isCorrect).map((answer) => answer.vocabularyId));
    const retryItems = items.filter((item) => incorrectIds.has(item.vocabularyId));
    if (retryItems.length) startSession(retryItems);
  };

  if (items.length === 0) return <div ref={rootRef} className="synonym-entrance"><SynonymEmptyState onOpenVocabularyManager={onOpenVocabularyManager} /></div>;
  if (view === 'setup') return <div ref={rootRef} className="synonym-entrance"><SynonymPracticeSetup items={items} topics={topics} collections={collections} mode={mode} filters={filters} questionCount={questionCount} onFiltersChange={setFilters} onQuestionCountChange={setQuestionCount} onStart={() => startSession()} onBack={() => setView('home')} /></div>;
  if (view === 'results' && result) return <div ref={rootRef} className="synonym-entrance"><SynonymPracticeResults result={result} hasIncorrect={result.answers.some((answer) => !answer.isCorrect)} onRetryIncorrect={retryIncorrect} onNewSession={startNewSession} onHome={() => setView('home')} /></div>;
  if (view === 'session' && sessionData) {
    const onComplete = (nextResult: SynonymPracticeResult) => { setResult(nextResult); setView('results'); };
    if (sessionData.mode === 'multiple-choice' && sessionData.multipleChoice) return <div key={sessionKey} ref={rootRef} className="synonym-entrance"><MultipleChoiceSession questions={sessionData.multipleChoice} onComplete={onComplete} onExit={() => setView('home')} /></div>;
    if (sessionData.mode === 'matching' && sessionData.matching) return <div key={sessionKey} ref={rootRef} className="synonym-entrance"><MatchingSession question={sessionData.matching} onComplete={onComplete} onExit={() => setView('home')} /></div>;
    if (sessionData.mode === 'select-all' && sessionData.selectAll) return <div key={sessionKey} ref={rootRef} className="synonym-entrance"><SelectAllSynonymsSession questions={sessionData.selectAll} onComplete={onComplete} onExit={() => setView('home')} /></div>;
    return <div key={sessionKey} ref={rootRef} className="synonym-entrance"><TypingSynonymsSession items={sessionData.items} onComplete={onComplete} onExit={() => setView('home')} /></div>;
  }

  return (
    <div ref={rootRef} className="space-y-8 pb-12">
      <section className="synonym-hero relative overflow-hidden rounded-3xl border border-[#FCE7F3] bg-white p-5 shadow-md sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-pink-200 to-rose-100 opacity-60 blur-3xl" aria-hidden="true" />
        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FCE7F3] bg-[#FFF1F2] px-3 py-1 text-xs font-bold text-[#F472B6]"><GitCompareArrows className="h-3.5 w-3.5" aria-hidden="true" /> Ôn tập từ đồng nghĩa TOEIC</div>
            <h1 className="text-2xl font-black tracking-tight text-[#4A4544] sm:text-3xl">Luyện từ đồng nghĩa</h1>
            <p className="max-w-xl text-sm leading-relaxed text-[#77716F]">Nhận biết, ghi nhớ và luyện phản xạ với những synonym có trong kho vocabulary thật của bạn.</p>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-2.5 sm:flex-row md:w-auto md:flex-col lg:flex-row">
            <button type="button" onClick={() => startSetup('multiple-choice')} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-gradient-to-r from-[#F472B6] to-[#ED4F8E] px-5 py-3 text-xs font-extrabold text-white shadow-md shadow-pink-200 transition hover:opacity-95 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] focus-visible:ring-offset-2"><Play className="h-4 w-4 fill-current" aria-hidden="true" /> Bắt đầu ôn tập</button>
            <button type="button" onClick={onOpenVocabularyManager} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-[#FCE7F3] bg-white px-4 py-3 text-xs font-extrabold text-[#5C635D] shadow-sm transition hover:bg-[#FFF9FA] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] focus-visible:ring-offset-2"><Layers className="h-4 w-4 text-[#F472B6]" aria-hidden="true" /> Quản lý synonym</button>
          </div>
        </div>
        <div className="relative z-10 mt-8 grid grid-cols-2 gap-3 border-t border-[#FCE7F3] pt-6 sm:grid-cols-4 sm:gap-4">
          <div className="synonym-stat rounded-2xl border border-[#FCE7F3] bg-[#FFF9FA] p-3.5"><span className="mb-1 block text-[11px] font-bold text-[#77716F]">Kho từ đồng nghĩa</span><span className="text-2xl font-black text-[#4A4544]">{items.length}</span><span className="ml-1.5 text-[11px] font-bold text-[#A39A98]">từ</span></div>
          <div className="synonym-stat rounded-2xl border border-[#FCE7F3] bg-[#FFF9FA] p-3.5"><span className="mb-1 block text-[11px] font-bold text-[#77716F]">Tổng synonym</span><span className="text-2xl font-black text-[#F472B6]">{synonymCount}</span><span className="ml-1.5 text-[11px] font-bold text-[#D95476]">cụm</span></div>
          <div className="synonym-stat rounded-2xl border border-[#FCE7F3] bg-[#FFF9FA] p-3.5"><span className="mb-1 block text-[11px] font-bold text-[#77716F]">Học phần</span><span className="text-2xl font-black text-[#4A4544]">{sectionsWithSynonyms}</span><span className="ml-1.5 text-[11px] font-bold text-[#A39A98]">section</span></div>
          <div className="synonym-stat rounded-2xl border border-[#FCE7F3] bg-[#FFF9FA] p-3.5"><span className="mb-1 block text-[11px] font-bold text-[#77716F]">Cần bổ sung</span><span className="text-2xl font-black text-[#D95476]">{missingSynonyms.length}</span><span className="ml-1.5 text-[11px] font-bold text-[#D95476]">từ</span></div>
        </div>
      </section>

      <section className="synonym-filter space-y-4 rounded-3xl border border-[#FCE7F3] bg-white p-5 shadow-sm sm:p-6">
        <div><h2 className="flex items-center gap-2 text-lg font-bold text-[#4A4544]"><Filter className="h-5 w-5 text-[#F472B6]" aria-hidden="true" /> Chọn Section muốn ôn</h2><p className="mt-1 text-xs text-[#77716F]">Lọc trước để các mode phía dưới tập trung đúng nhóm từ bạn cần luyện.</p></div>
        <div className="grid gap-3 md:grid-cols-12 md:items-center">
          <label className="relative block md:col-span-5"><span className="sr-only">Chọn bộ sưu tập</span><select value={filters.collectionId} onChange={(event) => setFilters({ collectionId: event.target.value, topicId: 'all' })} className="w-full appearance-none rounded-2xl border-2 border-[#FCE7F3] bg-white px-4 py-3 text-xs font-bold text-[#4A4544] outline-none transition focus:border-[#F472B6] focus:ring-2 focus:ring-pink-100"><option value="all">Tất cả bộ sưu tập</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.title}</option>)}</select></label>
          <div className="flex gap-1.5 overflow-x-auto pb-1 md:col-span-7" aria-label="Chọn học phần nhanh"><button type="button" onClick={() => setFilters((current) => ({ ...current, topicId: 'all' }))} className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-bold transition ${filters.topicId === 'all' ? 'border-[#F472B6] bg-[#F472B6] text-white' : 'border-slate-200 bg-white text-[#5C635D] hover:border-pink-300 hover:bg-[#FFF9FA]'}`}>Tất cả <span className="ml-1 rounded-md bg-black/5 px-1.5 py-0.5">{items.length}</span></button>{matchingTopics.slice(0, 6).map((topic) => <button type="button" key={topic.id} onClick={() => setFilters((current) => ({ ...current, topicId: topic.id }))} className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-bold transition ${filters.topicId === topic.id ? 'border-[#F472B6] bg-[#F472B6] text-white' : 'border-slate-200 bg-white text-[#5C635D] hover:border-pink-300 hover:bg-[#FFF9FA]'}`}>{topic.title} <span className={`ml-1 rounded-md px-1.5 py-0.5 ${filters.topicId === topic.id ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>{items.filter((item) => item.topicId === topic.id).length}</span></button>)}</div>
        </div>
      </section>

      <section className="space-y-4"><div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-bold text-[#4A4544]"><Sparkles className="h-5 w-5 text-[#F472B6]" aria-hidden="true" /> Chọn mode luyện tập</h2><span className="hidden text-xs font-semibold text-[#77716F] sm:inline">4 cách học</span></div><div className="grid gap-4 md:grid-cols-2">{modes.map(({ id, title, description, icon: Icon, iconClass, badgeClass, tone }) => <article key={id} className="synonym-mode-card group flex flex-col justify-between rounded-3xl border border-[#FCE7F3] bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"><div><div className="mb-3 flex items-center justify-between"><span className={`rounded-2xl p-3 ${iconClass}`}><Icon className="h-6 w-6" aria-hidden="true" /></span><span className={`rounded-full border px-3 py-1 text-xs font-extrabold ${badgeClass}`}>Có dữ liệu</span></div><h3 className="text-base font-bold text-[#4A4544] transition group-hover:text-[#F472B6]">{title}</h3><p className="mt-1 text-xs leading-relaxed text-[#77716F]">{description}</p><div className="mt-4 flex items-center gap-3 text-xs font-medium text-[#A39A98]"><span>{filteredItems.length} từ theo bộ lọc</span><span aria-hidden="true">•</span><span>Trộn một lần</span></div></div><button type="button" onClick={() => startSetup(id)} className={`mt-6 flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] focus-visible:ring-offset-2 ${tone === 'indigo' ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white' : tone === 'amber' ? 'bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white' : 'bg-[#FFF1F2] text-[#F472B6] hover:bg-[#F472B6] hover:text-white'}`}>Thiết lập {title}</button></article>)}</div></section>

      {missingSynonyms.length > 0 && <section className="synonym-missing rounded-3xl border border-dashed border-[#F1BFC8] bg-white/80 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-[#4A4544]">Các từ chưa có synonym</h2><p className="mt-1 text-sm text-[#77716F]">Bổ sung trực tiếp bằng modal sửa vocabulary hiện tại.</p></div><span className="rounded-full border border-[#FCE7F3] bg-[#FFF1F2] px-3 py-1.5 text-xs font-extrabold text-[#D95476]">{missingSynonyms.length} từ</span></div><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{missingSynonyms.slice(0, 6).map((vocabulary) => <div key={vocabulary.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#FFF9FA] px-3 py-2.5"><span className="min-w-0 truncate text-sm font-bold text-[#5C635D]">{vocabulary.word}</span><button type="button" onClick={() => onOpenEditVocabulary(vocabulary)} className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-[#D95476] hover:bg-[#FFF1F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]">Thêm synonym</button></div>)}</div></section>}
    </div>
  );
}
