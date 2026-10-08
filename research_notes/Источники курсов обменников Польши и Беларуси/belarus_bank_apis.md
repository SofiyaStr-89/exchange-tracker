# Official machine-readable rate and branch sources at Belarusian banks (checked 08.10.2026)

Method: direct HTTP checks from the researcher's machine on 08.10.2026 at about 16:08 CEST (17:08 Minsk). User-Agent was "ExchangeMapRecon/0.1 (personal non-commercial project)". At most 3 requests went to each bank domain. GitHub code search (gh) and web search were used to find endpoints. Where a finding comes from a live check, the source is the endpoint URL. All counts and values are from the 08.10.2026 responses unless noted otherwise.

## Belarusbank: kursExchange + filials_info (city values, GPS, join key, terms)

### Takeaway
Belarusbank meets every requirement with two free, keyless JSON endpoints. `kursExchange` gives per-branch buy/sell rates, and `filials_info` gives the same branches with `GPS_X`/`GPS_Y` coordinates, hours and addresses. The two join 1:1 on `filial_id`. `kursExchange` with no `city` parameter returns the whole country in one call (1102 rows, about 1.26 MB).

### Cited Findings
- `GET https://belarusbank.by/api/filials_info?city=Минск` returned 157 Minsk branches (916 KB JSON). All 157 had non-empty `GPS_X`/`GPS_Y`. Example: `GPS_X":"53.927417","GPS_Y":"27.481600"`, so **GPS_X = latitude and GPS_Y = longitude**, which is the reverse of the usual x/y convention. — [filials_info](https://belarusbank.by/api/filials_info?city=%D0%9C%D0%B8%D0%BD%D1%81%D0%BA)
- Other `filials_info` fields:
  - Identity and location: `filial_id`, `sap_id`, `filial_name` (e.g. "Отделение №510/264"), `filial_num`, `region_id`, `region`, `cbu_num`, `otd_num`, `name_type`/`name` (locality), `street_type`, `street`, `home_number`, and `*_prev` fields (old addresses).
  - Hours: `info_worktime` (pipe format `|Пн 09 00 19 00 |…|Сб |Вс |`), `info_worktime_short` (e.g. "Пн–Пт: 09:00–19:00; Сб–Вс: выходной"), `info_worktime_text` (free-text exceptions in HTML), and `info_weekend{1..7}_day`/`_time`.
  - Contacts and bank details: `phone_info`, `info_bank_bik`, `info_bank_unp`, `bel_number_schet`, `foreign_number_schet`.
  - About 130 `usl_*` 0/1 service flags. Among them are `usl_konversiya_foreign_val` (currency conversion), `usl_razmen_foreign_val` (currency change), `usl_zamen_foreign_val` and `usl_podlinnost_banknot`. — [filials_info](https://belarusbank.by/api/filials_info?city=%D0%9C%D0%B8%D0%BD%D1%81%D0%BA)
- `GET https://belarusbank.by/api/kursExchange?city=Минск` returned 137 rows.
  - Fields: `kurs_date_time`, `{USD,EUR,RUB,CZK,PLN,CAD,SEK,CHF,JPY,CNY,NOK}_in/_out`, cross rates (`USD_EUR`, `USD_RUB`, `RUB_EUR`, `CNY_USD` `_in/_out`), `filial_id`, `sap_id`, `info_worktime`, `street_type`, `street`, `home_number`, `filials_text`, `name`, `name_type`.
  - Join: all 137 `filial_id` values were found in `filials_info` for Minsk (137/137).
  - Coverage gap: 20 Minsk branches in `filials_info` have no rates row. These are probably branches without a cash exchange desk (guess). — [kursExchange Минск](https://belarusbank.by/api/kursExchange?city=%D0%9C%D0%B8%D0%BD%D1%81%D0%BA)
- `GET https://belarusbank.by/api/kursExchange` with no city parameter returned **1102 rows across 585 distinct localities** (HTTP 200, `Content-Length: 1263735`, `Cache-Control: no-store`).
  - Rows per city: Минск 137, Гомель 34, Брест 32, Гродно 25, Могилев 22, Витебск 19, Бобруйск 16, Барановичи 16, Пинск 13, Орша/Молодечно/Борисов 10 each.
  - The `city` values are the plain names found in the `name` field: "Минск", "Гомель", "Брест" and so on. No separate city list endpoint was tested. — [kursExchange all](https://belarusbank.by/api/kursExchange)
- **Timestamp caveat.** All 1102 rows carried the same `kurs_date_time` = "2026-10-07 17:20:00", even though the request was made at 17:08 Minsk on 08.10.2026. The field looks like "time the current rate set was established", not "data freshness". Rates had apparently not changed for about 24 h, or the field lags (unverified). — [kursExchange all](https://belarusbank.by/api/kursExchange)
- **A rate of "0.0000" means the currency is not offered at that branch.** Nationwide, the number of branches with a non-zero buy rate was:
  - USD, EUR, RUB: 1102 each
  - CNY 580, PLN 322
  - CHF 17, SEK 12, CZK 10, CAD 4, JPY 2 — [kursExchange all](https://belarusbank.by/api/kursExchange)
- **Units are not stated in the response.** Observed values fit NBRB scales:
  - PLN 7.30/7.98 is per 10 PLN.
  - CZK 13.00 is per 100.
  - RUB 3.15/3.59 is per 100.
  - CNY 4.53/4.70 is per 10.
  - USD 3.035/3.08 and EUR 3.37/3.44 are per 1.

  NBRB `Cur_Scale` on 08.10.2026: RUB 100, PLN 10, CNY 10, CZK 100, JPY 100, SEK 10, NOK 10; USD, EUR, CHF, CAD and GBP 1. — [NBRB rates](https://api.nbrb.by/exrates/rates?periodicity=0)
- Terms and rate limits: none in the HTTP headers (no rate-limit headers, a session cookie is set). No documentation or terms page was found. — [kursExchange all](https://belarusbank.by/api/kursExchange)

### Inferences
- A 15-minute worker needs only one `kursExchange` call per run. For the static layer, `filials_info` (no city parameter, presumably nationwide; not tested to stay within the request budget) can be refreshed daily and joined on `filial_id`. Calling `kursExchange` once nationwide is gentler on the server than calling it once per city.
- Because `kurs_date_time` changes rarely, the app should show both the "rate set at" time and its own "fetched at" time.
- `/api/atm` and `/api/infobox` were not tested (request budget). They are probably not needed for exchange points.

### Gaps
- No official Belarusbank documentation or terms of use for `/api/*` was found. Usage is undocumented and tolerated, not formally licensed.
- `filials_info` without the `city` parameter was not tested.

## Other banks: public APIs and feeds

### Takeaway
Besides Belarusbank, only two free, keyless feeds give **per-branch** rates.
- **MTBank** has an XML feed with coordinates (`currxml.php`).
- **Belgazprombank** has an XML feed of per-branch rates, but with branch *names* only.
- **Alfa-Bank** has a free public JSON API, but it gives one bank-wide rate set and no branches.
- **Sber Bank** documents a per-branch API, but its host does not resolve.
- **Belagroprombank**'s old feed now returns 404.

No machine-readable source was found for the other listed banks within this research budget.

### Cited Findings
- **MTBank**: `GET https://www.mtbank.by/currxml.php?ver=2` returned XML (309 KB) `<rates name="MTBank rates" date="08.10.2026">` with **105 `<department>` elements**.
  - Each department has the attributes `x` (longitude, e.g. 27.550138), `y` (latitude, e.g. 53.890859), `label` ("Обменный пункт №10"), `address`, `id` and `city`.
  - 79 of 105 departments have coordinates.
  - Departments by city: Минск 48, Гродно 7, Витебск 6, Брест 5, Гомель 5, Бобруйск 3, Барановичи 3, Могилев 2.
  - Each department contains `<currency><code>EUR</code><codeTo>BYN</codeTo><purchase>3.3600</purchase><sale>3.4350</sale><cacheless>0</cacheless>`.
  - Each pair appears twice per department, which matches `cacheless` 0 and 1 (cash and non-cash; inference).
  - Pairs: EUR/USD/RUB→BYN, EUR→RUB, EUR→USD and USD→RUB at every department. CNY/PLN→BYN at 48 departments. GBP and TRY at a few.
  - There are also `weight` and `metals` elements.
  - **No opening hours. The only timestamp is a date** (no time of day).
  - Units are not stated: PLN 7.40/8.00 implies per 10, RUB 3.35/3.60 implies per 100. — [MTBank currxml](https://www.mtbank.by/currxml.php?ver=2)
- **Belgazprombank**: `https://belgazprombank.by/export_courses.php` redirects (301, to an http:// URL) to `https://belgazprombank.by/upload/courses.xml`. That file (64 KB) contains **46 `<branch name="ЦБУ №501">`** elements (e.g. "ПРК №3", "Офис продаж №502/1").
  - Rates per branch are given as `<rate currency="usd" Units="1"><range min-amount="0" max-amount="9999"><buy>3.035</buy><sell>3.059</sell></range><range min-amount="10000" …>`. This means tiered rates by amount, and **the units are stated explicitly**: rub 100, pln 10, cny 10, all others 1.
  - Currencies: usd, eur, rub, uah, gbp, chf, pln, cny, plus cross pairs (eur_rub, usd_rub, usd_pln, eur_usd, gbp_usd, usd_cny and their reverses).
  - **No address, coordinates, hours or timestamp.** — [Belgazprombank courses.xml](https://belgazprombank.by/upload/courses.xml)
- **Alfa-Bank**: `GET https://developerhub.alfabank.by:8273/partner/1.0.1/public/rates` returned free, keyless JSON. It has only 6 entries:
  - EUR/RUB, USD/RUB, EUR/USD, RUB/BYN (`quantity`:100), EUR/BYN and USD/BYN.
  - Fields: `sellRate`, `sellIso`, `sellCode`, `buyRate`, `buyIso`, `buyCode`, `quantity` (unit scale), `name`, `date` ("08.10.2026", date only).
  - **These are bank-wide rates, not per branch, and the type (cash or online) is not stated.**
  - A guessed branches path `/partner/1.0.1/public/institutions` returned a WSO2 404 "No matching resource". — [Alfa rates](https://developerhub.alfabank.by:8273/partner/1.0.1/public/rates)
- The same Alfa endpoint is used by several hobby projects on GitHub (e.g. Kursownia, wunder_back, Alpha-Bank-Rates-Compose, Bookkeeping AlfaBankJob). — [Kursownia rate_getter.py](https://github.com/MaksimSurmach/Kursownia/blob/9f98fe921875a501df5ce69aee6893d80df0b5e4/Kursownia/rates/rate_getter.py); [wunder_back rates.grabber.ts](https://github.com/doctor-maxin/wunder_back/blob/c92ee49d75c3064087c096a994c9dec0b1cfa4f5/src/domains/rates/services/rates.grabber.ts)
- **Belagroprombank**: the Kursownia project uses `https://belapb.by/CashExRatesDaily.php`. On 08.10.2026 it returned **HTTP 404** ("Страница не найдена"), so the old feed is gone or has moved. — [Kursownia rate_getter.py](https://github.com/MaksimSurmach/Kursownia/blob/9f98fe921875a501df5ce69aee6893d80df0b5e4/Kursownia/rates/rate_getter.py); live check of https://belapb.by/CashExRatesDaily.php
- **Sber Bank**: the official PDF "Сервис «Курсы валют» (API)" is still hosted at www.sber-bank.by. It describes:
  - Base URL `https://developer.sber-bank.by/api/rates/v1/currencyExchange`.
  - Parameters: `exchangeType` (required: Online/ATM/Cash/Cashless), `idBranch` (e.g. "369-100", default all), `sourceCurrency`, `targetCurrency`, `direction` (buy/sell).
  - Response: `currencyExchangeList` with exchangeType, idBranch, sourceCurrency, targetCurrency, UnitCurrency, ExchangeRate, AmountMin, AmountMax, direction, DateTime, UpdatedDateTime.
  - Limit: **"не более двух запросов в минуту"** (at most two requests per minute).
  - Contact: api@bps-sberbank.by.
  - **The response has no address or coordinates, only `idBranch`.** — [Sber PDF](https://www.sber-bank.by/files/up/42533/Описание_сервиса_Курсы_валют.pdf)
- On 08.10.2026, `developer.sber-bank.by` gave curl a DNS/connection failure (no A record returned), while `www.sber-bank.by` resolves. — live check
- Sber publishes API terms "Условия оказания услуг сервисов API" as a public offer. The copy at digital-psi.sber-bank.by refused connections (ECONNREFUSED) on 08.10.2026. — [Sber API terms (search result)](https://digital-psi.sber-bank.by/files/up/42532/Условия_оказания_услуг_сервисов_API.pdf)
- **BelVEB** publishes "open-api-kursy-valyut", a PDF spec (Word 2016, August 2022). It defines a rates service with ExchangeType (Online/Cash/ATM/Cashless), SourceCurrency, TargetCurrency, ExchangeRate, AmountMin/Max, Direction buy/sell, DateTime (ISO with offset) and AdditionalData. **The extracted text gives no endpoint URL.** The field set is almost identical to Sber's, which suggests a common Belarusian open-API template (inference). — [BelVEB open API rates doc](https://belveb.by/documents/open-api-kursy-valyut)
- In October 2018, Myfin listed Alfa-Bank, Bank Moscow-Minsk (now BelVEB), Belarusbank, Belagroprombank, BSB Bank and Priorbank as banks with public "справочная информация" (reference information) APIs. The article does not specify endpoints. — [Myfin 2018](https://myfin.by/article/events/12230-budushhee-mira-finansov-kakie-belorusskie-banki-otkryvayut-api)
- Searches for official APIs of Priorbank, Belinvestbank, BNB, Dabrabyt, Paritetbank, VTB, BSB, Reshenie, RRB, Status, Technobank, TK Bank, Zepter and BTA returned only aggregator (myfin.by) pages. No developer pages were found. — [search example: myfin Priorbank](https://myfin.by/bank/priorbank/currency)

### Inferences
- A practical source set: Belarusbank (JSON, complete), MTBank (XML with coordinates), Belgazprombank (XML; branch names must be geocoded or matched once by hand against the bank's office list), and Alfa-Bank (one bank-wide rate, which could be attached to all Alfa offices only if the app labels it "bank-wide").
- The Sber per-branch API cannot be used today: its host is down, and even when it worked it needed a separate branch list keyed by `idBranch`.
- For the other banks, the only routes are the JSON/XHR calls behind their own "курсы в отделениях" web pages, or aggregators. Neither was investigated here, and both would be unofficial.

### Gaps
- Priorbank, Belinvestbank, BNB, BelVEB (endpoint URL), Belagroprombank (current URL), Dabrabyt, Paritetbank, VTB, BSB, Reshenie, RRB, Status, Technobank, TK Bank, Zepter and BTA: their official machine-readable endpoints were **not found**. Their website XHR endpoints were not inspected (request and tool budget).
- Whether Sber has a new API host or a branch-list API: not found.
- An Alfa-Bank branches/offices API on developerhub: not found (only one guessed path was tried, and it returned 404).

## NBRB: currency scales and a registry of exchange points

### Takeaway
NBRB's free API is the authoritative source of currency unit scales (`Cur_Scale`). No NBRB API or national registry of exchange points with addresses was found.

### Cited Findings
- `GET https://api.nbrb.by/exrates/rates?periodicity=0` (08.10.2026) returns `Cur_Scale` for each currency, e.g. RUB 100, PLN 10, CNY 10, CZK 100, JPY 100, SEK 10, NOK 10, UAH 100, TRY 10, KZT 1000, and USD/EUR/GBP/CHF/CAD 1. — [NBRB rates](https://api.nbrb.by/exrates/rates?periodicity=0)
- `GET https://api.nbrb.by/exrates/currencies/431` returns currency metadata, including `Cur_QuotName` ("1 Доллар США"). — [NBRB currency](https://api.nbrb.by/exrates/currencies/431)

### Inferences
- Bank feeds that omit units (Belarusbank, MTBank) appear to follow NBRB scales, based on the price levels observed. A reasonable default is to normalise with NBRB `Cur_Scale` and run a sanity check against the NBRB official rate.

### Gaps
- No NBRB endpoint or open-data set listing exchange points (обменные пункты) with addresses was found. Whether NBRB publishes counts of exchange points per bank (e.g. in statistical bulletins) was not verified.

## Which banks cover most exchange points

### Takeaway
Belarusbank dominates by a wide margin: 1102 rate-publishing points in 585 localities, against MTBank's 105 and Belgazprombank's 46. Branch counts for the other banks were not established.

### Cited Findings
- Belarusbank: 1102 points with rates nationwide (Minsk 137). — [kursExchange all](https://belarusbank.by/api/kursExchange)
- MTBank: 105 departments (Minsk 48). — [MTBank currxml](https://www.mtbank.by/currxml.php?ver=2)
- Belgazprombank: 46 branches with rates. — [Belgazprombank courses.xml](https://belgazprombank.by/upload/courses.xml)

### Inferences
- From common knowledge (not verified here, so treat it as a guess): Belagroprombank, Priorbank, BelVEB and Belinvestbank likely come next in network size. Belarusbank + Belagroprombank + Priorbank + MTBank + Belgazprombank + Alfa probably cover most points in Minsk. Outside regional centres, Belarusbank (and probably Belagroprombank) are often the only options.

### Gaps
- No authoritative per-bank count of exchange points was found for October 2026.
