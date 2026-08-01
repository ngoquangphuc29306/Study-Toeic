# Modal & Form Mobile Audit — Phase 9.9F

**Date**: 2026-08-01  
**Issue**: Modal and form mobile responsive problems  
**Status**: Audit in progress

---

## Executive Summary

**Total Components Found**:
- 9 files with modals/dialogs
- 5 modals identified
- 4 forms with password/file inputs
- 3 delete confirmations (using native `confirm()`)
- 0 custom toast notifications found (no toast system implemented)

**Files Analyzed**:
1. `components/AddVocabModal.tsx` — Add/Edit vocabulary modal with tabs
2. `components/CollectionModal.tsx` — Collection/Section creation modal
3. `components/ExcelImportModal.tsx` — Excel/CSV import modal
4. `components/AccountSettings.tsx` — Account settings modal (portal-based)
5. `components/Dashboard.tsx` — Daily goal settings modal
6. `components/FlashcardMode.tsx` — Settings modal + Report modal
7. `components/VocabManager.tsx` — Native confirm dialogs for delete actions
8. Auth pages (login/signup/password) — Full page forms, not modals

---

## 1. AddVocabModal.tsx Analysis

### Current Implementation

**Line 119**: Modal wrapper
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
  <div className="relative w-full max-w-lg bg-white rounded-3xl border border-pink-100 shadow-xl overflow-hidden p-6 space-y-5 max-h-[90vh] flex flex-col">
```

**Accessibility**:
- ❌ Missing `role="dialog"`
- ❌ Missing `aria-modal="true"`
- ❌ No `aria-labelledby` for header

**Mobile Issues**:
- ⚠️ Uses `max-h-[90vh]` instead of `max-h-[90dvh]` (may not account for mobile browser chrome)
- ⚠️ `rounded-3xl` (48px) may be too large on mobile
- ✅ Has `p-4` outer padding
- ✅ Has `overflow-hidden` on wrapper
- ⚠️ Form has `overflow-y-auto pr-1` but container already scrolls

### Form Analysis

**Word Form** (lines 158-301):
- 11 input fields total
- Input font size: `text-xs` (12px) on label, inputs use default
- ⚠️ **Critical**: Inputs don't explicitly set font-size ≥16px
- ✅ All inputs have labels
- ✅ Labels use `htmlFor` (implicit, no `id` on inputs)
- ❌ Inputs missing `id` attribute for label association
- ✅ Grid layout: `grid-cols-2 gap-3` for paired fields
- ⚠️ Input padding: `p-2.5` (10px) — adequate but could be `p-3` on mobile

**Topic Form** (lines 304-367):
- 4 fields (collection select, title, description textarea, category)
- ⚠️ Same font-size issues as word form
- ✅ Textarea has `rows={2}` and `resize-none`

### Keyboard Behavior
- ✅ Forms use `onSubmit` handlers
- ✅ Submit buttons are `type="submit"`
- ❌ No ESC key handler to close modal
- ❌ Backdrop click doesn't close modal

### Touch Targets
- Submit button: `py-3 px-4` = ~48px height ✅
- Close button: `p-1.5` + icon `w-5 h-5` = ~26px ❌ (below 44px)
- Tab buttons: `py-2` + text = ~32px ⚠️ (acceptable)

### Issues Summary

**Critical**:
1. Input/textarea font-size may be < 16px (triggers Safari zoom)
2. Missing `id` on inputs for proper label association
3. Missing ARIA attributes for accessibility

**High Priority**:
4. Close button touch target too small (26px)
5. No ESC key handler
6. Uses `vh` instead of `dvh`
7. Border radius too large on mobile

**Medium Priority**:
8. Nested `overflow-y-auto` (form inside scrolling container)
9. Input padding could be larger on mobile

---

## 2. CollectionModal.tsx Analysis

### Current Implementation

**Line 114**: Modal wrapper
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
  <div className="relative w-full max-w-lg bg-white rounded-[32px] border border-[#FCE7F3] shadow-2xl p-6 sm:p-8 space-y-6">
```

**Accessibility**:
- ❌ Missing `role="dialog"`
- ❌ Missing `aria-modal="true"`
- ❌ No `aria-labelledby`

