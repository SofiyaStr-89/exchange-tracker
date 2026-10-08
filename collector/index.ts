// Сборщик курсов для GitHub Actions (SPEC: «Архитектура»). Адаптеры подключаются на следующих шагах.

const adapters: string[] = [];

console.log(`Сборщик запущен ${new Date().toISOString()}, адаптеров: ${adapters.length}`);
