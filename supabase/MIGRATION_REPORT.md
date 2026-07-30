# Phase 1A: Cloud Supabase Migration — Implementation Report

**Version**: 1.1  
**Created**: 2026-07-30  
**Updated**: 2026-07-30  
**Status**: Ready for final review — not pushed

---

## 1. Summary

Phase 1A prepares the minimum database foundation for the first vertical slice:

```text
Sign up / Sign in
→ Create Collection
→ Create Topic
→ Add Vocabulary
→ Refresh
→ Data remains
→ Another user cannot access it
```

This phase creates only:

- `collections`
- `topics`
- `vocabularies`
- database constraints
- indexes
- `updated_at` triggers
- Row Level Security policies
- table grants

This phase does **not** create:

- `user_vocab_progress`
- `review_logs`
- SRS RPC functions
- study sessions
- daily goals
- import jobs
- authentication pages
- application integration

No migration has been pushed to Supabase Cloud yet.

---

## 2. Files

```text
supabase/
├── migrations/
│   ├── 20260730_184631_initial_vertical_slice_schema.sql
│   └── 20260730_184632_initial_vertical_slice_rls.sql
├── seed.sql
├── RLS_TEST_PLAN.md
└── MIGRATION_REPORT.md
```

### Migration 1 — Schema

`20260730_184631_initial_vertical_slice_schema.sql`

Creates:

- `public.collections`
- `public.topics`
- `public.vocabularies`
- `public.set_updated_at()`
- indexes
- composite ownership constraints

### Migration 2 — RLS

`20260730_184632_initial_vertical_slice_rls.sql`

Creates:

- RLS policies for `SELECT`
- RLS policies for `INSERT`
- RLS policies for `UPDATE`
- RLS policies for `DELETE`
- minimum grants for `authenticated`
- explicit revokes for `anon` and `PUBLIC`

### Development seed

`supabase/seed.sql`

The seed file intentionally contains no user-owned sample records.

Collections, topics and vocabularies require a real authenticated user. Test data will be created through authenticated flows during Phase 2.

---

## 3. Final schema design

## 3.1. UUID IDs

All three entities use database-generated UUIDs:

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
```

The existing TypeScript model uses `string`, so UUID values remain type-compatible:

```ts
id: string
```

Phase 2 must remove client-generated IDs and use the UUID returned by Supabase after `INSERT ... RETURNING`.

---

## 3.2. Collections

Important fields:

```text
id
user_id
title
description
icon
created_at
updated_at
```

Ownership:

```text
collections.user_id → auth.users.id
```

Required composite key:

```sql
UNIQUE (id, user_id)
```

This key allows child tables to reference both the parent ID and its owner.

---

## 3.3. Topics

Important fields:

```text
id
collection_id
user_id
title
description
icon
category
created_at
updated_at
```

Ownership is enforced at database level:

```sql
FOREIGN KEY (collection_id, user_id)
REFERENCES public.collections(id, user_id)
ON DELETE CASCADE
```

Therefore, this invalid row cannot exist:

```text
topic.user_id = Bob
topic.collection_id = Alice's collection
```

Topics also expose:

```sql
UNIQUE (id, user_id)
```

so vocabularies can enforce ownership against their parent topic.

---

## 3.4. Vocabularies

Important fields:

```text
id
topic_id
user_id
word
phonetic_uk
phonetic_us
part_of_speech
meaning
example
example_translation
synonyms
collocations
audio_url
note
created_at
updated_at
```

Ownership is enforced at database level:

```sql
FOREIGN KEY (topic_id, user_id)
REFERENCES public.topics(id, user_id)
ON DELETE CASCADE
```

Therefore, this invalid row cannot exist:

```text
vocabulary.user_id = Bob
vocabulary.topic_id = Alice's topic
```

---

## 4. Ownership model

The ownership hierarchy is:

```text
auth.users
└── collections
    └── topics
        └── vocabularies
```

Security is enforced by two independent layers.

### Layer 1 — Composite foreign keys

Composite foreign keys guarantee parent and child have the same `user_id`.

This is the database integrity boundary.

### Layer 2 — Row Level Security

RLS guarantees an authenticated user can only read and mutate rows where:

```sql
user_id = auth.uid()
```

For child inserts and updates, RLS additionally verifies the referenced parent belongs to the current user.

Application checks may still be added to provide clearer error messages, but application code is **not** the security boundary.

---

## 5. Ownership assignment strategy

For the first vertical slice, the client sends `user_id` in the insert payload.

Example:

```ts
const {
  data: { user },
} = await supabase.auth.getUser();

if (!user) {
  throw new Error('Not authenticated');
}

const { data, error } = await supabase
  .from('collections')
  .insert({
    user_id: user.id,
    title: input.title,
    description: input.description,
    icon: input.icon,
  })
  .select()
  .single();
