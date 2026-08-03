import { useCallback, useRef, useState } from 'react';
import type { SynonymPracticeMode, SynonymPracticeResult, SynonymSessionAnswer } from '../types';

interface UseSynonymPracticeSessionOptions {
  mode: SynonymPracticeMode;
  totalQuestions: number;
  onComplete: (result: SynonymPracticeResult) => void;
}

export function useSynonymPracticeSession({ mode, totalQuestions, onComplete }: UseSynonymPracticeSessionOptions) {
  const [startedAt] = useState(() => Date.now());
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);
  const answersRef = useRef<SynonymSessionAnswer[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [answers, setAnswers] = useState<SynonymSessionAnswer[]>([]);

  const recordAnswer = useCallback((answer: SynonymSessionAnswer) => {
    answersRef.current = [...answersRef.current, answer];
    setAnswers(answersRef.current);
    if (answer.isCorrect) {
      scoreRef.current += 1;
      streakRef.current += 1;
      bestStreakRef.current = Math.max(bestStreakRef.current, streakRef.current);
      setScore(scoreRef.current);
      setBestStreak(bestStreakRef.current);
    } else {
      streakRef.current = 0;
    }
  }, []);

  const next = useCallback(() => {
    if (questionIndex + 1 < totalQuestions) {
      setQuestionIndex((current) => current + 1);
      return;
    }

    const elapsedSeconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
    onComplete({
      mode,
      totalQuestions,
      correctAnswers: scoreRef.current,
      scorePercentage: totalQuestions ? Math.round((scoreRef.current / totalQuestions) * 100) : 0,
      elapsedSeconds,
      bestStreak: bestStreakRef.current,
      answers: answersRef.current,
    });
  }, [mode, onComplete, questionIndex, startedAt, totalQuestions]);

  const finish = useCallback(() => {
    const elapsedSeconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
    onComplete({
      mode,
      totalQuestions,
      correctAnswers: scoreRef.current,
      scorePercentage: totalQuestions ? Math.round((scoreRef.current / totalQuestions) * 100) : 0,
      elapsedSeconds,
      bestStreak: bestStreakRef.current,
      answers: answersRef.current,
    });
  }, [mode, onComplete, startedAt, totalQuestions]);

  return {
    questionIndex,
    score,
    bestStreak,
    answers,
    recordAnswer,
    next,
    finish,
    progress: totalQuestions ? ((questionIndex + 1) / totalQuestions) * 100 : 0,
  };
}
