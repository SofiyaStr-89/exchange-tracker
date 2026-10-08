# Belarus aggregators of per-branch bank exchange rates (recon 08.10.2026)

Method: direct recon on 08.10.2026, about 16:08 local machine time. The pages show times of 17:01–17:11, which fits Minsk time (UTC+3). Requests used User-Agent "ExchangeMapRecon/0.1 (personal non-commercial project)", were spaced ≥2.5 s apart, and were capped at ≤3 content requests per site plus robots.txt. Web searches were also used. Raw HTML was saved in the session scratchpad and is not in the project. All counts below are for **Minsk**, measured in one snapshot.

## 1. Which aggregators exist and what each exposes (coverage, fields, format, requests per city, freshness, robots)

### Takeaway
Two pages each return **all banks' Minsk exchange points in one request**. **myfin.by/currency/minsk** returns 530 branches of 22 banks, with a per-branch rate time and embedded per-branch JSON, but no coordinates. **kurs.onliner.by** returns 472 rows (about 455 unique addresses) of 22 banks **with coordinates**, but no per-branch time and no PLN/CNY. select.by needs one request per bank and its JSON lives under robots-disallowed /api/. banki24.by, bankibel.by and infobank.by only show city-level best rates or per-bank pages and add nothing beyond these two.

### Cited Findings

