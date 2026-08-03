'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  HelpCircle, 
  CheckCircle2, 
  XCircle, 
  ArrowLeft, 
  RotateCw, 
  Award, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Vocabulary, Topic, QuizQuestion } from '../lib/types';
import gsap from 'gsap';
import { motionTokens } from '../lib/animation/motionTokens';
import { usePrefersReducedMotion } from '../hooks/use-prefers-reduced-motion';

interface QuizModeProps {
  vocabularies: Vocabulary[];
  topics: Topic[];
  selectedTopicId: string;
  onUpdateProgress: (vocabId: string, status: 'learning' | 'mastered') => void;
  onBackToDashboard: () => void;
  onSwitchToFlashcards: (topicId: string) => void;
}

// Helper to generate question pool
function createQuestionsForTopic(topicId: string, allVocabs: Vocabulary[]): QuizQuestion[] {
  const pool = topicId === 'all' 
    ? allVocabs 
    : allVocabs.filter((v) => v.topic_id === topicId);

  if (!pool || pool.length < 2) {
    return [];
  }

  // Shuffle pool
  const shuffledPool = [...pool].sort(() => 0.5 - Math.random());
  const sampleSize = Math.min(10, shuffledPool.length);
  const selectedVocabs = shuffledPool.slice(0, sampleSize);

  return selectedVocabs.map((vocab) => {
    const types: ('word-to-meaning' | 'meaning-to-word' | 'fill-example')[] = ['word-to-meaning', 'meaning-to-word'];
    if (vocab.example && vocab.example.toLowerCase().includes(vocab.word.toLowerCase())) {
      types.push('fill-example');
    }
    const questionType = types[Math.floor(Math.random() * types.length)];

    const distractors = allVocabs
      .filter((v) => v.id !== vocab.id)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);

    let options: string[] = [];
    let correctAnswerIndex = 0;
    let promptText = '';

    if (questionType === 'word-to-meaning') {
      promptText = `Nghĩa Tiếng Việt chính xác của từ "${vocab.word}" là gì?`;
      const choices = [vocab.meaning, ...distractors.map((d) => d.meaning)];
      const shuffledChoices = choices.map((value) => ({ value, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map((item) => item.value);

      options = shuffledChoices;
      correctAnswerIndex = shuffledChoices.indexOf(vocab.meaning);
    } else if (questionType === 'meaning-to-word') {
      promptText = `Từ Tiếng Anh nào mang nghĩa: "${vocab.meaning}"?`;
      const choices = [vocab.word, ...distractors.map((d) => d.word)];
      const shuffledChoices = choices.map((value) => ({ value, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map((item) => item.value);

      options = shuffledChoices;
      correctAnswerIndex = shuffledChoices.indexOf(vocab.word);
    } else {
      const maskedExample = (vocab.example || vocab.word).replace(
        new RegExp(vocab.word, 'gi'),
        '______'
      );
      promptText = `Điền từ thích hợp vào chỗ trống: "${maskedExample}"`;
      const choices = [vocab.word, ...distractors.map((d) => d.word)];
      const shuffledChoices = choices.map((value) => ({ value, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map((item) => item.value);

      options = shuffledChoices;
      correctAnswerIndex = shuffledChoices.indexOf(vocab.word);
    }

    return {
      vocabulary: vocab,
      options,
      correctAnswerIndex,
      questionType,
      promptText,
    };
  });
}

export const QuizMode: React.FC<QuizModeProps> = ({
  vocabularies,
  topics,
  selectedTopicId,
  onUpdateProgress,
  onBackToDashboard,
  onSwitchToFlashcards,
}) => {
  const [filterTopic, setFilterTopic] = useState<string>(selectedTopicId || 'all');
  const [questions, setQuestions] = useState<QuizQuestion[]>(() =>
    createQuestionsForTopic(selectedTopicId || 'all', vocabularies)
  );

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [quizFinished, setQuizFinished] = useState<boolean>(false);
  const [incorrectItems, setIncorrectItems] = useState<Vocabulary[]>([]);
  const currentQ = questions[currentQuestionIndex];
  const quizRef = useRef<HTMLDivElement>(null);
  const completionRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!isAnswered || selectedOptionIndex === null || !currentQ || !quizRef.current) return;

    const ctx = gsap.context(() => {
      const selectedOption = quizRef.current?.querySelector<HTMLElement>(
        `[data-quiz-option="${selectedOptionIndex}"]`
      );
      const feedback = quizRef.current?.querySelector<HTMLElement>('[data-quiz-feedback]');
      if (!selectedOption || !feedback) return;

      if (prefersReducedMotion) {
        gsap.set([selectedOption, feedback], { clearProps: 'all' });
        return;
      }

      const isCorrect = selectedOptionIndex === currentQ.correctAnswerIndex;
      const timeline = gsap.timeline({
        defaults: {
          duration: motionTokens.duration.instant,
          ease: motionTokens.ease.standard,
        },
      });

      if (isCorrect) {
        timeline.fromTo(
          selectedOption,
          { scale: 0.985 },
          { scale: 1, duration: motionTokens.duration.fast }
        );
      } else {
        timeline
          .to(selectedOption, { x: -4 })
          .to(selectedOption, { x: 4 })
          .to(selectedOption, { x: 0 });
      }

      timeline.fromTo(
        feedback,
        { autoAlpha: 0, y: motionTokens.distance.small },
        { autoAlpha: 1, y: 0, duration: motionTokens.duration.fast },
        '<'
      );
    }, quizRef);

    return () => ctx.revert();
  }, [currentQ, isAnswered, prefersReducedMotion, selectedOptionIndex]);

  useEffect(() => {
    if (!quizFinished || !completionRef.current) return;

    const ctx = gsap.context(() => {
      const targets = completionRef.current?.querySelectorAll<HTMLElement>('[data-quiz-completion-item]');
      if (!targets) return;

      if (prefersReducedMotion) {
        gsap.set(targets, { clearProps: 'all' });
        return;
      }

      gsap.timeline({
        defaults: {
          duration: motionTokens.duration.normal,
          ease: motionTokens.ease.emphasized,
        },
      })
        .fromTo(targets[0], { autoAlpha: 0, scale: 0.96 }, { autoAlpha: 1, scale: 1 })
        .fromTo(
          Array.from(targets).slice(1),
          { autoAlpha: 0, y: motionTokens.distance.small },
          { autoAlpha: 1, y: 0, stagger: 0.05 },
          '-=0.12'
        );
    }, completionRef);

    return () => ctx.revert();
  }, [prefersReducedMotion, quizFinished]);

  const handleTopicChange = (newTopicId: string) => {
    setFilterTopic(newTopicId);
    setCurrentQuestionIndex(0);
    setSelectedOptionIndex(null);
    setIsAnswered(false);
    setScore(0);
    setQuizFinished(false);
    setIncorrectItems([]);
    setQuestions(createQuestionsForTopic(newTopicId, vocabularies));
  };

  const restartQuiz = () => {
    setCurrentQuestionIndex(0);
    setSelectedOptionIndex(null);
    setIsAnswered(false);
    setScore(0);
    setQuizFinished(false);
    setIncorrectItems([]);
    setQuestions(createQuestionsForTopic(filterTopic, vocabularies));
  };

  // Handle Option Select
  const handleSelectOption = (index: number) => {
    if (isAnswered || !currentQ) return;

    setSelectedOptionIndex(index);
    setIsAnswered(true);

    const isCorrect = index === currentQ.correctAnswerIndex;

    if (isCorrect) {
      setScore((prev) => prev + 1);
      onUpdateProgress(currentQ.vocabulary.id, 'mastered');
    } else {
      setIncorrectItems((prev) => [...prev, currentQ.vocabulary]);
      onUpdateProgress(currentQ.vocabulary.id, 'learning');
    }
  };

  const handleNextQuestion = useCallback(() => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedOptionIndex(null);
      setIsAnswered(false);
    } else {
      setQuizFinished(true);
      try {
        if (!prefersReducedMotion) {
          confetti({
            particleCount: 120,
            spread: 80,
            origin: { y: 0.5 },
            colors: ['#F472B6', '#10B981', '#F59E0B', '#6366F1'],
          });
        }
      } catch {
        // Fallback if confetti fails
      }
    }
  }, [currentQuestionIndex, questions.length, prefersReducedMotion]);

  const poolVocabs = filterTopic === 'all' 
    ? vocabularies 
    : vocabularies.filter((v) => v.topic_id === filterTopic);

  if (!poolVocabs || poolVocabs.length < 2 || questions.length === 0) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white rounded-3xl border border-pink-100 text-center space-y-4">
        <HelpCircle className="w-12 h-12 text-pink-300 mx-auto" />
        <h3 className="font-bold text-lg text-gray-800">Cần ít nhất 2 từ vựng để tạo bài Quiz</h3>
        <p className="text-xs text-gray-500">Hãy thêm nhiều từ vựng hơn hoặc chọn &quot;Tất cả bài học&quot; để luyện tập.</p>
        <button
          onClick={onBackToDashboard}
          className="px-4 py-2 bg-pink-500 text-white font-bold rounded-xl text-sm cursor-pointer"
        >
          Quay về Dashboard
        </button>
      </div>
    );
  }

  // Finished Screen
  if (quizFinished) {
    const totalQ = questions.length;
    const scorePercent = Math.round((score / totalQ) * 100);

    return (
      <div ref={completionRef} className="max-w-2xl mx-auto my-8 p-8 bg-white rounded-3xl border border-pink-100 shadow-lg text-center space-y-6">
        <div data-quiz-completion-item className="w-20 h-20 mx-auto bg-gradient-to-tr from-rose-400 to-pink-500 rounded-3xl flex items-center justify-center text-white shadow-md">
          <Award className="w-10 h-10" />
        </div>

        <div data-quiz-completion-item className="space-y-2">
          <span className="px-3 py-1 rounded-full bg-pink-100 text-pink-700 text-xs font-bold uppercase tracking-wide">
            Kết Quả Bài Quiz
          </span>
          <h2 className="text-3xl font-extrabold text-gray-800">
            {scorePercent >= 80 ? 'Xuất Sắc! 🎉' : scorePercent >= 50 ? 'Tốt Lắm! 👏' : 'Cố Gắng Thêm Nhé! 💪'}
          </h2>
          <p className="text-xs sm:text-sm text-gray-500">
            Bạn đã trả lời đúng {score} / {totalQ} câu hỏi ({scorePercent}%)
          </p>
        </div>

        {/* Score Progress Bar */}
        <div data-quiz-completion-item className="w-full h-4 bg-gray-100 rounded-full overflow-hidden p-0.5 border border-gray-200">
          <div
            style={{ width: `${scorePercent}%` }}
            className={`h-full rounded-full transition-all duration-700 ${
              scorePercent >= 80
                ? 'bg-gradient-to-r from-emerald-400 to-teal-500'
                : scorePercent >= 50
                ? 'bg-gradient-to-r from-pink-400 to-rose-500'
                : 'bg-gradient-to-r from-amber-400 to-orange-500'
            }`}
          />
        </div>

        {/* Incorrect items warning */}
        {incorrectItems.length > 0 && (
          <div data-quiz-completion-item className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-left space-y-2">
            <h4 className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
              <XCircle className="w-4 h-4 text-rose-500" />
              Các từ bạn đã làm sai ({incorrectItems.length} từ):
            </h4>
            <div className="flex flex-wrap gap-2 pt-1">
              {incorrectItems.map((item) => (
                <span key={item.id} className="px-2.5 py-1 rounded-lg bg-white border border-rose-200 text-xs font-semibold text-rose-700">
                  {item.word} — {item.meaning}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div data-quiz-completion-item className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={restartQuiz}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-pink-500 hover:bg-pink-600 text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCw className="w-4 h-4" />
            Thử Lại Bài Quiz
          </button>

          <button
            onClick={() => onSwitchToFlashcards(filterTopic)}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200 font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            Luyện Flashcard Từ Này
          </button>

          <button
            onClick={onBackToDashboard}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm transition-all cursor-pointer"
          >
            Về Trang Chủ
          </button>
        </div>
      </div>
    );
  }

  if (!currentQ) return null;

  return (
    <div ref={quizRef} className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* Header controls */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onBackToDashboard}
          className="inline-flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-pink-600 transition-colors bg-white px-3.5 py-2 rounded-xl border border-pink-100 shadow-2xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Dashboard</span>
        </button>

        {/* Topic selector */}
        <select
          value={filterTopic}
          onChange={(e) => handleTopicChange(e.target.value)}
          className="bg-white border border-pink-100 rounded-xl text-xs font-bold px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-300"
        >
          <option value="all">Tất cả chủ đề</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </div>

      {/* Progress header */}
      <div className="bg-white p-4 rounded-2xl border border-pink-100 shadow-2xs space-y-2">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-gray-700">
            Câu hỏi {currentQuestionIndex + 1} / {questions.length}
          </span>
          <span className="text-pink-600">Điểm hiện tại: {score}</span>
        </div>
        <div className="w-full h-2 bg-pink-50 rounded-full overflow-hidden">
          <div
            style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
            className="h-full bg-gradient-to-r from-rose-400 to-pink-500 transition-all duration-300"
          />
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-white rounded-[36px] p-6 sm:p-8 space-y-6 border-2 border-[#FCE7F3] shadow-xs">
        <div className="space-y-2">
          <span className="px-3 py-1 rounded-full bg-[#FFF1F2] text-[#F472B6] text-xs font-bold uppercase tracking-wider">
            Trắc Nghiệm Phản Xạ
          </span>
          <h3 className="text-xl sm:text-2xl font-extrabold text-gray-800 leading-snug pt-1">
            {currentQ.promptText}
          </h3>
        </div>

        {/* 4 Choices Grid */}
        <div className="grid grid-cols-1 gap-3 pt-2">
          {currentQ.options.map((option, idx) => {
            let optionStyle = 'bg-white hover:bg-[#FFF1F2] border-[#FCE7F3] text-gray-700';

            if (isAnswered) {
              if (idx === currentQ.correctAnswerIndex) {
                optionStyle = 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold shadow-2xs';
              } else if (idx === selectedOptionIndex) {
                optionStyle = 'bg-rose-50 border-rose-300 text-rose-800 font-bold';
              } else {
                optionStyle = 'bg-gray-50 border-gray-100 text-gray-400 opacity-60';
              }
            }

            return (
              <button
                key={idx}
                disabled={isAnswered}
                onClick={() => handleSelectOption(idx)}
                data-quiz-option={idx}
                className={`w-full p-4 rounded-2xl border-2 text-left text-sm transition-all flex items-center justify-between cursor-pointer ${optionStyle}`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-xl bg-[#FFF1F2] text-[#F472B6] font-bold flex items-center justify-center text-xs flex-shrink-0">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span>{option}</span>
                </div>

                {isAnswered && idx === currentQ.correctAnswerIndex && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                )}
                {isAnswered && idx === selectedOptionIndex && idx !== currentQ.correctAnswerIndex && (
                  <XCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Explanation Card after answer */}
        {isAnswered && (
          <div data-quiz-feedback className="p-4 rounded-2xl bg-[#FFF1F2] border border-[#FCE7F3] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#F472B6]">Giải Thích Từ Vựng:</span>
              <span className="text-xs font-semibold text-gray-600">
                {currentQ.vocabulary.word} ({currentQ.vocabulary.part_of_speech})
              </span>
            </div>
            <p className="text-sm font-bold text-gray-800">
              👉 Nghĩa: {currentQ.vocabulary.meaning}
            </p>
            {currentQ.vocabulary.example && (
              <p className="text-xs text-gray-600 italic">
                Ví dụ: &ldquo;{currentQ.vocabulary.example}&rdquo;
              </p>
            )}
          </div>
        )}

        {/* Next Question Action Button */}
        {isAnswered && (
          <button
            onClick={handleNextQuestion}
            className="w-full py-3.5 px-6 rounded-2xl bg-[#F472B6] hover:bg-[#ec4899] text-white font-bold text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>
              {currentQuestionIndex < questions.length - 1 ? 'Câu Tiếp Theo' : 'Xem Kết Quả Quiz'}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
