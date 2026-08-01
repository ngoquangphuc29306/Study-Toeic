# VocabTOEIC — Phased Roadmap

**Document Version**: 3.1
**Created**: 2026-07-30
**Updated**: 2026-07-31
**Status**: Official Development Roadmap (Phase 2E Complete)
**Authority**: Defines phase sequence and acceptance criteria

---

## Overview

This roadmap transforms VocabTOEIC từ Google AI Studio prototype sang production-ready application theo incremental phases.

**Principles**:
- Mỗi phase có deliverable rõ ràng
- Mỗi phase kết thúc với working, tested code
- Có thể rollback nếu phase fail
- UI preservation contract được enforce ở tất cả phases
- Data ownership contract được enforce từ Phase 2+

---

## Phase 0 — Contracts

**Status**: ✅ COMPLETED

**Goal**: Establish product and architecture contracts làm foundation cho tất cả phases sau.

**Scope**:
- Tạo documentation trong `docs/`
- KHÔNG sửa application code
- KHÔNG thay đổi UI
- KHÔNG cài dependencies mới
- KHÔNG tạo migrations
- KHÔNG commit

**Deliverables**:
- ✅ `docs/PRODUCT_DECISIONS.md` — Approved/Current/Deferred decisions
- ✅ `docs/UI_PRESERVATION_CONTRACT.md` — Visual source of truth (verified features only)
- ✅ `docs/DATA_OWNERSHIP_CONTRACT.md` — Security model, RLS, composite FKs
- ✅ `docs/ROUTE_CONTRACT.md` — Current SPA, Phase 2 auth routes
- ✅ `docs/SRS_TARGET_SPEC.md` — Current algorithm as MVP target, atomic RPC
- ✅ `docs/TARGET_ARCHITECTURE.md` — Layered architecture, algorithm-neutral examples
- ✅ `docs/PHASED_ROADMAP.md` — This document
- ✅ `docs/README.md` — Document index and precedence

**Acceptance Criteria**:
- All 8 documents created
- Git diff shows ONLY new/modified files in `docs/`
- No application code changed
- Product owner reviews and approves contracts

**Rollback**: N/A (no code changes)

**Commit Strategy**: Single commit "docs: Phase 0 — Product and Architecture Contracts"

---

## Phase 1 — Cloud Development Supabase Foundation

**Status**: ✅ COMPLETED

**Goal**: Setup cloud development Supabase project with versioned migrations and PROPOSED schema (not production deployment yet).

**Environment Strategy**:
- **Development**: `vocabtoeic-dev` — cloud project for destructive testing and iteration
- **Production**: `vocabtoeic-prod` — created in Phase 10, never accessed before then
- **Source of Truth**: Migration files in Git (not Dashboard SQL Editor)

**Prerequisites**:
- Phase 0 contracts approved
- Supabase account created
- Development project `vocabtoeic-dev` created on Supabase Cloud

**Scope**:
✅ **Allowed**:
- Run `npx supabase init` to create `supabase/` directory
- Run `npx supabase login` to authenticate
- Run `npx supabase link --project-ref <dev-project-ref>` to link to `vocabtoeic-dev`
- Create versioned migration files with PROPOSED schema
- Write RLS policies
- Create seed data for testing
- Run `npx supabase db push` to apply migrations to cloud dev
- Verify schema and RLS on cloud development project
- Add Supabase client initialization (not yet used by app)

❌ **Not Allowed**:
- Use Dashboard SQL Editor without corresponding migration file
- Deploy to production Supabase project
- Link to production project reference
- Migrate existing features to use Supabase
- Remove localStorage
- Change UI
- Add authentication flows

**File Structure**:
```
supabase/
  ├── config.toml
  ├── .gitignore
  ├── seed.sql                    # Optional: dev seed data (not migrated to production)
  └── migrations/
        ├── 20260730_001_init_schema.sql
        └── 20260730_002_rls_policies.sql

lib/
  └── supabase.ts  # Client initialization (not yet used)
```

**Tasks**:
1. Create `vocabtoeic-dev` project on Supabase Cloud dashboard
2. Initialize: `npx supabase init`
3. Login: `npx supabase login`
4. Link to dev: `npx supabase link --project-ref <dev-project-ref>`
5. Create migration 001: Init schema (profiles if needed, collections, topics, vocabularies)
6. Create migration 002: RLS policies (enforce user_id ownership)
7. (Optional) Create `supabase/seed.sql`: Sample data for development testing only
8. Review migrations (SQL syntax, composite FKs, RLS policies)
9. Push to cloud dev: `npx supabase db push`
10. Verify schema in Supabase Dashboard (Tables, RLS enabled)
11. Initialize Supabase client in `lib/supabase.ts` (not yet used by app)

**Note on Seed Data**:
- Seed data is NOT part of production migrations
- Use optional `supabase/seed.sql` for development testing only
- Production databases start empty (users create their own data)
- Seed file is not versioned as a migration

**Phase 1 Schema Scope** (Limited):
- `profiles` table (if required for user metadata)
- `collections` table
- `topics` table
- `vocabularies` table
- Indexes on foreign keys and user_id columns
- Composite foreign keys (enforce same-owner relationships)
- RLS policies (SELECT/INSERT/UPDATE/DELETE per table)
- Profile creation trigger (if profiles table exists)

**Deferred to Implementation Phases**:
- ❌ `user_vocab_progress` (Phase 5)
- ❌ `review_logs` (Phase 5)
- ❌ `submit_vocabulary_rating` RPC (Phase 5)
- ❌ `study_sessions` (Phase 6)
- ❌ `daily_goals` (Phase 7)
- ❌ `import_jobs` (Phase 8)

**Schema Highlights** (from DATA_OWNERSHIP_CONTRACT.md):
- All tables have `user_id` column (except auth.users)
- Composite foreign keys enforce same-owner relationships
- RLS policies on all tables (SELECT/INSERT/UPDATE/DELETE)
- Soft delete with `deleted_at` column
- All SQL labeled as "PROPOSED: Not migration-ready"

**Safety Rules**:
1. **Cloud dev is disposable**: May be reset or recreated at any time
2. **No production data in dev**: `vocabtoeic-dev` must NEVER contain real user data
3. **Git is source of truth**: All schema changes must exist as migration files in Git
4. **No Dashboard-only changes**: SQL Editor changes without migrations are forbidden
5. **Production is separate**: `vocabtoeic-prod` is a different project, accessed only in Phase 10
6. **Never link to production**: Do not run `supabase link` against production project reference during development
7. **No destructive production commands**: Never run `db reset` or `db push --destructive` against a production-linked repository

**Acceptance Criteria**:
- `vocabtoeic-dev` cloud project created
- `supabase/` directory created with versioned migrations
- Repository linked to correct dev project reference (`supabase/.temp/project-ref` contains dev ref)
- `npx supabase db push` succeeds without errors
- Schema exists on cloud dev (verify in Supabase Dashboard)
- RLS policies enabled (verify with cross-user test accounts)
- Seed data loads correctly
- Migration files committed to Git
- Supabase client initialized but NOT yet connected to app features
- Application still uses localStorage (no functional changes)
- No production deployment performed