```

The client value is not trusted. RLS enforces:

```sql
WITH CHECK (user_id = auth.uid())
```

Sending another user's ID is rejected by the database.

---

## 6. RLS summary

Each table has four policies.

### SELECT

```sql
USING (user_id = auth.uid())
```

Users can only read their own rows.

### INSERT

Collections require:

```sql
user_id = auth.uid()
```

Topics additionally require that the referenced collection belongs to the current user.

Vocabularies additionally require that the referenced topic belongs to the current user.

### UPDATE

`USING` limits which existing rows are visible for update.

`WITH CHECK` validates the row after modification.

This blocks:

- changing `user_id` to another user
- moving a topic into another user's collection
- moving a vocabulary into another user's topic

### DELETE

```sql
USING (user_id = auth.uid())
```

Users can only delete their own rows.

---

## 7. Delete strategy

Phase 1 uses **hard delete**.

When a user deletes:

```text
Collection
→ its Topics are deleted
→ their Vocabularies are deleted
```

This is implemented with `ON DELETE CASCADE`.

Soft delete is deferred. There is no `deleted_at` column in the Phase 1 schema.

Because composite ownership is enforced, a cascade cannot delete a valid child owned by a different user.

---

## 8. Timestamp strategy

The database generates timestamps:

```sql
clock_timestamp()
```

All three tables contain:

```text
created_at
updated_at
```

The `public.set_updated_at()` trigger updates `updated_at` before each row update.

The trigger function:

- is schema-qualified
- has a fixed `search_path`
- does not use `SECURITY DEFINER`

---

## 9. Seed strategy

`supabase/seed.sql` contains comments only.

Phase 1 does not seed user-owned records because they require authenticated users.

During Phase 2:

1. create two test users through Supabase Auth;
2. sign in as each user;
3. create collections, topics and vocabularies through authenticated clients;
4. execute the two-user RLS test plan.

Do not paste user-owned seed records into the Dashboard SQL Editor.

---

## 10. Application changes required in Phase 2

Phase 2 must:

1. remove client-generated collection/topic/vocabulary IDs;
2. omit `id` from insert payloads;
3. read the generated UUID from the returned row;
4. send the authenticated user's ID as `user_id`;
5. load migrated entities from Supabase;
6. stop using localStorage for migrated entities;
7. preserve current UI and SPA navigation;
8. add `/login` and `/signup`;
9. test isolation with two real Auth users.

UUID remains a TypeScript `string`, so no UI type migration is required.

A one-time mapping is only needed if existing prototype localStorage data must be imported.

---

## 11. Security properties

After the migrations are applied correctly:

- anonymous users cannot access the three tables;
- authenticated users can only access their own rows;
- users cannot impersonate another owner through `user_id`;
- users cannot create a topic under another user's collection;
- users cannot move a topic under another user's collection;
- users cannot create a vocabulary under another user's topic;
- users cannot move a vocabulary under another user's topic;
- parent-child ownership is enforced even if RLS is bypassed by a privileged database role.

---

## 12. Remaining risks

### Migration has not been executed

SQL syntax and behavior still need validation against `vocabtoeic-dev`.

### Cloud-only workflow

Because local Supabase is not used, failed migrations must be corrected carefully in the disposable development project.

Never run these migrations first against production.

### Existing remote schema

Before pushing, confirm that the cloud dev project does not already contain conflicting tables or migration history.

### Authenticated testing

RLS cannot be meaningfully tested as Alice and Bob from an ordinary admin SQL Editor session alone. Tests should use authenticated Supabase clients or another method that supplies real user JWTs.

---

## 13. Pre-push checklist

- [ ] Correct project branch is active
- [ ] Repository is linked to `vocabtoeic-dev`
- [ ] Project reference has been manually verified
- [ ] No `DROP TABLE` or other destructive SQL exists
- [ ] Composite foreign keys exist
- [ ] RLS is enabled and forced
- [ ] Anonymous privileges are revoked
- [ ] `seed.sql` contains no user-owned data
- [ ] Git diff contains only intended Phase 1 files
- [ ] Cloud dev contains no production data

Useful checks:

```powershell
git diff --check
git status --short

Select-String `
  -Path "supabase\migrations\*.sql" `
  -Pattern "DROP TABLE|DROP FUNCTION|uuid_generate_v4|uuid-ossp|GRANT USAGE ON ALL SEQUENCES"
```

The last command should return no matches.

---

## 14. Future push command

Only after final review:

```powershell
npx supabase link --project-ref <VOCABTOEIC_DEV_PROJECT_REF>
npx supabase db push
```

Do not link to the production project.

---

## 15. Current status

```text
Application code changed: No
UI changed: No
Cloud database changed: No
Migration pushed: No
Dependencies changed: No
Git commit created: No
```

**Next action**: final migration review, then push to `vocabtoeic-dev`, followed by authenticated two-user RLS testing.
