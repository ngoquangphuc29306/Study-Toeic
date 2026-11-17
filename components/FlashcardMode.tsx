'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Volume2,
  RotateCw,
  CheckCircle2,
  GitCompareArrows,
  BookOpen,
  Award,
  RefreshCw,
  Target,
  Keyboard,
  Mic,
  Settings,
  AlertTriangle,
  X,
  Lightbulb,
  Check,
  RotateCcw,
  Trash2,
  Eye,
  MessageSquare,
  Hash,
  Pencil
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { FlashcardInitialFilter, Vocabulary, Topic } from '../lib/types';
import { SrsRating } from '../services/vocabService';
import type { RatingResult } from '../services/progressService';
import { useToast } from '../contexts/ToastContext';
import { useFlashcardSession } from '../hooks/useFlashcardSession';
import { useFlashcardRating } from '../hooks/useFlashcardRating';
import { AddVocabModal } from './AddVocabModal';
import gsap from 'gsap';
import { motionTokens } from '../lib/animation/motionTokens';
import { usePrefersReducedMotion } from '../hooks/use-prefers-reduced-motion';
import { isVocabularyDue } from '../features/review-reminder';
import { evaluatePronunciation } from '../lib/pronunciation/evaluatePronunciation';
import { createFlashcardQuizOptions } from '../lib/quiz/flashcardOptions';
import { QuizExercise } from './flashcard/QuizExercise';
import { TypingExercise } from './flashcard/TypingExercise';
import { PronunciationExercise } from './flashcard/PronunciationExercise';
import { FlashcardExercise } from './flashcard/FlashcardExercise';

type PronunciationStatus =
  | 'idle'
  | 'requesting-permission'
  | 'listening'
  | 'checking'
  | 'correct'
  | 'incorrect'
  | 'unsupported'
  | 'permission-denied'
  | 'no-speech'
  | 'recognition-error';

interface SpeechRecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface SpeechRecognitionErrorEvent {
  error?: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

type VocabularyUpdate = Partial<Pick<Vocabulary,
  'word' | 'phonetic_uk' | 'phonetic_us' | 'part_of_speech' |
  'meaning' | 'example' | 'example_translation' | 'synonyms' |
  'collocations' | 'audio_url' | 'note'
>>;

interface FlashcardModeProps {
  userId: string | null;
  vocabularies: Vocabulary[];
  topics: Topic[];
  selectedTopicId: string;
  initialStatus?: FlashcardInitialFilter;
  onUpdateProgress: (
    vocabId: string,
    status: 'learning' | 'mastered',
    rating?: SrsRating,
    idempotencyKey?: string
  ) => Promise<RatingResult>;
  onBackToDashboard: () => void;
  onSwitchToSynonyms: (topicId: string) => void;
  onStudySessionCompleted?: () => void;
  onDeleteVocabulary?: (vocabId: string) => void;
  onEditVocabulary?: (vocabId: string, updates: VocabularyUpdate) => Promise<void>;
}

type StudySubMode = 'flashcard' | 'quiz' | 'typing' | 'pronounce';

// Identity changes start a fresh local session and invalidate the old mount's
// in-flight work, even when both accounts have the same vocabulary IDs.
export const FlashcardMode: React.FC<FlashcardModeProps> = (props) => (
  <FlashcardSession key={props.userId} {...props} />
);

const FlashcardSession: React.FC<FlashcardModeProps> = ({
  userId,
  vocabularies,
  topics,
  selectedTopicId,
  initialStatus,
  onUpdateProgress,
  onBackToDashboard,
  onSwitchToSynonyms,
  onStudySessionCompleted,
  onDeleteVocabulary,
  onEditVocabulary,
}) => {
  const { showToast } = useToast();
  const session = useFlashcardSession({ userId, vocabularies, selectedTopicId, initialStatus, onCompleted: onStudySessionCompleted });
  const { filterTopic, filterStatus, sessionStats, subMode, currentIndex, isCompleted,
    topicVocabulary: topicVocabs, activeVocabulary: activeVocabs, safeIndex, currentVocabulary: currentVocab,
    nowMs, setSubMode } = session;
  const currentVocabId = currentVocab?.id;

  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const cardTransitionRef = useRef<HTMLDivElement>(null);
  const completionRef = useRef<HTMLDivElement>(null);
  const typingInputRef = useRef<HTMLInputElement>(null);
  const typingFeedbackRef = useRef<HTMLDivElement>(null);
  const shouldAnimateCardRef = useRef(false);
  const ratingAudioContextRef = useRef<AudioContext | null>(null);
  const previousAudioContextRef = useRef<{
    subMode: StudySubMode;
    vocabularyId: string | null;
  }>({ subMode: 'flashcard', vocabularyId: null });
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const recognitionAttemptRef = useRef(0);
  const isFlashcardMountedRef = useRef(true);
  const prefersReducedMotion = usePrefersReducedMotion();

  // Edit vocabulary modal state
  const [showEditModal, setShowEditModal] = useState<boolean>(false);

  const stopRecognition = useCallback(() => {
    recognitionAttemptRef.current += 1;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;

    if (!recognition) return;
    recognition.onstart = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try {
      recognition.abort();
    } catch {
      try {
        recognition.stop();
      } catch {
        // Recognition may already have ended.
      }
    }
  }, []);

  useEffect(() => {
    isFlashcardMountedRef.current = true;
    return () => {
      isFlashcardMountedRef.current = false;
      stopRecognition();
    };
  }, [stopRecognition]);

  const previousStudyContextRef = useRef({
    selectedTopicId,
    initialStatus,
  });

  const hasInitializedStudyContextRef = useRef(false);

  useEffect(() => {
  // Lần chạy đầu tiên chỉ ghi nhận context hiện tại.
  // Không xóa session vì đây có thể là lúc trang đang refresh
  // và cần khôi phục snapshot cũ.
  if (!hasInitializedStudyContextRef.current) {
    previousStudyContextRef.current = {
      selectedTopicId,
      initialStatus,
    };

    hasInitializedStudyContextRef.current = true;
    return;
  }

  const previousContext = previousStudyContextRef.current;

  const topicChanged =
    previousContext.selectedTopicId !== selectedTopicId;

  const statusChanged =
    previousContext.initialStatus !== initialStatus;

  if (!topicChanged && !statusChanged) {
    return;
  }

  // Cập nhật ref trước để effect không xử lý lại cùng một thay đổi.
  previousStudyContextRef.current = {
    selectedTopicId,
    initialStatus,
  };

  setIsFlipped(false);
}, [
  selectedTopicId,
  initialStatus,
  userId,
]);


  // Evaluation / Rating Buttons State
  const [showRatingButtons, setShowRatingButtons] = useState<boolean>(false);

  // Track if user has revealed answer (for showing rating buttons)
  const [hasRevealedAnswer, setHasRevealedAnswer] = useState<boolean>(false);

  // Settings & Modals state matching image features
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);

