// Сведения об источниках, общие для сервера и приложения.

/** Официальные API банков: при равной свежести выигрывают; их время — момент установки курса (правила 2 и 6). */
export const OFFICIAL_SOURCES = ['belarusbank'];

export const SOURCE_SITES: Record<string, { title: string; url: string }> = {
  kantorlive: { title: 'kantor.live', url: 'https://kantor.live' },
  belarusbank: { title: 'API Беларусбанка', url: 'https://belarusbank.by' },
  myfin: { title: 'myfin.by', url: 'https://myfin.by/currency/minsk' },
  marketportal: { title: 'marketportal.pl', url: 'https://marketportal.pl/kantory' },
  exg: { title: 'exg.pl', url: 'https://www.exg.pl' },
  kursarz: { title: 'kursarz.pl', url: 'https://kursarz.pl/kantory/kursy-walut.html' },
  sprawa: { title: 'kantorsprawa.pl', url: 'https://kantorsprawa.pl' },
};
