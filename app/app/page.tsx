'use client';

import React, { useState, useEffect, useCallback } from 'react';
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

import { Collection, Topic, Vocabulary, StudyStats, LearningStatus } from '../../lib/types';

type CreateModalMode = 'collection' | 'section';

export default function AppPage() {
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
      const [fetchedCols, fetchedTopics, fetchedVocab, fetchedStats] = await Promise.all([
        getCollections(),
        getTopics(),
        getVocabByTopic('all'),
        getStudyStats(),
      ]);
      setCollections(fetchedCols);
      setTopics(fetchedTopics);
      setVocabularies(fetchedVocab);
      setStats(fetchedStats);
    } catch (err) {
      console.error('Error refreshing VocabTOEIC data:', err);
    }
  }, []);

  // Phase 2C Fix: Auth state change listener
  // Clear all state when user changes, then reload new user's data
  useEffect(() => {
    const supabase = createClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
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
        setSelectedTopicId('all');
        setDeleteError('');

        // Reload data for new user if authenticated
        if (session?.user) {
          refreshAppData();
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshAppData]);

  // Initial Data Load
  useEffect(() => {
    let isMounted = true;
    const initData = async () => {
      try {
        const [fetchedCols, fetchedTopics, fetchedVocab, fetchedStats] = await Promise.all([
          getCollections(),
          getTopics(),
          getVocabByTopic('all'),
          getStudyStats(),
        ]);
        if (isMounted) {
          setCollections(fetchedCols);
          setTopics(fetchedTopics);
          setVocabularies(fetchedVocab);
          setStats(fetchedStats);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error loading VocabTOEIC data:', err);
        if (isMounted) setIsLoading(false);
      }
    };

    initData();
    return () => {
      isMounted = false;
    };
  }, []);

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

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FFF9FA] space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#F472B6] to-[#FF85A1] p-0.5 animate-bounce shadow-lg shadow-pink-100">
          <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center text-[#F472B6] font-extrabold text-xl">
            🌸
          </div>
        </div>
        <p className="text-xs font-bold text-[#F472B6] animate-pulse">
          Đang tải hệ thống VocabTOEIC...
        </p>
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
            VocabTOEIC Phase 1 — Subsystem Học Từ Vựng TOEIC với Spaced Repetition & Soft Clean Minimalist UI
          </p>
        </div>
      </footer>
    </div>
  );
}
