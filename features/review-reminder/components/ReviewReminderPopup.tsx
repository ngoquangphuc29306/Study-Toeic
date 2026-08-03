'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AlarmClock, ArrowRight } from 'lucide-react';
import gsap from 'gsap';
import { motionTokens } from '../../../lib/animation/motionTokens';
import { usePrefersReducedMotion } from '../../../hooks/use-prefers-reduced-motion';

interface ReviewReminderPopupProps {
  isOpen: boolean;
  dueCount: number;
  onSnooze: () => void;
  onReviewNow: () => void;
}

export const ReviewReminderPopup: React.FC<ReviewReminderPopupProps> = ({
  isOpen,
  dueCount,
  onSnooze,
  onReviewNow,
}) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const actionLockedRef = useRef(false);
  const [isClosing, setIsClosing] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen || !popupRef.current) return;

    const ctx = gsap.context(() => {
      const popup = popupRef.current;
      if (!popup) return;

      if (prefersReducedMotion) {
        gsap.set(popup, { clearProps: 'transform,opacity,visibility' });
        return;
      }

      gsap.fromTo(
        popup,
        { autoAlpha: 0, y: motionTokens.distance.medium },
        {
          autoAlpha: 1,
          y: 0,
          duration: motionTokens.duration.fast,
          ease: motionTokens.ease.standard,
          clearProps: 'transform,opacity,visibility',
        }
      );
    }, popupRef);

    return () => ctx.revert();
  }, [isOpen, prefersReducedMotion]);

  useEffect(() => {
    if (!isClosing || !popupRef.current) return;

    const ctx = gsap.context(() => {
      const popup = popupRef.current;
      if (!popup) return;

      if (prefersReducedMotion) {
        pendingActionRef.current?.();
        pendingActionRef.current = null;
        actionLockedRef.current = false;
        setIsClosing(false);
        return;
      }

      gsap.to(popup, {
        autoAlpha: 0,
        y: motionTokens.distance.small,
        duration: motionTokens.duration.instant,
        ease: motionTokens.ease.standard,
        clearProps: 'transform,opacity,visibility',
        onComplete: () => {
          const action = pendingActionRef.current;
          pendingActionRef.current = null;
          actionLockedRef.current = false;
          setIsClosing(false);
          action?.();
        },
      });
    }, popupRef);

    return () => ctx.revert();
  }, [isClosing, prefersReducedMotion]);

  const closeWith = useCallback((action: () => void) => {
    if (actionLockedRef.current) return;
    actionLockedRef.current = true;
    pendingActionRef.current = action;

    if (prefersReducedMotion) {
      pendingActionRef.current = null;
      actionLockedRef.current = false;
      action();
      return;
    }

    setIsClosing(true);
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeWith(onSnooze);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeWith, isOpen, onSnooze]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/20 p-4"
    >
      <div
        ref={popupRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-md rounded-3xl border border-[#FCE7F3] bg-white p-5 shadow-2xl shadow-slate-950/15 sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FFF1F2] text-[#ED4F8E]">
            <AlarmClock className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 id={titleId} className="text-sm font-black text-[#4A4544] sm:text-base">
              Đã đến giờ ôn tập
            </h2>
            <p id={descriptionId} className="mt-1 text-xs leading-relaxed text-[#77716F] sm:text-sm">
              Bạn có <span className="font-black text-[#ED4F8E]">{dueCount}</span> từ sẵn sàng để ôn. Một phiên ôn ngắn sẽ giúp bạn duy trì tiến độ.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => closeWith(onSnooze)}
            className="rounded-xl px-3 py-2 text-xs font-bold text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] focus-visible:ring-offset-2"
          >
            Để sau
          </button>
          <button
            type="button"
            onClick={() => closeWith(onReviewNow)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#ED4F8E] to-[#F472B6] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ED4F8E] focus-visible:ring-offset-2"
          >
            Ôn ngay
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};
