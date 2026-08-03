import { ArrowLeft, Check, Layers3, Play, SlidersHorizontal } from 'lucide-react';
import type { Collection, Topic } from '../../../lib/types';
import type { SynonymPracticeFilters, SynonymPracticeItem, SynonymPracticeMode } from '../types';
import { getEligibleCountByMode } from '../services/synonymPracticeService';

interface SynonymPracticeSetupProps {
  items: SynonymPracticeItem[];
  topics: Topic[];
  collections: Collection[];
  mode: SynonymPracticeMode;
  filters: SynonymPracticeFilters;
  questionCount: number;
  onFiltersChange: (filters: SynonymPracticeFilters) => void;
  onQuestionCountChange: (count: number) => void;
  onStart: () => void;
  onBack: () => void;
}

const modeLabels: Record<SynonymPracticeMode, { title: string; description: string; tone: 'rose' | 'indigo' | 'amber' }> = {
  'multiple-choice': { title: 'Chọn đáp án', description: 'Tìm một synonym đúng trong bốn lựa chọn.', tone: 'rose' },
  matching: { title: 'Nối cặp', description: 'Ghép từ gốc với synonym tương ứng.', tone: 'rose' },
  'select-all': { title: 'Chọn tất cả', description: 'Chọn chính xác toàn bộ synonym đúng.', tone: 'indigo' },
  typing: { title: 'Gõ đáp án', description: 'Tự gõ một synonym bạn nhớ được.', tone: 'amber' },
};

