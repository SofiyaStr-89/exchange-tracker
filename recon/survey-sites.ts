// Шаг 5а: разовый обход сайтов kantorów из базы — кто публикует курс у себя и как.
// По одному запросу к странице (плюс robots.txt), пауза между запросами, честный User-Agent.
// npx tsx --env-file=.env.local recon/survey-sites.ts → research_notes/Источники курсов Варшавы/sites_survey.md

import { mkdir, writeFile } from 'node:fs/promises';
import { isNotNull } from 'drizzle-orm';
import { getDb } from '../lib/db/index.js';
import { exchangers } from '../lib/db/schema.js';
import { textOf } from '../lib/html.js';
import { USER_AGENT } from '../lib/probe.js';

const SKIP = /kantor\.live|marketportal|exg\.pl|kantorsprawa/;
const PAUSE_MS = 1200;
const OUT_DIR = 'recon/raw/sites';
const REPORT = 'research_notes/Источники курсов Варшавы/sites_survey.md';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const host = (u: string) => new URL(u).host.replace(/^www\./, '');

async function get(url: string): Promise<{ status: number; finalUrl: string; body: string } | { error: string }> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow', signal: AbortSignal.timeout(15_000) });
    return { status: res.status, finalUrl: res.url, body: await res.text() };
  } catch (err) {
    return { error: err instanceof Error ? (err.cause instanceof Error ? err.cause.message : err.message) : String(err) };
  }
}

function robotsDisallowAll(txt: string): boolean {
  let applies = false;
  for (const raw of txt.split('\n')) {
    const line = raw.replace(/#.*/, '').trim();
    const [k, ...rest] = line.split(':');
    const v = rest.join(':').trim();
    if (/^user-agent$/i.test(k ?? '')) applies = v === '*' || /exchangemapbot/i.test(v);
    else if (applies && /^disallow$/i.test(k ?? '') && v === '/') return true;
  }
  return false;
}

function analyse(html: string) {
  const text = textOf(html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' '));
  const pairs = [...text.matchAll(/\b(USD|EUR|GBP|CHF)\b[^0-9]{0,60}(\d[.,]\d{2,5})\D{1,40}(\d[.,]\d{2,5})/g)];
  const plausible = pairs.filter((m) => {
    const v = Number.parseFloat(m[2]!.replace(',', '.'));
    return v > 3 && v < 7; // курсы USD/EUR/GBP/CHF к PLN
  });
  const stamp = text.match(/(aktualiz\w*|kurs\w* z dnia|data)[^0-9]{0,40}(\d{1,4}[.\-/]\d{1,2}[.\-/]\d{2,4}(?:[ ,]+\d{1,2}:\d{2})?)/i)?.[2] ?? null;
  const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"/gi)].map((m) => m[1]!);
  const jsHints = [
    ...new Set(
      [...html.matchAll(/["'`]([^"'`\s]*(?:kurs|rate|waluty|currenc|exchange)[^"'`\s]*\.(?:json|php|xml)[^"'`\s]*)["'`]/gi)].map((m) => m[1]!),
    ),
  ].slice(0, 5);
  const iframes = [...html.matchAll(/<iframe[^>]*src="([^"]+)"/gi)].map((m) => m[1]!).filter((s) => !/google|youtube|facebook/i.test(s));
  const links = [
    ...new Set([...html.matchAll(/href="([^"]*(?:kurs|kursy|waluty|rates|cennik)[^"]*)"/gi)].map((m) => m[1]!)),
  ].slice(0, 5);
  const generator = html.match(/<meta[^>]+name="generator"[^>]+content="([^"]+)"/i)?.[1] ?? null;
  const platform = [
    /wp-content/i.test(html) ? 'WordPress' : null,
    /wix\.com|wixstatic/i.test(html) ? 'Wix' : null,
    /webflow/i.test(html) ? 'Webflow' : null,
    /joomla/i.test(html) ? 'Joomla' : null,
    /__NEXT_DATA__|_next\//.test(html) ? 'Next.js' : null,
    /kantor-?system|kantorsoft|e-?kantor|kantor\.pro/i.test(html) ? 'kantor-software?' : null,
  ].filter(Boolean);
  return { pairs: plausible.length, sample: plausible.slice(0, 2).map((m) => `${m[1]} ${m[2]}/${m[3]}`), stamp, scripts: scripts.length, jsHints, iframes, links, generator, platform, kupno: /kupno/i.test(text) && /sprzeda/i.test(text) };
}

const db = getDb();
const rows = await db.select({ website: exchangers.website, name: exchangers.name }).from(exchangers).where(isNotNull(exchangers.website));
const sites = new Map<string, { url: string; names: Set<string>; points: number }>();
for (const r of rows) {
  const h = host(r.website!);
  if (SKIP.test(h)) continue;
  const s = sites.get(h) ?? { url: r.website!, names: new Set(), points: 0 };
  s.names.add(r.name);
  s.points++;
  sites.set(h, s);
}

await mkdir(OUT_DIR, { recursive: true });
const results: string[] = [];
let first = true;
for (const [h, s] of [...sites.entries()].sort((a, b) => b[1].points - a[1].points)) {
  if (!first) await sleep(PAUSE_MS);
  first = false;
  const robots = await get(new URL('/robots.txt', s.url).toString());
  if ('body' in robots && robots.status === 200 && robotsDisallowAll(robots.body)) {
    results.push(`| ${h} | ${s.points} | robots запрещает | | | | |`);
    console.log(`${h}: robots запрещает`);
    continue;
  }
  await sleep(PAUSE_MS);
  const page = await get(s.url);
  if ('error' in page) {
    results.push(`| ${h} | ${s.points} | ошибка: ${page.error} | | | | |`);
    console.log(`${h}: ошибка ${page.error}`);
    continue;
  }
  await writeFile(`${OUT_DIR}/${h}.html`, page.body);
  const a = analyse(page.body);
  const verdict = a.pairs >= 2 ? 'курсы в HTML' : a.kupno ? 'есть «kupno/sprzedaż», чисел мало' : a.jsHints.length || a.iframes.length ? 'возможно, курсы грузит JS/iframe' : 'курсов не видно';
  const extra = [a.jsHints.join(' '), a.iframes.join(' '), a.links.join(' ')].filter(Boolean).join(' · ');
  results.push(
    `| ${h} | ${s.points} | ${page.status} ${verdict} | ${a.pairs} ${a.sample.join('; ')} | ${a.stamp ?? ''} | ${[...a.platform, a.generator].filter(Boolean).join(', ')} | ${extra.replace(/\|/g, '/').slice(0, 200)} |`,
  );
  console.log(`${h}: ${verdict} (${a.pairs})`);
}

await writeFile(
  REPORT,
  `# Обход сайтов kantorów Варшавы (${new Date().toISOString().slice(0, 10)})\n\n` +
    `Сайтов: ${sites.size}. По одному запросу к странице + robots.txt, пауза ${PAUSE_MS} мс, UA \`${USER_AGENT}\`.\n` +
    `«Пары» — сколько раз рядом с USD/EUR/GBP/CHF стоят два числа, похожих на курс к PLN.\n\n` +
    '| Сайт | Точек | Итог | Пары и пример | Время на странице | Платформа | Подсказки (JS, iframe, ссылки) |\n|---|---|---|---|---|---|---|\n' +
    results.join('\n') +
    '\n',
);
console.log(`Отчёт: ${REPORT}`);
