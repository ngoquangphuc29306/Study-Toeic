# VocabTOEIC — Data Ownership Contract

**Document Version**: 2.6
**Created**: 2026-07-30
**Updated**: 2026-08-01
**Status**: Product Owner Approved (Phase 7 Complete)
**Authority**: Zero Trust — Server enforces all ownership rules

**IMPORTANT**: All SQL examples in this document are **PROPOSED architectural drafts** and are **NOT migration-ready**. They require validation, testing, and adjustment before deployment to Supabase.

---

## 1. Core Principles

### 1.1. Default Private
**All user data is private by default.**

Mọi entity mới phải có `user_id` trừ khi có lý do rõ ràng để public (và được document).

### 1.2. Zero Trust Client
**Server KHÔNG tin client về identity.**

- Client gửi JWT token (từ Supabase Auth)
- Server extract `auth.uid()` từ token
- RLS policies dùng `auth.uid()`, KHÔNG dùng `user_id` từ client payload
- Service-role key KHÔNG được expose trong browser

### 1.3. Ownership Cascade
**Child record PHẢI thuộc cùng owner với parent.**

```
User owns Collection
  → Collection's Topics must belong to same User
    → Topic's Vocabularies must belong to same User
      → Vocabulary's Progress must belong to same User
```

**Enforcement**: 
- **Database-level**: Composite foreign keys `FOREIGN KEY (parent_id, user_id) REFERENCES parent(id, user_id)`
- **RLS policies**: Prevent unauthorized reads/writes
- **Application validation**: Additional checks in business logic

**Critical Requirement**: Simple foreign keys (`FOREIGN KEY (parent_id) REFERENCES parent(id)`) are INSUFFICIENT. They only verify the parent exists, NOT that the parent belongs to the same user. Composite foreign keys must be used to enforce same-owner relationships at the database level.

**Example**:
```sql
-- PROPOSED: Not migration-ready
-- WRONG: Simple FK only checks collection exists
CREATE TABLE topics (
  collection_id TEXT NOT NULL REFERENCES collections(id),
  user_id UUID NOT NULL
);

-- CORRECT: Composite FK enforces same owner
CREATE TABLE topics (
  collection_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  FOREIGN KEY (collection_id, user_id) REFERENCES collections(id, user_id)
);

-- Parent table needs composite unique constraint
CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  UNIQUE(id, user_id) -- Required for composite FK to work
);
```

**Note**: The schemas shown in this document use simple foreign keys for readability. Production migrations must implement composite foreign keys as shown above.

---

## 2. Entity Ownership Matrix

### 2.1. profiles

**Type**: User profile metadata  
**Owner**: `auth.uid()` (one-to-one với auth.users)

**Permissions**:
| Operation | Rule |
|-----------|------|
| **Read** | User can read own profile only |
| **Create** | Triggered on auth.users INSERT (via trigger) |
| **Update** | User can update own profile only |
| **Delete** | Cascade on auth.users DELETE |

**RLS Policy**:
```sql
-- PROPOSED: Not migration-ready
-- Read own profile
CREATE POLICY "Users can read own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- Update own profile
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
```

**Public Fields**: NONE (tất cả private)

**Schema** (target):
```sql
-- PROPOSED: Not migration-ready
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT, -- synced from auth.users
  display_name TEXT,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'Asia/Ho_Chi_Minh',
  daily_goal INT DEFAULT 20,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 2.2. collections

**Type**: User-created vocabulary collections  
**Owner**: `user_id`

**Permissions**:
| Operation | Rule |
|-----------|------|
| **Read** | User can read own collections only |
| **Create** | User creates with own `user_id` (from auth.uid()) |
| **Update** | User can update own collections only |
| **Delete** | User can delete own collections (cascade to topics) |

**RLS Policy**:
```sql
-- PROPOSED: Not migration-ready
-- Read own collections
CREATE POLICY "Users can read own collections"
ON collections FOR SELECT
USING (auth.uid() = user_id);

-- Insert with own user_id
CREATE POLICY "Users can create own collections"
ON collections FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Update own collections
CREATE POLICY "Users can update own collections"
ON collections FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Delete own collections
CREATE POLICY "Users can delete own collections"
ON collections FOR DELETE
USING (auth.uid() = user_id);
```

**Public Fields**: NONE (future: có thể có public_catalogue_collections với flag `is_public`)

**Schema** (target):
```sql
-- PROPOSED: Not migration-ready
CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'FolderKanban',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_collections_user_id ON collections(user_id);
```

---

### 2.3. topics

**Type**: Sections/lessons within collections  
**Owner**: `user_id` (inherited từ parent collection)

**Permissions**:
| Operation | Rule |
|-----------|------|
| **Read** | User can read own topics only |
| **Create** | User creates with own `user_id`; `collection_id` must belong to same user |
| **Update** | User can update own topics only |
| **Delete** | User can delete own topics (cascade to vocabularies) |

**RLS Policy**:
```sql
-- PROPOSED: Not migration-ready
-- Read own topics
CREATE POLICY "Users can read own topics"
ON topics FOR SELECT
USING (auth.uid() = user_id);

-- Insert own topics (với validation collection ownership)
CREATE POLICY "Users can create own topics"
ON topics FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM collections
    WHERE collections.id = topics.collection_id
    AND collections.user_id = auth.uid()
  )
);