**myfin.by — `/currency/minsk` (city "all banks" page): the best single source found**
- One GET of `https://myfin.by/currency/minsk` (2.1 MB HTML, HTTP 200) returned **530 branch rows from 22 banks**. Rows per bank: belarusbank 134, technobank 54, mtbank 49, belswissbank 36, belagroprombank 33, alfabank 31, rrb-bank 26, bps-sberbank 22, bnbank 21, belinvestbank 20, paritetbank 19, belgazprombank 15, priorbank 14, bank-vtb 12, statusbank 12, dabrabyt 9, bvebank 8, zepterbank 5, btabank 4, reshenie 2, belinkasgrupp 2, tkbank 2. — [myfin.by/currency/minsk](https://myfin.by/currency/minsk) (own fetch 08.10.2026)
  - The step-1 recon assumed 21 per-bank requests. This one page replaces all of them.
- Each row is `<tr data-bank-sef-alias="<bank>">`. It contains:
  - the branch link `/bank/<bank>/department/<id>-<slug>`, which gives a stable branch ID;
  - the address text;
  - a **per-branch update time** `<i class="ic-update-time"></i> 17:07` (time of day only, no date);
  - USD/EUR/RUB buy/sell cells;
  - a hidden input `data-branch-converter="rates"` holding JSON per branch, for example `{"USD":{"buy":3.02,"sell":3.07,"multiplier":1},"EUR":{...},"RUB":{"buy":3.4098,"sell":3.61,"multiplier":100}}`.
  — [myfin.by/currency/minsk](https://myfin.by/currency/minsk) (own fetch)
- Update-time distribution in the snapshot: 17:06 ×218, 17:08 ×210, 17:07 ×86, 17:01 ×15, missing ×1. The rates had been refreshed within about 10 minutes of the fetch. — own fetch. The MTBank page states the data is updated every 30 minutes. — [myfin.by/bank/mtbank/currency](https://myfin.by/bank/mtbank/currency)
- The main city page carries **USD, EUR and RUB (per 100) only**. There are separate currency pages `/currency/{pln,cny,gbp,chf,czk,try,uah,kzt,gel,aed,…}`, linked from the Minsk page. — own fetch
- `GET /currency/pln/minsk` redirected to `/currency/pln`. It returned **273 Minsk branch rows from 14 banks** with PLN **per 10** (`"multiplier":10`), in the same row format with per-branch time and hidden JSON. Typical values were 7.30/7.95 for Belarusbank and 7.65/7.90 for BNB. The city appears to come from a cookie or default rather than the URL; this is a guess. — [myfin.by/currency/pln](https://myfin.by/currency/pln) (own fetch)
- **Data-quality warning:** on the PLN page, all 8 bvebank rows had buy 0.1 / sell 9 (per 10 PLN). These are placeholder or garbage values and must be filtered, for example by deviation from the NBRB rate. — own fetch
- No coordinates appear on the city page: there are 0 matches for "lat", "coord" or "ymaps". There are also no opening hours and no open/closed text. Each row has a `data-has-appointment` flag (booking available). — own fetch
- City pages exist for many towns, for example `/currency/brest`, `/currency/baranovichi`, `/currency/bobrujsk`, `/currency/pinsk` and about 100 more slugs linked from the Minsk page. — own fetch; [myfin.by/currency/pinsk](https://myfin.by/currency/pinsk)
- robots.txt (served gzip-encoded):
  - allows `/currency/<city>`;
  - disallows `*?*` (any query string, so `/ajax-map/map-json?mapObjectId=…` is disallowed for crawlers);
  - disallows `/currency/*/*-*-*`, `*/city`, `/special-currency/`, `/frame*`;
  - has no Crawl-delay.
  — [myfin.by/robots.txt](https://myfin.by/robots.txt)
- The site disclaimer says rates are for reference only, may change during the day, and should be confirmed by phone. — [myfin.by/bank/mtbank/currency](https://myfin.by/bank/mtbank/currency)
- The Myfin mobile app (iOS id1542783124; Android `com.myfin_demo`) advertises a map of branches, exchange offices and ATMs and best rates. This implies a private app API. — [App Store](https://apps.apple.com/app/apple-store/id1542783124); [Google Play](https://play.google.com/store/apps/details?id=com.myfin_demo&hl=en_US); [myfin app review](https://myfin.by/article/money/konverter-lucsie-kursy-valut-i-otdelenia-bankov-obzor-prilozenia-myfin?app=true)

**kurs.onliner.by: the only one-request source with coordinates (Minsk)**
- One GET of `https://kurs.onliner.by/` (2.9 MB HTML) contains server-rendered "more options" tables for six instruments: 1 USD, 1 EUR, 100 RUB, cross EUR/USD, EUR/RUB and USD/RUB. Each table has **472 rows from 22 banks (about 455 unique addresses)**. — [kurs.onliner.by](https://kurs.onliner.by/) (own fetch 08.10.2026)
- Row format is `<tr class="merge"><td class="bank"><b>Беларусбанк</b></td><td>3,0350</td><td>3,0800</td><td class="address"><a class="pseudolink show-map" data-address="ул. Ванеева, 18" data-latitude="27.6121" data-longitude="53.882" …>` followed by `<td>Отделение №511/176 АСБ</td>`.
  - Coordinates have **4 decimals, and the attribute names are swapped**: `data-latitude` actually holds longitude (27.x) and `data-longitude` holds latitude (53.x).
  - Each row also gives the branch or office name.
  — own fetch
- The page has only a global "Обновлено меньше минуты назад" ("updated less than a minute ago"). There is **no per-branch timestamp, no hours, and no PLN/CNY**: 0 matches for PLN, CNY, злот or юан. — own fetch
- No city selector was found: links point only to `https://kurs.onliner.by/`, and the select options are only currencies. **This looks Minsk-only** (inferred; not confirmed). — own fetch
- `kurs.onliner.by/robots.txt` returns 404, so no robots rules apply. — own fetch
- No public documentation of an onliner `sdapi` endpoint for kurs was found in web search. — [search result: onliner forum](https://forum.onliner.by/viewtopic.php?t=25607220)

**select.by: per-branch data with coordinates, but one request per bank and under /api/**
- `https://select.by/kurs/` (Minsk) is a per-bank summary table: bank-level USD/EUR/100 RUB buy/sell, plus PLN/CNY links. Each bank row expands a child table "отделения <Bank>" ("<Bank> branches") whose rows are **loaded by JS**: `$.getJSON(url + <bankId>)` with `url = 'https://select.by/api/minsk/oldkurs/'`, for example bank id 20 = Альфа-Банк and 10 = Приорбанк. — [select.by/kurs](https://select.by/kurs/); [select.by/js/courses.160625.js](https://select.by/js/courses.160625.js) (own fetch)
- Branch rows contain a `a.btn-tomap` element with `data-x` / `data-y` coordinates, which open a Yandex map modal. This means select.by stores branch coordinates. — courses.160625.js (own fetch)
- There are city pages `/brest/kurs`, `/gomel/kurs`, `/grodno/kurs`, `/mogilev/kurs`, `/vitebsk/kurs`, and currency pages such as `/minsk/kurs-zlotogo` and `/minsk/kurs-kitayskogo-yuanya`. — own fetch
- robots.txt **disallows `/api/`**, as well as `/courses/` and `/current/`, so the branch JSON was not fetched. The footer says "Информация на сайте обновляется с задержкой" ("information on the site is updated with a delay"). — [select.by/robots.txt](https://select.by/robots.txt); [select.by/kurs](https://select.by/kurs/)

**banki24.by**
- `/minsk/kurs/usd` is a per-bank best-rate table with no branch detail. It has 0 matches for coords or per-branch time, and many sponsored rows. robots.txt disallows `/courses`, `/parser`, `/static` and others. — [banki24.by/minsk/kurs/usd](https://banki24.by/minsk/kurs/usd); [banki24.by/robots.txt](https://banki24.by/robots.txt) (own fetch)

**bankibel.by**
- `/kursy-valut/minsk` shows city best rates for USD, EUR, RUB, **PLN, CNY**, EUR/USD and USD/RUB. For example, best PLN buy was 7.65 and sell 7.90, against NBRB 7.8327 (per 10 PLN by implication). It links to `/<bank>/kursy-valut`, `/<bank>/otdelenija` and `/map/otdelenija`. — [bankibel.by/kursy-valut/minsk](https://bankibel.by/kursy-valut/minsk) (own fetch)
- Its robots.txt has the same structure as myfin's (`Allow: /*?page`, `Disallow: /*?*`, `/site/search*`, a Googlebot-News block), and its URL and CSS conventions are similar (`ic-arrow_right`). It is likely the same platform or owner as myfin, but this is **inferred, not confirmed**. — [bankibel.by/robots.txt](https://bankibel.by/robots.txt)

**infobank.by**
- The homepage ("Финансовый маркетплейс", a financial marketplace) has no rate, branch or map links in the HTML. robots.txt allows everything except ia_archiver. — [infobank.by](https://infobank.by/) (own fetch)

**1prime.by**
- `https://1prime.by/robots.txt` failed to connect (HTTP 000) on 08.10.2026. It is a news agency, not a rate aggregator. — own fetch

**Bank-own API (for reference)**
- Sber Bank (BY) documents a public JSON API: `developer.sber-bank.by/api/rates/v1/currencyExchange`, with an optional `idBranch` filter (for example `369-100`) that defaults to all branches. — [Sber Bank BY API description (PDF)](https://www.sber-bank.by/files/up/42533/Описание_сервиса_Курсы_валют.pdf)

### Inferences
- Requests per Minsk refresh (every 15 min):
  - myfin: 1 for USD/EUR/RUB, plus 1 per extra currency page (PLN, CNY…), so about 3.
  - onliner: 1, for Minsk only.
  - select.by: about 22, one per bank, and disallowed.
  - For about 100 cities × 3 myfin pages, that is about 300 requests per 15 min, which is heavy. A sensible plan is per-city refresh for big cities and slower refresh for small towns.
- Coordinates for myfin branches can be built **once and cached**:
  - from each department page `/bank/<bank>/department/<id>`, which has map-centre coordinates and hours per step-1 recon; this is about 530 one-off requests for Minsk, so spread them over days;
  - or by address-joining to onliner's coordinates for Minsk.
  - Branches rarely move.
- The per-branch time is time-of-day only. Assume the date is today (Europe/Minsk) and treat future times as yesterday's.

### Gaps
- Not tested: `myfin.by/ajax-map/map-json` (it needs a query string, which robots.txt disallows) and the myfin app API. Whether either returns all branches with coordinates in one call is **unknown**.
- select.by `/api/minsk/oldkurs/<id>` response shape was not fetched (robots.txt disallows `/api/`). Per-branch time and hours there are unknown.
- Onliner other-city support was not confirmed, and no JSON (sdapi) endpoint was verified.
- Terms of use pages of myfin, onliner and select were not read; only robots.txt was checked.
- Not checked: finance.zerkalo.io or other ex-TUT.BY finance pages, and the belapb.by / belarusbank own APIs.
- Not verified: whether `/currency/cny` per-branch exists like PLN (likely by analogy) and the CNY scale.

## 2. Do per-branch rates differ within a bank?

### Takeaway
**Yes, for many banks.** Belarusbank, Belgazprombank, VTB, BelVEB and Zepter had one rate tuple across all their Minsk branches. BelSwissBank, RRB, Sber, BNB and Statusbank had many different tuples. Per-branch data is needed; a "one rate per bank per city" model would be wrong.

### Cited Findings
Source for all items below: [myfin.by/currency/minsk](https://myfin.by/currency/minsk), [myfin.by/currency/pln](https://myfin.by/currency/pln), [kurs.onliner.by](https://kurs.onliner.by/) (own fetches 08.10.2026).
- **myfin, Minsk, distinct (USD, EUR, RUB) rate tuples per bank:**
  - belarusbank 1 tuple / 134 branches
  - belgazprombank 1/15
  - bank-vtb 1/12
  - bvebank 1/8
  - zepterbank 1/5
  - btabank 1/4
  - belagroprombank 2/33
  - alfabank 2/31
  - priorbank 2/14
  - belinvestbank 3/20
  - technobank 4/54
  - mtbank 4/49
  - paritetbank 5/19
  - statusbank 7/12
  - bnbank 13/21
  - rrb-bank 16/26
  - bps-sberbank 16/22
  - belswissbank 19/36
- **myfin, PLN, Minsk:**
  - belswissbank had 10 different buy/sell pairs across 12 branches;
  - technobank had 4;
  - belarusbank, mtbank and bnbank had a single pair each.
- **onliner, distinct USD buy/sell pairs per bank in Minsk:** Сбер Банк 15, Банк РРБ 12, БСБ Банк 10, БНБ-Банк 7, СтатусБанк 6, Беларусбанк 1, Альфа Банк 1. Onliner's data is consistent with myfin's.
- Some branches do not quote every currency. Empty cells appear on myfin, for example alfabank rows with only 4 of 6 values. Some banks also run separate "обменный пункт" points, for example Zepter "Обменный пункт № 1 BELGEE" on onliner.

### Inferences
- Since the city page gives all branches at once, per-branch variation does not increase the request count on myfin or onliner. It would on select.by, which needs one request per bank.

### Gaps
- Variation was not measured outside Minsk. Regional cities may be more uniform per bank (guess).

## 3. Is there one request for ALL banks' points in a city WITH coordinates? Recommended combination

### Takeaway
For Minsk, **kurs.onliner.by** gives all points with coordinates in one HTML request, but only for USD/EUR/RUB and without per-branch times. **myfin.by/currency/<city>** gives all points with per-branch time and embedded JSON for every city, but without coordinates. Recommended: use myfin as the primary rate source, add a one-off or rarely refreshed cached geocode layer (myfin department pages, with onliner coordinates as a cross-check for Minsk), and fetch myfin currency pages for PLN/CNY.

### Cited Findings
- onliner Minsk: 472 rows with `data-latitude`/`data-longitude` (swapped) for all 22 banks in one request. — [kurs.onliner.by](https://kurs.onliner.by/)
- myfin Minsk: 530 rows, 22 banks, per-branch time and JSON rates, no coordinates, in one request. — [myfin.by/currency/minsk](https://myfin.by/currency/minsk)
- myfin department pages carry coordinates and hours (from the project's step-1 recon, not re-fetched).
- select.by has coordinates per branch, but only through the per-bank `/api/…/oldkurs/<bankId>` path, which robots.txt disallows. — [select.by/js/courses.160625.js](https://select.by/js/courses.160625.js); [select.by/robots.txt](https://select.by/robots.txt)

### Inferences
**Ranking for our needs:**
1. **myfin.by `/currency/<city>` + `/currency/<cur>`.** It covers all cities, has per-branch time and IDs, and is allowed by robots.
2. **kurs.onliner.by.** One request for Minsk with coordinates; no robots restrictions; no PLN/CNY or timestamps; Minsk only.
3. **select.by.** Has per-branch coordinates, but needs N requests and sits under `/api/`, which robots disallows.
4. **bankibel.by.** City best rates only, including PLN/CNY; likely a myfin sibling.
5. **banki24.by.** Per-bank only.
6. **infobank.by and 1prime.by.** Not useful.

**Pipeline suggestion:**
- Cloudflare Worker every 15 min per city: fetch `myfin.by/currency/<city>` and parse the `tr[data-bank-sef-alias]` rows plus the hidden `data-branch-converter="rates"` JSON and `ic-update-time`.
- PLN and CNY pages for big cities, perhaps every 30–60 min.
- Static branch table `{department_id → lat, lon, hours}` filled gradually from department pages (for example ≤1 request per 5 s, once per branch, refreshed monthly).
- Sanity filters: drop rates more than ±15% from NBRB (this catches bvebank's 0.1/9 PLN rows) and stale times.
- Optional fallback for Minsk: onliner, joined by normalized address.

### Gaps
- Unknown whether the myfin ajax-map JSON or the app API would give all branch coordinates in one call. That would remove the department-page crawl, but needs a query-string request that robots.txt disallows. Ask or decide before testing.
- City-selection mechanics for myfin currency pages (cookie versus path) outside Minsk are unverified.
