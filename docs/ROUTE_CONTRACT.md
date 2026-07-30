# VocabTOEIC — Route Contract

**Document Version**: 2.0  
**Created**: 2026-07-30  
**Updated**: 2026-07-30  
**Status**: Product Owner Approved  
**Authority**: Describes current state and approved first-slice routes

---

## 1. Current State (Approved)

### 1.1. Single-Page Application
VocabTOEIC hiện tại là **Single Page Application (SPA)** với:
- **Single Route**: `/` (app root)
- **Navigation**: Tab-based switching via React state
- **No URL routing**: Không có Next.js App Router navigation

### 1.2. Current Navigation Model

**File**: `app/page.tsx`

**State-Based Tabs**:
```typescript
type ActiveTab = 'dashboard' | 'flashcard' | 'quiz' | 'vocab-manager';
const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
```

**View Mapping**:
| Tab Value | Component | Description |
|-----------|-----------|-------------|
| `'dashboard'` | `<Dashboard />` | Tổng quan, stats, collections, topics |
| `'flashcard'` | `<FlashcardMode />` | Chế độ học flashcard với SRS |
| `'quiz'` | `<QuizMode />` | Chế độ quiz trắc nghiệm |
| `'vocab-manager'` | `<VocabManager />` | Quản lý CRUD vocabularies |

**Navigation Trigger**:
- User clicks tab trong `<Navbar />`
- Components call `setActiveTab('dashboard')` để switch
- URL KHÔNG thay đổi (vẫn là `/`)

### 1.3. Current Limitations

**Không hỗ trợ**:
- ❌ Deep linking (không thể share link "đang học topic X")
- ❌ Browser back/forward navigation
- ❌ Bookmarking specific views
- ❌ URL parameters (topic_id, vocab_id)
- ❌ Separate auth routes (/login, /signup)

**Rationale**: Prototype từ Google AI Studio, chưa implement routing.

---

## 2. Internal View State (Current)

### 2.1. Dashboard View
**Route**: `/` (tab = 'dashboard')

**Sub-Views** (không có route):
- Collections list (default)
- Topic expanded view (click collection card)
- Difficult words section

**State**:
```typescript
// No URL params, pure component state
const [expandedCollectionId, setExpandedCollectionId] = useState<string | null>(null);
```

### 2.2. Flashcard View
**Route**: `/` (tab = 'flashcard')

**Parameters** (React state, không có URL):
```typescript
const [selectedTopicId, setSelectedTopicId] = useState<string>('all');
const [initialFlashcardStatus, setInitialFlashcardStatus] = useState<'all' | 'new' | 'learning' | 'mastered'>();
```

**Navigation Flow**:
1. User ở Dashboard
2. Click "Học Ngay" button trên topic card
3. → `handleSelectTopicForFlashcard(topicId, 'new')`
4. → `setActiveTab('flashcard')` + set topic/status state
5. FlashcardMode nhận props, load vocabularies filtered by topic + status

### 2.3. Quiz View
**Route**: `/` (tab = 'quiz')

**Parameters** (React state):
```typescript
const [selectedTopicId, setSelectedTopicId] = useState<string>('all');
```

**Navigation Flow**: Tương tự Flashcard

### 2.4. Vocab Manager View
**Route**: `/` (tab = 'vocab-manager')

**Sub-Views** (accordion state):
- Collections accordion (expand/collapse)
- Topics accordion (nested)
- Vocabularies table

**State**: Component-internal, không expose ra URL.

---

## 3. Modal State (Current)

### 3.1. Current Modals
**Modals KHÔNG là routes**, chỉ là React state:

```typescript
const [isAddModalOpen, setIsAddModalOpen] = useState(false);
const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
```

**Trigger**: Button click → `setIsAddModalOpen(true)`

**No URL**: Modal open/close không thay đổi URL.

---

## 4. First Vertical Slice Routes (Approved for Phase 2)

### 4.1. Authentication Routes

**Status**: ✅ **APPROVED** for Phase 2

**Routes to Add**:
| Route | Purpose | Component |
|-------|---------|-----------|
| `/login` | Login page | `<LoginPage />` |
| `/signup` | Sign up page | `<SignupPage />` |

**Implementation**: Next.js App Router
```
app/
  ├── (auth)/
  │     ├── login/
  │     │     └── page.tsx
  │     ├── signup/
  │     │     └── page.tsx
  └── page.tsx  // ← Current app stays at `/` (no changes)
```

