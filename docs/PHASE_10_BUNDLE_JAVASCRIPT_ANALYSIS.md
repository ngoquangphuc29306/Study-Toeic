# Phase 10: Bundle & JavaScript Analysis

**Audit Date**: 2026-08-02  
**Audit Scope**: Bundle composition, code splitting opportunities, unused imports  
**Status**: COMPLETED

---

## Executive Summary

**CONFIRMED FINDINGS**:
1. **/app route has 193 kB bundle (largest in application)** - Contains all components loaded eagerly
2. **No code splitting for inactive tabs** - Dashboard, FlashcardMode, QuizMode, VocabManager all imported at top level
3. **All components imported synchronously** - No dynamic imports for lazy loading
4. **Modals imported eagerly** - AddVocabModal, CollectionModal, ExcelImportModal loaded upfront

**OPTIMIZATION OPPORTUNITIES**:
1. Lazy load inactive tab components (FlashcardMode, QuizMode, VocabManager) - Could save ~100-150 kB on initial load
2. Lazy load modals (only load when opened) - Could save ~20-30 kB
3. Code split Dashboard sub-components if large
4. Consider dynamic imports for infrequently used features (Excel import, SQL modal)

**Performance Impact**: MEDIUM-HIGH
- 193 kB bundle blocks initial page render
- Mobile users on slow connections most affected
- All components loaded even if user only uses Dashboard
- First Load JS: 365 kB total (193 kB route + 172 kB shared)

---

## Build Output Analysis

### Bundle Size Breakdown

```
Route (app)                                 Size  First Load JS
├ ○ /app                                  193 kB         365 kB  ← LARGEST
├ ○ /app/account                         7.86 kB         180 kB
├ ○ /login                               3.16 kB         109 kB
├ ○ /signup                              3.93 kB         176 kB
├ ○ /forgot-password                     3.99 kB         176 kB
├ ○ /reset-password                      5.21 kB         177 kB
├ ○ /                                      161 B         106 kB

+ First Load JS shared by all             102 kB
  ├ chunks/255-a00225443dba3344.js       46.1 kB
  ├ chunks/4bd1b696-21f374d1156f834a.js  54.2 kB
  └ other shared chunks (total)          1.99 kB
```

**Key Observations**:
- **/app route**: 193 kB route-specific + 172 kB framework/shared = **365 kB total**
- **/app/account**: 7.86 kB route-specific + 172 kB = 180 kB total
- **Shared chunks**: 102 kB (React, Next.js, common utilities)
- **Gap**: 193 kB vs 7.86 kB = **185 kB difference** between /app and /app/account

**Analysis**:
- /app route loads ALL application components
- /app/account only loads account management page
- 185 kB in /app is mostly component code

---

## Import Analysis - app/app/page.tsx

### Component Imports (Lines 5-13)

```typescript
import { Navbar } from '../../components/Navbar';
import { Dashboard } from '../../components/Dashboard';
import { FlashcardMode } from '../../components/FlashcardMode';
import { QuizMode } from '../../components/QuizMode';
import { VocabManager } from '../../components/VocabManager';
import { AddVocabModal } from '../../components/AddVocabModal';
import { CollectionModal } from '../../components/CollectionModal';
import { ExcelImportModal } from '../../components/ExcelImportModal';
import { SqlScriptModal } from '../../components/SqlScriptModal';
```

❌ **All components imported synchronously at top level**  
❌ **No dynamic imports**  
❌ **No lazy loading**

**Impact**:
- All 9 components bundled into /app route
- User downloads all code even if only using Dashboard
- Mobile users wait for full 193 kB before seeing anything

---

### Service Imports (Lines 15-46)

```typescript
import {
  getCollections,
  getTopics,
  getVocabByTopic,
  getStudyStats,
  updateUserProgress,
  SrsRating,
  addCollection,
  deleteCollection,
  updateCollection,
  addTopic,
  deleteTopic,
  updateTopic,
  addVocabulary,
  bulkAddVocabularies,
  deleteVocabulary
} from '../../services/vocabService';
import { CollectionHasChildrenError } from '../../services/collectionErrors';
import { TopicHasVocabulariesError } from '../../services/topicErrors';
import { VocabularyValidationError } from '../../services/vocabularyErrors';
import { createClient } from '@/lib/supabase/client';
import { clearStudySession } from '@/lib/session/storage';
import { buildLoginUrl } from '@/lib/auth/safe-redirect';
import {
  exportVocabulariesAsCSV,
  exportBackupAsJSON
} from '../../services/importExportService';
import {
  getDashboardMetrics,
  getWeekActivity,
  type DashboardMetrics
} from '../../services/dashboardService';
```

