import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { fetchStops, norm, searchStopNames, Stop } from './carris';
import FREG from './freguesias.json';

export type Place = { lat: number; lon: number; label: string };

// Zonas conhecidas (fallback quando não há geocodificação, ex.: no preview web).
export const PLACES: Record<string, { lat: number; lon: number }> = {
  oeiras: { lat: 38.6905, lon: -9.3135 }, carcavelos: { lat: 38.6797, lon: -9.3369 }, cascais: { lat: 38.6979, lon: -9.4215 },
  amadora: { lat: 38.7536, lon: -9.2302 }, odivelas: { lat: 38.7928, lon: -9.1838 }, loures: { lat: 38.8309, lon: -9.1685 },
  almada: { lat: 38.679, lon: -9.1569 }, seixal: { lat: 38.6401, lon: -9.1015 }, barreiro: { lat: 38.6631, lon: -9.0724 },
  setúbal: { lat: 38.5244, lon: -8.8882 }, setubal: { lat: 38.5244, lon: -8.8882 }, sintra: { lat: 38.8029, lon: -9.3817 },
  'vila franca': { lat: 38.9553, lon: -8.9897 }, montijo: { lat: 38.7067, lon: -8.9739 }, palmela: { lat: 38.5689, lon: -8.9013 },
  'paço de arcos': { lat: 38.6967, lon: -9.2917 }, lisboa: { lat: 38.7223, lon: -9.1393 }, 'são domingos de rana': { lat: 38.7016, lon: -9.3392 },
  moita: { lat: 38.6509, lon: -8.9903 }, alcochete: { lat: 38.7553, lon: -8.9609 }, sesimbra: { lat: 38.4445, lon: -9.1015 }, mafra: { lat: 38.9372, lon: -9.3276 },
  'costa da caparica': { lat: 38.6446, lon: -9.2367 }, algés: { lat: 38.7022, lon: -9.2297 }, 'cacém': { lat: 38.7697, lon: -9.3005 }, queluz: { lat: 38.7566, lon: -9.2545 }, sacavém: { lat: 38.7944, lon: -9.1056 },
};

export const PLACE_SUGGESTIONS = ['Oeiras', 'Carcavelos', 'Amadora', 'Almada', 'Odivelas', 'Seixal'];

/** Parece uma morada? ("Rua…", "Av.…", "Praça…", ou tem número de porta) */
export function looksLikeStreet(q: string) {
  return /^(r\.?|rua|av\.?|avenida|travessa|tv\.?|largo|lg\.?|praça|pç\.?|estrada|est\.?|calçada|beco|alameda|rotunda|azinhaga|caminho|bairro|urbanização|urb\.?)\s/i.test(q.trim()) || /\d/.test(q);
}

export async function resolvePlace(q: string): Promise<Place | null> {
  const k = q.trim().toLowerCase();
  if (!k) return null;
  // Moradas: primeiro o geocodificador do próprio telemóvel (Apple/Google, sem chave), depois o OpenStreetMap.
  if (looksLikeStreet(q)) {
    if (Platform.OS !== 'web') {
      try {
        const r = await Location.geocodeAsync(q + ', Portugal');
        if (r[0]) return { lat: r[0].latitude, lon: r[0].longitude, label: q.trim() };
      } catch {}
    }
    try {
      const o = (await searchPlacesOnline(q))[0];
      if (o) return { lat: o.lat, lon: o.lon, label: q.trim() };
    } catch {}
  }
  const preset = Object.keys(PLACES).find((p) => k.includes(p));
  if (preset) return { ...PLACES[preset], label: q.trim() };
  // Freguesias/concelhos e nomes de paragens (ex.: "Alvalade", "Hospital de Cascais")
  const hit = searchPlacesLocal(q, await fetchStops(), 1)[0];
  if (hit) return { lat: hit.lat, lon: hit.lon, label: hit.label };
  if (Platform.OS !== 'web') {
    try {
      const r = await Location.geocodeAsync(q + ', Portugal');
      if (r[0]) return { lat: r[0].latitude, lon: r[0].longitude, label: q.trim() };
    } catch {}
  }
  return null;
}

export function suggestPlaces(q: string): Place[] {
  const k = q.trim().toLowerCase();
  if (k.length < 2) return [];
  return Object.keys(PLACES).filter((p) => p.includes(k)).slice(0, 3)
    .map((p) => ({ ...PLACES[p], label: p.replace(/(^|\s)\S/g, (c) => c.toUpperCase()) }));
}

export async function currentPlace(): Promise<Place | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { lat: p.coords.latitude, lon: p.coords.longitude, label: 'A minha localização' };
  } catch { return null; }
}

