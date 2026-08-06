import type { ToeicTestMode, ToeicTestPart } from '../types';

export type ToeicNavigationAction =
  | 'previous'
  | 'next'
  | 'palette-jump'
  | 'part-jump'
  | 'group-question'
  | 'auto-advance';

export interface ToeicNavigationPolicyInput {
  mode: ToeicTestMode;
  action: ToeicNavigationAction;
  currentPart: ToeicTestPart;
  targetPart: ToeicTestPart;
  currentPosition: number;
  targetPosition: number;
  currentMediaGroupKey: string | null;
  targetMediaGroupKey: string | null;
  mediaHasStarted: boolean;
  mediaHasEnded: boolean;
}

export interface ToeicNavigationDecision {
  allowed: boolean;
  reason: string | null;
}

const LISTENING_LOCK_REASON =
  'Trong chế độ Thi thử, phần Nghe được thực hiện theo thứ tự.';
const READING_ONLY_REASON =
  'Trong chế độ Thi thử, không thể quay lại phần Nghe.';

function allow(): ToeicNavigationDecision {
  return { allowed: true, reason: null };
}

function deny(reason: string): ToeicNavigationDecision {
  return { allowed: false, reason };
}

export function decideToeicNavigation({
  mode,
  action,
  currentPart,
  targetPart,
  currentPosition,
  targetPosition,
  currentMediaGroupKey,
  targetMediaGroupKey,
  mediaHasStarted,
  mediaHasEnded,
}: ToeicNavigationPolicyInput): ToeicNavigationDecision {
  if (targetPosition === currentPosition) return allow();
  if (mode === 'practice') return allow();

  const currentIsListening = currentPart <= 4;
  const targetIsListening = targetPart <= 4;

  if (!currentIsListening) {
    return targetIsListening ? deny(READING_ONLY_REASON) : allow();
  }

  if (action === 'group-question' && currentMediaGroupKey === targetMediaGroupKey) {
    return allow();
  }

  if (action === 'auto-advance') {
    if (!mediaHasStarted || !mediaHasEnded) {
      return deny('Hãy nghe hết audio trước khi chuyển câu.');
    }
    if (targetPosition <= currentPosition || targetMediaGroupKey === currentMediaGroupKey) {
      return deny('Audio hiện tại chưa hoàn tất để chuyển nhóm.');
    }
    return allow();
  }

  // Listening is sequential and is driven only by the media lifecycle. A
  // palette, tab, previous/next button, or keyboard event cannot bypass it.
  if (action === 'previous' || action === 'next' || action === 'palette-jump' || action === 'part-jump') {
    return deny(LISTENING_LOCK_REASON);
  }

  return targetIsListening
    ? deny(LISTENING_LOCK_REASON)
    : deny('Hãy hoàn tất phần Nghe trước khi chuyển sang phần Đọc.');
}

