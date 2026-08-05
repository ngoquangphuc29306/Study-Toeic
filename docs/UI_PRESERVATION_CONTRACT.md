# VocabTOEIC — UI Preservation Contract

**Document Version**: 2.0  
**Created**: 2026-07-30  
**Updated**: 2026-07-30  
**Status**: Official Visual Source of Truth  
**Authority**: UI hiện tại là baseline. Mọi thay đổi visual phải được product owner approve.

**IMPORTANT**: This document describes the current UI as the source of truth. Features and behaviours are marked as either:
- **Verified**: Confirmed to exist in current codebase
- **Unverified**: Documented but not confirmed in code inspection
- **Proposed**: Future additions, not currently implemented

Only preserve verified behaviours. Do not add unverified features during refactoring.

---

## 1. Declaration

**The current UI is the visual source of truth.**

Tất cả các phase refactor, migration, và feature addition PHẢI bảo tồn:
- Visual appearance
- Layout composition
- Interaction patterns
- Animation behaviors
- Responsive breakpoints
- Color palette
- Typography hierarchy
- Spacing system

**Permitted Changes**:
- ✅ Improve accessibility (ARIA labels, keyboard nav)
- ✅ Add loading states (skeleton, spinner)
- ✅ Add error states (toast, inline error)
- ✅ Fix bugs that affect UX negatively
- ✅ Internal implementation refactors (không thay đổi output)

**Prohibited Changes Without Approval**:
- ❌ Thay đổi màu sắc
- ❌ Thay đổi typography (font, size, weight)
- ❌ Thay đổi spacing/padding/margin
- ❌ Thay đổi border radius
- ❌ Thay đổi shadows
- ❌ Thay đổi layout structure
- ❌ Thay đổi labels/wording
- ❌ Xóa hoặc đổi chỗ UI elements
- ❌ Thay đổi animations

---

## 2. Design System

### 2.1. Color Palette

**Primary Pink Theme**:
```css
--primary: #F472B6        /* Pink-400 */
--primary-hover: #ec4899  /* Pink-500 */
--primary-light: #FCE7F3  /* Pink-100 */
--primary-lighter: #FFF1F2 /* Pink-50 */
--primary-gradient: linear-gradient(to right, #F472B6, #FF85A1)
```

**Neutrals**:
```css
--bg-main: #FFF9FA        /* Warm off-white */
--bg-white: #FFFFFF
--text-primary: #4A4A4A   /* Dark gray */
--text-secondary: #6B7280 /* Gray-500 */
--text-muted: #9CA3AF     /* Gray-400 */
--border-light: #FCE7F3   /* Pink-100 */
```

**Status Colors**:
```css
--status-new: #3B82F6      /* Blue-500 */
--status-learning: #F59E0B /* Amber-500 */
--status-mastered: #10B981 /* Emerald-500 */
--error: #EF4444           /* Red-500 */
--success: #10B981         /* Emerald-500 */
--warning: #F59E0B         /* Amber-500 */
```

**SRS Rating Colors**:
```css
--rating-again: #EF4444    /* Red-500 */
--rating-hard: #F59E0B     /* Amber-500 */
--rating-good: #10B981     /* Emerald-500 */
--rating-easy: #3B82F6     /* Blue-500 */
```

### 2.2. Typography

**Font Family**:
```css
font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
```

**Scale**:
```css
--text-xs: 0.75rem     /* 12px */
--text-sm: 0.875rem    /* 14px */
--text-base: 1rem      /* 16px */
--text-lg: 1.125rem    /* 18px */
--text-xl: 1.25rem     /* 20px */
--text-2xl: 1.5rem     /* 24px */
--text-3xl: 1.875rem   /* 30px */
```

**Weights**:
```css
--font-medium: 500
--font-semibold: 600
--font-bold: 700
--font-extrabold: 800
```

**Hierarchy Examples**:
- Navbar brand: `text-xl font-extrabold`
- Card headings: `text-lg font-bold`
- Body text: `text-sm font-medium`
- Captions: `text-xs font-bold`