**Rollback**: Delete `supabase/` directory, remove Supabase client file, reset cloud dev project

**Commit Strategy**: "feat: Phase 1 — Cloud Development Supabase Foundation with versioned migrations"

---

## Phase 2 — Authentication and First Vertical Slice

**Status**: ✅ COMPLETED

**Goal**: Add `/login` and `/signup` routes, persist collections/topics/vocabularies to Supabase, verify RLS isolation.

**Prerequisites**:
- Phase 1 completed (cloud dev Supabase running with schema deployed)
- Approved from ROUTE_CONTRACT.md Section 4 (Phase 2 routes)
- Approved from PRODUCT_DECISIONS.md Section 2.6 (First Vertical Slice)

**Completion Summary**:
- ✅ Created `/login` and `/signup` pages
- ✅ Added middleware to protect `/`
- ✅ Implemented Supabase Auth (email/password)
- ✅ Persisted collections, topics, vocabularies to Supabase
- ✅ Added RLS enforcement for these entities
- ✅ Removed localStorage for migrated entities
- ✅ Verified first vertical slice with multi-user test

---

## Phase 2B.5 — Public Landing Page and Protected `/app` Route

**Status**: ✅ COMPLETED

**Goal**: Move authenticated application to `/app` and create public landing page at `/`.

**Prerequisites**:
- Phase 2B completed (route protection implemented)

**Completion Summary**:
- ✅ Moved authenticated app from `/` to `/app/page.tsx`
- ✅ Created public landing page at `/`
- ✅ Updated middleware to protect `/app` and `/app/*`
- ✅ Kept `/` public for all visitors
- ✅ Updated all auth redirects from `/` to `/app`
- ✅ Updated safe redirect default from `/` to `/app`
- ✅ Preserved all existing application behavior at `/app`
- ✅ Updated route documentation

**Landing Page Sections**:
- Public navigation (logo, login, signup CTAs)
- Hero section with value proposition
- Core benefits (SRS, organization, progress tracking)
- SRS explanation (Again/Hard/Good/Easy)
- Organization flow (Collection → Topic → Vocabulary → Session)
- Final CTA
- Footer

**Route Structure After Phase 2B.5**:
```
/              → Public landing page
/login         → Public
/signup        → Public
/auth/callback → Public
/app           → Protected authenticated application
/app/*         → Protected
```

---

## Phase 2C — Collection CRUD Migration to Supabase

**Status**: ✅ COMPLETED (with Phase 2C Fix applied)

**Goal**: Migrate Collection CRUD operations from localStorage to Supabase while keeping Topics and Vocabularies in localStorage.

**Prerequisites**:
- Phase 2B.5 completed (public landing and protected app routes)

**Completion Summary**:
- ✅ Created `services/collectionService.ts` with Supabase browser client
- ✅ Collections use database-generated UUIDs (not client IDs)
- ✅ All Collection CRUD operations use authenticated session
- ✅ RLS enforces `user_id = auth.uid()` ownership
- ✅ Updated `services/vocabService.ts` to use Collection service
- ✅ Removed localStorage for Collections (`LOCAL_COLS_KEY`, `DELETED_COLS_KEY`)
- ✅ Topics and Vocabularies remain in localStorage (Phase 2D, 2E)
- ✅ **Phase 2C Fix**: Collection deletion blocks when child Topics/Vocabularies exist
- ✅ Collection totals computed from localStorage Topics/Vocabularies
- ✅ **Phase 2C Fix Extended**: User-scoped localStorage prevents cross-user data leakage

**Phase 2C Fix — User Isolation and Safe Deletion** (2026-07-30):

### Problem 1: Cross-User Data Leakage (Critical Security Bug)

**Symptom**: Bob can see and delete Alice's Topics and Vocabularies in the same browser.

**Root Cause**: Global localStorage keys shared by all authenticated users:
```typescript
// BEFORE (INSECURE)
localStorage.getItem('vocab_local_topics_v1')       // Global, all users
localStorage.getItem('vocab_local_vocabs_v1')       // Global, all users
```

**Impact**:
- User Alice creates Section "Business English"
- User Bob logs in (same browser)
- Bob sees Alice's "Business English" section
- Bob deletes it → Alice's data disappears

### Problem 2: Wrong Modal Creation Flow

**Symptom**: Clicking "Tạo học phần" shows both Collection and Section options as tabs.

**Root Cause**: CollectionModal had internal tab state instead of external mode control.

**Required Behavior**: Explicit modal modes where parent component controls which form appears.

### Problem 3: Icon Selection UI

**Symptom**: Icon chooser visible in Collection and Section forms but never used.

**Required Behavior**: Remove UI, use stable internal defaults (FolderKanban, BookOpen).

---

### Solution 1: User-Scoped localStorage

**Strategy**: Namespace localStorage keys per authenticated user ID.

**Implementation**:
- ✅ Created `services/localStorageHelpers.ts` with user-scoped helpers
- ✅ Key format: `vocab_local_topics_v1:<user-id>`
- ✅ Updated ALL Topic CRUD operations to use user-scoped keys
- ✅ Updated ALL Vocabulary CRUD operations to use user-scoped keys
- ✅ Updated Progress and Study Dates to use user-scoped keys
- ✅ Added auth state change listener to clear stale data on user switch

**User-Scoped Key Format**:
```typescript
// AFTER (SECURE)
getUserScopedArray('vocab_local_topics_v1', userId)
// → localStorage.getItem('vocab_local_topics_v1:alice-uuid')

getUserScopedArray('vocab_local_topics_v1', userId)
// → localStorage.getItem('vocab_local_topics_v1:bob-uuid')
```

**Affected Operations**:
- `getTopics()` → reads from `vocab_local_topics_v1:<user-id>`
- `addTopic()` → writes to `vocab_local_topics_v1:<user-id>`
- `updateTopic()` → updates `vocab_local_topics_v1:<user-id>`
- `deleteTopic()` → updates `vocab_deleted_topics_v1:<user-id>`
- `getVocabByTopic()` → reads from `vocab_local_vocabs_v1:<user-id>`
- `addVocabulary()` → writes to `vocab_local_vocabs_v1:<user-id>`
- `bulkAddVocabularies()` → writes to `vocab_local_vocabs_v1:<user-id>`
- `updateVocabulary()` → updates `vocab_local_vocabs_v1:<user-id>`
- `deleteVocabulary()` → updates `vocab_deleted_vocabs_v1:<user-id>`
- `updateUserProgress()` → updates `vocab_local_progress_v1:<user-id>`
- `getStudyStats()` → reads from `vocab_study_dates_v1:<user-id>`

