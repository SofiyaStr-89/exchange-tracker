# Источники сегодняшних курсов стационарных kantorów Варшавы (разведка 08.10.2026, ~18:00–18:30 по Варшаве)

Метод: web search + прямые запросы curl с UA `ExchangeMapBot/0.1 (personal non-commercial project; https://github.com/SofiyaStr-89/exchange-tracker)`, на каждый сайт не больше robots.txt + 2 запросов, пауза ≥2,5 с между запросами к одному сайту. Запросы шли с домашнего IP пользователя (Mac). Регламенты/ToS сайтов НЕ читались. Ничего не обходилось (Cloudflare, капчи). «Догадка» = не проверено.

Сырые выгрузки лежат в scratchpad сессии (не в репо).

---

## 1. Главная новая находка: marketportal.pl — страница «по валюте» с координатами и временем по каждому kantorowi

URL: `https://marketportal.pl/kantory/kursy-walut/warszawa/eur` (аналогично `/usd`, `/gbp`, `/chf`, есть и разбивка по районам `/kursy-walut/warszawa/srodmiescie/eur`).

Измерено (1 запрос, 222 КБ, HTTP 200):
- **54 уникальных точки Варшавы** (по `data-eoid`), все с «Ostatnia aktualizacja kursów: 2026-10-08 18:12…18:15» — то есть per-kantor timestamp есть, но все в пределах 3 минут → это время парсинга marketportal, а не время, когда kantor поменял курс (догадка, но очень вероятная).
- На одной странице — **все** точки города (без пагинации, в отличие от `/kantory/warszawa`, где 3 страницы).
- Поля по каждой точке: имя, район, адрес, **координаты** (`<td data-eoid="421" data-name="..." data-lat="52,244059" data-lng="20,991130">`, десятичная запятая), телефон(ы), часы работы по дням недели, ссылка на сайт kantoru, курс покупки/продажи, спред, порог оптового курса.
- Две вкладки: `#detail-quotes` (детальные курсы, 31 точка) и `#wholesale-quotes` (оптовые, 39 точек). 23 точки есть **только во вкладке «hurtowe»** (Zawisza, Respol, Alex, Bilion, Wiek, Apollo, Polres & Cris, Max, Akcent…) — у них, видимо, на сайте один курс, и marketportal кладёт его в «hurt». При использовании брать обе вкладки и помечать тип.
- Предыдущая заметка «у marketportal нет координат» — **неверна**: координаты есть в HTML страницы по валюте.
- robots.txt: `Disallow:` пусто (всё разрешено). С серверов доступен (по прошлой разведке).
- Итого: 1 запрос на валюту → ~54 точки с координатами, часами и временем. 4 валюты = 4 запроса.

## 2. Пересечение источников (измерено по нормализованному адресу «улица+номер», с ручной поправкой)

| Источник | Точек Варшавы с сегодняшней датой |
|---|---|
| zlata.ws `/pl/kantory/warszawa/` | 59 из 61 (57 уникальных адресов после склейки; две точки на 1 Sierpnia 46) |
| marketportal.pl `/kursy-walut/warszawa/eur` | 54 |
| kantor.live API | 14 из 80 (15 с хоть какими-то курсами) |
| quantor.pl | 29 по EUR не старше 3 дней (серверно отдаётся только 7) |
| przeliczwalut.pl `/kurs-euro-kantor.html` | ~25 строк с «Warszawa», время ЧЧ:ММ по каждому |
| rates.fm `/pl-pl/currency/exchanger/warsaw/` | 6 (Conti, Tavex, Bilion, Centrum, EXG, Na Długiej), «od 18:20» |

- zlata ∩ marketportal ≈ 40 точек по автоматической склейке, по факту ~43–45 (Akcent «Gróecka» опечатка у zlata, Marymont, Tesco Górczewska — те же точки).
- Только в zlata (≈13): Argentarii, Dan Exchange Chmielna 7, Finunion, Galeria Północna (EXG), Interkantor Solidarności, Joder, Kantor Cris (Grójecka 42), Kantor X, Neko Wilanów, Seveeu (Królewska 2), Kantor Bemowo (Babice Nowe), Exchange Group Pruszków и Piastów (это уже пригороды).
- Только в marketportal (≈8–10): Borcash, Tavex ×2 (Świętokrzyska, Okopowa), Redar Rondo Dmowskiego, Ursus, Extrakantor (Leszno 34/36), Inter Kantor Al. Jerozolimskie 81, Intraco Bonifraterska 17, White Money (у zlata дата 29.09).
- kantor.live fresh, которых нет ни в zlata, ни в marketportal: Any Money Exchange ×2, Valuta, Metal Market Europe (у zlata 05.10), Argentarii/Kantor X (есть в zlata). То есть kantor.live добавляет **~4–6** точек.
- **Объединение zlata ∪ marketportal ∪ kantor.live(fresh) ≈ 70 уникальных точек** (автоматически 75, минус ~5 дублей из-за разного написания адресов). Из них ~2 — пригороды.
- **Без zlata: marketportal ∪ kantor.live ≈ 59–60.**
- Вывод: агрегаторы во многом пересекаются (все парсят одни и те же ~60–70 сайтов kantorów), но у каждого есть свой «хвост» в 5–15 точек.
- Сверка с мастер-списком kantorymapa.pl (249 точек): совпали ~49 из 75 адресов. Расхождения в основном из-за написания адресов, но часть точек в торговых центрах (Carrefour Bemowo, Skorosze, Galeria Ursynów) в kantorymapa, похоже, отсутствует.

