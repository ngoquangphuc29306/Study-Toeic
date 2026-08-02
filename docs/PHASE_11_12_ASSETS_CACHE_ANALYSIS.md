# Phase 11-12: Assets, Images & Cache Analysis

**Audit Date**: 2026-08-02  
**Audit Scope**: Images, avatars, audio assets, browser cache, Next.js cache, Supabase client caching  
**Status**: COMPLETED

---

## Executive Summary

**CONFIRMED FINDINGS**:
1. **No static images in public directory** - Application has no images to optimize
2. **Avatar uses native <img> tag, not next/image** - Missing Next.js image optimization
3. **Avatar signed URL expires after 1 hour** - Frequent regeneration required
4. **audio_url column exists but no audio playback implemented** - Database field unused
5. **No HTTP cache headers configured** - Relying on Next.js defaults only
6. **No explicit Supabase client cache configuration** - Using library defaults
7. **No service worker or PWA caching** - Only browser and Next.js caching active

**EXCELLENT PATTERNS**:
1. **No LCP-blocking images** - Application is text/icon-based (Lucide icons)
2. **Avatar preview uses blob URLs** - Efficient local preview before upload
3. **Proper blob URL cleanup** - useEffect cleanup prevents memory leaks
4. **Supabase client reuses singleton** - No client recreation overhead

**Performance Impact**: LOW
- No images to optimize (no public/ directory assets)
- Avatar is small UI element (not LCP candidate)
- Audio feature not implemented (no playback overhead)
- Cache headers rely on Next.js production defaults

---

## Image Assets Analysis

### Static Images

**Public Directory Check**:
```bash
find public -type f \( -name "*.png" -o -name "*.jpg" ... \)
# Result: No files found
```

**Application-wide Image Search**:
```bash
grep -r "<img|next/image|Image from" app components
# Result: Found only in Navbar.tsx and AccountSettings.tsx (avatar)
```

✅ **No static images exist in public/ directory**  
✅ **No product images, hero images, or marketing assets**  
✅ **No LCP (Largest Contentful Paint) image blockers**

**Assessment**: **EXCELLENT** - Text-based application with icon-only UI (Lucide React icons)

---

## Avatar Image Analysis

### Avatar Implementation - Navbar.tsx

**Location**: [components/Navbar.tsx:162-173](components/Navbar.tsx:162-173)

```typescript
{isLoadingProfile ? (
  <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
) : profile?.avatarUrl ? (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={profile.avatarUrl}
    alt="Avatar"
    className="w-8 h-8 rounded-full object-cover border-2 border-[#FCE7F3]"
  />
) : (
  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#F472B6] to-[#FFB6C1] flex items-center justify-center text-white text-sm font-bold border-2 border-[#FCE7F3]">
    {profile?.displayName?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || 'U'}
  </div>
)}
```

❌ **Uses native <img> tag, not next/image**  
❌ **No image optimization (resize, format conversion, lazy loading)**  
✅ **Loading state with skeleton (animate-pulse)**  
✅ **Fallback to initials if no avatar**

**Same pattern in AccountSettings.tsx**: Lines 162-173, 187-198

---

### Signed URL Expiry

**Location**: [services/profileService.ts:395-417](services/profileService.ts:395-417)

```typescript
export async function getAvatarDisplayUrl(avatarPath: string | null): Promise<string | null> {
  if (!avatarPath) {
    return null;
  }

  const supabase = createClient();

  try {
    const { data, error } = await supabase.storage
      .from('avatars')
      .createSignedUrl(avatarPath, 3600); // 1 hour expiry

    if (error) {
      console.error('Create signed URL error:', error.message);
      return null;
    }

    return data.signedUrl;
  } catch (err) {
    console.error('Get avatar URL exception:', err);
    return null;
  }
}
```

⚠️ **Signed URL expires after 1 hour (3600 seconds)**  
⚠️ **Called on every profile load** (Navbar remount, AccountSettings mount)  
⚠️ **No URL caching** - Fresh signed URL generated each time

**Frequency**:
- Navbar remounts on every route change → new signed URL
- AccountSettings opens → new signed URL
- Profile refetch → new signed URL

**Impact**: LOW
- Signed URL generation is fast (~50-100ms)
- Avatar is small file (< 1 MB enforced)
- But adds to network request count

---