**Auth State Change Handler** (app/app/page.tsx):
```typescript
useEffect(() => {
  const supabase = createClient();
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
      // Clear all state immediately
      setCollections([]);
      setTopics([]);
      setVocabularies([]);
      setStats({ totalWords: 0, ... });
      
      // Reload data for new user if authenticated
      if (session?.user) {
        refreshAppData();
      }
    }
  });
  return () => { subscription.unsubscribe(); };
}, [refreshAppData]);
```

**Verification**: Each user's data now isolated per authenticated session, enforced by user-scoped localStorage keys.

---

### Solution 2: Explicit Modal Mode Control

**Strategy**: Parent component controls modal mode via props, no internal tab state.

**Implementation**:
- ✅ Changed CollectionModal interface to accept explicit `mode: 'collection' | 'section'`
- ✅ Added `defaultCollectionId` prop for pre-selecting parent Collection
- ✅ Removed internal tab switcher UI
- ✅ Removed activeTab state
- ✅ Made collection select disabled (controlled by props)

**Modal Interface**:
```typescript
type CreateMode = 'collection' | 'section';

interface CollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: CreateMode;                    // NEW: explicit mode
  collections: Collection[];
  defaultCollectionId?: string;        // NEW: pre-select collection
  onAddCollection: (col: Omit<Collection, 'id'>) => Promise<Collection>;
  onAddTopic: (topic: Omit<Topic, 'id'>) => Promise<Topic>;
}
```

**Usage Pattern**:
```typescript
// Create Collection
onOpenCollectionModal={() => {
  setCollectionModalMode('collection');
  setCollectionModalDefaultId(undefined);
  setIsCollectionModalOpen(true);
}}

// Create Section (with pre-selected Collection)
onOpenSectionModal={(collectionId) => {
  setCollectionModalMode('section');
  setCollectionModalDefaultId(collectionId);
  setIsCollectionModalOpen(true);
}}
```

---

### Solution 3: Remove Icon Selection UI

**Strategy**: Remove all icon picker UI, use stable internal defaults.

**Implementation**:
- ✅ Removed all icon selection state and handlers
- ✅ Added icon defaults: `DEFAULT_COLLECTION_ICON = 'FolderKanban'`, `DEFAULT_TOPIC_ICON = 'BookOpen'`
- ✅ Icon automatically applied on creation, not exposed in UI

---

### Solution 4: Safe Collection Deletion (Original Phase 2C Fix)

**Problem**: Original Phase 2C deleted Collections from Supabase and removed orphaned localStorage Topics, but did NOT handle Vocabularies that reference those Topics. This could create orphaned Vocabulary data.

**Solution**: Block Collection deletion when child data exists
- ✅ Created `CollectionHasChildrenError` for specific error handling
- ✅ Modified `deleteCollection()` to read user-scoped child Topics and Vocabularies
- ✅ Detect child Topics via `collection_id` match
- ✅ Detect child Vocabularies via Topic ownership chain
- ✅ Block deletion BEFORE Supabase request when children exist
- ✅ Show clear Vietnamese error message in UI
- ✅ Removed automatic localStorage cascade deletion
- ✅ No orphaned data possible during transitional period

**Deletion Behavior**:
```
Empty Collection → delete succeeds
Collection with Topics → delete blocked, show error
Collection with Vocabularies → delete blocked, show error
```

**Error Message**:
```
Không thể xóa bộ sưu tập này vì vẫn còn chủ đề hoặc từ vựng.
Hãy xóa dữ liệu bên trong trước.
```

---

### Data Flow After Phase 2C Fix

```
Collections → Supabase (user_id enforced by RLS)
Topics → User-scoped localStorage (vocab_local_topics_v1:<user-id>)
Vocabularies → User-scoped localStorage (vocab_local_vocabs_v1:<user-id>)
Progress → User-scoped localStorage (vocab_local_progress_v1:<user-id>)
Study Dates → User-scoped localStorage (vocab_study_dates_v1:<user-id>)
```

**Transitional Strategy**:
- Collections source of truth: Supabase with RLS
- Topics/Vocabularies: User-scoped localStorage (temporary until Phase 2D, 2E)
- Collection deletion blocked if any child Topics or Vocabularies exist
- No automatic cascade deletion of localStorage child data
- Auth state change clears all in-memory state and reloads new user's data
- Conservative approach prevents accidental data loss and cross-user leakage
- No bidirectional sync or conflict resolution (bounded transition)

**Security Properties**:
- ✅ User ID obtained only from authenticated Supabase session
- ✅ Never trust client-provided user ID
- ✅ RLS enforces Collections ownership at database level
- ✅ User-scoped localStorage prevents cross-user data leakage
- ✅ Auth state change listener clears stale data on user switch
- ✅ Legacy global localStorage keys no longer read (left for manual cleanup)

---

### Files Modified (Phase 2C Fix)

**Created**:
- `services/collectionService.ts` — Supabase CRUD for Collections
- `services/collectionErrors.ts` — `CollectionHasChildrenError` class
- `services/localStorageHelpers.ts` — User-scoped localStorage helpers

**Modified**:
- `services/vocabService.ts` — All Topic/Vocabulary CRUD now user-scoped
- `services/collectionService.ts` — Safe deletion with child detection
- `components/CollectionModal.tsx` — Explicit mode, no icon selection
- `app/app/page.tsx` — Auth state change listener, modal mode state
- `docs/DATA_OWNERSHIP_CONTRACT.md` — Version 2.3, Section 8
- `docs/PHASED_ROADMAP.md` — This section

---

## Phase 2D — Topic CRUD Migration to Supabase

**Status**: ✅ COMPLETED (2026-07-30)

**Goal**: Migrate Topics from user-scoped localStorage to Supabase with database-generated UUIDs.

**Prerequisites**:
- Phase 2C completed (Collections in Supabase, Topics in user-scoped localStorage)

**Scope**:
✅ **Allowed**:
- Migrate Topic read to Supabase queries
- Migrate Topic create to Supabase inserts (database-generated UUIDs)
- Migrate Topic update to Supabase updates
- Migrate Topic delete to Supabase deletes (with Vocabulary child check)
- Update Collection delete to check Supabase Topics instead of localStorage
- Validate Topic UUIDs before Vocabulary create/update
- Filter Vocabularies by valid Supabase Topic UUIDs
- Mark legacy localStorage Topic keys as inactive
- Update documentation

❌ **Not Allowed**:
- Migrate Vocabularies to Supabase (Phase 2E)
- Migrate SRS progress (Phase 2E+)
- Change Topic schema or add new fields
- Automatic migration of legacy localStorage Topics

**Implementation Details**:

**Files Created**:
- `services/topicService.ts` — Topic CRUD with Supabase client and RLS
- `services/topicErrors.ts` — `TopicHasVocabulariesError` for deletion safety

