# VocabTOEIC — Target Architecture

**Document Version**: 2.0  
**Created**: 2026-07-30  
**Updated**: 2026-07-30  
**Status**: Official Architecture Contract  
**Authority**: Defines target architecture patterns for production

---

## 1. Architecture Overview

### 1.1. Layered Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    UI Components                        │
│  (React, TailwindCSS, Accessibility)                   │
└────────────┬────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────┐
│              Controllers / Hooks                        │
│  (Loading, Error, Orchestration, View Models)          │
└────────────┬────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────┐
│               Domain Services                           │
│  (SRS Logic, Validation, Business Rules)               │
└────────────┬────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────┐
│                 Repositories                            │
│  (CRUD, Query Builders, Data Mapping)                  │
└────────────┬────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────┐
│                   Supabase                              │
│  (PostgreSQL, Auth, RLS, Realtime)                     │
└─────────────────────────────────────────────────────────┘
```

### 1.2. Design Principles

1. **Separation of Concerns**: Mỗi layer có trách nhiệm rõ ràng
2. **Pure Domain Logic**: Business rules không phụ thuộc framework
3. **Testability**: Mỗi layer testable độc lập
4. **Simple by Default**: Không over-engineer khi chưa cần
5. **Incremental Abstractions**: Introduce patterns when concrete need emerges

**Note on Dependency Inversion**: Repository interfaces and dependency injection are valuable patterns but NOT required for MVP. Start with concrete implementations. Add abstractions incrementally when:
- Multiple implementations emerge (e.g., Supabase + local cache)
- Testing becomes difficult without mocking
- A concrete need for swappable backends appears

---

## 2. Layer Responsibilities

### 2.1. UI Components

**Responsibility**:
- Render JSX/TSX
- Handle user events (onClick, onChange)
- Accessibility (ARIA, keyboard navigation)
- Visual feedback (loading, disabled states)
- **KHÔNG** chứa business logic

**Rules**:
- ✅ Nhận data qua props hoặc hooks
- ✅ Gọi callbacks để trigger actions
- ✅ Hiển thị loading/error states
- ❌ KHÔNG gọi Supabase trực tiếp
- ❌ KHÔNG tính toán SRS scheduling
- ❌ KHÔNG validate business rules

**Example**:
```typescript
// ✅ GOOD: Pure presentational component
interface FlashcardProps {
  word: string;
  meaning: string;
  isFlipped: boolean;
  onFlip: () => void;
  onRate: (rating: SrsRating) => void;
  isLoading?: boolean;
}

