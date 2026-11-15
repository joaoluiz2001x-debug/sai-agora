/**
 * Planeador de viagens com transbordos — API do Transitous (MOTIS 2).
 * https://transitous.org/api/  ·  Fontes: https://transitous.org/sources/
 * Condições de uso: projeto open-source, não comercial e com poucos pedidos.
 * Por isso: cache de 60 s por pedido e nada de atualizações automáticas agressivas.
 * Quando a app crescer: trocar BASE por um servidor MOTIS próprio (mesma API).
 */
import { Platform } from 'react-native';

export const TRANSITOUS_BASE = 'https://api.transitous.org/api/v1';
export const TRANSITOUS_SOURCES = 'https://transitous.org/sources/';
const USER_AGENT = 'SaiAgora/0.4 (+https://reliable-cendol-bdbd97.netlify.app)';

export type Mode = 'WALK' | 'BUS' | 'SUBWAY' | 'TRAM' | 'RAIL' | 'FERRY' | 'FUNICULAR' | 'OTHER';
export type Point = { lat: number; lon: number };
export type Stop = Point & { name: string; stopId?: string; stopCode?: string; time: number; scheduled: number };

export type Leg = {
  mode: Mode;
  from: Stop;
  to: Stop;
  start: number; // unix s
  end: number;
  scheduledStart: number;
  realTime: boolean;
  distance?: number; // m (a pé)
  route?: string;
  routeLong?: string;
  color: string;
  textColor: string;
  headsign?: string;
  agency?: string;
  stopsCount?: number;
  /** Paragens intermédias (onde o autocarro para pelo caminho), com hora prevista. */
  stops: (Point & { name: string; at: number })[];
  path: Point[];
  streets: string[]; // ruas do percurso a pé
};

export type Itinerary = {
  id: string;
  start: number;
  end: number;
  duration: number; // s
  transfers: number;
  legs: Leg[];
};

const t = (iso?: string) => (iso ? Math.round(new Date(iso).getTime() / 1000) : 0);

/** Descodifica polylines do Google com a precisão indicada (o MOTIS usa 7). */
export function decodePolyline(str: string, precision = 7): Point[] {
  const f = Math.pow(10, precision);
  const out: Point[] = [];
  let i = 0, lat = 0, lon = 0;
  while (i < str.length) {
    for (const k of [0, 1]) {
      let shift = 0, result = 0, b: number;
      do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (k === 0) lat += d; else lon += d;
    }
    out.push({ lat: lat / f, lon: lon / f });
  }
  return out;
}

const MODE_COLOR: Record<string, string> = { WALK: '#6B7280', SUBWAY: '#0A5BA8', BUS: '#C61D23', TRAM: '#E3A008', RAIL: '#18794E', FERRY: '#0E7490' };

function stop(x: any, label: 'START' | 'END' | null, names: { from: string; to: string }): Stop {
  const name = x.name === 'START' ? names.from : x.name === 'END' ? names.to : x.name;
  return {
    name, stopId: x.stopId, stopCode: x.stopCode, lat: x.lat, lon: x.lon,
    time: t(x.departure ?? x.arrival), scheduled: t(x.scheduledDeparture ?? x.scheduledArrival),
  };
}

const cache = new Map<string, { at: number; data: Itinerary[] }>();

export async function planTrip(from: Point, to: Point, names: { from: string; to: string }, opts: { arriveBy?: boolean; time?: Date } = {}): Promise<Itinerary[]> {
  const q = new URLSearchParams({
    fromPlace: `${from.lat.toFixed(5)},${from.lon.toFixed(5)}`,
    toPlace: `${to.lat.toFixed(5)},${to.lon.toFixed(5)}`,
    numItineraries: '5',
    detailedTransfers: 'true',
  });
  if (opts.time) q.set('time', opts.time.toISOString());
  if (opts.arriveBy) q.set('arriveBy', 'true');
  const key = q.toString();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.data;

  const r = await fetch(`${TRANSITOUS_BASE}/plan?${key}`, Platform.OS === 'web' ? {} : { headers: { 'User-Agent': USER_AGENT } });
  if (!r.ok) throw new Error('plan ' + r.status);
  const j = await r.json();
  const data: Itinerary[] = (j.itineraries ?? []).map((it: any) => ({
    id: it.id ?? `${it.startTime}-${it.endTime}`,
    start: t(it.startTime), end: t(it.endTime), duration: it.duration, transfers: it.transfers ?? 0,
    legs: (it.legs ?? []).map((l: any): Leg => {
      const mode = (['WALK', 'BUS', 'SUBWAY', 'TRAM', 'RAIL', 'FERRY', 'FUNICULAR'].includes(l.mode) ? l.mode : l.mode === 'METRO' ? 'SUBWAY' : l.mode?.includes('RAIL') ? 'RAIL' : 'OTHER') as Mode;
      const color = l.routeColor ? '#' + l.routeColor : MODE_COLOR[mode] ?? '#374151';
      return {
        mode, from: stop(l.from, null, names), to: stop(l.to, null, names),
        start: t(l.startTime), end: t(l.endTime), scheduledStart: t(l.scheduledStartTime), realTime: !!l.realTime,
        distance: l.distance, route: l.routeShortName || l.displayName, routeLong: l.routeLongName,
        color, textColor: l.routeTextColor ? '#' + l.routeTextColor : '#FFFFFF',
        headsign: l.headsign, agency: l.agencyName, stopsCount: l.intermediateStops ? l.intermediateStops.length + 1 : undefined,
        stops: (l.intermediateStops ?? []).filter((x: any) => typeof x.lat === 'number').map((x: any) => ({ lat: x.lat, lon: x.lon, name: x.name ?? '', at: t(x.arrival ?? x.departure ?? x.scheduledArrival) })),
        path: l.legGeometry?.points ? decodePolyline(l.legGeometry.points, l.legGeometry.precision ?? 7) : [l.from, l.to],
        streets: [...new Set<string>((l.steps ?? []).map((s: any) => s.streetName).filter((x: string) => x && x.length > 2))].slice(0, 3),
      };
    }),
  }));
  cache.set(key, { at: Date.now(), data });
  return data;
}

