# Dashboard Mobile Audit — Phase 9.9B

**Date**: 2026-08-01  
**Issue**: Dashboard mobile responsive layout problems  
**Status**: Audit in progress

---

## 1. Component Height Analysis

### Hero Banner (lines 265-319)
**Current mobile styling**:
- `rounded-[36px]` — Very large radius on small screens
- `p-8 sm:p-10` — 32px padding even on 320px viewport
- `text-2xl sm:text-4xl` — Heading still large on mobile
- Decorative blurs: `w-32 h-32` and `w-64 h-64` — Risk of overflow
- Quick action cards: `grid-cols-1 sm:grid-cols-3` with 3 full-width cards on mobile

**Estimated mobile height**:
- Padding top: 32px
- Eyebrow pill: ~28px
- Heading: ~32px (text-2xl)
- Description: ~40px (multi-line)
- Spacing: 12px (space-y-3)
- Quick actions (3 cards): ~156px (3 × 52px)
- Padding bottom: 32px
- **Total**: ~332px

**Problems**:
- 332px hero on 640px viewport = 52% of screen
- Combined with 108px Navbar (Phase 9.9A) = 440px / 640px = 69%
- Quick actions take 156px (3 stacked cards)
- Border radius too large for mobile
- Padding excessive on small screens

---

## 2. Padding & Spacing Issues

### Page Container (line 263)
- `space-y-8` — 32px vertical gap between sections
- `pb-12` — 48px bottom padding
- **Total wasted vertical space**: ~80px+ across entire page

### Streak Card (lines 325-390)
- `p-6` — 24px padding (not responsive)
- `rounded-[32px]` — Very large radius
- `space-y-5` — 20px internal spacing
- Weekly tracker: `gap-1.5` for 7 columns on 320px

**Width calculation for weekly tracker**:
- Container width: 320px - 48px (padding) = 272px
- 7 days with `gap-1.5` (6px × 6 = 36px)
- Each day: (272px - 36px) / 7 = ~33.7px
- Icon/text needs to fit in 33.7px width
- **Risk**: Tight fit, may clip on 320px

### Daily Goal Card (lines 393-458)
- `p-6` — 24px padding
- `rounded-[32px]` — Large radius
- Sub-cards: `grid-cols-1 sm:grid-cols-2` — Single column < 640px
- Each sub-card: `p-5` — 20px padding
- `rounded-2xl` — 16px radius on sub-cards

**Mobile layout**:
- < 640px: Two sub-cards stack vertically
- Each card: ~140px height
- Total card height: ~360px

### Mini Stat Cards (lines 734-782)
- `grid-cols-2 md:grid-cols-4` — 2 columns on mobile ✅ Good
- `p-4 sm:p-5` — Responsive padding ✅
- `rounded-[24px]` — Moderate radius
- Icon: `w-10 h-10` — Adequate size
- Text: `text-xl sm:text-2xl` — Responsive ✅

**Verdict**: Mini stat cards already well-optimized ✅

### Status Rows (lines 786-868)
- `p-5` — 20px padding (not responsive)
- `rounded-[24px]` — Large radius
- `flex-col sm:flex-row` — Stack on mobile ✅
- Button: `px-5 py-2.5` — Good touch target
- `gap-4` — 16px gap between content and button

**Mobile layout**:
- Icon + text stack above button
- Button: `self-start sm:self-auto` — Aligns left on mobile
- Each row: ~100px height on mobile
- 4 rows: ~400px total

---

## 3. Quick Action Cards Layout

**Current** (lines 282-318):
- `grid-cols-1 sm:grid-cols-3` — 3 cards stack vertically < 640px
- Each card: `p-4` with icon + text + arrow
- Estimated card height: ~52px
- **Total height**: 156px + gaps = ~172px

**Problems**:
- 3 full-width cards create tall vertical stack
- Takes significant hero banner space
- On 320px viewport, hero becomes very tall

**Options for improvement**:
1. **2-column grid on mobile**: First 2 cards side-by-side, third full width
2. **Horizontal scroll**: Single row, scroll if needed (not preferred)
3. **Compact list**: Reduce padding, make cards smaller

**Recommended**: Option 1 (2 columns for primary actions)

---

## 4. Streak Card Specific Issues

### Badge (lines 333-339)
- Long text: "🔥 Chuỗi đang hoạt động" or "❄️ Bắt đầu chuỗi ngay"
- On mobile, may wrap to two lines
- `px-3 py-1` — Adequate padding

### Streak Number Display (lines 342-356)
- `text-4xl sm:text-5xl` — Large even on mobile
- Accompanying text: `text-lg font-bold` — May compete for space
- Description paragraph: Multi-line on mobile

### Weekly Tracker (lines 359-389)
- **Critical**: 7 columns with `grid-cols-7 gap-1.5`
- Each day cell: `p-2` — 8px padding
- Icon: `w-4 h-4` — Flame icon
- Text: `text-[10px]` and `text-xs` — Very small