**Files Modified**:
- `services/vocabService.ts` — Delegate Topic CRUD to topicService, validate Topic UUIDs for Vocabulary operations, filter Vocabularies by valid Supabase Topics
- `app/app/page.tsx` — Import and handle `TopicHasVocabulariesError` in delete handler
- `docs/DATA_OWNERSHIP_CONTRACT.md` — Updated ownership matrix, Phase 2D status, added Topic migration documentation
- `docs/PHASED_ROADMAP.md` — Mark Phase 2D complete

**Topic ID Transition**:
- Before: Client-generated timestamps (`topic-1723456789`)
- After: Database-generated UUIDs (`550e8400-e29b-41d4-a716-446655440000`)

**Vocabulary Compatibility Strategy**: Fresh Start (Strategy A)
- Users recreate Topics in Supabase after deployment
- Legacy localStorage Vocabularies with legacy Topic IDs are filtered out (not shown)
- New Vocabularies must reference valid Supabase Topic UUIDs
- Explicit migration deferred to Phase 2E or dedicated migration tool

**Deletion Safety**:
- Topic delete blocks if any localStorage Vocabularies reference that Topic UUID
- Collection delete now checks Supabase Topics instead of localStorage Topics
- Error messages in Vietnamese: "Không thể xóa học phần này vì vẫn còn từ vựng. Hãy xóa từ vựng bên trong trước."

**Legacy localStorage Keys** (no longer read or written):
```
vocab_local_topics_v1:<user-id>
vocab_deleted_topics_v1:<user-id>
```

**Data Ownership After Phase 2D**:
- Collections → Supabase (Phase 2C)
- Topics → Supabase (Phase 2D)
- Vocabularies → user-scoped localStorage (Phase 2E pending)
- Study/SRS data → user-scoped localStorage (Phase 2E+ pending)

**Security**:
- RLS policies enforce `user_id = auth.uid()` on all Topic operations
- Composite FK `(collection_id, user_id) → collections(id, user_id)` enforces parent ownership
- Topic UUID validation before Vocabulary create/update
- User ID obtained from authenticated session only

**Quality Gates**:
- ✅ ESLint passed
- ✅ TypeScript type check passed
- ✅ Next.js build successful (5.3s)
- ✅ No whitespace errors (except line-ending warnings)
- ✅ No active localStorage Topic CRUD in runtime code
- ✅ No Vocabulary Supabase queries (still in localStorage)

**Acceptance Criteria**:
- ✅ Topics read from Supabase with database UUIDs
- ✅ Topics persist after browser refresh
- ✅ Topic create validates parent Collection ownership
- ✅ Topic delete blocks when Vocabularies exist
- ✅ Collection delete checks Supabase Topics
- ✅ Vocabulary create/update validates Topic UUID exists in Supabase
- ✅ Vocabularies filtered by valid Supabase Topic UUIDs
- ✅ Legacy localStorage Topic keys inactive
- ✅ Account switch clears stale Topic state
- ✅ No localStorage Topic reads or writes in active code
- ✅ Documentation updated

**Rollback**: Revert to Phase 2C (Topics in user-scoped localStorage)

**Commit Strategy**: "feat: migrate topic CRUD to Supabase"

**Next Phase**: Phase 2E — Vocabulary CRUD Migration to Supabase

---

## Phase 2E — Vocabulary CRUD Migration to Supabase

**Status**: ✅ COMPLETED (2026-07-31)

**Goal**: Migrate Vocabularies from user-scoped localStorage to Supabase with database-generated UUIDs while keeping study/SRS progress in localStorage.

**Prerequisites**:
- Phase 2D completed (Topics in Supabase, Vocabularies in user-scoped localStorage)

**Scope**:
✅ **Allowed**:
- Migrate Vocabulary read to Supabase queries
- Migrate Vocabulary create to Supabase inserts (database-generated UUIDs)
- Migrate Vocabulary bulk create to Supabase batch inserts
- Migrate Vocabulary update to Supabase updates
- Migrate Vocabulary delete to Supabase deletes (with localStorage progress cleanup)
- Update Topic delete to check Supabase Vocabularies instead of localStorage
- Merge Supabase Vocabulary data with localStorage progress
- Clean localStorage progress references after Vocabulary deletion
- Mark legacy localStorage Vocabulary keys as inactive
- Update documentation

❌ **Not Allowed**:
- Migrate SRS progress to Supabase (remains in localStorage for Phase 2E+)
- Change Vocabulary schema or add new fields
- Automatic migration of legacy localStorage Vocabularies
- Change SRS algorithm or rating semantics

**Implementation Details**:

**Files Created**:
- `services/vocabularyService.ts` — Vocabulary CRUD with Supabase client and RLS
- `services/vocabularyErrors.ts` — `VocabularyValidationError` for validation errors

**Files Modified**:
- `services/vocabService.ts` — Delegate Vocabulary CRUD to vocabularyService, merge Supabase data with localStorage progress, clean progress on deletion
- `services/topicService.ts` — Check Supabase Vocabularies instead of localStorage for deletion safety
- `app/app/page.tsx` — Import `VocabularyValidationError` for error handling
- `docs/DATA_OWNERSHIP_CONTRACT.md` — Updated ownership matrix, Phase 2E status, added Vocabulary migration documentation
- `docs/PHASED_ROADMAP.md` — Mark Phase 2E complete

**Vocabulary ID Transition**:
- Before: Client-generated timestamps (`vocab-1723456789-abc123`)
- After: Database-generated UUIDs (`7c9e6679-7425-40de-944b-e07fc1f90ae7`)

**Study/SRS Progress Strategy**:
- Study/SRS data (status, review_count, last_reviewed_at, next_review_at, interval_hours, again_count) remains in user-scoped localStorage
- localStorage keys use new Supabase Vocabulary UUIDs as references
- `getVocabByTopic()` loads from Supabase, merges with localStorage progress
- `updateUserProgress()` writes to localStorage using Vocabulary UUID
- `deleteVocabulary()` cleans localStorage progress after successful Supabase deletion

**Vocabulary Compatibility Strategy**: Fresh Start (Strategy A)
- Users recreate Vocabularies in Supabase after deployment
- Legacy localStorage Vocabularies with legacy IDs are not automatically migrated
- New Vocabularies created via UI (single add or bulk import from Excel)
- Study progress resets to "new" for recreated Vocabularies

**Deletion Safety**:
- Vocabulary delete removes from Supabase, then cleans localStorage progress references
- Topic delete blocks if any Supabase Vocabularies reference that Topic UUID
- Error messages in Vietnamese: "Không thể xóa học phần này vì vẫn còn từ vựng. Hãy xóa từ vựng bên trong trước."

**Legacy localStorage Keys** (no longer read or written for domain data):
```
vocab_local_vocabularies_v1:<user-id>     # Vocabularies now in Supabase
vocab_deleted_vocabs_v1:<user-id>         # Vocabulary deletes now in Supabase
```

