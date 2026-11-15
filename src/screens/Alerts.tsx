/** Avisos: greves, desvios e condicionamentos (feed oficial da Carris Metropolitana). */
import React from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { colors } from '../theme';
import { Icon, T, s } from '../components/ui';
import type { Alert } from '../data/carris';
import { Trip, tripLines, tripStops } from '../lib/plan';
import type { Itinerary } from '../data/transit';

export const KIND = {
  greve: { label: 'Greve', bg: '#FDE8E8', ink: '#8A1414' },
  desvio: { label: 'Desvio', bg: '#FFF4E0', ink: '#7A3E00' },
  paragem: { label: 'Paragem afetada', bg: '#FFF4E0', ink: '#7A3E00' },
  atraso: { label: 'Serviço reduzido', bg: '#FFF4E0', ink: '#7A3E00' },
  info: { label: 'Informação', bg: '#E8F1FB', ink: '#08467F' },
} as const;

/** Um aviso afeta a viagem se mencionar uma das linhas ou paragens do caminho atual. */
export function affects(a: Alert, it?: Itinerary) {
  const lines = tripLines(it), stops = tripStops(it);
  return a.lines.some((l) => lines.includes(l)) || a.stops.some((x) => stops.includes(x));
}

function date(u?: number) {
  if (!u) return '';
  const d = new Date(u * 1000);
  return `${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function Card({ a, trips, its }: { a: Alert; trips: Trip[]; its: Record<string, Itinerary | undefined> }) {
  const k = KIND[a.kind];
  const mine = trips.filter((t) => affects(a, its[t.id]));
  return (
    <View style={[s.card, { gap: 10 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <View style={{ backgroundColor: k.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
          <T bold style={{ color: k.ink, fontSize: 15 }}>{k.label}</T>
        </View>
        {!!a.lines.length && <T style={{ fontSize: 15, color: colors.muted }}>Linhas {a.lines.slice(0, 6).join(', ')}{a.lines.length > 6 ? '…' : ''}</T>}
      </View>
      <T bold style={{ fontSize: 18 }}>{a.title}</T>
      {!!a.text && <T style={{ fontSize: 16, lineHeight: 23, color: colors.inkSoft }}>{a.text}</T>}
      {(a.start || a.end) && <T style={{ fontSize: 14, color: colors.muted }}>{a.start ? `Desde ${date(a.start)}` : ''}{a.end ? ` · até ${date(a.end)}` : ''}</T>}
      {!!mine.length && <T bold style={{ fontSize: 15, color: colors.emergencyInk }}>Afeta: {mine.map((t) => t.label).join(', ')}</T>}
    </View>
  );
}

export function Alerts({ alerts, trips, its, refreshing, onRefresh, sample }: { alerts: Alert[] | null; trips: Trip[]; its: Record<string, Itinerary | undefined>; refreshing: boolean; onRefresh: () => void; sample: boolean }) {
  const mine = (alerts ?? []).filter((a) => trips.some((t) => affects(a, its[t.id])));
  const rest = (alerts ?? []).filter((a) => !mine.includes(a));
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.ground }} contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40, gap: 14 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}>
      <T bold accessibilityRole="header" style={{ fontSize: 28 }}>Greves e avisos</T>
      {sample && (
        <View style={{ backgroundColor: '#FFF7E6', borderWidth: 1, borderColor: '#F3D9A4', borderRadius: 12, padding: 12 }}>
          <T style={{ fontSize: 15, color: '#6B4204' }}>Demonstração: avisos de exemplo, não são reais.</T>
        </View>
      )}

      {alerts === null && <T style={{ color: colors.muted }}>A carregar avisos…</T>}

      {alerts && (
        <>
          <T bold style={{ fontSize: 20, marginTop: 4 }}>Nos seus trajetos</T>
          {mine.length ? mine.map((a) => <Card key={a.id} a={a} trips={trips} its={its} />) : (
            <View style={[s.card, { flexDirection: 'row', gap: 10, alignItems: 'center' }]}>
              <Icon name="check" color={colors.fast} sw={2.6} />
              <T style={{ fontSize: 17, flex: 1 }}>Sem avisos para as suas linhas.</T>
            </View>
          )}
          <T bold style={{ fontSize: 20, marginTop: 8 }}>Toda a rede</T>
          {rest.length ? rest.map((a) => <Card key={a.id} a={a} trips={trips} its={its} />) : <T style={{ color: colors.muted }}>Sem outros avisos.</T>}
        </>
      )}

      <View style={[s.card, { gap: 8, marginTop: 8 }]}>
        <T bold style={{ fontSize: 18 }}>Outros transportes</T>
        <T style={{ color: colors.inkSoft, lineHeight: 23 }}>Greves no comboio, metro e barco não estão nesta app. Consulte os avisos oficiais:</T>
        {[['CP — Comboios de Portugal', 'https://www.cp.pt'], ['Metro de Lisboa', 'https://www.metrolisboa.pt'], ['Transtejo / Soflusa', 'https://ttsl.pt'], ['Fertagus', 'https://www.fertagus.pt']].map(([l, u]) => (
          <Pressable key={u} onPress={() => Linking.openURL(u)} accessibilityRole="link" style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T bold style={{ color: colors.brand }}>{l}</T><Icon name="chevron" size={18} color={colors.brand} />
          </Pressable>
        ))}
      </View>
      <T style={{ fontSize: 14, color: colors.muted, textAlign: 'center' }}>Fonte: Carris Metropolitana (CC BY 4.0)</T>
    </ScrollView>
  );
}