**Redirect Logic**:
- Unauthenticated user → `/login`
- After login → `/` (current app, no changes to existing routes)

**NOT in Phase 2**:
- ❌ `/reset-password` (deferred)
- ❌ `/auth/callback` for OAuth (deferred, unless needed for first slice)
- ❌ Moving existing app to `/dashboard`
- ❌ Separate routes for flashcards, quiz, vocabularies

### 4.2. Current App Remains at `/`

**Status**: ✅ **APPROVED**

The existing application at `/` keeps:
- Tab-based navigation (dashboard, flashcard, quiz, vocab-manager)
- All current state management
- All current UI components
- No URL changes during tab switching

**Rationale**: Minimize risk by adding auth routes without restructuring existing app.

### 4.3. First Vertical Slice User Flow

**Approved Flow**:
1. User visits app → redirected to `/login` (if not authenticated)
2. User signs up at `/signup`
3. User logs in at `/login`
4. Redirected to `/` (existing app with dashboard tab)
5. User creates collection (persists to Supabase)
6. User creates topic (persists to Supabase)
7. User adds vocabulary (persists to Supabase)
8. User refreshes browser → data persists (loaded from Supabase)
9. Different user logs in → cannot see first user's data (RLS enforced)

---

## 5. Deferred: Full Routing Migration

### 5.1. Main App Routes (Deferred)

**Status**: 🔮 **DEFERRED** until Phase 6+ (requires product owner approval)

**Proposed Routes** (NOT approved for MVP):
- `/dashboard` — Move current dashboard tab to dedicated route
- `/flashcards` — Flashcard mode route
- `/flashcards/[topicId]` — Topic-specific flashcard
- `/quiz` — Quiz mode route
- `/quiz/[topicId]` — Topic-specific quiz
- `/vocabularies` — Vocab manager route
- `/vocabularies/[vocabId]` — Edit single vocabulary
- `/collections/[collectionId]` — Collection detail
- `/topics/[topicId]` — Topic detail
- `/settings` — User settings
- `/profile` — User profile

**Decision Required**: When to migrate from SPA tabs to full routing?

**Options**:
- Phase 6 (after core features stable)
- Phase 8+ (after testing)
- Never (keep SPA)

### 5.2. Public Landing Page (Deferred)

**Status**: 🔮 **DEFERRED**

**Options**:
1. Public landing at `/`, app at `/dashboard`
2. Direct to login (no public page, keep current `/`)
3. Separate marketing domain

**Decision Required**: Product owner must approve landing page strategy.

### 5.3. Deep Linking (Deferred)

**Current** (không support):
```
https://vocabtoeic.app/
```

**Proposed** (Phase 6+, NOT approved):
```
https://vocabtoeic.app/flashcards/topic-contracts?status=new
https://vocabtoeic.app/quiz/topic-office
https://vocabtoeic.app/vocabularies?search=obligation
```

**Benefits**:
- Share specific topic với friends
- Bookmark favorite sections
- Browser back/forward works
- Better SEO (if public landing page added)

**Cost**:
- Significant refactor of existing app
- Migration complexity
- Testing effort

### 5.4. API Routes (Deferred)

**Status**: 🔮 **DEFERRED** until specific need identified