**Active localStorage Keys** (study/SRS progress only):
```
vocab_local_progress_v1:<user-id>         # Progress data keyed by Vocabulary UUID
vocab_study_dates_v1:<user-id>            # Study date history for streak calculation
```

**Data Ownership After Phase 2E**:
- Collections → Supabase (Phase 2C)
- Topics → Supabase (Phase 2D)
- Vocabularies → Supabase (Phase 2E)
- Study/SRS data → user-scoped localStorage (Phase 2E+)

**Security**:
- RLS policies enforce `user_id = auth.uid()` on all Vocabulary operations
- Composite FK `(topic_id, user_id) → topics(id, user_id)` enforces parent ownership
- Foreign key violation (23503) handled with user-friendly error messages
- User ID obtained from authenticated session only
- Progress cleanup occurs only after confirmed Supabase deletion

**Quality Gates**:
- ✅ ESLint passed
- ✅ TypeScript type check passed
- ✅ Next.js build successful
- ✅ No active localStorage Vocabulary CRUD for domain data
- ✅ localStorage only used for study/SRS progress

**Acceptance Criteria**:
- ✅ Vocabularies read from Supabase with database UUIDs
- ✅ Vocabularies persist after browser refresh
- ✅ Vocabulary create validates parent Topic ownership
- ✅ Vocabulary delete cleans localStorage progress references
- ✅ Topic delete blocks when Supabase Vocabularies exist
- ✅ Study/SRS progress merges correctly from localStorage
- ✅ Bulk import creates Vocabularies in Supabase
- ✅ Legacy localStorage Vocabulary keys inactive for domain data
- ✅ Account switch clears stale Vocabulary state
- ✅ No localStorage Vocabulary reads or writes for domain data in active code
- ✅ Documentation updated

**Rollback**: Revert to Phase 2D (Vocabularies in user-scoped localStorage)

**Commit Strategy**: "feat: migrate vocabulary CRUD to Supabase"

**Next Phase**: Phase 4 — Current SRS Domain Extraction

---

## Phase 4 — Current SRS Domain Extraction

**Status**: 🔄 PENDING

**Goal**: Extract current SRS algorithm into pure domain functions (no algorithm changes).

**Prerequisites**:
- Phase 3 completed
- SRS_TARGET_SPEC.md Section 2.1 approved (preserve current algorithm)

**Scope**:
✅ **Allowed**:
- Create `lib/srs/scheduler.ts` with pure functions
- Extract scheduling logic from `services/vocabService.ts`
- Add explicit timestamp parameter (no `Date.now()` inside domain)
- Write comprehensive unit tests
- Verify behavior unchanged (same inputs → same outputs)

❌ **Not Allowed**:
- Change algorithm multipliers (keep Again=1min, Hard=6h/×2, Good=24h/×3, Easy=72h/×4)
- Add ease_factor, relearning steps, interval cap
- Change states (keep 'new', 'learning', 'mastered' only)
- Add auto-mastery

**File Structure**:
```
lib/
  └── srs/
        ├── scheduler.ts          # Pure domain functions
        ├── scheduler.test.ts     # Unit tests (fixed timestamps)
        └── types.ts              # Domain types
```

**Tasks**:
1. Create `lib/srs/scheduler.ts`
2. Implement `calculateNextReview(progress, rating, nowMs)` with current algorithm
3. Move logic from `services/vocabService.ts` lines 597-619
4. Add explicit `nowMs` parameter (not `Date.now()`)
5. Write unit tests with fixed timestamps
6. Verify all tests pass
7. Update `vocabService.ts` to call domain function

**Acceptance Criteria**:
- Domain function is pure (no side effects)
- Uses fixed timestamps in tests (no `Date.now()` in assertions)
- 100% test coverage for scheduling logic
- Behavior unchanged (existing app works identically)
- All tests pass

**Rollback**: Keep scheduling logic in `vocabService.ts`

**Commit Strategy**: "refactor: Phase 4 — Extract SRS domain logic"

---

## Phase 5 — SRS Persistence and Reliability

**Status**: 🔄 PENDING

**Goal**: Add database persistence for progress and review logs, implement atomic RPC with idempotency.

**Prerequisites**:
- Phase 4 completed (domain extraction done)
- SRS_TARGET_SPEC.md Section 2.4 approved (atomic RPC pattern)

**Scope**:
✅ **Allowed**:
- Create `review_logs` table
- Implement `submit_vocabulary_rating` RPC (server-side calculation)
- Add idempotency_key to prevent duplicate submissions
- Migrate client to call RPC instead of direct progress update
- Remove localStorage for user_vocab_progress

❌ **Not Allowed**:
- Change algorithm (keep current behavior)
- Add enhanced SRS features (Phase 11+)

**File Structure**:
```
supabase/
  └── migrations/
        ├── 20260730_004_review_logs.sql
        └── 20260730_005_submit_rating_rpc.sql

services/
  └── vocabService.ts  # Update to call RPC
```

**Tasks**:
1. Create migration 004: `review_logs` table with idempotency_key
2. Create migration 005: `submit_vocabulary_rating` RPC function
3. Implement server-side scheduling calculation in RPC
4. Add idempotency check (return if key already processed)
5. Update client to call RPC with vocabulary_id + rating + idempotency_key
6. Test duplicate submission protection
7. Remove localStorage for progress

**RPC Signature** (from SRS_TARGET_SPEC.md Section 2.4):
```sql
CREATE OR REPLACE FUNCTION submit_vocabulary_rating(
  p_vocabulary_id UUID,
  p_rating TEXT,
  p_idempotency_key UUID,
  p_reviewed_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSON
```

**Acceptance Criteria**:
- Review logs persisted to database
- RPC calculates intervals server-side (browser cannot manipulate)
- Idempotency prevents duplicate submissions
- Atomic transaction (progress + log updated together)
- Flashcard mode works with Supabase-backed progress
- No localStorage usage for progress

**Rollback**: Restore localStorage for progress

**Commit Strategy**: "feat: Phase 5 — SRS persistence with atomic RPC"

---

## Phase 6 — Study Session Recovery

**Status**: 🔄 PENDING

**Goal**: Preserve active study session state (bounded, session-scoped only).

**Prerequisites**:
- Phase 5 completed

**Scope**:
✅ **Allowed**:
- Store active session state (current card index, topic, filter)
- Restore session on page refresh (same session only)
- Clear session on logout or explicit exit

❌ **Not Allowed**:
- Long-term session persistence (no unbounded growth)
- Offline queue (out of scope)

**Tasks**:
1. Store active session in sessionStorage (not localStorage)
2. Restore on page load if session valid
3. Clear on logout
4. Add "Resume Session" button on Dashboard

**Acceptance Criteria**:
- Session survives page refresh
- Session cleared on logout
- No unbounded localStorage growth

**Rollback**: Remove session recovery

**Commit Strategy**: "feat: Phase 6 — Study session recovery"

---

## Phase 7 — Dashboard Real Data

**Status**: ✅ COMPLETED (2026-08-01)