export function SynonymPracticeSetup({ items, topics, collections, mode, filters, questionCount, onFiltersChange, onQuestionCountChange, onStart, onBack }: SynonymPracticeSetupProps) {
  const filteredItems = items.filter((item) => (filters.collectionId === 'all' || item.collectionId === filters.collectionId) && (filters.topicId === 'all' || item.topicId === filters.topicId));
  const eligibleCount = getEligibleCountByMode(mode, filteredItems);
  const selectedCount = mode === 'matching' ? (eligibleCount >= 2 ? 1 : 0) : Math.min(questionCount, eligibleCount);
  const matchingTopics = topics.filter((topic) => filters.collectionId === 'all' || topic.collection_id === filters.collectionId);
  const selectedMode = modeLabels[mode];
  const toneClasses = {
    rose: 'border-[#FCE7F3] bg-[#FFF1F2] text-[#D95476]',
    indigo: 'border-indigo-100 bg-indigo-50 text-indigo-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
  } as const;

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-[#FCE7F3] bg-white px-3 py-2.5 text-sm font-bold text-[#5C635D] transition hover:bg-[#FFF9FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]"><ArrowLeft className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">Thoát</span></button>
        <div><h1 className="text-lg font-extrabold text-[#4A4544] sm:text-xl">Cấu hình phiên luyện tập</h1><p className="text-xs text-[#77716F]">Chọn Section, số câu và bắt đầu mode {selectedMode.title.toLowerCase()}.</p></div>
      </div>

      <div className="rounded-3xl border border-[#FCE7F3] bg-white p-5 shadow-sm sm:p-8">
        <div className="flex items-start gap-3"><div className={`rounded-2xl border p-3 ${toneClasses[selectedMode.tone]}`}><SlidersHorizontal className="h-5 w-5" aria-hidden="true" /></div><div><span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${toneClasses[selectedMode.tone]}`}>{selectedMode.title}</span><p className="mt-2 text-sm text-[#77716F]">{selectedMode.description}</p></div></div>

        <div className="mt-7 space-y-3"><label className="block text-xs font-extrabold text-[#4A4544]">Bộ sưu tập<select value={filters.collectionId} onChange={(event) => onFiltersChange({ collectionId: event.target.value, topicId: 'all' })} className="mt-2 w-full appearance-none rounded-2xl border-2 border-[#FCE7F3] bg-white px-4 py-3 text-xs font-bold text-[#4A4544] outline-none transition focus:border-[#F472B6] focus:ring-2 focus:ring-pink-100"><option value="all">Tất cả bộ sưu tập</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.title}</option>)}</select></label><div><span className="block text-xs font-extrabold text-[#4A4544]">Section / học phần</span><div className="mt-2 flex gap-1.5 overflow-x-auto pb-1"><button type="button" onClick={() => onFiltersChange({ ...filters, topicId: 'all' })} className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-bold transition ${filters.topicId === 'all' ? 'border-[#F472B6] bg-[#F472B6] text-white' : 'border-slate-200 bg-white text-[#5C635D] hover:border-pink-300 hover:bg-[#FFF9FA]'}`}>Tất cả <span className="ml-1 rounded-md bg-black/5 px-1.5 py-0.5">{items.length}</span></button>{matchingTopics.slice(0, 8).map((topic) => <button type="button" key={topic.id} onClick={() => onFiltersChange({ ...filters, topicId: topic.id })} className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-bold transition ${filters.topicId === topic.id ? 'border-[#F472B6] bg-[#F472B6] text-white' : 'border-slate-200 bg-white text-[#5C635D] hover:border-pink-300 hover:bg-[#FFF9FA]'}`}>{topic.title}<span className={`ml-1 rounded-md px-1.5 py-0.5 ${filters.topicId === topic.id ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>{items.filter((item) => item.topicId === topic.id).length}</span></button>)}</div></div></div>

        {mode !== 'matching' && <div className="mt-6 space-y-2 border-t border-[#FCE7F3] pt-5"><span className="block text-xs font-extrabold text-[#4A4544]">Số câu</span><div className="grid grid-cols-3 gap-2">{[10, 20, eligibleCount].filter((value, index, values) => value > 0 && values.indexOf(value) === index).map((value) => <button type="button" key={value} onClick={() => onQuestionCountChange(value)} className={`rounded-2xl border px-3 py-3 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] ${questionCount === value ? 'border-[#F472B6] bg-[#FFF1F2] text-[#D95476] shadow-2xs' : 'border-[#FCE7F3] bg-white text-[#77716F] hover:border-[#F4A8B7]'}`}>{value === eligibleCount && value !== 10 && value !== 20 ? 'Tất cả' : value}</button>)}</div></div>}

        <div className="mt-6 rounded-2xl border border-[#FCE7F3] bg-[#FFF9FA] p-4 text-xs text-[#5C635D]"><div className="mb-2 font-extrabold text-[#4A4544]">Tóm tắt cấu hình</div><div className="flex justify-between gap-4"><span>Mode</span><strong className="text-[#4A4544]">{selectedMode.title}</strong></div><div className="mt-1 flex justify-between gap-4"><span>Vocabulary đủ điều kiện</span><strong className="text-emerald-700">{eligibleCount} từ</strong></div><div className="mt-1 flex justify-between gap-4"><span>Phiên sẽ luyện</span><strong className="text-[#D95476]">{mode === 'matching' ? '1 round' : `${selectedCount} câu`}</strong></div></div>

        <button type="button" disabled={selectedCount < 1 || (mode === 'matching' && eligibleCount < 2)} onClick={onStart} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#F472B6] to-[#ED4F8E] px-5 py-3.5 text-sm font-extrabold text-white shadow-md shadow-pink-200 transition hover:opacity-95 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#E8C8CE] disabled:bg-none disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] focus-visible:ring-offset-2"><Play className="h-4 w-4 fill-current" aria-hidden="true" /> Bắt đầu luyện tập</button>
        {mode === 'matching' && eligibleCount >= 2 && <p className="mt-3 flex items-center justify-center gap-1 text-center text-xs text-[#77716F]"><Check className="h-3.5 w-3.5 text-[#55A681]" aria-hidden="true" /> Round có 4-8 cặp khi đủ dữ liệu.</p>}
      </div>
    </section>
  );
}
