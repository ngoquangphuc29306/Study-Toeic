'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, Save } from 'lucide-react';
import type { ToeicLearningVocabularyContent, ToeicLearningVocabularyItem } from '../learningContracts';

export interface ToeicLearningContentValues {
  explanationEn: string | null;
  explanationVi: string | null;
  aiExplanation: string | null;
  transcript: string | null;
  translation: string | null;
  vocabulary: ToeicLearningVocabularyContent | null;
}

function LearningSection({ label, children, defaultOpen = true }: { label: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-[#FCE7F3] pt-3 first:border-t-0 first:pt-0">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex min-h-10 w-full items-center justify-between gap-3 text-left text-sm font-extrabold text-[#493B42] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]">
        <span>{label}</span>
        <ChevronDown className={`h-4 w-4 text-[#F472B6] transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && <div className="mt-2 text-sm leading-7 text-gray-700">{children}</div>}
    </div>
  );
}

export function ToeicLearningContentPanel({
  explanationEn,
  explanationVi,
  aiExplanation,
  transcript,
  translation,
  vocabulary,
  onSaveVocabulary,
}: ToeicLearningContentValues & { onSaveVocabulary?: (item: ToeicLearningVocabularyItem) => void }) {
  const hasVocabulary = Boolean(vocabulary && (vocabulary.items.length > 0 || vocabulary.raw));
  if (!explanationEn && !explanationVi && !aiExplanation && !transcript && !translation && !hasVocabulary) return null;

  return (
    <section className="mt-4 rounded-2xl border border-[#FCE7F3] bg-[#FFF9FB] p-4" aria-label="Nội dung học thêm">
      <div className="space-y-3">
        {(explanationVi || explanationEn) && <LearningSection label="Giải thích">
          {explanationVi && <p className="whitespace-pre-wrap">{explanationVi}</p>}
          {explanationEn && <p className="mt-2 whitespace-pre-wrap text-gray-500">{explanationEn}</p>}
        </LearningSection>}
        {aiExplanation && <LearningSection label="Giải thích bổ sung từ AI">
          <p className="whitespace-pre-wrap">{aiExplanation}</p>
        </LearningSection>}
        {transcript && <LearningSection label="Transcript">
          <p className="whitespace-pre-wrap">{transcript}</p>
        </LearningSection>}
        {translation && <LearningSection label="Bản dịch">
          <p className="whitespace-pre-wrap">{translation}</p>
        </LearningSection>}
        {hasVocabulary && vocabulary && <LearningSection label="Từ vựng">
          <ul className="space-y-2" aria-label="Danh sách từ vựng">
            {vocabulary.items.map((item) => <li key={`${item.word}-${item.partOfSpeech ?? ''}`} className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-white p-3">
              <div className="min-w-0">
                <p className="font-extrabold text-[#493B42]">{item.word}</p>
                {(item.partOfSpeech || item.meaningVi) && <p className="text-gray-600">{[item.partOfSpeech, item.meaningVi].filter(Boolean).join(' · ')}</p>}
              </div>
              {onSaveVocabulary && <button type="button" onClick={() => onSaveVocabulary(item)} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-[#FBCFE8] bg-white px-3 text-xs font-bold text-[#9D174D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]">
                <Save className="h-4 w-4" aria-hidden="true" /> Lưu từ
              </button>}
            </li>)}
          </ul>
          {vocabulary.items.length === 0 && vocabulary.raw && <p className="whitespace-pre-wrap">{vocabulary.raw}</p>}
        </LearningSection>}
      </div>
    </section>
  );
}
