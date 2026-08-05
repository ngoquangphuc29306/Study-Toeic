# VocabTOEIC — Documentation Index

**Version**: 1.1
**Created**: 2026-07-30  
**Updated**: 2026-08-05
**Status**: Official Documentation Index

## Current implementation snapshot

The current source of truth is the code and migrations on the active branch. The authenticated app runs at `/app` with tabs for Dashboard, Flashcard, Synonym Practice and Vocabulary Manager. Supabase owns vocabulary progress and review logs; the browser uses `sessionStorage` only for bounded study-session and pending-rating recovery.

Rating scheduling is server-authoritative through `submit_vocabulary_rating`. `success` and `already_processed` are successful mutation results. Again uses queue-based re-learning (`interval_hours = 0`, `next_review_at = null`). Current data loading uses request coordination, user/generation stale-response guards, aggregate failure isolation and controlled auth retry.

Historical `PHASE_*`, `*_AUDIT`, `*_REPORT` and `*_SUMMARY` documents are retained as decision and incident history. Their older implementation claims must not override the current contract documents below.

---

## Document Precedence

When documents contain conflicting information, the following precedence order applies (highest to lowest):

1. **PRODUCT_DECISIONS.md** — Product model, scope, approved behaviours
2. **DATA_OWNERSHIP_CONTRACT.md** — Security model, RLS policies, ownership rules
3. **SRS_TARGET_SPEC.md** — SRS algorithm specification and safety requirements
4. **ROUTE_CONTRACT.md** — Routing architecture and navigation patterns
5. **UI_PRESERVATION_CONTRACT.md** — Visual design system and interaction patterns
6. **TARGET_ARCHITECTURE.md** — Code architecture and layering
7. **PHASED_ROADMAP.md** — Implementation phases and timeline

**Rule**: A lower-numbered document takes precedence over a higher-numbered document when they conflict.

---

## Document Descriptions

### 1. PRODUCT_DECISIONS.md
**Purpose**: Define the product model, user data ownership, approved features, and open decisions.

**Scope**:
- Product model (personal vocabulary app)
- User data ownership model
- Four-rating SRS system
- Learning states (new, learning, mastered)
- Approved MVP features
- Deferred features and open decisions
- Performance targets

**Authority**: Product owner approved decisions. All other documents must align with approved decisions here.

---

### 2. DATA_OWNERSHIP_CONTRACT.md
**Purpose**: Define security model, Row Level Security policies, and data ownership rules.

**Scope**:
- Zero Trust security model
- Entity ownership rules for all database tables
- Proposed RLS policies (not migration-ready)
- Atomic RPC requirements for rating submission
- Composite ownership constraints
- Migration strategy from localStorage

**Authority**: Security and data access patterns. Overrides architecture and implementation details in conflict.

---

### 3. SRS_TARGET_SPEC.md
**Purpose**: Specify the current SRS RPC, client reconciliation, queue and idempotency contract.

**Scope**:
- Current SRS behavior (verified from code and migration)
- Authoritative RPC result contract and client reconciliation
- Safety requirements (pure functions, idempotency, atomicity)
- Deferred algorithm research (SM-2, FSRS)
- Test requirements with fixed timestamps

**Authority**: SRS behaviour specification. Implementation must match approved algorithm.

---

### 4. ROUTE_CONTRACT.md
**Purpose**: Document current routing and approved future routing plans.

**Scope**:
- Current state: SPA with tab navigation at `/app`
- First vertical slice: `/login`, `/signup` routes
- Deferred: full route migration, deep linking, admin routes
- Navigation patterns and URL parameters

**Authority**: Routing architecture. Phases must follow approved migration strategy.

---

### 5. UI_PRESERVATION_CONTRACT.md
**Purpose**: Document the current UI as visual source of truth.

**Scope**:
- Design system (colors, typography, spacing, shadows)
- Component inventory (verified behaviours only)
- Responsive behaviour
- Verified animations and interactions
- Permitted changes and approval process

**Authority**: Visual appearance and interaction patterns. Changes require product owner approval.

