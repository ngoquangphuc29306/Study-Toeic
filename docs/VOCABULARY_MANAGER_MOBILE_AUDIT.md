# Vocabulary Manager Mobile Audit

**Date**: 2026-08-01  
**Component**: VocabManager.tsx  
**Target Viewports**: 320px - 1440px

---

## 1. Files Audited

### Primary Component
- **components/VocabManager.tsx** (963 lines)
  - Main vocabulary management interface
  - Collections, topics/sections, vocabulary list
  - CRUD operations
  - Excel import integration
  - Search and filter functionality

### Related Components (Already Optimized in Previous Phases)
- **components/AddVocabModal.tsx** ✅ Phase 9.9F
- **components/CollectionModal.tsx** ✅ Phase 9.9F
- **components/ExcelImportModal.tsx** ✅ Phase 9.9F

### Files Referenced (No Changes Needed)
- **lib/types.ts** - Data types
- **services/vocabService.ts** - Business logic

---

## 2. Component Architecture

### Current Structure
```
VocabManager
├── Top Bar Header (line 189-312)
│   ├── Stats badges (Collections, Topics, Vocabularies)
│   └── "+ Tạo mới" dropdown (Create actions)
├── Collections List (line 314-682)
│   ├── Collection Header Row
│   │   ├── Title + Privacy badge + Meta stats
│   │   └── Collection "..." menu
│   └── Topic/Section Cards Grid (grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4)
│       ├── Section card
│       │   ├── Category badge + "..." menu
│       │   ├── Title + Progress
│       │   └── Action bar ("Quản lý..." + "Vào học")
│       └── "+ Thêm học phần" card
├── Unassigned Topics (line 588-681)
└── Modals (line 684-959)
    ├── "Xem danh sách từ" modal with table
    ├── Rename Collection modal
    └── Rename Topic modal
```

---

## 3. Layout Issues Identified

### 3.1 Top Bar Header (line 189-312)
**Current State**:
```tsx
<div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
```

**Issues**:
- ✅ **No major issues** - Already responsive
- Stats badges wrap correctly with `flex-wrap`
- "+ Tạo mới" button positioned correctly
- Gap spacing appropriate

**Status**: ✅ No changes needed

### 3.2 Stats Badges (line 193-217)
**Current State**:
```tsx
<div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
```

**Issues**:
- ✅ Already uses `flex-wrap`
- ✅ Appropriate padding (`px-4 py-2`)
- ✅ Text size appropriate (`text-xs`)
- ✅ Count badges styled correctly

**Status**: ✅ No changes needed

### 3.3 "+ Tạo mới" Dropdown (line 220-311)
**Current State**:
- Button: `px-5 py-2.5` (adequate touch target)
- Dropdown: `w-56` (fixed width)

**Issues**:
- ❌ **Minor**: Dropdown `w-56` (224px) may be tight on 320px viewport
- ✅ Positioned correctly (`absolute right-0`)
- ✅ Text size readable (`text-xs`)

**Recommendation**: Change `w-56` to `w-56 max-w-[calc(100vw-2rem)]` to prevent overflow on very small screens

### 3.4 Collection Header Row (line 328-407)
**Current State**:
```tsx
<div className="flex items-center justify-between">
  <div className="flex items-center gap-3">
    <h3 className="text-lg sm:text-xl font-extrabold">...</h3>
    <span>Privacy badge</span>
    <span className="hidden sm:inline-block">Meta stats</span>
  </div>
  <div>... menu button</div>
</div>
```

**Issues**:
- ✅ Title responsive (`text-lg sm:text-xl`)
- ✅ Meta stats hidden on mobile (`hidden sm:inline-block`)
- ❌ **Long collection names may wrap awkwardly** - need `min-w-0` and `truncate` handling

**Recommendation**: Add `min-w-0` to parent flex, allow title to truncate if needed

