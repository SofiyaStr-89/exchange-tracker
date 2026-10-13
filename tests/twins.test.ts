import { describe, expect, it } from 'vitest';
import { findTwin } from '../lib/twins.js';

const W = 'Warszawa';
const c = (name: string, address: string, city = W) => ({ name, address, city });
const placed = [
  c('Kantor Redar pod Novotelem', 'Przejście podziemne pod Novotelem obok stacji Metro Centrum, Lokal 33, Warszawa'),
  c('Kantor Redar pod Rotundą', 'Przejście podziemne pod Rotundą obok stacji Metro Centrum, Lokal 4, Warszawa'),
  c('Kantor K&K Jarosław Kluszczyński', 'al. Jerozolimskie / Jana Pawła II (Pawilon 140), 00-024 Warszawa'),
  c('Kantor K&K Jarosław Kluszczyński', 'al. Jerozolimskie / Jana Pawła II (Pawilon nr 24), 00-024 Warszawa'),
  c('Extrakantor Leszno', 'Leszno 34/36, 01-175 Warszawa'),
  c('extrakantor.pl - Warszawa - Jerozolimskie 50', 'Jerozolimskie 50 (lokal 70), Warszawa'),
  c('Kantor House', 'Aleja Jana Pawła II 38'),
  c('Kantor House', 'Ptasia 2, 00-138 Warszawa'),
  c('Kantor Plac Hallera', 'ul. Skoczylasa 9a, 03-469 Warszawa'),
  c('Kantor JB', 'Bieńczycki Plac Targowy 7, Kraków', 'Kraków'),
];

describe('двойник по названию', () => {
  it('Redar: по номеру помещения и по улице', () => {
    expect(findTwin(c('Kantor REDAR II przejście podziemne pod Novotelem', 'Rondo Dmowskiego - Lokal 33, Warszawa'), placed)?.name).toBe('Kantor Redar pod Novotelem');
    const iii = 'Metro Centrum (Przejście podziemne przy Rotundzie PKO (Rondo Dmowskiego) obok stacji Metro Centrum, Lokal 34A), 00-026 Warszawa';
    expect(findTwin(c('Kantor Redar Oddział III', iii), placed)?.name).toBe('Kantor Redar pod Rotundą');
  });

  it('K&K: павильон 140 и 24 — разные пункты', () => {
    expect(findTwin(c('K&K Kantor - Pawilon 140 - Przejście podziemne', 'Al. Jerozolimskie / Jana Pawła II, 00-024 Warszawa'), placed)?.address).toContain('Pawilon 140');
    expect(findTwin(c('K&K Kantor - Pawilon 24 - Przejście podziemne', 'Al. Jerozolimskie / Jana Pawła II, 00-024 Warszawa'), placed)?.address).toContain('nr 24');
  });

  it('без номера — по улице', () => {
    expect(findTwin(c('Kantor House', 'Jana Pawła II, 00-141 Warszawa'), placed)?.address).toBe('Aleja Jana Pawła II 38');
  });

  it('другая улица или другой номер той же сети — не двойник', () => {
    expect(findTwin(c('extrakantor.pl - Warszawa - Stalowa', 'Stalowa 60/64 (Supermarket TESCO), Warszawa'), placed)).toBeNull();
    expect(findTwin(c('extrakantor.pl - Jerozolimskie 144', 'Jerozolimskie 144, Warszawa'), placed)).toBeNull();
  });

  it('Plac Hallera и Kraków', () => {
    expect(findTwin(c('Kantor Plac Hallera', 'Pl.Hallera / Skoczylasa 9a, 03-470 Warszawa'), placed)?.name).toBe('Kantor Plac Hallera');
    expect(findTwin(c('Kantor JB', 'Bieńczycki Plac Targowy paw.7, 31-863 Kraków', 'Kraków'), placed)?.name).toBe('Kantor JB');
  });
});
