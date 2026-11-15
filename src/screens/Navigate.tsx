/**
 * Modo viagem ("Iniciar"): mapa em ecrã inteiro que segue o boneco pelo GPS, como no Google Maps.
 * Em cima: a instrução do momento (caminhe até…, apanhe o 750…, saia em…). Em baixo: hora de chegada e Terminar.
 * Para testar sem sair de casa, abra o site com ?sim=1 — o boneco percorre a rota sozinho.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, View, useWindowDimensions } from 'react-native';
import * as Location from 'expo-location';
import { colors } from '../theme';
import { Icon, T } from '../components/ui';
import { RouteMap } from '../components/RouteMap';
import { LineBadge, ModeIcon } from '../components/TransitUI';
import { Itinerary, Leg, Point, nextDepartures } from '../data/transit';
import { Vehicle, fetchVehicles } from '../data/carris';
import { hhmm } from '../lib/plan';

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;
function dist(a: Point, b: Point) {
  const x = rad(b.lon - a.lon) * Math.cos(rad((a.lat + b.lat) / 2));
  const y = rad(b.lat - a.lat);
  return Math.sqrt(x * x + y * y) * R;
}
function bearing(a: Point, b: Point) {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
/** Onde estou na rota: perna atual, ponto mais próximo e metros que faltam nessa perna. */
function locate(it: Itinerary, me: Point, minLeg: number) {
  let best = { leg: minLeg, idx: 0, d: Infinity };
  it.legs.forEach((l, li) => {
    if (li < minLeg) return;
    l.path.forEach((p, pi) => { const d = dist(me, p); if (d < best.d - 5) best = { leg: li, idx: pi, d }; });
  });
  const path = it.legs[best.leg].path;
  let left = 0;
  for (let i = best.idx; i < path.length - 1; i++) left += dist(path[i], path[i + 1]);
  return { ...best, left };
}
const fmtDist = (m: number) => (m >= 950 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${Math.max(10, Math.round(m / 10) * 10)} m`);
const inMin = (t: number, now: number) => { const m = Math.round((t - now) / 60); return m <= 0 ? 'agora' : `daqui a ${m} min`; };

function Instruction({ leg, next, left, now, offRoute, busAway, riding, ahead, nextAt }: { nextAt?: number; leg: Leg; next?: Leg; left: number; now: number; offRoute: boolean; busAway?: number; riding: boolean; ahead: Leg['stops'] }) {
  const walk = leg.mode === 'WALK';
  const big = { fontSize: 22, lineHeight: 28, color: '#fff' };
  const small = { fontSize: 16, color: colors.boardMuted };
  let title: React.ReactNode, sub: string;
  if (walk && next) {
    title = <T bold style={big}>Caminhe até {next.from.name}</T>;
    sub = `${fmtDist(left)} · o ${next.route ?? ''} passa às ${hhmm(next.start)} (${inMin(next.start, now)})`;
  } else if (walk) {
    title = <T bold style={big}>Caminhe até ao destino</T>;
    sub = `${fmtDist(left)} · chega às ${hhmm(leg.end)}`;
  } else if (!riding && now > leg.start + 60 && nextAt) {
    title = <T bold style={big}>Perdeu o {leg.route}? O próximo passa às {hhmm(nextAt)}</T>;
    sub = `${inMin(nextAt, now)} em ${leg.from.name}`;
  } else if (!riding) {
    title = <T bold style={big}>Apanhe o {leg.route} → {leg.headsign}</T>;
    sub = `Passa ${inMin(leg.start, now)} (${hhmm(leg.start)}) em ${leg.from.name}${busAway != null ? ` · o autocarro está a ${fmtDist(busAway)}` : ''}`;
  } else {
    const n = ahead.length + 1;
    if (n <= 1) {
      title = <T bold style={big}>Saia na próxima: {leg.to.name}</T>;
      sub = `Carregue no botão de paragem · ${hhmm(leg.end)}`;
    } else {
      title = <T bold style={big}>Próxima paragem: {ahead[0].name}</T>;
      sub = `Saia em ${leg.to.name} daqui a ${n} paragens (${hhmm(leg.end)})${next && next.mode !== 'WALK' ? ` · depois o ${next.route}` : ''}`;
    }
  }
  return (
    <View style={{ position: 'absolute', top: 44, left: 12, right: 12, backgroundColor: offRoute ? '#B45309' : colors.board, borderLeftWidth: 6, borderLeftColor: offRoute ? '#FDE68A' : colors.amber, borderRadius: 18, padding: 14,
      flexDirection: 'row', gap: 12, alignItems: 'center', boxShadow: '0 4px 14px rgba(0,0,0,.25)' } as any}>
      <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: walk ? 'rgba(255,255,255,.18)' : leg.color, alignItems: 'center', justifyContent: 'center' }}>
        <ModeIcon mode={leg.mode} size={28} color={walk ? '#fff' : leg.textColor} />
      </View>
      <View style={{ flex: 1, gap: 2 }} accessibilityLiveRegion="polite">
        {title}
        <T style={small}>{offRoute ? 'Parece que saiu do caminho — siga a linha azul.' : sub}</T>
      </View>
    </View>
  );
}

export function Navigate({ itinerary, onEnd }: { itinerary: Itinerary; onEnd: () => void }) {
  const { height } = useWindowDimensions();
  const [me, setMe] = useState<Point | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now() / 1000);
  const [denied, setDenied] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const last = useRef<Point | null>(null);
  const minLeg = useRef(0);

  const update = (p: Point, h?: number | null) => {
    if (h != null && h >= 0 && !Number.isNaN(h)) setHeading(h);
    else if (last.current && dist(last.current, p) > 4) setHeading(bearing(last.current, p));
    if (!last.current || dist(last.current, p) > 2) last.current = p;
    setMe(p);
  };

  useEffect(() => { const id = setInterval(() => setNow(Date.now() / 1000), 1000); return () => clearInterval(id); }, []);

  useEffect(() => {
    const sim = Platform.OS === 'web' && typeof location !== 'undefined' && location.search.includes('sim=1');
    if (sim) {
      // Simulação a 3× a velocidade real: a pé ~1,4 m/s, em transporte ~9 m/s
      const segs = itinerary.legs.flatMap((l) => l.path.slice(1).map((p, k) => ({ a: l.path[k], b: p, v: (l.mode === 'WALK' ? 1.4 : 9) * 3 })));
      let si = 0, k = 0;
      const id = setInterval(() => {
        let move = (segs[si]?.v ?? 0);
        while (si < segs.length && move > 0) {
          const sgm = segs[si], len = dist(sgm.a, sgm.b), rest = len * (1 - k);
          if (move < rest) { k += move / Math.max(len, 0.01); move = 0; } else { move -= rest; si++; k = 0; }
        }
        const sgm = segs[Math.min(si, segs.length - 1)];
        if (sgm) update({ lat: sgm.a.lat + (sgm.b.lat - sgm.a.lat) * k, lon: sgm.a.lon + (sgm.b.lon - sgm.a.lon) * k });
      }, 1000);
      return () => clearInterval(id);
    }
    let sub: Location.LocationSubscription | null = null;
    let hsub: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setDenied(true); return; }
      sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 2, timeInterval: 1000 },
        (pos) => { setAccuracy(pos.coords.accuracy ?? null); update({ lat: pos.coords.latitude, lon: pos.coords.longitude }, pos.coords.speed && pos.coords.speed > 0.5 ? pos.coords.heading : null); });
      if (Platform.OS !== 'web') hsub = await Location.watchHeadingAsync((h) => setHeading(h.trueHeading >= 0 ? h.trueHeading : h.magHeading));
    })().catch(() => setDenied(true));
    return () => { sub?.remove(); hsub?.remove(); };
  }, [itinerary]);

  const where = useMemo(() => {
    if (!me) return null;
    const w = locate(itinerary, me, minLeg.current);
    // Num transporte, só avança para a perna seguinte quando a hora já passou do fim desta
    minLeg.current = w.leg;
    return w;
  }, [me, itinerary]);

  // Se ainda não há GPS, mostra a 1.ª perna; durante o transporte a hora manda
  let li = where?.leg ?? 0;
  const timeLeg = itinerary.legs.findIndex((l) => now < l.end);
  if (where && itinerary.legs[li].mode !== 'WALK' && timeLeg > li) li = timeLeg;
  const leg = itinerary.legs[li];
  const next = itinerary.legs[li + 1];
  const left = where && where.leg === li ? where.left : leg.distance ?? 0;
  const offRoute = !!where && where.d > 80;
  const sheet = 150;
  // Já dentro do transporte? Pela posição (se já avançou na linha) ou pela hora
  const riding = leg.mode !== 'WALK' && ((!!where && where.leg === li && where.idx > 1) || now >= leg.start);
  const stopIdx = useMemo(() => leg.stops.map((x) => leg.path.reduce((bi, p, i) => (dist(p, x) < dist(leg.path[bi], x) ? i : bi), 0)), [leg]);
  const ahead = leg.stops.filter((x, i) => (where && where.leg === li ? stopIdx[i] > where.idx : x.at > now));
  const phase: 'walk' | 'ride' = riding ? 'ride' : 'walk';
  const [nextAt, setNextAt] = useState<number | undefined>();
  useEffect(() => { setNextAt(undefined); if (leg.mode !== 'WALK') nextDepartures(leg, 1).then((x) => setNextAt(x[0]?.at)).catch(() => {}); }, [leg]);

  // Autocarros da Carris Metropolitana em tempo real, das linhas desta viagem, perto da paragem
  const cmLegs = itinerary.legs.filter((l) => l.mode === 'BUS' && l.agency?.includes('Carris Metropolitana') && l.route);
  useEffect(() => {
    if (!cmLegs.length) return;
    let alive = true;
    const go = () => fetchVehicles(cmLegs.map((l) => l.route!)).then((vs) => {
      if (!alive) return;
      setVehicles(vs.filter((v) => cmLegs.some((l) => l.route === v.line && dist(v, l.from) < 6000)));
    }).catch(() => {});
    go();
    const id = setInterval(go, 10000);
    return () => { alive = false; clearInterval(id); };
  }, [itinerary]);
  const busMarks = vehicles.map((v) => ({ ...v, color: cmLegs.find((l) => l.route === v.line)?.color ?? '#C5221F' }));
  const nearestBus = leg.mode === 'BUS' && now < leg.start ? vehicles.filter((v) => v.line === leg.route).sort((a, b) => dist(a, leg.from) - dist(b, leg.from))[0] : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: colors.ground }}>
      <RouteMap itinerary={itinerary} me={me} heading={heading} follow={!!me} height={height} bottomInset={sheet}
        accuracy={accuracy} progress={where ? { leg: where.leg, idx: where.idx } : null} vehicles={busMarks} phase={phase} />
      <Instruction leg={leg} next={next} left={left} now={now} offRoute={offRoute} busAway={nearestBus ? dist(nearestBus, leg.from) : undefined} riding={riding} ahead={ahead} nextAt={nextAt} />

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 18, paddingBottom: 26, gap: 12, boxShadow: '0 -4px 16px rgba(0,0,0,.12)' } as any}>
        <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.line }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <T bold style={{ fontSize: 26 }}>{Math.max(1, Math.round((itinerary.end - now) / 60))} min</T>
            <T style={{ color: colors.inkSoft }}>Chegada às {hhmm(itinerary.end)}</T>
          </View>
          <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
            {itinerary.legs.filter((l) => l.mode !== 'WALK').map((l, i) => <LineBadge key={i} leg={l} />)}
          </View>
        </View>
        {denied && <T style={{ color: colors.emergency }}>Sem acesso à localização: ative-a para o boneco andar no mapa.</T>}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable onPress={onEnd} accessibilityRole="button"
            style={{ flex: 1, minHeight: 52, borderRadius: 26, backgroundColor: '#C5221F', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
            <Icon name="back" color="#fff" size={20} />
            <T bold style={{ color: '#fff', fontSize: 18 }}>Terminar</T>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
