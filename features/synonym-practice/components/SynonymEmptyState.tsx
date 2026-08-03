import { BookOpen, PencilLine } from 'lucide-react';

interface SynonymEmptyStateProps {
  onOpenVocabularyManager: () => void;
}

export function SynonymEmptyState({ onOpenVocabularyManager }: SynonymEmptyStateProps) {
  return (
    <section className="rounded-[2rem] border border-[#F9D9DE] bg-white p-8 text-center shadow-sm sm:p-12">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFF1F2] text-[#E96B82]">
        <BookOpen className="h-8 w-8" aria-hidden="true" />
      </div>
      <h2 className="mt-5 text-2xl font-black text-[#4A4544]">Chưa có từ đồng nghĩa</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#77716F]">
        Hãy thêm synonym cho vocabulary trong Quản lý từ vựng để bắt đầu luyện tập.
      </p>
      <button type="button" onClick={onOpenVocabularyManager} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#F472B6] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#E85D9F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] focus-visible:ring-offset-2">
        <PencilLine className="h-4 w-4" aria-hidden="true" />
        Mở Quản lý từ vựng
      </button>
    </section>
  );
}
