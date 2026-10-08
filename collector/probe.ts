// Пробные запросы к источникам из GitHub Actions (шаг 2.3). Локально: npm run probe.

import { appendFile } from 'node:fs/promises';
import { formatTable, probeAll } from '../lib/probe.js';

const results = await probeAll();
const table = formatTable(results);
console.log(table);

const summaryPath = process.env.GITHUB_STEP_SUMMARY;
if (summaryPath) {
  await appendFile(summaryPath, `## Пробные запросы к источникам из GitHub Actions\n\n${table}\n`);
}
