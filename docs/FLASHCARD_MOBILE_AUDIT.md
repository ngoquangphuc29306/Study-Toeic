# Flashcard Mobile Audit — Phase 9.9C

**Date**: 2026-08-01  
**Issue**: Flashcard mobile responsive layout problems  
**Status**: Audit in progress

---

## 1. Component Structure Analysis

### Main Container (line 840)
```tsx
<div className="max-w-3xl mx-auto space-y-5 pb-12">
```

**Current mobile styling**:
- `max-w-3xl` — 768px max width, appropriate for desktop
- `space-y-5` — 20px vertical gap between sections
- `pb-12` — 48px bottom padding
- No responsive adjustments for padding/spacing

**Issues**:
- No horizontal padding specified — relies on parent
- Bottom padding may be excessive on mobile
- Gap between sections not optimized for mobile

---

## 2. Top Header Navigation (lines 842-863)

### Back Button + Badges Layout
```tsx
<div className="flex items-center justify-between gap-4">
  <button className="... px-4 py-2 rounded-2xl ...">
    <ArrowLeft className="w-4 h-4" />
    <span>Dashboard</span>
  </button>
  
  <div className="flex flex-wrap items-center gap-2">
    <span className="... px-3 py-2 ...">Status Badge</span>
    <span className="... px-3.5 py-2 ...">Topic Badge</span>
  </div>
</div>
```

**320px viewport analysis**:
- Back button: ~100px width (icon + text + padding)
- Status badge: Variable (~120-180px depending on text)
- Topic badge: Variable (~150-200px)
- Total potential width: 370-480px
- **Risk**: Badges may wrap on 320px, creating 2-line header

**Problems**:
- `gap-4` (16px) may be too large on mobile
- Badge text not abbreviated (e.g., "🌟 Từ mới (5)" could be "🌟 Mới (5)")
- `flex-wrap` allows wrapping but creates uneven layout

**Touch targets**:
- Back button: 44px height ✅
- Badges: Read-only (not interactive) ✅

---

## 3. Mode Step Progress Bar (lines 866-889)

### Step Indicator
```tsx
<div className="flex items-center justify-center gap-1.5 sm:gap-3 p-2 rounded-2xl...">
  {modeSteps.map((step, idx) => (
    <div className="... px-3.5 py-2 rounded-xl text-xs...">
      {step.icon}
      <span>{step.label}</span>
    </div>
  ))}
</div>
```

**4 steps**: Flashcard | Trắc nghiệm | Gõ từ | Phát âm

**320px viewport analysis**:
- Container: 320px - 16px (p-2 × 2) = 304px
- 4 badges with gaps: 304px - (1.5px × 3 gaps = 4.5px) = ~299.5px
- Per badge: 299.5px / 4 = ~75px width
- Each badge needs: Icon (14px) + gap (8px) + text (40-60px) + padding (14px × 2) = 76-96px
- **Result**: Very tight, text may wrap or be cut off

**Problems**:
- Step labels may be too long on mobile
- "Trắc nghiệm" (9 characters) wider than "Flashcard" (9 characters)
- "Phát âm" (7 characters) fits better
- `overflow-x-auto` present but may create horizontal scroll
- Gap reduces from `gap-3` (12px) to `gap-1.5` (6px) on mobile ✅ (good)

**Potential fix**:
- Abbreviate labels on mobile: "Card", "Quiz", "Type", "Speak"
- Or use icon-only on mobile with tooltip

---

## 4. Main Study Card Container (lines 892-1375)

### Card Wrapper
```tsx
<div className="bg-white rounded-[32px] border-2 border-[#FCE7F3] p-6 sm:p-8 shadow-xs relative space-y-6">
```

**Current mobile styling**:
- `rounded-[32px]` — 32px radius (not responsive)
- `p-6 sm:p-8` — 24px padding mobile, 32px desktop ✅ (good)
- `space-y-6` — 24px internal vertical gap (not responsive)

**Issues**:
- Border radius could be smaller on mobile (20px)
- Internal spacing (`space-y-6`) not optimized for mobile
- No min-height or max-height constraints

---

## 5. Card Top Action Icons (lines 895-960)

