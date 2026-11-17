'use client';

import type { Ref } from 'react';
import { RotateCw, Volume2 } from 'lucide-react';
import type { Vocabulary } from '../../lib/types';

interface FlashcardExerciseProps {
  currentVocab: Vocabulary;
  isFlipped: boolean;
  showPartOfSpeech: boolean;
  showExamples: boolean;
  showCollocations: boolean;
  showSynonyms: boolean;
  cardTransitionRef: Ref<HTMLDivElement>;
  onFlip: () => void;
  onPlayPronunciation: (text: string, accent?: 'en-US' | 'en-GB') => void;
}

export function FlashcardExercise({
  currentVocab, isFlipped, showPartOfSpeech, showExamples, showCollocations,
  showSynonyms, cardTransitionRef, onFlip, onPlayPronunciation,
}: FlashcardExerciseProps) {
  return (
          <div
            ref={cardTransitionRef}
            key={currentVocab?.id}
            className="relative w-full min-h-[300px] sm:min-h-[320px]"
          >
            <div
            onClick={onFlip}
            className="relative w-full min-h-[300px] sm:min-h-[320px] [perspective:1000px] cursor-pointer select-none group"
            >
              {/* 3D Rotating Container: CSS owns this transform exclusively. */}
              <div
                className={`grid w-full min-h-[300px] sm:min-h-[320px] relative transition-transform duration-500 [transform-style:preserve-3d] ${
                  isFlipped ? '[transform:rotateY(180deg)]' : '[transform:rotateY(0deg)]'
                }`}
              >
              {/* FRONT SIDE */}
              <div className="col-start-1 row-start-1 relative w-full min-h-[300px] sm:min-h-[320px] flex flex-col items-center justify-between text-center p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-[#FFFDFE] via-white to-[#FFF5F7] border border-[#FCE7F3] shadow-xs hover:shadow-md transition-shadow backface-hidden overflow-hidden">
                <div className="space-y-4 my-auto">
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <h2 className="text-3xl sm:text-5xl font-black text-gray-900 tracking-tight break-words max-w-full">
                      {currentVocab.word}
                    </h2>
                    {showPartOfSpeech && currentVocab.part_of_speech && (
                      <span className="text-sm font-semibold text-gray-400 italic">
                        ({currentVocab.part_of_speech})
                      </span>
                    )}
                  </div>

                  {/* Pronunciation phonetics */}
                  <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                    {currentVocab.phonetic_uk && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlayPronunciation(currentVocab.word, 'en-GB');
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#FFF1F2] border border-[#FCE7F3] text-[#ED4F8E] hover:bg-[#FFE4E6] text-xs font-bold transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>UK  {currentVocab.phonetic_uk} </span>
                      </button>
                    )}

                    {currentVocab.phonetic_us && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlayPronunciation(currentVocab.word, 'en-US');
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#FFF1F2] border border-[#FCE7F3] text-[#ED4F8E] hover:bg-[#FFE4E6] text-xs font-bold transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>US  {currentVocab.phonetic_us} </span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="pt-2">
                  <p className="text-xs text-gray-400 font-semibold flex items-center justify-center gap-1.5 animate-pulse bg-white/80 px-3.5 py-1.5 rounded-full border border-[#FCE7F3]">
                    <RotateCw className="w-3 h-3 text-[#ED4F8E]" />
                    Nhấn hoặc chạm để xem nghĩa
                  </p>
                </div>
              </div>

              {/* BACK SIDE */}
              <div className="col-start-1 row-start-1 relative w-full min-h-[300px] sm:min-h-[320px] flex flex-col justify-between text-left p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-[#FFF5F7] via-white to-[#FFF0F5] border border-[#FCE7F3] shadow-xs hover:shadow-md transition-shadow backface-hidden [transform:rotateY(180deg)] overflow-hidden">
                <div className="space-y-4 my-auto w-full">
                  <div className="text-center">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#ED4F8E] bg-[#FFF1F2] px-3 py-1 rounded-full border border-[#FCE7F3]">
                      Nghĩa từ vựng
                    </span>
                    <h3 className="text-2xl sm:text-3xl font-black text-[#ED4F8E] mt-2 break-words">
                      {currentVocab.meaning}
                    </h3>
                  </div>

                  {/* Example box - controlled by showExamples setting */}
                  {showExamples && currentVocab.example && (
                    <div className="p-3.5 rounded-2xl bg-white/90 border border-[#FCE7F3] shadow-2xs space-y-1.5 text-xs">
                      <div className="flex items-start gap-2.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onPlayPronunciation(currentVocab.example || '');
                          }}
                          className="p-1.5 rounded-xl text-white bg-gradient-to-r from-[#ED4F8E] to-[#F472B6] hover:opacity-95 flex-shrink-0 cursor-pointer shadow-2xs mt-0.5 transition-transform hover:scale-105 active:scale-95"
                          title="Nghe câu ví dụ"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                        <div>
                          <p className="font-bold text-gray-900 italic text-sm leading-relaxed break-words">
                            &ldquo;{currentVocab.example}&rdquo;
                          </p>
                          {currentVocab.example_translation && (
                            <p className="text-gray-500 font-medium mt-1">
                              ({currentVocab.example_translation})
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Collocations & Synonyms */}
                  <div className="flex flex-wrap gap-2 text-xs">
                    {showCollocations && currentVocab.collocations && (
                      <span className="px-3 py-1.5 rounded-xl bg-[#E0F2FE] border border-[#BAE6FD] text-[#0284C7] font-bold text-[11px] break-words">
                        {currentVocab.collocations}
                      </span>
                    )}
                    {showSynonyms && currentVocab.synonyms && (
                      <span className="px-3 py-1.5 rounded-xl bg-[#F3E8FF] border border-[#E9D5FF] text-[#A855F7] font-bold text-xs sm:text-sm break-words">
                        Đồng nghĩa: {currentVocab.synonyms}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-center pt-2">
                  <p className="text-[11px] text-gray-400 font-medium">
                    Chạm để xoay về mặt trước
                  </p>
                </div>
              </div>
            </div>
            </div>
          </div>
  );
}
