'use client';

import React, { useState, useEffect } from 'react';
import { X, FolderPlus, FolderKanban } from 'lucide-react';
import { Collection, Topic } from '../lib/types';

type CreateMode = 'collection' | 'section';

interface CollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: CreateMode;
  collections: Collection[];
  defaultCollectionId?: string;
  onAddCollection: (col: Omit<Collection, 'id'>) => Promise<Collection>;
  onAddTopic: (topic: Omit<Topic, 'id'>) => Promise<Topic>;
}

const DEFAULT_COLLECTION_ICON = 'FolderKanban';
const DEFAULT_TOPIC_ICON = 'BookOpen';

export const CollectionModal: React.FC<CollectionModalProps> = ({
  isOpen,
  onClose,
  mode,
  collections,
  defaultCollectionId,
  onAddCollection,
  onAddTopic,
}) => {
  // Collection form state
  const [colTitle, setColTitle] = useState('');
  const [colDesc, setColDesc] = useState('');

  // Section form state
  const [secTitle, setSecTitle] = useState('');
  const [secDesc, setSecDesc] = useState('');
  const [secCategory, setSecCategory] = useState('Business');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derive effective collection ID from props
  const effectiveColId = defaultCollectionId || collections[0]?.id || '';

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      // Form will be reset in next useEffect based on mode
    }
  }, [isOpen, mode, defaultCollectionId]);

  if (!isOpen) return null;

  const handleCollectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colTitle.trim()) {
      setError('Vui lòng nhập tên bộ sưu tập');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onAddCollection({
        title: colTitle.trim(),
        description: colDesc.trim() || 'Bộ sưu tập từ vựng tùy chỉnh',
        icon: DEFAULT_COLLECTION_ICON,
      });
      setColTitle('');
      setColDesc('');
      onClose();
    } catch (err) {
      console.error(err);
      setError('Đã có lỗi xảy ra khi tạo bộ sưu tập');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secTitle.trim()) {
      setError('Vui lòng nhập tên Section / Bài học');
      return;
    }
    if (!effectiveColId) {
      setError('Vui lòng chọn hoặc tạo ít nhất 1 Bộ Sưu Tập trước');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onAddTopic({
        collection_id: effectiveColId,
        title: secTitle.trim(),
        description: secDesc.trim() || 'Section bài học từ vựng mới',
        category: secCategory,
        icon: DEFAULT_TOPIC_ICON,
      });
      setSecTitle('');
      setSecDesc('');
      onClose();
    } catch (err) {
      console.error(err);
      setError('Đã có lỗi xảy ra khi tạo Section bài học');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white rounded-[32px] border border-[#FCE7F3] shadow-2xl p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#FCE7F3]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFF1F2] border border-[#FCE7F3] flex items-center justify-center text-[#F472B6]">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-gray-800">
                {mode === 'collection' ? 'Tạo Bộ Sưu Tập' : 'Tạo Section Bài Học'}
              </h3>
              <p className="text-xs text-gray-500">
                {mode === 'collection'
                  ? 'Tạo bộ sưu tập từ vựng mới'
                  : 'Tạo section bài học mới'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-gray-100 hover:bg-[#FFF1F2] text-gray-500 hover:text-[#F472B6] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs font-bold">
            {error}
          </div>
        )}

        {/* Form: Collection */}
        {mode === 'collection' && (
          <form onSubmit={handleCollectionSubmit} className="space-y-4 text-xs font-bold">
            <div>
              <label className="block text-gray-700 mb-1">
                Tên Bộ Sưu Tập <span className="text-[#F472B6]">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ví dụ: TOEIC 800+ Master, Tiếng Anh Giao Tiếp..."
                value={colTitle}
                onChange={(e) => setColTitle(e.target.value)}
                className="w-full p-3 bg-[#FFF9FA] border border-[#FCE7F3] rounded-2xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#F472B6]"
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-1">Mô tả bộ sưu tập</label>
              <textarea
                rows={2}
                placeholder="Mô tả mục tiêu học tập hoặc chủ đề chính..."
                value={colDesc}
                onChange={(e) => setColDesc(e.target.value)}
                className="w-full p-3 bg-[#FFF9FA] border border-[#FCE7F3] rounded-2xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#F472B6]"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-2xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-2xl bg-[#F472B6] hover:bg-[#ec4899] text-white font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Đang Tạo...' : 'Tạo Bộ Sưu Tập'}
              </button>
            </div>
          </form>
        )}

        {/* Form: Section */}
        {mode === 'section' && (
          <form onSubmit={handleSectionSubmit} className="space-y-4 text-xs font-bold">
            <div>
              <label className="block text-gray-700 mb-1">
                Bộ Sưu Tập Chứa Section <span className="text-[#F472B6]">*</span>
              </label>
              <select
                value={effectiveColId}
                onChange={(e) => {
                  // Section form uses derived effectiveColId, no local state needed
                }}
                disabled
                className="w-full p-3 bg-[#FFF9FA] border border-[#FCE7F3] rounded-2xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#F472B6] opacity-75"
              >
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    📂 {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-700 mb-1">
                Tên Section / Bài học <span className="text-[#F472B6]">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ví dụ: Section 1: Hợp Đồng & Đàm Phán..."
                value={secTitle}
                onChange={(e) => setSecTitle(e.target.value)}
                className="w-full p-3 bg-[#FFF9FA] border border-[#FCE7F3] rounded-2xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#F472B6]"
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-1">Phân Loại (Category)</label>
              <input
                type="text"
                placeholder="Business, Travel, Finance..."
                value={secCategory}
                onChange={(e) => setSecCategory(e.target.value)}
                className="w-full p-3 bg-[#FFF9FA] border border-[#FCE7F3] rounded-2xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#F472B6]"
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-1">Mô tả ngắn bài học</label>
              <textarea
                rows={2}
                placeholder="Tóm tắt từ vựng cốt lõi hoặc dạng câu hỏi TOEIC áp dụng..."
                value={secDesc}
                onChange={(e) => setSecDesc(e.target.value)}
                className="w-full p-3 bg-[#FFF9FA] border border-[#FCE7F3] rounded-2xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#F472B6]"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-2xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-2xl bg-[#F472B6] hover:bg-[#ec4899] text-white font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Đang Tạo...' : 'Tạo Section'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