  // Settings Toggles (Match screenshot)
  const [autoPlayAudio, setAutoPlayAudio] = useState<boolean>(true);
  const [ratingFeedbackSound, setRatingFeedbackSound] = useState<boolean>(true);
  const [showExamples, setShowExamples] = useState<boolean>(true);
  const [showCollocations, setShowCollocations] = useState<boolean>(true);
  const [showSynonyms, setShowSynonyms] = useState<boolean>(true);
  const [showPartOfSpeech, setShowPartOfSpeech] = useState<boolean>(true);
  const [voiceAccent, setVoiceAccent] = useState<'en-US' | 'en-GB'>('en-US');

  // Quiz mode state
  const [selectedQuizIndex, setSelectedQuizIndex] = useState<number | null>(null);
  const [quizAnswered, setQuizAnswered] = useState<boolean>(false);

  // Typing mode state
  const [typedInput, setTypedInput] = useState<string>('');
  const [typingSubmitted, setTypingSubmitted] = useState<boolean>(false);
  const [isTypingCorrect, setIsTypingCorrect] = useState<boolean | null>(null);
  const [showHint, setShowHint] = useState<boolean>(false);

  // Pronounce mode state
  const [pronunciationStatus, setPronunciationStatus] = useState<PronunciationStatus>('idle');
  const [transcriptText, setTranscriptText] = useState<string>('');
  const isRecording =
    pronunciationStatus === 'requesting-permission' ||
    pronunciationStatus === 'listening' ||
    pronunciationStatus === 'checking';
  const pronounceSubmitted =
    pronunciationStatus === 'correct' ||
    pronunciationStatus === 'incorrect' ||
    pronunciationStatus === 'unsupported' ||
    pronunciationStatus === 'permission-denied' ||
    pronunciationStatus === 'no-speech' ||
    pronunciationStatus === 'recognition-error';
  const isPronounceCorrect = pronunciationStatus === 'correct';

