/**
 * Mapa da viagem (web): MapLibre + OpenFreeMap (grátis, sem chave, dados © OpenStreetMap).
 * Estilo inspirado no Google Maps: a pé em pontos azuis, linhas grossas com contorno branco,
 * paragens em círculos com nome, edifícios e nomes de ruas visíveis ao aproximar.
 * Modo "follow": a câmara segue o boneco (posição GPS) com a direção para onde vai.
 * No iOS/Android usa-se RouteMap.native.tsx.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { colors } from '../theme';
import { T } from './ui';
import type { Itinerary, Point } from '../data/transit';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export type RouteMapProps = {
  itinerary: Itinerary;
  me?: Point | null;
  heading?: number | null;
  follow?: boolean;
  height: number | string;
  bottomInset?: number;
  accuracy?: number | null;
  /** Até onde já se andou: perna e índice do ponto mais próximo. */
  progress?: { leg: number; idx: number } | null;
  vehicles?: { id: string; line: string; lat: number; lon: number; bearing: number; color: string }[];
  /** 'walk' = muito perto e a rodar; 'ride' = mais afastado para ver a linha até à saída. */
  phase?: 'walk' | 'ride';
};

const WALK_BLUE = '#1A73E8';

function meMarkerEl() {
  const el = document.createElement('div');
  el.style.cssText = 'width:64px;height:64px;position:relative;pointer-events:none';
  el.innerHTML = `
    <div data-halo style="position:absolute;left:50%;top:50%;width:0;height:0;transform:translate(-50%,-50%);border-radius:50%;
      background:rgba(26,115,232,.13);border:1px solid rgba(26,115,232,.3);transition:width .4s,height .4s"></div>
    <div data-cone style="position:absolute;inset:0;transition:transform .4s ease-out;display:none">
      <div style="position:absolute;left:50%;top:0;width:0;height:0;transform:translateX(-50%);
        border-left:22px solid transparent;border-right:22px solid transparent;border-bottom:32px solid rgba(26,115,232,.28);
        -webkit-mask:linear-gradient(to top,#000 30%,transparent);mask:linear-gradient(to top,#000 30%,transparent)"></div>
    </div>
    <div style="position:absolute;left:50%;top:50%;width:22px;height:22px;transform:translate(-50%,-50%);border-radius:50%;
      background:${WALK_BLUE};border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.35)"></div>`;
  return el;
}

function busEl(color: string, label: string) {
  const el = document.createElement('div');
  el.style.cssText = 'pointer-events:none';
  el.innerHTML = `<div style="display:flex;align-items:center;gap:3px;background:${color};color:#fff;font:700 12px system-ui;padding:3px 6px;border-radius:9px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4"><rect x="4" y="3" width="16" height="15" rx="3"/><path d="M4 11h16M8 21v-3M16 21v-3"/></svg>${label}</div>`;
  return el;
}
const mpp = (lat: number, zoom: number) => (156543.03 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);