-- Update own topics
CREATE POLICY "Users can update own topics"
ON topics FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Delete own topics
CREATE POLICY "Users can delete own topics"
ON topics FOR DELETE
USING (auth.uid() = user_id);
```

**Public Fields**: NONE

**Schema** (target):
```sql
-- PROPOSED: Not migration-ready
CREATE TABLE topics (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'BookOpen',
  category TEXT DEFAULT 'General',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_topics_user_id ON topics(user_id);
CREATE INDEX idx_topics_collection_id ON topics(collection_id);
```

---

### 2.4. vocabularies

**Type**: Individual vocabulary words  
**Owner**: `user_id` (inherited từ parent topic)

**Permissions**:
| Operation | Rule |
|-----------|------|
| **Read** | User can read own vocabularies only |
| **Create** | User creates with own `user_id`; `topic_id` must belong to same user |
| **Update** | User can update own vocabularies only |
| **Delete** | User can soft-delete own vocabularies (set `deleted_at`) |

**RLS Policy**:
```sql
-- PROPOSED: Not migration-ready
-- Read own vocabularies (exclude soft-deleted)
CREATE POLICY "Users can read own vocabularies"
ON vocabularies FOR SELECT
USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Insert own vocabularies
CREATE POLICY "Users can create own vocabularies"
ON vocabularies FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM topics
    WHERE topics.id = vocabularies.topic_id
    AND topics.user_id = auth.uid()
  )
);

-- Update own vocabularies (including soft delete via setting deleted_at)
CREATE POLICY "Users can update own vocabularies"
ON vocabularies FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

**Note on Soft Delete**: The UPDATE policy allows setting `deleted_at`. The SELECT policy excludes soft-deleted records from queries. A separate "undelete" or "recover" operation would UPDATE `deleted_at` back to NULL. Hard delete (actual DELETE statement) is not exposed to users in MVP.

**Public Fields**: NONE (future: shared vocabulary catalogue sẽ có bảng riêng `public_vocabularies`)

**Schema** (target):
```sql
-- PROPOSED: Not migration-ready
CREATE TABLE vocabularies (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  phonetic_uk TEXT,
  phonetic_us TEXT,
  part_of_speech TEXT DEFAULT 'noun',
  meaning TEXT NOT NULL,
  example TEXT,
  example_translation TEXT,
  synonyms TEXT,
  collocations TEXT,
  audio_url TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ -- Soft delete
);

CREATE INDEX idx_vocabularies_user_id ON vocabularies(user_id);
CREATE INDEX idx_vocabularies_topic_id ON vocabularies(topic_id);
CREATE INDEX idx_vocabularies_word ON vocabularies(word);
```

---

### 2.5. user_vocab_progress

**Type**: User's learning progress per vocabulary  
**Owner**: `user_id` (always `auth.uid()`)

**Permissions**:
| Operation | Rule |
|-----------|------|
| **Read** | User can read own progress only |
| **Create** | User creates progress for own `user_id` |
| **Update** | User can update own progress only (via upsert) |
| **Delete** | User can delete own progress (reset) |

**RLS Policy**:
```sql
-- PROPOSED: Not migration-ready
-- Read own progress
CREATE POLICY "Users can read own progress"
ON user_vocab_progress FOR SELECT
USING (auth.uid() = user_id);

-- Upsert own progress
CREATE POLICY "Users can upsert own progress"
ON user_vocab_progress FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
ON user_vocab_progress FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Delete own progress (reset)
CREATE POLICY "Users can delete own progress"
ON user_vocab_progress FOR DELETE
USING (auth.uid() = user_id);
```

**Public Fields**: NONE

**Schema** (target):
```sql
-- PROPOSED: Not migration-ready
CREATE TABLE user_vocab_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vocabulary_id TEXT NOT NULL REFERENCES vocabularies(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'learning', 'mastered')),
  review_count INT DEFAULT 0,
  mastery_level INT DEFAULT 0 CHECK (mastery_level BETWEEN 0 AND 5),
  interval_hours NUMERIC(10,4) DEFAULT 0,
  again_count INT DEFAULT 0,
  last_reviewed_at TIMESTAMPTZ DEFAULT NOW(),
  next_review_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_vocab UNIQUE (user_id, vocabulary_id)
);

CREATE INDEX idx_progress_user_id ON user_vocab_progress(user_id);
CREATE INDEX idx_progress_vocabulary_id ON user_vocab_progress(vocabulary_id);
CREATE INDEX idx_progress_next_review ON user_vocab_progress(user_id, next_review_at) WHERE status != 'mastered';
```

---

### 2.6. review_logs

**Type**: Audit trail of every rating action  
**Owner**: `user_id`

**CRITICAL SECURITY REQUIREMENT**: Browser must NEVER insert directly into `review_logs`. All rating submissions must go through an atomic database function/RPC that:
1. Accepts only: `vocabulary_id`, `rating`, `idempotency_key` from browser
2. Calculates server-side: `previous_interval_hours`, `new_interval_hours`, `next_review_at`
3. Updates `user_vocab_progress` and inserts `review_logs` in single transaction
4. Prevents client manipulation of scheduling algorithm and audit trail

