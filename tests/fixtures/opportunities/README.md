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