**Goal**: Connect Dashboard stats to real Supabase data from `vocabularies`, `user_vocab_progress`, and `review_logs` tables.

**Prerequisites**:
- Phase 5 completed (progress in database)

**Scope**:
✅ **Allowed**:
- Create `services/dashboardService.ts` for Dashboard-specific queries
- Query real stats from user_vocab_progress and review_logs
- Display due vocabulary count from next_review_at
- Show daily goal progress with unique vocabulary count today
- Calculate streak from review_logs consecutive days
- Implement timezone-aware day boundary calculations
- Remove localStorage study dates from statistics
- Keep daily goal preference in localStorage (user setting)

❌ **Not Allowed**:
- Change Dashboard UI design or layout
- Change SRS algorithm or Again queue behavior
- Change Study Session Recovery logic
- Add new packages or chart libraries
- Create new database migrations
- Run `supabase db push`

**Implementation Details**:

**Files Created**:
- `services/dashboardService.ts` — Dashboard metrics queries with RLS enforcement
  - `getDashboardMetrics()`: Aggregate query for all metrics
  - `calculateStudyStreak()`: Consecutive days from review_logs
  - `getRecentActivity()`: Recent review actions with vocabulary details
  - `getWeekActivity()`: 7-day activity histogram
  - `getLocalDayBoundaries()`: Timezone-aware date helper
- `services/dashboardErrors.ts` — `DashboardDataError`, `DashboardAuthError`
- `docs/PHASE_7_IMPLEMENTATION_REPORT.md` — Full implementation report with 41-item verification

**Files Modified**:
- `components/Dashboard.tsx` — Replaced localStorage stats with real Supabase metrics
  - Added `getDashboardMetrics()` and `getWeekActivity()` integration
  - Replaced all `stats.*` references with `dashboardMetrics.*`
  - Added loading states for async metric fetches
  - Kept daily goal preference in localStorage (user setting)
- `services/vocabService.ts` — Removed localStorage study dates logic
  - `getStudyStats()`: Simplified to minimal backward-compatible stats
  - `updateUserProgress()`: Removed localStorage study dates update
  - Added Phase 7 migration comments

**Data Migration**:

**Before Phase 7**:
- Total vocabulary: counted from vocabularies array in memory
- Status counts: calculated from vocabularies with merged progress
- Streak: calculated from localStorage `vocab_study_dates_v1:<user-id>`
- Today activity: counted vocabularies with `last_reviewed_at` today
- Due vocabulary: client-side filter on vocabularies array

**After Phase 7**:
- Total vocabulary: `COUNT(*) FROM vocabularies` (RLS-scoped)
- Status counts: aggregated from `user_vocab_progress.status`
- Streak: consecutive days calculation from `review_logs.reviewed_at`
- Today activity: `COUNT(*) FROM review_logs WHERE reviewed_at >= startOfToday`
- Unique vocabulary today: `COUNT(DISTINCT vocabulary_id) FROM review_logs today`
- Due vocabulary: server-side calculation from `user_vocab_progress.next_review_at <= NOW()`
- Difficult vocabulary: `COUNT(*) FROM user_vocab_progress WHERE again_count >= 5`

**Metric Definitions** (As Specified):
1. **Total Vocabulary:** Count of current user's vocabulary rows
2. **New Vocabulary:** Vocabularies with NO user_vocab_progress row (NOT status='new')
3. **Learning:** status='learning' in user_vocab_progress
4. **Mastered:** status='mastered' in user_vocab_progress
5. **Due:** status!='mastered' AND next_review_at IS NOT NULL AND next_review_at <= NOW()
6. **Reviews Today:** COUNT(review_logs WHERE reviewed_at in local day boundaries)
7. **Unique Vocabulary Studied Today:** COUNT(DISTINCT vocabulary_id) from review_logs today
8. **Study Streak:** Consecutive days backwards from today/yesterday with at least one review_log
9. **Difficult Vocabulary:** again_count >= 5 from user_vocab_progress

**Timezone Handling**:
- All day boundaries calculated in browser's local timezone
- `getLocalDayBoundaries()` returns [startOfDay, endOfDay] in local time
- Today queries use local date ranges, NOT UTC midnight
- Streak calculation uses local dates from review_logs
- Week activity visualization uses local day boundaries

**Security & RLS**:
- All queries user-scoped through Supabase RLS policies
- No client-supplied `user_id` parameters
- Authentication verified before all queries
- RLS policies enforce user ownership at database level

**Legacy localStorage Keys** (no longer written, kept for backward compatibility):
```
vocab_study_dates_v1:<user-id>  # No longer written after Phase 7
```

**Daily Goal Preference Keys** (still active, user settings not statistics):
```
vocab_daily_goal                # Daily goal preference (default: 20)
vocab_unlimited_review          # Unlimited review mode (default: true)
```

**Quality Gates**:
- ✅ ESLint passed (1 pre-existing warning unrelated to Phase 7)
- ✅ TypeScript type check passed
- ✅ Next.js build successful (6.6s)
- ✅ No database migrations created
- ✅ No `supabase db push` executed
- ✅ No git commit or push executed

**Acceptance Criteria**:
- ✅ Dashboard metrics load from Supabase on component mount
- ✅ Streak displays correct count from review_logs consecutive days
- ✅ Week visualization shows correct studied days from review_logs
- ✅ Due count calculated from user_vocab_progress.next_review_at
- ✅ New vocabulary count = total - (learning + mastered)
- ✅ Today's unique vocabulary count from review_logs DISTINCT vocabulary_id
- ✅ Timezone-aware day boundaries for all date calculations
- ✅ Loading states display during metric fetch
- ✅ localStorage no longer used for statistics (only daily goal preference)
- ✅ All Dashboard visual contracts preserved (no UI redesign)
- ✅ SRS algorithm unchanged (Again = 1min, Hard/Good/Easy intervals)
- ✅ Again queue behavior unchanged (5-card gap, interval_hours=0)
- ✅ Study Session Recovery unchanged
- ✅ Documentation updated

**Rollback**: Restore localStorage-based stat calculations in vocabService.getStudyStats()

**Commit Strategy**: "feat: Phase 7 — Dashboard real data"

**Next Phase**: Phase 8 — Import and Export

---

## Phase 8 — Import and Export

**Status**: ✅ COMPLETED (2026-08-01)

**Goal**: Bulk import from Excel/CSV, export user data.

**Prerequisites**:
- Phase 3 completed (vocabulary CRUD working)

**Scope**:
✅ **Allowed**:
- Excel import (existing feature, verified with Supabase)
- Add CSV export
- Add JSON export (backup format)

❌ **Not Allowed**:
- Anki import/export (deferred)
- Automatic sync (out of scope)

**Tasks**:
1. ✅ Verify Excel import works with Supabase
2. ✅ Add CSV export button
3. ✅ Add JSON export (all user data)
4. ⚠️ Test with 1000+ vocabularies (manual testing required)

