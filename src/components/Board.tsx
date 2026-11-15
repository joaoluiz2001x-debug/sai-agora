/**
 * "Painel de partidas": dígitos em placas escuras que viram (split-flap) quando mudam,
 * como nos painéis das estações. Com "reduzir movimento" ligado, mudam sem animação.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, View, ViewStyle } from 'react-native';
import { colors, font } from '../theme';
import { T, useReduceMotion } from './ui';

function Flap({ ch, size }: { ch: string; size: number }) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(1)).current;
  const prev = useRef(ch);
  useEffect(() => {
    if (prev.current === ch) return;
    prev.current = ch;
    if (reduce) return;
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
  }, [ch, reduce]);
  const w = size * 0.74, h = size * 1.18;
  return (
    <View style={{ width: w, height: h, borderRadius: size * 0.14, backgroundColor: colors.boardTile, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ transform: [{ perspective: 400 }, { rotateX: v.interpolate({ inputRange: [0, 1], outputRange: ['-90deg', '0deg'] }) }], opacity: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.2, 1, 1] }) }}>
        <T style={{ fontFamily: font.monoBold, fontSize: size, lineHeight: h, color: colors.amber, includeFontPadding: false } as any}>{ch}</T>
      </Animated.View>
      {/* dobradiça a meio, como numa placa real */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: h / 2 - 1, height: 2, backgroundColor: colors.board, opacity: 0.85 }} />
    </View>
  );
}

/** Mostra "MM:SS" (ou "H:MM" acima de uma hora) em placas. */
export function FlipTime({ seconds, size = 44, style }: { seconds: number; size?: number; style?: ViewStyle }) {
  const s = Math.max(0, Math.floor(seconds));
  const txt = s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}` : `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const unit = s >= 3600 ? 'h' : 'min';
  return (
    <View accessible accessibilityLabel={s >= 3600 ? `${Math.floor(s / 3600)} horas e ${Math.floor((s % 3600) / 60)} minutos` : `${Math.floor(s / 60)} minutos e ${s % 60} segundos`}
      style={[{ flexDirection: 'row', alignItems: 'center', gap: size * 0.1 }, style]}>
      {txt.split('').map((c, i) => c === ':'
        ? <T key={i} style={{ fontFamily: font.monoBold, fontSize: size * 0.8, color: colors.amber, marginHorizontal: 1 }}>:</T>
        : <Flap key={i} ch={c} size={size} />)}
      <T bold style={{ color: colors.boardMuted, fontSize: size * 0.36, marginLeft: 6, alignSelf: 'flex-end', marginBottom: size * 0.12 }}>{unit}</T>
    </View>
  );
}

/** Painel escuro com a etiqueta pequena em maiúsculas. */
export function BoardPanel({ label, children, style }: { label?: string; children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[{ backgroundColor: colors.board, borderRadius: 20, padding: 18, gap: 12 }, style]}>
      {!!label && <T style={{ fontFamily: font.mono, fontSize: 12, letterSpacing: 2.4, color: colors.amber } as any}>{label.toUpperCase()}</T>}
      {children}
    </View>
  );
}
