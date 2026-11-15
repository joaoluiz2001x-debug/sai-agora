/**
 * Dados da Carris Metropolitana — API pública, sem chave nem registo.
 * Base: https://api.carrismetropolitana.pt/v2
 *   GET /stops                  → paragens (id, long_name, lat, lon, line_ids, pattern_ids)
 *   GET /arrivals/by_stop/:id   → passagens do dia (estimated_arrival_unix = tempo real)
 *   GET /patterns/:id           → percurso de uma variante de linha (path com stop_id, horários, cor)
 *   GET /alerts                 → avisos de serviço (GTFS-RT Service Alerts: greves, desvios, paragens fechadas)
 * Dados da rede: licença CC BY 4.0 — é obrigatório indicar a fonte.
 * Sem acesso à API (ex.: preview web), usa dados de EXEMPLO e diz isso no ecrã.
 */

export type Stop = { id: string; name: string; lat: number; lon: number; lines: string[]; patterns: string[] };
export type Arrival = { line: string; headsign: string; at: number; live: boolean; scheduled: number; tripId: string };
export type Option = {
  line: string; color: string; textColor: string; headsign: string;
  board: Stop; boardWalkMin: number; alight: Stop; alightWalkMin: number; rideMin: number;
};
export type Alert = {
  id: string; kind: 'greve' | 'desvio' | 'paragem' | 'atraso' | 'info';
  title: string; text: string; start?: number; end?: number; lines: string[]; stops: string[];
};

const BASE = 'https://api.carrismetropolitana.pt/v2';
/** A API devolve alguns ids com o prefixo do operador, ex.: "[LA77N]1604" → "1604". */
const clean = (x: string | null | undefined) => String(x ?? '').replace(/^\[[^\]]*\]/, '');
let sampleMode = false;
export const isSample = () => sampleMode;

async function getJson<T>(path: string, timeoutMs = 8000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(BASE + path, { signal: ctrl.signal });
    if (!r.ok) throw new Error(String(r.status));
    return (await r.json()) as T;
  } finally { clearTimeout(t); }
}

// ---------- Cálculos ----------
export function distanceM(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371000, k = Math.PI / 180;
  const dLat = (b.lat - a.lat) * k, dLon = (b.lon - a.lon) * k;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * k) * Math.cos(b.lat * k) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
/** Minutos a pé: linha reta × 1,3 a 4,5 km/h, multiplicado pelo ritmo escolhido (1 = normal). */
export function walkMinutes(meters: number, pace = 1) {
  return Math.max(1, Math.round(((meters * 1.3) / 4500) * 60 * pace));
}
export function nearestStops(stops: Stop[], me: { lat: number; lon: number }, n = 8) {
  return stops.map((s) => ({ s, d: distanceM(me, s) })).sort((a, b) => a.d - b.d).slice(0, n);
}

// ---------- Exemplo ----------
const SAMPLE_STOPS: Stop[] = [
  { id: '121270', name: 'Oeiras (Estação) P8 Entrada Norte', lat: 38.688615, lon: -9.316617, lines: ['1604', '1120', '1523'], patterns: [] },
  { id: '900001', name: 'Paragem de exemplo — Av. Principal', lat: 38.6912, lon: -9.3121, lines: ['1607', '1614'], patterns: [] },
  { id: '900002', name: 'Paragem de exemplo — Escola', lat: 38.6941, lon: -9.3189, lines: ['1615', '1618'], patterns: [] },
  { id: '900003', name: 'Carcavelos (Estação) — exemplo', lat: 38.6795, lon: -9.3363, lines: ['1604'], patterns: [] },
  { id: '900004', name: 'Paragem de exemplo — Centro de Saúde', lat: 38.7012, lon: -9.2990, lines: ['1120', '1607'], patterns: [] },
];
const SAMPLE_HEAD: Record<string, string> = { '1604': 'Carcavelos (Estação)' };
const SAMPLE_COLOR: Record<string, string> = { '1604': '#C61D23', '1120': '#1D6FB8', '1523': '#2E7D32', '1607': '#C61D23', '1614': '#6A1B9A', '1615': '#1D6FB8', '1618': '#2E7D32' };