## 3. Новые агрегаторы и каталоги (чего не было в прошлых заметках)

**przeliczwalut.pl** — `https://www.przeliczwalut.pl/kurs-euro-kantor.html`
- Общепольская таблица EUR по kantorom: имя, город, район, покупка/продажа, время (ЧЧ:ММ или «7 paź», если не сегодня). Для Варшавы ~25 строк, почти все уже есть в marketportal/zlata. Новые имена: Ekantor / «Kantor DLA FIRM» (Ochota), Kantor Asia, Kantor Klonowa 22 (= Polres & Cris?).
- Странность: в 18:2x по Варшаве в таблице было время «19:16/19:17». Часовой пояс или часы сервера неизвестны, поэтому верить времени нельзя без проверки.
- Есть страницы отдельных kantorów `/kursy-walut-<slug>.html`. robots.txt разрешает всё. Координат не видно.
- Ценность: низкая, добавит 1–3 точки. Годится как кросс-проверка.

**rates.fm** — `/pl-pl/currency/exchanger/warsaw/`: 6 варшавских обменников со временем «od 18:20» и изменением к прошлому периоду. robots: `Disallow: /api/ /control/`. Ценность низкая, всё уже покрыто.

**kantorymapa.pl** — `/kantor/warszawa/`: 1 запрос → JSON-LD `ItemList` из **249** точек: имя, адрес, телефон, `openingHours`/`openingHoursSpecification`, **geo lat/lon**. ID похожи на OSM node id (`tonwex-319423954`), то есть данные, вероятно, из OSM и под ODbL (догадка). Курсов нет, только NBP. Лучший мастер-список с координатами за 1 запрос.

**nakordoni.eu** `/pl/exchange/warszawa`: ~80 точек, курсы с датой по каждой, но по сниппетам последние даты около 02.08.2026 (устарело). Для нашего UA — 403 Cloudflare (прошлая разведка). Не использовать.

**kantory.warszawa.pl**: сайт мёртв (404). **kantorwarszawa.pl** — это сайт одного kantoru («Warszawa Centrum», Kredytowa 8), а не агрегатор.

**kantor.live, мобильное приложение**: в поиске не найдено ни приложения, ни отдельного API. Внутренний JSON уже известен. Ещё одна деталь: `updated_at` помечено `+00:00`, но на деле это варшавское местное время (в 16:18 UTC видели 17:55/18:15). Адаптер `lib/adapters/kantorlive.ts` это уже учитывает.

**Telegram/Facebook-боты, GitHub-скрейперы, открытые датасеты**: ничего релевантного по Варшаве не найдено.

**Google Maps / Business «kurs»-посты**: доступ только через платный Places API или скрейпинг, который нарушает ToS. Не рассматривать.

**bankier / money.pl / interia / gazeta**: сравнивают только онлайн-kantory (по прошлой разведке и текущему поиску). Стационарных курсов нет.

## 4. quantor.pl — найден XHR

- В бандле `/target_build/page.cantors.<hash>.js` таблица грузится через `XHR.get({url: this.slug + "/rates/getRates", data: {...}})`.
- Параметры (из `_getRateLoadQuery` и `#params` в HTML): `symbol=EUR`, `page=1`, `limit=<число строк>`, `voivodeship=mazowieckie`, `city=warszawa`, `type=detal|hurt`, `orderby=opinia|kurs|ulica`, `order=desc`, `transact=kupno|sprzedaz`, `onlyCard=false`, `exchangeAmount=…`, `isExchangeAmountNational=true`.
- То есть `GET https://quantor.pl/rates/getRates?symbol=EUR&city=warszawa&voivodeship=mazowieckie&type=detal&orderby=opinia&order=desc&transact=kupno&page=1&limit=50`. **Не вызывался** (лимит запросов исчерпан). Формат ответа неизвестен: обработчик `handleRankingUpdate` вставляет его в DOM, так что это, вероятно, HTML-фрагмент + пагинация (догадка).
- robots.txt разрешает всё, кроме `/panel/`. Kantory обновляют курсы сами, поэтому здесь могут быть точки, которых нет у парсящих агрегаторов. Оценка новых точек: +3–8 (догадка).

## 5. Собственные сайты сетей и kantorów (формат, timestamp, сколько точек)

Домены взяты из полей `site` у kantor.live и ссылок «Strona internetowa kantoru» у marketportal.

