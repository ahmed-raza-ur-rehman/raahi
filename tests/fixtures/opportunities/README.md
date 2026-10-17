# Fixtures

Two kinds of files live here.

**Hand-built (first delivery)** — `njp-live.html`, `beoe-news.html`, `scholarshiptab.html`, `remotive.json`, `jobicy.json`,
`arbeitnow.json`, `devpost.json`, `codeforces.json`, `real-discount.json`, `wp-*.json`: small records written to
exercise the parsers. Records that are synthetic say so in their title (`(fixture)`).

**Real excerpts** — `*.sample.*`, `wp-ntslogin.json`, `wp-schoolsti.json`, `atom-mauqapakistan.xml`: cut from responses
the live probe captured on GitHub's runners on 2026-10-11 (the only place in this project's toolchain with unrestricted
internet access). Long descriptions were shortened and, for the WordPress and Atom files, the envelope was rebuilt around the
real titles, links, dates and excerpts; nothing else was edited. They are the ground truth for the field names each
adapter reads, so a parser change that breaks them is a real regression.

**Captured 2026-10-15 (probe rounds 5–7)** — `fpsc-jobs.sample.json` is the first six notices of FPSC's `/api/jobs?includeExpired=true`
(verbatim; the active list was empty that day, which is why the pipeline uses the synthetic `fpsc-jobs.active.json`, a single
real-shaped notice titled `(fixture)`). `pts-projects.sample.json` is PTS's real `/Projects/getProjects/` response plus one
synthetic open project, also titled `(fixture)`, because every real project was finished and carried a placeholder date.

`pakistanjobsbank.sample.html` is the real markup of that board's table (the first nine advertisements); `gopunjab.sample.html`
is real cards cut verbatim from its `/jobs/` list (six jobs, in the shapes the page uses: full card, compact card with a
"days left" badge, plain link).
