import { ToeicAttemptWorkspace } from '@/features/toeic-tests/components/ToeicAttemptWorkspace';

export default async function ToeicAttemptRoute({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  return <ToeicAttemptWorkspace attemptId={attemptId} />;
}