export function Flashcard({ word, meaning, isFlipped, onFlip, onRate, isLoading }: FlashcardProps) {
  return (
    <div className="flashcard">
      <div className={isFlipped ? 'flipped' : ''}>
        {isFlipped ? meaning : word}
      </div>
      <button onClick={onFlip} disabled={isLoading}>Flip</button>
      <div className="rating-buttons">
        <button onClick={() => onRate('again')} disabled={isLoading}>Again</button>
        <button onClick={() => onRate('hard')} disabled={isLoading}>Hard</button>
        <button onClick={() => onRate('good')} disabled={isLoading}>Good</button>
        <button onClick={() => onRate('easy')} disabled={isLoading}>Easy</button>
      </div>
    </div>
  );
}
```

```typescript
// ❌ BAD: Component chứa business logic
export function Flashcard({ vocab }: { vocab: Vocabulary }) {
  const handleRate = async (rating: SrsRating) => {
    // ❌ Business logic trong component
    const interval = rating === 'again' ? 1 / 60 : vocab.interval_hours * 3;
    const nextReview = new Date(Date.now() + interval * 3600 * 1000);
    
    // ❌ Direct Supabase call từ component
    await supabase.from('user_vocab_progress').update({
      interval_hours: interval,
      next_review_at: nextReview.toISOString(),
    }).eq('vocabulary_id', vocab.id);
  };
  
  return <div>{/* ... */}</div>;
}
```

---

### 2.2. Controllers / Hooks

**Responsibility**:
- Orchestrate data flow (fetch, transform, update)
- Loading states (`isLoading`, `isError`)
- Error handling
- Call domain services
- Transform domain data → view models
- **KHÔNG** chứa business rules

**Common Patterns**:
```typescript
// Custom hook for flashcard session
export function useFlashcardSession(topicId: string, initialStatus?: LearningStatus) {
  const [cards, setCards] = useState<Vocabulary[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Fetch cards on mount
  useEffect(() => {
    const fetchCards = async () => {
      try {
        setIsLoading(true);
        // Call repository
        const vocabs = await vocabularyRepo.getByTopic(topicId, initialStatus);
        // Shuffle (domain service)
        const shuffled = shuffleCards(vocabs);
        setCards(shuffled);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchCards();
  }, [topicId, initialStatus]);
  
  // Rate card (orchestrate: domain service + repository)
  const rateCard = async (rating: SrsRating) => {
    const vocab = cards[currentIndex];
    
    try {
      // Domain service calculates new progress
      const updatedProgress = await srsService.rateVocabulary(vocab.id, rating);
      
      // Move to next card
      setCurrentIndex((prev) => prev + 1);
      
      return updatedProgress;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };
  
  return {
    currentCard: cards[currentIndex],
    totalCards: cards.length,
    currentIndex,
    isLoading,
    error,
    rateCard,
    hasNext: currentIndex < cards.length - 1,
  };
}
```

**Rules**:
- ✅ Manage component state
- ✅ Call repositories hoặc domain services
- ✅ Handle async operations
- ✅ Transform data for view (ViewModel pattern)
- ❌ KHÔNG tính SRS intervals
- ❌ KHÔNG validate vocabulary fields
- ❌ KHÔNG directly manipulate database

---

### 2.3. Domain Services

**Responsibility**:
- **Pure business rules** (SRS scheduling, validation)
- Domain logic không phụ thuộc React hoặc Supabase
- Stateless, deterministic functions
- Testable với unit tests

**Rules**:
- ✅ Pure functions (same input → same output)
- ✅ Accept timestamp as parameter (không gọi Date.now())
- ✅ Return domain objects
- ❌ KHÔNG phụ thuộc React (no hooks, no JSX)
- ❌ KHÔNG phụ thuộc Supabase (no imports từ @supabase/supabase-js)
- ❌ KHÔNG có side effects (no I/O, no random)

**Example**:
```typescript
// lib/srs/scheduler.ts
// ✅ GOOD: Pure domain service
export function calculateNextReview(
  progress: UserVocabProgress,
  rating: SrsRating,
  nowMs: number // <-- Passed in, not Date.now()
): {
  status: LearningStatus;
  intervalHours: number;
  nextReviewMs: number | null;
  againCount: number;
} {
  let newIntervalHours = progress.intervalHours;
  let againCount = progress.againCount ?? 0;
  
  // APPROVED MVP ALGORITHM (current behaviour)
  switch (rating) {
    case 'again':
      newIntervalHours = 1 / 60; // 1 minute
      againCount += 1;
      break;
    case 'hard':
      newIntervalHours = newIntervalHours > 0 ? newIntervalHours * 2 : 6;
      break;
    case 'good':
      newIntervalHours = newIntervalHours > 0 ? newIntervalHours * 3 : 24;
      break;
    case 'easy':
      newIntervalHours = newIntervalHours > 0 ? newIntervalHours * 4 : 72;
      break;
    case 'mastered':
      return {
        status: 'mastered',
        intervalHours: newIntervalHours,
        nextReviewMs: null,
        againCount,
      };
  }
  
  const nextReviewMs = nowMs + newIntervalHours * 3600 * 1000;
  
  return {
    status: 'learning',
    intervalHours: newIntervalHours,
    nextReviewMs,
    againCount,
  };
}
```

**File Structure**:
```
lib/
  ├── srs/
  │     ├── scheduler.ts        // Core SRS logic
  │     ├── scheduler.test.ts   // Unit tests
  │     └── types.ts            // Domain types
  ├── validation/
  │     ├── vocabulary.ts       // Vocabulary validation rules
  │     └── vocabulary.test.ts
  └── utils/
        └── dates.ts            // Date utilities (pure functions)
```

---

### 2.4. Repositories

**Responsibility**:
- CRUD operations
- Query builders
- Data mapping (Database ↔ Domain)
- Handle Supabase-specific logic
- **KHÔNG** chứa business rules

**Rules**:
- ✅ Encapsulate Supabase queries
- ✅ Map database types → domain types
- ✅ Handle errors (convert SupabaseError → domain errors)
- ❌ KHÔNG tính toán SRS intervals
- ❌ KHÔNG validate business rules (delegate to domain services)

**Example**:
```typescript
// repositories/vocabularyRepository.ts
import { supabase } from '@/lib/supabase';
import type { Vocabulary, LearningStatus } from '@/lib/types';

export class VocabularyRepository {
  /**
   * Get vocabularies by topic with optional status filter
   */
  async getByTopic(
    topicId: string,
    status?: LearningStatus
  ): Promise<Vocabulary[]> {
    let query = supabase
      .from('vocabularies')
      .select(`
        *,
        user_vocab_progress (
          status,
          review_count,
          next_review_at,
          interval_hours,
          again_count
        )
      `)
      .eq('topic_id', topicId)
      .is('deleted_at', null);
    
    if (status) {
      query = query.eq('user_vocab_progress.status', status);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new RepositoryError(`Failed to fetch vocabularies: ${error.message}`, error);
    }
    
    // Map database rows → domain objects
    return data.map(this.mapToDomain);
  }
  
  /**
   * Get due vocabularies (next_review_at <= now)
   */
  async getDueVocabularies(limit: number = 20): Promise<Vocabulary[]> {
    const { data, error } = await supabase
      .from('vocabularies')
      .select(`
        *,
        user_vocab_progress!inner (*)
      `)
      .lte('user_vocab_progress.next_review_at', new Date().toISOString())
      .eq('user_vocab_progress.status', 'learning')
      .is('deleted_at', null)
      .order('user_vocab_progress.next_review_at', { ascending: true })
      .limit(limit);
    
    if (error) {
      throw new RepositoryError(`Failed to fetch due vocabularies: ${error.message}`, error);
    }
    
    return data.map(this.mapToDomain);
  }
  
  /**
   * Update progress (called by SRS service)
   */
  async updateProgress(
    vocabularyId: string,
    progress: Partial<UserVocabProgress>
  ): Promise<void> {
    const { error } = await supabase
      .from('user_vocab_progress')
      .upsert({
        vocabulary_id: vocabularyId,
        user_id: (await supabase.auth.getUser()).data.user!.id,
        ...progress,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,vocabulary_id',
      });
    
    if (error) {
      throw new RepositoryError(`Failed to update progress: ${error.message}`, error);
    }
  }
  
  /**
   * Map database row to domain object
   */
  private mapToDomain(row: any): Vocabulary {
    const progress = row.user_vocab_progress?.[0];
    
    return {
      id: row.id,
      topicId: row.topic_id,
      word: row.word,
      phoneticUk: row.phonetic_uk,
      phoneticUs: row.phonetic_us,
      partOfSpeech: row.part_of_speech,
      meaning: row.meaning,
      example: row.example,
      exampleTranslation: row.example_translation,
      synonyms: row.synonyms,
      collocations: row.collocations,
      audioUrl: row.audio_url,
      note: row.note,
      createdAt: row.created_at,
      // Progress fields (joined)
      status: progress?.status ?? 'new',
      reviewCount: progress?.review_count ?? 0,
      lastReviewedAt: progress?.last_reviewed_at,
      nextReviewAt: progress?.next_review_at,
      intervalHours: progress?.interval_hours ?? 0,
      againCount: progress?.again_count ?? 0,
    };
  }
}

// Export singleton instance
export const vocabularyRepo = new VocabularyRepository();
```

**File Structure**:
```
repositories/
  ├── vocabularyRepository.ts
  ├── collectionRepository.ts
  ├── topicRepository.ts
  ├── progressRepository.ts
  ├── reviewLogRepository.ts
  ├── sessionRepository.ts
  └── types.ts               // Repository error types
```

---

### 2.5. Supabase Layer

**Responsibility**:
- PostgreSQL database
- Row Level Security (RLS)
- Authentication (auth.users)
- Realtime subscriptions (optional)
- Storage (nếu có audio files)

**Not Application Code**:
- Migrations (SQL scripts)
- RLS policies (SQL)
- Database functions (SQL/plpgsql)
- Triggers

**Application Access**:
```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Server-side client (for API routes, server components)
export const supabaseServer = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Never expose in browser
  {
    auth: {
      persistSession: false,
    },
  }
);
```

---

## 3. Data Flow Examples

### 3.1. Rate Vocabulary Flow

```
User clicks "Good" button
  ↓
<Flashcard /> component
  ↓ onRate('good')
useFlashcardSession() hook
  ↓ rateCard('good')
SRS Service (calculateNextReview)
  ↓ Returns updated progress
Repository (updateProgress + insertReviewLog)
  ↓ Supabase RPC call
Database (atomic transaction)
  ↓ Success
Repository returns
  ↓
Hook updates state
  ↓
Component re-renders (next card)
```

**Code**:
```typescript
// 1. Component
<Flashcard onRate={(rating) => rateCard(rating)} />

// 2. Hook
const rateCard = async (rating: SrsRating) => {
  // 3. Domain Service
  const result = srsScheduler.calculateNextReview(
    currentCard.progress,
    rating,
    Date.now()
  );
  
  // 4. Repository
  await progressRepo.updateProgress(currentCard.id, result);
  await reviewLogRepo.insert({
    vocabularyId: currentCard.id,
    rating,
    previousInterval: currentCard.progress.intervalHours,
    newInterval: result.interval,
    // ...
  });
  
  // 5. Update UI
  setCurrentIndex(prev => prev + 1);
};
```

### 3.2. Load Dashboard Stats Flow

```
User opens Dashboard
  ↓
<Dashboard /> mounts
  ↓
useDashboardStats() hook
  ↓ useEffect fetch
Repository (getStats)
  ↓ Multiple Supabase queries (parallel)
Database returns aggregated data
  ↓
Repository maps to StatsViewModel
  ↓
Hook setState(stats)
  ↓
Component renders stats cards
```

---

## 4. State Management

### 4.1. Current Approach: useState + Context

**Current** (Phase 0-2): React hooks only
- `useState` for local state
- Props drilling for shared state
- No global state manager

**Acceptable for**:
- Small to medium apps
- State primarily component-local
- Limited cross-component sharing

### 4.2. Scaling Options (Future)

**If state becomes complex** (Phase 6+):

**Option A: React Context**
```typescript
// contexts/AuthContext.tsx
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState<User | null>(null);
  
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });
    
    return () => data.subscription.unsubscribe();
  }, []);
  
  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be within AuthProvider');
  return context;
}
```

**Option B: Zustand** (lightweight)
```typescript
// stores/authStore.ts
import { create } from 'zustand';

