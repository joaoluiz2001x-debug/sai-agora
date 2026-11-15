/** Detalhe da viagem: mapa + passos (a pé até à paragem, que autocarro/metro, onde sair, quando chega). */
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { colors } from '../theme';
import { EnterUp, Icon, PressableScale, T, s } from '../components/ui';
import { RouteMap } from '../components/RouteMap';
import { LineBadge, ModeIcon } from '../components/TransitUI';
import { Itinerary, Leg, TRANSITOUS_SOURCES, enrichWithCarrisMetropolitana, leaveTime, lineName } from '../data/transit';
import { countdown, hhmm } from '../lib/plan';

const mins = (a: number, b: number) => Math.max(1, Math.round((b - a) / 60));

function Step({ l, last, next }: { l: Leg; last: boolean; next?: Leg }) {
  const walk = l.mode === 'WALK';
  const dotColor = walk ? colors.lineStrong : l.color;
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
              {l.realTime ? '● Tempo real' : '○ Horário previsto'}{l.agency ? ` · ${l.mode === 'SUBWAY' ? lineName(l) + ' · ' : ''}${l.agency.replace(', E.P.E.', '')}` : ''}
            </T>
            <T style={{ fontSize: 16, color: colors.inkSoft }}>
              {l.stopsCount ? `${l.stopsCount} paragens · ` : ''}{mins(l.start, l.end)} min · saia em <T bold style={{ fontSize: 16 }}>{l.to.name}</T>
            </T>
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.ground }}>
      <RouteMap itinerary={it} height={Math.round(height * 0.38)} />
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Voltar"
        style={{ position: 'absolute', top: 48, left: 16, width: 48, height: 48, borderRadius: 24, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line }}>
        <Icon name="back" color={colors.ink} />
      </Pressable>

      <ScrollView style={{ flex: 1, marginTop: -16, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: colors.ground }}
        contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 16 }}>
        <EnterUp style={[s.card, { gap: 6 }]}>
          <T style={{ fontSize: 16, color: colors.muted }} numberOfLines={1}>{from} → {to}</T>
          <T style={{ fontSize: 18, color: colors.inkSoft }}>{leave <= 30 ? 'Saia de casa' : 'Saia de casa daqui a'}</T>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <T bold style={{ fontSize: 44, lineHeight: 52, color: leave <= 30 ? colors.emergency : colors.ink }}>{leave < -60 ? 'Já passou' : countdown(leave)}</T>
            <T style={{ fontSize: 18, color: colors.inkSoft }}>às {hhmm(leaveTime(it))}</T>
          </View>
          <T style={{ fontSize: 18 }}>Chega às <T bold style={{ fontSize: 18 }}>{hhmm(it.end)}</T> · {Math.round(it.duration / 60)} min · {it.transfers ? `${it.transfers} transbordo${it.transfers > 1 ? 's' : ''}` : 'sem transbordos'}</T>
        </EnterUp>

        <View style={[s.card, { paddingBottom: 4 }]}>
          {it.legs.map((l, i) => <Step key={i} l={l} last={i === it.legs.length - 1} next={it.legs[i + 1]} />)}
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingBottom: 12 }}>
            <View style={{ width: 32, alignItems: 'center' }}><Icon name="flag" color={colors.brand} /></View>
            <T bold style={{ fontSize: 18 }}>Chega a {to} às {hhmm(it.end)}</T>
          </View>
        </View>

        {onSave && (
          <PressableScale accessibilityRole="button" onPress={onSave} disabled={saved} style={[s.primaryBtn, { minHeight: 56, opacity: saved ? 0.6 : 1 }]}>
            <T bold style={{ color: colors.onBrand, fontSize: 18 }}>{saved ? 'Guardada' : 'Guardar e avisar-me quando sair'}</T>
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