### Icon Row
```tsx
<div className="flex items-center justify-between gap-2">
  <div className="flex items-center gap-2">
    <span>Topic title</span>
    <span>Status badge</span>
  </div>
  <div className="flex items-center gap-2">
    {/* 4 icon buttons: Check, Trash, Settings, Report */}
  </div>
</div>
```

**Icon buttons**: 4 buttons, each `p-2` with `w-4 h-4` icon
- Button size: 8px (p-2 × 2) + 16px (icon) + 2px (border) = 26px × 26px
- Total right section: (26px × 4) + (8px × 3 gaps) = 104px + 24px = 128px

**320px viewport**:
- Left section needs ~100-140px for topic + status
- Right section needs 128px
- Total: 228-268px (fits ✅)

**Touch target concern**:
- 26px × 26px is below 44px recommendation
- **Mitigation**: These are secondary actions, acceptable size

---

## 6. Flashcard Mode (lines 963-1097)

### Front Side Word Display
```tsx
<h2 className="text-3xl sm:text-5xl font-black text-gray-900 tracking-tight">
  {currentVocab.word}
</h2>
```

**Mobile size**: `text-3xl` = 30px (1.875rem)
**Desktop size**: `text-5xl` = 48px (3rem)

**Issues**:
- Very long words may wrap awkwardly
- No `break-words` or `hyphens` specified

### Pronunciation Buttons
```tsx
<button className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl ... text-xs...">
  <Volume2 className="w-3.5 h-3.5" />
  <span>UK / {currentVocab.phonetic_uk} /</span>
</button>
```

**Size**: ~80-120px width per button
**320px viewport**: 2 buttons = 160-240px + gap = 160-250px ✅ Fits

**Touch target**:
- Height: 12px (py-1.5 × 2) + ~14px (text) = 26px
- Width: ~80-120px
- **Below 44px height** — acceptable for secondary action

### Card Height
```tsx
<div className="relative w-full min-h-[300px] sm:min-h-[320px] [perspective:1000px]...">
```

**Mobile**: `min-h-[300px]` — 300px minimum height
**Desktop**: `min-h-[320px]` — 320px minimum height

**Problems**:
- Fixed min-height may cause issues with very short or very long content
- 300px on 640px viewport = 47% of screen height
- Combined with Navbar (108px from Phase 9.9A) = 408px / 640px = 64%

### Back Side Content
```tsx
<div className="... p-6 sm:p-8 ... overflow-y-auto">
```

**Has `overflow-y-auto`** ✅ Good — allows scrolling for long content

**Content elements**:
- Meaning heading: `text-2xl sm:text-3xl` (24px → 30px) ✅ Responsive
- Example box: `p-3.5 rounded-2xl` — Good size
- Collocations/Synonyms badges: `text-[11px]` — Small but readable

**No major issues** — back side is well-structured

---

## 7. Quiz Mode (lines 1100-1180)

### Word + Phonetic Display
```tsx
<h2 className="text-2xl sm:text-3xl font-black text-gray-900">
  {currentVocab.word}
</h2>
```

**Mobile**: 24px (good for quiz context)

### Quiz Options (4 choices)
```tsx
<div className="grid grid-cols-1 gap-2.5">
  <button className="w-full p-3.5 rounded-2xl ... text-xs sm:text-sm...">
```

**Layout**: Single column (stacked) ✅ Good
**Padding**: `p-3.5` (14px) — Adequate
**Text**: `text-xs sm:text-sm` — Responsive ✅

**Touch target**:
- Height: 14px (p-3.5 × 2) + ~16px (text) + ~16px (number badge) = 46px ✅

**No major issues** — quiz layout is mobile-friendly

---

## 8. Typing Mode (lines 1184-1264)

### Input Field
```tsx
<input
  type="text"
  className="w-full p-3.5 pr-12 ... text-sm font-bold..."
/>
```

**Mobile considerations**:
- `text-sm` = 14px font size
- **⚠️ Safari auto-zoom risk**: iOS Safari zooms in on inputs with font-size < 16px
- **Recommended**: Use `text-base` (16px) on mobile to prevent zoom

**Padding**: `p-3.5` (14px) — Good touch target
**Height**: 14px (p-3.5 × 2) + 16px (text) + 4px (border) = 48px ✅

### Hint Button (Lightbulb icon)
```tsx
<button className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 ...">
  <Lightbulb className="w-4 h-4" />
</button>
```

