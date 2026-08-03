'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Volume2,
  RotateCw,
  CheckCircle2,
  HelpCircle,
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
import { Vocabulary, Topic } from '../lib/types';
import { SrsRating } from '../services/vocabService';
import { saveStudySession, loadStudySession, clearStudySession } from '../lib/session/storage';
import { useToast } from '../contexts/ToastContext';
import { applyRatingToQueue } from '../lib/session/queueTransition';
import type { StudySessionSnapshot } from '../lib/session/types';
import { createClient } from '@/lib/supabase/client';
import { AddVocabModal } from './AddVocabModal';
import gsap from 'gsap';
import { motionTokens } from '../lib/animation/motionTokens';
import { usePrefersReducedMotion } from '../hooks/use-prefers-reduced-motion';

type VocabularyUpdate = Partial<Pick<Vocabulary,
  'word' | 'phonetic_uk' | 'phonetic_us' | 'part_of_speech' |
  'meaning' | 'example' | 'example_translation' | 'synonyms' |
  'collocations' | 'audio_url' | 'note'
>>;

interface FlashcardModeProps {
  vocabularies: Vocabulary[];
  topics: Topic[];
  selectedTopicId: string;
  initialStatus?: 'all' | 'new' | 'learning' | 'mastered';
  onUpdateProgress: (vocabId: string, status: 'learning' | 'mastered', rating?: SrsRating) => Promise<void>;
  onBackToDashboard: () => void;
  onSwitchToQuiz: (topicId: string) => void;
  onDeleteVocabulary?: (vocabId: string) => void;
  onEditVocabulary?: (vocabId: string, updates: VocabularyUpdate) => Promise<void>;
}

type StudySubMode = 'flashcard' | 'quiz' | 'typing' | 'pronounce';