**Permissions**:
| Operation | Rule |
|-----------|------|
| **Read** | User can read own logs only |
| **Create** | Database function/RPC only (NOT direct browser INSERT) |
| **Update** | FORBIDDEN (audit immutability) |
| **Delete** | FORBIDDEN (audit retention) |

**RLS Policy**:
```sql
-- PROPOSED: Not migration-ready
-- Read own logs
CREATE POLICY "Users can read own logs"
ON review_logs FOR SELECT
USING (auth.uid() = user_id);

-- No direct INSERT/UPDATE/DELETE allowed
-- Authenticated and anon roles have no table-level permissions
-- Only the rating RPC (SECURITY DEFINER) can insert review logs
```

**Table-Level Permissions**:
```sql
-- PROPOSED: Not migration-ready
-- Revoke all direct table access
REVOKE ALL ON review_logs FROM authenticated, anon;

-- Grant SELECT only (via RLS policy above)
GRANT SELECT ON review_logs TO authenticated;

-- Grant EXECUTE on rating RPC (defined elsewhere)
GRANT EXECUTE ON FUNCTION submit_vocabulary_rating(UUID, TEXT, UUID) TO authenticated;
```

**Public Fields**: NONE

**Schema** (target):
```sql
-- PROPOSED: Not migration-ready
CREATE TABLE review_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vocabulary_id TEXT NOT NULL REFERENCES vocabularies(id) ON DELETE CASCADE,
  session_id UUID REFERENCES study_sessions(id) ON DELETE SET NULL,
  rating TEXT NOT NULL CHECK (rating IN ('again', 'hard', 'good', 'easy', 'mastered')),
  previous_interval_hours NUMERIC(10,4) NOT NULL, -- Server-calculated, NOT from browser
  new_interval_hours NUMERIC(10,4) NOT NULL, -- Server-calculated, NOT from browser
  next_review_at TIMESTAMPTZ, -- Server-calculated, NOT from browser
  reviewed_at TIMESTAMPTZ NOT NULL,
  idempotency_key UUID NOT NULL UNIQUE, -- Prevents duplicate submissions
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_review_logs_user_id ON review_logs(user_id);
CREATE INDEX idx_review_logs_vocabulary_id ON review_logs(vocabulary_id);
CREATE INDEX idx_review_logs_session_id ON review_logs(session_id);
CREATE INDEX idx_review_logs_reviewed_at ON review_logs(user_id, reviewed_at DESC);
CREATE INDEX idx_review_logs_idempotency ON review_logs(idempotency_key);
```

**Rationale**: If browser provides `previous_interval_hours` and `new_interval_hours`, users could manipulate their learning schedule (e.g., always set long intervals to cheat progress). Server must own the scheduling logic.

**Implementation**: See SRS_TARGET_SPEC.md section 2.4 for the approved atomic RPC pattern.

---

### 2.7. study_sessions

**Type**: Study session tracking (flashcard/quiz sessions)  
**Owner**: `user_id`

**Permissions**:
| Operation | Rule |
|-----------|------|
| **Read** | User can read own sessions only |
| **Create** | User creates sessions |
| **Update** | User can update own sessions (progress tracking) |
| **Delete** | User can delete own sessions |

**RLS Policy**:
```sql
-- PROPOSED: Not migration-ready
-- Read own sessions
CREATE POLICY "Users can read own sessions"
ON study_sessions FOR SELECT
USING (auth.uid() = user_id);

-- Create own sessions
CREATE POLICY "Users can create own sessions"
ON study_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Update own sessions
CREATE POLICY "Users can update own sessions"
ON study_sessions FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Delete own sessions
CREATE POLICY "Users can delete own sessions"
ON study_sessions FOR DELETE
USING (auth.uid() = user_id);
```

**Public Fields**: NONE

**Schema** (target):
```sql
-- PROPOSED: Not migration-ready
CREATE TABLE study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id TEXT REFERENCES topics(id) ON DELETE SET NULL,
  session_type TEXT NOT NULL CHECK (session_type IN ('flashcard', 'quiz', 'typing')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  total_items INT DEFAULT 0,
  completed_items INT DEFAULT 0,
  correct_count INT DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_study_sessions_user_id ON study_sessions(user_id);
CREATE INDEX idx_study_sessions_status ON study_sessions(user_id, status);
```

---

### 2.8. study_session_items

**Type**: Individual items within a session (snapshot của vocab at review time)  
**Owner**: `user_id` (inherited từ session)

**Permissions**:
| Operation | Rule |
|-----------|------|
| **Read** | User can read items của own sessions only |
| **Create** | User creates items khi bắt đầu session |
| **Update** | User updates items (mark answered, rating) |
| **Delete** | Cascade on session delete |

**RLS Policy**:
```sql
-- PROPOSED: Not migration-ready
-- Read own session items
CREATE POLICY "Users can read own session items"
ON study_session_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM study_sessions
    WHERE study_sessions.id = study_session_items.session_id
    AND study_sessions.user_id = auth.uid()
  )
);

-- Create own session items
CREATE POLICY "Users can create own session items"
ON study_session_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM study_sessions
    WHERE study_sessions.id = study_session_items.session_id
    AND study_sessions.user_id = auth.uid()
  )
);

-- Update own session items
CREATE POLICY "Users can update own session items"
ON study_session_items FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM study_sessions
    WHERE study_sessions.id = study_session_items.session_id
    AND study_sessions.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM study_sessions
    WHERE study_sessions.id = study_session_items.session_id
    AND study_sessions.user_id = auth.uid()
  )
);
```

