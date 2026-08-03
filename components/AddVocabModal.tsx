'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Topic, Vocabulary } from '../lib/types';

type VocabularyUpdate = Partial<Pick<Vocabulary,
  'word' | 'phonetic_uk' | 'phonetic_us' | 'part_of_speech' |
  'meaning' | 'example' | 'example_translation' | 'synonyms' |
  'collocations' | 'audio_url' | 'note'
>>;

interface AddVocabModalProps {
  isOpen: boolean;
  onClose: () => void;
  topics: Topic[];
  defaultTopicId?: string;

  onAddVocabulary?: (newVocab: Omit<Vocabulary, 'id'>) => Promise<void>;

  mode?: 'add' | 'edit';
  editVocabulary?: Vocabulary;
  onEditVocabulary?: (vocabId: string, updates: VocabularyUpdate) => Promise<void>;
}

export const AddVocabModal: React.FC<AddVocabModalProps> = ({
  isOpen,
  onClose,
  topics,
  defaultTopicId,
  onAddVocabulary,
  mode = 'add',
  editVocabulary,
  onEditVocabulary,
}) => {
  const isEditMode = mode === 'edit' && Boolean(editVocabulary);

  // Word form state
  const [topicId, setTopicId] = useState<string>(() =>
    isEditMode && editVocabulary
      ? editVocabulary.topic_id
      : defaultTopicId || topics[0]?.id || ''
  );
  const [prevDefaultTopicId, setPrevDefaultTopicId] = useState<string | undefined>(defaultTopicId);

  // Sync prop to state safely during render if changed
  if (mode === 'add' && defaultTopicId !== prevDefaultTopicId) {
    setPrevDefaultTopicId(defaultTopicId);
    if (defaultTopicId) {
      setTopicId(defaultTopicId);
    }
  }
  const [word, setWord] = useState<string>(() =>
    isEditMode && editVocabulary ? editVocabulary.word : ''
  );
  const [phoneticUk, setPhoneticUk] = useState<string>(() =>
    isEditMode && editVocabulary
      ? editVocabulary.phonetic_uk || ''
      : ''
  );
  const [phoneticUs, setPhoneticUs] = useState<string>(() =>
    isEditMode && editVocabulary
      ? editVocabulary.phonetic_us || ''
      : ''
  );
  const [partOfSpeech, setPartOfSpeech] = useState<string>(() =>
    isEditMode && editVocabulary
      ? editVocabulary.part_of_speech || 'noun'
      : 'noun'
  );
  const [meaning, setMeaning] = useState<string>(() =>
    isEditMode && editVocabulary ? editVocabulary.meaning : ''
  );
  const [example, setExample] = useState<string>(() =>
    isEditMode && editVocabulary
      ? editVocabulary.example || ''
      : ''
  );
  const [exampleTranslation, setExampleTranslation] = useState<string>(() =>
    isEditMode && editVocabulary
      ? editVocabulary.example_translation || ''
      : ''
  );
  const [synonyms, setSynonyms] = useState<string>(() =>
    isEditMode && editVocabulary
      ? editVocabulary.synonyms || ''
      : ''
  );
  const [collocations, setCollocations] = useState<string>(() =>
    isEditMode && editVocabulary
      ? editVocabulary.collocations || ''
      : ''
  );
  const [note, setNote] = useState<string>(() =>
    isEditMode && editVocabulary
      ? editVocabulary.note || ''
      : ''
  );

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
      if (mode === 'edit' && editVocabulary && onEditVocabulary) {
        // Edit mode: call onEditVocabulary with updates
        const updates: VocabularyUpdate = {
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
        };
        await onEditVocabulary(editVocabulary.id, updates);
      } else {
        if (!onAddVocabulary) {
          throw new Error('Thiếu handler thêm từ vựng.');
        }

        // Add mode: call onAddVocabulary
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
      }

      // Reset form (only in add mode)
      if (mode === 'add') {
        setWord('');
        setPhoneticUk('');
        setPhoneticUs('');
        setMeaning('');
        setExample('');
        setExampleTranslation('');
        setSynonyms('');
        setCollocations('');
        setNote('');
      }
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

        {/* Header */}
        <div>
          <h3 id="add-vocab-modal-title" className="text-lg sm:text-xl font-extrabold text-gray-800">
            {mode === 'edit' ? 'Chỉnh Sửa Từ Vựng' : 'Thêm Mới Từ Vựng'}
          </h3>
        </div>

        {/* WORD FORM */}
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
                disabled={mode === 'edit'}
                className="w-full p-2.5 sm:p-3 bg-gray-50 border border-pink-100 rounded-xl text-base sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-pink-300 disabled:opacity-60 disabled:cursor-not-allowed"
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
                  <option value="conjunction">Liên từ (Conjunction)</option>
                  <option value="preposition">Giới từ (Preposition)</option>
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
              {isSubmitting ? 'Đang Lưu...' : (mode === 'edit' ? 'Lưu Thay Đổi' : 'Lưu Từ Vựng Vào Bài Học')}
            </button>
          </form>
      </div>
    </div>
  );
};

