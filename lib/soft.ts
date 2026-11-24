// Временный сбой внешнего сервиса адресов (Nominatim «HTTP 629» 24.11.2026, GUGiK, Photon, onliner) не должен
// ронять ночной шаг целиком: адрес пропускаем до следующей ночи, остальные обрабатываем, в конце — предупреждение
// (жёлтое в GitHub Actions, без письма).

export const serviceErrors: string[] = [];

/** Обёртка: ошибка → `fallback` и запись в serviceErrors. */
export function soft<A extends unknown[], R>(fn: (...args: A) => Promise<R>, fallback: R): (...args: A) => Promise<R> {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      serviceErrors.push(message);
      console.log(`⚠ сервис недоступен (${message}) — этот адрес попробуем следующей ночью`);
      return fallback;
    }
  };
}

export function reportServiceErrors(): void {
  if (!serviceErrors.length) return;
  console.log(`::warning::Временные сбои сервисов адресов: ${serviceErrors.length} (первый — ${serviceErrors[0]}). Эти точки попробуем следующей ночью.`);
}