**Public Fields**: NONE

**Schema** (target):
```sql
-- PROPOSED: Not migration-ready
CREATE TABLE study_session_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
  vocabulary_id TEXT NOT NULL REFERENCES vocabularies(id) ON DELETE CASCADE,
  queue_index INT NOT NULL,
  answered BOOLEAN DEFAULT FALSE,
  rating TEXT CHECK (rating IN ('again', 'hard', 'good', 'easy')),
  time_spent_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_session_items_session_id ON study_session_items(session_id);
CREATE INDEX idx_session_items_queue_index ON study_session_items(session_id, queue_index);
```

---

### 2.9. daily_goals

**Type**: User's daily study goals and tracking  
**Owner**: `user_id`

**Permissions**:
| Operation | Rule |
|-----------|------|
| **Read** | User can read own daily goals only |
| **Create** | Auto-created per day (trigger hoặc upsert) |
| **Update** | User can update own goals |
| **Delete** | User can delete own goal records |

**RLS Policy**:
```sql
-- PROPOSED: Not migration-ready
-- Read own daily goals
CREATE POLICY "Users can read own daily goals"
ON daily_goals FOR SELECT
USING (auth.uid() = user_id);

-- Upsert own daily goals
CREATE POLICY "Users can upsert own daily goals"
ON daily_goals FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily goals"
ON daily_goals FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Delete own daily goals
CREATE POLICY "Users can delete own daily goals"
ON daily_goals FOR DELETE
USING (auth.uid() = user_id);
```

**Public Fields**: NONE

**Schema** (target):
```sql
-- PROPOSED: Not migration-ready
CREATE TABLE daily_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_date DATE NOT NULL,
  target_words INT DEFAULT 20,
  studied_words INT DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_date UNIQUE (user_id, goal_date)
);

CREATE INDEX idx_daily_goals_user_id ON daily_goals(user_id);
CREATE INDEX idx_daily_goals_date ON daily_goals(user_id, goal_date DESC);
```

---

### 2.10. user_settings

**Type**: User preferences and app settings  
**Owner**: `user_id`

**Permissions**:
| Operation | Rule |
|-----------|------|
| **Read** | User can read own settings only |
| **Create** | Auto-created on user signup (trigger) |
| **Update** | User can update own settings |
| **Delete** | Cascade on user delete |

**RLS Policy**:
```sql
-- PROPOSED: Not migration-ready
-- Read own settings
CREATE POLICY "Users can read own settings"
ON user_settings FOR SELECT
USING (auth.uid() = user_id);

-- Update own settings
CREATE POLICY "Users can update own settings"
ON user_settings FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

**Public Fields**: NONE

**Schema** (target):
```sql
-- PROPOSED: Not migration-ready
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_goal INT DEFAULT 20,
  auto_play_audio BOOLEAN DEFAULT TRUE,
  show_phonetic BOOLEAN DEFAULT TRUE,
  flashcard_auto_flip BOOLEAN DEFAULT FALSE,
  quiz_question_count INT DEFAULT 10,
  theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),
  language TEXT DEFAULT 'vi',
  timezone TEXT DEFAULT 'Asia/Ho_Chi_Minh',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 2.11. import_jobs

**Type**: Excel/CSV import job tracking  
**Owner**: `user_id`

**Permissions**:
| Operation | Rule |
|-----------|------|
| **Read** | User can read own import jobs only |
| **Create** | User creates import jobs |
| **Update** | System updates job status (progress, completed) |
| **Delete** | User can delete own import jobs |

**RLS Policy**:
```sql
-- PROPOSED: Not migration-ready
-- Read own import jobs
CREATE POLICY "Users can read own import jobs"
ON import_jobs FOR SELECT
USING (auth.uid() = user_id);

-- Create own import jobs
CREATE POLICY "Users can create own import jobs"
ON import_jobs FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Update own import jobs
CREATE POLICY "Users can update own import jobs"
ON import_jobs FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Delete own import jobs
CREATE POLICY "Users can delete own import jobs"
ON import_jobs FOR DELETE
USING (auth.uid() = user_id);
```

**Public Fields**: NONE

**Schema** (target):
```sql
-- PROPOSED: Not migration-ready
CREATE TABLE import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id TEXT REFERENCES topics(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  total_rows INT DEFAULT 0,
  processed_rows INT DEFAULT 0,
  success_count INT DEFAULT 0,
  error_count INT DEFAULT 0,
  error_log JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_import_jobs_user_id ON import_jobs(user_id);
CREATE INDEX idx_import_jobs_status ON import_jobs(user_id, status);
```

---

## 3. RLS Enforcement Checklist

### 3.1. Enable RLS on All Tables
```sql
-- PROPOSED: Not migration-ready
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocabularies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_vocab_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_session_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
```

### 3.2. No Bypass for Anon Key
**Critical**: Supabase anon key phải chịu RLS policies.

Only service-role key bypasses RLS (và KHÔNG được dùng trong browser).