### 3.5 Topic/Section Cards Grid (line 410-583)
**Current State**:
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
```

**Issues**:
- ✅ **Excellent responsive grid** - Already optimized
- ✅ 1 column mobile, scales to 2/3/4 on larger screens
- ✅ Gap appropriate (`gap-4`)
- ✅ Cards have proper structure

**Status**: ✅ No changes needed to grid

### 3.6 Individual Section Card (line 418-566)
**Current State**:
- Padding: `p-5` (20px - adequate)
- Border radius: `rounded-2xl` (16px - good)
- Flex layout: `flex flex-col justify-between space-y-4`

**Issues**:
- ✅ Card structure sound
- ✅ Touch targets adequate
- ❌ **Topic title truncation missing** - long titles may wrap excessively
- ❌ **Action bar may stack awkwardly** on very narrow cards

**Recommendations**:
1. Add `line-clamp-2` to topic title
2. Ensure action buttons maintain readable size

### 3.7 Action Buttons in Section Card (line 494-564)
**Current State**:
- "Quản lý..." button with dropdown
- "Vào học" button (flex-1)

**Issues**:
- ✅ Good flex layout
- ✅ Touch targets adequate (`px-3 py-2` and `px-4 py-2`)
- ✅ Icons sized correctly (`w-3.5 h-3.5` and `w-4 h-4`)
- ❌ **"Quản lý..." dropdown positioned `bottom-11`** - may be cut off on small cards

**Recommendation**: Change dropdown position to `top-11` or use auto-positioning

---

## 4. "Xem danh sách từ" Modal Issues (line 684-853)

### 4.1 Modal Container
**Current State**:
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
  <div className="relative w-full max-w-4xl max-h-[90vh] bg-white ... p-6">
```

**Issues**:
- ❌ **Missing responsive padding** - `p-4` everywhere (should be `p-3 sm:p-4`)
- ❌ **Modal `p-6` too large on mobile** - should be `p-4 sm:p-6`
- ❌ **Missing `dvh`** - should use `max-h-[90dvh]` instead of `max-h-[90vh]`
- ❌ **Missing responsive border radius** - `rounded-[32px]` may be too large mobile
- ❌ **Missing ARIA attributes** - needs `role="dialog"`, `aria-modal`, `aria-labelledby`
- ❌ **No backdrop click handler**
- ❌ **No ESC key handler**

**Critical**: This is the MAIN mobile responsive issue in VocabManager

### 4.2 Modal Header (line 689-721)
**Current State**:
- Title: `text-xl` (20px - good)
- Actions: "+ Thêm Từ Vựng" button + Close button

**Issues**:
- ❌ **Header may wrap awkwardly** on mobile
- ❌ **Close button touch target small** (`p-2` - 32px total with 20px icon)
- ✅ Title size appropriate

**Recommendations**:
1. Make header flex-col on mobile, flex-row on desktop
2. Increase close button to `p-2.5 sm:p-2`
3. Add `aria-label` to close button

### 4.3 Modal Search Bar (line 723-733)
**Current State**:
```tsx
<input className="w-full pl-10 pr-4 py-2.5 ... text-xs" />
```

**Issues**:
- ✅ Full width - good
- ✅ Adequate padding
- ❌ **Font size `text-xs` (12px) triggers Safari auto-zoom on mobile**

**Critical**: Need `text-base sm:text-xs` pattern (16px mobile, 12px desktop)

### 4.4 Vocabulary Table (line 736-839)
**Current State**:
```tsx
<div className="flex-1 overflow-y-auto ...">
  <table className="w-full text-left border-collapse text-xs">
    <thead>
      <tr>
        <th>Từ Vựng / IPA</th>
        <th>Loại Từ</th>
        <th>Nghĩa</th>
        <th>Ví Dụ & Dịch</th>
        <th>Trạng Thái</th>
        <th>Xóa</th>
      </tr>
    </thead>
```

**Critical Issues**:
- ❌ **6 columns too wide for mobile** - causes horizontal scroll
- ❌ **No `overflow-x-auto` wrapper** - table overflows modal
- ❌ **No mobile card alternative**
- ❌ **Fixed `text-xs` size** - hard to read on mobile
- ❌ **Action columns may be inaccessible** if scrolled off-screen

**This is the PRIMARY mobile issue in VocabManager**

**Strategy Decision Required**:
- Option A: Add `overflow-x-auto` wrapper with `min-width` on table (controlled scroll)
- Option B: Create mobile card layout (recommended but more work)
- Option C: Hide columns progressively on mobile with CSS