### 2.3. Spacing System

**Base Unit**: 4px (Tailwind default)

**Common Spacing**:
```css
--space-1: 0.25rem  /* 4px */
--space-2: 0.5rem   /* 8px */
--space-3: 0.75rem  /* 12px */
--space-4: 1rem     /* 16px */
--space-6: 1.5rem   /* 24px */
--space-8: 2rem     /* 32px */
```

**Container Padding**:
- Mobile: `px-4` (16px)
- Desktop: `px-6 lg:px-8` (24px → 32px)

**Card Padding**:
- Default: `p-6` (24px)
- Compact: `p-4` (16px)

### 2.4. Border Radius

**Scale**:
```css
--radius-sm: 0.5rem    /* 8px - rounded-lg */
--radius-md: 0.75rem   /* 12px - rounded-xl */
--radius-lg: 1rem      /* 16px - rounded-2xl */
--radius-xl: 1.5rem    /* 24px - rounded-3xl */
--radius-full: 9999px  /* rounded-full - pills */
```

**Usage**:
- Cards: `rounded-2xl` (16px) hoặc `rounded-3xl` (24px)
- Buttons: `rounded-2xl` (16px) hoặc `rounded-full` (pill)
- Badges: `rounded-full`
- Icons: `rounded-xl` (12px)

### 2.5. Shadows

**Elevation**:
```css
--shadow-2xs: 0 1px 2px rgba(0,0,0,0.05)
--shadow-xs: 0 1px 3px rgba(0,0,0,0.1)
--shadow-sm: 0 2px 4px rgba(0,0,0,0.06)
--shadow-md: 0 4px 6px rgba(0,0,0,0.07)
--shadow-lg: 0 10px 15px rgba(0,0,0,0.1)
--shadow-xl: 0 20px 25px rgba(0,0,0,0.15)
--shadow-2xl: 0 25px 50px rgba(0,0,0,0.25)
```

**Glow Effects**:
```css
--glow-pink: 0 4px 12px rgba(244,114,182,0.3)
```

---

## 3. Component Inventory

### 3.1. Navbar (components/Navbar.tsx)

**Structure**:
```
Header (sticky top-0 backdrop-blur)
  ├── Brand Logo (VocabTOEIC + "Master" badge)
  ├── Navigation Tabs (Desktop: md:flex, Mobile: bottom row)
  │     ├── Tổng Quan (Home icon)
  │     ├── Luyện Flashcards (Sparkles icon)
  │     ├── Luyện từ đồng nghĩa (GitCompareArrows icon)
  │     └── Quản Lý Từ Vựng (Layers icon)
  └── Action Badges
        ├── Daily Streak (Flame icon + "{n} Ngày Streak")
        └── Mastered Count (CheckCircle2 icon + "{x}/{y} Đã thuộc")
```

**Visual Rules**:
- Background: `bg-white/90 backdrop-blur-md`
- Border: `border-b border-[#FCE7F3]`
- Height: `h-16` (64px)
- Active tab: `bg-white text-[#F472B6] shadow-2xs`
- Inactive tab: `text-gray-500 hover:text-[#F472B6]`
- Mobile nav: Fixed bottom row on `md:hidden`

**Preserved Behavior**:
- Sticky positioning
- Tab switching animation (smooth transition)
- Hover effects (color + slight bg change)
- Flame icon pulse animation for streak
- Mobile bottom navigation reveals on small screens

### 3.2. Dashboard (components/Dashboard.tsx)

**Layout**:
```
Dashboard Container
  ├── Header Section
  │     ├── Title: "Bảng Điều Khiển Học Tập"
  │     ├── Subtitle: Date + greeting
  │     └── Action Buttons (Thêm Từ, Tạo Collection)
  ├── Stats Cards Row (4 cards)
  │     ├── Từ Mới (Blue)
  │     ├── Đang Học (Amber)
  │     ├── Cần Ôn (Pink gradient, animated)
  │     └── Đã Thuộc (Emerald)
  ├── Collections Grid
  │     └── Collection Card[]
  │           ├── Icon chip
  │           ├── Title + description
  │           ├── Stats (topics, words)
  │           └── Topic List
  │                 └── Topic Card[]
  │                       ├── Icon + title
  │                       ├── Progress bar
  │                       ├── Stats pills
  │                       └── Action buttons
  └── Difficult Words Section (if any)
        └── Vocabulary Card[] (words with again_count > threshold)
```

