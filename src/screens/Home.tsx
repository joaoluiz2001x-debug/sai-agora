/**
 * Início: um cartão por viagem guardada com "Saia de casa daqui a X min", o resumo do caminho e a hora de chegada.
 * Tocar abre o caminho completo no mapa. O número muda a cada segundo sem animação (frequente → instantâneo).
 */
import React from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { colors } from '../theme';
import { EnterUp, Icon, PressableScale, T, s } from '../components/ui';
import { LegSummary } from '../components/TransitUI';
import { FlipTime } from '../components/Board';
import { font } from '../theme';
import { Plan, Trip, countdown, hhmm } from '../lib/plan';
import type { Alert } from '../data/carris';
import { affects } from './Alerts';

export const STATE = {
  cedo: { label: 'Tem tempo', bg: '#E7F5EE', ink: '#14532D', dot: colors.fast },
  prepare: { label: 'Prepare-se', bg: '#FFF4E0', ink: '#7A3E00', dot: colors.waitMid },
  saia: { label: 'Saia já!', bg: '#FDE8E8', ink: '#8A1414', dot: colors.emergency },
  perdido: { label: 'Sem ligação', bg: colors.track, ink: colors.inkSoft, dot: colors.muted },
} as const;

function greeting() {
  const h = new Date().getHours();
  return h < 6 ? 'Boa noite' : h < 13 ? 'Bom dia' : h < 20 ? 'Boa tarde' : 'Boa noite';
}

function TripCard({ trip, plan, error, notify, onNotify, onDelete, onOpen, alerts, onAlerts }: {
  trip: Trip; plan: Plan | null | undefined; error?: boolean; notify: boolean; onNotify: (v: boolean) => void; onDelete: () => void;
  onOpen: () => void; alerts: Alert[]; onAlerts: () => void;
}) {
  const st = plan ? STATE[plan.state] : STATE.perdido;
  return (
    <EnterUp deps={[plan?.it.id]} style={[s.card, { padding: 0, overflow: 'hidden', borderWidth: 0 }]}>
      <Pressable onPress={plan ? onOpen : undefined} accessibilityRole="button"
        accessibilityLabel={plan ? `${trip.label}. Saia de casa ${plan.state === 'saia' ? 'agora' : 'daqui a ' + countdown(plan.secondsToLeave)}. Chega às ${hhmm(plan.it.end)}. Ver caminho no mapa.` : trip.label}
        style={({ pressed }) => ({ padding: 18, gap: 14, backgroundColor: pressed ? colors.boardTile : colors.board })}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <T style={{ fontFamily: font.mono, fontSize: 12, letterSpacing: 2.4, color: colors.amber } as any}>PARTIDA</T>
            <T bold accessibilityRole="header" style={{ fontSize: 22, color: colors.boardInk }} numberOfLines={1}>{trip.label}</T>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: st.bg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: st.dot }} />
            <T bold style={{ color: st.ink, fontSize: 15 }}>{st.label}</T>
          </View>
        </View>

        {!!alerts.length && (
          <Pressable onPress={onAlerts} accessibilityRole="button" accessibilityLabel={`Aviso: ${alerts[0].title}. Ver avisos`}
            style={{ flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: colors.amber, borderRadius: 10, padding: 10 }}>
            <Icon name="warn" size={20} color={colors.onAmber} />
            <T bold style={{ color: colors.onAmber, fontSize: 15, flex: 1 }} numberOfLines={2}>{alerts[0].title}</T>
          </Pressable>
        )}

        {plan === undefined && !error && <T style={{ color: colors.boardMuted }}>A calcular o caminho…</T>}
        {error && <T style={{ color: colors.boardMuted }}>Sem ligação à internet para calcular o caminho.</T>}
        {plan === null && <T style={{ fontSize: 18, color: colors.boardInk }}>Não há transportes nas próximas horas.</T>}
        {plan && (
          <>
            <View style={{ gap: 6 }}>
              <T style={{ fontSize: 16, color: colors.boardMuted }}>{plan.state === 'saia' ? 'Saia de casa agora' : `Saia de casa às ${hhmm(plan.leaveAt)} — faltam`}</T>
              {plan.state === 'saia'
                ? <T style={{ fontFamily: font.monoBold, fontSize: 44, color: colors.amber } as any}>JÁ!</T>
                : <FlipTime seconds={plan.secondsToLeave} size={42} />}
            </View>
            <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 10 }}><LegSummary it={plan.it} /></View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <T style={{ fontSize: 17, color: colors.boardInk }}>Chega às <T style={{ fontFamily: font.monoBold, fontSize: 17, color: colors.boardInk } as any}>{hhmm(plan.it.end)}</T></T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <T bold style={{ color: colors.amber }}>Ver no mapa</T><Icon name="chevron" size={18} color={colors.amber} />
              </View>
            </View>
          </>
        )}
      </Pressable>

      <View style={{ paddingHorizontal: 18, paddingVertical: 8, gap: 2, borderTopWidth: 1, borderTopColor: colors.line }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 }}>
          <Icon name="bell" size={22} color={colors.inkSoft} />
          <T style={{ fontSize: 17, flex: 1 }} nativeID={'n' + trip.id}>Avisar-me quando for para sair</T>
          <Switch accessibilityLabelledBy={'n' + trip.id} value={notify} onValueChange={onNotify}
            trackColor={{ true: colors.brand, false: colors.lineStrong }} thumbColor="#FFFFFF" />
        </View>
        <Pressable onPress={onDelete} accessibilityRole="button" accessibilityLabel={`Apagar viagem ${trip.label}`}
          style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
          <Icon name="trash" size={18} color={colors.muted} /><T style={{ color: colors.muted, fontSize: 15 }}>Apagar</T>
        </Pressable>
      </View>
    </EnterUp>
  );
}