**Mobile Issues**:
- ❌ No `max-h` constraint — modal can exceed viewport height
- ❌ No `overflow-y-auto` — long content cannot scroll
- ⚠️ `rounded-[32px]` too large on mobile
- ✅ Responsive padding: `p-6 sm:p-8`

### Form Analysis

**Collection Form** (lines 150-192):
- 2 fields: title (input), description (textarea)
- ⚠️ Input padding: `p-3` (12px) — adequate
- ⚠️ Textarea: `rows={2}` — may be too short if long description
- ⚠️ Font size: `text-xs` on labels, inputs don't specify (likely 16px base ✅)
- ✅ Labels have proper text, but no `htmlFor`/`id` association
- ❌ Inputs missing `id` for label association

**Section Form** (lines 196-270):
- 4 fields: collection select (disabled), title, category, description
- ⚠️ Select is `disabled` — can't change parent collection
- ⚠️ Same label association issues

### Error Handling
- ✅ Error message displays above form: `bg-rose-50 border border-rose-200`
- ⚠️ Error may push content down, causing layout shift
- ✅ Error has `role="alert"` (implicit from content, not explicit)

### Action Buttons
- Layout: `flex justify-end gap-2`
- Cancel: `px-5 py-2.5` = ~40px height ⚠️ (close to 44px)
- Submit: `px-6 py-2.5` = ~40px height ⚠️
- ✅ Disabled state with `opacity-50`

### Keyboard Behavior
- ✅ Form `onSubmit` handlers
- ❌ No ESC key handler
- ❌ Backdrop click doesn't close

### Issues Summary

**Critical**:
1. No `max-h` or `overflow-y-auto` — can exceed viewport
2. Missing ARIA attributes

**High Priority**:
3. Missing label `id`/`htmlFor` associations
4. No ESC/backdrop close behavior
5. Error can cause layout shift

**Medium Priority**:
6. Border radius too large on mobile
7. Buttons slightly below 44px touch target

---

## 3. ExcelImportModal.tsx Analysis

### Current Implementation