**Visual Rules**:
- Stats cards: `rounded-3xl` border with subtle gradient backgrounds
- Animated "Cần Ôn" card: Gradient border + pulse animation
- Collection cards: White bg, `rounded-2xl`, `border-[#FCE7F3]`
- Topic cards: Nested inside collection, lighter bg `bg-[#FFF9FA]`
- Progress bars: Gradient from status color
- Hover: `hover:scale-[1.02] transition-transform`

**Preserved Interactions**:
- Click collection → expand/collapse topics
- Click "Học Ngay" → navigate to flashcard
- Click "Luyện từ đồng nghĩa" → navigate to Synonym Practice
- Click "Thêm Từ" → open AddVocabModal

### 3.3. Flashcard Mode (components/FlashcardMode.tsx)

**Structure**:
```
FlashcardMode Container
  ├── Header
  │     ├── Back button
  │     ├── Topic selector dropdown
  │     ├── Status filter (All/New/Learning/Mastered)
  │     └── Progress indicator ("{x}/{y}")
  ├── Card Display Area
  │     └── Flashcard (3D flip animation)
  │           ├── Front: Word + phonetic + audio button
  │           └── Back: Meaning + example + note
  ├── Rating Buttons (if on back side)
  │     ├── Again (Red)
  │     ├── Hard (Amber)
  │     ├── Good (Emerald)
  │     └── Easy (Blue)
  └── Navigation
        ├── Previous button
        ├── Flip button (if on front)
        └── Next button
```

**Visual Rules**:
- Card: Large centered `rounded-3xl` with shadow-xl
- Flip animation: CSS `rotateY(180deg)` with `transition-transform duration-500` and `transform-style: preserve-3d`
- Front side: Large word text (`text-3xl font-extrabold`)
- Back side: Organized sections (meaning, example, synonyms, collocations)
- Rating buttons: Full-width row, rounded-2xl, color-coded
- Button hover: `hover:scale-105 active:scale-95`

**Preserved Animations**:
- 3D card flip (preserve-3d, rotateY)
- Button press feedback (scale)
- Smooth topic switch (fade transition)
- Confetti on session complete

### 3.4. Quiz Mode (components/QuizMode.tsx)

> **Current implementation correction (2026-08-05):** The active `/app` navigation renders Synonym Practice instead of `QuizMode`. The current feature is implemented by `features/synonym-practice/` with four modes: multiple choice, matching, select all and typing. `components/QuizMode.tsx` is not the active app tab and should not be treated as the current navigation contract.

**Structure**:
```
QuizMode Container
  ├── Header (similar to Flashcard)
  ├── Quiz Question Card
  │     ├── Question number + progress
  │     ├── Prompt text (word hoặc meaning)
  │     └── Answer options (4 buttons)
  ├── Feedback (after answer)
  │     ├── Correct/Incorrect indicator
  │     ├── Explanation
  │     └── Next button
  └── Results Screen (after quiz complete)
        ├── Score percentage (large display)
        ├── Stats (correct/total)
        ├── Incorrect words list
        └── Action buttons (Redo, Back, Flashcard)
```

**Visual Rules**:
- Option buttons: Large, rounded-2xl, border-2
- Selected: Highlighted with color
- Correct: Green border + checkmark
- Incorrect: Red border + X
- Results screen: Centered card with gradient background
- Score display: Extra large text (`text-5xl font-extrabold`)

**Preserved Behavior**:
- Click option → immediate feedback
- Disabled state after answer
- Smooth transition to next question
- Confetti on high score (>80%)

