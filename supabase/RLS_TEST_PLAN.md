# VocabTOEIC — Two-User RLS Test Plan

**Version**: 1.1  
**Created**: 2026-07-30  
**Updated**: 2026-07-30  
**Purpose**: Verify database ownership, RLS isolation and anonymous access  
**Scope**: `collections`, `topics`, `vocabularies`

---

## 1. Test goals

The tests must prove:

1. Alice can create, read, update and delete her own data.
2. Bob cannot read, update or delete Alice's data.
3. Bob cannot insert rows using Alice's `user_id`.
4. Bob cannot create a topic under Alice's collection.
5. Bob cannot move his topic under Alice's collection.
6. Bob cannot create a vocabulary under Alice's topic.
7. Bob cannot move his vocabulary under Alice's topic.
8. Composite foreign keys reject owner mismatches even through a privileged database path.
9. Anonymous users cannot read or mutate any table.
10. Cascading deletion only affects rows with matching ownership.

---

## 2. Environment

Required:

- Supabase Cloud project: `vocabtoeic-dev`
- migrations applied:
  - `20260730_184631_initial_vertical_slice_schema.sql`
  - `20260730_184632_initial_vertical_slice_rls.sql`
- two confirmed Auth users:
  - Alice
  - Bob
- Supabase project URL
- publishable/anon key

Do not use production data.

---

## 3. Important testing rule

The Supabase Dashboard SQL Editor normally runs with elevated database privileges. It is useful for inspecting schema and testing constraints, but it does not accurately simulate an authenticated Alice or Bob session by itself.

Use an authenticated Supabase client for RLS tests.

A temporary Node script, browser test page or Phase 2 application flow may be used.

Do not put service-role credentials in browser code.

---

## 4. Suggested test helper

The pseudocode below shows the required structure.

```ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const alice = createClient(supabaseUrl, supabaseAnonKey);
const bob = createClient(supabaseUrl, supabaseAnonKey);
const anonymous = createClient(supabaseUrl, supabaseAnonKey);

await alice.auth.signInWithPassword({
  email: process.env.TEST_ALICE_EMAIL!,
  password: process.env.TEST_ALICE_PASSWORD!,
});

await bob.auth.signInWithPassword({
  email: process.env.TEST_BOB_EMAIL!,
  password: process.env.TEST_BOB_PASSWORD!,
});
```

Store test credentials only in ignored environment files.

---

## 5. Test data variables

Record these IDs during execution:

```text
ALICE_USER_ID
BOB_USER_ID
ALICE_COLLECTION_ID
ALICE_TOPIC_ID
ALICE_VOCABULARY_ID
BOB_COLLECTION_ID
BOB_TOPIC_ID
BOB_VOCABULARY_ID
```

Delete test data after testing.

---

# 6. Authenticated RLS scenarios

## Scenario 1 — Alice creates her hierarchy

### Create collection

```ts
const {
  data: { user: aliceUser },
} = await alice.auth.getUser();

if (!aliceUser) throw new Error('Alice is not authenticated');

const { data: aliceCollection, error: collectionError } = await alice
  .from('collections')
  .insert({
    user_id: aliceUser.id,
    title: 'Alice TOEIC Collection',
    description: 'RLS test data',
    icon: 'FolderKanban',
  })
  .select()
  .single();

if (collectionError) throw collectionError;
```

Expected:

- insert succeeds;
- returned `user_id` equals Alice's ID;
- ID is a UUID.

### Create topic

```ts
const { data: aliceTopic, error: topicError } = await alice
  .from('topics')
  .insert({
    user_id: aliceUser.id,
    collection_id: aliceCollection.id,
    title: 'Alice Contracts Topic',
    description: 'RLS test topic',
    icon: 'BookOpen',
    category: 'Business',
  })
  .select()
  .single();

if (topicError) throw topicError;
```

Expected: insert succeeds.

### Create vocabulary

```ts
const { data: aliceVocabulary, error: vocabularyError } = await alice
  .from('vocabularies')
  .insert({
    user_id: aliceUser.id,
    topic_id: aliceTopic.id,
    word: 'obligation',
    part_of_speech: 'noun',
    meaning: 'Nghĩa vụ',
  })
  .select()
  .single();

if (vocabularyError) throw vocabularyError;
```

Expected: insert succeeds.

---

## Scenario 2 — Alice reads her own data

```ts
const { data: collections } = await alice.from('collections').select('*');
const { data: topics } = await alice.from('topics').select('*');
const { data: vocabularies } = await alice.from('vocabularies').select('*');
```

