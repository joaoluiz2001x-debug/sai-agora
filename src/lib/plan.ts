import type { Place } from '../data/places';
import type { Itinerary } from '../data/transit';
import { leaveTime } from '../data/transit';

export type Settings = { bufferMin: number; simpleDefault: boolean };
export const DEFAULT_SETTINGS: Settings = { bufferMin: 0, simpleDefault: false };

/** Viagem guardada: de onde, para onde e um nome. O caminho é recalculado sempre que a app abre. */
export type Trip = { id: string; label: string; from: Place; to: Place };

export type Plan = { it: Itinerary; leaveAt: number; secondsToLeave: number; state: 'cedo' | 'prepare' | 'saia' };

/** Primeira viagem que ainda dá para apanhar (sair no máximo há 30 s). */
export function pickPlan(its: Itinerary[], nowS = Date.now() / 1000): Plan | null {
  const ok = its.filter((it) => leaveTime(it) >= nowS - 30).sort((a, b) => a.end - b.end || leaveTime(a) - leaveTime(b));
  const it = ok[0];
  if (!it) return null;
  const leaveAt = leaveTime(it);
  const secondsToLeave = Math.round(leaveAt - nowS);
  return { it, leaveAt, secondsToLeave, state: secondsToLeave <= 30 ? 'saia' : secondsToLeave <= 5 * 60 ? 'prepare' : 'cedo' };
}

export function tripLines(it?: Itinerary) {
  return it ? it.legs.filter((l) => l.mode !== 'WALK' && l.route).map((l) => l.route!) : [];
}
export function tripStops(it?: Itinerary) {
  return it ? it.legs.filter((l) => l.mode !== 'WALK').flatMap((l) => [l.from.stopCode, l.to.stopCode]).filter(Boolean) as string[] : [];
}

export function hhmm(unix: number) {
  const d = new Date(unix * 1000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function countdown(sec: number) {
  if (sec <= 30) return 'Agora';
  const m = Math.ceil(sec / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}
