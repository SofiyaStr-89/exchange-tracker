# Aggregators of per-location rates of stationary kantory in Poland (recon 08.10.2026)

Method note: web search plus at most 2 direct HTTP requests per site (robots.txt + 1 page; zlata.ws, quantor.pl got robots + 2 pages), honest UA `ExchangeMapRecon/0.1 (personal non-commercial project)`. In the very first batch (kantory.pl, kantor.live, mybank.pl, kantoria.pl) the homepage and robots.txt were fetched without the 2 s pause; all later batches used >=2 s. All numbers below were observed on 08.10.2026, Warsaw afternoon (approx. 15:50-16:15 local), unless marked otherwise. Regulamin/ToS pages were NOT read for any site (budget), only robots.txt.

## Which Polish sites/apps list per-location kantor rates with timestamps (coverage, fields, exposure, freshness, robots)

### Takeaway
The best new find is **zlata.ws**: per-location table for 12 big cities with a per-kantor update timestamp, 59 of 61 Warsaw kantors updated today, plain server-rendered HTML, robots.txt allows `/pl/kantory/`. **marketportal.pl** (57 Warsaw kantors, opening hours, many currencies, retail + wholesale, 142 cities, robots allow all) and **quantor.pl** (29 Warsaw kantors with EUR rates <=3 days old, relative per-kantor timestamps, kantors self-update) complement it. None of them exposes coordinates in what I saw, so geocoding (or kantor.live / kantorymapa.pl coords) is still needed. **kantorymapa.pl** is the largest directory (3769 kantors, 746 towns) but shows NBP rates, not per-kantor rates (except a few self-reported).

### Cited Findings

