# Changelog

All notable changes to RAAHI are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
the versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html):
`MAJOR` for a breaking change to the public API, `MINOR` for new capability,
`PATCH` for a fix.

For a project that people rely on in an emergency, an honest changelog is part
of the product: it is how a reviewer knows what changed in the thing they are
about to recommend to a citizen.

---

## [1.0.1] — 2026-09-30

Two changes, both about what a visitor actually experiences: how much data
their phone has to download, and what a browser will let run on the page.

### Fixed

- **The model SDK was being shipped to the browser.** The voice button
  imported four language tags and the photo screen imported six sentences of
  checklist, both from modules that import the OpenAI SDK — so 67 KB gzipped of
  SDK reached every visitor. Both constants now live in leaf modules with no
  server imports.
- **The knowledge corpus was pinned into client bundles.** Five data modules
  built a lookup `Map` at module scope, which stops a bundler from dropping the
  array it reads. None of the maps was ever used by anything. They are gone,
  and the constants the screens need moved into leaves.
  - First-load JS, gzipped: home page **269 KB → 195 KB**, blood 197 → 196 KB,
    disaster 199 → 194 KB. Every page now sits at the framework baseline and no
    client chunk contains the SDK.

### Changed

- **The Content-Security-Policy now uses a per-request nonce instead of
  `'unsafe-inline'`.** Injected inline scripts no longer have anything to
  match, while Next stamps the nonce onto every script it emits. Pages render
  per request to allow this; measured cost is 15–18 ms TTFB and no change in
  bundle size.

### Added

- `tests/bundle.test.ts` — four guards so neither mistake can come back: no
  client component may import an SDK-bearing module, the browser-safe leaves
  must stay dependency-free, no data module may build a `Map` at module scope,
  and no client component may import the knowledge corpus.
- Four CSP tests in `tests/security-and-errors.test.ts`.

### Verification

133 tests, `tsc --noEmit` clean, `eslint` 0 errors / 0 warnings, production
build green. All 22 routes checked in both production and development: every
script carries the nonce.

---

## [1.0.0] — 2026-09-30

First release. Everything from here on is a change against this baseline.

### Added — the citizen platform

Every module below is complete and working end to end, in four languages
(English, Urdu, Pashto, Hindko), voice-first and RTL-first.

- **Scholarships** — fees, eligibility, required documents and procedure,
  national and international (`/scholarships`).
- **Documents & attestation** — how to obtain each document and who attests it,
  with a step-by-step walkthrough (`/documents`, `/procedure/[id]`).
- **Tests & preparation** — competitive exams, IELTS and admissions tests, with
  dates and how to prepare (`/tests`).
- **Dates & deadlines** — exams, admissions, jobs and internships (`/dates`,
  `/opportunities`).
- **Application tracker** — save progress on each application and manage it
  (`/track`).
- **Health** — free medical camps, medical procedures, and early disease /
  outbreak signals with reporting (`/health`).
- **Blood network** — find a donor or a bank, or request one (`/blood`).
- **Disaster relief** — guides, training, and a relief request routed to the
  right channel (`/disaster`).
- **Legal guidance** — plain-language rights and routes (`/legal`).
- **Authority contacts** — direct, verified numbers for the office that can
  actually help (`/contacts`, `/emergency`).
- **Eligibility & programmes** — check what you qualify for (`/programs`,
  `/portal`).
- **Knowledge base with correction** — every answer cites its source and the
  date a human last checked it; mistakes are reportable and reviewed by a
  person, never auto-applied (`/kb`).
- **Web search & scraping** — rate-limited, cached, robots-respecting, with a
  per-deployment budget so it can neither overload a host nor quietly disappear
  as a feature.
- **Installable (PWA)** with an offline page, plus SEO: metadata, structured
  data, sitemap and robots.

### Added — resilience and honesty

- **A plan B for every AI feature** (`lib/ai/resilience.ts`): a circuit breaker
  per provider, a hard deadline per call, one retry for transient faults, and a
  fallback that cannot throw. Wired into translation, vision, OCR, voice, the
  grounding rewrite and embeddings.
- **Data can go stale** (`lib/freshness.ts`): every record now reads as fresh,
  due a re-check, or possibly out of date, with thresholds that depend on what
  the record is. Shown as a badge wherever a bare date was printed before.
- **Health endpoint** (`/api/health`): provider circuits, capabilities as
  booleans, and stale-record counts. Never echoes a secret, and always answers
  200 so a provider outage cannot take the site out of service.
- **Privacy page** (`/privacy`): what we keep, what we pass to a responding
  organisation, the two cookies we set, when an AI writes the answer, and what
  RAAHI is not.
- **A crash page that still helps** (`app/global-error.tsx`): leads with
  1122 / 15 / 115 rather than a blank screen.
- **Rate limiting that survives a shared mobile network** — a tight per-visitor
  budget with a generous ceiling per address, because Pakistan's carriers put
  thousands of people behind one carrier-grade NAT address.
- **Security headers** — CSP, HSTS, frame and referrer policy, and inbound rate
  limiting, applied centrally in `proxy.ts`.

### Fixed

- **OCR invented data.** The scanner returned a placeholder CNIC and the portal
  labelled its own failure "Pre-verified". Two independent causes: the portal
  sent `image` while the endpoint accepted only `imageBase64`, and it read
  `data.fields` while the API returns `data.result`. It now returns empty
  fields with a plain explanation when it cannot read a document, and masks
  every value it does return.
- **The no-provider chat fallback was invisible.** It emitted `type: "service"`
  events, but the chat renders `search_results`, so on any deployment without a
  key the service cards were silently dropped.
- **A half-written answer could hang the chat** when a stream died mid-reply.
- **Next 16 renamed `middleware` to `proxy`**, so the security middleware was
  being ignored entirely.
- **Duplicate React keys** where a scholarship legitimately asks for two CNICs
  (the student's and a guardian's).
- Verified, callable numbers for NDMA, PRCS and Alkhidmat.
- Emergency and self-harm detection now answers before any model is consulted.

### Verification

118 tests, `tsc --noEmit` clean, `eslint` 0 errors / 0 warnings, production
build green.

---

## Release process

1. Work on `arena/*` branches; keep commits in imperative mood.
2. Before tagging: `npm run verify` (typecheck + test + build).
3. Update `CHANGELOG.md` and bump the version in **both** `package.json` and
   `lib/version.ts` — a test fails the build if they drift apart.
4. Tag `vX.Y.Z` and publish a GitHub Release with the changelog section as the
   body.
5. After deploying, check `/api/health` — it reports the version, the provider
   circuits and any records that have gone stale.
