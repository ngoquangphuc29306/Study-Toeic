/**
 * Import/Export Service
 *
 * Phase 8: Vocabulary data import/export functionality
 * - Excel import verification (existing feature with Supabase)
 * - CSV export for vocabularies
 * - JSON backup export for all user data
 */

import { createClient } from '@/lib/supabase/client';
import type { Vocabulary, Topic, Collection, UserVocabProgress } from '@/lib/types';

export interface ReviewLog {
  id?: string;
  user_id?: string;
  vocabulary_id: string;
  rating: string;
  reviewed_at: string;
  previous_status?: string;
  new_status?: string;
  previous_interval_hours?: number;
  new_interval_hours?: number;
}

export interface ExportVocabulary {
  word: string;
  phonetic_uk: string;
  phonetic_us: string;
  part_of_speech: string;
  meaning: string;
  example: string;
  example_translation: string;
  synonyms: string;
  collocations: string;
  note: string;
  topic_name: string;
  collection_name: string;
}

export interface VocabularyBackup {
  version: 1;
  exportedAt: string;
  collections: Collection[];
  topics: Topic[];
  vocabularies: Vocabulary[];
  progress?: UserVocabProgress[];
  reviewLogs?: ReviewLog[];
  reviewLogsLimit: number;
  reviewLogsTruncated: boolean;
}

/**
 * Get all user vocabularies with topic and collection names for export
 */
export async function getVocabulariesForExport(): Promise<ExportVocabulary[]> {
  const supabase = createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }

  try {
    const { data, error } = await supabase
      .from('vocabularies')
      .select(`
        word,
        phonetic_uk,
        phonetic_us,
        part_of_speech,
        meaning,
        example,
        example_translation,
        synonyms,
        collocations,
        note,
        topics!inner(title, collections!inner(title))
      `)
      .order('word', { ascending: true });

    if (error) throw error;

    if (!data) return [];

    // TypeScript any: Supabase nested JOIN returns untyped object with topics.collections structure
    // All fields explicitly accessed with fallback values for safety
    return data.map((v: any) => ({
      word: v.word || '',
      phonetic_uk: v.phonetic_uk || '',
      phonetic_us: v.phonetic_us || '',
      part_of_speech: v.part_of_speech || '',
      meaning: v.meaning || '',
      example: v.example || '',
      example_translation: v.example_translation || '',
      synonyms: v.synonyms || '',
      collocations: v.collocations || '',
      note: v.note || '',
      topic_name: v.topics?.title || '',
      collection_name: v.topics?.collections?.title || '',
    }));
  } catch (err) {
    console.error('getVocabulariesForExport error:', err);
    throw new Error('Không thể tải dữ liệu từ vựng để xuất.');
  }
}

/**
 * Export vocabularies as CSV
 * UTF-8 with BOM for Excel Vietnamese compatibility
 */
export async function exportVocabulariesAsCSV(): Promise<void> {
  const vocabularies = await getVocabulariesForExport();

  if (vocabularies.length === 0) {
    throw new Error('Không có từ vựng nào để xuất.');
  }

  const headers = [
    'Từ vựng',
    'IPA-UK',
    'IPA-US',
    'Loại từ',
    'Meaning',
    'Example',
    'Example_vi',
    'Từ đồng nghĩa',
    'Cụm từ',
    'Ghi chú',
    'Học phần',
    'Bộ sưu tập',
  ];

  const rows = vocabularies.map((v) => [
    v.word,
    v.phonetic_uk,
    v.phonetic_us,
    v.part_of_speech,
    v.meaning,
    v.example,
    v.example_translation,
    v.synonyms,
    v.collocations,
    v.note,
    v.topic_name,
    v.collection_name,
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => escapeCSVCell(cell)).join(','))
    .join('\n');

  // UTF-8 BOM for Excel Vietnamese display
  const BOM = '﻿';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

  const date = new Date().toISOString().split('T')[0];
  const filename = `toeic-vocabulary-${date}.csv`;

  downloadBlob(blob, filename);
}

/**
 * Escape CSV cell value
 * Handles: commas, quotes, newlines
 */
function escapeCSVCell(value: string): string {
  if (!value) return '';

  const stringValue = String(value);

  // If contains comma, quote, or newline → wrap in quotes and escape internal quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Get all user data for backup
 */
export async function getUserDataForBackup(): Promise<VocabularyBackup> {
  const supabase = createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }

  try {
    // Parallel fetch all user data
    const [collectionsResult, topicsResult, vocabulariesResult, progressResult, reviewLogsResult] =
      await Promise.all([
        supabase.from('collections').select('*').order('created_at', { ascending: true }),
        supabase.from('topics').select('*').order('created_at', { ascending: true }),
        supabase.from('vocabularies').select('*').order('created_at', { ascending: true }),
        supabase.from('user_vocab_progress').select('*').order('created_at', { ascending: true }),
        supabase
          .from('review_logs')
          .select('*')
          .order('reviewed_at', { ascending: false })
          .limit(5001), // Fetch 5001 to detect truncation
      ]);

    if (collectionsResult.error) throw collectionsResult.error;
    if (topicsResult.error) throw topicsResult.error;
    if (vocabulariesResult.error) throw vocabulariesResult.error;
    if (progressResult.error) throw progressResult.error;
    if (reviewLogsResult.error) throw reviewLogsResult.error;

    const allReviewLogs = reviewLogsResult.data || [];
    const reviewLogsTruncated = allReviewLogs.length > 5000;
    const reviewLogs = reviewLogsTruncated ? allReviewLogs.slice(0, 5000) : allReviewLogs;

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      collections: collectionsResult.data || [],
      topics: topicsResult.data || [],
      vocabularies: vocabulariesResult.data || [],
      progress: progressResult.data || [],
      reviewLogs,
      reviewLogsLimit: 5000,
      reviewLogsTruncated,
    };
  } catch (err) {
    console.error('getUserDataForBackup error:', err);
    throw new Error('Không thể tải dữ liệu người dùng để sao lưu.');
  }
}

/**
 * Export full user backup as JSON
 */
export async function exportBackupAsJSON(): Promise<void> {
  const backup = await getUserDataForBackup();

  const jsonContent = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });

  const date = new Date().toISOString().split('T')[0];
  const filename = `toeic-vocabulary-backup-${date}.json`;

  downloadBlob(blob, filename);
}

/**
 * Trigger browser download for blob
 * Revokes URL after download to prevent memory leaks
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoke URL after a short delay to ensure download starts
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