function sampleArrivals(stop: Stop): Arrival[] {
  const now = Math.floor(Date.now() / 1000);
  const out: Arrival[] = [];
  stop.lines.forEach((line, li) => {
    const every = [12, 15, 20][li % 3] * 60;
    const first = now - (now % every) + li * 4 * 60;
    for (let k = 0; k < 6; k++) {
      const scheduled = first + k * every;
      const delay = ((scheduled / 60 + li) % 5) * 60 - 60;
      const live = scheduled - now < 25 * 60;
      out.push({ line, headsign: SAMPLE_HEAD[line] ?? 'Destino de exemplo', scheduled, at: live ? scheduled + delay : scheduled, live, tripId: `${stop.id}-${line}-${k}` });
    }
  });
  return out.filter((a) => a.at > now - 60).sort((a, b) => a.at - b.at);
}

function sampleAlerts(): Alert[] {
  const now = Math.floor(Date.now() / 1000);
  return [
    { id: 'ex1', kind: 'greve', title: 'Exemplo: greve parcial de motoristas', text: 'Exemplo de aviso. Serviço reduzido em algumas linhas entre as 05h00 e as 10h00. Os horários em tempo real mostram os autocarros que circulam.', start: now - 3600, end: now + 86400, lines: ['1604', '1120'], stops: [] },
    { id: 'ex2', kind: 'desvio', title: 'Exemplo: desvio por obras', text: 'Exemplo de aviso. A linha segue por percurso alternativo; a paragem habitual não é servida.', start: now - 86400, end: now + 7 * 86400, lines: ['1614'], stops: ['900001'] },
    { id: 'ex3', kind: 'info', title: 'Exemplo: horário de feriado', text: 'Exemplo de aviso. No feriado aplica-se o horário de domingo.', lines: [], stops: [] },
  ];
}

// ---------- API ----------
let stopsCache: Stop[] | null = null;

export async function fetchStops(): Promise<Stop[]> {
  if (stopsCache) return stopsCache;
  try {
    type Raw = { id: string; long_name: string; lat: number | string; lon: number | string; line_ids?: string[]; pattern_ids?: string[]; operational_status?: string };
    const raw = await getJson<Raw[]>('/stops', 15000);
    stopsCache = raw.filter((s) => s.operational_status !== 'inactive').map((s) => ({
      id: clean(s.id), name: s.long_name, lat: Number(s.lat), lon: Number(s.lon), lines: (s.line_ids ?? []).map(clean), patterns: s.pattern_ids ?? [],
    }));
    sampleMode = false;
  } catch {
    sampleMode = true;
    stopsCache = SAMPLE_STOPS;
  }
  return stopsCache;
}

export async function fetchArrivals(stop: Pick<Stop, 'id' | 'lines'> & Partial<Stop>): Promise<Arrival[]> {
  if (sampleMode) return sampleArrivals(stop as Stop);
  try {
    type Raw = { line_id: string; headsign: string; scheduled_arrival_unix: number; estimated_arrival_unix: number | null; trip_id: string | null; pattern_id: string };
    const raw = await getJson<Raw[]>(`/arrivals/by_stop/${stop.id}`);
    const now = Math.floor(Date.now() / 1000);
    return raw.map((a) => ({
      line: clean(a.line_id), headsign: a.headsign, scheduled: a.scheduled_arrival_unix,
      at: a.estimated_arrival_unix ?? a.scheduled_arrival_unix, live: a.estimated_arrival_unix != null,
      tripId: a.trip_id ?? `${clean(a.pattern_id)}-${a.scheduled_arrival_unix}`,
    })).filter((a) => a.at > now - 60).sort((a, b) => a.at - b.at);
  } catch {
    return sampleArrivals(stop as Stop);
  }
}