**Line 153**: Modal wrapper
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
  <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-[32px] border border-[#FCE7F3] shadow-2xl overflow-hidden flex flex-col p-6 sm:p-8 space-y-5">
```

**Accessibility**:
- ❌ Missing `role="dialog"`
- ❌ Missing `aria-modal="true"`
- ❌ No `aria-labelledby`

**Mobile Issues**:
- ⚠️ Uses `vh` instead of `dvh`
- ⚠️ `max-w-4xl` (896px) — very wide, but clamped by viewport
- ⚠️ `rounded-[32px]` too large on mobile
- ✅ Has `overflow-hidden` on container
- ✅ Responsive padding: `p-6 sm:p-8`

### Form Sections

**Section 1: Target Picker** (lines 190-253):
- Grid layout: `grid-cols-1 sm:grid-cols-2` ✅
- Select dropdowns with proper padding
- ⚠️ Font size not explicitly set on selects
- ⚠️ No `id`/`htmlFor` associations
- ✅ Conditional input for new topic creation
- ⚠️ New topic input: text may be small

**Section 2: File Upload** (lines 256-280):
- ⚠️ **Critical**: Hidden file input `opacity-0` overlay pattern
- ⚠️ On mobile, "click" behavior may not work well
- ✅ Visual feedback: hover states
- ⚠️ Accept attribute: `.xlsx, .xls, .csv`
- ⚠️ No explicit file size validation in UI

**Section 3: Preview Table** (lines 283-392):
- ⚠️ **Critical**: Table with 8 columns — will require horizontal scroll on mobile
- ✅ Wrapper has `overflow-y-auto` with `max-h-[300px]`
- ❌ Table has no `min-width` — may collapse on narrow viewports
- ⚠️ Table text: `text-xs` and `text-[11px]` — very small on mobile
- ⚠️ Delete button in table: `w-3.5 h-3.5` icon with `p-1` = ~22px touch target ❌

### Touch Targets
- Download template button: `px-3.5 py-2` = ~32px height ⚠️
- Close button: `p-2` + icon `w-5 h-5` = ~30px ❌
- Cancel button: `px-5 py-2.5` = ~40px ⚠️
- Import button: `px-6 py-2.5` = ~40px ⚠️
- Table delete buttons: ~22px ❌ ❌

### File Name Display
- Line 290: `{file?.name}` — long filenames may overflow
- ⚠️ No `truncate` or `max-w` on filename display

### Issues Summary

**Critical**:
1. Table will require horizontal scroll on mobile (8 columns)
2. No `min-width` on table
3. File upload "click zone" may not work well on mobile
4. Missing ARIA attributes

**High Priority**:
5. Table delete buttons too small (22px)
6. Close button too small (30px)
7. Very small text in table (11px)
8. No ESC/backdrop close
9. Long filenames may overflow

**Medium Priority**:
10. Action buttons below 44px target
11. Border radius too large on mobile
12. No `max-h` on outer modal (relies on inner table scroll)

---

## 4. AccountSettings.tsx Analysis

### Current Implementation

**Line 244-246**: Portal modal wrapper
```tsx
<div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
  <div className="my-auto w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border border-[#FCE7F3] bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
```

**Accessibility**:
- ❌ Missing `role="dialog"`
- ❌ Missing `aria-modal="true"`
- ✅ Has `aria-label` on close button
- ✅ Has `id`/`htmlFor` on most form fields

**Mobile Features**:
- ✅ Uses `dvh` in `max-h-[calc(100dvh-2rem)]` ✅✅✅
- ✅ Backdrop click closes modal (`onClick={onClose}`)
- ✅ `stopPropagation` on inner content prevents accidental close
- ✅ Responsive item alignment: `items-start sm:items-center`
- ⚠️ `rounded-3xl` (48px) too large on mobile

### Form Analysis

**Profile Section** (lines 271-442):
- Avatar upload/remove buttons
- Display name input
- Email display (read-only)
- Created date display

**Avatar Actions**:
- Upload button: `px-3 py-2 text-xs` = ~32px ⚠️
- Remove button: `px-3 py-2 text-xs` = ~32px ⚠️
- ⚠️ Below 44px but acceptable for secondary actions

**Display Name Input** (lines 338-352):
- ✅ Has `id="displayName"` and proper `label htmlFor`
- ✅ Font size: `text-sm` (14px) ⚠️ — may trigger Safari zoom
- ⚠️ Should be `text-base sm:text-sm` (16px mobile)
- ✅ Padding: `px-4 py-2.5` — adequate

**Password Section** (lines 445-549):
- Two password inputs with show/hide toggle
- ✅ Has `id` and `label htmlFor` associations
- ⚠️ Font size: `text-sm` (14px) — **CRITICAL** triggers Safari zoom
- ⚠️ Should be `text-base sm:text-sm`
- ✅ Padding: `pl-10 pr-11 py-2.5` — adequate
- Eye toggle buttons: `right-3` icon = ~30px touch target ⚠️

**Error/Success Messages**:
- ✅ Has `role="alert"` and `role="status"`
- ✅ Has `aria-live="polite"`
- ✅ Displays below relevant sections

**Submit Buttons**:
- Save profile: `py-2.5 px-4 text-sm` = ~42px ⚠️
- Change password: `py-2.5 px-4 text-sm` = ~42px ⚠️
- ✅ Loading states with spinner
- ✅ Disabled states

**Sign Out Section**:
- Uses `<SignOutButton>` component
- Button rendered full-width

### Sticky Header
- Line 248: `sticky top-0 z-10`
- ✅ Header remains visible during scroll
- ✅ Rounded corners preserved: `rounded-t-3xl`

### Keyboard Behavior
- ✅ Forms have `onSubmit`
- ✅ `autoComplete="new-password"` on password fields
- ❌ No explicit ESC key handler (relies on backdrop click)

### Issues Summary

**Critical**:
1. Password inputs use 14px font (triggers Safari zoom)
2. Display name input uses 14px font

**High Priority**:
3. Missing `role="dialog"` and `aria-modal`
4. Eye toggle buttons 30px (below 44px)

**Medium Priority**:
5. Border radius too large on mobile (48px)
6. Avatar action buttons 32px (acceptable for secondary)
7. Submit buttons 42px (close to 44px, acceptable)

---

## 5. Dashboard.tsx — Daily Goal Modal Analysis

### Current Implementation

**Line 872**: Modal wrapper
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
  <div className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto bg-white border border-[#FCE7F3] rounded-[20px] sm:rounded-[28px] p-4 sm:p-6 space-y-4 sm:space-y-6 shadow-2xl">
```

**Accessibility**:
- ❌ Missing `role="dialog"`
- ❌ Missing `aria-modal="true"`
- ✅ Close button has `aria-label="Đóng"`
- ✅ Toggle button has `aria-label` for unlimited review

**Mobile Features**:
- ✅ Uses `dvh`: `max-h-[90dvh]` ✅✅✅
- ✅ Has `overflow-y-auto` on modal content
- ✅ Responsive border radius: `rounded-[20px] sm:rounded-[28px]` ✅
- ✅ Responsive padding: `p-4 sm:p-6`
- ✅ Responsive spacing: `space-y-4 sm:space-y-6`
- ❌ No backdrop click close
- ❌ No ESC key handler

### Form Analysis

**Field 1: Daily Goal Input** (lines 898-912):
- ✅ Has `id="daily-goal-input"` and `label htmlFor`
- Type: `type="number"` with `min={1}` `max={100}`
- ⚠️ Font size: `font-bold` but no explicit size (likely 16px ✅)
- ✅ Padding: `p-2.5 sm:p-3` — responsive
- ✅ Helper text below

**Field 2: Unlimited Review Toggle** (lines 915-947):
- ✅ Toggle button with `id="unlimited-review-toggle"`
- ✅ Label associated (implicit)
- Toggle size: `h-6 w-11` = 24px × 44px
- ⚠️ Toggle height 24px (below 44px) but width adequate for tap

**Action Buttons** (lines 951-959+):
- Cancel: `px-4 sm:px-5 py-2 sm:py-2.5` = ~36-40px ⚠️
- Save: likely same dimensions
- ✅ Responsive text: `text-xs sm:text-sm`

### Issues Summary

**High Priority**:
1. Missing `role="dialog"` and `aria-modal`
2. No backdrop click close
3. No ESC key handler

**Medium Priority**:
4. Toggle button height 24px (below 44px guideline)
5. Action buttons 36-40px (close but below 44px)

**Low Priority**:
- None — this modal is already well-optimized from Phase 9.9B

---

## 6. FlashcardMode.tsx — Settings & Report Modals Analysis

### Settings Modal (lines 1512-1651)

**Line 1512**: Modal wrapper
```tsx
<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
  <div className="relative w-full max-w-sm bg-white rounded-[28px] border-2 border-[#FCE7F3] p-6 shadow-2xl">
```

**Issues**:
- ❌ Missing `role="dialog"`, `aria-modal`
- ❌ No `max-h` constraint
- ⚠️ `max-w-sm` (384px) adequate
- ⚠️ `rounded-[28px]` could be responsive

### Report Modal (lines 1654-1690)

**Line 1654**: Modal wrapper
```tsx
<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
  <div className="relative w-full max-w-md bg-white rounded-[28px] border-2 border-[#FCE7F3] p-6 shadow-2xl">
```

**Issues**:
- ❌ Missing `role="dialog"`, `aria-modal`
- ❌ No `max-h` constraint
- ⚠️ Textarea: no explicit max-height or rows specified

---

## 7. Delete Confirmations Analysis

### Current Implementation

**VocabManager.tsx**:
- Line 390: `if (confirm(\`Bạn có chắc chắn muốn xóa bộ từ vựng "${col.title}"...\`))`
- Line 468: `if (confirm(\`Bạn có chắc chắn muốn xóa học phần "${topic.title}"?\`))`
- Line 648: Same as line 468 (duplicate)
- Line 825: `if (confirm(\`Xóa từ "${item.word}"?\`))`

**FlashcardMode.tsx**:
- Line 555: `if (window.confirm(\`Bạn có chắc chắn muốn xóa từ vựng "${currentVocab.word}"...\`))`

### Issues

**Critical**:
1. Native `confirm()` dialogs are NOT mobile-friendly
2. Cannot style or control layout
3. Text may be truncated on mobile
4. No accessibility attributes
5. Blocks entire page
6. Cannot prevent accidental confirms

**Recommendation**:
- Replace with custom confirmation modal component
- Follow same responsive patterns as other modals
- Include "Cancel" and "Delete" buttons with adequate touch targets
- Make "Delete" button visually distinct (red/danger style)
- Add `role="alertdialog"` for accessibility

---

## 8. Toast/Notification System

### Finding

**No custom toast notification system found** in the codebase.

Only instances found:
- `components/account/AccountPage.tsx` — mentions "Toast" in grep but not implemented

**Current error handling**:
- Inline error messages within modals/forms
- Alert-style messages with colored backgrounds
- No global toast/notification system

**Recommendation**:
- If toasts are added in future, ensure:
  - Fixed positioning with margins (16px from edges)
  - Max width on mobile (calc(100vw - 32px))
  - Z-index above modals if needed
  - Auto-dismiss without requiring interaction
  - `role="status"` or `role="alert"` for screen readers
  - Do not cover primary actions or navigation

---

## 9. Auth Pages (Out of Scope — Full Pages, Not Modals)

Files identified but not audited (full page forms, not modals):
- `app/login/login-form.tsx`
- `app/signup/page.tsx`
- `app/forgot-password/page.tsx`
- `app/reset-password/page.tsx`

These are full-page forms, not modal dialogs. If needed, should be audited separately under "Form page mobile optimization" task.

---

## Summary of Critical Issues

### All Modals

1. **Missing ARIA attributes** — All modals lack `role="dialog"` and `aria-modal="true"`
2. **Missing ESC key handlers** — Only AccountSettings has backdrop click close
3. **Input font-size < 16px** — AddVocabModal, CollectionModal inputs may trigger Safari zoom
4. **Password inputs 14px** — AccountSettings password fields trigger Safari zoom
5. **Missing max-height constraints** — CollectionModal, FlashcardMode modals can exceed viewport
6. **Native confirm() dialogs** — Not mobile-friendly, need custom replacement

### Touch Target Issues

7. **Close buttons too small** — Many modals: 26-30px (below 44px)
8. **Table delete buttons** — ExcelImportModal: 22px (far below 44px)
9. **Secondary buttons** — Many modals: 32-40px (acceptable but could improve)

### Mobile UX Issues

10. **Border radius too large** — Most modals use 32-48px radius on mobile
11. **vh vs dvh** — AddVocabModal, ExcelImportModal, CollectionModal use `vh` not `dvh`
12. **Table horizontal scroll** — ExcelImportModal table needs `min-width` and better mobile layout
13. **Label associations missing** — Many inputs lack `id`/`htmlFor` connections

### Layout Issues

14. **Nested overflow** — AddVocabModal has form scroll inside scrolling container
15. **Error layout shift** — CollectionModal errors push content down
16. **Long filename overflow** — ExcelImportModal filename display needs truncate

---

## Recommended Fix Priority

### Must Fix (Critical)

1. Add `role="dialog"` and `aria-modal="true"` to all modals
2. Fix password input font-size in AccountSettings (14px → 16px mobile)
3. Fix input font-sizes in AddVocabModal and CollectionModal
4. Replace native `confirm()` with custom confirmation modal
5. Add `max-h-[90dvh]` and `overflow-y-auto` to modals missing constraints

### Should Fix (High Priority)

6. Add ESC key and backdrop click handlers to all modals
7. Increase close button touch targets to 40-44px
8. Change `vh` to `dvh` in all modals
9. Make border radius responsive (20px mobile, 28-32px desktop)
10. Add `id`/`htmlFor` label associations to all form inputs
11. Fix ExcelImportModal table for mobile (min-width, smaller columns, or card view)

### Nice to Fix (Medium Priority)

12. Increase secondary button sizes closer to 44px
13. Fix nested overflow in AddVocabModal
14. Prevent error layout shift in CollectionModal
15. Add filename truncation in ExcelImportModal
16. Add `aria-labelledby` to all modal headers

---

**Audit Complete** ✅  
**Next**: Implement responsive fixes based on priority