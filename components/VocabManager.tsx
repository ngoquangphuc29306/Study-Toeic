'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Search,
  MoreVertical,
  Edit3,
  Pencil,
  Trash2,
  List,
  Upload,
  BookOpen,
  Volume2,
  Lock,
  Globe,
  ChevronRight,
  FolderPlus,
  FileSpreadsheet,
  X,
  ChevronDown,
  Layers,
  Sparkles,
  Download
} from 'lucide-react';
import { Collection, Vocabulary, Topic, LearningStatus } from '../lib/types';
import { AddVocabModal } from './AddVocabModal';
import gsap from 'gsap';
import { motionTokens } from '../lib/animation/motionTokens';
import { usePrefersReducedMotion } from '../hooks/use-prefers-reduced-motion';

type VocabularyUpdate = Partial<Pick<Vocabulary,
  'word' | 'phonetic_uk' | 'phonetic_us' | 'part_of_speech' |
  'meaning' | 'example' | 'example_translation' | 'synonyms' |
  'collocations' | 'audio_url' | 'note'
>>;

interface VocabManagerProps {
  collections: Collection[];
  topics: Topic[];
  vocabularies: Vocabulary[];
  onUpdateStatus: (vocabId: string, status: LearningStatus) => void;
  onDeleteVocabulary: (vocabId: string) => Promise<void>;
  onEditVocabulary: (vocabId: string, updates: VocabularyUpdate) => Promise<void>;
  onDeleteTopic: (topicId: string) => Promise<void>;
  onDeleteCollection: (colId: string) => Promise<void>;
  onUpdateTopic?: (topicId: string, updates: Partial<Topic>) => Promise<void>;
  onUpdateCollection?: (colId: string, updates: Partial<Collection>) => Promise<void>;
  onSelectTopicForFlashcard: (topicId: string, initialStatus?: 'all' | 'new' | 'learning' | 'mastered') => void;
  onSelectTopicForSynonyms: (topicId: string) => void;
  onOpenAddModalWithTopic?: (topicId?: string) => void;
  onOpenExcelModalWithTopic?: (topicId?: string) => void;
  onOpenCollectionModal: () => void;
  onOpenSectionModal: (collectionId: string) => void;
  onOpenSqlModal: () => void;
  onExportCSV?: () => void;
  onExportJSON?: () => void;
  isExportingCSV?: boolean;
  isExportingJSON?: boolean;
}