const toSec = (t: string) => { const [h, m, s] = t.split(':').map(Number); return h * 3600 + m * 60 + (s || 0); };

/**
 * Para onde vai? Procura linhas que passam numa paragem perto da origem e DEPOIS numa paragem perto do destino.
 * Usa os percursos (/patterns) das paragens mais próximas da origem.
 */
export async function findOptions(from: { lat: number; lon: number }, to: { lat: number; lon: number }, pace = 1): Promise<Option[]> {
  const stops = await fetchStops();
  if (sampleMode) {
    const board = nearestStops(stops, from, 3);
    const alight = nearestStops(stops, to, 1)[0];
    if (!alight || alight.d > 1000) return [];
    return board.slice(0, 2).map(({ s, d }, i) => ({
      line: s.lines[0], color: SAMPLE_COLOR[s.lines[0]] ?? '#0A5BA8', textColor: '#FFFFFF', headsign: SAMPLE_HEAD[s.lines[0]] ?? 'Destino de exemplo',
      board: s, boardWalkMin: walkMinutes(d, pace), alight: alight.s, alightWalkMin: walkMinutes(alight.d, pace), rideMin: 9 + i * 6,
    }));
  }
  const byId = new Map(stops.map((s) => [s.id, s]));
  const origin = nearestStops(stops, from, 10).filter((x) => x.d < 1500);
  const destNear = new Map(stops.map((s) => [s.id, distanceM(to, s)] as const).filter(([, d]) => d < 1000));
  if (!origin.length || !destNear.size) return [];
  const patternIds = [...new Set(origin.flatMap((o) => o.s.patterns))].slice(0, 60);
  type RawPattern = { id: string; line_id: string; headsign: string; color?: string; text_color?: string; path: { stop_id: string }[]; trips?: { schedule: { stop_id: string; arrival_time: string }[] }[] };
  const patterns = (await Promise.all(patternIds.map((id) => getJson<RawPattern[]>(`/patterns/${id}`).then((r) => r[0]).catch(() => null))))
    .filter((p): p is RawPattern => !!p);
  const best = new Map<string, Option>(); // melhor opção por linha
  for (const p of patterns) {
    const ids = p.path.map((x) => clean(x.stop_id));
    for (const o of origin) {
      const i = ids.indexOf(o.s.id);
      if (i < 0) continue;
      let j = -1, dj = Infinity;
      for (let k = i + 1; k < ids.length; k++) { const d = destNear.get(ids[k]); if (d != null && d < dj) { dj = d; j = k; } }
      if (j < 0) continue;
      const sched = p.trips?.[0]?.schedule;
      const tA = sched?.find((x) => clean(x.stop_id) === ids[i]); const tB = sched?.find((x) => clean(x.stop_id) === ids[j]);
      const rideMin = tA && tB ? Math.max(1, Math.round((toSec(tB.arrival_time) - toSec(tA.arrival_time)) / 60)) : Math.max(2, (j - i) * 1.5);
      const alight = byId.get(ids[j]);
      if (!alight) continue;
      const opt: Option = { line: clean(p.line_id), color: p.color ?? '#0A5BA8', textColor: p.text_color ?? '#FFFFFF', headsign: p.headsign,
        board: o.s, boardWalkMin: walkMinutes(o.d, pace), alight, alightWalkMin: walkMinutes(dj, pace), rideMin: Math.round(rideMin) };
      const cur = best.get(clean(p.line_id));
      const cost = (x: Option) => x.boardWalkMin + x.rideMin + x.alightWalkMin;
      if (!cur || cost(opt) < cost(cur)) best.set(clean(p.line_id), opt);
    }
  }
  return [...best.values()].sort((a, b) => a.boardWalkMin + a.rideMin + a.alightWalkMin - (b.boardWalkMin + b.rideMin + b.alightWalkMin)).slice(0, 6);
}

