# TOEIC Test Phase 4 — Read Security Boundary

## Scope

Phase 4 hardens read access for TOEIC test content. It does not implement the
test UI, attempts, autosave, scoring, submission, or any SRS behavior.

Preserved contracts:

- `submit_vocabulary_rating` and all SRS formulas/mappings;
- TOEIC attempt, queue, autosave and scoring behavior;
- database schema from Phase 2/3 migrations;
- existing UI layout and navigation.

## Audit findings

Before this phase, `authenticated` had direct `SELECT` grants on
`toeic_tests`, `toeic_passages`, and `toeic_questions`. RLS limited rows to
published tests, but a direct table projection could still expose sensitive
columns on those rows. `toeic_question_answer_keys` was already isolated from
browser roles.

The browser Supabase client is already a singleton in
`lib/supabase/client.ts`. Server route handlers use the cookie-backed client in
`lib/supabase/server.ts`. There was no TOEIC read service, no production TOEIC
private bucket contract, and no server-only signed media endpoint.

Existing dynamic imports and chunk-recovery logic are unrelated to this read
boundary and were not changed.

## Database boundary

`supabase/migrations/20260805120000_create_toeic_safe_read_boundary.sql` adds:

- `list_published_toeic_tests(...)` for a bounded, deterministic catalog;
- `get_published_toeic_test_part(...)` for one published part;
- `SECURITY DEFINER` functions with `search_path = public, pg_temp`;
- authentication checks through `auth.uid()`;
- explicit columns and explicit JSON keys; no `SELECT *`;
- pagination bounds (`1..50`, offset `0..100000`);
- direct authenticated `SELECT` revocation on the three content tables.

The part projection contains question text, options, passage content and
bucket-relative media paths only. It does not contain answer keys,
transcripts, translations, explanations, AI explanations or vocabulary
content.

The answer-key table remains inaccessible to browser roles. Existing RLS is
kept as defense in depth; RPCs are now the intended browser read boundary.

## Type and service boundary

`features/toeic-tests/readContracts.ts` defines separate DTOs:

- `ToeicTestCatalogItem`;
- `ToeicTestTakingQuestion`;
- `ToeicTestTakingPassage`;
- `ToeicTestPartPayload`.

The existing rich importer/domain types are not weakened or made optional.
`features/toeic-tests/mappers/toeicTestMapper.ts` validates RPC output and
rejects forbidden sensitive field names at runtime. The browser service calls
the existing Supabase singleton and maps database errors to stable
`ToeicReadError` codes.

## Private media

The migration creates the private `toeic-test-media` bucket with:

- `public = false`;
- 50 MiB object limit;
- `audio/mpeg`, `image/webp`, `image/png`, and `image/jpeg` MIME types;
- no browser storage policy.

`features/toeic-tests/server/toeicMediaService.ts` is marked with the
`server-only` package and uses `SUPABASE_SERVICE_ROLE_KEY` only on the server.
It validates the authenticated request, published test, media-folder scope,
database-referenced media paths, maximum batch size (20), and signed URL TTL
(5–15 minutes, default 10 minutes). Duplicate paths are deduplicated. Raw
service-role errors and credentials never cross the API response.

`app/api/toeic-tests/[testId]/media/route.ts` is a `POST` route with a private,
`no-store` response. It authenticates with the normal cookie-backed Supabase
client, then delegates signing to the server-only service. It never accepts a
bucket name from the client and never caches signed URLs.

## Verification

`supabase/tests/toeic_test_schema_verification.sql` now checks:

- no authenticated direct `SELECT` on TOEIC content tables;
- authenticated-only execute grants for the two safe read RPCs;
- private bucket configuration;
- absence of a TOEIC browser storage policy;
- existing answer-key, attempt, RLS, and integrity invariants.

Unit tests cover DTO mapping, sensitive-field rejection, RPC argument
validation/error mapping, media path authorization, path traversal rejection,
deduplication, unpublished tests, and signing failures.
