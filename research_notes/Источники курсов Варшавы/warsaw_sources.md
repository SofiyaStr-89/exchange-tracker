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