interface AuthStore {
  user: User | null;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));

// Usage
const user = useAuthStore((state) => state.user);
```

**Option C: Redux Toolkit** (heavyweight, overkill cho VocabTOEIC)

**Recommendation**: 
- Phase 0-5: React hooks + props
- Phase 6+: Add Context for auth + user settings
- Zustand nếu state càng phức tạp

**Avoid**: Redux (too heavy), MobX (overkill)

---

## 5. Error Handling

### 5.1. Error Types

```typescript
// lib/errors.ts
export class DomainError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export class RepositoryError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends RepositoryError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`);
    this.name = 'NotFoundError';
  }
}
```

### 5.2. Error Boundaries

```typescript
// components/ErrorBoundary.tsx
export class ErrorBoundary extends React.Component<Props, State> {
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // Send to Sentry, etc.
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h2>Đã xảy ra lỗi</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => window.location.reload()}>Tải lại</button>
        </div>
      );
    }
    
    return this.props.children;
  }
}
```

### 5.3. Hook Error Handling

```typescript
// hooks/useAsyncError.ts
export function useAsyncError() {
  const [, setError] = useState();
  
  return useCallback((error: Error) => {
    setError(() => {
      throw error; // Trigger error boundary
    });
  }, []);
}

// Usage
const throwError = useAsyncError();

try {
  await dangerousOperation();
} catch (err) {
  throwError(err as Error);
}
```