| Сеть / kantor | Точек в Варшаве | Формат | Время курса | Доступ с сервера / robots | Покрыто агрегаторами? |
|---|---|---|---|---|---|
| **EXG (exg.pl)** | **11 страниц филиалов**: atrium-targowek, atrium-targowek-2-kasa, atrium-targowek-carrefour, galeria-mlociny-1, galeria-mlociny-2, galeria-polnocna, galeria-polnocna-pietro-0, galeria-rembielinska, promenada, tesco-gorczewska-bemowo, sadyba-best-mall | HTML по филиалу `/kantory/kantor/warszawa/<slug>/`: детальные курсы (~30 валют) + оптовые + золото | «Dane kursów z: 2026-10-08 - 18:16» на странице филиала | robots `Allow: /`. `media/kursy-walut/rates.json` — заглушка от 2020-07-28, не использовать | marketportal: 3, zlata: 4. **Новых: ~6–7** (Atrium Targówek ×3, Młociny ×2, Promenada, Północna p.0). В поиске у Galeria Północna мелькала дата 2026-09-29, так что часть филиалов может быть несвежей (догадка) |
| **EXG Capital / Baltic Exchange** (exgcapital.pl → OVH-фрейм на balticexchange.pl) | 5: E.Leclerc Jerozolimskie (id 68), Auchan Ursynów (71), Skorosze (74), Gocław (79), Carrefour Bemowo (88) | HTML `balticexchange.pl/index/kantor/<id>` | «Ostatnia aktualizacja cen nastąpiła: 2026-10-08 godz: 18:17» | robots.txt → 500. Сеть в основном гданьская | все 5 уже в marketportal и zlata (у zlata под именем «Exchange Group») → новых 0, но это первоисточник |
| **Tavex** | 4 (Świętokrzyska 32 = officeId 30, Arkadia 175, Koneser 171, Klif/Okopowa 73) | **JSON встроен в HTML** страницы `/kantor-warszawa-centrum/`: `"eur":{"30":"{\"buy\":[{price,quantityFrom,quantityTo}…],\"sell\":[…]}", "175":…}`. Ступенчатые цены по сумме. **1 запрос = все 15 офисов в Польше**, 87 валют | только относительное «Aktualizacja: 4 min temu» | robots: всё разрешено. Страница 1,5 МБ | kantor.live 4, marketportal 3. Новых 0, но свежее и полнее |
| **Interkantor** (interkantor.eu) | 3: Galeria Rondo Wiatraczna (Grochowska 207), Pod Rondem 40-latka (переход Al. Jerozolimskie, lok 24), Al. Solidarności 149 | серверный HTML (WP-плагин `kursy-walut`), одна таблица на все 3 точки, `id="bid-USD"`/`id="ask-USD"` | «Ostatnia aktualizacja: 08.10.26 18:20», «aktualizowane co minutę 24h» | robots: всё разрешено | zlata 3, marketportal 2 → +0–1 |
| **Dan Exchange** (danexchange.pl) | 2 (Złota 65, Wolska 54); zlata ещё перечисляет Chmielna 7 | **JSON API**: `POST /api/get-currencies.php` с `action=get_currencies` → `{"package":{"created_at":"2026-10-08 18:18:40"},"records":[{waluta, kurs_detalkupno, kurs_detalsprzedaz, kurs_hurtkupno, kurs_hurtsprzedaz…}]}`, 50 КБ | `package.created_at` | robots: всё разрешено | все уже покрыты; первоисточник с точным временем |
| **Redar** (redar.net) | 3 (Marszałkowska 99A, переход под Novotelem lok. 33, Rondo Dmowskiego lok. 34A) | HTML-таблица по филиалу `/oddzial/<slug>` (страница 415 КБ) | времени на странице не видно | robots `Allow: /` | все в marketportal |
| **Kantor Solec** (kantorsolec.pl) | 2 (Solec 81B, Grochowska 204) | HTML | «Aktualizacja walut: 08.10.2026» (только дата) | robots есть | покрыто |
| **Kantor Wiek** (kantor-wiek.pl) | 2 (Wileńska Targowa 72, Arkadia JP II 82) | HTML по точке | — | страница вернула **HTTP 500** | покрыто |
| **K&K** (kantor-kk.pl) | 2 (переход Al. Jerozolimskie/JP II) | robots.txt и главная — одинаковые 12,8 КБ без курсов (вероятно, JS или заглушка) | — | ? | marketportal 2 |
| **White Money** (kantor-wm.pl) | 1 (Targowa 59) + Poznań, Łódź | WP-плагин `kantor-rates`, HTML | «Aktualizacja: 08.10.2026 18:21:30» | robots есть | marketportal (у zlata дата 29.09) |
| **Any Money Exchange** (anymoney.org) | 2 | HTML, на странице есть маркеры Cloudflare, но контент отдался | «Ostatnia aktualizacja: 2026-10-08 17:22:15» | — | только kantor.live |
| Kantor Sprawa (kantorsprawa.pl) | 2 по kantor.live | HTML | «Aktualizacja: 2026-10-08 18:20:08» | robots есть | не найден в zlata/mp (имя) — проверить |
| Kantor House (kantor-house.com) | 1–2 | HTML, маркеры Cloudflare | — | — | покрыто |
| Borcash (borcash.pl) | 1 (+Kraków?) | HTML | нет | — | marketportal |
| Kantor KURS (kantorkurs.pl/warszawa) | 1 (Marszałkowska 85) | HTML | «aktualizowane na bieżąco» | — | покрыто |
| Kantor Zawisza | 1 | HTML | нет | — | покрыто |
| Conti (conti.waw.pl) | 1 | HTML, за 100 ед. | «aktualizowane w ciągu dnia» | — | покрыто |
| quark.house | — | криптообменник, **вне scope** | | | |

Рейтинг адаптеров по числу **новых** точек на один адаптер:
1. **exg.pl** — +6–7 новых точек (11 филиалов, но часть уже есть в агрегаторах); 11 запросов за цикл; свежесть отдельных филиалов не проверена.
2. **Tavex** — 0 новых, но 4 точки в Варшаве и 15 по Польше за 1 запрос, точные ступенчатые цены.
3. **Interkantor** — +1 (Solidarności без zlata), 1 запрос на 3 точки, точный timestamp.
4. **Dan Exchange JSON** — 0 новых, 2–3 точки, лучший формат (JSON + created_at).
5. Остальные — по 1–2 точки, все уже есть в marketportal. Свои адаптеры имеет смысл писать только ради точного времени или если marketportal отвалится.

