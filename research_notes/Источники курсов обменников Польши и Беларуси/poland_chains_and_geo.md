# Polish kantor chains and free coordinate/hours sources (research date 2026-10-08)

Method note: I used web search, about 8 direct page fetches (no more than 2 per site) and one small Overpass count query (UA "ExchangeMapRecon/0.1 (personal non-commercial project)"). WebFetch returns a model-made summary of each page, not the raw HTML. "Not seen" means not seen in that summary, not proven absent. Web search worked poorly for Polish kantor brands: several queries returned nothing useful. Coverage of the smaller chains is therefore thin, and these gaps are listed below.

## Which kantor chains operate in Poland, with branch and city counts

### Takeaway
Of the named candidates, only Tavex is confirmed as a real multi-city chain: 15 stationary points in 9 cities, per tavex.pl on 2026-10-08. "Kantor Exchange" (kantor-exchange.pl) is a Kraków-only mall chain with about 9 points. Dan Exchange is 2 points in Warsaw. I could not confirm a store count for Conti, Any Money Exchange, Grosz, Centrum, Exchange Point, Interchange, Lemoon, Argentarii, Max Kantor or Kantor Złoty. Most "chains" on kantor.live look like 1–5-point local operators, not national networks.

### Cited Findings
- **Tavex**: the homepage says "15 punktów stacjonarnych … w 9 miastach". Addresses listed: Białystok (G City Biała, Miłosza 2), Gdańsk (Galeria Bałtycka, Grunwaldzka 141), Gdynia (Galeria Klif, al. Zwycięstwa 256), Katowice ×2 (Silesia City Center, Chorzowska 107; "Kantor 3 Maja"), Lublin (Królewska 4), Łódź (Manufaktura, Drewnowska 58), Poznań (Stary Browar, Półwiejska 42), Warszawa ×4 (Arkadia, al. Jana Pawła II 82; Świętokrzyska 32; Koneser, Pl. Konesera 10A; Klif, Okopowa 58/72), Wrocław ×3 (Oławska 9; Wroclavia, Sucha 1, two salons). Branches are mostly in malls. — [tavex.pl](https://tavex.pl/)
- Older Tavex figures: 12 branches in 8 cities ([trade.gov.pl profile](https://trade.gov.pl/en/support/malopolska-chamber-of-craft-and-entrepreneurship/page/114)), and Okopowa was announced as the 10th Polish location ([Eurobuild](https://eurobuildcee.com/news/55358-srebro-zloto-i-waluty-przy-okopowej)). Both are older and superseded by the homepage.
- **Kantor Exchange** (kantor-exchange.pl): "9 lokalizacji w Krakowie". The site names Galeria Bronowice (Stawowa 61, Mon–Sat 9–21, Sun 10–21), Galeria Krakowska (levels +1 and −1), Carrefour Czyżyny, Galeria Mozaika, Kaufland Bratysławska, Park Handlowy Zakopianka, Bonarka City Center and Designer Outlet Kraków (Galicyjska 10, Mon–Sat 9–21). The site does not name an owner, so I could not confirm a link to Baltona. — [kantor-exchange.pl](https://kantor-exchange.pl/); aggregator listing: [nakordoni.eu Kraków](https://nakordoni.eu/pl/exchange/krakow)
- **Dan Exchange** (danexchange.pl): 2 Warsaw points, Złota 65 and Wolska 54, with "ponad 60 walut". — [danexchange.pl](https://danexchange.pl/). A guide also lists a "Dan Exchange, Chmielna 7" point, undated, so it may be stale or a different operator ([exiap.com](https://www.exiap.com/guides/currency-exchanges-best-in-warsaw)).
- **Conti**: one Warsaw address, Al. Jana Pawła II 46/48 pav. 12, from a 2018 list. I did not confirm that a chain exists. — [se.pl](https://www.se.pl/warszawa/kantory-warszawa-adresy-lokalizacje-aa-uxj3-t2vJ-cMdb.html)
- **Kantor Zawisza**: one Warsaw point, al. Jerozolimskie 60B (Pl. Zawiszy), Mon–Fri 9:30–18:00, Sat 9:30–14:00. The aggregator had rates dated 2026-09-16. — [nakordoni.eu](https://nakordoni.eu/en/exchange/warszawa/kantor-zawisza)
- **Argentarii**: a Warsaw listing whose rates were dated 22.10.2025 on rates.fm. — [rates.fm](https://rates.fm/pl-pl/currency/exchanger/warsaw/argentarii-kantor/)
- **FlyingAtom** is a crypto-to-cash "kantor", not a currency exchange. Articles report 13, then 19 stationary offices, and LinkedIn says 12 cities. LinkedIn also says crypto exchange was suspended from 01.07.2026 pending a licence. Out of scope. — [comparic.pl](https://comparic.pl/kryptowalutowe-transakcje-w-kantorach-stacjonarnych/), [LinkedIn](https://pl.linkedin.com/company/flyingatom)
- **Travelex** entered Poland in 2014 with a point at Łódź airport. Its current presence is unknown. — [pasazer.com](https://www.pasazer.com/news/24679/travelex,otworzy,kantor,na,lotnisku,w,lodzi.html)

### Inferences
- The Polish stationary kantor market is very fragmented. The biggest confirmed national FX-cash chain (Tavex) has only 15 points.
- "Chains" in kantor.live are probably mostly operators with 2–10 points in one city, for example Kantor Exchange in Kraków and Dan Exchange in Warsaw.

### Gaps
- No reliable 2026 store counts for Conti, Any Money Exchange, Grosz, Centrum, Exchange Point, Interchange, Lemoon, Argentarii, Max Kantor, Kantor Złoty or Baltona. Searches returned nothing relevant. A next step would be to check each brand's own site (kontakt/placówki page) manually.
- Airport operators are unconfirmed. I found nothing on who runs the kantors at Chopin, Kraków or Katowice airports in 2026, and I did not confirm Interchange or Exchange Point as current Polish operators.

## How each chain publishes rates and branch lists

### Takeaway
Tavex publishes rates per city or branch: one page per city, with branch tabs, 87 currency codes and an "Aktualizacja: X min temu" label. It is the best candidate for a dedicated adapter, but the data endpoint is still to be found in the browser's network tab. Smaller operators (Kantor Exchange, Dan Exchange) publish one common HTML table, without a machine-readable feed or precise timestamp.

### Cited Findings
- Tavex has per-city rate pages: /kantor-bialystok-kursy-walut/, /kantor-gdansk-kursy-walut/, /kantor-gdynia-kursy-walut/, /kantor-katowice-kursy-walut/, /kantor-lublin-kursy-walut/, /kantor-lodz-kursy-walut/, /kantor-poznan-kursy-walut/, /kantor-warszawa-centrum/ and /kantor-wroclaw-kursy-walut/, plus a general /kursy-walut/ page. — [tavex.pl](https://tavex.pl/)
- The Tavex Wrocław page has tabs for the "Oławska", "Wroclavia" and "Sucha" branches, a currency selector with 87 codes (AED…ZAR), and an "Aktualizacja: 2 min temu" label (relative time). The rate values did not appear in the fetched text, which suggests they are rendered client-side (inference). Opening hours are on the Kontakt subpage tabs. — [tavex.pl Wrocław](https://tavex.pl/kantor-wroclaw-kursy-walut/), [tavex.pl](https://tavex.pl/)
- Kantor Exchange (Kraków) has one rate table, quoted per 100 units. Example: EUR 433.00 buy / 441.00 sell. The table is updated on business days until 17:00, has no timestamp, and the site shows no JSON or store locator. — [kantor-exchange.pl](https://kantor-exchange.pl/)
- Dan Exchange has one HTML rate table on a separate page, with more than 60 currencies, no timestamp and no JSON. Wholesale rates for amounts above 3000 PLN are given by phone. — [danexchange.pl](https://danexchange.pl/)

### Inferences
- The 2-minute "Aktualizacja" label and branch tabs suggest Tavex serves live rates from an XHR/JSON endpoint per branch. This is unverified: confirm it once in browser devtools. If true, one request per city every 15 minutes is cheap: 9 requests per cycle.
- For small operators, the HTML table is the only format. Without a timestamp, "freshness" must be treated as "fetched at", and parsing must check that the values actually change.

### Gaps
- I did not inspect the Tavex network calls. Whether rates differ between branches in the same city is unconfirmed. Branch coordinates are not exposed (not seen).
- Rate formats for Any Money Exchange, Kantor Zawisza and Argentarii were not checked. Their own sites were not found.

## Share of kantors covered by chains vs independents

### Takeaway
Chains cover a small share. Poland has roughly 5,000 registered kantors (latest figures, 2015 and 2017). Even generous counts of identifiable chains reach well under 100 points, so chains cover about 1–2% nationally (inference). Their share is higher in big-city malls and centres. Brand tagging in OSM is almost nonexistent.

### Cited Findings
- 4,951 registered kantor entities in Poland in 2017. Śląskie had 12.28% of them, Małopolskie 11.55%, Dolnośląskie 10.36%. — [Sołtysiak, Optimum 3/2019](https://repozytorium.uwb.edu.pl/jspui/bitstream/11320/8119/1/Optimum_3_2019_M_Soltysiak_Empiryczna_analiza_zachowan.pdf)
- NIK, citing NBP records, gives operating kantors at year-end: 4,558 (2012), 4,601 (2013), 5,011 (2014), 4,973 (H1 2015). — [NIK report](https://bip.nik.gov.pl/kontrole/wyniki-kontroli-nik/pobierz,kbf~p_15_013_201510271410471445955047~id2~01,typ,kj.pdf)
- In OSM Poland on 2026-10-08, only 8 of 1,645 `amenity=bureau_de_change` objects have a `brand` tag. — Overpass count query (own query, overpass-api.de, osm_base 2026-10-08T14:05Z)
- Airport and train-station kantors are known for poor rates. — [money.pl](https://www.money.pl/gospodarka/wiadomosci/artykul/kantory-euro-dworce-lotniska-wymiana-walut,211,0,2411731.html)

### Inferences
- The project's Warsaw sample (80 kantors on kantor.live, 15 with fresh rates) fits this picture. Tavex has 4 Warsaw points (about 5% of 80) and Dan Exchange 2. Even all identified chains would likely add only 5–10 Warsaw points with fresh rates. This is a guess.

### Gaps
- No 2025–2026 NBP count of kantors was found. No source gives chain share by city or by venue type (airports, stations, malls).

## Coordinates and opening hours: OSM, Nominatim and Polish official geocoders

### Takeaway
OSM has about 1,645 kantor objects in Poland, roughly a third of the about 5,000 registered kantors. Only 36.5% of them have `opening_hours`, 56% have `name`, and 24% have `addr:street`. OSM helps as a seed and for coordinates, but it is not complete enough to be the only source. For geocoding a few hundred addresses once, Nominatim is acceptable under its policy. The official GUGiK UUG service, built on PRG address points, is the best free option for Polish addresses.

### Cited Findings
- taginfo Geofabrik (Poland): `amenity=bureau_de_change` has 1,658 objects (1,539 nodes, 118 ways, 1 relation), with data until 2026-10-06T20:20Z. The worldwide figure is 21,140. — [taginfo PL](https://taginfo.geofabrik.de/europe:poland/api/4/tag/stats?key=amenity&value=bureau_de_change), [taginfo world](https://taginfo.openstreetmap.org/api/4/tag/stats?key=amenity&value=bureau_de_change)
- Own Overpass count (single query, 2026-10-08, osm_base 14:05Z, inside the PL admin boundary):

  | Tag | Objects | Share of 1,645 |
  |---|---|---|
  | All `bureau_de_change` | 1,645 | 100% |
  | `opening_hours` | 601 | 36.5% |
  | `name` | 923 | 56.1% |
  | `addr:street` | 396 | 24.1% |
  | `brand` | 8 | 0.5% |

  — [overpass-api.de](https://overpass-api.de/)
- The Nominatim public API allows at most 1 request per second per application. "Smaller one-time bulk tasks may be permissible" if they run single-threaded on one machine with all results cached. Scripts running longer than a day or on a schedule are limited to 4 requests per minute. Stock library User-Agents are not accepted, autocomplete is banned, and ODbL attribution is required. — [OSMF Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/)
- GUGiK geocoding:
  - **OpenLS** service at `http://mapy.geoportal.gov.pl/openLSgp/geocode`. It geocodes against PRG "Punkt Adresowy" objects. — [geoportal OpenLS](https://www.geoportal.gov.pl/pl/usluga/usluga-openls/), [user guide PDF](https://geoportal.gov.pl/wp-media/2024/08/G2_Przewodnik_uzytkownika_Uzupelnienie.pdf)
  - **UUG** service, used by the QGIS plugin "Geokodowanie Adresów UUG GUGiK" (v1.3.2, Apr 2026) for batch CSV geocoding. Results can be points (buildings, localities), lines (streets) or polygons (squares). Some PRG addresses lack postal codes. — [QGIS plugin](https://plugins.qgis.org/plugins/geokodowanie_adresow/), [GitHub](https://github.com/envirosolutionspl/geokodowanie_uug)
  - A third-party tool describes UUG as returning up to 10 candidates in EPSG:2180 (Polish CS92) with an accuracy score, and as usually more accurate than Nominatim for Polish addresses. Not official documentation. — [glama.ai qgis-mcp](https://glama.ai/mcp/servers/piatkowski/qgis-mcp/tools/geocode_gugik_prg)
  - R package rgugik offers `geocodePL_get()` for GUGiK geocoding. — [rgugik](https://cran.nics.utk.edu/cran/web/packages/rgugik/refman/rgugik.html)
  - GUGiK changed its service addresses at some point. — [gov.pl GUGiK](https://www.gov.pl/web/gugik/nowe-adresy-uslug-sieciowych-gugik)

### Inferences
- Recommended geocoding pipeline:
  1. Use GUGiK UUG first, and convert EPSG:2180 to WGS84 with proj4/pyproj.
  2. Fall back to Nominatim at 1 request per second with caching. For about 600 addresses that is roughly 10 minutes, a one-time job within the policy.
  3. Store the coordinates permanently, and re-geocode only new or changed addresses.
- Opening hours: OSM covers about a third of objects. For chain branches, scrape the chain's own site (for example the Tavex Kontakt tabs). The rest will have to come from the aggregator, or be shown as "hours unknown".
- OSM data is ODbL. Showing it, or a database derived from it, in the PWA requires attribution and share-alike for the derived database.

### Gaps
- I could not confirm the exact UUG endpoint URL, parameters, rate limits or terms of use from an official page: the geoportal UUG page returned 404. From prior knowledge, unverified: the endpoint is `https://services.gugik.gov.pl/uug/?request=GetAddress&address=<city, street number>`, PRG address data have been free open data since the 2020 amendment to Prawo geodezyjne, and the full PRG address-point dataset can be downloaded in bulk from geoportal "dane do pobrania". Check `constants.py` in the plugin repo to confirm.
- Not researched: Photon (komoot) and geocode.maps.co free-tier limits.

## Recommendation: dedicated chain adapters vs the aggregator

### Takeaway
Build one dedicated adapter, for Tavex (15 points, 9 cities, 87 currencies, rates updated within minutes, per-branch tabs). Treat everything else as aggregator-first. Small-operator HTML adapters (Kantor Exchange in Kraków, Dan Exchange in Warsaw) are worth it only as cheap extras.

### Cited Findings
- Tavex: 15 points in 9 cities, per-city pages with branch tabs, 87 currency codes, "Aktualizacja: 2 min temu". — [tavex.pl](https://tavex.pl/), [tavex.pl Wrocław](https://tavex.pl/kantor-wroclaw-kursy-walut/)
- Kantor Exchange: 9 Kraków points, one HTML table, updated on business days until 17:00. — [kantor-exchange.pl](https://kantor-exchange.pl/)
- Dan Exchange: 2 Warsaw points, more than 60 currencies, HTML table. — [danexchange.pl](https://danexchange.pl/)

### Inferences
- Suggested architecture:
  1. Use the aggregator (kantor.live) as the base layer for the kantor list and rates.
  2. Override chain branches with primary-source rates: Tavex, then the HTML ones.
  3. Join by normalised address plus distance under 50 m.
  4. Fill coordinates and hours from OSM (`opening_hours` where present), then UUG or Nominatim.
- Expected effect: freshness improves for about 25 points nationally (Tavex 15, Kantor Exchange 9, Dan Exchange 2). This is significant for Warsaw, Wrocław and Kraków malls, but it will not fix the overall low share of kantors with fresh rates (about 19%), because most kantors are independents that publish rates nowhere online (inference).
- Before building the Tavex adapter, open one Tavex city page in devtools to find the rates XHR, check robots.txt and keep to 1 request per city per 15 minutes.

### Gaps
- Whether chains such as Grosz, Centrum, Lemoon, Max Kantor, Kantor Złoty, Any Money Exchange, Argentarii or Kantor Zawisza run their own websites with rate feeds is unverified. Searches returned nothing usable. A manual check of each brand's site is the next step.
