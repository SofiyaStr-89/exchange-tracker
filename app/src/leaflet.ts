// Leaflet для приложения. Плагин leaflet.markercluster (FR-17) собран по старой схеме и ищет Leaflet
// в глобальной переменной L, поэтому кладём её до загрузки плагина.

import L from 'leaflet';

(globalThis as unknown as { L: typeof L }).L = L;

// Поворот карты двумя пальцами (плагин MIT; leaflet-rotate от Raruto не берём — GPL).
import '@tomickigrzegorz/leaflet-rotate';

export default L;
