import type { ToeicTestTakingPassage } from '../readContracts';

export function ToeicPassageRenderer({ passage }: { passage: ToeicTestTakingPassage }) {
  return (
    <section className="rounded-2xl border border-[#FCE7F3] bg-[#FFF8FA] p-4 sm:p-5" aria-labelledby={`passage-${passage.id}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#F472B6]">Đoạn đọc</p>
          <h2 id={`passage-${passage.id}`} className="mt-1 text-base font-extrabold text-[#493B42]">
            {passage.title || passage.passageType || 'Nội dung bài nghe/đọc'}
          </h2>
        </div>
      </div>
      <div className="space-y-4 text-sm leading-7 text-[#5E5057]">
        {passage.content.documents.map((document, index) => (
          <div key={`${passage.id}-${index}`}>
            {document.title && <h3 className="mb-1 font-bold text-[#493B42]">{document.title}</h3>}
            <p className="whitespace-pre-wrap">{document.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
