// Все тексты интерфейса. Польский перевод появится отдельным файлом с теми же ключами.
// {имя} в строке — подстановка, см. fmt() в index.ts.
export const ru = {
  appTitle: 'Карта обменников',
  locating: 'Определяем ваше местоположение…',
  geoHint:
    'Нет доступа к геолокации — показываем последнее место. Чтобы видеть обменники рядом, разрешите доступ к местоположению в настройках браузера для этого сайта.',
  loading: 'Загружаем обменники…',
  refreshing: 'Обновляем курсы…',
  loadError: 'Не удалось загрузить обменники. Проверьте интернет.',
  nothingHere: 'В радиусе {radius} нет обменников с курсом {currency}.',
  mapAttribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
  you: 'Вы здесь',

  close: 'Закрыть',
  buyLabel: 'Покупаю {currency}',
  sellLabel: 'Продаю {currency}',
  noRate: 'нет курса',
  open: 'Открыт',
  closed: 'Закрыт',
  todayHours: 'Сегодня {from}–{to}',
  todayDayOff: 'Сегодня выходной',
  hoursUnknown: 'Часы работы не указаны',
  roundTheClock: 'Сегодня круглосуточно',
  rateUpdatedToday: 'Курс обновлён сегодня в {time}',
  rateUpdatedOn: 'Курс обновлён {date} в {time}',
  source: 'Источник: ',
  distance: '{distance} от точки поиска',
  meters: '{n} м',
  kilometers: '{n} км',
} as const;

export type Messages = { [K in keyof typeof ru]: string };