### 3.3. Test RLS Policies
**Verification script** (chạy cho mỗi table):

```sql
-- PROPOSED: Not migration-ready
-- Test as user A
SET request.jwt.claims.sub = '<user_a_uuid>';

-- Should return only user A's data
SELECT * FROM collections;

-- Should fail (user B's data)
SELECT * FROM collections WHERE user_id = '<user_b_uuid>';

-- Should fail (insert with wrong user_id)
INSERT INTO collections (id, user_id, title)
VALUES ('test-col', '<user_b_uuid>', 'Test');

-- Should succeed (insert with auth.uid())
INSERT INTO collections (id, user_id, title)
VALUES ('test-col-2', '<user_a_uuid>', 'Test');
```

---

## 4. Client-Side Enforcement

### 4.1. Do NOT Trust Client
**Application code phải giả định client có thể gửi bất kỳ payload nào.**

**Bad Practice**:
```typescript
// ❌ WRONG: Client tự set user_id
const { data } = await supabase
  .from('collections')
  .insert({
    id: 'col-123',
    user_id: getCurrentUserId(), // ❌ Client-controlled
    title: 'My Collection',
  });
```

**Good Practice**:
```typescript
// ✅ CORRECT: Let database/trigger set user_id from auth.uid()
const { data } = await supabase
  .from('collections')
  .insert({
    id: 'col-123',
    // user_id omitted, will be set by trigger or default
    title: 'My Collection',
  });

// OR use database trigger:
CREATE TRIGGER set_user_id_on_collection
BEFORE INSERT ON collections
FOR EACH ROW
EXECUTE FUNCTION set_owner_from_auth();
```

### 4.2. Service Role Key
**NEVER expose service-role key in**:
- Frontend code
- Environment variables prefixed with `NEXT_PUBLIC_`
- Git repository
- Browser DevTools

**Only use service-role key in**:
- Server-side API routes
- Database migrations
- Admin scripts
- Backend services

### 4.3. Input Validation and Output Encoding

**Input Validation**: User-provided data must be validated according to context:
- **Length limits**: Enforce max length for text fields (e.g., title max 200 chars, word max 100 chars)
- **Type validation**: Ensure data types match schema (numbers are numbers, UUIDs are valid UUIDs)
- **Business rules**: Enforce domain constraints (e.g., interval_hours >= 0, rating must be one of 4 values)
- **Format validation**: Validate structured data (e.g., ISO timestamps, URLs)

**Output Encoding**: Display user-generated content safely:
- **React/JSX**: Automatic escaping for text content (no action needed for `<div>{user.title}</div>`)
- **HTML attributes**: Use React props safely (`className={userClass}` auto-escaped)
- **URLs**: Validate and sanitize user-provided URLs before rendering as `href` (check protocol is http/https)
- **Markdown/rich text**: If added in future, use tested sanitization library (DOMPurify) and allow only safe tags