### Avatar Preview (Upload Flow)

**Location**: [components/AccountSettings.tsx:89-100](components/AccountSettings.tsx:89-100)

```typescript
const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  // Revoke previous preview URL
  if (avatarPreview && avatarPreview.startsWith('blob:')) {
    URL.revokeObjectURL(avatarPreview);
  }

  // Create preview
  const previewUrl = URL.createObjectURL(file);
  setAvatarPreview(previewUrl);
  // ...
};
```

✅ **Uses blob URLs for local preview** (instant, no upload)  
✅ **Proper cleanup** (URL.revokeObjectURL on unmount and replacement)

**Cleanup**: [components/AccountSettings.tsx:81-87](components/AccountSettings.tsx:81-87)

```typescript
useEffect(() => {
  return () => {
    if (avatarPreview && avatarPreview.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreview);
    }
  };
}, [avatarPreview]);
```

✅ **EXCELLENT pattern** - No memory leaks from blob URLs

---

## Audio Assets Analysis

### Database Schema

**audio_url column exists**: [supabase/migrations/20260730184631_initial_vertical_slice_schema.sql:204](supabase/migrations/20260730184631_initial_vertical_slice_schema.sql:204)

```sql
CREATE TABLE public.vocabularies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ...
  audio_url text,
  -- ...
);
```

✅ **Column created in schema**

**Service Layer**: [services/vocabularyService.ts:41, 110, 197, 300-301](services/vocabularyService.ts)

```typescript
// SELECT includes audio_url
.select('id, topic_id, user_id, word, phonetic_uk, phonetic_us, part_of_speech, meaning, example, example_translation, synonyms, collocations, audio_url, note, created_at, updated_at')

// INSERT accepts audio_url
audio_url: payload.audio_url?.trim() || null,

// UPDATE accepts audio_url
if (updates.audio_url !== undefined) {
  updatePayload.audio_url = updates.audio_url.trim() || null;
}
```

✅ **Service layer supports audio_url CRUD**

---

### Audio Playback Implementation

**Search Results**:
```bash
grep -r "new Audio\(|HTMLAudioElement|\.play\(\)|audioRef|audioElement" app components
# Result: No matches found (only in .claude skills)
```

❌ **No audio playback implemented in UI**  
❌ **No <audio> elements in components**  
❌ **No audio player controls**  
❌ **audio_url column fetched but never rendered**

**Assessment**: **Database field unused** - Feature planned but not implemented

**Performance Impact**: NONE (no audio assets loaded)

---

## Browser Cache Analysis

### HTTP Cache Headers

**Next.js Configuration**: [next.config.ts](next.config.ts)

```typescript
const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos', // Placeholder only
      },
    ],
  },
  // No explicit cache headers configured
};
```

❌ **No custom cache headers in next.config.ts**  
✅ **Relies on Next.js production defaults**

**Next.js Default Cache Headers** (production build):
- Static assets (`/_next/static/*`): `Cache-Control: public, max-age=31536000, immutable`
- Images (next/image): `Cache-Control: public, max-age=60, s-maxage=31536000, stale-while-revalidate`
- API routes: No caching by default
- SSR pages: No caching by default (can use revalidate)

**Assessment**: Acceptable for application type (no custom static assets)

---

### Service Worker / PWA

**Search Results**:
```bash
find . -name "service-worker.js" -o -name "sw.js" -o -name "manifest.json"
# Result: No files found
```

❌ **No service worker implemented**  
❌ **No PWA manifest**  
❌ **No offline support**  
❌ **No background sync**

**Assessment**: Not a PWA - relies on browser cache only

---

## Next.js Router Cache

### App Router Caching Behavior

**Next.js 15 App Router defaults**:
- Client-side navigation caches RSC payload
- Cache duration: 30 seconds (default staleTimes)
- Router.refresh() forces cache invalidation
- Route changes preserve cache for 5 minutes

**Application Behavior**:
- All routes are Client Components (`'use client'`)
- No Server Components with cache configuration
- No `revalidate` or `fetchCache` directives found
- All data fetched client-side via Supabase

**Assessment**: Router cache not heavily utilized (client-side data fetching pattern)

---

## Supabase Client Caching

### Client Singleton Pattern

**Location**: [lib/supabase/client.ts](lib/supabase/client.ts)