**Recommendation**: **Option A for Phase 9.9G** - Add horizontal scroll container
- Wrap table in `<div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">`
- Add `min-w-[800px]` to table
- Ensure modal doesn't scroll horizontally at page level

### 4.5 Table Cell Content (line 766-833)
**Issues**:
- ❌ **Long words may overflow cells**
- ❌ **IPA text may wrap awkwardly**
- ❌ **Example text truncation missing**
- ❌ **Delete button touch target** (`p-1.5` = ~28px) - below WCAG 44px

**Recommendations**:
1. Add `break-words` to word cell
2. Add `max-w-[200px] truncate` to example cell with tooltip
3. Increase delete button to `p-2 sm:p-1.5`

---

## 5. Native confirm() Audit

### Found 4 instances:

1. **Line 390**: Delete Collection
   ```tsx
   if (confirm(`Bạn có chắc chắn muốn xóa bộ từ vựng "${col.title}" và toàn bộ bài học bên trong?`)) {
   ```

2. **Line 468**: Delete Topic (in assigned section)
   ```tsx
   if (confirm(`Bạn có chắc chắn muốn xóa học phần "${topic.title}"?`)) {
   ```

3. **Line 648**: Delete Topic (in unassigned section)
   ```tsx
   if (confirm(`Bạn có chắc chắn muốn xóa học phần "${topic.title}"?`)) {
   ```

4. **Line 825**: Delete Vocabulary (in modal table)
   ```tsx
   if (confirm(`Xóa từ "${item.word}"?`)) {
   ```

**Status**: All use native `confirm()` - not mobile-friendly

**Decision for Phase 9.9G**:
- **Defer custom confirm modal creation** - out of scope for mobile responsive
- **Document for Phase 9.9H** - create reusable ConfirmDialog component
- Focus Phase 9.9G on layout and responsive issues only

---

## 6. Overflow Sources

### Primary Overflow Sources:
1. ✅ **Page-level container** - No horizontal overflow (has proper padding)
2. ✅ **Collection grid** - Responsive, no overflow
3. ✅ **Section cards** - Fit within grid cells
4. ❌ **"Xem danh sách từ" modal table** - CRITICAL: 6 columns cause horizontal scroll
5. ✅ **Dropdown menus** - Fixed width, positioned correctly

### Secondary Concerns:
- Long collection names - may need truncation
- Long topic titles - should use `line-clamp-2`
- Long vocabulary words - need `break-words`
- Long meanings/examples - need truncation with expand option

---

## 7. Touch Target Analysis

### Adequate (≥44px):
- ✅ "+ Tạo mới" button: `px-5 py-2.5` = ~48px height
- ✅ "Vào học" button: `px-4 py-2` = ~44px height
- ✅ Section "..." menu: `p-2` with w-4 h-4 icon = ~40px (acceptable)
- ✅ Collection "..." menu: `p-2` = ~40px (acceptable)

### Below Target (<44px):
- ❌ Delete button in modal table: `p-1.5` = ~28px
- ❌ Audio button in table: `p-1` = ~24px
- ❌ Status toggle in table: `px-2.5 py-1` = ~32px

**Recommendations**:
- Increase table action buttons to `p-2 sm:p-1.5` (larger on mobile)
- Consider larger touch targets for frequent actions

---

## 8. Accessibility Issues

### Missing ARIA:
- ❌ "Xem danh sách từ" modal - no `role="dialog"`, `aria-modal`, `aria-labelledby`
- ❌ Rename Collection modal - no ARIA attributes
- ❌ Rename Topic modal - no ARIA attributes
- ✅ Search input - has placeholder (acceptable)
- ❌ Icon-only buttons - missing `aria-label` on audio/delete buttons

### Keyboard Navigation:
- ❌ No ESC key handler for modals
- ❌ No backdrop click to close modals
- ✅ Dropdown menus close on outside click
- ✅ Focus management decent

### Screen Reader:
- ❌ Table headers need better semantic structure
- ❌ Status badges only use color - need text labels (already have text, OK)
- ✅ Form labels present in rename modals