## 6. zlata.ws: честная оценка доступа

- Публичного API, RSS, информера или sitemap не нашлось. Поиск по «zlata.ws informer/API» ничего не дал. В robots.txt запрещены `/xml/`, `/ajax/`, `/parsers/`, строки Sitemap нет.
- Контакт: на странице только форма «Kontakt / Informacje kontaktowe» (`#feedback`, JS-форма). Email на странице не найден.
- С домашнего IP страница отдаётся (сегодня 200, 71 КБ), с IP дата-центров — Cloudflare challenge (по прошлой проверке).
- Честные варианты:
  1. **Написать владельцу через форму обратной связи.** Попросить разрешения на 1 запрос в 15–30 минут для некоммерческого PWA или фид, и/или попросить внести IP/UA коллектора в allowlist Cloudflare. Это единственный «чистый» путь к серверному доступу.
  2. Запускать коллектор zlata **с домашней машины** (cron или launchd на Mac, 1 запрос в 15–30 минут) и пушить результат в БД/Vercel. Это не обход защиты, а обычный доступ с того же IP, что и у браузера пользователя, но лучше всё равно сначала получить согласие владельца.
  3. Не использовать zlata: потеря ~10–13 точек (см. п. 2).
- Обходить Cloudflare (headless-браузеры, резидентные прокси, решатели challenge) — **нельзя**, не рассматривалось.
- Нюанс с временем: в списке zlata в 18:18 по Варшаве самая свежая метка была «08.10 14:58». Список кэшируется или показывает время в другом поясе (раньше видели расхождение список 14:04 / карточка 16:04 = +2 ч, то есть список, видимо, в UTC). Нужно проверить до показа пользователю.

## 7. Рекомендация (ранжированная)

Оценки числа «точек в Варшаве с сегодняшним курсом» — накопительные. Всё помеченное «≈» — оценка по пересечению одного дня.

| # | Что добавить | Прирост | Итого | Трудоёмкость | Примечание |
|---|---|---|---|---|---|
| 1 | **marketportal.pl по валюте** (`/kantory/kursy-walut/warszawa/{eur,usd,gbp,chf}`), обе вкладки | 54 | **≈54** | малая: 1 HTML-парсер, 4 запроса за цикл; координаты, часы, телефон, сайт уже есть | основа; работает с серверов; robots разрешает. Timestamp — время их парсинга |
| 2 | **kantor.live API** (уже есть адаптер) | +4–6 (Any Money ×2, Valuta, Metal Market, Argentarii, Kantor X) | **≈59–60** | нулевая | |
| 3 | **exg.pl** по филиалам | +6–7 (догадка: если все филиалы свежие; один, по поиску, был от 29.09) | **≈65–67** | малая: 11 запросов, один парсер, адреса филиалов на странице | robots разрешает |
| 4 | **zlata.ws** — только с разрешения владельца или с домашнего коллектора | +8–11 (Finunion, Joder, Cris, Seveeu, Neko Wilanów, Dan Chmielna, Interkantor Solidarności, Kantor Bemowo, Galeria Północna при отсутствии exg, Pruszków/Piastów — пригороды) | **≈73–77** | малая по коду, организационно — ждать ответа или держать домашний cron | без zlata этот прирост теряется |
| 5 | **quantor.pl `/rates/getRates`** | +3–8 (догадка; kantory сами вносят курсы) | **≈77–83** | средняя: проверить формат ответа (вероятно, HTML-фрагмент), пагинация, геокодирование адресов | endpoint найден, но не вызывался |
| 6 | Interkantor / Tavex / Dan Exchange (свои сайты) | +0–1 точка, но точнее время и цены | ≈ то же | малая (3 адаптера, по 1 запросу) | ради качества, а не количества |
| 7 | przeliczwalut.pl, rates.fm | +1–3 | ≈ то же | малая | кросс-проверка; часовой пояс у przeliczwalut подозрительный |
| 8 | kantorymapa.pl `/kantor/warszawa/` (JSON-LD, 249 точек, координаты, часы) | 0 курсов | — | малая | мастер-список, чтобы показывать на карте и точки «без курса онлайн»; лицензия, видимо, ODbL |

Итого: реалистичный потолок для Варшавы — **~75–85 точек с сегодняшним курсом из ~250** (около 30–35%). Без zlata — **~65–75**. Больше получить нельзя: остальные ~170 kantorów курсы онлайн, похоже, не публикуют (догадка, согласуется со всеми источниками).

## 8. Пробелы

- ToS/regulamin marketportal.pl, quantor.pl, przeliczwalut.pl, exg.pl не читались. Прочитать до продакшена.
- Свежесть остальных 10 филиалов exg.pl не проверялась (видели только Sadyba, 18:16 сегодня).
- Формат ответа quantor `/rates/getRates` не проверен.
- Сопоставление «Exchange Group» у zlata с EXG (exg.pl) и EXG Capital (balticexchange.pl): у zlata под одним брендом смешаны обе сети.
- kantorsprawa.pl, Valuta, Metal Market Europe, Any Money Exchange — адреса не сверялись с другими источниками.
- Не проверено, отдаёт ли marketportal страницу по валюте дата-центровым IP так же, как городскую (по прошлой разведке городская отдаётся).