```typescript
import { createBrowserClient } from '@supabase/ssr';
import { supabaseEnv } from './env';

export function createClient() {
  return createBrowserClient(
    supabaseEnv.url,
    supabaseEnv.anonKey
  );
}
```

**Supabase Client Behavior**:
- `createBrowserClient` returns **singleton instance** per URL+key combo
- Session cached in memory and cookies
- No explicit query result caching
- All queries hit database (no local cache layer)

**Usage Pattern in Application**:
```typescript
const supabase = createClient(); // Gets singleton
const { data } = await supabase.from('vocabularies').select('*');
// No caching - every call queries database
```

❌ **No query result caching layer** (e.g., React Query, SWR)  
✅ **Session caching works correctly** (auth.getUser() fast after first call)  
❌ **Every refreshAppData() queries database** (no stale-while-revalidate)

**Assessment**: Relies on database performance, no client-side cache

---

## State Management Caching

### React State Patterns

**Count of useState/useEffect**:
```bash
grep -r "useEffect\|useState" app/app/page.tsx components/Dashboard.tsx components/FlashcardMode.tsx | wc -l
# Result: 81 occurrences
```

**Pattern**: Heavy reliance on local component state

**Caching Behavior**:
- State persists during component lifetime
- State lost on unmount (e.g., Navbar remount loses profile)
- No state persistence library (Zustand, Redux, Jotai)
- No query cache (React Query, SWR)

**refreshAppData() pattern**:
```typescript
const refreshAppData = useCallback(async () => {
  const [fetchedCols, fetchedTopics, fetchedVocab, fetchedStats, fetchedMetrics, fetchedWeek] = 
    await Promise.all([
      getCollections(),
      getTopics(),
      getVocabByTopic('all'),
      getStudyStats(),
      getDashboardMetrics(),
      getWeekActivity(),
    ]);
  
  setCollections(fetchedCols);
  setTopics(fetchedTopics);
  setVocabularies(fetchedVocab);
  setStats(fetchedStats);
  setDashboardMetrics(fetchedMetrics);
  setWeekActivity(fetchedWeek);
}, []);
```

❌ **No cache invalidation strategy** - Always fetches fresh data  
❌ **No optimistic updates** - Waits for server confirmation  
❌ **No background refetch** - Only refetches on mutation

---

## localStorage / sessionStorage Usage

**Search Results**:
```bash
grep -r "localStorage\|sessionStorage" --include="*.ts" --include="*.tsx" lib services components
```

**Found**:
- `lib/session/storage.ts` - Flashcard session persistence
- User-scoped keys (includes user_id to prevent cross-user leakage)

✅ **localStorage used correctly for session continuity**  
✅ **User-scoped keys prevent data leakage** (Phase 2C fix)  
✅ **Cleared on logout/user switch**

**Not used for**:
- API response caching
- Query result caching
- Profile caching
- Vocabulary data caching

---

## Avatar Caching Deep Dive

### Current Flow

**User navigates from /app to /app/account**:
1. Navbar remounts (no app/app/layout.tsx)
2. Navbar useEffect fires (pathname dependency)
3. Calls `getCurrentProfile()` → auth check + profile query
4. Profile has `avatar_path: "user-id/avatar.jpg"`
5. Calls `getAvatarDisplayUrl(avatar_path)` → signed URL generation
6. Returns signed URL (expires in 1 hour)
7. Sets `profile` state with `avatarUrl: "https://...signedUrl"`
8. Renders `<img src={profile.avatarUrl} />`

**On every navigation**: Steps 1-8 repeat

**Optimization Opportunities**:
1. Add app/app/layout.tsx → Navbar doesn't remount → profile cached
2. Cache signed URL in memory (valid for 1 hour) → skip regeneration
3. Use next/image → automatic optimization and caching
4. Preload avatar on initial load → instant display on navigation

---

## Root Causes Summary

### RC18: Avatar Uses Native <img>, Not next/image (P2)
**Pattern**: Avatar rendered with native <img> tag, no optimization  
**Impact**: No automatic resize, format conversion, or lazy loading  
**Location**: [components/Navbar.tsx:164-168](components/Navbar.tsx:164-168), [components/AccountSettings.tsx](components/AccountSettings.tsx)  
**Severity**: LOW - Avatar is small UI element, not LCP candidate

