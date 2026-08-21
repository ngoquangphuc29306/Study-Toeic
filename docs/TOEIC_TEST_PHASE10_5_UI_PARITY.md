# TOEIC Test Phase 10.5 - UI parity reconstruction

## Audit baseline

Prototype is the visual and interaction source of truth. Production retains its
server-authoritative attempt, autosave, submission, media, learning-content,
history, vocabulary and annotation boundaries. This phase changes presentation
and UI composition only.

## Screen reconstruction inventory

| Screen | Prototype region/control | Production equivalent before reconstruction | Visual mismatch | Behavior mismatch | Action |
| --- | --- | --- | --- | --- | --- |
| Catalog | Hero, Study/Progress tabs, year pills, four-column test cards | `ToeicTestCatalogPage` | Generic page header and three-column card grid | Filters are text inputs rather than prototype selection model | Recompose catalog around prototype hero, tabs, filter pills, card toolbar and cards |
| Start | Catalog mode/Part dialog | `ToeicTestOverviewPage` route | Separate overview page and broad card layout | Existing start/resume remains correct | Keep deep-link route, render its content as prototype-equivalent modal/sheet presentation |
| Workspace | Header, part bar, audio bar, split workspace, right palette, fixed footer | `ToeicAttemptWorkspace` | Simplified sticky header, always-visible aside and native audio controls | Palette lacks filters; no prototype toolbar composition | Rebuild shell around existing state/actions and keep all RPC paths unchanged |
| Practice feedback | Feedback/explanation directly below answers | `ToeicPracticeFeedbackPanel` | Present but not placed/styled like prototype accordion | Existing feedback contract is correct | Place feedback in prototype learning panel position without exposing data in Exam |
| Learning tools | Notes, vocabulary, annotation, dictation, flip toolbar | `ToeicLearningToolsPanel` | Separate panel rather than prototype toolbar/drawer affordance | Deferred tools need truthful disabled/loading states | Recompose tool entry points and retain current service calls |
| Submit | Center modal with answer, unanswered and flag summary | `ToeicSubmitDialog` | Similar content, different hierarchy and visual tokens | Existing focus trap and submit flow correct | Align dialog shell and summary hierarchy |
| Result | Score report composition and per-part cards | `ToeicAttemptResultPage` | Generic dashboard card arrangement | No official scaled score by design | Match composition but preserve honest no-scaled-score state |
| Review | Part navigation, answer review, learning content and vocabulary | `ToeicAttemptReviewPage` | Two-column card feed differs from prototype review workspace | Owner-only learning data is correct | Recompose review header, navigation and question panels |
| History | Card/modal history model | `ToeicAttemptHistoryPage` | Route list does not share prototype visual density | Server history source is correct | Restyle route as prototype-equivalent history panel |
| Vocabulary save | Compact modal with explicit destination | `ToeicVocabularySaveDialog` | Already structurally close | Existing explicit Collection/Section decision is intentional | Apply scoped visual tokens only |
| Notes and annotation | Drawer/panel placement | `ToeicLearningToolsPanel` and tool subcomponents | Functional but visually detached from workspace header | Persistence is correct | Embed as contextual tool drawer, never localStorage authority |

## Prototype token inventory

| Token | Prototype value / rule | Production scope |
| --- | --- | --- |
| Canvas | `#FFF9FA` / pale pink | TOEIC page root only |
| Surface | white | cards, bars, dialogs |
| Primary | pink 500/600 (`#F472B6`, `#EC4899`) | primary actions and active states |
| Ink | slate 900 and muted slate 500/600 | content hierarchy |
| Border | pink 100/200 (`#FCE7F3`, `#FBCFE8`) | surfaces and separators |
| Radius | 12px controls, 16px cards, 24px panels | `rounded-xl`, `rounded-2xl`, `rounded-3xl` |
| Shadows | subtle pink-tinted control/card elevation | hover and dialog elevation only |
| Spacing | 4px base, 8/12/16/20/24px clusters | workspace density |
| Header | 56px desktop shell, 44px Part bar, 56px footer | CBT desktop layout |
| Palette | 320px desktop right drawer | desktop, overlay sheet on mobile |
| Breakpoints | single-column below 768px, shell split at 1024px | responsive mapping |

## Control mapping

| Prototype control | Production action/boundary | UI treatment |
| --- | --- | --- |
| Exam / Practice | `startToeicAttempt` | mode selector, preserving Exam all-part validation |
| Part selection | existing selectedParts state | grouped Listening/Reading selectable cards |
| Resume | `getActiveToeicAttempt` | explicit resume card/CTA |
| Audio play, mute, speed, seek | signed media URL and browser audio | styled toolbar; controls disabled where product policy requires |
| Question palette filters | in-memory session answer state | all, answered, unanswered, flagged filters; no correctness pre-submit |
| A-D, keyboard and flag | existing autosave controller | unchanged mutation semantics |
| Practice check | `checkToeicPracticeAnswer` | exact feedback placement after answer area |
| Submit | autosave flush then server submit | existing idempotent flow in prototype-style dialog |
| Notes / annotations / lookup / dictation / flip | Phase 10 services | contextual workspace tool panel, truthful capability state |

