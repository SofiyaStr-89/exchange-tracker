// Еженедельно (maintenance): пускает ли kursarz.pl снова наш сервер. Проверка — через сервер (/api/source-check),
// потому что kursarz закрывал доступ именно серверу, а не всем. Если пускает — шаг завершается ошибкой:
// GitHub пришлёт письмо, это сигнал включить kursarz обратно (collector/build-cities.ts, lib/cities-data.ts).
// npm run check-kursarz

const res = await fetch('https://exchange-tracker-one.vercel.app/api/source-check?source=kursarz', { signal: AbortSignal.timeout(60_000) });
const body = (await res.json()) as { ok?: boolean; detail?: string | null; checkedAt?: string };
if (body.ok) {
  console.log(`::error::kursarz.pl снова пускает наш сервер (проверено ${body.checkedAt}) — можно включать его обратно. Это хорошая новость, а не сбой.`);
  process.exit(1);
}
console.log(`kursarz.pl по-прежнему не пускает сервер: ${body.detail ?? `HTTP ${res.status}`}`);

export {};
