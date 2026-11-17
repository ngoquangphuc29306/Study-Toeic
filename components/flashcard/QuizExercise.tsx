'use client';

import { Check, Volume2, X } from 'lucide-react';
import type { Vocabulary } from '../../lib/types';

interface QuizExerciseProps {
  currentVocab: Vocabulary;
  showPartOfSpeech: boolean;
  quizOptions: string[];
  correctQuizIndex: number;
  selectedQuizIndex: number | null;
  quizAnswered: boolean;
  onPlayPronunciation: (text: string) => void;
  onQuizSelect: (index: number) => void;
}

export function QuizExercise({
  currentVocab, showPartOfSpeech, quizOptions, correctQuizIndex,
  selectedQuizIndex, quizAnswered, onPlayPronunciation, onQuizSelect,
}: QuizExerciseProps) {
  return (
          <div className="space-y-6 animate-fadeIn py-2">
            <div className="text-center space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900">
                {currentVocab.word} {showPartOfSpeech && currentVocab.part_of_speech && <span className="text-sm text-gray-400 font-normal">({currentVocab.part_of_speech})</span>}
              </h2>
              <div className="flex items-center justify-center gap-3">
                {currentVocab.phonetic_us && (
                  <button
                    onClick={() => onPlayPronunciation(currentVocab.word)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#ED4F8E]"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>{currentVocab.phonetic_us}</span>
                  </button>
                )}
              </div>
            </div>

            {/* 4 Choices */}
            <div className="grid grid-cols-1 gap-2.5">
              {quizOptions.map((opt, idx) => {
                let btnStyle = 'bg-white border-[#FCE7F3] text-gray-800 hover:bg-[#FFF5F7]';
                let checkIcon = null;

                if (quizAnswered) {
                  if (idx === correctQuizIndex) {
                    btnStyle = 'bg-[#D1FAE5] border-[#059669] text-[#059669] font-bold';
                    checkIcon = <Check className="w-4 h-4 text-[#059669]" />;
                  } else if (idx === selectedQuizIndex) {
                    btnStyle = 'bg-[#FFE4E6] border-[#E11D48] text-[#E11D48] font-bold';
                    checkIcon = <X className="w-4 h-4 text-[#E11D48]" />;
                  } else {
                    btnStyle = 'bg-gray-50 border-gray-100 text-gray-400 opacity-50';
                  }
                }

                return (
                  <button
                    key={idx}
                    data-flash-quiz-option={idx}
                    disabled={quizAnswered}
                    onClick={() => onQuizSelect(idx)}
                    className={`w-full p-3.5 rounded-2xl border text-left text-xs sm:text-sm transition-all flex items-center justify-between cursor-pointer ${btnStyle}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-xl bg-[#FFF1F2] text-[#ED4F8E] font-extrabold flex items-center justify-center text-xs flex-shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-semibold">{opt}</span>
                    </div>
                    {checkIcon}
                  </button>
                );
              })}
            </div>

            {/* Banner feedback */}
            {quizAnswered && (
              <div data-flash-quiz-feedback className={`p-3.5 rounded-2xl text-center text-xs font-extrabold flex items-center justify-center gap-2 ${
                selectedQuizIndex === correctQuizIndex
                  ? 'bg-[#D1FAE5] text-[#059669]'
                  : 'bg-[#FFE4E6] text-[#E11D48]'
              }`}>
                {selectedQuizIndex === correctQuizIndex ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Chính xác!</span>
                  </>
                ) : (
                  <>
                    <X className="w-4 h-4" />
                    <span>Chưa đúng! Nghĩa đúng: &quot;{currentVocab.meaning}&quot;</span>
                  </>
                )}
              </div>
            )}

            <p className="text-center text-[11px] text-gray-400 font-semibold">
              1 · 2 · 3 · 4 để chọn
            </p>
          </div>
  );
}