## Intentional differences

- Correct answers, explanations, transcript and translation stay absent before the
  corresponding server-authorized Practice feedback or post-submit Review read.
- Score display uses server result totals only. The prototype's approximate 10-990
  score remains intentionally absent.
- Media continues through the private bucket signing route.
- Notes, attempts, answers, history and annotations remain server-backed. No
  prototype localStorage authority is carried into production.
- Exam pause and listening navigation/seek rules remain product-policy-driven;
  disabled presentation is preferable to fake behavior.

## Responsive and accessibility acceptance baseline

- Verify 1440, 1280, 1024, 768, 390 and 360px layouts.
- Preserve keyboard A-D/1-4, arrows and flag shortcut behavior.
- Keep dialogs focus-trapped and Escape-dismissible where allowed.
- Keep visible focus, 44px touch targets for icon controls and non-color state
  labels.
- Keep animation to CSS opacity/transform transitions and disable it under
  `prefers-reduced-motion`.

## Implemented reconstruction

- `ToeicTestCatalogPage` now follows the prototype hierarchy: pink hero,
  Study/Progress view switch, year pills, dense four-column card toolbar and
  explicit Exam/Practice entry points. The existing server-backed progress read
  remains the only source for counts and resume state.
- `ToeicTestOverviewPage` accepts the selected catalog mode in the URL while
  retaining its server-authoritative start and resume workflow. It does not
  create local attempt state.
- `ToeicAttemptWorkspace` now has a compact CBT header, scrollable Part bar,
  sheet-style question palette with All/Answered/Unanswered/Flagged filters,
  and the signed passage image/audio and question image/audio in their
  contextual locations. Keyboard answer/navigation/flag controls and autosave
  are unchanged.
- `ToeicMediaView` replaces browser-native controls with a compact toolbar
  using the same signed URL: play/pause, progress seek, speed, mute and an
  accessible image zoom dialog. It keeps media errors and retry visible.
- Shared `toeicPrototypeTokens.ts` scopes the prototype canvas, surface,
  border, action and focus tokens to this feature only; it does not alter the
  rest of EasyTOEIC.

## Phase 10.5 capability boundary

- Each catalog card now has the prototype-order action rail. **Ẩn tiến độ** is
  the real existing user preference and never deletes an attempt or result.
  History opens the existing history route. Wrong-question retry remains a
  real action on a selected submitted attempt in History/Result, because the
  card has no safe source-attempt contract. Test-level notes and vocabulary
  summaries are visibly unavailable rather than invented.
- The catalog mode dialog is a visual entry layer above the existing overview
  and attempt-start flow. It passes the chosen Practice Parts in the URL; the
  overview supplies them to the existing server-authoritative `startToeicAttempt`
  request. Exam continues to select all seven Parts. The displayed default
  duration comes from catalog metadata. Custom duration choices are disabled
  and no duration is sent from the browser.
- The split Practice/Exam progress composition uses only available summary
  fields (attempt count, completed Parts, active attempts and raw result
  totals). Per-Part correctness, aggregate duration, Exam count, 10--990 high
  or average score, skill aggregates and test-level vocabulary summary have
  no contract in this phase, so their visual positions show `—` and a clear
  `Chưa có dữ liệu` explanation.
- Deferred to Phase 11/12: Listening lock, audio seek/replay policy,
  auto-advance after audio, custom Exam duration, per-Part and skill aggregate
  analytics, total duration aggregates, scaled-score aggregates and vocabulary
  summary per test card. No backend, RPC, migration or schema work is included
  here.

## Interaction and verification notes

- Palette filters operate only on in-memory answer/flag state. They never
  reveal correctness, explanations or any answer key before an authorized
  Practice feedback or post-submit Review response.
- Audio controls are presentation controls on an already-authorized signed
  media URL. Playback rejection from browser policy leaves the player idle,
  rather than causing an unhandled error.
- The image zoom dialog supports click-outside, an explicit close control and
  Escape. All new icon controls have accessible labels and at least a 40px
  target; action controls retain the existing 44px minimum.
- CSS-only transitions are used. `prefers-reduced-motion` disables the
  transition effects. GSAP was reviewed but intentionally not introduced:
  the prototype does not require choreographed motion, and CSS keeps the
  production interaction path smaller and deterministic.

## Visual test constraint

The local Next development server started successfully on port 3000 during
this phase. The sandboxed in-app browser could not reach the host's localhost
endpoint, so screenshot-based verification from that browser is blocked by the
environment. Static type/lint/build verification and the final manual checklist
remain required before release; this is not a production or application error.
