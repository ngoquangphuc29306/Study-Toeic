import { ToeicAttemptReviewPage } from '@/features/toeic-tests/components/ToeicAttemptReviewPage';

export default async function ToeicAttemptReviewRoute({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  return <ToeicAttemptReviewPage attemptId={attemptId} />;
}