---

### 6. TARGET_ARCHITECTURE.md
**Purpose**: Define code architecture and layering patterns.

**Scope**:
- Layered architecture: UI → Controllers → Domain → Repositories → Supabase
- Layer responsibilities
- State management strategy
- Error handling patterns
- Testing strategy
- Incremental abstraction approach

**Authority**: Code organization and structure. Must align with approved SRS algorithm and data ownership model.

---

### 7. PHASED_ROADMAP.md
**Purpose**: Define implementation phases, tasks, and timeline.

**Scope**:
- Phase 0: Contracts (completed)
- Phase 1: Cloud Development Supabase Foundation
- Phase 2: Auth + First Vertical Slice
- Phase 3-10: Incremental feature migration
- Deferred: SRS algorithm research (requires explicit approval)
- Timeline and risk mitigation

**Authority**: Implementation order and deliverables. Must implement approved decisions from higher-precedence documents.

---

## Conflict Resolution

### Example 1: SRS Algorithm
- **PRODUCT_DECISIONS.md** states: "MVP preserves current algorithm"
- **SRS_TARGET_SPEC.md** describes: "Modified SM-2 in deferred section"
- **PHASED_ROADMAP.md** includes: "Phase 5: Enhanced SRS Algorithm"

**Resolution**: PRODUCT_DECISIONS.md takes precedence. Phase 5 must preserve current algorithm. SM-2 is deferred and requires explicit approval before implementation.

### Example 2: Routing Migration
- **ROUTE_CONTRACT.md** states: "Keep `/app` for the authenticated vertical slice"
- **PHASED_ROADMAP.md** originally stated: "Phase 2: Move to `/dashboard`"

**Resolution**: ROUTE_CONTRACT.md takes precedence. The current authenticated SPA remains at `/app`; `/` is the public landing page.

### Example 3: localStorage Usage
- **DATA_OWNERSHIP_CONTRACT.md** states: "Supabase is source of truth after migration"
- **TARGET_ARCHITECTURE.md** described: "Hybrid storage with localStorage fallback"

**Resolution**: DATA_OWNERSHIP_CONTRACT.md takes precedence. localStorage is permitted only for: one-time migration, temporary drafts, bounded session recovery, and domains not yet migrated. No long-term persistence fallback.

---

## Document Status

| Document | Status | Last Updated | Approval Required |
|----------|--------|--------------|-------------------|
| README.md | ✅ Current | 2026-08-05 | N/A |
| PRODUCT_DECISIONS.md | ✅ Approved/current notes corrected | 2026-08-05 | Product Owner |
| DATA_OWNERSHIP_CONTRACT.md | ✅ Current notes corrected | 2026-08-05 | Product Owner + Security Review |
| SRS_TARGET_SPEC.md | ✅ Current implementation reference | 2026-08-05 | Product Owner |
| ROUTE_CONTRACT.md | ✅ Current | 2026-08-05 | Product Owner |
| UI_PRESERVATION_CONTRACT.md | ✅ Corrected | 2026-07-30 | Product Owner |
| TARGET_ARCHITECTURE.md | ⚠️ Target patterns plus current notes | 2026-08-05 | Technical Lead |
| PHASED_ROADMAP.md | ✅ Corrected | 2026-07-30 | Product Owner |

---

## Change Process

**To update any contract document**:
1. Identify which document(s) require changes
2. Check precedence order for conflicts
3. Update lower-precedence documents to align with higher-precedence decisions
4. Submit for product owner review
5. Update "Last Updated" date after approval

**To propose new features**:
1. Add to "Open Decisions" in PRODUCT_DECISIONS.md
2. Wait for product owner approval
3. Update dependent documents (SRS, Architecture, Roadmap) only after approval

---

## Notes

- All SQL examples in documentation are **proposed drafts only**, not migration-ready
- All performance numbers are **targets**, not guaranteed contracts
- Features documented but not verified in code are marked **Unverified**
- Deferred decisions require explicit product owner approval before implementation