**320px calculation**:
- Parent padding: 24px × 2 = 48px
- Available: 320px - 48px = 272px
- Gaps: 6px × 6 = 36px
- Per cell: (272 - 36) / 7 = 33.7px width
- With `p-2` (8px × 2 = 16px), content area: 17.7px
- Flame icon: 16px (w-4)
- Label "T2/T3": ~12px width
- **Conclusion**: Very tight, but should fit

**Risk**: On exactly 320px, cells may feel cramped

---

## 5. Daily Goal Card Issues

### Header (lines 395-407)
- Heading + Settings button
- Settings icon: `w-5 h-5` — Adequate
- Should fit on one line on 320px ✅

### Sub-cards (lines 410-457)
**Ôn tập card**:
- Clickable, full interactive area
- Number display: `text-3xl sm:text-4xl` — Large
- Label: Small text
- Height: ~140px

**Từ mới card**:
- Number + progress bar
- `text-3xl sm:text-4xl` — Large
- Progress bar: `max-w-xs mx-auto` — Should fit
- Height: ~140px

**Mobile (< 640px)**:
- `grid-cols-1` — Cards stack vertically
- Total height: ~320px (2 × 140px + gap)

**360px+ viewport**:
- Could consider `grid-cols-2` starting at 360px
- Would save vertical space
- **Risk**: Text may be cramped

**Recommendation**: Keep 1 column < 640px, ensure cards not too tall

---

## 6. Mini Stat Cards Analysis

**Current** (lines 734-782):
- `grid-cols-2 md:grid-cols-4` — 2 cols mobile, 4 desktop
- Each card: ~80px height
- Padding: `p-4 sm:p-5` — Responsive
- Icon + number + label layout
- Numbers: `text-xl sm:text-2xl`

**320px layout**:
- 2 columns: (320 - 48 - 12) / 2 = 130px per card width
- Adequate for icon + number

**Verdict**: Well-optimized, no major changes needed ✅

---

## 7. Status Rows Analysis

**Layout** (lines 786-868):
- 4 rows: Due, Pending, Mastered, Difficult
- Each row: Icon + text + button
- Mobile: `flex-col sm:flex-row` — Stack on mobile
- Button: `self-start sm:self-auto` — Left-align on mobile

**Mobile behavior**:
- Icon (44px) + text stack vertically above button
- Button below, left-aligned
- Gap: 16px between elements
- Estimated height per row: ~90-100px
- **Total 4 rows**: ~380px

**Problems**:
- No significant issues
- Touch targets adequate
- Layout stacks cleanly

**Minor optimization**:
- Could reduce padding from `p-5` to `p-4 sm:p-5`
- Would save ~8px per row = 32px total

---

## 8. Detail Views Table Analysis

### Tables (lines 462-727)
**Three tables**: Pending, Mastered, Difficult

**Current approach**:
- Plain HTML `<table>` with `overflow-x-auto` wrapper
- Columns:
  - Pending: Word | Meaning | Due Time (3 cols)
  - Mastered: Word | Meaning | IPA | Date | Action (5 cols)
  - Difficult: Word | Meaning | IPA | Fail Count | Action (5 cols)

**Mobile risks**:
- 5-column tables may overflow on 320px
- Table min-width not set — relies on content
- `py-3.5 px-5` — Large cell padding

**320px viewport**:
- Container width: 320px
- With padding: ~272px available
- 5 columns: Word (80px) + Meaning (100px) + IPA (60px) + Date/Count (60px) + Action (80px) = 380px
- **Result**: Horizontal scroll required

**Current implementation**:
- Already has `overflow-x-auto` on wrapper (line 500, 575, 675)
- Tables should scroll horizontally ✅

**Problems**:
- No `min-width` on table — may collapse too much
- Cell padding large (`px-5`) — increases width
- No mobile-specific card view

**Options**:
1. **Keep table with controlled scroll** — Add `min-width` to table
2. **Switch to card list on mobile** — More code, better UX
3. **Reduce columns on mobile** — Hide IPA/Date columns

**Recommended**: Option 1 (controlled scroll with min-width)

---

## 9. Goal Settings Modal Analysis

### Modal (lines 875-968)
**Current**:
- Fixed overlay: `fixed inset-0 z-50`
- Modal container: `max-w-md` — 448px max width
- Padding: `p-6` — 24px
- Rounded: `rounded-[28px]` — Large radius

**Mobile (320px)**:
- Outer padding: `p-4` — 16px on viewport
- Modal width: 320px - 32px = 288px
- Content area: 288px - 48px (p-6) = 240px
- **Should fit** ✅

**Height concerns**:
- Header: ~60px
- Form fields: ~180px
- Actions: ~50px
- Total: ~290px
- **320px viewport height**: 568px (iPhone SE)
- Modal: 290px = 51% of viewport ✅