**Size**: 6px (p-1.5 × 2) + 16px (icon) = 22px × 22px
**Touch target**: Below 44px — acceptable (secondary action)

---

## 9. Pronounce Mode (lines 1268-1372)

### Record Button (Large circular button)
```tsx
<button className="w-20 h-20 mx-auto rounded-full bg-[#0284C7]...">
  <Mic className="w-8 h-8" />
</button>
```

**Size**: 80px × 80px ✅ Excellent touch target

**No issues** — pronounce mode is well-designed for mobile

---

## 10. Rating Buttons Section (lines 1377-1487)

### Initial 2 Buttons ("Đã thuộc" / "Chưa nhớ")
```tsx
<div className="grid grid-cols-2 gap-3">
  <button className="py-3.5 px-4 ... text-xs sm:text-sm...">
```

**320px viewport**:
- Container: 320px - 48px (card padding) = 272px
- Gap: 12px
- Per button: (272px - 12px) / 2 = 130px width

**Touch target**:
- Height: 14px (py-3.5 × 2) + ~16px (text) + ~8px (icon) = 38px
- Width: 130px
- **Height slightly below 44px** — close but acceptable

### 4 Rating Buttons (After "Đã thuộc")
```tsx
<div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
  <button className="p-3.5 ... text-xs flex flex-col...">
    <span>Học lại</span>
    <span className="text-[10px]">Sau 5 thẻ</span>
  </button>
```

**Mobile layout**: 2×2 grid (Already implemented ✅)
**Desktop layout**: 1×4 row

**320px viewport (2×2 grid)**:
- Container: 272px
- Gap: 10px (2.5px × 1 gap vertical, × 1 gap horizontal)
- Per button: (272px - 10px) / 2 = 131px width
- Height: 14px (p-3.5 × 2) + ~14px (label) + ~10px (subtitle) + 2px (gap) = 40px

**Touch target**:
- Width: 131px ✅
- Height: 40px (close to 44px, acceptable)

**Content**:
- Label: "Học lại", "Khó", "Tốt", "Dễ" (4-8 characters) ✅ Fits
- Subtitle: Time intervals (e.g., "Sau 5 thẻ", "6 giờ", "24 giờ", "3 ngày")
- `text-[10px]` — Very small but readable for secondary info

**⚠️ Potential Issue**: Subtitle text may be cut off or wrap on 320px
- "Sau 5 thẻ" = ~50px width
- "3 ngày" = ~35px width
- Button width: 131px
- Should fit, but tight ✅

---

## 11. Bottom Progress Section (lines 1490-1509)

### Mode Counter
```tsx
<p className="text-xs font-bold text-gray-500">
  Chế độ {subMode === 'flashcard' ? '1' : ...}/4: {subMode === 'flashcard' ? 'Flashcard' : ...}
</p>
```

**Text**: "Chế độ 1/4: Flashcard" (~150px width)
**320px viewport**: Fits comfortably ✅

### Session Stats
```tsx
<div className="flex items-center justify-center gap-6 text-xs font-bold">
  <div>{activeVocabs.length} Từ mới</div>
  <div>{sessionStats.mastered} Đã học</div>
  <div>{sessionStats.needsReview} Ôn tập</div>
</div>
```

**3 stats with `gap-6` (24px)**:
- Each stat: ~60-80px
- Total: 180-240px + (24px × 2 gaps) = 228-288px
- **320px viewport**: May be tight, but should fit

**Potential issue**: Large numbers (e.g., "123 Từ mới") may wrap

---

## 12. Settings Modal (lines 1512-1651)

### Modal Container
```tsx
<div className="relative w-full max-w-sm bg-white ... rounded-[28px] ... p-6...">
```

**max-w-sm**: 384px (24rem)
**320px viewport**: Modal width = 320px - 32px (p-4 outer) = 288px ✅

**Content**: 5 toggle switches + 1 dropdown
**Height**: ~400px (fits most mobile viewports)

**No major issues** — modal is appropriately sized

---

## 13. Report Modal (lines 1654-1690)

### Modal Container
```tsx
<div className="relative w-full max-w-md bg-white rounded-[28px] ... p-6...">
```

**max-w-md**: 448px (28rem)
**320px viewport**: Modal width = 288px ✅

**No major issues** — modal is appropriately sized

---

## 14. Horizontal Scroll Risks

### Potential overflow points:

1. **Top header badges** (line 852-861)
   - Status + Topic badges may exceed 320px
   - Has `flex-wrap` — wraps instead of scrolls ✅

2. **Mode step progress** (line 866)
   - Has `overflow-x-auto` ✅
   - 4 badges may require horizontal scroll on 320px
   - **Risk level**: Medium (may need label abbreviation)

3. **Flashcard word display** (line 986)
   - Long words may overflow
   - No `break-words` specified
   - **Risk level**: Medium

4. **Pronunciation buttons** (line 997-1023)
   - 2 buttons with IPA text
   - Has `flex-wrap` via parent
   - **Risk level**: Low ✅

5. **Rating buttons** (line 1435)
   - 2×2 grid on mobile
   - Fixed layout, no overflow
   - **Risk level**: None ✅

---

## 15. Vertical Space Usage

### Total mobile viewport usage (640px height example):

1. **Navbar** (Phase 9.9A): 108px
2. **Top header**: ~60px (back button + badges, may be 2 lines)
3. **Mode progress bar**: ~48px
4. **Main card**: Variable (300px min-height for flashcard)
5. **Rating buttons**: ~120px (2 buttons + 4 rating buttons when revealed)
6. **Bottom stats**: ~60px
7. **Gaps**: 20px × gaps between sections
8. **Bottom padding**: 48px

**Estimated total**: 108 + 60 + 48 + 300 + 120 + 60 + 100 (gaps) + 48 = **844px**
**640px viewport**: Requires scrolling ✅ Expected behavior

**Critical issue**: Flashcard `min-h-[300px]` is reasonable, but combined with Navbar and other elements, takes significant viewport

---

## 16. Touch Target Analysis

### Interactive elements:

**Meeting 44px minimum**:
- ✅ Back button: ~44px height
- ✅ Quiz option buttons: ~46px height
- ✅ Typing input: ~48px height
- ✅ Pronounce record button: 80px × 80px
- ✅ "Đã thuộc" / "Chưa nhớ" buttons: ~38px height (close)
- ✅ Rating buttons (2×2): ~40px height (close)

**Below 44px (acceptable for secondary actions)**:
- ⚠️ Top action icons (check/trash/settings/report): 26px × 26px
- ⚠️ Pronunciation buttons: ~26px height
- ⚠️ Typing hint button: 22px × 22px
- ⚠️ Settings toggle switches: 24px height (standard toggle)

**Verdict**: Primary actions meet guidelines, secondary actions are acceptably sized

---

## 17. Typography Scaling

### Text sizes used:

**Headings**:
- Flashcard word: `text-3xl sm:text-5xl` (30px → 48px) ✅ Responsive
- Quiz word: `text-2xl sm:text-3xl` (24px → 30px) ✅ Responsive
- Meaning: `text-2xl sm:text-3xl` (24px → 30px) ✅ Responsive

**Body text**:
- Quiz options: `text-xs sm:text-sm` (12px → 14px) ✅ Responsive
- Button labels: `text-xs sm:text-sm` (12px → 14px) ✅ Responsive
- Stats: `text-xs` (12px) — Not responsive, but acceptable for small text

**Micro text**:
- Rating subtitles: `text-[10px]` (10px) — Very small but readable
- Shortcut hints: `text-[11px]` (11px) — Small but acceptable

**Issue**: Typing input uses `text-sm` (14px) which triggers Safari zoom on iOS
- **Fix needed**: Change to `text-base` (16px) on mobile

---

## 18. Animation Performance

### Animations found:

1. **Card flip** (line 974-981): `transition-transform duration-500 [transform-style:preserve-3d]`
   - 3D transform on card flip
   - **Concern**: May be janky on low-end mobile devices

2. **Fade-in** (line 1101, 1185, 1269, 1425): `animate-fadeIn`
   - Simple opacity transition
   - **Performance**: Good ✅

3. **Bounce** (line 765): `animate-bounce`
   - Completion award icon
   - **Performance**: Good ✅

4. **Pulse** (line 1027, 1304): `animate-pulse`
   - Flip instruction, recording indicator
   - **Performance**: Good ✅

5. **Spin** (line 1399): `animate-spin`
   - Loading indicator
   - **Performance**: Good ✅

