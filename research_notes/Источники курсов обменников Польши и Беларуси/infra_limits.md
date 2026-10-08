# Free-tier infrastructure for a periodic exchange-rate scraper (Cloudflare Workers + Cron + D1, and alternatives) — as of 2026-10-08

All official-doc values below were read on **2026-10-08** unless noted. No traffic was sent to any exchange-rate site.

## 1. Cloudflare Workers Free plan: limits relevant to cron-driven scraping

### Takeaway
Workers Free gives you 100k requests/day, **5 Cron Triggers per account**, a 15-minute wall-clock limit for cron runs, but only **10 ms CPU per invocation** and **50 outbound subrequests per invocation**. That is enough for a 15-minute refresh of 2 cities from a few JSON/light-HTML sources. It is not enough for a single-invocation weekly crawl of hundreds of pages. Queues, Workflows and Durable Objects (SQLite) are all available on Free and can split that crawl across many invocations.

### Cited Findings
- Workers Free: Requests **100,000/day**, resetting at midnight UTC. — [CF Workers limits](https://developers.cloudflare.com/workers/platform/limits/) (seen 2026-10-08)
- CPU time per HTTP request **10 ms**; CPU time per Cron Trigger **10 ms**. — [CF Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- Subrequests per invocation **50**. Subrequests to internal Cloudflare services **1,000**. — [CF Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- Duration (wall clock) for Cron Triggers **15 min**. The page says scheduled Workers have "a maximum wall time of 15 minutes per invocation". Waiting on network I/O counts toward wall time but not toward CPU time. — [CF Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- Cron Triggers per account: **5**. Memory per isolate **128 MB**. Worker size **64 MiB**. Workers per account **100**. Simultaneous open connections **6**. — [CF Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- Cron Triggers:
  - They take standard 5-field cron syntax, the finest example being `* * * * *` (every minute), and run in UTC.
  - Changes can take up to 15 minutes to propagate.
  - Cron Workers "will run on underutilized machines". The docs don't say where they run or whether runs are guaranteed to be punctual or never skipped.
  - Source: [CF Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- **Queues are available on Free**: **10,000 operations/day** included, message retention **24 h (non-configurable)**. — [CF Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/)
- **Workflows on Free**:
  - 1,024 steps per Workflow.
  - "50 per request" subrequests per instance.
  - **10 ms CPU per step**, unlimited wall time per step.
  - 100 concurrent instances per account.
  - `step.sleep` up to 365 days.
  - Completed instances are kept for 3 days.
  - Source: [CF Workflows limits](https://developers.cloudflare.com/workflows/reference/limits/)
  - The Paid column of that page is internally inconsistent (50,000 vs 10,000 concurrent instances). That doesn't affect Free.
- **Durable Objects are available on Free**, with the SQLite storage backend only.
  - Free daily limits: 100,000 requests, 13,000 GB-s duration, 5M rows read, 100k rows written, 5 GB stored. Limits reset at 00:00 UTC.
  - Alarm invocations count toward requests, and each `setAlarm()` counts as one row written.
  - Source: [CF Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- HTMLRewriter: the API page shows `new HTMLRewriter().on(...).transform(res)` on a fetched Response. It says nothing about plan restrictions. — [CF HTMLRewriter](https://developers.cloudflare.com/workers/runtime-apis/html-rewriter/)

### Inferences
- **10 ms CPU is the binding constraint**, not wall time. Fetching pages and waiting on them is cheap. Parsing large HTML (regex or DOM over 200–500 KB pages) can exceed 10 ms. Prefer sources with JSON endpoints. For HTML, use streaming HTMLRewriter and extract only the selectors you need.
- **50 subrequests per invocation**: one `*/15 * * * *` cron covering 2 cities × 5–10 sources is about 10–20 fetches plus a few D1 calls. That fits.
- **5 Cron Triggers per account** is enough. Suggested split:
  - one `*/15` cron for the hot cities;
  - one weekly cron that kicks off the rebuild;
  - optionally one daily cleanup cron.
- **Request budget**: 96 cron runs/day plus PWA API traffic, far under 100k/day.
- **Weekly rebuild of hundreds of pages at ≥1 s pace** can't run in one Free invocation because of the 50-subrequest cap. Free options:
  - **(a) Queues:** the weekly cron enqueues one message per branch page. A consumer with `max_batch_size` ≤ ~40 does the fetches. Each message costs roughly 3 operations (write, read, delete), so 10k ops/day means about 3,000 messages/day. That is enough for "hundreds".
  - **(b) Workflows:** one step per page (or per small batch of pages) with `step.sleep("1 second")` between them. Up to 1,024 steps per instance. Each step gets its own 10 ms CPU budget.
  - **(c) Durable Object alarm loop:** process N pages per alarm, then call `setAlarm(now + 1s)`.
  - Of these, Workflows map most naturally to "hundreds of requests at ≥1 s pace". Queues are simpler.
- **On-demand cities**: a PWA request for a non-hot city can trigger a fetch inside the HTTP request handler, cache the result in D1 with a TTL, and then serve from cache. Same 50-subrequest and 10 ms CPU limits apply.

### Gaps
- No official statement on whether cron runs are guaranteed punctual or how often they are skipped or delayed.
- Not documented whether HTMLRewriter's native parsing counts fully toward the 10 ms CPU limit. Needs an empirical check on our own Worker using `wrangler tail` CPU metrics.
- The "50 per request" subrequest wording for Workflows on Free is ambiguous: per step vs per instance. Treat it as 50 per step invocation until tested.

## 2. D1 and KV Free plan limits

### Takeaway
D1 Free:
- 5M rows read/day, **100k rows written/day**
- 10 databases, 500 MB max per DB, 5 GB per account
- 50 queries per Worker invocation

Rows written is the limit that will bite if every rate tick is stored as a row. KV Free allows only 1,000 writes/day, so it's unsuitable as the primary store for 15-minute updates.

### Cited Findings
- D1 Free:
  - 10 databases per account.
  - **500 MB max database size**.
  - 5 GB storage per account.
  - **50 queries per Worker invocation** (subrequest limits apply).
  - Time Travel: 7 days.
  - Source: [CF D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- D1 Free: **5 million rows read/day**, **100,000 rows written/day**, 5 GB storage.
  - When a daily cap is hit, "Queries stop running for the rest of the day."
  - "Free limits reset daily at 00:00 UTC."
  - Source: [CF D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- D1 can also be written from outside Workers via REST: `POST https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{database_id}/query`. It needs an API token with D1 Read/Write. No rate limit is documented on that page. — [CF API: D1 query](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/)
- KV Free:
  - 100,000 reads/day.
  - **1,000 writes/day** (to different keys) and 1 write/s to the same key.
  - 1 GB storage.
  - 25 MiB max value size.
  - 1,000 operations per invocation.
  - Source: [CF KV limits](https://developers.cloudflare.com/kv/platform/limits/)

### Inferences
- **Write budget math.** Assume about 300 offices across Warsaw + Minsk, 4 currencies, buy/sell stored in one row, refreshed 96×/day. That is about 115k rows/day, which **exceeds 100k**. Mitigations:
  - Upsert only when a rate changed. Most kantor rates change a few times a day, not every 15 minutes.
  - Or store one row per (source, city) snapshot as a JSON blob. That is about 20 rows per tick, or roughly 2k rows/day.
  - Keep history only as hourly or daily aggregates.
  - Secondary indexes likely add to rows-written per insert (not verified here). Keep indexes minimal on the hot table.
- 50 queries per invocation: use `db.batch([...])` to group statements. A batch likely counts as one call, but verify this.
- KV (1,000 writes/day) can hold one "latest snapshot per hot city" key. 2 keys × 96 = 192 writes/day, which is fine, and gives cheap 100k reads/day for the PWA. D1 stays the system of record.

### Gaps
- Not confirmed in the docs whether `db.batch()` counts as 1 or N toward the 50-queries-per-invocation limit.
- Not confirmed in the docs whether index maintenance counts as extra rows written.

## 3. Blocking of Cloudflare Workers egress by Belarusian/Polish sites

### Takeaway
I found no specific reports for myfin.by, select.by, belarusbank.by or kantor.live blocking Cloudflare Workers. There is one hard official data point: Belarusbank states its **payment** APIs work for non-residents **only from Belarusian IP addresses**. Other Belarusian bank sites have reportedly been unreachable from abroad. Geo-blocking of .by sources from any non-Belarus host (Cloudflare, GitHub, Oracle) is a real risk. Validate each source manually from your own browser/VPN before building on it.

### Cited Findings
- Belarusbank FAQ on business payment APIs: asked whether non-residents can use the payment APIs, the bank answers "Да, могут. Но только с белорусских IP-адресов." (Yes, but only from Belarusian IP addresses.) — [belarusbank.by payment API](https://belarusbank.by/o-banke/for-developers/api-platezhey-dlya-biznesa/)
- Belarusbank publishes informational APIs, including exchange rates by branch/city (`kursExchange`, `city` GET param). It also lists an open-banking endpoint `https://belarusbank.by/open-banking/v1.0/banks/AKBBBY2X/exchange`. Neither page states a geo restriction for these informational APIs. — [Belarusbank info APIs](https://belarusbank.by/o-banke/for-developers/informatsionnye-api/), [API курсы валют](https://belarusbank.by/o-banke/for-developers/informatsionnye-api/api_kursy_valyut/)
- A Zerkalo article reports the sites of Belinvestbank, Belagroprombank and Statusbank could not be opened from abroad; a Belagroprombank call-centre confirmed this. Publication date is unclear, and Belarusbank is not mentioned. — [news.zerkalo.io](https://news.zerkalo.io/economics/11059.html) (via search snippet; not fully read)
- Habr Q&A threads describe Cloudflare-fronted sites returning a Cloudflare challenge/403 to curl/scraper clients even with cookies/delays. These are generic, not about myfin.by. — [qna.habr.com/q/1391686](https://qna.habr.com/q/1391686), [infostart forum](https://forum.infostart.ru/forum9/topic316461/message3092113/)
- A Cloudflare Workers subrequest that gets 403 with `cf-mitigated: challenge` means the target's bot protection served a challenge. Also, `wrangler dev --remote` adds a `cf-workers-preview-token` header, and requests to other Cloudflare zones are discarded in that mode, so local tests can mislead. — [CF Workers known issues](https://developers.cloudflare.com/workers/platform/known-issues/); the challenge-header detail is from a third-party blog: [blog.send.win](https://blog.send.win/?p=8190)

### Inferences
- **Workers egress is not a Belarusian IP.** Cron Workers also run on "underutilized machines" in unspecified locations. Any source that geo-restricts to BY IPs will fail from Workers, GitHub Actions (Azure US) and Oracle (no BY region) alike. Changing provider won't fix this. Only a Belarus-located collector would. Options for that:
  - a home machine or Raspberry Pi in Belarus;
  - a friend's device;
  - a cheap BY VPS (not free).
- Workers traffic is identifiable as Cloudflare-originated, and Worker fetches to sites that are themselves on Cloudflare may be treated differently. That could get them challenged or blocked by Bot Fight Mode. This is a plausible risk, but no source confirms it for these sites.
- Polish kantor sites are generally not geo-restricted to PL (EU). The main risk there is generic bot protection. Unverified for kantor.live.
- Aggregators like myfin.by/select.by are more likely to use anti-bot protection than bank JSON APIs. Prefer official bank APIs (Belarusbank `kursExchange`/open-banking, NBRB) and test reachability from a non-BY IP before committing.

### Gaps
- No direct reports found of myfin.by, select.by, belarusbank.by or kantor.live blocking Cloudflare Workers or datacenter IPs.
- Unknown whether Belarusbank's informational exchange API (as opposed to the payment API) is geo-restricted. This must be checked manually (e.g. one browser request via a non-BY VPN). It wasn't tested here, per the constraints.
- Unknown whether Cloudflare has a PoP in Belarus, or where cron Workers execute.

## 4. Free alternatives for the scraping part

### Takeaway
**GitHub Actions in a public repo** is the most practical free alternative:
- unlimited standard-runner minutes;
- schedules every 5 min or longer, but with delays and possible drops;
- well suited to the weekly crawl of hundreds of pages;
- can write to D1 via the REST API.

Vercel Hobby cron is once per day only. Fly.io has no free tier for new accounts. Render Free does not include cron jobs. Oracle Always Free is generous (2 OCPU/12 GB Arm VM) but requires a card for sign-up and reclaims idle VMs. Deno Deploy Free has a modest monthly CPU budget.

### Cited Findings
- **GitHub Actions `schedule`:**
  - "The shortest interval you can run scheduled workflows is once every 5 minutes."
  - Runs can be delayed during high load, such as the top of the hour. "If the load is sufficiently high enough, some queued jobs may be dropped."
  - In public repos, scheduled workflows are auto-disabled after 60 days with no repository activity.
  - Only the default branch runs.
  - Source: [GitHub docs: events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
- **GitHub Actions billing:**
  - Standard GitHub-hosted runners are free in public repos. No cap is stated, but the word "unlimited" isn't used.
  - Private repos on GitHub Free get **2,000 min/month**.
  - Artifacts/Packages: 500 MB. Cache: 10 GB per repo.
  - Source: [GitHub billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- **Vercel Hobby cron:** 100 cron jobs per project, but a **minimum interval of once per day**, with ±59 min precision. More frequent expressions fail at deploy. — [Vercel cron usage & pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) (page last_updated 2026-07-15)
- **Render:**
  - Free instances exist only for web services, Postgres, Key Value and static sites. "Other service types don't support Free instances", so no free cron jobs or background workers.
  - Free Postgres expires 30 days after creation.
  - Free web services spin down when idle; a third-party guide says after 15 min.
  - Sources: [Render free docs](https://render.com/docs/free); idle detail from [unanswered.io](https://unanswered.io/guide/render-free-tier-details) (third-party)
- **Oracle Cloud Always Free:**
  - 2× VM.Standard.E2.1.Micro (1/8 OCPU, 1 GB).
  - A1 Arm: 1,500 OCPU-h + 9,000 GB-h/month, about 2 OCPU / 12 GB.
  - 10 TB/month outbound.
  - Instances must be in the home region.
  - Idle instances may be reclaimed if, over 7 days, p95 CPU < 20%, network < 20% and (A1 only) memory < 20%.
  - Source: [Oracle Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
  - Credit card required at sign-up for identity verification: from general knowledge, **not verified on the page**.
- **Deno Deploy Free:**
  - 1M requests/month, 20 GiB egress, **10 h active CPU**, 150 GiB-hr memory.
  - KV: 1 GiB, 1M reads, 500k writes per month.
  - 10 apps.
  - The pricing page doesn't mention cron limits or a card requirement.
  - Source: [Deno Deploy pricing](https://deno.com/deploy/pricing)
  - A third-party tracker says these limits were cut in Aug 2026 from 15 h CPU / 100 GB egress, as listed in Deno's Feb 2026 GA post. — [agentdeals PR](https://github.com/robhunter/agentdeals/pull/2115), [Deno GA blog](https://deno.com/blog/deno-deploy-is-ga)
- **Fly.io:** no free tier for new orgs. New accounts get a trial (≈2 machine-hours or 7 days), then need a card. Legacy plans keep their allowances. — third-party only: [costbench](https://costbench.com/software/cloud-infrastructure/fly-io/free-plan/), [agentdeals Fly.io](https://agentdeals.dev/vendor/fly-io). Not verified on fly.io; one other source contradicts it.

### Inferences
- **GitHub Actions, public repo:**
  - Fits the weekly rebuild well: a Python/Node script with `sleep(1)` between hundreds of requests. GitHub-hosted job time limit is 6 h per job (from general knowledge, not fetched).
  - Results can be pushed to D1 via the REST endpoint using a scoped API token stored as a repo secret, or committed as JSON to the repo or Pages.
  - It's a poor primary for the strict 15-min refresh, because schedules can be delayed or dropped. Fine as a backup.
  - Egress IPs are Azure (mostly US), so the geo-block issue for .by sources is the same as for Cloudflare.
  - A public repo exposes the scraper code but not secrets.
  - The 60-day inactivity auto-disable needs a keepalive commit or a workflow that touches the repo.
- **Oracle A1:** a real always-on VM with a fixed public IP, able to run anything including headless browsers. Downsides: credit card, reclamation risk for a light cron workload (p95 CPU < 20% is likely, so it could be reclaimed), and no BY region. A "keep-busy" trick is common but against the spirit of the tier.
- **Deno Deploy:** supports `Deno.cron`, but the 10 h CPU/month free budget and missing cron limits on the pricing page make it a secondary choice. It can write to D1 via REST.
- **Not suitable for 15-min scraping on free:** Vercel Hobby (daily only), Render Free (no cron), Fly.io (no free tier).

### Gaps
- `Deno.cron` frequency limits on the Free plan weren't found in official docs.
- Oracle's credit-card requirement wasn't verified on an official page in this session.
- Fly.io free status was confirmed only by third-party aggregators.

## 5. Recommended architecture (free, no card)

### Takeaway
Use **Cloudflare Workers Free + D1 + Queues/Workflows** as the core:
- an API for the PWA;
- a 15-min cron for Warsaw and Minsk;
- on-demand fetch with D1 cache for other cities;
- a weekly rebuild fanned out via Queues or Workflows.

Use a **public-repo GitHub Actions** workflow as the fallback crawler for the weekly branch rebuild and for any source that needs heavy parsing. Plan for a Belarus-located collector (home device) only if a key .by source turns out to be geo-blocked.

### Cited Findings
- Per-invocation limits that drive the design:
  - 50 subrequests and 10 ms CPU per invocation, 15 min wall clock for cron, 5 crons per account. — [CF Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
  - D1 100k rows written/day. — [CF D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
  - Queues 10k ops/day. — [CF Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/)
  - Workflows: 1,024 steps per instance, 10 ms CPU per step. — [CF Workflows limits](https://developers.cloudflare.com/workflows/reference/limits/)
  - GitHub Actions: 5-min minimum schedule, public repos free. — [GitHub events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows), [GitHub billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)

### Inferences
Proposed design:

1. **Hot refresh.** Cron `*/15 * * * *` → Worker `scheduled()`:
   - Fetch about 10–20 source endpoints for Warsaw and Minsk using `Promise.all`. Mind the limit of 6 simultaneous connections.
   - Parse with HTMLRewriter or JSON.
   - Diff against the last snapshot. Write only changed rows, or one JSON snapshot row per (source, city), to D1 in a `batch()`.
   - Optionally put a "latest" blob per city in KV for cheap reads.
   - If one invocation risks 10 ms CPU, split into 2–3 crons at offsets (`0,15,30,45` / `5,20,35,50`), one per source group. There are 5 crons available.
2. **On-demand cities.**
   - The PWA calls `/rates?city=X`.
   - The Worker serves from D1 if the data is less than N min old.
   - Otherwise it fetches the sources for X, under 50 subrequests, stores the result and returns it.
   - Add a per-city lock (a D1 row or a Durable Object) to avoid stampedes.
3. **Weekly rebuild** of branches and coordinates.
   - Option A, all Cloudflare: the weekly cron enqueues one message per branch URL into a Queue (hundreds of messages is far under 10k ops/day). The consumer handles small batches, `max_concurrency` 1, with ~1 s spacing via `delaySeconds`, and upserts into D1. Alternatively, a Workflow with one `step.do` per page plus `step.sleep('1 second')`.
   - Option B, GitHub Actions: a weekly `schedule` in a public repo runs a script with polite 1 s pacing, then bulk-upserts to D1 via the REST `/query` endpoint, or writes a JSON file that the Worker imports.
     - Pros: no 10 ms CPU limit, easier debugging, can geocode.
     - Recommended for the rebuild if parsing is heavy.
4. **Geo-blocked .by sources.** If verification shows a source refuses non-BY IPs, put a small collector script on a device in Belarus (cron every 15 min). It posts results to a Worker endpoint protected by a shared secret. The Worker writes them to D1. This is the only free way around BY-IP restrictions. Proxies or VPN rotation to evade blocks are not recommended because of ToS and legal risk.
5. **Budget check** (Free):
   - Requests: ≈96–300 cron invocations/day + PWA traffic, well under 100k/day.
   - D1 writes: with diff-only or snapshot rows, about 2k–20k/day, under 100k.
   - D1 reads: 5M/day. Serve the PWA from KV or edge cache to save reads.
   - Queues: a few hundred messages/week, about 1–2k ops, under 10k/day.
   - No credit card needed for Cloudflare Workers Free or GitHub public repos (general knowledge; Cloudflare docs didn't state it on the pages read).

### Gaps
- Real CPU cost of parsing each specific source page under 10 ms is unknown. Prototype and measure with `wrangler tail` / dashboard CPU metrics.
- Reachability of each .by source from non-BY datacenter IPs is unverified. It must be checked manually before committing to the Cloudflare/GitHub-only design.