// ---------- Avisos (greves, desvios, condicionamentos) ----------
function kindOf(cause?: string, effect?: string, text = ''): Alert['kind'] {
  const c = `${cause ?? ''} ${effect ?? ''} ${text}`.toUpperCase();
  if (c.includes('STRIKE') || c.includes('GREVE')) return 'greve';
  if (c.includes('DETOUR') || c.includes('DESVIO')) return 'desvio';
  if (c.includes('STOP_MOVED') || c.includes('NO_SERVICE') || c.includes('PARAGEM')) return 'paragem';
  if (c.includes('DELAY') || c.includes('REDUCED') || c.includes('ATRASO')) return 'atraso';
  return 'info';
}
const tr = (t: any): string => t?.translation?.find?.((x: any) => (x.language ?? '').startsWith('pt'))?.text ?? t?.translation?.[0]?.text ?? (typeof t === 'string' ? t : '');

export async function fetchAlerts(): Promise<Alert[]> {
  if (sampleMode) return sampleAlerts();
  try {
    const raw: any = await getJson<any>('/alerts');
    const entities: any[] = Array.isArray(raw) ? raw : raw?.entity ?? [];
    const now = Date.now() / 1000;
    return entities.map((e) => {
      const a = e.alert ?? e;
      const title = tr(a.header_text ?? a.headerText);
      const text = tr(a.description_text ?? a.descriptionText);
      const per = (a.active_period ?? a.activePeriod ?? [])[0] ?? {};
      const ents: any[] = a.informed_entity ?? a.informedEntity ?? [];
      const lines = [...new Set(ents.map((x) => clean(x.route_id ?? x.routeId).split('_')[0]).filter(Boolean))];
      const stopsIds = [...new Set(ents.map((x) => clean(x.stop_id ?? x.stopId)).filter(Boolean))];
      return { id: String(e.id ?? title), kind: kindOf(a.cause, a.effect, title), title, text,
        start: per.start ? Number(per.start) : undefined, end: per.end ? Number(per.end) : undefined, lines, stops: stopsIds } as Alert;
    }).filter((x) => x.title && (!x.end || x.end > now)).sort((a, b) => (a.kind === 'greve' ? -1 : 0) - (b.kind === 'greve' ? -1 : 0));
  } catch {
    return sampleAlerts();
  }
}

// ---------- Pesquisa de locais pelos nomes das paragens (sem serviços externos) ----------
export const norm = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Sugestões a partir dos nomes das paragens: "hospital", "escola", "estação", ruas, bairros… */
export function searchStopNames(stops: Stop[], q: string, n = 6): { label: string; lat: number; lon: number }[] {
  const words = norm(q).split(/\s+/).filter((w) => w.length > 1);
  if (!words.length) return [];
  const seen = new Map<string, { label: string; lat: number; lon: number; score: number }>();
  for (const st of stops) {
    const nm = norm(st.name);
    if (!words.every((w) => nm.includes(w))) continue;
    const label = st.name.replace(/\s*\(?P\d+.*$/i, '').trim(); // junta "Estação P1", "Estação P2"…
    if (seen.has(label)) continue;
    seen.set(label, { label, lat: st.lat, lon: st.lon, score: nm.startsWith(words[0]) ? 0 : 1 });
  }
  return [...seen.values()].sort((a, b) => a.score - b.score || a.label.length - b.label.length).slice(0, n);
}

export type Vehicle = { id: string; line: string; lat: number; lon: number; bearing: number; tripId: string };
/** Autocarros da Carris Metropolitana em tempo real (posição GPS), só das linhas pedidas. */
export async function fetchVehicles(lines: string[]): Promise<Vehicle[]> {
  if (!lines.length) return [];
  const r = await fetch(`${BASE}/vehicles`);
  if (!r.ok) return [];
  const all: any[] = await r.json();
  return all
    .filter((v) => lines.includes(clean(String(v.line_id))) && typeof v.lat === 'number')
    .map((v) => ({ id: String(v.id), line: clean(String(v.line_id)), lat: v.lat, lon: v.lon, bearing: v.bearing ?? 0, tripId: String(v.trip_id ?? '') }));
}
