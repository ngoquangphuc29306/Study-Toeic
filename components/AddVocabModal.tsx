'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, BookOpen, FileText } from 'lucide-react';
import { Collection, Topic, Vocabulary } from '../lib/types';

interface AddVocabModalProps {
  isOpen: boolean;
  onClose: () => void;
  collections?: Collection[];
  topics: Topic[];
  defaultTopicId?: string;
  onAddVocabulary: (newVocab: Omit<Vocabulary, 'id'>) => Promise<void>;
  onAddTopic: (newTopic: Omit<Topic, 'id'>) => Promise<Topic | void>;
}

export const AddVocabModal: React.FC<AddVocabModalProps> = ({
  isOpen,
  onClose,
  collections = [],
  topics,
  defaultTopicId,
  onAddVocabulary,
  onAddTopic,
}) => {
  const [activeTab, setActiveTab] = useState<'word' | 'topic'>('word');

  // Word form state
  const [topicId, setTopicId] = useState<string>(defaultTopicId || topics[0]?.id || '');
  const [prevDefaultTopicId, setPrevDefaultTopicId] = useState<string | undefined>(defaultTopicId);

  // Sync prop to state safely during render if changed
  if (defaultTopicId !== prevDefaultTopicId) {
    setPrevDefaultTopicId(defaultTopicId);
    if (defaultTopicId) {
      setTopicId(defaultTopicId);
    }
  }
  const [word, setWord] = useState<string>('');
  const [phoneticUk, setPhoneticUk] = useState<string>('');
  const [phoneticUs, setPhoneticUs] = useState<string>('');
  const [partOfSpeech, setPartOfSpeech] = useState<string>('noun');
  const [meaning, setMeaning] = useState<string>('');
  const [example, setExample] = useState<string>('');
  const [exampleTranslation, setExampleTranslation] = useState<string>('');
  const [synonyms, setSynonyms] = useState<string>('');
  const [collocations, setCollocations] = useState<string>('');
  const [note, setNote] = useState<string>('');

  // Topic form state
  const [newTopicColId, setNewTopicColId] = useState<string>(collections[0]?.id || '');
  const [newTopicTitle, setNewTopicTitle] = useState<string>('');
  const [newTopicDesc, setNewTopicDesc] = useState<string>('');
  const [newTopicCat, setNewTopicCat] = useState<string>('Business');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // ESC key handler
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!isOpen) return null;

  const handleWordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!word || !meaning || !topicId) return;

    setIsSubmitting(true);
    try {
      await onAddVocabulary({
        topic_id: topicId,
        word: word.trim(),
        phonetic_uk: phoneticUk.trim() || undefined,
        phonetic_us: phoneticUs.trim() || undefined,
        part_of_speech: partOfSpeech,
        meaning: meaning.trim(),
        example: example.trim() || undefined,
        example_translation: exampleTranslation.trim() || undefined,
        synonyms: synonyms.trim() || undefined,
        collocations: collocations.trim() || undefined,
        note: note.trim() || undefined,
      });

      // Reset form
      setWord('');
      setPhoneticUk('');
      setPhoneticUs('');
      setMeaning('');
      setExample('');
      setExampleTranslation('');
      setSynonyms('');
      setCollocations('');
      setNote('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTopicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicTitle) return;

    setIsSubmitting(true);
    try {
      await onAddTopic({
        collection_id: newTopicColId || collections[0]?.id,
        title: newTopicTitle.trim(),
        description: newTopicDesc.trim() || 'Chủ đề từ vựng TOEIC mới',
        category: newTopicCat || 'General',
        icon: 'BookOpen',
      });

      setNewTopicTitle('');
      setNewTopicDesc('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-[20px] sm:rounded-3xl border border-pink-100 shadow-xl p-4 sm:p-6 space-y-4 sm:space-y-5 max-h-[90dvh] flex flex-col overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-vocab-modal-title"
      >
        {/* Modal Close Button */}
        <button
          onClick={onClose}
          aria-label="Đóng"
          className="absolute top-4 sm:top-5 right-4 sm:right-5 p-2 sm:p-2.5 rounded-full bg-gray-100 hover:bg-pink-100 text-gray-500 hover:text-pink-600 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header & Tabs */}
        <div className="space-y-3">
          <h3 id="add-vocab-modal-title" className="text-lg sm:text-xl font-extrabold text-gray-800">
            Thêm Mới Từ Vựng
          </h3>

          <div className="flex items-center gap-1 bg-pink-50/80 p-1 rounded-2xl border border-pink-100 text-xs font-bold">
            <button
              onClick={() => setActiveTab('word')}
              className={`flex-1 py-2 rounded-xl transition-all cursor-pointer ${
                activeTab === 'word' ? 'bg-white text-pink-600 shadow-2xs' : 'text-gray-500'
              }`}
            >
              Thêm Từ Vựng Mới
            </button>

            <button
              onClick={() => setActiveTab('topic')}
              className={`flex-1 py-2 rounded-xl transition-all cursor-pointer ${
                activeTab === 'topic' ? 'bg-white text-pink-600 shadow-2xs' : 'text-gray-500'
              }`}
            >
              Tạo Học Phần Mới
            </button>
          </div>
        </div>

        {/* WORD FORM */}
        {activeTab === 'word' ? (
          <form onSubmit={handleWordSubmit} className="space-y-3 text-xs">
            <div>
              <label htmlFor="vocab-topic-select" className="block font-bold text-gray-700 mb-1">
                Thuộc Section Bài Học <span className="text-pink-500">*</span>
              </label>
              <select
                id="vocab-topic-select"
                value={topicId}
                onChange={(e) => setTopicId(e.target.value)}
                required
                className="w-full p-2.5 sm:p-3 bg-gray-50 border border-pink-100 rounded-xl text-base sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-pink-300"
              >
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    📖 {t.title} ({t.category})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="vocab-word-input" className="block font-bold text-gray-700 mb-1">
                  Từ Vựng (English) <span className="text-pink-500">*</span>
                </label>
                <input
                  id="vocab-word-input"
                  type="text"
                  placeholder="Ví dụ: Obligation"
                  value={word}
                  onChange={(e) => setWord(e.target.value)}
                  required
                  className="w-full p-2.5 sm:p-3 bg-gray-50 border border-pink-100 rounded-xl text-base sm:text-sm font-bold text-pink-600 focus:outline-none focus:ring-2 focus:ring-pink-300"
                />
              </div>

              <div>
                <label htmlFor="vocab-pos-select" className="block font-bold text-gray-700 mb-1">
                  Loại Từ (Part of Speech)
                </label>
                <select
                  id="vocab-pos-select"
                  value={partOfSpeech}
                  onChange={(e) => setPartOfSpeech(e.target.value)}
                  className="w-full p-2.5 sm:p-3 bg-gray-50 border border-pink-100 rounded-xl text-base sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-pink-300"
                >
                  <option value="noun">Danh từ (Noun)</option>
                  <option value="verb">Động từ (Verb)</option>
                  <option value="adjective">Tính từ (Adjective)</option>
                  <option value="adverb">Trạng từ (Adverb)</option>
                  <option value="phrase">Cụm từ (Phrase)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="vocab-ipa-uk" className="block font-bold text-gray-700 mb-1">IPA-UK</label>
                <input
                  id="vocab-ipa-uk"
                  type="text"
                  placeholder="/ˌɒb.lɪˈɡeɪ.ʃən/"
                  value={phoneticUk}
                  onChange={(e) => setPhoneticUk(e.target.value)}
                  className="w-full p-2.5 sm:p-3 bg-gray-50 border border-pink-100 rounded-xl text-base sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-pink-300"
                />
              </div>

              <div>
                <label htmlFor="vocab-ipa-us" className="block font-bold text-gray-700 mb-1">IPK-US</label>
                <input
                  id="vocab-ipa-us"
                  type="text"
                  placeholder="/ˌɑː.bləˈɡeɪ.ʃən/"
                  value={phoneticUs}
                  onChange={(e) => setPhoneticUs(e.target.value)}
                  className="w-full p-2.5 sm:p-3 bg-gray-50 border border-pink-100 rounded-xl text-base sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-pink-300"
                />
              </div>
            </div>

            <div>
              <label htmlFor="vocab-meaning" className="block font-bold text-gray-700 mb-1">
                Meaning (Nghĩa) <span className="text-pink-500">*</span>
              </label>
              <input
                id="vocab-meaning"
                type="text"
                placeholder="Ví dụ: Nghĩa vụ, bổn phận bắt buộc"
                value={meaning}
                onChange={(e) => setMeaning(e.target.value)}
                required
                className="w-full p-2.5 sm:p-3 bg-gray-50 border border-pink-100 rounded-xl text-base sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-pink-300"
              />
            </div>

            <div>
              <label htmlFor="vocab-example" className="block font-bold text-gray-700 mb-1">Example (Ví Dụ)</label>
              <input
                id="vocab-example"
                type="text"
                placeholder="The vendor has a legal obligation..."
                value={example}
                onChange={(e) => setExample(e.target.value)}
                className="w-full p-2.5 sm:p-3 bg-gray-50 border border-pink-100 rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
              />
            </div>

            <div>
              <label htmlFor="vocab-example-vi" className="block font-bold text-gray-700 mb-1">Example_vi (Dịch Ví Dụ)</label>
              <input
                id="vocab-example-vi"
                type="text"
                placeholder="Bên bán có nghĩa vụ pháp lý..."
                value={exampleTranslation}
                onChange={(e) => setExampleTranslation(e.target.value)}
                className="w-full p-2.5 sm:p-3 bg-gray-50 border border-pink-100 rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="vocab-synonyms" className="block font-bold text-gray-700 mb-1">Từ Đồng Nghĩa (Synonyms)</label>
                <input
                  id="vocab-synonyms"
                  type="text"
                  placeholder="duty, responsibility, commitment"
                  value={synonyms}
                  onChange={(e) => setSynonyms(e.target.value)}
                  className="w-full p-2.5 sm:p-3 bg-gray-50 border border-pink-100 rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                />
              </div>

              <div>
                <label htmlFor="vocab-collocations" className="block font-bold text-gray-700 mb-1">Cụm Từ (Collocations)</label>
                <input
                  id="vocab-collocations"
                  type="text"
                  placeholder="fulfill an obligation, meet obligations"
                  value={collocations}
                  onChange={(e) => setCollocations(e.target.value)}
                  className="w-full p-2.5 sm:p-3 bg-gray-50 border border-pink-100 rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 sm:py-3.5 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-2xl text-xs sm:text-sm transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {isSubmitting ? 'Đang Lưu...' : 'Lưu Từ Vựng Vào Bài Học'}
            </button>
          </form>
        ) : (
          /* TOPIC FORM */
          <form onSubmit={handleTopicSubmit} className="space-y-3 text-xs">
            {collections.length > 0 && (
              <div>
                <label htmlFor="topic-collection-select" className="block font-bold text-gray-700 mb-1">
                  Bộ Sưu Tập Chứa Section
                </label>
                <select
                  id="topic-collection-select"
                  value={newTopicColId}
                  onChange={(e) => setNewTopicColId(e.target.value)}
                  className="w-full p-2.5 sm:p-3 bg-gray-50 border border-pink-100 rounded-xl text-base sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-pink-300"
                >
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      📂 {c.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="topic-title-input" className="block font-bold text-gray-700 mb-1">
                Tên Section Mới <span className="text-pink-500">*</span>
              </label>
              <input
                id="topic-title-input"
                type="text"
                placeholder="Ví dụ: Section 1: Hợp Đồng & Đàm Phán"
                value={newTopicTitle}
                onChange={(e) => setNewTopicTitle(e.target.value)}
                required
                className="w-full p-2.5 sm:p-3 bg-gray-50 border border-pink-100 rounded-xl text-base sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-pink-300"
              />
            </div>

            <div>
              <label htmlFor="topic-desc-textarea" className="block font-bold text-gray-700 mb-1">Mô Tả Section</label>
              <textarea
                id="topic-desc-textarea"
                placeholder="Mô tả nội dung từ vựng bài học này..."
                value={newTopicDesc}
                onChange={(e) => setNewTopicDesc(e.target.value)}
                rows={2}
                className="w-full p-2.5 sm:p-3 bg-gray-50 border border-pink-100 rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 resize-none"
              />
            </div>

            <div>
              <label htmlFor="topic-category-input" className="block font-bold text-gray-700 mb-1">Phân Loại (Category)</label>
              <input
                id="topic-category-input"
                type="text"
                placeholder="Business, HR, Corporate, Travel..."
                value={newTopicCat}
                onChange={(e) => setNewTopicCat(e.target.value)}
                className="w-full p-2.5 sm:p-3 bg-gray-50 border border-pink-100 rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 sm:py-3.5 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-2xl text-xs sm:text-sm transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {isSubmitting ? 'Đang Lưu...' : 'Tạo Section Bài Học Mới'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

