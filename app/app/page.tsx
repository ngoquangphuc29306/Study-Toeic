'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '../../components/Navbar';
import { Dashboard } from '../../components/Dashboard';
import { FlashcardMode } from '../../components/FlashcardMode';
import { QuizMode } from '../../components/QuizMode';
import { VocabManager } from '../../components/VocabManager';
import { AddVocabModal } from '../../components/AddVocabModal';
import { CollectionModal } from '../../components/CollectionModal';
import { ExcelImportModal } from '../../components/ExcelImportModal';
import { SqlScriptModal } from '../../components/SqlScriptModal';

import {
  getCollections,
  getTopics,
  getVocabByTopic,
  getStudyStats,
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

import { Collection, Topic, Vocabulary, StudyStats, LearningStatus } from '../../lib/types';

type CreateModalMode = 'collection' | 'section';

export default function AppPage() {
  const router = useRouter();

  // Auth state
  const [authStatus, setAuthStatus] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking');

  const [activeTab, setActiveTab] = useState<'dashboard' | 'flashcard' | 'quiz' | 'vocab-manager'>('dashboard');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('all');
  const [initialFlashcardStatus, setInitialFlashcardStatus] = useState<'all' | 'new' | 'learning' | 'mastered' | undefined>(undefined);
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
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [deleteError, setDeleteError] = useState<string>('');

  // Helper to re-fetch data
  const refreshAppData = useCallback(async () => {
    try {
      const [fetchedCols, fetchedTopics, fetchedVocab, fetchedStats, fetchedMetrics, fetchedWeek] = await Promise.all([
        getCollections(),
        getTopics(),
        getVocabByTopic('all'),
        getStudyStats(),
        getDashboardMetrics(),
        getWeekActivity(),
      ]);
      setCollections(fetchedCols);
      setTopics(fetchedTopics);
      setVocabularies(fetchedVocab);
      setStats(fetchedStats);
      setDashboardMetrics(fetchedMetrics);
      setWeekActivity(fetchedWeek);
    } catch (err) {
      console.error('Error refreshing EasyTOEIC data:', err);
    }
  }, []);

  // Phase 2C Fix: Auth state change listener
  // Phase 6 Fix: Track user identity to detect actual user switches
  // Phase 9.5: Application-level auth listener (scoped to /app route)
  //
  // Mount Scope: /app route only
  // - Does NOT run when recovery links open /reset-password directly
  // - PASSWORD_RECOVERY handling moved to root-level AuthEventBridge
  // - This listener manages application state for signed-in users
  const previousUserIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
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
        setDeleteError('');

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
          setDeleteError('');
        }

        // Update tracked user ID
        previousUserIdRef.current = currentUserId;

        // Reload data for authenticated user
        refreshAppData();
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
  }, [refreshAppData]);

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
  }, [authStatus]); // Dependency on authStatus to run after auth confirmed

  // Handle Updates & Actions
  // Phase 5: handleUpdateProgress now throws errors for FlashcardMode to handle
  const handleUpdateProgress = async (vocabId: string, status: LearningStatus, rating?: SrsRating): Promise<void> => {
    await updateUserProgress(vocabId, status, rating);
    await refreshAppData();
  };

  const handleAddCollection = async (newCol: Omit<Collection, 'id'>) => {
    const col = await addCollection(newCol);
    await refreshAppData();
    return col;
  };

  const handleUpdateCollection = async (colId: string, updates: Partial<Collection>) => {
    setCollections((prev) => prev.map((c) => (c.id === colId ? { ...c, ...updates } : c)));
    await updateCollection(colId, updates);
    await refreshAppData();
  };

  const handleUpdateTopic = async (topicId: string, updates: Partial<Topic>) => {
    setTopics((prev) => prev.map((t) => (t.id === topicId ? { ...t, ...updates } : t)));
    await updateTopic(topicId, updates);
    await refreshAppData();
  };

  const handleDeleteCollection = async (colId: string) => {
    try {
      setDeleteError('');
      await deleteCollection(colId);
      await refreshAppData();
    } catch (err) {
      if (err instanceof CollectionHasChildrenError) {
        setDeleteError('Không thể xóa bộ sưu tập này vì vẫn còn chủ đề hoặc từ vựng. Hãy xóa dữ liệu bên trong trước.');
      } else if (err instanceof Error) {
        setDeleteError(err.message);
      } else {
        setDeleteError('Không thể xóa bộ sưu tập. Vui lòng thử lại.');
      }
      throw err;
    }
  };

  const handleAddTopic = async (newTopic: Omit<Topic, 'id'>) => {
    const topic = await addTopic(newTopic);
    await refreshAppData();
    return topic;
  };

  const handleDeleteTopic = async (topicId: string) => {
    try {
      setDeleteError('');
      await deleteTopic(topicId);
      await refreshAppData();
    } catch (err) {
      if (err instanceof TopicHasVocabulariesError) {
        setDeleteError('Không thể xóa học phần này vì vẫn còn từ vựng. Hãy xóa từ vựng bên trong trước.');
      } else if (err instanceof Error) {
        setDeleteError(err.message);
      } else {
        setDeleteError('Không thể xóa học phần. Vui lòng thử lại.');
      }
      throw err;
    }
  };

  const handleAddVocabulary = async (newVocab: Omit<Vocabulary, 'id'>) => {
    await addVocabulary(newVocab);
    await refreshAppData();
  };

  const handleBulkAddVocabularies = async (items: Omit<Vocabulary, 'id'>[]) => {
    await bulkAddVocabularies(items);
    await refreshAppData();
  };

  const handleDeleteVocabulary = async (vocabId: string) => {
    await deleteVocabulary(vocabId);
    await refreshAppData();
  };

  // Switchers
  const handleSelectTopicForFlashcard = (topicId: string, initialStatus?: 'all' | 'new' | 'learning' | 'mastered') => {
    setSelectedTopicId(topicId);
    setInitialFlashcardStatus(initialStatus);
    setActiveTab('flashcard');
  };

  const handleSelectTopicForQuiz = (topicId: string) => {
    setSelectedTopicId(topicId);
    setActiveTab('quiz');
  };

  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [isExportingJSON, setIsExportingJSON] = useState(false);

  const handleExportCSV = async () => {
    if (isExportingCSV) return;
    setIsExportingCSV(true);
    try {
      await exportVocabulariesAsCSV();
    } catch (err) {
      console.error('Export CSV error:', err);
      alert('Không thể xuất file CSV. Vui lòng thử lại.');
    } finally {
      setIsExportingCSV(false);
    }
  };

  const handleExportJSON = async () => {
    if (isExportingJSON) return;
    setIsExportingJSON(true);
    try {
      await exportBackupAsJSON();
    } catch (err) {
      console.error('Export JSON error:', err);
      alert('Không thể xuất file JSON backup. Vui lòng thử lại.');
    } finally {
      setIsExportingJSON(false);
    }
  };

  // Loading UI - shown during auth check and initial data load
  // Do not render app UI until auth is confirmed and data is loaded
  if (authStatus === 'checking' || isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FFF9FA] space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#F472B6] to-[#FF85A1] p-0.5 animate-bounce shadow-lg shadow-pink-100">
          <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center text-[#F472B6] font-extrabold text-xl">
            🌸
          </div>
        </div>
        <p className="text-xs font-bold text-[#F472B6] animate-pulse">
          {authStatus === 'checking' ? 'Đang xác thực...' : 'Đang tải hệ thống EasyTOEIC...'}
        </p>
      </div>
    );
  }

  // If unauthenticated, render null while redirecting
  if (authStatus === 'unauthenticated') {
    return null;
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
        {activeTab === 'dashboard' && (
          <Dashboard
            topics={topics}
            vocabularies={vocabularies}
            stats={stats}
            dashboardMetrics={dashboardMetrics}
            weekActivity={weekActivity}
            isLoadingMetrics={isLoadingDashboardMetrics}
            onSelectTopicForFlashcard={handleSelectTopicForFlashcard}
            onSelectTopicForQuiz={handleSelectTopicForQuiz}
            onOpenAddModal={() => setIsAddModalOpen(true)}
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
            onSwitchToQuiz={handleSelectTopicForQuiz}
            onDeleteVocabulary={handleDeleteVocabulary}
          />
        )}

        {activeTab === 'quiz' && (
          <QuizMode
            vocabularies={vocabularies}
            topics={topics}
            selectedTopicId={selectedTopicId}
            onUpdateProgress={handleUpdateProgress}
            onBackToDashboard={() => setActiveTab('dashboard')}
            onSwitchToFlashcards={handleSelectTopicForFlashcard}
          />
        )}

        {activeTab === 'vocab-manager' && (
          <VocabManager
            collections={collections}
            topics={topics}
            vocabularies={vocabularies}
            onUpdateStatus={handleUpdateProgress}
            onDeleteVocabulary={handleDeleteVocabulary}
            onDeleteTopic={handleDeleteTopic}
            onDeleteCollection={handleDeleteCollection}
            onUpdateTopic={handleUpdateTopic}
            onUpdateCollection={handleUpdateCollection}
            onSelectTopicForFlashcard={handleSelectTopicForFlashcard}
            onSelectTopicForQuiz={handleSelectTopicForQuiz}
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
            deleteError={deleteError}
            onClearDeleteError={() => setDeleteError('')}
          />
        )}
      </main>

      {/* Modals */}
      <AddVocabModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        collections={collections}
        topics={topics}
        defaultTopicId={defaultModalTopicId}
        onAddVocabulary={handleAddVocabulary}
        onAddTopic={handleAddTopic}
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

      {/* Footer */}
      <footer className="border-t border-[#FCE7F3] bg-white/70 py-6 text-center text-xs text-gray-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-center gap-3">
          <p className="font-medium text-gray-600">
            EasyTOEIC Phase 1 — Subsystem Học Từ Vựng TOEIC với Spaced Repetition & Soft Clean Minimalist UI
          </p>
        </div>
      </footer>
    </div>
  );
}