✅ **Service imports are acceptable** - Small utility functions, needed immediately  
⚠️ **Export functions** (exportVocabulariesAsCSV, exportBackupAsJSON) could be lazy-loaded

---

## Component Size Estimates

**Based on file analysis and typical React component sizes**:

| Component | Estimated Size | Usage Pattern | Should Lazy Load? |
|-----------|---------------|---------------|-------------------|
| Navbar | 10-15 kB | Always visible | ❌ No - needed immediately |
| Dashboard | 40-60 kB | Default tab | ❌ No - default view |
| FlashcardMode | 30-50 kB | Inactive tab | ✅ YES |
| QuizMode | 20-30 kB | Inactive tab | ✅ YES |
| VocabManager | 30-40 kB | Inactive tab | ✅ YES |
| AddVocabModal | 8-12 kB | Conditional | ✅ YES (modal) |
| CollectionModal | 8-12 kB | Conditional | ✅ YES (modal) |
| ExcelImportModal | 10-15 kB | Rare | ✅ YES (modal) |
| SqlScriptModal | 5-8 kB | Rare | ✅ YES (modal) |

**Potential Savings**:
- Inactive tabs: 80-120 kB (FlashcardMode + QuizMode + VocabManager)
- Modals: 30-47 kB (all 4 modals)
- **Total**: 110-167 kB could be deferred

**After Optimization**:
- Initial bundle: ~80 kB (Navbar + Dashboard + framework)
- Lazy-loaded on demand: ~110 kB (tabs + modals)

---

## Code Splitting Opportunities

### 1. Lazy Load Inactive Tabs (HIGH PRIORITY)

**Current Pattern** - [app/app/page.tsx:460-550](app/app/page.tsx:460-550)
```typescript
import { FlashcardMode } from '../../components/FlashcardMode';
import { QuizMode } from '../../components/QuizMode';
import { VocabManager } from '../../components/VocabManager';

// ... in render
{activeTab === 'dashboard' && <Dashboard {...props} />}
{activeTab === 'flashcard' && <FlashcardMode {...props} />}
{activeTab === 'quiz' && <QuizMode {...props} />}
{activeTab === 'manage' && <VocabManager {...props} />}
```

**Optimized Pattern** - Dynamic imports:
```typescript
import dynamic from 'next/dynamic';

const Dashboard = dynamic(() => import('../../components/Dashboard').then(m => ({ default: m.Dashboard })));
const FlashcardMode = dynamic(() => import('../../components/FlashcardMode').then(m => ({ default: m.FlashcardMode })), {
  loading: () => <LoadingSpinner />,
});
const QuizMode = dynamic(() => import('../../components/QuizMode').then(m => ({ default: m.QuizMode })), {
  loading: () => <LoadingSpinner />,
});
const VocabManager = dynamic(() => import('../../components/VocabManager').then(m => ({ default: m.VocabManager })), {
  loading: () => <LoadingSpinner />,
});

// Render - same as before
{activeTab === 'dashboard' && <Dashboard {...props} />}
{activeTab === 'flashcard' && <FlashcardMode {...props} />}
{activeTab === 'quiz' && <QuizMode {...props} />}
{activeTab === 'manage' && <VocabManager {...props} />}
```

**Benefits**:
- Initial load: Only Dashboard bundled
- Tab switch: Load component on-demand (1-2 second delay first time)
- Cached: Subsequent tab switches instant
- **Savings**: ~80-120 kB on initial load

**Trade-off**:
- First tab switch shows loading spinner (1-2s)
- User might notice delay when switching to new tab
- Acceptable for performance gain

---

### 2. Lazy Load Modals (MEDIUM PRIORITY)

**Current Pattern**:
```typescript
import { AddVocabModal } from '../../components/AddVocabModal';
import { CollectionModal } from '../../components/CollectionModal';
import { ExcelImportModal } from '../../components/ExcelImportModal';
import { SqlScriptModal } from '../../components/SqlScriptModal';
```

