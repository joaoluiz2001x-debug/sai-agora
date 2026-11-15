/** 🎲 Ecrã simples ("modo avó"): uma só mensagem gigante, cor de fundo pelo estado, nada mais. */
import React from 'react';
import { Pressable, View } from 'react-native';
import { T } from '../components/ui';
import { Plan, Trip, countdown, hhmm } from '../lib/plan';
import { lineName } from '../data/transit';

export function Simple({ trip, plan, onExit }: { trip?: Trip; plan: Plan | null | undefined; onExit: () => void }) {
  const state = plan?.state ?? 'perdido';
  const bg = state === 'saia' ? '#B91C1C' : state === 'prepare' ? '#8A4B00' : state === 'cedo' ? '#14532D' : '#374151';
  const big = !plan ? 'SEM TRANSPORTE' : state === 'saia' ? 'SAIA AGORA' : countdown(plan.secondsToLeave).toUpperCase();
  const first = plan?.it.legs.find((l) => l.mode !== 'WALK');
  return (
    <View style={{ flex: 1, backgroundColor: bg, padding: 28, paddingTop: 80, paddingBottom: 40, justifyContent: 'space-between' }}>
      <View accessible accessibilityLiveRegion="polite"
        accessibilityLabel={!plan ? 'Não há transportes nas próximas horas' : `${state === 'saia' ? 'Saia agora' : 'Saia daqui a ' + countdown(plan.secondsToLeave)}.${first ? ` Apanhe o ${lineName(first)} às ${hhmm(first.start)} em ${first.from.name}.` : ''}`}
        style={{ gap: 18 }}>
        {trip && <T bold style={{ color: '#FFFFFF', fontSize: 26 }}>{trip.label}</T>}
        {plan && state !== 'saia' && <T bold style={{ color: '#FFFFFF', fontSize: 34, lineHeight: 40 }}>SAIA DAQUI A</T>}
        <T bold style={{ color: '#FFFFFF', fontSize: 84, lineHeight: 92 }} adjustsFontSizeToFit numberOfLines={2}>{big}</T>
        {first && (
          <T style={{ color: '#FFFFFF', fontSize: 28, lineHeight: 36 }}>
            Apanhe o <T bold style={{ color: '#FFFFFF', fontSize: 28 }}>{lineName(first)}</T> às <T bold style={{ color: '#FFFFFF', fontSize: 28 }}>{hhmm(first.start)}</T>{'\n'}
            em {first.from.name}
          </T>
        )}
      </View>
      <Pressable onPress={onExit} accessibilityRole="button" accessibilityLabel="Sair do ecrã simples"
        style={{ minHeight: 64, borderRadius: 16, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
        <T bold style={{ color: '#FFFFFF', fontSize: 22 }}>Voltar</T>
      </Pressable>
    </View>
  );
}