Expected:

- Alice sees her own collection;
- Alice sees her own topic;
- Alice sees her own vocabulary.

---

## Scenario 3 — Bob cannot read Alice's data

```ts
const { data: bobCollections, error: cError } =
  await bob.from('collections').select('*');

const { data: bobTopics, error: tError } =
  await bob.from('topics').select('*');

const { data: bobVocabularies, error: vError } =
  await bob.from('vocabularies').select('*');
```

Before Bob creates any data, expected:

- no query error;
- all arrays are empty;
- Alice's IDs do not appear.

---

## Scenario 4 — Bob cannot impersonate Alice

Get Bob's authenticated user:

```ts
const {
  data: { user: bobUser },
} = await bob.auth.getUser();

if (!bobUser) throw new Error('Bob is not authenticated');
```

Attempt:

```ts
const { error } = await bob.from('collections').insert({
  user_id: aliceUser.id,
  title: 'Impersonation attempt',
});
```

Expected:

- insert fails with an RLS policy error;
- no row is created.

Repeat for `topics` and `vocabularies` with Alice's `user_id`.

---

## Scenario 5 — Bob cannot create a topic under Alice's collection

Attempt:

```ts
const { error } = await bob.from('topics').insert({
  user_id: bobUser.id,
  collection_id: aliceCollection.id,
  title: 'Cross-owner topic',
  description: 'Must fail',
  icon: 'BookOpen',
  category: 'Test',
});
```

Expected:

- insert fails;
- either the RLS parent check or composite foreign key rejects it;
- no topic row is created.

This test must not be treated as an application-only responsibility.

---

## Scenario 6 — Bob creates his own hierarchy

Create Bob's own collection, topic and vocabulary using Bob's authenticated ID.

Expected:

- all inserts succeed;
- Bob sees only Bob's rows;
- Alice still sees only Alice's rows.

---

## Scenario 7 — Bob cannot move his topic into Alice's collection

Attempt:

```ts
const { error } = await bob
  .from('topics')
  .update({
    collection_id: aliceCollection.id,
  })
  .eq('id', bobTopic.id);
```

Expected:

- update fails;
- Bob's topic remains under Bob's collection.

The protection must come from both:

- `WITH CHECK` RLS parent ownership validation;
- composite foreign key ownership.

---

## Scenario 8 — Bob cannot create a vocabulary under Alice's topic

Attempt:

```ts
const { error } = await bob.from('vocabularies').insert({
  user_id: bobUser.id,
  topic_id: aliceTopic.id,
  word: 'cross-owner',
  part_of_speech: 'noun',
  meaning: 'Must fail',
});
```

Expected:

- insert fails;
- no vocabulary row is created.

---

## Scenario 9 — Bob cannot move his vocabulary into Alice's topic

Attempt:

```ts
const { error } = await bob
  .from('vocabularies')
  .update({
    topic_id: aliceTopic.id,
  })
  .eq('id', bobVocabulary.id);
```

Expected:

- update fails;
- Bob's vocabulary remains under Bob's topic.

---

## Scenario 10 — Bob cannot update Alice's rows

```ts
const collectionResult = await bob
  .from('collections')
  .update({ title: 'Hacked' })
  .eq('id', aliceCollection.id)
  .select();

const topicResult = await bob
  .from('topics')
  .update({ title: 'Hacked' })
  .eq('id', aliceTopic.id)
  .select();

const vocabularyResult = await bob
  .from('vocabularies')
  .update({ word: 'hacked' })
  .eq('id', aliceVocabulary.id)
  .select();
```

Expected:

- Alice's rows remain unchanged;
- returned data is empty or otherwise indicates no accessible row was updated.

Verify by reading again as Alice.

---

## Scenario 11 — Bob cannot delete Alice's rows

```ts
await bob
  .from('vocabularies')
  .delete()
  .eq('id', aliceVocabulary.id);

await bob
  .from('topics')
  .delete()
  .eq('id', aliceTopic.id);

await bob
  .from('collections')
  .delete()
  .eq('id', aliceCollection.id);
```

Expected:

- Alice's rows remain present;
- Bob cannot delete any Alice-owned row.

Verify by reading again as Alice.

---

# 7. Anonymous access scenarios

Use a Supabase client that has not signed in.

## Anonymous SELECT

```ts
const result = await anonymous.from('collections').select('*');
```

Expected:

- request fails due to missing table privilege or returns no accessible rows;
- no private data is returned.

Repeat for `topics` and `vocabularies`.