export function Home(props: {
  trips: Trip[]; plans: Record<string, Plan | null | undefined>; errors: Record<string, boolean>; notify: Record<string, boolean>; alerts: Alert[];
  onNotify: (id: string, v: boolean) => void; onDelete: (id: string) => void; onPlan: () => void; onSimple: () => void; onAlerts: () => void;
  onOpen: (t: Trip) => void;
}) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.ground }} contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 32, gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <View>
          <T style={{ fontFamily: font.mono, fontSize: 13, letterSpacing: 3, color: colors.brand } as any}>SAI AGORA · {greeting().toUpperCase()}</T>
          <T bold accessibilityRole="header" style={{ fontSize: 30 }}>As suas partidas</T>
        </View>
        {props.trips.length > 0 && (
          <Pressable onPress={props.onSimple} accessibilityRole="button" accessibilityLabel="Abrir ecrã simples, com letras gigantes"
            style={{ minHeight: 48, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.lineStrong, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.card }}>
            <Icon name="eye" size={20} color={colors.brand} /><T bold style={{ color: colors.brand }}>Simples</T>
          </Pressable>
        )}
      </View>

      {!props.trips.length && (
        <View style={[s.card, { alignItems: 'center', gap: 12, padding: 28 }]}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.cardOn, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="route" size={36} color={colors.brand} />
          </View>
          <T bold style={{ fontSize: 22, textAlign: 'center' }}>Ainda não tem viagens</T>
          <T style={{ fontSize: 17, color: colors.inkSoft, textAlign: 'center', lineHeight: 24 }}>Diga-nos de onde sai e para onde vai. Mostramos o caminho e dizemos quando sair de casa.</T>
          <PressableScale accessibilityRole="button" onPress={props.onPlan} outerStyle={{ alignSelf: 'stretch' }} style={[s.primaryBtn, { minHeight: 56 }]}>
            <T bold style={{ color: colors.onBrand, fontSize: 18 }}>Planear a primeira viagem</T>
          </PressableScale>
        </View>
      )}

      {props.trips.map((t) => (
        <TripCard key={t.id} trip={t} plan={props.plans[t.id]} error={props.errors[t.id]} notify={!!props.notify[t.id]}
          alerts={props.alerts.filter((a) => affects(a, props.plans[t.id]?.it))}
          onOpen={() => props.onOpen(t)} onAlerts={props.onAlerts} onNotify={(v) => props.onNotify(t.id, v)} onDelete={() => props.onDelete(t.id)} />
      ))}

      {props.trips.length > 0 && (
        <PressableScale accessibilityRole="button" onPress={props.onPlan} style={[s.ghostBtn, { minHeight: 56, borderWidth: 2, borderColor: colors.brand, borderStyle: 'dashed' }]}>
          <T bold style={{ color: colors.brand, fontSize: 18 }}>+ Nova viagem</T>
        </PressableScale>
      )}
    </ScrollView>
  );
}