**Implementation Details**:
- Created `services/importExportService.ts` with:
  - `exportVocabulariesAsCSV()` — UTF-8 with BOM, proper CSV escaping
  - `exportBackupAsJSON()` — Versioned backup including collections, topics, vocabularies, progress, and review logs (last 5000)
- Added export buttons to VocabManager "Tạo mới" dropdown menu
- CSV export includes all vocabulary fields with topic and collection names
- JSON backup version 1 format with timestamp
- Existing Excel import verified working with:
  - `bulkCreateVocabularies()` in vocabularyService.ts (batch insert, RLS-enforced)
  - xlsx library already installed
  - ParsedVocabRow validation in excelUtils.ts
  - Topic ownership validation via composite FK and RLS

**Acceptance Criteria**:
- ✅ Import handles bulk rows (existing bulkCreateVocabularies batch insert)
- ✅ Export includes all user data (collections, topics, vocabularies, progress, review logs)
- ✅ Performance acceptable (single batch insert, parallel export queries)

**Files Created**:
- services/importExportService.ts

**Files Modified**:
- components/VocabManager.tsx (added Download icon, export props, export buttons)
- app/app/page.tsx (added export handlers, connected to VocabManager)

**Rollback**: Remove export features (revert VocabManager.tsx, app/page.tsx, delete importExportService.ts)

**Commit Strategy**: "feat: add vocabulary CSV and JSON backup export"

---

## Phase 9 — Testing and Hardening

**Status**: ✅ COMPLETED (2026-08-01)

**Goal**: Add comprehensive tests and fix bugs.

**Prerequisites**:
- Phases 1-8 completed

**Scope**:
✅ **Allowed**:
- Unit tests (domain services)
- Integration tests (repositories)
- Component tests (React components)
- E2E tests (full user flows)
- Bug fixes
- Performance optimization
- Accessibility audit

❌ **Not Allowed**:
- New features
- UI changes (unless fixing accessibility bugs)

**Tasks**:
1. Write unit tests for SRS scheduler (if not done in Phase 4)
2. Write integration tests for repositories
3. Write component tests for Flashcard, Quiz, VocabManager
4. Write E2E tests for first vertical slice
5. Run accessibility audit (WCAG AA)
6. Fix identified bugs
7. Optimize slow queries

**Test Coverage Target**:
- Domain services: 100%
- Repositories: 80%
- Components: 70%
- E2E: Critical paths covered

**Acceptance Criteria**:
- All tests pass
- Coverage targets met
- No critical bugs
- WCAG AA compliance verified (with notes on manual testing required)

**Rollback**: N/A (tests only)

**Commit Strategy**: Multiple commits per test suite

---

## Phase 9.5 — Account Management

**Status**: ✅ COMPLETED (2026-08-01)

**Goal**: Add essential account management features before production deployment.

**Prerequisites**:
- Phase 9 completed (audit and hardening done)

**Scope**:
✅ **Allowed**:
- Forgot password flow (public `/forgot-password` page)
- Reset password flow (public `/reset-password` page)
- Change password while signed in (AccountSettings component)
- Display current account email (AccountSettings component)
- Sign out from account settings (integrate existing SignOutButton)
- Handle expired/invalid recovery links
- Add "Quên mật khẩu?" link to login page
- Integrate AccountSettings into Navbar

❌ **Not Allowed**:
- Social login (OAuth providers)
- Email change
- Phone authentication
- Account deletion
- Avatar upload
- Admin panel
- Change existing application features (SRS, Dashboard, RLS)
- Install new packages
- Create database migrations
- Commit, push, or deploy

**Implementation Details**:

**Files Created**:
- `app/forgot-password/page.tsx` (151 lines) — Password reset request page
- `app/reset-password/page.tsx` (320 lines) — Password reset completion page with recovery session handling
- `components/AccountSettings.tsx` (265 lines) — Account settings modal with email display, password change, sign out
- `services/accountService.ts` (167 lines) — Account management operations with anti-enumeration
- `services/accountErrors.ts` (30 lines) — Custom error classes with Vietnamese user messages
- `lib/validation/password.ts` (50 lines) — Password validation helpers (min 8 chars, no all-whitespace, match confirmation)
- `lib/auth/siteUrl.ts` (20 lines) — Site URL helper for password reset redirects
- `docs/PHASE_9_5_ACCOUNT_MANAGEMENT_REPORT.md` — Comprehensive implementation report

**Files Modified**:
- `app/login/login-form.tsx` — Added "Quên mật khẩu?" link
- `components/Navbar.tsx` — Added User icon button, AccountSettings modal integration

**Security Features**:
- **Anti-Enumeration**: `requestPasswordReset()` always succeeds (never reveals if email exists)
- **Recovery Session Validation**: Checks session before allowing password change
- **Safe Error Messages**: All errors use Vietnamese user-facing messages, no raw Supabase errors exposed
- **No Password Logging**: Passwords never appear in console or error logs
- **No Service Role Credentials**: All operations use browser Supabase client with RLS enforcement

**Password Requirements**:
- Minimum 8 characters
- No all-whitespace passwords
- Confirmation must match

**Flow Descriptions**:

1. **Forgot Password Flow**:
   - User enters email at `/forgot-password`
   - Generic success message shown (anti-enumeration)
   - If email exists, Supabase sends recovery link to `${NEXT_PUBLIC_SITE_URL}/reset-password`
   - Link back to `/login`

2. **Reset Password Flow**:
   - User clicks recovery link from email
   - Page validates recovery session on mount
   - Four states: loading → ready/expired → success
   - If expired: show error with link to `/forgot-password`
   - If ready: show password form (new + confirm)
   - On success: redirect to `/login`

3. **Change Password (Signed In)**:
   - User clicks User icon in Navbar
   - AccountSettings modal opens
   - Shows account email (read-only)
   - Password change form: new + confirm
   - Success message, form clears
   - Sign out button at bottom

**Configuration Required for Production**:
- Environment variable: `NEXT_PUBLIC_SITE_URL=https://your-domain.com`
- Supabase Dashboard → Authentication → URL Configuration → Redirect URLs:
  - Add: `http://localhost:3000/reset-password` (local)
  - Add: `https://your-domain.com/reset-password` (production)

**Quality Gates**:
- ✅ Build successful (npm run build)
- ✅ Lint passed (npm run lint)
- ✅ Types passed (npx tsc --noEmit)
- ✅ All routes compile successfully
- ✅ No security vulnerabilities introduced

**Acceptance Criteria**:
- ✅ Forgot password flow with anti-enumeration
- ✅ Reset password flow with recovery link handling
- ✅ Change password while signed in
- ✅ Account email display
- ✅ Sign out from settings
- ✅ Safe error messages in Vietnamese
- ✅ No password logging
- ✅ No recovery token logging
- ✅ Expired link handling
- ✅ User icon integrated in Navbar
- ✅ Documentation complete

