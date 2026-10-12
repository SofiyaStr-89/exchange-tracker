// Кластеры плашек (FR-17): число обменников и лучший курс среди открытых со свежим курсом.

import './leaflet.js';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import L from 'leaflet';
import { formatRate } from './format.js';
import type { Mode } from './rates.js';

/** Что знает плашка о себе — для подписи кластера. */
export interface PlateInfo {
  /** Курс для выбора лучшего: только открытые со свежим курсом; иначе null. */
  eligible: number | null;
  isBest: boolean;
}

export type PlateMarker = L.Marker & { plateInfo?: PlateInfo };

export function createClusterGroup(getMode: () => Mode): L.MarkerClusterGroup {
  return L.markerClusterGroup({
    maxClusterRadius: 48,
    disableClusteringAtZoom: 17,
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    iconCreateFunction(cluster) {
      const infos = (cluster.getAllChildMarkers() as PlateMarker[]).map((m) => m.plateInfo).filter((i): i is PlateInfo => !!i);
      const values = infos.map((i) => i.eligible).filter((v): v is number => v !== null);
      const best = values.length ? (getMode() === 'buy' ? Math.min(...values) : Math.max(...values)) : null;
      const green = infos.some((i) => i.isBest);
      const classes = ['plate', 'plate-cluster', best === null ? 'plate-none' : '', green ? 'plate-best' : ''].filter(Boolean).join(' ');
      return L.divIcon({
        className: 'plate-anchor',
        html: `<div class="${classes}">${best === null ? '—' : formatRate(best)}<span class="cluster-count">${cluster.getChildCount()}</span></div>`,
        iconSize: undefined,
      });
    },
  });
}