---

## 6. Testing Strategy

### 6.1. Unit Tests (Domain Services)

**Target**: Pure functions, business logic

**Framework**: Vitest

**Example**:
```typescript
// lib/srs/scheduler.test.ts
import { describe, test, expect } from 'vitest';
import { calculateNextReview } from './scheduler';

describe('SRS Scheduler', () => {
  test('Again rating resets interval to 1 minute', () => {
    const now = new Date('2026-07-30T10:00:00Z').getTime();
    const progress = {
      status: 'learning' as const,
      intervalHours: 24,
      againCount: 1,
    };
    
    const result = calculateNextReview(progress, 'again', now);
    
    expect(result.intervalHours).toBe(1 / 60); // 1 min
    expect(result.againCount).toBe(2);
    expect(result.status).toBe('learning');
    expect(result.nextReviewMs).toBe(now + 60 * 1000);
  });
});
```

### 6.2. Integration Tests (Repositories)

**Target**: Database interactions

**Setup**: Supabase test instance

**Example**:
```typescript
// repositories/vocabularyRepository.test.ts
import { describe, test, expect, beforeEach } from 'vitest';
import { vocabularyRepo } from './vocabularyRepository';
import { setupTestDb, teardownTestDb } from '../test/setup';

describe('VocabularyRepository', () => {
  beforeEach(async () => {
    await setupTestDb();
  });
  
  test('getByTopic returns vocabularies with progress', async () => {
    const vocabs = await vocabularyRepo.getByTopic('topic-test');
    
    expect(vocabs).toHaveLength(10);
    expect(vocabs[0]).toHaveProperty('status');
    expect(vocabs[0]).toHaveProperty('reviewCount');
  });
  
  afterEach(async () => {
    await teardownTestDb();
  });
});
```