**Proposed Routes** (NOT approved):
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/export` | GET | Export user data (JSON/CSV) |
| `/api/import` | POST | Import Excel/CSV |
| `/api/stats` | GET | Get dashboard stats (if client-side too slow) |

**NOT Approved**:
- ❌ `/api/progress/sync` — Offline sync is out of scope
- ❌ `/api/admin/migrate` — Admin routes deferred

**Current**: All logic ở client, gọi Supabase client trực tiếp. This is acceptable for MVP.

**Add API routes only when**:
- Server-side logic required (e.g., file processing)
- Rate limiting needed
- Client-side approach proven insufficient

---

## 6. Route Guards (Phase 2)

### 6.1. Authentication Guard

**Status**: ✅ **APPROVED** for Phase 2

**Implementation**:
```typescript
// middleware.ts
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  // Public routes
  const isPublic = pathname === '/login' || 
                   pathname === '/signup' ||
                   pathname.startsWith('/auth/');
  
  if (isPublic) {
    return NextResponse.next();
  }
  
  // Protected routes (including `/`)
  const session = await getSession(req);
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  
  return NextResponse.next();
}
```

**Protected Routes**:
- `/` — Current app (requires auth)
- Any future routes except `/login`, `/signup`, `/auth/*`

### 6.2. Role-Based Guard (Deferred)

**Status**: 🔮 **DEFERRED** — No admin features in MVP

If admin features are added in future:
```typescript
// app/(admin)/layout.tsx
export default async function AdminLayout({ children }) {
  const session = await getServerSession();
  
  if (!session || session.user.role !== 'admin') {
    redirect('/');
  }
  
  return <>{children}</>;
}
```

---

## 7. Migration Strategy (Approved)

### 7.1. Phase 2: Add Auth Routes Only

**Tasks**:
1. Create `/login` page
2. Create `/signup` page
3. Add middleware to protect `/`
4. Redirect unauthenticated users to `/login`
5. After login, redirect to `/`
6. Keep existing app at `/` unchanged

**NO CHANGES** to existing app structure, components, or routing logic.

### 7.2. Phase 6+: Full Routing (If Approved)
**Only IF product owner approves full routing migration**:

**Incremental Steps**:
1. Move `/` → `/dashboard` (keep SPA tab navigation inside)
2. Keep flashcard/quiz/vocab-manager as tabs within `/dashboard`
3. Eventually: Break tabs into separate routes

**File Structure** (if approved):
```
app/
  ├── (auth)/
  │     ├── login/page.tsx
  │     └── signup/page.tsx
  ├── (app)/
  │     └── dashboard/
  │           └── page.tsx  // ← Current app/page.tsx moves here
  └── layout.tsx
```

**Navbar Update** (if approved):
```typescript
// Change from setState to Next.js Link
<Link href="/dashboard">Tổng Quan</Link>
<Link href="/flashcards">Luyện Flashcards</Link>
<Link href="/quiz">Bài Tập Quiz</Link>
<Link href="/vocabularies">Quản Lý Từ Vựng</Link>
```

---

## 8. URL Parameter Contracts (Deferred)

**Status**: 🔮 **DEFERRED** until full routing migration approved

### 8.1. Flashcards Route (Proposed)

**Proposed**: `/flashcards/[topicId]?status=new&shuffle=true`

**Parameters**:
| Param | Type | Values | Default | Description |
|-------|------|--------|---------|-------------|
| `topicId` | path | string or 'all' | 'all' | Topic to study |
| `status` | query | 'all' \| 'new' \| 'learning' \| 'mastered' | 'all' | Filter by learning status |
| `shuffle` | query | boolean | true | Shuffle card order |
| `limit` | query | number | 20 | Max cards per session |

### 8.2. Quiz Route (Proposed)

**Proposed**: `/quiz/[topicId]?count=10&type=mixed`

### 8.3. Vocabularies Route (Proposed)

**Proposed**: `/vocabularies?search=obligation&topic=topic-contracts`

---

## 9. Non-Negotiable Rules

### 9.1. Backward Compatibility
**During Migration** (if Phase 6+ approved):
- Old bookmarks (`/`) must still work
- Redirect `/` → `/dashboard` if authenticated
- No 404 for users with old URLs

### 9.2. Browser Navigation
**Once routing is implemented** (if approved):
- Back button PHẢI hoạt động
- Forward button PHẢI hoạt động
- Refresh PHẢI giữ nguyên state

---

## 10. Open Decisions for Product Owner

### 10.1. Routing Migration Timeline (Priority: MEDIUM)

**Question**: When should full routing migration happen?

**Options**:
- A: Phase 6 (after core features stable)
- B: Phase 8+ (after testing complete)
- C: Never (keep SPA forever)

**Current Decision**: ✅ DEFERRED — Keep SPA for MVP, revisit after launch

---

### 10.2. Landing Page Strategy (Priority: LOW)

**Question**: Should there be a public landing page?

**Options**:
- A: Public landing at `/`, app at `/dashboard`
- B: Direct to login (no public page, keep current `/`)
- C: Different domain

**Current Decision**: 🔮 DEFERRED — No public landing page in MVP

---

## Document Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-30 | Phase 0 | Initial route contract |
| 2.0 | 2026-07-30 | Phase 0 Correction | Clarified Phase 2 adds only /login and /signup, kept current app at `/`, deferred full routing migration, resolved contradictions |

**Approval**: ✅ Current state and Phase 2 auth routes approved. Full routing migration requires separate approval.
