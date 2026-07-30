'use client';

import React, { useState } from 'react';
import { X, Upload, FileSpreadsheet, Download, CheckCircle, AlertCircle, Trash2, ArrowRight } from 'lucide-react';
import { Collection, Topic, Vocabulary } from '../lib/types';
import { parseExcelFile, downloadExcelTemplate, ParsedVocabRow } from '../lib/excelUtils';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  collections: Collection[];
  topics: Topic[];
  defaultTopicId?: string;
  onBulkAddVocabularies: (vocabs: Omit<Vocabulary, 'id'>[]) => Promise<void>;
  onAddTopic: (newTopic: Omit<Topic, 'id'>) => Promise<Topic>;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  collections,
  topics,
  defaultTopicId,
  onBulkAddVocabularies,
  onAddTopic,
}) => {
  const [selectedColId, setSelectedColId] = useState<string>(collections[0]?.id || '');
  const [selectedTopicId, setSelectedTopicId] = useState<string>(defaultTopicId || topics[0]?.id || '');
  const [prevDefaultTopicId, setPrevDefaultTopicId] = useState<string | undefined>(defaultTopicId);

  // Sync prop to state safely during render if changed
  if (defaultTopicId !== prevDefaultTopicId) {
    setPrevDefaultTopicId(defaultTopicId);
    if (defaultTopicId) {
      setSelectedTopicId(defaultTopicId);
      const parentTopic = topics.find((t) => t.id === defaultTopicId);
      if (parentTopic && parentTopic.collection_id) {
        setSelectedColId(parentTopic.collection_id);
      }
    }
  }

  // Quick inline new section creation state
  const [isCreatingNewTopic, setIsCreatingNewTopic] = useState<boolean>(false);
  const [newTopicTitle, setNewTopicTitle] = useState<string>('');

  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedVocabRow[]>([]);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filter topics for selected collection
  const availableTopics = topics.filter((t) => !selectedColId || t.collection_id === selectedColId);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setErrorMsg(null);
    setIsParsing(true);

    try {
      const rows = await parseExcelFile(uploadedFile);
      if (rows.length === 0) {
        setErrorMsg('File Excel/CSV không chứa dữ liệu từ vựng hợp lệ.');
      }
      setParsedRows(rows);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg('Không thể đọc file. Vui lòng đảm bảo file là định dạng Excel (.xlsx, .xls) hoặc CSV hợp lệ.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleRemoveRow = (index: number) => {
    setParsedRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImportSubmit = async () => {
    let targetSectionId = selectedTopicId;

    if (isCreatingNewTopic) {
      if (!newTopicTitle.trim()) {
        setErrorMsg('Vui lòng nhập tên Section / Bài học mới.');
        return;
      }
      try {
        const createdTopic = await onAddTopic({
          collection_id: selectedColId || collections[0]?.id,
          title: newTopicTitle.trim(),
          description: 'Bài học tạo tự động từ Import Excel',
          icon: 'BookOpen',
          category: 'Imported',
        });
        targetSectionId = createdTopic.id;
      } catch (err) {
        console.error(err);
        setErrorMsg('Lỗi khi tạo Section mới.');
        return;
      }
    }

    if (!targetSectionId) {
      setErrorMsg('Vui lòng chọn Section / Bài học đích để lưu từ vựng.');
      return;
    }

    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      setErrorMsg('Không có dòng từ vựng hợp lệ nào để import.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Omit<Vocabulary, 'id'>[] = validRows.map((r) => ({
        topic_id: targetSectionId,
        word: r.word,
        phonetic_uk: r.phonetic_uk,
        phonetic_us: r.phonetic_us,
        part_of_speech: r.part_of_speech || 'noun',
        meaning: r.meaning,
        example: r.example,
        example_translation: r.example_translation,
        synonyms: r.synonyms,
        collocations: r.collocations,
        note: r.note,
      }));

      await onBulkAddVocabularies(payload);
      
      // Reset & Close
      setFile(null);
      setParsedRows([]);
      setErrorMsg(null);
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('Xảy ra lỗi trong quá trình import từ vựng.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-[32px] border border-[#FCE7F3] shadow-2xl overflow-hidden flex flex-col p-6 sm:p-8 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#FCE7F3]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFF1F2] border border-[#FCE7F3] flex items-center justify-center text-[#F472B6]">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-gray-800">
                Import Từ Vựng Bằng File Excel
              </h3>
              <p className="text-xs text-gray-500">
                Tải file .xlsx, .xls hoặc .csv có đầy đủ các cột chi tiết từ vựng
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={downloadExcelTemplate}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-[#FFF1F2] hover:bg-[#FCE7F3] text-[#F472B6] border border-[#FCE7F3] text-xs font-bold transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Tải File Mẫu (.xlsx)</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-full bg-gray-100 hover:bg-[#FFF1F2] text-gray-500 hover:text-[#F472B6] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Section 1: Target Destination Picker */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#FFF9FA] p-4 rounded-2xl border border-[#FCE7F3] text-xs">
          <div>
            <label className="block font-bold text-gray-700 mb-1">
              1. Chọn Collection (Bộ sưu tập) <span className="text-[#F472B6]">*</span>
            </label>
            <select
              value={selectedColId}
              onChange={(e) => {
                const colId = e.target.value;
                setSelectedColId(colId);
                const firstMatchingTopic = topics.find((t) => t.collection_id === colId);
                if (firstMatchingTopic) setSelectedTopicId(firstMatchingTopic.id);
              }}
              className="w-full p-2.5 bg-white border border-[#FCE7F3] rounded-xl font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#F472B6]"
            >
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  📂 {c.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-gray-700">
                2. Chọn Section (Bài học đích) <span className="text-[#F472B6]">*</span>
              </label>
              <button
                type="button"
                onClick={() => setIsCreatingNewTopic(!isCreatingNewTopic)}
                className="text-[11px] font-bold text-[#F472B6] hover:underline cursor-pointer"
              >
                {isCreatingNewTopic ? 'Chấm dứt tạo Section mới' : '+ Tạo Section Mới'}
              </button>
            </div>

            {isCreatingNewTopic ? (
              <input
                type="text"
                placeholder="Nhập tên Section mới (ví dụ: Section 4: Chăm Sóc Khách Hàng)..."
                value={newTopicTitle}
                onChange={(e) => setNewTopicTitle(e.target.value)}
                className="w-full p-2.5 bg-white border border-[#FCE7F3] rounded-xl font-bold text-[#F472B6] focus:outline-none focus:ring-2 focus:ring-[#F472B6]"
              />
            ) : (
              <select
                value={selectedTopicId}
                onChange={(e) => setSelectedTopicId(e.target.value)}
                className="w-full p-2.5 bg-white border border-[#FCE7F3] rounded-xl font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#F472B6]"
              >
                {availableTopics.length > 0 ? (
                  availableTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      📖 {t.title}
                    </option>
                  ))
                ) : (
                  <option value="">(Chưa có Section nào trong Collection này)</option>
                )}
              </select>
            )}
          </div>
        </div>

        {/* Section 2: Upload Zone */}
        {!file && (
          <div className="border-2 border-dashed border-[#FCE7F3] rounded-3xl p-8 text-center space-y-3 bg-[#FFF9FA]/50 hover:bg-[#FFF1F2]/30 transition-all cursor-pointer relative">
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="w-14 h-14 mx-auto rounded-full bg-[#FFF1F2] text-[#F472B6] flex items-center justify-center">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">
                Kéo thả file Excel vào đây hoặc click để chọn file
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Hỗ trợ định dạng Excel (.xlsx, .xls) hoặc CSV. Tự động nhận diện các cột:
                <br />
                <span className="font-semibold text-[#F472B6]">
                  Từ vựng, IPA-UK, IPK-US, Meaning, example, example_vi, từ đồng nghĩa, cụm từ
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Section 3: Preview Table */}
        {parsedRows.length > 0 && (
          <div className="flex-1 overflow-hidden flex flex-col space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-gray-700">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-[#FFF1F2] text-[#F472B6]">
                  {validCount} / {parsedRows.length} dòng hợp lệ
                </span>
                <span className="text-gray-400 font-normal">File: {file?.name}</span>
              </div>

              <label className="text-[#F472B6] hover:underline cursor-pointer">
                Đổi File Khác
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex-1 overflow-y-auto border border-[#FCE7F3] rounded-2xl bg-white max-h-[300px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-[#FFF1F2] text-[#F472B6] font-bold text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">STT</th>
                    <th className="py-2.5 px-3">Từ Vựng</th>
                    <th className="py-2.5 px-3">IPA (UK/US)</th>
                    <th className="py-2.5 px-3">Meaning</th>
                    <th className="py-2.5 px-3">Ví Dụ & Dịch</th>
                    <th className="py-2.5 px-3">Từ Đồng Nghĩa</th>
                    <th className="py-2.5 px-3">Cụm Từ</th>
                    <th className="py-2.5 px-3 text-center">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#FCE7F3]">
                  {parsedRows.map((row, idx) => (
                    <tr
                      key={idx}
                      className={row.isValid ? 'hover:bg-[#FFF9FA]' : 'bg-rose-50/60'}
                    >
                      <td className="py-2 px-3 text-gray-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>

                      <td className="py-2 px-3 font-bold text-gray-800">
                        <div className="flex items-center gap-1">
                          {row.isValid ? (
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                          )}
                          <span className="text-[#F472B6] font-extrabold">{row.word || '—'}</span>
                        </div>
                        <span className="text-[10px] text-gray-400 uppercase font-bold">
                          {row.part_of_speech}
                        </span>
                      </td>

                      <td className="py-2 px-3 text-gray-500 font-mono text-[11px]">
                        <div>UK: {row.phonetic_uk || '—'}</div>
                        <div>US: {row.phonetic_us || '—'}</div>
                      </td>

                      <td className="py-2 px-3 font-bold text-gray-700 max-w-[160px]">
                        {row.meaning || <span className="text-rose-500">Chưa có nghĩa</span>}
                      </td>

                      <td className="py-2 px-3 text-gray-600 max-w-[200px] text-[11px]">
                        {row.example && <p className="italic">&ldquo;{row.example}&rdquo;</p>}
                        {row.example_translation && (
                          <p className="text-gray-400">👉 {row.example_translation}</p>
                        )}
                      </td>

                      <td className="py-2 px-3 text-gray-600 max-w-[120px] text-[11px]">
                        {row.synonyms ? (
                          <span className="bg-pink-50 text-[#F472B6] px-2 py-0.5 rounded font-semibold">
                            {row.synonyms}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="py-2 px-3 text-gray-600 max-w-[140px] text-[11px]">
                        {row.collocations ? (
                          <span className="bg-[#FFF1F2] text-gray-700 px-2 py-0.5 rounded italic">
                            {row.collocations}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="py-2 px-3 text-center">
                        <button
                          onClick={() => handleRemoveRow(idx)}
                          className="p-1 hover:bg-rose-100 rounded text-rose-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Error Feedback */}
        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#FCE7F3]">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-xs transition-all cursor-pointer"
          >
            Hủy Bỏ
          </button>

          <button
            onClick={handleImportSubmit}
            disabled={isSubmitting || isParsing || parsedRows.length === 0 || validCount === 0}
            className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-[#F472B6] hover:bg-[#ec4899] text-white font-bold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            <span>{isSubmitting ? 'Đang Import...' : `Xác Nhận Import (${validCount} Từ)`}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