### 3.5. Vocab Manager (components/VocabManager.tsx)

**Structure**:
```
VocabManager Container
  ├── Toolbar
  │     ├── Search input
  │     ├── Filter dropdown (collection, topic, status)
  │     └── Action buttons (Add, Import, SQL)
  ├── Collections List
  │     └── Collection Accordion[]
  │           ├── Collection Header (expand/collapse)
  │           ├── Collection Actions (Edit, Delete)
  │           └── Topics List
  │                 └── Topic Accordion[]
  │                       ├── Topic Header
  │                       ├── Topic Actions
  │                       └── Vocabularies Table
  │                             └── Vocabulary Row[]
  │                                   ├── Word + phonetic
  │                                   ├── Meaning
  │                                   ├── Status badge
  │                                   └── Actions (Edit, Delete, Status)
  └── Pagination (if applicable)
```

**Visual Rules**:
- Search input: Sticky top, rounded-2xl, icon prefix
- Accordion headers: Bold, with chevron icon rotation on expand
- Table: Alternating row bg (`odd:bg-white even:bg-[#FFF9FA]`)
- Status badges: Rounded-full pills, color-coded
- Action buttons: Icon-only
- Delete confirmation: Modal with warning color

**Preserved Interactions** (Verified):
- Accordion expand/collapse animation (smooth height transition)
- Hover row highlights

**Unverified** (not found in code inspection):
- ❌ Search debounce timing (300ms specific)
- ❌ Inline edit (double-click or edit button)
- ❌ Tooltip on hover for action buttons

### 3.6. Modals

**Common Structure**:
```
Modal Overlay (fixed inset-0 bg-black/40 backdrop-blur-xs)
  └── Modal Container (centered, rounded-[32px], white bg)
        ├── Header
        │     ├── Icon chip (colored background)
        │     ├── Title + subtitle
        │     └── Close button (X icon)
        ├── Content Area
        │     └── Form / Content
        └── Footer
              └── Action buttons (Cancel, Submit)
```

**Modal Types**:
1. **AddVocabModal**: Add single vocabulary
2. **CollectionModal**: Create collection or topic
3. **ExcelImportModal**: Import from Excel file
4. **SqlScriptModal**: Display SQL script for Supabase

**Visual Rules**:
- Overlay: `animate-fadeIn`
- Container: `max-w-lg` centered, `p-6 sm:p-8`
- Header icon: `w-10 h-10 rounded-2xl` trong colored background
- Tab switcher (CollectionModal): Segmented control style
- Form inputs: `rounded-2xl border-[#FCE7F3] focus:ring-2 focus:ring-[#F472B6]`
- Submit button: Primary pink gradient
- Cancel button: Gray background

**Preserved Animations**:
- Fade in overlay
- Scale up modal (from 0.95 to 1)
- Close animation (reverse)

---

## 4. Responsive Behavior

### 4.1. Breakpoints

Tailwind default:
```css
sm: 640px
md: 768px
lg: 1024px
xl: 1280px
2xl: 1536px
```

**Usage**:
- Mobile-first design
- Desktop nav shows at `md:` (768px+)
- Mobile nav shows on `md:hidden`
- Grid columns: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- Padding adjusts: `px-4 sm:px-6 lg:px-8`

### 4.2. Mobile Optimizations

**Touch Targets**:
- Minimum: `44x44px` (11rem = 44px)
- Buttons: `py-2.5 px-4` minimum
- Icon buttons: `p-3` minimum

**Stacking**:
- Stats cards: Stack vertically on mobile (`grid-cols-1`)
- Collections: Single column on mobile
- Forms: Full-width inputs on mobile

**Navigation**:
- Desktop: Horizontal tabs in navbar
- Mobile: Bottom fixed navigation row

### 4.3. Tablet (md) Behavior

**Hybrid Layout**:
- Show desktop nav (không có bottom bar)
- Stats cards: 2 columns (`sm:grid-cols-2`)
- Collections: 2 columns (`md:grid-cols-2`)
- Flashcard: Slightly smaller but still centered