---

# Раунд 2 (08.10.2026, ~18:29–18:35 по Варшаве)

Метод тот же: curl с UA `ExchangeMapBot/0.1 (personal non-commercial project; https://github.com/SofiyaStr-89/exchange-tracker)`, домашний IP, ≥2 с между запросами к одному сайту, не больше 3 запросов на сайт плюс robots.txt. Логинов не было, защиту ничем не обходили. Пометка «(догадка)» = не проверено.

Запросы: marketportal 3 (`/eur`, `/usd`, `/regulamin`); quantor 3 (`getRates`, главная ради ссылки на регламент, `/serwis/regulamin.html`); exg 3 + robots (одна страница отдала 302 на `www.`, плюс 2 страницы филиалов); kantorymapa 2 (`/kantor/warszawa/`, `/kontakt/`); Overpass 1; zlata 0.

## R2.1. marketportal.pl

**Регламент** (`/regulamin`, короткий, без параграфов). Об автоматическом доступе, роботах и повторном использовании данных там **ничего нет**: ни запрета, ни разрешения. Что сказано:
- товарные знаки и информация о kantorach «są własnością ich właścicieli», размещены «jedynie w celach informacyjnych», курсы «przybliżone»;
- курсы не являются офертой (ст. 66 KC);
- принимаются только kantory, у которых на сайте есть актуальные курсы, «możliwe do pobrania przez mechanizm służący do pobierania danych ze stron internetowych używany przez MarketPortal.pl». Значит, marketportal сам парсит сайты kantorów, и **«Ostatnia aktualizacja kursów» — время их парсинга** (подтверждено регламентом);
- контакт: kontakt@marketportal.pl.
- robots.txt: `Disallow:` пусто. Футер: «Copyright © 2026: MarketPortal.pl».
- Вывод: юридически серая зона, явного запрета нет. По-хорошему стоит написать на kontakt@ (как и в zlata) и ставить атрибуцию «Kursy: MarketPortal.pl» со ссылкой. Отдельный нюанс: курсы фактически принадлежат kantorom, marketportal их только агрегирует.

**Структура страницы** `https://marketportal.pl/kantory/kursy-walut/warszawa/<eur|usd|gbp|chf>` (около 222 КБ, всё в серверном HTML):
- Две вкладки: `<div class="tab-pane ..." id="detail-quotes">` («Kursy detaliczne») и `<div class="tab-pane ..." id="wholesale-quotes">` («Kursy hurtowe»). Внутри каждой — `<table>` с колонками `Kantor | EUR Kupno | EUR Sprzedaż | EUR Spread | Mapa | Dane`.
- Разделители районов: `<tr class="quotes-city"><td colspan="6"><strong>Śródmieście</strong></td></tr>`.
- Строка kantoru:
  - `<td><a href="/kantor/<slug>">ИМЯ</a></td>` — имя и ссылка на страницу kantoru на marketportal;
  - `<td>4,3100</td><td>4,4400</td>` — покупка и продажа (десятичная запятая);
  - `<td>13 gr / 3,02%</td>` — спред;
  - `<td data-eoid="421" data-name="ИМЯ" data-lat="52,244059000000000" data-lng="20,991130000000000" ...>` — **ID и координаты** (с запятой); внутри `<div class="d-none" id="hAddress_421">Warszawa - Śródmieście#Jana Pawła II 45a/47a</div>` — район и адрес через `#`;
  - `<div id="popover-content_421" class="d-none"><ul>`:
    - `<li><strong>Warszawa - Śródmieście</strong></li><li>адрес</li>`;
    - `<li>Telefon: …</li>` (0..N штук);
    - `<ul class="list-unstyled opening-hours"><li>Poniedziałek <span>10:00-17:00</span></li> … <li>Niedziela <span>Zamknięte</span></li></ul>` — **часы по дням** (у сегодняшнего дня `class="today"`; в HTML мусор `<li ">`, так что парсер должен быть терпимым);
    - `<a href="https://borcash.pl/" target="_blank">Strona internetowa kantoru</a>` — **сайт kantoru**;
    - иногда `<span><b>Informacja o kursach hurtowych: </b>Kursy hurtowe obowiązują dla transakcji powyżej 3000 zł.</span>` — **порог опта**;
    - `<p><b>Ostatnia aktualizacja kursów</b>: </p><span>2026-10-08 18:13</span>` — **timestamp** (местное время, без пояса).
- Курсы **по каждому kantorowi**, у каждой строки свои значения. Но у сетей значения совпадают по точкам: Redar ×3 = 4,36/4,40, K&K I и II = 4,17/4,30 (у K&K I и II ещё и одинаковые координаты). Похоже, курс сети снимается с одной страницы (догадка). При показе «лучший курс» такие точки не дубли, это разные кассы.
- Измерено: EUR — detal 31 строка, hurt 39, в обеих вкладках 16 → **54 уникальных eoid**. USD — detal 32, hurt 39 → **52 уникальных**. Набор почти тот же: 3 точки есть только в EUR, 1 — только в USD. Все timestamps 18:12–18:15 сегодня.
- **Другие города:** в `<select id="ddlCity">` 142 города со slug в `data-val` (`krakow`, `wroclaw`, `gdansk`, `poznan`, `lodz`, `warszawa`…), в `<select id="ddlCurrency">` — весь ISO-список. Шаблон `/kantory/kursy-walut/<city-slug>/<cur>`, вероятно, работает и для Кракова, но **сама страница Кракова не запрашивалась** (лимит запросов) → догадка высокой уверенности.

