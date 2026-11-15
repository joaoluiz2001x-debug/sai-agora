/** Menu inferior: 4 separadores grandes, ícone + texto, indicador no ativo. Troca instantânea (uso frequente). */
import React from 'react';
import { Pressable, View } from 'react-native';
import { colors } from '../theme';
import { Icon, T } from './ui';

export type Tab = 'inicio' | 'viagem' | 'avisos' | 'ajustes';
const ITEMS: { id: Tab; icon: 'home' | 'route' | 'warn' | 'gear'; label: string }[] = [
  { id: 'inicio', icon: 'home', label: 'Início' },
  { id: 'viagem', icon: 'route', label: 'Nova viagem' },
  { id: 'avisos', icon: 'warn', label: 'Avisos' },
  { id: 'ajustes', icon: 'gear', label: 'Ajustes' },
];

export function TabBar({ tab, onChange, badge }: { tab: Tab; onChange: (t: Tab) => void; badge: number }) {
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.line, paddingBottom: 22, paddingTop: 6 }}>
      {ITEMS.map((it) => {
        const on = it.id === tab;
        return (
          <Pressable key={it.id} onPress={() => onChange(it.id)} accessibilityRole="tab" accessibilityState={{ selected: on }}
            accessibilityLabel={it.label + (it.id === 'avisos' && badge ? `, ${badge} nos seus trajetos` : '')}
            style={{ flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
            <View style={{ width: 56, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.cardOn : 'transparent' }}>
              <Icon name={it.icon} size={22} color={on ? colors.brand : colors.muted} sw={on ? 2.4 : 2} />
              {it.id === 'avisos' && badge > 0 && (
                <View style={{ position: 'absolute', top: -2, right: 8, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.emergency, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                  <T bold style={{ color: '#FFFFFF', fontSize: 11 }}>{badge}</T>
                </View>
              )}
            </View>
            <T bold={on} style={{ fontSize: 13, color: on ? colors.brand : colors.muted }}>{it.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}
