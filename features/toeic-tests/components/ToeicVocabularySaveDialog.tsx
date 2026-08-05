'use client';

import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, Save, X } from 'lucide-react';
import type { ToeicLearningVocabularyItem } from '../learningContracts';
import { listToeicVocabularyCollections, listToeicVocabularySections, saveToeicVocabulary } from '../services/toeicVocabularyAdapter';

export function ToeicVocabularySaveDialog({
  item,
  open,
  onClose,
}: {
  item: ToeicLearningVocabularyItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const firstControlRef = useRef<HTMLSelectElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [collections, setCollections] = useState<ReadonlyArray<{ id: string; title: string }>>([]);
  const [sections, setSections] = useState<ReadonlyArray<{ id: string; title: string }>>([]);
  const [collectionId, setCollectionId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<'created' | 'duplicate' | null>(null);

  useEffect(() => {
    if (!open || !item) return;
    let active = true;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    queueMicrotask(() => {
      if (!active) return;
      setLoading(true);
      setError(null);
      setResult(null);
      setCollectionId('');
      setSectionId('');
      setSections([]);
      void listToeicVocabularyCollections().then((value) => { if (active) setCollections(value); }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải Collection.'); }).finally(() => { if (active) setLoading(false); });
    });
    const focusTimer = window.setTimeout(() => firstControlRef.current?.focus(), 0);
    return () => { active = false; window.clearTimeout(focusTimer); returnFocusRef.current?.focus(); };
  }, [item, open]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (!collectionId) { setSections([]); setSectionId(''); return; }
      setSectionsLoading(true);
      setError(null);
      setSectionId('');
      void listToeicVocabularySections(collectionId).then((value) => { if (active) setSections(value); }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải Section.'); }).finally(() => { if (active) setSectionsLoading(false); });
    });
    return () => { active = false; };
  }, [collectionId]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab') return;
      const dialog = event.currentTarget instanceof Window ? document.querySelector('[data-toeic-vocab-dialog="true"]') : null;
      const controls = dialog ? Array.from(dialog.querySelectorAll<HTMLElement>('button, select')) .filter((control) => !control.hasAttribute('disabled')) : [];
      if (controls.length === 0) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open || !item) return null;

  const submit = async () => {
    if (!collectionId || !sectionId) { setError('Hãy chọn Collection và Section trước khi lưu.'); return; }
    setBusy(true);
    setError(null);
    try {
      const saved = await saveToeicVocabulary({ word: item.word, meaningVi: item.meaningVi, partOfSpeech: item.partOfSpeech, collectionId, sectionId });
      setResult(saved.status);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể lưu từ vựng.');
    } finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#493B42]/40 p-4" role="presentation"><div data-toeic-vocab-dialog="true" role="dialog" aria-modal="true" aria-labelledby="toeic-vocab-dialog-title" className="w-full max-w-lg rounded-3xl border border-[#FBCFE8] bg-white p-5 shadow-xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#F472B6]">Lưu từ vựng</p><h2 id="toeic-vocab-dialog-title" className="mt-1 text-xl font-black text-[#493B42]">Thêm vào danh sách học</h2></div><button type="button" onClick={onClose} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]" aria-label="Đóng"><X className="h-5 w-5" aria-hidden="true" /></button></div><div className="mt-4 rounded-2xl bg-[#FFF8FA] p-4"><p className="font-extrabold text-[#493B42]">{item.word}</p><p className="mt-1 text-sm text-gray-600">{[item.partOfSpeech, item.meaningVi].filter(Boolean).join(' · ') || 'Chưa có nghĩa tiếng Việt'}</p></div>{loading ? <div className="mt-5 flex items-center gap-2 text-sm text-gray-500" role="status"><LoaderCircle className="h-4 w-4 animate-spin text-[#F472B6]" aria-hidden="true" /> Đang tải Collection…</div> : result ? <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800" role="status">{result === 'duplicate' ? 'Từ này đã có trong Section đã chọn.' : 'Đã lưu từ vựng thành công.'}</div> : <div className="mt-5 space-y-4"><label className="block text-sm font-bold text-[#493B42]">Collection<select ref={firstControlRef} value={collectionId} onChange={(event) => setCollectionId(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[#FBCFE8] bg-white px-3 focus:border-[#F472B6] focus:outline-none focus:ring-2 focus:ring-[#F472B6]"><option value="">Chọn Collection</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.title}</option>)}</select></label><label className="block text-sm font-bold text-[#493B42]">Section<select value={sectionId} onChange={(event) => setSectionId(event.target.value)} disabled={!collectionId || sectionsLoading || sections.length === 0} className="mt-2 min-h-11 w-full rounded-xl border border-[#FBCFE8] bg-white px-3 focus:border-[#F472B6] focus:outline-none focus:ring-2 focus:ring-[#F472B6] disabled:bg-gray-50"><option value="">{sectionsLoading ? 'Đang tải Section…' : sections.length === 0 && collectionId ? 'Collection chưa có Section' : 'Chọn Section'}</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}</select></label></div>}{error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700" role="alert">{error}</p>}<div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-[#FBCFE8] px-4 text-sm font-bold text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]">Đóng</button>{!result && <button type="button" onClick={() => void submit()} disabled={busy || loading || !collectionId || !sectionId} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#F472B6] px-4 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] disabled:cursor-not-allowed disabled:opacity-50">{busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}<Save className="h-4 w-4" aria-hidden="true" /> Lưu từ</button>}</div></div></div>;
}