## R2.2. quantor.pl

**Ответ `GET /rates/getRates?symbol=EUR&city=warszawa&voivodeship=mazowieckie&type=detal&orderby=opinia&order=desc&transact=kupno&page=1&limit=50`**: HTTP 200, `content-type: text/html`, **7 КБ HTML-фрагмента, не JSON**. За Cloudflare (`server: cloudflare`, `cf-ray …-WAW`), но для нашего UA челленджа не было.
- Структура: `<div id="table"><table>`, заголовки «RANKING KANTORÓW - WARSZAWA» (первая группа с бейджем «OTWARTE TERAZ», вторая — остальные), строки `<tr id="<hash>-0-" onmouseover="...controller.addCantorToMap(52.13955, 21.05880)">`.
- Поля в строке: **координаты** (в `addCantorToMap(lat, lng)`), имя/бренд (`<strong>ZAWI$ZA</strong>`), название места (`<span>Galeria Ursynów</span>`), **адрес** (`<u>al. Komisji Edukacji Narodowej 36/30</u>`) со ссылкой `./kantor/warszawa-<slug>.html`, статус открытия в tooltip («Dziś otwarty do godz. 20:00» / «W tej chwili zamknięty»), **курс** `<h5>4.3200</h5>` (точка, только одна сторона — `transact=kupno`), **свежесть только относительная** в tooltip («27 minut temu», «1 dni temu»), сумма в PLN за `exchangeAmount` (998 PLN), значок доверия «zaufany / N rezerwacji».
- **Строк всего 2**, хотя `limit=50`: Galeria Ursynów (курс «1 dni temu») и Zawisza, al. Jerozolimskie 60B (27 минут назад). То есть **свежих сегодня — 1**. Возможно, без `exchangeAmount`/`onlyCard` ответ урезан (догадка), дальше не проверяли.
- Абсолютного timestamp нет, второй стороны курса нет (нужен второй запрос с `transact=sprzedaz`).

**Регламент** (`/serwis/regulamin.html`, оператор Quantor Sp. z o.o., Wrocław), §4: «Zabrania się kopiowania, rozpowszechniania i wykorzystywania poza Serwisem treści… Publikowanie i wykorzystywanie całości lub części zestawień prezentowanych w Serwisie wymaga zgody Administratora». §2: основное назначение — просмотр в браузере, «zabrania się użytkowania Serwisu w sposób niezgodny z jego podstawowym wykorzystaniem».
→ **Без письменного согласия использовать нельзя.** Учитывая, что даёт 1–2 точки, — **исключить**.

## R2.3. exg.pl

- robots.txt: `exg.pl` → 301 на `www.exg.pl`, там `User-agent: * / Allow: /`, `Sitemap: https://www.exg.pl/sitemap.xml`. Сайт без Cloudflare (Apache).
- **11 страниц филиалов в Варшаве** (каноничный хост `www.`, без `www.` отдаёт 302):
  1. https://www.exg.pl/kantory/kantor/warszawa/atrium-targowek/ (сейчас называется «G-City Targówek», ul. Głębocka 15)
  2. https://www.exg.pl/kantory/kantor/warszawa/atrium-targowek-2-kasa
  3. https://www.exg.pl/kantory/kantor/warszawa/atrium-targowek-carrefour
  4. https://www.exg.pl/kantory/kantor/warszawa/galeria-mlociny-1
  5. https://www.exg.pl/kantory/kantor/warszawa/galeria-mlociny-2
  6. https://www.exg.pl/kantory/kantor/warszawa/galeria-polnocna (Światowida 17)
  7. https://www.exg.pl/kantory/kantor/warszawa/galeria-polnocna-pietro-0
  8. https://www.exg.pl/kantory/kantor/warszawa/galeria-rembielinska (на странице «Renova Rembielińska», ul. Rembielińska 20)
  9. https://www.exg.pl/kantory/kantor/warszawa/promenada
  10. https://www.exg.pl/kantory/kantor/warszawa/sadyba-best-mall
  11. https://www.exg.pl/kantory/kantor/warszawa/tesco-gorczewska-bemowo
