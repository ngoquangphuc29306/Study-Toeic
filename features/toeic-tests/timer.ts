import type { ToeicAttemptSession } from './attemptContracts';

export function getServerClockOffsetMs(serverNow: string, clientNow = Date.now()): number {
  const serverTime = Date.parse(serverNow);
  if (Number.isNaN(serverTime)) throw new Error('Invalid TOEIC server time');
  return serverTime - clientNow;
}

export function getRemainingToeicSeconds(
  session: Pick<ToeicAttemptSession, 'deadlineAt'>,
  clientNow = Date.now(),
  serverClockOffsetMs = 0
): number | null {
  if (!session.deadlineAt) return null;
  const deadline = Date.parse(session.deadlineAt);
  if (Number.isNaN(deadline)) throw new Error('Invalid TOEIC deadline');
  return Math.max(0, Math.floor((deadline - (clientNow + serverClockOffsetMs)) / 1000));
}
