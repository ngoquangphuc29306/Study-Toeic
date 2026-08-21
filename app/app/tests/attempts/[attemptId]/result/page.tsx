import { ToeicAttemptResultPage } from '@/features/toeic-tests/components/ToeicAttemptResultPage';

export default async function ToeicAttemptResultRoute({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  return <ToeicAttemptResultPage attemptId={attemptId} />;
}