- **Свежесть:** G-City Targówek — «Dane kursów z: 2026-10-08 - 18:30» (запрос в 18:32), Galeria Północna — «2026-10-08 - 18:09» (то есть дата 29.09 из поиска устарела). В раунде 1 Sadyba — 18:16 сегодня. **3 из 3 проверенных филиалов — сегодня.** Остальные 8 не проверялись.
- **HTML курсов:** блоки `<div class="pack ...">` с `<h2 class="pack-name">` «Hurtowe Kursy Walut» / «Aktualny kurs walut» / «Aktualny kurs złota». Под заголовком `<div class="pack-inf"> Dane kursów z: YYYY-MM-DD - HH:MM</div>` и для опта `<div class="pack-inf"> Hurtowe stawki obowiązują od 1000 jednostek walut obcych</div>`. Таблица на div-ах: `<div class="table rates">` → `<div class="tbody">` → `<div class="tr">` с 4 `<div class="td">`: (флаг + `<b class="rates-name">EUR - HURT <small>…</small></b>`), `EUR`, `4,3600` (kupno), `4,4100` (sprzedaż). У опта суффикс « - HURT» в имени.
- **Адрес/телефон/часы:** `<p class="fs-4">… <b class="c-2">Adres:</b><br> ul. Głębocka 15<br> Warszawa 03-287<br> tel.: <b>+ 48 22 313 12 07</b>` и `<b class="c-2">Godziny otwarcia:</b><br> pn-pt: <strong>9:00 - 21:00</strong><br> sob: <strong>…</strong><br> nd: <strong>10:00 - 20:00 (handlowe)</strong>`. Координат нет, только iframe Google Maps по адресу, так что координаты брать из OSM или геокодировать. Внизу блок «branches» — 10 других филиалов (`branches-name`, адрес, телефон, часы), то есть **одна страница даёт адреса и часы всех 11**, но курсы только своего филиала.
- **Регламент/ToS:** ссылок на регламент, политику или terms на странице филиала нет, найти не удалось. Ограничений не видно, robots разрешает.

## R2.4. kantorymapa.pl и OpenStreetMap

**Откуда список kantorymapa.** На странице прямо сказано: «Dane kantorów pochodzą z OpenStreetMap, map Google i publicznych katalogów firm». Во встроенных данных Next.js (RSC) у каждой точки есть `source` и `osmId`:
| source | точек | пример osmId |
|---|---|---|
| `osm` | 123 | `node/319423954`, `way/…` |
| `google` | 72 | `gmaps:0x…:0x…` |
| `panoramafirm` | 27 | `katalog…` |
| `pkt` | 27 | `katalog…` |
| **итого** | **249** | |
Реестра NBP/KNF среди источников нет. Поле `zaktualizowano` — 2026-08 (134 записи), сама страница статична (`last-modified: 2026-09-17`, LiteSpeed/Hostinger).

**Лицензия/условия:** регламента/ToS нет, есть только `/polityka-prywatnosci/` и `/kontakt/` (на `/kontakt/` указан email для рекламы и поправок, без условий использования). В футере «© 2026 Kantorymapa.pl · Wszystkie prawa zastrzeżone», «Mapa: OpenStreetMap, CartoDB». Атрибуции ODbL на данные почти нет («Dane: OpenStreetMap» в отдельных местах). То есть:
- 123 OSM-записи по сути под ODbL (их можно брать **из OSM напрямую**);
- 72 записи, извлечённые из Google Maps, — Google ToS запрещает такое извлечение и повторное использование; брать их от третьей стороны тоже плохо;
- 54 записи из panoramafirm/pkt.pl — каталожные базы, у них есть право sui generis на базу данных;
- остальное «все права защищены». **Копировать список kantorymapa юридически нечисто** (догадка юридического характера, но обоснованная).

**JSON-LD на `/kantor/warszawa/`** (`ItemList`, 249 `ListItem`), у `item` (`@type: [FinancialService, LocalBusiness]`):
- `name` — 249; `url` — 249, но это **ссылка на страницу kantorymapa**, а не сайт kantoru;
- `address` (`PostalAddress`: `streetAddress`, `addressLocality`, `addressRegion`, `addressCountry`) — 249;
- `geo` (`GeoCoordinates`: `latitude`, `longitude`) — 249;
- `telephone` — 169; `openingHoursSpecification` (`dayOfWeek`/`opens`/`closes`) — 149; строка `openingHours` — 6;
- **сайта kantoru (`sameAs`) в JSON-LD нет.** Он есть только во встроенных RSC-данных: `{"osmId","slug","miasto","name","lat","lng","address","phone","website","hours","operator","source","googleId","zaktualizowano"}`. **`website` не null у 111 из 249** (osm 68, google 43). Больше всего ссылок у loombard.pl (12), exg.pl (6), kantorcapital.pl (5), tavex.pl (4).

**OpenStreetMap (Overpass, 1 запрос, `area(3600336075)` = граница Варшавы, `nwr[amenity=bureau_de_change]`, данные на 2026-10-08T16:31Z):**
- **141 объект** (132 node, 9 way); `name` — 101, `opening_hours` — 92, `addr:street` — 92, `addr:housenumber` — 91, **`website`/`contact:website` — 22**, `phone`/`contact:phone` — 16, `check_date` — 109.
- Все 141 OSM-точки есть в kantorymapa (в пределах 30 м) → kantorymapa = OSM + 108 точек из Google и каталогов. У kantorymapa сайтов больше (68 против 22 на тех же OSM-точках), их явно дополнили из Google (догадка).
- Совпадение с точками marketportal (55 уникальных eoid EUR∪USD) по расстоянию: в пределах 100 м в kantorymapa — 45/55, в OSM — 39/55 (в пределах 50 м — 34 и 32).

