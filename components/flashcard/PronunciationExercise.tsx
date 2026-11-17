'use client';

import { AlertTriangle, Check, Mic, RotateCcw, Volume2, X } from 'lucide-react';
import type { Vocabulary } from '../../lib/types';

interface PronunciationExerciseProps {
  currentVocab: Vocabulary;
  isRecording: boolean;
  pronounceSubmitted: boolean;
  isPronounceCorrect: boolean;
  isPronunciationTechnicalIssue: boolean;
  pronunciationFeedback: { title: string; detail: string };
  transcriptText: string;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onSkip: () => void;
  onPlayPronunciation: (text: string) => void;
}

export function PronunciationExercise({
  currentVocab, isRecording, pronounceSubmitted, isPronounceCorrect,
  isPronunciationTechnicalIssue, pronunciationFeedback, transcriptText,
  onStartRecording, onStopRecording, onSkip, onPlayPronunciation,
}: PronunciationExerciseProps) {
  return (
          <div className="space-y-6 text-center animate-fadeIn py-4">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                PHÁT ÂM TỪ NÀY
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 pt-1">
                {currentVocab.meaning}
              </h2>
            </div>

            <div className="space-y-4 py-2">
              {!isRecording && !pronounceSubmitted && (
                <div className="space-y-3">
                  <button
                    onClick={onStartRecording}
                    className="w-20 h-20 mx-auto rounded-full bg-[#0284C7] hover:bg-[#0369A1] text-white flex items-center justify-center shadow-lg transition-all cursor-pointer hover:scale-105"
                  >
                    <Mic className="w-8 h-8" />
                  </button>
                  <p className="text-xs font-bold text-gray-600">Nhấn để nói</p>
                  <button
                    onClick={onSkip}
                    className="text-xs text-gray-400 hover:text-gray-700 font-medium cursor-pointer"
                  >
                    ▷ Bỏ qua chế độ này
                  </button>
                </div>
              )}

              {isRecording && (
                <div className="space-y-3">
                  <button
                    onClick={onStopRecording}
                    className="w-20 h-20 mx-auto rounded-full bg-[#E11D48] text-white flex items-center justify-center shadow-lg transition-all animate-pulse cursor-pointer"
                  >
                    <div className="w-6 h-6 bg-white rounded-xs" />
                  </button>
                  <p className="text-xs font-bold text-[#E11D48]">
                    Đang nghe... Bấm để dừng
                  </p>
                </div>
              )}

              {pronounceSubmitted && (
                <div className="space-y-4 max-w-md mx-auto">
                  <div className={`p-4 rounded-2xl border text-center space-y-2 ${
                    isPronounceCorrect
                      ? 'bg-[#D1FAE5]/40 border-[#059669] text-[#059669]'
                      : 'bg-[#FFE4E6]/40 border-[#E11D48] text-[#E11D48]'
                  }`}>
                    <div className="flex items-center justify-center gap-2 text-sm font-black">
                      {isPronounceCorrect ? (
                        <>
                          <Check className="w-5 h-5" />
                          <span>Chính xác!</span>
                        </>
                      ) : (
                        <>
                          {isPronunciationTechnicalIssue ? (
                            <AlertTriangle className="w-5 h-5" />
                          ) : (
                            <X className="w-5 h-5" />
                          )}
                          <span>{pronunciationFeedback.title}</span>
                        </>
                      )}
                    </div>
                    {pronunciationFeedback.detail && (
                      <p className="text-xs text-gray-600 font-medium">
                        {pronunciationFeedback.detail}
                      </p>
                    )}
                    <p className="text-lg font-black text-gray-900">
                      {currentVocab.word}
                    </p>
                    {transcriptText && !isPronounceCorrect && (
                      <p className="text-xs text-gray-500 font-medium">
                        Bạn nói: <span className="font-bold text-[#E11D48]">{transcriptText}</span>
                      </p>
                    )}
                    <button
                      onClick={() => onPlayPronunciation(currentVocab.word)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0284C7] hover:underline cursor-pointer pt-1"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Nghe phát âm</span>
                    </button>
                  </div>

                  {!isPronounceCorrect && (
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <button
                        onClick={onStartRecording}
                        className="px-4 py-2 rounded-xl bg-white border border-[#FCE7F3] text-gray-700 font-bold text-xs hover:bg-[#FFF1F2] cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5 inline mr-1" />
                        {isPronunciationTechnicalIssue ? 'Thử lại' : 'Nói lại'}
                      </button>
                      <button
                        onClick={onSkip}
                        className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 font-bold text-xs hover:bg-gray-200 cursor-pointer"
                      >
                        Bỏ qua
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
  );
}
