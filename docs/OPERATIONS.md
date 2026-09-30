# Running RAAHI

For the person who deploys it and the person who gets the call when it breaks.

RAAHI is a single Next.js application with an embedded SQLite database. There
is no queue, no cache server and no external datastore to run — which is
deliberate: fewer moving parts means fewer things to fail at 2am.

---

## Deploying

```bash
npm ci                    # or: npm install
npm run verify            # typecheck + test + build — do not skip this
npm run build
npm start                 # serves on $PORT, defaults to 3000
```

`npm run verify` is the gate. If it fails, the build is not safe to ship: the
tests encode promises the product makes to citizens (sources are cited, donor
numbers are masked, emergencies are detected).

### Behind a proxy

RAAHI reads `x-forwarded-for` / `x-real-ip` for rate limiting. If you run it
behind nginx or a CDN, make sure that header is the **real** client IP and not
spoofable, or the rate limits can be bypassed. With nginx:

```nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Real-IP       $remote_addr;
```

The app sets `Strict-Transport-Security` only when `NODE_ENV=production`, so
run it in production mode on a real deployment.

---

## Environment

Every variable is optional — that is the point. RAAHI runs fully without any
of them and upgrades itself when you add them.

| Variable | What it does when set |
|---|---|
| `DASHSCOPE_API_KEY` | Enables the Qwen models: chat, translation, vision/OCR, speech. **Without it every one of these still works**, just with the deterministic fallback. |
| `RAAHI_DB_PATH` | Where the SQLite file lives. Default `data/raahi.db`. |
| `SERPER_API_KEY`, `BRAVE_SEARCH_API_KEY`, `GOOGLE_CSE_API_KEY` + `GOOGLE_CSE_CX` | Live web search. Without them, search answers from the local corpus only. |
| `RAAHI_LIVE_SEARCH_BUDGET` | Max live web searches per deployment per hour. Unset means a sane default. |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin for SEO. Set it to your real domain in production. |
| `RAAHI_BUILD_COMMIT` | Reported by `/api/health` so you can tell which code is running. Most CI systems can set this. |

Copy `.env.example` to `.env.local` to start. Never commit a real `.env` —
`.gitignore` blocks it, and a test fails the build if that protection is
removed.

---

## Checking that it is healthy

```
GET /api/health
```

```json
{
  "status": "ok",
  "ready": true,
  "version": "1.0.0",
  "capabilities": { "ai": true, "webSearch": false, "database": true },
  "providers": {
    "dashscope-chat": { "open": false, "failures": 0, "retryInSeconds": 0 }
  },
  "dataFreshness": { "total": 114, "fresh": 72, "aging": 36, "stale": 6, "staleIds": [] }
}
```

Read it like this:

- **`status`** — `ok`, or `degraded`. It is **never** a 5xx, even when the AI
  provider is down, because RAAHI still answers from its own verified data. Do
  not configure your load balancer to eject a degraded instance: ejecting it
  removes the only thing still serving citizens.
- **`providers.*.open`** — `true` means we tried the provider, it failed
  repeatedly, and we have stopped calling it for a while. Look at the logs for
  the reason. It clears itself automatically by letting one request through
  once the circuit has cooled.
- **`dataFreshness.staleIds`** — records nobody has re-checked within their
  threshold. This is your content review queue. A stale scholarship deadline is
  a citizen who travels across town for nothing.
- **`version`** — which code is actually running.

`/api/health` is `no-store`, so it is safe to poll. Once a minute is plenty.

---

## Backing up

Everything a citizen has entrusted to RAAHI is one file: the SQLite database at
`RAAHI_DB_PATH` (default `data/raahi.db`). There is no other durable state —
no uploaded images are kept, and sessions are cookies.

```bash
# SQLite's own online backup is safe while the app is running.
sqlite3 data/raahi.db ".backup '/backup/raahi-$(date +%F).db'"
```

Keep `-wal` and `-shm` files out of any copy made by naive file sync; use
`.backup` (or `VACUUM INTO`) rather than `cp` on a live database.

Restore by stopping the app, replacing the file, and starting it again.

---

## Logs

RAAHI logs to stdout only, in a few deliberate places. There is no log file to
rotate and no PII in the logs.

| What you see | What it means |
|---|---|
| `provider <name> failed, using fallback` | A model call did not work. The citizen was served from verified data instead. Check the key and network. |
| `Qwen API call failed, falling back to verified RAG services` | Same, on the main chat path. |
| `Qwen stream failed mid-answer` | The connection dropped part way through. The chat finished with verified services rather than hanging. |
| `stripped a prompt-injection pattern from user input` | Someone is probing the assistant. Blocked automatically; worth watching if frequent. |

If `provider ... failed` repeats, the circuit will open and you will see it in
`/api/health` — that is the system protecting itself, not a new fault.

---

## When something goes wrong

**The AI is slow or down.** RAAHI keeps working. Chat answers from the
knowledge base, OCR says it cannot read the document instead of guessing,
translation falls back to the glossary, and text-to-speech hands a speaking
plan to the browser. Nothing shows an error to the citizen. Fix the key or the
network when convenient.

**Search results look thin.** Without a search API key, search covers only the
local corpus. That is by design, not a failure — the corpus is curated and
cited.

**A record is wrong.** Do not edit it in place from production. Raise it
through `/kb` so it goes through review with evidence; the correction queue
exists so that "someone changed a fee" is always auditable.

**The database is locked.** Two processes are using the same
`RAAHI_DB_PATH`. Run one instance, or give each its own file.

---

## Scaling

RAAHI is comfortably single-instance: the database is local and the knowledge
set is small. If you run several instances, be aware of two things:

1. **Rate limiting is per instance.** With N instances the effective ceiling is
   `limit × N`. That trade-off is deliberate — an approximate ceiling beats
   adding Redis as a dependency that can fail.
2. **Each instance needs its own database file**, or move to a networked
   database. Do not point two instances at one SQLite file over a network
   mount; SQLite does not tolerate it.

Provider circuits are also per instance, which is the right granularity: they
protect that instance's visitors from a slow dependency.