---

## 5. Animation Catalog

### 5.1. Transitions

**Default Duration**: `transition-all duration-200`

**Hover Effects**:
- Scale: `hover:scale-105` (cards, buttons)
- Color: `hover:bg-[color]` (buttons, links)
- Shadow: `hover:shadow-lg` (elevated elements)

**Active/Press**:
- Scale down: `active:scale-95` (buttons)

### 5.2. Special Animations (Verified)

**Pulse** (Verified in Dashboard.tsx and FlashcardMode.tsx):
```css
animate-pulse /* Tailwind built-in */
```
- Usage: Flame icon for streak badge (Dashboard.tsx:329)
- Usage: Today marker in calendar (Dashboard.tsx:381)
- Usage: Flip card hint text (FlashcardMode.tsx:829)
- Usage: Recording button (FlashcardMode.tsx:1107)

**Bounce** (Verified in FlashcardMode.tsx):
```css
animate-bounce /* Tailwind built-in */
```
- Usage: Success icon on session complete (FlashcardMode.tsx:567)

**Fade In** (Verified in Dashboard.tsx and FlashcardMode.tsx):
```css
animate-fadeIn
```
- Usage: Modal overlays (Dashboard.tsx:876, FlashcardMode.tsx:1285, 1427)
- Usage: Detail views (Dashboard.tsx:463, 534, 634)
- Usage: Quiz submode (FlashcardMode.tsx:903)
- Usage: Typing submode (FlashcardMode.tsx:987)
- Usage: Pronounce submode (FlashcardMode.tsx:1071)
- Usage: Rating buttons reveal (FlashcardMode.tsx:1201)
- **Note**: `animate-fadeIn` is used in components but NOT defined in globals.css or Tailwind config. May rely on Tailwind default or be missing CSS definition.

**Flip Card** (Verified in FlashcardMode.tsx):
```css
.card-flip {
  transform: rotateY(180deg);
  transition: transform 0.6s cubic-bezier(0.4, 0.0, 0.2, 1);
}
```
- Implementation: `[transform:rotateY(180deg)]` with `transition-transform duration-500` (FlashcardMode.tsx:781)
- Front side: `[backface-visibility:hidden]` (default)
- Back side: `[backface-visibility:hidden] [transform:rotateY(180deg)]` (FlashcardMode.tsx:837)
- Container: `[transform-style:preserve-3d]` (FlashcardMode.tsx:780)
- Supporting utilities defined in globals.css lines 4-16

**Confetti** (Verified):
- Library: `canvas-confetti` (imported in FlashcardMode.tsx and QuizMode.tsx)
- Trigger: Quiz complete (>80%), session complete
- Duration: 3 seconds
- Colors: Pink theme (`#F472B6`, `#FCE7F3`)

**Ping** (Verified in Dashboard.tsx):
```css
animate-ping /* Tailwind built-in */
```
- Usage: Today marker in calendar (Dashboard.tsx:381)

---

## 6. Keyboard Interactions (Verified)

### 6.1. Global Shortcuts

**Flashcard Mode** (Verified from `components/FlashcardMode.tsx`):
- `Space`: Flip card (flashcard submode only)
- `Tab`: Show rating buttons
- `Enter`: Submit answer (typing mode) or mark as not remembered
- `Digit1-4`: Select quiz option A-D (quiz submode only)

**Not Verified** (not found in current code):
- ❌ Arrow keys for navigation (previous/next card)
- ❌ Escape to exit
- ❌ Number keys for rating buttons (1=Again, 2=Hard, 3=Good, 4=Easy)

**Quiz Mode**: 
- Digit1-4 verified in FlashcardMode when `subMode === 'quiz'`

**Dashboard**:
- Standard browser Tab navigation (no custom shortcuts verified)

**Note**: Only list verified keyboard shortcuts in documentation. Do not claim features exist without code evidence.

### 6.2. Focus Management