// ---------- Pesquisa de qualquer sítio ----------
// 1) Todas as freguesias e concelhos do país (lista embutida, funciona sem internet).
// 2) Nomes das paragens da Carris Metropolitana (hospitais, escolas, estações…).
// 3) No telemóvel: ruas e locais via Photon/OpenStreetMap (sem chave; © OpenStreetMap).
type Gaz = { label: string; sub: string; lat: number; lon: number; n: string };
const title = (x: string) => x.toLowerCase().replace(/(^|[\s-])\S/g, (c) => c.toUpperCase()).replace(/ (De|Da|Do|Dos|Das|E) /g, (m) => m.toLowerCase());

const GAZ: Gaz[] = (() => {
  const rows = FREG as unknown as [string, string, number, number][];
  const out: Gaz[] = rows.map(([name, muni, lat, lon]) => ({ label: name, sub: title(muni), lat, lon, n: norm(name) }));
  const muni = new Map<string, { lat: number; lon: number; k: number }>();
  for (const [, m, lat, lon] of rows) { const x = muni.get(m) ?? { lat: 0, lon: 0, k: 0 }; x.lat += lat; x.lon += lon; x.k++; muni.set(m, x); }
  for (const [m, x] of muni) out.push({ label: title(m), sub: 'Concelho', lat: x.lat / x.k, lon: x.lon / x.k, n: norm(m) });
  return out;
})();

const LX = { lat: 38.72, lon: -9.14 };
const near = (p: { lat: number; lon: number }) => Math.hypot(p.lat - LX.lat, (p.lon - LX.lon) * 0.78);

export type Suggestion = Place & { sub?: string; source: 'zona' | 'paragem' | 'mapa' };

export function searchPlacesLocal(q: string, stops: Stop[], n = 7): Suggestion[] {
  const k = norm(q.trim());
  if (k.length < 2) return [];
  const words = k.split(/\s+/);
  const gaz = GAZ.filter((g) => words.every((w) => g.n.includes(w)))
    .map((g) => ({ g, score: (g.n.startsWith(words[0]) ? 0 : 2) + (near(g) < 0.5 ? 0 : 1) + (g.sub === 'Concelho' ? -0.5 : 0) }))
    .sort((a, b) => a.score - b.score || a.g.label.length - b.g.label.length)
    .slice(0, 5)
    .map(({ g }) => ({ lat: g.lat, lon: g.lon, label: g.label, sub: g.sub, source: 'zona' as const }));
  const st = searchStopNames(stops, q, 12).sort((a, b) => near(a) - near(b)).slice(0, 4).map((x) => ({ ...x, sub: 'Paragem', source: 'paragem' as const }));
  const seen = new Set<string>();
  return [...gaz, ...st].filter((x) => { const key = x.label + (x.sub ?? ''); if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, n);
}

/** Ruas, números de porta e locais via OpenStreetMap. No preview do Claude é bloqueado (caixa fechada); na app e na versão web publicada funciona. */
export async function searchPlacesOnline(q: string, signal?: AbortSignal): Promise<Suggestion[]> {
  if (q.trim().length < 3) return [];
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=10&lat=${LX.lat}&lon=${LX.lon}&bbox=-9.55,38.35,-8.6,39.1`;
  const r = await fetch(url, Platform.OS === 'web' ? { signal } : { signal, headers: { 'User-Agent': 'SaiAgora/1.0' } });
  if (!r.ok) return [];
  const j = await r.json();
  return (j.features ?? []).map((f: any) => {
    const p = f.properties ?? {};
    const label = p.name ? p.name : [p.street, p.housenumber].filter(Boolean).join(' ');
    const sub = [p.street && p.name ? p.street : null, p.district, p.city ?? p.county].filter(Boolean).join(', ');
    const street = p.osm_key === 'highway' || p.type === 'street' || !!p.housenumber;
    // Locais onde as pessoas vão (centros comerciais, estações, hospitais…) primeiro; autoestradas e pontes nunca.
    const place = ['shop', 'amenity', 'tourism', 'railway', 'public_transport', 'leisure', 'building', 'office'].includes(p.osm_key);
    const skip = ['motorway', 'trunk', 'motorway_link', 'bridge'].includes(p.osm_value);
    const rank = place ? 0 : street ? 1 : 2;
    return { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], label: label || sub, sub, source: 'mapa' as const, street, rank, skip };
  }).filter((x: any) => x.label && !x.skip)
    // Uma rua aparece partida em muitos troços: mostra uma só por nome + zona.
    .filter((x: Suggestion, i: number, arr: Suggestion[]) => arr.findIndex((y) => y.label === x.label && (y.sub ?? '').split(', ').pop() === (x.sub ?? '').split(', ').pop()) === i)
    .sort((a: any, b: any) => (looksLikeStreet(q) ? Number(b.street) - Number(a.street) : a.rank - b.rank))
    .slice(0, 5);
}
