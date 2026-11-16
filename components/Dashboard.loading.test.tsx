// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard';
import { Navbar } from './Navbar';
import type { DashboardMetrics } from '../services/dashboardService';

vi.mock('next/navigation', () => ({ useRouter: () => ({}), usePathname: () => '/app' }));
vi.mock('./auth/sign-out-button', () => ({ SignOutButton: () => null }));
vi.mock('@/services/profileService', () => ({ getCurrentProfile: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }));
vi.mock('../hooks/use-prefers-reduced-motion', () => ({ usePrefersReducedMotion: () => true }));

function dashboard(metrics: DashboardMetrics | null, loadingWeek = true) {
  const container = document.createElement('div');
  container.innerHTML = renderToStaticMarkup(<Dashboard userId="a" topics={[]} vocabularies={[]}
    stats={{ totalWords: 0, newCount: 0, learningCount: 0, masteredCount: 0, dailyStreak: 0, todayStudiedCount: 0 }}
    dashboardMetrics={metrics} weekActivity={[]} isLoadingMetrics={metrics === null} isLoadingWeekActivity={loadingWeek}
    onSelectTopicForFlashcard={() => undefined} onSelectTopicForSynonyms={() => undefined} onOpenCollectionModal={() => undefined} />);
  return container;
}
const metrics: DashboardMetrics = { totalVocabulary: 0, newVocabulary: 0, learningVocabulary: 0, masteredVocabulary: 0, dueVocabulary: 0, reviewsToday: 0, uniqueVocabularyStudiedToday: 0, newVocabularyStudiedToday: 0, studyStreak: 0, difficultVocabulary: 0 };

it('shows loading placeholders for new words and weekly activity without claiming zero completion', () => {
  const container = dashboard(null);
  const words = container.querySelector('[aria-label="Từ mới hôm nay"]');
  const week = container.querySelector('[aria-label="Lịch tuần này"]');
  expect(words?.getAttribute('aria-busy')).toBe('true');
  expect(words?.textContent).not.toContain('0%');
  expect(words?.textContent).not.toContain('0/20');
  expect(week?.getAttribute('aria-busy')).toBe('true');
  expect(week?.textContent).not.toContain('0/7');
  expect(container.textContent).not.toContain('❄️ Bắt đầu');
});

it('keeps week loading independently after metrics succeed and renders real zero metrics', () => {
  const container = dashboard(metrics);
  expect(container.querySelector('[aria-label="Từ mới hôm nay"]')?.getAttribute('aria-busy')).toBe('false');
  expect(container.querySelector('[aria-label="Từ mới hôm nay"]')?.textContent).toContain('0/20');
  expect(container.querySelector('[aria-label="Lịch tuần này"]')?.getAttribute('aria-busy')).toBe('true');
});

it('renders zero weekly activity only after week succeeds', () => {
  const container = dashboard(null, false);
  expect(container.querySelector('[aria-label="Lịch tuần này"]')?.getAttribute('aria-busy')).toBe('false');
  expect(container.querySelector('[aria-label="Lịch tuần này"]')?.textContent).toContain('0/7');
});

it('keeps the Navbar streak unknown until loaded and displays a real zero after success', () => {
  const container = document.createElement('div');
  const render = (streak: number | null) => renderToStaticMarkup(<Navbar activeTab="dashboard" setActiveTab={() => undefined}
    stats={{ totalWords: 0, newCount: 0, learningCount: 0, masteredCount: 0, dailyStreak: 0, todayStudiedCount: 0 }}
    currentStreak={streak} onOpenSqlModal={() => undefined} onOpenAddModal={() => undefined} />);
  container.innerHTML = render(null);
  expect(container.querySelector('[aria-label="Chuỗi ngày học tập"]')?.getAttribute('aria-busy')).toBe('true');
  container.innerHTML = render(0);
  expect(container.querySelector('[aria-label="Chuỗi ngày học tập"]')?.getAttribute('aria-busy')).toBe('false');
  expect(container.querySelector('[aria-label="Chuỗi ngày học tập"]')?.textContent).toBe('0');
});