**Рекомендация по мастер-списку: OSM напрямую, не kantorymapa.**
- OSM: открытая лицензия ODbL. Нужно: атрибуция «© OpenStreetMap contributors» со ссылкой на openstreetmap.org/copyright на карте или в приложении. Если **публично распространять** производную базу (OSM + свои данные, слитые в одну таблицу), share-alike требует отдать её под ODbL. Для показа на карте (Produced Work) достаточно атрибуции. Для личного проекта это не проблема; чтобы не было вопросов, свои данные (курсы) лучше хранить отдельной таблицей и связывать по id (догадка-интерпретация ODbL, не юридическая консультация).
- Точки с курсами в любом случае приходят со своими координатами от marketportal/kantor.live/exg. OSM нужен только для точек «без курса онлайн» (~100+) и чтобы дополнять часы.
- kantorymapa даст +108 точек и больше сайтов, но с нечистой лицензией (Google/каталоги, «wszelkie prawa zastrzeżone»). Если они очень нужны — только с письменного согласия владельца (email на /kontakt/). Иначе использовать kantorymapa максимум как ручную подсказку для правок в самом OSM (вносить в OSM данные из Google **нельзя**, только проверенные лично).
- «Обе» (OSM + kantorymapa) — не рекомендую: лицензионный риск ради точек без курсов.

## R2.5. marketportal и боты

- Ответы `/kursy-walut/warszawa/eur` и `/usd` на наш бот-UA: **HTTP 200, полный HTML (222 КБ)**, без челленджа. В заголовках **нет Cloudflare** (`server` не указан, нет `cf-ray`/`cf-cache-status`), есть HSTS, `x-frame-options: deny`. Похоже на собственный хостинг/IIS-подобный стек (догадка).
- Запросы шли с домашнего IP. С IP дата-центра (Vercel/GitHub Actions) в этом раунде **не проверяли**. По раунду 1 главная отдаётся серверам, и признаков Cloudflare или WAF нет, так что, скорее всего, будет работать (догадка).

## R2.6. Черновик письма владельцу zlata.ws (НЕ отправлено)

Канал: форма «Kontakt» на zlata.ws (email на сайте не найден).

**Po polsku:**
> Temat: Prośba o zgodę na niekomercyjne pobieranie kursów kantorów
>
> Dzień dobry,
>
> tworzę prywatną, niekomercyjną aplikację webową (PWA) z mapą kantorów, z której korzystam sama i ewentualnie kilka znajomych osób. Nie ma w niej reklam ani płatnych funkcji. Kod jest publiczny: https://github.com/SofiyaStr-89/exchange-tracker
>
> Chciałabym zapytać o zgodę na to, aby mój bot odczytywał stronę https://zlata.ws/pl/kantory/<miasto>/ (na początek tylko Warszawa) **nie częściej niż raz na 15 minut**. Bot przedstawia się jako:
> `ExchangeMapBot/0.1 (personal non-commercial project; https://github.com/SofiyaStr-89/exchange-tracker)`
> W aplikacji przy każdym kursie podam źródło „zlata.ws” z linkiem do Państwa strony.
>
> Jeśli wolą Państwo inny sposób (np. plik JSON/XML, inną częstotliwość albo konkretną godzinę), chętnie się dostosuję. Jeśli się Państwo nie zgadzają, oczywiście uszanuję tę decyzję i nie będę pobierać danych.
>
> Z góry dziękuję za odpowiedź i pozdrawiam serdecznie,
> Sofiya

**По-русски (перевод):**
> Тема: Просьба о разрешении на некоммерческое чтение курсов обменников
>
> Здравствуйте!
>
> Я делаю личное некоммерческое веб-приложение (PWA) с картой обменников, которым пользуюсь сама и, возможно, несколько знакомых. В нём нет рекламы и платных функций. Код открыт: https://github.com/SofiyaStr-89/exchange-tracker
>
> Хочу попросить разрешения, чтобы мой бот читал страницу https://zlata.ws/pl/kantory/<город>/ (для начала только Варшаву) **не чаще одного раза в 15 минут**. Бот представляется как:
> `ExchangeMapBot/0.1 (personal non-commercial project; https://github.com/SofiyaStr-89/exchange-tracker)`
> В приложении у каждого курса будет указан источник «zlata.ws» со ссылкой на ваш сайт.
>
> Если вам удобнее другой способ (например, JSON/XML-файл, другая частота или конкретное время), я с радостью подстроюсь. Если вы против, я, конечно, уважаю это решение и не буду забирать данные.
>
> Заранее спасибо за ответ!
> София

(Похожее письмо имеет смысл отправить и на kontakt@marketportal.pl: явного запрета там нет, но согласие снимает риск.)

## R2.7. Итоговое решение (обновление п. 7 раунда 1)

| Источник | Решение | Почему |
|---|---|---|
| **marketportal.pl** `/kantory/kursy-walut/warszawa/{eur,usd,gbp,chf}` | **Внедрять первым** | 54 точки за запрос, координаты, часы, телефон, сайт, timestamp; регламент не запрещает; robots разрешает; Cloudflare нет. Атрибуция + (желательно) письмо на kontakt@ |
| **kantor.live** | оставить (уже есть) | +4–6 точек |
| **exg.pl** (11 страниц) | **Внедрять вторым** | 3/3 проверенных филиала свежие сегодня; robots `Allow: /`; ToS не найден; координат нет → брать из OSM или по адресу |
| **zlata.ws** | только после ответа владельца | черновик письма выше |
| **quantor.pl** | **Не использовать** | регламент §4 прямо требует согласия; endpoint отдал 2 точки, свежая 1 |
| **Мастер-список** | **OSM (Overpass), 141 точка, ODbL с атрибуцией** | kantorymapa — смесь OSM + Google + каталоги, «wszelkie prawa zastrzeżone» |