**NOT Required**:
- ❌ Generic HTML entity encoding for all user text (React handles this)
- ❌ SQL injection prevention via escaping (Supabase client uses parameterized queries)
- ❌ Script tag stripping for simple text fields (React's JSX escapes by default)

**Context-Specific Concerns**:
- `example` and `example_translation` fields: Plain text only in MVP, rendered in JSX (safe by default)
- `note` field: Plain text only, no rich formatting in MVP
- Future rich text: Requires sanitization library and allowlist approach

---

## 5. Migration from localStorage

### 5.1. One-Time Import Only

**CRITICAL**: After a domain is migrated to Supabase, localStorage must NOT be used as a silent long-term persistence fallback for that domain.

**Phase 2D Status** (2026-07-31):
- ✅ Collections: **MIGRATED** to Supabase (source of truth)
  - **Deletion Safety**: Blocks deletion if Supabase Topics exist
  - **No Auto-Cascade**: Does NOT automatically delete database child data
- ✅ Topics: **MIGRATED** to Supabase (source of truth)
  - **Deletion Safety**: Blocks deletion if Supabase Vocabularies exist
  - **No Auto-Cascade**: Does NOT automatically delete Supabase child data
  - **Legacy Keys**: localStorage Topic keys (vocab_local_topics_v1:<user-id>) are no longer read or written
- ✅ Vocabularies: **MIGRATED** to Supabase (Phase 2E complete)
  - **Topic Validation**: Must reference valid Supabase Topic UUIDs
  - **Database UUIDs**: Vocabularies use database-generated UUIDs
  - **Legacy Keys**: localStorage Vocabulary keys (vocab_local_vocabularies_v1:<user-id>) are no longer read or written for domain data
- 🔄 Progress: Still in user-scoped localStorage (Phase 2E+)
  - **Progress References**: localStorage progress references Supabase Vocabulary UUIDs
  - **Deletion Cleanup**: Deleting a Vocabulary cleans its localStorage progress references

**Approved localStorage Uses**:
1. **One-time migration**: Import existing data on first login
2. **Temporary drafts**: Unsaved form input (cleared on submit)
3. **Bounded session recovery**: Current study session only (cleared after session ends or on next login)
4. **Pre-migration domains**: Entities not yet migrated in current phase

**Not Approved**:
- ❌ Long-term fallback if Supabase fails
- ❌ Offline-first sync with conflict resolution
- ❌ Automatic localStorage writes after migration

### 5.2. Ownership Assignment
**Current State**: localStorage không có user_id concept.

**Migration Strategy**:
1. User signs up/logs in
2. Check localStorage for existing data
3. If found, prompt: "Tìm thấy dữ liệu cục bộ. Import vào tài khoản?"
4. If yes, batch insert với `user_id = auth.uid()`
5. Clear localStorage after successful migration
6. Show confirmation: "Đã import {n} collections, {m} topics, {x} vocabularies"

### 5.3. Conflict Resolution
**Scenario**: User already has data on server, localStorage also has data.

**Approved Strategy**: Ask user to choose

**Options Presented to User**:
1. **Merge**: Keep server data + add localStorage data (deduplicate by word field)
2. **Replace**: Discard localStorage, keep only server data
3. **Cancel**: Skip import, keep server data, leave localStorage untouched

**Implementation**:
- Show dialog on first login if both server data and localStorage data exist
- User must choose explicitly (no silent automatic merge)
- After user choice, execute the operation and clear localStorage
- Log the operation for audit purposes

**No Conflict**: If server has no data, simply import all localStorage data without prompting.

---

## 6. Audit & Compliance

### 6.1. Data Export
**User Rights** (GDPR/CCPA):
- User có quyền export toàn bộ dữ liệu của mình
- Format: JSON hoặc CSV
- Bao gồm: collections, topics, vocabularies, progress, review logs, sessions

**Implementation**:
```typescript
// API route: /api/export
export async function GET(req: Request) {
  const user = await getAuthUser(req);
  const data = {
    collections: await exportCollections(user.id),
    topics: await exportTopics(user.id),
    vocabularies: await exportVocabularies(user.id),
    progress: await exportProgress(user.id),
    review_logs: await exportReviewLogs(user.id),
  };
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="vocabtoeic-export-${Date.now()}.json"`,
    },
  });
}
```

### 6.2. Data Deletion
**User Rights**:
- User có quyền xóa toàn bộ dữ liệu
- Cascade delete từ `auth.users` → tất cả tables

**Implementation**:
```sql
-- PROPOSED: Not migration-ready
-- All foreign keys có ON DELETE CASCADE
-- Delete user từ auth.users sẽ tự động xóa tất cả data
DELETE FROM auth.users WHERE id = '<user_id>';
```

**Soft Delete**:
- Vocabularies: `deleted_at` field (có thể recover)
- Hard delete sau 30 ngày (cron job)

---

## 8. Phase 2D — Topic Migration to Supabase

**Status**: Implemented in Phase 2D (2026-07-30)

### Problem
Topics remained in user-scoped localStorage during Phase 2C. This required:
- Complex localStorage management for Topic CRUD
- Manual Topic ID generation (client-side timestamps)
- Inconsistent data sources (Collections in Supabase, Topics in localStorage)
- Potential data loss if localStorage is cleared

### Solution
Migrate Topics to Supabase `public.topics` table with:
- Database-generated UUIDs for Topic IDs
- RLS policies enforcing ownership (`user_id = auth.uid()`)
- Composite foreign key enforcing parent Collection ownership
- Deletion protection when localStorage Vocabularies exist

### Topic ID Transition

**Before Phase 2D**: Client-generated IDs
```
topic-1723456789
```

**After Phase 2D**: Database-generated UUIDs
```
550e8400-e29b-41d4-a716-446655440000
```

### Vocabulary Compatibility Strategy

**Chosen Strategy**: Fresh Start (Strategy A)

Users recreate Topics in Supabase after Phase 2D deployment. Legacy localStorage Topics (if any) are not automatically migrated.

**Behavior**:
- Existing localStorage Vocabularies with legacy Topic IDs are filtered out (not shown)
- New Vocabularies must reference valid Supabase Topic UUIDs
- Vocabulary create/update validates Topic exists in Supabase
- Legacy Topic data remains in localStorage but is inactive

**User-Facing Impact**:
- Users may see empty Topic list after Phase 2D if they have legacy Topics
- Users recreate Topics via "Tạo Section Bài Học" modal
- Existing Vocabularies with legacy Topic IDs will not appear until explicit migration

### Legacy localStorage Keys (Inactive)

These keys are no longer read or written after Phase 2D:
```
vocab_local_topics_v1:<user-id>        # Topics now in Supabase
vocab_deleted_topics_v1:<user-id>      # Topic deletes now in Supabase
```

Data in these keys remains untouched but is not used by the application.

### Topic Deletion Safety

**Phase 2E Behavior**: Block Topic deletion if any Supabase Vocabularies reference that Topic UUID

**Error Message**:
```
Không thể xóa học phần này vì vẫn còn từ vựng. Hãy xóa từ vựng bên trong trước.
```

**Implementation**: `TopicHasVocabulariesError` thrown by `topicService.deleteTopic()`

### Collection Deletion After Phase 2E

**Updated Behavior**: Block Collection deletion if any Supabase Topics exist

**Implementation**: `collectionService.deleteCollection()` queries Supabase Topics

### Files Changed

**New Files**:
- `services/topicService.ts` — Topic CRUD with Supabase
- `services/topicErrors.ts` — `TopicHasVocabulariesError`

**Modified Files**:
- `services/vocabService.ts` — Delegate Topic CRUD to topicService, validate Topic UUIDs for Vocabulary operations
- `app/app/page.tsx` — Import and handle `TopicHasVocabulariesError`
- `docs/DATA_OWNERSHIP_CONTRACT.md` — Updated ownership matrix and migration status

### Security Requirements

1. Topic `user_id` obtained from authenticated Supabase session only
2. RLS policies enforce `user_id = auth.uid()` on all Topic operations
3. Composite FK `(collection_id, user_id) → collections(id, user_id)` enforces parent ownership
4. Topic UUID validation before Vocabulary create/update
5. Vocabularies filtered by valid Supabase Topic UUIDs only

---

## 9. Phase 2C Fix — User-Scoped localStorage

**Status**: Implemented in Phase 2C Fix (2026-07-30)

### Problem
Topics and Vocabularies remain in localStorage during Phase 2C transitional period. The original global localStorage keys caused critical cross-user data leakage:

```
vocab_local_topics_v1       // Shared by all users in same browser
vocab_local_vocabs_v1       // Shared by all users in same browser
```

**Impact**: Alice and Bob could see and delete each other's Topics and Vocabularies when using the same browser.

### Solution
Implement user-scoped localStorage keys that namespace data per authenticated user:

```
Storage Key Format:
vocab_local_topics_v1:<user-id>
vocab_local_vocabs_v1:<user-id>
vocab_local_progress_v1:<user-id>
vocab_study_dates_v1:<user-id>
vocab_deleted_topics_v1:<user-id>
vocab_deleted_vocabs_v1:<user-id>