6. **Hover scale** (lines 1004, 1017, 1057, 1283): `hover:scale-105`
   - Multiple buttons
   - **On mobile**: Touch doesn't trigger hover, these are desktop-only ✅

**Verdict**: No critical performance issues. Card flip may need testing on older devices.

---

## 19. Keyboard Shortcuts (lines 641-693)

### Active shortcuts:
- `Space`: Flip flashcard
- `Tab`: Show rating buttons
- `Enter`: Submit typing / progress to next exercise
- `1-4`: Select quiz option

**Mobile behavior**:
- Hardware keyboard: Works ✅
- Software keyboard: `Enter` works, others not accessible
- **No conflict** with mobile usage

**Shortcut hints displayed**:
- Line 1178: "1 · 2 · 3 · 4 để chọn"
- Line 1262: "Enter để kiểm tra"
- Line 1485: Long hint text about "Đã thuộc" and "Chưa nhớ"

**Issue**: Hint text on line 1485 is very long (133 characters)
- May wrap to multiple lines on mobile
- **Recommendation**: Abbreviate or remove on mobile

---

## 20. Fixed Height Issues

### Elements with fixed/min heights:

1. **Flashcard container**: `min-h-[300px] sm:min-h-[320px]`
   - **Concern**: Forces 300px even for short content
   - **Verdict**: Reasonable minimum for card flip experience

2. **No max-height constraints** on card
   - Long content can expand card indefinitely
   - Back side has `overflow-y-auto` ✅
   - **Verdict**: Acceptable

3. **No viewport-based heights** (e.g., `min-h-screen`)
   - Good — avoids mobile browser chrome issues ✅

---

## Summary of Root Causes

### Critical Issues

1. **Typing input font size too small** (14px)
   - Triggers Safari auto-zoom on iOS
   - **Fix**: Change to 16px on mobile

2. **Mode step labels too long for 320px**
   - "Trắc nghiệm", "Flashcard", "Gõ từ", "Phát âm" with icons = 75-96px each
   - **Fix**: Abbreviate labels on mobile or use icon-only

3. **Top header badges may wrap awkwardly**
   - Status + Topic badges with long text
   - **Fix**: Abbreviate badge text on mobile

4. **Flashcard word may overflow**
   - No `break-words` or wrapping control for very long words
   - **Fix**: Add `break-words` utility

5. **Long hint text may wrap** (line 1485)
   - 133 characters of explanatory text
   - **Fix**: Abbreviate or hide on mobile

### Minor Issues

6. **Card border radius not responsive** (32px on mobile)
   - Could be reduced to 20px for consistency with Phase 9.9B
   - **Fix**: `rounded-[20px] sm:rounded-[32px]`

7. **Bottom padding excessive** (48px)
   - Could be reduced on mobile
   - **Fix**: `pb-8 sm:pb-12`

8. **Internal card spacing not responsive** (`space-y-6`)
   - 24px gap may be reduced on mobile
   - **Fix**: `space-y-4 sm:space-y-6`

9. **Page container spacing** (`space-y-5`)
   - Already reasonable, could be optimized
   - **Fix**: `space-y-4 sm:space-y-5`

10. **Top action icons small touch targets** (26px)
    - Below 44px recommendation
    - **Verdict**: Acceptable for secondary actions, but could increase to 32px

### No Issues

11. **Rating button layout** ✅
    - Already uses 2×2 grid on mobile
    - Good implementation

12. **Quiz layout** ✅
    - Single column, adequate spacing
    - Good touch targets

13. **Pronounce mode** ✅
    - Large record button (80px)
    - Well-designed for mobile

14. **Modals** ✅
    - Appropriate sizing for 320px
    - No overflow issues

15. **Session persistence** ✅
    - Logic preserved, no layout dependencies

---

## Recommended Fix Priority

### High Priority
1. Fix typing input font size (Safari zoom prevention)
2. Abbreviate mode step labels on mobile
3. Add `break-words` to flashcard word display
4. Abbreviate top header badge text on mobile

### Medium Priority
5. Make card border radius responsive
6. Reduce bottom padding on mobile
7. Optimize internal spacing (card, page container)
8. Abbreviate long hint text on mobile

### Low Priority
9. Increase top action icon sizes (26px → 32px) if space allows
10. Fine-tune rating button subtitle spacing

---

**Audit Complete** ✅  
**Next**: Implement responsive fixes
