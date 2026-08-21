import { ToeicTestOverviewPage } from '@/features/toeic-tests/components/ToeicTestOverviewPage';

export default async function ToeicTestOverviewRoute({ params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params;
  return <ToeicTestOverviewPage testId={testId} />;
}