**Problems identified**:
- No `max-h` constraint — if content grows, may exceed viewport
- No `overflow-y-auto` — can't scroll if needed
- Mobile keyboard: May cover modal on focus

**Required fixes**:
- Add `max-h-[90dvh]` or similar
- Add `overflow-y-auto` to content area
- Ensure buttons visible when keyboard open

---

## 10. Fixed Width Elements Check

### Explicit widths found:
- Icons: `w-3`, `w-4`, `w-5`, `w-6`, `w-9`, `w-10`, `w-11`, `w-12` — Flexible ✅
- Hero blurs: `w-32 h-32`, `w-64 h-64` — Decorative, absolute positioned ✅
- Modal: `max-w-md` — Max width, not fixed ✅
- Progress bar: `max-w-xs` — Max width ✅

**No problematic fixed widths found** ✅

### Min-width checks:
- No `min-width` or `min-w-` classes found on containers
- Tables don't have explicit `min-width`
- **Action needed**: Add `min-width` to detail view tables

---

## 11. Horizontal Scroll Risks

### Potential overflow points:

1. **Weekly tracker** (line 364)
   - 7 columns with gaps on 320px
   - Calculation: Should fit, but tight
   - **Risk level**: Low

2. **Detail view tables** (lines 501, 576, 676)
   - Already wrapped in `overflow-x-auto` ✅
   - No `min-width` set on tables
   - **Risk level**: Medium (needs min-width)

3. **Status row buttons** (lines 799-804, 820-825, 841-846, 862-867)
   - Button text: "Ôn tập ngay", "Xem chi tiết", "Luyện tập"
   - With padding: ~110-130px
   - **Risk level**: Low (adequate wrapping)

4. **Quick action cards** (lines 282-318)
   - Grid layout, should wrap properly
   - **Risk level**: Low ✅

**Conclusion**: Only detail tables need attention

---

## 12. Animation & Performance

### Animations found:
- `animate-pulse` — Flame icon (line 329)
- `animate-ping` — Current day indicator (line 381)
- `animate-fadeIn` — Detail views (lines 463, 534, 634)
- `transition-all` — Multiple hover states
- `transition-colors` — Color transitions
- `transition-transform` — Arrow icons

**Performance concerns**:
- Pulse and ping are CSS animations — lightweight ✅
- `transition-all` on many elements — could be optimized
- Backdrop blur on hero: `backdrop-blur-md` (line 269) — Moderate

**Verdict**: No critical performance issues

---

## Summary of Root Causes

### Critical Issues

1. **Excessive hero height** (~332px on mobile)
   - Large padding (32px)
   - Large radius (36px)
   - 3 stacked quick action cards (156px)
   - Hero + Navbar = 440px on 640px viewport (69%)

2. **Non-responsive padding**
   - Hero: `p-8` on mobile (should be smaller)
   - Streak card: `p-6` (should be `p-4 sm:p-6`)
   - Daily goal: `p-6` (should be `p-4 sm:p-6`)
   - Status rows: `p-5` (should be `p-4 sm:p-5`)

3. **Large border radius on mobile**
   - Hero: `rounded-[36px]` (should be `rounded-[20px] sm:rounded-[36px]`)
   - Cards: `rounded-[32px]` (should be `rounded-[20px] sm:rounded-[32px]`)

4. **Weekly tracker tight on 320px**
   - 7 columns with 33.7px per cell
   - May feel cramped
   - Could reduce gap or padding slightly

5. **Detail tables lack min-width**
   - May collapse too much on mobile
   - Need `min-w-[600px]` or similar

6. **Goal modal lacks height constraint**
   - No `max-h` — could overflow on short viewports
   - No `overflow-y-auto` — can't scroll if needed

### Minor Issues

7. **Page spacing excessive**
   - `space-y-8` could be `space-y-5 sm:space-y-8`
   - Would save 12-16px per gap

8. **Status badge text may wrap**
   - "🔥 Chuỗi đang hoạt động" on small screens
   - Could abbreviate on mobile

9. **Sub-card numbers large on mobile**
   - `text-3xl sm:text-4xl` — 30px on mobile
   - Could be `text-2xl sm:text-4xl` for tighter layout

---

## Recommended Fix Priority

### High Priority
1. Reduce hero padding and radius on mobile
2. Optimize quick action cards layout (2-col on mobile)
3. Make padding responsive across all major cards
4. Add min-width to detail view tables
5. Add height constraint to goal modal

### Medium Priority
6. Reduce page-level spacing on mobile
7. Optimize weekly tracker spacing for 320px
8. Reduce border radius globally on mobile

### Low Priority
9. Abbreviate long badge text on mobile
10. Fine-tune number sizes in sub-cards

---

**Audit Complete** ✅  
**Next**: Implement responsive fixes