export function RouteMap({ itinerary, me, heading, follow, height, bottomInset = 0, accuracy, progress, vehicles, phase = 'walk' }: RouteMapProps) {
  const box = useRef<any>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const meRef = useRef<maplibregl.Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tracking, setTracking] = useState(true);
  const shown = useRef<[number, number] | null>(null);
  const anim = useRef(0);
  const buses = useRef<Map<string, maplibregl.Marker>>(new Map());

  // 1) Cria o mapa e desenha o percurso (só quando muda a viagem)
  useEffect(() => {
    if (!box.current) return;
    setReady(false);
    let map: maplibregl.Map | null = null;
    try {
      map = new maplibregl.Map({
        container: box.current as HTMLElement,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        attributionControl: { compact: true },
        center: [itinerary.legs[0].from.lon, itinerary.legs[0].from.lat],
        zoom: 14,
      });
    } catch { setFailed(true); return; }
    mapRef.current = map;
    map.on('dragstart', (e: any) => { if (e.originalEvent) setTracking(false); });
    map.on('error', (e: any) => { if (String(e?.error?.message ?? '').includes('Failed to fetch')) setFailed(true); });
    map.on('load', () => {
      const m = map!;
      // Edifícios mais visíveis (como no Maps)
      ['building', 'building-3d'].forEach((id) => {
        if (m.getLayer(id) && m.getLayer(id)!.type === 'fill') m.setPaintProperty(id, 'fill-color', '#E8E6E3');
      });
      const all: [number, number][] = [];
      const stops: GeoJSON.Feature[] = [];
      const mids: GeoJSON.Feature[] = [];
      itinerary.legs.forEach((l, i) => {
        const coords = l.path.map((p) => [p.lon, p.lat] as [number, number]);
        all.push(...coords);
        m.addSource(`leg${i}`, { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } } });
        if (l.mode === 'WALK') {
          m.addLayer({ id: `leg${i}`, type: 'line', source: `leg${i}`, layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': WALK_BLUE, 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 4, 18, 8], 'line-dasharray': [0.01, 2] } });
        } else {
          m.addLayer({ id: `leg${i}c`, type: 'line', source: `leg${i}`, layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#FFFFFF', 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 8, 18, 15] } });
          m.addLayer({ id: `leg${i}`, type: 'line', source: `leg${i}`, layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': l.color, 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 5, 18, 10] } });
          l.stops.forEach((x) => mids.push({ type: 'Feature', properties: { name: x.name }, geometry: { type: 'Point', coordinates: [x.lon, x.lat] } }));
          stops.push({ type: 'Feature', properties: { name: l.from.name }, geometry: { type: 'Point', coordinates: [l.from.lon, l.from.lat] } });
          stops.push({ type: 'Feature', properties: { name: l.to.name }, geometry: { type: 'Point', coordinates: [l.to.lon, l.to.lat] } });
        }
      });
      // Caminhos a pé por cima das linhas (em ruas onde passa o autocarro, os pontos azuis ficavam escondidos)
      itinerary.legs.forEach((l, i) => { if (l.mode === 'WALK' && m.getLayer(`leg${i}`)) m.moveLayer(`leg${i}`); });
      m.addSource('done', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } } });
      m.addLayer({ id: 'done', type: 'line', source: 'done', layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#9AA0A6', 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 6, 18, 11] } });
      const dest = itinerary.legs[itinerary.legs.length - 1].to;
      // Paragens intermédias: pontos brancos na linha; o nome aparece ao aproximar
      m.addSource('mids', { type: 'geojson', data: { type: 'FeatureCollection', features: mids } });
      m.addLayer({ id: 'mids', type: 'circle', source: 'mids',
        paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 2.5, 17, 5], 'circle-color': '#FFFFFF', 'circle-stroke-color': '#5F6368', 'circle-stroke-width': 1.5 } });
      m.addLayer({ id: 'mids-label', type: 'symbol', source: 'mids', minzoom: 14.5,
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-anchor': 'left', 'text-offset': [0.8, 0], 'text-max-width': 8, 'text-optional': true },
        paint: { 'text-color': '#3C4043', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.6 } });
      m.addSource('stops', { type: 'geojson', data: { type: 'FeatureCollection', features: stops } });
      m.addLayer({ id: 'stops', type: 'circle', source: 'stops',
        paint: { 'circle-radius': 7, 'circle-color': '#FFFFFF', 'circle-stroke-color': '#202124', 'circle-stroke-width': 2.5 } });
      m.addLayer({ id: 'stops-label', type: 'symbol', source: 'stops',
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': 14, 'text-anchor': 'left', 'text-offset': [0.9, 0], 'text-max-width': 9 },
        paint: { 'text-color': '#202124', 'text-halo-color': '#FFFFFF', 'text-halo-width': 2 } });
      const pin = document.createElement('div');
      pin.innerHTML = `<svg width="30" height="40" viewBox="0 0 30 40"><path d="M15 0C6.7 0 0 6.7 0 15c0 11 15 25 15 25s15-14 15-25C30 6.7 23.3 0 15 0z" fill="#EA4335"/><circle cx="15" cy="15" r="5.5" fill="#A50E0E"/></svg>`;
      new maplibregl.Marker({ element: pin, anchor: 'bottom' }).setLngLat([dest.lon, dest.lat]).addTo(m);
      const b = all.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(all[0], all[0]));
      m.fitBounds(b, { padding: { top: 70, left: 40, right: 40, bottom: 40 + bottomInset }, duration: 0 });
      setReady(true);
    });
    return () => { meRef.current = null; mapRef.current = null; map?.remove(); };
  }, [itinerary]);

  // 2) Caminho já feito a cinzento
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready || !progress) return;
    const coords: [number, number][] = [];
    itinerary.legs.forEach((l, li) => {
      if (li < progress.leg) coords.push(...l.path.map((p) => [p.lon, p.lat] as [number, number]));
      else if (li === progress.leg) coords.push(...l.path.slice(0, progress.idx + 1).map((p) => [p.lon, p.lat] as [number, number]));
    });
    if (me) coords.push([me.lon, me.lat]);
    (m.getSource('done') as maplibregl.GeoJSONSource | undefined)?.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords.length > 1 ? coords : [] } });
  }, [progress?.leg, progress?.idx, ready]);

  // 3) O boneco: desliza suavemente até à nova posição, com círculo de precisão e cone de direção
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready || !me) return;
    if (!meRef.current) meRef.current = new maplibregl.Marker({ element: meMarkerEl() }).setLngLat([me.lon, me.lat]).addTo(m);
    const el = meRef.current.getElement();
    const cone = el.querySelector('[data-cone]') as HTMLElement | null;
    if (cone) {
      cone.style.display = heading == null ? 'none' : 'block';
      if (heading != null) cone.style.transform = `rotate(${heading - (follow && tracking ? m.getBearing() : 0)}deg)`;
    }
    const halo = () => {
      const h = el.querySelector('[data-halo]') as HTMLElement | null;
      if (!h) return;
      const px = Math.min(260, Math.max(0, ((accuracy ?? 0) / mpp(me.lat, m.getZoom())) * 2));
      h.style.width = h.style.height = `${px < 30 ? 0 : px}px`;
    };
    halo();
    m.on('zoom', halo);
    const from = shown.current ?? [me.lon, me.lat];
    const to: [number, number] = [me.lon, me.lat];
    const t0 = performance.now();
    cancelAnimationFrame(anim.current);
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 900);
      const e = 1 - Math.pow(1 - k, 3);
      const p: [number, number] = [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e];
      shown.current = p;
      meRef.current?.setLngLat(p);
      if (k < 1) anim.current = requestAnimationFrame(step);
    };
    anim.current = requestAnimationFrame(step);
    if (follow && tracking) {
      const ride = phase === 'ride';
      m.easeTo({ center: to, zoom: ride ? 15 : 17.5, pitch: ride ? 30 : 50,
        bearing: ride ? m.getBearing() : heading ?? m.getBearing(), padding: { top: 120, left: 0, right: 0, bottom: bottomInset }, duration: 900, easing: (x) => 1 - Math.pow(1 - x, 3) });
    }
    return () => { m.off('zoom', halo); };
  }, [me?.lat, me?.lon, heading, follow, tracking, ready, bottomInset, accuracy, phase]);

  // 4) Autocarros em tempo real
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    const seen = new Set<string>();
    (vehicles ?? []).forEach((v) => {
      seen.add(v.id);
      const mk = buses.current.get(v.id);
      if (mk) mk.setLngLat([v.lon, v.lat]);
      else buses.current.set(v.id, new maplibregl.Marker({ element: busEl(v.color, v.line) }).setLngLat([v.lon, v.lat]).addTo(m));
    });
    buses.current.forEach((mk, id) => { if (!seen.has(id)) { mk.remove(); buses.current.delete(id); } });
  }, [vehicles, ready]);

  return (
    <View style={{ height: height as any, backgroundColor: colors.track }}>
      {/* @ts-ignore — div nativo na web */}
      <div ref={box} style={{ position: 'absolute', inset: 0 }} aria-label="Mapa da viagem" role="img" />
      {follow && !tracking && (
        <Pressable onPress={() => setTracking(true)} accessibilityRole="button" accessibilityLabel="Centrar no boneco"
          style={{ position: 'absolute', right: 14, bottom: bottomInset + 16, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff',
            paddingHorizontal: 16, minHeight: 48, borderRadius: 24, boxShadow: '0 2px 10px rgba(0,0,0,.25)' } as any}>
          {/* @ts-ignore */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#1A73E8"><path d="M12 2 4.5 20.3l.7.7L12 18l6.8 3 .7-.7z"/></svg>
          <T bold style={{ color: '#1A73E8' }}>Centrar</T>
        </Pressable>
      )}
      {failed && (
        <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <T style={{ color: colors.inkSoft, textAlign: 'center' }}>O mapa não carregou aqui. Na app e no site publicado aparece normalmente.</T>
        </View>
      )}
    </View>
  );
}