### 6.3. Component Tests (UI)

**Target**: React components

**Framework**: React Testing Library

**Example**:
```typescript
// components/Flashcard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Flashcard } from './Flashcard';

test('calls onRate when rating button clicked', () => {
  const onRate = vi.fn();
  
  render(<Flashcard word="test" meaning="nghĩa" onRate={onRate} />);
  
  fireEvent.click(screen.getByText('Good'));
  
  expect(onRate).toHaveBeenCalledWith('good');
});
```

### 6.4. E2E Tests (Full Flows)

**Target**: Complete user journeys

**Framework**: Playwright

**Example**:
```typescript
// e2e/flashcard-session.spec.ts
import { test, expect } from '@playwright/test';

test('complete flashcard session', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name=email]', 'test@example.com');
  await page.fill('[name=password]', 'password');
  await page.click('button[type=submit]');
  
  await page.goto('/flashcards');
  
  // Rate 5 cards
  for (let i = 0; i < 5; i++) {
    await page.click('button:has-text("Good")');
  }
  
  // Should show completion
  await expect(page.locator('text=Hoàn thành')).toBeVisible();
});
```

---

## 7. Performance Optimization

### 7.1. Component Optimization

**React.memo**:
```typescript
// Prevent unnecessary re-renders
export const VocabularyCard = React.memo(({ vocab }: Props) => {
  return <div>{vocab.word}</div>;
});
```