**Requirements**:
- All interactive elements focusable
- Visible focus ring: `focus:ring-2 focus:ring-[#F472B6] focus:outline-none`
- Logical tab order
- Modal trap focus (không tab ra ngoài modal)
- Restore focus on modal close

**Status**: Focus management requirements are design goals, not verified implementations. Actual focus behaviour should be tested.

---

## 7. Protected Files

**These files contain UI implementation and MUST NOT have breaking visual changes**:

### Core UI Components:
- `components/Navbar.tsx`
- `components/Dashboard.tsx`
- `components/FlashcardMode.tsx`
- `components/QuizMode.tsx`
- `components/VocabManager.tsx`

### Modals:
- `components/AddVocabModal.tsx`
- `components/CollectionModal.tsx`
- `components/ExcelImportModal.tsx`
- `components/SqlScriptModal.tsx`

### Layouts:
- `app/layout.tsx`
- `app/page.tsx`
- `app/globals.css`

### Utilities:
- `lib/utils.ts` (cn function used for className merging)

---

## 8. Permitted Internal Refactors

### 8.1. Code Organization
✅ **Allowed**:
- Extract sub-components (vẫn giữ visual output)
- Create custom hooks (không ảnh hưởng UI)
- Refactor state management (behavior unchanged)
- Add PropTypes/TypeScript types
- Optimize re-renders (React.memo, useMemo)

### 8.2. Accessibility Improvements
✅ **Allowed** (and encouraged):
- Add ARIA labels: `aria-label`, `aria-describedby`
- Add roles: `role="button"`, `role="dialog"`
- Improve semantic HTML: `<nav>`, `<main>`, `<article>`
- Add keyboard shortcuts (documented)
- Add screen reader announcements (visually hidden text)
- Improve color contrast (if current fails WCAG AA)

### 8.3. Loading & Error States
✅ **Allowed**:
- Add skeleton loaders (styled to match design system)
- Add spinners (pink theme)
- Add error toasts/banners (styled to match)
- Add empty states (với illustration hoặc icon)
- Add offline indicators

**Constraint**: Loading/error UI phải follow current design language (colors, radius, spacing).

---

## 9. Change Approval Process

### 9.1. Pre-Implementation
**Before making any visual change**:

1. Document proposed change (screenshot/mockup)
2. State rationale (UX improvement, bug fix, accessibility)
3. Show before/after comparison
4. Submit for product owner review

### 9.2. Review Criteria
Product owner evaluates:
- Does it improve UX without breaking familiarity?
- Does it align with design system?
- Is it necessary or nice-to-have?
- Does it introduce inconsistency?

### 9.3. Rejection Grounds
Automatic rejection if:
- Changes existing color palette
- Changes typography scale
- Removes existing functionality
- Breaks responsive behavior
- Lacks accessibility consideration

---

## 10. Testing Requirements

### 10.1. Visual Regression
**Before merge**:
- Take screenshots of all major views (Dashboard, Flashcard, Quiz, VocabManager)
- Compare pixel-by-pixel với baseline
- Flag any differences for review

**Tools** (future):
- Percy.io
- Chromatic
- Playwright visual comparison

### 10.2. Cross-Browser
**Minimum Support**:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Mobile Browsers**:
- Safari iOS 14+
- Chrome Android 90+

### 10.3. Responsive Testing
**Breakpoints to verify**:
- 375px (iPhone SE)
- 768px (iPad portrait)
- 1280px (Desktop)
- 1920px (Large desktop)

---

## Document Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-30 | Phase 0 | Initial UI preservation contract |
| 2.0 | 2026-07-30 | Phase 0 Correction | Added verification status (Verified/Unverified/Proposed), marked unverified keyboard shortcuts (arrow keys, escape, number keys for ratings), marked unverified VocabManager features (search debounce timing, inline edit, tooltips), verified animations from code (pulse, bounce, fadeIn, flip, confetti, ping), noted animate-fadeIn may be missing CSS definition |

**Approval**: This document is the official UI contract. Deviations require product owner sign-off.