  // ESC key handlers for modals
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSettingsModal) {
          setShowSettingsModal(false);
        } else if (showReportModal) {
          setShowReportModal(false);
        } else if (showEditModal) {
          setShowEditModal(false);
        }
      }
    };

    if (showSettingsModal || showReportModal || showEditModal) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [showSettingsModal, showReportModal, showEditModal]);

  // Reset interaction state during render when word or submode changes
  useEffect(() => {
    const resetInteractionState = () => {
      setIsFlipped(false);
      setShowRatingButtons(false);
      setHasRevealedAnswer(false);

      setTypedInput('');
      setTypingSubmitted(false);
      setIsTypingCorrect(null);
      setShowHint(false);

      stopRecognition();
      setPronunciationStatus('idle');
      setTranscriptText('');

      setSelectedQuizIndex(null);
      setQuizAnswered(false);
    };

    queueMicrotask(resetInteractionState);
  }, [currentIndex, subMode, stopRecognition]);

  // Counts by status
  const { newCount, dueCount, masteredCount, totalCount } = useMemo(() => {
    let n = 0, due = 0, m = 0;
    topicVocabs.forEach((v) => {
      if (!v.status || v.status === 'new') {
        n++;
      } else if (v.status === 'mastered') {
        m++;
      }
      if (isVocabularyDue(v, nowMs)) due++;
    });
    return { newCount: n, dueCount: due, masteredCount: m, totalCount: topicVocabs.length };
  }, [topicVocabs, nowMs]);

  // Display labels for static text badges
  const currentTopicTitle = useMemo(() => {
    if (filterTopic === 'all') return `Tất cả bài học (${vocabularies.length} từ)`;
    const topic = topics.find((t) => t.id === filterTopic);
    return topic ? `${topic.title} (${topicVocabs.length} từ)` : 'Bài học';
  }, [filterTopic, topics, vocabularies.length, topicVocabs.length]);

  const currentStatusLabel = useMemo(() => {
    if (filterStatus === 'new') return `🌟 Từ mới (${newCount})`;
    if (filterStatus === 'due') return `⏰ Đến hạn ôn (${dueCount})`;
    if (filterStatus === 'learning') return `⏰ Đến hạn ôn (${dueCount})`;
    if (filterStatus === 'mastered') return `✅ Đã thuộc (${masteredCount})`;
    return `📚 Tất cả trạng thái (${totalCount})`;
  }, [filterStatus, newCount, dueCount, masteredCount, totalCount]);

  const remainingCountLabel = filterStatus === 'new' ? 'Từ mới' : 'Còn lại';
  const remainingCountShortLabel = filterStatus === 'new' ? 'Mới' : 'Còn';

  const audioWord = currentVocab?.word;
  const audioVocabularyId = currentVocab?.id;

  useEffect(() => {
    const card = cardTransitionRef.current;
    if (!card || !shouldAnimateCardRef.current) return;

    shouldAnimateCardRef.current = false;
    const ctx = gsap.context(() => {
      if (prefersReducedMotion) {
        gsap.set(card, { clearProps: 'transform,opacity' });
        return;
      }

      gsap.fromTo(
        card,
        { x: motionTokens.distance.large, autoAlpha: 0 },
        {
          x: 0,
          autoAlpha: 1,
          duration: motionTokens.duration.fast,
          ease: motionTokens.ease.standard,
          clearProps: 'transform,opacity',
        }
      );
    }, card);

    return () => ctx.revert();
  }, [safeIndex, currentVocab?.id, prefersReducedMotion]);

  useEffect(() => {
    if (!isCompleted || !completionRef.current) return;

    const ctx = gsap.context(() => {
      const completion = completionRef.current;
      if (!completion) return;

      const targets = completion.querySelectorAll<HTMLElement>('[data-completion-item]');
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
  }, [isCompleted, prefersReducedMotion]);

  // Sync currentIndex after render completes if it was out of bounds

  // Derive Quiz options dynamically using pure seeded shuffle
  const { options: quizOptions, correctAnswerIndex: correctQuizIndex } = useMemo(
    () => createFlashcardQuizOptions(currentVocab, activeVocabs),
    [currentVocab, activeVocabs],
  );

  useEffect(() => {
    if (!quizAnswered || selectedQuizIndex === null || !cardTransitionRef.current) return;

    const ctx = gsap.context(() => {
      const selectedOption = cardTransitionRef.current?.querySelector<HTMLElement>(
        `[data-flash-quiz-option="${selectedQuizIndex}"]`
      );
      const feedback = cardTransitionRef.current?.querySelector<HTMLElement>('[data-flash-quiz-feedback]');
      if (!selectedOption || !feedback) return;

      if (prefersReducedMotion) {
        gsap.set([selectedOption, feedback], { clearProps: 'all' });
        return;
      }

      const timeline = gsap.timeline({
        defaults: {
          duration: motionTokens.duration.instant,
          ease: motionTokens.ease.standard,
        },
      });

      if (selectedQuizIndex === correctQuizIndex) {
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
    }, cardTransitionRef);

    return () => ctx.revert();
  }, [correctQuizIndex, prefersReducedMotion, quizAnswered, selectedQuizIndex]);

  useEffect(() => {
    if (!typingSubmitted || isTypingCorrect === null || !cardTransitionRef.current) return;

    const ctx = gsap.context(() => {
      const input = typingInputRef.current;
      const feedback = typingFeedbackRef.current;
      if (!input || !feedback) return;

      if (prefersReducedMotion) {
        gsap.set([input, feedback], { clearProps: 'all' });
        return;
      }

      const timeline = gsap.timeline({
        defaults: {
          duration: motionTokens.duration.instant,
          ease: motionTokens.ease.standard,
        },
      });

      if (isTypingCorrect) {
        timeline.fromTo(
          input,
          { scale: 0.985 },
          { scale: 1, duration: motionTokens.duration.fast }
        );
      } else {
        timeline
          .to(input, { x: -4 })
          .to(input, { x: 4 })
          .to(input, { x: 0 });
      }

      timeline.fromTo(
        feedback,
        { autoAlpha: 0, y: motionTokens.distance.small },
        { autoAlpha: 1, y: 0, duration: motionTokens.duration.fast },
        '<'
      );
    }, cardTransitionRef);

    return () => ctx.revert();
  }, [isTypingCorrect, prefersReducedMotion, typingSubmitted]);

  // Text-to-Speech
  const playPronunciation = useCallback((text: string, accent: 'en-US' | 'en-GB' = voiceAccent) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      showToast('Trình duyệt của bạn không hỗ trợ Web Speech API.', 'error');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = accent;
    utterance.rate = 0.85;

    window.speechSynthesis.speak(utterance);
  }, [voiceAccent, showToast]);

  // Shared, subtle confirmation sound for the four SRS rating buttons.
  const playRatingFeedback = useCallback(() => {
    if (!ratingFeedbackSound || typeof window === 'undefined') return;

    const AudioContextConstructor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextConstructor) return;

    const audioContext =
      ratingAudioContextRef.current?.state === 'closed'
        ? new AudioContextConstructor()
        : (ratingAudioContextRef.current ?? new AudioContextConstructor());

    ratingAudioContextRef.current = audioContext;

    if (audioContext.state === 'suspended') {
      void audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const startTime = audioContext.currentTime;
    const endTime = startTime + 0.14;

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(560, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(700, startTime + 0.08);

    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.6, startTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(startTime);
    oscillator.stop(endTime);
  }, [ratingFeedbackSound]);

  useEffect(() => {
    return () => {
      const audioContext = ratingAudioContextRef.current;
      if (audioContext && audioContext.state !== 'closed') {
        void audioContext.close();
      }
    };
  }, []);

  // Automatically pronounce the current word when entering an exercise mode
  // or when a new vocabulary item appears inside that mode.
  useEffect(() => {
    const previousContext = previousAudioContextRef.current;
    const shouldPlayAudio =
      autoPlayAudio &&
      subMode !== 'flashcard' &&
      Boolean(audioWord) &&
      (previousContext.subMode !== subMode || previousContext.vocabularyId !== audioVocabularyId);

    previousAudioContextRef.current = {
      subMode,
      vocabularyId: audioVocabularyId ?? null,
    };

    if (shouldPlayAudio && audioWord) {
      playPronunciation(audioWord);
    }
  }, [audioVocabularyId, audioWord, autoPlayAudio, playPronunciation, subMode]);

  // Helper for dynamic SRS button interval subtitles
  const getRatingSubtitle = (rating: 'again' | 'hard' | 'good' | 'easy', currentInterval = 0) => {
    // Phase 6: Again now shows queue-based relearning message
    if (rating === 'again') return 'Sau 5 thẻ';
    const formatHoursLabel = (hours: number) => {
    if (hours < 1) {
      const minutes = Math.max(1, Math.round(hours * 60));
      return `${minutes} phút`;
    }

    const roundedHours = Math.round(hours);

    if (roundedHours < 24) {
      return `${roundedHours} giờ`;
    }

    const days = Math.floor(roundedHours / 24);
    const remainingHours = roundedHours % 24;

    if (remainingHours === 0) {
      return `${days} ngày`;
    }

      return `${days} ngày ${remainingHours} giờ`;
    };

    if (rating === 'hard') {
      const h = currentInterval > 0 ? currentInterval * 2 : 6;
      return formatHoursLabel(h);
    }
    if (rating === 'good') {
      const h = currentInterval > 0 ? currentInterval * 3 : 24;
      return formatHoursLabel(h);
    }
    if (rating === 'easy') {
      const h = currentInterval > 0 ? currentInterval * 4 : 72;
      return formatHoursLabel(h);
    }
    return '';
  };

  const onRatingCommitted = useCallback((
    _action: { vocabularyId: string; rating: SrsRating; isMastered: boolean },
    prepared: import('../hooks/useFlashcardSession').PreparedRating,
  ): boolean => {
    if (!prepared.isCurrent()) return false;
    stopRecognition();
    setPronunciationStatus('idle');
    setIsFlipped(false);
    setHasRevealedAnswer(false);
    if (!prepared.isComplete) shouldAnimateCardRef.current = true;
    if (!prepared.commit()) return false;
    if (prepared.isComplete && !prefersReducedMotion) {
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#ED4F8E', '#F472B6', '#FCE7F3', '#3B82F6', '#10B981'],
        });
      } catch {
        // Fallback
      }
    }
    return true;
  }, [prefersReducedMotion, stopRecognition]);

  const rating = useFlashcardRating({
    userId,
    vocabularyId: currentVocabId,
    onUpdateProgress,
    prepareRating: session.prepareRating,
    onCommitted: onRatingCommitted,
  });
  const { isSubmitting, submissionError, hasPendingRatingRetry, isLocked, retry, dismissError } = rating;
  const handleRating = rating.submit;

  // Handle Rating Selection from 4 evaluation buttons
  const handleSelectSrsRating = useCallback((srsRating: SrsRating) => {
    if (isLocked()) return;
    playRatingFeedback();
    setShowRatingButtons(false);
    const isMastered = srsRating === 'mastered';
    handleRating(isMastered, srsRating);
    setSubMode('flashcard');
  }, [handleRating, isLocked, playRatingFeedback, setSubMode]);

  const retryPendingRating = useCallback(() => {
    setShowRatingButtons(false);
    void retry();
  }, [retry]);

  const handleBackToDashboard = useCallback(() => {
    if (isLocked()) return;
    onBackToDashboard();
  }, [isLocked, onBackToDashboard]);

  // Handle "Chưa nhớ" -> Immediately transition to next exercise step
  const handleNotRemembered = useCallback(() => {
    // Block during rating submission to prevent state corruption
    if (isLocked()) return;

    setShowRatingButtons(false);

    // Phase 9.10A.4: Special case for pronunciation mode
    // "Chưa nhớ" should NOT create rating or requeue card
    // Just return to flashcard mode with same word
    if (subMode === 'pronounce') {
      // Reset pronunciation state
      stopRecognition();
      setTranscriptText('');
      setPronunciationStatus('idle');

      // Return to flashcard, same word, front side
      setIsFlipped(false);
      setSubMode('flashcard');
      return; // Early return - no rating, no queue change
    }

    // Normal flow for other modes: cycle through exercise types
    if (subMode === 'flashcard') {
      setSubMode('quiz');
    } else if (subMode === 'quiz') {
      setSubMode('typing');
    } else if (subMode === 'typing') {
      setSubMode('pronounce');
    }
  }, [isLocked, subMode, stopRecognition, setSubMode]);

  // Handle Delete current vocabulary item
  const handleDeleteCurrentVocab = useCallback(() => {
    if (isLocked() || !currentVocab) return;

    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn xóa từ vựng "${currentVocab.word}" khỏi bài học này?`
    );

    if (!confirmed) return;

    if (onDeleteVocabulary) {
      onDeleteVocabulary(currentVocab.id);
    }

    session.removeCurrentAfterDelete();
  }, [currentVocab, isLocked, onDeleteVocabulary, session]);

  // Handle Quiz selection
  const handleQuizSelect = useCallback((idx: number) => {
    if (quizAnswered || isLocked()) return;
    setSelectedQuizIndex(idx);
    setQuizAnswered(true);
    // Mark answer as revealed after user selects an option
    setHasRevealedAnswer(true);
  }, [isLocked, quizAnswered]);

  // Handle edit vocabulary
  const handleEditCurrentVocab = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (
        isLocked() ||
        isSubmitting ||
        !currentVocab ||
        !onEditVocabulary
      ) {
        return;
      }

      setShowEditModal(true);
    },
    [currentVocab, isLocked, isSubmitting, onEditVocabulary]
  );

  const handleSaveEdit = useCallback(
    async (
      vocabId: string,
      updates: VocabularyUpdate
    ): Promise<void> => {
      if (!onEditVocabulary) {
        throw new Error('Chức năng chỉnh sửa chưa khả dụng')
      }

      await onEditVocabulary(vocabId, updates);
    },
    [onEditVocabulary]
  );

  // Handle Typing Check
  const handleCheckTyping = useCallback(() => {
    if (!currentVocab || typingSubmitted || isLocked()) return;
    const cleanInput = typedInput.trim().toLowerCase();
    const cleanWord = currentVocab.word.trim().toLowerCase();
    const correct = cleanInput === cleanWord;
    setIsTypingCorrect(correct);
    setTypingSubmitted(true);
    // Mark answer as revealed after checking typing result
    setHasRevealedAnswer(true);
  }, [currentVocab, isLocked, typingSubmitted, typedInput]);

  const handleStopRecording = useCallback(() => {
    stopRecognition();
    setPronunciationStatus('idle');
    setTranscriptText('');
  }, [stopRecognition]);

  // A learning result exists only when Speech Recognition returns a transcript
  // and evaluatePronunciation confirms it. Technical failures never fall back
  // to a correct result.
  const handleStartRecording = () => {
    if (isLocked() || !currentVocab || isRecording) return;

    stopRecognition();
    setTranscriptText('');
    setPronunciationStatus('requesting-permission');

    if (typeof window === 'undefined') {
      setPronunciationStatus('unsupported');
      return;
    }

    const win = window as unknown as Record<string, unknown>;
    const SpeechRecognitionClass = (win.SpeechRecognition || win.webkitSpeechRecognition) as
      | SpeechRecognitionConstructor
      | undefined;

    if (!SpeechRecognitionClass) {
      setPronunciationStatus('unsupported');
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      const attemptId = recognitionAttemptRef.current + 1;
      recognitionAttemptRef.current = attemptId;
      recognitionRef.current = recognition;
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      const isActiveAttempt = () => (
        isFlashcardMountedRef.current &&
        recognitionAttemptRef.current === attemptId &&
        recognitionRef.current === recognition
      );

      recognition.onstart = () => {
        if (isActiveAttempt()) setPronunciationStatus('listening');
      };

      recognition.onresult = (event) => {
        if (!isActiveAttempt()) return;

        const transcript = event.results[0]?.[0]?.transcript?.trim() || '';
        if (!transcript) {
          recognitionRef.current = null;
          setPronunciationStatus('no-speech');
          return;
        }

        setPronunciationStatus('checking');
        const evaluation = evaluatePronunciation(currentVocab.word, transcript);
        if (!isActiveAttempt()) return;

        recognitionRef.current = null;
        setTranscriptText(transcript);
        setPronunciationStatus(evaluation.isCorrect ? 'correct' : 'incorrect');
        setHasRevealedAnswer(true);
      };

      recognition.onerror = (event) => {
        if (!isActiveAttempt()) return;

        recognitionRef.current = null;
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setPronunciationStatus('permission-denied');
        } else if (event.error === 'no-speech') {
          setPronunciationStatus('no-speech');
        } else {
          setPronunciationStatus('recognition-error');
        }
      };

      recognition.onend = () => {
        if (!isActiveAttempt()) return;
        recognitionRef.current = null;
        setPronunciationStatus((previous) => (
          previous === 'requesting-permission' || previous === 'listening'
            ? 'no-speech'
            : previous
        ));
      };

      recognition.start();
    } catch {
      recognitionRef.current = null;
      setPronunciationStatus('recognition-error');
    }
  };

  const pronunciationFeedback = useMemo(() => {
    switch (pronunciationStatus) {
      case 'correct':
        return { title: 'Chính xác!', detail: '' };
      case 'incorrect':
        return { title: 'Chưa đúng', detail: '' };
      case 'unsupported':
        return { title: 'Chưa hỗ trợ', detail: 'Trình duyệt này chưa hỗ trợ nhận diện giọng nói.' };
      case 'permission-denied':
        return { title: 'Không thể dùng microphone', detail: 'Hãy cấp quyền microphone và thử lại.' };
      case 'no-speech':
        return { title: 'Không nghe thấy giọng nói', detail: 'Hãy nói lại và thử thêm một lần.' };
      case 'recognition-error':
        return { title: 'Không thể nhận diện', detail: 'Vui lòng thử lại.' };
      default:
        return { title: '', detail: '' };
    }
  }, [pronunciationStatus]);

  const isPronunciationTechnicalIssue =
    pronunciationStatus === 'unsupported' ||
    pronunciationStatus === 'permission-denied' ||
    pronunciationStatus === 'no-speech' ||
    pronunciationStatus === 'recognition-error';

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCompleted || !currentVocab || showSettingsModal || showReportModal || showEditModal) return;
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.isComposing || e.repeat) return;

      // Native controls and editable descendants own their keyboard behavior.
      const interactiveSelector = 'button, input, textarea, select, a[href], summary, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="link"], [role="textbox"], [role="combobox"], [role="listbox"], [role="option"], [role="checkbox"], [role="radio"], [role="switch"], [role="slider"], [role="spinbutton"], [role="tab"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="dialog"], [role="alertdialog"], [aria-modal="true"], [tabindex], dialog';
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest(interactiveSelector) || document.activeElement?.closest(interactiveSelector)) return;

      if (e.code === 'Space' && subMode === 'flashcard') {
        e.preventDefault();
        setIsFlipped((prev) => {
          const nextState = !prev;
          if (nextState) {
            // Mark answer as revealed when flipping to back side
            setHasRevealedAnswer(true);
            if (autoPlayAudio) {
              playPronunciation(currentVocab.word);
            }
          }
          return nextState;
        });
      } else if (e.code === 'Enter') {
        if (subMode === 'typing' && !typingSubmitted) {
          e.preventDefault();
          handleCheckTyping();
        } else if (subMode === 'typing' && typingSubmitted) {
          e.preventDefault();
          if (!isLocked()) {
            setShowRatingButtons(true);
          }
        } else {
          e.preventDefault();
          handleNotRemembered();
        }
      } else if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code) && subMode === 'quiz') {
        const num = parseInt(e.code.replace('Digit', ''), 10) - 1;
        if (num >= 0 && num < quizOptions.length) {
          handleQuizSelect(num);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isCompleted,
    currentVocab,
    subMode,
    typingSubmitted,
    isTypingCorrect,
    showSettingsModal,
    showReportModal,
    showEditModal,
    autoPlayAudio,
    quizOptions.length,
    handleRating,
    isLocked,
    handleNotRemembered,
    playPronunciation,
    handleCheckTyping,
    handleQuizSelect,
  ]);

  const restartSession = () => {
    session.restart();
    setIsFlipped(false);
  };

  // Empty queue guard - render before accessing currentVocab
  if (!activeVocabs || activeVocabs.length === 0 || !currentVocab) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white rounded-[32px] border border-[#FCE7F3] text-center space-y-4 shadow-2xs">
        <BookOpen className="w-12 h-12 text-[#F472B6] mx-auto" />
        <h3 className="font-bold text-lg text-gray-800">
          {filterStatus === 'new'
            ? 'Không có từ mới trong học phần này'
            : filterStatus === 'learning' || filterStatus === 'due'
            ? 'Không có từ nào đến hạn ôn tập'
            : 'Không có từ vựng nào phù hợp'}
        </h3>
        <p className="text-xs text-gray-500 leading-relaxed">
          {filterStatus === 'new'
            ? 'Tất cả các từ vựng trong học phần này đã được khởi đầu học hoặc đã thuộc. Bạn có thể chọn học tất cả từ hoặc chọn bộ lọc khác.'
            : filterStatus === 'learning' || filterStatus === 'due'
            ? 'Bạn đã hoàn thành tất cả các từ đến hạn ôn tập lúc này! Bạn có thể học thêm từ mới hoặc ôn tập lại tất cả các từ.'
            : 'Vui lòng chọn bài học khác hoặc quay về Dashboard.'}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {filterStatus === 'new' && totalCount > 0 && (
            <button
              onClick={() => {
                session.selectStatus('all');
              }}
              className="px-5 py-2.5 bg-[#FFF1F2] text-[#ED4F8E] font-bold rounded-2xl text-xs cursor-pointer border border-[#FCE7F3] hover:bg-[#FFE4E6] transition-colors"
            >
              Học tất cả từ ({totalCount} từ)
            </button>
          )}

          {(filterStatus === 'learning' || filterStatus === 'due') && totalCount > 0 && (
            <button
              onClick={() => {
                session.selectStatus('all');
              }}
              className="px-5 py-2.5 bg-[#FFF1F2] text-[#ED4F8E] font-bold rounded-2xl text-xs cursor-pointer border border-[#FCE7F3] hover:bg-[#FFE4E6] transition-colors"
            >
              Ôn tất cả từ ({totalCount} từ)
            </button>
          )}

          <button
            onClick={handleBackToDashboard}
            className="px-5 py-2.5 bg-gradient-to-r from-[#ED4F8E] to-[#F472B6] text-white font-bold rounded-2xl text-xs cursor-pointer shadow-2xs hover:opacity-95 transition-opacity"
          >
            Quay về Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Session Completed View
  if (isCompleted) {
    return (
      <div ref={completionRef} data-session-completion className="max-w-2xl mx-auto my-8 p-8 bg-white rounded-[32px] border border-[#FCE7F3] shadow-lg text-center space-y-6 animate-fadeIn">
        <div data-completion-item className="w-20 h-20 mx-auto bg-gradient-to-tr from-[#ED4F8E] to-[#F472B6] rounded-[28px] flex items-center justify-center text-white shadow-md">
          <Award className="w-10 h-10" />
        </div>

        <div data-completion-item className="space-y-2">
          <span className="px-3.5 py-1 rounded-full bg-[#FFF1F2] text-[#ED4F8E] text-xs font-bold uppercase tracking-wide border border-[#FCE7F3]">
            Hoàn Thành Phiên Học
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
            Tuyệt Vời! Bạn Đã Hoàn Thành Session 🎉
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 font-medium">
            Tiếp tục duy trì thói quen học tập để nâng cao vốn từ vựng TOEIC mỗi ngày!
          </p>
        </div>

        <div data-completion-item className="grid grid-cols-2 gap-4 p-4 rounded-[24px] bg-[#FFF5F7] border border-[#FCE7F3] text-left">
          <div className="p-4 bg-white rounded-2xl border border-[#FCE7F3] space-y-1">
            <div className="flex items-center gap-2 text-[#059669] text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-[#059669]" />
              <span>Đã thuộc (Mastered)</span>
            </div>
            <div className="text-2xl font-black text-gray-900">{sessionStats.mastered} Từ</div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-[#FCE7F3] space-y-1">
            <div className="flex items-center gap-2 text-[#D97706] text-xs font-bold">
              <RefreshCw className="w-4 h-4 text-[#D97706]" />
              <span>Cần ôn lại</span>
            </div>
            <div className="text-2xl font-black text-gray-900">{sessionStats.needsReview} Từ</div>
          </div>
        </div>

        <div data-completion-item className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={restartSession}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-[#ED4F8E] to-[#F472B6] text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer hover:opacity-95"
          >
            <RotateCw className="w-4 h-4" />
            Luyện Lại Session Này
          </button>

          <button
            onClick={() => onSwitchToSynonyms(filterTopic)}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-[#FFF1F2] border border-[#FCE7F3] text-[#ED4F8E] font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer hover:bg-[#FFE4E6]"
          >
            <GitCompareArrows className="w-4 h-4" />
            Luyện Từ Đồng Nghĩa Ngay
          </button>

          <button
            onClick={handleBackToDashboard}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gray-100 text-gray-700 font-bold text-xs transition-all cursor-pointer hover:bg-gray-200"
          >
            Về Trang Chủ
          </button>
        </div>
      </div>
    );
  }

  const currentTopic = topics.find((t) => t.id === currentVocab?.topic_id);

  // Sub-mode steps definition for step indicator bar
  const modeSteps: { id: StudySubMode; label: string; icon: React.ReactNode }[] = [
    { id: 'flashcard', label: 'Flashcard', icon: <RotateCw className="w-3.5 h-3.5" /> },
    { id: 'quiz', label: 'Trắc nghiệm', icon: <Target className="w-3.5 h-3.5" /> },
    { id: 'typing', label: 'Gõ từ', icon: <Keyboard className="w-3.5 h-3.5" /> },
    { id: 'pronounce', label: 'Phát âm', icon: <Mic className="w-3.5 h-3.5" /> },
  ];

  const currentStepIndex = modeSteps.findIndex((s) => s.id === subMode);

  const handleFlipCard = () => {
    setIsFlipped((prev) => {
      const nextState = !prev;
      if (nextState) {
        // Mark answer as revealed when flipping to back side
        setHasRevealedAnswer(true);
        if (autoPlayAudio) {
          playPronunciation(currentVocab.word);
        }
      }
      return nextState;
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-5 pb-8 sm:pb-12 px-4 sm:px-0">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        <button
          onClick={handleBackToDashboard}
          className="inline-flex items-center gap-2 text-xs font-bold text-gray-700 hover:text-[#ED4F8E] bg-white px-3 sm:px-4 py-2 rounded-2xl border border-[#FCE7F3] shadow-2xs transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Dashboard</span>
        </button>

        {/* Topic & Status Display (Static Text Badges) */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Status Badge */}
          <span className="bg-white border border-[#FCE7F3] rounded-2xl text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-1.5 sm:py-2 text-gray-800 shadow-2xs select-none">
            {currentStatusLabel}
          </span>

          {/* Topic Badge */}
          <span className="bg-white border border-[#FCE7F3] rounded-2xl text-[10px] sm:text-xs font-bold px-2 sm:px-3.5 py-1.5 sm:py-2 text-gray-800 shadow-2xs select-none">
            {currentTopicTitle}
          </span>
        </div>
      </div>

      {/* Mode Step Progress Bar (Non-clickable text boxes, passed sections highlighted in color) */}
      <div className="flex items-center justify-center gap-1.5 sm:gap-3 p-2 rounded-2xl bg-white border border-[#FCE7F3] shadow-2xs overflow-x-auto">
        {modeSteps.map((step, idx) => {
          const isPassed = idx < currentStepIndex;
          const isCurrent = idx === currentStepIndex;

          let badgeStyle = 'bg-gray-100 text-gray-400 border border-gray-200';
          if (isPassed) {
            // Passed section marked with color and checkmark
            badgeStyle = 'bg-[#D1FAE5] text-[#059669] border border-[#A7F3D0] font-bold';
          } else if (isCurrent) {
            badgeStyle = 'bg-[#ED4F8E] text-white shadow-xs font-extrabold';
          }

          return (
            <div
              key={step.id}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 rounded-xl text-[10px] sm:text-xs whitespace-nowrap transition-all select-none ${badgeStyle}`}
            >
              {isPassed ? <Check className="w-3.5 h-3.5 text-[#059669]" /> : step.icon}
              <span className="hidden sm:inline">{step.label}</span>
            </div>
          );
        })}
      </div>

      {/* MAIN CONTENT STUDY CARD CONTAINER */}
      <div className="bg-white rounded-[20px] sm:rounded-[32px] border-2 border-[#FCE7F3] p-4 sm:p-6 lg:p-8 shadow-xs relative space-y-4 sm:space-y-6">

        {/* Card Top Action Icons (Check / Edit / Trash / Settings / Alert) */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              {currentTopic?.title || 'TOEIC Vocabulary'}
            </span>
            {currentVocab && (
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                currentVocab.status === 'learning'
                  ? (!currentVocab.next_review_at || new Date(currentVocab.next_review_at).getTime() <= nowMs
                    ? 'bg-rose-50 text-rose-600 border-rose-200'
                    : 'bg-amber-50 text-amber-600 border-amber-200')
                  : currentVocab.status === 'mastered'
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                  : 'bg-sky-50 text-sky-600 border-sky-200'
              }`}>
                {currentVocab.status === 'learning'
                  ? (!currentVocab.next_review_at || new Date(currentVocab.next_review_at).getTime() <= nowMs
                    ? '⏰ Đến hạn'
                    : '⏳ Chưa đến hạn')
                  : currentVocab.status === 'mastered'
                  ? '✅ Đã thuộc'
                  : '🌟 Từ mới'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (isLocked()) return;
                if (!hasRevealedAnswer) return;
                if (currentVocab.status === 'mastered') return;
                handleRating(true, 'mastered');
              }}
              disabled={isSubmitting || !hasRevealedAnswer || currentVocab.status === 'mastered'}
              title={currentVocab.status === 'mastered' ? 'Đã thuộc' : 'Đánh dấu đã thuộc'}
              className={`p-2 sm:p-2.5 rounded-xl border transition-all cursor-pointer ${
                currentVocab.status === 'mastered'
                  ? 'bg-[#D1FAE5] border-[#059669] text-[#059669]'
                  : 'bg-white border-[#FCE7F3] text-gray-400 hover:text-[#059669] hover:bg-[#D1FAE5]/40'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>

            {/* Edit vocabulary button */}
            {onEditVocabulary && (
              <button
                type="button"
                onClick={handleEditCurrentVocab}
                disabled={isSubmitting}
                aria-label="Chỉnh sửa từ vựng"
                title="Chỉnh sửa từ vựng"
                className="p-2 sm:p-2.5 rounded-xl bg-white border border-[#FCE7F3] text-[#ED4F8E] hover:bg-[#FFF1F2] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}

            {/* Trash bin button to delete word from current section */}
            <button
              onClick={handleDeleteCurrentVocab}
              disabled={isSubmitting}
              title={
                isSubmitting
                  ? 'Đang lưu kết quả, chưa thể xóa từ'
                  : 'Xóa từ vựng khỏi bài học này'
              }
              className="p-2 sm:p-2.5 rounded-xl bg-white border border-[#FCE7F3] text-gray-400 hover:text-[#E11D48] hover:bg-[#FFE4E6] transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Gear button (Settings) */}
            <button
              onClick={() => setShowSettingsModal(true)}
              title="Cài đặt thẻ"
              className="p-2 sm:p-2.5 rounded-xl bg-white border border-[#FCE7F3] text-gray-400 hover:text-gray-700 hover:bg-[#FFF1F2] transition-all cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Report button */}
            <button
              onClick={() => setShowReportModal(true)}
              title="Báo cáo từ này"
              className="p-2 sm:p-2.5 rounded-xl bg-white border border-[#FCE7F3] text-gray-400 hover:text-[#E11D48] hover:bg-[#FFE4E6] transition-all cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* SUB-MODE 1: FLASHCARD */}
        {subMode === 'flashcard' && (
          <FlashcardExercise currentVocab={currentVocab} isFlipped={isFlipped}
            showPartOfSpeech={showPartOfSpeech} showExamples={showExamples}
            showCollocations={showCollocations} showSynonyms={showSynonyms}
            cardTransitionRef={cardTransitionRef} onFlip={handleFlipCard}
            onPlayPronunciation={playPronunciation} />
        )}

        {/* SUB-MODE 2: TRẮC NGHIỆM */}
        {subMode === 'quiz' && (
          <QuizExercise currentVocab={currentVocab} showPartOfSpeech={showPartOfSpeech}
            quizOptions={quizOptions} correctQuizIndex={correctQuizIndex}
            selectedQuizIndex={selectedQuizIndex} quizAnswered={quizAnswered}
            onPlayPronunciation={playPronunciation} onQuizSelect={handleQuizSelect} />
        )}

        {/* SUB-MODE 3: GÕ TỪ */}
        {subMode === 'typing' && (
          <TypingExercise currentVocab={currentVocab} showPartOfSpeech={showPartOfSpeech}
            typedInput={typedInput} typingSubmitted={typingSubmitted}
            isTypingCorrect={isTypingCorrect} showHint={showHint}
            typingInputRef={typingInputRef} typingFeedbackRef={typingFeedbackRef}
            onTypedInputChange={setTypedInput} onCheckTyping={handleCheckTyping}
            onToggleHint={() => setShowHint(!showHint)} />
        )}

        {/* SUB-MODE 4: PHÁT ÂM */}
        {subMode === 'pronounce' && (
          <PronunciationExercise currentVocab={currentVocab} isRecording={isRecording}
            pronounceSubmitted={pronounceSubmitted} isPronounceCorrect={isPronounceCorrect}
            isPronunciationTechnicalIssue={isPronunciationTechnicalIssue}
            pronunciationFeedback={pronunciationFeedback} transcriptText={transcriptText}
            onStartRecording={handleStartRecording} onStopRecording={handleStopRecording}
            onSkip={handleNotRemembered} onPlayPronunciation={playPronunciation} />
        )}

      </div>

        {/* BOTTOM RESPONSE ACTION BUTTONS (Đã thuộc / Chưa nhớ & 4 Rating Buttons) */}
      <div className="space-y-3">
        {/* Error banner */}
        {submissionError && (
          <div className="p-3.5 rounded-2xl bg-[#FFE4E6] border border-[#E11D48] text-[#E11D48] text-xs font-bold flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{submissionError}</span>
            </div>
            {hasPendingRatingRetry && (
              <button
                type="button"
                onClick={retryPendingRating}
                disabled={isSubmitting}
                className="shrink-0 rounded-lg border border-[#E11D48] bg-white px-2.5 py-1 font-bold text-[#E11D48] hover:bg-[#FFF1F2] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Thử lại
              </button>
            )}
            <button
              type="button"
              onClick={dismissError}
              className="text-[#E11D48] hover:text-[#BE123C] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Only show rating buttons after user has revealed answer */}
        {hasRevealedAnswer && !showRatingButtons ? (
          /* Initial 2 Buttons: "Đã thuộc" (triggers 4 rating buttons) & "Chưa nhớ" (transitions exercise) */
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                if (!isLocked()) {
                  setShowRatingButtons(true);
                }
              }}
              disabled={isSubmitting}
              className="py-3.5 px-4 rounded-2xl bg-white border-2 border-[#059669] text-[#059669] hover:bg-[#D1FAE5]/40 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4 text-[#059669]" />
              <span>Đã thuộc</span>
            </button>

            <button
              onClick={handleNotRemembered}
              disabled={isSubmitting}
              className="py-3.5 px-4 rounded-2xl bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Chưa nhớ</span>
            </button>
          </div>
        ) : hasRevealedAnswer && showRatingButtons ? (
          /* 4 Rating/Evaluation Buttons revealed when clicking "Đã thuộc" */
          <div className="space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between px-1">
              <span className="text-sm font-bold text-gray-600">Đánh giá mức độ thuộc:</span>
              <button
                onClick={() => setShowRatingButtons(false)}
                className="text-[11px] text-gray-400 hover:text-gray-600 font-semibold cursor-pointer"
              >
                ✕ Hủy
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                onClick={() => handleSelectSrsRating('again')}
                disabled={isSubmitting}
                className="p-3.5 rounded-2xl bg-[#EF4444] text-white font-bold text-sm sm:text-base flex flex-col items-center justify-center gap-0.5 hover:opacity-90 transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Học lại</span>
                <span className="text-xs sm:text-sm font-normal opacity-90">
                  {getRatingSubtitle('again', currentVocab?.interval_hours)}
                </span>
              </button>

              <button
                onClick={() => handleSelectSrsRating('hard')}
                disabled={isSubmitting}
                className="p-3.5 rounded-2xl bg-[#D97706] text-white font-bold text-sm sm:text-base flex flex-col items-center justify-center gap-0.5 hover:opacity-90 transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Khó</span>
                <span className="text-xs sm:text-sm font-normal opacity-90">
                  {getRatingSubtitle('hard', currentVocab?.interval_hours)}
                </span>
              </button>

              <button
                onClick={() => handleSelectSrsRating('good')}
                disabled={isSubmitting}
                className="p-3.5 rounded-2xl bg-[#059669] text-white font-bold text-sm sm:text-base flex flex-col items-center justify-center gap-0.5 hover:opacity-90 transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Tốt</span>
                <span className="text-xs sm:text-sm font-normal opacity-90">
                  {getRatingSubtitle('good', currentVocab?.interval_hours)}
                </span>
              </button>

              <button
                onClick={() => handleSelectSrsRating('easy')}
                disabled={isSubmitting}
                className="p-3.5 rounded-2xl bg-[#0284C7] text-white font-bold text-sm sm:text-base flex flex-col items-center justify-center gap-0.5 hover:opacity-90 transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Dễ</span>
                <span className="text-xs sm:text-sm font-normal opacity-90">
                  {getRatingSubtitle('easy', currentVocab?.interval_hours)}
                </span>
              </button>
            </div>
          </div>
        ) : null}

        {/* Shortcut hints */}
        {hasRevealedAnswer && (
          <>
            <p className="text-center text-[11px] text-gray-400 font-semibold hidden sm:block">
              Ấn &quot;Đã thuộc&quot; để hiện 4 nút đánh giá · Ấn &quot;Chưa nhớ&quot; để qua phần bài tập khác (Flashcard → Trắc nghiệm → Gõ từ → Phát âm)
            </p>
            <p className="text-center text-[10px] text-gray-400 font-semibold sm:hidden">
              Ấn &quot;Đã thuộc&quot; để đánh giá hoặc &quot;Chưa nhớ&quot; để luyện thêm
            </p>
          </>
        )}
      </div>

      {/* Mode Index & Bottom Vocabulary Counters */}
      <div className="text-center space-y-2 pt-1 border-t border-[#FCE7F3]">
        <p className="text-xs font-bold text-gray-500">
          Chế độ {subMode === 'flashcard' ? '1' : subMode === 'quiz' ? '2' : subMode === 'typing' ? '3' : '4'}/4: {subMode === 'flashcard' ? 'Flashcard' : subMode === 'quiz' ? 'Trắc nghiệm' : subMode === 'typing' ? 'Gõ từ' : 'Phát âm'}
        </p>

        <div className="flex items-center justify-center gap-4 sm:gap-6 text-xs font-bold">
          <div className="flex items-center gap-1.5">
            <span className="text-[#0284C7] font-black">{activeVocabs.length}</span>
            <span className="text-gray-500 hidden sm:inline">{remainingCountLabel}</span>
            <span className="text-gray-500 sm:hidden">{remainingCountShortLabel}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[#A855F7] font-black">{sessionStats.learningVocabularyIds.length}</span>
            <span className="text-gray-500 hidden sm:inline">Đang học</span>
            <span className="text-gray-500 sm:hidden">Học</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[#ED4F8E] font-black">{dueCount}</span>
            <span className="text-gray-500 hidden sm:inline">Đến hạn ôn</span>
            <span className="text-gray-500 sm:hidden">Ôn</span>
          </div>
        </div>
      </div>

      {/* MODAL: Settings (Colors synchronized with website theme) */}
      {showSettingsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs animate-fadeIn"
          onClick={() => setShowSettingsModal(false)}
        >
          <div
            className="relative w-full max-w-sm max-h-[90dvh] overflow-y-auto bg-white text-gray-900 rounded-[20px] sm:rounded-[28px] border border-[#FCE7F3] p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="flashcard-settings-modal-title"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-1 border-b border-[#FCE7F3]">
              <h3 id="flashcard-settings-modal-title" className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#ED4F8E]" />
                <span>Cài đặt</span>
              </h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                aria-label="Đóng"
                className="p-2 sm:p-2.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-[#FFF1F2] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Toggles list */}
            <div className="space-y-4 text-xs">
              {/* 1. Tự động phát âm */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Volume2 className="w-4 h-4 text-[#ED4F8E]" />
                  <span className="font-bold text-gray-800 text-xs">Tự động phát âm</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoPlayAudio(!autoPlayAudio)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    autoPlayAudio ? 'bg-[#ED4F8E]' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                      autoPlayAudio ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* 2. Âm thanh phản hồi rating */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Volume2 className="w-4 h-4 text-[#ED4F8E]" />
                  <span className="font-bold text-gray-800 text-xs">Âm thanh phản hồi</span>
                </div>
                <button
                  type="button"
                  aria-label="Bật hoặc tắt âm thanh phản hồi rating"
                  aria-pressed={ratingFeedbackSound}
                  onClick={() => setRatingFeedbackSound(!ratingFeedbackSound)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    ratingFeedbackSound ? 'bg-[#ED4F8E]' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                      ratingFeedbackSound ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* 3. Hiện ví dụ */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Eye className="w-4 h-4 text-[#ED4F8E]" />
                  <span className="font-bold text-gray-800 text-xs">Hiện ví dụ</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowExamples(!showExamples)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    showExamples ? 'bg-[#ED4F8E]' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                      showExamples ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* 3. Hiện cụm từ */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="w-4 h-4 text-[#ED4F8E]" />
                  <span className="font-bold text-gray-800 text-xs">Hiện cụm từ</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCollocations(!showCollocations)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    showCollocations ? 'bg-[#ED4F8E]' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                      showCollocations ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* 4. Hiện từ đồng nghĩa */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Hash className="w-4 h-4 text-[#ED4F8E]" />
                  <span className="font-bold text-gray-800 text-xs">Hiện từ đồng nghĩa</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSynonyms(!showSynonyms)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    showSynonyms ? 'bg-[#ED4F8E]' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                      showSynonyms ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* 5. Hiển thị loại từ */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4 text-[#ED4F8E]" />
                  <span className="font-bold text-gray-800 text-xs">Hiển thị loại từ</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPartOfSpeech(!showPartOfSpeech)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    showPartOfSpeech ? 'bg-[#ED4F8E]' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                      showPartOfSpeech ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* 6. Giọng đọc dropdown */}
              <div className="flex items-center justify-between pt-3 border-t border-[#FCE7F3]">
                <span className="font-bold text-gray-800 text-xs">Giọng đọc</span>
                <select
                  value={voiceAccent}
                  onChange={(e) => setVoiceAccent(e.target.value as 'en-US' | 'en-GB')}
                  className="bg-[#FFF5F7] border border-[#FCE7F3] text-gray-800 font-bold text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#F472B6] cursor-pointer"
                >
                  <option value="en-US">US us</option>
                  <option value="en-GB">UK uk</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Report word issue */}
      {showReportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-fadeIn"
          onClick={() => setShowReportModal(false)}
        >
          <div
            className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto bg-white rounded-[20px] sm:rounded-[28px] border border-[#FCE7F3] p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="flashcard-report-modal-title"
          >
            <div className="flex items-center justify-between">
              <h3 id="flashcard-report-modal-title" className="text-base sm:text-lg font-extrabold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#E11D48]" />
                <span>Báo cáo sai sót từ vựng</span>
              </h3>
              <button
                onClick={() => setShowReportModal(false)}
                aria-label="Đóng"
                className="p-2 sm:p-2.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Bạn nhận thấy lỗi dịch nghĩa, phát âm hoặc câu ví dụ của từ &ldquo;<strong>{currentVocab.word}</strong>&rdquo;? Vui lòng chọn bên dưới:
            </p>

            <div className="space-y-2 text-xs font-bold text-gray-700">
              {['Sai phiên âm IPA / Âm thanh', 'Nghĩa tiếng Việt chưa chính xác', 'Câu ví dụ không chính xác', 'Khác'].map((reason, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    showToast('Cảm ơn bạn đã đóng góp! Đội ngũ sẽ kiểm tra và cập nhật.', 'success');
                    setShowReportModal(false);
                  }}
                  className="w-full p-3 text-left rounded-xl bg-[#FFF5F7] hover:bg-[#FFF1F2] border border-[#FCE7F3] transition-all cursor-pointer"
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showEditModal && currentVocab && onEditVocabulary && (
        <AddVocabModal
          key={`edit-vocabulary-${currentVocab.id}`}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          topics={topics}
          defaultTopicId={currentVocab.topic_id}
          mode="edit"
          editVocabulary={currentVocab}
          onEditVocabulary={handleSaveEdit}
        />
      )}
    </div>
  );
};