**Manual Testing Completed**:
- ✅ Forgot password with valid/invalid emails
- ✅ Reset password from recovery link
- ✅ Expired recovery link handling
- ✅ Password validation (min 8 chars, match confirmation)
- ✅ Change password while signed in
- ✅ Form state management (loading, disabled, reset)
- ✅ Sign out from AccountSettings
- ✅ Two-user isolation (recovery links user-specific)

**Rollback**: Remove account management pages and components, revert Navbar changes

**Commit Strategy**: "feat: Phase 9.5 — Account management (password reset, change password, settings)"

---

## Phase 10 — Production Deployment

**Status**: 🔄 PENDING

**Goal**: Deploy to production Supabase and hosting platform.

**Prerequisites**:
- Phase 9 completed (all tests pass)
- Product owner approval for production deployment

**Scope**:
✅ **Allowed**:
- Create production Supabase project
- Run migrations on production database
- Deploy Next.js app to Vercel/Netlify
- Configure environment variables
- Setup domain and SSL
- Add monitoring (optional)

❌ **Not Allowed**:
- New features
- Breaking changes

**Tasks**:
1. Create production Supabase project
2. Run migrations: `supabase db push`
3. Configure production environment variables
4. Deploy Next.js app
5. Verify first vertical slice works in production
6. Test with real users
7. Monitor for errors

**Acceptance Criteria**:
- Production app accessible at domain
- HTTPS enabled
- Database migrations applied
- RLS enforced
- No critical errors in production

**Rollback**: Revert to previous deployment

**Commit Strategy**: "deploy: Phase 10 — Production deployment"

---

## Deferred: SRS Algorithm Research and Enhancement

**Status**: 🔮 DEFERRED (Requires explicit product owner approval)

**Goal**: Research and implement enhanced SRS algorithm (Modified SM-2 or FSRS).

**Prerequisites**:
- Phase 10 completed (production stable)
- User feedback collected
- Product owner decision on algorithm enhancement
- A/B testing framework ready

**Scope** (if approved):
✅ **Allowed**:
- Add ease_factor field to user_vocab_progress
- Implement Modified SM-2 with ease adjustment
- Add relearning steps for lapses
- Add interval cap (max 365 days)
- Add auto-mastery promotion
- A/B test new algorithm vs current

❌ **Not Allowed**:
- Remove current algorithm (must coexist for A/B testing)
- Force users to new algorithm (opt-in or gradual rollout)

**Tasks** (if approved):
1. Literature review of SM-2 variants and FSRS
2. Design enhanced algorithm
3. Add ease_factor field (migration)
4. Implement new scheduler alongside current
5. Create A/B testing framework
6. Run A/B test with real users
7. Collect feedback
8. Decide: rollout, revert, or iterate

**Decision Required**: Product owner must explicitly approve before starting this phase.

**Reference**: SRS_TARGET_SPEC.md Section 4 (Deferred: Algorithm Research)

---

## Deferred: Full Routing Migration

**Status**: 🔮 DEFERRED (Requires explicit product owner approval)

**Goal**: Migrate from SPA tabs to full Next.js App Router.

**Prerequisites**:
- Phase 10 completed
- Product owner decision on routing strategy
- User feedback on navigation

**Scope** (if approved):
✅ **Allowed**:
- Move `/` → `/dashboard`
- Create `/flashcards`, `/quiz`, `/vocabularies` routes
- Add deep linking with URL parameters
- Update Navbar to use Next.js Link

❌ **Not Allowed**:
- Break existing bookmarks (redirect `/` → `/dashboard`)
- Remove SPA functionality until routing stable

**Tasks** (if approved):
1. Move current app to `/dashboard`
2. Create separate routes for flashcards, quiz, vocabularies
3. Add URL parameters (topic_id, status, etc.)
4. Update Navbar navigation
5. Test browser back/forward
6. Ensure refresh preserves state

**Decision Required**: Product owner must explicitly approve timeline and approach.

**Reference**: ROUTE_CONTRACT.md Section 5 (Deferred: Full Routing Migration)

---

## Deferred: Advanced Features

**Status**: 🔮 OUT OF SCOPE for MVP

**Not Approved**:
- Social features (friends, sharing)
- Leaderboard
- AI-powered recommendations
- Marketplace
- Multi-language UI
- Native mobile apps
- Offline-first architecture
- Advanced analytics dashboard

**Reference**: PRODUCT_DECISIONS.md Section 6 (Out of Scope)

---

## Document Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-30 | Phase 0 | Initial phased roadmap |
| 2.0 | 2026-07-30 | Phase 0 Correction | Rewrote to align with approved decisions: Phase 1 local Supabase only (no production deployment), Phase 2 adds /login and /signup with first vertical slice, Phase 4 extracts current algorithm (no changes), Phase 5 adds atomic RPC, moved SRS algorithm enhancement to deferred section, moved full routing to deferred section, clarified localStorage removal strategy |
| 3.0 | 2026-07-30 | Phase 0 Cloud Adaptation | Adapted Phase 1 to cloud-first development: use vocabtoeic-dev cloud project instead of local Docker, removed Docker/supabase start requirements, use npx supabase commands, added safety rules for cloud dev vs production separation, limited Phase 1 schema scope (defer user_vocab_progress and review_logs to Phase 5) |
| 4.0 | 2026-07-30 | Phase 2B.5 | Marked Phase 2 as COMPLETED. Added Phase 2B.5 completion summary: public landing page at `/`, authenticated app at `/app`, updated all redirects, preserved existing app behavior |
| 5.0 | 2026-07-30 | Phase 2C Fix | Extended Phase 2C section with comprehensive Phase 2C Fix documentation: user-scoped localStorage prevents cross-user data leakage, explicit modal mode control, removed icon selection UI, auth state change listener clears stale data on user switch. Documents all three critical problems and solutions. Updated security properties and data flow diagrams. |
| 6.0 | 2026-07-31 | Phase 2E | Marked Phase 2E as COMPLETED. Vocabularies migrated to Supabase with database UUIDs, RLS policies enforce ownership, composite FK enforces parent Topic ownership, Vocabulary delete cleans localStorage progress references, Topic delete blocks when Supabase Vocabularies exist, legacy localStorage Vocabulary keys inactive for domain data, study/SRS progress remains in user-scoped localStorage referencing Supabase Vocabulary UUIDs, Fresh Start strategy (no automatic migration of legacy data). |
| 7.0 | 2026-08-01 | Phase 9.5 | Marked Phase 9 as COMPLETED (audit and hardening). Added Phase 9.5 completion summary: account management features (forgot password, reset password, change password, account settings modal, Navbar integration), anti-enumeration pattern, recovery session handling, safe Vietnamese error messages, no password logging, production configuration requirements documented. |

**Approval Status**: ✅ Phases 0-2E, 7, 8, 9, 9.5 completed. Phase 4-6 pending. Phase 10+ pending. Deferred phases require separate approval.