// Pure deterministic shuffle helper using seed
function seededShuffle<T>(array: T[], seed: string): T[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    hash = (hash * 9301 + 49297) % 233280;
    const j = Math.abs(hash) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export const FlashcardMode: React.FC<FlashcardModeProps> = ({
  vocabularies,
  topics,
  selectedTopicId,
  initialStatus,
  onUpdateProgress,
  onBackToDashboard,
  onSwitchToQuiz,
  onDeleteVocabulary,
  onEditVocabulary,
}) => {
  const { showToast } = useToast();
  const [filterTopic, setFilterTopic] = useState<string>(selectedTopicId || 'all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'new' | 'learning' | 'mastered'>(initialStatus || 'new');
  const [subMode, setSubMode] = useState<StudySubMode>('flashcard');
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  // Phase 6: State-based study queue (vocabulary IDs)
  const [studyQueue, setStudyQueue] = useState<string[]>([]);
  const [isSessionRestored, setIsSessionRestored] = useState<boolean>(false);

  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const cardTransitionRef = useRef<HTMLDivElement>(null);
  const completionRef = useRef<HTMLDivElement>(null);
  const typingInputRef = useRef<HTMLInputElement>(null);
  const typingFeedbackRef = useRef<HTMLDivElement>(null);
  const shouldAnimateCardRef = useRef(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  // Edit vocabulary modal state
  const [showEditModal, setShowEditModal] = useState<boolean>(false);

  // Phase 6: Helper to get authenticated user ID
  const getUserId = useCallback(async (): Promise<string | null> => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    } catch {
      return null;
    }
  }, []);

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

  setFilterTopic(selectedTopicId || 'all');
  setFilterStatus(initialStatus || 'new');

  setCurrentIndex(0);
  setIsFlipped(false);
  setIsCompleted(false);
  setSubMode('flashcard');

  setStudyQueue([]);
  setIsSessionRestored(false);

  const clearPreviousStudySession = async () => {
    const userId = await getUserId();

    if (userId) {
      clearStudySession(userId);
    }
  };

  void clearPreviousStudySession();
}, [
  selectedTopicId,
  initialStatus,
  getUserId,
]);

  // Track previous index & subMode for state reset during render
  const [sessionStats, setSessionStats] = useState({ mastered: 0, needsReview: 0 });

  // Stable timestamp for due-time calculations
  const [nowMs] = useState(() => Date.now());

  // Evaluation / Rating Buttons State
  const [showRatingButtons, setShowRatingButtons] = useState<boolean>(false);

  // Track if user has revealed answer (for showing rating buttons)
  const [hasRevealedAnswer, setHasRevealedAnswer] = useState<boolean>(false);

  // Settings & Modals state matching image features
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);

  // Settings Toggles (Match screenshot)
  const [autoPlayAudio, setAutoPlayAudio] = useState<boolean>(true);
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
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [pronounceSubmitted, setPronounceSubmitted] = useState<boolean>(false);
  const [isPronounceCorrect, setIsPronounceCorrect] = useState<boolean | null>(null);
  const [transcriptText, setTranscriptText] = useState<string>('');

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

      setIsRecording(false);
      setPronounceSubmitted(false);
      setIsPronounceCorrect(null);
      setTranscriptText('');

      setSelectedQuizIndex(null);
      setQuizAnswered(false);
    };

    queueMicrotask(resetInteractionState);
  }, [currentIndex, subMode]);

  // Topic-filtered list
  const topicVocabs = useMemo(() => {
    if (filterTopic === 'all') return vocabularies;
    return vocabularies.filter((v) => v.topic_id === filterTopic);
  }, [vocabularies, filterTopic]);

  // Counts by status
  const { newCount, learningCount, dueCount, masteredCount, totalCount } = useMemo(() => {
    let n = 0, l = 0, due = 0, m = 0;
    topicVocabs.forEach((v) => {
      if (!v.status || v.status === 'new') {
        n++;
      } else if (v.status === 'mastered') {
        m++;
      } else if (v.status === 'learning') {
        l++;
        const isDue = !v.next_review_at || new Date(v.next_review_at).getTime() <= nowMs;
        if (isDue) {
          due++;
        }
      }
    });
    return { newCount: n, learningCount: l, dueCount: due, masteredCount: m, totalCount: topicVocabs.length };
  }, [topicVocabs, nowMs]);

  // Display labels for static text badges
  const currentTopicTitle = useMemo(() => {
    if (filterTopic === 'all') return `Tất cả bài học (${vocabularies.length} từ)`;
    const topic = topics.find((t) => t.id === filterTopic);
    return topic ? `${topic.title} (${topicVocabs.length} từ)` : 'Bài học';
  }, [filterTopic, topics, vocabularies.length, topicVocabs.length]);

  const currentStatusLabel = useMemo(() => {
    if (filterStatus === 'new') return `🌟 Từ mới (${newCount})`;
    if (filterStatus === 'learning') return `⏰ Đến hạn ôn (${dueCount})`;
    if (filterStatus === 'mastered') return `✅ Đã thuộc (${masteredCount})`;
    return `📚 Tất cả trạng thái (${totalCount})`;
  }, [filterStatus, newCount, dueCount, masteredCount, totalCount]);

  // Filter & sort list based on topic and status
  const activeVocabs = useMemo(() => {
    // Phase 6: If session restored and queue exists, use queue order
    if (isSessionRestored && studyQueue.length > 0) {
      const vocabMap = new Map(topicVocabs.map(v => [v.id, v]));
      return studyQueue
        .map(id => vocabMap.get(id))
        .filter((v): v is Vocabulary => v !== undefined);
    }

    // Initial queue building (no session restore)
    if (filterStatus === 'new') {
      return topicVocabs.filter((v) => !v.status || v.status === 'new');
    }
    if (filterStatus === 'mastered') {
      return topicVocabs.filter((v) => v.status === 'mastered');
    }
    if (filterStatus === 'learning') {
      // Only include words in 'learning' status that are ACTUALLY due for review (next_review_at <= now)
      return topicVocabs.filter((v) => v.status === 'learning' && (!v.next_review_at || new Date(v.next_review_at).getTime() <= nowMs));
    }

    // When filterStatus === 'all': Order: Từ đến hạn -> Từ chưa đến hạn -> Từ mới -> Từ đã thuộc
    const dueWords: Vocabulary[] = [];
    const notDueWords: Vocabulary[] = [];
    const newWords: Vocabulary[] = [];
    const masteredWords: Vocabulary[] = [];

    topicVocabs.forEach((v) => {
      if (v.status === 'learning') {
        const isDue = !v.next_review_at || new Date(v.next_review_at).getTime() <= nowMs;
        if (isDue) {
          dueWords.push(v);
        } else {
          notDueWords.push(v);
        }
      } else if (v.status === 'mastered') {
        masteredWords.push(v);
      } else {
        newWords.push(v);
      }
    });

    // Sort dueWords: earliest next_review_at first (most overdue first)
    dueWords.sort((a, b) => {
      const timeA = a.next_review_at ? new Date(a.next_review_at).getTime() : 0;
      const timeB = b.next_review_at ? new Date(b.next_review_at).getTime() : 0;
      return timeA - timeB;
    });

    // Sort notDueWords: earliest next_review_at first (closest to due time)
    notDueWords.sort((a, b) => {
      const timeA = a.next_review_at ? new Date(a.next_review_at).getTime() : 0;
      const timeB = b.next_review_at ? new Date(b.next_review_at).getTime() : 0;
      return timeA - timeB;
    });

    return [...dueWords, ...notDueWords, ...newWords, ...masteredWords];
  }, [topicVocabs, filterStatus, nowMs, isSessionRestored, studyQueue]);

  // Phase 6: Session restore on mount
  useEffect(() => {
    if (isSessionRestored) return;
    if (activeVocabs.length === 0) return;

    const restoreSession = async () => {
      const userId = await getUserId();
      if (!userId) {
        // No user, initialize queue from activeVocabs
        setStudyQueue(activeVocabs.map(v => v.id));
        setIsSessionRestored(true);
        return;
      }

      const snapshot = loadStudySession(userId);

      // Check if snapshot matches current session context
      if (
        snapshot &&
        snapshot.selectedTopicId === filterTopic &&
        snapshot.initialStatus === filterStatus
      ) {
        // Validate vocabulary IDs still exist
        const vocabMap = new Map(topicVocabs.map(v => [v.id, v]));
        const validIds = snapshot.vocabularyIds.filter(id => vocabMap.has(id));

        if (validIds.length > 0) {
          setStudyQueue(validIds);
          setCurrentIndex(Math.min(snapshot.currentIndex, validIds.length - 1));
          setIsSessionRestored(true);
          return;
        }
      }

      // No valid snapshot, initialize from activeVocabs
      setStudyQueue(activeVocabs.map(v => v.id));
      setIsSessionRestored(true);
    };

    restoreSession();
  }, [activeVocabs, filterTopic, filterStatus, isSessionRestored, getUserId, topicVocabs]);

  // Phase 6 Fix: Clear session only on explicit completion, not unmount
  // sessionStorage naturally handles tab lifecycle
  // Unmount cleanup removed to allow refresh recovery

  // Safe index: clamp currentIndex to valid range when activeVocabs changes
  const safeIndex = useMemo(() => {
    if (activeVocabs.length === 0) return 0;
    if (currentIndex >= activeVocabs.length) return activeVocabs.length - 1;
    if (currentIndex < 0) return 0;
    return currentIndex;
  }, [currentIndex, activeVocabs.length]);

  // Use safe index directly, sync state in next render to avoid cascading updates
  const currentVocab = activeVocabs[safeIndex];

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
  const { quizOptions, correctQuizIndex } = useMemo(() => {
    if (!currentVocab || activeVocabs.length === 0) {
      return { quizOptions: [], correctQuizIndex: 0 };
    }
    const distractors = activeVocabs
      .filter((v) => v.id !== currentVocab.id)
      .map((v) => v.meaning);

    const seededDistractors = seededShuffle(distractors, currentVocab.id + '_distractors').slice(0, 3);
    const choices = [currentVocab.meaning, ...seededDistractors];
    const shuffled = seededShuffle(choices, currentVocab.id + '_choices');

    return {
      quizOptions: shuffled,
      correctQuizIndex: shuffled.indexOf(currentVocab.meaning),
    };
  }, [currentVocab, activeVocabs]);

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

  // Helper for dynamic SRS button interval subtitles
  const getRatingSubtitle = (rating: 'again' | 'hard' | 'good' | 'easy', currentInterval = 0) => {
    // Phase 6: Again now shows queue-based relearning message
    if (rating === 'again') return 'Sau 5 thẻ';
    const formatHoursLabel = (hours: number) => {
      if (hours < 1) {
        const mins = Math.max(1, Math.round(hours * 60));
        return `${mins} phút`;
      }
      if (hours < 24) {
        return `${Math.round(hours)} giờ`;
      }
      const days = Math.round(hours / 24);
      return `${days} ngày`;
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

  // Submission state for atomic RPC
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Synchronous ref lock for duplicate submission prevention
  const ratingSubmitLockRef = useRef<boolean>(false);

  // Handle Progress Rating with SRS
  // Hotfix UX: Optimistic card transition with sequential save
  const handleRating = useCallback(async (isMastered: boolean, rating?: SrsRating) => {
    if (!currentVocab || ratingSubmitLockRef.current) return;

    const srsRating: SrsRating = rating || (isMastered ? 'mastered' : 'good');
    const newStatus = isMastered || srsRating === 'mastered' ? 'mastered' : 'learning';

    // 1. Acquire synchronous lock and disable buttons (prevent double-click/double-submit)
    ratingSubmitLockRef.current = true;
    setIsSubmitting(true);
    setSubmissionError(null);

    // 2. Calculate queue transition IMMEDIATELY (before any await)
    const transition = applyRatingToQueue(
      srsRating,
      studyQueue,
      safeIndex,
      currentVocab.id
    );

    // 3. Store previous state for rollback on save failure
    const previousQueue = studyQueue;
    const previousIndex = safeIndex;
    const previousStats = sessionStats;
    const ratedVocabId = currentVocab.id;

    // ✅ FLASH BUG FIX: Reset flip state SYNCHRONOUSLY before index change
    // This prevents Card B from rendering with Card A's isFlipped state
    setIsFlipped(false);
    setHasRevealedAnswer(false);

    // 4. OPTIMISTIC UPDATE - Card transitions INSTANTLY (< 10ms)
    // EXCEPT for final card: do not show completion until save succeeds
    if (!transition.isComplete) {
      shouldAnimateCardRef.current = true;
      setStudyQueue(transition.queue);
      setCurrentIndex(transition.currentIndex);
    }
    setSessionStats((prev) => ({
      mastered: isMastered || srsRating === 'mastered' ? prev.mastered + 1 : prev.mastered,
      needsReview: !isMastered && srsRating !== 'mastered' ? prev.needsReview + 1 : prev.needsReview,
    }));

    // 5. BACKGROUND SAVE - Does not block card transition (except for final card)
    // ratingSubmitLockRef stays true, preventing rating next card until save completes
    try {
      // Submit rating via service (handles RPC + idempotency)
      await onUpdateProgress(ratedVocabId, newStatus, srsRating);

      // 6. Save session snapshot AFTER server confirms
      if (transition.isComplete) {
        // Final card: Show completion ONLY after save succeeds
        setIsCompleted(true);
        setStudyQueue(transition.queue);
        setCurrentIndex(transition.currentIndex);

        // Clear session on completion
        const userId = await getUserId();
        if (userId) {
          clearStudySession(userId);
        }
        if (!prefersReducedMotion) {
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
      } else {
        // Save session with exact transition result
        const userId = await getUserId();
        if (userId && transition.queue.length > 0) {
          const snapshot: StudySessionSnapshot = {
            version: 1,
            userId,
            mode: filterStatus === 'new' ? 'new' : 'review',
            vocabularyIds: transition.queue,
            currentIndex: transition.currentIndex,
            selectedTopicId: filterTopic,
            initialStatus: filterStatus,
            startedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          saveStudySession(snapshot);
        }
      }
    } catch (err) {
      // 7. ROLLBACK on save failure - revert to previous card
      shouldAnimateCardRef.current = false;
      setStudyQueue(previousQueue);
      setCurrentIndex(previousIndex);
      setSessionStats(previousStats);

      // Show safe error message
      const message = err instanceof Error ? err.message : 'Không thể lưu kết quả. Vui lòng thử lại.';
      setSubmissionError(message);
      console.error('handleRating error:', err);
    } finally {
      // 8. Release lock and re-enable buttons only after save completes (or fails)
      ratingSubmitLockRef.current = false;
      setIsSubmitting(false);
    }
  }, [currentVocab, safeIndex, onUpdateProgress, studyQueue, sessionStats, filterTopic, filterStatus, getUserId, prefersReducedMotion]);

  // Handle Rating Selection from 4 evaluation buttons
  const handleSelectSrsRating = useCallback((srsRating: SrsRating) => {
    if (ratingSubmitLockRef.current) return;
    setShowRatingButtons(false);
    const isMastered = srsRating === 'mastered';
    handleRating(isMastered, srsRating);
    setSubMode('flashcard');
  }, [handleRating]);

  // Handle "Chưa nhớ" -> Immediately transition to next exercise step
  const handleNotRemembered = useCallback(() => {
    // Block during rating submission to prevent state corruption
    if (ratingSubmitLockRef.current) return;

    setShowRatingButtons(false);

    // Phase 9.10A.4: Special case for pronunciation mode
    // "Chưa nhớ" should NOT create rating or requeue card
    // Just return to flashcard mode with same word
    if (subMode === 'pronounce') {
      // Reset pronunciation state
      setIsRecording(false);
      setTranscriptText('');
      setPronounceSubmitted(false);
      setIsPronounceCorrect(null);

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
  }, [subMode]);

  // Handle Delete current vocabulary item
  const handleDeleteCurrentVocab = useCallback(() => {
    if (ratingSubmitLockRef.current || !currentVocab) return;

    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn xóa từ vựng "${currentVocab.word}" khỏi bài học này?`
    );

    if (!confirmed) return;

    if (onDeleteVocabulary) {
      onDeleteVocabulary(currentVocab.id);
    }

    if (currentIndex >= activeVocabs.length - 1) {
      setCurrentIndex(Math.max(0, activeVocabs.length - 2));
    }
  }, [currentVocab, onDeleteVocabulary, currentIndex, activeVocabs.length]);

  // Handle Quiz selection
  const handleQuizSelect = useCallback((idx: number) => {
    if (quizAnswered || ratingSubmitLockRef.current) return;
    setSelectedQuizIndex(idx);
    setQuizAnswered(true);
    // Mark answer as revealed after user selects an option
    setHasRevealedAnswer(true);
  }, [quizAnswered]);

  // Handle edit vocabulary
  const handleEditCurrentVocab = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (
        ratingSubmitLockRef.current ||
        isSubmitting ||
        !currentVocab ||
        !onEditVocabulary
      ) {
        return;
      }

      setShowEditModal(true);
    },
    [currentVocab, isSubmitting, onEditVocabulary]
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
    if (!currentVocab || typingSubmitted || ratingSubmitLockRef.current) return;
    const cleanInput = typedInput.trim().toLowerCase();
    const cleanWord = currentVocab.word.trim().toLowerCase();
    const correct = cleanInput === cleanWord;
    setIsTypingCorrect(correct);
    setTypingSubmitted(true);
    // Mark answer as revealed after checking typing result
    setHasRevealedAnswer(true);
  }, [currentVocab, typingSubmitted, typedInput]);

  // Handle Speech Pronunciation
  const handleStartRecording = () => {
    if (ratingSubmitLockRef.current) return;
    setIsRecording(true);
    setTranscriptText('');

    if (typeof window !== 'undefined') {
      try {
        const win = window as unknown as Record<string, unknown>;
        const SpeechRecognitionClass = (win.SpeechRecognition || win.webkitSpeechRecognition) as unknown as new () => {
          lang: string;
          interimResults: boolean;
          maxAlternatives: number;
          onresult: (event: { results: { transcript: string }[][] }) => void;
          onerror: () => void;
          start: () => void;
        };
        if (!SpeechRecognitionClass) throw new Error('SpeechRecognition not supported');

        const recognition = new SpeechRecognitionClass();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event: { results: { transcript: string }[][] }) => {
          const result = event.results[0][0].transcript;
          setTranscriptText(result);
          setIsRecording(false);
          setPronounceSubmitted(true);
          const isCorrect = result.toLowerCase().includes(currentVocab?.word.toLowerCase() || '');
          setIsPronounceCorrect(isCorrect);
          setHasRevealedAnswer(true);
        };

        recognition.onerror = () => {
          setTimeout(() => {
            setIsRecording(false);
            setPronounceSubmitted(true);
            setIsPronounceCorrect(true);
            setTranscriptText(currentVocab?.word || '');
            setHasRevealedAnswer(true);
          }, 1500);
        };

        recognition.start();
        return;
      } catch {
        // Fallback simulation
      }
    }

    setTimeout(() => {
      setIsRecording(false);
      setPronounceSubmitted(true);
      setIsPronounceCorrect(true);
      setTranscriptText(currentVocab?.word || '');
      setHasRevealedAnswer(true);
    }, 1800);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCompleted || !currentVocab || showSettingsModal || showReportModal || showEditModal) return;

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
      } else if (e.code === 'Tab') {
        e.preventDefault();
        if (!ratingSubmitLockRef.current) {
          setShowRatingButtons(true);
        }
      } else if (e.code === 'Enter') {
        if (subMode === 'typing' && !typingSubmitted) {
          e.preventDefault();
          handleCheckTyping();
        } else if (subMode === 'typing' && typingSubmitted) {
          e.preventDefault();
          if (!ratingSubmitLockRef.current) {
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
    handleNotRemembered,
    playPronunciation,
    handleCheckTyping,
    handleQuizSelect,
  ]);

  const restartSession = async () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsCompleted(false);
    setSessionStats({ mastered: 0, needsReview: 0 });
    setSubMode('flashcard');
    // Phase 6 Fix: Clear session on explicit restart
    const userId = await getUserId();
    if (userId) {
      clearStudySession(userId);
    }
    // Reinitialize queue
    setStudyQueue([]);
    setIsSessionRestored(false);
  };

  // Empty queue guard - render before accessing currentVocab
  if (!activeVocabs || activeVocabs.length === 0 || !currentVocab) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white rounded-[32px] border border-[#FCE7F3] text-center space-y-4 shadow-2xs">
        <BookOpen className="w-12 h-12 text-[#F472B6] mx-auto" />
        <h3 className="font-bold text-lg text-gray-800">
          {filterStatus === 'new'
            ? 'Không có từ mới trong học phần này'
            : filterStatus === 'learning'
            ? 'Không có từ nào đến hạn ôn tập'
            : 'Không có từ vựng nào phù hợp'}
        </h3>
        <p className="text-xs text-gray-500 leading-relaxed">
          {filterStatus === 'new'
            ? 'Tất cả các từ vựng trong học phần này đã được khởi đầu học hoặc đã thuộc. Bạn có thể chọn học tất cả từ hoặc chọn bộ lọc khác.'
            : filterStatus === 'learning'
            ? 'Bạn đã hoàn thành tất cả các từ đến hạn ôn tập lúc này! Bạn có thể học thêm từ mới hoặc ôn tập lại tất cả các từ.'
            : 'Vui lòng chọn bài học khác hoặc quay về Dashboard.'}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {filterStatus === 'new' && totalCount > 0 && (
            <button
              onClick={() => setFilterStatus('all')}
              className="px-5 py-2.5 bg-[#FFF1F2] text-[#ED4F8E] font-bold rounded-2xl text-xs cursor-pointer border border-[#FCE7F3] hover:bg-[#FFE4E6] transition-colors"
            >
              Học tất cả từ ({totalCount} từ)
            </button>
          )}

          {filterStatus === 'learning' && totalCount > 0 && (
            <button
              onClick={() => setFilterStatus('all')}
              className="px-5 py-2.5 bg-[#FFF1F2] text-[#ED4F8E] font-bold rounded-2xl text-xs cursor-pointer border border-[#FCE7F3] hover:bg-[#FFE4E6] transition-colors"
            >
              Ôn tất cả từ ({totalCount} từ)
            </button>
          )}

          <button
            onClick={onBackToDashboard}
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
            onClick={() => onSwitchToQuiz(filterTopic)}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-[#FFF1F2] border border-[#FCE7F3] text-[#ED4F8E] font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer hover:bg-[#FFE4E6]"
          >
            <HelpCircle className="w-4 h-4" />
            Làm Bài Quiz Ngay
          </button>

          <button
            onClick={onBackToDashboard}
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

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-5 pb-8 sm:pb-12 px-4 sm:px-0">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        <button
          onClick={onBackToDashboard}
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
                if (ratingSubmitLockRef.current) return;
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
          <div
            ref={cardTransitionRef}
            key={currentVocab?.id}
            className="relative w-full min-h-[300px] sm:min-h-[320px]"
          >
            <div
            onClick={() => {
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
            }}
            className="relative w-full min-h-[300px] sm:min-h-[320px] [perspective:1000px] cursor-pointer select-none group"
            >
              {/* 3D Rotating Container: CSS owns this transform exclusively. */}
              <div
                className={`w-full h-full min-h-[300px] sm:min-h-[320px] relative transition-transform duration-500 [transform-style:preserve-3d] ${
                  isFlipped ? '[transform:rotateY(180deg)]' : '[transform:rotateY(0deg)]'
                }`}
              >
              {/* FRONT SIDE */}
              <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-between text-center p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-[#FFFDFE] via-white to-[#FFF5F7] border border-[#FCE7F3] shadow-xs hover:shadow-md transition-shadow backface-hidden">
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
                          playPronunciation(currentVocab.word, 'en-GB');
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#FFF1F2] border border-[#FCE7F3] text-[#ED4F8E] hover:bg-[#FFE4E6] text-xs font-bold transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>UK / {currentVocab.phonetic_uk} /</span>
                      </button>
                    )}

                    {currentVocab.phonetic_us && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          playPronunciation(currentVocab.word, 'en-US');
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#FFF1F2] border border-[#FCE7F3] text-[#ED4F8E] hover:bg-[#FFE4E6] text-xs font-bold transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>US / {currentVocab.phonetic_us} /</span>
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
              <div className="absolute inset-0 w-full h-full flex flex-col justify-between text-left p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-[#FFF5F7] via-white to-[#FFF0F5] border border-[#FCE7F3] shadow-xs hover:shadow-md transition-shadow backface-hidden [transform:rotateY(180deg)] overflow-y-auto">
                <div className="space-y-4 my-auto w-full">
                  <div className="text-center">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#ED4F8E] bg-[#FFF1F2] px-3 py-1 rounded-full border border-[#FCE7F3]">
                      Nghĩa từ vựng
                    </span>
                    <h3 className="text-2xl sm:text-3xl font-black text-[#ED4F8E] mt-2">
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
                            playPronunciation(currentVocab.example || '');
                          }}
                          className="p-1.5 rounded-xl text-white bg-gradient-to-r from-[#ED4F8E] to-[#F472B6] hover:opacity-95 flex-shrink-0 cursor-pointer shadow-2xs mt-0.5 transition-transform hover:scale-105 active:scale-95"
                          title="Nghe câu ví dụ"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                        <div>
                          <p className="font-bold text-gray-900 italic text-sm leading-relaxed">
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
                      <span className="px-3 py-1.5 rounded-xl bg-[#E0F2FE] border border-[#BAE6FD] text-[#0284C7] font-bold text-[11px]">
                        {currentVocab.collocations}
                      </span>
                    )}
                    {showSynonyms && currentVocab.synonyms && (
                      <span className="px-3 py-1.5 rounded-xl bg-[#F3E8FF] border border-[#E9D5FF] text-[#A855F7] font-bold text-xs sm:text-sm">
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
        )}

        {/* SUB-MODE 2: TRẮC NGHIỆM */}
        {subMode === 'quiz' && (
          <div className="space-y-6 animate-fadeIn py-2">
            <div className="text-center space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900">
                {currentVocab.word} {showPartOfSpeech && currentVocab.part_of_speech && <span className="text-sm text-gray-400 font-normal">({currentVocab.part_of_speech})</span>}
              </h2>
              <div className="flex items-center justify-center gap-3">
                {currentVocab.phonetic_us && (
                  <button
                    onClick={() => playPronunciation(currentVocab.word)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#ED4F8E]"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>/{currentVocab.phonetic_us}/</span>
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
                    onClick={() => handleQuizSelect(idx)}
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
        )}

        {/* SUB-MODE 3: GÕ TỪ */}
        {subMode === 'typing' && (
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
                  onChange={(e) => setTypedInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (!typingSubmitted) handleCheckTyping();
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
                  onClick={() => setShowHint(!showHint)}
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
                  onClick={handleCheckTyping}
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
        )}

        {/* SUB-MODE 4: PHÁT ÂM */}
        {subMode === 'pronounce' && (
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
                    onClick={handleStartRecording}
                    className="w-20 h-20 mx-auto rounded-full bg-[#0284C7] hover:bg-[#0369A1] text-white flex items-center justify-center shadow-lg transition-all cursor-pointer hover:scale-105"
                  >
                    <Mic className="w-8 h-8" />
                  </button>
                  <p className="text-xs font-bold text-gray-600">Nhấn để nói</p>
                  <button
                    onClick={() => {
                      setPronounceSubmitted(true);
                      setIsPronounceCorrect(true);
                      setHasRevealedAnswer(true);
                    }}
                    className="text-xs text-gray-400 hover:text-gray-700 font-medium cursor-pointer"
                  >
                    ▷ Bỏ qua chế độ này
                  </button>
                </div>
              )}

              {isRecording && (
                <div className="space-y-3">
                  <button
                    onClick={() => setIsRecording(false)}
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
                          <X className="w-5 h-5" />
                          <span>Chưa đúng</span>
                        </>
                      )}
                    </div>
                    <p className="text-lg font-black text-gray-900">
                      {currentVocab.word}
                    </p>
                    {transcriptText && !isPronounceCorrect && (
                      <p className="text-xs text-gray-500 font-medium">
                        Bạn nói: <span className="font-bold text-[#E11D48]">{transcriptText}</span>
                      </p>
                    )}
                    <button
                      onClick={() => playPronunciation(currentVocab.word)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0284C7] hover:underline cursor-pointer pt-1"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Nghe phát âm</span>
                    </button>
                  </div>

                  {!isPronounceCorrect && (
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <button
                        onClick={handleStartRecording}
                        className="px-4 py-2 rounded-xl bg-white border border-[#FCE7F3] text-gray-700 font-bold text-xs hover:bg-[#FFF1F2] cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5 inline mr-1" />
                        Nói lại
                      </button>
                      <button
                        onClick={handleNotRemembered}
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
            <button
              onClick={() => setSubmissionError(null)}
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
                if (!ratingSubmitLockRef.current) {
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
            <span className="text-gray-500 hidden sm:inline">Từ mới</span>
            <span className="text-gray-500 sm:hidden">Mới</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[#A855F7] font-black">{sessionStats.mastered}</span>
            <span className="text-gray-500 hidden sm:inline">Đã học</span>
            <span className="text-gray-500 sm:hidden">Học</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[#ED4F8E] font-black">{sessionStats.needsReview}</span>
            <span className="text-gray-500 hidden sm:inline">Ôn tập</span>
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

              {/* 2. Hiện ví dụ */}
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
