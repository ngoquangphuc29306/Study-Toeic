'use client';

import type { Ref } from 'react';
import { Check, Lightbulb, X } from 'lucide-react';
import type { Vocabulary } from '../../lib/types';

interface TypingExerciseProps {
  currentVocab: Vocabulary;
  showPartOfSpeech: boolean;
  typedInput: string;
  typingSubmitted: boolean;
  isTypingCorrect: boolean | null;
  showHint: boolean;
  typingInputRef: Ref<HTMLInputElement>;
  typingFeedbackRef: Ref<HTMLDivElement>;
  onTypedInputChange: (value: string) => void;
  onCheckTyping: () => void;
  onToggleHint: () => void;
}

export function TypingExercise({
  currentVocab, showPartOfSpeech, typedInput, typingSubmitted, isTypingCorrect,
  showHint, typingInputRef, typingFeedbackRef, onTypedInputChange, onCheckTyping,
  onToggleHint,
}: TypingExerciseProps) {
  return (
          <div className="space-y-6 text-center animate-fadeIn py-4">
            <div className="space-y-1">
              {showPartOfSpeech && currentVocab.part_of_speech && (
                <span className="px-3 py-1 rounded-full bg-[#FFF1F2] text-[#ED4F8E] text-[11px] font-bold">
                  {currentVocab.part_of_speech}
                </span>
              )}
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 pt-2">
                {currentVocab.meaning}
              </h2>
            </div>

            {/* Input Form */}
            <div className="max-w-md mx-auto space-y-3">
              <div className="relative">
                <input
                  ref={typingInputRef}
                  type="text"
                  placeholder="Gõ từ tiếng Anh..."
                  value={typedInput}
                  disabled={typingSubmitted}
                  onChange={(e) => onTypedInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.defaultPrevented && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && !e.nativeEvent.isComposing && !e.repeat) {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!typingSubmitted) onCheckTyping();
                    }
                  }}
                  className={`w-full p-3.5 pr-12 bg-white border-2 rounded-2xl text-base sm:text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F472B6] transition-all ${
                    typingSubmitted
                      ? isTypingCorrect
                        ? 'border-[#059669] bg-[#D1FAE5]/30'
                        : 'border-[#E11D48] bg-[#FFE4E6]/30'
                      : 'border-[#FCE7F3]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => onToggleHint()}
                  title="Gợi ý ký tự đầu"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-xl text-gray-400 hover:text-[#ED4F8E] hover:bg-[#FFF1F2] cursor-pointer"
                >
                  <Lightbulb className="w-4 h-4" />
                </button>
              </div>

              {showHint && (
                <p className="text-xs text-[#0284C7] font-semibold">
                  Gợi ý: Từ bắt đầu bằng chữ &ldquo;<strong>{currentVocab.word.charAt(0).toUpperCase()}</strong>&rdquo; ({currentVocab.word.length} ký tự)
                </p>
              )}

              {!typingSubmitted ? (
                <button
                  onClick={onCheckTyping}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#ED4F8E] to-[#F472B6] text-white font-bold text-xs shadow-2xs hover:opacity-95 transition-all cursor-pointer"
                >
                  Kiểm tra
                </button>
              ) : (
                <div ref={typingFeedbackRef} className={`p-3.5 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 ${
                  isTypingCorrect ? 'bg-[#D1FAE5] text-[#059669]' : 'bg-[#FFE4E6] text-[#E11D48]'
                }`}>
                  {isTypingCorrect ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Chính xác! {currentVocab.word}</span>
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4" />
                      <span>Chưa đúng! Đáp án đúng: {currentVocab.word}</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <p className="text-[11px] text-gray-400 font-semibold">
              Enter để kiểm tra
            </p>
          </div>
  );
}