Example:
vocab_local_topics_v1:550e8400-e29b-41d4-a716-446655440000
vocab_local_vocabs_v1:550e8400-e29b-41d4-a716-446655440000
```

### Implementation
**File**: `services/localStorageHelpers.ts` (new)

Helper functions:
- `getUserStorageKey(baseKey, userId)` — Build user-scoped key
- `getUserScopedArray<T>(baseKey, userId)` — Read user-scoped array
- `setUserScopedArray<T>(baseKey, userId, value)` — Write user-scoped array
- `getUserScopedObject<T>(baseKey, userId, defaultValue)` — Read user-scoped object
- `setUserScopedObject<T>(baseKey, userId, value)` — Write user-scoped object

All Topic and Vocabulary CRUD operations updated to use user-scoped helpers.

### Legacy Global Keys
Legacy unscoped keys are **no longer read** after Phase 2C Fix:
```
vocab_local_topics_v1       // Not read, left untouched
vocab_local_vocabs_v1       // Not read, left untouched
```

**Migration Strategy**: No automatic migration. Legacy data is left untouched for manual cleanup or future explicit migration if needed.

### Security Requirements
1. User ID **must** come from authenticated Supabase session only (`auth.getUser()`)
2. Never accept user ID from form input or client state
3. Missing authentication returns empty arrays, not global fallback keys
4. All localStorage operations validate userId before proceeding
5. Authentication state change clears in-memory state and reloads new user's data

### Icon Defaults
Icon selection UI removed from Collection and Section forms.

**Default Icons**:
- Collection: `FolderKanban`
- Topic/Section: `BookOpen`

Icons are set internally during create operations. Existing icons are preserved during updates.

---

## 10. Phase 2E — Vocabulary Migration to Supabase

**Status**: Implemented in Phase 2E (2026-07-31)

### Problem
Vocabularies remained in user-scoped localStorage during Phase 2D. This required:
- Complex localStorage management for Vocabulary CRUD
- Manual Vocabulary ID generation (client-side timestamps)
- Inconsistent data sources (Collections and Topics in Supabase, Vocabularies in localStorage)
- Potential data loss if localStorage is cleared
- Complex validation logic to filter Vocabularies by valid Supabase Topic UUIDs

### Solution
Migrate Vocabularies to Supabase `public.vocabularies` table with:
- Database-generated UUIDs for Vocabulary IDs
- RLS policies enforcing ownership (`user_id = auth.uid()`)
- Composite foreign key enforcing parent Topic ownership
- Study/SRS progress remains in user-scoped localStorage
- Vocabulary deletion cleans localStorage progress references

### Vocabulary ID Transition

**Before Phase 2E**: Client-generated IDs
```
vocab-1723456789-abc123
```

**After Phase 2E**: Database-generated UUIDs
```
7c9e6679-7425-40de-944b-e07fc1f90ae7
```

### Study/SRS Progress Strategy

**Chosen Strategy**: Keep progress in user-scoped localStorage

Study/SRS data (status, review_count, last_reviewed_at, next_review_at, interval_hours, again_count) remains in localStorage using the new Supabase Vocabulary UUIDs as keys.

**localStorage Keys (Active)**:
```
vocab_local_progress_v1:<user-id>      # Progress data keyed by Vocabulary UUID
vocab_study_dates_v1:<user-id>         # Study date history for streak calculation
```

**Behavior**:
- `getVocabByTopic()` loads Vocabularies from Supabase, merges progress from localStorage
- `updateUserProgress()` writes progress to localStorage using Vocabulary UUID
- `deleteVocabulary()` removes Vocabulary from Supabase, then cleans localStorage progress reference
- `getStudyStats()` computes stats from Supabase Vocabularies + localStorage progress

### Legacy localStorage Keys (Inactive)

These keys are no longer read or written after Phase 2E:
```
vocab_local_vocabularies_v1:<user-id>  # Vocabularies now in Supabase
vocab_deleted_vocabs_v1:<user-id>      # Vocabulary deletes now in Supabase
```

Data in these keys remains untouched but is not used by the application.

### Vocabulary Deletion Safety

**Phase 2E Behavior**: Delete Vocabulary from Supabase, then clean localStorage progress references

**Implementation**: 
1. `vocabularyService.deleteVocabulary()` deletes from Supabase, returns deleted ID
2. `vocabService.deleteVocabulary()` calls vocabularyService, then cleans localStorage progress

**Error Handling**: If Supabase deletion fails, no localStorage cleanup occurs (safe)

### Topic Deletion After Phase 2E

**Updated Behavior**: Block Topic deletion if any Supabase Vocabularies exist (replaced Phase 2D's localStorage-based check)

**Implementation**: `topicService.deleteTopic()` now queries Supabase Vocabularies instead of localStorage

### Files Changed

**New Files**:
- `services/vocabularyService.ts` — Vocabulary CRUD with Supabase
- `services/vocabularyErrors.ts` — `VocabularyValidationError`

**Modified Files**:
- `services/vocabService.ts` — Delegate Vocabulary CRUD to vocabularyService, merge Supabase data with localStorage progress
- `services/topicService.ts` — Query Supabase Vocabularies for deletion safety check
- `app/app/page.tsx` — Import `VocabularyValidationError`
- `docs/DATA_OWNERSHIP_CONTRACT.md` — Updated ownership matrix and migration status

### Security Requirements

1. Vocabulary `user_id` obtained from authenticated Supabase session only
2. RLS policies enforce `user_id = auth.uid()` on all Vocabulary operations
3. Composite FK `(topic_id, user_id) → topics(id, user_id)` enforces parent ownership
4. Foreign key violation (23503) handled gracefully with user-friendly error
5. Study/SRS progress stored in user-scoped localStorage only
6. Progress cleanup occurs only after confirmed Supabase deletion

### Fresh Start Strategy

**Migration Strategy**: Fresh Start (Strategy A)

Users recreate Vocabularies in Supabase after Phase 2E deployment. Legacy localStorage Vocabularies (if any) are not automatically migrated.

**Behavior**:
- Existing localStorage Vocabularies with legacy IDs are not shown
- New Vocabularies must be created via UI (single or bulk import)
- Legacy Vocabulary data remains in localStorage but is inactive
- Users can recreate their vocabulary lists via Excel import or manual entry

**User-Facing Impact**:
- Users may see empty Vocabulary lists after Phase 2E if they have legacy data
- Users recreate Vocabularies via "Thêm Từ Vựng" or "Nhập từ Excel"
- Study progress resets to "new" for recreated Vocabularies

---


| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-30 | Phase 0 | Initial data ownership contract |
| 2.0 | 2026-07-30 | Phase 0 Correction | Added PROPOSED label to all SQL, added composite FK requirement, clarified review_logs atomic RPC requirement, added input validation section, clarified localStorage as one-time import only, fixed soft delete policy |
| 2.1 | 2026-07-30 | Phase 2C | Updated migration status: Collections migrated to Supabase, Topics/Vocabularies remain in localStorage |
| 2.2 | 2026-07-30 | Phase 2C Fix | Added Collection deletion safety: blocks deletion if child Topics/Vocabularies exist in localStorage, prevents orphaned data during transitional period |
| 2.3 | 2026-07-30 | Phase 2C Fix | Added user-scoped localStorage: Topics/Vocabularies namespaced per authenticated user (vocab_local_topics_v1:<user-id>), prevents cross-user data leakage, legacy global keys no longer read, auth state reset clears data on account change, icon defaults documented |
| 2.4 | 2026-07-30 | Phase 2D | Topics migrated to Supabase with database UUIDs, RLS policies enforce ownership, composite FK enforces parent Collection ownership, Topic delete blocks when localStorage Vocabularies exist, Vocabulary create/update validates Topic UUID, legacy localStorage Topic keys inactive, Collection delete checks Supabase Topics instead of localStorage |
| 2.5 | 2026-07-31 | Phase 2E | Vocabularies migrated to Supabase with database UUIDs, RLS policies enforce ownership, composite FK enforces parent Topic ownership, Vocabulary delete cleans localStorage progress references, Topic delete blocks when Supabase Vocabularies exist, legacy localStorage Vocabulary keys inactive for domain data, study/SRS progress remains in user-scoped localStorage referencing Supabase Vocabulary UUIDs |
| 2.6 | 2026-08-01 | Phase 7 | Dashboard statistics migrated from localStorage to Supabase: streak from review_logs consecutive days, today activity from review_logs with timezone-aware boundaries, due count from user_vocab_progress.next_review_at server-side calculation, unique vocabulary studied today from review_logs DISTINCT count, localStorage study dates (vocab_study_dates_v1:<user-id>) no longer written but kept for backward compatibility, daily goal preference remains in localStorage as user setting not statistic, dashboardService.ts created for Dashboard-specific queries with RLS enforcement |

**Approval**: This document defines the security model. Any deviation requires security review.
