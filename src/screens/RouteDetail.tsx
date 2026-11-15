/** Detalhe da viagem: mapa + passos (a pé até à paragem, que autocarro/metro, onde sair, quando chega). */
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { colors } from '../theme';
import { EnterUp, Icon, PressableScale, T, s } from '../components/ui';
import { RouteMap } from '../components/RouteMap';
import { FlipTime } from '../components/Board';
import { font } from '../theme';
import { Navigate } from './Navigate';
import { LineBadge, ModeIcon } from '../components/TransitUI';
import { Itinerary, Leg, TRANSITOUS_SOURCES, enrichWithCarrisMetropolitana, leaveTime, lineName, nextDepartures } from '../data/transit';
import { Alert, fetchAlerts } from '../data/carris';
import { countdown, hhmm } from '../lib/plan';

const mins = (a: number, b: number) => Math.max(1, Math.round((b - a) / 60));

function Step({ l, last, next, alerts }: { l: Leg; last: boolean; next?: Leg; alerts: Alert[] }) {
  const walk = l.mode === 'WALK';
  const dotColor = walk ? colors.lineStrong : l.color;
  const [open, setOpen] = useState(false);
  const [after, setAfter] = useState<{ at: number; realTime: boolean; delay: number }[]>([]);
  useEffect(() => { if (!walk) nextDepartures(l).then(setAfter).catch(() => {}); }, [l.from.stopId, l.start]);
  const delay = Math.round((l.start - l.scheduledStart) / 60);
  const mine = walk ? [] : alerts.filter((a) => l.route && a.lines.includes(l.route));
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ alignItems: 'center', width: 32 }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: walk ? colors.card : l.color, borderWidth: walk ? 1 : 0, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
          <ModeIcon mode={l.mode} size={18} color={walk ? colors.inkSoft : l.textColor} />
        </View>
        {!last && <View style={{ flex: 1, width: walk ? 0 : 4, borderLeftWidth: walk ? 3 : 0, borderStyle: walk ? 'dotted' : 'solid', borderColor: colors.lineStrong, backgroundColor: walk ? 'transparent' : dotColor, marginVertical: 2, minHeight: 24 }} />}
      </View>
      <View style={{ flex: 1, paddingBottom: 18, gap: 4 }}>
        {walk ? (
          <>
            <T bold style={{ fontSize: 18 }}>Caminhe {mins(l.start, l.end)} min{l.distance ? ` (${Math.round(l.distance)} m)` : ''}</T>
            <T style={{ fontSize: 16, color: colors.inkSoft }}>
              até <T bold style={{ fontSize: 16 }}>{l.to.name}</T>{l.streets.length ? `, pela ${l.streets.join(' e ')}` : ''}
            </T>
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <LineBadge leg={l} large />
              <T bold style={{ fontSize: 18, flex: 1 }}>→ {l.headsign}</T>
            </View>
            <T style={{ fontSize: 16, color: colors.inkSoft }}>
              Apanhe em <T bold style={{ fontSize: 16 }}>{l.from.name}</T> às <T bold style={{ fontSize: 16 }}>{hhmm(l.start)}</T>
            </T>
            <T style={{ fontSize: 14, color: l.realTime ? colors.fast : colors.muted }}>
              {l.realTime ? (delay >= 2 ? `● Tempo real · ${delay} min atrasado` : delay <= -2 ? `● Tempo real · ${-delay} min adiantado` : '● Tempo real · a horas') : '○ Horário previsto'}{l.agency ? ` · ${l.mode === 'SUBWAY' ? lineName(l) + ' · ' : ''}${l.agency.replace(', E.P.E.', '')}` : ''}
            </T>
            <T style={{ fontSize: 16, color: colors.inkSoft }}>
              {l.stopsCount ? `${l.stopsCount} paragens · ` : ''}{mins(l.start, l.end)} min · saia em <T bold style={{ fontSize: 16 }}>{l.to.name}</T>
            </T>
            {after.length > 0 && (
              <T style={{ fontSize: 15, color: colors.inkSoft }}>Se perder este: <T bold style={{ fontSize: 15 }}>{after.map((x) => hhmm(x.at)).join(' · ')}</T></T>
            )}
            {mine.map((a) => (
              <View key={a.id} style={{ backgroundColor: '#FEF3C7', borderRadius: 10, padding: 10, gap: 2 }}>
                <T bold style={{ fontSize: 15, color: '#92400E' }}>⚠ {a.title}</T>
                <T style={{ fontSize: 14, color: '#92400E' }} numberOfLines={3}>{a.text}</T>
              </View>
            ))}
            {l.stops.length > 0 && (
              <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ minHeight: 40, justifyContent: 'center' }}>
                <T bold style={{ fontSize: 15, color: colors.brand }}>{open ? 'Esconder paragens' : `Ver as ${l.stops.length} paragens pelo caminho`}</T>
              </Pressable>
            )}
            {open && l.stops.map((x, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 3 }}>
                <View style={{ width: 9, height: 9, borderRadius: 5, borderWidth: 2, borderColor: l.color, backgroundColor: '#fff' }} />
                <T style={{ flex: 1, fontSize: 15, color: colors.inkSoft }} numberOfLines={1}>{x.name}</T>
                {!!x.at && <T style={{ fontSize: 14, color: colors.muted }}>{hhmm(x.at)}</T>}
              </View>
            ))}
            {next && next.mode !== 'WALK' && <T style={{ fontSize: 15, color: colors.brand }}>Mude logo para o seguinte.</T>}
          </>
        )}
      </View>
    </View>
  );
}