## Anonymous INSERT

```ts
const result = await anonymous.from('collections').insert({
  user_id: aliceUser.id,
  title: 'Anonymous attempt',
});
```

Expected: insert fails.

Repeat mutation checks for update and delete.

---

# 8. Privileged database constraint tests

These tests verify database integrity independently of RLS.

Run them only in the disposable cloud development project using a privileged SQL session.

Use real Alice and Bob UUIDs and IDs obtained from the authenticated test setup.

## Mismatched topic owner

```sql
BEGIN;

INSERT INTO public.topics (
  user_id,
  collection_id,
  title,
  description,
  icon,
  category
)
VALUES (
  '<BOB_USER_ID>'::uuid,
  '<ALICE_COLLECTION_ID>'::uuid,
  'Constraint test',
  'Must fail',
  'BookOpen',
  'Test'
);

ROLLBACK;
```

Expected:

```text
foreign key violation
topics_collection_owner_fk
```

## Mismatched vocabulary owner

```sql
BEGIN;

INSERT INTO public.vocabularies (
  user_id,
  topic_id,
  word,
  part_of_speech,
  meaning
)
VALUES (
  '<BOB_USER_ID>'::uuid,
  '<ALICE_TOPIC_ID>'::uuid,
  'constraint-test',
  'noun',
  'Must fail'
);

ROLLBACK;
```

Expected:

```text
foreign key violation
vocabularies_topic_owner_fk
```

These tests prove ownership is database-enforced even when a privileged role bypasses RLS.

---

# 9. Cascade ownership test

Create a separate temporary Alice hierarchy:

```text
Alice temporary collection
└── Alice temporary topic
    └── Alice temporary vocabulary
```

Delete the temporary collection as Alice.

Expected:

- temporary topic is deleted;
- temporary vocabulary is deleted;
- Bob's collection, topic and vocabulary remain unchanged.

Because mismatched ownership cannot exist, cascades cannot delete another user's valid child rows.

---

# 10. Cleanup

Delete Bob's test collection as Bob and Alice's test collection as Alice.

Because of `ON DELETE CASCADE`, deleting each test collection should remove its child topics and vocabularies.

Confirm:

```ts
const aliceRemaining = await alice.from('collections').select('id');
const bobRemaining = await bob.from('collections').select('id');
```

Expected: test collections no longer exist.

---

# 11. Result checklist

| Test | Expected |
|---|---|
| Alice creates own hierarchy | PASS |
| Alice reads own hierarchy | PASS |
| Bob cannot read Alice data | PASS |
| Bob cannot impersonate Alice | PASS |
| Bob cannot insert topic under Alice collection | PASS |
| Bob creates own hierarchy | PASS |
| Bob cannot move topic under Alice collection | PASS |
| Bob cannot insert vocabulary under Alice topic | PASS |
| Bob cannot move vocabulary under Alice topic | PASS |
| Bob cannot update Alice rows | PASS |
| Bob cannot delete Alice rows | PASS |
| Anonymous access blocked | PASS |
| Privileged mismatched topic insert rejected | PASS |
| Privileged mismatched vocabulary insert rejected | PASS |
| Cascade affects only same-owner hierarchy | PASS |

---

# 12. Test report template

```markdown
# RLS Test Execution Report

**Date**:
**Tester**:
**Environment**: vocabtoeic-dev
**Migration versions**:
- 20260730_184631
- 20260730_184632

| Test | Result | Notes |
|---|---|---|
| Alice creates own hierarchy | PASS / FAIL | |
| Bob cannot read Alice data | PASS / FAIL | |
| Bob cannot impersonate Alice | PASS / FAIL | |
| Cross-owner topic insert rejected | PASS / FAIL | |
| Cross-owner topic update rejected | PASS / FAIL | |
| Cross-owner vocabulary insert rejected | PASS / FAIL | |
| Cross-owner vocabulary update rejected | PASS / FAIL | |
| Anonymous access blocked | PASS / FAIL | |
| Composite FK tests pass | PASS / FAIL | |
| Cascade ownership test passes | PASS / FAIL | |

## Issues

## Evidence

## Final decision

- [ ] RLS approved for Phase 2
- [ ] Requires migration correction
```

---

## 13. Approval condition

Phase 1A security testing is complete only when:

- all authenticated isolation tests pass;
- all anonymous tests pass;
- both privileged composite foreign key tests fail as expected;
- cascade behavior is verified;
- no test uses service-role credentials in browser code;
- evidence is recorded in a test execution report.