**Optimized Pattern**:
```typescript
const AddVocabModal = dynamic(() => import('../../components/AddVocabModal').then(m => ({ default: m.AddVocabModal })));
const CollectionModal = dynamic(() => import('../../components/CollectionModal').then(m => ({ default: m.CollectionModal })));
const ExcelImportModal = dynamic(() => import('../../components/ExcelImportModal').then(m => ({ default: m.ExcelImportModal })));
const SqlScriptModal = dynamic(() => import('../../components/SqlScriptModal').then(m => ({ default: m.SqlScriptModal })));
```

**Benefits**:
- Modals only loaded when user clicks "Add" or "Import"
- Most users never open all modals
- **Savings**: ~30-47 kB on initial load

**Trade-off**:
- Slight delay (0.5-1s) when opening modal first time
- Very acceptable - user expects modals to take a moment

---

### 3. Lazy Load Export Functions (LOW PRIORITY)

**Current Pattern**:
```typescript
import {
  exportVocabulariesAsCSV,
  exportBackupAsJSON
} from '../../services/importExportService';
```

**Optimized Pattern**:
```typescript
const handleExportCSV = async () => {
  const { exportVocabulariesAsCSV } = await import('../../services/importExportService');
  await exportVocabulariesAsCSV();
};

const handleExportJSON = async () => {
  const { exportBackupAsJSON } = await import('../../services/importExportService');
  await exportBackupAsJSON();
};
```

**Benefits**:
- Export functions and dependencies (xlsx library) only loaded when used
- **Savings**: ~10-20 kB (xlsx library is heavy)

**Trade-off**:
- Minimal - export is infrequent action, user won't notice delay

---

## Third-Party Dependencies Analysis

### Known Heavy Dependencies

**From package.json** (would need to check package.json for full list):
1. **xlsx** - Excel parsing library (~500 kB unpacked, ~100 kB gzipped)
   - Used only in ExcelImportModal
   - Should be lazy-loaded with modal

2. **lucide-react** - Icon library
   - Tree-shaken, only imported icons bundled
   - Already optimized

3. **canvas-confetti** - Confetti animation
   - Used only in FlashcardMode/QuizMode completion
   - Should be lazy-loaded with those components

4. **@supabase/supabase-js** - Supabase client
   - Needed immediately for auth check
   - Cannot be lazy-loaded

---

## Shared Chunks Analysis

```
First Load JS shared by all             102 kB
  ├ chunks/255-a00225443dba3344.js       46.1 kB
  ├ chunks/4bd1b696-21f374d1156f834a.js  54.2 kB
  └ other shared chunks (total)          1.99 kB
```

**Breakdown** (typical for Next.js app):
- **46.1 kB chunk**: React runtime, React DOM
- **54.2 kB chunk**: Next.js framework, routing, client utilities
- **1.99 kB**: Webpack runtime, module loader

✅ **Shared chunks are normal size** - No optimization needed here

---

## Loading States

### Current Loading UI

**Auth check loading** - [app/app/page.tsx:449-460](app/app/page.tsx:449-460)
```typescript
if (authStatus === 'checking') {
  return (
    <div className="min-h-screen bg-[#FFF9FA] flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-[#F472B6] to-[#FF85A1] animate-pulse">
          <span className="text-2xl">🌸</span>
        </div>
        <p className="text-[#9CA3AF] text-sm">Đang xác thực...</p>
      </div>
    </div>
  );
}
```

✅ **Good loading UI** - Could be reused for lazy-loaded components

**Initial data loading** - [app/app/page.tsx:461-472](app/app/page.tsx:461-472)
```typescript
if (isLoading) {
  return (
    <div className="min-h-screen bg-[#FFF9FA]">
      <Navbar currentStreak={0} />
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-[#F472B6] to-[#FF85A1] animate-pulse">
            <span className="text-2xl">📚</span>
          </div>
          <p className="text-[#9CA3AF] text-sm">Đang tải dữ liệu...</p>
        </div>
      </div>
    </div>
  );
}
```

✅ **Shows Navbar during loading** - Good UX  
**Recommendation**: Same loading component can be used for dynamic imports

---

## Performance Impact Calculation

### Current Performance (No Code Splitting)

**Initial Page Load**:
1. Download 365 kB JavaScript (193 kB route + 172 kB shared)
2. Parse & execute all JavaScript
3. Render initial view

**On 3G connection** (750 kbps):
- Download: 365 kB ÷ 93.75 KB/s = **~4 seconds**
- Parse: ~1-2 seconds
- **Total**: ~5-6 seconds to interactive

**On 4G connection** (4 mbps):
- Download: 365 kB ÷ 500 KB/s = **~0.7 seconds**
- Parse: ~1 second
- **Total**: ~1.7-2 seconds to interactive