export function RouteDetail({ itinerary, from, to, onBack, onSave, saved }: {
  itinerary: Itinerary; from: string; to: string; onBack: () => void; onSave?: () => void; saved?: boolean;
}) {
  const { height } = useWindowDimensions();
  const [it, setIt] = useState(itinerary);
  const [now, setNow] = useState(Date.now() / 1000);
  useEffect(() => { setIt(itinerary); enrichWithCarrisMetropolitana(itinerary).then(setIt).catch(() => {}); }, [itinerary]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now() / 1000), 1000); return () => clearInterval(id); }, []);
  const leave = leaveTime(it) - now;
  const [alerts, setAlerts] = useState<Alert[]>([]);
  useEffect(() => { fetchAlerts().then(setAlerts).catch(() => {}); }, []);
  const [nav, setNav] = useState(false);
  if (nav) return <Navigate itinerary={it} onEnd={() => setNav(false)} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.ground }}>
      <RouteMap itinerary={it} height={Math.round(height * 0.38)} />
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Voltar"
        style={{ position: 'absolute', top: 48, left: 16, width: 48, height: 48, borderRadius: 24, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line }}>
        <Icon name="back" color={colors.ink} />
      </Pressable>

      <ScrollView style={{ flex: 1, marginTop: -16, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: colors.ground }}
        contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 16 }}>
        <EnterUp style={{ backgroundColor: colors.board, borderRadius: 20, padding: 18, gap: 8 }}>
          <T style={{ fontFamily: font.mono, fontSize: 12, letterSpacing: 2.4, color: colors.amber } as any} numberOfLines={1}>{(from + ' → ' + to).toUpperCase()}</T>
          <T style={{ fontSize: 16, color: colors.boardMuted }}>{leave <= 30 ? 'Saia de casa agora' : `Saia de casa às ${hhmm(leaveTime(it))} — faltam`}</T>
          {leave < -60 ? <T style={{ fontFamily: font.monoBold, fontSize: 36, color: colors.amber } as any}>JÁ PASSOU</T>
            : leave <= 30 ? <T style={{ fontFamily: font.monoBold, fontSize: 44, color: colors.amber } as any}>JÁ!</T>
            : <FlipTime seconds={leave} size={40} />}
          <T style={{ fontSize: 17, color: colors.boardInk }}>Chega às <T style={{ fontFamily: font.monoBold, fontSize: 17, color: colors.boardInk } as any}>{hhmm(it.end)}</T> · {Math.round(it.duration / 60)} min · {it.transfers ? `${it.transfers} transbordo${it.transfers > 1 ? 's' : ''}` : 'direto'}</T>
        </EnterUp>

        <View style={[s.card, { paddingBottom: 4 }]}>
          {it.legs.map((l, i) => <Step key={i} l={l} last={i === it.legs.length - 1} next={it.legs[i + 1]} alerts={alerts} />)}
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingBottom: 12 }}>
            <View style={{ width: 32, alignItems: 'center' }}><Icon name="flag" color={colors.brand} /></View>
            <T bold style={{ fontSize: 18 }}>Chega a {to} às {hhmm(it.end)}</T>
          </View>
        </View>

        <PressableScale accessibilityRole="button" onPress={() => setNav(true)} style={[s.primaryBtn, { minHeight: 56, flexDirection: 'row', gap: 10, backgroundColor: colors.amber }]}>
          <Icon name="nav" color={colors.onAmber} />
          <T bold style={{ color: colors.onAmber, fontSize: 18 }}>Iniciar viagem</T>
        </PressableScale>

        {onSave && (
          <PressableScale accessibilityRole="button" onPress={onSave} disabled={saved} style={[s.card, { minHeight: 56, alignItems: 'center', justifyContent: 'center', opacity: saved ? 0.6 : 1 }]}>
            <T bold style={{ color: colors.brand, fontSize: 18 }}>{saved ? 'Guardada' : 'Guardar e avisar-me quando sair'}</T>
          </PressableScale>
        )}

        <Pressable onPress={() => Linking.openURL(TRANSITOUS_SOURCES)} accessibilityRole="link">
          <T style={{ fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19 }}>
            Rotas: Transitous (fontes de dados) · Mapa: OpenFreeMap © OpenStreetMap{'\n'}Horários da Carris (Lisboa) sem tempo real.
          </T>
        </Pressable>
      </ScrollView>
    </View>
  );
}