**zlata.ws (Polish section `/pl/kantory/<city>/`)** — strongest candidate for fresh rates
- City list page for Warsaw: 61 rows, each row = one location (name, address "Warszawa, Fieldorfa, 41"), date+time column (`08.10 14:04`), buy/sell for USD, EUR, GBP. 59 of 61 rows dated 08.10, 1 dated 05.10, 1 dated 29.09 (counted from HTML, 08.10.2026) — [zlata.ws Warszawa](https://zlata.ws/pl/kantory/warszawa/)
- Cities with Polish lists (12): Warszawa, Białystok, Bydgoszcz, Gdańsk, Katowice, Kraków, Łódź, Lublin, Poznań, Rzeszów, Szczecin, Wrocław — [zlata.ws Warszawa](https://zlata.ws/pl/kantory/warszawa/)
- Many Warsaw rows are branches of the same brand listed separately (e.g. 8+ "Exchange Group (...)" locations, 3 "Interkantor ..." locations, 2 "Redar") — i.e. per location, not per brand — [zlata.ws Warszawa](https://zlata.ws/pl/kantory/warszawa/)
- Detail page (`/pl/kantory/warszawa/goclaw/`) adds: phone, opening hours as free text ("Poniedziałek - sobota: 09.00 - 21.00, niedziela 10.00 - 20.00"), "Ostatnia aktualizacja: 08.10.2026 в 16:04", kantor comment (wholesale thresholds), and more currencies (USD, EUR, GBP, CHF, AUD, CAD, GEL for this kantor). No coordinates / map found in HTML — [zlata.ws Centrum Gocław](https://zlata.ws/pl/kantory/warszawa/goclaw/)
- Timestamp discrepancy: list showed 14:04, detail page fetched ~1 min later showed 16:04 for the same kantor. Guess: list is in UTC and detail in Warsaw local (CEST = UTC+2), or the list is cached; must be verified before use — [list](https://zlata.ws/pl/kantory/warszawa/), [detail](https://zlata.ws/pl/kantory/warszawa/goclaw/)
- Data source: the site asks kantors wishing to be listed to send "stronę internetową z kursem wymiany" (their website with the exchange rate) → zlata.ws scrapes kantor websites; robots.txt also disallows a `/parsers/` directory — [zlata.ws detail page footer form](https://zlata.ws/pl/kantory/warszawa/goclaw/), [robots.txt](https://zlata.ws/robots.txt)
- robots.txt: `Disallow: /engine/ /ajax/ /module/ /parsers/ /template/ /xml/`; `/pl/kantory/` is allowed — [robots.txt](https://zlata.ws/robots.txt)
- Site is Ukrainian/Russian-oriented ("Українська", "Po rosyjsku" links, "в 16:04" typo in Polish text), copyright 2009-2026 — [zlata.ws](https://zlata.ws/pl/kantory/warszawa/)
- Exposure: server-rendered HTML `<table class="table">` with `<tr>` per kantor — trivially parsable; 1 request per city gives USD/EUR/GBP for all; other currencies need 1 request per kantor.

**marketportal.pl (`/kantory/<city>`)**
- Warsaw: "Aktualna liczba kantorów w mieście Warszawa to: 57", paginated (3 pages, 12 kantors with rate tables on page 1) — [MarketPortal Warszawa](https://marketportal.pl/kantory/warszawa)
- Per kantor on list page: name, district + address ("Warszawa - Śródmieście#Marszałkowska 99A"), weekly opening hours per day + "otwarte" flag, retail rates ("Kursy detaliczne") for USD/EUR/CHF/GBP visible plus "pokaż resztę kursów" (many more, e.g. ALL, GEL), spread, wholesale rates ("Kursy hurtowe obowiązują przy transakcjach powyżej 5000 zł"), link to kantor's website, "wizytówka" detail page `/kantor/<slug>` — [MarketPortal Warszawa](https://marketportal.pl/kantory/warszawa)
- Timestamp is per city, not per kantor: "Ostatnia aktualizacja kursów wymiany walut dla kantorów z miasta Warszawa odbyła się: 2026-10-08 15:49" — [MarketPortal Warszawa](https://marketportal.pl/kantory/warszawa)
- Embedded JSON city list with 142 cities (with districts) on the page — [MarketPortal Warszawa](https://marketportal.pl/kantory/warszawa)
- No coordinates found in list HTML (detail page not checked) — [MarketPortal Warszawa](https://marketportal.pl/kantory/warszawa)
- robots.txt: `User-agent: * Disallow:` (everything allowed) — [robots.txt](https://marketportal.pl/robots.txt)
- Search snippets show Kraków rates (Kantor Meritum, Union Standard) undated — [MarketPortal Kraków](https://marketportal.pl/kantory/krakow), [Kraków Stare Miasto](https://marketportal.pl/kantory/krakow/stare-miasto)

**quantor.pl (`/kantory/<city>.html`)**
- Warsaw summary: "Zestawienie obejmuje kurs waluty Euro z 29 kantorów. Ceny kupna i sprzedaży starsze niż 3 dni zostały pominięte", last change "2026-10-08 16:11:12" — [Quantor Warszawa](https://quantor.pl/kantory/warszawa.html)
- Per kantor: name, location hint ("Plac Zawiszy"), address, rating/opinions, rate for chosen currency, relative age ("1 minut temu", "4 godzin temu", "1 dni temu"), online reservation; only 7 entries server-rendered (schema.org ItemList `numberOfItems: 7`), the rest loaded via JS — [Quantor Warszawa](https://quantor.pl/kantory/warszawa.html)
- City pages for 12 big cities + 16 voivodeship pages; Mazowieckie lists ~40 towns — [Quantor kantory](https://quantor.pl/kantory/)
- Kantors self-manage rates (site has "Promuj kantor", login, `/panel/` disallowed in robots) — [Quantor kantory](https://quantor.pl/kantory/), [robots.txt](https://quantor.pl/robots.txt)
- Mobile app "Qrsy" on Google Play — [Quantor](https://quantor.pl/en/kantory/)
- robots.txt allows `/` except `/panel/`, `/panel-old/` — [robots.txt](https://quantor.pl/robots.txt)

**kantorymapa.pl** — largest directory, not a rate aggregator
- "W bazie 3769 kantorów stacjonarnych", 746 towns, 131 open 24h, 610 open on Sunday; Warszawa 249, Kraków 147, Wrocław 114, Poznań 111, Gdańsk 78, Szczecin 65, Łódź 61 — [kantorymapa.pl](https://kantorymapa.pl/)
- Shows addresses, hours, phones, map; rates are NBP ("Kursy: NBP API · Mapa: OpenStreetMap, CartoDB"); a "Realne kursy" block shows only a few self-reported stationary offers (e.g. "Conti Warszawa" EUR 4,3700/4,3500); page `/dla-kantorow/` suggests kantors can submit data — [kantorymapa.pl](https://kantorymapa.pl/)
- Next.js site; homepage does not embed the kantor list/coords; city pages `/kantor/<city>/` not fetched — [kantorymapa.pl](https://kantorymapa.pl/)
- robots.txt: `Allow: /` — [robots.txt](https://kantorymapa.pl/robots.txt)

**kantor.pl (Super Grupa PL, online kantor) — directory only**
- "baza kantorów stacjonarnych w Polsce ... dane adresowe i telefoniczne"; Warszawa (199), Radom (15), etc.; no rates, no hours, no coords; kantors add themselves for free ("Dodaj kantor za darmo"); operator disclaims accuracy — [kantor.pl Warszawa](https://kantor.pl/kantory/warszawa)
- robots.txt only blocks Yandex — [robots.txt](https://kantor.pl/robots.txt)
- Likely stale (e.g. 199 Warsaw entries incl. duplicates like "Akcent" and "Akcent. Kantor wymiany walut" at same address) — [kantor.pl Warszawa](https://kantor.pl/kantory/warszawa)

**kantory.pl** — affiliate/content site (Walutomat, InternetowyKantor ads), has `/mapa`, `/kursy` (NBP-like rates EUR 4.2858 etc.); no per-kantor rates seen on homepage; robots.txt returns HTML (none) — [kantory.pl](https://kantory.pl/)

**nakordoni.eu** — multilingual exchange directory; Gdańsk list of 29 points with addresses, hours, phones, per-kantor rate dates; search snippets showed rates dated 30.07–02.08 (i.e. stale ~2 months as of 08.10.2026). Direct request returned **403 Cloudflare block** for our UA; robots.txt is long and explicitly rate-limits crawlers — [nakordoni.eu Gdańsk](https://nakordoni.eu/pl/exchange/gdansk), [robots.txt](https://nakordoni.eu/robots.txt)

**rates.fm** — also has per-exchanger pages for stationary kantors outside Warsaw (e.g. Kantor 1913 Gdańsk, last update 20.02.2026 per search snippet = stale) — [rates.fm Kantor 1913](https://rates.fm/pl-pl/currency/exchanger/gdansk/kantor-1913/)

**Other / dead / irrelevant**
- kantor.katowice.pl has a "Kantory w Krakowie" page (not checked) — [kantor.katowice.pl](https://www.kantor.katowice.pl/kantory-krakow)
- minfin.pl (Ukrainian Minfin, Polish version): search snippet says Kraków data "1529 dni temu"; `/warszawa` returned 404 — [minfin.pl Kraków](https://minfin.pl/krakow)
- mybank.pl kursy-walut: NBP/bank rates, no kantor section found — [mybank.pl](https://mybank.pl/kursy-walut/)
- kantorowo.pl, e-kursy.pl, kantorydoplaty.pl, kantory.info, kursywalut.org: no HTTP response (DNS/connection failed) on 08.10.2026.
- kantoria.pl is a hotel in Tarnów (not a kantor site) — [kantoria.pl](https://www.kantoria.pl/)
- strefakursow.pl is an online-course site (unrelated) — [strefakursow.pl](https://strefakursow.pl/)
- bankier.pl ranks only online kantors — [bankier.pl](https://www.bankier.pl/smart/porownywarka-kantorow-internetowych)
- Google Play: single-kantor apps ("Kantor Płock", "Konik"), "Kantory w Warszawie" (Devine Duck), "Multi" (Ukrainian) — none found as a nationwide stationary-rate map — [Kantory w Warszawie](https://play.google.com/store/apps/details?id=com.devineduck.kantor&hl=pl), [Multi](https://apps.apple.com/pl/app/multi-kursy-walut-i-kantory/id1574863878?l=pl)
- Single kantors publish own rates with date (e.g. P&R Exchange Kraków, Basztowa 10, update 2 Oct 2026 per search) — [prexchange.pl](https://prexchange.pl/)

### Inferences
- Ranking for our needs (fresh per-location rates + metadata):
  1. **zlata.ws** — freshest (97% of Warsaw rows dated today), per-location, per-kantor timestamp, 1 req/city; but only 12 cities, no coords, hours as free text.
  2. **marketportal.pl** — 142 cities, structured hours, many currencies + wholesale; per-city (not per-kantor) timestamp; no coords seen; ~3 pages/city.
  3. **kantor.live** (from step 1) — only source with coords via JSON API, but only 15/80 Warsaw kantors fresh.
  4. **quantor.pl** — 29 fresh EUR rates in Warsaw, self-reported, relative times, JS-loaded (needs reverse-engineering its XHR).
  5. **kantorymapa.pl** — best master list (3769 kantors, 746 towns, hours, map → probably coords) but no real rates.
  6. rates.fm, nakordoni.eu (blocked/stale), kantor.pl (stale directory).
- Overlap between zlata.ws, marketportal and kantor.live in Warsaw seems high (same names: Redar, Respol, Zawisza, Pod Dębami, Saska, Grochowska 204, Rembielińska) — suggests all scrape the same subset of kantors that publish rates on their own websites (guess, not quantified).
- Warsaw upper bound: kantorymapa says 249 kantors, kantor.pl 199, kantor.live 80, zlata 61, marketportal 57, quantor 29 → only ~60–80 Warsaw kantors (roughly a quarter to a third) publish machine-readable online rates at all (guess).

### Gaps
- Coordinates: not confirmed for zlata, marketportal (detail page unchecked), kantorymapa city pages (unchecked).
- kantor.live mobile app API: not investigated (no store page found in searches).
- Terms of use / regulamin of zlata.ws, marketportal.pl, quantor.pl, kantorymapa.pl not read — must check before production scraping.
- Exact number of kantors per city for zlata.ws outside Warsaw, and marketportal totals across 142 cities, not measured.
- quantor.pl XHR endpoint for full list not identified.
- Google Maps "kantor" listings: only accessible via paid Places API or ToS-restricted scraping; not evaluated further.

## How aggregators get their rates (primary sources)

### Takeaway
Two mechanisms: scraping kantor websites (zlata.ws explicitly; marketportal and kantor.live likely) and self-submission by kantors (quantor.pl panel, kantor.pl/kantorymapa.pl registration). So coverage is capped by how many kantors publish rates online; going to primary kantor websites (chains like Exchange Group, Interkantor, Redar, Tavex) can improve coverage and freshness.

### Cited Findings
- zlata.ws asks kantors to send "stronę internetową z kursem wymiany" to be added; robots.txt hides `/parsers/` — [zlata.ws](https://zlata.ws/pl/kantory/warszawa/goclaw/), [robots.txt](https://zlata.ws/robots.txt)
- marketportal.pl links each kantor's own website ("strona www kantoru") and updates all kantors of a city in one batch (single city timestamp) — [MarketPortal Warszawa](https://marketportal.pl/kantory/warszawa)
- quantor.pl: kantor login/panel, "Promuj kantor", reservations — self-managed — [Quantor](https://quantor.pl/kantory/warszawa.html)
- kantor.pl: "Masz kantor? Dodaj go za darmo" — self-registration — [kantor.pl](https://kantor.pl/kantory/warszawa)
- kantorymapa.pl: "Kursy: NBP API", `/dla-kantorow/` page — [kantorymapa.pl](https://kantorymapa.pl/)
- Chains publish per-branch rates on their own sites (e.g. P&R Exchange Kraków dated 2 Oct 2026) — [prexchange.pl](https://prexchange.pl/)

### Inferences
- Batch-updating all kantors of a city at once (marketportal 15:49; zlata timestamps clustered at 11:42/11:44/11:51/11:53/11:58/14:04) suggests scheduled scraping of kantor websites, where the timestamp is the scrape time, not necessarily the kantor's own rate time (guess).
- Chains with many branches (Exchange Group ~8+ Warsaw branches, Tavex, Interkantor, Redar, Yero in Gdańsk) are high-value primary sources.

### Gaps
- marketportal.pl and kantor.live data collection method not stated on pages read.
- No GitHub project scraping Polish stationary kantors found (search returned nothing relevant; `kursywalut` package on readthedocs unverified) — [kursywalut docs](https://kursywalut.readthedocs.io/pl/latest/authors.html)

## Open dataset / official registry of kantory

### Takeaway
The NBP "Rejestr działalności kantorowej" is public at kantor.nbp.pl, but is a JSF/PrimeFaces search form (search by firm name or NIP, cookie consent required), not a downloadable dataset; it is not a practical source for a complete address list. No open dataset found.

### Cited Findings
- kantor.nbp.pl "REJESTR KANTORÓW" with "Wyszukiwanie" section; robots.txt returns 404; JSF session (`jsessionid`), cookie-acceptance gate — [kantor.nbp.pl](https://kantor.nbp.pl/)
- The register is public ("jawny"), everyone may inspect it — [LexPortal](https://lexportal.eu/mod/glossary/showentry.php?eid=6669&displayformat=dictionary)
- Search is by entrepreneur name or NIP — [kantorymapa.pl poradnik](https://kantorymapa.pl/poradnik/jak-sprawdzic-czy-kantor-jest-legalny/)
- Entry/changes procedure (address changes must be reported) — [biznes.gov.pl](https://www.biznes.gov.pl/pl/portal/ou668), [biznes.gov.pl procedura](https://www.biznes.gov.pl/pl/opisy-procedur/-/proc/646)
- Online kantors are not in this register (they are KNF payment institutions) — [kantor.nbp.pl](https://kantor.nbp.pl/) (via search summary)

### Inferences
- Best practical "master list" substitutes: kantorymapa.pl (3769) and OpenStreetMap (`amenity=bureau_de_change`, which kantorymapa itself appears to map on) — OSM not verified in this recon.

### Gaps
- Whether the NBP register lists each outlet's address (vs only the company seat) — not verified.
- Existence of a bulk export of the register (dane.gov.pl) — not found.

## Best combination recommendation for Poland

### Takeaway
Use zlata.ws as the primary fresh-rate source for its 12 cities, marketportal.pl for broader city coverage (142 cities) and hours/currencies, kantor.live API for coordinates and its fresh subset, and a master list (kantorymapa.pl or OSM) + geocoding to place everything on the map; match records by normalized address.

### Cited Findings
- zlata.ws: 59/61 Warsaw kantors updated 08.10.2026, 12 cities — [zlata.ws](https://zlata.ws/pl/kantory/warszawa/)
- marketportal.pl: 57 Warsaw kantors, 142 cities, hours, update 2026-10-08 15:49 — [MarketPortal](https://marketportal.pl/kantory/warszawa)
- quantor.pl: 29 Warsaw EUR rates <=3 days — [Quantor](https://quantor.pl/kantory/warszawa.html)
- kantorymapa.pl: 3769 kantors, 746 towns — [kantorymapa.pl](https://kantorymapa.pl/)

### Inferences
- Suggested pipeline (Cloudflare Worker, every 15 min): zlata.ws city list (12 req/run) → marketportal city pages (only cities with kantors; ~1–3 req/city; could run less often, e.g. hourly, since its timestamp is per-city batch) → kantor.live API per city (coords + hours) → merge by address; show per-kantor "rate as of" from zlata/kantor.live, and city batch time for marketportal-only entries.
- Every 15 min across 140+ cities may exceed polite limits for marketportal; consider 30–60 min and conditional requests.
- Verify zlata.ws timestamp timezone before display.

### Gaps
- No cross-source dedup rate measured; coverage outside the 12 big cities depends on marketportal and kantor.live only.
- ToS of the chosen sources not reviewed.
