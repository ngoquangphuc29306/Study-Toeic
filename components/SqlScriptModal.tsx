'use client';

import React, { useState } from 'react';
import { X, Copy, Check, Download, Database, ExternalLink, ShieldCheck } from 'lucide-react';
import { SUPABASE_SQL_SCRIPT } from '../lib/sqlScript';

interface SqlScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SqlScriptModal: React.FC<SqlScriptModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState<boolean>(false);

  // ESC key handler
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCRIPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([SUPABASE_SQL_SCRIPT], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vocab_toeic_phase1_supabase.sql';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-white rounded-[20px] sm:rounded-3xl border border-pink-100 shadow-2xl overflow-hidden p-4 sm:p-6 lg:p-8 space-y-5 max-h-[90dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sql-script-modal-title"
      >
        {/* Modal Close Button */}
        <button
          onClick={onClose}
          aria-label="Đóng"
          className="absolute top-5 right-5 p-1.5 rounded-full bg-gray-100 hover:bg-pink-100 text-gray-500 hover:text-pink-600 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Title */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-100 text-pink-700 text-xs font-bold">
            <Database className="w-3.5 h-3.5" />
            <span>Supabase SQL Architecture & Seed Data</span>
          </div>
          <h3 id="sql-script-modal-title" className="text-xl font-extrabold text-gray-800">
            Script Khởi Tạo Cơ Sở Dữ Liệu Supabase (Phase 1)
          </h3>
          <p className="text-xs text-gray-500">
            Bao gồm khởi tạo các bảng <code className="bg-pink-50 text-pink-600 px-1 py-0.5 rounded font-mono">topics</code>, <code className="bg-pink-50 text-pink-600 px-1 py-0.5 rounded font-mono">vocabularies</code>, <code className="bg-pink-50 text-pink-600 px-1 py-0.5 rounded font-mono">user_vocab_progress</code>, bật RLS & Policy bảo mật, cùng dữ liệu Seed ban đầu.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                copied
                  ? 'bg-emerald-500 text-white'
                  : 'bg-pink-500 hover:bg-pink-600 text-white shadow-xs'
              }`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Đã Sao Chép SQL!' : 'Sao Chép SQL Script'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200 text-xs font-bold transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Tải File .sql</span>
            </button>
          </div>

          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-pink-600 font-semibold"
          >
            <span>Mở Supabase SQL Editor</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* SQL Script Display Container */}
        <div className="relative flex-1 bg-gray-900 rounded-2xl p-4 overflow-y-auto border border-gray-800 text-gray-100 font-mono text-xs leading-relaxed space-y-1">
          <pre className="whitespace-pre-wrap selection:bg-pink-500 selection:text-white">
            {SUPABASE_SQL_SCRIPT}
          </pre>
        </div>

        {/* Quick Instructions */}
        <div className="p-3.5 rounded-2xl bg-pink-50/80 border border-pink-100 text-xs space-y-1 text-gray-600">
          <p className="font-bold text-gray-800 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-pink-500" />
            Hướng dẫn thực thi trên Supabase:
          </p>
          <ol className="list-decimal list-inside space-y-0.5 text-[11px] pl-1 text-gray-600">
            <li>Đăng nhập <a href="https://supabase.com" target="_blank" className="text-pink-600 font-bold underline">Supabase Dashboard</a> và chọn dự án của bạn.</li>
            <li>Vào mục <strong>SQL Editor</strong> ở menu bên trái &gt; Bấm <strong>New Query</strong>.</li>
            <li>Dán toàn bộ nội dung SQL trên và bấm <strong>Run (Ctrl+Enter)</strong>.</li>
            <li>Dữ liệu từ vựng sẽ tự động được gieo mầm (seed) và sẵn sàng sử dụng!</li>
          </ol>
        </div>
      </div>
    </div>
  );
};
