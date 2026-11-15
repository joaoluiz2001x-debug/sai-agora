/**
 * Mapa da viagem (web): MapLibre + mapa vetorial OpenFreeMap (grátis, sem chave, dados © OpenStreetMap).
 * No iOS/Android usa-se RouteMap.native.tsx (Apple Maps / Google Maps).
 * No preview do Claude o mapa não carrega (a caixa fechada bloqueia pedidos externos) — mostra um aviso.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { colors } from '../theme';
import { T } from './ui';
import type { Itinerary, Point } from '../data/transit';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export type RouteMapProps = { itinerary: Itinerary; me?: Point | null; height: number };

export function RouteMap({ itinerary, me, height }: RouteMapProps) {
  const box = useRef<any>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!box.current) return;
    let map: maplibregl.Map | null = null;
    try {
      map = new maplibregl.Map({
        container: box.current as HTMLElement,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        attributionControl: { compact: true },
        center: [itinerary.legs[0].from.lon, itinerary.legs[0].from.lat],
        zoom: 13,
      });
    } catch { setFailed(true); return; }
    map.on('error', (e: any) => { if (String(e?.error?.message ?? '').includes('Failed to fetch')) setFailed(true); });
    map.on('load', () => {
      const m = map!;
      const all: [number, number][] = [];
      itinerary.legs.forEach((l, i) => {
        const coords = l.path.map((p) => [p.lon, p.lat] as [number, number]);
        all.push(...coords);
        m.addSource(`leg${i}`, { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } } });
        if (l.mode === 'WALK') {
          m.addLayer({ id: `leg${i}`, type: 'line', source: `leg${i}`, layout: { 'line-cap': 'round' },
            paint: { 'line-color': '#4B5563', 'line-width': 4, 'line-dasharray': [0.1, 1.8] } });
        } else {
          m.addLayer({ id: `leg${i}c`, type: 'line', source: `leg${i}`, paint: { 'line-color': '#FFFFFF', 'line-width': 9 } });
          m.addLayer({ id: `leg${i}`, type: 'line', source: `leg${i}`, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': l.color, 'line-width': 6 } });
        }
      });
      const pin = (p: Point, bg: string, label: string, anchor: 'top' | 'bottom' = 'top') => {
        const el = document.createElement('div');
        el.style.cssText = `background:${bg};color:#fff;font:700 12px system-ui;padding:4px 7px;border-radius:10px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)`;
        el.textContent = label;
        new maplibregl.Marker({ element: el, anchor }).setLngLat([p.lon, p.lat]).addTo(m);
      };
      itinerary.legs.filter((l) => l.mode !== 'WALK').forEach((l) => pin(l.from, l.color, l.route ?? ''));
      pin(itinerary.legs[0].from, '#111827', 'Partida', 'bottom');
      pin(itinerary.legs[itinerary.legs.length - 1].to, colors.brand, 'Destino', 'bottom');
      if (me) {
        const el = document.createElement('div');
        el.style.cssText = 'width:16px;height:16px;border-radius:8px;background:#2563EB;border:3px solid #fff;box-shadow:0 0 0 6px rgba(37,99,235,.2)';
        new maplibregl.Marker({ element: el }).setLngLat([me.lon, me.lat]).addTo(m);
      }
      const b = all.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(all[0], all[0]));
      m.fitBounds(b, { padding: 40, duration: 0 });
    });
    return () => { map?.remove(); };
  }, [itinerary, me]);

  return (
    <View style={{ height, backgroundColor: colors.track }}>
      {/* @ts-ignore — div nativo na web */}
      <div ref={box} style={{ position: 'absolute', inset: 0 }} aria-label="Mapa da viagem" role="img" />
      {failed && (
        <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <T style={{ color: colors.inkSoft, textAlign: 'center' }}>O mapa não carregou aqui. Na app e no site publicado aparece normalmente.</T>
        </View>
      )}
    </View>
  );
}