---

## 9. Responsive Breakpoint Issues

### Current Breakpoints Used:
- `sm:` (640px) - Used extensively ✅
- `md:` (768px) - Used in header `flex-col md:flex-row` ✅
- `lg:` (1024px) - Used in grid `lg:grid-cols-3` ✅
- `xl:` (1280px) - Used in grid `xl:grid-cols-4` ✅

### Issues:
- ✅ No non-standard breakpoints (`xs:` not used)
- ✅ Breakpoints follow Tailwind standards
- ✅ Progressive enhancement used correctly

**Status**: ✅ Breakpoints well-structured

---

## 10. Performance Concerns

### Current Implementation:
- ✅ No duplicate data transformations
- ✅ React.useMemo used for collection grouping (line 124-144)
- ✅ No heavy re-renders
- ✅ No new fetch requests

**Status**: ✅ Performance acceptable

---

## 11. Priority Fixes for Phase 9.9G

### High Priority (MUST FIX):
1. **Modal table horizontal scroll** (line 736)
   - Add `overflow-x-auto` wrapper
   - Add `min-w-[800px]` to table
   - Ensure page-level no horizontal scroll

2. **Modal search input font-size** (line 731)
   - Change `text-xs` to `text-base sm:text-xs`
   - Prevent Safari auto-zoom

3. **Modal ARIA attributes** (line 686, 857, 910)
   - Add `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
   - Add ESC key handlers
   - Add backdrop click handlers

4. **Modal responsive spacing** (line 686-687)
   - Change `p-4` to `p-3 sm:p-4` on backdrop
   - Change `p-6` to `p-4 sm:p-6` on modal
   - Use `dvh` instead of `vh`

### Medium Priority (SHOULD FIX):
5. **Collection title truncation** (line 330)
   - Add `min-w-0` and `truncate` handling

6. **Topic title line clamp** (line 484)
   - Add `line-clamp-2` to prevent excessive wrapping

7. **Touch targets in modal table** (line 823-832)
   - Increase delete button size on mobile

8. **Dropdown positioning** (line 514)
   - Fix "Quản lý..." dropdown position

### Low Priority (NICE TO HAVE):
9. **Long content handling**
   - Add `break-words` to vocabulary word cells
   - Add truncation to example cells

10. **Close button consistency**
    - Ensure all close buttons have `aria-label`

---

## 12. Out of Scope (Defer to Phase 9.9H)

### Deferred Items:
1. **Custom confirm dialogs** - Create reusable ConfirmDialog component
2. **Mobile card layout for vocabulary list** - Major refactor, use scroll for now
3. **Progressive column hiding** - Complex CSS, use scroll for now
4. **Touch gesture support** - Swipe actions
5. **Virtual scrolling** - Performance optimization for large lists

---

## 13. Desktop Preservation Strategy

### Must Not Change:
- ✅ Grid layout on desktop (xl:grid-cols-4)
- ✅ Text sizes on desktop (sm: breakpoint preserves desktop sizes)
- ✅ Spacing on desktop (sm: and lg: breakpoints maintain spacing)
- ✅ Table layout on desktop (readable, full columns)
- ✅ Modal size on desktop (max-w-4xl preserved)

### Implementation Approach:
- Mobile-first classes for base mobile experience
- `sm:` and `lg:` overrides for desktop
- No desktop-only changes
- Test at 1024px, 1280px, 1440px after changes

---

## Summary

**Files to Modify**: 1 file (VocabManager.tsx)

**Critical Issues**: 3
1. Modal table horizontal overflow
2. Modal search input Safari auto-zoom
3. Missing modal accessibility attributes

**Medium Issues**: 5
- Collection/topic title truncation
- Touch targets in table
- Dropdown positioning
- Modal responsive spacing

**Deferred Issues**: 5
- Custom confirm dialogs → Phase 9.9H
- Mobile card layout → Phase 9.9H
- Progressive column hiding → Phase 9.9H

**Estimated Fixes**: ~12-15 Edit operations

**Testing Required**: 320px, 360px, 375px, 640px, 768px, 1024px, 1440px

---

**Audit Completed**: 2026-08-01