**useMemo**:
```typescript
// Expensive calculations
const filteredVocabs = useMemo(() => {
  return vocabularies.filter(v => v.status === selectedStatus);
}, [vocabularies, selectedStatus]);
```

**useCallback**:
```typescript
// Stable function references
const handleRate = useCallback((rating: SrsRating) => {
  rateCard(rating);
}, [rateCard]);
```

### 7.2. Data Loading

**Parallel Requests**:
```typescript
// Load multiple resources in parallel
const [collections, topics, stats] = await Promise.all([
  collectionRepo.getAll(),
  topicRepo.getAll(),
  statsRepo.getStats(),
]);
```

**Pagination**:
```typescript
// Don't load all 1000 vocabularies at once
const vocabs = await vocabularyRepo.getByTopic(topicId, {
  limit: 20,
  offset: page * 20,
});
```

**Caching**:
```typescript
// Cache static data (collections, topics)
const cachedCollections = useMemo(() => {
  return collections; // Won't refetch unless invalidated
}, [collections]);
```

### 7.3. Bundle Optimization

**Code Splitting**:
```typescript
// Lazy load heavy components
const QuizMode = lazy(() => import('./components/QuizMode'));

<Suspense fallback={<LoadingSpinner />}>
  <QuizMode />
</Suspense>
```

**Tree Shaking**:
```typescript
// Import only what you need
import { shuffle } from 'lodash-es/shuffle'; // ✅
import _ from 'lodash'; // ❌ Imports entire library
```

---

## 8. Migration Path

### 8.1. Phase 0-2: Keep Current Architecture
- Single `vocabService.ts` với mixed concerns
- Direct Supabase calls từ service
- No separation yet

### 8.2. Phase 3-4: Extract Domain Services
```
services/vocabService.ts (current)
  ↓ Extract pure logic
lib/srs/scheduler.ts (pure functions)
lib/validation/vocabulary.ts (validation rules)
```

### 8.3. Phase 5-6: Introduce Repositories
```
services/vocabService.ts
  ↓ Split
repositories/vocabularyRepository.ts (CRUD)
lib/srs/srsService.ts (orchestrate repo + scheduler)
```

### 8.4. Phase 7+: Full Layered Architecture
```
components/  (UI)
  ↓
hooks/  (Controllers)
  ↓
lib/srs/  (Domain Services)
  ↓
repositories/  (Data Access)
  ↓
Supabase
```

---

## 9. Non-Negotiables

### 9.1. Simplicity First
**Don't over-engineer when not needed.**

- ❌ Không dùng Redux khi useState đủ
- ❌ Không tạo abstraction layers khi chỉ có 1 implementation
- ❌ Không viết generic code cho cases không tồn tại
- ✅ Start simple, refactor when pain points emerge

### 9.2. Testability
**All business logic MUST be testable.**

- Pure functions for SRS
- Repository interfaces for mocking
- Dependency injection cho tests

### 9.3. Type Safety
**Use TypeScript strictly.**

- `strict: true` in tsconfig.json
- No `any` types (dùng `unknown` nếu cần)
- Define domain types clearly

---

## Document Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-30 | Phase 0 | Initial target architecture |
| 2.0 | 2026-07-30 | Phase 0 Correction | Replaced Modified SM-2 algorithm examples with current-algorithm-neutral examples (Again=5min, Hard=6h/×2, Good=24h/×3, Easy=72h/×4), removed ease_factor/lapseCount fields, updated to againCount field, updated test examples with fixed timestamps, clarified repository interfaces not required for MVP (introduce abstractions incrementally) |
| 2.1 | 2026-07-31 | Parameter Update | Updated Again interval from 5 minutes to 1 minute in all examples (Again=1min, Hard/Good/Easy unchanged). Product parameter change only, not algorithm redesign. |

**Approval**: This document defines target architecture. Incremental migration plan requires approval before execution.
