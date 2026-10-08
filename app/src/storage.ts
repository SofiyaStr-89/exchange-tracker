// localStorage с защитой: в приватном режиме и при запрете хранилища приложение работает и без него (SPEC).

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // хранилище недоступно — просто не запоминаем
  }
}