// ---------- Tempo real da Carris Metropolitana nas pernas de autocarro dela ----------
const strip = (x: string | null | undefined) => String(x ?? '').replace(/^\[[^\]]*\]/, '');

/** O Transitous nem sempre traz o tempo real da Carris Metropolitana: completamos com a API dela. */
export async function enrichWithCarrisMetropolitana(it: Itinerary): Promise<Itinerary> {
  const legs = await Promise.all(it.legs.map(async (l) => {
    if (l.mode !== 'BUS' || l.realTime || !l.agency?.includes('Carris Metropolitana') || !l.from.stopCode) return l;
    try {
      const r = await fetch(`https://api.carrismetropolitana.pt/v2/arrivals/by_stop/${l.from.stopCode}`);
      if (!r.ok) return l;
      const arr: any[] = await r.json();
      const m = arr.find((a) => strip(a.line_id) === l.route && Math.abs(a.scheduled_arrival_unix - l.scheduledStart) < 120);
      if (!m?.estimated_arrival_unix) return l;
      const delta = m.estimated_arrival_unix - m.scheduled_arrival_unix;
      return { ...l, start: l.scheduledStart + delta, end: l.end + delta, realTime: true };
    } catch { return l; }
  }));
  return { ...it, legs };
}

// ---------- Ajudas de apresentação ----------
export const MODE_LABEL: Record<Mode, string> = {
  WALK: 'A pé', BUS: 'Autocarro', SUBWAY: 'Metro', TRAM: 'Elétrico', RAIL: 'Comboio', FERRY: 'Barco', FUNICULAR: 'Ascensor', OTHER: 'Transporte',
};

const METRO_LINES: Record<string, string> = { Az: 'Linha Azul', Am: 'Linha Amarela', Vd: 'Linha Verde', Vm: 'Linha Vermelha' };
export function lineName(l: Leg) {
  if (l.mode === 'SUBWAY' && l.route && METRO_LINES[l.route]) return METRO_LINES[l.route];
  if (l.mode === 'RAIL') return l.route && l.route.length > 6 ? `Comboio (Linha ${l.route})` : `Comboio ${l.route ?? ''}`.trim();
  return l.route ?? MODE_LABEL[l.mode];
}

/** Hora a que tem de sair de casa = início da 1.ª perna (a pé). */
export function leaveTime(it: Itinerary) {
  return it.legs[0]?.start ?? it.start;
}

/** Próximas partidas da mesma linha e sentido na paragem de embarque (para quem perde o autocarro). */
export async function nextDepartures(l: Leg, n = 3): Promise<{ at: number; realTime: boolean; delay: number }[]> {
  if (l.mode === 'WALK' || !l.from.stopId) return [];
  const r = await fetch(`${TRANSITOUS_BASE}/stoptimes?stopId=${encodeURIComponent(l.from.stopId)}&n=80&time=${new Date((l.start - 60) * 1000).toISOString()}`,
    Platform.OS === 'web' ? undefined : { headers: { 'User-Agent': USER_AGENT } });
  if (!r.ok) return [];
  const j = await r.json();
  return (j.stopTimes ?? [])
    .filter((x: any) => (x.routeShortName ?? x.displayName) === l.route && (!l.headsign || x.headsign === l.headsign))
    .map((x: any) => ({ at: t(x.place.departure), realTime: !!x.realTime, delay: t(x.place.departure) - t(x.place.scheduledDeparture) }))
    .filter((x: any) => x.at > l.start + 30)
    .slice(0, n);
}