export const VocabManager: React.FC<VocabManagerProps> = ({
  collections,
  topics,
  vocabularies,
  onUpdateStatus,
  onDeleteVocabulary,
  onEditVocabulary,
  onDeleteTopic,
  onDeleteCollection,
  onUpdateTopic,
  onUpdateCollection,
  onSelectTopicForFlashcard,
  onOpenAddModalWithTopic,
  onOpenExcelModalWithTopic,
  onOpenCollectionModal,
  onOpenSectionModal,
  onExportCSV,
  isExportingCSV = false,
}) => {
  // Active dropdown state tracking
  const [activeManageDropdown, setActiveManageDropdown] = useState<string | null>(null);
  const [activeSectionMenu, setActiveSectionMenu] = useState<string | null>(null);
  const [activeCollectionMenu, setActiveCollectionMenu] = useState<string | null>(null);
  const [isTopCreateOpen, setIsTopCreateOpen] = useState<boolean>(false);

  // Modal view for "Xem danh sách từ"
  const [viewWordsTopic, setViewWordsTopic] = useState<Topic | null>(null);
  const [modalSearch, setModalSearch] = useState<string>('');
  const [editingVocabulary, setEditingVocabulary] = useState<Vocabulary | null>(null);

  // Modals for Renaming
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [newCollectionTitle, setNewCollectionTitle] = useState<string>('');

  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [newTopicTitle, setNewTopicTitle] = useState<string>('');
  const wordsModalRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  // Audio pronunciation helper
  const handleSpeak = (text: string, lang: 'en-US' | 'en-GB' = 'en-US') => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('.prevent-close-menu')) {
        return;
      }
      setActiveManageDropdown(null);
      setActiveSectionMenu(null);
      setActiveCollectionMenu(null);
      setIsTopCreateOpen(false);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // ESC key handlers for modals
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (viewWordsTopic) {
          setViewWordsTopic(null);
        } else if (editingVocabulary) {
          setEditingVocabulary(null);
        } else if (editingCollection) {
          setEditingCollection(null);
        } else if (editingTopic) {
          setEditingTopic(null);
        }
      }
    };

    if (viewWordsTopic || editingCollection || editingTopic) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [viewWordsTopic, editingVocabulary, editingCollection, editingTopic]);

  useEffect(() => {
    if (!viewWordsTopic || !wordsModalRef.current) return;

    const ctx = gsap.context(() => {
      const modal = wordsModalRef.current;
      if (!modal) return;

      if (prefersReducedMotion) {
        gsap.set(modal, { clearProps: 'all' });
        return;
      }

      gsap.fromTo(
        modal,
        { autoAlpha: 0, y: motionTokens.distance.medium },
        {
          autoAlpha: 1,
          y: 0,
          duration: motionTokens.duration.normal,
          ease: motionTokens.ease.standard,
          clearProps: 'transform,opacity,visibility',
        }
      );
    }, wordsModalRef);

    return () => ctx.revert();
  }, [prefersReducedMotion, viewWordsTopic]);

  // Group topics by collection
  const collectionGroupMap = React.useMemo(() => {
    const map = new Map<string, Topic[]>();
    
    // First initialize all collections
    collections.forEach((col) => {
      map.set(col.id, []);
    });

    // Fallback collection for unassigned topics
    map.set('unassigned', []);

    topics.forEach((t) => {
      if (t.collection_id && map.has(t.collection_id)) {
        map.get(t.collection_id)!.push(t);
      } else {
        map.get('unassigned')!.push(t);
      }
    });

    return map;
  }, [collections, topics]);

  // Rename handlers
  const handleSaveRenameCollection = async () => {
    if (!editingCollection || !newCollectionTitle.trim()) return;
    if (onUpdateCollection) {
      await onUpdateCollection(editingCollection.id, { title: newCollectionTitle.trim() });
    }
    setEditingCollection(null);
    setNewCollectionTitle('');
  };

  const handleSaveRenameTopic = async () => {
    if (!editingTopic || !newTopicTitle.trim()) return;
    if (onUpdateTopic) {
      await onUpdateTopic(editingTopic.id, { title: newTopicTitle.trim() });
    }
    setEditingTopic(null);
    setNewTopicTitle('');
  };

  return (
    <div className="bg-white text-gray-800 rounded-[32px] p-4 sm:p-6 lg:p-8 space-y-8 font-sans shadow-sm border border-[#FCE7F3]">

      {/* Top Bar Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-[#FCE7F3]">
        
        {/* Navigation / Filter Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <div className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-[#FFF1F2] text-[#F472B6] border border-[#FCE7F3]">
            <BookOpen className="w-4 h-4" />
            <span>Bộ từ vựng</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[#F472B6]/20 text-[#F472B6] text-[10px] font-extrabold">
              {collections.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
            <Layers className="w-4 h-4 text-blue-500" />
            <span>Tổng Học Phần</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-extrabold">
              {topics.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-amber-50 text-amber-700 border border-amber-100">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Tổng Từ Vựng</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold">
              {vocabularies.length}
            </span>
          </div>
        </div>

        {/* Global "+ Tạo mới" Action Button */}
        <div className="relative prevent-close-menu">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsTopCreateOpen(!isTopCreateOpen);
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#ED4F8E] to-[#F472B6] hover:from-[#E13B7D] hover:to-[#EC4899] text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo mới</span>
            <ChevronDown className="w-3.5 h-3.5 ml-1" />
          </button>

          {/* "+ Tạo mới" Dropdown Menu */}
          {isTopCreateOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-56 max-w-[calc(100vw-2rem)] bg-white border border-[#FCE7F3] rounded-2xl shadow-xl z-50 p-2 space-y-1 text-xs"
            >
              <button
                onClick={() => {
                  setIsTopCreateOpen(false);
                  onOpenCollectionModal();
                }}
                className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-[#FFF1F2] text-gray-700 font-semibold cursor-pointer transition-colors"
              >
                <FolderPlus className="w-4 h-4 text-[#F472B6]" />
                <span>Tạo Bộ từ vựng</span>
              </button>

              <button
                onClick={() => {
                  setIsTopCreateOpen(false);
                  if (onOpenExcelModalWithTopic) onOpenExcelModalWithTopic();
                }}
                className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-[#FFF1F2] text-gray-700 font-semibold cursor-pointer transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Import File Excel</span>
              </button>

              <div className="border-t border-[#FCE7F3] my-1"></div>

              <button
                onClick={() => {
                  setIsTopCreateOpen(false);
                  if (onExportCSV) onExportCSV();
                }}
                disabled={isExportingCSV}
                aria-busy={isExportingCSV}
                className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-blue-50 text-gray-700 font-semibold cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4 text-blue-600" />
                <span>{isExportingCSV ? 'Đang xuất...' : 'Xuất CSV'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Collections List Rendering */}
      <div className="space-y-10">
        {collections.map((col) => {
          const colTopics = collectionGroupMap.get(col.id) || [];
          
          // Calculate total words and mastered words for collection
          const colTopicIds = new Set(colTopics.map((t) => t.id));
          const colVocabs = vocabularies.filter((v) => colTopicIds.has(v.topic_id));
          const colMasteredCount = colVocabs.filter((v) => v.status === 'mastered').length;

          return (
            <div key={col.id} className="space-y-4">
              
              {/* Collection Header Row */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 flex items-center gap-2 min-w-0">
                    <span className="truncate">{col.title}</span>
                  </h3>

                  {/* Privacy Badge */}
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-gray-100 text-gray-500 text-[11px] font-medium border border-gray-200">
                    <Lock className="w-3 h-3 text-gray-400" />
                    <span>Riêng tư</span>
                  </span>

                  {/* Collection Meta Stats */}
                  <span className="text-xs text-gray-500 font-medium hidden sm:inline-block">
                    {colTopics.length} học phần · {colVocabs.length} từ · {colMasteredCount} đã thuộc
                  </span>
                </div>

                {/* Collection '...' Menu Button */}
                <div className="relative prevent-close-menu">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveCollectionMenu(activeCollectionMenu === col.id ? null : col.id);
                    }}
                    className="p-2 rounded-xl bg-gray-50 hover:bg-[#FFF1F2] text-gray-500 hover:text-[#F472B6] transition-colors cursor-pointer border border-[#FCE7F3]"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {/* Dropdown Menu for Collection */}
                  {activeCollectionMenu === col.id && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 mt-2 w-48 bg-white border border-[#FCE7F3] rounded-2xl shadow-xl z-40 p-1.5 space-y-1 text-xs"
                    >
                      <button
                        onClick={() => {
                          setActiveCollectionMenu(null);
                          setEditingCollection(col);
                          setNewCollectionTitle(col.title);
                        }}
                        className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-[#FFF1F2] text-gray-700 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-blue-500" />
                        <span>Đổi tên Bộ từ vựng</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveCollectionMenu(null);
                          onOpenSectionModal(col.id);
                        }}
                        className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-[#FFF1F2] text-gray-700 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Thêm học phần vào bộ</span>
                      </button>

                      <button
                        onClick={async () => {
                          setActiveCollectionMenu(null);
                          if (confirm(`Bạn có chắc chắn muốn xóa bộ từ vựng "${col.title}" và toàn bộ bài học bên trong?`)) {
                            try {
                              await onDeleteCollection(col.id);
                            } catch (err) {
                              // Error is handled in parent component
                              console.error('Delete collection failed:', err);
                            }
                          }
                        }}
                        className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-rose-50 text-rose-600 cursor-pointer border-t border-rose-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa Bộ từ vựng</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Grid of Section Cards under this collection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                
                {colTopics.map((topic) => {
                  const topicVocabs = vocabularies.filter((v) => v.topic_id === topic.id);
                  const totalWords = topicVocabs.length;
                  const masteredCount = topicVocabs.filter((v) => v.status === 'mastered').length;

                  return (
                    <div
                      key={topic.id}
                      className="group relative bg-white hover:bg-[#FFF5F7]/40 border border-[#FCE7F3] hover:border-[#F472B6] rounded-2xl p-5 flex flex-col justify-between space-y-4 transition-all shadow-2xs hover:shadow-md"
                    >
                      {/* Section Card Top Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2.5 py-1 rounded-lg bg-[#FFF1F2] text-[#F472B6] text-[10px] font-bold border border-[#FCE7F3]">
                            {topic.category || col.title}
                          </span>

                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-100">
                            <Globe className="w-2.5 h-2.5 text-emerald-500" />
                            <span>Công khai</span>
                          </span>
                        </div>

                        {/* '...' Button on Section Card */}
                        <div className="relative prevent-close-menu">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveSectionMenu(activeSectionMenu === topic.id ? null : topic.id);
                            }}
                            className="p-1 rounded-lg hover:bg-[#FFF1F2] text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {/* Section Card '...' Dropdown */}
                          {activeSectionMenu === topic.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 mt-1 w-44 bg-white border border-[#FCE7F3] rounded-xl shadow-xl z-30 p-1.5 space-y-1 text-xs"
                            >
                              <button
                                onClick={() => {
                                  setActiveSectionMenu(null);
                                  setEditingTopic(topic);
                                  setNewTopicTitle(topic.title);
                                }}
                                className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#FFF1F2] text-gray-700 cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-blue-500" />
                                <span>Đổi tên Section</span>
                              </button>

                              <button
                                onClick={async () => {
                                  setActiveSectionMenu(null);
                                  if (confirm(`Bạn có chắc chắn muốn xóa học phần "${topic.title}"?`)) {
                                    await onDeleteTopic(topic.id);
                                  }
                                }}
                                className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-50 text-rose-600 cursor-pointer border-t border-rose-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Xóa Section</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Section Title & Progress Stat */}
                      <div className="space-y-2">
                        <h4 className="text-base font-extrabold text-gray-900 leading-snug group-hover:text-[#F472B6] transition-colors line-clamp-2">
                          {topic.title}
                        </h4>

                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-600">
                          <span>{masteredCount}/{totalWords}</span>
                          <span className="text-gray-400 text-[11px] font-normal">đã thuộc</span>
                        </div>
                      </div>

                      {/* Bottom Action Bar */}
                      <div className="flex items-center gap-2 pt-2">
                        
                        {/* NÚT "Quản Lý..." DROPDOWN */}
                        <div className="relative prevent-close-menu">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveManageDropdown(
                                activeManageDropdown === topic.id ? null : topic.id
                              );
                            }}
                            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#FFF1F2] hover:bg-[#FCE7F3] text-[#F472B6] border border-[#FCE7F3] text-xs font-bold transition-all cursor-pointer"
                          >
                            <List className="w-3.5 h-3.5 text-[#F472B6]" />
                            <span>Quản lý...</span>
                            <ChevronDown className="w-3 h-3 text-[#F472B6]" />
                          </button>

                          {/* Dropdown menu */}
                          {activeManageDropdown === topic.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute left-0 top-11 w-48 bg-white border border-[#FCE7F3] rounded-2xl shadow-xl z-40 p-1.5 space-y-1 text-xs"
                            >
                              <button
                                onClick={() => {
                                  setActiveManageDropdown(null);
                                  if (onOpenAddModalWithTopic) onOpenAddModalWithTopic(topic.id);
                                }}
                                className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#FFF1F2] text-gray-700 font-semibold cursor-pointer transition-colors"
                              >
                                <Plus className="w-4 h-4 text-emerald-600" />
                                <span>Thêm từ</span>
                              </button>

                              <button
                                onClick={() => {
                                  setActiveManageDropdown(null);
                                  if (onOpenExcelModalWithTopic) onOpenExcelModalWithTopic(topic.id);
                                }}
                                className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#FFF1F2] text-gray-700 font-semibold cursor-pointer transition-colors"
                              >
                                <Upload className="w-4 h-4 text-[#F472B6]" />
                                <span>Import</span>
                              </button>

                              <button
                                onClick={() => {
                                  setActiveManageDropdown(null);
                                  setViewWordsTopic(topic);
                                }}
                                className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#FFF1F2] text-gray-700 font-semibold cursor-pointer transition-colors border-t border-[#FCE7F3]"
                              >
                                <BookOpen className="w-4 h-4 text-purple-500" />
                                <span>Xem danh sách từ</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* NÚT "Vào học" */}
                        <button
                          onClick={() => onSelectTopicForFlashcard(topic.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#ED4F8E] to-[#F472B6] hover:opacity-90 text-white font-extrabold text-xs transition-all shadow-2xs cursor-pointer"
                        >
                          <ChevronRight className="w-4 h-4" />
                          <span>Vào học</span>
                        </button>

                      </div>

                    </div>
                  );
                })}

                {/* "+ Thêm học phần" Card */}
                <button
                  onClick={() => onOpenSectionModal(col.id)}
                  className="min-h-[180px] border-2 border-dashed border-[#FCE7F3] hover:border-[#F472B6] rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-2 bg-[#FFF5F7]/30 hover:bg-[#FFF1F2] transition-all cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-full bg-[#FFF1F2] text-[#F472B6] group-hover:bg-[#F472B6] group-hover:text-white flex items-center justify-center transition-all">
                    <Plus className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-gray-600 group-hover:text-gray-900">
                    Thêm học phần
                  </span>
                </button>

              </div>
            </div>
          );
        })}

        {/* Fallback for Unassigned Topics if any */}
        {(collectionGroupMap.get('unassigned') || []).length > 0 && (
          <div className="space-y-4 pt-4 border-t border-[#FCE7F3]">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-gray-900">Chủ Đề Chưa Phân Loại</h3>
              <span className="text-xs text-gray-500">
                {(collectionGroupMap.get('unassigned') || []).length} học phần
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {(collectionGroupMap.get('unassigned') || []).map((topic) => {
                const topicVocabs = vocabularies.filter((v) => v.topic_id === topic.id);

                return (
                  <div
                    key={topic.id}
                    className="bg-white border border-[#FCE7F3] rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="px-2.5 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-bold">
                          Unassigned
                        </span>
                        <h4 className="text-base font-bold text-gray-900 mt-2">{topic.title}</h4>
                        <p className="text-xs text-emerald-600 font-bold mt-1">{topicVocabs.length} từ</p>
                      </div>

                      {/* '...' Button on Unassigned Section Card */}
                      <div className="relative prevent-close-menu">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveSectionMenu(activeSectionMenu === topic.id ? null : topic.id);
                          }}
                          className="p-1 rounded-lg hover:bg-[#FFF1F2] text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {activeSectionMenu === topic.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 mt-1 w-44 bg-white border border-[#FCE7F3] rounded-xl shadow-xl z-30 p-1.5 space-y-1 text-xs"
                          >
                            <button
                              onClick={() => {
                                setActiveSectionMenu(null);
                                setEditingTopic(topic);
                                setNewTopicTitle(topic.title);
                              }}
                              className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#FFF1F2] text-gray-700 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-blue-500" />
                              <span>Đổi tên Section</span>
                            </button>

                            <button
                              onClick={async () => {
                                setActiveSectionMenu(null);
                                if (confirm(`Bạn có chắc chắn muốn xóa học phần "${topic.title}"?`)) {
                                  await onDeleteTopic(topic.id);
                                }
                              }}
                              className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-50 text-rose-600 cursor-pointer border-t border-rose-100"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Xóa Section</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setViewWordsTopic(topic)}
                        className="px-3 py-2 rounded-xl bg-[#FFF1F2] text-[#F472B6] border border-[#FCE7F3] text-xs font-bold cursor-pointer"
                      >
                        Danh sách từ
                      </button>
                      <button
                        onClick={() => onSelectTopicForFlashcard(topic.id)}
                        className="flex-1 py-2 rounded-xl bg-gradient-to-r from-[#ED4F8E] to-[#F472B6] text-white font-bold text-xs cursor-pointer"
                      >
                        Vào học
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* MODAL: Xem danh sách từ của Học Phần */}
      {viewWordsTopic && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-fadeIn"
          onClick={() => setViewWordsTopic(null)}
        >
          <div
            ref={wordsModalRef}
            className="relative w-full max-w-4xl max-h-[90dvh] bg-white border border-[#FCE7F3] rounded-[20px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col p-4 sm:p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="view-words-modal-title"
          >
            
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#FCE7F3]">
              <div>
                <h3 id="view-words-modal-title" className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-[#F472B6]" />
                  <span>{viewWordsTopic.title}</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Danh sách từ vựng chi tiết trong học phần này
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => {
                    const tid = viewWordsTopic.id;
                    setViewWordsTopic(null);
                    if (onOpenAddModalWithTopic) onOpenAddModalWithTopic(tid);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#ED4F8E] to-[#F472B6] text-white font-bold text-xs shadow-2xs transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm Từ Vựng</span>
                </button>

                <button
                  onClick={() => setViewWordsTopic(null)}
                  aria-label="Đóng"
                  className="p-2.5 sm:p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm từ vựng trong học phần này..."
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#FFF5F7] border border-[#FCE7F3] rounded-xl text-base sm:text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#F472B6]"
              />
            </div>

            {/* Modal Words Table */}
            <div className="flex-1 overflow-y-auto border border-[#FCE7F3] rounded-2xl bg-[#FFF5F7]/30">
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                {(() => {
                const topicWords = vocabularies.filter(
                  (v) =>
                    v.topic_id === viewWordsTopic.id &&
                    (v.word.toLowerCase().includes(modalSearch.toLowerCase()) ||
                      v.meaning.toLowerCase().includes(modalSearch.toLowerCase()))
                );

                if (topicWords.length === 0) {
                  return (
                    <div className="p-12 text-center text-gray-400 text-xs space-y-2">
                      <p>Chưa có từ vựng nào trong học phần này.</p>
                    </div>
                  );
                }

                return (
                  <table className="w-full text-left border-collapse text-xs min-w-[800px]">
                    <thead className="sticky top-0 bg-[#FFF1F2] text-gray-700 font-bold text-[11px] uppercase tracking-wider border-b border-[#FCE7F3]">
                      <tr>
                        <th className="py-3 px-4">Từ Vựng / IPA</th>
                        <th className="py-3 px-4">Loại Từ</th>
                        <th className="py-3 px-4">Nghĩa</th>
                        <th className="py-3 px-4">Ví Dụ & Dịch</th>
                        <th className="py-3 px-4 text-center">Trạng Thái</th>
                        <th className="py-3 px-4 text-center">Hành Động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-100/60">
                      {topicWords.map((item) => (
                        <tr key={item.id} className="hover:bg-white transition-colors">
                          <td className="py-3.5 px-4 font-bold text-gray-900">
                            <div className="flex items-center gap-2">
                              <span className="text-[#ED4F8E] text-sm font-extrabold">{item.word}</span>
                              <button
                                onClick={() => handleSpeak(item.word, 'en-US')}
                                className="p-1 hover:bg-[#FFF1F2] rounded-full text-[#ED4F8E] cursor-pointer"
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="text-[10px] text-gray-500 font-mono space-x-2 mt-0.5">
                              {item.phonetic_uk && <span>UK: {item.phonetic_uk}</span>}
                              {item.phonetic_us && <span>US: {item.phonetic_us}</span>}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="uppercase px-2 py-0.5 rounded bg-[#FFF1F2] text-[#F472B6] text-[10px] font-extrabold">
                              {item.part_of_speech}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 font-bold text-gray-800">{item.meaning}</td>

                          <td className="py-3.5 px-4 text-gray-600 text-[11px]">
                            {item.example && <p className="italic text-gray-700">&ldquo;{item.example}&rdquo;</p>}
                            {item.example_translation && (
                              <p className="text-gray-500 text-[10px]">👉 {item.example_translation}</p>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => {
                                const nextStatus =
                                  item.status === 'mastered'
                                    ? 'learning'
                                    : item.status === 'learning'
                                    ? 'new'
                                    : 'mastered';
                                onUpdateStatus(item.id, nextStatus);
                              }}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer ${
                                item.status === 'mastered'
                                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                  : item.status === 'learning'
                                  ? 'bg-amber-50 text-amber-600 border border-amber-200'
                                  : 'bg-gray-100 text-gray-500 border border-gray-200'
                              }`}
                            >
                              {item.status === 'mastered' ? 'Đã thuộc' : item.status === 'learning' ? 'Đang ôn' : 'Mới'}
                            </button>
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingVocabulary(item)}
                                aria-label={`Chỉnh sửa từ ${item.word}`}
                                title="Chỉnh sửa từ vựng"
                                className="p-2 sm:p-1.5 hover:bg-[#FFF1F2] rounded-lg text-[#ED4F8E] cursor-pointer transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={async () => {
                                  if (confirm(`Xóa từ "${item.word}"?`)) {
                                    await onDeleteVocabulary(item.id);
                                  }
                                }}
                                aria-label={`Xóa từ ${item.word}`}
                                title="Xóa từ vựng"
                                className="p-2 sm:p-1.5 hover:bg-rose-100 rounded-lg text-rose-500 cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[#FCE7F3]">
              <button
                onClick={() => setViewWordsTopic(null)}
                className="px-5 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 cursor-pointer"
              >
                Đóng
              </button>
            </div>

          </div>
        </div>
      )}

      {editingVocabulary && (
        <AddVocabModal
          key={`manager-edit-vocabulary-${editingVocabulary.id}`}
          isOpen={true}
          onClose={() => setEditingVocabulary(null)}
          topics={topics}
          defaultTopicId={editingVocabulary.topic_id}
          mode="edit"
          editVocabulary={editingVocabulary}
          onEditVocabulary={onEditVocabulary}
        />
      )}

      {/* MODAL: Đổi Tên Bộ Từ Vựng (Collection) */}
      {editingCollection && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs animate-fadeIn"
          onClick={() => setEditingCollection(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveRenameCollection();
            }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-white border border-[#FCE7F3] rounded-[20px] sm:rounded-[28px] p-4 sm:p-6 space-y-4 text-xs shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rename-collection-modal-title"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#FCE7F3]">
              <h3 id="rename-collection-modal-title" className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#ED4F8E]" />
                <span>Đổi Tên Bộ Từ Vựng</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingCollection(null)}
                aria-label="Đóng"
                className="p-2 sm:p-1.5 rounded-full hover:bg-[#FFF1F2] text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              <label className="block font-bold text-gray-700">Tên mới bộ từ vựng</label>
              <input
                type="text"
                autoFocus
                value={newCollectionTitle}
                onChange={(e) => setNewCollectionTitle(e.target.value)}
                placeholder="Nhập tên bộ từ vựng..."
                className="w-full p-3 bg-[#FFF5F7] border border-[#FCE7F3] rounded-xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F472B6]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-[#FCE7F3]">
              <button
                type="button"
                onClick={() => setEditingCollection(null)}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold cursor-pointer hover:bg-gray-200 transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-gradient-to-r from-[#ED4F8E] to-[#F472B6] text-white font-extrabold rounded-xl shadow-2xs hover:opacity-95 transition-all cursor-pointer"
              >
                Lưu Thay Đổi
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Đổi Tên Học Phần (Section) */}
      {editingTopic && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs animate-fadeIn"
          onClick={() => setEditingTopic(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveRenameTopic();
            }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-white border border-[#FCE7F3] rounded-[20px] sm:rounded-[28px] p-4 sm:p-6 space-y-4 text-xs shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rename-topic-modal-title"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#FCE7F3]">
              <h3 id="rename-topic-modal-title" className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#ED4F8E]" />
                <span>Đổi Tên Học Phần (Section)</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingTopic(null)}
                aria-label="Đóng"
                className="p-2 sm:p-1.5 rounded-full hover:bg-[#FFF1F2] text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              <label className="block font-bold text-gray-700">Tên mới học phần</label>
              <input
                type="text"
                autoFocus
                value={newTopicTitle}
                onChange={(e) => setNewTopicTitle(e.target.value)}
                placeholder="Nhập tên học phần..."
                className="w-full p-3 bg-[#FFF5F7] border border-[#FCE7F3] rounded-xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F472B6]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-[#FCE7F3]">
              <button
                type="button"
                onClick={() => setEditingTopic(null)}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold cursor-pointer hover:bg-gray-200 transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-gradient-to-r from-[#ED4F8E] to-[#F472B6] text-white font-extrabold rounded-xl shadow-2xs hover:opacity-95 transition-all cursor-pointer"
              >
                Lưu Thay Đổi
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
