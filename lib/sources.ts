// Сведения об источниках, общие для сервера и приложения.

/** Официальные API банков: при равной свежести выигрывают; их время — момент установки курса (правила 2 и 6). */
export const OFFICIAL_SOURCES = ['belarusbank', 'mtbank'];

export const SOURCE_SITES: Record<string, { title: string; url: string }> = {
  kantorlive: { title: 'kantor.live', url: 'https://kantor.live' },
  marketportal: { title: 'marketportal.pl', url: 'https://marketportal.pl/kantory' },
};