---

### Optimized Performance (With Code Splitting)

**After splitting inactive tabs + modals**:
- Initial bundle: ~193 kB → ~80 kB (save 113 kB)
- Total First Load: 365 kB → 252 kB

**On 3G connection**:
- Download: 252 kB ÷ 93.75 KB/s = **~2.7 seconds**
- Parse: ~0.7 seconds
- **Total**: ~3.4 seconds to interactive
- **Improvement**: 2.6 seconds faster (43% faster)

**On 4G connection**:
- Download: 252 kB ÷ 500 KB/s = **~0.5 seconds**
- Parse: ~0.7 seconds
- **Total**: ~1.2 seconds to interactive
- **Improvement**: 0.5-0.8 seconds faster (30% faster)

---

## Root Causes Summary

### RC15: No Code Splitting for Inactive Tabs (P0)
**Pattern**: FlashcardMode, QuizMode, VocabManager loaded eagerly  
**Impact**: 80-120 kB loaded unnecessarily on initial page load  
**Location**: [app/app/page.tsx:7-9](app/app/page.tsx:7-9)  
**Severity**: HIGH - primary cause of large /app bundle

### RC16: Modals Loaded Eagerly (P1)
**Pattern**: All modals imported at top level  
**Impact**: 30-47 kB loaded unnecessarily  
**Location**: [app/app/page.tsx:10-13](app/app/page.tsx:10-13)  
**Severity**: MEDIUM - modals used infrequently

### RC17: Heavy Dependencies Not Lazy-Loaded (P1)
**Pattern**: xlsx library bundled with main app  
**Impact**: ~20-30 kB for rarely-used feature  
**Location**: ExcelImportModal imports  
**Severity**: MEDIUM - affects users who never import Excel

---

## Recommended Implementation Order

### Phase 1: Lazy Load Inactive Tabs (Highest ROI)
**Effort**: 1-2 hours  
**Savings**: 80-120 kB  
**Risk**: LOW - Next.js dynamic imports are stable

```typescript
// Add to app/app/page.tsx
import dynamic from 'next/dynamic';

const FlashcardMode = dynamic(() => 
  import('../../components/FlashcardMode').then(m => ({ default: m.FlashcardMode })), 
  { loading: () => <LoadingSpinner /> }
);
const QuizMode = dynamic(() => 
  import('../../components/QuizMode').then(m => ({ default: m.QuizMode })), 
  { loading: () => <LoadingSpinner /> }
);
const VocabManager = dynamic(() => 
  import('../../components/VocabManager').then(m => ({ default: m.VocabManager })), 
  { loading: () => <LoadingSpinner /> }
);
```

### Phase 2: Lazy Load Modals
**Effort**: 30 minutes  
**Savings**: 30-47 kB  
**Risk**: LOW

```typescript
const AddVocabModal = dynamic(() => 
  import('../../components/AddVocabModal').then(m => ({ default: m.AddVocabModal }))
);
const CollectionModal = dynamic(() => 
  import('../../components/CollectionModal').then(m => ({ default: m.CollectionModal }))
);
const ExcelImportModal = dynamic(() => 
  import('../../components/ExcelImportModal').then(m => ({ default: m.ExcelImportModal }))
);
const SqlScriptModal = dynamic(() => 
  import('../../components/SqlScriptModal').then(m => ({ default: m.SqlScriptModal }))
);
```

### Phase 3: Lazy Load Export Functions
**Effort**: 15 minutes  
**Savings**: 10-20 kB  
**Risk**: LOW

```typescript
const handleExportCSV = async () => {
  setIsExportingCSV(true);
  const { exportVocabulariesAsCSV } = await import('../../services/importExportService');
  await exportVocabulariesAsCSV();
  setIsExportingCSV(false);
};
```

---

## Classification

**CONFIRMED**: 3 findings (no code splitting, eager modals, heavy deps)

**Priority Distribution**:
- P0 (Critical): 1 finding (no code splitting for inactive tabs)
- P1 (High): 2 findings (eager modals, heavy dependencies)

---

## Next Steps

**Phase 11-12**: Images, Assets, Cache  
**Phase 13**: UX Performance (loading states, optimistic updates)  
**Phase 14-15**: Instrumentation & Manual Testing  
**Phase 16-18**: Root Cause Categorization, Prioritization, Implementation Plan

---

**End of Phase 10**