### RC19: Signed URL Regenerated on Every Profile Load (P2)
**Pattern**: getAvatarDisplayUrl() called on every profile fetch  
**Impact**: Unnecessary signed URL generation (fast, but wasteful)  
**Location**: [services/profileService.ts:91-92](services/profileService.ts:91-92)  
**Severity**: LOW - Adds ~50-100ms per profile load, compounded by Navbar remount (RC4)

### RC20: No Query Result Caching Layer (P1)
**Pattern**: Every refreshAppData() queries database, no stale-while-revalidate  
**Impact**: Cannot show cached data while refetching fresh data  
**Location**: All service functions  
**Severity**: MEDIUM - User waits for every mutation to complete before seeing UI update

### RC21: No HTTP Cache Headers for API Routes (P2)
**Pattern**: Relies on Next.js defaults, no custom cache configuration  
**Impact**: Minimal (no static assets to cache)  
**Location**: next.config.ts  
**Severity**: LOW - Application is dynamic, caching would need careful invalidation

---

## Performance Impact Assessment

### Current Cache Behavior

**What IS Cached**:
- ✅ Supabase auth session (memory + cookies)
- ✅ Static Next.js assets (`/_next/static/*` - 1 year)
- ✅ Lucide icons (bundled JS, no external requests)
- ✅ localStorage flashcard sessions

**What IS NOT Cached**:
- ❌ Query results (vocabularies, topics, collections)
- ❌ Profile data (refetched on every Navbar remount)
- ❌ Avatar signed URLs (regenerated on every profile load)
- ❌ Dashboard metrics (refetched after every mutation)

### Cache Miss Costs

**Profile Load** (on navigation):
- Auth check: ~10ms (cached session)
- Profile query: ~50-100ms
- Signed URL generation: ~50-100ms
- **Total**: ~100-200ms per navigation

**Full App Refresh** (after mutation):
- 6 parallel queries: ~200-500ms
- No cached data shown while loading
- User sees loading spinner for full duration

**Comparison**:
- With cache: Show stale data (0ms) → fetch fresh (background) → update
- Without cache: Show spinner → fetch (200-500ms) → show data

---

## Optimization Opportunities

### High-Value Optimizations

1. **Add React Query / SWR** (addresses RC20)
   - Cache query results with stale-while-revalidate
   - Show cached data immediately, refetch in background
   - Automatic cache invalidation on mutation
   - Estimated impact: 200-500ms faster perceived load time

2. **Fix Navbar Remount** (addresses RC4 from Phase 6)
   - Add app/app/layout.tsx to prevent Navbar remount
   - Profile loaded once, cached for entire session
   - Estimated impact: Eliminates 100-200ms on every navigation

3. **Cache Signed URLs** (addresses RC19)
   - Store signed URL in memory with expiry timestamp
   - Regenerate only when expired (after 50 minutes, before 1 hour)
   - Estimated impact: 50-100ms saved per navigation

### Low-Priority Optimizations

4. **Migrate to next/image** (addresses RC18)
   - Automatic image optimization and caching
   - Minimal impact (avatar is small, not LCP)
   - Estimated impact: 10-20ms faster avatar load

5. **Implement Audio Playback** (future feature)
   - Currently no performance impact (feature unused)
   - When implemented: preload audio, cache in memory
   - Use Web Audio API for better control

---

## Classification

**CONFIRMED**: 4 findings (native img tag, signed URL regeneration, no query cache, no custom cache headers)  
**EXCELLENT**: 4 patterns (no LCP images, blob URL cleanup, client singleton, no static assets)

**Priority Distribution**:
- P0 (Critical): 0 findings
- P1 (High): 1 finding (no query result caching layer)
- P2 (Medium): 3 findings (native img, signed URL regen, no HTTP cache headers)

---

## Next Steps

**Phase 13**: UX Performance Audit
- Audit loading states (spinners, skeletons, placeholders)
- Check for optimistic updates
- Verify error handling UX
- Assess perceived performance vs actual performance

**Phase 14**: Add Instrumentation
- Add console.time markers to key paths
- Measure actual timing for login, delete Section, navigation
- Verify Phase 6-12 findings with real data

**Phase 15**: Manual Testing
- Execute test scenarios with timing measurements
- Confirm duplicate request counts
- Validate performance bottlenecks

---

**End of Phase 11-12**
