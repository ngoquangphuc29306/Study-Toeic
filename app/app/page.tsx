'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Navbar } from '../../components/Navbar';
import { Dashboard } from '../../components/Dashboard';
import { AddVocabModal } from '../../components/AddVocabModal';
import { CollectionModal } from '../../components/CollectionModal';
import { ExcelImportModal } from '../../components/ExcelImportModal';
import { SqlScriptModal } from '../../components/SqlScriptModal';
import { useToast } from '../../contexts/ToastContext';
import { updateVocabulary } from '../../services/vocabularyService';
import { ReviewReminderPopup, useReviewReminder } from '../../features/review-reminder';

// RC15 Code Splitting: Lazy-load tab components that are not rendered by default
// Only Dashboard renders on initial page load; other tabs load on demand
function TabLoadingFallback() {
  return (
    <div
      className="flex min-h-[400px] items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <span className="text-[#5C635D]">Đang tải nội dung...</span>
    </div>
  );
}

const FlashcardMode = dynamic(
  () => import('../../components/FlashcardMode').then((mod) => mod.FlashcardMode),
  { loading: () => <TabLoadingFallback /> }
);

const SynonymPractice = dynamic(
  () => import('../../features/synonym-practice').then((mod) => mod.SynonymPractice),
  { loading: () => <TabLoadingFallback /> }
);

const VocabManager = dynamic(
  () => import('../../components/VocabManager').then((mod) => mod.VocabManager),
  { loading: () => <TabLoadingFallback /> }
);

import {
  updateUserProgress,
  SrsRating,
  addCollection,
  deleteCollection,
  updateCollection,
  addTopic,
  deleteTopic,
  updateTopic,
  addVocabulary,
  bulkAddVocabularies,
  deleteVocabulary
} from '../../services/vocabService';
import { CollectionHasChildrenError } from '../../services/collectionErrors';
import { TopicHasVocabulariesError } from '../../services/topicErrors';
import { VocabularyValidationError } from '../../services/vocabularyErrors';
import type { RatingResult } from '../../services/progressService';
import { loadAppDataSnapshot, type AppDataSnapshot } from '../../services/appDataService';
import { createClient } from '@/lib/supabase/client';
import { clearStudySession } from '@/lib/session/storage';
import { buildLoginUrl } from '@/lib/auth/safe-redirect';
import {
  exportVocabulariesAsCSV,
  exportBackupAsJSON
} from '../../services/importExportService';
import {
  getDashboardMetrics,
  getWeekActivity,
  type DashboardMetrics
} from '../../services/dashboardService';
import { createRequestCoordinator } from '../../lib/data/requestCoordinator';
import { isCurrentRequest } from '../../lib/data/requestGeneration';
import { applyRatingResult } from '../../lib/srs/applyRatingResult';
import { deriveStudyStats, mergeVocabularyProgressIntoMetrics } from '../../lib/srs/deriveProgress';

import { Collection, FlashcardInitialFilter, Topic, Vocabulary, StudyStats, LearningStatus } from '../../lib/types';

type CreateModalMode = 'collection' | 'section';
type VocabularyUpdate = Partial<
  Pick<
    Vocabulary,
    | 'word'
    | 'phonetic_uk'
    | 'phonetic_us'
    | 'part_of_speech'
    | 'meaning'
    | 'example'
    | 'example_translation'
    | 'synonyms'
    | 'collocations'
    | 'audio_url'
    | 'note'
  >
>;
type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';
type DataStatus = 'idle' | 'loading' | 'success' | 'error';

const DATA_STALE_MS = 5 * 60 * 1000;
const RESUME_DEBOUNCE_MS = 750;

interface DerivedDataSnapshot {
  dashboardMetrics: DashboardMetrics;
  weekActivity: Array<{ date: string; count: number }>;
}

const appDataCoordinator = createRequestCoordinator<AppDataSnapshot>();
const derivedDataCoordinator = createRequestCoordinator<DerivedDataSnapshot>();

export default function AppPage() {
  const router = useRouter();
  const { showToast } = useToast();

  // Auth state
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'flashcard' | 'synonyms' | 'vocab-manager'>('dashboard');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('all');
  const [initialFlashcardStatus, setInitialFlashcardStatus] = useState<FlashcardInitialFilter | undefined>(undefined);
  const [defaultModalTopicId, setDefaultModalTopicId] = useState<string | undefined>(undefined);

  const [collections, setCollections] = useState<Collection[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [vocabularies, setVocabularies] = useState<Vocabulary[]>([]);
  const [stats, setStats] = useState<StudyStats>({
    totalWords: 0,
    masteredCount: 0,
    learningCount: 0,
    newCount: 0,
    dailyStreak: 3,
    todayStudiedCount: 0,
  });

  // Phase 9.8: Dashboard metrics ownership (single source of truth for streak)
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [weekActivity, setWeekActivity] = useState<Array<{ date: string; count: number }>>([]);
  const [isLoadingDashboardMetrics, setIsLoadingDashboardMetrics] = useState(true);

  // Extract authoritative streak for Navbar
  const currentStreak = dashboardMetrics?.studyStreak ?? 0;

  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState<boolean>(false);
  const [collectionModalMode, setCollectionModalMode] = useState<CreateModalMode>('collection');
  const [collectionModalDefaultId, setCollectionModalDefaultId] = useState<string | undefined>(undefined);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState<boolean>(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState<boolean>(false);
  const [editingVocabulary, setEditingVocabulary] = useState<Vocabulary | null>(null);
  const [dataStatus, setDataStatus] = useState<DataStatus>('idle');
  const [dataError, setDataError] = useState<string | null>(null);
  const [lastDataLoadedAt, setLastDataLoadedAt] = useState<number | null>(null);
  const [lastStudySessionCompletedAt, setLastStudySessionCompletedAt] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string>('');

  const previousUserIdRef = useRef<string | null>(null);
  const authStatusRef = useRef<AuthStatus>('loading');
  const authUserIdRef = useRef<string | null>(null);
  const dataStatusRef = useRef<DataStatus>('idle');
  const lastDataLoadedAtRef = useRef<number | null>(null);
  const hasSuccessfulDataRef = useRef(false);
  const loadGenerationRef = useRef(0);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ratingDerivedRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ratingDerivedRetryAttemptRef = useRef(0);
  const ratingDerivedNeedsRetryRef = useRef(false);
  const ratingDerivedWarningShownRef = useRef(false);
  const ratingDerivedRefreshRef = useRef<() => void>(() => undefined);
  const sessionCheckResolvedRef = useRef(false);
  const vocabulariesRef = useRef<Vocabulary[]>([]);
  const localDataRevisionRef = useRef(0);

  // Helper to re-fetch data
  // RC2 Fix: Used only for mutations (add/update/delete), NOT for initial load
  const refreshAppData = useCallback(async () => {
    const currentUserId = authUserIdRef.current;
    if (authStatusRef.current !== 'authenticated' || !currentUserId) return;

    const generation = ++loadGenerationRef.current;
    const localRevisionAtRequest = localDataRevisionRef.current;
    const hadUsableData = hasSuccessfulDataRef.current;
    dataStatusRef.current = 'loading';
    setDataStatus('loading');
    setDataError(null);
    if (!hadUsableData) setIsLoadingDashboardMetrics(true);

    const request = (async () => {
      try {
        const snapshot = await appDataCoordinator.getOrCreate(
          currentUserId,
          () => loadAppDataSnapshot(currentUserId)
        );

        if (!isCurrentRequest(
          { userId: currentUserId, generation },
          { userId: authUserIdRef.current || '', generation: loadGenerationRef.current }
        ) || authStatusRef.current !== 'authenticated') return;

        const hasLocalChanges = localDataRevisionRef.current !== localRevisionAtRequest;
        const effectiveVocabularies = hasLocalChanges
          ? vocabulariesRef.current
          : snapshot.vocabularies;

        setCollections(snapshot.collections);
        setTopics(snapshot.topics);
        vocabulariesRef.current = effectiveVocabularies;
        setVocabularies(effectiveVocabularies);
        setStats(hasLocalChanges ? deriveStudyStats(effectiveVocabularies) : snapshot.stats);
        setDashboardMetrics(
          mergeVocabularyProgressIntoMetrics(snapshot.dashboardMetrics, effectiveVocabularies)
        );
        setWeekActivity(snapshot.weekActivity);
        hasSuccessfulDataRef.current = true;
        dataStatusRef.current = 'success';
        setDataStatus('success');
        setDataError(null);
        const loadedAt = Date.now();
        lastDataLoadedAtRef.current = loadedAt;
        setLastDataLoadedAt(loadedAt);
        setIsLoadingDashboardMetrics(false);
        ratingDerivedNeedsRetryRef.current = false;
        ratingDerivedRetryAttemptRef.current = 0;
        ratingDerivedWarningShownRef.current = false;
      } catch (err) {
        console.error('Error loading EasyTOEIC data:', err);
        if (!isCurrentRequest(
          { userId: currentUserId, generation },
          { userId: authUserIdRef.current || '', generation: loadGenerationRef.current }
        ) || authStatusRef.current !== 'authenticated') return;

        dataStatusRef.current = 'error';
        setDataStatus('error');
        setDataError(err instanceof Error ? err.message : 'Unable to load data. Please try again.');
        // Keep the last successful snapshot. Only sign-out/user-switch reset
        // is allowed to replace domain arrays with [] (see clearAppData).
        setIsLoadingDashboardMetrics(false);
      }
    })();
    return request;
  }, []);

  // Phase 2C Fix: Auth state change listener
  // Phase 6 Fix: Track user identity to detect actual user switches
  // Phase 9.5: Application-level auth listener (scoped to /app route)
  //
  // Mount Scope: /app route only
  // - Does NOT run when recovery links open /reset-password directly
  // - PASSWORD_RECOVERY handling moved to root-level AuthEventBridge
  // - This listener manages application state for signed-in users
  /* Legacy auth/data effects replaced by the session-aware loader below.

  useEffect(() => {
    const supabase = createClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      const currentUserId = session?.user?.id || null;
      const previousUserId = previousUserIdRef.current;

      // Defensive: Only handle events when actually on /app route
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/app')) {
        return;
      }

      if (event === 'PASSWORD_RECOVERY') {
        // PASSWORD_RECOVERY is handled by root-level AuthEventBridge
        // This is a fallback if user reaches /app during recovery flow
        return; // Don't reload app data during recovery flow
      }

      if (event === 'SIGNED_OUT') {
        // Clear the outgoing user's session
        if (previousUserId) {
          clearStudySession(previousUserId);
        }

        // Clear all state immediately
        setCollections([]);
        setTopics([]);
        setVocabularies([]);
        setStats({
          totalWords: 0,
          masteredCount: 0,
          learningCount: 0,
          newCount: 0,
          dailyStreak: 0,
          todayStudiedCount: 0,
        });
        setDashboardMetrics(null);
        setWeekActivity([]);
        setIsLoadingDashboardMetrics(true);
        setSelectedTopicId('all');

        previousUserIdRef.current = null;

        // Navbar will clear its profile state on next render
        // No need to call getCurrentProfile() after sign out
      } else if (event === 'SIGNED_IN') {
        // SIGNED_IN: New authentication session established
        // This is a real login, not just a user metadata update

        // Validate session exists
        if (!session?.user) {
          return;
        }

        // Detect actual user identity change (Alice → Bob)
        const userChanged = previousUserId !== null && previousUserId !== currentUserId;

        if (userChanged && previousUserId) {
          // Clear the previous user's session
          clearStudySession(previousUserId);
        }

        // Clear all state on user change or initial sign-in
        if (userChanged || previousUserId === null) {
          setCollections([]);
          setTopics([]);
          setVocabularies([]);
          setStats({
            totalWords: 0,
            masteredCount: 0,
            learningCount: 0,
            newCount: 0,
            dailyStreak: 0,
            todayStudiedCount: 0,
          });
          setDashboardMetrics(null);
          setWeekActivity([]);
          setIsLoadingDashboardMetrics(true);
          setSelectedTopicId('all');
        }

        // Update tracked user ID
        previousUserIdRef.current = currentUserId;

        // RC2 Fix: Do NOT reload data here
        // Auth initialization flow (useEffect[authStatus]) is the single source
        // of initial data load after SIGNED_IN completes.
        // This prevents duplicate 12-query load on fresh login.
      } else if (event === 'USER_UPDATED') {
        // USER_UPDATED: User metadata changed (name, avatar, password, etc.)
        // This is NOT a new login - do not treat it as SIGNED_IN

        // Defensive: Ignore USER_UPDATED during password recovery flow
        if (typeof window !== 'undefined') {
          const recoveryMarker = sessionStorage.getItem('password_recovery_flow');
          if (recoveryMarker) {
            // Password recovery in progress - ignore this event
            return;
          }
        }

        // For USER_UPDATED on /app:
        // - Do NOT clear all app state
        // - Do NOT reload collections/topics/vocabulary/dashboard
        // - Profile will be refreshed by Navbar's own effect when needed
        // - No action required here

        // Update tracked user ID if it changed (edge case: user ID shouldn't change on update)
        if (currentUserId && currentUserId !== previousUserId) {
          previousUserIdRef.current = currentUserId;
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Auth Initialization Guard
  // Check authentication BEFORE loading any data
  // Flow: checking → verify user → authenticated OR redirect to login
  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const supabase = createClient();
        const { data: { user }, error } = await supabase.auth.getUser();

        if (!isMounted) return;

        if (error || !user) {
          // Not authenticated - redirect to login with return path
          const loginUrl = buildLoginUrl('/app');
          router.replace(loginUrl);
          setAuthStatus('unauthenticated');
          return;
        }

        // Authenticated - mark as ready
        setAuthStatus('authenticated');
      } catch (err) {
        console.error('Auth check error:', err);
        if (isMounted) {
          // On error, redirect to login
          const loginUrl = buildLoginUrl('/app');
          router.replace(loginUrl);
          setAuthStatus('unauthenticated');
        }
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [router]);

  // Initial Data Load
  // Only runs AFTER authentication is confirmed
  // RC2 Fix: This is the SINGLE source of initial data load
  // Runs after fresh login, page refresh, and user switching
  useEffect(() => {
    // Wait for auth confirmation
    if (authStatus !== 'authenticated') {
      return;
    }

    let isMounted = true;
    const initData = async () => {
      try {
        const [fetchedCols, fetchedTopics, fetchedVocab, fetchedStats, fetchedMetrics, fetchedWeek] = await Promise.all([
          getCollections(),
          getTopics(),
          getVocabByTopic('all'),
          getStudyStats(),
          getDashboardMetrics(),
          getWeekActivity(),
        ]);
        if (isMounted) {
          setCollections(fetchedCols);
          setTopics(fetchedTopics);
          setVocabularies(fetchedVocab);
          setStats(fetchedStats);
          setDashboardMetrics(fetchedMetrics);
          setWeekActivity(fetchedWeek);
          setIsLoadingDashboardMetrics(false);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error loading EasyTOEIC data:', err);
        if (isMounted) {
          setIsLoadingDashboardMetrics(false);
          setIsLoading(false);
        }
      }
    };

    initData();
    return () => {
      isMounted = false;
    };
  }, [authStatus]); // Dependency on authStatus to run after auth confirmed */

  const commitVocabularies = useCallback((
    nextOrUpdater: Vocabulary[] | ((current: Vocabulary[]) => Vocabulary[])
  ) => {
    const next = typeof nextOrUpdater === 'function'
      ? nextOrUpdater(vocabulariesRef.current)
      : nextOrUpdater;

    localDataRevisionRef.current += 1;
    vocabulariesRef.current = next;
    setVocabularies(next);
    setStats(deriveStudyStats(next));
    setDashboardMetrics((previous) => previous
      ? mergeVocabularyProgressIntoMetrics(previous, next)
      : previous);
  }, []);

  const clearAppData = useCallback((outgoingUserId: string | null) => {
    if (outgoingUserId) clearStudySession(outgoingUserId);

    loadGenerationRef.current += 1;
    localDataRevisionRef.current += 1;
    if (outgoingUserId) {
      appDataCoordinator.clear(outgoingUserId);
      derivedDataCoordinator.clear(outgoingUserId);
    }
    hasSuccessfulDataRef.current = false;
    lastDataLoadedAtRef.current = null;
    vocabulariesRef.current = [];
    setCollections([]);
    setTopics([]);
    setVocabularies([]);
    setStats({
      totalWords: 0,
      masteredCount: 0,
      learningCount: 0,
      newCount: 0,
      dailyStreak: 0,
      todayStudiedCount: 0,
    });
    setDashboardMetrics(null);
    setWeekActivity([]);
    setIsLoadingDashboardMetrics(true);
    dataStatusRef.current = 'idle';
    setDataStatus('idle');
    setDataError(null);
    setLastDataLoadedAt(null);
    setLastStudySessionCompletedAt(null);
    setSelectedTopicId('all');
    setDeleteError('');
    ratingDerivedNeedsRetryRef.current = false;
    ratingDerivedRetryAttemptRef.current = 0;
    ratingDerivedWarningShownRef.current = false;
  }, []);

  const scheduleResumeRefresh = useCallback(() => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);

    resumeTimerRef.current = setTimeout(() => {
      resumeTimerRef.current = null;
      if (
        typeof document === 'undefined' ||
        document.visibilityState !== 'visible' ||
        authStatusRef.current !== 'authenticated' ||
        !authUserIdRef.current ||
        (typeof navigator !== 'undefined' && navigator.onLine === false)
      ) return;

      const isStale = !lastDataLoadedAtRef.current || Date.now() - lastDataLoadedAtRef.current > DATA_STALE_MS;
      const shouldRefreshApp = dataStatusRef.current === 'error' || dataStatusRef.current === 'idle' || isStale;
      if (shouldRefreshApp) {
        void refreshAppData();
      } else if (ratingDerivedNeedsRetryRef.current) {
        ratingDerivedRefreshRef.current();
      }
    }, RESUME_DEBOUNCE_MS);
  }, [refreshAppData]);

  const handleAuthSession = useCallback((event: AuthChangeEvent, session: { user?: { id: string } } | null) => {
    const currentUserId = session?.user?.id || null;
    const previousUserId = previousUserIdRef.current;

    if (event === 'PASSWORD_RECOVERY') return;

    // A delayed INITIAL_SESSION(null) must not erase a session that has
    // already been restored by getSession(). Only SIGNED_OUT is authoritative
    // for clearing an already authenticated user.
    if (event !== 'SIGNED_OUT' && !currentUserId && authUserIdRef.current) return;

    if (event === 'SIGNED_OUT' || !currentUserId) {
      if (event === 'SIGNED_OUT' || sessionCheckResolvedRef.current) {
        clearAppData(previousUserId);
        previousUserIdRef.current = null;
        authUserIdRef.current = null;
        authStatusRef.current = 'unauthenticated';
        setAuthUserId(null);
        setAuthStatus('unauthenticated');
        if (event === 'SIGNED_OUT') router.replace(buildLoginUrl('/app'));
      }
      return;
    }

    const userChanged = previousUserId !== null && previousUserId !== currentUserId;
    if (userChanged) clearAppData(previousUserId);

    previousUserIdRef.current = currentUserId;
    authUserIdRef.current = currentUserId;
    authStatusRef.current = 'authenticated';
    setAuthUserId(currentUserId);
    setAuthStatus('authenticated');

    // Keep the auth callback lightweight; wait until session storage settles.
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
      setTimeout(() => void refreshAppData(), 0);
    } else if (event === 'TOKEN_REFRESHED') {
      scheduleResumeRefresh();
    }
  }, [clearAppData, refreshAppData, router, scheduleResumeRefresh]);

  useEffect(() => {
    let isMounted = true;
    let authRetryTimer: ReturnType<typeof setTimeout> | null = null;
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (isMounted) handleAuthSession(event, session);
    });

    const resolveInitialSession = async (retry = false) => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (!isMounted) return;

      if (error) {
        console.error('Auth session restore error:', error);
        if (!retry) authRetryTimer = setTimeout(() => void resolveInitialSession(true), 1000);
        return;
      }

      sessionCheckResolvedRef.current = true;
      handleAuthSession('INITIAL_SESSION', session);
      if (!session) router.replace(buildLoginUrl('/app'));
    };

    void resolveInitialSession();
    return () => {
      isMounted = false;
      if (authRetryTimer) clearTimeout(authRetryTimer);
      subscription.unsubscribe();
    };
  }, [handleAuthSession, router]);

  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        scheduleResumeRefresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('online', handleVisibilityOrFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('online', handleVisibilityOrFocus);
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, [scheduleResumeRefresh]);

  // Rating has two independent phases: the RPC mutation is critical for the
  // study session; aggregates are eventually consistent and must never reject it.
  const refreshRatingDerivedData = useCallback(async (): Promise<void> => {
    const currentUserId = authUserIdRef.current;
    if (authStatusRef.current !== 'authenticated' || !currentUserId) return;

    const generation = loadGenerationRef.current;
    const request = derivedDataCoordinator.getOrCreate(currentUserId, async () => {
      const [dashboardMetrics, weekActivity] = await Promise.all([
        getDashboardMetrics(currentUserId),
        getWeekActivity(currentUserId),
      ]);
      return { dashboardMetrics, weekActivity };
    });

    try {
      const snapshot = await request;
      if (!isCurrentRequest(
        { userId: currentUserId, generation },
        { userId: authUserIdRef.current || '', generation: loadGenerationRef.current }
      ) || authStatusRef.current !== 'authenticated') return;

      setDashboardMetrics(
        mergeVocabularyProgressIntoMetrics(snapshot.dashboardMetrics, vocabulariesRef.current)
      );
      setWeekActivity(snapshot.weekActivity);
      ratingDerivedNeedsRetryRef.current = false;
      ratingDerivedRetryAttemptRef.current = 0;
      ratingDerivedWarningShownRef.current = false;
      if (ratingDerivedRetryTimerRef.current) {
        clearTimeout(ratingDerivedRetryTimerRef.current);
        ratingDerivedRetryTimerRef.current = null;
      }
    } catch (error) {
      if (!isCurrentRequest(
        { userId: currentUserId, generation },
        { userId: authUserIdRef.current || '', generation: loadGenerationRef.current }
      ) || authStatusRef.current !== 'authenticated') return;

      ratingDerivedNeedsRetryRef.current = true;
      console.warn('Some derived rating data could not be refreshed. Keeping the last successful snapshot.', error);

      if (!ratingDerivedWarningShownRef.current) {
        ratingDerivedWarningShownRef.current = true;
        showToast('Đã lưu đánh giá. Một số thống kê sẽ được cập nhật lại sau.', 'info');
      }

      // Retry once in the background. Further retries happen on focus/resume.
      if (ratingDerivedRetryAttemptRef.current === 0 && !ratingDerivedRetryTimerRef.current) {
        ratingDerivedRetryAttemptRef.current = 1;
        ratingDerivedRetryTimerRef.current = setTimeout(() => {
          ratingDerivedRetryTimerRef.current = null;
          void ratingDerivedRefreshRef.current();
        }, 3000);
      }
    }
  }, [showToast]);

  useEffect(() => {
    ratingDerivedRefreshRef.current = () => {
      void refreshRatingDerivedData();
    };
  }, [refreshRatingDerivedData]);

  useEffect(() => {
    return () => {
      if (ratingDerivedRetryTimerRef.current) clearTimeout(ratingDerivedRetryTimerRef.current);
    };
  }, []);

  // The RPC result is the immediate progress source of truth. Derived refresh
  // runs separately and intentionally cannot reject this mutation promise.
  const handleUpdateProgress = useCallback(async (
    vocabId: string,
    status: LearningStatus,
    rating?: SrsRating,
    idempotencyKey?: string
  ): Promise<RatingResult> => {
    // Callers that own a retry lifecycle provide the original key. Legacy or
    // non-retrying callers still get one key per logical mutation invocation.
    const mutationIdempotencyKey = idempotencyKey || crypto.randomUUID();
    const ratingResult = await updateUserProgress(vocabId, status, rating, mutationIdempotencyKey);

    const patchedVocabularies = vocabulariesRef.current.map((vocabulary) => (
      vocabulary.id === vocabId ? applyRatingResult(vocabulary, ratingResult) : vocabulary
    ));
    commitVocabularies(patchedVocabularies);

    void refreshRatingDerivedData();
    return ratingResult;
  }, [commitVocabularies, refreshRatingDerivedData]);

  const handleAddCollection = async (newCol: Omit<Collection, 'id'>) => {
    try {
      const col = await addCollection(newCol);

      // Batch Fix Phase 2: Only update collections state, do NOT refetch all app data
      // Add operation only changes collections table (1 row added)
      // Topics, vocabularies, stats, metrics, week activity are unchanged
      setCollections((prevCollections) => [...prevCollections, col]);

      showToast('Tạo bộ sưu tập thành công! ✨', 'success');
      return col;
    } catch (err) {
      console.error('Add collection error:', err);
      showToast('Không thể tạo bộ sưu tập. Vui lòng thử lại.', 'error');
      throw err;
    }
  };

  const handleUpdateCollection = async (colId: string, updates: Partial<Collection>) => {
    try {
      // Batch Fix Phase 3: Update local state immediately, then save to server
      // No refetch needed - only 1 collection modified, no dependencies changed
      await updateCollection(colId, updates);

      setCollections((prev) => prev.map((c) => (c.id === colId ? { ...c, ...updates } : c)));
      showToast('Cập nhật bộ sưu tập thành công! ✨', 'success');
    } catch (err) {
      console.error('Update collection error:', err);
      showToast('Không thể cập nhật bộ sưu tập. Vui lòng thử lại.', 'error');
      throw err;
    }
  };

  const handleUpdateTopic = async (topicId: string, updates: Partial<Topic>) => {
    try {
      // Batch Fix Phase 5: Update local state immediately, then save to server
      // No refetch needed - only 1 topic modified, no dependencies changed
      await updateTopic(topicId, updates);

      setTopics((prev) => prev.map((t) => (t.id === topicId ? { ...t, ...updates } : t)));
      showToast('Cập nhật học phần thành công! ✨', 'success');
    } catch (err) {
      console.error('Update topic error:', err);
      showToast('Không thể cập nhật học phần. Vui lòng thử lại.', 'error');
      throw err;
    }
  };

  const handleDeleteCollection = async (colId: string) => {
    try {
      await deleteCollection(colId);

      setCollections((currentCollections) => currentCollections.filter((collection) => collection.id !== colId));
      showToast('Xóa bộ sưu tập thành công! ✨', 'success');
    } catch (err) {
      if (err instanceof CollectionHasChildrenError) {
        showToast('Không thể xóa bộ sưu tập này vì vẫn còn chủ đề hoặc từ vựng. Hãy xóa dữ liệu bên trong trước.', 'error');
      } else if (err instanceof Error) {
        showToast(err.message, 'error');
      } else {
        showToast('Không thể xóa bộ sưu tập. Vui lòng thử lại.', 'error');
      }
      throw err;
    }
  };

  const handleAddTopic = async (newTopic: Omit<Topic, 'id'>) => {
    try {
      const topic = await addTopic(newTopic);

      // Batch Fix Phase 4: Only update topics state, do NOT refetch all app data
      // Add operation only changes topics table (1 row added)
      // Collections, vocabularies, stats, metrics, week activity are unchanged
      setTopics((prevTopics) => [...prevTopics, topic]);

      showToast('Tạo học phần thành công! ✨', 'success');
      return topic;
    } catch (err) {
      console.error('Add topic error:', err);
      showToast('Không thể tạo học phần. Vui lòng thử lại.', 'error');
      throw err;
    }
  };

  const handleDeleteTopic = async (topicId: string) => {
    try {
      await deleteTopic(topicId);

      // RC1 Fix: Only update topics state, do NOT refetch all app data
      // Delete operation only changes topics table (1 row removed)
      // Collections, vocabularies, stats, metrics, week activity are unchanged
      setTopics(prevTopics => prevTopics.filter(t => t.id !== topicId));

      // Reset selection if deleted topic was currently selected
      if (selectedTopicId === topicId) {
        setSelectedTopicId('all');
      }

      showToast('Xóa học phần thành công! ✨', 'success');
    } catch (err) {
      if (err instanceof TopicHasVocabulariesError) {
        showToast('Không thể xóa học phần này vì vẫn còn từ vựng. Hãy xóa từ vựng bên trong trước.', 'error');
      } else if (err instanceof Error) {
        showToast(err.message, 'error');
      } else {
        showToast('Không thể xóa học phần. Vui lòng thử lại.', 'error');
      }
      throw err;
    }
  };

  const handleAddVocabulary = async (newVocab: Omit<Vocabulary, 'id'>) => {
    try {
      const createdVocab = await addVocabulary(newVocab);

      // Batch Fix Phase 6: Add vocabulary with default progress + targeted refetch
      // New vocabulary has no progress yet (status='new', review_count=0)
      const vocabWithDefaultProgress: Vocabulary = {
        ...createdVocab,
        status: 'new',
        review_count: 0,
        last_reviewed_at: undefined,
        next_review_at: undefined,
        interval_hours: undefined,
        again_count: 0,
        is_difficult: false,
      };

      commitVocabularies((prevVocabs) => [...prevVocabs, vocabWithDefaultProgress]);
      void refreshRatingDerivedData();

      showToast('Thêm từ vựng thành công! ✨', 'success');
    } catch (err) {
      console.error('Add vocabulary error:', err);
      showToast('Không thể thêm từ vựng. Vui lòng thử lại.', 'error');
      throw err;
    }
  };

  const handleUpdateVocabulary = async (
    vocabId: string,
    updates: VocabularyUpdate
  ): Promise<void> => {
    try {
      await updateVocabulary(vocabId, updates);

      commitVocabularies((currentVocabularies) =>
        currentVocabularies.map((vocabulary) =>
          vocabulary.id === vocabId
            ? { ...vocabulary, ...updates }
            : vocabulary
        )
      );

      showToast(
        'Cập nhật từ vựng thành công! ✨',
        'success'
      );
    } catch (err) {
      console.error('Update vocabulary error:', err);

      showToast(
        err instanceof Error
          ? err.message
          : 'Không thể cập nhật từ vựng. Vui lòng thử lại.',
        'error'
      );

      throw err;
    }
  };

  const handleBulkAddVocabularies = async (items: Omit<Vocabulary, 'id'>[]) => {
    try {
      const createdVocabs = await bulkAddVocabularies(items);

      // Batch Fix Phase 7: Add all vocabularies with default progress + targeted refetch
      // New vocabularies have no progress yet (status='new', review_count=0)
      const vocabsWithDefaultProgress: Vocabulary[] = createdVocabs.map((vocab) => ({
        ...vocab,
        status: 'new' as const,
        review_count: 0,
        last_reviewed_at: undefined,
        next_review_at: undefined,
        interval_hours: undefined,
        again_count: 0,
        is_difficult: false,
      }));

      commitVocabularies((prevVocabs) => [...prevVocabs, ...vocabsWithDefaultProgress]);
      void refreshRatingDerivedData();

      showToast(`Import thành công ${createdVocabs.length} từ vựng! ✨`, 'success');
    } catch (err) {
      console.error('Bulk add vocabularies error:', err);
      showToast('Không thể import từ vựng. Vui lòng thử lại.', 'error');
      throw err;
    }
  };

  const handleDeleteVocabulary = async (vocabId: string) => {
    try {
      await deleteVocabulary(vocabId);

      // Batch Fix Phase 8: Remove vocabulary from state + targeted refetch
      // Deletion affects vocabulary count, so stats and metrics must be refetched
      commitVocabularies((prevVocabs) => prevVocabs.filter((v) => v.id !== vocabId));
      void refreshRatingDerivedData();

      showToast('Xóa từ vựng thành công! ✨', 'success');
    } catch (err) {
      console.error('Delete vocabulary error:', err);
      showToast('Không thể xóa từ vựng. Vui lòng thử lại.', 'error');
      throw err;
    }
  };

  // Switchers
  const handleSelectTopicForFlashcard = (topicId: string, initialStatus?: FlashcardInitialFilter) => {
    setSelectedTopicId(topicId);
    setInitialFlashcardStatus(initialStatus);
    setActiveTab('flashcard');
  };

  const handleSelectTopicForSynonyms = (topicId: string) => {
    setSelectedTopicId(topicId);
    setActiveTab('synonyms');
  };

  const handleReviewDue = useCallback((dueVocabularyIds: string[]) => {
    if (dueVocabularyIds.length === 0) return;
    setSelectedTopicId('all');
    setInitialFlashcardStatus('due');
    setActiveTab('flashcard');
  }, []);

  const handleNoDueVocabulary = useCallback(() => {
    showToast('Các từ đến hạn đã được cập nhật.', 'info');
  }, [showToast]);

  const isReviewReminderBlocked =
    activeTab === 'flashcard' ||
    activeTab === 'synonyms' ||
    isAddModalOpen ||
    isCollectionModalOpen ||
    isExcelModalOpen ||
    isSqlModalOpen ||
    editingVocabulary !== null;

  const {
    isOpen: isReviewReminderOpen,
    dueCount: reviewReminderDueCount,
    handleSnooze: handleReviewReminderSnooze,
    handleReviewNow: handleReviewReminderNow,
  } = useReviewReminder({
    authStatus,
    dataStatus,
    authUserId,
    dashboardDueCount: dashboardMetrics?.dueVocabulary ?? null,
    vocabularies,
    lastDataLoadedAt,
    lastStudySessionCompletedAt,
    isBlocked: isReviewReminderBlocked,
    onReviewNow: handleReviewDue,
    onNoDueVocabulary: handleNoDueVocabulary,
  });

  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [isExportingJSON, setIsExportingJSON] = useState(false);

  const handleExportCSV = async () => {
    if (isExportingCSV) return;
    setIsExportingCSV(true);
    try {
      await exportVocabulariesAsCSV();
      showToast('Xuất file CSV thành công! ✨', 'success');
    } catch (err) {
      console.error('Export CSV error:', err);
      showToast('Không thể xuất file CSV. Vui lòng thử lại.', 'error');
    } finally {
      setIsExportingCSV(false);
    }
  };

  const handleExportJSON = async () => {
    if (isExportingJSON) return;
    setIsExportingJSON(true);
    try {
      await exportBackupAsJSON();
      showToast('Xuất file JSON backup thành công! ✨', 'success');
    } catch (err) {
      console.error('Export JSON error:', err);
      showToast('Không thể xuất file JSON backup. Vui lòng thử lại.', 'error');
    } finally {
      setIsExportingJSON(false);
    }
  };

  // Loading UI - shown during auth check and initial data load
  // Do not render app UI until auth is confirmed and data is loaded
  const hasSuccessfulData = lastDataLoadedAt !== null;

  if (authStatus === 'loading' || !authUserId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FFF9FA] space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#F472B6] to-[#FF85A1] p-0.5 animate-bounce shadow-lg shadow-pink-100">
          <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center text-[#F472B6] font-extrabold text-xl">
            🌸
          </div>
        </div>
        <p className="text-xs font-bold text-[#F472B6] animate-pulse">
          Đang xác thực...
        </p>
      </div>
    );
  }

  // If unauthenticated, render null while redirecting
  if (authStatus === 'unauthenticated') {
    return null;
  }

  if ((dataStatus === 'idle' || dataStatus === 'loading') && !hasSuccessfulData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FFF9FA] space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#F472B6] to-[#FF85A1] p-0.5 animate-bounce shadow-lg shadow-pink-100">
          <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center text-[#F472B6] font-extrabold text-xl">🌸</div>
        </div>
        <p className="text-xs font-bold text-[#F472B6] animate-pulse">Đang tải dữ liệu EasyTOEIC...</p>
      </div>
    );
  }

  if (dataStatus === 'error' && !hasSuccessfulData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FFF9FA] px-6 text-center">
        <div className="max-w-md rounded-2xl border border-rose-100 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-extrabold text-[#4A4A4A]">Không thể tải dữ liệu</h1>
          <p className="mt-2 text-sm text-gray-500">{dataError || 'Vui lòng thử lại.'}</p>
          <button
            type="button"
            onClick={() => void refreshAppData()}
            className="mt-4 rounded-xl bg-[#F472B6] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#EC4899]"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF9FA] text-[#4A4A4A] flex flex-col selection:bg-pink-200 selection:text-pink-900">
      {/* Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        stats={stats}
        currentStreak={currentStreak}
        onOpenSqlModal={() => setIsSqlModalOpen(true)}
        onOpenAddModal={() => setIsAddModalOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        {dataStatus === 'error' && dataError && (
          <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span>Dữ liệu hiện tại có thể đã cũ. {dataError}</span>
            <button
              type="button"
              onClick={() => void refreshAppData()}
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-bold text-amber-900 hover:bg-amber-100"
            >
              Thử lại
            </button>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <Dashboard
            userId={authUserId}
            topics={topics}
            vocabularies={vocabularies}
            stats={stats}
            dashboardMetrics={dashboardMetrics}
            weekActivity={weekActivity}
            isLoadingMetrics={isLoadingDashboardMetrics}
            onSelectTopicForFlashcard={handleSelectTopicForFlashcard}
            onSelectTopicForSynonyms={handleSelectTopicForSynonyms}
            onOpenCollectionModal={() => {
              setCollectionModalMode('collection');
              setCollectionModalDefaultId(undefined);
              setIsCollectionModalOpen(true);
            }}
            onUpdateProgress={handleUpdateProgress}
          />
        )}

        {activeTab === 'flashcard' && (
          <FlashcardMode
            vocabularies={vocabularies}
            topics={topics}
            selectedTopicId={selectedTopicId}
            initialStatus={initialFlashcardStatus}
            onUpdateProgress={handleUpdateProgress}
            onBackToDashboard={() => setActiveTab('dashboard')}
            onSwitchToSynonyms={handleSelectTopicForSynonyms}
            onStudySessionCompleted={() => setLastStudySessionCompletedAt(Date.now())}
            onDeleteVocabulary={handleDeleteVocabulary}
            onEditVocabulary={handleUpdateVocabulary}
          />
        )}

        {activeTab === 'synonyms' && (
          <SynonymPractice
            vocabularies={vocabularies}
            topics={topics}
            collections={collections}
            selectedTopicId={selectedTopicId}
            onOpenEditVocabulary={setEditingVocabulary}
            onOpenVocabularyManager={() => setActiveTab('vocab-manager')}
          />
        )}

        {activeTab === 'vocab-manager' && (
          <VocabManager
            collections={collections}
            topics={topics}
            vocabularies={vocabularies}
            onUpdateStatus={handleUpdateProgress}
            onDeleteVocabulary={handleDeleteVocabulary}
            onEditVocabulary={handleUpdateVocabulary}
            onDeleteTopic={handleDeleteTopic}
            onDeleteCollection={handleDeleteCollection}
            onUpdateTopic={handleUpdateTopic}
            onUpdateCollection={handleUpdateCollection}
            onSelectTopicForFlashcard={handleSelectTopicForFlashcard}
            onSelectTopicForSynonyms={handleSelectTopicForSynonyms}
            onOpenAddModalWithTopic={(topicId) => {
              setDefaultModalTopicId(topicId);
              setIsAddModalOpen(true);
            }}
            onOpenExcelModalWithTopic={(topicId) => {
              setDefaultModalTopicId(topicId);
              setIsExcelModalOpen(true);
            }}
            onOpenCollectionModal={() => {
              setCollectionModalMode('collection');
              setCollectionModalDefaultId(undefined);
              setIsCollectionModalOpen(true);
            }}
            onOpenSectionModal={(collectionId) => {
              setCollectionModalMode('section');
              setCollectionModalDefaultId(collectionId);
              setIsCollectionModalOpen(true);
            }}
            onOpenSqlModal={() => setIsSqlModalOpen(true)}
            onExportCSV={handleExportCSV}
            onExportJSON={handleExportJSON}
            isExportingCSV={isExportingCSV}
            isExportingJSON={isExportingJSON}
          />
        )}
      </main>

      {/* Modals */}
      <AddVocabModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        topics={topics}
        defaultTopicId={defaultModalTopicId}
        onAddVocabulary={handleAddVocabulary}
      />

      <AddVocabModal
        key={editingVocabulary?.id ?? 'edit-vocabulary-modal'}
        isOpen={Boolean(editingVocabulary)}
        onClose={() => setEditingVocabulary(null)}
        topics={topics}
        mode="edit"
        editVocabulary={editingVocabulary ?? undefined}
        onEditVocabulary={handleUpdateVocabulary}
      />

      <CollectionModal
        isOpen={isCollectionModalOpen}
        onClose={() => setIsCollectionModalOpen(false)}
        mode={collectionModalMode}
        collections={collections}
        defaultCollectionId={collectionModalDefaultId}
        onAddCollection={handleAddCollection}
        onAddTopic={handleAddTopic}
      />

      <ExcelImportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        collections={collections}
        topics={topics}
        defaultTopicId={defaultModalTopicId}
        onBulkAddVocabularies={handleBulkAddVocabularies}
        onAddTopic={handleAddTopic}
      />

      <SqlScriptModal
        isOpen={isSqlModalOpen}
        onClose={() => setIsSqlModalOpen(false)}
      />

      <ReviewReminderPopup
        isOpen={isReviewReminderOpen}
        dueCount={reviewReminderDueCount}
        onSnooze={handleReviewReminderSnooze}
        onReviewNow={handleReviewReminderNow}
      />

      {/* Footer */}
      <footer className="border-t border-[#FCE7F3] bg-white/70 py-6 text-center text-xs text-gray-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-center gap-3">
          <p className="font-medium text-gray-600">
            EasyTOEIC — Nâng cao từ vựng TOEIC với Spaced Repetition & Giao diện Tối giản, Sạch sẽ
          </p>
        </div>
      </footer>
    </div>
  );
}
