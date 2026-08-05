# VocabTOEIC — Route Contract

**Document Version**: 3.1
**Created**: 2026-07-30  
**Updated**: 2026-08-05
**Status**: Product Owner Approved  
**Authority**: Describes current state and approved routes

---

## 1. Current State (Phase 2B.5 Completed)

### 1.1. Route Structure

```
/              → Public landing page (marketing)
/login         → Public login page
/signup        → Public signup page
/auth/callback → Public OAuth/email confirmation callback

/app           → Protected: Authenticated application (SPA with tabs)
/app/*         → Protected: Future authenticated routes
```

### 1.2. Landing Page at `/`

**Status**: ✅ **IMPLEMENTED** (Phase 2B.5)

**Route**: `/` (public, accessible to all)

**Purpose**: Marketing landing page for unauthenticated and authenticated visitors

**Sections**:
- Public navigation (logo, login, signup CTAs)
- Hero section with value proposition
- Core benefits (SRS, organization, progress tracking)
- SRS explanation (Again/Hard/Good/Easy)
- Organization flow (Collection → Topic → Vocabulary → Session)
- Final CTA
- Footer

**Behavior**:
- Accessible to logged-out users
- Accessible to logged-in users (does NOT auto-redirect to `/app`)
- Login/Signup CTAs navigate to `/login` and `/signup`

### 1.3. Authenticated Application at `/app`

**Status**: ✅ **IMPLEMENTED** (Phase 2B.5)

**Route**: `/app` (protected, requires authentication)

**Application Model**: Single Page Application (SPA) with tab-based navigation

**State-Based Tabs**:
```typescript
type ActiveTab = 'dashboard' | 'flashcard' | 'synonyms' | 'vocab-manager';
const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
```

**View Mapping**:
| Tab Value | Component | Description |
|-----------|-----------|-------------|
| `'dashboard'` | `<Dashboard />` | Tổng quan, stats, collections, topics |
| `'flashcard'` | `<FlashcardMode />` | Chế độ học flashcard với SRS |
| `'synonyms'` | `<SynonymPractice />` | Luyện từ đồng nghĩa |
| `'vocab-manager'` | `<VocabManager />` | Quản lý CRUD vocabularies |

**Navigation Trigger**:
- User clicks tab trong `<Navbar />`
- Components call `setActiveTab('dashboard')` để switch
- URL KHÔNG thay đổi (vẫn là `/app`)
- Logo/home button in Navbar navigates to dashboard tab (within `/app`)

**Preserved Behavior from Phase 2B**:
- Dashboard, Flashcard, Synonym Practice và Vocabulary Manager là các tab hiện tại
- State management unchanged
- localStorage unchanged
- Modal behavior unchanged
- Collection/Topic/Vocabulary behavior unchanged
- SRS calculations unchanged
- Keyboard shortcuts unchanged

### 1.4. Authentication Routes

**Status**: ✅ **IMPLEMENTED** (Phase 2B)

**Routes**:
| Route | Purpose | Access |
|-------|---------|--------|
| `/login` | Email/password login | Public |
| `/signup` | User registration | Public |
| `/auth/callback` | OAuth/email confirmation | Public |

**Redirect Logic** (Phase 2B.5 Updated):
- Unauthenticated user visits `/app` → `/login?next=%2Fapp`
- Successful login without `next` → `/app`
- Successful login with `next=/app` → `/app`
- Authenticated user visits `/login` or `/signup` → `/app`
- Successful signup (no email confirmation) → `/app`
- Auth callback success → `/app` (or safe `next` parameter)

---

## 2. Route Protection (Middleware)

### 2.1. Public Routes

**No authentication required**:
```
/              Public landing page
/login         Login page
/signup        Signup page
/auth/*        Auth callbacks
```

### 2.2. Protected Routes

**Authentication required**:
```
/app           Main authenticated application
/app/*         Future authenticated routes
```

**Enforcement**: `lib/supabase/middleware.ts` checks authentication and redirects

---

## 3. Safe Redirect Contract

### 3.1. Security Rules

**Valid Redirects**:
- `/app`
- `/app/some-future-route`
- Any path starting with single `/`

**Invalid Redirects** (rejected, fallback to `/app`):
- `https://evil.com`
- `//evil.com`
- `javascript:alert(1)`
- Malformed URLs
- Empty or null paths

**Default Fallback**: `/app` (changed from `/` in Phase 2B.5)

### 3.2. Implementation

**File**: `lib/auth/safe-redirect.ts`

```typescript
export function getSafeRedirectPath(
  path: string | null | undefined,
  fallback: string = '/app'
): string
```

---

## 4. Internal Navigation

### 4.1. Landing Page Links

**From `/` (public landing)**:
- Login button → `/login`
- Signup button → `/signup`
- Logo → stays on `/` (no navigation)

### 4.2. Authenticated App Links

**Within `/app` (authenticated application)**:
- Logo/brand click → dashboard tab (state change, stays at `/app`)
- Navbar tabs → state change (stays at `/app`)
- All internal navigation via React state (no URL changes)

---

## 5. Future Routes (Deferred)

### 5.1. Full Routing Migration (Deferred)

**Status**: 🔮 **DEFERRED** until Phase 6+ (requires product owner approval)

