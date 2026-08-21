# TOEIC Test Phase 11.5 — External Media Sources

Phase 11.5 adds a controlled media-source boundary. Imported JSON may retain
an approved HTTPS audio/image URL, while existing bucket-relative paths still
use the private Supabase signed-media flow. This phase does not change the
Phase 10.5 UI or the Phase 11 playback/navigation policy.

## Source contract

The current sample JSON uses `questions[].audio_url` and
`questions[].image_url`. No `audioPath`, `audio_path`, `audioUrl`, `imagePath`,
or `imageUrl` aliases were found in the audited dataset, so no speculative
aliases were added.

`features/toeic-tests/mediaSource.ts` classifies values as:

- `storage_path`: a bucket-relative value such as
  `2026/test-1/part-3/audio.mp3`;
- `external_url`: a valid HTTPS URL, preserving its case-sensitive path and
  query string.

Empty values remain `null`. HTTP, FTP, JavaScript, data, blob, file, malformed,
credential-bearing, local/private-host and unsafe values are rejected. External
URLs are limited to 2048 characters and ports are rejected by default. Local
development ports/hosts require the explicit `allowLocalDevelopment` option;
production does not enable it.

## Server allowlist

External hosts are controlled only by the server environment variable:

```text
TOEIC_EXTERNAL_MEDIA_HOSTS=media.example.com,old-project.supabase.co
```

Hosts are matched exactly after lower-casing. Subdomains are not implicitly
accepted, and no `NEXT_PUBLIC_*` variable is used for this security decision.
The importer and runtime resolver both validate the allowlist. External URLs
are content-author-controlled; the production UI does not accept arbitrary
user-entered URLs.

## Import behavior

The importer does not download or upload media. It trims wrapping quote
artifacts, validates the URL, retains approved external URLs, and preserves
relative storage paths through the existing `buildToeicMediaPath` behavior.
Validation issues include the question index/field and redact URL query
values. Passage media consensus and the manifest preserve the full external
URL, including a required query token when the provider needs it.

The development importer uses the same server-side allowlist from
`TOEIC_EXTERNAL_MEDIA_HOSTS`. A dry run must be configured with the host list
when the JSON contains external URLs.

## Runtime resolver

`app/api/toeic-tests/[testId]/media` remains the authenticated authorization
boundary. It verifies the published test and that the requested media value is
referenced by that test.

For a storage path:

```text
relative path → referenced-path check → Supabase createSignedUrls → signed URL
```

For an external URL:

```text
HTTPS URL → exact host allowlist → referenced-value check → same URL returned
```

The server never sends an external URL to `createSignedUrls`, and there is no
arbitrary URL proxy. The browser consequently loads approved external media
directly from its host; the existing media client/View contract remains
`signedUrl` for compatibility, with `sourceType` identifying the source when
available.

The route does not log URLs or query tokens. External URL failures use the
existing media error/retry path; no external-specific UI was introduced.

## Database compatibility

The existing media columns are `TEXT`, but the original CHECK helper rejected
all `://` values. Migration
`20260805190000_allow_toeic_external_media_urls.sql` updates only the helper
and keeps `toeic_tests.media_folder` relative-only. It allows syntactically
safe HTTPS media values alongside relative paths and rejects whitespace,
credentials, local/private hosts and traversal patterns at the database
constraint boundary. Host allowlisting remains an application/server concern.

The old migrations were not edited. No new source-type column was added; the
value itself is the source discriminator, preserving backward compatibility.

## Stable media identity

Group identity remains:

```text
passageId → canonical media identity → questionId
```

`passageId` remains the first choice, so changing an external host does not
change Part 3/4 shared-group identity. External fallback identity uses
protocol, lower-cased hostname and pathname only; query tokens are excluded.
Signed URLs are never used as React/audio keys.

## Audit utility

Run the development-only checker with a configured allowlist:

```text
npm run toeic:audit-media -- --file prototype/2026-test-1-id_ad780150.json
```

The script has a four-request concurrency limit, an eight-second timeout,
redirect allowlist validation, HTTP status/content-type checks, duplicate
reporting and an audio range-response warning. It prints `PASS`, `WARNING` or
`FAIL`, redacts query values, and is not called from production playback.

## Security and deferred work

External URLs must not contain answer keys, user tokens, service-role keys or
other private credentials. A URL query token is not logged or used for group
identity; its expiry is the provider's responsibility and the resolver
revalidates the stored value on refresh.

Google Drive share links are not treated as direct media URLs. No Google Drive
adapter, public proxy, SSRF DNS proxy, transcoding, media download, offline
cache, service worker or licensing workflow is included in Phase 11.5.

If a media host changes, use a controlled exact-prefix migration/script with a
dry-run count. Do not replace arbitrary text or touch answer/explanation
content. A future provider-base-plus-relative-path model remains possible but
is intentionally deferred.

## Verification

Automated coverage includes source classification, unsafe schemes/hosts,
allowlist enforcement, importer preservation, external-vs-storage runtime
resolution, no storage signing for external URLs and passage-first media
identity. Manual verification must still confirm direct external Network
requests, storage signed URLs, Practice controls, Exam Phase 11 locks,
auto-advance, Part 3/4 shared audio and Review media in a real browser.
