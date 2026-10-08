// Геолокация с ожиданием не дольше 10 секунд (FR-1, FR-2).

export const LOCATE_TIMEOUT_MS = 10_000;

export function locate(timeoutMs = LOCATE_TIMEOUT_MS): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null);
    const timer = setTimeout(() => resolve(null), timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}