**Proposed Routes** (NOT approved for current phase):
- `/app/dashboard` — Dedicated dashboard route
- `/app/flashcards` — Flashcard mode route
- `/app/flashcards/[topicId]` — Topic-specific flashcard
- `/app/quiz` — Quiz mode route
- `/app/quiz/[topicId]` — Topic-specific quiz
- `/app/vocabularies` — Vocab manager route
- `/app/vocabularies/[vocabId]` — Edit single vocabulary
- `/app/collections/[collectionId]` — Collection detail
- `/app/topics/[topicId]` — Topic detail
- `/app/settings` — User settings
- `/app/profile` — User profile

**Decision Required**: When to migrate from SPA tabs to full routing?

**Options**:
- Phase 6 (after core features stable)
- Phase 8+ (after testing)
- Never (keep SPA)

### 5.2. Deep Linking (Deferred)

**Current** (không support):
```
https://<deployment-host>/app
```

**Proposed** (Phase 6+, NOT approved):
```
https://vocabtoeic.app/app/flashcards/topic-contracts?status=new
https://vocabtoeic.app/app/quiz/topic-office
https://vocabtoeic.app/app/vocabularies?search=obligation
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

### 5.3. API Routes (Deferred)

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

## 6. Route Guards (Implemented)

### 6.1. Authentication Guard

**Status**: ✅ **IMPLEMENTED** (Phase 2B.5)

**Implementation**:
```typescript
// lib/supabase/middleware.ts
export async function updateSession(request: NextRequest) {
  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  
  // Public routes
  const isPublicRoute = pathname === '/' || 
                       pathname === '/login' || 
                       pathname === '/signup' ||
                       pathname.startsWith('/auth/');
  
  // Protected routes (/app and /app/*)
  const isProtectedRoute = pathname === '/app' || pathname.startsWith('/app/');
  
  if (isProtectedRoute && !user) {
    return NextResponse.redirect(new URL('/login?next=' + encodeURIComponent(pathname), req.url));
  }
  
  // Redirect authenticated users from auth pages
  if (user && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/app', req.url));
  }
  
  return NextResponse.next();
}
```

**Protected Routes**:
- `/app` — Main authenticated application
- `/app/*` — Future authenticated routes

**Public Routes**:
- `/` — Landing page
- `/login` — Login page
- `/signup` — Signup page
- `/auth/*` — Auth callbacks

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

## 7. Migration Strategy (Phase 2B.5 Completed)

### 7.1. Phase 2B: Add Auth Routes Only

**Status**: ✅ **COMPLETED**

**Tasks**:
1. ✅ Create `/login` page
2. ✅ Create `/signup` page
3. ✅ Add middleware to protect `/`
4. ✅ Redirect unauthenticated users to `/login`
5. ✅ After login, redirect to `/`
6. ✅ Keep existing app at `/` unchanged

### 7.2. Phase 2B.5: Public Landing and Protected /app

**Status**: ✅ **COMPLETED**

**Tasks**:
1. ✅ Move authenticated app from `/` to `/app`
2. ✅ Create public landing page at `/`
3. ✅ Update middleware to protect `/app` and `/app/*`
4. ✅ Keep `/` public for all visitors
5. ✅ Update auth redirects from `/` to `/app`
6. ✅ Update safe redirect default from `/` to `/app`
7. ✅ Preserve all existing application behavior at `/app`

### 7.3. Phase 6+: Full Routing (If Approved)
**Only IF product owner approves full routing migration**:

**Incremental Steps**:
1. Move `/app` SPA → separate routes within `/app/*`
2. Break tabs into: `/app/dashboard`, `/app/flashcards`, `/app/synonyms`, `/app/vocabularies`
3. Eventually: Add deep linking with URL parameters

**File Structure** (if approved):
```
app/
  ├── page.tsx                      # Landing page (public)
  ├── (auth)/
  │     ├── login/page.tsx
  │     └── signup/page.tsx
  ├── app/
  │     ├── page.tsx                # Redirects to /app/dashboard
  │     ├── dashboard/page.tsx      # Current dashboard tab
  │     ├── flashcards/page.tsx     # Flashcard mode
  │     ├── synonyms/page.tsx        # Synonym Practice
  │     └── vocabularies/page.tsx   # Vocab manager
  └── layout.tsx
```

**Navbar Update** (if approved):
```typescript
// Change from setState to Next.js Link
<Link href="/app/dashboard">Tổng Quan</Link>
<Link href="/app/flashcards">Luyện Flashcards</Link>
<Link href="/app/synonyms">Luyện từ đồng nghĩa</Link>
<Link href="/app/vocabularies">Quản Lý Từ Vựng</Link>
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

### 8.2. Synonym Practice Route (Proposed)

**Proposed**: `/synonyms/[topicId]?count=10&type=mixed`

### 8.3. Vocabularies Route (Proposed)

**Proposed**: `/vocabularies?search=obligation&topic=topic-contracts`

---

## 9. Non-Negotiable Rules

### 9.1. Backward Compatibility
**During Migration** (if Phase 6+ approved):
- `/app` bookmarks must still work
- No 404 for users with saved URLs
- Clear migration path for existing users

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

## 10. Document Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-30 | Phase 0 | Initial route contract |
| 2.0 | 2026-07-30 | Phase 0 Correction | Clarified Phase 2 adds only /login and /signup, kept current app at `/`, deferred full routing migration, resolved contradictions |
| 3.0 | 2026-07-30 | Phase 2B.5 | Implemented public landing at `/` and moved authenticated app to `/app`. Updated all auth redirects to `/app`. Updated safe redirect default to `/app`. Removed deferred public landing page section (now implemented). |

**Approval**: ✅ Phase 2B.5 completed. `/` is public landing, `/app` is protected authenticated application.
