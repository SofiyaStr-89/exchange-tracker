// Все тексты интерфейса. Польский перевод появится отдельным файлом с теми же ключами.
export const ru = {
  appTitle: 'Карта обменников',
  mapPlaceholder: 'Здесь будет карта',
  serverChecking: 'Проверяем связь с сервером…',
  serverOk: 'Сервер отвечает',
  serverError: 'Сервер не отвечает',
} as const;

export type Messages = { [K in keyof typeof ru]: string };
